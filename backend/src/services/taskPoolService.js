import supabase from '../utils/supabaseToPrismaAdapter.js'
import { cache, REDIS_ENABLED } from '../utils/redis.js'
import logger from '../utils/logger.js'
import { ACTIVE_CLAIM_STATUS_FOR_EXPOSURE } from '../constants/claimLifecycle.js'

/**
 * 任务池服务 V3.0 优化版
 * 
 * 核心优化：
 * 1. 预热时缓存完整任务对象，避免后续数据库查询
 * 2. 修复表名错误：user_tasks → claims
 * 3. 优化用户占用任务缓存更新机制
 * 4. 增加池命中率统计
 */

const POOL_CONFIG = {
  HOT_POOL_SIZE: 100,        // 增大热门池大小
  HOT_POOL_TTL: 180,         // 延长缓存时间到3分钟
  USER_POOL_SIZE: 30,
  USER_POOL_TTL: 300,        // 用户池5分钟
  MIN_POOL_SIZE: 30,
  OCCUPIED_CACHE_TTL: 120,   // 用户占用缓存2分钟
  HOT_POOL_DETAIL_TTL: 60,   // 任务详情缓存1分钟
}

const KEYS = {
  HOT_POOL: 'task_pool:hot:v3',           // 缓存完整任务对象
  HOT_POOL_IDS: 'task_pool:hot:ids',      // 缓存任务ID列表（用于快速判断）
  USER_POOL: (userId) => `user_task_pool:${userId}`,
  POOL_STATS: 'task_pool:stats:v3',
  ACTIVE_CITIES: 'task_pool:active_cities',
  USER_OCCUPIED: (userId) => `user_occupied_tasks:${userId}`,
  TASK_DETAIL: (taskId) => `task_detail:${taskId}`,  // 单个任务详情缓存
}

class TaskPoolService {
  constructor() {
    this.isWarming = false
    this.stats = {
      hits: 0,
      misses: 0,
      partialHits: 0,
    }
  }

  async getTasks({ userId, city, province, limit = 20, filters = {} }) {
    const startTime = Date.now()
    
    try {
      // 1. 尝试从用户专属池获取（命中率最高）
      if (userId && REDIS_ENABLED && cache.isReady()) {
        const userPoolResult = await this.getFromUserPool(userId, { city, province, limit, filters })
        if (userPoolResult.tasks.length >= limit) {
          this.stats.hits++
          logger.debug(`[TaskPool] 用户池命中，返回 ${userPoolResult.tasks.length} 个任务，耗时 ${Date.now() - startTime}ms`)
          return { tasks: userPoolResult.tasks, fromCache: true, source: 'user_pool' }
        }
      }

      // 2. 尝试从全局热门池获取（缓存完整任务对象）
      if (REDIS_ENABLED && cache.isReady()) {
        const hotPoolResult = await this.getFromHotPool({ city, province, limit, filters, userId })
        if (hotPoolResult.tasks.length >= limit) {
          this.stats.hits++
          logger.debug(`[TaskPool] 热门池命中，返回 ${hotPoolResult.tasks.length} 个任务，耗时 ${Date.now() - startTime}ms`)
          
          // 异步更新用户专属池
          if (userId && hotPoolResult.allTasks.length > 0) {
            this.updateUserPool(userId, hotPoolResult.allTasks).catch(() => {})
          }
          
          return { tasks: hotPoolResult.tasks, fromCache: true, source: 'hot_pool' }
        }
        
        // 部分命中：热门池有数据但不够
        if (hotPoolResult.tasks.length > 0) {
          this.stats.partialHits++
          logger.debug(`[TaskPool] 热门池部分命中，返回 ${hotPoolResult.tasks.length} 个任务`)
          return { 
            tasks: hotPoolResult.tasks, 
            fromCache: true, 
            source: 'hot_pool_partial',
            needMore: limit - hotPoolResult.tasks.length 
          }
        }
      }

      this.stats.misses++
      logger.debug(`[TaskPool] 池未命中，需要实时计算，耗时 ${Date.now() - startTime}ms`)
      return { tasks: [], fromCache: false, source: 'miss' }
    } catch (err) {
      logger.error(`[TaskPool] 获取任务失败: ${err.message}`)
      return { tasks: [], fromCache: false, source: 'error' }
    }
  }

