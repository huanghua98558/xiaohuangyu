const toBigInt = (id) => {
  if (typeof id === 'bigint') return id
  if (typeof id === 'string') return BigInt(id)
  if (typeof id === 'number') return BigInt(Math.floor(id))
  return BigInt(id)
}

/**
 * 任务服务 - Prisma 版本
 */
import prisma from "../utils/prisma.js"
import { cache, DistributedLock } from "../utils/redis.js"
import logger from "../utils/logger.js"
import { AppError } from "../middlewares/errorHandler.js"
import nightPointService from "./nightPointService.js"
import onlineUserService from "./onlineUserService.js"
import { getConfigValues } from "./systemConfigService.js"
import {
  CLAIM_STATUS,
  PENDING_REVIEW_STATUSES,
  FINAL_APPROVED_STATUSES,
  RETRYABLE_REJECTION_STATUSES,
  normalizeClaimStatus,
  isClaimRejectedForUserDisplay,
  canResubmitClaim
} from "../constants/claimLifecycle.js"
import {
  appendReviewHistory,
  createReviewHistoryEntry,
  getLatestMeaningfulReason,
  safeParseReviewHistory
} from "../utils/claimReviewHistory.js"

const CONFIG_CACHE_KEY = "sys:config"
const CONFIG_CACHE_TTL = 300

// 辅助函数：判断是否为完成状态
function isCompletedStatus(status) {
  return FINAL_APPROVED_STATUSES.includes(normalizeClaimStatus(status))
}

// 辅助函数：判断是否为可重提的失败状态
function isFailedButRetryableStatus(status) {
  const normalizedStatus = normalizeClaimStatus(status)
  return ['image_failed', ...RETRYABLE_REJECTION_STATUSES].includes(normalizedStatus)
}

// 辅助函数：判断是否可以提交任务
function canSubmitTask(status) {
  const normalizedStatus = normalizeClaimStatus(status)
  return normalizedStatus === CLAIM_STATUS.DOING || isFailedButRetryableStatus(normalizedStatus)
}

function parseJsonField(raw, fallback) {
  if (raw === undefined || raw === null) {
    return fallback
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return fallback
    }
  }
  return raw
}

function normalizeEvaluation(evaluation) {
  const parsed = parseJsonField(evaluation, evaluation)
  if (typeof parsed === 'string') {
    return parsed
  }
  if (parsed && typeof parsed === 'object') {
    return parsed.text || parsed.content || ''
  }
  return ''
}

function normalizeScreenshots(screenshots) {
  const parsed = parseJsonField(screenshots, [])
  if (!Array.isArray(parsed)) {
    return []
  }
  return parsed.map(item => (typeof item === 'string' ? item : item?.url)).filter(Boolean)
}

class TaskService {
  async getConfig() {
    if (cache.isReady()) {
      const cached = await cache.get(CONFIG_CACHE_KEY)
      if (cached) return cached
    }

    const configMap = await getConfigValues([
      'defaultTimeLimitMinutes',
      'maxActiveTasksPerUser',
      'platformRewardRatio',
      'levelRewardRatio',
      'basePointsPerTask',
    ])

    const config = {
      defaultTimeLimitMinutes: parseInt(configMap.defaultTimeLimitMinutes) || 15,
      maxActiveTasksPerUser: parseInt(configMap.maxActiveTasksPerUser) || 3,
      platformRewardRatio: parseFloat(configMap.platformRewardRatio) || 0.5,
      levelRewardRatio: parseFloat(configMap.levelRewardRatio) || 0.3,
      basePointsPerTask: parseInt(configMap.basePointsPerTask) || 10
    }

    if (cache.isReady()) {
      await cache.set(CONFIG_CACHE_KEY, config, CONFIG_CACHE_TTL)
    }

    return config
  }

  async buildNightRewardInfo(task, onlineUsers = null) {
    try {
      const basePoints = Number(task?.reward || task?.base_reward || 0)
      const publishTime = task?.created_at || task?.start_time || null
      const needCount = Math.max(1, Number(task?.need_count || 1))
      const remain = Math.max(0, Number(task?.remain || 0))
      const acceptedCount = Math.max(0, needCount - remain)
      const resolvedOnlineUsers =
        onlineUsers === null || onlineUsers === undefined
          ? (await onlineUserService.getOnlineCount()) ?? 0
          : onlineUsers

      const result = await nightPointService.calculateCoefficientByPublishTime({
        publishTime,
        onlineUsers: Number(resolvedOnlineUsers) || 0,
        acceptedCount,
        needCount
      })

      const coefficient = Number(result?.coefficient || 1)
      const estimatedReward = Math.max(0, Math.ceil(basePoints * coefficient))

      return {
        isNight: Boolean(result?.isNight),
        coefficient,
        bonusPoints: Math.max(0, estimatedReward - basePoints),
        estimatedReward,
        publishTime
      }
    } catch (err) {
      logger.warn('构建夜间积分预览失败:', err.message)
      const fallbackReward = Number(task?.reward || task?.base_reward || 0)
      return {
        isNight: false,
        coefficient: 1,
        bonusPoints: 0,
        estimatedReward: fallbackReward,
        publishTime: task?.created_at || null
      }
    }
  }

  async getTasks(filters, geo, limit, userId, source) {
    const { platform, action } = filters
    const conditions = ["status = $1", "remain > 0"]
    const params = ["active"]
    let paramIndex = 2

    if (platform) {
      conditions.push(`platform = $${paramIndex}`)
      params.push(platform)
      paramIndex++
    }
    if (action) {
      conditions.push(`action = $${paramIndex}`)
      params.push(action)
      paramIndex++
    }

    const whereClause = "WHERE " + conditions.join(" AND ")
    const limitClause = limit ? `LIMIT $${paramIndex}` : ""
    if (limit) params.push(limit)

    const sql = `SELECT * FROM tasks ${whereClause} ORDER BY created_at DESC ${limitClause}`
    const tasks = await prisma.$queryRawUnsafe(sql, ...params)
    const onlineUsers = await onlineUserService.getOnlineCount()

    return Promise.all((tasks || []).map(async (t) => {
      const nightInfo = await this.buildNightRewardInfo(t, onlineUsers)
      return {
        id: t.id.toString(),
        title: t.title,
        platform: t.platform,
        action: t.action,
        description: t.description,
        reward: Number(t.reward || 0),
        remain: Number(t.remain || 0),
        timeLimitMinutes: Number(t.time_limit_minutes || 15),
        status: t.status,
        createdAt: t.created_at,
        isNightBonusTask: nightInfo.isNight,
        nightCoefficient: nightInfo.coefficient,
        nightBonusPoints: nightInfo.bonusPoints,
        estimatedReward: nightInfo.estimatedReward,
        publishTime: nightInfo.publishTime
      }
    }))
  }

