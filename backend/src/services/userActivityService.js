/**
 * 用户活跃度评分服务
 * 用于任务分配优先级计算
 */

import supabase from '../utils/supabaseToPrismaAdapter.js'
import logger from '../utils/logger.js'

class UserActivityService {
  
  /**
   * 计算用户活跃度评分
   * @param {string} userId 用户ID
   * @returns {Promise<number>} 活跃度评分 (0-100)
   */
  async calculateActivityScore(userId) {
    try {
      const now = new Date()
      const today = now.toISOString().split('T')[0]
      const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
      const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString()
      
      // 1. 获取用户基本信息
      const { data: user } = await supabase
        .from('users')
        .select('created_at, last_task_date')
        .eq('id', userId)
        .single()
      
      if (!user) return 0
      
      let score = 0
      
      // 2. 基础登录分 (最高10分)
      // 使用last_task_date作为活跃指标
      if (user.last_task_date) {
        const lastActive = new Date(user.last_task_date)
        const daysSinceActive = (now - lastActive) / (24 * 60 * 60 * 1000)
        
        if (daysSinceActive < 1) {
          score += 10 // 当天活跃
        } else if (daysSinceActive < 3) {
          score += 5 // 3天内活跃
        }
      }
      
      // 3. 连续签到加分 (最高50分)
      const { data: checkIns } = await supabase
        .from('user_check_ins')
        .select('check_in_date')
        .eq('user_id', userId)
        .gte('check_in_date', new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('check_in_date', { ascending: false })
        .limit(30)
      
      if (checkIns && checkIns.length > 0) {
        // 计算连续签到天数
        let consecutiveDays = 0
        let prevDate = null
        
        for (const checkIn of checkIns) {
          const checkDate = new Date(checkIn.check_in_date)
          if (prevDate === null) {
            consecutiveDays = 1
          } else {
            const dayDiff = (prevDate - checkDate) / (24 * 60 * 60 * 1000)
            if (dayDiff === 1) {
              consecutiveDays++
            } else {
              break
            }
          }
          prevDate = checkDate
        }
        
        // 连续签到加分：每天5分，上限50分
        score += Math.min(consecutiveDays * 5, 50)
      }
      
      // 4. 7天内完成任务加分 (最高30分)
      const { count: completedCount } = await supabase
        .from('claims')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['approved', 'done'])
        .gte('completed_at', sevenDaysAgo)
      
      score += Math.min((completedCount || 0) * 3, 30)
      
      // 5. 活跃度衰减（3天不活跃-50%，7天不活跃清零）
      if (user.last_task_date) {
        const daysSinceActive = (now - new Date(user.last_task_date)) / (24 * 60 * 60 * 1000)
        if (daysSinceActive > 7) {
          score = 0
        } else if (daysSinceActive > 3) {
          score = Math.floor(score * 0.5)
        }
      }
      
      logger.debug(`用户 ${userId} 活跃度评分: ${score}`)
      return score
    } catch (err) {
      logger.error(`计算活跃度评分失败: ${err.message}`)
      return 0
    }
  }
  
  /**
   * 获取用户活跃度等级
   * @param {string} userId 用户ID
   * @returns {Promise<{level: number, levelName: string, benefits: object}>}
   */
  async getActivityLevel(userId) {
    try {
      const score = await this.calculateActivityScore(userId)
      
      // 等级划分
      let level, levelName, benefits
      
      if (score >= 80) {
        level = 4
        levelName = '核心用户'
        benefits = {
          maxConcurrent: 30,        // 最高并发任务数
          earlyExposureMinutes: 10, // 提前看到新任务
          priorityWeight: 1.5,      // 优先级加成
          bonusRate: 0.1            // 积分加成10%
        }
      } else if (score >= 50) {
        level = 3
        levelName = '高活跃'
        benefits = {
          maxConcurrent: 25,
          earlyExposureMinutes: 5,
          priorityWeight: 1.3,
          bonusRate: 0.05
        }
      } else if (score >= 20) {
        level = 2
        levelName = '活跃'
        benefits = {
          maxConcurrent: 20,
          earlyExposureMinutes: 2,
          priorityWeight: 1.1,
          bonusRate: 0
        }
      } else {
        level = 1
        levelName = '新手'
        benefits = {
          maxConcurrent: 15,
          earlyExposureMinutes: 0,
          priorityWeight: 1.0,
          bonusRate: 0
        }
      }
      
      return { level, levelName, score, benefits }
    } catch (err) {
      logger.error(`获取活跃度等级失败: ${err.message}`)
      return { 
        level: 1, 
        levelName: '新手', 
        score: 0, 
        benefits: { maxConcurrent: 15, earlyExposureMinutes: 0, priorityWeight: 1.0, bonusRate: 0 } 
      }
    }
  }
  
  /**
   * 获取用户动态并发上限
   * 基础值 + 活跃度等级加成
   */
  async getDynamicMaxConcurrent(userId) {
    const levelInfo = await this.getActivityLevel(userId)
    return levelInfo.benefits.maxConcurrent
  }
  
