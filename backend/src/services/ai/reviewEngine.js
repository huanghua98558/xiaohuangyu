import { streamLLM, invokeLLM } from './llmService.js'
import { verifyComment } from './browserService.js'
import { getConfig, getReviewerConfig } from './configService.js'
import { logOperation } from './operationLogService.js'
// 视觉模型已删除，使用 imageReviewService
import { analyzeScreenshotsWithOCR } from './paddleOcrClient.js'
import { TASK_ACTIONS, needsCommentCheck, getActionCheckConfig } from '../../constants/taskActions.js'
import supabase from '../../utils/supabaseToPrismaAdapter.js'
import logger from '../../utils/logger.js'
import { analyzeCommentDimensionV5 } from './commentAnalysisV5.js'

// 审核维度权重（基础权重，会根据实际存在的维度动态调整）
const DIMENSION_WEIGHTS = {
  screenshot: 0.40,    // 截图分析权重
  linkVerify: 0.30,    // 链接验证权重
  commentAnalysis: 0.20, // 评论语义分析权重
  userBehavior: 0.10   // 用户行为分析权重
}

// 审核维度结果
const DIMENSION_RESULTS = {
  APPROVED: 'approved',
  REJECTED: 'rejected',
  MANUAL: 'manual',
  ERROR: 'error'
}

/**
 * 从任务标题中提取达人名字
 */
