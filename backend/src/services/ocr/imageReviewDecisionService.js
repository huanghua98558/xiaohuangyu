import { getScreenshotRoleLabel } from '../../utils/claimScreenshots.js';
import {
  extractCommentContent,
  normalizeDetectedValue,
} from './ocrResultNormalizer.js';

export const IMAGE_REVIEW_MIN_COMMENT_LENGTH = 6;

export function hasEffectiveEvidence(combinedEvidence) {
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

export function getEffectiveCommentLength(value) {
  const normalized = extractCommentContent(value);
  if (!normalized) return 0;

  // 去掉空白和大多数符号后再计算长度，避免简单标点凑字数。
  const compact = normalized.replace(/[\s\p{P}\p{S}]+/gu, '');
  return compact.length;
}

export function collectImageReviewTechnicalReasons(screenshotEvidence = [], options = {}) {
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

export function evaluateImageReviewResult({
  ocrResult,
  yoloResult,
  item,
  globalReviewConfig,
  extractAuthorFromTask,
  matchAuthor,
}) {
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

  const commentScreenshotEvidence = result.screenshotEvidence.find((entry) => entry?.screenType === 'comment') || null;
  const structuredCommentContentMissing = Boolean(
    ocrResult.commentExtraction?.contentMissing ||
    commentScreenshotEvidence?.contentMissing
  );

  if (yoloResult) {
    if (yoloResult.has_like !== undefined) result.interaction.hasLike = yoloResult.has_like;
    if (yoloResult.has_favorite !== undefined) result.interaction.hasFavorite = yoloResult.has_favorite;
    if (yoloResult.has_follow !== undefined) result.interaction.hasFollow = yoloResult.has_follow;
  }

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

  const taskAuthor = extractAuthorFromTask(item.task_title, item.video_url, item.action);
  if (taskAuthor && result.authorName) {
    const authorMatch = matchAuthor(taskAuthor, result.authorName);
    if (!authorMatch.match) {
      result.passed = false;
      result.reasons.push(`达人名字不匹配（任务:${taskAuthor} / 截图:${result.authorName}）`);
    }
  }

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
