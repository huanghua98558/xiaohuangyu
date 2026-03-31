function toIsoString(value) {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString()
  }

  const normalized = String(value || '').trim()
  if (!normalized) {
    return ''
  }

  const parsed = new Date(normalized)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString()
  }

  return normalized
}

export function normalizeSubmissionVersion(value, fallback = new Date()) {
  const normalized = toIsoString(value)
  if (normalized) {
    return normalized
  }

  return toIsoString(fallback)
}

function sanitizeKeyPart(value) {
  return normalizeSubmissionVersion(value).replace(/[^a-zA-Z0-9_-]/g, '-')
}

export function buildLinkDelayJobId({ claimId, submissionVersion }) {
  return `link-delay:${claimId}:${sanitizeKeyPart(submissionVersion)}`
}

export function buildLinkVerifyJobId({ claimId, submissionVersion }) {
  return `link-verify:${claimId}:${sanitizeKeyPart(submissionVersion)}`
}
