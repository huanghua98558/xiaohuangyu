import supabase from '../utils/supabaseToPrismaAdapter.js'
import prisma from '../utils/prisma.js'
import taskService from './taskService.js'
import logger from '../utils/logger.js'
import { cache, DistributedLock } from '../utils/redis.js'
import BusinessError from '../utils/BusinessError.js'
import {
  notifyPointsConverted,
  notifyWithdrawSubmitted,
  notifyWithdrawApproved,
  notifyWithdrawRejected,
  notifyWithdrawPaid,
  sendAdminNotification,
} from './notificationService.js'

// 排行榜缓存键模式
const RANK_CACHE_PATTERNS = [
  'rank:total:*',
  'rank:daily:*',
  'rank:user:total:*',
  'rank:user:daily:*'
]

// ============ P0 修复：添加分布式锁和事务保护 ============

class WalletService {
  /**
   * 积分兑换余额（添加分布式锁 + 事务保护）
   */
  async convertPoints(userId, points) {
    const lockKey = `lock:convert:${userId}`
    const lock = await DistributedLock.acquire(lockKey, 30000, { degradable: false })
    
    if (!lock.success) {
      throw new BusinessError('操作过于频繁，请稍后再试', 429)
    }
    
    try {
      const normalizedUserId = Number(userId)
      const normalizedPoints = Number(points)
      const config = await taskService.getConfig()

      if (!Number.isFinite(normalizedPoints) || normalizedPoints <= 0) {
        throw new BusinessError('兑换积分必须大于0', 400)
      }

      // 获取用户信息
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', normalizedUserId)
        .single()

      if (!user) {
        throw new BusinessError('用户不存在', 404)
      }

      if (Number(user.points || 0) < normalizedPoints) {
        throw new BusinessError('积分不足', 400)
      }

      // ========== 提现条件检查 ==========
      const { data: ratioConfig } = await supabase
        .from('system_configs')
        .select('value')
        .eq('key', 'withdraw_task_points_ratio')
        .single()
      
      const requiredRatio = parseInt(ratioConfig?.value || 50)

      const { data: bonusRecords } = await supabase
        .from('records')
        .select('points, type')
        .eq('user_id', normalizedUserId)
        .in('type', ['reward', 'week_reward', 'month_reward'])
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

      const hasLargeBonus = (bonusRecords || []).some(r => 
        r.points >= 100 && (r.type === 'week_reward' || r.type === 'month_reward')
      )

      if (!hasLargeBonus) {
        const taskPoints = user.task_points || 0
        const totalPoints = user.total_points || 0
        const effectiveTotal = totalPoints - (user.exchanged_points || 0)
        const taskRatio = effectiveTotal > 0 ? (taskPoints / effectiveTotal) * 100 : 0

        if (taskRatio < requiredRatio) {
          throw new BusinessError(`兑换失败: 任务积分占比需 >= ${requiredRatio}%, 当前 ${taskRatio.toFixed(1)}%。请多完成任务后再兑换。`, 400)
        }
      }

      // 计算兑换金额
      const yuan = Number((normalizedPoints / config.pointsToYuan).toFixed(2))

      const updatedUser = await prisma.$transaction(async (tx) => {
        const currentUser = await tx.users.findUnique({
          where: { id: normalizedUserId },
          select: {
            id: true,
            points: true,
            balance: true,
            exchanged_points: true
          }
        })

        if (!currentUser) {
          throw new BusinessError('用户不存在', 404)
        }

        if (Number(currentUser.points || 0) < normalizedPoints) {
          throw new BusinessError('积分不足', 400)
        }

        const nextPoints = Number(currentUser.points || 0) - normalizedPoints
        const nextBalance = Number(currentUser.balance || 0) + yuan
        const nextExchangedPoints = BigInt(currentUser.exchanged_points || 0) + BigInt(normalizedPoints)

        const savedUser = await tx.users.update({
          where: { id: normalizedUserId },
          data: {
            points: nextPoints,
            balance: nextBalance,
            exchanged_points: nextExchangedPoints
          },
          select: {
            id: true,
            balance: true,
            points: true,
            exchanged_points: true
          }
        })

        await tx.records.create({
          data: {
            user_id: normalizedUserId,
            type: 'convert',
            desc: '积分兑换',
            points: -normalizedPoints,
            balance: yuan
          }
        })

        return savedUser
      })

      // 清除排行榜缓存
      for (const pattern of RANK_CACHE_PATTERNS) {
        await cache.delPattern(pattern)
      }

      logger.info(`✅ 用户 ${normalizedUserId} 兑换积分 ${normalizedPoints} -> ${yuan}元`)

      try {
        await notifyPointsConverted(normalizedUserId, {
          points: normalizedPoints,
          amount: yuan,
          balance: updatedUser?.balance,
        })
      } catch (notifyErr) {
        logger.warn('发送积分兑换通知失败:', notifyErr.message)
      }

      return {
        message: `兑换成功，到账 ¥${yuan}`,
        convertedPoints: normalizedPoints,
        amount: yuan
      }
    } catch (error) {
      logger.error(`积分兑换失败: user=${userId}, points=${points}`, error)
      throw error
    } finally {
      await lock.release()
    }
  }

