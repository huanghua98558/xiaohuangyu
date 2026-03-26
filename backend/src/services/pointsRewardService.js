import supabase from '../utils/supabaseToPrismaAdapter.js'
import logger from '../utils/logger.js'

/**
 * 积分奖励统计服务
 * 统一管理所有积分奖励的统计分析
 */
class PointsRewardService {
  /**
   * 获取积分奖励统计概览
   */
  async getOverview(startDate = null, endDate = null) {
    const start = startDate || this.getTodayStart()
    const end = endDate || this.getTodayEnd()

    // 各类型奖励统计
    const { data: records } = await supabase
      .from('records')
      .select('type, points, created_at')
      .gte('created_at', start)
      .lte('created_at', end)

    // 统计各类型
    const stats = {
      sign_in: { count: 0, points: 0 },
      task: { count: 0, points: 0 },
      promotion_c: { count: 0, points: 0 },
      reward: { count: 0, points: 0 },
      bonus: { count: 0, points: 0 },
      achievement: { count: 0, points: 0 },
      convert: { count: 0, points: 0 },
      withdraw: { count: 0, points: 0 },
      admin_adjust: { count: 0, points: 0 }
    }

    let totalReward = 0
    let totalDeduct = 0

    ;(records || []).forEach(r => {
      const type = r.type || 'other'
      if (!stats[type]) stats[type] = { count: 0, points: 0 }
      stats[type].count++
      stats[type].points += r.points || 0
      
      if (r.points > 0) {
        totalReward += r.points
      } else {
        totalDeduct += Math.abs(r.points)
      }
    })

    return {
      stats,
      totalReward,
      totalDeduct,
      netReward: totalReward - totalDeduct
    }
  }

  /**
   * 获取今日奖励统计
   */
  async getTodayStats() {
    const today = this.getTodayStart()
    return this.getOverview(today)
  }

  /**
   * 获取奖励趋势数据（按天）
   */
  async getTrend(days = 30) {
    const result = []
    const now = new Date()

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateStr = this.formatDate(date)
      const start = `${dateStr}T00:00:00+08:00`
      const end = `${dateStr}T23:59:59+08:00`

      const { data: records } = await supabase
        .from('records')
        .select('type, points')
        .gte('created_at', start)
        .lte('created_at', end)

      const dayStats = {
        date: dateStr,
        sign_in: 0,
        task: 0,
        promotion_c: 0,
        reward: 0,
        bonus: 0,
        achievement: 0,
        total: 0
      }

      ;(records || []).forEach(r => {
        if (r.points > 0 && dayStats[r.type] !== undefined) {
          dayStats[r.type] += r.points
          dayStats.total += r.points
        }
      })

      result.push(dayStats)
    }

