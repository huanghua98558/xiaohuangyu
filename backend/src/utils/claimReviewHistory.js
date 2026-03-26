export function safeParseReviewHistory(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

export function createReviewHistoryEntry({
  stage,
  action,
  reason = '',
  details = {},
  timestamp = new Date().toISOString()
}) {
  return {
    stage,
    action,
    reason,
    details,
    timestamp
  }
}

export function appendReviewHistory(raw, entry) {
  const history = safeParseReviewHistory(raw)
  history.push(entry)
  return history
}

export function getLatestMeaningfulReason(claim = {}) {
  const candidates = [
    claim.review_note,
    claim.link_review_reason,
    claim.image_review_reason,
    claim.ai_reason
  ].filter(Boolean)

  if (candidates.length > 0) {
    return candidates[0]
  }

  const history = safeParseReviewHistory(claim.review_history)
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const item = history[i]
    if (item?.reason) {
      return item.reason
    }
    if (item?.details?.reason) {
      return item.details.reason
    }
  }

  return ''
}