  /**
   * 提现申请（添加分布式锁 + 事务保护）
   */
  async withdraw(userId, amount, wechatInfo = '') {
    const lockKey = `lock:withdraw:${userId}`
    const lock = await DistributedLock.acquire(lockKey, 30000, { degradable: false })
    
    if (!lock.success) {
      throw new BusinessError('操作过于频繁，请稍后再试', 429)
    }
    
    try {
      const normalizedUserId = Number(userId)
      const normalizedAmount = Number(amount)
      const config = await taskService.getConfig()

      if (!Number.isFinite(normalizedAmount) || normalizedAmount < config.minWithdrawAmount) {
        throw new BusinessError(`最低提现 ${config.minWithdrawAmount} 元`, 400)
      }

      // 获取用户信息
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', normalizedUserId)
        .single()

      if (!user) {
        throw new BusinessError('用户不存在', 404)
      }

      if (Number(user.balance) < normalizedAmount) {
        throw new BusinessError('余额不足', 400)
      }

      const { updatedUser, withdrawal } = await prisma.$transaction(async (tx) => {
        const currentUser = await tx.users.findUnique({
          where: { id: normalizedUserId },
          select: { id: true, balance: true }
        })

        if (!currentUser) {
          throw new BusinessError('用户不存在', 404)
        }

        if (Number(currentUser.balance || 0) < normalizedAmount) {
          throw new BusinessError('余额不足', 400)
        }

        const savedUser = await tx.users.update({
          where: { id: normalizedUserId },
          data: {
            balance: Number(currentUser.balance || 0) - normalizedAmount
          },
          select: { id: true, balance: true }
        })

        const savedWithdrawal = await tx.withdrawals.create({
          data: {
            user_id: normalizedUserId,
            amount: normalizedAmount,
            status: 'pending',
            wechat_info: wechatInfo,
            updated_at: new Date()
          },
          select: {
            id: true,
            amount: true,
            user_id: true
          }
        })

        await tx.records.create({
          data: {
            user_id: normalizedUserId,
            type: 'withdraw',
            desc: '提现申请',
            points: 0,
            balance: -normalizedAmount
          }
        })

        return { updatedUser: savedUser, withdrawal: savedWithdrawal }
      })

      logger.info(`✅ 用户 ${normalizedUserId} 申请提现 ${normalizedAmount}元`)

      try {
        await Promise.all([
          notifyWithdrawSubmitted(normalizedUserId, {
            amount: normalizedAmount,
            balance: updatedUser?.balance,
          }),
          sendAdminNotification({
            type: 'withdraw_pending_created',
            title: '有新的提现申请',
            content: `用户 ${normalizedUserId} 提交了 ${normalizedAmount.toFixed(2)} 元提现申请。`,
            data: {
              userId: String(normalizedUserId),
              amount: normalizedAmount,
              withdrawalId: withdrawal.id != null ? String(withdrawal.id) : undefined,
            },
            priority: 'high',
          }),
        ])
      } catch (notifyErr) {
        logger.warn('发送提现提交通知失败:', notifyErr.message)
      }

      return { message: '提现申请已提交，请等待审核' }
    } catch (error) {
      logger.error(`提现失败: user=${userId}, amount=${amount}`, error)
      throw error
    } finally {
      await lock.release()
    }
  }

