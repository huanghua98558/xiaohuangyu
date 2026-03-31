type NotificationData = Record<string, unknown> | undefined

function pickId(...values: unknown[]) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue
    return String(value)
  }
  return ''
}

function buildPath(path: string, params: Record<string, string>) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value)
  })
  const queryString = query.toString()
  return queryString ? `${path}?${queryString}` : path
}

export function getAdminNotificationHref(notification: {
  type?: string
  data?: NotificationData
}) {
  const type = notification?.type || 'system'
  const data = notification?.data || {}
  const claimId = pickId(data.claimId, data.claim_id)
  const taskId = pickId(data.taskId, data.task_id)
  const withdrawalId = pickId(data.withdrawalId, data.withdrawal_id)
  const blockStatus = pickId(data.blockStatus, data.block_status)

  if (type === 'manual_review') {
    return buildPath('/admin/ai-review-center', { claimId, tab: 'manual' })
  }

  if (type === 'block_detected') {
    return blockStatus === 'confirmed'
      ? buildPath('/admin/ai-review-center', { claimId, tab: 'blocked' })
      : buildPath('/admin/ai-review-center', { claimId, tab: 'manual' })
  }

  if (type === 'withdrawal' || withdrawalId) {
    return buildPath('/admin/withdrawals', { withdrawalId })
  }

  if (type === 'system_alert' || type === 'alert' || data.ruleId || data.severity || data.source) {
    return '/admin/alerts'
  }

  if (claimId) {
    return buildPath('/admin/ai-review-center', { claimId })
  }

  if (taskId) {
    return buildPath('/admin/tasks', { taskId })
  }

  return '/admin/notifications'
}

export function getAdminNotificationActionLabel(notification: {
  type?: string
  data?: NotificationData
}) {
  const target = getAdminNotificationHref(notification)

  if (target.startsWith('/admin/ai-review-center')) return '查看审核'
  if (target.startsWith('/admin/withdrawals')) return '查看提现'
  if (target.includes('tab=blocked')) return '查看封控'
  if (target === '/admin/alerts') return '查看告警'
  if (target.startsWith('/admin/tasks')) return '查看任务'
  return '查看通知'
}