  async getFromUserPool(userId, { city, province, limit, filters }) {
    try {
      const poolData = await cache.get(KEYS.USER_POOL(userId))
      
      if (!poolData || !poolData.tasks || poolData.tasks.length === 0) {
        return { tasks: [], allTasks: [] }
      }

      // 缓存的是完整任务对象，直接使用
      let tasks = poolData.tasks.filter(t => t.status === 'active' && t.remain > 0)
      
      if (tasks.length === 0) {
        return { tasks: [], allTasks: [] }
      }

      const filteredTasks = await this.filterTasks(tasks, { city, province, filters, userId })
      
      return { 
        tasks: filteredTasks.slice(0, limit),
        allTasks: filteredTasks
      }
    } catch (err) {
      logger.warn(`[TaskPool] 用户池获取失败: ${err.message}`)
      return { tasks: [], allTasks: [] }
    }
  }

  async getFromHotPool({ city, province, limit, filters, userId }) {
    try {
      const poolData = await cache.get(KEYS.HOT_POOL)
      
      if (!poolData || !poolData.tasks || poolData.tasks.length === 0) {
        // 触发预热，但不等待
        this.warmupHotPool().catch(() => {})
        return { tasks: [], allTasks: [] }
      }

      // 直接使用缓存的任务对象（V3.0优化：预热时已缓存完整对象）
      let tasks = poolData.tasks.filter(t => t.status === 'active' && t.remain > 0)
      
      const filteredTasks = await this.filterTasks(tasks, { city, province, filters, userId })
      
      return {
        tasks: filteredTasks.slice(0, limit),
        allTasks: filteredTasks
      }
    } catch (err) {
      logger.warn(`[TaskPool] 热门池获取失败: ${err.message}`)
      return { tasks: [], allTasks: [] }
    }
  }

  /**
   * 过滤任务 - V3.0 优化版
   * 
   * 过滤逻辑（按优先级）：
   * 1. 基础过滤：状态和剩余名额
   * 2. 平台/操作类型过滤
   * 3. 城市/省份限制过滤（任务维度）
   * 4. 用户已占用任务过滤
   */
  async filterTasks(tasks, { city, province, filters, userId }) {
    let result = tasks

    // 1. 平台过滤
    if (filters.platform && filters.platform !== 'all') {
      result = result.filter(t => t.platform === filters.platform)
    }

    // 2. 操作类型过滤
    if (filters.action && filters.action !== 'all') {
      result = result.filter(t => t.action === filters.action)
    }

    // 3. 城市/省份限制过滤（任务对用户的限制）
    if (city && city !== '未知') {
      result = result.filter(t => {
        if (t.city_limit && Array.isArray(t.city_limit) && t.city_limit.length > 0) {
          return t.city_limit.includes(city)
        }
        return true
      })
    }

    if (province && province !== '未知') {
      result = result.filter(t => {
        if (t.province_limit && Array.isArray(t.province_limit) && t.province_limit.length > 0) {
          return t.province_limit.includes(province)
        }
        return true
      })
    }

    // 4. 用户已占用任务过滤
    if (userId) {
      const occupiedTaskIds = await this.getUserOccupiedTaskIds(userId)
      if (occupiedTaskIds.size > 0) {
        const beforeCount = result.length
        result = result.filter(t => !occupiedTaskIds.has(t.id))
        if (beforeCount !== result.length) {
          logger.debug(`[TaskPool] 过滤用户已占用任务 ${beforeCount - result.length} 个`)
        }
      }
    }

    if (userId) {
      try {
        const exposureService = (await import('./exposureService.js')).default
        const config = await exposureService.getConfig()
        result = await exposureService.filterTasksByExposureWithSequential(
          result,
          userId,
          city,
          province,
          config
        )
      } catch (err) {
        logger.warn(`[TaskPool] 曝光过滤失败，回退为未过滤列表: ${err.message}`)
      }
    }

    return result
  }