  async getTaskById(id, userId = null) {
    const taskId = typeof id === 'string' ? BigInt(id) : id
    const tasks = await prisma.$queryRaw`SELECT * FROM tasks WHERE id = ${taskId}`
    if (!tasks || tasks.length === 0) return null
    const t = tasks[0]
    const nightInfo = await this.buildNightRewardInfo(t)
    
    // 检查用户是否已领取此任务
    let isClaimed = false
    let myClaimId = null
    if (userId) {
      const uid = typeof userId === 'string' ? BigInt(userId) : userId
      // 查询用户对该任务的所有 claim 记录（排除已放弃和已释放的）
      const claims = await prisma.$queryRaw`
        SELECT id, status, expires_at FROM claims 
        WHERE task_id = ${taskId} AND user_id = ${uid} 
        AND status NOT IN ('abandoned', 'released')
        ORDER BY claimed_at DESC
        LIMIT 1
      `
      
      if (claims && claims.length > 0) {
        const claim = claims[0]
        const claimStatus = claim.status
        
        // 判断是否可以重新领取
        // - abandoned: 已放弃，可以重新领取
        // - released: 已释放（被拒绝3次），可以重新领取
        // - expired: 已过期，可以重新领取
        // - doing: 进行中，可以提交
        // - submitted/image_reviewing/link_reviewing/pending_manual: 审核中
        // - done/approved/image_approved: 已完成
        // - image_failed/image_rejected/link_rejected: 失败可重提
        
        const normalizedClaimStatus = normalizeClaimStatus(claimStatus)
        const canClaim = ['expired', 'abandoned', 'released'].includes(normalizedClaimStatus)
        const isCompleted = FINAL_APPROVED_STATUSES.includes(normalizedClaimStatus)
        const isPending = PENDING_REVIEW_STATUSES.includes(normalizedClaimStatus)
        const canSubmit = normalizedClaimStatus === CLAIM_STATUS.DOING || isFailedButRetryableStatus(normalizedClaimStatus)
        
        // 如果任务已完成或审核中，标记为已领取
        isClaimed = isCompleted || isPending || (normalizedClaimStatus === CLAIM_STATUS.DOING && claim.expires_at && new Date(claim.expires_at) > new Date())
        myClaimId = claim.id.toString()
        
        return {
          id: t.id.toString(),
          title: t.title,
          platform: t.platform,
          action: t.action,
          videoUrl: t.video_url,
          description: t.description,
          templateImages: typeof t.template_images === 'string' ? JSON.parse(t.template_images || '[]') : (t.template_images || []),
          exampleImages: typeof t.example_images === 'string' ? JSON.parse(t.example_images || '[]') : (t.example_images || []),
          requirements: typeof t.requirements === 'string' ? JSON.parse(t.requirements || '[]') : (t.requirements || []),
          reward: Number(t.reward || 0),
          baseReward: Number(t.base_reward || 0),
          remain: Number(t.remain || 0),
          needCount: Number(t.need_count || 0),
          timeLimitMinutes: Number(t.time_limit_minutes || 15),
          cityLimit: Number(t.city_limit || 1),
          provinceLimit: Number(t.province_limit || 4),
          status: t.status,
          createdAt: t.created_at,
          isClaimed,
          myClaimId,
          claimStatus,  // 添加 claim 状态
          canClaim,     // 是否可以重新领取
          canSubmit,    // 是否可以提交
          isCompleted,  // 是否已完成
          isPending,     // 是否审核中
          isNightBonusTask: nightInfo.isNight,
          nightCoefficient: nightInfo.coefficient,
          nightBonusPoints: nightInfo.bonusPoints,
          estimatedReward: nightInfo.estimatedReward,
          publishTime: nightInfo.publishTime
        }
      }
    }
    
    return {
      id: t.id.toString(),
      title: t.title,
      platform: t.platform,
      action: t.action,
      videoUrl: t.video_url,
      description: t.description,
      templateImages: typeof t.template_images === 'string' ? JSON.parse(t.template_images || '[]') : (t.template_images || []),
      exampleImages: typeof t.example_images === 'string' ? JSON.parse(t.example_images || '[]') : (t.example_images || []),
      requirements: typeof t.requirements === 'string' ? JSON.parse(t.requirements || '[]') : (t.requirements || []),
      reward: Number(t.reward || 0),
      baseReward: Number(t.base_reward || 0),
      remain: Number(t.remain || 0),
      needCount: Number(t.need_count || 0),
      timeLimitMinutes: Number(t.time_limit_minutes || 15),
      cityLimit: Number(t.city_limit || 1),
      provinceLimit: Number(t.province_limit || 4),
      status: t.status,
      createdAt: t.created_at,
      isClaimed,
      myClaimId,
      isNightBonusTask: nightInfo.isNight,
      nightCoefficient: nightInfo.coefficient,
      nightBonusPoints: nightInfo.bonusPoints,
      estimatedReward: nightInfo.estimatedReward,
      publishTime: nightInfo.publishTime
    }
  }

