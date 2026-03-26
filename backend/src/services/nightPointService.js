import supabase from '../utils/supabaseToPrismaAdapter.js'
import { cache } from '../utils/redis.js'
import levelService from './levelService.js'
import logger from '../utils/logger.js'

/**
 * 夜间积分动态调整服务
 * 
 * 核心逻辑：
 * - 夜间(0:00-6:00)基础系数 1.4 倍
 * - 根据在线活跃用户数动态调整到 1.4-1.8 倍
 * - 在线用户少 → 系数高，在线用户多 → 系数低
 */

// 缓存键
const CACHE_KEY_CONFIG = 'night_point:config'
const CACHE_KEY_COEFFICIENT_MAP = 'night_point:coefficient_map'
const CACHE_TTL = 300 // 5分钟缓存

class NightPointService {
  /**
   * 判断小时是否在夜间区间（支持跨天）
   */
  isHourInNightRange(hour, startHour = 0, endHour = 6) {
    const h = Number(hour)
    const start = Number(startHour)
    const end = Number(endHour)

    if (
      !Number.isFinite(h) ||
      !Number.isFinite(start) ||
      !Number.isFinite(end)
    ) {
      return false
    }

    if (start === end) {
      return true
    }

    // 正常区间: 0-6
    if (start < end) {
      return h >= start && h < end
    }

    // 跨天区间: 22-6
    return h >= start || h < end
  }

  /**
   * 检查当前是否为夜间时段
   */
  isNightTime() {
    const hour = new Date().getHours()
    return this.isHourInNightRange(hour, 0, 6)
  }

  /**
   * 按参考时间判断是否夜间（用于按任务发布时间判定）
   */
  isNightTimeByReference(referenceTime, config = null) {
    const target = referenceTime ? new Date(referenceTime) : new Date()
    if (Number.isNaN(target.getTime())) {
      return false
    }

    const hour = target.getHours()
    const start = config?.time_start ?? 0
    const end = config?.time_end ?? 6
    return this.isHourInNightRange(hour, start, end)
  }

  /**
   * 获取夜间积分配置
   */
  async getConfig() {
    // 尝试从缓存获取
    const cached = await cache.get(CACHE_KEY_CONFIG)
    if (cached) {
      return cached
    }

    const { data, error } = await supabase
      .from('night_point_config')
      .select('*')
      .eq('is_active', true)
      .single()

    if (error || !data) {
      // 返回默认配置
      const defaultConfig = {
        time_start: 0,
        time_end: 6,
        base_coefficient: 1.4,
        max_coefficient: 1.8,
        no_accept_bonus: 0.1
      }
      await cache.set(CACHE_KEY_CONFIG, defaultConfig, CACHE_TTL)
      return defaultConfig
    }

    await cache.set(CACHE_KEY_CONFIG, data, CACHE_TTL)
    return data
  }

  /**
   * 获取在线用户-系数映射
   */
  async getCoefficientMap() {
    // 尝试从缓存获取
    const cached = await cache.get(CACHE_KEY_COEFFICIENT_MAP)
    if (cached) {
      return cached
    }

    const { data, error } = await supabase
      .from('online_user_coefficient_map')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error || !data || data.length === 0) {
      // 返回默认映射
      const defaultMap = [
        { online_users_max: 10, coefficient: 1.75, description: '极少人在线，高激励' },
        { online_users_max: 30, coefficient: 1.7, description: '少量人在线，中高激励' },
        { online_users_max: 50, coefficient: 1.6, description: '中等在线，适度激励' },
        { online_users_max: 100, coefficient: 1.5, description: '较多在线，低激励' },
        { online_users_max: 200, coefficient: 1.4, description: '大量在线，基础激励' }
      ]
      await cache.set(CACHE_KEY_COEFFICIENT_MAP, defaultMap, CACHE_TTL)
      return defaultMap
    }

