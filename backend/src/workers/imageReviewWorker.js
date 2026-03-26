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
import { Queue } from 'bullmq';
import redisConnection from '../config/queue.js';
import db from '../config/database.js';
import { publishImageReviewComplete } from '../utils/wsEventPublisher.js';
import promotionService from '../services/promotionService.js';
import pointsSettlementService from '../services/pointsSettlementService.js';
import { notifyClaimRejected, notifyManualReviewQueued } from '../services/notificationService.js';
import { CLAIM_STATUS } from '../constants/claimLifecycle.js';
import { appendReviewHistory, createReviewHistoryEntry } from '../utils/claimReviewHistory.js';

dotenv.config();

// ============ 配置 ============

// 服务配置
const OCR_SERVICES_CONFIG = [
  { url: 'http://127.0.0.1:9001', healthy: true, lastCheck: 0, failCount: 0 },
  { url: 'http://127.0.0.1:9002', healthy: true, lastCheck: 0, failCount: 0 }
];
const YOLO_SERVICE_CONFIG = { url: 'http://127.0.0.1:8003', healthy: true, lastCheck: 0, failCount: 0 };

// 超时配置 (优化后)
const TIMEOUTS = {
  OCR: 10000,      // 10秒 (原 30秒)
  YOLO: 5000,      // 5秒 (原 15秒)
  HEALTH_CHECK: 3000,
  BAILIAN: 30000   // 百炼 AI 超时
}

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

