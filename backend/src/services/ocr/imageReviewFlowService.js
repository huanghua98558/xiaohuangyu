export function buildImageRolePrecheckSummary(screenshots = []) {
  return screenshots.map((screenshot, index) => ({
    screenshotIndex: index + 1,
    expectedRole: screenshot.expectedRole,
    precheckRole: screenshot.precheckRole,
    resolvedRole: screenshot.precheckResolvedRole,
    confidence: screenshot.precheckConfidence,
  }));
}

export function decideImageReviewPipelineFallback({
  technicalFailureReasons = [],
  hasEffectiveEvidence = false,
  screenshotCount = 0,
}) {
  if (technicalFailureReasons.length > 0) {
    return {
      action: 'manual_review',
      reason: '图片审核服务异常，已转人工优先检查',
      details: {
        stage: 'image_review',
        blocking: true,
        highlight: true,
        source: 'ocr_yolo_technical_failure',
        technicalFailure: true,
        technicalReasons: technicalFailureReasons,
        screenshotCount,
      },
    };
  }

  if (!hasEffectiveEvidence) {
    return {
      action: 'manual_review',
      reason: '图片识别失败，已转人工检查',
      details: {
        stage: 'image_review',
        blocking: true,
        highlight: true,
        source: 'ocr_yolo',
        screenshotCount,
      },
    };
  }

  return null;
}

export function decideImageReviewPostResultFlow({
  item,
  result,
  link,
  submissionVersion,
  taskAuthorName,
}) {
  if (!result?.passed) {
    return {
      action: 'reject',
      options: {
        pushToManualQueue: true,
        manualReason: 'OCR+YOLO 审核未通过，已加入人工检查列表',
        manualDetails: {
          stage: 'image_review',
          blocking: false,
          reasons: result?.reasons || [],
          detected: result?.detected,
          source: result?.source || 'ocr_yolo',
        },
      },
    };
  }

  if (!item?.video_url) {
    return {
      action: 'complete',
      reason: '无需连接审核，任务完成',
    };
  }

  if (!link) {
    return {
      action: 'manual_review',
      reason: '任务链接解析失败，已转人工复审',
      details: {
        videoUrl: item.video_url,
      },
    };
  }

  return {
    action: 'enqueue_link_review',
    payload: {
      claimId: item.claim_id,
      userId: item.user_id,
      taskId: item.task_id,
      videoUrl: link,
      platform: item.platform || 'douyin',
      taskAuthorName,
      action: item.action,
      submissionVersion,
    },
  };
}

export default {
  buildImageRolePrecheckSummary,
  decideImageReviewPipelineFallback,
  decideImageReviewPostResultFlow,
};

