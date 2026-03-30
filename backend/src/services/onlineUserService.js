import { getRedisClient, REDIS_ENABLED } from '../utils/redis.js'
import supabase from '../utils/supabaseToPrismaAdapter.js'
import logger from '../utils/logger.js'
import db from '../config/database.js'

/**
 * 在线用户统计服务
 * 
 * 使用 Redis 实现在线用户统计：
 * - Sorted Set 存储在线用户（score 为最后活跃时间戳）
 * - 心跳机制：前端每 30 秒上报一次
 * - 超时清理：2 分钟无心跳则视为离线
 * 
 * V2.0 新增功能：
 * - 城市维度在线用户管理
 * - 完整在线用户快照
 * - 曝光容量支持
 * - 离线缓冲机制
 */

// Redis 键
const ONLINE_USERS_SET = 'online_users:set'
const ONLINE_USER_PREFIX = 'online_user:'
const ONLINE_COUNT_CACHE = 'online_users:count'

// V2.0 新增 Redis 键
const CITY_ONLINE_PREFIX = 'city_online:'           // 城市在线用户索引
const CITY_ONLINE_STATS = 'city_online_stats'       // 城市在线统计缓存
const USER_EXPOSURE_PREFIX = 'user_exposure:'       // 用户曝光额度
const OFFLINE_BUFFER_PREFIX = 'offline_buffer:'     // 离线缓冲
const ONLINE_STATS_CACHE = 'online_stats'           // 全局在线统计缓存

// 配置
const HEARTBEAT_TIMEOUT = 120 // 2分钟无心跳视为离线
const ACTIVE_THRESHOLD = 300 // 5分钟内活跃视为活跃用户
const OFFLINE_BUFFER_TIME = 300 // 5分钟离线缓冲时间
const EXPOSURE_QUOTA_TTL = 7200 // 2小时曝光额度缓存时间

class OnlineUserService {
  /**
   * 获取 Redis 客户端（确保已连接）
   */
  async _getClient() {
    return await getRedisClient()
  }

  async heartbeat(userId, metadata = {}) {
    const redisClient = await this._getClient()
    if (!REDIS_ENABLED || !redisClient) {
      return { success: false, reason: 'redis_disabled' }
    }

    try {
      const now = Date.now()
      const deviceId = metadata.deviceId || 'default'
      
      // 多设备支持：每个设备一个 key
      const deviceKey = `${ONLINE_USER_PREFIX}${userId}:device:${deviceId}`
      await redisClient.hSet(deviceKey, {
        lastActiveAt: String(now),
        level: String(metadata.level || 1),
        currentPage: metadata.currentPage || '',
        deviceType: metadata.deviceType || 'unknown', // mobile/desktop
        userAgent: metadata.userAgent || ''
      })
      
      // 设置过期时间（2分钟无心跳则离线）
      await redisClient.expire(deviceKey, HEARTBEAT_TIMEOUT)
      
      // 维护用户的设备列表
      const userDevicesKey = `${ONLINE_USER_PREFIX}${userId}:devices`
      await redisClient.sAdd(userDevicesKey, deviceId)
      await redisClient.expire(userDevicesKey, HEARTBEAT_TIMEOUT)
      
      // 加入在线用户集合（score 为最后活跃时间戳）
      await redisClient.zAdd(ONLINE_USERS_SET, [{ score: now, value: String(userId) }])
      
      return { success: true }
    } catch (error) {
      logger.error('心跳上报失败:', error)
      return { success: false, reason: error.message }
    }
  }

  /**
   * 用户离线
   */
  async offline(userId) {
    const redisClient = await this._getClient()
    if (!REDIS_ENABLED || !redisClient) {
      return { success: false }
    }

    try {
      // 从在线用户集合移除
      await redisClient.zRem(ONLINE_USERS_SET, String(userId))
      
      // 删除用户状态
      const userKey = `${ONLINE_USER_PREFIX}${userId}`
      await redisClient.del(userKey)
      
      return { success: true }
    } catch (error) {
      logger.error('离线处理失败:', error)
      return { success: false }
    }
  }

  /**
   * 清理超时用户
   * 应由定时任务每分钟调用一次
   */
  async cleanupOfflineUsers() {
    const redisClient = await this._getClient()
    if (!REDIS_ENABLED || !redisClient) {
      return { cleaned: 0 }
    }

    try {
      const threshold = Date.now() - HEARTBEAT_TIMEOUT * 1000
      
      // 移除超时用户
      const removed = await redisClient.zRemRangeByScore(ONLINE_USERS_SET, '-inf', threshold)
      
      if (removed > 0) {
        logger.debug(`清理离线用户: ${removed} 个`)
      }
      
      return { cleaned: removed }
    } catch (error) {
      logger.error('清理离线用户失败:', error.message)
      return { cleaned: 0 }
    }
  }

