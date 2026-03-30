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
import { cache } from "../utils/redis.js"
import logger from "../utils/logger.js"
import { AppError } from "../middlewares/errorHandler.js"

const CONFIG_CACHE_KEY = "sys:config"
const CONFIG_CACHE_TTL = 300

// 状态常量
const CLAIM_STATUS = {
  DOING: "doing",
  SUBMITTED: "submitted",
  IMAGE_REVIEWING: "image_reviewing",
  IMAGE_FAILED: "image_failed",
  LINK_REVIEWING: "link_reviewing",
  PENDING_MANUAL: "pending_manual",
  DONE: "done",
  REJECTED: "rejected",
  EXPIRED: "expired",
  ABANDONED: "abandoned"
}

class TaskService {
  async getConfig() {
    if (cache.isReady()) {
      const cached = await cache.get(CONFIG_CACHE_KEY)
      if (cached) return cached
    }

    const configs = await prisma.$queryRaw`SELECT * FROM configs`
    const configMap = {}
    for (const c of (configs || [])) {
      configMap[c.key] = c.value
    }

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

    return (tasks || []).map(t => ({
      id: t.id.toString(),
      title: t.title,
      platform: t.platform,
      action: t.action,
      description: t.description,
      reward: Number(t.reward || 0),
      remain: Number(t.remain || 0),
      timeLimitMinutes: Number(t.time_limit_minutes || 15),
      status: t.status
    }))
  }

