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
import db from "../config/database.js"
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
import {
  buildSubmissionScreenshotEntries,
  normalizeScreenshotEntries,
  normalizeScreenshotUrls,
} from "../utils/claimScreenshots.js"
import { normalizeSubmissionVersion } from "../utils/reviewQueueIds.js"
import {
  BUSINESS_TIME_ZONE,
  buildSettlementDisplay,
  calculatePointBreakdown,
  parseJsonObject,
  roundPoints,
  toSafeNumber,
} from "../utils/taskSettlement.js"

const CLAIM_COMPLETED_AT_SQL = `
  COALESCE(
    GREATEST(
      COALESCE(c.reviewed_at, c.image_reviewed_at, c.link_reviewed_at),
      COALESCE(c.image_reviewed_at, c.reviewed_at, c.link_reviewed_at),
      COALESCE(c.link_reviewed_at, c.reviewed_at, c.image_reviewed_at)
    ),
    c.reviewed_at,
    c.image_reviewed_at,
    c.link_reviewed_at
  )
`

const CONFIG_CACHE_KEY = "sys:config"
const CONFIG_CACHE_TTL = 300

const DEFAULT_TASK_TUTORIAL_CONFIG = {
  qualificationStandards: [
    '必有本任务的视频截图和评论截图',
    '视频截图已经有了点赞和收藏（只完成一个会不通过）',
    '评论截图必须是本人截图（一般在评论第一条，评论人名字后面带我标签）',
    '评论至少8个字。少字直接不通过',
    '评论内容要带有正向推荐，不要没有意义的灌水，并尽量与视频展示的产品有关联性，如不知道关联尽可能用中性词。',
  ],
  positiveCommentExamples: [
    '买了好几次了，也没有什么复做用，总的来说比较好',
    '真的不错，用了下次再来够买',
    '第一次用了这个产品，决定以后就买他们家的了',
    '好用，已回购，早点发货',
    '朋友推荐的没想到这么好用',
    '昨天收到了，试了一下，笑果真心不错，久违的感觉',
    '真实不需要评价，我用真管用',
    '试了，非常好拥，立马下了一单了',
    '来回购，比在國外买的墙多了',
    '朋友推荐的，好期待',
  ],
  commentLibrary: [
    '拍过好几种了，就这种还不错',
    '本来对这些东西就半信半疑，用了才知道，选对的比选贵的重要，不错!',
    '我一般不做评论，但你家的这个真好！[赞]',
    '二次会购了，不错哦，比市面上的强多了，满意！',
    '这个真的很好，也推荐过给我的朋友',
    '拍了一单回来试试，好用给你介绍朋友[呲牙]',
    '好多次回购了，很满意，真的太牛了。',
    '确实不错，已经回购几次了',
    '不错，物有所值[赞][赞][赞]',
    '买了好几次了，也没有复做用，总的来说比较好',
    '老婆之前拍过不搓值得推荐',
    '感觉很好👌价钱也合适又回购了😃好极了😘',
    '上次朋友推荐拍的，真的好用哦',
    '不错不错，值得入手',
    '又来回购了，牛[强][强]',
    '身边的朋友都在拥',
    '真的给力，媳妇很满意[玫瑰]',
  ],
  copyTip: '参考评论库：点击任意一条评论即可一键复制。复制后可直接粘贴到评论区，优先选择和视频产品更相关、语气自然、满足 8 个字以上的内容。',
}

async function getDefaultExampleImages() {
  const configMap = await getConfigValues(['example_image_1', 'example_image_2'])
  return [configMap.example_image_1, configMap.example_image_2].filter(Boolean)
}

async function resolveExampleImages(rawImages) {
  const parsed = typeof rawImages === 'string'
    ? parseJsonField(rawImages, [])
    : (rawImages || [])

  const normalized = Array.isArray(parsed) ? parsed.filter(Boolean) : []
  if (normalized.length) return normalized
  return getDefaultExampleImages()
}

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

