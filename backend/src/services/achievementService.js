import supabase from '../utils/supabaseToPrismaAdapter.js'
import logger from '../utils/logger.js'
import { notifyAchievementReward } from './notificationService.js'

function readField(obj, camelKey, snakeKey = camelKey) {
  return obj?.[camelKey] ?? obj?.[snakeKey]
}

class AchievementService {
  /**
   * 获取所有成就列表
   */
  async getAllAchievements() {
    const { data: achievements, error } = await supabase
      .from('achievements')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      throw new Error('获取成就列表失败')
    }

    return achievements || []
  }

  /**
   * 获取用户成就
   */
  async getUserAchievements(userId) {
    const normalizedUserId = Number(userId)
    // 获取所有成就
    const { data: achievements, error: achievementsError } = await supabase
      .from('achievements')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (achievementsError) {
      throw new Error('获取成就列表失败')
    }

    // 获取用户已获得的成就
    const { data: userAchievements, error: userError } = await supabase
      .from('user_achievements')
      .select('achievement_id, achieved_at')
      .eq('user_id', normalizedUserId)

    if (userError) {
      throw new Error('获取用户成就失败')
    }

    const achievedIds = new Set(userAchievements?.map(ua => readField(ua, 'achievementId', 'achievement_id')) || [])
    const achievedMap = new Map(userAchievements?.map(ua => [readField(ua, 'achievementId', 'achievement_id'), readField(ua, 'achievedAt', 'achieved_at')]) || [])

    // 获取用户统计数据用于进度计算
    const { data: user } = await supabase
      .from('users')
      .select('total_tasks, total_points')
      .eq('id', normalizedUserId)
      .single()

    // 获取连续签到天数
    const { data: latestSign } = await supabase
      .from('sign_ins')
      .select('continuous_days')
      .eq('user_id', normalizedUserId)
      .order('sign_date', { ascending: false })
      .limit(1)
      .single()

    const userStats = {
      total_tasks: Number(readField(user, 'totalTasks', 'total_tasks') || 0),
      total_points: Number(readField(user, 'totalPoints', 'total_points') || 0),
      continuous_sign: Number(readField(latestSign, 'continuousDays', 'continuous_days') || 0)
    }

    return achievements.map(achievement => ({
      ...achievement,
      is_achieved: achievedIds.has(achievement.id),
      achieved_at: achievedMap.get(achievement.id) || null,
      progress: this.calculateProgress(achievement, userStats)
    }))
  }

  /**
   * 计算成就进度
   */
  calculateProgress(achievement, userStats) {
    const currentValue = userStats[achievement.condition_type] || 0
    const targetValue = achievement.condition_value
    const progress = Math.min(100, Math.round((currentValue / targetValue) * 100))
    
    return {
      current: currentValue,
      target: targetValue,
      percent: progress
    }
  }

  /**
   * 检查并授予用户成就
   */
  async checkAndGrantAchievements(userId) {
    const normalizedUserId = Number(userId)
    // 获取用户统计数据
    const { data: user } = await supabase
      .from('users')
      .select('total_tasks, total_points, points')
      .eq('id', normalizedUserId)
      .single()

    if (!user) return []

    // 获取连续签到天数
    const { data: latestSign } = await supabase
      .from('sign_ins')
      .select('continuous_days')
      .eq('user_id', normalizedUserId)
      .order('sign_date', { ascending: false })
      .limit(1)
      .single()

    const stats = {
      total_tasks: Number(readField(user, 'totalTasks', 'total_tasks') || 0),
      total_points: Number(readField(user, 'totalPoints', 'total_points') || 0),
      continuous_sign: Number(readField(latestSign, 'continuousDays', 'continuous_days') || 0)
    }

    // 获取所有成就
    const { data: achievements } = await supabase
      .from('achievements')
      .select('*')
      .eq('is_active', true)

    // 获取已获得的成就
    const { data: userAchievements } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', normalizedUserId)

    const achievedIds = new Set(userAchievements?.map(ua => readField(ua, 'achievementId', 'achievement_id')) || [])

    const newlyGranted = []
    let currentPoints = Number(user.points || 0)  // 跟踪当前积分

    for (const achievement of achievements || []) {
      if (achievedIds.has(achievement.id)) continue

      const currentValue = stats[achievement.condition_type] || 0
      if (currentValue >= achievement.condition_value) {
        // 授予成就
        const { error: insertError } = await supabase
            .from('user_achievements')
            .insert({
            user_id: normalizedUserId,
            achievement_id: achievement.id
          })

        if (insertError) {
          logger.error(`授予成就失败: ${achievement.name}`, insertError)
          continue
        }

        // 发放奖励积分
        if (achievement.reward_points > 0) {
          const oldPoints = currentPoints
          const newPoints = oldPoints + achievement.reward_points

          // 更新用户积分（同时更新 total_points）
          const { error: updateError } = await supabase
            .from('users')
            .update({ 
              points: newPoints,
              total_points: Number(readField(user, 'totalPoints', 'total_points') || 0) + achievement.reward_points
            })
            .eq('id', normalizedUserId)

          if (updateError) {
            logger.error(`更新积分失败: ${achievement.name}`, updateError)
          } else {
            currentPoints = newPoints  // 更新当前积分追踪

            // 记录积分日志到 points_logs
            const { error: logError } = await supabase
              .from('records')
              .insert({
                user_id: normalizedUserId,
                old_points: oldPoints,
                new_points: newPoints,
                change: achievement.reward_points,
                balance: newPoints,
                type: 'achievement',
                desc: `获得成就「${achievement.name}」奖励`
              })

            if (logError) {
              logger.error(`记录积分日志失败: ${achievement.name}`, logError)
            }

            // 同时写入 records 表，供前端积分流水显示
            const { error: recordError } = await supabase
              .from('records')
              .insert({
                user_id: normalizedUserId,
                type: 'achievement',
                desc: `获得成就「${achievement.name}」奖励`,
                points: achievement.reward_points,
                balance: 0
              })

            if (recordError) {
              logger.error(`记录到 records 表失败: ${achievement.name}`, recordError)
            }
          }
        }

        newlyGranted.push(achievement)
        logger.info(`用户 ${normalizedUserId} 获得成就: ${achievement.name}，奖励 ${achievement.reward_points} 积分`)

        try {
          await notifyAchievementReward(normalizedUserId, {
            name: achievement.name,
            points: achievement.reward_points,
          })
        } catch (notifyError) {
          logger.error(`发送成就奖励通知失败: ${achievement.name}`, notifyError)
        }
      }
    }

    return newlyGranted
  }

  /**
   * 获取成就统计数据
   */
  async getAchievementStats(userId) {
    const normalizedUserId = Number(userId)
    const { count: total } = await supabase
      .from('achievements')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    const { count: achieved } = await supabase
      .from('user_achievements')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', normalizedUserId)

    const { data: userAchievements } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', normalizedUserId)

    // 计算总奖励积分
    const achievedIds = userAchievements?.map(ua => readField(ua, 'achievementId', 'achievement_id')) || []
    let totalRewardPoints = 0

    if (achievedIds.length > 0) {
      const { data: achievements } = await supabase
        .from('achievements')
        .select('reward_points')
        .in('id', achievedIds)

      totalRewardPoints = achievements?.reduce((sum, a) => sum + Number(readField(a, 'rewardPoints', 'reward_points') || 0), 0) || 0
    }

    return {
      total: total || 0,
      achieved: achieved || 0,
      totalRewardPoints
    }
  }
}

export default new AchievementService()
