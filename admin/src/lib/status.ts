/**
 * 任务状态常量定义
 */

// 主状态
export const CLAIM_STATUS = {
  DOING: 'doing',
  SUBMITTED: 'submitted',
  IMAGE_REVIEWING: 'image_reviewing',
  LINK_REVIEWING: 'link_reviewing',
  PENDING_MANUAL: 'pending_manual',
  DONE: 'done',
  APPROVED: 'approved',          // 数据库兼容
  REJECTED: 'rejected',
  IMAGE_REJECTED: 'image_rejected',  // 数据库兼容
  LINK_REJECTED: 'link_rejected',    // 数据库兼容
  EXPIRED: 'expired',
  ABANDONED: 'abandoned'
} as const

// 图片审核状态
export const IMAGE_REVIEW_STATUS = {
  PENDING: 'pending',
  REVIEWING: 'reviewing',
  PASSED: 'passed',
  APPROVED: 'approved',  // 数据库兼容
  FAILED: 'failed',
  REJECTED: 'rejected'   // 数据库兼容
} as const

// 链接审核状态
export const LINK_REVIEW_STATUS = {
  PENDING: 'pending',
  REVIEWING: 'reviewing',
  PASSED: 'passed',
  APPROVED: 'approved',  // 数据库兼容
  FAILED: 'failed',
  REJECTED: 'rejected'   // 数据库兼容
} as const

// 状态显示名称
export const CLAIM_STATUS_NAMES: Record<string, string> = {
  [CLAIM_STATUS.DOING]: '进行中',
  [CLAIM_STATUS.SUBMITTED]: '已提交',
  [CLAIM_STATUS.IMAGE_REVIEWING]: '图片审核中',
  [CLAIM_STATUS.LINK_REVIEWING]: '链接审核中',
  [CLAIM_STATUS.PENDING_MANUAL]: '待人工审核',
  [CLAIM_STATUS.DONE]: '已完成',
  [CLAIM_STATUS.APPROVED]: '已完成',
  [CLAIM_STATUS.REJECTED]: '已拒绝',
  [CLAIM_STATUS.IMAGE_REJECTED]: '图片审核拒绝',
  [CLAIM_STATUS.LINK_REJECTED]: '链接审核拒绝',
  [CLAIM_STATUS.EXPIRED]: '已过期',
  [CLAIM_STATUS.ABANDONED]: '已放弃'
}

// 辅助函数
export function getStatusName(status: string): string {
  return CLAIM_STATUS_NAMES[status] || status
}

export function isCompleted(status: string): boolean {
  return status === CLAIM_STATUS.DONE || status === CLAIM_STATUS.APPROVED
}

export function isFailed(status: string): boolean {
  return [CLAIM_STATUS.REJECTED, CLAIM_STATUS.IMAGE_REJECTED, CLAIM_STATUS.LINK_REJECTED].includes(status as any)
}

export function isPending(status: string): boolean {
  return [CLAIM_STATUS.SUBMITTED, CLAIM_STATUS.IMAGE_REVIEWING, CLAIM_STATUS.LINK_REVIEWING, CLAIM_STATUS.PENDING_MANUAL].includes(status as any)
}
