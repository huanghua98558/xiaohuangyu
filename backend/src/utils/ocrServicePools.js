function parseUrls(value, fallback = []) {
  if (!value) return [...fallback]
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function dedupe(items) {
  return [...new Set(items.filter(Boolean))]
}

function safePort(url) {
  try {
    return Number(new URL(url).port || (url.startsWith('https://') ? 443 : 80))
  } catch {
    return null
  }
}

export const OCR_PROFILE = {
  HOMEPAGE: 'homepage',
  COMMENT: 'comment',
}

function normalizeProfile(profile) {
  const normalized = String(profile || '').trim().toLowerCase()
  return normalized === OCR_PROFILE.COMMENT ? OCR_PROFILE.COMMENT : OCR_PROFILE.HOMEPAGE
}

function readProfileUrls(env, profile) {
  const normalized = normalizeProfile(profile)
  if (normalized === OCR_PROFILE.HOMEPAGE) {
    return parseUrls(
      env.OCR_HOMEPAGE_URLS || env.IMAGE_REVIEW_OCR_HOMEPAGE_URLS,
      ['http://127.0.0.1:9001', 'http://127.0.0.1:9002']
    )
  }

  return parseUrls(
    env.OCR_COMMENT_URLS || env.IMAGE_REVIEW_OCR_COMMENT_URLS,
    ['http://127.0.0.1:9101', 'http://127.0.0.1:9102']
  )
}

function buildEntries(urls, profile) {
  return dedupe(urls).map((url, index) => {
    const port = safePort(url)
    const host = (() => {
      try {
        return new URL(url).hostname
      } catch {
        return null
      }
    })()

    return {
      index,
      url,
      port,
      profile: normalizeProfile(profile),
      isLocal: host === '127.0.0.1' || host === 'localhost',
      isTunnel: port !== null && port >= 9100 && port < 9200,
    }
  })
}

export function getOcrServicePoolEntries(env = process.env) {
  const homepage = buildEntries(readProfileUrls(env, OCR_PROFILE.HOMEPAGE), OCR_PROFILE.HOMEPAGE)
  const comment = buildEntries(readProfileUrls(env, OCR_PROFILE.COMMENT), OCR_PROFILE.COMMENT)
  const all = [...homepage, ...comment]

  return {
    homepage,
    comment,
    all,
  }
}

export function getOcrServicePools(env = process.env) {
  const entries = getOcrServicePoolEntries(env)
  const homepage = entries.homepage.map((item) => item.url)
  const comment = entries.comment.map((item) => item.url)
  const all = entries.all.map((item) => item.url)

  return {
    homepage,
    comment,
    all,
    entries,
  }
}

export function getOcrHealthEndpoints(env = process.env) {
  return getOcrServicePoolEntries(env).all.map((entry) => ({
    index: entry.index,
    url: entry.url,
    port: entry.port,
    profile: entry.profile,
    isLocal: entry.isLocal,
    isTunnel: entry.isTunnel,
  }))
}
