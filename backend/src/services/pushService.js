import supabase from '../utils/supabaseToPrismaAdapter.js'
import { redisClient, REDIS_ENABLED } from '../utils/redis.js'
import logger from '../utils/logger.js'
import exposureService from './exposureService.js'
import nightOwlService from './nightOwlService.js'
import webSocketService from './webSocketService.js'
import onlineUserService from './onlineUserService.js'

/**
 * 任务推送服务
 * 
 * 推送规则：
 * - 推送量 = 曝光量（复用曝光规则）
 * - 白天：等级40% + 活跃30% + 完成率20% + 随机10%
 * - 夜间：夜猫子60% + 等级25% + 完成率15%
 */

// 推送权重配置
const DAY_WEIGHTS = {
  level: 0.40,
  activity: 0.30,
  completion: 0.20,
  random: 0.10
}

const NIGHT_WEIGHTS = {
  nightOwl: 0.60,
  level: 0.25,
  completion: 0.15
}

// 推送检查间隔配置（分钟）
const PUSH_CHECK_INTERVALS = [5, 15, 30, 60, 120, 240]

class PushService {
  constructor() {
    this.pushTimers = new Map() // taskId -> timer
  }

  /**
   * 任务创建时触发推送
   * @param {Object} task - 任务信息
   * @param {number} task.id - 任务ID
   * @param {number} task.needCount - 需求人数
   * @param {number} task.reward - 任务积分
   * @param {string} task.platform - 平台
   * @param {string} task.action - 动作类型
   */
  async onTaskCreated(task) {
    try {
      logger.info(`开始推送任务 ${task.id}: ${task.title}`)

      // 计算初始推送量
      const config = await exposureService.getConfig()
      const pushCount = exposureService.calcInitialExposure(task.needCount || task.remain, config)

      // 选择推送用户
      const targetUsers = await this.selectPushUsers(task, pushCount)

      if (targetUsers.length === 0) {
        logger.warn(`任务 ${task.id} 无可推送用户`)
        return { pushed: 0 }
      }

      // 执行推送
      const pushed = await this.executePush(task, targetUsers, 1)

      // 设置追加推送检查
      this.scheduleAppendPush(task)

      logger.info(`任务 ${task.id} 初始推送完成，目标 ${pushCount} 人，成功 ${pushed} 人`)

      return { pushed, targetCount: pushCount }
    } catch (err) {
      logger.error(`推送任务失败 ${task.id}:`, err.message)
      return { pushed: 0, error: err.message }
    }
  }

  /**
   * 选择推送用户
   */
  async selectPushUsers(task, count) {
    const isNight = nightOwlService.isNightTime()
    const weights = isNight ? NIGHT_WEIGHTS : DAY_WEIGHTS

    logger.debug(`选择推送用户: 夜间=${isNight}, 目标=${count}`)

    // 获取在线用户列表
    const onlineUsers = await this.getOnlineUsersWithScore(task)
    if (onlineUsers.length === 0) {
      return []
    }

    // 计算每个用户的权重分数
    const scoredUsers = await this.calculateUserScores(onlineUsers, task, weights)

    // 按分数排序
    scoredUsers.sort((a, b) => b.score - a.score)

    // 去重：排除已推送和已领取的用户
    const excludeUserIds = await this.getExcludeUserIds(task.id)
    const filteredUsers = scoredUsers.filter(u => !excludeUserIds.has(u.userId))

    // 取前 N 个
    return filteredUsers.slice(0, count)
  }

  /**
   * 获取在线用户及其基础分数
   */
  async getOnlineUsersWithScore(task) {
    // 从 WebSocket 服务获取在线用户
    const onlineClients = webSocketService.getOnlineClients()
    if (onlineClients.size === 0) {
      return []
    }

    const users = []
    for (const [userId, ws] of onlineClients) {
      users.push({
        userId,
        level: ws.userLevel || 1,
        currentPage: ws.currentPage || ''
      })
    }

    return users
  }

  /**
   * 计算用户推送分数
   */
  async calculateUserScores(users, task, weights) {
    const isNight = nightOwlService.isNightTime()
    const nightOwls = isNight ? await nightOwlService.getNightOwls() : []
    const nightOwlSet = new Set(nightOwls.map(o => o.userId))

    // 获取用户完成率数据
    const userIds = users.map(u => u.userId)
    const { data: userStats } = await supabase
      .from('users')
      .select('id, level, total_tasks, pass_rate_30d')
      .in('id', userIds)

    const statsMap = new Map((userStats || []).map(u => [u.id, u]))

    // 获取最高等级用于归一化
    const maxLevel = Math.max(...users.map(u => u.level), 1)
    const maxTasks = Math.max(...(userStats || []).map(u => u.total_tasks || 0), 1)

    return users.map(user => {
      const stats = statsMap.get(user.userId) || {}
      let score = 0

      if (isNight) {
        // 夜间权重
        if (nightOwlSet.has(user.userId)) {
          score += weights.nightOwl * 100 // 夜猫子加分
        }
        score += (user.level / maxLevel) * weights.level * 100
        score += ((stats.pass_rate_30d || 0.5)) * weights.completion * 100
      } else {
        // 白天权重
        score += (user.level / maxLevel) * weights.level * 100
        score += Math.min((stats.total_tasks || 0) / maxTasks, 1) * weights.activity * 100
        score += ((stats.pass_rate_30d || 0.5)) * weights.completion * 100
        score += Math.random() * weights.random * 100 // 随机因子
      }

      return {
        userId: user.userId,
        level: user.level,
        score,
        pushType: this.determinePushType(user, nightOwlSet, isNight)
      }
    })
  }

