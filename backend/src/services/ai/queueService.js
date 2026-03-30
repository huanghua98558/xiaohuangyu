/**
 * AI审核异步队列服务 - Supabase版
 * 
 * 用于处理大规模审核任务（30,000条/天）
 * 
 * 架构：
 * 1. 用户提交 → 任务入队 → 返回成功
 * 2. 后台工作进程消费队列 → AI分析 → 写入结果
 * 
 * 数据存储：所有数据存储在Supabase
 */

import supabase from '../../utils/supabaseToPrismaAdapter.js'
import { Queue } from 'bullmq'
import logger from '../../utils/logger.js'
import { reviewScreenshots } from './visionReviewService.js'
import { getReviewerConfig } from './configService.js'
import { TASK_ACTIONS, PLATFORMS, getPlatformName } from '../../constants/taskActions.js'
import taskService from '../taskService.js'
import achievementService from '../achievementService.js'
import pointsSettlementService from '../pointsSettlementService.js'
import db from '../../config/database.js'
import redisConnection from '../../config/queue.js'
import { CLAIM_STATUS } from '../../constants/claimLifecycle.js'
import { appendReviewHistory, createReviewHistoryEntry } from '../../utils/claimReviewHistory.js'

// 队列配置
const QUEUE_CONFIG = {
  maxRetries: 3,                          // 最大重试次数
  visibilityTimeout: 300,                 // 处理超时时间（秒）
  batchSize: 5,                           // 批量处理大小
  pollInterval: 1000                      // 轮询间隔（毫秒）
}

// 随机抽查配置
const RANDOM_CHECK_CONFIG = {
  baseRate: 0.05,           // 基础随机抽查率 5%
  highCreditBonus: -0.02,   // 高信用用户减少抽查
  lowCreditPenalty: 0.10    // 低信用用户增加抽查
}

const linkDelayQueue = new Queue('link-delay-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    }
  }
})

function readIntegerConfig(value, fallback, minimum = null) {
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed)) {
    return fallback
  }

  if (minimum !== null) {
    return Math.max(minimum, parsed)
  }

  return parsed
}

export async function getLinkVerifyConfig() {
  const config = {
    enabled: true,
    delayMinutes: 0,
    batchThreshold: 5,
    maxWaitMinutes: 120,
    batchSize: 10,
    retryCount: 3
  }

  try {
    const rows = await db.queryMany(
      "SELECT key, value FROM ai_configs WHERE key LIKE 'link_verify_%'"
    )

    for (const row of rows) {
      if (row.key === 'link_verify_enabled') {
        config.enabled = row.value === 'true'
      }
      if (row.key === 'link_verify_delay_minutes') {
        config.delayMinutes = readIntegerConfig(row.value, config.delayMinutes, 0)
      }
      if (row.key === 'link_verify_batch_threshold') {
        config.batchThreshold = readIntegerConfig(row.value, config.batchThreshold, 1)
      }
      if (row.key === 'link_verify_max_wait_minutes') {
        config.maxWaitMinutes = readIntegerConfig(row.value, config.maxWaitMinutes, 0)
      }
      if (row.key === 'link_verify_batch_size') {
        config.batchSize = readIntegerConfig(row.value, config.batchSize, 1)
      }
      if (row.key === 'link_verify_retry_count') {
        config.retryCount = readIntegerConfig(row.value, config.retryCount, 1)
      }
    }
  } catch (error) {
    logger.error('读取连接审核配置失败，使用默认值:', error)
  }

  return config
}

