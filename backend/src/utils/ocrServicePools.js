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

export function getOcrServicePools(env = process.env) {
  const homepage = dedupe(
    parseUrls(env.IMAGE_REVIEW_OCR_HOMEPAGE_URLS, ['http://127.0.0.1:9001'])
  )
  const comment = dedupe(
    parseUrls(env.IMAGE_REVIEW_OCR_COMMENT_URLS, ['http://127.0.0.1:9001', 'http://127.0.0.1:9002'])
  )
  const all = dedupe([...homepage, ...comment])

  return {
    homepage,
    comment,
    all,
  }
}

export function getOcrHealthEndpoints(env = process.env) {
  return getOcrServicePools(env).all.map((url, index) => ({
    index,
    url,
    port: safePort(url),
  }))
}