    await cache.set(CACHE_KEY_COEFFICIENT_MAP, data, CACHE_TTL)
    return data
  }

  /**
   * 计算夜间任务积分系数
   * @param {number} onlineUsers - 当前在线活跃用户数
   * @param {number} acceptedCount - 任务已接人数
   * @param {number} needCount - 任务需求人数
   * @returns {Promise<{coefficient: number, baseCoefficient: number, bonus: number}>}
   */
  async calculateCoefficientByReference({
    referenceTime,
    onlineUsers = 0,
    acceptedCount = 0,
    needCount = 1
  } = {}) {
    const config = await this.getConfig()

    // 非夜间时段，返回正常系数
    if (!this.isNightTimeByReference(referenceTime || new Date(), config)) {
      return { coefficient: 1.0, baseCoefficient: 1.0, bonus: 0, isNight: false }
    }

    const coefficientMap = await this.getCoefficientMap()

    // 根据在线用户数查找对应系数
    let baseCoefficient = config.base_coefficient
    for (const rule of coefficientMap) {
      if (onlineUsers <= rule.online_users_max) {
        baseCoefficient = rule.coefficient
        break
      }
    }

    // 计算额外加成
    let bonus = 0
    if (config.no_accept_bonus && acceptedCount === 0) {
      bonus = config.no_accept_bonus
    }

    // 计算最终系数（不超过最大值）
    const coefficient = Math.min(baseCoefficient + bonus, config.max_coefficient)

    return {
      coefficient,
      baseCoefficient,
      bonus,
      isNight: true,
      onlineUsers: Number(onlineUsers) || 0,
      config
    }
  }

  /**
   * 计算夜间任务积分系数（以当前时间判定，前端展示用）
   */
  async calculateCoefficient(onlineUsers, acceptedCount = 0, needCount = 1) {
    return this.calculateCoefficientByReference({
      referenceTime: new Date(),
      onlineUsers,
      acceptedCount,
      needCount
    })
  }

  /**
   * 按任务发布时间计算系数（结算用）
   */
  async calculateCoefficientByPublishTime({
    publishTime,
    onlineUsers = 0,
    acceptedCount = 0,
    needCount = 1
  } = {}) {
    return this.calculateCoefficientByReference({
      referenceTime: publishTime,
      onlineUsers,
      acceptedCount,
      needCount
    })
  }

  /**
   * 获取当前实时系数（供前端展示）
   * @param {number} onlineUsers - 当前在线用户数
   * @param {number} basePoints - 基础积分
   */
  async getCurrentCoefficient(onlineUsers, basePoints = 100) {
    const result = await this.calculateCoefficient(onlineUsers, 0, 1)
    
    return {
      isNight: result.isNight,
      onlineUsers,
      coefficient: result.coefficient,
      basePoints,
      displayPoints: Math.ceil(basePoints * result.coefficient),
      desc: this.buildDescription(result)
    }
  }

  /**
   * 构建描述文本
   */
  buildDescription(result) {
    if (!result.isNight) {
      return '白天时段，正常积分'
    }
    const hour = new Date().getHours()
    const timeDesc = hour < 2 ? '深夜' : hour < 4 ? '凌晨' : '清晨'
    const bonusDesc = result.bonus > 0 ? '，无人领取加成' : ''
    return `${timeDesc}时段，在线${result.onlineUsers}人，系数${result.coefficient}倍${bonusDesc}`
  }

  /**
   * 记录夜间任务积分日志
   */
  async logNightPoints(taskId, userId, basePoints, onlineUsers, coefficient, actualPoints) {
    try {
      await supabase
        .from('night_task_points_log')
        .insert({
          task_id: taskId,
          user_id: userId,
          base_points: basePoints,
          online_users: onlineUsers,
          coefficient,
          actual_points: actualPoints,
          accepted_at: new Date().toISOString()
        })
    } catch (error) {
      logger.error('记录夜间积分日志失败:', error.message)
    }
  }

  /**
   * 获取夜间积分统计数据
   */
  async getStats(startDate, endDate) {
    const { data, error } = await supabase
      .from('night_task_points_log')
      .select('coefficient, actual_points, base_points, online_users, accepted_at')
      .gte('accepted_at', startDate)
      .lte('accepted_at', endDate)
      .order('accepted_at', { ascending: true })

    if (error || !data) {
      return []
    }

    // 按日期聚合
    const dailyStats = {}
    for (const log of data) {
      const date = log.accepted_at.split('T')[0]
      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          count: 0,
          totalBasePoints: 0,
          totalBonusPoints: 0,
          totalOnlineUsers: 0,
          coefficients: []
        }
      }
      dailyStats[date].count++
      dailyStats[date].totalBasePoints += log.base_points
      dailyStats[date].totalBonusPoints += log.actual_points - log.base_points
      dailyStats[date].totalOnlineUsers += log.online_users
      dailyStats[date].coefficients.push(log.coefficient)
    }

    // 计算平均值
    return Object.values(dailyStats).map(stat => ({
      date: stat.date,
      count: stat.count,
      avgCoefficient: (stat.coefficients.reduce((a, b) => a + b, 0) / stat.count).toFixed(2),
      totalBasePoints: stat.totalBasePoints,
      totalBonusPoints: stat.totalBonusPoints,
      avgOnlineUsers: Math.round(stat.totalOnlineUsers / stat.count)
    }))
  }

  /**
   * 更新系数映射配置
   */
  async updateCoefficientMap(id, coefficient) {
    const { error } = await supabase
      .from('online_user_coefficient_map')
      .update({ coefficient })
      .eq('id', id)

    if (error) {
      throw new Error('更新失败: ' + error.message)
    }

    // 清除缓存
    await cache.del(CACHE_KEY_COEFFICIENT_MAP)
    
    return { success: true }
  }

  /**
   * 更新夜间积分配置
   */
  async updateConfig(configData) {
    const { error } = await supabase
      .from('night_point_config')
      .update(configData)
      .eq('is_active', true)

    if (error) {
      throw new Error('更新失败: ' + error.message)
    }

    // 清除缓存
    await cache.del(CACHE_KEY_CONFIG)
    
    return { success: true }
  }

  /**
   * 初始化数据库表（如果不存在）
   */
  async initTables() {
    try {
      // 检查配置表是否存在
      const { data: configCheck } = await supabase
        .from('night_point_config')
        .select('id')
        .limit(1)

      // 如果表存在但没有数据，插入默认配置
      if (configCheck !== null && configCheck.length === 0) {
        await supabase.from('night_point_config').insert({
          time_start: 0,
          time_end: 6,
          base_coefficient: 1.4,
          max_coefficient: 1.8,
          no_accept_bonus: 0.1,
          is_active: true
        })
        logger.info('初始化夜间积分配置')
      }

      // 检查系数映射表
      const { data: mapCheck } = await supabase
        .from('online_user_coefficient_map')
        .select('id')
        .limit(1)

      if (mapCheck !== null && mapCheck.length === 0) {
        const defaultMap = [
          { online_users_max: 10, coefficient: 1.75, description: '极少人在线，高激励', sort_order: 1 },
          { online_users_max: 30, coefficient: 1.7, description: '少量人在线，中高激励', sort_order: 2 },
          { online_users_max: 50, coefficient: 1.6, description: '中等在线，适度激励', sort_order: 3 },
          { online_users_max: 100, coefficient: 1.5, description: '较多在线，低激励', sort_order: 4 },
          { online_users_max: 200, coefficient: 1.4, description: '大量在线，基础激励', sort_order: 5 }
        ]
        await supabase.from('online_user_coefficient_map').insert(defaultMap)
        logger.info('初始化在线用户系数映射')
      }

      return true
    } catch (error) {
      logger.warn('夜间积分表初始化检查失败（表可能不存在）:', error.message)
      return false
    }
  }
}

export default new NightPointService()