export async function enqueueLinkVerificationCompat(params) {
  const {
    claimId,
    userId,
    taskId,
    videoUrl,
    platform,
    taskAuthorName,
    action
  } = params

  if (!videoUrl) {
    return { skipped: true, reason: '无视频链接' }
  }

  const config = await getLinkVerifyConfig()
  if (!config.enabled) {
    return { skipped: true, reason: '连接审核已禁用', config }
  }

  const now = Date.now()
  const delayMs = Math.max(0, Number(config.delayMinutes) || 0) * 60 * 1000

  await linkDelayQueue.add(
    'link-delay',
    {
      claimId,
      userId,
      taskId,
      links: [videoUrl],
      platform: platform || 'douyin',
      readyAt: now + delayMs,
      enqueuedAt: now,
      batchThreshold: config.batchThreshold,
      maxWaitMinutes: config.maxWaitMinutes,
      batchSize: config.batchSize,
      retryCount: config.retryCount,
      taskContext: {
        author: taskAuthorName || '',
        action: action || ''
      }
    },
    {
      delay: delayMs,
      attempts: Math.max(1, Number(config.retryCount) || 1)
    }
  )

  return {
    queued: true,
    config,
    readyAt: new Date(now + delayMs).toISOString()
  }
}

/**
 * 从任务标题中提取达人名字
 * @param {string} title - 任务标题，格式如 "Kim 根鸠-3月16日"
 * @returns {string} 达人名字
 */
function extractAuthorFromTitle(title) {
  if (!title) return ''
  // 格式: "达人名字-日期" 或 "达人名字 - 日期" 或 "达人名字-3月16日"
  const match = title.match(/^(.+?)[-–—]\s*\d/)
  if (match) {
    return match[1].trim()
  }
  // 尝试匹配 "-" 后面跟中文日期的情况
  const chineseDateMatch = title.match(/^(.+?)[-–—]\s*[\d一二三四五六七八九十月日]+/)
  if (chineseDateMatch) {
    return chineseDateMatch[1].trim()
  }
  // 如果没有日期，返回整个标题
  return title.trim()
}

/**
 * 添加任务到审核队列
 * @param {number} claimId - 领取记录ID
 * @param {Object} options - 选项
 */
export async function enqueueReview(claimId, options = {}) {
  try {
    const normalizedClaimId = Math.trunc(Number(claimId))
    if (!Number.isFinite(normalizedClaimId)) {
      throw new Error(`无效的 claimId: ${claimId}`)
    }

    // 如果提供了 user_id 和 task_id，直接使用；否则从数据库获取
    let userId = options.user_id
    let taskId = options.task_id
    let screenshots = options.screenshots
    
    if (!userId || !taskId) {
      // 直接走 CockroachDB，避免适配层类型偏差
      const claim = await db.queryOne(
        'SELECT id, user_id, task_id, screenshots FROM claims WHERE id = $1',
        [normalizedClaimId]
      )

      if (!claim) {
        logger.error('获取Claim失败: claim不存在', { claimId: normalizedClaimId })
        throw new Error('领取记录不存在')
      }
      
      userId = userId || claim.user_id
      taskId = taskId || claim.task_id
      screenshots = screenshots || claim.screenshots || '[]'
    }
    
    const userIdNum = Number(userId)
    const taskIdNum = Number(taskId)
    if (!Number.isFinite(userIdNum) || !Number.isFinite(taskIdNum)) {
      throw new Error(`入队参数无效: user_id=${userId}, task_id=${taskId}`)
    }

    // ai_review_queue.user_id 为 integer，task_id 为 bigint，统一转数字输入
    const userIdInt = Math.trunc(userIdNum)
    const taskIdInt = Math.trunc(taskIdNum)
    const screenshotsStr = typeof screenshots === 'string' ? screenshots : JSON.stringify(screenshots || [])
    
    const nowIso = new Date().toISOString()
    const existingQueue = await db.queryOne(
      'SELECT id FROM ai_review_queue WHERE claim_id = $1',
      [normalizedClaimId]
    )

    let queueItem
    if (existingQueue) {
      // 更新现有记录
      queueItem = await db.queryOne(
        `
        UPDATE ai_review_queue
        SET status = 'pending',
            screenshots = $3,
            ai_result = NULL,
            ai_confidence = NULL,
            ai_reason = NULL,
            processed_at = NULL,
            updated_at = $2
        WHERE claim_id = $1
        RETURNING *
        `,
        [normalizedClaimId, nowIso, screenshotsStr]
      )
    } else {
      // 创建新记录
      const priority = Math.trunc(Number(options.priority || 0))
      queueItem = await db.queryOne(
        `
        INSERT INTO ai_review_queue
          (claim_id, user_id, task_id, screenshots, status, priority, retry_count, updated_at, created_at)
        VALUES
          ($1, $2, $3, $4, 'pending', $5, 0, $6, $6)
        RETURNING *
        `,
        [normalizedClaimId, userIdInt, taskIdInt, screenshotsStr, priority, nowIso]
      )
    }
    
    if (!queueItem) {
      throw new Error('创建队列记录失败: 未返回队列项')
    }
    
    // 更新Claim的AI审核状态
    await db.query(
      'UPDATE claims SET ai_review_status = $1 WHERE id = $2',
      ['pending', normalizedClaimId]
    )
    
    logger.info(`审核任务入队: claimId=${normalizedClaimId}, queueId=${queueItem.id}`)
    
    return {
      success: true,
      queueId: queueItem.id,
      message: '已加入审核队列'
    }
  } catch (error) {
    logger.error('入队失败:', error)
    throw error
  }
}