function extractAuthorFromTitle(title) {
  if (!title) return ''
  // 格式: "达人名字-日期" 或 "达人名字 - 日期" 或 "达人名字-3月16日"
  // 匹配 "-" 后面跟数字的情况（日期格式）
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
 * 获取审核规则
 */
async function getReviewRule(platform, action) {
  const { data: rule } = await supabase
    .from('review_rules')
    .select('*')
    .eq('platform', platform)
    .eq('action', action)
    .eq('is_active', true)
    .single()
  
  return rule
}

/**
 * 维度1: 截图分析
 * 使用最新的审核助手截图分析逻辑
 */
async function analyzeScreenshotDimension(screenshots, action, rule, headers = {}, context = {}) {
  const startTime = Date.now()
  
  try {
    // 检查截图是否存在
    if (!screenshots || screenshots.length === 0) {
      return {
        dimension: 'screenshot',
        result: DIMENSION_RESULTS.REJECTED,
        confidence: 0,
        details: {
          foundActions: [],
          missingActions: ['截图'],
          analysisText: '用户未提交截图，无法进行审核',
          checkItems: []
        },
        duration: Date.now() - startTime
      }
    }
    
    // 过滤空URL
    const validScreenshots = screenshots.filter(url => url && url.trim() !== '')
    if (validScreenshots.length === 0) {
      return {
        dimension: 'screenshot',
        result: DIMENSION_RESULTS.REJECTED,
        confidence: 0,
        details: {
          foundActions: [],
          missingActions: ['有效截图'],
          analysisText: '截图URL为空，无法进行审核',
          checkItems: []
        },
        duration: Date.now() - startTime
      }
    }
    
    // 使用最新的审核助手截图分析逻辑
    const result = await analyzeScreenshotsWithOCR(validScreenshots, action)
    
    return {
      dimension: 'screenshot',
      result: result.passed ? DIMENSION_RESULTS.APPROVED : DIMENSION_RESULTS.REJECTED,
      confidence: result.confidence,
      details: {
        foundActions: result.foundActions || [],
        missingActions: result.missingActions || [],
        analysisText: result.details || '',
        rejectionReason: result.rejectionReason || '',
        
        
        checkItems: rule?.rule_config?.checkItems || []
      },
      duration: Date.now() - startTime
    }
    
  } catch (error) {
    logger.error('截图分析维度失败:', error)
    return {
      dimension: 'screenshot',
      result: DIMENSION_RESULTS.ERROR,
      confidence: 0,
      error: error.message,
      duration: Date.now() - startTime
    }
  }
}

/**
 * 构建截图分析提示词
 */
function buildScreenshotPrompt(action, checkItems) {
  const actionDescriptions = {
    like: '点赞操作 - 检查点赞按钮是否已变为红色/高亮状态',
    follow: '关注操作 - 检查关注按钮是否已变为"已关注"状态',
    collect: '收藏操作 - 检查收藏按钮是否已高亮',
    share: '转发操作 - 检查转发记录',
    comment: '评论操作 - 检查评论内容是否可见',
    like_comment: '点赞+评论操作 - 需要同时检测点赞和评论',
    like_collect: '点赞+收藏操作 - 需要同时检测',
    like_follow: '点赞+关注操作 - 需要同时检测'
  }
  
  const itemDescriptions = {
    like_button: '点赞按钮状态（是否已点赞）',
    like_count: '点赞数是否增加',
    follow_button: '关注按钮状态（是否已关注）',
    follower_count: '粉丝数是否变化',
    collect_button: '收藏按钮状态',
    collect_count: '收藏数是否增加',
    comment_text: '评论内容',
    comment_position: '评论位置',
    username_match: '评论用户名是否与截图中的用户匹配'
  }
  
  const checkList = checkItems.map(item => `- ${itemDescriptions[item] || item}`).join('\n')
  
  return `你是一个专业的任务审核助手，负责分析用户提交的任务截图。

任务类型: ${actionDescriptions[action] || action}

需要检测的项目:
${checkList}

请仔细分析截图，判断用户是否完成了所需操作。

请以JSON格式返回分析结果：
{
  "passed": true/false,
  "confidence": 0.0-1.0,
  "foundActions": ["检测到完成的操作"],
  "missingActions": ["未完成的操作"],
  "details": "详细分析说明",
  "evidence": ["截图中的证据描述"]
}

注意:
1. 仔细观察按钮颜色、状态变化
2. 检查数字是否合理
3. 对于评论，检查内容是否相关
4. confidence为置信度，0-1之间，1表示非常确定`
}

/**
 * 解析分析结果
 */
function parseAnalysisResult(response) {
  try {
    // 尝试提取JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    
    // 尝试解析整体
    return JSON.parse(response)
  } catch (error) {
    logger.warn('解析分析结果失败，使用默认值:', error)
    return {
      passed: false,
      confidence: 0.5,
      details: '无法解析AI响应',
      rawResponse: response
    }
  }
}

/**
 * 维度2: 链接验证
 * 打开视频链接验证用户评论是否真实存在
 */
async function verifyLinkDimension(videoUrl, comment, userName, platform, headers = {}) {
  const startTime = Date.now()
  
  // 如果不需要评论验证，直接返回通过
  if (!comment || comment.trim() === '') {
    return {
      dimension: 'linkVerify',
      result: DIMENSION_RESULTS.APPROVED,
      confidence: 1.0,
      details: { skipped: true, reason: '无评论内容需要验证' },
      duration: Date.now() - startTime
    }
  }
  
  try {
    const result = await verifyComment(videoUrl, comment, userName)
    
    return {
      dimension: 'linkVerify',
      result: result.verified ? DIMENSION_RESULTS.APPROVED : 
              (result.error ? DIMENSION_RESULTS.MANUAL : DIMENSION_RESULTS.REJECTED),
      confidence: result.confidence || 0,
      details: {
        verified: result.verified,
        matchType: result.matchType,
        foundComment: result.foundComment,
        searchedComments: result.searchedComments,
        error: result.error
      },
      duration: Date.now() - startTime
    }
    
  } catch (error) {
    logger.error('链接验证维度失败:', error)
    return {
      dimension: 'linkVerify',
      result: DIMENSION_RESULTS.MANUAL,
      confidence: 0,
      details: { error: error.message },
      duration: Date.now() - startTime
    }
  }
}

/**
 * 维度3: 评论语义分析 V5.0（本地免费版）
 * 零成本、毫秒级响应
 * 检测：字数、无意义内容、模板评论
 */
async function analyzeCommentDimension(comment, requirements, headers = {}) {
  // 直接调用V5版本
  return await analyzeCommentDimensionV5(comment, requirements, headers)
}

/**
 * 维度4: 用户行为分析
 * 检查用户历史行为模式
 */
async function analyzeUserBehavior(userId, claimId, headers = {}) {
  const startTime = Date.now()
  
  try {
    // 获取用户统计（使用实际存在的字段）
    const { data: userStats } = await supabase
      .from('users')
      .select('level, total_points, total_tasks')
      .eq('id', userId)
      .single()
    
    // 获取用户最近的审核记录
    const { data: recentClaims } = await supabase
      .from('claims')
      .select('status, ai_confidence, created_at')
      .eq('user_id', userId)
      .in('status', ['done', 'rejected'])
      .order('created_at', { ascending: false })
      .limit(20)
    
    // 计算用户信誉分数
    const totalClaims = recentClaims?.length || 0
    const rejectedCount = recentClaims?.filter(c => c.status === 'rejected').length || 0
    const avgConfidence = recentClaims?.reduce((sum, c) => sum + (c.ai_confidence || 0.5), 0) / (totalClaims || 1)
    
    // 检测异常模式
    const issues = []
    
    // 高拒绝率
    if (totalClaims >= 5 && rejectedCount / totalClaims > 0.3) {
      issues.push('拒绝率异常高')
    }
    
    // 低平均置信度
    if (totalClaims >= 5 && avgConfidence < 0.7) {
      issues.push('平均审核置信度低')
    }
    
    // 检查是否在可疑用户名单
    const { data: suspicious } = await supabase
      .from('suspicious_users')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'cleared')
      .maybeSingle()
    
    if (suspicious) {
      issues.push(`可疑用户标记: ${suspicious.suspicion_type}`)
    }
    
    // 计算信誉分数
    const rejectionRate = totalClaims > 0 ? rejectedCount / totalClaims : 0
    const reputationScore = Math.max(0, Math.min(1, 
      1 - rejectionRate * 0.5 - (suspicious ? 0.3 : 0) - (issues.length * 0.1)
    ))
    
    return {
      dimension: 'userBehavior',
      result: reputationScore >= 0.5 ? DIMENSION_RESULTS.APPROVED : DIMENSION_RESULTS.MANUAL,
      confidence: reputationScore,
      details: {
        level: userStats?.level || 1,
        totalClaims,
        rejectedCount,
        rejectionRate: Math.round(rejectionRate * 100),
        avgConfidence,
        issues,
        isSuspicious: !!suspicious
      },
      duration: Date.now() - startTime
    }
    
  } catch (error) {
    logger.error('用户行为分析失败:', error)
    return {
      dimension: 'userBehavior',
      result: DIMENSION_RESULTS.MANUAL,
      confidence: 0.5,
      error: error.message,
      duration: Date.now() - startTime
    }
  }
}

