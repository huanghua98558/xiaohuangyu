/**
 * 通知服务
 * 统一处理用户通知、管理员通知、实时推送和未读统计
 */

import db from '../config/database.js'
import {
  ADMIN_NOTIFICATION_TYPES,
  USER_NOTIFICATION_TYPES,
} from '../constants/taskActions.js'
import { publishBroadcast, publishToUser } from '../utils/wsEventPublisher.js'
import { getConfigValues } from './systemConfigService.js'

const tableColumnCache = new Map()
const userPreferenceCache = new Map()
const USER_PREFERENCE_TTL = 60 * 1000
const LEGACY_NOTIFICATION_TZ_OFFSET_MS = 8 * 60 * 60 * 1000

function toNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  const normalized = String(value).trim().toLowerCase()
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true
  if (['false', '0', 'no', 'off'].includes(normalized)) return false
  return fallback
}

function parseJson(value, fallback = null) {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return value
  if (typeof value !== 'string') return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function normalizeLegacyNotificationTimestamp(value) {
  if (!value) return null

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  // user/admin notification tables are still timestamp without time zone and
  // store Asia/Shanghai local wall-clock time. The backend runs in UTC, so the
  // pg driver parses those values as UTC and every notification appears 8 hours
  // earlier than it really is. Shift them here until the schema is migrated.
  return new Date(date.getTime() + LEGACY_NOTIFICATION_TZ_OFFSET_MS).toISOString()
}

async function getTableColumnSet(tableName) {
  if (tableColumnCache.has(tableName)) {
    return tableColumnCache.get(tableName)
  }

  const result = await db.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    `,
    [tableName]
  )

  const set = new Set((result.rows || []).map((row) => row.column_name))
  tableColumnCache.set(tableName, set)
  return set
}

function getNotificationCategory(type) {
  const reviewTypes = new Set([
    USER_NOTIFICATION_TYPES.CLAIM_APPROVED,
    USER_NOTIFICATION_TYPES.CLAIM_REJECTED,
    USER_NOTIFICATION_TYPES.REVIEW_FAILED,
    USER_NOTIFICATION_TYPES.BLOCK_DETECTED,
    'manual_review',
    'claim_manual_queued',
    'claim_manual_corrected',
  ])
  const pointsTypes = new Set([
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
  const withdrawTypes = new Set([
    'withdraw_submitted',
    'withdraw_approved',
    'withdraw_rejected',
    'withdraw_paid',
  ])

  if (reviewTypes.has(type)) return 'review'
  if (pointsTypes.has(type)) return 'points'
  if (withdrawTypes.has(type)) return 'withdraw'
  return 'system'
}

async function getUserNotificationPreferences(userId) {
  const cacheKey = String(userId)
  const cached = userPreferenceCache.get(cacheKey)
  if (cached && Date.now() - cached.updatedAt < USER_PREFERENCE_TTL) {
    return cached.value
  }

  let value
  try {
    const userColumns = await getTableColumnSet('users')
    const selectFields = [
      'notification_enabled',
      'notification_sound_enabled',
      'review_notification_enabled',
      'points_notification_enabled',
      'withdraw_notification_enabled',
    ].filter((column) => userColumns.has(column))

    if (selectFields.length === 0) {
      throw new Error('用户通知偏好字段不存在')
    }

    const rows = await db.query(
      `
      SELECT
        ${selectFields.join(', ')}
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    )

    const row = rows.rows?.[0] || {}
    value = {
      notificationEnabled: toBoolean(row.notification_enabled, true),
      notificationSoundEnabled: toBoolean(row.notification_sound_enabled, true),
      reviewNotificationEnabled: toBoolean(row.review_notification_enabled, true),
      pointsNotificationEnabled: toBoolean(row.points_notification_enabled, true),
      withdrawNotificationEnabled: toBoolean(row.withdraw_notification_enabled, true),
    }
  } catch {
    value = {
      notificationEnabled: true,
      notificationSoundEnabled: true,
      reviewNotificationEnabled: true,
      pointsNotificationEnabled: true,
      withdrawNotificationEnabled: true,
    }
  }

  userPreferenceCache.set(cacheKey, {
    value,
    updatedAt: Date.now(),
  })
  return value
}

async function shouldPushUserNotification(userId, type) {
  const prefs = await getUserNotificationPreferences(userId)
  if (!prefs.notificationEnabled) return false

  const category = getNotificationCategory(type)
  if (category === 'review') return prefs.reviewNotificationEnabled
  if (category === 'points') return prefs.pointsNotificationEnabled
  if (category === 'withdraw') return prefs.withdrawNotificationEnabled
  return true
}

