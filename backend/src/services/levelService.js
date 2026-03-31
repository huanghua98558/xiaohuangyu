import supabase from '../utils/supabaseToPrismaAdapter.js'
import logger from '../utils/logger.js'
import { sendUserNotification } from './notificationService.js'
import { USER_NOTIFICATION_TYPES } from '../constants/taskActions.js'
import achievementService from './achievementService.js'

class LevelService {
  /**
   * 获取所有等级配置
   */
  async getLevelConfigs() {
    const { data: configs, error } = await supabase
      .from('level_configs')
      .select('*')
      .eq('is_enabled', true)
      .order('level', { ascending: true })

    return configs || []
  }

  /**
   * 获取单个等级配置
   */
  async getLevelConfig(level) {
    const { data: config, error } = await supabase
      .from('level_configs')
      .select('*')
      .eq('level', level)
      .single()

    return config
  }

  /**
   * 获取用户等级信息
   */
  async getUserLevelInfo(userId) {
    const { data: user, error } = await supabase
      .from('users')
      .select('level, total_tasks, total_points, pass_rate_30d, last_task_date')
      .eq('id', userId)
      .single()

    if (!user) {
      throw new Error('用户不存在')
    }

    const currentLevel = await this.getLevelConfig(user.level)
    const nextLevel = await this.getLevelConfig(user.level + 1)

    const result = {
      currentLevel: user.level,
      levelName: currentLevel ? currentLevel.name : '新手体验官',
      levelIcon: currentLevel ? currentLevel.icon : '⭐',
      coefficient: currentLevel ? currentLevel.coefficient : 1.0,
      concurrentTasks: currentLevel ? currentLevel.concurrent_tasks : 1,
      prioritySupport: currentLevel ? currentLevel.priority_support : false,
      totalTasks: user.total_tasks,
      totalPoints: user.total_points,
      passRate: user.pass_rate_30d,
      canUpgrade: false,
      nextLevel: null,
      progress: null
    }

    // 如果有下一级，计算升级进度
    if (nextLevel) {
      const taskProgress = Math.min(100, (user.total_tasks / nextLevel.min_tasks) * 100)
      const pointsProgress = Math.min(100, (user.total_points / nextLevel.min_points) * 100)
      const passRateMet = user.pass_rate_30d >= nextLevel.min_pass_rate

      result.canUpgrade = user.total_tasks >= nextLevel.min_tasks && 
                          user.total_points >= nextLevel.min_points && 
                          passRateMet

      result.nextLevel = {
        level: nextLevel.level,
        name: nextLevel.name,
        icon: nextLevel.icon,
        coefficient: nextLevel.coefficient,
        minTasks: nextLevel.min_tasks,
        minPoints: nextLevel.min_points,
        minPassRate: nextLevel.min_pass_rate
      }

      result.progress = {
        tasks: {
          current: user.total_tasks,
          required: nextLevel.min_tasks,
          percent: Math.round(taskProgress * 10) / 10
        },
        points: {
          current: user.total_points,
          required: nextLevel.min_points,
          percent: Math.round(pointsProgress * 10) / 10
        },
        passRate: {
          current: user.pass_rate_30d,
          required: nextLevel.min_pass_rate,
          met: passRateMet
        },
        overallPercent: Math.round(Math.min(taskProgress, pointsProgress) * 10) / 10
      }
    }

    return result
  }

