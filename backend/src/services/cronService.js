import cron from 'node-cron'
import { Queue } from 'bullmq'
import leaderboardSnapshotService from './leaderboardSnapshotService.js'
import userService from './userService.js'
import pointsRewardService from './pointsRewardService.js'
import alertService from './alertService.js'
import businessMonitorService from './businessMonitorService.js'
import logger from '../utils/logger.js'
import alertEngine from './alertEngine.js'
import redisConnection from '../config/queue.js'
import db from '../config/database.js'
import { CLAIM_STATUS } from '../constants/claimLifecycle.js'

const linkDelayQueue = new Queue('link-delay-queue', { connection: redisConnection })
const linkVerifyQueue = new Queue('link-verify-queue', { connection: redisConnection })

async function getLinkPipelineSnapshot() {
  const [
    delayWaiting,
    delayDelayed,
    delayActive,
    reviewWaiting,
    reviewDelayed,
    reviewActive,
    claimStats
  ] = await Promise.all([
    linkDelayQueue.getWaitingCount(),
    linkDelayQueue.getDelayedCount(),
    linkDelayQueue.getActiveCount(),
    linkVerifyQueue.getWaitingCount(),
    linkVerifyQueue.getDelayedCount(),
    linkVerifyQueue.getActiveCount(),
    db.queryOne(
      `
      SELECT
        COUNT(*) FILTER (WHERE status = $1)::int AS pending_link,
        COUNT(*) FILTER (WHERE status = $2)::int AS link_reviewing,
        COUNT(*) FILTER (WHERE status = $3)::int AS pending_manual
      FROM claims
      `,
      [
        CLAIM_STATUS.PENDING_LINK,
        CLAIM_STATUS.LINK_REVIEWING,
        CLAIM_STATUS.PENDING_MANUAL
      ]
    )
  ])

  return {
    mode: 'bullmq_pipeline',
    delayQueue: {
      waiting: delayWaiting,
      delayed: delayDelayed,
      active: delayActive
    },
    reviewQueue: {
      waiting: reviewWaiting,
      delayed: reviewDelayed,
      active: reviewActive
    },
    claims: {
      pendingLink: Number(claimStats?.pending_link || 0),
      linkReviewing: Number(claimStats?.link_reviewing || 0),
      pendingManual: Number(claimStats?.pending_manual || 0)
    }
  }
}

/**
 * 定时任务服务
 * 管理所有定时任务的启动和停止
 */
class CronService {
  constructor() {
    this.jobs = []
    this.isRunning = false
  }
  
