import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/database.js';
import { publishImageReviewComplete } from '../utils/wsEventPublisher.js';
import promotionService from '../services/promotionService.js';
import pointsSettlementService from '../services/pointsSettlementService.js';
import { notifyClaimRejected, notifyManualReviewQueued } from '../services/notificationService.js';
import { enqueueLinkVerificationCompat } from '../services/ai/queueService.js';
import { CLAIM_STATUS } from '../constants/claimLifecycle.js';
import { appendReviewHistory, createReviewHistoryEntry } from '../utils/claimReviewHistory.js';
import { matchAuthorWithTolerance } from '../utils/authorMatch.js';
import { listImageReviewOcrJobsByRunId } from '../services/ocr/imageReviewOcrJobRepository.js';
import {
  buildCombinedEvidenceFromMergePayload,
  buildImageReviewMergePayload,
  buildImageReviewMergeSummary,
} from '../services/ocr/imageReviewMergeService.js';
import { evaluateImageReviewResult, hasEffectiveEvidence } from '../services/ocr/imageReviewDecisionService.js';
import { getEffectiveImageReviewConfig } from '../services/ocr/imageReviewConfigService.js';
import {
  decideImageReviewPipelineFallback,
  decideImageReviewPostResultFlow,
} from '../services/ocr/imageReviewFlowService.js';
import {
  markImageReviewManual,
  markImageReviewRejected,
  markImageReviewTaskCompleted,
  saveImageReviewResult,
} from '../services/ocr/imageReviewPersistenceService.js';
import {
  claimNextMergeReadyImageReviewRun,
  getImageReviewRunById,
  getImageReviewRunByMergeKey,
  updateImageReviewRunMergeState,
} from '../services/ocr/imageReviewRunRepository.js';
import { detectHomepageInteraction } from '../services/ocr/yoloClient.js';
import { TIMEOUTS, YOLO_SERVICE_CONFIG } from '../services/ocr/ocrRuntimeConfig.js';

const CURRENT_FILE = fileURLToPath(import.meta.url);