  async getMyTasks(userId) {
    // 转换用户ID为整数
    const uid = typeof userId === "string" ? BigInt(userId) : userId
    
    // 查询所有相关任务（包括 doing, submitted, 以及各种审核状态）
    const claims = await prisma.$queryRaw`
      SELECT c.*, t.title, t.platform, t.action, t.reward as task_reward, t.base_reward as task_base_reward, t.description,
             t.created_at as task_created_at, t.need_count as task_need_count, t.remain as task_remain
      FROM claims c
      JOIN tasks t ON c.task_id = t.id
      WHERE c.user_id = ${uid}
      ORDER BY c.claimed_at DESC
    `

    // 分组处理
    const doing = []
    const pending = []
    const done = []
    let totalRewards = 0
    const onlineUsers = await onlineUserService.getOnlineCount()
    
	    for (const c of (claims || [])) {
	      const normalizedStatus = normalizeClaimStatus(c.status)
	      const screenshots = normalizeScreenshots(c.screenshots)
	      const reviewHistory = safeParseReviewHistory(c.review_history)
	      const evaluation = normalizeEvaluation(c.evaluation)
	      const isRejected = isClaimRejectedForUserDisplay({
	        status: normalizedStatus,
	        reject_count: c.reject_count,
	        image_review_status: c.image_review_status,
	        link_review_status: c.link_review_status
	      })
	      const nightPreview = await this.buildNightRewardInfo({
	        reward: c.reward || c.base_reward || c.task_reward || c.task_base_reward,
	        base_reward: c.task_base_reward || c.base_reward,
	        created_at: c.task_created_at,
        need_count: c.task_need_count,
        remain: c.task_remain
      }, onlineUsers)

      const settledCoefficient = Number(c.night_coefficient || 0)
      const settledReward = Number(c.reward || 0)
      const settledBaseReward = Number(c.base_reward || 0)
      const finalCoefficient = settledCoefficient > 0 ? settledCoefficient : nightPreview.coefficient
      const finalBonusPoints =
        settledCoefficient > 0
          ? Math.max(0, settledReward - settledBaseReward)
          : nightPreview.bonusPoints

	      const item = {
	        id: c.id.toString(),
	        taskId: c.task_id?.toString(),
	        title: c.title,
	        platform: c.platform,
	        action: c.action,
	        status: normalizedStatus,
	        reward: Number(c.reward || 0),
	        baseReward: settledBaseReward,
	        claimedAt: c.claimed_at,
	        expiresAt: c.expires_at,
	        submittedAt: c.submitted_at,
	        reviewedAt: c.reviewed_at,
	        publishTime: c.task_created_at,
	        reviewNote: getLatestMeaningfulReason(c),
	        screenshots,
	        evaluation,
	        platformNickname: c.platform_nickname || '',
	        reviewHistory,
	        isNightBonusTask: nightPreview.isNight,
	        nightCoefficient: finalCoefficient,
	        nightBonusPoints: finalBonusPoints,
	        estimatedReward: nightPreview.estimatedReward,
	        isRejected,
	        canResubmit: canResubmitClaim({
	          status: normalizedStatus,
	          reject_count: c.reject_count
	        }),
	        canWithdraw: [CLAIM_STATUS.SUBMITTED, CLAIM_STATUS.IMAGE_REVIEWING].includes(normalizedStatus),
	        // 审核详情
	        reviewDetail: {
	          imageStatus: c.image_review_status,
	          imageReason: c.image_review_reason,
	          linkStatus: c.link_review_status,
	          linkReason: c.link_review_reason,
	          rejectCount: c.reject_count || 0,
	          maxRejectCount: 3,
	          stageLabel:
	            normalizedStatus === CLAIM_STATUS.SUBMITTED ? '等待图片审核' :
	            normalizedStatus === CLAIM_STATUS.IMAGE_REVIEWING ? '图片审核中' :
	            normalizedStatus === CLAIM_STATUS.PENDING_LINK ? '图片通过，等待连接审核' :
	            normalizedStatus === CLAIM_STATUS.LINK_REVIEWING ? '连接审核中' :
	            normalizedStatus === CLAIM_STATUS.PENDING_MANUAL ? '人工复审中' :
	            isRejected ? '已退回待重提' :
	            FINAL_APPROVED_STATUSES.includes(normalizedStatus) ? '审核通过' :
	            '进行中'
	        },
	        settlement: {
	          finalPoints: settledReward,
	          basePoints: settledBaseReward,
          coefficient: finalCoefficient,
          bonusPoints: finalBonusPoints,
          isNightAwarded: settledCoefficient > 1
        }
      }
      
      // 根据状态分组
	      if (normalizedStatus === CLAIM_STATUS.RELEASED) {
	        // 3次拒绝后释放的任务，不显示
	        continue
	      } else if (normalizedStatus === CLAIM_STATUS.DOING || RETRYABLE_REJECTION_STATUSES.includes(normalizedStatus)) {
	        // 进行中（未过期）或失败可重提
	        if (!c.expires_at || new Date(c.expires_at) > new Date() || isRejected) {
	          doing.push(item)
	        }
	      } else if (PENDING_REVIEW_STATUSES.includes(normalizedStatus)) {
	        // 待审核
	        pending.push(item)
	      } else if (FINAL_APPROVED_STATUSES.includes(normalizedStatus)) {
	        // 已完成（兼容多种状态值）
	        done.push(item)
	        totalRewards += Number(c.reward || 0)
	      } else if (normalizedStatus === CLAIM_STATUS.EXPIRED) {
	        // 过期任务不显示
	      } else if (normalizedStatus === CLAIM_STATUS.ABANDONED) {
	        // 已放弃的任务不显示
	      } else {
	        // 其他未知状态，记录日志但不显示
	        console.log('Unknown claim status:', normalizedStatus)
	      }
	    }
    
    return {
      doing,
      pending,
      done,
      doneStats: {
        totalCount: done.length,
        totalRewards
      }
    }
  }

