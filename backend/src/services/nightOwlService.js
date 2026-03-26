import supabase from '../utils/supabaseToPrismaAdapter.js'
import { redisClient, REDIS_ENABLED } from '../utils/redis.js'
import logger from '../utils/logger.js'

/**
 * 夜猫子用户识别服务
 * 
 * 定义：过去7天内，在 0:00-6:00 时段有 ≥ 3次活跃记录的用户
 * 
 * 数据来源：
 * - WebSocket 心跳记录
 * - 任务领取时间
 * - 任务提交时间
 */

// Redis 键
const NIGHT_OWL_SET = 'night_owls:set'
const NIGHT_OWL_CACHE = 'night_owls:cache'

// 夜间时段定义
const NIGHT_HOURS = [0, 1, 2, 3, 4, 5]
const MIN_NIGHT_ACTIVE_COUNT = 3 // 最少夜间活跃次数
const ANALYSIS_DAYS = 7 // 分析最近7天

class NightOwlService {
  /**
   * 判断当前是否为夜间时段
   */
  isNightTime() {
    const hour = new Date().getHours()
    return NIGHT_HOURS.includes(hour)
  }

  /**
   * 获取所有夜猫子用户ID列表
   * @returns {Promise<Array<{userId: number, score: number}>>}
   */
  async getNightOwls() {
    // 尝试从 Redis 获取缓存
    if (REDIS_ENABLED && redisClient) {
      try {
        const cached = await redisClient.zRangeWithScores(NIGHT_OWL_SET, 0, -1, { REV: true })
        if (cached && cached.length > 0) {
          return cached.map(item => ({
            userId: parseInt(item.value),
            score: item.score
          }))
        }
      } catch (err) {
        logger.warn('从 Redis 获取夜猫子列表失败:', err.message)
      }
    }

    // 从数据库获取
    const { data, error } = await supabase
      .from('night_owl_users')
      .select('user_id, night_active_count')
      .gte('night_active_count', MIN_NIGHT_ACTIVE_COUNT)
      .order('night_active_count', { ascending: false })

    if (error) {
      logger.error('获取夜猫子列表失败:', error.message)
      return []
    }

    return (data || []).map(item => ({
      userId: item.user_id,
      score: item.night_active_count
    }))
  }

  /**
   * 检查用户是否为夜猫子
   */
  async isNightOwl(userId) {
    const { data, error } = await supabase
      .from('night_owl_users')
      .select('night_active_count')
      .eq('user_id', userId)
      .single()

    return data && data.night_active_count >= MIN_NIGHT_ACTIVE_COUNT
  }

  /**
   * 记录用户夜间活跃（由 WebSocket 心跳调用）
   */
  async recordNightActivity(userId) {
    const hour = new Date().getHours()
    if (!NIGHT_HOURS.includes(hour)) {
      return // 非夜间时段，不记录
    }

    try {
      // 使用 upsert 更新或插入
      const { error } = await supabase
        .from('night_owl_users')
        .upsert({
          user_id: userId,
          night_active_count: 1,
          last_night_active: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        })

      if (error) {
        // 如果是重复键，手动增加计数
        if (error.code === '23505') {
          await supabase.rpc('increment_night_active', { user_id: userId })
        } else {
          logger.error('记录夜间活跃失败:', error.message)
        }
      }
    } catch (err) {
      logger.error('记录夜间活跃异常:', err.message)
    }
  }

  /**
   * 分析并更新夜猫子用户（定时任务调用）
   * 基于任务领取记录分析用户夜间活跃情况
   */
  async analyzeNightOwls() {
    logger.info('开始分析夜猫子用户...')

    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - ANALYSIS_DAYS)

      // 从 claims 表分析夜间活跃用户
      const { data: nightClaims, error } = await supabase
        .rpc('analyze_night_owl_users', {
          start_date: startDate.toISOString(),
          night_hours: NIGHT_HOURS
        })

      if (error) {
        // 如果 RPC 不存在，使用原生查询
        return await this.analyzeNightOwlsFallback(startDate)
      }