  /**
   * 获取提现记录
   */
  async getWithdrawals(userId, page = 1, size = 20) {
    const offset = (page - 1) * size

    const [{ data: list }, { count }] = await Promise.all([
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

    const [{ data: list }, { count }] = await Promise.all([
      supabase
        .from('withdrawals')
        .select('*')
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
   * 处理提现申请（管理员） - 添加分布式锁
   */
  async processWithdrawal(withdrawalId, reviewerId, action, note = '') {
    if (action === 'paid') {
      return this.confirmPaid(withdrawalId, reviewerId)
    }

    const lockKey = `lock:withdrawal:${withdrawalId}`
    const lock = await DistributedLock.acquire(lockKey, 30000, { degradable: false })
    
    if (!lock.success) {
      throw new Error('该提现申请正在处理中')
    }
    
    try {
      const { data: withdrawal, error } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('id', withdrawalId)
        .single()

      if (!withdrawal) {
        throw new Error('提现申请不存在')
      }

      if (withdrawal.status !== 'pending') {
        throw new Error('该提现申请已处理')
      }

      const now = new Date().toISOString()
      let updateData = {
        reviewer_id: reviewerId,
        review_note: note,
        reviewed_at: now
      }

      if (action === 'approve') {
        updateData.status = 'approved'
      } else if (action === 'reject') {
        updateData.status = 'rejected'
        
        // 拒绝时返还余额
        const { data: user } = await supabase
          .from('users')
          .select('balance')
          .eq('id', withdrawal.user_id)
          .single()
        
        if (user) {
          await supabase
            .from('users')
            .update({ balance: Number(user.balance) + Number(withdrawal.amount) })
            .eq('id', withdrawal.user_id)
        }
      } else {
        throw new Error('无效的操作')
      }

      const { error: updateError } = await supabase
        .from('withdrawals')
        .update(updateData)
        .eq('id', withdrawalId)

      if (updateError) {
        logger.error('处理提现失败:', updateError)
        throw new Error('处理提现失败')
      }

      logger.info(`✅ 提现申请 ${withdrawalId} 已${action === 'approve' ? '通过' : '拒绝'}`)

      try {
        if (action === 'approve') {
          await Promise.all([
            notifyWithdrawApproved(withdrawal.user_id, { amount: withdrawal.amount }),
            sendAdminNotification({
              type: 'withdraw_approved_waiting_payout',
              title: '提现待打款',
              content: `提现申请 ${withdrawalId} 已审核通过，等待打款。`,
              data: {
                withdrawalId: String(withdrawalId),
                userId: String(withdrawal.user_id),
                amount: Number(withdrawal.amount),
              },
              priority: 'high',
            }),
          ])
        } else {
          await notifyWithdrawRejected(withdrawal.user_id, {
            amount: withdrawal.amount,
            note,
          })
        }
      } catch (notifyErr) {
        logger.warn('发送提现审核通知失败:', notifyErr.message)
      }

      return { message: '处理成功' }
    } finally {
      await lock.release()
    }
  }

  /**
   * 确认打款（管理员） - 添加分布式锁
   */
  async confirmPaid(withdrawalId, reviewerId) {
    const lockKey = `lock:withdrawal:${withdrawalId}`
    const lock = await DistributedLock.acquire(lockKey, 30000, { degradable: false })
    
    if (!lock.success) {
      throw new Error('该提现申请正在处理中')
    }
    
    try {
      const { data: withdrawal, error } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('id', withdrawalId)
        .single()

      if (!withdrawal) {
        throw new Error('提现申请不存在')
      }

      if (withdrawal.status !== 'approved') {
        throw new Error('只有已通过的申请才能确认打款')
      }

      const { error: updateError } = await supabase
        .from('withdrawals')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('id', withdrawalId)

      if (updateError) {
        logger.error('确认打款失败:', updateError)
        throw new Error('确认打款失败')
      }

      logger.info(`✅ 提现申请 ${withdrawalId} 已确认打款`)

      try {
        await notifyWithdrawPaid(withdrawal.user_id, { amount: withdrawal.amount })
      } catch (notifyErr) {
        logger.warn('发送提现打款通知失败:', notifyErr.message)
      }

      return { message: '已确认打款' }
    } finally {
      await lock.release()
    }
  }

  /**
   * 批量审核提现申请（管理员）
   */
  async batchProcessWithdrawals(withdrawalIds, reviewerId, action, note = '') {
    const results = {
      success: [],
      failed: []
    }

    for (const id of withdrawalIds) {
      try {
        if (action === 'paid') {
          await this.confirmPaid(id, reviewerId)
        } else {
          await this.processWithdrawal(id, reviewerId, action, note)
        }
        results.success.push(id)
      } catch (error) {
        results.failed.push({ id, reason: error.message })
      }
    }

    return results
  }

  /**
   * 获取所有提现记录（管理员）
   */
  async getAllWithdrawals(page = 1, size = 20, filters = {}) {
    const offset = (page - 1) * size

    let query = supabase
      .from('withdrawals')
      .select('*', { count: 'exact' })

    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    if (filters.userId) {
      query = query.eq('user_id', filters.userId)
    }
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
      logger.error('获取提现记录失败:', error)
      throw new Error('获取提现记录失败')
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
      .select('*')
    
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate)
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate)
    }

    const { data: list, error } = await query
      .order('created_at', { ascending: false })
      .limit(10000)

    if (error) {
      logger.error('导出提现记录失败:', error)
      throw new Error('导出提现记录失败')
    }

    const headers = ['ID', '用户ID', '金额', '状态', '微信信息', '审核备注', '创建时间', '审核时间', '打款时间']
    const rows = (list || []).map(w => {
      const statusMap = { pending: '待审核', approved: '已通过', paid: '已打款', rejected: '已拒绝' }
      const wechatInfo = typeof w.wechat_info === 'string' ? w.wechat_info : JSON.stringify(w.wechat_info || {})
      return [
        w.id,
        w.user_id,
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
        desc: r.desc,
        createdAt: r.created_at
      })),
      total: count || 0,
      page,
      size
    }
  }

  /**
   * 获取提现统计
   */
  async getWithdrawalStats() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString()
    
    // 获取所有提现记录
    const withdrawals = await prisma.$queryRawUnsafe(
      `SELECT status, amount, created_at FROM withdrawals`
    )
    
    // 统计
    const pendingCount = withdrawals?.filter(w => w.status === 'pending').length || 0
    const approvedCount = withdrawals?.filter(w => w.status === 'approved').length || 0
    const rejectedCount = withdrawals?.filter(w => w.status === 'rejected').length || 0
    const paidRows = withdrawals?.filter(w => w.status === 'paid') || []
    const paidCount = paidRows.length
    const paidAmount = paidRows.reduce((sum, w) => sum + (Number(w.amount) || 0), 0)
    const rejectedRows = withdrawals?.filter(w => w.status === 'rejected') || []
    const rejectedAmount = rejectedRows.reduce((sum, w) => sum + (Number(w.amount) || 0), 0)
    const totalAmount = withdrawals?.filter(w => w.status === 'approved' || w.status === 'paid').reduce((sum, w) => sum + (Number(w.amount) || 0), 0) || 0
    const pendingAmount = withdrawals?.filter(w => w.status === 'pending').reduce((sum, w) => sum + (Number(w.amount) || 0), 0) || 0
    
    // 今日统计
    const todayWithdrawals = withdrawals?.filter(w => w.created_at && new Date(w.created_at) >= today) || []
    const todayCount = todayWithdrawals.length
    const todayAmount = todayWithdrawals.reduce((sum, w) => sum + (Number(w.amount) || 0), 0)
    
    return {
      pendingCount,
      approvedCount,
      rejectedCount,
      paidCount,
      paidAmount,
      rejectedAmount,
      totalAmount,
      pendingAmount,
      todayCount,
      todayAmount
    }
  }
}

export default new WalletService()
