const TRAILING_NOISE_PATTERNS = [
  /(主页置顶|置顶)$/u,
  /(拍同款|听抖音|分享|收藏|关注)$/u,
  /(图文作品|的图文作品|的作品)$/u,
  /(图文|作品|广告)$/u,
  /(\d+)$/
]

const BRACKET_TRAIL_PATTERN = /[（(【\[][^）)】\]]*(主页置顶|置顶|图文|作品|拍同款|听抖音|分享|收藏|关注)[^）)】\]]*[）)】\]]$/u

const AUTHOR_CONFUSION_GROUPS = [
  ['于', '宇'],
  ['吴', '罗'],
  ['艺', '芝'],
  ['傢', '家'],
  ['~', '～']
]

const AUTHOR_CONFUSION_MAP = new Map()
for (const group of AUTHOR_CONFUSION_GROUPS) {
  for (const char of group) {
    AUTHOR_CONFUSION_MAP.set(char, group[0])
  }
}

function normalizeUnicode(text) {
  return String(text || '')
    .normalize('NFKC')
    .replace(/\u200b/g, '')
    .trim()
}

function stripTrailingNoise(text) {
  let value = text

  while (true) {
    const before = value
    value = value.replace(BRACKET_TRAIL_PATTERN, '')
    for (const pattern of TRAILING_NOISE_PATTERNS) {
      value = value.replace(pattern, '')
    }
    value = value.replace(/[~～·•・'"“”‘’|]+$/gu, '').trim()
    if (value === before) break
  }

  return value
}

function collapseAuthorText(text) {
  return String(text || '')
    .replace(/^@+/u, '')
    .replace(/^[：:;；,.，。!?！？、]+/u, '')
    .replace(/[\s`~～!！@#￥$%^…&*＊()（）_\-+=[\]{}【】\\|;；:'"“”‘’，。,.<>《》/?？]+/gu, '')
    .trim()
}

export function normalizeAuthorName(text) {
  if (!text) return ''

  let value = normalizeUnicode(text)

  const atMatches = [...value.matchAll(/@([^@\n\r]+)/gu)]
  if (atMatches.length > 0) {
    value = atMatches[atMatches.length - 1][1]
  }

  value = stripTrailingNoise(value)
  value = collapseAuthorText(value)
  value = stripTrailingNoise(value)
  value = collapseAuthorText(value)

  return value.toLowerCase()
}

export function normalizeAuthorNameLoose(text) {
  const normalized = normalizeAuthorName(text)
  return Array.from(normalized).map((char) => AUTHOR_CONFUSION_MAP.get(char) || char).join('')
}

function levenshteinDistance(a, b) {
  const aa = Array.from(a)
  const bb = Array.from(b)
  if (aa.length === 0) return bb.length
  if (bb.length === 0) return aa.length

  const matrix = Array.from({ length: aa.length + 1 }, () => new Array(bb.length + 1).fill(0))
  for (let i = 0; i <= aa.length; i++) matrix[i][0] = i
  for (let j = 0; j <= bb.length; j++) matrix[0][j] = j

  for (let i = 1; i <= aa.length; i++) {
    for (let j = 1; j <= bb.length; j++) {
      const cost = aa[i - 1] === bb[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }

  return matrix[aa.length][bb.length]
}

function countVariantDiffs(a, b) {
  const aa = Array.from(a)
  const bb = Array.from(b)
  if (aa.length !== bb.length) return Number.POSITIVE_INFINITY

  let diffs = 0
  for (let i = 0; i < aa.length; i++) {
    if (aa[i] === bb[i]) continue
    const left = AUTHOR_CONFUSION_MAP.get(aa[i])
    const right = AUTHOR_CONFUSION_MAP.get(bb[i])
    if (!left || !right || left !== right) {
      return Number.POSITIVE_INFINITY
    }
    diffs += 1
  }
  return diffs
}

export function matchAuthorWithTolerance(taskAuthor, detectedAuthor, options = {}) {
  const allowMissingDetected = options.allowMissingDetected !== false

  if (!taskAuthor) {
    return { match: true, mode: 'no_task_author', reason: '无需验证达人' }
  }

  if (!detectedAuthor) {
    return allowMissingDetected
      ? { match: true, mode: 'missing_detected', reason: '页面未识别到达人，默认通过' }
      : { match: false, mode: 'missing_detected', reason: '未识别达人名字' }
  }

  const normalizedTask = normalizeAuthorName(taskAuthor)
  const normalizedDetected = normalizeAuthorName(detectedAuthor)

  if (!normalizedTask || !normalizedDetected) {
    return allowMissingDetected
      ? { match: true, mode: 'empty_normalized', reason: '达人信息不足，默认通过', normalizedTask, normalizedDetected }
      : { match: false, mode: 'empty_normalized', reason: `达人不匹配: 期望 ${taskAuthor}, 实际 ${detectedAuthor}`, normalizedTask, normalizedDetected }
  }

  if (
    normalizedTask === normalizedDetected ||
    normalizedTask.includes(normalizedDetected) ||
    normalizedDetected.includes(normalizedTask)
  ) {
    return {
      match: true,
      mode: 'normalized_exact',
      reason: '达人匹配成功',
      normalizedTask,
      normalizedDetected
    }
  }

  const looseTask = normalizeAuthorNameLoose(taskAuthor)
  const looseDetected = normalizeAuthorNameLoose(detectedAuthor)

  if (
    looseTask === looseDetected ||
    looseTask.includes(looseDetected) ||
    looseDetected.includes(looseTask)
  ) {
    return {
      match: true,
      mode: 'loose_normalized',
      reason: '达人近似匹配成功',
      normalizedTask,
      normalizedDetected,
      looseTask,
      looseDetected
    }
  }

  const variantDiffs = countVariantDiffs(normalizedTask, normalizedDetected)
  if (Number.isFinite(variantDiffs) && variantDiffs > 0 && variantDiffs <= Math.max(1, Math.floor(normalizedTask.length / 4))) {
    return {
      match: true,
      mode: 'variant_confusion',
      reason: '达人近似匹配成功',
      normalizedTask,
      normalizedDetected,
      variantDiffs
    }
  }

  const maxLen = Math.max(normalizedTask.length, normalizedDetected.length)
  const distance = levenshteinDistance(normalizedTask, normalizedDetected)
  const similarity = maxLen > 0 ? 1 - distance / maxLen : 0
  if (maxLen >= 4 && distance <= 1 && similarity >= 0.8) {
    return {
      match: true,
      mode: 'edit_distance',
      reason: '达人近似匹配成功',
      normalizedTask,
      normalizedDetected,
      distance,
      similarity
    }
  }

  return {
    match: false,
    mode: 'mismatch',
    reason: `达人不匹配: 期望 ${taskAuthor}, 实际 ${detectedAuthor}`,
    normalizedTask,
    normalizedDetected,
    distance,
    similarity
  }
}
