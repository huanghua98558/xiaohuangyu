/**
 * 图片审核 Worker - 优化版
 * 
 * 优化内容：
 * 1. Redis 共享轮询索引 - 解决多 Worker 负载不均
 * 2. 服务健康检查 + 自动摘除 - 运行时监控服务状态
 * 3. 百炼 AI 降级机制 - OCR/YOLO 都不可用时降级
 * 4. 超时配置优化 - OCR 10s, YOLO 5s
 */

import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Queue } from 'bullmq';
import redisConnection from '../config/queue.js';
import db from '../config/database.js';
import { publishImageReviewComplete } from '../utils/wsEventPublisher.js';

async function fetchClaimForPush(claimId) {
  try {
    const row = await db.queryOne(`
      SELECT id, user_id, task_id, screenshots, status, ai_review_status, ai_confidence,
             ai_reason, review_note, image_review_status, link_review_status,
             image_review_reason, link_review_reason, reject_count, review_history,
             claimed_at, submitted_at, reviewed_at, block_status
      FROM claims WHERE id = $1
    `, [claimId]);
    return row || null;
  } catch (e) {
    console.error('[ImageWorker] fetchClaimForPush failed:', e.message);
    return null;
  }
}
import promotionService from '../services/promotionService.js';
import pointsSettlementService from '../services/pointsSettlementService.js';
import { notifyClaimRejected, notifyManualReviewQueued } from '../services/notificationService.js';
import reviewConfigService from '../services/ai/reviewConfigService.js';
import { CLAIM_STATUS } from '../constants/claimLifecycle.js';
import { appendReviewHistory, createReviewHistoryEntry } from '../utils/claimReviewHistory.js';
import { matchAuthorWithTolerance } from '../utils/authorMatch.js';
import {
  buildSubmissionScreenshotEntries,
  getScreenshotRoleLabel,
  isCommentScreenshotRole,
  normalizeScreenshotEntries,
} from '../utils/claimScreenshots.js';
import { getOcrServicePools } from '../utils/ocrServicePools.js';

dotenv.config();
const execFileAsync = promisify(execFile);
const PM2_BIN = process.env.PM2_BIN || 'pm2';

// ============ 配置 ============

// 服务配置
const OCR_SERVICE_POOLS = getOcrServicePools();
const LOCAL_OCR_PROCESS_BY_URL = {
  'http://127.0.0.1:9001': 'ocr-service-1',
  'http://127.0.0.1:9002': 'ocr-service-2'
};
const OCR_SERVICES_CONFIG = OCR_SERVICE_POOLS.all.map((url) => ({
  url,
  healthy: true,
  lastCheck: 0,
  failCount: 0,
  lastFailureAt: 0,
  lastSuccessAt: 0,
  quarantineUntil: 0,
  restarting: false,
  lastRestartAt: 0,
  restartCount: 0,
}));
const YOLO_SERVICE_CONFIG = { url: 'http://127.0.0.1:8003', healthy: true, lastCheck: 0, failCount: 0 };

// 超时与吞吐配置
const IMAGE_WORKER_CONFIG = {
  pollIntervalMs: readIntegerConfig(process.env.IMAGE_REVIEW_POLL_INTERVAL_MS, 3000, 500),
  batchSize: readIntegerConfig(process.env.IMAGE_REVIEW_BATCH_SIZE, 5, 1),
  ocrTimeoutMs: readIntegerConfig(process.env.IMAGE_REVIEW_OCR_TIMEOUT_MS, 10000, 1000),
  yoloTimeoutMs: readIntegerConfig(process.env.IMAGE_REVIEW_YOLO_TIMEOUT_MS, 5000, 1000),
  healthTimeoutMs: readIntegerConfig(process.env.IMAGE_REVIEW_HEALTH_TIMEOUT_MS, 3000, 500),
  bailianTimeoutMs: readIntegerConfig(process.env.IMAGE_REVIEW_BAILIAN_TIMEOUT_MS, 30000, 5000)
};

const TIMEOUTS = {
  OCR: IMAGE_WORKER_CONFIG.ocrTimeoutMs,
  YOLO: IMAGE_WORKER_CONFIG.yoloTimeoutMs,
  HEALTH_CHECK: IMAGE_WORKER_CONFIG.healthTimeoutMs,
  BAILIAN: IMAGE_WORKER_CONFIG.bailianTimeoutMs
}
const REVIEW_SETTINGS_CACHE = {
  value: null,
  loadedAt: 0,
  ttlMs: 30000
};

function normalizeDetectedValue(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'object') {
    return normalizeDetectedValue(
      value.text ??
      value.content ??
      value.value ??
      value.name ??
      value.nickname ??
      value.author ??
      null
    );
  }

  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text) return null;

  const lowered = text.toLowerCase();
  if (['null', 'undefined', 'none', 'n/a', '没有', '无'].includes(lowered)) {
    return null;
  }

  return text;
}

async function getEffectiveReviewConfig() {
  const now = Date.now();
  if (REVIEW_SETTINGS_CACHE.value && now - REVIEW_SETTINGS_CACHE.loadedAt < REVIEW_SETTINGS_CACHE.ttlMs) {
    return REVIEW_SETTINGS_CACHE.value;
  }

  const config = await reviewConfigService.getConfig();
  const merged = {
    ...config,
    checks: { ...(config?.checks || {}) }
  };

  try {
    const legacyRow = await db.queryOne(
      "SELECT value FROM ai_configs WHERE key = 'image_review_settings' LIMIT 1"
    );
    if (legacyRow?.value) {
      const legacy = JSON.parse(legacyRow.value);
      if (legacy?.checks && typeof legacy.checks === 'object') {
        merged.checks = {
          ...merged.checks,
          ...legacy.checks
        };
      }
    }
  } catch (error) {
    console.warn('[Worker] 读取 image_review_settings 失败，使用全局审核配置:', error.message);
  }

  REVIEW_SETTINGS_CACHE.value = merged;
  REVIEW_SETTINGS_CACHE.loadedAt = now;
  return merged;
}

function extractCommentContent(value) {
  if (!value) return null;
  if (typeof value === 'object') {
    return normalizeDetectedValue(
      value.content ??
      value.text ??
      value.comment ??
      value.value ??
      null
    );
  }
  return normalizeDetectedValue(value);
}

function createCombinedEvidence(source = 'ocr_yolo') {
  return {
    source,
    has_comment_keyword: false,
    commenterNickname: null,
    comment: null,
    authorName: null,
    commentExtraction: {
      confidence: null,
      hasStructuredBlock: false,
      hasNickname: false,
      hasComment: false,
      contentMissing: false,
      trustedNickname: false,
      trustedComment: false
    },
    interaction: {
      hasLike: false,
      hasFavorite: false,
      hasFollow: false
    },
    screenshots: []
  };
}

function mergeInteractionState(target, source = {}) {
  if (!target || !source) return;
  target.hasLike = Boolean(target.hasLike || source.hasLike || source.has_like);
  target.hasFavorite = Boolean(target.hasFavorite || source.hasFavorite || source.has_favorite);
  target.hasFollow = Boolean(target.hasFollow || source.hasFollow || source.has_follow);
}

