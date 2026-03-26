/**
 * 链接审查队列服务
 * 
 * 功能：
 * 1. 延迟审查：截图审核通过后延迟N分钟再审查链接
 * 2. 批量处理：积累一定数量后批量处理，节省代理IP
 * 3. 超时处理：超过最大等待时间必须处理
 */

import supabase from '../../utils/supabaseToPrismaAdapter.js'
import logger from '../../utils/logger.js'
import { verifyComment } from './browserService.js'
import { comprehensiveVerify, VERIFY_MODE } from './ruleVerificationService.js'
import reviewConfig from './reviewConfigService.js'
import proxyPoolService from './proxyPoolService.js'
import { sendAdminNotification, sendUserNotification } from '../notificationService.js'
import { ADMIN_NOTIFICATION_TYPES, USER_NOTIFICATION_TYPES } from '../../constants/taskActions.js'
import pointsSettlementService from '../pointsSettlementService.js'

// 默认配置
const DEFAULT_CONFIG = {
  enabled: true,
  delayMinutes: 15,           // 延迟审查时间（分钟）
  batchThreshold: 5,          // 批量处理阈值
  maxWaitMinutes: 60,         // 最大等待时间（分钟）
  batchSize: 10,              // 单次批量处理数量
  maxRetries: 3               // 最大重试次数
}

/**
 * 获取配置
 */
async function getConfig() {
  try {
    const { data, error } = await supabase
      .from('ai_configs')
      .select('key, value')
      .in('key', [
        'link_verify_enabled',
        'link_verify_delay_minutes',
        'link_verify_batch_threshold',
        'link_verify_max_wait_minutes',
        'link_verify_batch_size',
        'link_verify_retry_count'
      ])
    
    if (error || !data) return DEFAULT_CONFIG
    
    const config = { ...DEFAULT_CONFIG }
    for (const item of data) {
      const key = item.key.replace('link_verify_', '')
      const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
      if (item.value === 'true') config[camelKey] = true
      else if (item.value === 'false') config[camelKey] = false
      else if (!isNaN(item.value)) config[camelKey] = parseInt(item.value)
      else config[camelKey] = item.value
    }
    return config
  } catch (e) {
    return DEFAULT_CONFIG
  }
}

/**
 * 添加到链接审查队列
 * 
 * @param {Object} params - 审查参数
 * @param {number} params.claimId - 领取记录ID
 * @param {number} params.userId - 用户ID
 * @param {number} params.taskId - 任务ID
 * @param {string} params.videoUrl - 视频链接
 * @param {string} params.comment - 评论内容
 * @param {string} params.userName - 用户名
 * @param {string} params.platform - 平台
 * @returns {Object} 队列记录
 */
