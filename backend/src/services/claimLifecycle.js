export const CLAIM_STATUS = {
  DOING: 'doing',
  SUBMITTED: 'submitted',
  IMAGE_REVIEWING: 'image_reviewing',
  PENDING_LINK: 'pending_link',
  LINK_REVIEWING: 'link_reviewing',
  PENDING_MANUAL: 'pending_manual',
  APPROVED: 'approved',
  DONE: 'done',
  RELEASED: 'released',
  EXPIRED: 'expired',
  ABANDONED: 'abandoned',
  IMAGE_REJECTED: 'image_rejected',
  LINK_REJECTED: 'link_rejected',
  REJECTED: 'rejected'
}

export const LEGACY_STATUS_MAP = {
  in_progress: CLAIM_STATUS.DOING,
  image_approved: CLAIM_STATUS.PENDING_LINK,
  link_approved: CLAIM_STATUS.APPROVED
}

export const PENDING_REVIEW_STATUSES = [
  CLAIM_STATUS.SUBMITTED,
  CLAIM_STATUS.IMAGE_REVIEWING,
  CLAIM_STATUS.PENDING_LINK,
  CLAIM_STATUS.LINK_REVIEWING,
  CLAIM_STATUS.PENDING_MANUAL
]

/** 仍占用「进行中」名额的状态（任务池 / 曝光并发统计与 DB claims 表一致） */
export const ACTIVE_CLAIM_STATUS_FOR_EXPOSURE = [
  CLAIM_STATUS.DOING,
  CLAIM_STATUS.SUBMITTED,
  CLAIM_STATUS.IMAGE_REVIEWING,
  CLAIM_STATUS.PENDING_LINK,
  CLAIM_STATUS.LINK_REVIEWING,
  CLAIM_STATUS.PENDING_MANUAL
]

export const FINAL_APPROVED_STATUSES = [
  CLAIM_STATUS.APPROVED,
  CLAIM_STATUS.DONE
]

export const RETRYABLE_REJECTION_STATUSES = [
  CLAIM_STATUS.IMAGE_REJECTED,
  CLAIM_STATUS.LINK_REJECTED,
  CLAIM_STATUS.REJECTED
]

export function normalizeClaimStatus(status) {
  if (!status) {
    return status
  }
  return LEGACY_STATUS_MAP[status] || status
}

export function hasRejectedReviewState(claim = {}) {
  const imageRejected = ['rejected', 'failed'].includes(claim.image_review_status)
  const linkRejected = ['rejected', 'failed'].includes(claim.link_review_status)
  return imageRejected || linkRejected
}

export function isClaimRejectedForUserDisplay(claim = {}) {
  const normalizedStatus = normalizeClaimStatus(claim.status)
  return (
    RETRYABLE_REJECTION_STATUSES.includes(normalizedStatus) ||
    (normalizedStatus === CLAIM_STATUS.DOING &&
      Number(claim.reject_count || 0) > 0 &&
      hasRejectedReviewState(claim))
  )
}

export function canResubmitClaim(claim = {}) {
  const normalizedStatus = normalizeClaimStatus(claim.status)
  return (
    (normalizedStatus === CLAIM_STATUS.DOING ||
      RETRYABLE_REJECTION_STATUSES.includes(normalizedStatus)) &&
    Number(claim.reject_count || 0) < 3
  )
}
