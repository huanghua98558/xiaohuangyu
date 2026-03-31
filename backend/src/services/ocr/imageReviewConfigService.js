import db from '../../config/database.js';
import reviewConfigService from '../ai/reviewConfigService.js';

const REVIEW_SETTINGS_CACHE = {
  value: null,
  loadedAt: 0,
  ttlMs: 30000,
};

export async function getEffectiveImageReviewConfig() {
  const now = Date.now();
  if (REVIEW_SETTINGS_CACHE.value && now - REVIEW_SETTINGS_CACHE.loadedAt < REVIEW_SETTINGS_CACHE.ttlMs) {
    return REVIEW_SETTINGS_CACHE.value;
  }

  const config = await reviewConfigService.getConfig();
  const merged = {
    ...config,
    checks: { ...(config?.checks || {}) },
  };

  try {
    const legacyRow = await db.queryOne(
      "SELECT value FROM ai_configs WHERE key = 'image_review_settings' LIMIT 1"
    );

    if (legacyRow?.value) {
      const legacy = JSON.parse(legacyRow.value);
      if (legacy?.checks && typeof legacy.checks === 'object') {
        merged.checks = {
          ...merged.checks,
          ...legacy.checks,
        };
      }
    }
  } catch (error) {
    console.warn('[ImageReviewConfig] 读取 image_review_settings 失败，使用全局审核配置:', error.message);
  }

  REVIEW_SETTINGS_CACHE.value = merged;
  REVIEW_SETTINGS_CACHE.loadedAt = now;
  return merged;
}

export default {
  getEffectiveImageReviewConfig,
};

