import supabase from '../utils/supabase.js'
import taskService from './taskService.js'
import logger from '../utils/logger.js'
import { cache } from '../utils/redis.js'

// 排行榜缓存键模式
const RANK_CACHE_PATTERNS = [
  'rank:total:*',
  'rank:daily:*',
  'rank:user:total:*',
  'rank:user:daily:*'
]

class WalletService {
  /**
   * 积分兑换余额
   */
  async convertPoints(userId, points) {
    const config = await taskService.getConfig()

    if (points <= 0) {
      throw new Error('兑换积分必须大于0')
    }

    // 获取用户信息
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (!user) {
      throw new Error('用户不存在')
    }

    if (user.points < points) {
      throw new Error('积分不足')
    }

    // ========== 提现条件检查 ==========
    // 获取提现任务积分占比要求
    const { data: ratioConfig } = await supabase
      .from('system_configs')
      .select('value')
      .eq('key', 'withdraw_task_points_ratio')
      .single()
    
    const requiredRatio = parseInt(ratioConfig?.value || 50)

    // 检查用户是否有大额周奖励或月奖励
    const { data: bonusRecords } = await supabase
      .from('records')
      .select('points, type')
      .eq('user_id', userId)
      .in('type', ['reward', 'week_reward', 'month_reward'])
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    const hasLargeBonus = (bonusRecords || []).some(r => 
      r.points >= 100 && (r.type === 'week_reward' || r.type === 'month_reward')
    )

    // 如果没有大额周/月奖励, 则检查任务积分占比
    if (!hasLargeBonus) {
      const taskPoints = user.task_points || 0
      const totalPoints = user.total_points || 0
      const effectiveTotal = totalPoints - (user.exchanged_points || 0)
      const taskRatio = effectiveTotal > 0 ? (taskPoints / effectiveTotal) * 100 : 0

      if (taskRatio < requiredRatio) {
        throw new Error('兑换失败: 任务积分占比需 >= ' + requiredRatio + '%, 当前 ' + taskRatio.toFixed(1) + '%。请多完成任务后再兑换。')
      }
    }
    // ========== 提现条件检查结束 ==========

    // 计算兑换金额
    const yuan = (points / config.pointsToYuan).toFixed(2)

    // 更新用户积分和余额
    const { error: updateError } = await supabase
      .from('users')
      .update({
        points: user.points - points,
        exchanged_points: (user.exchanged_points || 0) + points,
        balance: Number(user.balance) + parseFloat(yuan)
      })
      .eq('id', userId)

    if (updateError) {
      logger.error('兑换失败:', updateError)
      throw new Error('兑换失败')
    }

    // 记录积分兑换
    const { error: recordError } = await supabase
      .from('records')
      .insert({
        user_id: userId,
        type: 'convert',
        description: '积分兑换',
        points: -points,
        balance: parseFloat(yuan)
      })
    
    if (recordError) {
      logger.error('记录积分兑换失败:', recordError)
    }

    // 清除排行榜缓存
    for (const pattern of RANK_CACHE_PATTERNS) {
      await cache.delPattern(pattern)
    }

    logger.info(`用户 ${userId} 兑换积分 ${points} -> ${yuan}元`)

    return {
      message: `兑换成功，到账 ¥${yuan}`,
      convertedPoints: points,
      amount: parseFloat(yuan)
    }
  }

  /**
   * 提现申请
   */
  async withdraw(userId, amount, wechatInfo = '') {
    const config = await taskService.getConfig()

    if (amount < config.minWithdrawAmount) {
      throw new Error(`最低提现 ${config.minWithdrawAmount} 元`)
    }

    // 获取用户信息
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (!user) {
      throw new Error('用户不存在')
    }

    if (Number(user.balance) < amount) {
      throw new Error('余额不足')
    }

    // 扣减余额
    const { error: updateError } = await supabase
      .from('users')
      .update({
        balance: Number(user.balance) - amount
      })
      .eq('id', userId)

    if (updateError) {
      logger.error('提现失败:', updateError)
      throw new Error('提现失败')
    }

    // 创建提现记录
    await supabase
      .from('withdrawals')
      .insert({
        user_id: userId,
        amount: amount,
        status: 'pending',
        wechat_info: wechatInfo
      })

    // 记录
    await supabase
      .from('records')
      .insert({
        user_id: userId,
        type: 'withdraw',
        description: '提现申请',
        points: 0,
        balance: -amount
      })

    logger.info(`用户 ${userId} 申请提现 ${amount}元`)

    return { message: '提现申请已提交，请等待审核' }
  }