async function shouldBroadcastAdminNotification() {
  const configs = await getConfigValues([
    'notification_admin_enabled',
  ])
  return toBoolean(configs.notification_admin_enabled, true)
}

async function getPreferredUserNotificationTable() {
  const userNotificationColumns = await getTableColumnSet('user_notifications')
  if (userNotificationColumns.size > 0) {
    return 'user_notifications'
  }

  const legacyColumns = await getTableColumnSet('notifications')
  if (legacyColumns.size > 0) {
    return 'notifications'
  }

  return 'user_notifications'
}

function buildInsertSql(tableName, payload) {
  const keys = Object.keys(payload)
  const placeholders = keys.map((_, index) => `$${index + 1}`)
  return {
    text: `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
    values: keys.map((key) => payload[key]),
  }
}

function normalizeNotificationRow(row) {
  if (!row) return null

  return {
    ...row,
    id: row.id != null ? String(row.id) : row.id,
    user_id: row.user_id != null ? String(row.user_id) : row.user_id,
    title: row.title || '',
    content: row.content || row.message || '',
    priority: row.priority || 'normal',
    data: parseJson(row.data, {}) || {},
    is_read: Boolean(row.is_read),
    read_at: normalizeLegacyNotificationTimestamp(row.read_at),
    created_at: normalizeLegacyNotificationTimestamp(row.created_at),
    updated_at: normalizeLegacyNotificationTimestamp(row.updated_at),
  }
}

async function insertNotification(tableName, payload, notifyFn = null) {
  const columns = await getTableColumnSet(tableName)
  const row = {}

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || !columns.has(key)) return
    row[key] = value
  })

  if (!columns.has('created_at')) {
    // no-op: created_at may be defaulted by DB
  }

  const { text, values } = buildInsertSql(tableName, row)
  const result = await db.query(text, values)
  const inserted = normalizeNotificationRow(result.rows?.[0] || null)

  if (inserted && notifyFn) {
    await notifyFn(inserted)
  }

  return inserted
}

async function getUnreadCount(tableName, where = '') {
  const result = await db.query(
    `
    SELECT COUNT(*)::int AS count
    FROM ${tableName}
    WHERE is_read = false
    ${where ? `AND ${where}` : ''}
    `
  )
  return toNumber(result.rows?.[0]?.count, 0)
}

async function getNotificationList(tableName, {
  whereClauses = [],
  values = [],
  unreadOnly = false,
  page = 1,
  pageSize = 20,
} = {}) {
  const limit = Math.max(1, toNumber(pageSize, 20))
  const offset = Math.max(0, (Math.max(1, toNumber(page, 1)) - 1) * limit)

  const clauses = [...whereClauses]
  if (unreadOnly) {
    clauses.push(`is_read = false`)
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const countSql = `SELECT COUNT(*)::int AS count FROM ${tableName} ${where}`
  const listSql = `
    SELECT *
    FROM ${tableName}
    ${where}
    ORDER BY created_at DESC, id DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
  `

  const [countRes, listRes] = await Promise.all([
    db.query(countSql, values),
    db.query(listSql, [...values, limit, offset]),
  ])

  return {
    list: (listRes.rows || []).map(normalizeNotificationRow),
    total: toNumber(countRes.rows?.[0]?.count, 0),
    page: Math.max(1, toNumber(page, 1)),
    pageSize: limit,
  }
}

export async function sendAdminNotification(params) {
  const {
    type = ADMIN_NOTIFICATION_TYPES.SYSTEM_ALERT || 'system_alert',
    title = '系统通知',
    content,
    message,
    data = {},
    priority = 'normal',
  } = params || {}

  const notification = await insertNotification('admin_notifications', {
    type,
    title,
    content: content || message || '',
    data: JSON.stringify(data || {}),
    priority,
    is_read: false,
  }, async (inserted) => {
    if (await shouldBroadcastAdminNotification()) {
      await publishBroadcast('admin_notification', inserted)
    }
  })

  return notification
}

export async function getAdminNotifications(params = {}) {
  const whereClauses = []
  const values = []
  if (params.type) {
    values.push(params.type)
    whereClauses.push(`type = $${values.length}`)
  }

  const result = await getNotificationList('admin_notifications', {
    ...params,
    whereClauses,
    values,
  })
  const unreadCount = await getAdminUnreadCount()
  return {
    ...result,
    unreadCount,
  }
}

export async function getAdminUnreadCount() {
  return getUnreadCount('admin_notifications')
}

export async function markAdminNotificationRead(notificationId) {
  const columns = await getTableColumnSet('admin_notifications')
  const sets = ['is_read = true']
  if (columns.has('read_at')) {
    sets.push('read_at = NOW()')
  }

  const result = await db.query(
    `
    UPDATE admin_notifications
    SET ${sets.join(', ')}
    WHERE id = $1
    RETURNING *
    `,
    [notificationId]
  )

  return normalizeNotificationRow(result.rows?.[0] || null)
}

export async function markAllAdminNotificationsRead() {
  const columns = await getTableColumnSet('admin_notifications')
  const sets = ['is_read = true']
  if (columns.has('read_at')) {
    sets.push('read_at = NOW()')
  }

  const result = await db.query(
    `
    UPDATE admin_notifications
    SET ${sets.join(', ')}
    WHERE is_read = false
    RETURNING id
    `
  )

  return {
    success: true,
    updatedCount: result.rows?.length || 0,
  }
}

export async function sendUserNotification(params) {
  const {
    userId,
    type = 'system',
    title = '系统通知',
    content,
    message,
    data = {},
    priority = 'normal',
  } = params || {}

  if (!userId) {
    throw new Error('userId is required')
  }

  const tableName = await getPreferredUserNotificationTable()
  const notification = await insertNotification(tableName, {
    user_id: userId,
    type,
    title,
    content: content || message || '',
    data: JSON.stringify(data || {}),
    priority,
    is_read: false,
  }, async (inserted) => {
    if (await shouldPushUserNotification(userId, type)) {
      await publishToUser(userId, 'notification', inserted)
    }
  })

  return notification
}

export async function getUserNotifications(params = {}) {
  const {
    userId,
    type = null,
    unreadOnly = false,
    page = 1,
    pageSize = 20,
  } = params

  if (!userId) {
    throw new Error('用户ID不能为空')
  }

  const tableName = await getPreferredUserNotificationTable()
  const whereClauses = ['user_id = $1']
  const values = [userId]
  if (type) {
    values.push(type)
    whereClauses.push(`type = $${values.length}`)
  }

  const result = await getNotificationList(tableName, {
    whereClauses,
    values,
    unreadOnly,
    page,
    pageSize,
  })

  return {
    ...result,
    unreadCount: await getUserUnreadCount(userId),
  }
}

export async function markUserNotificationRead(notificationId, userId) {
  const tableName = await getPreferredUserNotificationTable()
  const columns = await getTableColumnSet(tableName)
  const sets = ['is_read = true']
  if (columns.has('read_at')) {
    sets.push('read_at = NOW()')
  }
  if (columns.has('updated_at')) {
    sets.push('updated_at = NOW()')
  }

  const result = await db.query(
    `
    UPDATE ${tableName}
    SET ${sets.join(', ')}
    WHERE id = $1
      AND user_id = $2
    RETURNING *
    `,
    [notificationId, userId]
  )

  return normalizeNotificationRow(result.rows?.[0] || null)
}

export async function markAllUserNotificationsRead(userId) {
  const tableName = await getPreferredUserNotificationTable()
  const columns = await getTableColumnSet(tableName)
  const sets = ['is_read = true']
  if (columns.has('read_at')) {
    sets.push('read_at = NOW()')
  }
  if (columns.has('updated_at')) {
    sets.push('updated_at = NOW()')
  }

  const result = await db.query(
    `
    UPDATE ${tableName}
    SET ${sets.join(', ')}
    WHERE user_id = $1
      AND is_read = false
    RETURNING id
    `,
    [userId]
  )

  return {
    success: true,
    updatedCount: result.rows?.length || 0,
  }
}

export async function deleteUserNotification(notificationId, userId) {
  const tableName = await getPreferredUserNotificationTable()
  const result = await db.query(
    `
    DELETE FROM ${tableName}
    WHERE id = $1
      AND user_id = $2
    RETURNING id
    `,
    [notificationId, userId]
  )

  return {
    success: Boolean(result.rows?.length),
  }
}

export async function getUserUnreadCount(userId) {
  const tableName = await getPreferredUserNotificationTable()
  const result = await db.query(
    `
    SELECT COUNT(*)::int AS count
    FROM ${tableName}
    WHERE user_id = $1
      AND is_read = false
    `,
    [userId]
  )

  return toNumber(result.rows?.[0]?.count, 0)
}

export async function notifyClaimApproved(userId, claimId, rewardAmount) {
  return sendUserNotification({
    userId,
    type: USER_NOTIFICATION_TYPES.CLAIM_APPROVED || 'claim_approved',
    title: '任务审核通过',
    content: `您提交的任务已审核通过，到账 ${toNumber(rewardAmount, 0)} 积分。`,
    data: {
      claimId: String(claimId),
      rewardAmount: toNumber(rewardAmount, 0),
    },
    priority: 'high',
  })
}

export async function notifyClaimRejected(userId, claimId, reason) {
  return sendUserNotification({
    userId,
    type: USER_NOTIFICATION_TYPES.CLAIM_REJECTED || 'claim_rejected',
    title: '任务审核未通过',
    content: reason || '任务审核未通过，请重新检查后提交。',
    data: {
      claimId: String(claimId),
      reason: reason || '',
    },
    priority: 'high',
  })
}

export async function notifyReviewFailed(userId, claimId, failReason) {
  return sendUserNotification({
    userId,
    type: USER_NOTIFICATION_TYPES.REVIEW_FAILED || 'review_failed',
    title: '任务审核失败',
    content: failReason || '审核失败，请稍后重试。',
    data: {
      claimId: String(claimId),
      reason: failReason || '',
    },
    priority: 'high',
  })
}

export async function notifyWelcome(userId, username) {
  return sendUserNotification({
    userId,
    type: 'user_registered',
    title: '注册成功',
    content: `欢迎加入小黄鱼${username ? `，${username}` : ''}。`,
    data: {
      username: username || '',
    },
    priority: 'normal',
  })
}

export async function notifyPointsAwarded(userId, detail = {}) {
  const finalPoints = toNumber(detail.finalPoints ?? detail.points, 0)
  const bonusPoints = toNumber(detail.bonusPoints, 0)
  return sendUserNotification({
    userId,
    type: 'points_awarded',
    title: '积分到账',
    content: bonusPoints > 0
      ? `到账 ${finalPoints} 积分，其中加成 ${bonusPoints} 积分。`
      : `到账 ${finalPoints} 积分。`,
    data: detail,
    priority: 'normal',
  })
}

export async function notifySignInReward(userId, { points, continuousDays } = {}) {
  return sendUserNotification({
    userId,
    type: 'sign_in_reward',
    title: '签到奖励到账',
    content: `今日签到成功，到账 ${toNumber(points, 0)} 积分，已连续签到 ${toNumber(continuousDays, 1)} 天。`,
    data: {
      points: toNumber(points, 0),
      continuousDays: toNumber(continuousDays, 1),
    },
    priority: 'normal',
  })
}

export async function notifyAchievementReward(userId, { name, points } = {}) {
  return sendUserNotification({
    userId,
    type: 'achievement_reward',
    title: '成就奖励到账',
    content: `恭喜解锁成就「${name || '新成就'}」，到账 ${toNumber(points, 0)} 积分。`,
    data: {
      name: name || '',
      points: toNumber(points, 0),
    },
    priority: 'normal',
  })
}

export async function notifyLeaderboardReward(userId, { type, rank, points, periodKey } = {}) {
  const label = type === 'monthly' ? '月榜' : '周榜'
  return sendUserNotification({
    userId,
    type: 'leaderboard_reward',
    title: `${label}奖励到账`,
    content: `恭喜获得${label}第 ${toNumber(rank, 0)} 名，到账 ${toNumber(points, 0)} 积分。`,
    data: {
      leaderboardType: type || 'weekly',
      rank: toNumber(rank, 0),
      points: toNumber(points, 0),
      periodKey: periodKey || '',
    },
    priority: 'high',
  })
}

export async function notifyPromotionReward(userId, { level, points, sourceUserId } = {}) {
  const levelLabel = toNumber(level, 1) === 2 ? '二级' : '一级'
  return sendUserNotification({
    userId,
    type: 'promotion_reward',
    title: '推广奖励到账',
    content: `${levelLabel}推广奖励到账 ${toNumber(points, 0)} 积分。`,
    data: {
      level: toNumber(level, 1),
      points: toNumber(points, 0),
      sourceUserId: sourceUserId != null ? String(sourceUserId) : undefined,
    },
    priority: 'normal',
  })
}

export async function notifyAdminPointsAdjusted(userId, { amount, reason, balance } = {}) {
  const change = toNumber(amount, 0)
  const prefix = change >= 0 ? '+' : ''
  return sendUserNotification({
    userId,
    type: 'admin_points_adjusted',
    title: '积分变动通知',
    content: `管理员已调整您的积分 ${prefix}${change}${reason ? `，原因：${reason}` : ''}`,
    data: {
      amount: change,
      reason: reason || '',
      balance: balance !== undefined ? toNumber(balance, 0) : undefined,
    },
    priority: 'high',
  })
}

export async function notifyPointsConverted(userId, { points, amount, balance } = {}) {
  return sendUserNotification({
    userId,
    type: 'points_converted',
    title: '积分兑换成功',
    content: `已兑换 ${toNumber(points, 0)} 积分，到账 ${toNumber(amount, 0).toFixed(2)} 元。`,
    data: {
      points: toNumber(points, 0),
      amount: toNumber(amount, 0),
      balance: balance !== undefined ? toNumber(balance, 0) : undefined,
    },
    priority: 'normal',
  })
}

export async function notifyWithdrawSubmitted(userId, { amount, balance } = {}) {
  return sendUserNotification({
    userId,
    type: 'withdraw_submitted',
    title: '提现申请已提交',
    content: `已提交 ${toNumber(amount, 0).toFixed(2)} 元提现申请，请等待审核。`,
    data: {
      amount: toNumber(amount, 0),
      balance: balance !== undefined ? toNumber(balance, 0) : undefined,
    },
    priority: 'high',
  })
}

export async function notifyWithdrawApproved(userId, { amount } = {}) {
  return sendUserNotification({
    userId,
    type: 'withdraw_approved',
    title: '提现审核通过',
    content: `您的 ${toNumber(amount, 0).toFixed(2)} 元提现申请已审核通过，等待管理员打款。`,
    data: {
      amount: toNumber(amount, 0),
    },
    priority: 'high',
  })
}

export async function notifyWithdrawRejected(userId, { amount, note } = {}) {
  return sendUserNotification({
    userId,
    type: 'withdraw_rejected',
    title: '提现申请未通过',
    content: note
      ? `您的 ${toNumber(amount, 0).toFixed(2)} 元提现申请未通过：${note}`
      : `您的 ${toNumber(amount, 0).toFixed(2)} 元提现申请未通过。`,
    data: {
      amount: toNumber(amount, 0),
      note: note || '',
    },
    priority: 'high',
  })
}

export async function notifyWithdrawPaid(userId, { amount } = {}) {
  return sendUserNotification({
    userId,
    type: 'withdraw_paid',
    title: '提现已打款',
    content: `您的 ${toNumber(amount, 0).toFixed(2)} 元提现已完成打款。`,
    data: {
      amount: toNumber(amount, 0),
    },
    priority: 'high',
  })
}

export async function notifyManualReviewQueued(params = {}) {
  const {
    claimId,
    userId,
    taskId,
    stage = 'review',
    reason = '有新任务进入人工检查队列',
  } = params

  return sendAdminNotification({
    type: ADMIN_NOTIFICATION_TYPES.MANUAL_REVIEW || 'manual_review',
    title: '人工检查列表新增',
    content: reason,
    data: {
      claimId: claimId != null ? String(claimId) : undefined,
      userId: userId != null ? String(userId) : undefined,
      taskId: taskId != null ? String(taskId) : undefined,
      stage,
    },
    priority: 'high',
  })
}

export async function sendSystemAnnouncement(title, content, userIds = null) {
  if (Array.isArray(userIds) && userIds.length > 0) {
    const results = await Promise.all(
      userIds.map((userId) =>
        sendUserNotification({
          userId,
          type: 'system_announcement',
          title,
          content,
          priority: 'normal',
        })
      )
    )
    return { sentCount: results.filter(Boolean).length }
  }

  const userRows = await db.query('SELECT id FROM users WHERE status = 1')
  const results = await Promise.all(
    (userRows.rows || []).map((row) =>
      sendUserNotification({
        userId: row.id,
        type: 'system_announcement',
        title,
        content,
        priority: 'normal',
      })
    )
  )

  return { sentCount: results.filter(Boolean).length }
}

export async function markAsRead(userId, notificationId) {
  return markUserNotificationRead(notificationId, userId)
}

export async function markAllAsRead(userId) {
  return markAllUserNotificationsRead(userId)
}

export default {
  sendAdminNotification,
  getAdminNotifications,
  getAdminUnreadCount,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  sendUserNotification,
  getUserNotifications,
  markUserNotificationRead,
  markAllUserNotificationsRead,
  deleteUserNotification,
  getUserUnreadCount,
  notifyClaimApproved,
  notifyClaimRejected,
  notifyReviewFailed,
  notifyWelcome,
  notifyPointsAwarded,
  notifySignInReward,
  notifyAchievementReward,
  notifyLeaderboardReward,
  notifyPromotionReward,
  notifyAdminPointsAdjusted,
  notifyPointsConverted,
  notifyWithdrawSubmitted,
  notifyWithdrawApproved,
  notifyWithdrawRejected,
  notifyWithdrawPaid,
  notifyManualReviewQueued,
  sendSystemAnnouncement,
  markAsRead,
  markAllAsRead,
}