function parseStringArrayConfig(rawValue, fallback) {
  const parsed = parseJsonField(rawValue, fallback)
  if (!Array.isArray(parsed)) return fallback
  return parsed
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

async function getTaskTutorialConfig() {
  const configMap = await getConfigValues([
    'task_tutorial_qualification_standards',
    'task_tutorial_positive_comment_examples',
    'task_tutorial_comment_library',
    'task_tutorial_copy_tip',
  ])

  return {
    qualificationStandards: parseStringArrayConfig(
      configMap.task_tutorial_qualification_standards,
      DEFAULT_TASK_TUTORIAL_CONFIG.qualificationStandards
    ),
    positiveCommentExamples: parseStringArrayConfig(
      configMap.task_tutorial_positive_comment_examples,
      DEFAULT_TASK_TUTORIAL_CONFIG.positiveCommentExamples
    ),
    commentLibrary: parseStringArrayConfig(
      configMap.task_tutorial_comment_library,
      DEFAULT_TASK_TUTORIAL_CONFIG.commentLibrary
    ),
    copyTip: (configMap.task_tutorial_copy_tip || DEFAULT_TASK_TUTORIAL_CONFIG.copyTip).trim(),
  }
}

function normalizeScreenshots(screenshots) {
  return normalizeScreenshotUrls(screenshots)
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
      'task_default_city_limit',
      'task_default_province_limit',
      'task_timeout_minutes',
      'max_concurrent_per_user',
      'city_limit_per_task',
      'province_limit_per_task',
      'platformRewardRatio',
      'levelRewardRatio',
      'basePointsPerTask',
      'example_image_1',
      'example_image_2',
    ])

    const config = {
      defaultTimeLimitMinutes: parseInt(configMap.defaultTimeLimitMinutes || configMap.task_timeout_minutes) || 15,
      maxActiveTasksPerUser: parseInt(configMap.maxActiveTasksPerUser || configMap.max_concurrent_per_user) || 3,
      cityLimitPerTask: parseInt(configMap.task_default_city_limit || configMap.city_limit_per_task) || 1,
      provinceLimitPerTask: parseInt(configMap.task_default_province_limit || configMap.province_limit_per_task) || 4,
      platformRewardRatio: parseFloat(configMap.platformRewardRatio) || 0.5,
      levelRewardRatio: parseFloat(configMap.levelRewardRatio) || 0.3,
      basePointsPerTask: parseInt(configMap.basePointsPerTask) || 10,
      exampleImages: [configMap.example_image_1, configMap.example_image_2].filter(Boolean),
    }

    if (cache.isReady()) {
      await cache.set(CONFIG_CACHE_KEY, config, CONFIG_CACHE_TTL)
    }

    return config
  }

  async buildNightRewardInfo(task, onlineUsers = null, options = {}) {
    const useListPreview = options.useListPreview === true
    const lockedSettlement = parseJsonObject(
      options.lockedSettlement ?? task?.settlement_snapshot,
      null
    )

    if (lockedSettlement?.basePoints) {
      const settled = buildSettlementDisplay(lockedSettlement, task)
      return {
        isNight: settled.isNight,
        coefficient: settled.coefficient,
        bonusPoints: settled.bonusPoints,
        estimatedReward: settled.finalPoints,
        finalPoints: settled.finalPoints,
        basePoints: settled.basePoints,
        extraRate: settled.extraRate,
        publishTime: lockedSettlement.taskPublishedAt || task?.created_at || task?.start_time || null,
        previewType: 'locked',
        businessTimezone: lockedSettlement.businessTimezone || BUSINESS_TIME_ZONE,
      }
    }

    try {
      const basePoints = toSafeNumber(task?.base_reward ?? task?.reward, 0)
      const publishTime = task?.created_at || task?.start_time || null
      const needCount = Math.max(1, Number(task?.need_count || 1))
      const remain = Math.max(0, Number(task?.remain || 0))
      const acceptedCount = Math.max(0, needCount - remain)
      const resolvedOnlineUsers =
        onlineUsers === null || onlineUsers === undefined
          ? (await onlineUserService.getOnlineCount()) ?? 0
          : onlineUsers

      const result = useListPreview
        ? await nightPointService.calculateCoefficient(
            Number(resolvedOnlineUsers) || 0,
            acceptedCount,
            needCount
          )
        : await nightPointService.calculateCoefficientByPublishTime({
            publishTime,
            onlineUsers: Number(resolvedOnlineUsers) || 0,
            acceptedCount,
            needCount
          })

      const coefficient = Number(result?.coefficient || 1)
      const breakdown = calculatePointBreakdown(basePoints, coefficient)

      return {
        isNight: Boolean(result?.isNight),
        coefficient: breakdown.coefficient,
        bonusPoints: breakdown.bonusPoints,
        estimatedReward: breakdown.finalPoints,
        finalPoints: breakdown.finalPoints,
        basePoints: breakdown.basePoints,
        extraRate: breakdown.extraRate,
        publishTime,
        previewType: useListPreview ? 'preview' : 'publish_time',
        businessTimezone: BUSINESS_TIME_ZONE,
      }
    } catch (err) {
      logger.warn('构建夜间积分预览失败:', err.message)
      const fallbackReward = toSafeNumber(task?.base_reward ?? task?.reward, 0)
      return {
        isNight: false,
        coefficient: 1,
        bonusPoints: 0,
        estimatedReward: fallbackReward,
        finalPoints: fallbackReward,
        basePoints: fallbackReward,
        extraRate: 0,
        publishTime: task?.created_at || null,
        previewType: 'fallback',
        businessTimezone: BUSINESS_TIME_ZONE,
      }
    }
  }

  async getTasks(filters, geo, limit, userId, source) {
    const { platform, action } = filters
    const { city, province } = geo || {}
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

    let fetchLimit = null
    if (userId) {
      if (limit != null && Number(limit) > 0) {
        const n = Number(limit)
        fetchLimit = Math.min(200, Math.max(n * 4, n))
      } else {
        fetchLimit = 80
      }
    } else if (limit != null && Number(limit) > 0) {
      fetchLimit = Number(limit)
    }

    const limitClause = fetchLimit != null ? `LIMIT $${paramIndex}` : ""
    if (fetchLimit != null) params.push(fetchLimit)

    const sql = `SELECT * FROM tasks ${whereClause} ORDER BY created_at DESC ${limitClause}`
    const tasks = await prisma.$queryRawUnsafe(sql, ...params)
    const onlineUsers = await onlineUserService.getOnlineCount()

    let enriched = await Promise.all((tasks || []).map(async (t) => {
      const nightInfo = await this.buildNightRewardInfo(t, onlineUsers, { useListPreview: true })
      const idStr = typeof t.id === 'bigint' ? t.id.toString() : String(t.id)
      return {
        id: idStr,
        title: t.title,
        platform: t.platform,
        action: t.action,
        description: t.description,
        reward: roundPoints(t.base_reward || t.reward || 0),
        baseReward: roundPoints(t.base_reward || t.reward || 0),
        remain: Number(t.remain || 0),
        timeLimitMinutes: Number(t.time_limit_minutes || 15),
        status: t.status,
        created_at: t.created_at,
        city: t.city ?? null,
        province: t.province ?? null,
        isNightBonusTask: nightInfo.isNight,
        nightCoefficient: nightInfo.coefficient,
        nightBonusPoints: nightInfo.bonusPoints,
        nightExtraRate: nightInfo.extraRate,
        estimatedReward: nightInfo.estimatedReward,
        publishTime: nightInfo.publishTime,
        settlementPreview: {
          previewType: nightInfo.previewType,
          businessTimezone: nightInfo.businessTimezone,
          basePoints: nightInfo.basePoints,
          bonusPoints: nightInfo.bonusPoints,
          finalPoints: nightInfo.finalPoints,
          coefficient: nightInfo.coefficient,
          extraRate: nightInfo.extraRate,
        }
      }
    }))

    if (userId) {
      try {
        const taskIds = enriched.map((task) => Number(task.id)).filter(Number.isFinite)
        if (taskIds.length > 0) {
          const uid = typeof userId === 'string' ? BigInt(userId) : userId
          const taskIdSql = taskIds.join(',')
          const latestClaims = await prisma.$queryRawUnsafe(
            `
            SELECT DISTINCT ON (task_id)
              task_id, status, expires_at, claimed_at, reject_count, image_review_status, link_review_status
            FROM claims
            WHERE user_id = $1
              AND task_id IN (${taskIdSql})
            ORDER BY task_id, claimed_at DESC, id DESC
            `,
            uid
          )

          const reclaimableStatuses = new Set([
            CLAIM_STATUS.EXPIRED,
            CLAIM_STATUS.ABANDONED,
            CLAIM_STATUS.RELEASED,
          ])

          const blockedTaskIds = new Set(
            (latestClaims || [])
              .filter((claim) => {
                const normalizedStatus = normalizeClaimStatus(claim.status)

                if (reclaimableStatuses.has(normalizedStatus)) {
                  return false
                }

                // 失败可重提的任务继续留在「我的任务」，避免和任务大厅混在一起。
                if (RETRYABLE_REJECTION_STATUSES.includes(normalizedStatus)) {
                  return true
                }

                if (
                  normalizedStatus === CLAIM_STATUS.DOING &&
                  claim.expires_at &&
                  new Date(claim.expires_at) <= new Date()
                ) {
                  return false
                }

                return true
              })
              .map((claim) => String(claim.task_id))
          )

          enriched = enriched.filter((task) => !blockedTaskIds.has(String(task.id)))
        }
      } catch (err) {
        logger.warn(`任务大厅用户状态过滤失败，继续使用原列表: ${err.message}`)
      }

      try {
        const exposureService = (await import('./exposureService.js')).default
        const config = await exposureService.getConfig()
        enriched = await exposureService.filterTasksByExposureWithSequential(
          enriched,
          userId,
          city ?? null,
          province ?? null,
          config
        )
      } catch (err) {
        logger.warn(`任务列表曝光过滤失败，使用原始列表: ${err.message}`)
      }
    }

    const outLimit = limit != null && Number(limit) > 0 ? Number(limit) : enriched.length
    const sliced = enriched.slice(0, outLimit)

    if (userId && sliced.length > 0) {
      try {
        const exposureService = (await import('./exposureService.js')).default
        await exposureService.batchRecordViews(
          sliced,
          userId,
          city ?? null,
          province ?? null,
          source === 'home' ? 'home' : 'list'
        )
      } catch (err) {
        logger.warn(`批量记录曝光浏览失败: ${err.message}`)
      }
    }

    return sliced.map((t) => ({
      id: String(t.id),
      title: t.title,
      platform: t.platform,
      action: t.action,
      description: t.description,
      reward: t.reward,
      baseReward: t.baseReward,
      remain: t.remain,
      timeLimitMinutes: t.timeLimitMinutes,
      status: t.status,
      createdAt: t.created_at,
      isNightBonusTask: t.isNightBonusTask,
      nightCoefficient: t.nightCoefficient,
      nightBonusPoints: t.nightBonusPoints,
      nightExtraRate: t.nightExtraRate,
      estimatedReward: t.estimatedReward,
      publishTime: t.publishTime,
      settlementPreview: t.settlementPreview,
    }))
  }

  async getTaskById(id, userId = null) {
    const taskId = typeof id === 'string' ? BigInt(id) : id
    const tasks = await prisma.$queryRaw`SELECT * FROM tasks WHERE id = ${taskId}`
    if (!tasks || tasks.length === 0) return null
    const t = tasks[0]
    const nightInfo = await this.buildNightRewardInfo(t, null, { useListPreview: true })
    const tutorialConfig = await getTaskTutorialConfig()
    
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
        const isExpiredDoing =
          normalizedClaimStatus === CLAIM_STATUS.DOING &&
          claim.expires_at &&
          new Date(claim.expires_at) <= new Date()
        const shouldStayInMyTasks =
          !canClaim &&
          !isExpiredDoing
        
        // 如果任务已完成或审核中，标记为已领取
        isClaimed = isCompleted || isPending || (normalizedClaimStatus === CLAIM_STATUS.DOING && claim.expires_at && new Date(claim.expires_at) > new Date())
        myClaimId = claim.id.toString()
        
        const exampleImages = await resolveExampleImages(t.example_images)
        return {
          id: t.id.toString(),
          title: t.title,
          platform: t.platform,
          action: t.action,
          videoUrl: t.video_url,
          description: t.description,
          templateImages: typeof t.template_images === 'string' ? JSON.parse(t.template_images || '[]') : (t.template_images || []),
          exampleImages,
          requirements: typeof t.requirements === 'string' ? JSON.parse(t.requirements || '[]') : (t.requirements || []),
          reward: roundPoints(t.base_reward || t.reward || 0),
          baseReward: roundPoints(t.base_reward || t.reward || 0),
          remain: Number(t.remain || 0),
          needCount: Number(t.need_count || 0),
          timeLimitMinutes: Number(t.time_limit_minutes || 15),
          cityLimit: Number(t.city_limit || 1),
          provinceLimit: Number(t.province_limit || 4),
          status: t.status,
          createdAt: t.created_at,
          isClaimed,
          hallVisible: !shouldStayInMyTasks,
          shouldRedirectToMyTask: shouldStayInMyTasks,
          redirectToClaimId: shouldStayInMyTasks ? myClaimId : null,
          redirectReason: shouldStayInMyTasks ? 'task_belongs_to_my_tasks' : null,
          myClaimId,
          claimStatus,  // 添加 claim 状态
          canClaim,     // 是否可以重新领取
          canSubmit,    // 是否可以提交
          isCompleted,  // 是否已完成
          isPending,     // 是否审核中
          tutorialConfig,
          isNightBonusTask: nightInfo.isNight,
          nightCoefficient: nightInfo.coefficient,
          nightBonusPoints: nightInfo.bonusPoints,
          nightExtraRate: nightInfo.extraRate,
          estimatedReward: nightInfo.estimatedReward,
          publishTime: nightInfo.publishTime,
          settlementPreview: {
            previewType: nightInfo.previewType,
            businessTimezone: nightInfo.businessTimezone,
            basePoints: nightInfo.basePoints,
            bonusPoints: nightInfo.bonusPoints,
            finalPoints: nightInfo.finalPoints,
            coefficient: nightInfo.coefficient,
            extraRate: nightInfo.extraRate,
          }
        }
      }
    }
    
    const exampleImages = await resolveExampleImages(t.example_images)
    return {
      id: t.id.toString(),
      title: t.title,
      platform: t.platform,
      action: t.action,
      videoUrl: t.video_url,
      description: t.description,
      templateImages: typeof t.template_images === 'string' ? JSON.parse(t.template_images || '[]') : (t.template_images || []),
      exampleImages,
      requirements: typeof t.requirements === 'string' ? JSON.parse(t.requirements || '[]') : (t.requirements || []),
      reward: roundPoints(t.base_reward || t.reward || 0),
      baseReward: roundPoints(t.base_reward || t.reward || 0),
      remain: Number(t.remain || 0),
      needCount: Number(t.need_count || 0),
      timeLimitMinutes: Number(t.time_limit_minutes || 15),
      cityLimit: Number(t.city_limit || 1),
      provinceLimit: Number(t.province_limit || 4),
      status: t.status,
      createdAt: t.created_at,
      isClaimed,
      myClaimId,
      tutorialConfig,
      isNightBonusTask: nightInfo.isNight,
      nightCoefficient: nightInfo.coefficient,
      nightBonusPoints: nightInfo.bonusPoints,
      nightExtraRate: nightInfo.extraRate,
      estimatedReward: nightInfo.estimatedReward,
      publishTime: nightInfo.publishTime,
      settlementPreview: {
        previewType: nightInfo.previewType,
        businessTimezone: nightInfo.businessTimezone,
        basePoints: nightInfo.basePoints,
        bonusPoints: nightInfo.bonusPoints,
        finalPoints: nightInfo.finalPoints,
        coefficient: nightInfo.coefficient,
        extraRate: nightInfo.extraRate,
      }
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

    const claimIds = [...new Set((claims || []).map((c) => Number(c.id)).filter(Number.isFinite))]
    let blockedRecordMap = new Map()
    if (claimIds.length > 0) {
      const blockedRows = await prisma.$queryRawUnsafe(
        `
        SELECT DISTINCT ON (claim_id)
          id,
          claim_id,
          status,
          review_note,
          reviewed_at,
          detected_at
        FROM blocked_accounts
        WHERE claim_id IN (${claimIds.join(',')})
        ORDER BY claim_id, COALESCE(reviewed_at, detected_at, created_at) DESC, id DESC
        `
      )
      blockedRecordMap = new Map(
        (blockedRows || []).map((row) => [String(row.claim_id), row])
      )
    }

    // 分组处理
    const doing = []
    const pending = []
    const done = []
    const blockedRecords = []
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
        reward: c.task_base_reward || c.base_reward || c.task_reward || c.reward,
        base_reward: c.base_reward || c.task_base_reward,
        created_at: c.task_created_at,
        need_count: c.task_need_count,
        remain: c.task_remain,
        settlement_snapshot: c.settlement_snapshot,
        final_points: c.final_points,
        bonus_points: c.bonus_points,
        night_coefficient: c.night_coefficient
      }, onlineUsers, {
        useListPreview: true,
        lockedSettlement: c.settlement_snapshot
      })

      const settledDisplay = buildSettlementDisplay(c.settlement_snapshot, c)
      const settledBaseReward = settledDisplay.basePoints || roundPoints(c.base_reward || c.task_base_reward || 0)
      const settledReward = settledDisplay.finalPoints || roundPoints(c.final_points || c.reward || settledBaseReward)
      const finalCoefficient = settledDisplay.coefficient || nightPreview.coefficient
      const finalBonusPoints = settledDisplay.bonusPoints || nightPreview.bonusPoints

      const canResubmit = canResubmitClaim({
        status: normalizedStatus,
        reject_count: c.reject_count
      })

      const item = {
	        id: c.id.toString(),
	        taskId: c.task_id?.toString(),
	        title: c.title,
	        platform: c.platform,
	        action: c.action,
	        status: normalizedStatus,
	        reward: settledReward,
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
          blockStatus: c.block_status || blockedRecordMap.get(String(c.id))?.status || 'none',
	        isNightBonusTask: nightPreview.isNight,
	        nightCoefficient: finalCoefficient,
	        nightBonusPoints: finalBonusPoints,
          nightExtraRate: settledDisplay.extraRate || nightPreview.extraRate,
	        estimatedReward: nightPreview.estimatedReward,
	        isRejected,
	        canResubmit,
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
          extraRate: settledDisplay.extraRate || nightPreview.extraRate,
          previewType: settledDisplay.previewType || nightPreview.previewType,
          businessTimezone: settledDisplay.businessTimezone || nightPreview.businessTimezone,
          isNightAwarded: finalCoefficient > 1
        }
      }

      const blockedRecord = blockedRecordMap.get(String(c.id))
      if (item.blockStatus === 'confirmed' && blockedRecord) {
        blockedRecords.push({
          ...item,
          blockedAt: blockedRecord.reviewed_at || blockedRecord.detected_at || c.reviewed_at || c.submitted_at || c.claimed_at,
          blockedRecordId: blockedRecord.id?.toString?.() || String(blockedRecord.id),
          blockReason: blockedRecord.review_note || c.review_note || '人工确认评论账号已封控，请更换抖音账号后重新领取任务',
        })
        continue
      }
      
      // 根据状态分组
	      if (normalizedStatus === CLAIM_STATUS.RELEASED) {
	        // 3次拒绝后释放的任务，不显示
	        continue
	      } else if (normalizedStatus === CLAIM_STATUS.DOING || RETRYABLE_REJECTION_STATUSES.includes(normalizedStatus)) {
	        // 进行中（未过期）或失败可重提
	        if (!c.expires_at || new Date(c.expires_at) > new Date() || (isRejected && canResubmit)) {
	          doing.push(item)
	        }
	      } else if (PENDING_REVIEW_STATUSES.includes(normalizedStatus)) {
	        // 待审核
	        pending.push(item)
	      } else if (FINAL_APPROVED_STATUSES.includes(normalizedStatus)) {
	        // 已完成（兼容多种状态值）
	        done.push(item)
	        totalRewards += settledReward
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
      blockedRecords,
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
    const lock = await DistributedLock.acquire(lockKey, 30000, { degradable: true })

    if (!lock.success) {
      throw new AppError("操作过于频繁，请稍后再试", 429, "TOO_MANY_REQUESTS")
    }

    try {
      const config = await this.getConfig()

      const dupStatuses = [
        CLAIM_STATUS.DOING,
        CLAIM_STATUS.SUBMITTED,
        CLAIM_STATUS.IMAGE_REVIEWING,
        CLAIM_STATUS.PENDING_LINK,
        CLAIM_STATUS.LINK_REVIEWING,
        CLAIM_STATUS.PENDING_MANUAL,
        CLAIM_STATUS.APPROVED,
        CLAIM_STATUS.DONE
      ]

      const result = await db.transaction(async (client) => {
        const taskRes = await client.query(
          `SELECT * FROM tasks WHERE id = $1::BIGINT FOR UPDATE`,
          [String(tid)]
        )
        const task = taskRes.rows[0]
        if (!task) {
          throw new AppError("任务不存在", 404, "NOT_FOUND")
        }
        if (task.status !== "active") {
          throw new AppError("任务已下架", 400, "BAD_REQUEST")
        }
        if (Number(task.remain) <= 0) {
          throw new AppError("任务已被抢完", 400, "BAD_REQUEST")
        }

        const dupRes = await client.query(
          `SELECT 1 FROM claims WHERE task_id = $1::BIGINT AND user_id = $2::BIGINT AND status = ANY($3::text[]) LIMIT 1`,
          [String(tid), String(uid), dupStatuses]
        )
        if (dupRes.rows.length > 0) {
          throw new AppError("您已领取过此任务", 400, "BAD_REQUEST")
        }

        const activeCountRes = await client.query(
          `SELECT COUNT(*)::int AS count FROM claims WHERE user_id = $1::BIGINT AND status = $2`,
          [String(uid), CLAIM_STATUS.DOING]
        )
        const activeCount = Number(activeCountRes.rows[0]?.count || 0)

        const userLevelRes = await client.query(
          `SELECT level FROM users WHERE id = $1::BIGINT`,
          [String(uid)]
        )
        const userLevel = Number(userLevelRes.rows[0]?.level || 1)

        const levelConfigRes = await client.query(
          `SELECT concurrent_tasks FROM level_configs WHERE level = $1`,
          [userLevel]
        )
        const maxConcurrentTasks = Number(levelConfigRes.rows[0]?.concurrent_tasks || config.maxActiveTasksPerUser || 1)

        if (activeCount >= maxConcurrentTasks) {
          throw new AppError(
            `您当前等级最多可同时进行${maxConcurrentTasks}个任务，请先完成后再领取新任务`,
            400,
            "BAD_REQUEST"
          )
        }

        if (task.city_limit > 0 && city) {
          const cityCountRes = await client.query(
            `SELECT COUNT(*)::int AS count FROM claims WHERE task_id = $1::BIGINT AND city = $2`,
            [String(tid), city]
          )
          const cityCount = Number(cityCountRes.rows[0]?.count || 0)
          if (cityCount >= task.city_limit) {
            throw new AppError("该城市名额已满", 400, "BAD_REQUEST")
          }
        }

        if (task.province_limit > 0 && province) {
          const provinceCountRes = await client.query(
            `SELECT COUNT(*)::int AS count FROM claims WHERE task_id = $1::BIGINT AND province = $2`,
            [String(tid), province]
          )
          const provinceCount = Number(provinceCountRes.rows[0]?.count || 0)
          if (provinceCount >= task.province_limit) {
            throw new AppError("该省份名额已满", 400, "BAD_REQUEST")
          }
        }

        const baseReward = roundPoints(task.base_reward || task.reward || 0)
        const levelCoefficient = 1.0
        const timeLimitMinutes = Number(task.time_limit_minutes || config.defaultTimeLimitMinutes)
        const expiresAt = new Date(Date.now() + timeLimitMinutes * 60 * 1000)
        const currentAcceptedCount = Math.max(
          0,
          Number(task.need_count || 1) - Number(task.remain || 0)
        )

        const settledOnlineUsersRaw = await onlineUserService.getOnlineCount()
        const settledOnlineUsers =
          settledOnlineUsersRaw === null || settledOnlineUsersRaw === undefined
            ? null
            : toSafeNumber(settledOnlineUsersRaw, null)
        const coefficientResult = await nightPointService.calculateCoefficientByPublishTime({
          publishTime: new Date(),
          onlineUsers: settledOnlineUsers,
          acceptedCount: currentAcceptedCount,
          needCount: Number(task.need_count || 1),
        })
        const breakdown = calculatePointBreakdown(baseReward, coefficientResult?.coefficient || 1)
        const lockedSettlement = {
          source: 'task_claim',
          claimId: null,
          taskId: String(tid),
          userId: String(uid),
          taskPublishedAt: task.created_at || null,
          claimTime: new Date().toISOString(),
          lockTime: new Date().toISOString(),
          publishTime: new Date().toISOString(),
          previewType: 'locked',
          businessTimezone: BUSINESS_TIME_ZONE,
          basePoints: breakdown.basePoints,
          coefficient: breakdown.coefficient,
          extraRate: breakdown.extraRate,
          bonusPoints: breakdown.bonusPoints,
          finalPoints: breakdown.finalPoints,
          isNight: Boolean(coefficientResult?.isNight),
          onlineUsers: settledOnlineUsers,
          onlineUsersSource: settledOnlineUsers === null ? 'fallback_base_coefficient' : 'redis_live',
          config: coefficientResult?.config || null,
          acceptedCount: currentAcceptedCount,
          needCount: Number(task.need_count || 1),
          calculatedAt: new Date().toISOString(),
        }

        const ins = await client.query(
          `INSERT INTO claims (
            user_id, task_id, title, platform, action,
            base_reward, reward, level_coefficient,
            status, city, province, expires_at, settlement_snapshot, night_coefficient, online_users, final_points, bonus_points, publish_time_snapshot, config_snapshot
          ) VALUES (
            $1::BIGINT, $2::BIGINT, $3, $4, $5,
            $6, $7, $8,
            $9, $10, $11, $12::timestamptz, $13::jsonb, $14, $15, $16, $17, $18::timestamptz, $19::jsonb
          ) RETURNING id`,
          [
            String(uid),
            String(tid),
            task.title,
            task.platform,
            task.action,
            baseReward,
            baseReward,
            levelCoefficient,
            CLAIM_STATUS.DOING,
            city || null,
            province || null,
            expiresAt.toISOString(),
            JSON.stringify(lockedSettlement),
            breakdown.coefficient,
            settledOnlineUsers,
            breakdown.finalPoints,
            breakdown.bonusPoints,
            task.created_at || new Date().toISOString(),
            JSON.stringify(coefficientResult?.config || null)
          ]
        )

        const claimId = ins.rows[0]?.id?.toString()
        lockedSettlement.claimId = claimId

        const up = await client.query(
          `UPDATE tasks SET remain = remain - 1, updated_at = NOW() WHERE id = $1::BIGINT AND remain > 0`,
          [String(tid)]
        )
        if (up.rowCount !== 1) {
          throw new AppError("任务名额已抢完，请稍后重试", 400, "BAD_REQUEST")
        }

        await client.query(
          `UPDATE task_exposure SET accepted_count = accepted_count + 1, updated_at = NOW() WHERE task_id = $1::BIGINT`,
          [String(tid)]
        )

        return {
          claimId,
          taskId: taskId.toString(),
          title: task.title,
          reward: baseReward,
          settlement: lockedSettlement,
          timeLimitMinutes,
          expiresAt
        }
      })

      logger.info(`✅ 用户 ${userId} 领取任务 ${taskId} 成功, claimId: ${result.claimId}`)
      return result
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

      const screenshotEntries = buildSubmissionScreenshotEntries(screenshots)
      const screenshotUrls = normalizeScreenshotUrls(screenshotEntries)
      const submittedAt = new Date()
      const submissionVersion = normalizeSubmissionVersion(submittedAt)

      if (screenshotUrls.length < 2) {
        throw new AppError("请至少上传2张截图", 400, "BAD_REQUEST")
      }

	    const nextReviewHistory = appendReviewHistory(
	      claim.review_history,
	      createReviewHistoryEntry({
	        stage: 'submission',
	        action: isRetryableStatus ? 'resubmitted' : 'submitted',
	        reason: isRetryableStatus ? '用户重新提交任务' : '用户提交任务',
	        details: {
            submissionVersion,
	          screenshotsCount: screenshotUrls.length,
            screenshotRoles: screenshotEntries.map((item) => ({
              url: item.url,
              role: item.role,
              sortOrder: item.sortOrder,
            })),
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
	        screenshots = ${JSON.stringify(screenshotUrls)}::jsonb,
	        evaluation = ${JSON.stringify({ text: evaluation || '' })}::jsonb,
	        submitted_at = ${submittedAt},
          submission_version = ${submittedAt},
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
	      await enqueueReview(claimId.toString(), {
          screenshots: screenshotEntries,
          submissionVersion,
          submittedAt,
        })
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
          submission_version = NULL,
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

    return await db.transaction(async (client) => {
      const cr = await client.query(
        `SELECT * FROM claims WHERE id = $1::BIGINT AND user_id = $2::BIGINT FOR UPDATE`,
        [String(cid), String(uid)]
      )
      const claim = cr.rows[0]
      if (!claim) {
        throw new AppError("领取记录不存在", 404, "NOT_FOUND")
      }
      if (
        PENDING_REVIEW_STATUSES.includes(normalizeClaimStatus(claim.status)) ||
        FINAL_APPROVED_STATUSES.includes(normalizeClaimStatus(claim.status))
      ) {
        throw new AppError("当前状态不允许放弃", 400, "BAD_REQUEST")
      }

      await client.query(`UPDATE claims SET status = $1 WHERE id = $2::BIGINT`, [
        CLAIM_STATUS.ABANDONED,
        String(cid)
      ])
      await client.query(
        `UPDATE tasks SET remain = LEAST(need_count, remain + 1), updated_at = NOW() WHERE id = $1::BIGINT`,
        [String(claim.task_id)]
      )
      await client.query(
        `UPDATE task_exposure SET accepted_count = GREATEST(0, accepted_count - 1), updated_at = NOW() WHERE task_id = $1::BIGINT`,
        [String(claim.task_id)]
      )

      logger.info(`用户 ${userId} 放弃任务, claimId: ${claimId}`)

      return {
        claimId: claimId.toString(),
        status: CLAIM_STATUS.ABANDONED,
        message: "任务已放弃"
      }
    })
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
        SUM(COALESCE(final_points, reward)) FILTER (
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
    
    // 今日已完成：图片+链接双审通过，按完成时刻统计
    const todayCompletedResult = await prisma.$queryRawUnsafe(
      `
      SELECT COUNT(*)::bigint as count
      FROM claims c
      WHERE c.status IN ('approved', 'done')
        AND LOWER(COALESCE(TRIM(c.image_review_status), '')) IN ('approved', 'checked')
        AND LOWER(COALESCE(TRIM(c.link_review_status), '')) IN ('approved', 'skipped', 'passed', 'checked')
        AND ${CLAIM_COMPLETED_AT_SQL} >= $1
      `,
      today
    )
    const todayCompleted = Number(todayCompletedResult[0]?.count || 0)
    
    // 今日任务总量（今日发布任务的积分总和）
    const todayAmountResult = await prisma.$queryRaw`
      SELECT COALESCE(SUM(reward), 0) as total FROM tasks WHERE created_at >= ${today}
    `
    const todayTotalAmount = Number(todayAmountResult[0]?.total || 0)
    
    // 今日任务已完成数
    const todayCompletedFromTodayTasksResult = await prisma.$queryRawUnsafe(
      `
      SELECT COUNT(*)::bigint as count
      FROM claims c
      JOIN tasks t ON c.task_id = t.id
      WHERE t.created_at >= $1
        AND c.status IN ('approved', 'done')
        AND LOWER(COALESCE(TRIM(c.image_review_status), '')) IN ('approved', 'checked')
        AND LOWER(COALESCE(TRIM(c.link_review_status), '')) IN ('approved', 'skipped', 'passed', 'checked')
        AND ${CLAIM_COMPLETED_AT_SQL} >= $1
      `,
      today
    )
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
    const screenshotEntries = normalizeScreenshotEntries(c.screenshots)
    const reviewHistory = safeParseReviewHistory(c.review_history)
    const evaluation = normalizeEvaluation(c.evaluation)
    const settledDisplay = buildSettlementDisplay(c.settlement_snapshot, c)
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
      reward: settledDisplay.finalPoints || roundPoints(c.final_points || c.reward || 0),
      baseReward: settledDisplay.basePoints || roundPoints(c.base_reward || 0),
      city: c.city,
      province: c.province,
      screenshots: c.screenshots,
      screenshotUrls: screenshotUrls,
      screenshotEntries,
      evaluation,
      platformNickname: c.platform_nickname,
      claimedAt: c.claimed_at,
      submittedAt: c.submitted_at,
      expiresAt: c.expires_at,
      reviewedAt: c.reviewed_at,
      reviewNote: getLatestMeaningfulReason(c),
      settlement: {
        finalPoints: settledDisplay.finalPoints || roundPoints(c.final_points || c.reward || 0),
        basePoints: settledDisplay.basePoints || roundPoints(c.base_reward || 0),
        coefficient: settledDisplay.coefficient || roundPoints(c.night_coefficient || 1),
        bonusPoints: settledDisplay.bonusPoints || roundPoints(c.bonus_points || 0),
        extraRate: settledDisplay.extraRate || 0,
        previewType: settledDisplay.previewType || 'locked',
        businessTimezone: settledDisplay.businessTimezone || BUSINESS_TIME_ZONE,
        isNightAwarded: settledDisplay.coefficient > 1,
      },
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
        reward: roundPoints(c.final_points || c.reward || 0),
        taskReward: roundPoints(c.task_reward || 0),
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