  async getTaskById(id, userId = null) {
    const taskId = typeof id === 'string' ? BigInt(id) : id
    const tasks = await prisma.$queryRaw`SELECT * FROM tasks WHERE id = ${taskId}`
    if (!tasks || tasks.length === 0) return null
    const t = tasks[0]
    
    // 检查用户是否已领取此任务
    let isClaimed = false
    let myClaimId = null
    if (userId) {
      const uid = typeof userId === 'string' ? BigInt(userId) : userId
      const claims = await prisma.$queryRaw`
        SELECT id FROM claims WHERE task_id = ${taskId} AND user_id = ${uid} AND status IN ('doing', 'submitted', 'done')
      `
      isClaimed = claims && claims.length > 0
      if (isClaimed) {
        myClaimId = claims[0].id.toString()
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
      isClaimed,
      myClaimId
    }
  }

  async getMyTasks(userId) {
    // 转换用户ID为整数
    const uid = typeof userId === "string" ? parseInt(userId, 10) : userId
    
    const claims = await prisma.$queryRaw`
      SELECT c.*, t.title, t.platform, t.action, t.reward
      FROM claims c
      JOIN tasks t ON c.task_id = t.id
      WHERE c.user_id = ${uid}
      AND c.status IN (${CLAIM_STATUS.DOING}, ${CLAIM_STATUS.SUBMITTED}, ${CLAIM_STATUS.DONE})
      ORDER BY c.claimed_at DESC
    `

    return (claims || []).map(c => ({
      id: c.id.toString(),
      taskId: c.task_id?.toString(),
      title: c.title,
      platform: c.platform,
      status: c.status,
      reward: Number(c.reward || 0),
      claimedAt: c.claimed_at,
      expiresAt: c.expires_at
    }))
  }

  /**
   * 领取任务
   */
  async claimTask(userId, taskId, geo = {}) {
    const uid = typeof userId === "string" ? BigInt(userId) : userId
    const tid = typeof taskId === "string" ? BigInt(taskId) : taskId
    const { city, province, lat, lng } = geo

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

    // 3. 检查余量
    if (Number(task.remain) <= 0) {
      throw new AppError("任务已被抢完", 400, "BAD_REQUEST")
    }

    // 4. 检查用户是否已领取
    const existingClaims = await prisma.$queryRaw`
      SELECT id FROM claims 
      WHERE task_id = ${tid} AND user_id = ${uid} 
      AND status IN (${CLAIM_STATUS.DOING}, ${CLAIM_STATUS.SUBMITTED}, ${CLAIM_STATUS.DONE})
    `
    if (existingClaims && existingClaims.length > 0) {
      throw new AppError("您已领取过此任务", 400, "BAD_REQUEST")
    }

    // 5. 获取配置
    const config = await this.getConfig()

    // 6. 检查用户当前进行中的任务数量
    const activeCountResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM claims 
      WHERE user_id = ${uid} AND status = ${CLAIM_STATUS.DOING}
    `
    const activeCount = Number(activeCountResult[0]?.count || 0)
    if (activeCount >= config.maxActiveTasksPerUser) {
      throw new Error(`您有${activeCount}个任务正在进行中，请先完成后再领取新任务`)
    }

    // 7. 检查城市限制
    if (task.city_limit > 0 && city) {
      const cityCountResult = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM claims 
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
        SELECT COUNT(*) as count FROM claims 
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

    // 12. 更新任务余量
    await prisma.$queryRaw`
      UPDATE tasks SET remain = remain - 1 WHERE id = ${tid}
    `

    logger.info(`用户 ${userId} 领取任务 ${taskId} 成功, claimId: ${claimId}`)

    return {
      claimId,
      taskId: taskId.toString(),
      title: task.title,
      reward: finalReward,
      timeLimitMinutes,
      expiresAt
    }
  }

  /**
   * 提交任务
   */
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
    
    // 2. 检查状态
    if (claim.status !== CLAIM_STATUS.DOING) {
      throw new AppError(`任务状态不正确: ${claim.status}`, 400, "BAD_REQUEST")
    }
    
    // 3. 检查是否过期
    if (claim.expires_at && new Date(claim.expires_at) < new Date()) {
      throw new AppError("任务已过期", 400, "BAD_REQUEST")
    }
    
    // 4. 更新领取记录
    await prisma.$queryRaw`
      UPDATE claims SET
        status = ${CLAIM_STATUS.SUBMITTED},
        platform_nickname = ${platformNickname || null},
        screenshots = ${JSON.stringify(screenshots)}::jsonb,
        evaluation = ${evaluation || null},
        submitted_at = NOW()
      WHERE id = ${cid}
    `
    
    logger.info(`用户 ${userId} 提交任务成功, claimId: ${claimId}`)
    
    // 5. 入队到审核队列 (使用 Supabase 队列)
    try {
      const { enqueueReview } = await import('./ai/queueService.js')
      await enqueueReview(Number(claimId))
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
    
    // 2. 只有 submitted 状态才能撤回
    if (claim.status !== CLAIM_STATUS.SUBMITTED) {
      throw new AppError("当前状态不允许撤回", 400, "BAD_REQUEST")
    }
    
    // 3. 更新状态
    await prisma.$queryRaw`
      UPDATE claims SET
        status = ${CLAIM_STATUS.DOING},
        submitted_at = NULL
      WHERE id = ${cid}
    `
    
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
    if (claim.status === CLAIM_STATUS.SUBMITTED || claim.status === CLAIM_STATUS.DONE) {
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
        COUNT(*) FILTER (WHERE status = ${CLAIM_STATUS.SUBMITTED}) as pending,
        COUNT(*) FILTER (WHERE status = ${CLAIM_STATUS.DONE}) as approved,
        COUNT(*) FILTER (WHERE status = ${CLAIM_STATUS.REJECTED}) as rejected
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
          COUNT(*) FILTER (WHERE status = ${CLAIM_STATUS.DONE}) as done_count,
          COUNT(*) FILTER (WHERE status = ${CLAIM_STATUS.REJECTED}) as rejected_count,
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
        pendingCount: Number(stat.submitted_count || 0),
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
        COUNT(*) FILTER (WHERE status = "active") as active_tasks,
        COUNT(*) FILTER (WHERE status = "inactive") as inactive_tasks,
        SUM(remain) as total_remain,
        SUM(need_count) as total_need
      FROM tasks
    `
    
    const claimStats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_claims,
        COUNT(*) FILTER (WHERE status = ${CLAIM_STATUS.SUBMITTED}) as pending_review,
        COUNT(*) FILTER (WHERE status = ${CLAIM_STATUS.DONE}) as completed,
        SUM(reward) FILTER (WHERE status = ${CLAIM_STATUS.DONE}) as total_reward
      FROM claims
    `
    
    return {
      tasks: {
        total: Number(stats[0]?.total_tasks || 0),
        active: Number(stats[0]?.active_tasks || 0),
        inactive: Number(stats[0]?.inactive_tasks || 0),
        totalRemain: Number(stats[0]?.total_remain || 0),
        totalNeed: Number(stats[0]?.total_need || 0)
      },
      claims: {
        total: Number(claimStats[0]?.total_claims || 0),
        pendingReview: Number(claimStats[0]?.pending_review || 0),
        completed: Number(claimStats[0]?.completed || 0),
        totalReward: Number(claimStats[0]?.total_reward || 0)
      }
    }
  }

  async getTodayStats() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const stats = await prisma.$queryRaw`
      SELECT 
        (SELECT COUNT(*) FROM tasks WHERE created_at >= ${today}) as today_tasks,
        (SELECT COUNT(*) FROM claims WHERE claimed_at >= ${today}) as today_claims,
        (SELECT COUNT(*) FROM claims WHERE submitted_at >= ${today}) as today_submissions,
        (SELECT COUNT(*) FROM claims WHERE reviewed_at >= ${today} AND status = ${CLAIM_STATUS.DONE}) as today_approved
    `
    
    return {
      todayTasks: Number(stats[0]?.today_tasks || 0),
      todayClaims: Number(stats[0]?.today_claims || 0),
      todaySubmissions: Number(stats[0]?.today_submissions || 0),
      todayApproved: Number(stats[0]?.today_approved || 0)
    }
  }

  async getTaskStats(taskId) {
    // 确保 taskId 是整数类型
    const taskIdInt = typeof taskId === "string" ? parseInt(taskId, 10) : taskId;
    
    const tasks = await prisma.$queryRaw`
      SELECT * FROM tasks WHERE id = ${taskIdInt}
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
        COUNT(*) FILTER (WHERE status = ${CLAIM_STATUS.DOING}) as doing_count,
        COUNT(*) FILTER (WHERE status = ${CLAIM_STATUS.DONE}) as done_count,
        COUNT(*) FILTER (WHERE status = ${CLAIM_STATUS.REJECTED}) as rejected_count,
        COUNT(*) FILTER (WHERE status = ${CLAIM_STATUS.EXPIRED}) as expired_count
      FROM claims
      WHERE task_id = ${taskIdInt}
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
        pendingCount: submittedCount,
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
    const taskIdInt = typeof taskId === "string" ? parseInt(taskId, 10) : taskId;

    const tasks = await prisma.$queryRaw`
      SELECT id, title FROM tasks WHERE id = ${taskIdInt}
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
    const params = [taskIdInt]
    
    if (status) {
      claimsQuery += ` AND c.status = $${params.length + 1}`
      params.push(status)
    }
    
    claimsQuery += ` ORDER BY c.claimed_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(size, offset)

    const claims = await prisma.$queryRawUnsafe(claimsQuery, ...params)

    let countQuery = `SELECT COUNT(*) as count FROM claims WHERE task_id = $1`
    const countParams = [taskIdInt]
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
    const claims = await prisma.$queryRaw`
      SELECT c.*, u.username, u.phone
      FROM claims c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = ${claimId}
    `
    
    if (!claims || claims.length === 0) {
      throw new Error("领取记录不存在")
    }
    
    const c = claims[0]
    return {
      id: c.id?.toString(),
      taskId: c.task_id?.toString(),
      userId: c.user_id?.toString(),
      username: c.username || `用户${c.user_id}`,
      phone: c.phone || "-",
      status: c.status,
      reward: Number(c.reward || 0),
      city: c.city,
      province: c.province,
      screenshots: c.screenshots,
      evaluation: c.evaluation,
      platformNickname: c.platform_nickname,
      claimedAt: c.claimed_at,
      submittedAt: c.submitted_at,
      expiresAt: c.expires_at,
      reviewedAt: c.reviewed_at,
      reviewNote: c.review_note
    }
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

  async deleteTask(id) {
    await prisma.$queryRaw`DELETE FROM tasks WHERE id = ${id}`
    return true
  }
}

export default new TaskService()
