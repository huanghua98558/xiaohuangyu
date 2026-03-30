import supabase from '../utils/supabaseToPrismaAdapter.js'
import levelService from './levelService.js'
import logger from '../utils/logger.js'
import { notifyPromotionReward } from './notificationService.js'

class PromotionService {
  /**
   * 获取系统配置
   */
  async getConfig() {
    const { data: configs, error } = await supabase
      .from('system_configs')
      .select('*')
    
    const result = {}
    for (const c of (configs || [])) {
      result[c.key] = c.value
    }
    return result
  }

  // ==================== C端推广 ====================

  /**
   * 绑定C端推广关系
   */
  async bindCPromotion(userId, inviteCode) {
    const config = await this.getConfig()
    if (config.c_promotion_enabled !== 'true') {
      return { bound: false, message: '推广系统未开启' }
    }

    // 查找邀请人
    const { data: inviter, error } = await supabase
      .from('users')
      .select('*')
      .eq('invite_code', inviteCode)
      .single()

    if (!inviter || inviter.id === userId) {
      return { bound: false, message: '邀请码无效' }
    }

    // 检查是否已绑定
    const { data: user } = await supabase
      .from('users')
      .select('c_parent_id, c_grand_id')
      .eq('id', userId)
      .single()

    if (user?.c_parent_id) {
      return { bound: false, message: '已绑定推广关系' }
    }

    // 绑定关系
    const updateData = {
      c_parent_id: inviter.id,
      invited_by: inviter.id
    }

    // 如果邀请人也有上级，设置二级上级
    if (inviter.c_parent_id) {
      updateData.c_grand_id = inviter.c_parent_id
    }

    await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)

    // 记录推广关系
    await supabase
      .from('promotion_relations')
      .insert({
        type: 'c',
        parent_id: inviter.id,
        child_id: userId,
        level: 1
      })

    if (inviter.c_parent_id) {
      await supabase
        .from('promotion_relations')
        .insert({
          type: 'c',
          parent_id: inviter.c_parent_id,
          child_id: userId,
          level: 2
        })
    }