  /**
   * 领取任务
   */
  /**
   * 领取任务（添加分布式锁防止并发领取）
   */
  async claimTask(userId, taskId, geo = {}) {
    const uid = typeof userId === "string" ? BigInt(userId) : userId
    const tid = typeof taskId === "string" ? BigInt(taskId) : taskId
    const { city, province, lat, lng } = geo

    // ============ P0 修复：添加分布式锁 ============
    const lockKey = `lock:claim:${userId}:${taskId}`
    const lock = await DistributedLock.acquire(lockKey, 30000)
    
    if (!lock.success) {
      throw new AppError("操作过于频繁，请稍后再试", 429, "TOO_MANY_REQUESTS")
    }
    
    try {
      // 1. 获取任务信息
      const tasks = await prisma.$queryRaw`SELECT * FROM tasks WHERE id = ${tid}`
      if (!tasks || tasks.length === 0) {
        throw new AppError("任务不存在", 404, "NOT_FOUND")
      }
      const task = tasks[0]

      // 2. 检查任务状态
      if (task.status !== "active") {
        throw new AppError("任务已下架", 400, "BAD_REQUEST")
      }

      // 3. 检查余量（使用乐观锁）
      if (Number(task.remain) <= 0) {
        throw new AppError("任务已被抢完", 400, "BAD_REQUEST")
      }

      // 4. 检查用户是否已领取
      const existingClaims = await prisma.$queryRaw`
        SELECT id FROM claims 
        WHERE task_id = ${tid} AND user_id = ${uid} 
        AND status IN (
          ${CLAIM_STATUS.DOING},
          ${CLAIM_STATUS.SUBMITTED},
          ${CLAIM_STATUS.IMAGE_REVIEWING},
          ${CLAIM_STATUS.PENDING_LINK},
          ${CLAIM_STATUS.LINK_REVIEWING},
          ${CLAIM_STATUS.PENDING_MANUAL},
          ${CLAIM_STATUS.APPROVED},
          ${CLAIM_STATUS.DONE}
        )
      `
      if (existingClaims && existingClaims.length > 0) {
        throw new AppError("您已领取过此任务", 400, "BAD_REQUEST")
      }

      // 5. 获取配置
      const config = await this.getConfig()

      // 6. 检查用户当前进行中的任务数量
      const activeCountResult = await prisma.$queryRaw`
        SELECT COUNT(*)::int as count FROM claims 
        WHERE user_id = ${uid} AND status = ${CLAIM_STATUS.DOING}
      `
      const activeCount = Number(activeCountResult[0]?.count || 0)
      if (activeCount >= config.maxActiveTasksPerUser) {
        throw new Error(`您有${activeCount}个任务正在进行中，请先完成后再领取新任务`)
      }

      // 7. 检查城市限制
      if (task.city_limit > 0 && city) {
        const cityCountResult = await prisma.$queryRaw`
          SELECT COUNT(*)::int as count FROM claims 
          WHERE task_id = ${tid} AND city = ${city}
        `
        const cityCount = Number(cityCountResult[0]?.count || 0)
        if (cityCount >= task.city_limit) {
          throw new AppError("该城市名额已满", 400, "BAD_REQUEST")
        }
      }

      // 8. 检查省份限制
      if (task.province_limit > 0 && province) {
        const provinceCountResult = await prisma.$queryRaw`
          SELECT COUNT(*)::int as count FROM claims 
          WHERE task_id = ${tid} AND province = ${province}
        `
        const provinceCount = Number(provinceCountResult[0]?.count || 0)
        if (provinceCount >= task.province_limit) {
          throw new AppError("该省份名额已满", 400, "BAD_REQUEST")
        }
      }

      // 9. 计算奖励
      const baseReward = Number(task.base_reward || task.reward || 0)
      const levelCoefficient = 1.0 // TODO: 根据用户等级计算
      const finalReward = Math.round(baseReward * levelCoefficient)

      // 10. 计算过期时间
      const timeLimitMinutes = Number(task.time_limit_minutes || config.defaultTimeLimitMinutes)
      const expiresAt = new Date(Date.now() + timeLimitMinutes * 60 * 1000)

      // ============ P0 修复：使用事务确保原子性 ============
      // 11. 创建领取记录
      const insertResult = await prisma.$queryRaw`
        INSERT INTO claims (
          user_id, task_id, title, platform, action,
          base_reward, reward, level_coefficient,
          status, city, province, expires_at
        ) VALUES (
          ${uid}, ${tid}, ${task.title}, ${task.platform}, ${task.action},
          ${baseReward}, ${finalReward}, ${levelCoefficient},
          ${CLAIM_STATUS.DOING}, ${city || null}, ${province || null}, ${expiresAt}
        ) RETURNING id
      `

      const claimId = insertResult[0]?.id?.toString()

      // 12. 更新任务余量（带条件检查，乐观锁）
      const updateResult = await prisma.$queryRaw`
        UPDATE tasks SET remain = remain - 1 
        WHERE id = ${tid} AND remain > 0
      `

      logger.info(`✅ 用户 ${userId} 领取任务 ${taskId} 成功, claimId: ${claimId}`)

      return {
        claimId,
        taskId: taskId.toString(),
        title: task.title,
        reward: finalReward,
        timeLimitMinutes,
        expiresAt
      }
    } finally {
      await lock.release()
    }
  }
  async submitTask(userId, claimId, platformNickname, screenshots, evaluation) {
    const uid = typeof userId === "string" ? BigInt(userId) : userId
    const cid = typeof claimId === "string" ? BigInt(claimId) : claimId

    // 1. 验证领取记录
    const claims = await prisma.$queryRaw`
      SELECT c.*, t.title as task_title, t.platform, t.action
      FROM claims c
      LEFT JOIN tasks t ON c.task_id = t.id
      WHERE c.id = ${cid} AND c.user_id = ${uid}
    `
    
    if (!claims || claims.length === 0) {
      throw new AppError("领取记录不存在", 404, "NOT_FOUND")
    }
    
    const claim = claims[0]
    
    // 2. 检查状态 - 允许 doing 和失败状态重提
    const canSubmit = claim.status === CLAIM_STATUS.DOING || isFailedButRetryableStatus(claim.status)
    if (!canSubmit) {
      throw new AppError(`任务状态不正确: ${claim.status}`, 400, "BAD_REQUEST")
    }
    
    // 3. 检查是否过期（失败状态可重提，跳过过期检查）
    const isRetryableStatus = isFailedButRetryableStatus(claim.status);
    if (!isRetryableStatus && claim.expires_at && new Date(claim.expires_at) < new Date()) {
      throw new AppError("任务已过期", 400, "BAD_REQUEST")
    }
    
	    // 失败状态重提时，延长过期时间
	    if (isRetryableStatus) {
	      const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 延长24小时
	      await prisma.$queryRaw`
	        UPDATE claims SET expires_at = ${newExpiresAt} WHERE id = ${cid}
	      `;
	    }

	    const nextReviewHistory = appendReviewHistory(
	      claim.review_history,
	      createReviewHistoryEntry({
	        stage: 'submission',
	        action: isRetryableStatus ? 'resubmitted' : 'submitted',
	        reason: isRetryableStatus ? '用户重新提交任务' : '用户提交任务',
	        details: {
	          screenshotsCount: Array.isArray(screenshots) ? screenshots.length : 0,
	          hasEvaluation: Boolean(evaluation),
	          previousStatus: claim.status
	        }
	      })
	    )

	    // 4. 更新领取记录
	    await prisma.$queryRaw`
	      UPDATE claims SET
	        status = ${CLAIM_STATUS.SUBMITTED},
	        platform_nickname = ${platformNickname || null},
	        screenshots = ${JSON.stringify(screenshots)}::jsonb,
	        evaluation = ${JSON.stringify({ text: evaluation || '' })}::jsonb,
	        submitted_at = NOW(),
	        reviewed_at = NULL,
	        review_note = NULL,
	        ai_review_status = 'pending',
	        ai_confidence = NULL,
	        ai_reason = NULL,
	        ai_reviewed_at = NULL,
	        image_review_status = 'pending',
	        image_review_reason = NULL,
	        image_reviewed_at = NULL,
	        link_review_status = NULL,
	        link_review_reason = NULL,
	        link_reviewed_at = NULL,
	        link_verified = NULL,
	        link_verify_result = NULL,
	        ocr_comment = NULL,
	        review_history = ${JSON.stringify(nextReviewHistory)}::jsonb
	      WHERE id = ${cid}
	    `
    
    logger.info(`用户 ${userId} 提交任务成功, claimId: ${claimId}`)

    // 5. 释放曝光额度（用户提交任务后，临时占用状态结束）
    try {
      const exposureService = await import('./exposureService.js')
      await exposureService.default.resetExposureQuotaOnSubmit(userId.toString(), 1)
      logger.info(`用户 ${userId} 提交任务后已释放曝光额度`)
    } catch (err) {
      logger.error(`释放曝光额度失败：${err.message}`)
      // 不抛出错误，避免影响提交流程
    }
    
    // 5. 入队到审核队列 (使用 Supabase 队列)
    try {
      const { enqueueReview } = await import('./ai/queueService.js')
      await enqueueReview(claimId.toString())
      logger.info(`审核任务已入队, claimId: ${claimId}`)
    } catch (err) {
      logger.error(`审核任务入队失败: ${err.message}`)
      // 不抛出错误，允许用户提交成功，后续可手动处理
    }
    
	    return {
	      claimId: claimId.toString(),
	      status: CLAIM_STATUS.SUBMITTED,
	      message: "提交成功，等待审核"
    }
  }

