import prisma from '../utils/prisma.js'
import { redisClient, REDIS_ENABLED } from '../utils/redis.js'
import logger from '../utils/logger.js'
import db from '../config/database.js'

/**
 * 曝光配额服务
 * 统一管理用户曝光配额的获取、更新、释放
 * 
 * V3.0 重构：
 * - 统一从 exposureService 调用
 * - 使用 Prisma + CockroachDB 替代 Supabase
 * - Redis 缓存优化
 */
class ExposureQuotaService {
  constructor() {
    // Redis key 前缀
    this.CACHE_PREFIX = 'user_exposure:'
    this.CACHE_TTL = 7200 // 2小时缓存
    
    // 默认曝光限制配置
    this.DEFAULT_EXPOSURE_LIMITS = {
      1: 10,
      2: 12,
      3: 15,
      4: 18,
      5: 20,
      6: 20
    }
    
    // 等级配置缓存
    this.levelConfigCache = new Map()
    this.cacheExpiry = 0
  }

  /**
   * 获取用户曝光配额
   * @param {number|string} userId - 用户ID
   * @returns {Promise<object>} - 曝光配额信息
   */
  async getUserExposureQuota(userId) {
    const uid = typeof userId === 'string' ? parseInt(userId) : userId
    
    // 1. 优先从 Redis 获取
    if (REDIS_ENABLED && redisClient) {
      try {
        const key = `${this.CACHE_PREFIX}${uid}`
        const cached = await redisClient.hGetAll(key)
        
        if (cached && Object.keys(cached).length > 0) {
          return {
            limit: parseInt(cached.exposure_limit) || 20,
            current: parseInt(cached.current_exposure) || 0,
            regularUsed: parseInt(cached.regular_used) || 0,
            reservedUsed: parseInt(cached.reserved_used) || 0,
            available: Math.max(0, (parseInt(cached.exposure_limit) || 20) - (parseInt(cached.current_exposure) || 0)),
            selectionScore: parseFloat(cached.selection_score) || 0,
            fromCache: true
          }
        }
      } catch (error) {
        logger.warn(`[ExposureQuota] Redis 获取失败: ${error.message}`)
      }
    }
    
    // 2. 从 Prisma (CockroachDB) 获取
    try {
      const user = await prisma.users.findUnique({
        where: { id: uid },
        select: {
          level: true,
          current_exposure: true,
          regular_used: true,
          reserved_used: true,
          is_whitelist: true,
          is_blacklist: true,
          exposure_level: true,
          exposure_priority: true
        }
      })
      
      if (!user) {
        return this._getDefaultQuota()
      }
      
      // 获取等级对应的曝光上限
      const limit = await this.getExposureLimitByLevel(user.level)
      const currentExposure = Number(user.current_exposure || 0)
      const regularUsed = Number(user.regular_used || 0)
      const reservedUsed = Number(user.reserved_used || 0)
      
      const quota = {
        limit,
        current: currentExposure,
        regularUsed,
        reservedUsed,
        available: Math.max(0, limit - currentExposure),
        isWhitelist: user.is_whitelist || false,
        isBlacklist: user.is_blacklist || false,
        exposureLevel: user.exposure_level || 1,
        exposurePriority: user.exposure_priority || 0,
        fromCache: false
      }
      
      // 3. 缓存到 Redis
      await this._cacheQuota(uid, quota)
      
      return quota
    } catch (error) {
      logger.error(`[ExposureQuota] 获取用户曝光额度失败: ${error.message}`)
      return this._getDefaultQuota()
    }
  }

  /**
   * 根据用户等级获取曝光上限
   * @param {number} level - 用户等级
   * @returns {Promise<number>} - 曝光上限
   */
  async getExposureLimitByLevel(level) {
    const levelNum = Number(level) || 1

    // 1. 检查缓存
    if (this.levelConfigCache.has(levelNum) && Date.now() < this.cacheExpiry) {
      return this.levelConfigCache.get(levelNum)
    }
    
    // 2. 从数据库获取
    try {
      const config = await prisma.level_configs.findUnique({
        where: { level: levelNum },
        select: { concurrent_tasks: true }
      })
      
      const limit = Number(config?.concurrent_tasks) || this.DEFAULT_EXPOSURE_LIMITS[levelNum] || 10
      
      // 更新缓存
      this.levelConfigCache.set(levelNum, limit)
      this.cacheExpiry = Date.now() + 300000 // 5分钟缓存
      
      return limit
    } catch (error) {
      logger.warn(`[ExposureQuota] 获取等级配置失败: ${error.message}`)
      return this.DEFAULT_EXPOSURE_LIMITS[levelNum] || 10
    }
  }

