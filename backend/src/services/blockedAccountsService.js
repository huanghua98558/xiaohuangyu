/**
 * 评论封控账号服务
 * 统一处理疑似封控、人工确认/取消、列表查询和通知。
 */

import db from '../config/database.js'
import logger from '../utils/logger.js'
import {
  ADMIN_NOTIFICATION_TYPES,
  BLOCK_STATUS,
  USER_NOTIFICATION_TYPES,
} from '../constants/taskActions.js'
import { CLAIM_STATUS } from '../constants/claimLifecycle.js'
import { sendAdminNotification, sendUserNotification } from './notificationService.js'
import { appendReviewHistory, createReviewHistoryEntry } from '../utils/claimReviewHistory.js'

const tableColumnCache = new Map()

function toId(value) {
  if (value === undefined || value === null || value === '') return null
  return String(value)
}

function normalizePlatformNickname(value) {
  if (!value) return null
  return String(value).trim().slice(0, 100)
}

function normalizeReviewNote(value, fallback = '') {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || fallback
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

async function hasBlockNotification(tableName, { userId = null, claimId = null, blockStatus = null } = {}) {
  const columns = await getTableColumnSet(tableName)
  if (!columns.size) return false

  const values = ['block_detected']
  const where = ['type = $1']

  if (userId && columns.has('user_id')) {
    values.push(userId)
    where.push(`user_id = $${values.length}`)
  }

  if (claimId && columns.has('data')) {
    values.push(String(claimId))
    where.push(`COALESCE(data->>'claimId', '') = $${values.length}`)
  }

  if (blockStatus && columns.has('data')) {
    values.push(String(blockStatus))
    where.push(`COALESCE(data->>'blockStatus', '') = $${values.length}`)
  }

  const result = await db.query(
    `
    SELECT 1
    FROM ${tableName}
    WHERE ${where.join(' AND ')}
    LIMIT 1
    `,
    values
  )

  return Boolean(result.rows?.length)
}

async function updateUserBlockStats(userId) {
  if (!userId) return

  const result = await db.query(
    `
    SELECT COUNT(*)::int AS count
    FROM blocked_accounts
    WHERE user_id = $1
      AND status IN ($2, $3)
    `,
    [userId, BLOCK_STATUS.SUSPECTED, BLOCK_STATUS.CONFIRMED]
  )

  const blockedCount = Number(result.rows?.[0]?.count || 0)

  await db.query(
    `
    UPDATE users
    SET has_blocked_account = $2,
        blocked_account_count = $3,
        last_blocked_at = CASE WHEN $3 > 0 THEN NOW() ELSE last_blocked_at END,
        updated_at = NOW()
    WHERE id = $1
    `,
    [userId, blockedCount > 0, blockedCount]
  )
}

function toReadableBlockReason(record, fallback) {
  return normalizeReviewNote(
    record?.review_note,
    fallback || '疑似评论账号被平台限制，仅自己可见，需要人工检查。'
  )
}

async function notifyBlockedAccountDetected(record, { taskTitle = '', reason = '' } = {}) {
  const claimId = toId(record?.claim_id)
  const taskId = toId(record?.task_id)
  const userId = toId(record?.user_id)
  const blockedRecordId = toId(record?.id)
  const titleSuffix = taskTitle ? `《${taskTitle}》` : `任务 #${claimId}`
  const readableReason = toReadableBlockReason(record, reason)

  const adminExists = await hasBlockNotification('admin_notifications', {
    claimId,
    blockStatus: BLOCK_STATUS.SUSPECTED,
  })

  if (!adminExists) {
    await sendAdminNotification({
      type: ADMIN_NOTIFICATION_TYPES.BLOCK_DETECTED || 'block_detected',
      title: '疑似评论账号封控',
      content: `${titleSuffix} 检测到疑似评论账号被抖音限制，请优先人工核查。`,
      data: {
        claimId,
        taskId,
        userId,
        blockRecordId: blockedRecordId,
        blockStatus: BLOCK_STATUS.SUSPECTED,
        reason: readableReason,
      },
      priority: 'high',
    })
  }

  if (userId) {
    const userExists = await hasBlockNotification('user_notifications', {
      userId,
      claimId,
      blockStatus: BLOCK_STATUS.SUSPECTED,
    })

    if (!userExists) {
      await sendUserNotification({
        userId,
        type: USER_NOTIFICATION_TYPES.BLOCK_DETECTED || 'block_detected',
        title: '疑似评论账号封控提醒',
        content: '检测到您用于本次任务的抖音评论账号疑似被平台限制，仅自己可见。请勿重复提交，等待人工确认。',
        data: {
          claimId,
          taskId,
          blockRecordId: blockedRecordId,
          blockStatus: BLOCK_STATUS.SUSPECTED,
          reason: readableReason,
        },
        priority: 'high',
      })
    }
  }
}

async function notifyBlockedAccountConfirmed(record, { taskTitle = '' } = {}) {
  const claimId = toId(record?.claim_id)
  const taskId = toId(record?.task_id)
  const userId = toId(record?.user_id)
  const blockedRecordId = toId(record?.id)
  const titleSuffix = taskTitle ? `《${taskTitle}》` : `任务 #${claimId}`
  const readableReason = toReadableBlockReason(record, '人工已确认评论账号被平台封控。')

  const adminExists = await hasBlockNotification('admin_notifications', {
    claimId,
    blockStatus: BLOCK_STATUS.CONFIRMED,
  })

  if (!adminExists) {
    await sendAdminNotification({
      type: ADMIN_NOTIFICATION_TYPES.BLOCK_DETECTED || 'block_detected',
      title: '已确认评论账号封控',
      content: `${titleSuffix} 已人工确认评论账号封控，请提醒用户尽快更换抖音账号。`,
      data: {
        claimId,
        taskId,
        userId,
        blockRecordId: blockedRecordId,
        blockStatus: BLOCK_STATUS.CONFIRMED,
        reason: readableReason,
      },
      priority: 'high',
    })
  }

  if (userId) {
    const userExists = await hasBlockNotification('user_notifications', {
      userId,
      claimId,
      blockStatus: BLOCK_STATUS.CONFIRMED,
    })

    if (!userExists) {
      await sendUserNotification({
        userId,
        type: USER_NOTIFICATION_TYPES.BLOCK_DETECTED || 'block_detected',
        title: '评论账号已确认封控',
        content: '人工已确认您本次任务使用的抖音评论账号被平台限制，仅自己可见。请更换抖音账号后再继续做任务。',
        data: {
          claimId,
          taskId,
          blockRecordId: blockedRecordId,
          blockStatus: BLOCK_STATUS.CONFIRMED,
          reason: readableReason,
        },
        priority: 'high',
      })
    }
  }
}

async function notifyBlockedAccountFalsePositive(record, { taskTitle = '' } = {}) {
  const claimId = toId(record?.claim_id)
  const taskId = toId(record?.task_id)
  const userId = toId(record?.user_id)
  const blockedRecordId = toId(record?.id)

  const adminExists = await hasBlockNotification('admin_notifications', {
    claimId,
    blockStatus: BLOCK_STATUS.FALSE_POSITIVE,
  })

  if (!adminExists) {
    await sendAdminNotification({
      type: ADMIN_NOTIFICATION_TYPES.BLOCK_DETECTED || 'block_detected',
      title: '疑似封控已取消',
      content: `${taskTitle ? `《${taskTitle}》` : `任务 #${claimId}`} 已取消封控判断，请继续人工审核。`,
      data: {
        claimId,
        taskId,
        userId,
        blockRecordId: blockedRecordId,
        blockStatus: BLOCK_STATUS.FALSE_POSITIVE,
      },
      priority: 'normal',
    })
  }

  if (userId) {
    const userExists = await hasBlockNotification('user_notifications', {
      userId,
      claimId,
      blockStatus: BLOCK_STATUS.FALSE_POSITIVE,
    })

    if (!userExists) {
      await sendUserNotification({
        userId,
        type: USER_NOTIFICATION_TYPES.BLOCK_DETECTED || 'block_detected',
        title: '封控提醒已取消',
        content: '人工复核后已取消本次评论账号封控提醒，请以最新审核结果为准。',
        data: {
          claimId,
          taskId,
          blockRecordId: blockedRecordId,
          blockStatus: BLOCK_STATUS.FALSE_POSITIVE,
        },
        priority: 'normal',
      })
    }
  }
}

export async function detectAndRecordBlock(params) {
  const {
    userId,
    claimId,
    taskId = null,
    platform = '抖音',
    platformUserId = null,
    platformUsername = null,
    failReason = '',
    videoUrl = null,
    commentContent = null,
  } = params || {}

  try {
    const existingResult = await db.query(
      `
      SELECT *
      FROM blocked_accounts
      WHERE claim_id = $1
      ORDER BY COALESCE(reviewed_at, detected_at, created_at) DESC, id DESC
      LIMIT 1
      `,
      [claimId]
    )

    const existing = existingResult.rows?.[0]
    if (existing) {
      const updated = await db.query(
        `
        UPDATE blocked_accounts
        SET occurrence_count = COALESCE(occurrence_count, 1) + 1,
            review_note = $2,
            platform_nickname = COALESCE(NULLIF($3, ''), platform_nickname),
            platform_user_id = COALESCE(NULLIF($4, ''), platform_user_id),
            video_url = COALESCE(NULLIF($5, ''), video_url),
            comment_content = COALESCE(NULLIF($6, ''), comment_content),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [
          existing.id,
          normalizeReviewNote(failReason, existing.review_note || ''),
          normalizePlatformNickname(platformUsername) || '',
          platformUserId || '',
          videoUrl || '',
          commentContent || '',
        ]
      )

      if (existing.status !== BLOCK_STATUS.CONFIRMED) {
        await db.query(
          `
          UPDATE claims
          SET block_status = $2
          WHERE id = $1
          `,
          [claimId, BLOCK_STATUS.SUSPECTED]
        )
      }

      await updateUserBlockStats(userId)

      if ((existing.status || BLOCK_STATUS.SUSPECTED) === BLOCK_STATUS.SUSPECTED) {
        const taskTitleResult = await db.query(
          'SELECT title FROM tasks WHERE id = $1 LIMIT 1',
          [taskId || existing.task_id || null]
        )
        const taskTitle = taskTitleResult.rows?.[0]?.title || ''
        await notifyBlockedAccountDetected(updated.rows?.[0] || existing, {
          taskTitle,
          reason: failReason || existing.review_note || '',
        })
      }

      return {
        success: true,
        isNewBlock: false,
        status: existing.status || BLOCK_STATUS.SUSPECTED,
        block: updated.rows?.[0] || existing,
      }
    }

    const taskTitleResult = await db.query(
      'SELECT title FROM tasks WHERE id = $1 LIMIT 1',
      [taskId || null]
    )
    const taskTitle = taskTitleResult.rows?.[0]?.title || ''

    const insertResult = await db.query(
      `
      INSERT INTO blocked_accounts (
        platform,
        platform_nickname,
        platform_user_id,
        task_id,
        video_url,
        comment_content,
        block_type,
        detection_method,
        status,
        review_note,
        occurrence_count,
        detected_at,
        created_at,
        updated_at,
        user_id,
        claim_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 'comment_hidden', 'link_verification', $7, $8, 1, NOW(), NOW(), NOW(), $9, $10
      )
      RETURNING *
      `,
      [
        platform,
        normalizePlatformNickname(platformUsername),
        platformUserId,
        taskId,
        videoUrl,
        commentContent,
        BLOCK_STATUS.SUSPECTED,
        normalizeReviewNote(
          failReason,
          '疑似评论账号被平台限制，仅自己可见，请人工核查。'
        ),
        userId,
        claimId,
      ]
    )

    const block = insertResult.rows?.[0]

    await db.query(
      `
      UPDATE claims
      SET block_status = $2
      WHERE id = $1
      `,
      [claimId, BLOCK_STATUS.SUSPECTED]
    )

    await updateUserBlockStats(userId)
    await notifyBlockedAccountDetected(block, { taskTitle, reason: failReason })

    return {
      success: true,
      isNewBlock: true,
      status: BLOCK_STATUS.SUSPECTED,
      block,
    }
  } catch (error) {
    logger.error('[BlockedAccounts] 检测封控失败:', error)
    throw error
  }
}

export async function confirmBlock(blockId, adminId, notes = '') {
  try {
    const result = await db.query(
      `
      SELECT ba.*, c.review_history, t.title AS task_title
      FROM blocked_accounts ba
      LEFT JOIN claims c ON c.id = ba.claim_id
      LEFT JOIN tasks t ON t.id = ba.task_id
      WHERE ba.id = $1
      LIMIT 1
      `,
      [blockId]
    )

    const block = result.rows?.[0]
    if (!block) {
      throw new Error('封控记录不存在')
    }

    const updatedBlockResult = await db.query(
      `
      UPDATE blocked_accounts
      SET status = $2,
          reviewed_by = $3,
          reviewed_at = NOW(),
          review_note = $4,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [
        blockId,
        BLOCK_STATUS.CONFIRMED,
        adminId || null,
        normalizeReviewNote(notes, '人工确认评论账号已封控'),
      ]
    )

    const reviewHistory = appendReviewHistory(
      block.review_history,
      createReviewHistoryEntry({
        stage: 'manual_review',
        action: 'rejected',
        reason: '人工确认评论账号已封控',
        details: {
          blockStatus: BLOCK_STATUS.CONFIRMED,
          blockRecordId: toId(blockId),
          note: normalizeReviewNote(notes, '人工确认评论账号已封控'),
        },
      })
    )

    await db.query(
      `
      UPDATE claims
      SET block_status = $2,
          status = $3,
          ai_review_status = $4,
          link_review_status = $5,
          link_review_reason = $6,
          reviewed_at = NOW(),
          review_note = $7,
          review_history = $8
      WHERE id = $1
      `,
      [
        block.claim_id,
        BLOCK_STATUS.CONFIRMED,
        CLAIM_STATUS.RELEASED,
        'blocked_confirmed',
        'rejected',
        '人工确认评论账号已封控',
        '人工确认评论账号已封控，请提醒用户更换抖音账号后重新领取任务',
        JSON.stringify(reviewHistory),
      ]
    )

    await updateUserBlockStats(block.user_id)
    await notifyBlockedAccountConfirmed(updatedBlockResult.rows?.[0] || block, {
      taskTitle: block.task_title || '',
    })

    return {
      success: true,
      data: updatedBlockResult.rows?.[0] || block,
      message: '已确认评论账号封控',
    }
  } catch (error) {
    logger.error('[BlockedAccounts] 确认封控失败:', error)
    return { success: false, error: error.message }
  }
}

export async function markAsFalsePositive(blockId, adminId, notes = '') {
  try {
    const result = await db.query(
      `
      SELECT ba.*, c.review_history, t.title AS task_title
      FROM blocked_accounts ba
      LEFT JOIN claims c ON c.id = ba.claim_id
      LEFT JOIN tasks t ON t.id = ba.task_id
      WHERE ba.id = $1
      LIMIT 1
      `,
      [blockId]
    )

    const block = result.rows?.[0]
    if (!block) {
      throw new Error('封控记录不存在')
    }

    const updatedBlockResult = await db.query(
      `
      UPDATE blocked_accounts
      SET status = $2,
          reviewed_by = $3,
          reviewed_at = NOW(),
          review_note = $4,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [
        blockId,
        BLOCK_STATUS.FALSE_POSITIVE,
        adminId || null,
        normalizeReviewNote(notes, '人工复核后取消封控提醒'),
      ]
    )

    const reviewHistory = appendReviewHistory(
      block.review_history,
      createReviewHistoryEntry({
        stage: 'manual_review',
        action: 'inspected',
        reason: '人工取消封控提醒，请继续人工审核',
        details: {
          blockStatus: BLOCK_STATUS.FALSE_POSITIVE,
          blockRecordId: toId(blockId),
          note: normalizeReviewNote(notes, '人工复核后取消封控提醒'),
        },
      })
    )

    await db.query(
      `
      UPDATE claims
      SET block_status = $2,
          status = $3,
          ai_review_status = 'manual',
          link_review_status = 'manual',
          link_review_reason = NULL,
          review_note = $4,
          review_history = $5
      WHERE id = $1
      `,
      [
        block.claim_id,
        BLOCK_STATUS.NONE,
        'pending_manual',
        '疑似封控已取消，请继续人工复核',
        JSON.stringify(reviewHistory),
      ]
    )

    await updateUserBlockStats(block.user_id)
    await notifyBlockedAccountFalsePositive(updatedBlockResult.rows?.[0] || block, {
      taskTitle: block.task_title || '',
    })

    return {
      success: true,
      data: updatedBlockResult.rows?.[0] || block,
      message: '已取消封控提醒',
    }
  } catch (error) {
    logger.error('[BlockedAccounts] 标记误报失败:', error)
    return { success: false, error: error.message }
  }
}

export async function getBlockedAccounts(params = {}) {
  const {
    status,
    platform,
    userId,
    page = 1,
    pageSize = 20,
  } = params

  const limit = Math.max(1, Number(pageSize) || 20)
  const currentPage = Math.max(1, Number(page) || 1)
  const offset = (currentPage - 1) * limit
  const values = []
  const where = []

  if (status && status !== 'all') {
    values.push(status)
    where.push(`ba.status = $${values.length}`)
  }
  if (platform && platform !== 'all') {
    values.push(platform)
    where.push(`ba.platform = $${values.length}`)
  }
  if (userId) {
    values.push(userId)
    where.push(`ba.user_id = $${values.length}`)
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const countSql = `
    SELECT COUNT(*)::int AS count
    FROM blocked_accounts ba
    ${whereClause}
  `

  const listSql = `
    SELECT
      ba.*,
      u.username,
      u.phone,
      t.title AS task_title,
      t.platform AS task_platform,
      c.status AS claim_status,
      c.review_note AS claim_review_note
    FROM blocked_accounts ba
    LEFT JOIN users u ON u.id = ba.user_id
    LEFT JOIN tasks t ON t.id = ba.task_id
    LEFT JOIN claims c ON c.id = ba.claim_id
    ${whereClause}
    ORDER BY COALESCE(ba.reviewed_at, ba.detected_at, ba.created_at) DESC, ba.id DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
  `

  const [countRes, listRes] = await Promise.all([
    db.query(countSql, values),
    db.query(listSql, [...values, limit, offset]),
  ])

  const list = (listRes.rows || []).map((row) => ({
    ...row,
    id: toId(row.id),
    user_id: toId(row.user_id),
    claim_id: toId(row.claim_id),
    task_id: toId(row.task_id),
  }))

  return {
    success: true,
    data: {
      list,
      total: Number(countRes.rows?.[0]?.count || 0),
      page: currentPage,
      pageSize: limit,
    },
  }
}

export async function getBlockStats() {
  const result = await db.query(
    `
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = $1)::int AS suspected,
      COUNT(*) FILTER (WHERE status = $2)::int AS confirmed,
      COUNT(*) FILTER (WHERE status = $3)::int AS false_positive
    FROM blocked_accounts
    `,
    [BLOCK_STATUS.SUSPECTED, BLOCK_STATUS.CONFIRMED, BLOCK_STATUS.FALSE_POSITIVE]
  )

  const row = result.rows?.[0] || {}

  return {
    success: true,
    data: {
      total: Number(row.total || 0),
      suspected: Number(row.suspected || 0),
      confirmed: Number(row.confirmed || 0),
      false_positive: Number(row.false_positive || 0),
    },
  }
}

export async function checkAccountBlocked(platform, platformUserId) {
  const result = await db.query(
    `
    SELECT *
    FROM blocked_accounts
    WHERE platform = $1
      AND platform_user_id = $2
      AND status = $3
    ORDER BY reviewed_at DESC NULLS LAST, detected_at DESC, id DESC
    LIMIT 1
    `,
    [platform, platformUserId, BLOCK_STATUS.CONFIRMED]
  )

  const block = result.rows?.[0] || null
  return {
    success: true,
    isBlocked: Boolean(block),
    block,
  }
}

export default {
  detectAndRecordBlock,
  confirmBlock,
  markAsFalsePositive,
  getBlockedAccounts,
  getBlockStats,
  checkAccountBlocked,
}