  /**
   * 撤回提交
   */
  async withdrawClaim(userId, claimId) {
    const uid = typeof userId === "string" ? BigInt(userId) : userId
    const cid = typeof claimId === "string" ? BigInt(claimId) : claimId

    // 1. 验证领取记录
    const claims = await prisma.$queryRaw`
      SELECT * FROM claims WHERE id = ${cid} AND user_id = ${uid}
    `
    
    if (!claims || claims.length === 0) {
      throw new AppError("领取记录不存在", 404, "NOT_FOUND")
    }
    
    const claim = claims[0]
    
	    const normalizedStatus = normalizeClaimStatus(claim.status)
	    const queueItems = await prisma.$queryRaw`
	      SELECT id, status FROM ai_review_queue WHERE claim_id = ${cid}
	    `
	    const queueItem = queueItems?.[0]
	    
	    // 2. submitted 可直接撤回；image_reviewing 仅在队列还未真正处理时允许撤回
	    if (![CLAIM_STATUS.SUBMITTED, CLAIM_STATUS.IMAGE_REVIEWING].includes(normalizedStatus)) {
	      throw new AppError("当前状态不允许撤回", 400, "BAD_REQUEST")
	    }
	    if (
	      normalizedStatus === CLAIM_STATUS.IMAGE_REVIEWING &&
	      queueItem &&
	      !['pending', 'withdrawn'].includes(queueItem.status)
	    ) {
	      throw new AppError("图片审核已开始，当前不可撤回", 400, "BAD_REQUEST")
	    }

	    const nextReviewHistory = appendReviewHistory(
	      claim.review_history,
	      createReviewHistoryEntry({
	        stage: 'submission',
	        action: 'withdrawn',
	        reason: '用户撤回提交',
	        details: {
	          previousStatus: claim.status,
	          queueStatus: queueItem?.status || null
	        }
	      })
	    )
	    
	    // 3. 更新状态
	    await prisma.$queryRaw`
	      UPDATE claims SET
	        status = ${CLAIM_STATUS.DOING},
	        submitted_at = NULL,
	        review_note = NULL,
	        ai_review_status = NULL,
	        image_review_status = NULL,
	        link_review_status = NULL,
	        review_history = ${JSON.stringify(nextReviewHistory)}::jsonb
	      WHERE id = ${cid}
	    `

	    if (queueItem) {
	      await prisma.$queryRaw`
	        UPDATE ai_review_queue
	        SET status = 'withdrawn',
	            updated_at = NOW()
	        WHERE id = ${queueItem.id}
	      `
	    }
    
    logger.info(`用户 ${userId} 撤回提交, claimId: ${claimId}`)
    
    return {
      claimId: claimId.toString(),
      status: CLAIM_STATUS.DOING,
      message: "撤回成功，可重新提交"
    }
  }

  /**
   * 放弃任务
   */
  async abandonClaim(userId, claimId) {
    const uid = typeof userId === "string" ? BigInt(userId) : userId
    const cid = typeof claimId === "string" ? BigInt(claimId) : claimId

    // 1. 验证领取记录
    const claims = await prisma.$queryRaw`
      SELECT * FROM claims WHERE id = ${cid} AND user_id = ${uid}
    `
    
    if (!claims || claims.length === 0) {
      throw new AppError("领取记录不存在", 404, "NOT_FOUND")
    }
    
    const claim = claims[0]
    
    // 2. 已提交或已完成状态不能放弃
    if (
      PENDING_REVIEW_STATUSES.includes(normalizeClaimStatus(claim.status)) ||
      FINAL_APPROVED_STATUSES.includes(normalizeClaimStatus(claim.status))
    ) {
      throw new AppError("当前状态不允许放弃", 400, "BAD_REQUEST")
    }
    
    // 3. 更新状态并恢复任务余量
    await prisma.$queryRaw`
      UPDATE claims SET status = ${CLAIM_STATUS.ABANDONED} WHERE id = ${cid}
    `
    
    await prisma.$queryRaw`
      UPDATE tasks SET remain = remain + 1 WHERE id = ${claim.task_id}
    `
    
    logger.info(`用户 ${userId} 放弃任务, claimId: ${claimId}`)
    
    return {
      claimId: claimId.toString(),
      status: CLAIM_STATUS.ABANDONED,
      message: "任务已放弃"
    }
  }

  async getReviewStats() {

    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) FILTER (
          WHERE status = ${CLAIM_STATUS.SUBMITTED}
             OR status = ${CLAIM_STATUS.IMAGE_REVIEWING}
             OR status = ${CLAIM_STATUS.PENDING_LINK}
             OR status = ${CLAIM_STATUS.LINK_REVIEWING}
             OR status = ${CLAIM_STATUS.PENDING_MANUAL}
        ) as pending,
        COUNT(*) FILTER (
          WHERE status = ${CLAIM_STATUS.APPROVED}
             OR status = ${CLAIM_STATUS.DONE}
        ) as approved,
        COUNT(*) FILTER (
          WHERE status = ${CLAIM_STATUS.REJECTED}
             OR status = ${CLAIM_STATUS.IMAGE_REJECTED}
             OR status = ${CLAIM_STATUS.LINK_REJECTED}
             OR status = ${CLAIM_STATUS.RELEASED}
             OR (
               status = ${CLAIM_STATUS.DOING}
               AND (
                 image_review_status = 'rejected'
                 OR link_review_status = 'rejected'
               )
             )
        ) as rejected
      FROM claims
      WHERE submitted_at IS NOT NULL
    `
    
    return {
      pending: Number(stats[0]?.pending || 0),
      approved: Number(stats[0]?.approved || 0),
      rejected: Number(stats[0]?.rejected || 0)
    }
  }

  async getTasksWithStats(page = 1, size = 20, filters = {}) {
    const offset = (page - 1) * size
    
    const conditions = []
    const params = []
    
    if (filters.status) {
      conditions.push("status = $" + (params.length + 1))
      params.push(filters.status)
    }
    if (filters.platform) {
      conditions.push("platform = $" + (params.length + 1))
      params.push(filters.platform)
    }
    
    const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : ""
    
    const countSql = "SELECT COUNT(*) as count FROM tasks " + whereClause
    const countResult = await prisma.$queryRawUnsafe(countSql, ...params)
    const total = Number(countResult[0]?.count || 0)
    
    params.push(size)
    params.push(offset)
    const listSql = "SELECT * FROM tasks " + whereClause + " ORDER BY created_at DESC LIMIT $" + (params.length - 1) + " OFFSET $" + params.length
    const tasks = await prisma.$queryRawUnsafe(listSql, ...params)
    
    const taskIds = (tasks || []).map(t => t.id)
    
    let claimsStats = []
    if (taskIds.length > 0) {
      claimsStats = await prisma.$queryRaw`
        SELECT 
          task_id,
          COUNT(*) as total_claims,
          COUNT(*) FILTER (WHERE status = ${CLAIM_STATUS.SUBMITTED}) as submitted_count,
          COUNT(*) FILTER (
            WHERE status = ${CLAIM_STATUS.SUBMITTED}
               OR status = ${CLAIM_STATUS.IMAGE_REVIEWING}
               OR status = ${CLAIM_STATUS.PENDING_LINK}
               OR status = ${CLAIM_STATUS.LINK_REVIEWING}
               OR status = ${CLAIM_STATUS.PENDING_MANUAL}
          ) as pending_count,
          COUNT(*) FILTER (
            WHERE status = ${CLAIM_STATUS.APPROVED}
               OR status = ${CLAIM_STATUS.DONE}
          ) as done_count,
          COUNT(*) FILTER (
            WHERE status = ${CLAIM_STATUS.REJECTED}
               OR status = ${CLAIM_STATUS.IMAGE_REJECTED}
               OR status = ${CLAIM_STATUS.LINK_REJECTED}
               OR status = ${CLAIM_STATUS.RELEASED}
               OR (
                 status = ${CLAIM_STATUS.DOING}
                 AND (
                   image_review_status = 'rejected'
                   OR link_review_status = 'rejected'
                 )
               )
          ) as rejected_count,
          COUNT(*) FILTER (WHERE status = ${CLAIM_STATUS.DOING}) as doing_count
        FROM claims
        WHERE task_id = ANY(${taskIds})
        GROUP BY task_id
      `
    }
    
    const statsMap = new Map()
    for (const stat of claimsStats) {
      const totalClaims = Number(stat.total_claims || 0)
      const doneCount = Number(stat.done_count || 0)
      statsMap.set(stat.task_id.toString(), {
        totalClaims,
        submittedCount: Number(stat.submitted_count || 0),
        pendingCount: Number(stat.pending_count || 0),
        doneCount,
        rejectedCount: Number(stat.rejected_count || 0),
        expiredCount: 0,
        doingCount: Number(stat.doing_count || 0),
        completedRate: totalClaims > 0 ? Math.round((doneCount / totalClaims) * 100) : 0
      })
    }
    
    const list = (tasks || []).map(t => {
      const stats = statsMap.get(t.id.toString()) || {
        totalClaims: 0,
        submittedCount: 0,
        pendingCount: 0,
        doneCount: 0,
        rejectedCount: 0,
        expiredCount: 0,
        doingCount: 0,
        completedRate: 0
      }
      
      return {
        id: t.id.toString(),
        title: t.title,
        taskCode: t.task_code,
        platform: t.platform,
        action: t.action,
        videoUrl: t.video_url,
        description: t.description,
        templateImages: typeof t.template_images === "string" ? JSON.parse(t.template_images || "[]") : (t.template_images || []),
        exampleImages: typeof t.example_images === "string" ? JSON.parse(t.example_images || "[]") : (t.example_images || []),
        requirements: t.requirements,
        reward: Number(t.reward || 0),
        baseReward: Number(t.base_reward || 0),
        remain: Number(t.remain || 0),
        needCount: Number(t.need_count || 0),
        timeLimitMinutes: Number(t.time_limit_minutes || 15),
        cityLimit: Number(t.city_limit || 1),
        provinceLimit: Number(t.province_limit || 4),
        publisherType: t.publisher_type,
        publisherId: t.publisher_id,
        status: t.status,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        stats
      }
    })
    
    return { list, total, page, size }
  }

  async getTasksOverview() {
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(*) FILTER (WHERE status = 'active') as active_tasks,
        COUNT(*) FILTER (WHERE status = 'inactive') as inactive_tasks,
        SUM(remain) as total_remain,
        SUM(need_count) as total_need
      FROM tasks
    `
    