export async function enqueueLinkVerification(params) {
  const {
    claimId,
    userId,
    taskId,
    videoUrl,
    comment,
    userName,
    platform,
    taskAuthorName,
    commentAuthor
  } = params
  
  // 没有视频链接或评论，不需要审查
  if (!videoUrl || !comment) {
    logger.info(`[LinkVerify] claimId=${claimId} 无需链接审查（无视频或评论）`)
    return { skipped: true, reason: '无视频链接或评论' }
  }
  
  const config = await getConfig()
  
  if (!config.enabled) {
    logger.info(`[LinkVerify] 链接审查已禁用`)
    return { skipped: true, reason: '链接审查已禁用' }
  }
  
  // 计算时间
  const now = new Date()
  const scheduledAt = new Date(now.getTime() + config.delayMinutes * 60 * 1000)
  const maxProcessAt = new Date(now.getTime() + config.maxWaitMinutes * 60 * 1000)
  
  try {
    // 检查是否已存在
    const { data: existing } = await supabase
      .from('link_verification_queue')
      .select('id, status')
      .eq('claim_id', claimId)
      .maybeSingle()
    
    if (existing) {
      // 更新现有记录
      const { data, error } = await supabase
        .from('link_verification_queue')
        .update({
          video_url: videoUrl,
          comment,
          user_name: userName,
        comment_author: commentAuthor,
          platform,
          status: 'pending',
          scheduled_at: scheduledAt.toISOString(),
          max_process_at: maxProcessAt.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single()
      
      if (error) throw error
      
      logger.info(`[LinkVerify] 更新队列: claimId=${claimId}, 计划时间=${scheduledAt.toLocaleString()}`)
      return { queued: true, id: data.id, scheduledAt }
    }
    
    // 创建新记录
    const { data, error } = await supabase
      .from('link_verification_queue')
      .insert({
        claim_id: claimId,
        user_id: userId,
        task_id: taskId,
        video_url: videoUrl,
        comment,
        user_name: userName,
        comment_author: commentAuthor,
        platform,
        status: 'pending',
        scheduled_at: scheduledAt.toISOString(),
        max_process_at: maxProcessAt.toISOString(),
        comment_author: commentAuthor,
        screenshot_verified_at: now.toISOString()
      })
      .select()
      .single()
    
    if (error) throw error
    
    logger.info(`[LinkVerify] 入队成功: claimId=${claimId}, 计划时间=${scheduledAt.toLocaleString()}`)
    
    // 检查是否达到批量阈值
    await checkBatchThreshold(config)
    
    return { queued: true, id: data.id, scheduledAt }
    
  } catch (error) {
    logger.error(`[LinkVerify] 入队失败:`, error)
    return { error: error.message }
  }
}

/**
 * 检查是否达到批量处理阈值
 */
async function checkBatchThreshold(config) {
  try {
    const { count } = await supabase
      .from('link_verification_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ready')
    
    if (count >= config.batchThreshold) {
      logger.info(`[LinkVerify] 达到批量阈值: ${count} >= ${config.batchThreshold}`)
      // 触发批量处理
      processReadyBatch().catch(e => logger.error('[LinkVerify] 批量处理失败:', e))
    }
  } catch (e) {
    logger.error('[LinkVerify] 检查批量阈值失败:', e)
  }
}

/**
 * 处理待审查的链接
 * 1. 将到达计划时间的 pending 更新为 ready
 * 2. 将超过最大等待时间的强制更新为 ready
 * 3. 批量处理 ready 状态的任务
 */
export async function processPendingLinks() {
  const config = await getConfig()
  const now = new Date()
  
  try {
    // 1. 将到达计划时间的 pending 更新为 ready
    await supabase
      .from('link_verification_queue')
      .update({ status: 'ready', updated_at: now.toISOString() })
      .eq('status', 'pending')
      .lte('scheduled_at', now.toISOString())
    
    // 2. 将超过最大等待时间的强制更新为 ready（优先级更高）
    const { data: overdue, error } = await supabase
      .from('link_verification_queue')
      .update({ 
        status: 'ready', 
        priority: 10,  // 提高优先级
        updated_at: now.toISOString() 
      })
      .eq('status', 'pending')
      .lte('max_process_at', now.toISOString())
      .select('id, claim_id')
    
    if (overdue && overdue.length > 0) {
      logger.warn(`[LinkVerify] 发现${overdue.length}条超时任务，强制处理`)
    }
    
    // 3. 统计待处理数量
    const { count } = await supabase
      .from('link_verification_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ready')
    
    if (count === 0) {
      return { processed: 0, message: '无待处理任务' }
    }
    
    // 4. 检查ready状态的超时任务
    const { data: readyOverdue } = await supabase
      .from('link_verification_queue')
      .select('id, claim_id')
      .eq('status', 'ready')
      .lte('max_process_at', now.toISOString())
    
    if (readyOverdue && readyOverdue.length > 0) {
      logger.warn(`[LinkVerify] 发现${readyOverdue.length}条ready状态超时任务，强制处理`)
      // 更新优先级
      await supabase
        .from('link_verification_queue')
        .update({ priority: 10, updated_at: now.toISOString() })
        .in('id', readyOverdue.map(t => t.id))
    }
    
    // 5. 如果达到批量阈值或有超时任务，开始处理
    if (count >= config.batchThreshold || (overdue && overdue.length > 0) || (readyOverdue && readyOverdue.length > 0)) {
      return await processReadyBatch(config)
    }
    
    return { pending: count, message: '等待更多任务积累' }
    
  } catch (error) {
    logger.error('[LinkVerify] 处理待审查链接失败:', error)
    return { error: error.message }
  }
}

/**
 * 批量处理 ready 状态的任务
 */
export async function processReadyBatch(oldConfig = null) {
  // 使用全局审核配置
  const reviewSettings = await reviewConfig.getConfig()
  const config = {
    batchSize: reviewSettings.linkVerify.batchSize,
    maxRetries: reviewSettings.linkVerify.retryCount,
    ...oldConfig
  }
  
  const now = new Date()
  const processed = []
  const errors = []
  
  try {
    // 获取待处理任务
    const { data: items, error } = await supabase
      .from('link_verification_queue')
      .select('*')
      .eq('status', 'ready')
      .order('priority', { ascending: false })  // 优先级高的先处理
      .order('created_at', { ascending: true })  // 同优先级按创建时间
      .limit(config.batchSize)
    
    if (error || !items || items.length === 0) {
      return { processed: 0, message: '无待处理任务' }
    }
    
    logger.info(`[LinkVerify] 开始批量处理 ${items.length} 条任务`)
    
    // 获取代理IP（一个IP处理一批）
    const proxyIP = await proxyPoolService.getAvailableIP()
    
    for (const item of items) {
      try {
        // 更新状态为处理中
        await supabase
          .from('link_verification_queue')
          .update({ 
            status: 'processing', 
            proxy_ip: proxyIP?.ip_address,
            proxy_used_at: now.toISOString(),
            updated_at: now.toISOString()
          })
          .eq('id', item.id)
        // 执行链接验证（访问视频页面，提取评论）
        const linkResult = await verifyComment(
          item.video_url,
          item.comment,
          item.user_name,
          { proxy: proxyIP, taskAuthorName: item.task_author_name }
        )
        
        // 综合验证：昵称一致性 + 评论内容一致性 + 语意识别
        let comprehensiveResult = {
          passed: Boolean(linkResult.verified),
          reason: '基础链接验证结果'
        }
        let finalVerified = Boolean(linkResult.verified)
        
        // 根据配置决定是否进行综合验证
        if (linkResult.verified && linkResult.extractedComments) {
          // 从提取的评论中找到匹配的评论
          const matchedComment = linkResult.extractedComments.find(c => 
            c.text && c.text.includes(item.comment?.substring(0, 20))
          )
          
          // 规则验证 + AI语意识别（根据配置）
          comprehensiveResult = await comprehensiveVerify({
            screenshotNickname: item.comment_author || matchedComment?.author,
            claimNickname: item.user_name,
            screenshotComment: matchedComment?.text || item.comment,
            claimedComment: item.comment,
            taskInfo: {
              title: item.task_title,
              description: item.task_description,
              platform: item.platform
            },
            // 传入配置
            config: {
              checkCommentNickname: reviewSettings.checks.commentNickname,
              checkComment: reviewSettings.checks.comment,
              semanticEnabled: reviewSettings.semantic.enabled,
              semanticMode: reviewSettings.semantic.mode,
              commentMinLength: reviewSettings.comment.minLength
            }
          })
          
          finalVerified = comprehensiveResult.passed
          logger.info('[LinkVerify] 综合验证结果:', finalVerified, comprehensiveResult.reason)
        }
        
        
        // 更新结果
        const result = {
          ...linkResult,
          comprehensive: comprehensiveResult,
          verified: finalVerified,
          finalVerified
        }
        
        const updateData = {
          status: 'completed',
          verification_result: result,
          verified: finalVerified,
          processed_at: now.toISOString(),
          updated_at: now.toISOString()
        }
        
        if (!finalVerified && (linkResult.error || comprehensiveResult?.reason)) {
          updateData.error_message = linkResult.error || comprehensiveResult.reason
        }
        
        await supabase
          .from('link_verification_queue')
          .update(updateData)
          .eq('id', item.id)
        
        // 记录代理使用结果
        if (proxyIP) {
          await proxyPoolService.recordIPResult(
            proxyIP.ip_address,
            finalVerified || !linkResult.error,
            linkResult.error || 'success'
          )
        }
        
        // 更新 Claim 的链接验证结果（含封控检测）
        await updateClaimLinkVerificationWithBlock(item.claim_id, result)
        
        processed.push({
          id: item.id,
          claimId: item.claim_id,
          verified: finalVerified,
          matchType: result.matchType
        })
        
        logger.info(`[LinkVerify] claimId=${item.claim_id} 验证完成: ${finalVerified ? '通过' : '未通过'}`)
        
      } catch (itemError) {
        errors.push({
          id: item.id,
          claimId: item.claim_id,
          error: itemError.message
        })
        
        // 更新失败状态
        await supabase
          .from('link_verification_queue')
          .update({
            status: item.retry_count >= config.maxRetries ? 'failed' : 'ready',
            retry_count: item.retry_count + 1,
            error_message: itemError.message,
            updated_at: now.toISOString()
          })
          .eq('id', item.id)
        
        logger.error(`[LinkVerify] claimId=${item.claim_id} 处理失败:`, itemError.message)
      }
    }
    
    return {
      processed: processed.length,
      errors: errors.length,
      details: processed,
      errorDetails: errors
    }
    
  } catch (error) {
    logger.error('[LinkVerify] 批量处理失败:', error)
    return { error: error.message, processed: 0 }
  }
}

/**
 * 获取队列统计
 */
export async function getQueueStats() {
  try {
    const { data, error } = await supabase
      .from('link_verification_queue')
      .select('status')
    
    if (error) throw error
    
    const stats = {
      total: data.length,
      pending: data.filter(d => d.status === 'pending').length,
      ready: data.filter(d => d.status === 'ready').length,
      processing: data.filter(d => d.status === 'processing').length,
      completed: data.filter(d => d.status === 'completed').length,
      failed: data.filter(d => d.status === 'failed').length
    }
    
    return stats
  } catch (e) {
    return { error: e.message }
  }
}

/**
 * 获取配置信息
 */
export async function getConfigInfo() {
  return await getConfig()
}

/**
 * 更新配置
 */
export async function updateConfig(key, value) {
  try {
    const { error } = await supabase
      .from('ai_configs')
      .update({ value: String(value), updated_at: new Date().toISOString() })
      .eq('key', `link_verify_${key}`)
    
    if (error) throw error
    return { success: true }
  } catch (e) {
    return { error: e.message }
  }
}

// ==================== 封控检测相关方法 ====================

/**
 * 更新Claim的链接验证结果（增强版，含封控检测）
 */
async function updateClaimLinkVerificationWithBlock(claimId, result) {
  try {
    // 获取当前的AI结果和完整claim信息
    const { data: claim } = await supabase
      .from('claims')
      .select('*, users(points, total_points), tasks(title, reward, base_reward)')
      .eq('id', claimId)
      .single()
    
    const aiResult = claim?.ai_result || {}
    aiResult.linkVerification = {
      verified: result.verified,
      matchType: result.matchType,
      foundComment: result.foundComment,
      searchedComments: result.searchedComments,
      verifiedAt: new Date().toISOString()
    }
    
    const updateData = { ai_result: aiResult }
    
    if (result.verified) {
      // 链接审核通过，任务完成
      updateData.status = 'approved'
      updateData.link_review_status = 'passed'
      updateData.link_reviewed_at = new Date().toISOString()
      updateData.ai_review_status = 'approved'
      updateData.reviewed_at = new Date().toISOString()
      
      // 更新Claim状态
      await supabase
        .from('claims')
        .update(updateData)
        .eq('id', claimId)
      
      const settlement = await pointsSettlementService.awardClaimPoints({
        claimId,
        userId: claim.user_id,
        taskId: claim.task_id,
        awardReason: '链接审核通过',
        source: 'ai_link_verification_service'
      })

      logger.info(
        '[LinkVerify] claimId=' + claimId + ' 链接审核通过，积分结算=' + (settlement?.finalPoints || 0)
      )
      
    } else {
      // 链接审核失败，更新状态为 link_rejected（允许用户重新提交）
      updateData.status = 'link_rejected'
      updateData.link_review_status = 'rejected'
      updateData.link_reviewed_at = new Date().toISOString()
      updateData.submitted_at = null  // 清空提交时间，允许重新提交
      
      logger.warn('[LinkVerify] claimId=' + claimId + ' 链接审核失败，触发封控检测')
      
      // 更新Claim状态
      await supabase
        .from('claims')
        .update(updateData)
        .eq('id', claimId)
      
      // 触发封控检测
      await detectBlockAccount({
        claimId,
        userId: claim.user_id,
        platform: claim.tasks?.platform || claim.platform,
        platformUsername: claim.platform_nickname,
        failReason: result.error || '链接验证失败',
        evidence: result
      })
    }
    
  } catch (e) {
    logger.error('[LinkVerify] 更新Claim失败:', e)
  }
}

async function detectBlockAccount(params) {
  const {
    claimId,
    userId,
    platform,
    platformUsername,
    failReason,
    evidence
  } = params
  
  logger.info('[BlockDetect] 开始封控检测: claimId=' + claimId + ', platform=' + platform + ', username=' + platformUsername)
  
  try {
    // 动态导入blockedAccountsService
    const blockedAccountsService = await import('./blockedAccountsService.js')
    
    // 提取平台用户ID（如果有）
    let platformUserId = null
    if (evidence && evidence.videoUrl) {
      // 从视频URL中提取用户ID（平台相关）
      // TODO: 根据不同平台解析用户ID
      platformUserId = platformUsername
    }
    
    const result = await blockedAccountsService.detectAndRecordBlock({
      userId,
      claimId,
      platform,
      platformUserId: platformUserId || platformUsername,
      platformUsername,
      failReason,
      evidence: {
        linkVerification: evidence,
        detectedAt: new Date().toISOString()
      }
    })
    
    if (result.isNewBlock) {
      logger.info('[BlockDetect] 新增疑似封控记录：blockId=' + result.block.id)
      
      // 发送管理员通知
      try {
        await sendAdminNotification({
          type: ADMIN_NOTIFICATION_TYPES.BLOCK_DETECTED,
          title: '疑似封控账号检测',
          message: `用户${platformUsername}在${platform}平台疑似被风控`,
          data: { 
            blockId: result.block.id, 
            userId, 
            platform,
            platformUsername,
            claimId
          },
          priority: 'high'
        })
        logger.info('[BlockDetect] 管理员通知已发送')
      } catch (notifError) {
        logger.error('[BlockDetect] 发送管理员通知失败:', notifError)
      }
      
      // 发送用户通知
      try {
        await sendUserNotification({
          userId,
          type: USER_NOTIFICATION_TYPES.BLOCK_DETECTED,
          title: '账号异常提醒',
          message: '您的账号可能存在异常，请及时联系客服处理',
          data: {
            platform,
            detectedAt: new Date().toISOString()
          }
        })
        logger.info('[BlockDetect] 用户通知已发送')
      } catch (notifError) {
        logger.error('[BlockDetect] 发送用户通知失败:', notifError)
      }
    } else {
      logger.info('[BlockDetect] 已存在封控记录：status=' + result.status)
    }
    
    return result
    
  } catch (error) {
    logger.error('[BlockDetect] 封控检测失败:', error)
    
    // 即使封控检测失败，也更新任务状态
    await supabase
      .from('claims')
      .update({
        block_status: 'suspected',
        status: 'pending_manual'
      })
      .eq('id', claimId)
    
    return { error: error.message }
  }
}


// 导出方法
export { 
  updateClaimLinkVerificationWithBlock, 
  detectBlockAccount 
}

export default {
  enqueueLinkVerification,
  processPendingLinks,
  processReadyBatch,
  getQueueStats,
  getConfigInfo,
  updateConfig,
  updateClaimLinkVerificationWithBlock,
  detectBlockAccount
}