  /**
   * 启动所有定时任务
   */
  async start() {
    if (this.isRunning) {
      logger.warn('定时任务服务已在运行中')
      return
    }
    
    // 每周一 00:05 生成上周周榜快照
    const weeklyJob = cron.schedule('5 0 * * 1', async () => {
      logger.info('开始执行周榜快照任务')
      try {
        await leaderboardSnapshotService.generateWeeklySnapshot()
        logger.info('周榜快照任务执行完成')
      } catch (err) {
        logger.error('周榜快照任务执行失败:', err)
      }
    }, { scheduled: true, timezone: 'Asia/Shanghai' })
    
    // 每月1日 00:10 生成上月月榜快照
    const monthlyJob = cron.schedule('10 0 1 * *', async () => {
      logger.info('开始执行月榜快照任务')
      try {
        await leaderboardSnapshotService.generateMonthlySnapshot()
        logger.info('月榜快照任务执行完成')
      } catch (err) {
        logger.error('月榜快照任务执行失败:', err)
      }
    }, { scheduled: true, timezone: 'Asia/Shanghai' })
    
    // 每小时检查注册奖励解冻
    const bonusUnlockJob = cron.schedule('0 */6 * * *', async () => {
      logger.info('开始执行注册奖励解冻检查')
      try {
        await userService.processScheduledUnlocks()
        logger.info('注册奖励解冻检查完成')
      } catch (err) {
        logger.error('注册奖励解冻检查失败:', err)
      }
    }, { scheduled: true, timezone: 'Asia/Shanghai' })
    
// DISABLED:     // AI审核定时轮询任务（可配置间隔）
// DISABLED:     const aiReviewPollJob = cron.schedule('*/5 * * * *', async () => {
// DISABLED:       try {
// DISABLED:         await this.pollAIReviewQueue()
// DISABLED:       } catch (err) {
// DISABLED:         logger.error('AI审核轮询失败:', err)
// DISABLED:       }
// DISABLED:     }, { scheduled: true, timezone: 'Asia/Shanghai' })
    
    // 每小时检查积分异常（5分时执行）
    const pointsAnomalyJob = cron.schedule('5 * * * *', async () => {
      logger.info('开始执行积分异常检测')
      try {
        const result = await pointsRewardService.detectAnomalies()
        if (result.anomalies && result.anomalies.length > 0) {
          for (const anomaly of result.anomalies) {
            await alertService.createAlert({
              type: 'points_anomaly',
              severity: anomaly.severity,
              title: `积分异常：${anomaly.type}`,
              message: anomaly.description,
              data: anomaly
            })
          }
          logger.info(`积分异常检测完成：发现 ${result.anomalies.length} 个异常`)
        } else {
          logger.info('积分异常检测完成：未发现异常')
        }
      } catch (err) {
        logger.error('积分异常检测失败:', err)
      }
    }, { scheduled: true, timezone: 'Asia/Shanghai' })
    
    // 每天凌晨2点 - 图片归档压缩任务
    const imageArchiveJob = cron.schedule('0 2 * * *', async () => {
      logger.info('开始执行图片归档压缩任务')
      try {
        const { runArchiveJob } = await import('../jobs/imageArchiveJob.js')
        const result = await runArchiveJob()
        logger.info(`图片归档压缩完成: ${result.archivedCount} 张`)
      } catch (err) {
        logger.error('图片归档压缩任务失败:', err)
      }
    }, { scheduled: true, timezone: 'Asia/Shanghai' })
    
    // 每天凌晨3点 - 图片清理任务
    const imageCleanupJob = cron.schedule('0 3 * * *', async () => {
      logger.info('开始执行图片清理任务')
      try {
        const { runCleanupJob } = await import('../jobs/imageCleanupJob.js')
        const result = await runCleanupJob()
        logger.info(`图片清理完成: 删除 ${result.totalFiles} 个文件`)
      } catch (err) {
        logger.error('图片清理任务失败:', err)
      }
    }, { scheduled: true, timezone: 'Asia/Shanghai' })
    
    // 连接审核流水观测任务（每5分钟执行）
    const linkVerifyJob = cron.schedule('*/5 * * * *', async () => {
      try {
        const snapshot = await getLinkPipelineSnapshot()
        const hasBufferedWork =
          snapshot.delayQueue.waiting > 0 ||
          snapshot.delayQueue.delayed > 0 ||
          snapshot.delayQueue.active > 0 ||
          snapshot.reviewQueue.waiting > 0 ||
          snapshot.reviewQueue.delayed > 0 ||
          snapshot.reviewQueue.active > 0 ||
          snapshot.claims.pendingLink > 0 ||
          snapshot.claims.linkReviewing > 0 ||
          snapshot.claims.pendingManual > 0

        if (hasBufferedWork) {
          logger.info(
            `连接审核流水状态: delay(wait=${snapshot.delayQueue.waiting}, delayed=${snapshot.delayQueue.delayed}, active=${snapshot.delayQueue.active}), ` +
            `review(wait=${snapshot.reviewQueue.waiting}, delayed=${snapshot.reviewQueue.delayed}, active=${snapshot.reviewQueue.active}), ` +
            `claims(pending_link=${snapshot.claims.pendingLink}, reviewing=${snapshot.claims.linkReviewing}, manual=${snapshot.claims.pendingManual})`
          )
        }
      } catch (err) {
        logger.error('连接审核流水观测失败:', err)
      }
    }, { scheduled: true, timezone: 'Asia/Shanghai' })

    // 业务监控定时任务（每10分钟执行）
    const businessMonitorJob = cron.schedule('*/10 * * * *', async () => {
      try {
        const result = await businessMonitorService.runAllChecks()
        if (result.alertCount > 0) {
          logger.info(`[业务监控] 发现 ${result.alertCount} 个告警`)
        }
      } catch (err) {
        logger.error('业务监控任务失败:', err)
      }
    }, { scheduled: true, timezone: 'Asia/Shanghai' })

    
    this.jobs = [weeklyJob, monthlyJob, bonusUnlockJob, /* DISABLED: aiReviewPollJob */, pointsAnomalyJob, imageArchiveJob, imageCleanupJob, linkVerifyJob, businessMonitorJob]
    this.isRunning = true
    
    logger.info('定时任务服务已启动')
    logger.info('- 周榜快照: 每周一 00:05')
    logger.info('- 月榜快照: 每月1日 00:10')
    logger.info('- 注册奖励解冻: 每小时')
    // DISABLED: logger.info('- AI审核轮询: 每分钟检查')
    logger.info('- 积分异常检测: 每小时05分')
    logger.info('- 图片归档压缩: 每天凌晨02:00')
    logger.info('- 图片清理: 每天凌晨03:00')
    logger.info('- 连接审核流水观测: 每5分钟')
    logger.info('- 业务监控: 每10分钟')
  }
  
