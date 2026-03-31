import dotenv from 'dotenv';
import {
  buildSubmissionScreenshotEntries,
  normalizeScreenshotEntries,
} from '../utils/claimScreenshots.js';
import { normalizeSubmissionVersion } from '../utils/reviewQueueIds.js';
import { upsertImageReviewOcrJobs } from '../services/ocr/imageReviewOcrJobRepository.js';
import { upsertImageReviewRun } from '../services/ocr/imageReviewRunRepository.js';
import { buildImageReviewRoutePlan } from '../services/ocr/imageReviewRouterService.js';

dotenv.config();

function parseScreenshotPayload(raw) {
  return normalizeScreenshotEntries(raw);
}

function getSubmissionVersionForItem(item) {
  return normalizeSubmissionVersion(
    item?.submission_version || item?.submitted_at,
    Date.now()
  );
}

export function buildImageReviewRoutePlanFromItem(item) {
  const queueScreenshots = parseScreenshotPayload(item?.queue_screenshots);
  const claimScreenshots = parseScreenshotPayload(item?.claim_screenshots);
  const screenshots =
    queueScreenshots.length > 0
      ? queueScreenshots
      : (claimScreenshots.length > 0 ? claimScreenshots : buildSubmissionScreenshotEntries(item?.claim_screenshots));

  return buildImageReviewRoutePlan({
    claimId: item?.claim_id,
    taskId: item?.task_id,
    userId: item?.user_id,
    screenshots,
    submissionVersion: getSubmissionVersionForItem(item),
  });
}

export class ImageReviewRouterWorker {
  async start() {
    console.log('[ImageReviewRouterWorker] 骨架模式启动');
    console.log('[ImageReviewRouterWorker] 当前写入 route plan 与 OCR jobs，尚未接入独立 OCR 队列');
  }

  async buildRoutePlan(item) {
    return buildImageReviewRoutePlanFromItem(item);
  }

  async persistRoutePlan(item) {
    const routePlan = await this.buildRoutePlan(item);
    const run = await upsertImageReviewRun({
      routePlan,
      sourceQueueId: item?.queue_id || null,
      status: 'ocr_pending',
    });
    const jobs = await upsertImageReviewOcrJobs({
      runId: run.id,
      routePlan,
    });

    return {
      routePlan,
      run,
      jobs,
    };
  }
}

export default {
  ImageReviewRouterWorker,
  buildImageReviewRoutePlanFromItem,
};