  /**
   * 获取当前在线用户数
   * @returns {number|null} 在线用户数，如果Redis未启用则返回null
   */
  async getOnlineCount() {
    const redisClient = await this._getClient()
    if (!REDIS_ENABLED || !redisClient) {
      return null  // 返回null表示功能不可用，而不是返回0
    }

    try {
      // 先清理超时用户
      await this.cleanupOfflineUsers()
      
      // 获取在线用户数
      const count = await redisClient.zCard(ONLINE_USERS_SET)
      
      // 缓存计数（供快速查询）
      await redisClient.set(ONLINE_COUNT_CACHE, count, { EX: 60 })
      
      return count
    } catch (error) {
      logger.error('获取在线用户数失败:', error.message)
      return null
    }
  }

  /**
   * 获取活跃用户数（5分钟内有操作）
   */
  async getActiveCount() {
    const redisClient = await this._getClient()
    if (!REDIS_ENABLED || !redisClient) {
      return 0
    }

    try {
      const threshold = Date.now() - ACTIVE_THRESHOLD * 1000
      const count = await redisClient.zCount(ONLINE_USERS_SET, threshold, '+inf')
      return count
    } catch (error) {
      logger.error('获取活跃用户数失败:', error.message)
      return 0
    }
  }

  /**
   * 获取在线用户列表
   */
  async getOnlineUsers(limit = 100) {
    const redisClient = await this._getClient()
    if (!REDIS_ENABLED || !redisClient) {
      return []
    }

    try {
      const userIds = await redisClient.zRange(ONLINE_USERS_SET, 0, limit - 1, { REV: true })
      return userIds
    } catch (error) {
      logger.error('获取在线用户列表失败:', error.message)
      return []
    }
  }

  /**
   * 检查用户是否在线
   */
  async isOnline(userId) {
    const redisClient = await this._getClient()
    if (!REDIS_ENABLED || !redisClient) {
      return false
    }

    try {
      const score = await redisClient.zScore(ONLINE_USERS_SET, userId)
      return score !== null
    } catch (error) {
      return false
    }
  }

  /**
   * 批量检查用户在线状态
   * @param {number[]} userIds - 用户ID数组
   * @returns {Promise<Map<number, boolean>>} - 用户ID -> 是否在线的映射
   */
  async batchCheckOnline(userIds) {
    const result = new Map()
    
    const redisClient = await this._getClient()
    if (!REDIS_ENABLED || !redisClient || !userIds || userIds.length === 0) {
      userIds?.forEach(id => result.set(id, false))
      return result
    }

    try {
      const pipeline = redisClient.multi()
      
      for (const userId of userIds) {
        pipeline.zScore(ONLINE_USERS_SET, String(userId))
      }
      
      const scores = await pipeline.exec()
      
      for (let i = 0; i < userIds.length; i++) {
        const score = scores[i]
        const scoreValue = Array.isArray(score) ? score[1] : score
        result.set(userIds[i], scoreValue !== null)
      }
      
      return result
    } catch (error) {
      logger.error('批量检查在线状态失败:', error.message)
      userIds.forEach(id => result.set(id, false))
      return result
    }
  }

  /**
   * 批量检查用户在线状态
   * @param {number[]} userIds - 用户ID数组
   * @returns {Promise<Map<number, boolean>>} - 用户ID -> 是否在线的映射
   */
  async batchCheckOnline(userIds) {
    const result = new Map()
    
    const redisClient = await this._getClient()
    if (!REDIS_ENABLED || !redisClient || !userIds || userIds.length === 0) {
      // Redis 不可用时，返回空结果
      userIds?.forEach(id => result.set(id, false))
      return result
    }

    try {
      // 使用 pipeline 批量查询
      const pipeline = redisClient.multi()
      
      for (const userId of userIds) {
        pipeline.zScore(ONLINE_USERS_SET, String(userId))
      }
      
      const scores = await pipeline.exec()
      
      for (let i = 0; i < userIds.length; i++) {
        const score = scores[i]
        // Redis v4 multi.exec 返回 [error, result] 数组
        const scoreValue = Array.isArray(score) ? score[1] : score
        result.set(userIds[i], scoreValue !== null)
      }
      
      return result
    } catch (error) {
      logger.error('批量检查在线状态失败:', error.message)
      // 出错时返回全部离线
      userIds.forEach(id => result.set(id, false))
      return result
    }
  }

