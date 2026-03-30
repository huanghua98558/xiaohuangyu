function pickId(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue
    return String(value)
  }
  return ''
}

const REVIEW_TYPES = new Set([
  'claim_approved',
  'claim_rejected',
  'review_failed',
  'claim_manual_queued',
  'claim_manual_corrected',
  'block_detected',
])

const POINT_TYPES = new Set([
  'points_awarded',
  'points_converted',
  'sign_in_reward',
  'achievement_reward',
  'leaderboard_reward',
  'promotion_reward',
  'register_bonus',
  'register_bonus_unlock',
  'admin_points_adjusted',
])

const WITHDRAW_TYPES = new Set([
  'withdraw_submitted',
  'withdraw_approved',
  'withdraw_rejected',
  'withdraw_paid',
])

export function getUserNotificationTarget(notification = {}, user = null) {
  const type = notification.type || 'system'
  const data = notification.data || {}
  const claimId = pickId(data.claimId, data.claim_id)
  const taskId = pickId(data.taskId, data.task_id)
  const blockStatus = String(data.blockStatus || data.block_status || '')

  if (REVIEW_TYPES.has(type)) {
    if (type === 'block_detected' && blockStatus === 'confirmed') {
      return '/my/tasks?tab=blocked'
    }
    if (claimId) return `/my/task/${encodeURIComponent(claimId)}`
    return '/my/tasks'
  }

  if (WITHDRAW_TYPES.has(type)) {
    return '/withdraw'
  }

  if (POINT_TYPES.has(type)) {
    return '/points'
  }

  if (taskId) {
    return `/task/${encodeURIComponent(taskId)}`
  }

  if (user?.role === 'admin' && type === 'system_alert') {
    return '/admin/alerts'
  }

  return '/notifications'
}

export function getUserNotificationActionLabel(notification = {}, user = null) {
  const type = notification.type || 'system'
  const target = getUserNotificationTarget(notification, user)

  if (target.startsWith('/my/task/')) return '查看任务'
  if (target === '/my/tasks') return '任务列表'
  if (target === '/withdraw') return '查看提现'
  if (target === '/points') return '查看积分'
  if (target === '/admin/alerts') return '查看告警'
  if (type === 'system') return '查看消息'
  return '查看详情'
}

export function getAdminNotificationTarget(notification = {}) {
  const type = notification.type || 'system'
  const data = notification.data || {}
  const claimId = pickId(data.claimId, data.claim_id)
  const taskId = pickId(data.taskId, data.task_id)

  if (type === 'manual_review') {
    if (claimId) return `/publisher/claim/${encodeURIComponent(claimId)}`
    return '/admin/review'
  }

  if (type === 'system_alert' || type === 'block_detected') {
    return '/admin/alerts'
  }

  if (claimId) {
    return `/publisher/claim/${encodeURIComponent(claimId)}`
  }

  if (taskId) {
    return '/publisher/tasks'
  }

  return '/admin/notifications'
}

export function getAdminNotificationActionLabel(notification = {}) {
  const target = getAdminNotificationTarget(notification)

  if (target.startsWith('/publisher/claim/')) return '查看详情'
  if (target === '/admin/review') return '去审核'
  if (target === '/admin/alerts') return '查看告警'
  if (target === '/publisher/tasks') return '任务管理'
  return '查看通知'
}