/**
 * 综合审核 - 主入口
 * 整合所有维度进行综合判断
 */
export async function comprehensiveReview(claimId, options = {}) {
  const startTime = Date.now()
  
  // 获取Claim数据（不使用外键关联）
  const { data: claim, error: claimError } = await supabase
    .from('claims')
    .select('*')
    .eq('id', claimId)
    .single()
  
  if (claimError || !claim) {
    throw new Error('领取记录不存在')
  }
  
  // 分别查询关联的 task 和 user
  let task = null
  let user = null
  
  if (claim.task_id) {
    const { data: taskData } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', claim.task_id)
      .single()
    task = taskData
  }
  
  if (claim.user_id) {
    const { data: userData } = await supabase
      .from('users')
      .select('id, username, level')
      .eq('id', claim.user_id)
      .single()
    user = userData
  }
  
  const screenshots = JSON.parse(claim.screenshots || '[]')
  const videoUrl = task?.video_url
  const platform = task?.platform || claim.platform
  const action = task?.action || claim.action
  
  // 获取审核规则
  const rule = await getReviewRule(platform, action)
  const thresholds = rule?.thresholds || { approve: 0.85, reject: 0.6 }
  
  // 构建截图分析的上下文
  const screenshotContext = {
    taskTitle: task?.title || '',
    taskAuthor: task?.title ? extractAuthorFromTitle(task.title) : '',
    platform
  }
  
  // 并行执行各维度检测
  const dimensionResults = {}
  
  // 1. 截图分析（必须）
  dimensionResults.screenshot = await analyzeScreenshotDimension(
    screenshots,
    action,
    rule,
    options.headers,
    screenshotContext
  )
  
  // 从截图分析结果中提取评论内容
  const commentFromScreenshot = dimensionResults.screenshot?.details?.comment?.content || ''
  const commentText = options.commentText || commentFromScreenshot
  
  // 判断是否需要执行评论相关检测（使用常量定义的函数）
  const shouldCheckComment = needsCommentCheck(action)
  
  // 2. 链接验证（短视频内容体验调研任务或评论任务，且有视频链接和评论内容）
  if (shouldCheckComment && videoUrl && commentText) {
    dimensionResults.linkVerify = await verifyLinkDimension(
      videoUrl,
      commentText,
      user?.username,
      platform,
      options.headers
    )
  }
  
  // 3. 评论语义分析（短视频内容体验调研任务或评论任务，且有评论内容）
  if (shouldCheckComment && commentText) {
    dimensionResults.commentAnalysis = await analyzeCommentDimension(
      commentText,
      task?.requirements,
      options.headers
    )
  }
  
  // 4. 用户行为分析（始终执行）
  dimensionResults.userBehavior = await analyzeUserBehavior(
    claim.user_id,
    claimId,
    options.headers
  )
  
  // 计算加权置信度
  let totalWeight = 0
  let weightedConfidence = 0
  
  for (const [dimension, result] of Object.entries(dimensionResults)) {
    const weight = DIMENSION_WEIGHTS[dimension] || 0.1
    if (result.confidence !== undefined) {
      weightedConfidence += result.confidence * weight
      totalWeight += weight
    }
  }
  
  const finalConfidence = totalWeight > 0 ? weightedConfidence / totalWeight : 0.5
  
  // 综合决策
  let finalDecision = DIMENSION_RESULTS.MANUAL
  let decisionReason = ''
  
  // 检查是否有严重问题（硬规则，不依赖置信度）
  const criticalIssues = Object.entries(dimensionResults)
    .filter(([_, r]) => r.result === DIMENSION_RESULTS.REJECTED)
  
  if (criticalIssues.length > 0) {
    // 硬规则：有严重问题直接拒绝
    finalDecision = DIMENSION_RESULTS.REJECTED
    decisionReason = `检测到问题: ${criticalIssues.map(([d, _]) => d).join(', ')}`
  } else {
    // 无严重问题：通过
    finalDecision = DIMENSION_RESULTS.APPROVED
    decisionReason = `所有检测项通过`
  }
  
  // 更新Claim
  await supabase
    .from('claims')
    .update({
      ai_review_status: finalDecision,
      ai_confidence: finalConfidence,
      ai_reason: decisionReason,
      ai_reviewed_at: new Date().toISOString()
    })
    .eq('id', claimId)
  
  // 如果需要人工审核，创建报告
  if (finalDecision === DIMENSION_RESULTS.MANUAL) {
    await createReviewReport(claimId, dimensionResults, decisionReason)
  }
  
  // 记录日志
  await logOperation({
    userId: 0,
    type: 'reviewer',
    action: 'comprehensive_review',
    input: { claimId, platform, action },
    output: {
      decision: finalDecision,
      confidence: finalConfidence,
      dimensions: Object.fromEntries(
        Object.entries(dimensionResults).map(([k, v]) => [k, v.confidence])
      )
    },
    status: 'success',
    duration: Date.now() - startTime
  })
  
  return {
    claimId,
    decision: finalDecision,
    confidence: finalConfidence,
    reason: decisionReason,
    dimensions: dimensionResults,
    thresholds,
    duration: Date.now() - startTime
  }
}