      // 更新数据库
      if (nightClaims && nightClaims.length > 0) {
        for (const record of nightClaims) {
          await supabase
            .from('night_owl_users')
            .upsert({
              user_id: record.user_id,
              night_active_count: record.night_count,
              night_active_rate: record.night_rate,
              last_night_active: record.last_night_active,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id'
            })
        }

        // 更新 Redis 缓存
        await this.updateRedisCache(nightClaims)
      }

      logger.info(`夜猫子分析完成，共 ${nightClaims?.length || 0} 人`)
      return nightClaims || []
    } catch (err) {
      logger.error('分析夜猫子用户失败:', err.message)
      return []
    }
  }

  /**
   * 备用分析方案（不依赖 RPC）
   */
  async analyzeNightOwlsFallback(startDate) {
    try {
      // 查询夜间领取记录
      const { data: claims, error } = await supabase
        .from('claims')
        .select('user_id, claimed_at')
        .gte('claimed_at', startDate.toISOString())

      if (error || !claims) {
        logger.error('查询领取记录失败:', error?.message)
        return []
      }

      // 统计每个用户的夜间活跃次数
      const userStats = new Map()

      for (const claim of claims) {
        const hour = new Date(claim.claimed_at).getHours()
        const isNight = NIGHT_HOURS.includes(hour)

        if (!userStats.has(claim.user_id)) {
          userStats.set(claim.user_id, { total: 0, night: 0, lastNight: null })
        }

        const stats = userStats.get(claim.user_id)
        stats.total++
        if (isNight) {
          stats.night++
          if (!stats.lastNight || new Date(claim.claimed_at) > new Date(stats.lastNight)) {
            stats.lastNight = claim.claimed_at
          }
        }
      }

      // 筛选夜猫子并更新数据库
      const nightOwls = []
      for (const [userId, stats] of userStats) {
        if (stats.night >= MIN_NIGHT_ACTIVE_COUNT) {
          const nightRate = stats.total > 0 ? stats.night / stats.total : 0

          await supabase
            .from('night_owl_users')
            .upsert({
              user_id: userId,
              night_active_count: stats.night,
              night_active_rate: nightRate,
              last_night_active: stats.lastNight,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id'
            })

          nightOwls.push({
            user_id: userId,
            night_count: stats.night,
            night_rate: nightRate,
            last_night_active: stats.lastNight
          })
        }
      }

      // 更新 Redis 缓存
      await this.updateRedisCache(nightOwls)

      logger.info(`夜猫子分析完成（备用方案），共 ${nightOwls.length} 人`)
      return nightOwls
    } catch (err) {
      logger.error('备用分析方案失败:', err.message)
      return []
    }
  }

  /**
   * 更新 Redis 缓存
   */
  async updateRedisCache(nightOwls) {
    if (!REDIS_ENABLED || !redisClient) return

    try {
      // 清除旧数据
      await redisClient.del(NIGHT_OWL_SET)

      // 添加新数据
      if (nightOwls.length > 0) {
        const members = nightOwls.map(owl => ({
          score: owl.night_count,
          value: String(owl.user_id)
        }))
        await redisClient.zAdd(NIGHT_OWL_SET, members)
      }

      // 设置过期时间（24小时）
      await redisClient.expire(NIGHT_OWL_SET, 86400)

      logger.debug('夜猫子 Redis 缓存已更新')
    } catch (err) {
      logger.warn('更新 Redis 缓存失败:', err.message)
    }
  }

  /**
   * 获取夜猫子统计数据
   */
  async getStats() {
    const { count: total } = await supabase
      .from('night_owl_users')
      .select('*', { count: 'exact', head: true })
      .gte('night_active_count', MIN_NIGHT_ACTIVE_COUNT)

    const { data: topUsers } = await supabase
      .from('night_owl_users')
      .select('user_id, night_active_count, night_active_rate')
      .gte('night_active_count', MIN_NIGHT_ACTIVE_COUNT)
      .order('night_active_count', { ascending: false })
      .limit(10)

    return {
      total: total || 0,
      threshold: MIN_NIGHT_ACTIVE_COUNT,
      analysisDays: ANALYSIS_DAYS,
      nightHours: NIGHT_HOURS,
      topUsers: topUsers || []
    }
  }
}

export default new NightOwlService()
