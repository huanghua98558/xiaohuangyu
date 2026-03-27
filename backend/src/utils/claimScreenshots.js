export const SCREENSHOT_ROLES = {
  HOMEPAGE: 'homepage',
  COMMENT: 'comment',
  EXTRA: 'extra',
}

function parseJsonField(raw, fallback) {
  if (raw === undefined || raw === null) return fallback
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return fallback
    }
  }
  return raw
}

export function getDefaultScreenshotRole(index = 0) {
  if (index === 0) return SCREENSHOT_ROLES.HOMEPAGE
  if (index === 1) return SCREENSHOT_ROLES.COMMENT
  return SCREENSHOT_ROLES.EXTRA
}

export function normalizeScreenshotRole(role, index = 0) {
  const normalized = String(role || '').trim().toLowerCase()
  if (['homepage', 'home', 'profile', 'author_profile', 'author', 'video_home'].includes(normalized)) {
    return SCREENSHOT_ROLES.HOMEPAGE
  }
  if (['comment', 'comment_screenshot', 'comments', 'reply'].includes(normalized)) {
    return SCREENSHOT_ROLES.COMMENT
  }
  if (normalized === SCREENSHOT_ROLES.EXTRA) {
    return SCREENSHOT_ROLES.EXTRA
  }
  return getDefaultScreenshotRole(index)
}

export function normalizeScreenshotEntry(item, index = 0) {
  if (!item) return null

  if (typeof item === 'string') {
    const url = item.trim()
    if (!url) return null
    return {
      url,
      role: getDefaultScreenshotRole(index),
      sortOrder: index,
    }
  }

  if (typeof item === 'object') {
    const url = String(item.url || item.imageUrl || item.path || '').trim()
    if (!url) return null
    return {
      url,
      role: normalizeScreenshotRole(item.role || item.type, index),
      sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
    }
  }

  return null
}

export function normalizeScreenshotEntries(raw) {
  const parsed = parseJsonField(raw, [])
  if (!Array.isArray(parsed)) return []
  return parsed
    .map((item, index) => normalizeScreenshotEntry(item, index))
    .filter(Boolean)
}

export function normalizeScreenshotUrls(raw) {
  return normalizeScreenshotEntries(raw).map((item) => item.url).filter(Boolean)
}

export function buildSubmissionScreenshotEntries(raw) {
  return normalizeScreenshotEntries(raw).map((item, index) => ({
    url: item.url,
    role: normalizeScreenshotRole(item.role, index),
    sortOrder: index,
  }))
}

export function isCommentScreenshotRole(role) {
  return normalizeScreenshotRole(role, 1) === SCREENSHOT_ROLES.COMMENT
}

export function isHomepageScreenshotRole(role) {
  return normalizeScreenshotRole(role, 0) === SCREENSHOT_ROLES.HOMEPAGE
}

export function getScreenshotRoleLabel(role) {
  const normalized = normalizeScreenshotRole(role)
  if (normalized === SCREENSHOT_ROLES.COMMENT) return '评论截图'
  if (normalized === SCREENSHOT_ROLES.HOMEPAGE) return '视频主页图'
  return '补充截图'
}