  stop() {
    this.jobs.forEach(job => job.stop())
    this.jobs = []
    this.isRunning = false
    logger.info('定时任务服务已停止')
  }
  
  async pollAIReviewQueue({ force = false } = {}) {
    const { getConfig } = await import('./ai/configService.js')
    const { enqueueReview } = await import('./ai/queueService.js')
    
    const aiReviewEnabled = await getConfig('ai_review_enabled', 'true')
    if (aiReviewEnabled !== 'true' && aiReviewEnabled !== true) {
      return { skipped: true, reason: 'AI审核已禁用', queued: 0 }
    }

    const triggerMode = await getConfig('ai_review_trigger_mode', 'realtime')
    if (!force && triggerMode !== 'scheduled') {
      return { skipped: true, reason: `当前触发模式为 ${triggerMode}`, queued: 0 }
    }

    const pendingClaims = await db.query(
      `
      SELECT c.id
      FROM claims c
      LEFT JOIN ai_review_queue q
        ON q.claim_id = c.id
       AND q.status IN ('pending', 'processing')
      WHERE c.status IN ($1, $2)
        AND COALESCE(c.ai_review_status, 'pending') IN ('pending', 'processing')
        AND q.id IS NULL
      ORDER BY c.submitted_at ASC NULLS LAST, c.id ASC
      LIMIT 20
      `,
      [CLAIM_STATUS.SUBMITTED, CLAIM_STATUS.IMAGE_REVIEWING]
    )

    if (!pendingClaims || pendingClaims.length === 0) {
      return { queued: 0, claimIds: [], message: '没有需要补偿入队的审核任务' }
    }

    let queued = 0
    const claimIds = []
    for (const claim of pendingClaims) {
      try {
        await enqueueReview(claim.id)
        queued += 1
        claimIds.push(String(claim.id))
      } catch (err) {
        logger.error('入队失败 claimId=' + claim.id + ':', err)
      }
    }

    if (queued > 0) {
      logger.info(`AI审核补偿入队完成: ${queued}/${pendingClaims.length}`)
    }

    return {
      queued,
      claimIds,
      scanned: pendingClaims.length,
      forced: force
    }
  }
  async triggerWeeklySnapshot() {
    logger.info('手动触发周榜快照')
    return leaderboardSnapshotService.generateWeeklySnapshot()
  }
  