  /**
   * 更新用户曝光额度
   * @param {number|string} userId - 用户ID
   * @param {number} delta - 变化量（正数增加，负数减少）
   * @param {string} type - 类型 'regular' | 'reserved'
   * @returns {Promise<boolean>} - 是否成功
   */
  async updateUserExposureQuota(userId, delta, type = 'regular') {
    const uid = typeof userId === 'string' ? parseInt(userId) : userId
    
    try {
      await db.query(
        `
        UPDATE users
        SET current_exposure = GREATEST(COALESCE(current_exposure, 0) + $1, 0),
            regular_used = CASE
              WHEN $2 = 'regular' AND $1 > 0 THEN COALESCE(regular_used, 0) + $1
              ELSE COALESCE(regular_used, 0)
            END,
            reserved_used = CASE
              WHEN $2 = 'reserved' AND $1 > 0 THEN COALESCE(reserved_used, 0) + $1
              ELSE COALESCE(reserved_used, 0)
            END
        WHERE id = $3
        `,
        [delta, type, uid]
      )

      if (REDIS_ENABLED && redisClient) {
        await this._clearCache(uid)
      }
      
      logger.debug(`[ExposureQuota] 用户 ${uid} 曝光额度更新: ${delta > 0 ? '+' : ''}${delta}`)
      return true
    } catch (error) {
      logger.error(`[ExposureQuota] 更新曝光额度失败: ${error.message}`)
      return false
    }
  }

  /**
   * 占用用户曝光额度
   * @param {number|string} userId - 用户ID
   * @param {number} count - 占用数量
   * @param {string} type - 类型
   * @returns {Promise<object>} - { success, available, message }
   */
  async acquireQuota(userId, count = 1, type = 'regular') {
    const uid = typeof userId === 'string' ? parseInt(userId) : userId
    
    try {
      const quota = await this.getUserExposureQuota(uid)
      
      // 白名单用户不限制
      if (quota.isWhitelist) {
        return { success: true, available: 999, message: '白名单用户无限制' }
      }
      
      // 黑名单用户禁止
      if (quota.isBlacklist) {
        return { success: false, available: 0, message: '用户已被禁止曝光' }
      }
      
      // 检查可用额度
      if (quota.available < count) {
        return { 
          success: false, 
          available: quota.available, 
          message: `曝光额度不足: 需要 ${count}, 可用 ${quota.available}` 
        }
      }
      
      // 占用额度
      const success = await this.updateUserExposureQuota(uid, count, type)
      
      if (success) {
        logger.info(`[ExposureQuota] 用户 ${uid} 占用 ${count} 个曝光额度 (${type})`)
        return { success: true, available: quota.available - count, message: '成功' }
      }
      
      return { success: false, available: quota.available, message: '更新失败' }
    } catch (error) {
      logger.error(`[ExposureQuota] 占用额度失败: ${error.message}`)
      return { success: false, available: 0, message: error.message }
    }
  }

  /**
   * 释放用户曝光额度
   * @param {number|string} userId - 用户ID
   * @param {number} count - 释放数量
   * @param {string} reason - 释放原因
   * @returns {Promise<boolean>} - 是否成功
   */
  async releaseQuota(userId, count = 1, reason = 'manual') {
    const uid = typeof userId === 'string' ? parseInt(userId) : userId
    
    const success = await this.updateUserExposureQuota(uid, -count, 'regular')
    
    if (success) {
      logger.info(`[ExposureQuota] 用户 ${uid} 释放 ${count} 个曝光额度，原因: ${reason}`)
    }
    
    return success
  }

  /**
   * 重置用户曝光额度（任务提交后调用）
   * @param {number|string} userId - 用户ID
   * @param {number} count - 释放的额度数量
   * @returns {Promise<boolean>} - 是否成功
   */
  async resetQuotaOnSubmit(userId, count = 1) {
    const uid = typeof userId === 'string' ? parseInt(userId) : userId
    
    try {
      const quota = await this.getUserExposureQuota(uid)
      
      // 确保不会释放超过当前占用的额度
      const actualRelease = Math.min(count, quota.current)
      
      if (actualRelease > 0) {
        const success = await this.updateUserExposureQuota(uid, -actualRelease, 'regular')
        
        if (success) {
          logger.info(`[ExposureQuota] 用户 ${uid} 提交任务后释放 ${actualRelease} 个曝光额度`)
        }
        return success
      }
      
      return true
    } catch (error) {
      logger.error(`[ExposureQuota] 重置额度失败: ${error.message}`)
      return false
    }
  }

