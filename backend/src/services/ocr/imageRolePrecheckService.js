import {
  getDefaultScreenshotRole,
  normalizeScreenshotRole,
  SCREENSHOT_ROLES,
} from '../../utils/claimScreenshots.js';

function normalizeKeywordSource(value) {
  return String(value || '').trim().toLowerCase();
}

function detectRoleFromKeywords(value) {
  const normalized = normalizeKeywordSource(value);
  if (!normalized) {
    return null;
  }

  const commentKeywords = [
    'comment',
    'comments',
    'reply',
    'replies',
    'pinglun',
    '评论',
    '回复',
  ];
  const homepageKeywords = [
    'homepage',
    'home',
    'profile',
    'author',
    'works',
    'zuopin',
    '主页',
    '首页',
    '作品',
    '达人',
  ];

  if (commentKeywords.some((keyword) => normalized.includes(keyword))) {
    return SCREENSHOT_ROLES.COMMENT;
  }
  if (homepageKeywords.some((keyword) => normalized.includes(keyword))) {
    return SCREENSHOT_ROLES.HOMEPAGE;
  }

  return null;
}

function buildPrecheckDecision({ screenshot, index }) {
  const expectedRole = normalizeScreenshotRole(screenshot?.role, index);
  const rawUrl = String(screenshot?.url || '').trim();
  const keywordRole = detectRoleFromKeywords(rawUrl);

  if (keywordRole) {
    return {
      expectedRole,
      precheckRole: keywordRole,
      resolvedRole: keywordRole,
      precheckConfidence: keywordRole === expectedRole ? 'high' : 'medium',
      precheckReason: `命中图片 URL 关键词，预判为${keywordRole}`,
    };
  }

  if (expectedRole === SCREENSHOT_ROLES.EXTRA) {
    return {
      expectedRole,
      precheckRole: 'unknown',
      resolvedRole: getDefaultScreenshotRole(index),
      precheckConfidence: 'low',
      precheckReason: '补充截图缺少明确结构特征，暂按默认顺序兜底',
    };
  }

  return {
    expectedRole,
    precheckRole: expectedRole,
    resolvedRole: expectedRole,
    precheckConfidence: 'low',
    precheckReason: '当前为轻量规则预判，先沿用预期角色进入 OCR',
  };
}

export function precheckImageRoles(screenshots = []) {
  return screenshots.map((screenshot, index) => {
    const decision = buildPrecheckDecision({ screenshot, index });
    return {
      ...screenshot,
      expectedRole: decision.expectedRole,
      precheckRole: decision.precheckRole,
      precheckResolvedRole: decision.resolvedRole,
      precheckConfidence: decision.precheckConfidence,
      precheckReason: decision.precheckReason,
    };
  });
}

export default {
  precheckImageRoles,
};