/**
 * 从队列获取待处理任务
 * @param {number} limit - 获取数量
 * @returns {Array} 任务列表
 */
export async function dequeueReviews(limit = 10) {
  try {
    // 从数据库获取待处理任务（不使用关联查询）
    const { data: items, error } = await supabase
      .from('ai_review_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('retry_count', QUEUE_CONFIG.maxRetries)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit)
    
    if (error) throw error
    
    if (items && items.length > 0) {
      // 标记为处理中
      const ids = items.map(i => i.id)
      await supabase
        .from('ai_review_queue')
        .update({
          status: 'processing',
          processed_at: new Date().toISOString()
        })
        .in('id', ids)
      
      // 批量获取关联数据
      const claimIds = items.map(i => i.claim_id)
      const taskIds = [...new Set(items.map(i => i.task_id))]
      const userIds = [...new Set(items.map(i => i.user_id))]
      
      const [claimsRes, tasksRes, usersRes] = await Promise.all([
        supabase.from('claims').select('*').in('id', claimIds),
        supabase.from('tasks').select('id, action, title, platform, video_url').in('id', taskIds),
        supabase.from('users').select('id, username, level').in('id', userIds)
      ])
      
      const claimsMap = new Map((claimsRes.data || []).map(c => [c.id, c]))
      const tasksMap = new Map((tasksRes.data || []).map(t => [t.id, t]))
      const usersMap = new Map((usersRes.data || []).map(u => [u.id, u]))
      
      // 组装完整数据
      return items.map(item => ({
        ...item,
        claims: {
          ...claimsMap.get(item.claim_id),
          tasks: tasksMap.get(item.task_id),
          users: usersMap.get(item.user_id)
        }
      }))
    }
    
    return items || []
  } catch (error) {
    logger.error('获取队列任务失败:', error)
    return []
  }
}

/**
 * 处理单个审核任务
 * @param {Object} item - 队列项
 * @param {Object} config - 审核配置
 * @returns {Object} 处理结果
 */
export async function processQueueItem(item, config = {}) {
  const startTime = Date.now()
  
  try {
    const { claims: claim, claim_id, user_id } = item
    const screenshots = JSON.parse(claim?.screenshots || '[]')
    const action = claim?.tasks?.action || TASK_ACTIONS.SHORT_VIDEO_RESEARCH
    const taskTitle = claim?.tasks?.title || ''
    const platform = claim?.tasks?.platform || 'douyin'
    const videoUrl = claim?.tasks?.video_url || null
    
    // 获取审核配置
    const reviewerConfig = await getReviewerConfig()
    
    // 获取审核规则（获取auto_reject_enabled设置）
    const { data: reviewRule } = await supabase
      .from('review_rules')
      .select('*')
      .eq('platform', platform)
      .eq('action', action)
      .eq('is_active', true)
      .maybeSingle()
    
    const autoRejectEnabled = reviewRule?.auto_reject_enabled ?? false
    // ========== 状态流转：更新为图片审核中 ==========
    await supabase
      .from("claims")
      .update({ status: "image_reviewing", image_review_status: "reviewing" })
      .eq("id", claim_id)
    logger.info(`[审核] Claim ${claim_id} 状态更新为 image_reviewing`)

    
    // 判断是否需要随机抽查
    const shouldRandomCheck = checkRandomTrigger(claim?.users)
    
    // AI分析截图（传入审核上下文）
    const analysisResult = await reviewScreenshots(screenshots, { action, platform, taskAuthor: extractAuthorFromTitle(taskTitle) })
    // 计算置信度（基础值）
    let confidence = analysisResult.confidence || 0.5
    
    // ========== 置信度调整因子 ==========
    // 1. 达人名匹配加分
    if (analysisResult.authorMatch?.matched) {
      confidence = Math.min(1.0, confidence + 0.10)
      logger.info(`[审核] 达人名匹配，置信度+0.10 -> ${confidence.toFixed(2)}`)
    }
    
    // 2. 本人评论确认加分
    if (analysisResult.comment?.isOwner) {
      confidence = Math.min(1.0, confidence + 0.15)
      logger.info(`[审核] 本人评论确认，置信度+0.15 -> ${confidence.toFixed(2)}`)
    }
    
    // 3. 评论正向性加分
    if (analysisResult.comment?.isPositive) {
      confidence = Math.min(1.0, confidence + 0.05)
      logger.info(`[审核] 评论正向，置信度+0.05 -> ${confidence.toFixed(2)}`)
    }
    
    // 4. 评论字数达标加分
    if (analysisResult.comment?.lengthValid) {
      confidence = Math.min(1.0, confidence + 0.05)
      logger.info(`[审核] 评论字数达标，置信度+0.05 -> ${confidence.toFixed(2)}`)
    }
    
    // 决定处理方式（硬规则决策，置信度仅记录不参与决策）
    let decision = 'manual'
    let reason = analysisResult.details || ''
    
    // 如果需要随机抽查，强制进入人工
    if (shouldRandomCheck) {
      decision = 'manual'
      reason = `随机抽查: ${analysisResult.details}`
    } else if (!analysisResult.passed) {
      // 硬规则不通过：直接拒绝（不依赖置信度）
      decision = 'rejected'
      reason = `AI自动拒绝: ${analysisResult.rejectionReason || analysisResult.details}`
    } else {
      // 硬规则通过：自动通过（不依赖置信度）
      decision = 'approved'
      reason = `AI自动通过: ${analysisResult.details}`
    }
    
    // 更新队列状态
    await supabase
      .from('ai_review_queue')
      .update({
        status: decision === 'manual' ? 'manual' : `ai_${decision}`,
        ai_result: JSON.stringify(analysisResult),
        ai_confidence: Number(confidence),
        ai_reason: reason,
        processed_at: new Date().toISOString(),
        processed_by: 'ai'
      })
      .eq('id', item.id)
    
    // 如果是自动决策，更新Claim
    if (decision !== 'manual') {
      // 提取达人名字用于显示
      const displayAuthor = extractAuthorFromTitle(taskTitle)
      
      // 构建用户可见的审核备注（简化版）
      let reviewNote = ''
      if (decision === 'rejected') {
        reviewNote = analysisResult.rejectionReason || '审核未通过，请检查截图是否符合要求'
      } else {
        reviewNote = '审核通过'
      }
      
      // 内部详细信息
      const authorMatchInfo = analysisResult.authorMatch 
        ? `达人验证：${analysisResult.authorMatch.matched ? '✓ 匹配' : '✗ 不匹配'}（任务达人：${displayAuthor}，截图达人：${analysisResult.authorMatch.screenshotAuthor || '未识别'}）`
        : ''
      const commentInfo = analysisResult.comment
        ? `评论验证：${analysisResult.comment.lengthValid ? '✓ 字数合格' : '✗ 字数不足'}（${analysisResult.comment.length || 0}字）\n内容方向：${analysisResult.comment.isPositive ? '✓ 正向' : '✗ 非正向'}\n本人评论：${analysisResult.comment.isOwner ? '✓ 已确认' : '✗ 未确认'}${analysisResult.comment.ownerIndicator ? `（${analysisResult.comment.ownerIndicator}）` : ''}\n评论内容：${analysisResult.comment.content || '未识别'}`
        : ''
      const detailedReason = `[AI审核] 决策：${decision === 'approved' ? '通过' : '拒绝'}\n置信度：${(confidence * 100).toFixed(1)}%\n${authorMatchInfo}\n${commentInfo}\n详情：${analysisResult.details}`
      
      // 获取配置的过期时间
      const config = await taskService.getConfig()
      const timeLimit = config.defaultTimeLimitMinutes || 15
      const newExpiresAt = new Date(Date.now() + timeLimit * 60 * 1000)
      
      // 根据审核决策更新状态
      const newStatus = decision === 'approved' ? 'approved' : 'image_rejected'
      
      await supabase
        .from('claims')
        .update({
          status: newStatus,
          ai_review_status: decision,
          ai_confidence: Number(confidence),
          ai_reason: detailedReason,  // 内部详细信息
          ai_reviewed_at: new Date().toISOString(),
          reviewed_at: decision === 'approved' ? new Date().toISOString() : null,
          review_note: reviewNote,  // 用户可见的简化信息
          reviewer_id: decision === 'approved' ? 0 : null,
          expires_at: decision === 'approved' ? undefined : newExpiresAt.toISOString(),  // 拒绝时重置过期时间
          submitted_at: null,  // 清空提交时间，允许重新提交
          screenshots: decision === 'approved' ? undefined : null  // 拒绝时清空截图
        })
        .eq('id', claim_id)
      
      // 如果通过，检查是否需要链接审核
      if (decision === "approved") {
        // 获取任务中的达人名
        const taskAuthorName = extractAuthorFromTitle(taskTitle)
        
        // 从 OCR 结果提取评论内容
        const commentContent = analysisResult.comment?.content || ""
        
        // 检查是否需要链接审核（有视频链接且需要评论验证）
        if (videoUrl && commentContent) {
          logger.info(`[审核] Claim ${claim_id} 需要链接审核，视频：${videoUrl}`)
          
          // 加入新的连接延迟队列
          try {
            const queueResult = await enqueueLinkVerificationCompat({
              claimId: claim_id,
              userId: user_id,
              taskId: item.task_id,
              videoUrl: videoUrl,
              platform: platform,
              taskAuthorName: taskAuthorName
            })

            if (queueResult?.queued) {
              const reviewHistory = appendReviewHistory(
                claim?.review_history,
                createReviewHistoryEntry({
                  stage: 'link_review',
                  action: 'queued',
                  reason: `已进入连接审核队列，基础延迟 ${queueResult.config.delayMinutes} 分钟`,
                  details: {
                    delayMinutes: queueResult.config.delayMinutes,
                    batchThreshold: queueResult.config.batchThreshold,
                    maxWaitMinutes: queueResult.config.maxWaitMinutes,
                    source: 'ai_queue_service'
                  }
                })
              )

              await supabase
                .from("claims")
                .update({
                  status: CLAIM_STATUS.PENDING_LINK,
                  link_review_status: "pending",
                  link_review_reason: "图片审核通过，等待连接审核",
                  review_note: "图片审核通过，等待连接审核",
                  review_history: reviewHistory
                })
                .eq("id", claim_id)

              logger.info(`[审核] Claim ${claim_id} 已加入连接延迟队列`)
            } else if (queueResult?.skipped) {
              logger.info(`[审核] Claim ${claim_id} 跳过连接审核: ${queueResult.reason}`)
              await approveClaimWithReward(claim_id)
            }
          } catch (linkError) {
            logger.error(`[审核] 加入链接审核队列失败：${linkError.message}`)
            const reviewHistory = appendReviewHistory(
              claim?.review_history,
              createReviewHistoryEntry({
                stage: 'link_review',
                action: 'manual',
                reason: '连接审核入队失败，已转人工复审',
                details: {
                  error: linkError.message,
                  source: 'ai_queue_service'
                }
              })
            )

            await supabase
              .from("claims")
              .update({
                status: CLAIM_STATUS.PENDING_MANUAL,
                link_review_status: "manual",
                link_review_reason: "连接审核入队失败，已转人工复审",
                review_note: "连接审核入队失败，已转人工复审",
                review_history: reviewHistory
              })
              .eq("id", claim_id)
          }
        } else {
          // 无需链接审核，直接发放积分
          await approveClaimWithReward(claim_id)
        }
      }
      // 记录AI审核日志
      await supabase
        .from('task_review_logs')
        .insert({
          claim_id: claim_id,
          task_id: item.task_id,
          reviewer_id: 0,  // AI审核
          action: decision === 'approved' ? 'approve' : 'reject',
          note: reason,
          is_ai_review: true,
          ai_confidence: Number(confidence)
        })
      // 拒绝时不释放名额，用户有15分钟时间重新提交，或者可以主动放弃
    } else {
      // 更新为待人工审核
      const displayAuthor = extractAuthorFromTitle(taskTitle)
      
      // 用户可见的简化信息
      const reviewNote = '正在人工审核中，请耐心等待'
      
      // 内部详细信息
      const authorMatchInfo = analysisResult.authorMatch 
        ? `达人验证：${analysisResult.authorMatch.matched ? '✓ 匹配' : '✗ 不匹配'}（任务达人：${displayAuthor}，截图达人：${analysisResult.authorMatch.screenshotAuthor || '未识别'}）`
        : ''
      const commentInfo = analysisResult.comment
        ? `评论验证：${analysisResult.comment.lengthValid ? '✓ 字数合格' : '✗ 字数不足'}（${analysisResult.comment.length || 0}字）\n内容方向：${analysisResult.comment.isPositive ? '✓ 正向' : '✗ 非正向'}\n本人评论：${analysisResult.comment.isOwner ? '✓ 已确认' : '✗ 未确认'}${analysisResult.comment.ownerIndicator ? `（${analysisResult.comment.ownerIndicator}）` : ''}\n评论内容：${analysisResult.comment.content || '未识别'}`
        : ''
      const detailedReason = `[AI初审] 决策：需人工审核\n置信度：${(confidence * 100).toFixed(1)}%\n${authorMatchInfo}\n${commentInfo}\n详情：${analysisResult.details}`
      
      await supabase
        .from('claims')
        .update({
          ai_review_status: 'manual',
          ai_confidence: Number(confidence),
          ai_reason: detailedReason,  // 内部详细信息
          ai_reviewed_at: new Date().toISOString(),
          review_note: reviewNote  // 用户可见的简化信息
        })
        .eq('id', claim_id)
      
      // 记录AI转人工审核日志
      await supabase
        .from('task_review_logs')
        .insert({
          claim_id: claim_id,
          task_id: item.task_id,
          reviewer_id: 0,  // AI审核
          action: 'manual',
          note: reason,
          is_ai_review: true,
          ai_confidence: Number(confidence)
        })
    }
    
    const duration = Date.now() - startTime
    
    return {
      success: true,
      claimId: claim_id,
      decision,
      confidence,
      duration
    }
  } catch (error) {
    logger.error('处理队列任务失败:', error)
    
    // 更新为失败
    await supabase
      .from('ai_review_queue')
      .update({
        status: 'pending',
        retry_count: (item.retry_count || 0) + 1
      })
      .eq('id', item.id)
    
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 发放积分奖励
 */
async function approveClaimWithReward(claimId) {
  const { data: claim } = await supabase
    .from('claims')
    .select('*, tasks(title)')
    .eq('id', claimId)
    .single()
  
  if (!claim) return

  const settlement = await pointsSettlementService.awardClaimPoints({
    claimId,
    userId: claim.user_id,
    taskId: claim.task_id,
    awardReason: 'AI审核自动通过',
    source: 'ai_queue_service'
  })

  logger.info(
    '[积分发放] claimId=' + claimId + ' 结算完成，积分=' + (settlement?.finalPoints || 0)
  )

  // ========== 新增：检查成就 ==========
  try {
    const achievements = await achievementService.checkAndGrantAchievements(claim.user_id)
    if (achievements && achievements.length > 0) {
      logger.info("[成就] 用户 " + claim.user_id + " 获得成就: " + achievements.map(a => a.name).join(","))
    }
  } catch (achievementError) {
    logger.error("检查成就失败:", achievementError.message)
  }
  // ========================================
}

function checkRandomTrigger(user) {
  if (!user) return Math.random() < RANDOM_CHECK_CONFIG.baseRate
  
  const level = user.level || 1
  let rate = RANDOM_CHECK_CONFIG.baseRate
  
  // 高等级用户减少抽查
  if (level >= 5) {
    rate += RANDOM_CHECK_CONFIG.highCreditBonus
  }
  // 低等级用户增加抽查
  else if (level <= 2) {
    rate += RANDOM_CHECK_CONFIG.lowCreditPenalty
  }
  
  return Math.random() < rate
}

/**
 * 批量处理队列
 * @param {number} count - 处理数量
 * @param {Object} headers - 请求头
 * @returns {Object} 处理结果
 */
export async function batchProcessQueue(count = 10, headers = {}) {
  const items = await dequeueReviews(count)
  
  const results = {
    total: items.length,
    processed: 0,
    approved: 0,
    rejected: 0,
    manual: 0,
    failed: 0
  }
  
  for (const item of items) {
    const result = await processQueueItem(item, {})
    
    if (result.success) {
      results.processed++
      if (result.decision === 'approved') results.approved++
      else if (result.decision === 'rejected') results.rejected++
      else if (result.decision === 'manual') results.manual++
    } else {
      results.failed++
    }
    
    // 添加延迟避免过载
    await new Promise(r => setTimeout(r, 500))
  }
  
  return results
}

/**
 * 处理待审核队列（供定时任务调用）
 * @param {number} count - 处理数量
 * @returns {Object} 处理结果
 */
export async function processPendingQueue(count = 10) {
  return await batchProcessQueue(count)
}

/**
 * 获取队列统计
 * @returns {Object} 统计数据
 */
export async function getQueueStats() {
  const { data: stats, error } = await supabase
    .from('ai_review_queue')
    .select('status')
  
  if (error) {
    logger.error('获取队列统计失败:', error)
    return { total: 0, pending: 0, processing: 0, manual: 0 }
  }
  
  const result = {
    total: stats?.length || 0,
    pending: 0,
    processing: 0,
    manual: 0,
    ai_approved: 0,
    ai_rejected: 0,
    completed: 0
  }
  
  stats?.forEach(s => {
    if (result.hasOwnProperty(s.status)) {
      result[s.status]++
    }
  })
  
  return result
}

/**
 * 获取队列大小
 * @returns {number} 队列大小
 */
export async function getQueueSize() {
  const { count, error } = await supabase
    .from('ai_review_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
  
  if (error) {
    logger.error('获取队列大小失败:', error)
    return 0
  }
  
  return count || 0
}

export default {
  enqueueReview,
  dequeueReviews,
  processQueueItem,
  batchProcessQueue,
  getQueueStats,
  getQueueSize,
  getLinkVerifyConfig,
  enqueueLinkVerificationCompat
}
