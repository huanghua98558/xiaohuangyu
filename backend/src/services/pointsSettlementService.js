import db from '../config/database.js'
import nightPointService from './nightPointService.js'
import onlineUserService from './onlineUserService.js'
import logger from '../utils/logger.js'
import { publishPointsAwarded } from '../utils/wsEventPublisher.js'
import { notifyPointsAwarded } from './notificationService.js'

function toSafeNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function parseHistory(raw) {
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

class PointsSettlementService {
  constructor() {
    this.claimsColumnSet = null
  }

  async getClaimsColumnSet() {
    if (this.claimsColumnSet) {
      return this.claimsColumnSet
    }

    try {
      const res = await db.query(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'claims'
        `
      )
      this.claimsColumnSet = new Set((res.rows || []).map(row => row.column_name))
      return this.claimsColumnSet
    } catch (err) {
      logger.warn('[PointsSettlement] 读取 claims 字段失败，使用基础字段:', err.message)
      this.claimsColumnSet = new Set(['reward'])
      return this.claimsColumnSet
    }
  }

  async getClaimContext(claimId) {
    return db.queryOne(
      `
      SELECT 
        c.id,
        c.user_id,
        c.task_id,
        c.reward as claim_reward,
        c.base_reward as claim_base_reward,
        c.review_history,
        c.status as claim_status,
        c.night_coefficient,
        c.online_users,
        t.reward as task_reward,
        t.base_reward as task_base_reward,
        t.created_at as task_created_at,
        t.need_count,
        t.remain
      FROM claims c
      JOIN tasks t ON t.id = c.task_id
      WHERE c.id = $1
      `,
      [claimId]
    )
  }

  async appendSettlementHistory(client, claimId, entry) {
    const historyRow = await client.query(
      'SELECT review_history FROM claims WHERE id = $1',
      [claimId]
    )
    const history = parseHistory(historyRow.rows?.[0]?.review_history)
    history.push(entry)
    await client.query(
      'UPDATE claims SET review_history = $1 WHERE id = $2',
      [JSON.stringify(history), claimId]
    )
  }

  resolveBasePoints(ctx, explicitBasePoints) {
    if (explicitBasePoints !== undefined && explicitBasePoints !== null) {
      return Math.max(0, Math.round(toSafeNumber(explicitBasePoints, 0)))
    }

    const candidate = [
      ctx?.claim_reward,
      ctx?.claim_base_reward,
      ctx?.task_reward,
      ctx?.task_base_reward
    ]
      .map(v => toSafeNumber(v, 0))
      .find(v => v > 0)

    return Math.max(0, Math.round(candidate || 0))
  }

  async awardClaimPoints({
    claimId,
    userId = null,
    taskId = null,
    basePoints = null,
    publishTime = null,
    awardReason = '任务审核通过',
    source = 'unknown',
    metadata = {}
  }) {
    if (!claimId) {
      throw new Error('claimId is required for points settlement')
    }

    const ctx = await this.getClaimContext(claimId)
    if (!ctx) {
      throw new Error(`领取记录不存在: claimId=${claimId}`)
    }

    const finalUserId = userId || ctx.user_id
    const finalTaskId = taskId || ctx.task_id
    if (!finalUserId || !finalTaskId) {
      throw new Error(`结算参数不完整: claimId=${claimId}`)
    }

    // 幂等：同一 claim 只发一次积分
    const existing = await db.queryOne(
      `
      SELECT id, points, extra_data, created_at
      FROM records
      WHERE type = 'task'
        AND (
          "desc" LIKE $1
          OR extra_data LIKE $2
        )
      ORDER BY id DESC
      LIMIT 1
      `,
      [`%claim:${claimId}%`, `%\"claimId\":\"${String(claimId)}\"%`]
    )

    if (existing) {
      return {
        success: true,
        skipped: true,
        claimId,
        userId: finalUserId,
        taskId: finalTaskId,
        finalPoints: toSafeNumber(existing.points, 0),
        reason: 'already_awarded'
      }
    }

    const resolvedBasePoints = this.resolveBasePoints(ctx, basePoints)
    if (resolvedBasePoints <= 0) {
      return {
        success: true,
        skipped: true,
        claimId,
        userId: finalUserId,
        taskId: finalTaskId,
        finalPoints: 0,
        reason: 'base_points_zero'
      }
    }

    const onlineUsersRaw = await onlineUserService.getOnlineCount()
    const onlineUsersSource = onlineUsersRaw === null ? 'fallback_zero' : 'redis_live'
    const onlineUsers = onlineUsersRaw === null ? 0 : toSafeNumber(onlineUsersRaw, 0)

    const publishAt = publishTime || ctx.task_created_at || new Date().toISOString()
    const needCount = Math.max(1, toSafeNumber(ctx.need_count, 1))
    const remainCount = Math.max(0, toSafeNumber(ctx.remain, 0))
    const acceptedCount = Math.max(0, needCount - remainCount)

    const coefficientResult = await nightPointService.calculateCoefficientByPublishTime({
      publishTime: publishAt,
      onlineUsers,
      acceptedCount,
      needCount
    })

    const coefficient = toSafeNumber(coefficientResult?.coefficient, 1)
    const finalPoints = Math.max(0, Math.ceil(resolvedBasePoints * coefficient))
    const bonusPoints = Math.max(0, finalPoints - resolvedBasePoints)
    const isNight = Boolean(coefficientResult?.isNight)

    const snapshot = {
      source,
      claimId: String(claimId),
      taskId: String(finalTaskId),
      userId: String(finalUserId),
      publishTime: publishAt,
      basePoints: resolvedBasePoints,
      coefficient,
      bonusPoints,
      finalPoints,
      isNight,
      onlineUsers,
      onlineUsersSource,
      config: coefficientResult?.config || null,
      calculatedAt: new Date().toISOString(),
      metadata
    }
    const claimColumns = await this.getClaimsColumnSet()

    await db.transaction(async (client) => {
      await client.query(
        `
        INSERT INTO records (user_id, type, points, task_id, "desc", extra_data, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `,
        [
          finalUserId,
          'task',
          finalPoints,
          finalTaskId,
          `任务奖励 - ${awardReason} (claim:${claimId})`,
          JSON.stringify(snapshot)
        ]
      )

      await client.query(
        `
        UPDATE users
        SET 
          points = COALESCE(points, 0) + $1,
          total_points = COALESCE(total_points, 0) + $1,
          updated_at = NOW()
        WHERE id = $2
        `,
        [finalPoints, finalUserId]
      )

      const updates = ['reward = $1']
      const values = [finalPoints]

      if (claimColumns.has('night_coefficient')) {
        updates.push(`night_coefficient = $${values.length + 1}`)
        values.push(coefficient)
      }
      if (claimColumns.has('online_users')) {
        updates.push(`online_users = $${values.length + 1}`)
        values.push(onlineUsers)
      }

      if (claimColumns.has('final_points')) {
        updates.push(`final_points = $${values.length + 1}`)
        values.push(finalPoints)
      }
      if (claimColumns.has('bonus_points')) {
        updates.push(`bonus_points = $${values.length + 1}`)
        values.push(bonusPoints)
      }
      if (claimColumns.has('publish_time_snapshot')) {
        updates.push(`publish_time_snapshot = $${values.length + 1}`)
        values.push(publishAt)
      }
      if (claimColumns.has('config_snapshot')) {
        updates.push(`config_snapshot = $${values.length + 1}`)
        values.push(JSON.stringify(coefficientResult?.config || null))
      }
      if (claimColumns.has('settlement_snapshot')) {
        updates.push(`settlement_snapshot = $${values.length + 1}`)
        values.push(JSON.stringify(snapshot))
      }

      values.push(claimId)
      const whereIndex = values.length
      await client.query(
        `UPDATE claims SET ${updates.join(', ')} WHERE id = $${whereIndex}`,
        values
      )

      await this.appendSettlementHistory(client, claimId, {
        stage: 'points_settlement',
        action: 'awarded',
        reason: awardReason,
        details: snapshot,
        timestamp: new Date().toISOString()
      })
    })

    if (isNight) {
      await nightPointService.logNightPoints(
        finalTaskId,
        finalUserId,
        resolvedBasePoints,
        onlineUsers,
        coefficient,
        finalPoints
      )
    }

    await publishPointsAwarded(finalUserId, finalPoints, {
      reason: awardReason,
      source,
      claimId: String(claimId),
      taskId: String(finalTaskId),
      basePoints: resolvedBasePoints,
      nightCoefficient: coefficient,
      bonusPoints,
      finalPoints,
      isNight,
      publishTime: publishAt,
      onlineUsers
    })

    try {
      await notifyPointsAwarded(finalUserId, {
        reason: awardReason,
        source,
        claimId: String(claimId),
        taskId: String(finalTaskId),
        basePoints: resolvedBasePoints,
        nightCoefficient: coefficient,
        bonusPoints,
        finalPoints,
        isNight,
        publishTime: publishAt,
        onlineUsers,
      })
    } catch (notifyErr) {
      logger.warn('[PointsSettlement] 发送积分通知失败:', notifyErr.message)
    }

    logger.info(
      `[PointsSettlement] claimId=${claimId}, userId=${finalUserId}, final=${finalPoints}, base=${resolvedBasePoints}, coef=${coefficient}, source=${source}`
    )

    return {
      success: true,
      claimId,
      userId: finalUserId,
      taskId: finalTaskId,
      basePoints: resolvedBasePoints,
      coefficient,
      bonusPoints,
      finalPoints,
      isNight,
      onlineUsers
    }
  }
}

export default new PointsSettlementService()