  async triggerMonthlySnapshot() {
    logger.info('手动触发月榜快照')
    return leaderboardSnapshotService.generateMonthlySnapshot()
  }
  
  async triggerAIReviewPoll() {
    logger.info('手动触发AI审核轮询')
    return this.pollAIReviewQueue({ force: true })
  }
  
  /**
   * 手动触发图片归档任务
   */
  async triggerImageArchive() {
    logger.info('手动触发图片归档任务')
    const { runArchiveJob } = await import('../jobs/imageArchiveJob.js')
    return runArchiveJob()
  }
  
  /**
   * 手动触发图片清理任务
   */
  async triggerImageCleanup() {
    logger.info('手动触发图片清理任务')
    const { runCleanupJob } = await import('../jobs/imageCleanupJob.js')
    return runCleanupJob()
  }
  
  /**
   * 手动查看连接审核流水状态
   */
  async triggerLinkVerify() {
    logger.info('手动查看连接审核流水状态')
    return getLinkPipelineSnapshot()
  }
  

  // 立即执行健康检查（服务启动时调用）
  async _immediateHealthCheck(webSocketService) {
    try {
      logger.info("[HEALTH] 执行启动时健康检查...")
      const axios = (await import("axios")).default
      const checks = await Promise.allSettled([
        axios.get("http://127.0.0.1:9001/health", { timeout: 5000 }).then(() => true).catch(() => false),
        axios.get("http://127.0.0.1:9002/health", { timeout: 5000 }).then(() => true).catch(() => false),
        axios.get("http://127.0.0.1:8003/health", { timeout: 5000 }).then(() => true).catch(() => false),
        axios.get("http://127.0.0.1:8000/", { timeout: 5000 }).then(r => r.data && r.data.status === "ok").catch(() => false),
        axios.get("http://127.0.0.1:8001/", { timeout: 5000 }).then(r => r.data && r.data.status === "ok").catch(() => false),
        axios.get("http://127.0.0.1:8002/", { timeout: 5000 }).then(r => r.data && r.data.status === "ok").catch(() => false)
      ])
      const gv = (r) => r.status === "fulfilled" ? r.value : false
      const health = {
        ocr: [{ port: 9001, healthy: gv(checks[0]) }, { port: 9002, healthy: gv(checks[1]) }],
        yolo: { port: 8003, healthy: gv(checks[2]) },
        browser: [{ port: 8000, healthy: gv(checks[3]) }, { port: 8001, healthy: gv(checks[4]) }, { port: 8002, healthy: gv(checks[5]) }],
        timestamp: Date.now()
      }
      webSocketService.broadcastServiceHealth(health)
      logger.info("[HEALTH] 启动时健康检查完成，状态已缓存")
    } catch (err) {
      logger.error("[HEALTH] 启动时健康检查失败:", err)
    }
  }

