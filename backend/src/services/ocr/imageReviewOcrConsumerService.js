import fs from 'fs';
import path from 'path';
import redisConnection from '../../config/queue.js';
import { analyzeImageWithOcr } from './ocrClient.js';
import {
  claimNextPendingImageReviewOcrJob,
  markImageReviewOcrJobCompleted,
  markImageReviewOcrJobFailed,
} from './imageReviewOcrJobRepository.js';
import { buildImageReviewMergePayload, buildImageReviewMergeSummary } from './imageReviewMergeService.js';
import {
  buildOcrServicesToTry,
  getNextOcrService,
  getOcrProfileByRole,
} from './ocrRouteService.js';
import {
  OCR_ALLOW_CROSS_PROFILE_FALLBACK,
  OCR_SERVICE_POOLS,
  OCR_SERVICES_CONFIG,
  REDIS_KEYS,
  TIMEOUTS,
} from './ocrRuntimeConfig.js';
import {
  isServiceQuarantined,
  reportServiceFailure,
  reportServiceSuccess,
} from './ocrHealthService.js';
import {
  getImageReviewRunById,
  updateImageReviewRunMergeState,
} from './imageReviewRunRepository.js';
import { listImageReviewOcrJobsByRunId } from './imageReviewOcrJobRepository.js';

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

export const OCR_WORKER_LOOP_CONFIG = {
  idlePollMs: readIntegerConfig(process.env.IMAGE_REVIEW_OCR_JOB_IDLE_POLL_MS, 2000, 200),
  errorPollMs: readIntegerConfig(process.env.IMAGE_REVIEW_OCR_JOB_ERROR_POLL_MS, 5000, 500),
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function urlToLocalPath(imageUrl) {
  try {
    if (!imageUrl || typeof imageUrl !== 'string') return null;
    const normalized = imageUrl.trim();
    if (!normalized || normalized === 'system') return null;

    if (normalized.startsWith('uploads/')) {
      const localStorageDir = process.env.LOCAL_STORAGE_DIR || '/data/images/uploads';
      return path.join(localStorageDir, normalized.replace(/^uploads\//, ''));
    }

    if (normalized.startsWith('/uploads/')) {
      const localStorageDir = process.env.LOCAL_STORAGE_DIR || '/data/images/uploads';
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
      const localStorageDir = process.env.LOCAL_STORAGE_DIR || '/data/images/uploads';
      return path.join(localStorageDir, match[1]);
    }
    return null;
  } catch {
    return null;
  }
}

async function analyzeJobWithOcr(job) {
  const screenshotRole = job?.resolved_role || job?.expected_role || 'homepage';
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

  const imagePath = urlToLocalPath(job?.image_url);
  if (!imagePath || !fs.existsSync(imagePath)) {
    throw new Error(`OCR job 文件不存在: ${job?.image_url}`);
  }

  if (servicesToTry.length === 0) {
    throw new Error(`当前没有可用的 ${expectedProfile} OCR 服务`);
  }

  for (const service of servicesToTry) {
    try {
      const result = await analyzeImageWithOcr(imagePath, {
        serviceUrl: service.url,
        screenshotRole,
        timeoutMs: TIMEOUTS.OCR,
      });
      reportServiceSuccess(OCR_SERVICES_CONFIG, service.url);
      return result;
    } catch (error) {
      reportServiceFailure({
        serviceConfigs: OCR_SERVICES_CONFIG,
        serviceUrl: service.url,
        onFailure: () => {},
      });
      if (servicesToTry.indexOf(service) >= servicesToTry.length - 1) {
        throw error;
      }
    }
  }

  throw new Error('OCR 服务全部尝试失败');
}

export async function refreshMergeStateForRunId(runId) {
  if (!runId) {
    return null;
  }

  const run = await getImageReviewRunById(runId);
  if (!run || !run.route_plan_json) {
    return null;
  }

  const ocrJobs = await listImageReviewOcrJobsByRunId(run.id);
  const ocrResults = ocrJobs.map((job) => ({
    dispatchKey: job.dispatch_key,
    status: job.status === 'completed' ? 'completed' : job.status,
    ocrResult: job.ocr_result_json,
    error: job.error_json,
    processedAt: job.processed_at,
  }));

  const mergePayload = buildImageReviewMergePayload({
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
    mergeSummary: buildImageReviewMergeSummary(mergePayload),
  };
}

export function createImageReviewOcrConsumer({ ocrProfile, workerName }) {
  return {
    async claimNextJob() {
      return claimNextPendingImageReviewOcrJob({
        ocrProfile,
        claimedBy: workerName,
      });
    },

    async processJob(job) {
      if (!job) return null;

      try {
        const ocrResult = await analyzeJobWithOcr(job);
        await markImageReviewOcrJobCompleted({
          dispatchKey: job.dispatch_key,
          ocrResult,
        });
        const mergeState = await refreshMergeStateForRunId(job.run_id);
        return {
          job,
          status: 'completed',
          ocrResult,
          mergeState,
        };
      } catch (error) {
        await markImageReviewOcrJobFailed({
          dispatchKey: job.dispatch_key,
          error: {
            message: error.message,
            workerName,
            ocrProfile,
          },
        });
        const mergeState = await refreshMergeStateForRunId(job.run_id);
        return {
          job,
          status: 'failed',
          error,
          mergeState,
        };
      }
    },

    async processNextJob() {
      const job = await this.claimNextJob();
      if (!job) {
        return null;
      }
      return this.processJob(job);
    },

    async waitForNextPoll(reason = 'idle') {
      const timeoutMs = reason === 'error'
        ? OCR_WORKER_LOOP_CONFIG.errorPollMs
        : OCR_WORKER_LOOP_CONFIG.idlePollMs;
      await sleep(timeoutMs);
    },
  };
}

export default {
  OCR_WORKER_LOOP_CONFIG,
  createImageReviewOcrConsumer,
  refreshMergeStateForRunId,
};

