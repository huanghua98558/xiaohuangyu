/**
 * 通知服务
 * 处理管理员通知和用户通知
 */

import supabase from '../utils/supabaseToPrismaAdapter.js'
import {
  ADMIN_NOTIFICATION_TYPES,
  ADMIN_NOTIFICATION_TYPE_NAMES,
  USER_NOTIFICATION_TYPES,
  USER_NOTIFICATION_TYPE_NAMES,
} from '../constants/taskActions.js'

// ==================== 管理员通知 ====================

/**
 * 发送管理员通知
 * @param {Object} params
 * @param {string} params.type - 通知类型
 * @param {string} params.title - 标题
 * @param {string} params.message - 消息内容
 * @param {Object} params.data - 附加数据
 * @param {string} params.priority - 优先级 (low, medium, high)
 */
export async function sendAdminNotification(params) {
  const {
    type,
    title,
    message,
    data = {},
    priority = 'medium',
  } = params

  console.log('[Notification] 发送管理员通知:', { type, title })

  const notificationData = {
    type,
    title,
    message,
    data,
    priority,
    is_read: false,
  }

  const { data: notification, error } = await supabase
    .from('admin_notifications')
    .insert(notificationData)
    .select()
    .single()

  if (error) {
    console.error('[Notification] 发送管理员通知失败:', error)
    throw error
  }

  return notification
}

/**
 * 获取管理员通知列表
 * @param {Object} params
 * @param {boolean} params.unreadOnly - 仅未读
 * @param {number} params.page - 页码
 * @param {number} params.pageSize - 每页数量
 */
export async function getAdminNotifications(params = {}) {
  const {
    unreadOnly = false,
    page = 1,
    pageSize = 20,
  } = params

  let query = supabase
    .from('admin_notifications')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (unreadOnly) {
    query = query.eq('is_read', false)
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error('[Notification] 获取管理员通知失败:', error)
    throw error
  }

  return {
    list: data || [],
    total: count || 0,
    page,
    pageSize,
    unreadCount: data?.filter(n => !n.is_read).length || 0,
  }
}

/**
 * 标记管理员通知为已读
 * @param {string} notificationId - 通知ID
 */
export async function markAdminNotificationRead(notificationId) {
  const { data, error } = await supabase
    .from('admin_notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId)
    .select()
    .single()

  if (error) {
    console.error('[Notification] 标记已读失败:', error)
    throw error
  }

  return data
}

/**
 * 标记所有管理员通知为已读
 */
export async function markAllAdminNotificationsRead() {
  const { data, error } = await supabase
    .from('admin_notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('is_read', false)
    .select()

  if (error) {
    console.error('[Notification] 标记全部已读失败:', error)
    throw error
  }

  return {
    success: true,
    updatedCount: data?.length || 0,
  }
}

// ==================== 用户通知 ====================

/**
 * 发送用户通知
 * @param {Object} params
 * @param {string} params.userId - 用户ID
 * @param {string} params.type - 通知类型
 * @param {string} params.title - 标题
 * @param {string} params.message - 消息内容
 * @param {Object} params.data - 附加数据
 */
export async function sendUserNotification(params) {
  const {
    userId,
    type,
    title,
    message,
    data = {},
  } = params

  console.log('[Notification] 发送用户通知:', { userId, type, title })

  const notificationData = {
    user_id: userId,
    type,
    title,
    message,
    data,
    is_read: false,
  }

  const { data: notification, error } = await supabase
    .from('user_notifications')
    .insert(notificationData)
    .select()
    .single()

  if (error) {
    console.error('[Notification] 发送用户通知失败:', error)
    throw error
  }

  return notification
}

/**
 * 获取用户通知列表
 * @param {Object} params
 * @param {string} params.userId - 用户ID
 * @param {boolean} params.unreadOnly - 仅未读
 * @param {number} params.page - 页码
 * @param {number} params.pageSize - 每页数量
 */
export async function getUserNotifications(params) {
  const {
    userId,
    unreadOnly = false,
    page = 1,
    pageSize = 20,
  } = params

  if (!userId) {
    throw new Error('用户ID不能为空')
  }

  let query = supabase
    .from('user_notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (unreadOnly) {
    query = query.eq('is_read', false)
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error('[Notification] 获取用户通知失败:', error)
    throw error
  }

  return {
    list: data || [],
    total: count || 0,
    page,
    pageSize,
  }
}

/**
 * 标记用户通知为已读
 * @param {string} notificationId - 通知ID
 * @param {string} userId - 用户ID（权限验证）
 */
export async function markUserNotificationRead(notificationId, userId) {
  const { data, error } = await supabase
    .from('user_notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('[Notification] 标记已读失败:', error)
    throw error
  }

  return data
}

/**
 * 获取用户未读通知数量
 * @param {string} userId - 用户ID
 */
export async function getUserUnreadCount(userId) {
  const { count, error } = await supabase
    .from('user_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error) {
    console.error('[Notification] 获取未读数量失败:', error)
    throw error
  }

  return count || 0
}

// ==================== 便捷方法 ====================

/**
 * 发送任务通过通知
 */
export async function notifyClaimApproved(userId, claimId, rewardAmount) {
  return sendUserNotification({
    userId,
    type: USER_NOTIFICATION_TYPES.CLAIM_APPROVED,
    title: '任务审核通过',
    message: "Notification message",
    data: {
      claim_id: claimId,
      reward_amount: rewardAmount,
    },
  })
}

/**
 * 发送任务拒绝通知
 */
export async function notifyClaimRejected(userId, claimId, reason) {
  return sendUserNotification({
    userId,
    type: USER_NOTIFICATION_TYPES.CLAIM_REJECTED,
    title: '任务审核未通过',
    message: "Notification message",
    data: {
      claim_id: claimId,
      reason,
    },
  })
}

/**
 * 发送审核失败通知（需重试）
 */
export async function notifyReviewFailed(userId, claimId, failReason) {
  return sendUserNotification({
    userId,
    type: USER_NOTIFICATION_TYPES.REVIEW_FAILED,
    title: '任务审核失败',
    message: "Notification message",
    data: {
      claim_id: claimId,
      fail_reason: failReason,
    },
  })
}

export default {
  // 管理员通知
  sendAdminNotification,
  getAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  
  // 用户通知
  sendUserNotification,
  getUserNotifications,
  markUserNotificationRead,
  getUserUnreadCount,
  
  // 便捷方法
  notifyClaimApproved,
  notifyClaimRejected,
  notifyReviewFailed,
}