  /**
   * 获取用户已占用的任务ID集合（V3.0 修复版）
   * 
   * 修复：使用正确的表名 `claims`
   * 优化：增加缓存命中率统计
   */
  async getUserOccupiedTaskIds(userId) {
    if (!userId) return new Set()

    const cacheKey = KEYS.USER_OCCUPIED(userId)
    
    // 1. 尝试从Redis缓存获取
    if (REDIS_ENABLED && cache.isReady()) {
      try {
        const cached = await cache.get(cacheKey)
        if (cached && Array.isArray(cached.taskIds)) {
          return new Set(cached.taskIds)
        }
      } catch (err) {
        logger.debug(`[TaskPool] 获取用户占用缓存失败: ${err.message}`)
      }
    }

    // 2. 从数据库查询（修复：使用 claims 表）
    try {
      const occupiedIds = new Set()

      // 查询已领取未完成的任务（进行中、待审核）
      const { data: activeClaims, error: activeError } = await supabase
        .from('claims')  // 修复：user_tasks → claims
        .select('task_id')
        .eq('user_id', userId)
        .in('status', ACTIVE_CLAIM_STATUS_FOR_EXPOSURE)

      if (!activeError && activeClaims) {
        activeClaims.forEach(c => occupiedIds.add(c.task_id))
      }

      // 查询最近7天内已完成的任务（避免重复推荐）
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const { data: recentCompleted, error: completedError } = await supabase
        .from('claims')  // 修复：user_tasks → claims
        .select('task_id')
        .eq('user_id', userId)
        .in('status', ['approved', 'done'])
        .gte('reviewed_at', sevenDaysAgo.toISOString())

      if (!completedError && recentCompleted) {
        recentCompleted.forEach(c => occupiedIds.add(c.task_id))
      }

      // 3. 缓存结果
      if (REDIS_ENABLED && cache.isReady() && occupiedIds.size > 0) {
        try {
          await cache.set(cacheKey, {
            taskIds: Array.from(occupiedIds),
            updatedAt: Date.now()
          }, POOL_CONFIG.OCCUPIED_CACHE_TTL)
        } catch (err) {
          logger.debug(`[TaskPool] 缓存用户占用任务失败: ${err.message}`)
        }
      }

      return occupiedIds
    } catch (err) {
      logger.error(`[TaskPool] 查询用户占用任务失败: ${err.message}`)
      return new Set()
    }
  }

  /**
   * 热门池预热（V3.0 优化版）
   * 
   * 优化：缓存完整任务对象，避免后续查询数据库
   */
  async warmupHotPool() {
    if (this.isWarming) {
      logger.debug('[TaskPool] 热门池正在预热中，跳过')
      return
    }

    this.isWarming = true
    const startTime = Date.now()

    try {
      // 查询活跃任务，获取完整字段
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*')  // 获取所有字段
        .eq('status', 'active')
        .gt('remain', 0)
        .order('created_at', { ascending: false })
        .limit(POOL_CONFIG.HOT_POOL_SIZE * 2)

      if (error || !tasks) {
        logger.warn('[TaskPool] 预热查询失败')
        return
      }

      // 按优先级排序
      const sortedTasks = this.prioritizeTasks(tasks)
      const topTasks = sortedTasks.slice(0, POOL_CONFIG.HOT_POOL_SIZE)

      // 缓存完整任务对象（V3.0核心优化）
      const poolData = {
        tasks: topTasks,  // 缓存完整对象
        warmedAt: Date.now(),
        totalActive: tasks.length,
        version: 'v3'
      }

      await cache.set(KEYS.HOT_POOL, poolData, POOL_CONFIG.HOT_POOL_TTL)

      // 更新统计
      await this.updatePoolStats('hot_pool_warmup', topTasks.length)

      logger.info(`[TaskPool] 热门池预热完成，缓存 ${topTasks.length} 个完整任务对象，耗时 ${Date.now() - startTime}ms`)
    } catch (err) {
      logger.error(`[TaskPool] 热门池预热失败: ${err.message}`)
    } finally {
      this.isWarming = false
    }
  }