  startStatsBroadcast(webSocketService) {
    this._ws = webSocketService

    // 启动时立即执行一次健康检查
    this._immediateHealthCheck(webSocketService)

    const statsJob = cron.schedule("*/10 * * * * *", async () => {
      try {
        const { default: supabase } = await import("../utils/supabaseToPrismaAdapter.js")
        const today = new Date().toISOString().split("T")[0]
        const [taskRes, claimRes] = await Promise.all([
          supabase.from("tasks").select("*", { count: "exact", head: true }).gte("created_at", today),
          supabase.from("claims").select("*", { count: "exact", head: true }).gte("claimed_at", today)
        ])
        // 获取在线用户数
        const onlineUserService = (await import('./onlineUserService.js')).default
        const onlineUsers = await onlineUserService.getOnlineCount()
        
        // 清除缓存，确保前端获取最新数据
        const { getRedisClient } = await import('../utils/redis.js')
        const redisClient = await getRedisClient()
        if (redisClient) {
          await redisClient.del('admin:dashboard:stats')
        }
        
        await webSocketService.broadcastStatsUpdate({
          todayTasks: taskRes.count || 0,
          todayClaims: claimRes.count || 0,
          onlineUsers: onlineUsers || 0,
          timestamp: Date.now()
        })
      } catch (err) { logger.error("[STATS_JOB] 错误:", err) }
    }, { scheduled: true, timezone: "Asia/Shanghai" })

    const metricsJob = cron.schedule("*/15 * * * * *", async () => {
      try {
        const os = await import("os")
        const cpus = os.cpus()
        const cpuIdle = cpus.reduce((sum, c) => sum + c.times.idle, 0)
        const cpuTotal = cpus.reduce((sum, c) => sum + Object.values(c.times).reduce((a, b) => a + b, 0), 0)
        const cpuUsage = Math.round((1 - cpuIdle / cpuTotal) * 100)
        const totalMem = os.totalmem()
        const freeMem = os.freemem()
        const memUsage = Math.round(((totalMem - freeMem) / totalMem) * 100)
        const metrics = {
          cpu: cpuUsage,
          memory: memUsage,
          memoryUsed: Math.round((totalMem - freeMem) / 1024 / 1024),
          memoryTotal: Math.round(totalMem / 1024 / 1024),
          uptime: Math.round(os.uptime()),
          loadAvg: os.loadavg().map(v => Math.round(v * 100) / 100),
          wsClients: webSocketService.getClientCount ? webSocketService.getClientCount() : 0,
          timestamp: Date.now()
        }
        webSocketService.broadcastSystemMetrics(metrics)
        try { await alertEngine.evaluate(metrics) } catch (e) {}
      } catch (err) { logger.error("[STATS_JOB] 错误:", err) }
    }, { scheduled: true, timezone: "Asia/Shanghai" })

    const healthJob = cron.schedule("*/30 * * * * *", async () => {
      try {
        const axios = (await import("axios")).default
        const checks = await Promise.allSettled([
          axios.get("http://127.0.0.1:9001/health", { timeout: 3000 }).then(() => true).catch(() => false),
          axios.get("http://127.0.0.1:9002/health", { timeout: 3000 }).then(() => true).catch(() => false),
          axios.get("http://127.0.0.1:8003/health", { timeout: 3000 }).then(() => true).catch(() => false),
          axios.get("http://127.0.0.1:8000/", { timeout: 3000 }).then(r => r.data && r.data.status === "ok").catch(() => false),
          axios.get("http://127.0.0.1:8001/", { timeout: 3000 }).then(r => r.data && r.data.status === "ok").catch(() => false),
          axios.get("http://127.0.0.1:8002/", { timeout: 3000 }).then(r => r.data && r.data.status === "ok").catch(() => false)
        ])
        const gv = (r) => r.status === "fulfilled" ? r.value : false
        const health = {
          ocr: [{ port: 9001, healthy: gv(checks[0]) }, { port: 9002, healthy: gv(checks[1]) }],
          yolo: { port: 8003, healthy: gv(checks[2]) },
          browser: [{ port: 8000, healthy: gv(checks[3]) }, { port: 8001, healthy: gv(checks[4]) }, { port: 8002, healthy: gv(checks[5]) }],
          timestamp: Date.now()
        }
        webSocketService.broadcastServiceHealth(health)
        const alertMetrics = {
          services: {
            ocr: health.ocr.some(s => s.healthy),
            yolo: health.yolo.healthy,
            browser: health.browser.some(s => s.healthy)
          }
        }
        try { await alertEngine.evaluate(alertMetrics) } catch (e) {}
      } catch (err) { logger.error("[STATS_JOB] 错误:", err) }
    }, { scheduled: true, timezone: "Asia/Shanghai" })

    this.jobs.push(statsJob, metricsJob, healthJob)
    logger.info("实时监控推送已启动: 统计(10s) + 系统指标(15s) + 服务健康(30s)")
  }
}

export default new CronService()
