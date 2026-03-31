import {
  createImageReviewMergePayload,
  createImageReviewMergeSummary,
  createMergedScreenshotEntry,
  normalizeOcrMergeEntry,
} from './imageReviewContractService.js';
import {
  createCombinedEvidence,
  mergeOcrEvidence,
} from './ocrResultNormalizer.js';
import { collectImageReviewTechnicalReasons } from './imageReviewDecisionService.js';
import { isCommentScreenshotRole } from '../../utils/claimScreenshots.js';

export function buildImageReviewMergePayload({
  routePlan,
  ocrResults = [],
}) {
  const normalizedResults = ocrResults.map(normalizeOcrMergeEntry);
  const resultByDispatchKey = new Map(
    normalizedResults.map((entry) => [entry.dispatchKey, entry])
  );

  const mergedScreenshots = (routePlan?.routes || []).map((route) => {
    const result = resultByDispatchKey.get(route.dispatchKey) || null;
    return createMergedScreenshotEntry({ route, result });
  });

  return createImageReviewMergePayload({
    routePlan,
    mergedScreenshots,
  });
}

export function buildImageReviewMergeSummary(mergePayload) {
  return createImageReviewMergeSummary(mergePayload);
}

export function buildCombinedEvidenceFromMergePayload({
  mergePayload,
  yoloResult = null,
}) {
  const combinedEvidence = createCombinedEvidence('ocr_merge');
  const mergedScreenshots = mergePayload?.mergedScreenshots || [];

  for (const screenshot of mergedScreenshots) {
    if (screenshot?.mergeStatus === 'completed' && screenshot?.ocrResult) {
      const isCommentScreenshot = mergeOcrEvidence(
        combinedEvidence,
        screenshot.ocrResult,
        screenshot.screenshotIndex,
        screenshot.expectedRole || screenshot.resolvedRole || 'homepage'
      );

      const detectedRole = isCommentScreenshot ? 'comment' : 'homepage';
      if (
        screenshot.resolvedRole &&
        screenshot.expectedRole &&
        screenshot.resolvedRole !== screenshot.expectedRole
      ) {
        combinedEvidence.screenshots.push({
          screenshotIndex: screenshot.screenshotIndex,
          source: 'precheck',
          status: 'role_prechecked',
          expectedRole: screenshot.expectedRole,
          detectedRole: screenshot.resolvedRole,
          note: `预判阶段已先按 ${screenshot.resolvedRole} 路由 OCR`,
        });
      }
      if (detectedRole !== screenshot.expectedRole && screenshot.expectedRole !== 'extra') {
        combinedEvidence.screenshots.push({
          screenshotIndex: screenshot.screenshotIndex,
          source: 'routing',
          status: 'role_mismatch',
          expectedRole: screenshot.expectedRole,
          detectedRole,
          note: '截图角色与默认顺序不一致，已按识别结果纠偏',
        });
      }
      continue;
    }

    combinedEvidence.screenshots.push({
      screenshotIndex: screenshot?.screenshotIndex,
      source: 'ocr',
      status: screenshot?.mergeStatus === 'failed' ? 'failed' : 'pending',
      expectedRole: screenshot?.expectedRole || screenshot?.resolvedRole || 'homepage',
    });
  }

  const hasHomepageScreenshot = mergedScreenshots.some((screenshot) => {
    const resolvedRole = screenshot?.resolvedRole || screenshot?.expectedRole || 'homepage';
    return !isCommentScreenshotRole(resolvedRole);
  });

  const technicalFailureReasons = collectImageReviewTechnicalReasons(combinedEvidence.screenshots, {
    hasHomepageScreenshot,
    yoloResult,
  });

  return {
    combinedEvidence,
    technicalFailureReasons,
    hasHomepageScreenshot,
  };
}

export default {
  buildCombinedEvidenceFromMergePayload,
  buildImageReviewMergePayload,
  buildImageReviewMergeSummary,
};