function mergeOcrEvidence(combinedEvidence, ocrResult, screenshotIndex, expectedRole = 'homepage') {
  if (!combinedEvidence || !ocrResult) return false;

  const structuredComment = ocrResult.first_comment || null;
  const commentText = extractCommentContent(structuredComment?.content || ocrResult.comment);
  const explicitType = ocrResult.detectedType || ocrResult.detected_type || null;
  const authorName = normalizeDetectedValue(
    ocrResult.authorName ||
    ocrResult.author_name ||
    (explicitType === 'homepage' ? ocrResult.author : null)
  );
  const commenterNickname = normalizeDetectedValue(
    structuredComment?.nickname ||
    ocrResult.commenterNickname ||
    ocrResult.commenter_nickname ||
    (explicitType === 'comment' ? ocrResult.author : null)
  );
  const extractionConfidence = normalizeDetectedValue(
    structuredComment?.confidence ||
    ocrResult.extraction_confidence ||
    null
  );
  const confidenceLevel = String(extractionConfidence || '').toLowerCase();
  const hasStructuredCommentBlock = Boolean(
    structuredComment?.nickname ||
    structuredComment?.content ||
    (Array.isArray(ocrResult.comment_candidates) && ocrResult.comment_candidates.length > 0)
  );
  const contentMissing = Boolean(
    structuredComment?.contentMissing ||
    (structuredComment?.nickname && !structuredComment?.content)
  );
  const trustCommentContent = !isCommentScreenshotRole(expectedRole) || ['high', 'medium'].includes(confidenceLevel);
  const trustCommentNickname = !isCommentScreenshotRole(expectedRole)
    ? false
    : Boolean(commenterNickname) && (['high', 'medium'].includes(confidenceLevel) || contentMissing || hasStructuredCommentBlock);

  let isCommentScreenshot = false;
  if (isCommentScreenshotRole(expectedRole)) {
    isCommentScreenshot = true;
  } else if (expectedRole === 'homepage' || expectedRole === 'profile') {
    isCommentScreenshot = false;
  } else if (explicitType === 'comment') {
    isCommentScreenshot = true;
  } else if (explicitType === 'homepage') {
    isCommentScreenshot = false;
  } else if (!isCommentScreenshotRole(expectedRole) && authorName) {
    isCommentScreenshot = false;
  } else {
    isCommentScreenshot = Boolean(ocrResult.has_comment_keyword || commentText || commenterNickname);
  }

  combinedEvidence.has_comment_keyword = Boolean(
    combinedEvidence.has_comment_keyword ||
    (explicitType === 'comment' ? true : ocrResult.has_comment_keyword) ||
    commentText
  );

  combinedEvidence.authorName = combinedEvidence.authorName || authorName;

  if (isCommentScreenshot) {
    if (trustCommentContent) {
      combinedEvidence.comment = combinedEvidence.comment || commentText;
    }
    if (trustCommentNickname) {
      combinedEvidence.commenterNickname = combinedEvidence.commenterNickname || commenterNickname;
    }
    combinedEvidence.commentExtraction = {
      confidence: extractionConfidence || combinedEvidence.commentExtraction?.confidence || 'unknown',
      hasStructuredBlock: Boolean(combinedEvidence.commentExtraction?.hasStructuredBlock || hasStructuredCommentBlock),
      hasNickname: Boolean(combinedEvidence.commentExtraction?.hasNickname || commenterNickname),
      hasComment: Boolean(combinedEvidence.commentExtraction?.hasComment || commentText),
      contentMissing: Boolean(combinedEvidence.commentExtraction?.contentMissing || contentMissing),
      trustedNickname: Boolean(combinedEvidence.commentExtraction?.trustedNickname || trustCommentNickname),
      trustedComment: Boolean(combinedEvidence.commentExtraction?.trustedComment || trustCommentContent)
    };
  } else {
    combinedEvidence.authorName = combinedEvidence.authorName || authorName;
  }

  mergeInteractionState(combinedEvidence.interaction, ocrResult.interaction);

  combinedEvidence.screenshots.push({
    screenshotIndex,
    source: 'ocr',
    screenType: isCommentScreenshot ? 'comment' : 'profile',
    hasCommentKeyword: Boolean(ocrResult.has_comment_keyword),
    commenterNickname: isCommentScreenshot ? (trustCommentNickname ? (commenterNickname || '没有') : '低置信度未采信') : '没有',
    comment: trustCommentContent ? (commentText || '没有') : (contentMissing ? '正文未识别' : '低置信度未采信'),
    authorName: authorName || '没有',
    firstComment: structuredComment || null,
    extractionConfidence: extractionConfidence || 'unknown',
    commentCandidates: Array.isArray(ocrResult.comment_candidates) ? ocrResult.comment_candidates.slice(0, 3) : [],
    contentMissing,
    trustedNickname: trustCommentNickname,
    trustedComment: trustCommentContent
  });

  return isCommentScreenshot;
}

function mergeAiEvidence(combinedEvidence, aiResult, screenshotIndex) {
  if (!combinedEvidence || !aiResult) return false;

  const normalizedType = aiResult.type === 'B' ? 'profile' : 'comment';
  const commentText = extractCommentContent(aiResult.comment);
  const commenterNickname = normalizeDetectedValue(
    aiResult.commenterNickname ||
    (normalizedType === 'comment' ? aiResult.author : null)
  );
  const authorName = normalizeDetectedValue(
    aiResult.authorName ||
    (normalizedType === 'profile' ? aiResult.author : null)
  );

  combinedEvidence.has_comment_keyword = Boolean(
    combinedEvidence.has_comment_keyword ||
    aiResult.has_comment_keyword ||
    commentText
  );

  if (normalizedType === 'comment') {
    combinedEvidence.comment = combinedEvidence.comment || commentText;
    combinedEvidence.commenterNickname = combinedEvidence.commenterNickname || commenterNickname;
  } else {
    combinedEvidence.authorName = combinedEvidence.authorName || authorName;
  }

  mergeInteractionState(combinedEvidence.interaction, aiResult.interaction);

  combinedEvidence.screenshots.push({
    screenshotIndex,
    source: aiResult.source || 'bailian_ai',
    screenType: normalizedType,
    hasCommentKeyword: Boolean(aiResult.has_comment_keyword),
    commenterNickname: normalizedType === 'comment' ? (commenterNickname || '没有') : '没有',
    comment: commentText || '没有',
    authorName: normalizedType === 'profile' ? (authorName || '没有') : '没有'
  });

  return normalizedType === 'comment';
}

function readIntegerConfig(value, fallback, minimum = null) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (minimum !== null) {
    return Math.max(minimum, parsed);
  }

  return parsed;
}

// ============ 链接审查延迟配置 ============
async function getLinkVerifyConfig() {
  try {
    const configs = await db.queryMany(
      "SELECT key, value FROM ai_configs WHERE key LIKE 'link_verify_%'"
    );
    const config = {
      delayMinutes: 0,
      batchThreshold: 5,
      maxWaitMinutes: 120,
      batchSize: 10,
      retryCount: 3,
      enabled: true
    };
    for (const c of configs) {
      if (c.key === "link_verify_delay_minutes") config.delayMinutes = readIntegerConfig(c.value, config.delayMinutes, 0);
      if (c.key === "link_verify_batch_threshold") config.batchThreshold = readIntegerConfig(c.value, config.batchThreshold, 1);
      if (c.key === "link_verify_max_wait_minutes") config.maxWaitMinutes = readIntegerConfig(c.value, config.maxWaitMinutes, 0);
      if (c.key === "link_verify_batch_size") config.batchSize = readIntegerConfig(c.value, config.batchSize, 1);
      if (c.key === "link_verify_retry_count") config.retryCount = readIntegerConfig(c.value, config.retryCount, 1);
      if (c.key === "link_verify_enabled") config.enabled = c.value === "true";
    }
    return config;
  } catch (e) {
    console.log("[Worker] 获取链接审查配置失败:", e.message);
    return { delayMinutes: 0, batchThreshold: 5, maxWaitMinutes: 120, batchSize: 10, retryCount: 3, enabled: true };
  }
}

// 健康检查配置
const HEALTH_CONFIG = {
  CHECK_INTERVAL: readIntegerConfig(process.env.IMAGE_REVIEW_HEALTH_CHECK_INTERVAL_MS, 10000, 1000),
  FAIL_THRESHOLD: 3,        // 连续失败 3 次标记为不健康
  RECOVERY_THRESHOLD: 1,    // 成功 1 次即恢复
  QUARANTINE_MS: readIntegerConfig(process.env.IMAGE_REVIEW_OCR_QUARANTINE_MS, 90000, 5000),
  RESTART_COOLDOWN_MS: readIntegerConfig(process.env.IMAGE_REVIEW_OCR_RESTART_COOLDOWN_MS, 180000, 10000),
  PM2_RESTART_TIMEOUT_MS: readIntegerConfig(process.env.IMAGE_REVIEW_OCR_PM2_RESTART_TIMEOUT_MS, 15000, 2000)
};