/**
 * 创建审核报告（需要人工审核时）
 */
async function createReviewReport(claimId, dimensions, reason) {
  // 收集判定困难的原因
  const difficultyReasons = []
  
  for (const [dimension, result] of Object.entries(dimensions)) {
    if (result.result === DIMENSION_RESULTS.MANUAL) {
      difficultyReasons.push({
        dimension,
        confidence: result.confidence,
        issues: result.details?.issues || result.details?.error || '置信度不足'
      })
    }
  }
  
  const { data: existingReport } = await supabase
    .from('review_reports')
    .select('id')
    .eq('claim_id', claimId)
    .eq('status', 'pending')
    .maybeSingle()
  
  if (existingReport) {
    return existingReport
  }
  
  const { data: report, error } = await supabase
    .from('review_reports')
    .insert({
      claim_id: claimId,
      report_type: 'ai_undetermined',
      ai_analysis: dimensions,
      difficulty_reasons: difficultyReasons,
      human_required: true,
      status: 'pending',
      priority: calculatePriority(dimensions)
    })
    .select()
    .single()
  
  if (error) {
    logger.error('创建审核报告失败:', error)
  }
  
  return report
}

/**
 * 计算报告优先级
 */
function calculatePriority(dimensions) {
  let priority = 0
  
  for (const result of Object.values(dimensions)) {
    if (result.result === DIMENSION_RESULTS.ERROR) priority += 3
    if (result.confidence && result.confidence < 0.6) priority += 2
    if (result.details?.issues?.length > 0) priority += result.details.issues.length
  }
  
  return Math.min(priority, 10)
}

/**
 * 批量综合审核
 */
export async function batchComprehensiveReview(claimIds, options = {}) {
  const results = []
  
  for (const claimId of claimIds) {
    try {
      const result = await comprehensiveReview(claimId, options)
      results.push(result)
      
      // 间隔避免过载
      await new Promise(r => setTimeout(r, 500))
    } catch (error) {
      results.push({
        claimId,
        decision: DIMENSION_RESULTS.ERROR,
        error: error.message
      })
    }
  }
  
  return {
    total: claimIds.length,
    results,
    summary: {
      approved: results.filter(r => r.decision === DIMENSION_RESULTS.APPROVED).length,
      rejected: results.filter(r => r.decision === DIMENSION_RESULTS.REJECTED).length,
      manual: results.filter(r => r.decision === DIMENSION_RESULTS.MANUAL).length,
      error: results.filter(r => r.decision === DIMENSION_RESULTS.ERROR).length
    }
  }
}

export default {
  comprehensiveReview,
  batchComprehensiveReview,
  analyzeScreenshotDimension,
  verifyLinkDimension,
  analyzeCommentDimension,
  analyzeUserBehavior,
  DIMENSION_RESULTS
}