  /**
   * 确定推送类型
   */
  determinePushType(user, nightOwlSet, isNight) {
    if (isNight && nightOwlSet.has(user.userId)) {
      return 'night_owl'
    }
    if (user.level >= 5) {
      return 'level'
    }
    return 'normal'
  }

  /**
   * 获取需要排除的用户ID
   */
  async getExcludeUserIds(taskId) {
    const excludeSet = new Set()

    // 已推送的用户
    const { data: pushedLogs } = await supabase
      .from('task_push_logs')
      .select('user_id')
      .eq('task_id', taskId)

    for (const log of (pushedLogs || [])) {
      excludeSet.add(log.user_id)
    }

    // 已领取的用户
    const { data: claims } = await supabase
      .from('claims')
      .select('user_id')
      .eq('task_id', taskId)

    for (const claim of (claims || [])) {
      excludeSet.add(claim.user_id)
    }

    return excludeSet
  }

  /**
   * 执行推送
   */
  async executePush(task, targetUsers, round) {
    let pushedCount = 0
    const pushTime = new Date().toISOString()

    for (const user of targetUsers) {
      try {
        // 发送 WebSocket 消息
        const sent = webSocketService.sendToUser(user.userId, {
          type: 'new_task',
          data: {
            taskId: task.id,
            title: task.title,
            platform: task.platform,
            action: task.action,
            reward: task.reward,
            remain: task.remain,
            timeLimitMinutes: task.time_limit_minutes,
            nightBonus: nightOwlService.isNightTime(),
            pushType: user.pushType,
            createdAt: task.created_at
          }
        })

        if (sent) {
          pushedCount++

          // 记录推送日志
          await supabase
            .from('task_push_logs')
            .insert({
              task_id: task.id,
              user_id: user.userId,
              push_round: round,
              push_type: user.pushType,
              pushed_at: pushTime
            })
        }
      } catch (err) {
        logger.error(`推送用户 ${user.userId} 失败:`, err.message)
      }
    }

    // 更新曝光记录
    if (pushedCount > 0) {
      await supabase
        .from('task_exposure')
        .update({
          current_exposure: supabase.rpc('increment', { x: pushedCount }),
          updated_at: pushTime
        })
        .eq('task_id', task.id)
    }

    return pushedCount
  }

  /**
   * 设置追加推送检查定时器
   */
  scheduleAppendPush(task) {
    // 清除已存在的定时器
    if (this.pushTimers.has(task.id)) {
      clearTimeout(this.pushTimers.get(task.id))
    }

    let checkIndex = 0

    const checkAndAppend = async () => {
      try {
        // 检查任务是否已完成或过期
        const { data: taskData } = await supabase
          .from('tasks')
          .select('status, remain')
          .eq('id', task.id)
          .single()

        if (!taskData || taskData.status !== 'active' || taskData.remain <= 0) {
          logger.debug(`任务 ${task.id} 已完成或下架，停止追加推送`)
          this.pushTimers.delete(task.id)
          return
        }

        // 检查领取率，决定是否追加推送
        const { data: exposure } = await supabase
          .from('task_exposure')
          .select('*')
          .eq('task_id', task.id)
          .single()

        if (!exposure) return

        const config = await exposureService.getConfig()
        const addAmount = exposureService.calcAddExposure(
          exposure.accepted_count,
          exposure.need_count,
          exposure.current_exposure,
          exposure.max_exposure,
          config
        )

        if (addAmount > 0) {
          logger.info(`任务 ${task.id} 追加推送: ${addAmount} 人`)

          const targetUsers = await this.selectPushUsers(task, addAmount)
          const round = checkIndex + 2 // 第1轮是初始推送

          await this.executePush(task, targetUsers, round)
        }

        // 继续下一轮检查
        checkIndex++
        if (checkIndex < PUSH_CHECK_INTERVALS.length) {
          const nextInterval = PUSH_CHECK_INTERVALS[checkIndex] * 60 * 1000
          this.pushTimers.set(task.id, setTimeout(checkAndAppend, nextInterval))
        } else {
          this.pushTimers.delete(task.id)
        }
      } catch (err) {
        logger.error(`追加推送检查失败 ${task.id}:`, err.message)
      }
    }

    // 设置第一次检查
    const firstInterval = PUSH_CHECK_INTERVALS[0] * 60 * 1000
    this.pushTimers.set(task.id, setTimeout(checkAndAppend, firstInterval))
  }

  /**
   * 获取推送统计
   */
  async getPushStats(taskId) {
    const { data: logs } = await supabase
      .from('task_push_logs')
      .select('*')
      .eq('task_id', taskId)

    if (!logs || logs.length === 0) {
      return { total: 0, rounds: 0, types: {} }
    }

    const types = {}
    let maxRound = 0

    for (const log of logs) {
      types[log.push_type] = (types[log.push_type] || 0) + 1
      maxRound = Math.max(maxRound, log.push_round)
    }

    return {
      total: logs.length,
      rounds: maxRound,
      types,
      logs: logs.slice(0, 20) // 最近20条
    }
  }

  /**
   * 清理过期的推送定时器
   */
  cleanupExpiredTimers() {
    // 定期清理（每小时）
    setInterval(async () => {
      const taskIds = Array.from(this.pushTimers.keys())

      for (const taskId of taskIds) {
        const { data: task } = await supabase
          .from('tasks')
          .select('status')
          .eq('id', taskId)
          .single()

        if (!task || task.status !== 'active') {
          clearTimeout(this.pushTimers.get(taskId))
          this.pushTimers.delete(taskId)
        }
      }
    }, 60 * 60 * 1000)
  }
}

export default new PushService()
