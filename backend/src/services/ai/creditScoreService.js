/**
 * 用户信用分服务 - Supabase版
 * 
 * 基于用户历史行为计算信用分：
 * 1. 历史通过率
 * 2. 完成速度异常检测
 * 3. 活跃时间模式
 * 4. 作弊记录
 * 
 * 信用分范围：0-100
 * - 90-100：优秀，自动审核优先通过
 * - 70-89：良好，正常审核流程
 * - 50-69：一般，加强审核
 * - 0-49：风险用户，人工审核
 * 
 * 数据存储：所有数据存储在Supabase
 */

import supabase from '../../utils/supabaseToPrismaAdapter.js'
import logger from '../../utils/logger.js'

// 信用分权重配置
const WEIGHTS = {
  passRate: 0.35,
  speedScore: 0.25,
  frequencyScore: 0.20,
  cheatScore: 0.20
}

// 默认配置
const DEFAULT_CONFIG = {
  excellentPassRate: 0.95,
  goodPassRate: 0.85,
  normalPassRate: 0.70,
  minCompleteTime: 30,
  normalCompleteTime: 120,
  maxHourlyTasks: 20,
  maxDailyTasks: 100,
  highCreditThreshold: 90,
  normalCreditThreshold: 70,
  lowCreditThreshold: 50
}

/**
 * 计算用户信用分
 * @param {number} userId - 用户ID
 * @returns {Object} 信用分详情
 */
export async function calculateUserCreditScore(userId) {
  try {
    // 获取用户统计数据
    const stats = await getUserStats(userId)
    
    // 计算各维度得分
    const passRateScore = calculatePassRateScore(stats.passRate)
    const speedScore = calculateSpeedScore(stats.avgCompleteTime, stats.minCompleteTime)
    const frequencyScore = calculateFrequencyScore(stats.hourlyTasks, stats.dailyTasks)
    const cheatScore = calculateCheatScore(stats.cheatCount, stats.warningCount)
    
    // 加权计算总分
    const totalScore = Math.round(
      passRateScore * WEIGHTS.passRate +
      speedScore * WEIGHTS.speedScore +
      frequencyScore * WEIGHTS.frequencyScore +
      cheatScore * WEIGHTS.cheatScore
    )
    
    const finalScore = Math.max(0, Math.min(100, totalScore))
    const level = getCreditLevel(finalScore)
    const randomCheckRate = calculateRandomCheckRate(finalScore)
    
    return {
      score: finalScore,
      level,
      components: {
        passRateScore,
        speedScore,
        frequencyScore,
        cheatScore
      },
      stats,
      randomCheckRate,
      updatedAt: new Date()
    }
  } catch (error) {
    logger.error('计算用户信用分失败:', error)
    return {
      score: 50,
      level: 'normal',
      error: error.message
    }
  }
}

/**
 * 获取用户统计数据
 */
async function getUserStats(userId) {
  // 获取用户信息
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('total_tasks, created_at')
    .eq('id', userId)
    .single()
  
  if (userError || !user) {
    throw new Error('用户不存在')
  }
  
  // 获取最近30天的任务统计
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  
  const { data: recentClaims, error: claimsError } = await supabase
    .from('claims')
    .select('status, claimed_at, submitted_at, reviewed_at')
    .eq('user_id', userId)
    .gte('created_at', thirtyDaysAgo)
  
  if (claimsError) {
    logger.error('获取用户任务统计失败:', claimsError)
  }
  
  // 计算通过率
  const claims = recentClaims || []
  const totalSubmissions = claims.filter(c => c.status !== 'doing' && c.status !== 'expired').length
  const passedCount = claims.filter(c => c.status === 'done').length
  const passRate = totalSubmissions > 0 ? passedCount / totalSubmissions : 1
  
  // 计算平均完成时间
  const completedClaims = claims.filter(c => c.submitted_at && c.claimed_at)
  let avgCompleteTime = 120
  let minCompleteTime = 120
  
  if (completedClaims.length > 0) {
    const times = completedClaims.map(c => {
      const diff = (new Date(c.submitted_at) - new Date(c.claimed_at)) / 1000
      return diff > 0 ? diff : 120
    })
    avgCompleteTime = times.reduce((a, b) => a + b, 0) / times.length
    minCompleteTime = Math.min(...times)
  }
  
  // 计算当前小时和今天的任务数
  const now = new Date()
  const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).toISOString()
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  
  const { count: hourlyTasks } = await supabase
    .from('claims')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', hourStart)
  
  const { count: dailyTasks } = await supabase
    .from('claims')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', dayStart)
  
  // 获取作弊和警告记录
  const { count: cheatCount } = await supabase
    .from('claims')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .like('ai_reason', '%cheat%')
    .gte('created_at', thirtyDaysAgo)
  
  const { count: warningCount } = await supabase
    .from('claims')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .or('ai_reason.like.%duplicate%,ai_reason.like.%suspicious%')
    .gte('created_at', thirtyDaysAgo)
  
  return {
    totalTasks: user.total_tasks || 0,
    passRate,
    avgCompleteTime,
    minCompleteTime,
    hourlyTasks: hourlyTasks || 0,
    dailyTasks: dailyTasks || 0,
    cheatCount: cheatCount || 0,
    warningCount: warningCount || 0
  }
}