  /**
   * 检查并升级用户等级（添加升级通知和成就检查）
   */
  async checkAndUpgrade(userId) {
    const { data: user, error } = await supabase
      .from('users')
      .select('level, total_tasks, total_points, pass_rate_30d')
      .eq('id', userId)
      .single()

    if (!user) return { upgraded: false }

    const nextLevel = await this.getLevelConfig(user.level + 1)
    if (!nextLevel) return { upgraded: false }

    // 检查是否满足升级条件
    const canUpgrade = user.total_tasks >= nextLevel.min_tasks &&
                       user.total_points >= nextLevel.min_points &&
                       user.pass_rate_30d >= nextLevel.min_pass_rate

    if (canUpgrade) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ level: nextLevel.level })
        .eq('id', userId)

      if (!updateError) {
        logger.info(`✅ 用户 ${userId} 升级到 Lv.${nextLevel.level} (${nextLevel.name})`)
        
        // ========== 发送升级通知 ==========
        try {
          await sendUserNotification({
            userId,
            type: USER_NOTIFICATION_TYPES.LEVEL_UP,
            title: '🎉 恭喜升级！',
            message: `您已成功升级到 ${nextLevel.name} (Lv.${nextLevel.level})，享受更多权益！`,
            data: {
              newLevel: nextLevel.level,
              levelName: nextLevel.name,
              coefficient: nextLevel.coefficient,
              privileges: {
                concurrentTasks: nextLevel.concurrent_tasks,
                prioritySupport: nextLevel.priority_support
              }
            }
          })
          logger.info(`📱 升级通知已发送给用户 ${userId}`)
        } catch (notifyError) {
          logger.error(`发送升级通知失败: ${notifyError.message}`)
        }
        // ========================================

        // ========== 新增：检查成就 ==========
        try {
          const achievements = await achievementService.checkAndGrantAchievements(userId)
          if (achievements && achievements.length > 0) {
            logger.info(`🏆 用户 ${userId} 升级后获得成就: ${achievements.map(a => a.name).join(',')} `)
          }
        } catch (achievementError) {
          logger.error(`检查成就失败: ${achievementError.message}`)
        }
        // ========================================

        return { upgraded: true, newLevel: nextLevel.level, levelName: nextLevel.name }
      }
    }

    return { upgraded: false }
  }

  /**
   * 检查并降级用户等级（添加降级通知）- 定时任务调用
   */
  async checkAndDemote(userId) {
    const config = await this.getSystemConfig()
    const inactiveDays = parseInt(config.level_demotion_inactive_days || '30')
    const minPassRate = parseFloat(config.level_demotion_pass_rate || '70')

    const { data: user, error } = await supabase
      .from('users')
      .select('level, pass_rate_30d, last_task_date')
      .eq('id', userId)
      .single()

    if (!user || user.level <= 1) return { demoted: false }

    const now = new Date()
    const lastActive = user.last_task_date ? new Date(user.last_task_date) : null
    const daysInactive = lastActive ? Math.floor((now - lastActive) / (1000 * 60 * 60 * 24)) : 999

    // 检查降级条件
    const shouldDemote = daysInactive >= inactiveDays || user.pass_rate_30d < minPassRate

    if (shouldDemote) {
      const newLevel = user.level - 1
      const prevLevelName = (await this.getLevelConfig(user.level))?.name || `Lv.${user.level}`
      const newLevelName = (await this.getLevelConfig(newLevel))?.name || `Lv.${newLevel}`
      const reason = daysInactive >= inactiveDays ? 'inactive' : 'passRate'
      const reasonText = reason === 'inactive' ? `超过${inactiveDays}天未活跃` : `通过率低于${minPassRate}%`

      const { error: updateError } = await supabase
        .from('users')
        .update({ level: newLevel })
        .eq('id', userId)

      if (!updateError) {
        logger.info(`⚠️ 用户 ${userId} 降级到 Lv.${newLevel} (原因: ${reasonText})`)
        
        // ========== 发送降级通知 ==========
        try {
          await sendUserNotification({
            userId,
            type: USER_NOTIFICATION_TYPES.LEVEL_DOWN,
            title: '等级变动提醒',
            message: `您的等级已从 ${prevLevelName} 降为 ${newLevelName}。原因：${reasonText}。完成任务可恢复等级！`,
            data: {
              previousLevel: user.level,
              previousLevelName: prevLevelName,
              newLevel: newLevel,
              newLevelName: newLevelName,
              reason: reason,
              reasonText: reasonText
            }
          })
          logger.info(`📱 降级通知已发送给用户 ${userId}`)
        } catch (notifyError) {
          logger.error(`发送降级通知失败: ${notifyError.message}`)
        }
        // ========================================

        return { demoted: true, newLevel, reason, reasonText }
      }
    }

    return { demoted: false }
  }

  /**
   * 更新用户统计数据（完成任务后调用）
   */
  async updateUserStats(userId, points, passed) {
    const { data: user, error } = await supabase
      .from('users')
      .select('total_tasks, total_points, level')
      .eq('id', userId)
      .single()

    if (!user) return

    // 更新累计数据
    const updateData = {
      total_tasks: (user.total_tasks || 0) + 1,
      total_points: (user.total_points || 0) + points,
      last_task_date: new Date().toISOString()
    }

    // 更新30天通过率
    if (!passed && user.total_tasks > 0) {
      updateData.pass_rate_30d = Math.max(0, ((user.total_tasks * 100 - 1) / (user.total_tasks + 1)))
    }

    await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)

    // 检查是否可以升级
    return await this.checkAndUpgrade(userId)
  }

  /**
   * 获取系统配置
   */
  async getSystemConfig() {
    const { data: configs, error } = await supabase
      .from('system_configs')
      .select('*')

    const result = {}
    for (const c of (configs || [])) {
      result[c.key] = c.value
    }
    return result
  }

  /**
   * 更新等级配置（管理员）
   */
  async updateLevelConfig(level, data) {
    const updateData = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.coefficient !== undefined) updateData.coefficient = data.coefficient
    if (data.minTasks !== undefined) updateData.min_tasks = data.minTasks
    if (data.minPoints !== undefined) updateData.min_points = data.minPoints
    if (data.minPassRate !== undefined) updateData.min_pass_rate = data.minPassRate
    if (data.concurrentTasks !== undefined) updateData.concurrent_tasks = data.concurrentTasks
    if (data.prioritySupport !== undefined) updateData.priority_support = data.prioritySupport
    if (data.icon !== undefined) updateData.icon = data.icon
    if (data.isEnabled !== undefined) updateData.is_enabled = data.isEnabled

    // V2.0 新增字段
    if (data.exposureLimit !== undefined) {
      updateData.exposure_limit = data.exposureLimit
    }
    if (data.regularExposureQuota !== undefined) {
      updateData.regular_exposure_quota = data.regularExposureQuota
    }
    if (data.levelWeight !== undefined) {
      updateData.level_weight = data.levelWeight
    }

    const { data: config, error } = await supabase
      .from('level_configs')
      .update(updateData)
      .eq('level', level)
      .select()
      .single()

    return config
  }
}

export default new LevelService()