    logger.info(`用户 ${userId} 绑定推广关系，上级: ${inviter.id}`)
    return { bound: true, parentId: inviter.id, grandId: inviter.c_parent_id }
  }

  /**
   * 计算C端推广收益（任务完成后调用）
   */
  async calculateCPromotionEarnings(claimId, userId, points) {
    try {
    const config = await this.getConfig()
    if (config.c_promotion_enabled !== 'true') return

    const { data: user } = await supabase
      .from('users')
      .select('c_parent_id, c_grand_id')
      .eq('id', userId)
      .single()

    if (!user) return

    const level1Rate = parseFloat(config.c_promotion_level1_rate || '10') / 100
    const level2Rate = parseFloat(config.c_promotion_level2_rate || '5') / 100

    // 一级推广收益
    if (user.c_parent_id) {
      const parentPoints = Math.floor(points * level1Rate)
      if (parentPoints > 0) {
        await this.createPromotionEarning('c', user.c_parent_id, userId, claimId, 1, parentPoints, points, level1Rate * 100)
        
        // 获取上级当前积分
        const { data: parent } = await supabase
          .from('users')
          .select('points, total_points')
          .eq('id', user.c_parent_id)
          .single()

        // 更新上级积分
        await supabase
          .from('users')
          .update({
            points: (parent?.points || 0) + parentPoints,
            total_points: (parent?.total_points || parent?.points || 0) + parentPoints,
          })
          .eq('id', user.c_parent_id)

        // 记录积分变动
        await supabase
          .from('records')
          .insert({
            user_id: user.c_parent_id,
            type: 'promotion_c',
            description: '好友完成任务奖励',
            points: parentPoints,
            extra_data: JSON.stringify({ fromUserId: userId, level: 1 })
          })

        try {
          await notifyPromotionReward(user.c_parent_id, {
            level: 1,
            points: parentPoints,
            sourceUserId: userId,
          })
        } catch (notifyError) {
          logger.error('发送一级推广奖励通知失败:', notifyError)
        }
      }
    }

    // 二级推广收益
    if (user.c_grand_id) {
      const grandPoints = Math.floor(points * level2Rate)
      if (grandPoints > 0) {
        await this.createPromotionEarning('c', user.c_grand_id, userId, claimId, 2, grandPoints, points, level2Rate * 100)
        
        // 获取二级上级当前积分
        const { data: grand } = await supabase
          .from('users')
          .select('points, total_points')
          .eq('id', user.c_grand_id)
          .single()

        // 更新二级上级积分
        await supabase
          .from('users')
          .update({
            points: (grand?.points || 0) + grandPoints,
            total_points: (grand?.total_points || grand?.points || 0) + grandPoints,
          })
          .eq('id', user.c_grand_id)

        // 记录积分变动
        await supabase
          .from('records')
          .insert({
            user_id: user.c_grand_id,
            type: 'promotion_c',
            description: '间接好友完成任务奖励',
            points: grandPoints,
            extra_data: JSON.stringify({ fromUserId: userId, level: 2 })
          })

        try {
          await notifyPromotionReward(user.c_grand_id, {
            level: 2,
            points: grandPoints,
            sourceUserId: userId,
          })
        } catch (notifyError) {
          logger.error('发送二级推广奖励通知失败:', notifyError)
        }
      }
    }
    } catch (e) {
      console.error('[PromotionService] calculateCPromotionEarnings error:', e.message);
    }
  }

  /**
   * 创建推广收益记录
   */
  async createPromotionEarning(type, userId, fromUserId, claimId, level, points, sourcePoints, rate) {
    await supabase
      .from('promotion_earnings')
      .insert({
        type,
        user_id: userId,
        from_user_id: fromUserId,
        from_claim_id: claimId,
        level,
        points,
        source_points: sourcePoints,
        rate,
        status: 'settled',
        settled_at: new Date().toISOString()
      })
  }

  /**
   * 获取C端推广统计
   */
  async getCStats(userId) {
    try {
    const config = await this.getConfig()
    const level1Rate = parseFloat(config.c_promotion_level1_rate || '10')
    const level2Rate = parseFloat(config.c_promotion_level2_rate || '5')

    // 一级下级数量
    const { count: level1Count } = await supabase
      .from('promotion_relations')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'c')
      .eq('parent_id', userId)
      .eq('level', 1)

    // 二级下级数量
    const { count: level2Count } = await supabase
      .from('promotion_relations')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'c')
      .eq('parent_id', userId)
      .eq('level', 2)

    // 今日收益
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const { data: todayEarnings } = await supabase
      .from('promotion_earnings')
      .select('points')
      .eq('type', 'c')
      .eq('user_id', userId)
      .gte('created_at', today.toISOString())

    const todayPoints = (todayEarnings || []).reduce((sum, e) => sum + (e.points || 0), 0)

    // 累计收益
    const { data: totalEarnings } = await supabase
      .from('promotion_earnings')
      .select('points')
      .eq('type', 'c')
      .eq('user_id', userId)

    const totalPoints = (totalEarnings || []).reduce((sum, e) => sum + (e.points || 0), 0)

    return {
      level1Rate,
      level2Rate,
      level1Count: level1Count || 0,
      level2Count: level2Count || 0,
      totalCount: (level1Count || 0) + (level2Count || 0),
      todayPoints,
      totalPoints
    }
    } catch (e) {
      console.error('[PromotionService] getCStats error:', e.message);
      return { level1Rate: 10, level2Rate: 5, level1Count: 0, level2Count: 0, totalCount: 0, todayPoints: 0, totalPoints: 0 }
    }
  }

  /**
   * 获取下级列表
   */
  async getSubordinates(userId, level = 1, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize

    const { data: relations, error } = await supabase
      .from('promotion_relations')
      .select(`
        id,
        created_at,
        users:child_id (id, username, level, total_tasks, created_at)
      `)
      .eq('type', 'c')
      .eq('parent_id', userId)
      .eq('level', level)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    const { count: total } = await supabase
      .from('promotion_relations')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'c')
      .eq('parent_id', userId)
      .eq('level', level)

    return {
      list: (relations || []).map(r => ({
        id: r.users?.id,
        username: r.users?.username,
        level: r.users?.level,
        totalTasks: r.users?.total_tasks,
        createdAt: r.created_at
      })),
      total: total || 0,
      page,
      pageSize
    }
  }

  /**
   * 获取推广收益明细
   */
  async getCEarnings(userId, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize

    const { data: earnings, error } = await supabase
      .from('promotion_earnings')
      .select(`
        id,
        level,
        points,
        source_points,
        rate,
        created_at,
        claims:from_claim_id (title, platform)
      `)
      .eq('type', 'c')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    const { count: total } = await supabase
      .from('promotion_earnings')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'c')
      .eq('user_id', userId)

    return {
      list: (earnings || []).map(e => ({
        id: e.id,
        level: e.level,
        points: e.points,
        sourcePoints: e.source_points,
        rate: e.rate,
        taskTitle: e.claims?.title || '',
        platform: e.claims?.platform || '',
        createdAt: e.created_at
      })),
      total: total || 0,
      page,
      pageSize
    }
  }

  // ==================== B端推广 ====================

  /**
   * 获取B端推广统计
   */
  async getBStats(userId) {
    const config = await this.getConfig()
    const rate = parseFloat(config.b_promotion_rate || '2')

    // 邀请的企业数量
    const { count: partnerCount } = await supabase
      .from('promotion_relations')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'b')
      .eq('parent_id', userId)

    // 累计收益
    const { data: totalEarnings } = await supabase
      .from('promotion_earnings')
      .select('points')
      .eq('type', 'b')
      .eq('user_id', userId)

    const totalPoints = (totalEarnings || []).reduce((sum, e) => sum + (e.points || 0), 0)

    // 待结算收益
    const { data: pendingEarnings } = await supabase
      .from('promotion_earnings')
      .select('points')
      .eq('type', 'b')
      .eq('user_id', userId)
      .eq('status', 'pending')

    const pendingPoints = (pendingEarnings || []).reduce((sum, e) => sum + (e.points || 0), 0)

    // 已结算收益
    const { data: settledEarnings } = await supabase
      .from('promotion_earnings')
      .select('points')
      .eq('type', 'b')
      .eq('user_id', userId)
      .eq('status', 'settled')

    const settledPoints = (settledEarnings || []).reduce((sum, e) => sum + (e.points || 0), 0)

    return {
      rate,
      partnerCount: partnerCount || 0,
      totalPoints,
      pendingPoints,
      settledPoints,
      balancePoints: 0
    }
  }

  /**
   * 获取已邀请企业列表
   */
  async getPartners(userId, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize

    const { data: relations, error } = await supabase
      .from('promotion_relations')
      .select(`
        id,
        created_at,
        users:child_id (id, username, created_at)
      `)
      .eq('type', 'b')
      .eq('parent_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    const { count: total } = await supabase
      .from('promotion_relations')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'b')
      .eq('parent_id', userId)

    return {
      list: (relations || []).map(r => ({
        id: r.users?.id,
        username: r.users?.username,
        createdAt: r.created_at
      })),
      total: total || 0,
      page,
      pageSize
    }
  }
}

export default new PromotionService()