  /**
   * 获取用户在线状态详情
   */
  async getUserOnlineInfo(userId) {
    const redisClient = await this._getClient()
    if (!REDIS_ENABLED || !redisClient) {
      return null
    }

    try {
      const userKey = `${ONLINE_USER_PREFIX}${userId}`
      const data = await redisClient.hGetAll(userKey)
      
      if (!data || !data.lastActiveAt) {
        return null
      }
      
      return {
        userId,
        lastActiveAt: new Date(parseInt(data.lastActiveAt)),
        level: parseInt(data.level) || 1,
        currentPage: data.currentPage || '',
        deviceId: data.deviceId || '',
        isOnline: await this.isOnline(userId)
      }
    } catch (error) {
      logger.error('获取用户在线状态失败:', error.message)
      return null
    }
  }

  /**
   * 获取按等级分组的在线用户统计
   */
  async getOnlineStatsByLevel() {
    const redisClient = await this._getClient()
    if (!REDIS_ENABLED || !redisClient) {
      return { total: 0, byLevel: {} }
    }

    try {
      const userIds = await redisClient.zRange(ONLINE_USERS_SET, 0, -1)
      const byLevel = {}
      
      for (const userId of userIds) {
        const userKey = `${ONLINE_USER_PREFIX}${userId}`
        const data = await redisClient.hGet(userKey, 'level')
        const level = parseInt(data) || 1
        byLevel[level] = (byLevel[level] || 0) + 1
      }
      
      return {
        total: userIds.length,
        byLevel
      }
    } catch (error) {
      logger.error('获取等级在线统计失败:', error.message)
      return { total: 0, byLevel: {} }
    }
  }

