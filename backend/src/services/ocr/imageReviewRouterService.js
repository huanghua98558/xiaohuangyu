import { precheckImageRoles } from './imageRolePrecheckService.js';
import { getOcrProfileByRole } from './ocrRouteService.js';
import { normalizeSubmissionVersion } from '../../utils/reviewQueueIds.js';
import {
  buildImageReviewDispatchKey,
  buildImageReviewMergeKey,
  createImageReviewRouteEntry,
  createImageReviewRoutePlan,
} from './imageReviewContractService.js';

export function buildImageReviewRoutePlan({
  claimId,
  taskId,
  userId,
  screenshots = [],
  submissionVersion,
}) {
  const normalizedSubmissionVersion = normalizeSubmissionVersion(submissionVersion, Date.now());
  const precheckedScreenshots = precheckImageRoles(screenshots);

  const routes = precheckedScreenshots.map((screenshot, index) => {
    const screenshotIndex = index + 1;
    const resolvedRole = screenshot.precheckResolvedRole || screenshot.expectedRole || screenshot.role;
    const ocrProfile = getOcrProfileByRole(resolvedRole);

    return createImageReviewRouteEntry({
      claimId,
      submissionVersion: normalizedSubmissionVersion,
      screenshotIndex,
      screenshot,
      resolvedRole,
      ocrProfile,
      index,
    });
  });

  return createImageReviewRoutePlan({
    claimId,
    taskId,
    userId,
    submissionVersion: normalizedSubmissionVersion,
    routes,
  });
}

export default {
  buildImageReviewDispatchKey,
  buildImageReviewMergeKey,
  buildImageReviewRoutePlan,
};