  /**
   * 批量获取用户活跃度评分
   */
  async batchGetActivityScores(userIds) {
    const scores = {}
    for (const userId of userIds) {
      scores[userId] = await this.calculateActivityScore(userId)
    }
    return scores
  }
  
  /**
   * 判断是否为新用户（注册3天内）
   */
  async isNewUser(userId) {
    const { data: user } = await supabase
      .from('users')
      .select('created_at')
      .eq('id', userId)
      .single()
    
    if (!user) return false
    
    const daysSinceCreated = (Date.now() - new Date(user.created_at)) / (24 * 60 * 60 * 1000)
    return daysSinceCreated <= 3
  }
  
  /**
   * 获取用户任务完成率
   */
  async getCompletionRate(userId) {
    const { count: total } = await supabase
      .from('claims')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['approved', 'done', 'rejected', 'expired', 'abandoned'])
    
    const { count: completed } = await supabase
      .from('claims')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['approved', 'done'])
    
    if (!total || total === 0) return 0.5 // 新用户默认中等完成率
    return completed / total
  }
  
  /**
   * 计算任务分配优先级（新版本：活跃用户优先）
   * @param {string} userId 用户ID
   * @returns {Promise<number>} 优先级分数 (0-100)
   */
  async calculatePriority(userId) {
    try {
      // 活跃度评分 (权重50%) - 提升活跃用户权重
      const activityScore = await this.calculateActivityScore(userId)
      
      // 任务完成率 (权重30%)
      const completionRate = await this.getCompletionRate(userId)
      
      // 提交速度评分 (权重20%) - 新增：快速提交的用户优先
      const speedScore = await this.getSubmitSpeedScore(userId)
      
      // 新人保护：仅保留10%作为微小调整（不再作为主要因素）
      let newBonus = 0
      if (await this.isNewUser(userId)) {
        newBonus = 10  // 降低新人保护：30→10
      }
      
      // 今日已获积分惩罚（让还没获得积分的用户有更高优先级）
      const todayPoints = await this.getTodayEarnedPoints(userId)
      let todayPenalty = 0
      if (todayPoints >= 300) {
        todayPenalty = -30  // 已获得较多积分，大幅降低优先级
      } else if (todayPoints >= 200) {
        todayPenalty = -20
      } else if (todayPoints >= 100) {
        todayPenalty = -10
      } else if (todayPoints === 0) {
        todayPenalty = 10   // 还没获得积分，轻微提升优先级
      }
      
      // 综合优先级 = 活跃度50% + 完成率30% + 提交速度20% + 新人保护 + 今日惩罚
      const priority = Math.max(0, Math.min(100, 
        activityScore * 0.5 +                    // 活跃度权重提升
        completionRate * 100 * 0.3 +             // 完成率
        speedScore * 0.2 +                       // 提交速度
        newBonus +
        todayPenalty
      ))
      
      logger.debug(`用户 ${userId} 优先级: ${priority.toFixed(1)} (活跃度:${activityScore}×50%, 完成率:${(completionRate*100).toFixed(0)}%×30%, 速度:${speedScore}×20%)`)
      return priority
    } catch (err) {
      logger.error(`计算优先级失败: ${err.message}`)
      return 0
    }
  }
  
  /**
   * 获取用户提交速度评分
   * 基于用户历史提交速度计算
   */
  async getSubmitSpeedScore(userId) {
    try {
      // 获取用户最近10个已完成任务的提交时间
      const { data: claims } = await supabase
        .from('claims')
        .select('created_at, completed_at')
        .eq('user_id', userId)
        .in('status', ['approved', 'done'])
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(10)
      
      if (!claims || claims.length === 0) {
        return 50  // 新用户默认中等速度
      }
      
      // 计算平均完成时间
      let totalTime = 0
      let validCount = 0
      
      for (const claim of claims) {
        if (claim.created_at && claim.completed_at) {
          const created = new Date(claim.created_at)
          const completed = new Date(claim.completed_at)
          const minutes = (completed - created) / (1000 * 60)
          if (minutes > 0 && minutes < 120) {  // 排除异常数据
            totalTime += minutes
            validCount++
          }
        }
      }
      
      if (validCount === 0) return 50
      
      const avgMinutes = totalTime / validCount
      
      // 根据平均完成时间计算速度评分
      // 5分钟内 = 100分，每增加5分钟减10分，最低0分
      let speedScore = 100 - Math.floor((avgMinutes - 5) / 5) * 10
      speedScore = Math.max(0, Math.min(100, speedScore))
      
      logger.debug(`用户 ${userId} 平均完成时间: ${avgMinutes.toFixed(1)}分钟, 速度评分: ${speedScore}`)
      return speedScore
    } catch (err) {
      logger.error(`获取提交速度失败: ${err.message}`)
      return 50
    }
  }
  
  /**
   * 获取用户今日已获积分
   */
  async getTodayEarnedPoints(userId) {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data: claims } = await supabase
        .from('claims')
        .select('reward')
        .eq('user_id', userId)
        .in('status', ['approved', 'done'])
        .gte('completed_at', today)
      
      return (claims || []).reduce((sum, c) => sum + (c.reward || 0), 0)
    } catch (err) {
      logger.error(`获取今日积分失败: ${err.message}`)
      return 0
    }
  }
  
  /**
   * 记录用户签到
   */
  async checkIn(userId) {
    try {
      const today = new Date().toISOString().split('T')[0]
      
      // 检查今天是否已签到
      const { data: existing } = await supabase
        .from('user_check_ins')
        .select('id')
        .eq('user_id', userId)
        .eq('check_in_date', today)
        .maybeSingle()
      
      if (existing) {
        return { success: false, message: '今日已签到' }
      }
      
      // 计算连续签到天数
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const { data: lastCheckIn } = await supabase
        .from('user_check_ins')
        .select('check_in_date')
        .eq('user_id', userId)
        .eq('check_in_date', yesterday)
        .maybeSingle()
      
      // 插入签到记录
      const { error } = await supabase
        .from('user_check_ins')
        .insert({
          user_id: userId,
          check_in_date: today,
          is_consecutive: !!lastCheckIn
        })
      
      if (error) {
        logger.error(`签到失败: ${error.message}`)
        return { success: false, message: '签到失败' }
      }
      
      // 计算奖励积分
      const reward = await this.calculateCheckInReward(userId)
      
      // 发放奖励
      if (reward.points > 0) {
        await supabase
          .from('users')
          .update({ 
            points: supabase.rpc('increment', { 
              row_id: userId, 
              table_name: 'users', 
              column_name: 'points', 
              increment_value: reward.points 
            })
          })
          .eq('id', userId)
        
        // 简单直接更新积分
        const { data: user } = await supabase
          .from('users')
          .select('points')
          .eq('id', userId)
          .single()
        
        if (user) {
          await supabase
            .from('users')
            .update({ points: (user.points || 0) + reward.points })
            .eq('id', userId)
        }
      }
      
      logger.info(`用户 ${userId} 签到成功，获得 ${reward.points} 积分`)
      return { 
        success: true, 
        message: '签到成功',
        consecutiveDays: reward.consecutiveDays,
        points: reward.points
      }
    } catch (err) {
      logger.error(`签到异常: ${err.message}`)
      return { success: false, message: '签到失败' }
    }
  }
  
  /**
   * 计算签到奖励
   */
  async calculateCheckInReward(userId) {
    try {
      const { data: checkIns } = await supabase
        .from('user_check_ins')
        .select('check_in_date')
        .eq('user_id', userId)
        .order('check_in_date', { ascending: false })
        .limit(30)
      
      // 计算连续签到天数
      let consecutiveDays = 0
      let prevDate = null
      
      for (const checkIn of (checkIns || [])) {
        const checkDate = new Date(checkIn.check_in_date)
        if (prevDate === null) {
          consecutiveDays = 1
        } else {
          const dayDiff = (prevDate - checkDate) / (24 * 60 * 60 * 1000)
          if (dayDiff === 1) {
            consecutiveDays++
          } else {
            break
          }
        }
        prevDate = checkDate
      }
      
      // 计算奖励积分
      let points = 2 // 基础2积分
      if (consecutiveDays >= 7) {
        points = 15
      } else if (consecutiveDays >= 3) {
        points = 5
      }
      
      // 30天额外奖励
      if (consecutiveDays >= 30) {
        points = 50
      }
      
      return { consecutiveDays, points }
    } catch (err) {
      logger.error(`计算签到奖励失败: ${err.message}`)
      return { consecutiveDays: 1, points: 2 }
    }
  }
  
  /**
   * 获取系统供需比
   * @returns {Promise<{ratio: number, activeUsers: number, availableTasks: number}>}
   */
  async getSupplyDemandRatio() {
    try {
      // 活跃用户数（24小时内登录）
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { count: activeUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .gte('last_login_at', oneDayAgo)
      
      // 可接任务数（有剩余名额的活跃任务）
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, remain')
        .eq('status', 'active')
        .gt('remain', 0)
      
      const availableTasks = (tasks || []).reduce((sum, t) => sum + t.remain, 0)
      
      // 供需比
      const ratio = availableTasks > 0 ? (activeUsers || 0) / availableTasks : 0
      
      logger.info(`供需比: ${ratio.toFixed(2)} (活跃用户:${activeUsers}, 可接任务:${availableTasks})`)
      
      return {
        ratio,
        activeUsers: activeUsers || 0,
        availableTasks
      }
    } catch (err) {
      logger.error(`计算供需比失败: ${err.message}`)
      return { ratio: 1, activeUsers: 0, availableTasks: 0 }
    }
  }
}

export default new UserActivityService()