// 本地存储根目录
const LOCAL_STORAGE_DIR = process.env.LOCAL_STORAGE_DIR || '/data/images/uploads';

// 链接验证延迟队列
const linkDelayQueue = new Queue('link-delay-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 }
  }
});

// 轮询配置
const POLL_INTERVAL = IMAGE_WORKER_CONFIG.pollIntervalMs;
const BATCH_SIZE = IMAGE_WORKER_CONFIG.batchSize;

// Redis 轮询索引 Key
const REDIS_KEYS = {
  OCR_INDEX_HOMEPAGE: 'image:worker:ocr:index:homepage',
  OCR_INDEX_COMMENT: 'image:worker:ocr:index:comment',
  HEALTH_STATUS: 'image:worker:health:status',
  OCR_RESTART_LOCK_PREFIX: 'image:worker:ocr:restart:lock:'
};

function isLocalOcrService(serviceUrl) {
  return Boolean(LOCAL_OCR_PROCESS_BY_URL[serviceUrl]);
}

function isServiceQuarantined(serviceConfig) {
  return Boolean(serviceConfig?.quarantineUntil && serviceConfig.quarantineUntil > Date.now());
}

async function triggerLocalOcrRestart(serviceConfig, reason = 'health_failure') {
  if (!serviceConfig) return false;

  const processName = LOCAL_OCR_PROCESS_BY_URL[serviceConfig.url];
  if (!processName) return false;

  const now = Date.now();
  if (serviceConfig.restarting) return false;
  if (serviceConfig.lastRestartAt && now - serviceConfig.lastRestartAt < HEALTH_CONFIG.RESTART_COOLDOWN_MS) {
    return false;
  }

  serviceConfig.restarting = true;
  serviceConfig.lastRestartAt = now;
  serviceConfig.restartCount = (serviceConfig.restartCount || 0) + 1;
  serviceConfig.quarantineUntil = Math.max(serviceConfig.quarantineUntil || 0, now + HEALTH_CONFIG.QUARANTINE_MS);

  const lockKey = `${REDIS_KEYS.OCR_RESTART_LOCK_PREFIX}${processName}`;
  try {
    const locked = await redisConnection.set(
      lockKey,
      String(now),
      'PX',
      HEALTH_CONFIG.RESTART_COOLDOWN_MS,
      'NX'
    );
    if (locked !== 'OK') {
      serviceConfig.restarting = false;
      return false;
    }
  } catch (error) {
    console.warn(`[Health] OCR ${serviceConfig.url} 获取重启锁失败，继续尝试本地重启: ${error.message}`);
  }

  console.warn(`[Health] ♻️ OCR ${serviceConfig.url} 触发自动重启 (${reason})，进程=${processName}`);

  try {
    await execFileAsync(PM2_BIN, ['restart', processName], {
      timeout: HEALTH_CONFIG.PM2_RESTART_TIMEOUT_MS
    });
    console.log(`[Health] ✅ OCR ${serviceConfig.url} 自动重启命令已执行`);
    return true;
  } catch (error) {
    console.error(`[Health] OCR ${serviceConfig.url} 自动重启失败: ${error.message}`);
    return false;
  } finally {
    serviceConfig.restarting = false;
  }
}

function markServiceUnhealthy(serviceConfig, serviceName, reason = 'runtime_failure') {
  if (!serviceConfig) return;

  serviceConfig.lastFailureAt = Date.now();

  if (serviceConfig.failCount >= HEALTH_CONFIG.FAIL_THRESHOLD) {
    if (serviceConfig.healthy) {
      console.warn(`[Health] ❌ ${serviceName} 标记为不健康 (连续失败 ${serviceConfig.failCount} 次)`);
    }
    serviceConfig.healthy = false;
    serviceConfig.quarantineUntil = Math.max(serviceConfig.quarantineUntil || 0, Date.now() + HEALTH_CONFIG.QUARANTINE_MS);
    void triggerLocalOcrRestart(serviceConfig, reason);
  }
}

// ============ Redis 共享轮询索引 ============

/**
 * 获取下一个 OCR 服务 (Redis 共享索引)
 */
function getOcrPoolByRole(role) {
  return isCommentScreenshotRole(role) ? OCR_SERVICE_POOLS.comment : OCR_SERVICE_POOLS.homepage;
}

async function getNextOcrService(role = 'homepage') {
  try {
    const key = isCommentScreenshotRole(role) ? REDIS_KEYS.OCR_INDEX_COMMENT : REDIS_KEYS.OCR_INDEX_HOMEPAGE;
    const pool = getOcrPoolByRole(role);
    const servicePool = pool.length > 0 ? pool : OCR_SERVICE_POOLS.all;
    if (servicePool.length === 0) {
      return null;
    }

    // 使用 Redis INCR 实现原子递增
    const index = await redisConnection.incr(key);
    const serviceIndex = (index - 1) % servicePool.length;
    
    // 获取健康的服务
    const healthyServices = OCR_SERVICES_CONFIG.filter(
      (service) => servicePool.includes(service.url) && service.healthy && !isServiceQuarantined(service)
    );
    if (healthyServices.length === 0) {
      return null;
    }
    
    // 从健康服务中选择
    const healthyIndex = (index - 1) % healthyServices.length;
    return healthyServices[healthyIndex].url;
  } catch (e) {
    // Redis 失败时使用随机选择
    console.warn('[Worker] Redis 获取索引失败，使用随机选择');
    const pool = getOcrPoolByRole(role);
    const servicePool = pool.length > 0 ? pool : OCR_SERVICE_POOLS.all;
    if (servicePool.length === 0) {
      return null;
    }
    const healthyServices = OCR_SERVICES_CONFIG.filter(
      (service) => servicePool.includes(service.url) && service.healthy && !isServiceQuarantined(service)
    );
    if (healthyServices.length === 0) {
      return null;
    }
    return healthyServices[Math.floor(Math.random() * healthyServices.length)].url;
  }
}

// ============ 服务健康检查 ============

/**
 * 检查单个服务健康状态
 */
async function checkServiceHealth(serviceConfig, serviceName) {
  try {
    const res = await axios.get(`${serviceConfig.url}/health`, { 
      timeout: TIMEOUTS.HEALTH_CHECK 
    });
    
    serviceConfig.lastCheck = Date.now();
    if (res.status === 200) {
      serviceConfig.failCount = 0;
      serviceConfig.lastSuccessAt = Date.now();
      serviceConfig.quarantineUntil = 0;
      if (!serviceConfig.healthy) {
        console.log(`[Health] ✅ ${serviceName} 恢复健康`);
      }
      serviceConfig.healthy = true;
      return true;
    }
  } catch (e) {
    serviceConfig.failCount++;
    serviceConfig.lastCheck = Date.now();

    markServiceUnhealthy(serviceConfig, serviceName, 'health_check_failed');
  }
  return serviceConfig.healthy;
}

/**
 * 定时健康检查
 */
async function startHealthCheck() {
  const check = async () => {
    // 检查 OCR 服务
    for (const service of OCR_SERVICES_CONFIG) {
      await checkServiceHealth(service, `OCR ${service.url}`);
    }
    
    // 检查 YOLO 服务
    await checkServiceHealth(YOLO_SERVICE_CONFIG, 'YOLO');
    
    // 汇总状态
    const healthyOcr = OCR_SERVICES_CONFIG.filter(s => s.healthy).length;
    const yoloHealthy = YOLO_SERVICE_CONFIG.healthy;
    
    console.log(`[Health] 状态: OCR ${healthyOcr}/${OCR_SERVICES_CONFIG.length} 健康, YOLO ${yoloHealthy ? '健康' : '不健康'}`);
  };
  
  // 启动时立即检查一次
  await check();
  
  // 定时检查
  setInterval(check, HEALTH_CONFIG.CHECK_INTERVAL);
}