  /**
   * 批量获取用户曝光配额
   * @param {number[]} userIds - 用户ID列表
   * @returns {Promise<Map<number, object>>} - 用户ID -> 配额信息映射
   */
  async batchGetUserExposureQuotas(userIds) {
    const quotaMap = new Map()
    
    if (!userIds || userIds.length === 0) {
      return quotaMap
    }
    
    try {
      // 1. 批量从 Redis 获取
      if (REDIS_ENABLED && redisClient) {
        const keys = userIds.map(id => `${this.CACHE_PREFIX}${id}`)
        const values = await redisClient.mGet(keys)
        
        for (let i = 0; i < userIds.length; i++) {
          if (values[i]) {
            try {
              const data = JSON.parse(values[i])
              quotaMap.set(userIds[i], data)
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
        
        if (quotaMap.size === userIds.length) {
          return quotaMap
        }
      }
      
      // 2. 从数据库获取未缓存的用户
      const uncachedIds = userIds.filter(id => !quotaMap.has(id))
      
      if (uncachedIds.length > 0) {
        const users = await prisma.users.findMany({
          where: { id: { in: uncachedIds } },
          select: {
            id: true,
            level: true,
            current_exposure: true,
            regular_used: true,
            reserved_used: true
          }
        })
        
        for (const user of users) {
          const limit = await this.getExposureLimitByLevel(user.level)
          const currentExposure = Number(user.current_exposure || 0)
          const regularUsed = Number(user.regular_used || 0)
          const reservedUsed = Number(user.reserved_used || 0)
          const quota = {
            limit,
            current: currentExposure,
            regularUsed,
            reservedUsed,
            available: Math.max(0, limit - currentExposure)
          }
          quotaMap.set(user.id, quota)
        }
      }
      
      return quotaMap
    } catch (error) {
      logger.error(`[ExposureQuota] 批量获取曝光额度失败: ${error.message}`)
      return quotaMap
    }
  }

  /**
   * 设置用户白名单状态
   * @param {number|string} userId - 用户ID
   * @param {boolean} isWhitelist - 是否白名单
   * @returns {Promise<boolean>} - 是否成功
   */
  async setWhitelist(userId, isWhitelist) {
    const uid = typeof userId === 'string' ? parseInt(userId) : userId
    
    try {
      await prisma.users.update({
        where: { id: uid },
        data: { is_whitelist: isWhitelist }
      })
      
      // 清除缓存
      await this._clearCache(uid)
      
      logger.info(`[ExposureQuota] 用户 ${uid} 白名单状态更新为: ${isWhitelist}`)
      return true
    } catch (error) {
      logger.error(`[ExposureQuota] 设置白名单失败: ${error.message}`)
      return false
    }
  }

  /**
   * 设置用户黑名单状态
   * @param {number|string} userId - 用户ID
   * @param {boolean} isBlacklist - 是否黑名单
   * @returns {Promise<boolean>} - 是否成功
   */
  async setBlacklist(userId, isBlacklist) {
    const uid = typeof userId === 'string' ? parseInt(userId) : userId
    
    try {
      await prisma.users.update({
        where: { id: uid },
        data: { is_blacklist: isBlacklist }
      })
      
      // 清除缓存
      await this._clearCache(uid)
      
      logger.info(`[ExposureQuota] 用户 ${uid} 黑名单状态更新为: ${isBlacklist}`)
      return true
    } catch (error) {
      logger.error(`[ExposureQuota] 设置黑名单失败: ${error.message}`)
      return false
    }
  }

  /**
   * 获取曝光配额统计
   * @param {number|string} userId - 用户ID
   * @returns {Promise<object>} - 统计信息
   */
  async getExposureStats(userId) {
    const uid = typeof userId === 'string' ? parseInt(userId) : userId
    
    try {
      const quota = await this.getUserExposureQuota(uid)
      
      // 获取今日曝光记录（使用 task_view_records 表）
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const todayCount = await prisma.task_view_records.count({
        where: {
          user_id: BigInt(uid),
          created_at: { gte: today }
        }
      })
      
      return {
        quota,
        todayExposure: todayCount,
        usageRate: quota.limit > 0 ? Math.round((quota.current / quota.limit) * 100) : 0
      }
    } catch (error) {
      logger.error(`[ExposureQuota] 获取统计失败: ${error.message}`)
      return {
        quota: this._getDefaultQuota(),
        todayExposure: 0,
        usageRate: 0
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 私有方法
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 缓存配额到 Redis
   */
  async _cacheQuota(userId, quota) {
    if (!REDIS_ENABLED || !redisClient) return
    
    try {
      const key = `${this.CACHE_PREFIX}${userId}`
      await redisClient.hSet(key, {
        exposure_limit: quota.limit.toString(),
        current_exposure: quota.current.toString(),
        regular_used: quota.regularUsed.toString(),
        reserved_used: quota.reservedUsed.toString(),
        selection_score: (quota.selectionScore || 0).toString()
      })
      await redisClient.expire(key, this.CACHE_TTL)
    } catch (error) {
      logger.warn(`[ExposureQuota] 缓存失败: ${error.message}`)
    }
  }

  /**
   * 清除缓存
   */
  async _clearCache(userId) {
    if (!REDIS_ENABLED || !redisClient) return
    
    try {
      const key = `${this.CACHE_PREFIX}${userId}`
      await redisClient.del(key)
    } catch (error) {
      logger.warn(`[ExposureQuota] 清除缓存失败: ${error.message}`)
    }
  }

  /**
   * 获取默认配额
   */
  _getDefaultQuota() {
    return {
      limit: 10,
      current: 0,
      regularUsed: 0,
      reservedUsed: 0,
      available: 10,
      isWhitelist: false,
      isBlacklist: false,
      exposureLevel: 1,
      exposurePriority: 0,
      fromCache: false
    }
  }
}

export default new ExposureQuotaService()
