/**
 * 任务领取状态常量定义
 * 
 * 状态流转：
 * doing -> submitted -> image_reviewing -> link_reviewing -> done
 *                      -> image_failed (回到 doing)
 *                      -> link_rejected (回到 doing)
 * doing -> expired
 * doing -> abandoned
 */

// ==================== 主状态 ====================
export const CLAIM_STATUS = {
  DOING: "doing",                 // 进行中（未提交）
  SUBMITTED: "submitted",         // 已提交（等待审核）
  IMAGE_REVIEWING: "image_reviewing", // 图片审核中
  LINK_REVIEWING: "link_reviewing",   // 链接审核中
  PENDING_MANUAL: "pending_manual",   // 待人工审核
  DONE: "done",                   // 已完成（通过所有审核）
  REJECTED: "rejected",           // 已拒绝（不可重提）
  EXPIRED: "expired",             // 已过期
  ABANDONED: "abandoned"          // 已放弃
}

// ==================== 图片审核状态 ====================
export const IMAGE_REVIEW_STATUS = {
  PENDING: "pending",             // 待审核
  REVIEWING: "reviewing",         // 审核中
  PASSED: "passed",               // 审核通过
  FAILED: "failed"                // 审核失败
}

// ==================== 链接审核状态 ====================
export const LINK_REVIEW_STATUS = {
  PENDING: "pending",             // 待审核
  REVIEWING: "reviewing",         // 审核中
  PASSED: "passed",               // 审核通过
  FAILED: "failed"                // 审核失败
}

// ==================== AI审核状态 ====================
export const AI_REVIEW_STATUS = {
  PENDING: "pending",             // 待审核
  APPROVED: "approved",           // AI通过
  REJECTED: "rejected",           // AI拒绝
  MANUAL: "manual"                // 需人工审核
}

// ==================== 状态显示名称 ====================
export const CLAIM_STATUS_NAMES = {
  [CLAIM_STATUS.DOING]: "进行中",
  [CLAIM_STATUS.SUBMITTED]: "已提交",
  [CLAIM_STATUS.IMAGE_REVIEWING]: "图片审核中",
  [CLAIM_STATUS.LINK_REVIEWING]: "链接审核中",
  [CLAIM_STATUS.PENDING_MANUAL]: "待人工审核",
  [CLAIM_STATUS.DONE]: "已完成",
  [CLAIM_STATUS.REJECTED]: "已拒绝",
  [CLAIM_STATUS.EXPIRED]: "已过期",
  [CLAIM_STATUS.ABANDONED]: "已放弃"
}

// ==================== 辅助函数 ====================

/**
 * 判断是否可以提交任务
 */
export function canSubmit(status) {
  return status === CLAIM_STATUS.DOING
}

/**
 * 判断是否可以放弃任务
 */
export function canAbandon(status) {
  return status === CLAIM_STATUS.DOING || status === CLAIM_STATUS.SUBMITTED
}

/**
 * 判断是否可以撤回提交
 */
export function canWithdraw(status) {
  return status === CLAIM_STATUS.SUBMITTED
}

/**
 * 判断是否为待审核状态
 */
export function isPendingReview(status) {
  return [
    CLAIM_STATUS.SUBMITTED,
    CLAIM_STATUS.IMAGE_REVIEWING,
    CLAIM_STATUS.LINK_REVIEWING,
    CLAIM_STATUS.PENDING_MANUAL
  ].includes(status)
}

/**
 * 判断是否为已完成状态
 */
export function isCompleted(status) {
  return status === CLAIM_STATUS.DONE
}

/**
 * 判断是否为失败状态（可重试）
 */
export function isFailed(status) {
  return status === CLAIM_STATUS.REJECTED || status === CLAIM_STATUS.EXPIRED
}

export default {
  CLAIM_STATUS,
  IMAGE_REVIEW_STATUS,
  LINK_REVIEW_STATUS,
  AI_REVIEW_STATUS,
  CLAIM_STATUS_NAMES,
  canSubmit,
  canAbandon,
  canWithdraw,
  isPendingReview,
  isCompleted,
  isFailed
}