  /**
   * 获取完整的在线统计信息
   */
  async getFullStats() {
    const [total, active5min, byLevel] = await Promise.all([
      this.getOnlineCount(),
      this.getActiveCount(),
      this.getOnlineStatsByLevel()
    ])
    
    return {
      total,
      active5min,
      active15min: active5min, // 简化处理
      byLevel: byLevel.byLevel,
      timestamp: new Date().toISOString()
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V2.0 新增功能：城市维度在线用户管理
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 按城市获取在线用户列表
   * @param {string} city - 城市名称
   * @returns {Promise<Array>} - 在线用户列表
   */
  async getOnlineUsersByCity(city) {
    const redisClient = await this._getClient()
    if (!REDIS_ENABLED || !redisClient || !city) {
      return []
    }

    try {
      const cityKey = `${CITY_ONLINE_PREFIX}${city}`
      const userIds = await redisClient.sMembers(cityKey)
      
      if (!userIds || userIds.length === 0) {
        return []
      }

      // 批量获取用户详情
      const users = await Promise.all(
        userIds.map(userId => this.getUserOnlineInfo(parseInt(userId)))
      )

      return users.filter(Boolean)
    } catch (error) {
      logger.error('获取城市在线用户失败:', error.message)
      return []
    }
  }

  /**
   * 按城市统计在线用户
   * @returns {Promise<Array>} - 城市统计列表
   */
  async getOnlineStatsByCity() {
    const redisClient = await this._getClient()
    if (!REDIS_ENABLED || !redisClient) {
      return []
    }

    try {
      // 从缓存获取
      const cached = await redisClient.hGetAll(CITY_ONLINE_STATS)
      if (cached && Object.keys(cached).length > 0) {
        return Object.entries(cached).map(([city, count]) => ({
          city,
          onlineCount: parseInt(count)
        }))
      }

      // 从数据库获取城市分布统计
      const { data: cityStats } = await supabase
        .from('city_online_stats')
        .select('city, online_count')
        .gt('online_count', 0)

      if (cityStats && cityStats.length > 0) {
        return cityStats.map(s => ({
          city: s.city,
          onlineCount: s.online_count
        }))
      }

      return []
    } catch (error) {
      logger.error('获取城市在线统计失败:', error.message)
      return []
    }
  }

  /**
   * 添加用户到城市在线索引
   * @param {number} userId - 用户ID
   * @param {string} city - 城市
   */
  async addToCityIndex(userId, city) {
    const redisClient = await this._getClient()
    if (!REDIS_ENABLED || !redisClient || !city) return

    try {
      const cityKey = `${CITY_ONLINE_PREFIX}${city}`
      await redisClient.sAdd(cityKey, userId.toString())
      await redisClient.expire(cityKey, HEARTBEAT_TIMEOUT)
      
      // 更新城市统计缓存
      await redisClient.hIncrBy(CITY_ONLINE_STATS, city, 1)
      await redisClient.expire(CITY_ONLINE_STATS, 60)
    } catch (error) {
      logger.error('添加城市索引失败:', error.message)
    }
  }

  /**
   * 从城市在线索引移除用户
   * @param {number} userId - 用户ID
   * @param {string} city - 城市
   */
  async removeFromCityIndex(userId, city) {
    const redisClient = await this._getClient()
    if (!REDIS_ENABLED || !redisClient || !city) return

    try {
      const cityKey = `${CITY_ONLINE_PREFIX}${city}`
      await redisClient.sRem(cityKey, userId.toString())
      
      // 更新城市统计缓存
      await redisClient.hIncrBy(CITY_ONLINE_STATS, city, -1)
    } catch (error) {
      logger.error('移除城市索引失败:', error.message)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V2.0 新增功能：完整在线用户快照
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 获取完整在线用户快照
   * 包含用户等级、城市、曝光状态等完整信息
   * @returns {Promise<Array>} - 在线用户快照列表
   */
  async getOnlineUsersSnapshot() {
    const redisClient = await this._getClient()
    if (!REDIS_ENABLED || !redisClient) {
      return []
    }

    try {
      const now = Date.now()
      const userIds = await redisClient.zRangeByScore(ONLINE_USERS_SET, 0, now)

      if (!userIds || userIds.length === 0) {
        return []
      }

      // 批量获取用户详情
      const users = await Promise.all(
        userIds.map(async (userId) => {
          const info = await this.getUserOnlineInfoWithExposure(parseInt(userId))
          return info
        })
      )

      return users.filter(Boolean)
    } catch (error) {
      logger.error('获取在线用户快照失败:', error.message)
      return []
    }
  }

  /**
   * 获取用户完整在线信息（包含曝光额度）
   * @param {number} userId - 用户ID
   * @returns {Promise<Object|null>} - 用户完整信息
   */
  async getUserOnlineInfoWithExposure(userId) {
    const redisClient = await this._getClient()
    if (!REDIS_ENABLED || !redisClient) {
      return null
    }

    try {
      let data = null
      
      // 首先尝试从 heartbeatEnhanced 存储位置读取
      const userKey = `${ONLINE_USER_PREFIX}${userId}`
      data = await redisClient.hGetAll(userKey)
      
      // 如果没有数据，尝试从 heartbeat 存储的设备目录读取
      if (!data || !data.lastActiveAt) {
        const devicesKey = `${ONLINE_USER_PREFIX}${userId}:devices`
        const devices = await redisClient.sMembers(devicesKey)
        
        if (devices && devices.length > 0) {
          // 获取最新活跃的设备数据
          let latestData = null
          let latestTime = 0
          
          for (const deviceId of devices) {
            const deviceKey = `${ONLINE_USER_PREFIX}${userId}:device:${deviceId}`
            const deviceData = await redisClient.hGetAll(deviceKey)
            
            if (deviceData && deviceData.lastActiveAt) {
              const activeTime = parseInt(deviceData.lastActiveAt)
              if (activeTime > latestTime) {
                latestTime = activeTime
                latestData = deviceData
              }
            }
          }
          
          if (latestData) {
            data = latestData
          }
        }
      }

      if (!data || !data.lastActiveAt) {
        return null
      }

      // 获取曝光额度信息
      const exposureQuota = await this.getUserExposureQuota(userId)

      return {
        user_id: userId,
        lastActiveAt: new Date(parseInt(data.lastActiveAt)),
        level: parseInt(data.level) || 1,
        city: data.city || '未知',
        province: data.province || '未知',
        currentPage: data.currentPage || '',
        deviceId: data.deviceId || '',
        isOnline: await this.isOnline(userId),
        // 曝光相关信息
        current_exposure: exposureQuota.current,
        exposure_limit: exposureQuota.limit,
        available_quota: exposureQuota.available,
        selection_score: exposureQuota.selectionScore
      }
    } catch (error) {
      logger.error('获取用户完整在线信息失败:', error.message)
      return null
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V2.0 新增功能：增强版心跳机制
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 增强版心跳上报（支持城市和曝光状态）
   * @param {number} userId - 用户ID
   * @param {object} metadata - 附加信息 { level, city, province, currentPage, deviceId }
   * @returns {Promise<object>} - 心跳结果
   */
  async heartbeatEnhanced(userId, metadata = {}) {
    const numericUserId = Number(userId)
    const safeUserId = Number.isFinite(numericUserId) ? numericUserId : userId
    const redisClient = await this._getClient()
    if (!REDIS_ENABLED || !redisClient) {
      // Redis 不可用时，更新数据库中的最后活跃时间
      try {
        await db.query(
          'UPDATE users SET last_task_date = NOW(), updated_at = NOW() WHERE id = $1',
          [safeUserId]
        )
      } catch (e) {
        logger.warn('更新用户活跃时间失败:', e.message)
      }
      return { success: false, reason: 'redis_disabled' }
    }

    try {
      const now = Date.now()
      const userKey = `${ONLINE_USER_PREFIX}${userId}`

      // 获取用户之前的城市
      const prevData = await redisClient.hGetAll(userKey)
      const prevCity = prevData?.city

      // 更新用户状态
      const updateData = {
        lastActiveAt: now.toString(),
        level: (metadata.level || 1).toString(),
        city: metadata.city || '未知',
        province: metadata.province || '未知',
        currentPage: metadata.currentPage || '',
        deviceId: metadata.deviceId || ''
      }

      await redisClient.hSet(userKey, updateData)
      // 同步更新数据库中的地址（如果地址有变化且有效）
      if (metadata.city && metadata.city !== "未知" && metadata.province && metadata.province !== "未知") {
        try {
          await db.query(
            'UPDATE users SET city = $1, province = $2, updated_at = NOW() WHERE id = $3',
            [metadata.city, metadata.province, safeUserId]
          )
        } catch (dbErr) {
          logger.warn("更新用户地址失败:", dbErr.message)
        }
      }
      await redisClient.expire(userKey, HEARTBEAT_TIMEOUT)

      // 更新在线用户集合
      await redisClient.zAdd(ONLINE_USERS_SET, [{ score: now, value: userId.toString() }])

      // 更新城市索引
      const newCity = metadata.city
      if (prevCity && prevCity !== newCity && prevCity !== '未知') {
        await this.removeFromCityIndex(userId, prevCity)
      }
      if (newCity && newCity !== '未知') {
        await this.addToCityIndex(userId, newCity)
      }

      // 检查是否是重新上线
      const wasOffline = !prevData || Object.keys(prevData).length === 0

      // 获取曝光额度
      const exposureQuota = await this.getUserExposureQuota(userId)
      
      // ═══════════════════════════════════════════════════════════════════════════
      // V3.0 新增：用户重新上线时的处理
      // ═══════════════════════════════════════════════════════════════════════════
      if (wasOffline) {
        // 异步触发曝光分配（不阻塞响应）
        this.triggerExposureOnOnline(userId, metadata).catch(err => 
          logger.warn(`用户上线触发曝光分配失败: ${err.message}`)
        )
      }

      return {
        success: true,
        wasOffline,
        exposureQuota
      }
    } catch (error) {
      logger.error('增强版心跳上报失败:', error.message)
      return { success: false, reason: error.message }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V2.0 新增功能：曝光额度管理
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 获取用户曝光额度
   * @param {number} userId - 用户ID
   * @returns {Promise<object>} - 曝光额度信息
   */
  async getUserExposureQuota(userId) {
    // 优先从Redis获取
    const redisClient = await this._getClient()
    if (REDIS_ENABLED && redisClient) {
      try {
        const key = `${USER_EXPOSURE_PREFIX}${userId}`
        const cached = await redisClient.hGetAll(key)

        if (cached && Object.keys(cached).length > 0) {
          return {
            limit: parseInt(cached.exposure_limit) || 20,
            current: parseInt(cached.current_exposure) || 0,
            regularUsed: parseInt(cached.regular_used) || 0,
            reservedUsed: parseInt(cached.reserved_used) || 0,
            available: Math.max(0, (parseInt(cached.exposure_limit) || 20) - (parseInt(cached.current_exposure) || 0)),
            selectionScore: parseFloat(cached.selection_score) || 0
          }
        }
      } catch (error) {
        logger.warn('从Redis获取曝光额度失败:', error.message)
      }
    }

    // 从数据库获取
    try {
      const { data: user } = await supabase
        .from('users')
        .select('level, current_exposure, regular_used, reserved_used, is_whitelist, is_blacklist')
        .eq('id', userId)
        .single()

      if (!user) {
        return { limit: 10, current: 0, regularUsed: 0, reservedUsed: 0, available: 10, selectionScore: 0 }
      }

      // 获取等级对应的曝光上限
      const limit = await this.getExposureLimitByLevel(user.level)

      return {
        limit,
        current: user.current_exposure || 0,
        regularUsed: user.regular_used || 0,
        reservedUsed: user.reserved_used || 0,
        available: Math.max(0, limit - (user.current_exposure || 0)),
        selectionScore: 0 // 需要单独计算
      }
    } catch (error) {
      logger.error('获取用户曝光额度失败:', error.message)
      return { limit: 10, current: 0, regularUsed: 0, reservedUsed: 0, available: 10, selectionScore: 0 }
    }
  }

  /**
   * 根据用户等级获取曝光上限
   * @param {number} level - 用户等级
   * @returns {Promise<number>} - 曝光上限
   */
  async getExposureLimitByLevel(level) {
    const levelNum = Number(level) || 1
    try {
      const levelConfig = await db.queryOne(
        'SELECT concurrent_tasks FROM level_configs WHERE level = $1 LIMIT 1',
        [levelNum]
      )
      return Number(levelConfig?.concurrent_tasks) || 10
    } catch (error) {
      // 默认值
      const EXPOSURE_LIMITS = {
        1: 10,
        2: 12,
        3: 15,
        4: 18,
        5: 20,
        6: 20
      }
      return EXPOSURE_LIMITS[levelNum] || 10
    }
  }

  /**
   * 更新用户曝光额度
   * @param {number} userId - 用户ID
   * @param {number} delta - 变化量（正数增加，负数减少）
   * @param {string} type - 类型 'regular' | 'reserved'
   * @returns {Promise<boolean>} - 是否成功
   */
  async updateUserExposureQuota(userId, delta, type = 'regular') {
    // 更新 Redis
    const redisClient = await this._getClient()
    if (REDIS_ENABLED && redisClient) {
      try {
        const key = `${USER_EXPOSURE_PREFIX}${userId}`
        const multi = redisClient.multi()

        multi.hIncrBy(key, 'current_exposure', delta)
        if (type === 'regular' && delta > 0) {
          multi.hIncrBy(key, 'regular_used', delta)
        } else if (type === 'reserved' && delta > 0) {
          multi.hIncrBy(key, 'reserved_used', delta)
        }

        await multi.exec()
      } catch (error) {
        logger.error('更新Redis曝光额度失败:', error.message)
      }
    }

    // 更新数据库
    try {
      await supabase.rpc('update_user_exposure_quota', {
        p_user_id: userId,
        p_delta: delta
      })
      return true
    } catch (error) {
      logger.error('更新数据库曝光额度失败:', error.message)
      return false
    }
  }

  /**
   * 初始化用户曝光额度缓存
   * @param {number} userId - 用户ID
   */
  async initUserExposureQuotaCache(userId) {
    const redisClient = await this._getClient()
    if (!REDIS_ENABLED || !redisClient) return

    try {
      const quota = await this.getUserExposureQuota(userId)
      const key = `${USER_EXPOSURE_PREFIX}${userId}`

      await redisClient.hSet(key, {
        exposure_limit: quota.limit.toString(),
        current_exposure: quota.current.toString(),
        regular_used: quota.regularUsed.toString(),
        reserved_used: quota.reservedUsed.toString(),
        selection_score: quota.selectionScore.toString()
      })
      await redisClient.expire(key, EXPOSURE_QUOTA_TTL)
    } catch (error) {
      logger.error('初始化曝光额度缓存失败:', error.message)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V2.0 新增功能：离线缓冲机制
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 增强版离线处理（支持缓冲期）
   * @param {number} userId - 用户ID
   * @returns {Promise<object>} - 处理结果
   */
  async offlineEnhanced(userId) {
    // 获取用户信息
    const userInfo = await this.getUserOnlineInfoWithExposure(userId)
    const userCity = userInfo?.city

    // 从在线用户集合移除
    const redisClient = await this._getClient()
    if (REDIS_ENABLED && redisClient) {
      await redisClient.zRem(ONLINE_USERS_SET, userId.toString())

      // 删除用户详情
      const userKey = `${ONLINE_USER_PREFIX}${userId}`
      await redisClient.del(userKey)

      // 从城市索引移除
      if (userCity && userCity !== '未知') {
        await this.removeFromCityIndex(userId, userCity)
      }

      // 更新缓存计数
      await redisClient.decr(ONLINE_COUNT_CACHE)

      // 设置离线缓冲状态
      const bufferKey = `${OFFLINE_BUFFER_PREFIX}${userId}`
      await redisClient.set(bufferKey, '1', { EX: OFFLINE_BUFFER_TIME })
    }

    logger.info(`用户 ${userId} 下线，进入缓冲期`)

    return { success: true, buffered: true }
  }

  /**
   * 检查离线缓冲（定时任务调用）
   * 缓冲期结束后释放曝光额度
   * @returns {Promise<number>} - 处理的用户数
   */
  async checkOfflineBuffer() {
    const redisClient = await this._getClient()
    if (!REDIS_ENABLED || !redisClient) {
      return 0
    }

    try {
      // 扫描所有离线缓冲键
      let processedCount = 0
      let cursor = 0

      do {
        const { cursor: newCursor, keys } = await redisClient.scan(
          cursor,
          { MATCH: `${OFFLINE_BUFFER_PREFIX}*`, COUNT: 100 }
        )
        cursor = newCursor

        for (const key of keys) {
          const ttl = await redisClient.ttl(key)

          // TTL <= 0 表示已过期
          if (ttl <= 0) {
            const userId = key.replace(OFFLINE_BUFFER_PREFIX, '')

            // 检查用户是否真正离线
            const isStillOnline = await this.isOnline(parseInt(userId))

            if (!isStillOnline) {
              // 释放曝光额度
              await this.releaseExposureOnOffline(parseInt(userId))
              processedCount++
            }

            // 删除缓冲键
            await redisClient.del(key)
          }
        }
      } while (cursor !== 0)

      if (processedCount > 0) {
        logger.info(`离线缓冲检查完成，释放了 ${processedCount} 个用户的曝光额度`)
      }

      return processedCount
    } catch (error) {
      logger.error('检查离线缓冲失败:', error.message)
      return 0
    }
  }

  /**
   * 用户离线时释放曝光额度
   * @param {number} userId - 用户ID
   */
  async releaseExposureOnOffline(userId) {
    try {
      const quota = await this.getUserExposureQuota(userId)

      if (quota.current > 0) {
        // 重置曝光额度
        await this.updateUserExposureQuota(userId, -quota.current)
        logger.info(`用户 ${userId} 离线，释放 ${quota.current} 个曝光额度`)
      }
      
      // V3.0 新增：将用户已曝光但未领取的任务重新入队
      await this.requeueUserExposedTasks(userId)
    } catch (error) {
      logger.error('释放曝光额度失败:', error.message)
    }
  }
  
  /**
   * 将用户已曝光但未领取的任务重新入队
   * V3.0 新增功能
   * @param {number} userId - 用户ID
   */
  async requeueUserExposedTasks(userId) {
    try {
      // 动态导入避免循环依赖
      const supabase = await import('../utils/supabaseToPrismaAdapter.js')
      
      // 1. 查询用户已曝光但未领取的任务
      // 曝光记录存在但领取记录不存在
      const { data: exposedTasks } = await supabase
        .from('task_view_records')
        .select('task_id, created_at')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // 最近30分钟内曝光的
        .order('created_at', { ascending: false })
        .limit(20)
      
      if (!exposedTasks || exposedTasks.length === 0) {
        return
      }
      
      // 2. 过滤出未领取的任务
      const taskIds = exposedTasks.map(t => t.task_id)
      const { data: claimedTasks } = await supabase
        .from('claims')
        .select('task_id')
        .eq('user_id', userId)
        .in('task_id', taskIds)
        .in('status', ['doing', 'pending', 'done'])
      
      const claimedSet = new Set((claimedTasks || []).map(c => c.task_id))
      const unclaimedTaskIds = taskIds.filter(id => !claimedSet.has(id))
      
      if (unclaimedTaskIds.length === 0) {
        return
      }
      
      // 3. 更新这些任务的曝光计数（减少曝光数）
      // 这样这些任务可以被其他用户看到
      const { error: updateError } = await supabase.rpc('decrement_task_exposure', {
        task_ids: unclaimedTaskIds
      })
      
      if (updateError) {
        logger.warn(`更新任务曝光计数失败: ${updateError.message}`)
      }
      
      // 4. 删除这些曝光记录
      const { error: deleteError } = await supabase
        .from('task_view_records')
        .delete()
        .eq('user_id', userId)
        .in('task_id', unclaimedTaskIds)
      
      if (deleteError) {
        logger.warn(`删除曝光记录失败: ${deleteError.message}`)
      }
      
      logger.info(`用户 ${userId} 离线，重新入队 ${unclaimedTaskIds.length} 个任务`)
    } catch (error) {
      logger.error(`重新入队用户任务失败: ${error.message}`)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V3.0 新增功能：用户上线曝光分配
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 用户上线时触发曝光分配
   * @param {number} userId - 用户ID
   * @param {object} metadata - 用户元数据
   */
  async triggerExposureOnOnline(userId, metadata = {}) {
    try {
      // 动态导入 exposureService 避免循环依赖
      const exposureService = (await import('./exposureService.js')).default
      
      // 1. 计算用户选择分数
      const selectionScore = await exposureService.calculateSelectionScore(userId)
      logger.info(`用户 ${userId} 上线，选择分数: ${selectionScore}`)
      
      // 2. 预分配曝光额度（如果不足）
      const quota = await this.getUserExposureQuota(userId)
      if (quota.available < quota.limit * 0.5) {
        // 如果可用额度低于限制的50%，预分配到基础额度
        const baseQuota = await this.getExposureLimitByLevel(metadata.level || 1)
        const delta = baseQuota - quota.current
        if (delta > 0) {
          await this.updateUserExposureQuota(userId, delta)
          logger.info(`用户 ${userId} 预分配曝光额度: +${delta}`)
        }
      }
      
      // 3. 触发曝光分配（通知用户有新任务可领取）
      // 通过 WebSocket 推送任务更新通知
      try {
        const webSocketService = (await import('./webSocketService.js')).default
        await webSocketService.sendToUser(userId, {
          type: 'exposure_refresh',
          data: {
            selectionScore,
            quota: await this.getUserExposureQuota(userId),
            message: '您有新的任务可领取'
          }
        })
      } catch (wsErr) {
        logger.debug(`WebSocket推送失败: ${wsErr.message}`)
      }
      
      return { success: true, selectionScore }
    } catch (error) {
      logger.error(`用户上线触发曝光分配失败: ${error.message}`)
      return { success: false, error: error.message }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // V2.0 新增功能：全局统计
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 获取全局在线统计
   * @returns {Promise<object>} - 全局统计信息
   */
  /**
   * 获取全局在线统计（V3.0 修复版）
   * 返回前端期望的数据结构
   */
  async getGlobalOnlineStats() {
    // 尝试从缓存获取
    const redisClient = await this._getClient()
    if (REDIS_ENABLED && redisClient) {
      try {
        const cached = await redisClient.hGetAll(ONLINE_STATS_CACHE)
        if (cached && Object.keys(cached).length > 0) {
          // 返回前端期望的数据结构
          return {
            total: parseInt(cached.total_online) || 0,
            byLevel: JSON.parse(cached.level_distribution || '{}'),
            byCity: JSON.parse(cached.city_distribution || '{}'),
            byProvince: JSON.parse(cached.province_distribution || '{}'),
            peakToday: parseInt(cached.peak_today) || 0,
            peakTime: cached.peak_time || null,
            avgOnlineTime: parseInt(cached.avg_online_time) || 0,
            // 兼容旧字段
            totalOnline: parseInt(cached.total_online) || 0,
            levelDistribution: JSON.parse(cached.level_distribution || '{}'),
            cityDistribution: JSON.parse(cached.city_distribution || '{}'),
            lastUpdated: cached.last_updated
          }
        }
      } catch (error) {
        logger.warn('从缓存获取全局统计失败:', error.message)
      }
    }

    // 重新计算
    const users = await this.getOnlineUsersSnapshot()

    // 等级分布
    const byLevel = {}
    users.forEach(user => {
      const level = user.level || 1
      byLevel[level] = (byLevel[level] || 0) + 1
    })

    // 城市分布
    const byCity = {}
    users.forEach(user => {
      const city = user.city || '未知'
      byCity[city] = (byCity[city] || 0) + 1
    })

    // 省份分布
    const byProvince = {}
    users.forEach(user => {
      const province = user.province || '未知'
      byProvince[province] = (byProvince[province] || 0) + 1
    })

    // 今日峰值（从缓存或重新计算）
    let peakToday = users.length
    let peakTime = new Date().toISOString()
    if (REDIS_ENABLED && redisClient) {
      try {
        const peakData = await redisClient.get(ONLINE_PEAK_KEY)
        if (peakData) {
          const parsed = JSON.parse(peakData)
          peakToday = Math.max(parsed.count || 0, users.length)
          peakTime = parsed.time || peakTime
        }
      } catch (e) {}
    }

    const stats = {
      total: users.length,
      byLevel,
      byCity,
      byProvince,
      peakToday,
      peakTime,
      avgOnlineTime: 0, // 需要额外的在线时长追踪
      // 兼容旧字段
      totalOnline: users.length,
      levelDistribution: byLevel,
      cityDistribution: byCity,
      lastUpdated: new Date().toISOString()
    }

    // 缓存结果
    if (REDIS_ENABLED && redisClient) {
      try {
        await redisClient.hSet(ONLINE_STATS_CACHE, {
          total_online: stats.total.toString(),
          level_distribution: JSON.stringify(byLevel),
          city_distribution: JSON.stringify(byCity),
          province_distribution: JSON.stringify(byProvince),
          peak_today: peakToday.toString(),
          peak_time: peakTime,
          avg_online_time: '0',
          last_updated: stats.lastUpdated
        })
        await redisClient.expire(ONLINE_STATS_CACHE, 30)
      } catch (error) {
        logger.warn('缓存全局统计失败:', error.message)
      }
    }

    return stats
  }

  /**
   * 刷新全局统计缓存
   */
  async refreshGlobalStats() {
    const redisClient = await this._getClient()
    if (REDIS_ENABLED && redisClient) {
      await redisClient.del(ONLINE_STATS_CACHE)
      await redisClient.del(CITY_ONLINE_STATS)
    }
    return await this.getGlobalOnlineStats()
  }

  /**
   * 批量获取用户设备信息
   */
  async batchGetUserDevices(userIds) {
    const redisClient = await this._getClient()
    const result = new Map()
    
    if (!REDIS_ENABLED || !redisClient || !userIds || userIds.length === 0) {
      return result
    }

    try {
      for (const userId of userIds) {
        const info = await this.getUserOnlineInfo(userId)
        result.set(String(userId), info?.devices || [])
      }
      return result
    } catch (error) {
      logger.error('批量获取设备信息失败:', error)
      return result
    }
  }

}

export default new OnlineUserService()