    return result
  }

  /**
   * 获取奖励明细列表
   */
  async getRewardList(params = {}) {
    const {
      type = null,
      startDate = null,
      endDate = null,
      userId = null,
      page = 1,
      size = 20
    } = params

    const offset = (page - 1) * size
    
    // 构建基础查询
    let query = supabase
      .from('records')
      .select('id, user_id, type, desc, points, balance, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (type && type !== 'all') {
      query = query.eq('type', type)
    }
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }
    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, count, error } = await query.range(offset, offset + size - 1)

    if (error) {
      logger.error('获取奖励明细失败:', error)
      throw new Error('获取奖励明细失败')
    }

    // 获取用户信息
    const userIds = [...new Set((data || []).map(r => r.user_id))]
    let userMap = {}
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, username, role')
        .in('id', userIds)
      ;(users || []).forEach(u => {
        userMap[u.id] = u
      })
    }

    return {
      list: (data || []).map(r => {
        const user = userMap[r.user_id] || {}
        return {
          id: r.id,
          userId: r.user_id,
          username: user.username || '未知',
          userRole: user.role || '',
          type: r.type,
          description: r.desc,
          points: r.points,
          balance: Number(r.balance) || 0,
          createdAt: r.created_at
        }
      }),
      total: count || 0,
      page,
      size
    }
  }

  /**
   * 获取用户奖励汇总
   */
  async getUserRewardSummary(userId) {
    const { data: records } = await supabase
      .from('records')
      .select('type, points')
      .eq('user_id', userId)

    const summary = {
      sign_in: 0,
      task: 0,
      promotion_c: 0,
      reward: 0,
      bonus: 0,
      achievement: 0,
      total: 0
    }

    ;(records || []).forEach(r => {
      if (r.points > 0 && summary[r.type] !== undefined) {
        summary[r.type] += r.points
        summary.total += r.points
      }
    })

    return summary
  }

  /**
   * 导出奖励数据
   */
  async exportRewards(params = {}) {
    const { type, startDate, endDate } = params
    
    let query = supabase
      .from('records')
      .select('id, user_id, type, desc, points, balance, created_at')
      .order('created_at', { ascending: false })

    if (type && type !== 'all') {
      query = query.eq('type', type)
    }
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data, error } = await query.limit(10000)

    if (error) {
      logger.error('导出奖励数据失败:', error)
      throw new Error('导出失败')
    }

    // 获取用户信息
    const userIds = [...new Set((data || []).map(r => r.user_id))]
    let userMap = {}
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, username')
        .in('id', userIds)
      ;(users || []).forEach(u => {
        userMap[u.id] = u
      })
    }

    return (data || []).map(r => ({
      记录ID: r.id,
      用户ID: r.user_id,
      用户名: userMap[r.user_id]?.username || '',
      奖励类型: this.getTypeLabel(r.type),
      描述: r.desc,
      积分变动: r.points,
      余额变动: Number(r.balance) || 0,
      时间: r.created_at
    }))
  }

  /**
   * 获取积分配置
   */
  async getConfigs() {
    const { data: configs } = await supabase
      .from('system_configs')
      .select('*')
      .or('key.like.points_%,key.like.c_promotion%')

    const result = {
      // 签到配置
      sign_in_base: 3,
      sign_in_7: 5,
      sign_in_14: 8,
      sign_in_30: 10,
      // 推广配置（统一管理）
      promotion_level1: 10,
      promotion_level2: 5,
      // 兑换配置
      points_to_yuan: 10,
      // 注册奖励
      register_bonus: 200,
      // 最低提现
      min_withdraw: 10,
      // 兑换限制开关（true=需要任务积分占比达标，false=无限制）
      exchange_restriction_enabled: true,
      // 周榜奖励配置
      rank_weekly_top1: 300,   // 周榜第1名
      rank_weekly_top2: 100,   // 周榜第2名
      rank_weekly_top3: 50,    // 周榜第3-5名
      // 月榜奖励配置
      rank_monthly_top1: 2000, // 月榜第1名
      rank_monthly_top2: 1000, // 月榜第2名
      rank_monthly_top3: 500   // 月榜第3-5名
    }

    ;(configs || []).forEach(c => {
      // 处理 points_ 前缀的配置
      if (c.key.startsWith('points_')) {
        const key = c.key.replace('points_', '')
        if (result.hasOwnProperty(key)) {
          // 布尔值配置特殊处理
          if (key === "exchange_restriction_enabled") {
            result[key] = c.value === "true" || c.value === true
          } else {
            result[key] = parseFloat(c.value) || result[key]
          }
        }
      }
      
      // 处理推广配置（c_promotion_level1_rate -> promotion_level1）
      if (c.key === 'c_promotion_level1_rate') {
        result.promotion_level1 = parseFloat(c.value) || result.promotion_level1
      }
      if (c.key === 'c_promotion_level2_rate') {
        result.promotion_level2 = parseFloat(c.value) || result.promotion_level2
      }
    })

    return result
  }

  /**
   * 更新积分配置
   */
  async updateConfig(key, value) {
    // 处理推广配置的特殊key映射
    let fullKey = key
    if (key === 'promotion_level1') {
      fullKey = 'c_promotion_level1_rate'
    } else if (key === 'promotion_level2') {
      fullKey = 'c_promotion_level2_rate'
    } else {
      fullKey = `points_${key}`
    }
    
    const { error } = await supabase
      .from('system_configs')
      .upsert({
        key: fullKey,
        value: String(value),
        description: this.getConfigDescription(key)
      }, { onConflict: 'key' })

    if (error) {
      logger.error('更新积分配置失败:', error)
      throw new Error('更新配置失败')
    }

    logger.info(`更新积分配置: ${fullKey} = ${value}`)
    return { success: true, key: fullKey }
  }

  /**
   * 批量更新积分配置
   */
  async updateConfigs(configs) {
    for (const [key, value] of Object.entries(configs)) {
      await this.updateConfig(key, value)
    }
    return { success: true }
  }

  /**
   * 检测异常积分变动
   */
  async detectAnomaly() {
    const anomalies = []

    // 1. 检测短时间内大量积分获取
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
    const { data: recentRecords } = await supabase
      .from('records')
      .select('user_id, points, type, created_at')
      .gte('created_at', oneHourAgo)
      .gt('points', 0)

    // 按用户聚合
    const userTotals = {}
    ;(recentRecords || []).forEach(r => {
      if (!userTotals[r.user_id]) {
        userTotals[r.user_id] = { total: 0, count: 0, types: new Set() }
      }
      userTotals[r.user_id].total += r.points
      userTotals[r.user_id].count++
      userTotals[r.user_id].types.add(r.type)
    })

    // 检测异常用户
    for (const [userId, data] of Object.entries(userTotals)) {
      if (data.total > 500 || data.count > 20) {
        anomalies.push({
          type: 'high_frequency',
          severity: data.total > 1000 ? 'high' : 'medium',
          userId: parseInt(userId),
          details: {
            hourTotal: data.total,
            recordCount: data.count,
            types: Array.from(data.types)
          },
          message: `用户${userId}在1小时内获得${data.total}积分(${data.count}次操作)`
        })
      }
    }

    // 2. 检测异常高额奖励
    const today = this.getTodayStart()
    const { data: highRewards } = await supabase
      .from('records')
      .select('user_id, points, type, desc')
      .gte('created_at', today)
      .gt('points', 200)

    ;(highRewards || []).forEach(r => {
      if (r.type !== 'admin_adjust') {
        anomalies.push({
          type: 'high_reward',
          severity: 'medium',
          userId: r.user_id,
          details: {
            points: r.points,
            rewardType: r.type,
            description: r.desc
          },
          message: `用户${r.user_id}单次获得${r.points}积分(${r.type})`
        })
      }
    })

    // 3. 检测积分快速消耗
    const { data: fastSpends } = await supabase
      .from('records')
      .select('user_id, points, type')
      .gte('created_at', oneHourAgo)
      .lt('points', -100)

    ;(fastSpends || []).forEach(r => {
      anomalies.push({
        type: 'fast_spend',
        severity: 'low',
        userId: r.user_id,
        details: {
          points: r.points,
          spendType: r.type
        },
        message: `用户${r.user_id}快速消耗${Math.abs(r.points)}积分`
      })
    })

    return anomalies
  }

  /**
   * 检测积分异常（定时任务调用）
   */
  async detectAnomalies() {
    const anomalies = await this.detectAnomaly()
    return { anomalies }
  }

  // 辅助方法
  getTodayStart() {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00+08:00`
  }

  getTodayEnd() {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T23:59:59+08:00`
  }

  formatDate(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  getTypeLabel(type) {
    const labels = {
      sign_in: '签到奖励',
      task: '任务奖励',
      promotion_c: '推广奖励',
      reward: '排行榜奖励',
      bonus: '注册奖励',
      achievement: '成就奖励',
      convert: '积分兑换',
      withdraw: '提现',
      admin_adjust: '管理员调整'
    }
    return labels[type] || '其他'
  }

  getConfigDescription(key) {
    const descriptions = {
      sign_in_base: '签到基础积分',
      sign_in_7: '连续7天签到积分',
      sign_in_14: '连续14天签到积分',
      sign_in_30: '连续30天签到积分',
      promotion_level1: '一级推广奖励比例(%)',
      promotion_level2: '二级推广奖励比例(%)',
      points_to_yuan: '积分兑换比例',
      exchange_restriction_enabled: '兑换限制开关',
      register_bonus: '注册奖励积分',
      min_withdraw: '最低提现金额',
      rank_daily_top1: '日榜第1奖励',
      rank_daily_top2: '日榜第2奖励',
      rank_daily_top3: '日榜第3奖励',
      rank_weekly_base: '周榜基础奖励'
    }
    return descriptions[key] || ''
  }
}

export default new PointsRewardService()