  /**
   * 获取提现记录
   */
  async getWithdrawals(userId, page = 1, size = 20) {
    const offset = (page - 1) * size

    const [{ data: list, error: listError }, { count, error: countError }] = await Promise.all([
      supabase
        .from('withdrawals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + size - 1),
      supabase
        .from('withdrawals')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
    ])

    return {
      list: (list || []).map(w => ({
        id: w.id,
        userId: w.user_id,
        amount: Number(w.amount),
        status: w.status,
        wechatInfo: w.wechat_info,
        reviewerId: w.reviewer_id,
        reviewNote: w.review_note,
        reviewedAt: w.reviewed_at,
        paidAt: w.paid_at,
        createdAt: w.created_at
      })),
      total: count || 0,
      page,
      size
    }
  }

  /**
   * 获取待处理的提现申请（管理员）
   */
  async getPendingWithdrawals(page = 1, size = 20) {
    const offset = (page - 1) * size

    const [{ data: list, error: listError }, { count, error: countError }] = await Promise.all([
      supabase
        .from('withdrawals')
        .select(`
          *,
          users:user_id (id, username, phone)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .range(offset, offset + size - 1),
      supabase
        .from('withdrawals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
    ])

    return {
      list: (list || []).map(w => ({
        id: w.id,
        userId: w.user_id,
        amount: Number(w.amount),
        status: w.status,
        wechatInfo: w.wechat_info,
        reviewerId: w.reviewer_id,
        reviewNote: w.review_note,
        reviewedAt: w.reviewed_at,
        paidAt: w.paid_at,
        createdAt: w.created_at,
        user: w.users
      })),
      total: count || 0,
      page,
      size
    }
  }

  /**
   * 处理提现申请（管理员）
   */
  async processWithdrawal(withdrawalId, reviewerId, action, note = '') {
    const { data: withdrawal, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('id', withdrawalId)
      .single()

    if (!withdrawal) {
      throw new Error('提现记录不存在')
    }

    // 根据操作类型检查状态
    if (action === 'paid') {
      // 打款确认需要 approved 状态
      if (withdrawal.status !== 'approved') {
        throw new Error('该提现未通过审核，无法打款')
      }
    } else {
      // approve 和 reject 需要 pending 状态
      if (withdrawal.status !== 'pending') {
        throw new Error('该提现已处理')
      }
    }

    if (action === 'approve') {
      // 通过
      await supabase
        .from('withdrawals')
        .update({
          status: 'approved',
          reviewer_id: reviewerId,
          review_note: note,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', withdrawalId)

      // 记录审核日志
      await this._logWithdrawalReview(withdrawalId, reviewerId, 'approve', note)

      logger.info(`审核员 ${reviewerId} 通过提现 ${withdrawalId}`)

      return { message: '已通过，等待打款' }
    } else if (action === 'reject') {
      // 拒绝，退还余额
      // 获取用户当前余额
      const { data: user } = await supabase
        .from('users')
        .select('balance')
        .eq('id', withdrawal.user_id)
        .single()

      // 更新提现状态
      await supabase
        .from('withdrawals')
        .update({
          status: 'rejected',
          reviewer_id: reviewerId,
          review_note: note,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', withdrawalId)

      // 记录审核日志
      await this._logWithdrawalReview(withdrawalId, reviewerId, 'reject', note)

      // 退还余额
      await supabase
        .from('users')
        .update({
          balance: Number(user?.balance || 0) + Number(withdrawal.amount)
        })
        .eq('id', withdrawal.user_id)

      // 记录
      await supabase
        .from('records')
        .insert({
          user_id: withdrawal.user_id,
          type: 'withdraw',
          description: '提现退回',
          points: 0,
          balance: Number(withdrawal.amount)
        })

      logger.info(`审核员 ${reviewerId} 拒绝提现 ${withdrawalId}`)

      return { message: '已拒绝，余额已退回' }
    } else if (action === 'paid') {
      // 确认打款
      await supabase
        .from('withdrawals')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('id', withdrawalId)

      // 记录打款日志
      await this._logWithdrawalReview(withdrawalId, reviewerId, 'paid', note)

      logger.info(`提现 ${withdrawalId} 已打款`)

      return { message: '已确认打款' }
    }

    throw new Error('无效的操作类型')
  }

  /**
   * 记录提现审核日志
   */
  async _logWithdrawalReview(withdrawalId, reviewerId, action, note = '') {
    await supabase
      .from('withdrawal_review_logs')
      .insert({
        withdrawal_id: withdrawalId,
        reviewer_id: reviewerId,
        action: action,
        note: note
      })
  }

  /**
   * 获取提现审核记录
   */
  async getWithdrawalReviewLogs(withdrawalId) {
    const { data: logs, error } = await supabase
      .from('withdrawal_review_logs')
      .select(`
        *,
        reviewer:reviewer_id (id, username)
      `)
      .eq('withdrawal_id', withdrawalId)
      .order('created_at', { ascending: true })

    return (logs || []).map(log => ({
      id: log.id,
      withdrawalId: log.withdrawal_id,
      reviewerId: log.reviewer_id,
      reviewerName: log.reviewer?.username || '未知',
      action: log.action,
      note: log.note,
      createdAt: log.created_at
    }))
  }

  /**
   * 获取所有提现记录（管理员）- 支持分页和筛选
   */
  async getAllWithdrawals(page = 1, size = 20, filters = {}) {
    const offset = (page - 1) * size
    
    let query = supabase
      .from('withdrawals')
      .select(`
        *,
        users:user_id (id, username, phone)
      `, { count: 'exact' })
    
    // 状态筛选
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    
    // 日期筛选
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate)
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate)
    }

    const { data: list, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + size - 1)

    return {
      list: (list || []).map(w => ({
        id: w.id,
        userId: w.user_id,
        amount: Number(w.amount),
        status: w.status,
        wechatInfo: w.wechat_info,
        reviewerId: w.reviewer_id,
        reviewNote: w.review_note,
        reviewedAt: w.reviewed_at,
        paidAt: w.paid_at,
        createdAt: w.created_at,
        user: w.users
      })),
      total: count || 0,
      page,
      size
    }
  }

  /**
   * 获取提现统计（管理员）
   */
  async getWithdrawalStats() {
    // 待审核数量
    const { count: pendingCount } = await supabase
      .from('withdrawals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    // 已通过待打款数量
    const { count: approvedCount } = await supabase
      .from('withdrawals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')

    // 已打款数量和金额
    const { data: paidData } = await supabase
      .from('withdrawals')
      .select('amount')
      .eq('status', 'paid')
    
    const paidCount = paidData?.length || 0
    const paidAmount = (paidData || []).reduce((sum, w) => sum + Number(w.amount), 0)

    // 已拒绝数量和金额
    const { data: rejectedData } = await supabase
      .from('withdrawals')
      .select('amount')
      .eq('status', 'rejected')
    
    const rejectedCount = rejectedData?.length || 0
    const rejectedAmount = (rejectedData || []).reduce((sum, w) => sum + Number(w.amount), 0)

    return {
      pendingCount: pendingCount || 0,
      approvedCount: approvedCount || 0,
      paidCount,
      paidAmount,
      rejectedCount,
      rejectedAmount
    }
  }

  /**
   * 获取提现审核记录列表（分页）
   */
  async getWithdrawalReviewLogsList(page = 1, size = 20, filters = {}) {
    const offset = (page - 1) * size

    let query = supabase
      .from('withdrawal_review_logs')
      .select('*', { count: 'exact' })

    if (filters.withdrawalId) {
      query = query.eq('withdrawal_id', filters.withdrawalId)
    }
    if (filters.reviewerId) {
      query = query.eq('reviewer_id', filters.reviewerId)
    }
    if (filters.action) {
      query = query.eq('action', filters.action)
    }

    const { data: logs, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + size - 1)

    if (error) {
      logger.error('获取提现审核记录列表失败:', error)
      throw new Error('获取提现审核记录列表失败')
    }

    // 批量获取关联数据
    const reviewerIds = [...new Set((logs || []).map(l => l.reviewer_id).filter(Boolean))]
    const withdrawalIds = [...new Set((logs || []).map(l => l.withdrawal_id).filter(Boolean))]

    let reviewers = {}, withdrawals = {}, withdrawalUsers = {}
    
    if (reviewerIds.length > 0) {
      const { data: users } = await supabase.from('users').select('id, username').in('id', reviewerIds)
      ;(users || []).forEach(u => { reviewers[u.id] = u.username })
    }
    if (withdrawalIds.length > 0) {
      const { data: withdrawalList } = await supabase.from('withdrawals').select('id, amount, status, user_id').in('id', withdrawalIds)
      ;(withdrawalList || []).forEach(w => { withdrawals[w.id] = { amount: w.amount, status: w.status, userId: w.user_id } })
      
      const userIds = [...new Set((withdrawalList || []).map(w => w.user_id).filter(Boolean))]
      if (userIds.length > 0) {
        const { data: users } = await supabase.from('users').select('id, username').in('id', userIds)
        ;(users || []).forEach(u => { withdrawalUsers[u.id] = u.username })
      }
    }

    return {
      list: (logs || []).map(log => {
        const withdrawal = withdrawals[log.withdrawal_id]
        return {
          id: log.id,
          withdrawalId: log.withdrawal_id,
          amount: withdrawal ? Number(withdrawal.amount) : 0,
          userId: withdrawal?.userId,
          userName: withdrawalUsers[withdrawal?.userId] || '未知用户',
          reviewerId: log.reviewer_id,
          reviewerName: reviewers[log.reviewer_id] || '未知',
          action: log.action,
          note: log.note,
          createdAt: log.created_at
        }
      }),
      total: count || 0,
      page,
      size
    }
  }

  /**
   * 获取提现历史记录（全量，支持筛选）
   */
  async getWithdrawalHistory(page = 1, size = 20, filters = {}) {
    const offset = (page - 1) * size
    
    let query = supabase
      .from('withdrawals')
      .select(`
        *,
        users:user_id (id, username, phone),
        reviewer:reviewer_id (id, username)
      `, { count: 'exact' })
    
    // 状态筛选
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    
    // 用户筛选
    if (filters.userId) {
      query = query.eq('user_id', filters.userId)
    }
    
    // 日期筛选
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate)
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate)
    }

    const { data: list, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + size - 1)

    if (error) {
      logger.error('获取提现历史失败:', error)
      throw new Error('获取提现历史失败')
    }

    return {
      list: (list || []).map(w => ({
        id: w.id,
        userId: w.user_id,
        amount: Number(w.amount),
        status: w.status,
        wechatInfo: w.wechat_info,
        reviewerId: w.reviewer_id,
        reviewerName: w.reviewer?.username || '',
        reviewNote: w.review_note,
        reviewedAt: w.reviewed_at,
        paidAt: w.paid_at,
        createdAt: w.created_at,
        user: w.users
      })),
      total: count || 0,
      page,
      size
    }
  }

  /**
   * 导出提现记录为 CSV
   */
  async exportWithdrawalsToCSV(filters = {}) {
    let query = supabase
      .from('withdrawals')
      .select(`
        *,
        users:user_id (id, username, phone)
      `)
    
    // 状态筛选
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    
    // 日期筛选
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate)
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate)
    }

    const { data: list, error } = await query
      .order('created_at', { ascending: false })
      .limit(10000) // 限制最大导出数量

    if (error) {
      logger.error('导出提现记录失败:', error)
      throw new Error('导出提现记录失败')
    }

    // 生成 CSV
    const headers = ['ID', '用户名', '手机号', '金额', '状态', '微信信息', '审核备注', '创建时间', '审核时间', '打款时间']
    const rows = (list || []).map(w => {
      const statusMap = { pending: '待审核', approved: '已通过', paid: '已打款', rejected: '已拒绝' }
      const wechatInfo = typeof w.wechat_info === 'string' ? w.wechat_info : JSON.stringify(w.wechat_info || {})
      return [
        w.id,
        w.users?.username || '',
        w.users?.phone || '',
        w.amount,
        statusMap[w.status] || w.status,
        wechatInfo,
        w.review_note || '',
        w.created_at || '',
        w.reviewed_at || '',
        w.paid_at || ''
      ]
    })

    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
    return csv
  }

  /**
   * 获取积分兑换记录
   */
  async getConvertRecords(userId, page = 1, size = 20) {
    const offset = (page - 1) * size

    const { data: list, count, error } = await supabase
      .from('records')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('type', 'convert')
      .order('created_at', { ascending: false })
      .range(offset, offset + size - 1)

    if (error) {
      logger.error('获取兑换记录失败:', error)
      throw new Error('获取兑换记录失败')
    }

    return {
      list: (list || []).map(r => ({
        id: r.id,
        points: Math.abs(r.points),
        amount: Number(r.balance),
        desc: r.description,
        createdAt: r.created_at
      })),
      total: count || 0,
      page,
      size
    }
  }
}

export default new WalletService()