function shouldAutoStartWorker() {
  const argvPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
  const pm2ExecPath = process.env.pm_exec_path ? path.resolve(process.env.pm_exec_path) : null;
  const runningUnderPm2 = process.env.pm_id !== undefined;
  return runningUnderPm2 || argvPath === CURRENT_FILE || pm2ExecPath === CURRENT_FILE;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function urlToLocalPath(imageUrl) {
  try {
    if (!imageUrl || typeof imageUrl !== 'string') return null;
    const normalized = imageUrl.trim();
    if (!normalized || normalized === 'system') return null;
    const localStorageDir = process.env.LOCAL_STORAGE_DIR || '/data/images/uploads';

    if (normalized.startsWith('uploads/')) {
      return path.join(localStorageDir, normalized.replace(/^uploads\//, ''));
    }
    if (normalized.startsWith('/uploads/')) {
      const relativePath = normalized.replace('/uploads/', '');
      if (!relativePath) return null;
      return path.join(localStorageDir, relativePath);
    }
    if (normalized.startsWith('/')) {
      return null;
    }

    const url = new URL(normalized);
    const match = url.pathname.match(/\/uploads\/(.+)/);
    if (match) {
      return path.join(localStorageDir, match[1]);
    }
    return null;
  } catch {
    return null;
  }
}

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
  } catch {
    return null;
  }
}

function extractAuthorFromTask(title, videoUrl, action = '') {
  const normalizedAction = String(action || '').toLowerCase();
  const isShortVideoResearch =
    normalizedAction.includes('short_video') ||
    normalizedAction.includes('短视频') ||
    normalizedAction.includes('体验');

  if (isShortVideoResearch) {
    return null;
  }

  const titleMatch = title?.match(/@([\w\u4e00-\u9fff]+)/);
  if (titleMatch) return titleMatch[1];
  const urlMatch = videoUrl?.match(/看看【(.+?)】/);
  if (urlMatch) return urlMatch[1].replace('的作品', '');
  return null;
}

function extractLinkFromVideoUrl(videoUrl) {
  if (!videoUrl) return null;
  const linkMatch = videoUrl.match(/(https?:\/\/[^\s]+)/);
  if (linkMatch) return linkMatch[1];
  return videoUrl;
}

export class ImageReviewMergeWorker {
  constructor() {
    this.running = false;
  }

  async start() {
    console.log('[ImageReviewMergeWorker] 主链模式启动');
    console.log('[ImageReviewMergeWorker] 当前轮询 merge_ready run，并执行最终图片审核判定与落库');
    this.running = true;
    this.poll();
  }

  stop() {
    this.running = false;
  }

  async buildMergePayload({ routePlan, ocrResults = [] }) {
    const mergePayload = buildImageReviewMergePayload({
      routePlan,
      ocrResults,
    });

    console.log('[ImageReviewMergeWorker] merge summary:', JSON.stringify(
      buildImageReviewMergeSummary(mergePayload)
    ));

    return mergePayload;
  }

  async fetchItemForRun(run) {
    return db.queryOne(
      `
      SELECT
        q.id as queue_id,
        q.claim_id,
        q.user_id,
        q.task_id,
        q.screenshots as queue_screenshots,
        q.status,
        q.retry_count,
        q.submission_version,
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
      WHERE q.claim_id = $1
      LIMIT 1
      `,
      [run.claim_id]
    );
  }

  async callYOLOForMerge(mergePayload) {
    const homepageScreenshot = (mergePayload?.mergedScreenshots || []).find(
      (item) => item?.ocrProfile === 'homepage'
    );
    if (!homepageScreenshot || !YOLO_SERVICE_CONFIG.healthy) {
      return null;
    }

    const imagePath = urlToLocalPath(homepageScreenshot.url);
    if (!imagePath) {
      return null;
    }

    try {
      return await detectHomepageInteraction(imagePath, {
        serviceUrl: YOLO_SERVICE_CONFIG.url,
        timeoutMs: TIMEOUTS.YOLO,
      });
    } catch {
      return null;
    }
  }

  async evaluateMergedRun({ run, mergePayload }) {
    const item = await this.fetchItemForRun(run);
    if (!item) {
      throw new Error(`merge run 缺少关联 queue item: ${run.claim_id}`);
    }

    const yoloResult = await this.callYOLOForMerge(mergePayload);
    const { combinedEvidence, technicalFailureReasons } = buildCombinedEvidenceFromMergePayload({
      mergePayload,
      yoloResult,
    });

    const pipelineFallback = decideImageReviewPipelineFallback({
      technicalFailureReasons,
      hasEffectiveEvidence: hasEffectiveEvidence(combinedEvidence),
      screenshotCount: (mergePayload?.mergedScreenshots || []).length,
    });
    if (pipelineFallback?.action === 'manual_review') {
      await markImageReviewManual({
        item,
        reason: pipelineFallback.reason,
        details: pipelineFallback.details,
      });
      await updateImageReviewRunMergeState({
        runId: run.id,
        mergePayload,
        status: 'manual',
        readyCount: mergePayload?.readiness?.readyCount || 0,
        lastError: pipelineFallback.reason,
      });
      await publishImageReviewComplete(item.claim_id, item.user_id, false, pipelineFallback.reason, await fetchClaimForPush(item.claim_id));
      await notifyManualReviewQueued({
        claimId: item.claim_id,
        userId: item.user_id,
        taskId: item.task_id,
        stage: 'image_review',
        reason: pipelineFallback.reason,
      }).catch(() => {});
      return { item, result: null, action: 'manual_review' };
    }

    const globalReviewConfig = await getEffectiveImageReviewConfig();
    const result = evaluateImageReviewResult({
      ocrResult: combinedEvidence,
      yoloResult,
      item,
      globalReviewConfig,
      extractAuthorFromTask,
      matchAuthor: (taskAuthor, detectedAuthor) =>
        matchAuthorWithTolerance(taskAuthor, detectedAuthor, { allowMissingDetected: false }),
    });

    await saveImageReviewResult({
      item,
      result,
      duration: 0,
    });

    const reviewFlow = decideImageReviewPostResultFlow({
      item,
      result,
      link: extractLinkFromVideoUrl(item.video_url),
      submissionVersion: run.submission_version,
      taskAuthorName: extractAuthorFromTask(item.task_title, item.video_url, item.action),
    });

    if (reviewFlow.action === 'reject') {
      await markImageReviewRejected({ item, result, options: reviewFlow.options });
      await updateImageReviewRunMergeState({
        runId: run.id,
        mergePayload,
        status: 'completed',
        readyCount: mergePayload?.readiness?.readyCount || 0,
      });
      await publishImageReviewComplete(item.claim_id, item.user_id, false, result.reasons.join('; ') || '图片审核未通过', await fetchClaimForPush(item.claim_id));
      await notifyClaimRejected(item.user_id, item.claim_id, result.reasons.join('; ') || '图片审核未通过').catch(() => {});
      return { item, result, action: 'reject' };
    }

    if (reviewFlow.action === 'manual_review') {
      await markImageReviewManual({
        item,
        reason: reviewFlow.reason,
        details: reviewFlow.details,
      });
      await updateImageReviewRunMergeState({
        runId: run.id,
        mergePayload,
        status: 'manual',
        readyCount: mergePayload?.readiness?.readyCount || 0,
      });
      await publishImageReviewComplete(item.claim_id, item.user_id, false, reviewFlow.reason, await fetchClaimForPush(item.claim_id));
      await notifyManualReviewQueued({
        claimId: item.claim_id,
        userId: item.user_id,
        taskId: item.task_id,
        stage: 'image_review',
        reason: reviewFlow.reason,
      }).catch(() => {});
      return { item, result, action: 'manual_review' };
    }

    if (reviewFlow.action === 'enqueue_link_review') {
      const queueResult = await enqueueLinkVerificationCompat(reviewFlow.payload);
      if (queueResult.skipped && queueResult.reason === '连接审核已禁用') {
        await markImageReviewTaskCompleted({ item, reason: '图片审核通过，连接审核已关闭' });
        const settlement = await pointsSettlementService.awardClaimPoints({
          claimId: item.claim_id,
          taskId: item.task_id,
          userId: item.user_id,
          awardReason: '图片审核通过（免链接审核）',
          source: 'image_review_merge_worker',
        });
        const awardedPoints = settlement?.finalPoints || 0;
        await promotionService.calculateCPromotionEarnings(item.claim_id, item.user_id, awardedPoints).catch(() => {});
        await publishImageReviewComplete(item.claim_id, item.user_id, true, '图片审核通过，连接审核已关闭', await fetchClaimForPush(item.claim_id));
      } else if (queueResult.queued) {
        const linkConfig = queueResult.config || {};
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
                retryCount: linkConfig.retryCount,
              },
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
              item.claim_id,
            ]
          );
        });
        await publishImageReviewComplete(item.claim_id, item.user_id, true, '图片审核通过，等待连接审核', await fetchClaimForPush(item.claim_id));
      } else {
        throw new Error(queueResult.reason || '连接审核入队失败');
      }

      await updateImageReviewRunMergeState({
        runId: run.id,
        mergePayload,
        status: 'completed',
        readyCount: mergePayload?.readiness?.readyCount || 0,
      });
      return { item, result, action: 'enqueue_link_review' };
    }

    if (reviewFlow.action === 'complete') {
      await markImageReviewTaskCompleted({ item, reason: reviewFlow.reason });
      const settlement = await pointsSettlementService.awardClaimPoints({
        claimId: item.claim_id,
        taskId: item.task_id,
        userId: item.user_id,
        awardReason: '图片审核通过（免链接审核）',
        source: 'image_review_merge_worker',
      });
      const awardedPoints = settlement?.finalPoints || 0;
      await promotionService.calculateCPromotionEarnings(item.claim_id, item.user_id, awardedPoints).catch(() => {});
      await updateImageReviewRunMergeState({
        runId: run.id,
        mergePayload,
        status: 'completed',
        readyCount: mergePayload?.readiness?.readyCount || 0,
      });
      await publishImageReviewComplete(item.claim_id, item.user_id, true, reviewFlow.reason, await fetchClaimForPush(item.claim_id));
      return { item, result, action: 'complete' };
    }

    return { item, result, action: 'unknown' };
  }

  async loadMergePayloadByMergeKey(mergeKey) {
    const run = await getImageReviewRunByMergeKey(mergeKey);
    if (!run) {
      throw new Error(`未找到 merge run: ${mergeKey}`);
    }
    if (!run.route_plan_json) {
      throw new Error(`merge run 缺少 route_plan_json: ${mergeKey}`);
    }

    const ocrJobs = await listImageReviewOcrJobsByRunId(run.id);
    const ocrResults = ocrJobs.map((job) => ({
      dispatchKey: job.dispatch_key,
      status: job.status === 'completed' ? 'completed' : job.status,
      ocrResult: job.ocr_result_json,
      error: job.error_json,
      processedAt: job.processed_at,
    }));

    const mergePayload = await this.buildMergePayload({
      routePlan: run.route_plan_json,
      ocrResults,
    });

    const readyCount = mergePayload?.readiness?.readyCount || 0;
    const nextStatus = mergePayload?.readiness?.ready
      ? 'merge_ready'
      : (readyCount > 0 ? 'ocr_partial' : 'ocr_pending');

    const updatedRun = await updateImageReviewRunMergeState({
      runId: run.id,
      mergePayload,
      status: nextStatus,
      readyCount,
      mergedAt: mergePayload?.readiness?.ready ? new Date().toISOString() : null,
    });

    return {
      run: updatedRun,
      jobs: ocrJobs,
      mergePayload,
    };
  }

  async processNextReadyRun() {
    const run = await claimNextMergeReadyImageReviewRun();
    if (!run) {
      return null;
    }

    try {
      const latestRun = await getImageReviewRunById(run.id);
      const activeRun = latestRun || run;
      const ocrJobs = await listImageReviewOcrJobsByRunId(activeRun.id);
      const ocrResults = ocrJobs.map((job) => ({
        dispatchKey: job.dispatch_key,
        status: job.status === 'completed' ? 'completed' : job.status,
        ocrResult: job.ocr_result_json,
        error: job.error_json,
        processedAt: job.processed_at,
      }));
      const mergePayload = await this.buildMergePayload({
        routePlan: activeRun.route_plan_json,
        ocrResults,
      });
      return this.evaluateMergedRun({
        run: activeRun,
        mergePayload,
      });
    } catch (error) {
      await updateImageReviewRunMergeState({
        runId: run.id,
        mergePayload: run.merge_payload_json,
        status: 'failed',
        readyCount: run.ready_count || 0,
        lastError: error.message,
      });
      throw error;
    }
  }

  async poll() {
    while (this.running) {
      try {
        const result = await this.processNextReadyRun();
        if (!result) {
          await sleep(2000);
          continue;
        }
        console.log('[ImageReviewMergeWorker] merge run 已完成:', JSON.stringify({
          claimId: result.item?.claim_id,
          action: result.action,
          passed: result.result?.passed,
        }));
      } catch (error) {
        console.error(`[ImageReviewMergeWorker] 轮询处理失败: ${error.message}`);
        await sleep(5000);
      }
    }
  }
}

export default {
  ImageReviewMergeWorker,
};

if (shouldAutoStartWorker()) {
  const worker = new ImageReviewMergeWorker();
  worker.start().catch(console.error);
}

