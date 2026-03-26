import supabase from '../utils/supabaseToPrismaAdapter.js'
import { cache } from '../utils/redis.js'
import logger from '../utils/logger.js'

// 缓存键
const RANK_CACHE_TTL = 300 // 5分钟

class LeaderboardService {
  /**
   * 获取总排行榜
   */
  async getTotalRank(limit = 50) {
    const cacheKey = `rank:total:${limit}`
    
    const cached = await cache.get(cacheKey)
    if (cached) return cached

    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, points, level, total_tasks')
      .gt('points', 0)
      .order('points', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit)

    const result = (users || []).map((u, index) => ({
      rank: index + 1,
      id: u.id,
      username: u.username,
      points: u.points,
      level: u.level,
      totalTasks: u.total_tasks
    }))

    await cache.set(cacheKey, result, RANK_CACHE_TTL)
    return result
  }

  /**
   * 获取周排行榜
   */
  async getWeeklyRank(limit = 50) {
    const cacheKey = `rank:weekly:${limit}`
    
    const cached = await cache.get(cacheKey)
    if (cached) return cached

    // 计算本周开始时间（周一00:00:00）
    const now = new Date()
    const dayOfWeek = now.getDay() || 7
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - dayOfWeek + 1)
    weekStart.setHours(0, 0, 0, 0)
    const weekStartStr = weekStart.toISOString().split('T')[0]

    // 从 records 表统计本周所有正向积分变动（任务奖励、签到、成就等）
    const { data: weeklyRecords, error } = await supabase
      .from('records')
      .select('user_id, points, type')
      .gte('created_at', weekStartStr)

    // 按用户聚合积分（只统计正向积分）
    const userEarningsMap = new Map()
    for (const record of (weeklyRecords || [])) {
      // 只统计正向积分（任务奖励、签到、成就等）
      if (record.points > 0) {
        const current = userEarningsMap.get(record.user_id) || 0
        userEarningsMap.set(record.user_id, current + record.points)
      }
    }

    // 获取用户信息
    const userIds = Array.from(userEarningsMap.keys())
    if (userIds.length === 0) return []

    const { data: users } = await supabase
      .from('users')
      .select('id, username, level')
      .in('id', userIds)
    
    const userMap = new Map((users || []).map(u => [u.id, u]))

    // 组合并排序
    const result = Array.from(userEarningsMap.entries())
      .map(([userId, points]) => {
        const user = userMap.get(userId)
        return {
          userId,
          weeklyPoints: points,
          username: user ? user.username : '未知用户',
          level: user ? user.level : 1
        }
      })
      .sort((a, b) => b.weeklyPoints - a.weeklyPoints)
      .slice(0, limit)
      .map((item, index) => ({
        rank: index + 1,
        id: item.userId,
        username: item.username,
        weeklyPoints: item.weeklyPoints,
        level: item.level
      }))