function mergeOcrEvidence(combinedEvidence, ocrResult, screenshotIndex) {
  if (!combinedEvidence || !ocrResult) return false;

  const commentText = extractCommentContent(ocrResult.comment);
  const detectedName = normalizeDetectedValue(ocrResult.author);
  const isCommentScreenshot = Boolean(ocrResult.has_comment_keyword || commentText);

  combinedEvidence.has_comment_keyword = Boolean(
    combinedEvidence.has_comment_keyword ||
    ocrResult.has_comment_keyword ||
    commentText
  );

  if (isCommentScreenshot) {
    combinedEvidence.comment = combinedEvidence.comment || commentText;
    combinedEvidence.commenterNickname = combinedEvidence.commenterNickname || detectedName;
  } else {
    combinedEvidence.authorName = combinedEvidence.authorName || detectedName;
  }

  mergeInteractionState(combinedEvidence.interaction, ocrResult.interaction);

  combinedEvidence.screenshots.push({
    screenshotIndex,
    source: 'ocr',
    screenType: isCommentScreenshot ? 'comment' : 'profile',
    hasCommentKeyword: Boolean(ocrResult.has_comment_keyword),
    commenterNickname: isCommentScreenshot ? (detectedName || '没有') : '没有',
    comment: commentText || '没有',
    authorName: !isCommentScreenshot ? (detectedName || '没有') : '没有'
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
  CHECK_INTERVAL: 30000,    // 每 30 秒检查一次
  FAIL_THRESHOLD: 3,        // 连续失败 3 次标记为不健康
  RECOVERY_THRESHOLD: 1     // 成功 1 次即恢复
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
const POLL_INTERVAL = 3000;
const BATCH_SIZE = 5;

// Redis 轮询索引 Key
const REDIS_KEYS = {
  OCR_INDEX: 'image:worker:ocr:index',
  HEALTH_STATUS: 'image:worker:health:status'
};

// ============ Redis 共享轮询索引 ============

/**
 * 获取下一个 OCR 服务 (Redis 共享索引)
 */
async function getNextOcrService() {
  try {
    // 使用 Redis INCR 实现原子递增
    const index = await redisConnection.incr(REDIS_KEYS.OCR_INDEX);
    const serviceIndex = (index - 1) % OCR_SERVICES_CONFIG.length;
    
    // 获取健康的服务
    const healthyServices = OCR_SERVICES_CONFIG.filter(s => s.healthy);
    if (healthyServices.length === 0) {
      // 所有服务都不健康，返回配置中的第一个
      return OCR_SERVICES_CONFIG[serviceIndex].url;
    }
    
    // 从健康服务中选择
    const healthyIndex = (index - 1) % healthyServices.length;
    return healthyServices[healthyIndex].url;
  } catch (e) {
    // Redis 失败时使用随机选择
    console.warn('[Worker] Redis 获取索引失败，使用随机选择');
    const healthyServices = OCR_SERVICES_CONFIG.filter(s => s.healthy);
    if (healthyServices.length === 0) {
      return OCR_SERVICES_CONFIG[Math.floor(Math.random() * OCR_SERVICES_CONFIG.length)].url;
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
      if (!serviceConfig.healthy) {
        console.log(`[Health] ✅ ${serviceName} 恢复健康`);
      }
      serviceConfig.healthy = true;
      return true;
    }
  } catch (e) {
    serviceConfig.failCount++;
    serviceConfig.lastCheck = Date.now();
    
    if (serviceConfig.failCount >= HEALTH_CONFIG.FAIL_THRESHOLD) {
      if (serviceConfig.healthy) {
        console.warn(`[Health] ❌ ${serviceName} 标记为不健康 (连续失败 ${serviceConfig.failCount} 次)`);
      }
      serviceConfig.healthy = false;
    }
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
  }
}

/**
 * 报告服务调用失败
 */
function reportServiceFailure(serviceUrl) {
  const service = OCR_SERVICES_CONFIG.find(s => s.url === serviceUrl);
  if (service) {
    service.failCount++;
    if (service.failCount >= HEALTH_CONFIG.FAIL_THRESHOLD) {
      service.healthy = false;
      console.warn(`[Health] ⚠️ OCR ${serviceUrl} 标记为不健康`);
    }
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
async function callOCR(imagePath) {
  if (!fs.existsSync(imagePath)) {
    console.error(`[Worker] 文件不存在: ${imagePath}`);
    return null;
  }

  // 获取健康的服务列表
  const healthyServices = OCR_SERVICES_CONFIG.filter(s => s.healthy);
  const servicesToTry = healthyServices.length > 0 ? healthyServices : OCR_SERVICES_CONFIG;
  
  // 最多尝试所有健康服务
  for (const service of servicesToTry) {
    const form = new FormData();
    form.append('file', fs.createReadStream(imagePath));

    try {
      const res = await axios.post(`${service.url}/ocr/analyze_file`, form, {
        headers: form.getHeaders(),
        timeout: TIMEOUTS.OCR
      });
      
      reportServiceSuccess(service.url);
      return res.data;
    } catch (e) {
      console.warn(`[Worker] OCR ${service.url} 调用失败: ${e.message}`);
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
function extractAuthorFromTask(title, videoUrl) {
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
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [];
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
    console.log(`  - 超时配置: OCR ${TIMEOUTS.OCR}ms, YOLO ${TIMEOUTS.YOLO}ms`);
    
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
      const screenshots = queueScreenshots.length > 0 ? queueScreenshots : claimScreenshots;

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
      
      console.log(`[Worker] 共 ${screenshots.length} 张截图待处理`);
      
      for (let i = 0; i < screenshots.length; i++) {
        const screenshot = screenshots[i];
        const imageUrl = screenshot.url || screenshot;
        const imagePath = urlToLocalPath(imageUrl);

        if (!imagePath) {
          console.log(`[Worker] 第 ${i + 1} 张图片路径解析失败，跳过`);
          combinedEvidence.screenshots.push({
            screenshotIndex: i + 1,
            source: 'ocr',
            status: 'path_failed'
          });
          continue;
        }

        screenshotPaths.push(imagePath);

        console.log(`[Worker] 处理第 ${i + 1} 张截图...`);
        
        // 调用 OCR
        const ocrResult = await callOCR(imagePath);
        
        if (!ocrResult) {
          console.log(`[Worker] 第 ${i + 1} 张 OCR 失败`);
          combinedEvidence.screenshots.push({
            screenshotIndex: i + 1,
            source: 'ocr',
            status: 'failed'
          });
          continue;
        }
        
        console.log(`[Worker] 第 ${i + 1} 张 OCR 结果: hasComment=${ocrResult.has_comment_keyword}, author=${ocrResult.author}, comment=${ocrResult.comment}`);

        const isCommentScreenshot = mergeOcrEvidence(combinedEvidence, ocrResult, i + 1);
        
        // 如果是类型 B（达人主页），调用 YOLO 检测互动状态
        if (!isCommentScreenshot && !yoloResult) {
          console.log(`[Worker] 第 ${i + 1} 张类型 B，调用 YOLO 检测互动状态...`);
          yoloResult = await callYOLO(imagePath);
          console.log(`[Worker] YOLO 结果: ${JSON.stringify(yoloResult)}`);
        }
      }
      
      // 直接判断结果（取消 AI 降级和 AI 复审）
      let result = this.evaluateResult(combinedEvidence, yoloResult, item);

      // 保存结果
      await this.saveResult(item, result, Date.now() - startTime);

      // 如果不通过，拒绝并推送人工检查列表
      if (!result.passed) {
        await this.rejectTask(item, result, {
          pushToManualQueue: true,
          manualReason: '图片审核不通过: ' + result.reasons.join(', '),
          manualDetails: {
            stage: 'image_review',
            blocking: false,
            reasons: result.reasons,
            detected: result.detected
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
                author: extractAuthorFromTask(item.task_title, item.video_url),
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
            await publishImageReviewComplete(item.claim_id, item.user_id, true, '图片审核通过，等待连接审核');
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
      } else if (!result.passed) {
        // 图片审核拒绝，退回用户端
        console.log(`[Worker] ❌ 图片审核拒绝，退回用户端`);
        await this.rejectTask(item, result, usedFallback ? {
          pushToManualQueue: true,
          manualReason: 'AI降级审核未通过，已加入人工检查列表',
          manualDetails: {
            stage: 'image_review',
            blocking: false,
            source: result.source || 'bailian_ai_fallback'
          }
        } : {});
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

  async runAiReReview(screenshotPaths, item, baseResult) {
    const aiEvidence = createCombinedEvidence('ai_review');

    for (let i = 0; i < screenshotPaths.length; i++) {
      const aiResult = await callBailianAI(screenshotPaths[i], {
        taskTitle: item.task_title,
        action: item.action,
        stage: 'audit_recheck'
      });

      if (!aiResult) {
        aiEvidence.screenshots.push({
          screenshotIndex: i + 1,
          source: 'bailian_ai',
          status: 'failed'
        });
        continue;
      }

      mergeAiEvidence(aiEvidence, aiResult, i + 1);
    }

    if (!hasEffectiveEvidence(aiEvidence)) {
      return {
        decision: 'manual',
        reason: 'AI复审未产出有效识别结果'
      };
    }

    const decision = this.evaluateResult(aiEvidence, null, item);
    decision.source = 'ai_review';
    decision.recheck = {
      previousReasons: baseResult?.reasons || [],
      screenshotCount: screenshotPaths.length
    };

    return {
      decision: decision.passed ? 'approved' : 'rejected',
      result: decision
    };
  }

  evaluateResult(ocrResult, yoloResult, item) {
    const commentContent = extractCommentContent(ocrResult.comment);
    const commenterNickname = normalizeDetectedValue(ocrResult.commenterNickname);
    const authorName = normalizeDetectedValue(ocrResult.authorName || ocrResult.author);
    
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
      interaction: {
        hasLike: ocrResult.interaction?.hasLike || false,
        hasFavorite: ocrResult.interaction?.hasFavorite || false,
        hasFollow: ocrResult.interaction?.hasFollow || false
      },
      screenshotEvidence: Array.isArray(ocrResult.screenshots) ? ocrResult.screenshots : []
    };

    // 合并 YOLO 结果
    if (yoloResult) {
      if (yoloResult.has_like !== undefined) result.interaction.hasLike = yoloResult.has_like;
      if (yoloResult.has_favorite !== undefined) result.interaction.hasFavorite = yoloResult.has_favorite;
      if (yoloResult.has_follow !== undefined) result.interaction.hasFollow = yoloResult.has_follow;
    }

    // 获取审核规则 (从 action 解析)
    const action = item.action || '';
    const requiresCommentFlow = action.includes('评论') || action.includes('留言') || action.includes('体验');
    // "短视频体验官" 类任务默认需要全部检测（点赞、收藏）
    const isFullCheck = action.includes('体验') || action.includes('短视频') || action.includes('short_video');

    const reviewSettings = {
      checks: {
        comment: requiresCommentFlow,
        commenterNickname: requiresCommentFlow,
        authorName: true,
        like: isFullCheck || action.includes('点赞'),      // 体验类任务检查点赞
        favorite: isFullCheck || action.includes('收藏'),  // 体验类任务检查收藏
        follow: action.includes('关注')
      }
    };

    if (reviewSettings.checks.commenterNickname && !result.commenterNickname) {
      result.passed = false;
      result.reasons.push('未识别评论人昵称');
    }

    if (reviewSettings.checks.comment && !commentContent) {
      result.passed = false;
      result.reasons.push('未识别评论内容');
    }

    if (requiresCommentFlow && !result.hasComment) {
      result.passed = false;
      result.reasons.push('未检测到评论截图');
    }

    if (reviewSettings.checks.authorName && !result.authorName) {
      result.passed = false;
      result.reasons.push('未识别达人名字');
    }

    // 达人匹配
    const taskAuthor = extractAuthorFromTask(item.task_title, item.video_url);
    if (taskAuthor && result.authorName) {
      if (!this.matchAuthor(taskAuthor, result.authorName)) {
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
      authorName: result.authorName || '没有',
      like: result.interaction.hasLike ? '有' : '没有',
      favorite: result.interaction.hasFavorite ? '有' : '没有',
      follow: result.interaction.hasFollow ? '有' : '没有'
    };

    return result;
  }

  matchAuthor(taskAuthor, detectedAuthor) {
    if (!taskAuthor || !detectedAuthor) return true;
    const t = taskAuthor.replace('@', '').toLowerCase();
    const d = detectedAuthor.replace('@', '').toLowerCase();
    return t === d || t.includes(d) || d.includes(t);
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
            commenterNickname: result.commenterNickname || '没有',
            comment: result.comment || '没有',
            authorName: result.authorName || '没有',
            screenshots: result.screenshotEvidence || []
          }
        })
      );
      
      await client.query(`
        UPDATE claims 
        SET image_review_status = $1,
            image_review_reason = $2,
            image_reviewed_at = NOW(),
            ocr_comment = $3,
            ai_review_status = $4,
            ai_reason = $5,
            review_history = $6
        WHERE id = $7
      `, [
        result.passed ? 'approved' : 'rejected',
        result.reasons.join('; ') || '审核通过',
        result.comment || null,
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

      await publishImageReviewComplete(item.claim_id, item.user_id, true, reason);

    } catch (e) {
      console.error(`[Worker] 完成任务失败: ${e.message}`);
    }
  }
  
  // 拒绝任务（退回用户端）
  async rejectTask(item, result, options = {}) {
    try {
      await db.transaction(async (client) => {
        const claimRes = await client.query(`SELECT reject_count, review_history FROM claims WHERE id = $1`, [item.claim_id]);
        const rejectCount = (claimRes.rows[0]?.reject_count || 0) + 1;
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
        item.claim_id,
        item.user_id,
        false,
        result.reasons.join('; ') || '图片审核未通过'
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

      await publishImageReviewComplete(item.claim_id, item.user_id, false, reason);

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