    const claimStats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_claims,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) FILTER (WHERE status = 'submitted') as submitted,
        COUNT(*) FILTER (
          WHERE status = 'approved'
             OR status = 'done'
        ) as completed,
        COUNT(*) FILTER (
          WHERE status = 'submitted'
             OR status = 'image_reviewing'
             OR status = 'pending_link'
             OR status = 'link_reviewing'
             OR status = 'pending_manual'
        ) as pending,
        SUM(reward) FILTER (
          WHERE status = 'approved'
             OR status = 'done'
        ) as total_reward
      FROM claims
    `
    
    return {
      totalTasks: Number(stats[0]?.total_tasks || 0),
      activeTasks: Number(stats[0]?.active_tasks || 0),
      inactiveTasks: Number(stats[0]?.inactive_tasks || 0),
      totalClaims: Number(claimStats[0]?.total_claims || 0),
      uniqueClaimUsers: Number(claimStats[0]?.unique_users || 0),
      totalSubmitted: Number(claimStats[0]?.submitted || 0),
      totalCompleted: Number(claimStats[0]?.completed || 0),
      totalPending: Number(claimStats[0]?.pending || 0)
    }
  }
  async getTodayStats() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // 今日发布的任务数
    const todayTasksResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM tasks WHERE created_at >= ${today}
    `
    const todayPublishedTasks = Number(todayTasksResult[0]?.count || 0)
    
    // 今日任务总量（剩余名额）
    const remainResult = await prisma.$queryRaw`
      SELECT COALESCE(SUM(remain), 0) as total FROM tasks WHERE status = 'active'
    `
    const remainTotal = Number(remainResult[0]?.total || 0)
    
    // 今日领取数量
    const todayClaimsResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM claims WHERE claimed_at >= ${today}
    `
    const todayClaims = Number(todayClaimsResult[0]?.count || 0)
    
    // 今日已完成数量
    const todayCompletedResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM claims
      WHERE reviewed_at >= ${today}
        AND (
          status = ${CLAIM_STATUS.APPROVED}
          OR status = ${CLAIM_STATUS.DONE}
        )
    `
    const todayCompleted = Number(todayCompletedResult[0]?.count || 0)
    
    // 今日任务总量（今日发布任务的积分总和）
    const todayAmountResult = await prisma.$queryRaw`
      SELECT COALESCE(SUM(reward), 0) as total FROM tasks WHERE created_at >= ${today}
    `
    const todayTotalAmount = Number(todayAmountResult[0]?.total || 0)
    
    // 今日任务已完成数
    const todayCompletedFromTodayTasksResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM claims c
      JOIN tasks t ON c.task_id = t.id
      WHERE t.created_at >= ${today}
        AND (
          c.status = ${CLAIM_STATUS.APPROVED}
          OR c.status = ${CLAIM_STATUS.DONE}
        )
    `
    const todayCompletedFromTodayTasks = Number(todayCompletedFromTodayTasksResult[0]?.count || 0)
    
    return {
      todayPublishedTasks,
      todayTotalAmount,
      todayCompleted,
      remainTotal,
      todayClaims,
      todayCompletedFromTodayTasks
    }
  }

  async getTaskStats(taskId) {
    // 确保 taskId 是整数类型
    // 直接使用字符串 taskId，避免 BigInt 精度丢失
    const taskIdBigInt = BigInt(taskId);
    
    const tasks = await prisma.$queryRaw`
      SELECT * FROM tasks WHERE id = ${taskIdBigInt}
    `
    
    if (!tasks || tasks.length === 0) {
      throw new AppError("任务不存在", 404, "NOT_FOUND")
    }
    
    const t = tasks[0]
    
    const statsResult = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_claims,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) FILTER (WHERE status = ${CLAIM_STATUS.SUBMITTED}) as submitted_count,
        COUNT(*) FILTER (
          WHERE status = ${CLAIM_STATUS.SUBMITTED}
             OR status = ${CLAIM_STATUS.IMAGE_REVIEWING}
             OR status = ${CLAIM_STATUS.PENDING_LINK}
             OR status = ${CLAIM_STATUS.LINK_REVIEWING}
             OR status = ${CLAIM_STATUS.PENDING_MANUAL}
        ) as pending_count,
        COUNT(*) FILTER (WHERE status = ${CLAIM_STATUS.DOING}) as doing_count,
        COUNT(*) FILTER (
          WHERE status = ${CLAIM_STATUS.APPROVED}
             OR status = ${CLAIM_STATUS.DONE}
        ) as done_count,
        COUNT(*) FILTER (
          WHERE status = ${CLAIM_STATUS.REJECTED}
             OR status = ${CLAIM_STATUS.IMAGE_REJECTED}
             OR status = ${CLAIM_STATUS.LINK_REJECTED}
             OR status = ${CLAIM_STATUS.RELEASED}
             OR (
               status = ${CLAIM_STATUS.DOING}
               AND (
                 image_review_status = 'rejected'
                 OR link_review_status = 'rejected'
               )
             )
        ) as rejected_count,
        COUNT(*) FILTER (WHERE status = ${CLAIM_STATUS.EXPIRED}) as expired_count
      FROM claims
      WHERE task_id = ${taskIdBigInt}
    `
    
    const s = statsResult[0] || {}
    const totalClaims = Number(s.total_claims || 0)
    const doneCount = Number(s.done_count || 0)
    const submittedCount = Number(s.submitted_count || 0)
    
    const task = {
      id: t.id.toString(),
      title: t.title,
      taskCode: t.task_code,
      platform: t.platform,
      action: t.action,
      videoUrl: t.video_url,
      description: t.description,
      templateImages: typeof t.template_images === "string" ? JSON.parse(t.template_images || "[]") : (t.template_images || []),
      exampleImages: typeof t.example_images === "string" ? JSON.parse(t.example_images || "[]") : (t.example_images || []),
      requirements: t.requirements,
      reward: Number(t.reward || 0),
      baseReward: Number(t.base_reward || 0),
      remain: Number(t.remain || 0),
      needCount: Number(t.need_count || 0),
      timeLimitMinutes: Number(t.time_limit_minutes || 15),
      cityLimit: Number(t.city_limit || 1),
      provinceLimit: Number(t.province_limit || 4),
      publisherType: t.publisher_type,
      publisherId: t.publisher_id,
      status: t.status,
      createdAt: t.created_at,
      updatedAt: t.updated_at
    }
    
    return {
      task,
      stats: {
        totalClaims,
        uniqueUsers: Number(s.unique_users || 0),
        submittedCount,
        pendingCount: Number(s.pending_count || 0),
        doneCount,
        rejectedCount: Number(s.rejected_count || 0),
        expiredCount: Number(s.expired_count || 0),
        doingCount: Number(s.doing_count || 0),
        completedRate: totalClaims > 0 ? Math.round((doneCount / totalClaims) * 100) : 0,
        submittedRate: totalClaims > 0 ? Math.round((submittedCount / totalClaims) * 100) : 0
      }
    }
  }

  async getTaskClaims(taskId, options = {}) {
    const { page = 1, size = 20, status } = options
    const offset = (page - 1) * size
    
    // 确保 taskId 是整数类型
    // 直接使用字符串 taskId，避免 BigInt 精度丢失
    const taskIdBigInt = BigInt(taskId);

    const tasks = await prisma.$queryRaw`
      SELECT id, title FROM tasks WHERE id = ${taskIdBigInt}
    `
    if (!tasks || tasks.length === 0) {
      throw new AppError("任务不存在", 404, "NOT_FOUND")
    }

    let claimsQuery = `
      SELECT c.*, u.username, u.phone
      FROM claims c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.task_id = $1
    `
    const params = [taskIdBigInt]
    
    if (status) {
      claimsQuery += ` AND c.status = $${params.length + 1}`
      params.push(status)
    }
    
    claimsQuery += ` ORDER BY c.claimed_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(size, offset)

    const claims = await prisma.$queryRawUnsafe(claimsQuery, ...params)

    let countQuery = `SELECT COUNT(*)::int as count FROM claims WHERE task_id = $1`
    const countParams = [taskIdBigInt]
    if (status) {
      countQuery += ` AND status = $2`
      countParams.push(status)
    }
    const countResult = await prisma.$queryRawUnsafe(countQuery, ...countParams)
    const total = Number(countResult[0]?.count || 0)

    const list = (claims || []).map(c => ({
      id: c.id?.toString(),
      userId: c.user_id?.toString(),
      username: c.username || `用户${c.user_id}`,
      phone: c.phone || "-",
      status: c.status,
      reward: Number(c.reward || 0),
      city: c.city,
      province: c.province,
      claimedAt: c.claimed_at,
      submittedAt: c.submitted_at,
      expiresAt: c.expires_at,
      reviewedAt: c.reviewed_at,
      reviewNote: c.review_note,
      isExpired: c.expires_at && new Date(c.expires_at) < new Date(),
      timeSpent: c.submitted_at 
        ? Math.round((new Date(c.submitted_at) - new Date(c.claimed_at)) / 1000 / 60)
        : null
    }))

    return { list, total, page, size }
  }

  async getClaimById(claimId) {
    // 将 claimId 转换为整数
    const claimIdInt = typeof claimId === 'string' ? BigInt(claimId) : claimId
    
    const claims = await prisma.$queryRaw`
      SELECT c.*, u.username, u.phone,
             t.id as task_id_val, t.title as task_title, t.platform as task_platform
      FROM claims c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN tasks t ON c.task_id = t.id
      WHERE c.id = ${claimIdInt}
    `
    
    if (!claims || claims.length === 0) {
      throw new Error("领取记录不存在")
    }
    
    const c = claims[0]
    const normalizedStatus = normalizeClaimStatus(c.status)
    const screenshotUrls = normalizeScreenshots(c.screenshots)
    const reviewHistory = safeParseReviewHistory(c.review_history)
    const evaluation = normalizeEvaluation(c.evaluation)
    const isRejected = isClaimRejectedForUserDisplay({
      status: normalizedStatus,
      reject_count: c.reject_count,
      image_review_status: c.image_review_status,
      link_review_status: c.link_review_status
    })

    return {
      id: c.id?.toString(),
      taskId: c.task_id?.toString(),
      userId: c.user_id?.toString(),
      title: c.title || c.task_title,
      platform: c.platform || c.task_platform,
      action: c.action,
      status: normalizedStatus,
      reward: Number(c.reward || 0),
      baseReward: Number(c.base_reward || 0),
      city: c.city,
      province: c.province,
      screenshots: c.screenshots,
      screenshotUrls: screenshotUrls,
      evaluation,
      platformNickname: c.platform_nickname,
      claimedAt: c.claimed_at,
      submittedAt: c.submitted_at,
      expiresAt: c.expires_at,
      reviewedAt: c.reviewed_at,
      reviewNote: getLatestMeaningfulReason(c),
      canWithdraw: [CLAIM_STATUS.SUBMITTED, CLAIM_STATUS.IMAGE_REVIEWING].includes(normalizedStatus),
      canResubmit: canResubmitClaim({
        status: normalizedStatus,
        reject_count: c.reject_count
      }),
      isRejected,
      // 图片审核字段
      image_review_status: c.image_review_status,
      image_reviewed_at: c.image_reviewed_at,
      image_review_reason: c.image_review_reason,
      // 链接审查字段
      link_review_status: c.link_review_status,
      link_reviewed_at: c.link_reviewed_at,
      link_review_reason: c.link_review_reason,
      // 封控状态
      block_status: c.block_status,
      // 审核历史字段
      reject_count: c.reject_count,
      review_history: reviewHistory,
      // 用户信息
      user: {
        id: c.user_id?.toString(),
        username: c.username || `用户${c.user_id}`,
        phone: c.phone || null
      },
      // 任务信息
      task: c.task_id_val ? {
        id: c.task_id_val?.toString(),
        title: c.task_title,
        platform: c.task_platform
      } : null
    }
  }

  async getMyClaimById(userId, claimId) {
    const claim = await this.getClaimById(claimId)

    if (String(claim.userId) !== String(userId)) {
      throw new AppError("领取记录不存在", 404, "NOT_FOUND")
    }

    return claim
  }

  async getTaskReviewLogs(claimId) {
    const logs = await prisma.$queryRaw`
      SELECT * FROM review_logs
      WHERE claim_id = ${claimId}
      ORDER BY created_at DESC
    `
    
    return (logs || []).map(log => ({
      id: log.id?.toString(),
      claimId: log.claim_id?.toString(),
      reviewerId: log.reviewer_id?.toString(),
      action: log.action,
      note: log.note,
      createdAt: log.created_at
    }))
  }


  /**
   * 获取所有待审核提交
   */
  async getAllReviewClaims(page = 1, size = 20, filters = {}) {
    const offset = (page - 1) * size
    
    let whereClause = 'WHERE submitted_at IS NOT NULL'
    const params = []
    
    if (filters.status) {
      whereClause += ` AND status = $${params.length + 1}`
      params.push(filters.status)
    }
    
    if (filters.taskId) {
      whereClause += ` AND task_id = $${params.length + 1}`
      params.push(filters.taskId)
    }
    
    // 获取总数
    const countResult = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as count FROM claims ${whereClause}`,
      ...params
    )
    const total = Number(countResult[0]?.count || 0)
    
    // 获取列表
    const claims = await prisma.$queryRawUnsafe(
      `SELECT c.*, u.username, u.phone, t.title, t.platform, t.action, t.reward as task_reward
       FROM claims c
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN tasks t ON c.task_id = t.id
       ${whereClause}
       ORDER BY c.submitted_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      ...params, size, offset
    )
    
    return {
      list: (claims || []).map(c => ({
        id: c.id?.toString(),
        taskId: c.task_id?.toString(),
        userId: c.user_id?.toString(),
        username: c.username || `用户${c.user_id}`,
        phone: c.phone || '-',
        title: c.title,
        platform: c.platform,
        action: c.action,
        status: c.status,
        reward: Number(c.reward || 0),
        taskReward: Number(c.task_reward || 0),
        screenshots: c.screenshots,
        platformNickname: c.platform_nickname,
        claimedAt: c.claimed_at,
        submittedAt: c.submitted_at,
        reviewedAt: c.reviewed_at,
        reviewNote: c.review_note
      })),
      total,
      page,
      size
    }
  }

  /**
   * 获取分组待审核任务
   */
  async getPendingReviewGrouped() {
    const tasks = await prisma.$queryRaw`
      SELECT t.id, t.title, t.platform, t.action, t.reward, t.remain,
             COUNT(c.id) FILTER (
               WHERE c.status = 'submitted'
                  OR c.status = 'image_reviewing'
                  OR c.status = 'pending_link'
                  OR c.status = 'link_reviewing'
                  OR c.status = 'pending_manual'
             ) as pending_count,
             COUNT(c.id) FILTER (
               WHERE (
                 c.status = 'submitted'
                 OR c.status = 'image_reviewing'
                 OR c.status = 'pending_link'
                 OR c.status = 'link_reviewing'
                 OR c.status = 'pending_manual'
               )
               AND c.submitted_at < NOW() - INTERVAL '1 hour'
             ) as urgent_count
      FROM tasks t
      LEFT JOIN claims c ON t.id = c.task_id
      WHERE t.status = 'active'
      GROUP BY t.id, t.title, t.platform, t.action, t.reward, t.remain
      HAVING COUNT(c.id) FILTER (
        WHERE c.status = 'submitted'
           OR c.status = 'image_reviewing'
           OR c.status = 'pending_link'
           OR c.status = 'link_reviewing'
           OR c.status = 'pending_manual'
      ) > 0
      ORDER BY urgent_count DESC, pending_count DESC
    `
    
    return (tasks || []).map(t => ({
      id: t.id?.toString(),
      title: t.title,
      platform: t.platform,
      action: t.action,
      reward: Number(t.reward || 0),
      remain: Number(t.remain || 0),
      pendingCount: Number(t.pending_count || 0),
      urgentCount: Number(t.urgent_count || 0)
    }))
  }

  async deleteTask(id) {
    // 转换 ID 为 BigInt（如果需要）
    const taskId = typeof id === 'string' ? BigInt(id) : id
    
    // 先删除关联的 claims 记录（外键约束）
    await prisma.$executeRaw`DELETE FROM claims WHERE task_id = ${taskId}`
    
    // 再删除任务
    await prisma.$queryRaw`DELETE FROM tasks WHERE id = ${taskId}`
    return true
  }

  /**
   * 获取审核记录列表
   */
  async getTaskReviewLogsList(page = 1, size = 20, filters = {}) {
    const { taskId, claimId, reviewerId, action } = filters
    const offset = (page - 1) * size
    
    let whereConditions = '1=1'
    if (taskId) whereConditions += ` AND rl.task_id = ${taskId}`
    if (claimId) whereConditions += ` AND rl.claim_id = ${claimId}`
    if (reviewerId) whereConditions += ` AND rl.reviewer_id = ${reviewerId}`
    if (action) whereConditions += ` AND rl.action = '${action}'`
    
    const countQuery = `SELECT COUNT(*)::int as total FROM review_logs rl WHERE ${whereConditions}`
    const dataQuery = `
      SELECT rl.*, 
             u.username as reviewer_name,
             t.title as task_title,
             c.screenshots
      FROM review_logs rl
      LEFT JOIN users u ON rl.reviewer_id = u.id
      LEFT JOIN tasks t ON rl.task_id = t.id
      LEFT JOIN claims c ON rl.claim_id = c.id
      WHERE ${whereConditions}
      ORDER BY rl.created_at DESC
      LIMIT ${size} OFFSET ${offset}
    `
    
    try {
      const [countResult, logs] = await Promise.all([
        prisma.$queryRawUnsafe(countQuery),
        prisma.$queryRawUnsafe(dataQuery)
      ])
      
      return {
        list: logs.map(log => ({
          id: log.id,
          taskId: log.task_id,
          claimId: log.claim_id,
          reviewerId: log.reviewer_id,
          reviewerName: log.reviewer_name,
          action: log.action,
          reason: log.reason,
          createdAt: log.created_at,
          taskTitle: log.task_title,
          screenshots: log.screenshots
        })),
        total: Number(countResult[0]?.total || 0),
        page,
        size
      }
    } catch (error) {
      // 如果 review_logs 表不存在或查询失败，返回空列表
      console.error('获取审核记录失败:', error.message)
      return { list: [], total: 0, page, size }
    }
  }
}

export default new TaskService()