    await cache.set(cacheKey, result, RANK_CACHE_TTL)
    return result
  }

  /**
   * 获取月排行榜
   */
  async getMonthlyRank(limit = 50) {
    const cacheKey = `rank:monthly:${limit}`
    
    const cached = await cache.get(cacheKey)
    if (cached) return cached

    // 计算本月开始时间
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const monthStartStr = monthStart.toISOString().split('T')[0]

    // 从 records 表统计本月所有正向积分变动
    const { data: monthlyRecords, error } = await supabase
      .from('records')
      .select('user_id, points, type')
      .gte('created_at', monthStartStr)

    // 按用户聚合积分（只统计正向积分）
    const userEarningsMap = new Map()
    for (const record of (monthlyRecords || [])) {
      if (record.points > 0) {
        const current = userEarningsMap.get(record.user_id) || 0
        userEarningsMap.set(record.user_id, current + record.points)
      }
    }

    // 获取用户信息
    const userIds = Array.from(userEarningsMap.keys())
    if (userIds.length === 0) return []

    const { data: users } = await supabase
      .from('users')
      .select('id, username, level')
      .in('id', userIds)
    
    const userMap = new Map((users || []).map(u => [u.id, u]))

    // 组合并排序
    const result = Array.from(userEarningsMap.entries())
      .map(([userId, points]) => {
        const user = userMap.get(userId)
        return {
          userId,
          monthlyPoints: points,
          username: user ? user.username : '未知用户',
          level: user ? user.level : 1
        }
      })
      .sort((a, b) => b.monthlyPoints - a.monthlyPoints)
      .slice(0, limit)
      .map((item, index) => ({
        rank: index + 1,
        id: item.userId,
        username: item.username,
        monthlyPoints: item.monthlyPoints,
        level: item.level
      }))

    await cache.set(cacheKey, result, RANK_CACHE_TTL)
    return result
  }

  /**
   * 获取用户在各排行榜中的排名
   */
  async getUserRank(userId) {
    const [totalRank, weeklyRank, monthlyRank] = await Promise.all([
      this.getUserTotalRank(userId),
      this.getUserWeeklyRank(userId),
      this.getUserMonthlyRank(userId)
    ])

    return {
      total: totalRank,
      weekly: weeklyRank,
      monthly: monthlyRank
    }
  }

  /**
   * 获取用户总榜排名
   */
  async getUserTotalRank(userId) {
    const { data: user, error } = await supabase
      .from('users')
      .select('points')
      .eq('id', userId)
      .single()

    if (!user || user.points <= 0) {
      return { rank: 0, points: 0, total: 0 }
    }

    // 统计比该用户积分高的人数（不限制角色，与总榜保持一致）
    const { count: higherCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gt('points', user.points)

    const { count: total } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gt('points', 0)

    return {
      rank: (higherCount || 0) + 1,
      points: user.points,
      total: total || 0
    }
  }

  /**
   * 获取用户周榜排名
   */
  async getUserWeeklyRank(userId) {
    const now = new Date()
    const dayOfWeek = now.getDay() || 7
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - dayOfWeek + 1)
    weekStart.setHours(0, 0, 0, 0)
    const weekStartStr = weekStart.toISOString().split('T')[0]

    // 从 records 表统计用户本周所有正向积分
    const { data: userRecords } = await supabase
      .from('records')
      .select('points')
      .eq('user_id', userId)
      .gte('created_at', weekStartStr)

    const userPoints = (userRecords || [])
      .filter(r => r.points > 0)
      .reduce((sum, r) => sum + r.points, 0)

    if (userPoints <= 0) {
      return { rank: 0, points: 0, total: 0 }
    }

    // 查询所有用户本周积分
    const { data: allRecords } = await supabase
      .from('records')
      .select('user_id, points')
      .gte('created_at', weekStartStr)

    // 按用户聚合（只统计正向积分）
    const userEarningsMap = new Map()
    for (const record of (allRecords || [])) {
      if (record.points > 0) {
        const current = userEarningsMap.get(record.user_id) || 0
        userEarningsMap.set(record.user_id, current + record.points)
      }
    }

    // 计算排名
    let higherCount = 0
    for (const [uid, points] of userEarningsMap) {
      if (uid !== userId && points > userPoints) {
        higherCount++
      }
    }

    return {
      rank: higherCount + 1,
      points: userPoints,
      total: userEarningsMap.size
    }
  }

  /**
   * 获取用户月榜排名
   */
  async getUserMonthlyRank(userId) {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const monthStartStr = monthStart.toISOString().split('T')[0]

    // 从 records 表统计用户本月所有正向积分
    const { data: userRecords } = await supabase
      .from('records')
      .select('points')
      .eq('user_id', userId)
      .gte('created_at', monthStartStr)

    const userPoints = (userRecords || [])
      .filter(r => r.points > 0)
      .reduce((sum, r) => sum + r.points, 0)

    if (userPoints <= 0) {
      return { rank: 0, points: 0, total: 0 }
    }

    // 查询所有用户本月积分
    const { data: allRecords } = await supabase
      .from('records')
      .select('user_id, points')
      .gte('created_at', monthStartStr)

    // 按用户聚合（只统计正向积分）
    const userEarningsMap = new Map()
    for (const record of (allRecords || [])) {
      if (record.points > 0) {
        const current = userEarningsMap.get(record.user_id) || 0
        userEarningsMap.set(record.user_id, current + record.points)
      }
    }

    // 计算排名
    let higherCount = 0
    for (const [uid, points] of userEarningsMap) {
      if (uid !== userId && points > userPoints) {
        higherCount++
      }
    }

    return {
      rank: higherCount + 1,
      points: userPoints,
      total: userEarningsMap.size
    }
  }

  /**
   * 掩码用户名（保护隐私）
   */
  maskUsername(username) {
    if (!username || username.length <= 2) {
      return username || ''
    }
    return username[0] + '*'.repeat(Math.min(username.length - 2, 4)) + username[username.length - 1]
  }
}

export default new LeaderboardService()
