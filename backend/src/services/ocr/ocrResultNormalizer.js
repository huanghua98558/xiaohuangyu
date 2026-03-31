import { isCommentScreenshotRole } from '../../utils/claimScreenshots.js';

export function normalizeDetectedValue(value) {
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

export function extractCommentContent(value) {
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

export function createCombinedEvidence(source = 'ocr_yolo') {
  return {
    source,
    has_comment_keyword: false,
    commenterNickname: null,
    comment: null,
    authorName: null,
    commentExtraction: {
      confidence: null,
      hasStructuredBlock: false,
      hasNickname: false,
      hasComment: false,
      contentMissing: false,
      trustedNickname: false,
      trustedComment: false
    },
    interaction: {
      hasLike: false,
      hasFavorite: false,
      hasFollow: false
    },
    screenshots: []
  };
}

export function mergeInteractionState(target, source = {}) {
  if (!target || !source) return;
  target.hasLike = Boolean(target.hasLike || source.hasLike || source.has_like);
  target.hasFavorite = Boolean(target.hasFavorite || source.hasFavorite || source.has_favorite);
  target.hasFollow = Boolean(target.hasFollow || source.hasFollow || source.has_follow);
}

export function mergeOcrEvidence(combinedEvidence, ocrResult, screenshotIndex, expectedRole = 'homepage') {
  if (!combinedEvidence || !ocrResult) return false;

  const structuredComment = ocrResult.first_comment || null;
  const commentText = extractCommentContent(structuredComment?.content || ocrResult.comment);
  const explicitType = ocrResult.detectedType || ocrResult.detected_type || null;
  const authorName = normalizeDetectedValue(
    ocrResult.authorName ||
    ocrResult.author_name ||
    (explicitType === 'homepage' ? ocrResult.author : null)
  );
  const commenterNickname = normalizeDetectedValue(
    structuredComment?.nickname ||
    ocrResult.commenterNickname ||
    ocrResult.commenter_nickname ||
    (explicitType === 'comment' ? ocrResult.author : null)
  );
  const extractionConfidence = normalizeDetectedValue(
    structuredComment?.confidence ||
    ocrResult.extraction_confidence ||
    null
  );
  const confidenceLevel = String(extractionConfidence || '').toLowerCase();
  const hasStructuredCommentBlock = Boolean(
    structuredComment?.nickname ||
    structuredComment?.content ||
    (Array.isArray(ocrResult.comment_candidates) && ocrResult.comment_candidates.length > 0)
  );
  const contentMissing = Boolean(
    structuredComment?.contentMissing ||
    (structuredComment?.nickname && !structuredComment?.content)
  );
  const trustCommentContent = !isCommentScreenshotRole(expectedRole) || ['high', 'medium'].includes(confidenceLevel);
  const trustCommentNickname = !isCommentScreenshotRole(expectedRole)
    ? false
    : Boolean(commenterNickname) && (['high', 'medium'].includes(confidenceLevel) || contentMissing || hasStructuredCommentBlock);

  let isCommentScreenshot = false;
  if (isCommentScreenshotRole(expectedRole)) {
    isCommentScreenshot = true;
  } else if (expectedRole === 'homepage' || expectedRole === 'profile') {
    isCommentScreenshot = false;
  } else if (explicitType === 'comment') {
    isCommentScreenshot = true;
  } else if (explicitType === 'homepage') {
    isCommentScreenshot = false;
  } else if (!isCommentScreenshotRole(expectedRole) && authorName) {
    isCommentScreenshot = false;
  } else {
    isCommentScreenshot = Boolean(ocrResult.has_comment_keyword || commentText || commenterNickname);
  }

  combinedEvidence.has_comment_keyword = Boolean(
    combinedEvidence.has_comment_keyword ||
    (explicitType === 'comment' ? true : ocrResult.has_comment_keyword) ||
    commentText
  );

  combinedEvidence.authorName = combinedEvidence.authorName || authorName;

  if (isCommentScreenshot) {
    if (trustCommentContent) {
      combinedEvidence.comment = combinedEvidence.comment || commentText;
    }
    if (trustCommentNickname) {
      combinedEvidence.commenterNickname = combinedEvidence.commenterNickname || commenterNickname;
    }
    combinedEvidence.commentExtraction = {
      confidence: extractionConfidence || combinedEvidence.commentExtraction?.confidence || 'unknown',
      hasStructuredBlock: Boolean(combinedEvidence.commentExtraction?.hasStructuredBlock || hasStructuredCommentBlock),
      hasNickname: Boolean(combinedEvidence.commentExtraction?.hasNickname || commenterNickname),
      hasComment: Boolean(combinedEvidence.commentExtraction?.hasComment || commentText),
      contentMissing: Boolean(combinedEvidence.commentExtraction?.contentMissing || contentMissing),
      trustedNickname: Boolean(combinedEvidence.commentExtraction?.trustedNickname || trustCommentNickname),
      trustedComment: Boolean(combinedEvidence.commentExtraction?.trustedComment || trustCommentContent)
    };
  } else {
    combinedEvidence.authorName = combinedEvidence.authorName || authorName;
  }

  mergeInteractionState(combinedEvidence.interaction, ocrResult.interaction);

  combinedEvidence.screenshots.push({
    screenshotIndex,
    source: 'ocr',
    screenType: isCommentScreenshot ? 'comment' : 'profile',
    hasCommentKeyword: Boolean(ocrResult.has_comment_keyword),
    commenterNickname: isCommentScreenshot ? (trustCommentNickname ? (commenterNickname || '没有') : '低置信度未采信') : '没有',
    comment: trustCommentContent ? (commentText || '没有') : (contentMissing ? '正文未识别' : '低置信度未采信'),
    authorName: authorName || '没有',
    firstComment: structuredComment || null,
    extractionConfidence: extractionConfidence || 'unknown',
    commentCandidates: Array.isArray(ocrResult.comment_candidates) ? ocrResult.comment_candidates.slice(0, 3) : [],
    contentMissing,
    trustedNickname: trustCommentNickname,
    trustedComment: trustCommentContent
  });

  return isCommentScreenshot;
}

export function mergeAiEvidence(combinedEvidence, aiResult, screenshotIndex) {
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
