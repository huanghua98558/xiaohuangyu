import { normalizeSubmissionVersion } from '../../utils/reviewQueueIds.js';

function sanitizeKeyPart(value) {
  return normalizeSubmissionVersion(value).replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function buildImageReviewDispatchKey({
  claimId,
  submissionVersion,
  screenshotIndex,
  resolvedRole,
}) {
  return `${resolvedRole}-ocr:${claimId}:${sanitizeKeyPart(submissionVersion)}:${screenshotIndex}`;
}

export function buildImageReviewMergeKey({ claimId, submissionVersion }) {
  return `image-merge:${claimId}:${sanitizeKeyPart(submissionVersion)}`;
}

export function createImageReviewRouteEntry({
  claimId,
  submissionVersion,
  screenshotIndex,
  screenshot,
  resolvedRole,
  ocrProfile,
  index = 0,
}) {
  return {
    screenshotIndex,
    sortOrder: Number.isFinite(Number(screenshot?.sortOrder)) ? Number(screenshot.sortOrder) : index,
    url: screenshot?.url,
    expectedRole: screenshot?.expectedRole || screenshot?.role,
    precheckRole: screenshot?.precheckRole,
    resolvedRole,
    precheckConfidence: screenshot?.precheckConfidence,
    precheckReason: screenshot?.precheckReason,
    ocrProfile,
    dispatchKey: buildImageReviewDispatchKey({
      claimId,
      submissionVersion,
      screenshotIndex,
      resolvedRole,
    }),
  };
}

export function createImageReviewRoutePlan({
  claimId,
  taskId,
  userId,
  submissionVersion,
  routes = [],
}) {
  const normalizedSubmissionVersion = normalizeSubmissionVersion(submissionVersion, Date.now());

  return {
    claimId,
    taskId,
    userId,
    submissionVersion: normalizedSubmissionVersion,
    mergeKey: buildImageReviewMergeKey({
      claimId,
      submissionVersion: normalizedSubmissionVersion,
    }),
    routes,
    groups: {
      homepage: routes.filter((route) => route.ocrProfile === 'homepage'),
      comment: routes.filter((route) => route.ocrProfile === 'comment'),
    },
  };
}

export function normalizeOcrMergeEntry(entry = {}) {
  return {
    dispatchKey: entry.dispatchKey || '',
    status: entry.status || 'pending',
    ocrResult: entry.ocrResult || null,
    error: entry.error || null,
    processedAt: entry.processedAt || null,
  };
}

export function createMergedScreenshotEntry({
  route,
  result,
}) {
  return {
    screenshotIndex: route.screenshotIndex,
    sortOrder: route.sortOrder,
    url: route.url,
    expectedRole: route.expectedRole,
    precheckRole: route.precheckRole,
    resolvedRole: route.resolvedRole,
    precheckConfidence: route.precheckConfidence,
    precheckReason: route.precheckReason,
    ocrProfile: route.ocrProfile,
    dispatchKey: route.dispatchKey,
    mergeStatus: result?.status || 'pending',
    ocrResult: result?.ocrResult || null,
    error: result?.error || null,
    processedAt: result?.processedAt || null,
  };
}

export function createImageReviewMergePayload({
  routePlan,
  mergedScreenshots = [],
}) {
  const readyCount = mergedScreenshots.filter((item) => item.mergeStatus === 'completed').length;
  const missingDispatchKeys = mergedScreenshots
    .filter((item) => item.mergeStatus !== 'completed')
    .map((item) => item.dispatchKey);

  return {
    claimId: routePlan?.claimId,
    taskId: routePlan?.taskId,
    userId: routePlan?.userId,
    submissionVersion: routePlan?.submissionVersion,
    mergeKey: routePlan?.mergeKey,
    readiness: {
      expectedCount: mergedScreenshots.length,
      readyCount,
      ready: mergedScreenshots.length > 0 && missingDispatchKeys.length === 0,
      missingDispatchKeys,
    },
    groups: {
      homepage: mergedScreenshots.filter((item) => item.ocrProfile === 'homepage'),
      comment: mergedScreenshots.filter((item) => item.ocrProfile === 'comment'),
    },
    mergedScreenshots,
  };
}

export function createImageReviewMergeSummary(mergePayload) {
  return {
    claimId: mergePayload?.claimId,
    mergeKey: mergePayload?.mergeKey,
    expectedCount: mergePayload?.readiness?.expectedCount || 0,
    readyCount: mergePayload?.readiness?.readyCount || 0,
    ready: Boolean(mergePayload?.readiness?.ready),
    missingDispatchKeys: mergePayload?.readiness?.missingDispatchKeys || [],
  };
}

export default {
  buildImageReviewDispatchKey,
  buildImageReviewMergeKey,
  createImageReviewMergePayload,
  createImageReviewMergeSummary,
  createImageReviewRouteEntry,
  createImageReviewRoutePlan,
  createMergedScreenshotEntry,
  normalizeOcrMergeEntry,
};

