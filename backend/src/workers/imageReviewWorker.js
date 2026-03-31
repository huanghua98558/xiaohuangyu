/**
 * 图片审核 Worker - 优化版
 * 
 * 优化内容：
 * 1. Redis 共享轮询索引 - 解决多 Worker 负载不均
 * 2. 服务健康检查 + 自动摘除 - 运行时监控服务状态
 * 3. 超时配置优化 - OCR 10s, YOLO 5s
 *
 * 职责边界：
 * - OCR 负责评论正文、评论人昵称、达人名字等文字识别
 * - YOLO 只负责主页类截图上的互动按钮识别（点赞/收藏/关注）
 * - 当前流程里，只有截图被判定为主页类截图时才会调用 YOLO
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { execFile } from 'child_process';
import { promisify } from 'util';
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
import { enqueueLinkVerificationCompat } from '../services/ai/queueService.js';
import { CLAIM_STATUS } from '../constants/claimLifecycle.js';
import { appendReviewHistory, createReviewHistoryEntry } from '../utils/claimReviewHistory.js';
import { matchAuthorWithTolerance } from '../utils/authorMatch.js';
import {
  buildSubmissionScreenshotEntries,
  getScreenshotRoleLabel,
  normalizeScreenshotEntries,
} from '../utils/claimScreenshots.js';
import {
  buildOcrServicesToTry,
  getNextOcrService,
  getOcrProfileByRole,
} from '../services/ocr/ocrRouteService.js';
import {
  evaluateImageReviewResult,
  hasEffectiveEvidence,
} from '../services/ocr/imageReviewDecisionService.js';
import { getEffectiveImageReviewConfig } from '../services/ocr/imageReviewConfigService.js';
import {
  buildImageRolePrecheckSummary,
  decideImageReviewPipelineFallback,
  decideImageReviewPostResultFlow,
} from '../services/ocr/imageReviewFlowService.js';
import { precheckImageRoles } from '../services/ocr/imageRolePrecheckService.js';
import { processImageReviewScreenshots } from '../services/ocr/imageReviewPipelineService.js';
import {
  markImageReviewManual,
  markImageReviewRejected,
  markImageReviewTaskCompleted,
  saveImageReviewResult,
} from '../services/ocr/imageReviewPersistenceService.js';
import { markImageReviewOcrJobCompleted, markImageReviewOcrJobFailed, markImageReviewOcrJobProcessing } from '../services/ocr/imageReviewOcrJobRepository.js';
import {
  checkServiceHealth,
  isServiceQuarantined,
  markServiceUnhealthy,
  reportServiceFailure,
  reportServiceSuccess,
  startHealthCheck,
  triggerLocalOcrRestart,
} from '../services/ocr/ocrHealthService.js';
import { ImageReviewRouterWorker } from './imageReviewRouterWorker.js';
import { detectHomepageInteraction } from '../services/ocr/yoloClient.js';
import { analyzeImageWithOcr } from '../services/ocr/ocrClient.js';
import {
  BATCH_SIZE,
  HEALTH_CONFIG,
  LOCAL_OCR_PROCESS_BY_URL,
  LOCAL_STORAGE_DIR,
  OCR_ALLOW_CROSS_PROFILE_FALLBACK,
  OCR_SERVICE_POOLS,
  OCR_SERVICES_CONFIG,
  POLL_INTERVAL,
  REDIS_KEYS,
  TIMEOUTS,
  YOLO_SERVICE_CONFIG,
} from '../services/ocr/ocrRuntimeConfig.js';
import { normalizeSubmissionVersion } from '../utils/reviewQueueIds.js';

dotenv.config();
const execFileAsync = promisify(execFile);
const PM2_BIN = process.env.PM2_BIN || 'pm2';
const transitionRouterWorker = new ImageReviewRouterWorker();

function getSubmissionVersionForItem(item) {
  return normalizeSubmissionVersion(
    item?.submission_version || item?.submitted_at,
    Date.now()
  );
}

function restartLocalOcrService(serviceConfig, reason = 'health_failure') {
  return triggerLocalOcrRestart({
    serviceConfig,
    reason,
    localOcrProcessByUrl: LOCAL_OCR_PROCESS_BY_URL,
    healthConfig: HEALTH_CONFIG,
    redisClient: redisConnection,
    restartLockPrefix: REDIS_KEYS.OCR_RESTART_LOCK_PREFIX,
    execRestart: (processName, timeoutMs) =>
      execFileAsync(PM2_BIN, ['restart', processName], { timeout: timeoutMs }),
  });
}

function handleServiceUnhealthy(serviceConfig, serviceName, reason = 'runtime_failure') {
  return markServiceUnhealthy({
    serviceConfig,
    serviceName,
    reason,
    healthConfig: HEALTH_CONFIG,
    triggerRestart: restartLocalOcrService,
  });
}

// ============ Redis 共享轮询索引 ============

// ============ 服务健康检查 ============

/**
 * 检查单个服务健康状态
 */
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

  const expectedProfile = getOcrProfileByRole(screenshotRole);
  const preferredUrl = await getNextOcrService({
    role: screenshotRole,
    servicePools: OCR_SERVICE_POOLS,
    serviceConfigs: OCR_SERVICES_CONFIG,
    redisClient: redisConnection,
    redisKeys: REDIS_KEYS,
    isServiceQuarantined,
  });
  const servicesToTry = buildOcrServicesToTry({
    role: screenshotRole,
    preferredUrl,
    servicePools: OCR_SERVICE_POOLS,
    serviceConfigs: OCR_SERVICES_CONFIG,
    allowCrossProfileFallback: OCR_ALLOW_CROSS_PROFILE_FALLBACK,
    isServiceQuarantined,
  });

  if (servicesToTry.length === 0) {
    console.warn('[Worker] 当前没有可用的健康 OCR 服务，将返回空结果并由上层转人工处理');
    return null;
  }
  
  // 最多尝试所有健康服务
  for (const service of servicesToTry) {
    try {
      const result = await analyzeImageWithOcr(imagePath, {
        serviceUrl: service.url,
        screenshotRole,
        timeoutMs: TIMEOUTS.OCR,
      });

      const serviceProfile = service.profile || 'unknown';
      const actualProfile = String(result?.profile || '').trim().toLowerCase();
      if (actualProfile && serviceProfile !== 'unknown' && actualProfile !== serviceProfile) {
        console.warn(
          `[Worker] OCR 节点 profile 返回异常: service=${service.url}, expected=${serviceProfile}, actual=${actualProfile}`
        );
      }
      
      reportServiceSuccess(OCR_SERVICES_CONFIG, service.url);
      return result;
    } catch (e) {
      console.warn(
        `[Worker] OCR ${service.url} (${getScreenshotRoleLabel(screenshotRole)}, profile=${expectedProfile}) 调用失败: ${e.message}`
      );
      reportServiceFailure({
        serviceConfigs: OCR_SERVICES_CONFIG,
        serviceUrl: service.url,
        onFailure: handleServiceUnhealthy,
      });
      
      // 如果还有其他服务可以尝试，继续
      if (servicesToTry.indexOf(service) < servicesToTry.length - 1) {
        console.log(`[Worker] 尝试下一个 OCR 服务...`);
        continue;
      }
    }
  }
  
  // 所有 OCR 服务都失败，当前不再走 AI 降级，返回空结果由上层转人工处理。
  console.warn('[Worker] 所有 OCR 服务不可用，当前无降级通道，将由上层转人工处理');
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

  try {
    const result = await detectHomepageInteraction(imagePath, {
      serviceUrl: YOLO_SERVICE_CONFIG.url,
      timeoutMs: TIMEOUTS.YOLO,
    });
    
    YOLO_SERVICE_CONFIG.failCount = 0;
    return result;
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
    console.log(`  - 轮询配置: poll=${POLL_INTERVAL}ms, batch=${BATCH_SIZE}`);
    console.log(`  - 超时配置: OCR ${TIMEOUTS.OCR}ms, YOLO ${TIMEOUTS.YOLO}ms`);
    console.log(`  - OCR主页池: ${OCR_SERVICE_POOLS.homepage.join(', ')}`);
    console.log(`  - OCR评论池: ${OCR_SERVICE_POOLS.comment.join(', ')}`);
    console.log(`  - OCR跨Profile兜底: ${OCR_ALLOW_CROSS_PROFILE_FALLBACK ? '开启' : '关闭'}`);
    
    // 启动健康检查
    await startHealthCheck({
      ocrServices: OCR_SERVICES_CONFIG,
      yoloServiceConfig: YOLO_SERVICE_CONFIG,
      healthConfig: HEALTH_CONFIG,
      checkServiceHealthFn: (serviceConfig, serviceName) =>
        checkServiceHealth({
          serviceConfig,
          serviceName,
          timeoutMs: TIMEOUTS.HEALTH_CHECK,
          healthConfig: HEALTH_CONFIG,
          onFailure: handleServiceUnhealthy,
        }),
    });
    
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

      const precheckedScreenshots = precheckImageRoles(screenshots);
      console.log('[Worker] role-precheck 结果:', JSON.stringify(buildImageRolePrecheckSummary(precheckedScreenshots)));

      const transitionRoute = await transitionRouterWorker.persistRoutePlan({
        ...item,
        queue_screenshots: JSON.stringify(precheckedScreenshots),
      });
      console.log('[Worker] 过渡链路 route plan 已落库:', JSON.stringify({
        runId: transitionRoute.run?.id,
        mergeKey: transitionRoute.run?.merge_key,
        jobCount: transitionRoute.jobs?.length || 0,
      }));
      console.log(`[Worker] ✅ route plan 已提交，后续由 OCR workers + merge worker 继续处理: claim_id=${item.claim_id}`);
      return;

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
    const globalReviewConfig = await getEffectiveImageReviewConfig();
    return evaluateImageReviewResult({
      ocrResult,
      yoloResult,
      item,
      globalReviewConfig,
      extractAuthorFromTask,
      matchAuthor: (taskAuthor, detectedAuthor) => this.matchAuthor(taskAuthor, detectedAuthor),
    });
  }

  matchAuthor(taskAuthor, detectedAuthor) {
    return matchAuthorWithTolerance(taskAuthor, detectedAuthor, { allowMissingDetected: false });
  }

  async saveResult(item, result, duration) {
    await saveImageReviewResult({
      item,
      result,
      duration,
    });
  }
  
  // 完成任务（无需链接验证时）
  async completeTask(item, result, reason = '无需连接审核，任务完成') {
    try {
      await markImageReviewTaskCompleted({ item, reason });

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
      const rejectState = await markImageReviewRejected({ item, result, options });

      if (rejectState.released) {
        console.log('[Worker] ⚠️ 任务已释放: 拒绝次数达到3次');
      } else {
        console.log(`[Worker] 🔄 任务已退回用户端: 拒绝次数 ${rejectState.rejectCount}/3, 新倒计时 ${rejectState.timeLimitMinutes}分钟`);
      }

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
      await markImageReviewManual({ item, reason, details });

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