/**
 * 报告服务调用成功
 */
function reportServiceSuccess(serviceUrl) {
  const service = OCR_SERVICES_CONFIG.find(s => s.url === serviceUrl);
  if (service) {
    service.failCount = 0;
    service.healthy = true;
    service.lastSuccessAt = Date.now();
    service.quarantineUntil = 0;
  }
}

/**
 * 报告服务调用失败
 */
function reportServiceFailure(serviceUrl) {
  const service = OCR_SERVICES_CONFIG.find(s => s.url === serviceUrl);
  if (service) {
    service.failCount++;
    markServiceUnhealthy(service, `OCR ${serviceUrl}`, 'runtime_timeout');
  }
}

// ============ 百炼 AI 降级 ============

/**
 * 调用百炼 AI 进行图片审核 (降级方案)
 */
async function callBailianAI(imagePath, taskContext) {
  console.log('[Worker] 🔄 降级到百炼 AI 审核...');
  
  try {
    if (!imagePath || typeof imagePath !== 'string' || !fs.existsSync(imagePath)) {
      console.warn(`[Worker] 百炼降级跳过，无效图片路径: ${imagePath}`);
      return null;
    }

    // 读取图片并转为 base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
    
    // 调用百炼 AI API
    const response = await axios.post(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
      {
        model: 'qwen-vl-plus',
        input: {
          messages: [
            {
              role: 'user',
              content: [
                { image: `data:${mimeType};base64,${base64Image}` },
                { text: `请只返回 JSON，不要输出其它解释。分析这张小红书截图：

【图片类型判断】
- comment_screenshot：评论区截图，包含评论列表
- author_profile：达人主页，显示头像、名字、右侧有互动按钮

【达人主页互动状态识别 - 重点！】
这是小红书达人主页，请仔细观察右侧一列互动按钮区域（从上到下依次是：点赞、收藏、关注）：

1. 点赞状态（心形图标）：
   - 未点赞：白色空心心形 ❤️‍🩹（轮廓线，内部是空的或透明的）
   - 已点赞：红色实心心形 ❤️（整体是红色填充的）
   - 判断要点：看心形内部是否有红色填充！

2. 收藏状态（星形图标）：
   - 未收藏：白色空心星形 ⭐（轮廓线，内部是空的）
   - 已收藏：黄色实心星形 🌟（整体是黄色填充的）
   - 判断要点：看星形内部是否有黄色填充！

3. 关注状态：
   - 红色"+"按钮 = 未关注
   - 灰色"已关注"按钮 = 已关注

【常见误判警告】
- 不要把白色空心心形误判为已点赞！
- 白色空心心形 = 未点赞
- 红色实心心形 = 已点赞

【评论截图识别】
- commenter_nickname：评论人昵称
- comment_content：评论内容
- has_comment_keyword：是否出现"评论"关键词

返回格式：
{
  "type": "comment_screenshot" | "author_profile",
  "has_comment_keyword": true,
  "commenter_nickname": "评论人昵称",
  "comment_content": "评论内容",
  "author_name": "达人名字",
  "interaction": {
    "has_like": true,
    "has_favorite": true,
    "has_follow": true
  }
}` }
              ]
            }
          ]
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.BAILIAN_API_KEY || process.env.DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: TIMEOUTS.BAILIAN
      }
    );
    
    // 解析结果
    const content = response.data?.output?.choices?.[0]?.message?.content;
    const contentText = Array.isArray(content)
      ? content.map(part => (typeof part === 'string' ? part : part?.text || '')).join('\n')
      : (typeof content === 'string' ? content : '');

    if (contentText) {
      // 尝试提取 JSON
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        console.log("[Worker] 百炼 AI 原始返回:", JSON.stringify(result));
        const type = result.type === 'author_profile' ? 'B' : 'A';
        const commentContent = extractCommentContent(result.comment_content || result.comment);
        const commenterNickname = normalizeDetectedValue(result.commenter_nickname);
        const authorName = normalizeDetectedValue(result.author_name || (type === 'B' ? result.author : null));

        return {
          type,
          has_comment_keyword: result.has_comment_keyword || false,
          comment: commentContent || null,
          commenterNickname: commenterNickname || null,
          authorName: authorName || null,
          author: authorName || commenterNickname || null,
          interaction: {
            hasLike: result.interaction?.has_like || false,
            hasFavorite: result.interaction?.has_favorite || false,
            hasFollow: result.interaction?.has_follow || false
          },
          source: 'bailian_ai'
        };
      }
    }
    
    return null;
  } catch (e) {
    console.error(`[Worker] 百炼 AI 调用失败: ${e.message}`);
    return null;
  }
}

// ============ 核心调用函数 ============

/**
 * 从 URL 或相对路径提取本地文件路径
 * 支持格式：
 * - 相对路径: /uploads/images/2026/03/24/xxx.webp
 * - 完整 URL: https://domain.com/uploads/images/2026/03/24/xxx.webp
 */