  prioritizeTasks(tasks) {
    const now = Date.now()
    const tenMinutesAgo = now - 10 * 60 * 1000

    return tasks.sort((a, b) => {
      // 新任务优先
      const aIsNew = new Date(a.created_at).getTime() > tenMinutesAgo
      const bIsNew = new Date(b.created_at).getTime() > tenMinutesAgo
      if (aIsNew && !bIsNew) return -1
      if (!aIsNew && bIsNew) return 1

      // 高奖励优先
      if (b.reward !== a.reward) {
        return b.reward - a.reward
      }

      // 剩余名额少的优先（紧迫感）
      return a.remain - b.remain
    })
  }

  async updateUserPool(userId, tasks) {
    if (!tasks || tasks.length === 0) return

    try {
      // 缓存完整任务对象
      const topTasks = tasks.slice(0, POOL_CONFIG.USER_POOL_SIZE)
      
      await cache.set(KEYS.USER_POOL(userId), {
        tasks: topTasks,
        updatedAt: Date.now()
      }, POOL_CONFIG.USER_POOL_TTL)
      
      logger.debug(`[TaskPool] 更新用户 ${userId} 专属池，缓存 ${topTasks.length} 个任务`)
    } catch (err) {
      logger.debug(`[TaskPool] 更新用户池失败: ${err.message}`)
    }
  }

  /**
   * 清除用户相关缓存（在用户领取/提交/放弃任务后调用）
   */
  async invalidateUserCache(userId) {
    if (!REDIS_ENABLED || !cache.isReady() || !userId) return

    try {
      await Promise.all([
        cache.del(KEYS.USER_POOL(userId)),
        cache.del(KEYS.USER_OCCUPIED(userId))
      ])
      logger.debug(`[TaskPool] 清除用户 ${userId} 的所有缓存`)
    } catch (err) {
      logger.debug(`[TaskPool] 清除用户缓存失败: ${err.message}`)
    }
  }

  /**
   * 清除用户占用任务缓存（轻量级操作）
   */
  async invalidateUserOccupiedCache(userId) {
    if (!REDIS_ENABLED || !cache.isReady() || !userId) return

    try {
      await cache.del(KEYS.USER_OCCUPIED(userId))
    } catch (err) {
      logger.debug(`[TaskPool] 清除用户占用缓存失败: ${err.message}`)
    }
  }
  /**
   * 获取用户列表（包含在线状态）
   */
  async getUsersWithOnlineStatus(page = 1, size = 20, filters = {}) {
    // 如果有在线状态筛选，需要特殊处理
    if (filters.isOnline !== undefined) {
      const pageSize = size * 5
      const result = await this.getUsers(1, pageSize, { ...filters, isOnline: undefined })
      
      if (result.list.length > 0) {
        const userIds = result.list.map(u => u.id)
        const onlineStatusMap = await onlineUserService.batchCheckOnline(userIds)
        
        const filteredList = result.list
          .map(user => ({
            ...user,
            isOnline: onlineStatusMap.get(user.id) || false
          }))
          .filter(user => user.isOnline === filters.isOnline)
        
        const offset = (page - 1) * size
        const paginatedList = filteredList.slice(offset, offset + size)
        
        return {
          list: paginatedList,
          total: filteredList.length,
          page,
          size
        }
      }
      return result
    }
    
    const result = await this.getUsers(page, size, filters)
    if (result.list.length > 0) {
      const userIds = result.list.map(u => u.id)
      const onlineStatusMap = await onlineUserService.batchCheckOnline(userIds)
      result.list = result.list.map(user => ({
        ...user,
        isOnline: onlineStatusMap.get(user.id) || false
      }))
    }
    return result
  }