/**
 * 计算通过率得分
 */
function calculatePassRateScore(passRate) {
  if (passRate >= DEFAULT_CONFIG.excellentPassRate) return 100
  if (passRate >= DEFAULT_CONFIG.goodPassRate) return 85
  if (passRate >= DEFAULT_CONFIG.normalPassRate) return 70
  if (passRate >= 0.5) return 50
  return 30
}

/**
 * 计算速度得分
 */
function calculateSpeedScore(avgTime, minTime) {
  // 如果最小完成时间太短，可能是作弊
  if (minTime < DEFAULT_CONFIG.minCompleteTime) return 40
  
  if (avgTime <= DEFAULT_CONFIG.normalCompleteTime) return 100
  if (avgTime <= 300) return 80  // 5分钟内
  if (avgTime <= 600) return 60  // 10分钟内
  return 40
}

/**
 * 计算频率得分
 */
function calculateFrequencyScore(hourlyTasks, dailyTasks) {
  let score = 100
  
  if (hourlyTasks > DEFAULT_CONFIG.maxHourlyTasks) {
    score -= 30
  } else if (hourlyTasks > DEFAULT_CONFIG.maxHourlyTasks * 0.7) {
    score -= 10
  }
  
  if (dailyTasks > DEFAULT_CONFIG.maxDailyTasks) {
    score -= 30
  } else if (dailyTasks > DEFAULT_CONFIG.maxDailyTasks * 0.7) {
    score -= 10
  }
  
  return Math.max(0, score)
}

/**
 * 计算作弊得分
 */
function calculateCheatScore(cheatCount, warningCount) {
  if (cheatCount > 0) return 20
  if (warningCount > 3) return 40
  if (warningCount > 1) return 60
  if (warningCount === 1) return 80
  return 100
}

/**
 * 获取信用等级
 */
function getCreditLevel(score) {
  if (score >= DEFAULT_CONFIG.highCreditThreshold) return 'excellent'
  if (score >= DEFAULT_CONFIG.normalCreditThreshold) return 'good'
  if (score >= DEFAULT_CONFIG.lowCreditThreshold) return 'normal'
  return 'risk'
}

/**
 * 计算随机抽查概率
 */
function calculateRandomCheckRate(score) {
  const baseRate = 0.05
  if (score >= DEFAULT_CONFIG.highCreditThreshold) {
    return Math.max(0, baseRate - 0.02)
  }
  if (score < DEFAULT_CONFIG.lowCreditThreshold) {
    return baseRate + 0.10
  }
  return baseRate
}

/**
 * 获取信用排名
 */
export async function getCreditRanking(limit = 100) {
  try {
    const prisma = (await import('../../utils/prisma.js')).default
    
    // 使用原始 SQL 查询
    const users = await prisma.$queryRawUnsafe(`
      SELECT id, username, level, total_tasks
      FROM users
      WHERE total_tasks >= 10
      ORDER BY total_tasks DESC
      LIMIT ${parseInt(limit)}
    `)
    
    return users || []
  } catch (error) {
    logger.error('获取信用排名失败:', error)
    return []
  }
}

/**
 * 获取风险用户列表
 */
export async function getRiskUsers(limit = 50) {
  try {
    const prisma = (await import('../../utils/prisma.js')).default
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    
    // 使用原始 SQL 查询被拒绝次数较多的用户
    const riskUsers = await prisma.$queryRawUnsafe(`
      SELECT 
        c.user_id,
        u.username,
        u.level,
        COUNT(*) as reject_count
      FROM claims c
      JOIN users u ON c.user_id = u.id
      WHERE c.status = 'rejected'
        AND c.claimed_at >= '${thirtyDaysAgo.toISOString()}'
      GROUP BY c.user_id, u.username, u.level
      HAVING COUNT(*) >= 5
      ORDER BY reject_count DESC
      LIMIT ${parseInt(limit)}
    `)
    
    return (riskUsers || []).map(r => ({
      user_id: r.user_id,
      username: r.username || '未知',
      level: r.level || 1,
      rejectCount: parseInt(r.reject_count)
    }))
  } catch (error) {
    logger.error('获取风险用户失败:', error)
    return []
  }
}

export default {
  calculateUserCreditScore,
  getCreditRanking,
  getRiskUsers
}