function urlToLocalPath(imageUrl) {
  try {
    if (!imageUrl || typeof imageUrl !== 'string') return null;
    const normalized = imageUrl.trim();
    if (!normalized || normalized === 'system') return null;

    // 兼容裸相对路径 uploads/...
    if (normalized.startsWith('uploads/')) {
      return path.join(LOCAL_STORAGE_DIR, normalized.replace(/^uploads\//, ''));
    }

    // 检查是否是相对路径（以 / 开头）
    if (normalized.startsWith('/uploads/')) {
      // 相对路径直接拼接
      const relativePath = normalized.replace('/uploads/', '');
      if (!relativePath) return null;
      return path.join(LOCAL_STORAGE_DIR, relativePath);
    }

    // 拒绝 /system 这类非上传路径，避免误读本地文件
    if (normalized.startsWith('/')) {
      return null;
    }
    
    // 尝试作为完整 URL 解析
    const url = new URL(normalized);
    const match = url.pathname.match(/\/uploads\/(.+)/);
    if (match) {
      return path.join(LOCAL_STORAGE_DIR, match[1]);
    }
    return null;
  } catch (e) {
    console.error(`[Worker] URL 解析失败: ${imageUrl}`);
    return null;
  }
}

/**
 * 调用 OCR Service (带重试和故障转移)
 */
async function callOCR(imagePath, screenshotRole = 'homepage') {
  if (!fs.existsSync(imagePath)) {
    console.error(`[Worker] 文件不存在: ${imagePath}`);
    return null;
  }

  const preferredUrl = await getNextOcrService(screenshotRole);
  const poolUrls = getOcrPoolByRole(screenshotRole);
  const poolServices = OCR_SERVICES_CONFIG.filter((service) => poolUrls.includes(service.url));
  const healthyServices = poolServices.filter((service) => service.healthy && !isServiceQuarantined(service));
  const fallbackServices = OCR_SERVICES_CONFIG.filter(
    (service) => !poolUrls.includes(service.url) && service.healthy && !isServiceQuarantined(service)
  );
  const orderedServices = [];

  const pushService = (service) => {
    if (!service || orderedServices.find((item) => item.url === service.url)) {
      return;
    }
    orderedServices.push(service);
  };

  pushService(OCR_SERVICES_CONFIG.find((service) => service.url === preferredUrl));
  healthyServices.forEach(pushService);
  fallbackServices.forEach(pushService);

  const servicesToTry = orderedServices;
  if (servicesToTry.length === 0) {
    console.warn('[Worker] 当前没有可用的健康 OCR 服务，直接进入降级逻辑');
    return null;
  }
  
  // 最多尝试所有健康服务
  for (const service of servicesToTry) {
    const form = new FormData();
    form.append('file', fs.createReadStream(imagePath));
    form.append('image_type', screenshotRole);

    try {
      const res = await axios.post(`${service.url}/ocr/analyze_file`, form, {
        headers: form.getHeaders(),
        timeout: TIMEOUTS.OCR
      });
      
      reportServiceSuccess(service.url);
      return res.data;
    } catch (e) {
      console.warn(`[Worker] OCR ${service.url} (${getScreenshotRoleLabel(screenshotRole)}) 调用失败: ${e.message}`);
      reportServiceFailure(service.url);
      
      // 如果还有其他服务可以尝试，继续
      if (servicesToTry.indexOf(service) < servicesToTry.length - 1) {
        console.log(`[Worker] 尝试下一个 OCR 服务...`);
        continue;
      }
    }
  }
  
  // 所有 OCR 服务都失败，尝试降级
  console.warn('[Worker] 所有 OCR 服务不可用，尝试降级到百炼 AI...');
  return null;
}

/**
 * 调用 YOLO Service (带健康检查)
 */
async function callYOLO(imagePath) {
  if (!fs.existsSync(imagePath)) {
    console.error(`[Worker] 文件不存在: ${imagePath}`);
    return null;
  }

  if (!YOLO_SERVICE_CONFIG.healthy) {
    console.warn('[Worker] YOLO 服务当前不健康，跳过调用');
    return null;
  }

  const form = new FormData();
  form.append('file', fs.createReadStream(imagePath));

  try {
    const res = await axios.post(`${YOLO_SERVICE_CONFIG.url}/yolo/detect_file`, form, {
      headers: form.getHeaders(),
      timeout: TIMEOUTS.YOLO
    });
    
    YOLO_SERVICE_CONFIG.failCount = 0;
    return res.data;
  } catch (e) {
    console.error(`[Worker] YOLO 调用失败: ${e.message}`);
    YOLO_SERVICE_CONFIG.failCount++;
    
    if (YOLO_SERVICE_CONFIG.failCount >= HEALTH_CONFIG.FAIL_THRESHOLD) {
      YOLO_SERVICE_CONFIG.healthy = false;
      console.warn('[Worker] YOLO 服务标记为不健康');
    }
    
    return null;
  }
}

/**
 * 从任务标题/描述提取达人名字
 */
function extractAuthorFromTask(title, videoUrl, action = '') {
  const normalizedAction = String(action || '').toLowerCase();
  const isShortVideoResearch =
    normalizedAction.includes('short_video') ||
    normalizedAction.includes('短视频') ||
    normalizedAction.includes('体验');

  // 短视频体验类任务当前没有独立达人字段时，不能把分享文案里的标题直接当达人名
  // 否则会把 “xxx的图文作品 / xxx的作品” 这类标题误判成达人，导致图片审核误拒。
  if (isShortVideoResearch) {
    return null;
  }

  const titleMatch = title?.match(/@([\w\u4e00-\u9fff]+)/);
  if (titleMatch) return titleMatch[1];
  
  const urlMatch = videoUrl?.match(/看看【(.+?)】/);
  if (urlMatch) return urlMatch[1].replace('的作品', '');
  
  return null;
}

/**
 * 从 video_url 提取实际链接
 */
function extractLinkFromVideoUrl(videoUrl) {
  if (!videoUrl) return null;
  const linkMatch = videoUrl.match(/(https?:\/\/[^\s]+)/);
  if (linkMatch) return linkMatch[1];
  return videoUrl;
}

function parseScreenshotPayload(raw) {
  return normalizeScreenshotEntries(raw);
}

function hasEffectiveEvidence(combinedEvidence) {
  if (!combinedEvidence) return false;
  return Boolean(
    combinedEvidence.comment ||
    combinedEvidence.commenterNickname ||
    combinedEvidence.authorName ||
    combinedEvidence.has_comment_keyword ||
    combinedEvidence.interaction?.hasLike ||
    combinedEvidence.interaction?.hasFavorite ||
    combinedEvidence.interaction?.hasFollow
  );
}

const IMAGE_REVIEW_MIN_COMMENT_LENGTH = 6;

function getEffectiveCommentLength(value) {
  const normalized = extractCommentContent(value);
  if (!normalized) return 0;

  // 去掉空白和大多数符号后再计算长度，避免简单标点凑字数。
  const compact = normalized.replace(/[\s\p{P}\p{S}]+/gu, '');
  return compact.length;
}

function collectImageReviewTechnicalReasons(screenshotEvidence = [], options = {}) {
  const reasons = [];

  for (const screenshot of screenshotEvidence) {
    if (!screenshot || screenshot.source !== 'ocr') continue;

    if (screenshot.status === 'path_failed') {
      reasons.push(`第 ${screenshot.screenshotIndex} 张截图路径解析失败`);
    } else if (screenshot.status === 'failed') {
      reasons.push(`第 ${screenshot.screenshotIndex} 张${getScreenshotRoleLabel(screenshot.expectedRole)} OCR 服务识别失败`);
    }
  }

  if (options.hasHomepageScreenshot && !options.yoloResult) {
    reasons.push('YOLO 图标识别服务异常，无法确认点赞/收藏状态');
  }

  return [...new Set(reasons)];
}

// ============ Worker 类 ============

class ImageReviewWorker {
  constructor() {
    this.running = false;
  }

  async start() {
    console.log('[Worker] 启动图片审核 Worker (优化版)...');
    console.log('[Worker] 优化特性:');
    console.log('  - Redis 共享轮询索引');
    console.log('  - 服务健康检查 + 自动摘除');
    console.log('  - 百炼 AI 降级机制');
    console.log(`  - 轮询配置: poll=${POLL_INTERVAL}ms, batch=${BATCH_SIZE}`);
    console.log(`  - 超时配置: OCR ${TIMEOUTS.OCR}ms, YOLO ${TIMEOUTS.YOLO}ms`);
    console.log(`  - OCR主页池: ${OCR_SERVICE_POOLS.homepage.join(', ')}`);
    console.log(`  - OCR评论池: ${OCR_SERVICE_POOLS.comment.join(', ')}`);
    
    // 启动健康检查
    await startHealthCheck();
    
    console.log('[Worker] ✅ 服务就绪，开始轮询队列...');
    
    this.running = true;
    this.poll();
  }

  async poll() {
    while (this.running) {
      try {
        const items = await db.queryMany(`
          SELECT 
            q.id as queue_id,
            q.claim_id,
            q.user_id,
            q.task_id,
            q.screenshots as queue_screenshots,
            q.status,
            q.retry_count,
            c.screenshots as claim_screenshots,
            c.status as claim_status,
            c.submitted_at,
            t.title as task_title,
            t.video_url,
            t.action,
            t.platform,
            t.reward,
            t.base_reward
          FROM ai_review_queue q
          JOIN claims c ON q.claim_id = c.id
          JOIN tasks t ON q.task_id = t.id
          WHERE q.status = 'pending'
          ORDER BY q.created_at ASC
          LIMIT $1
        `, [BATCH_SIZE]);

        if (items.length > 0) {
          console.log(`[Worker] 📋 发现 ${items.length} 个待审核任务`);
          
          for (const item of items) {
            await this.processItem(item);
          }
        }
      } catch (error) {
        console.error('[Worker] 轮询错误:', error.message);
      }

      await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }
  }

  async processItem(item) {
    const startTime = Date.now();
    console.log(`[Worker] 开始处理 claim_id=${item.claim_id}`);

    try {
      // 防重复处理：检查 claim 当前状态
      const currentClaim = await db.queryOne("SELECT status FROM claims WHERE id = $1", [item.claim_id]);
      if (currentClaim && !["submitted", "image_reviewing"].includes(currentClaim.status)) {
        console.log(`[Worker] claim_id=${item.claim_id} 已不在待审核状态 (status=${currentClaim.status})，跳过`);
        await db.query("UPDATE ai_review_queue SET status = 'completed', ai_result = 'skipped' WHERE id = $1", [item.queue_id]);
        return;
      }

      // 标记为处理中
      await db.query(`
        UPDATE ai_review_queue 
        SET status = 'processing', 
            retry_count = retry_count + 1
        WHERE id = $1 AND status = 'pending'
      `, [item.queue_id]);

      await db.query(
        `
        UPDATE claims
        SET status = $1,
            ai_review_status = 'processing',
            image_review_status = 'reviewing',
            image_review_reason = '图片审核中'
        WHERE id = $2
        `,
        [CLAIM_STATUS.IMAGE_REVIEWING, item.claim_id]
      );

      // 获取截图
      const queueScreenshots = parseScreenshotPayload(item.queue_screenshots);
      const claimScreenshots = parseScreenshotPayload(item.claim_screenshots);
      const screenshots =
        queueScreenshots.length > 0
          ? queueScreenshots
          : (claimScreenshots.length > 0 ? claimScreenshots : buildSubmissionScreenshotEntries(item.claim_screenshots));

      if (!screenshots || screenshots.length === 0) {
        const result = { passed: false, reasons: ['无截图数据'] };
        await this.saveResult(item, result, Date.now() - startTime);
        await this.rejectTask(item, result);
        return;
      }

      // 处理所有截图，合并结果
      let combinedEvidence = createCombinedEvidence('ocr_yolo');
      let yoloResult = null;
      let usedFallback = false;
      const screenshotPaths = [];
      const hasHomepageScreenshot = screenshots.some((screenshot, index) => {
        const expectedRole = screenshot?.role || (index === 0 ? 'homepage' : 'comment');
        return !isCommentScreenshotRole(expectedRole);
      });
      
      console.log(`[Worker] 共 ${screenshots.length} 张截图待处理`);
      
      for (let i = 0; i < screenshots.length; i++) {
        const screenshot = screenshots[i];
        const imageUrl = screenshot.url || screenshot;
        const expectedRole = screenshot.role || (i === 0 ? 'homepage' : 'comment');
        const imagePath = urlToLocalPath(imageUrl);

        if (!imagePath) {
          console.log(`[Worker] 第 ${i + 1} 张图片路径解析失败，跳过`);
          combinedEvidence.screenshots.push({
            screenshotIndex: i + 1,
            source: 'ocr',
            status: 'path_failed',
            expectedRole,
          });
          continue;
        }

        screenshotPaths.push(imagePath);

        console.log(`[Worker] 处理第 ${i + 1} 张截图 (${getScreenshotRoleLabel(expectedRole)})...`);
        
        // 调用 OCR；如果 OCR 服务失败，仅做技术兜底，不再进入审核级 AI 复审
        let ocrResult = await callOCR(imagePath, expectedRole);


        if (!ocrResult) {
          console.log(`[Worker] 第 ${i + 1} 张 OCR 失败，标记为识别失败`);
          combinedEvidence.screenshots.push({
            screenshotIndex: i + 1,
            source: "ocr",
            status: "failed",
            expectedRole,
          });
          continue;
        }

        
        console.log(`[Worker] 第 ${i + 1} 张 OCR 结果: hasComment=${ocrResult.has_comment_keyword}, author=${ocrResult.author}, comment=${ocrResult.comment}`);

        const isCommentScreenshot = mergeOcrEvidence(combinedEvidence, ocrResult, i + 1, expectedRole);
        const detectedRole = isCommentScreenshot ? 'comment' : 'homepage';
        const roleMismatch =
          expectedRole !== 'extra' &&
          ((isCommentScreenshot && !isCommentScreenshotRole(expectedRole)) ||
            (!isCommentScreenshot && isCommentScreenshotRole(expectedRole)));

        if (roleMismatch) {
          combinedEvidence.screenshots.push({
            screenshotIndex: i + 1,
            source: 'routing',
            status: 'role_mismatch',
            expectedRole,
            detectedRole,
            note: '截图角色与默认顺序不一致，已按识别结果纠偏'
          });
        }
        
        // 如果是类型 B（达人主页），调用 YOLO 检测互动状态
        if (!isCommentScreenshot && !yoloResult) {
          console.log(`[Worker] 第 ${i + 1} 张类型 B，调用 YOLO 检测互动状态...`);
          yoloResult = await callYOLO(imagePath);
          console.log(`[Worker] YOLO 结果: ${JSON.stringify(yoloResult)}`);
        }
      }

      const technicalFailureReasons = collectImageReviewTechnicalReasons(combinedEvidence.screenshots, {
        hasHomepageScreenshot,
        yoloResult,
      });

      if (technicalFailureReasons.length > 0) {
        await this.moveToManualReview(item, '图片审核服务异常，已转人工优先检查', {
          stage: 'image_review',
          blocking: true,
          highlight: true,
          source: usedFallback ? 'ocr_yolo_technical_failure_with_fallback' : 'ocr_yolo_technical_failure',
          technicalFailure: true,
          technicalReasons: technicalFailureReasons,
          screenshotCount: screenshotPaths.length,
        });
        return;
      }
      
      if (!hasEffectiveEvidence(combinedEvidence)) {
        await this.moveToManualReview(item, '图片识别失败，已转人工检查', {
          stage: 'image_review',
          blocking: true,
          highlight: true,
          source: usedFallback ? 'ocr_with_ai_fallback' : 'ocr_yolo',
          screenshotCount: screenshotPaths.length
        });
        return;
      }

      let result = await this.evaluateResult(combinedEvidence, yoloResult, item);
      if (usedFallback) {
        result.source = 'ocr_with_ai_fallback';
      }

      // 保存结果
      await this.saveResult(item, result, Date.now() - startTime);

      // 如果不通过，按 OCR+YOLO 结果直接拒绝，同时推送人工列表；不再进行 AI 复审
      if (!result.passed) {
        await this.rejectTask(item, result, {
          pushToManualQueue: true,
          manualReason: 'OCR+YOLO 审核未通过，已加入人工检查列表',
          manualDetails: {
            stage: 'image_review',
            blocking: false,
            reasons: result.reasons,
            detected: result.detected,
            source: result.source || 'ocr_yolo'
          }
        });
        return;
      }

      // 如果通过且需要链接验证
      if (result.passed && item.video_url) {
        const link = extractLinkFromVideoUrl(item.video_url);
        if (link) {
          // 获取延迟配置
          const linkConfig = await getLinkVerifyConfig();
          const delayMs = linkConfig.delayMinutes * 60 * 1000;

          if (!linkConfig.enabled) {
            await this.completeTask(item, result, '图片审核通过，连接审核已关闭');
          } else {
            const now = Date.now();
            await linkDelayQueue.add('link-delay', {
              claimId: item.claim_id,
              userId: item.user_id,
              taskId: item.task_id,
              links: [link],
              platform: item.platform || 'douyin',
              readyAt: now + delayMs,
              enqueuedAt: now,
              batchThreshold: linkConfig.batchThreshold,
              maxWaitMinutes: linkConfig.maxWaitMinutes,
              batchSize: linkConfig.batchSize,
              retryCount: linkConfig.retryCount,
              taskContext: {
                author: extractAuthorFromTask(item.task_title, item.video_url, item.action),
                action: item.action
              }
            }, {
              delay: delayMs,
              attempts: Math.max(1, Number(linkConfig.retryCount) || 1)
            });

            await db.transaction(async (client) => {
              const historyRes = await client.query(`SELECT review_history FROM claims WHERE id = $1`, [item.claim_id]);
              const nextHistory = appendReviewHistory(
                historyRes.rows?.[0]?.review_history,
                createReviewHistoryEntry({
                  stage: 'link_review',
                  action: 'queued',
                  reason: `已进入连接审核队列，基础延迟 ${linkConfig.delayMinutes} 分钟`,
                  details: {
                    delayMinutes: linkConfig.delayMinutes,
                    batchThreshold: linkConfig.batchThreshold,
                    maxWaitMinutes: linkConfig.maxWaitMinutes,
                    batchSize: linkConfig.batchSize,
                    retryCount: linkConfig.retryCount
                  }
                })
              );

              await client.query(
                `
                UPDATE claims
                SET status = $1,
                    link_review_status = 'pending',
                    link_review_reason = $2,
                    review_note = $2,
                    review_history = $3
                WHERE id = $4
                `,
                [
                  CLAIM_STATUS.PENDING_LINK,
                  '图片审核通过，等待连接审核',
                  JSON.stringify(nextHistory),
                  item.claim_id
                ]
              );
            });

            console.log(`[Worker] 📤 已加入连接延迟队列，延迟 ${linkConfig.delayMinutes} 分钟`);
            await publishImageReviewComplete(item.claim_id, item.user_id, true, '图片审核通过，等待连接审核', await fetchClaimForPush(item.claim_id));
          }
        } else {
          await this.moveToManualReview(item, '任务链接解析失败，已转人工复审', {
            videoUrl: item.video_url
          });
        }
      } else if (result.passed && !item.video_url) {
        // 图片审核通过且无需链接验证，直接完成任务
        console.log(`[Worker] ✅ 图片审核通过且无需链接验证，直接完成任务`);
        await this.completeTask(item, result);
      }

      console.log(`[Worker] ✅ 处理完成: claim_id=${item.claim_id}, 结果=${result.passed ? '通过' : '拒绝'}, 耗时=${Date.now() - startTime}ms`);

    } catch (error) {
      console.error(`[Worker] ❌ 处理失败: ${error.message}`);
      
      await db.query(`
        UPDATE ai_review_queue 
        SET status = 'failed', 
            ai_reason = $1
        WHERE id = $2
      `, [error.message, item.queue_id]);
    }
  }

  async evaluateResult(ocrResult, yoloResult, item) {
    const commentContent = extractCommentContent(ocrResult.comment);
    const commenterNickname = normalizeDetectedValue(ocrResult.commenterNickname);
    const authorName = normalizeDetectedValue(ocrResult.authorName || ocrResult.author);
    const commentLength = getEffectiveCommentLength(commentContent);
    
    const result = {
      passed: true,
      reasons: [],
      type: ocrResult.type,
      source: ocrResult.source || 'ocr_yolo',
      hasComment: Boolean(ocrResult.has_comment_keyword || commentContent),
      author: authorName,
      authorName,
      commenterNickname,
      comment: commentContent,
      commentLength,
      interaction: {
        hasLike: ocrResult.interaction?.hasLike || false,
        hasFavorite: ocrResult.interaction?.hasFavorite || false,
        hasFollow: ocrResult.interaction?.hasFollow || false
      },
      screenshotEvidence: Array.isArray(ocrResult.screenshots) ? ocrResult.screenshots : []
    };

    const commentScreenshotEvidence = result.screenshotEvidence.find((item) => item?.screenType === 'comment') || null;
    const structuredCommentContentMissing = Boolean(
      ocrResult.commentExtraction?.contentMissing ||
      commentScreenshotEvidence?.contentMissing
    );

    // 合并 YOLO 结果
    if (yoloResult) {
      if (yoloResult.has_like !== undefined) result.interaction.hasLike = yoloResult.has_like;
      if (yoloResult.has_favorite !== undefined) result.interaction.hasFavorite = yoloResult.has_favorite;
      if (yoloResult.has_follow !== undefined) result.interaction.hasFollow = yoloResult.has_follow;
    }

    // 获取审核规则 — 直接使用管理员在后台配置的检查项开关
    const action = item.action || '';
    const globalReviewConfig = await getEffectiveReviewConfig();
    const reviewSettings = {
      checks: {
        comment: globalReviewConfig.checks.comment !== false,
        commenterNickname: globalReviewConfig.checks.commentNickname !== false,
        authorName: globalReviewConfig.checks.authorName !== false,
        like: globalReviewConfig.checks.like !== false,
        favorite: globalReviewConfig.checks.favorite !== false,
        follow: globalReviewConfig.checks.follow !== false
      }
    };

    if (reviewSettings.checks.commenterNickname && !result.commenterNickname) {
      result.passed = false;
      result.reasons.push('未识别评论人昵称');
    }

    if (reviewSettings.checks.comment && !commentContent) {
      result.passed = false;
      result.reasons.push(structuredCommentContentMissing ? '第一条评论未识别到文字正文' : '未识别评论内容');
    }

    if (reviewSettings.checks.comment && commentContent && commentLength < IMAGE_REVIEW_MIN_COMMENT_LENGTH) {
      result.passed = false;
      result.reasons.push(`评论内容少于${IMAGE_REVIEW_MIN_COMMENT_LENGTH}个字`);
    }

    if (reviewSettings.checks.comment && !result.hasComment) {
      result.passed = false;
      result.reasons.push('未检测到评论截图');
    }

    if (reviewSettings.checks.authorName && !result.authorName) {
      result.passed = false;
      result.reasons.push('未识别达人名字');
    }

    // 达人匹配
    const taskAuthor = extractAuthorFromTask(item.task_title, item.video_url, item.action);
    if (taskAuthor && result.authorName) {
      const authorMatch = this.matchAuthor(taskAuthor, result.authorName);
      if (!authorMatch.match) {
        result.passed = false;
        result.reasons.push(`达人名字不匹配（任务:${taskAuthor} / 截图:${result.authorName}）`);
      }
    }

    // 互动验证
    console.log("[Worker] 互动验证: checks.like=" + reviewSettings.checks.like + ", hasLike=" + result.interaction.hasLike + ", action=" + action);
    if (reviewSettings.checks.like && !result.interaction.hasLike) {
      result.passed = false;
      result.reasons.push('未检测到点赞');
    }
    if (reviewSettings.checks.favorite && !result.interaction.hasFavorite) {
      result.passed = false;
      result.reasons.push('未检测到收藏');
    }
    if (reviewSettings.checks.follow && !result.interaction.hasFollow) {
      result.passed = false;
      result.reasons.push('未检测到关注');
    }

    result.detected = {
      commenterNickname: result.commenterNickname || '没有',
      comment: result.comment || '没有',
      commentLength: result.comment ? String(commentLength) : '没有',
      authorName: result.authorName || '没有',
      like: reviewSettings.checks.like ? (result.interaction.hasLike ? '有' : '没有') : '未启用',
      favorite: reviewSettings.checks.favorite ? (result.interaction.hasFavorite ? '有' : '没有') : '未启用',
      follow: reviewSettings.checks.follow ? (result.interaction.hasFollow ? '有' : '没有') : '未启用'
    };

    result.checksEnabled = reviewSettings.checks;

    return result;
  }

  matchAuthor(taskAuthor, detectedAuthor) {
    return matchAuthorWithTolerance(taskAuthor, detectedAuthor, { allowMissingDetected: false });
  }

  async saveResult(item, result, duration) {
    await db.transaction(async (client) => {
      const historyRes = await client.query(`SELECT review_history FROM claims WHERE id = $1`, [item.claim_id]);
      const reviewHistory = appendReviewHistory(
        historyRes.rows?.[0]?.review_history,
        createReviewHistoryEntry({
          stage: 'image_review',
          action: result.passed ? 'approved' : 'rejected',
          reason: result.reasons.join('; ') || '审核通过',
          details: {
            type: result.type,
            hasComment: result.hasComment,
            interaction: result.interaction,
            source: result.source || 'ocr_yolo',
            durationMs: duration,
            recheck: result.recheck || null,
            commenterNickname: result.commenterNickname || '没有',
            comment: result.comment || '没有',
            authorName: result.authorName || '没有',
            screenshots: result.screenshotEvidence || [],
            detected: result.detected || {},
            checksEnabled: result.checksEnabled || {}
          }
        })
      );
      
      await client.query(`
        UPDATE claims 
        SET image_review_status = $1,
            image_review_reason = $2,
            image_reviewed_at = NOW(),
            ocr_comment = $3,
            platform_nickname = COALESCE(NULLIF(platform_nickname, ''), $4),
            ai_review_status = $5,
            ai_reason = $6,
            review_history = $7
        WHERE id = $8
      `, [
        result.passed ? 'approved' : 'rejected',
        result.reasons.join('; ') || '审核通过',
        result.comment || null,
        result.commenterNickname || null,
        result.passed ? 'approved' : 'rejected',
        JSON.stringify(result),
        JSON.stringify(reviewHistory),
        item.claim_id
      ]);

      await client.query(`
        UPDATE ai_review_queue 
        SET status = 'completed',
            ai_result = $1,
            ai_confidence = $2,
            ai_reason = $3,
            processed_at = NOW()
        WHERE id = $4
      `, [
        result.passed ? 'approved' : 'rejected',
        result.passed ? 0.9 : 0.5,
        JSON.stringify(result),
        item.queue_id
      ]);
    });

  }
  
  // 完成任务（无需链接验证时）
  async completeTask(item, result, reason = '无需连接审核，任务完成') {
    try {
      await db.transaction(async (client) => {
        const historyRes = await client.query(`SELECT review_history FROM claims WHERE id = $1`, [item.claim_id]);
        const reviewHistory = appendReviewHistory(
          historyRes.rows?.[0]?.review_history,
          createReviewHistoryEntry({
            stage: 'task_complete',
            action: 'approved',
            reason,
            details: { source: 'image_review_worker' }
          })
        );

        await client.query(`
          UPDATE claims 
          SET status = $1,
              link_review_status = 'skipped',
              link_review_reason = $2,
              review_note = $2,
              reviewed_at = NOW(),
              review_history = $3
          WHERE id = $4
        `, [CLAIM_STATUS.APPROVED, reason, JSON.stringify(reviewHistory), item.claim_id]);
      });

      const settlement = await pointsSettlementService.awardClaimPoints({
        claimId: item.claim_id,
        taskId: item.task_id,
        userId: item.user_id,
        awardReason: '图片审核通过（免链接审核）',
        source: 'image_review_worker'
      });

      const awardedPoints = settlement?.finalPoints || 0;
      console.log(`[Worker] 🎉 任务完成: 用户${item.user_id} +${awardedPoints}积分`);

      // 推广积分联动
      try {
        await promotionService.calculateCPromotionEarnings(item.claim_id, item.user_id, awardedPoints);
      } catch (promoErr) {
        console.error('[Worker] 推广积分计算失败:', promoErr.message);
      }

      await publishImageReviewComplete(item.claim_id, item.user_id, true, reason, await fetchClaimForPush(item.claim_id));

    } catch (e) {
      console.error(`[Worker] 完成任务失败: ${e.message}`);
    }
  }
  
  // 拒绝任务（退回用户端）
  async rejectTask(item, result, options = {}) {
    try {
      await db.transaction(async (client) => {
        const claimRes = await client.query(`SELECT reject_count, review_history FROM claims WHERE id = $1`, [item.claim_id]);
        const rejectCount = Number(claimRes.rows[0]?.reject_count || 0) + 1;
        const reviewReason = result.reasons.join('; ') || '图片审核未通过';
        let reviewHistory = appendReviewHistory(
          claimRes.rows?.[0]?.review_history,
          createReviewHistoryEntry({
            stage: 'claim_flow',
            action: rejectCount >= 3 ? 'released' : 'returned',
            reason: reviewReason,
            details: {
              rejectCount,
              source: 'image_review'
            }
          })
        );

        if (options.pushToManualQueue) {
          reviewHistory = appendReviewHistory(
            reviewHistory,
            createReviewHistoryEntry({
              stage: 'manual_review',
              action: 'queued',
              reason: options.manualReason || '已加入人工检查列表',
              details: {
                ...(options.manualDetails || {}),
                previousDecision: 'rejected'
              }
            })
          );
        }

        const nextAiStatus = options.pushToManualQueue ? 'manual' : 'rejected';
        const aiReason = JSON.stringify({
          ...result,
          manualReview: options.pushToManualQueue ? {
            queued: true,
            reason: options.manualReason || '已加入人工检查列表',
            details: options.manualDetails || {}
          } : undefined
        });
        
        // 如果拒绝次数达到3次，释放任务
        if (rejectCount >= 3) {
          await client.query(`
            UPDATE claims 
            SET status = 'released',
                reject_count = $1,
                submitted_at = NULL,
                reviewed_at = NOW(),
                review_note = $2,
                ai_review_status = $4,
                ai_reason = $5,
                image_review_status = 'rejected',
                image_review_reason = $2,
                review_history = $3
            WHERE id = $6
          `, [rejectCount, reviewReason, JSON.stringify(reviewHistory), nextAiStatus, aiReason, item.claim_id]);
          console.log(`[Worker] ⚠️ 任务已释放: 拒绝次数达到3次`);
        } else {
          // 退回用户端，状态改为 doing，允许重新提交
          // 需要重新设置倒计时（从任务获取限时）
          const timeLimitResult = await client.query(
            `SELECT t.time_limit_minutes FROM claims c JOIN tasks t ON c.task_id = t.id WHERE c.id = $1`,
            [item.claim_id]
          );
          const timeLimitMinutes = timeLimitResult.rows[0]?.time_limit_minutes || 15;
          const newExpiresAt = new Date(Date.now() + timeLimitMinutes * 60 * 1000);
          
          await client.query(`
            UPDATE claims
            SET status = $1,
                reject_count = $2,
                submitted_at = NULL,
                reviewed_at = NOW(),
                review_note = $3,
                ai_review_status = $5,
                ai_reason = $6,
                image_review_status = 'rejected',
                image_review_reason = $3,
                review_history = $4,
                expires_at = $7
            WHERE id = $8
          `, [CLAIM_STATUS.DOING, rejectCount, reviewReason, JSON.stringify(reviewHistory), nextAiStatus, aiReason, newExpiresAt, item.claim_id]);
          console.log(`[Worker] 🔄 任务已退回用户端: 拒绝次数 ${rejectCount}/3, 新倒计时 ${timeLimitMinutes}分钟`);
        }
      });

      await publishImageReviewComplete(
        item.claim_id, item.user_id, false, result.reasons.join('; ') || '图片审核未通过', await fetchClaimForPush(item.claim_id)
      );

      try {
        await notifyClaimRejected(
          item.user_id,
          item.claim_id,
          result.reasons.join('; ') || '图片审核未通过'
        );
      } catch (notifyErr) {
        console.error(`[Worker] 发送图片拒绝通知失败: ${notifyErr.message}`);
      }

    } catch (e) {
      console.error(`[Worker] 拒绝任务失败: ${e.message}`);
    }
  }

  async moveToManualReview(item, reason, details = {}) {
    try {
      await db.transaction(async (client) => {
        const historyRes = await client.query(`SELECT review_history FROM claims WHERE id = $1`, [item.claim_id]);
        const reviewHistory = appendReviewHistory(
          historyRes.rows?.[0]?.review_history,
          createReviewHistoryEntry({
            stage: 'image_review',
            action: 'manual',
            reason,
            details: {
              ...details,
              blocking: details.blocking !== false
            }
          })
        );

        await client.query(
          `
          UPDATE claims
          SET status = $1,
              ai_review_status = 'manual',
              ai_reason = $2,
              image_review_status = 'manual',
              image_review_reason = $2,
              review_note = $2,
              review_history = $3
          WHERE id = $4
          `,
          [CLAIM_STATUS.PENDING_MANUAL, reason, JSON.stringify(reviewHistory), item.claim_id]
        );

        await client.query(
          `
          UPDATE ai_review_queue
          SET status = 'completed',
              ai_result = 'manual',
              ai_reason = $1,
              processed_at = NOW()
          WHERE id = $2
          `,
          [JSON.stringify({ reason, details }), item.queue_id]
        );
      });

      await publishImageReviewComplete(item.claim_id, item.user_id, false, reason, await fetchClaimForPush(item.claim_id));

      try {
        await notifyManualReviewQueued({
          claimId: item.claim_id,
          userId: item.user_id,
          taskId: item.task_id,
          stage: 'image_review',
          reason,
        });
      } catch (notifyErr) {
        console.error(`[Worker] 发送人工队列通知失败: ${notifyErr.message}`);
      }
    } catch (e) {
      console.error(`[Worker] 转人工失败: ${e.message}`);
    }
  }

}

// 启动 Worker
const worker = new ImageReviewWorker();
worker.start().catch(console.error);