  /**
   * Clear hot pool cache when task status changes
   */
  async invalidateHotPool() {
    if (!REDIS_ENABLED || !cache.isReady()) return

    try {
      await cache.del(KEYS.HOT_POOL)
      logger.info("[TaskPool] Hot pool cache cleared")

      // Async warmup
      this.warmupHotPool().catch(() => {})
    } catch (err) {
      logger.warn("[TaskPool] Clear hot pool cache failed:", err.message)
    }
  }

  async updatePoolStats(event, count) {
    if (!REDIS_ENABLED || !cache.isReady()) return

    try {
      const stats = await cache.get(KEYS.POOL_STATS) || { 
        warmups: 0, 
        totalCached: 0,
        hits: 0,
        misses: 0
      }
      
      stats.warmups = (stats.warmups || 0) + 1
      stats.totalCached = count
      stats.lastWarmup = Date.now()
      stats.hits = this.stats.hits
      stats.misses = this.stats.misses
      
      await cache.set(KEYS.POOL_STATS, stats, 3600)
    } catch (err) {
      // 忽略统计更新失败
    }
  }

  async getPoolStats() {
    const stats = {
      hotPool: null,
      enabled: REDIS_ENABLED && cache.isReady(),
      memoryStats: { ...this.stats }
    }

    if (!REDIS_ENABLED || !cache.isReady()) {
      return stats
    }

    try {
      const hotPool = await cache.get(KEYS.HOT_POOL)
      const poolStats = await cache.get(KEYS.POOL_STATS)

      stats.hotPool = {
        size: hotPool?.tasks?.length || 0,
        warmedAt: hotPool?.warmedAt,
        totalActive: hotPool?.totalActive,
        version: hotPool?.version,
        age: hotPool?.warmedAt ? Date.now() - hotPool.warmedAt : null
      }
      stats.stats = poolStats
    } catch (err) {
      stats.error = err.message
    }

    return stats
  }

  async checkAndReplenish() {
    if (!REDIS_ENABLED || !cache.isReady()) return

    try {
      const hotPool = await cache.get(KEYS.HOT_POOL)
      
      if (!hotPool || !hotPool.tasks || hotPool.tasks.length < POOL_CONFIG.MIN_POOL_SIZE) {
        logger.info('[TaskPool] 热门池水位低，触发补充')
        await this.warmupHotPool()
      }
    } catch (err) {
      logger.warn(`[TaskPool] 池健康检查失败: ${err.message}`)
    }
  }

  async recordActiveCity(city) {
    if (!REDIS_ENABLED || !cache.isReady() || !city || city === '未知') return

    try {
      const redis = (await import('../utils/redis.js')).redisClient
      if (redis) {
        await redis.zIncrBy(KEYS.ACTIVE_CITIES, 1, city)
      }
    } catch (err) {
      // 忽略
    }
  }
  
  /**
   * 获取命中率统计
   */
  getHitRate() {
    const total = this.stats.hits + this.stats.misses + this.stats.partialHits
    if (total === 0) return { hitRate: 0, partialRate: 0, missRate: 0 }
    return {
      hitRate: (this.stats.hits / total * 100).toFixed(1),
      partialRate: (this.stats.partialHits / total * 100).toFixed(1),
      missRate: (this.stats.misses / total * 100).toFixed(1),
      total
    }
  }
}

export default new TaskPoolService()
