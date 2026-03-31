import supabase from '../utils/supabaseToPrismaAdapter.js'
import logger from '../utils/logger.js'

class UserDetailService {
  /**
   * 获取用户详情（完整信息）
   */
  async getUserDetail(userId) {
    // 获取用户基本信息
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error || !user) {
      throw new Error('用户不存在')
    }

    // 获取用户任务统计
    const { data: taskStats } = await supabase
      .from('claims')
      .select('status')
      .eq('user_id', userId)

    const taskCount = {
      total: taskStats?.length || 0,
      pending: taskStats?.filter(t => t.status === 'pending').length || 0,
      done: taskStats?.filter(t => t.status === 'done').length || 0,
      rejected: taskStats?.filter(t => t.status === 'rejected').length || 0
    }

    // 获取用户积分日志 (使用 records 表)
    const { data: pointsLogs } = await supabase
      .from('records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    // 获取用户余额日志 (使用 records 表，筛选余额相关)
    const { data: balanceLogs } = await supabase
      .from('records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    // 获取用户签到记录
    const { data: signInStats } = await supabase
      .from('sign_ins')
      .select('*')
      .eq('user_id', userId)
      .order('sign_date', { ascending: false })
      .limit(30)

    // 获取用户成就
    const { data: userAchievements } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)

    // 获取用户提现记录
    const { data: withdrawals } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    return {
      user: {
        id: user.id,
        username: user.username,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        level: user.level,
        points: user.points,
        balance: Number(user.balance) || 0,
        totalTasks: user.total_tasks,
        totalPoints: user.total_points,
        status: user.status,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at
      },
      taskStats: taskCount,
      pointsLogs: pointsLogs || [],
      balanceLogs: balanceLogs || [],
      signInStats: {
        total: signInStats?.length || 0,
        records: signInStats || []
      },
      achievements: userAchievements || [],
      withdrawals: withdrawals || []
    }
  }

  /**
   * 获取用户任务列表（管理端）
   */
  async getUserTasks(userId, page = 1, size = 20, status = null) {
    const offset = (page - 1) * size

    let query = supabase
      .from('claims')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: claims, count, error } = await query
      .order('claimed_at', { ascending: false })
      .range(offset, offset + size - 1)

    if (error) {
      throw new Error('获取用户任务列表失败')
    }

    return {
      list: claims || [],
      total: count || 0,
      page,
      size
    }
  }

  /**
   * 获取用户积分流水
   */
  async getUserPointsLogs(userId, page = 1, size = 20) {
    const offset = (page - 1) * size

    const { data: logs, count, error } = await supabase
      .from('records')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + size - 1)

    if (error) {
      throw new Error('获取积分流水失败')
    }

    return {
      list: logs || [],
      total: count || 0,
      page,
      size
    }
  }

  /**
   * 获取用户余额流水
   */
  async getUserBalanceLogs(userId, page = 1, size = 20) {
    const offset = (page - 1) * size

    const { data: logs, count, error } = await supabase
      .from('records')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + size - 1)

    if (error) {
      throw new Error('获取余额流水失败')
    }

    return {
      list: logs || [],
      total: count || 0,
      page,
      size
    }
  }

  /**
   * 获取用户活跃度分析
   */
  async getUserActivity(userId, days = 30) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // 获取任务完成趋势
    const { data: claims } = await supabase
      .from('claims')
      .select('reviewed_at')
      .eq('user_id', userId)
      .in('status', ['approved', 'done'])
      .gte('reviewed_at', startDate.toISOString())

    // 按日期统计
    const dailyStats = {}
    ;(claims || []).forEach(claim => {
      const date = claim.reviewed_at?.split('T')[0]
      if (date) {
        dailyStats[date] = (dailyStats[date] || 0) + 1
      }
    })

    // 获取签到统计
    const { data: signIns } = await supabase
      .from('sign_ins')
      .select('sign_date, points_earned')
      .eq('user_id', userId)
      .gte('sign_date', startDate.toISOString().split('T')[0])

    return {
      dailyTasks: dailyStats,
      signIns: signIns || [],
      period: days
    }
  }

  /**
   * 批量更新用户
   */
  async batchUpdateUsers(userIds, updates, adminId) {
    const updateData = {}
    if (updates.level !== undefined) updateData.level = updates.level
    if (updates.status !== undefined) updateData.status = updates.status ? 1 : 0
    if (updates.role !== undefined) updateData.role = updates.role

    const { data: users, error } = await supabase
      .from('users')
      .update(updateData)
      .in('id', userIds)
      .select()

    if (error) {
      throw new Error('批量更新用户失败')
    }

    logger.info(`管理员 ${adminId} 批量更新用户 ${userIds.length} 个`)
    return users
  }

  /**
   * 批量发放积分
   */
  async batchGrantPoints(userIds, amount, reason, adminId) {
    const results = []

    for (const userId of userIds) {
      try {
        const { data: user } = await supabase
          .from('users')
          .select('points')
          .eq('id', userId)
          .single()

        if (user) {
          const newPoints = user.points + amount
          
          await supabase
            .from('users')
            .update({ points: newPoints })
            .eq('id', userId)

          // 使用 records 表记录
          await supabase
            .from('records')
            .insert({
              user_id: userId,
              type: 'admin_batch',
              desc: `批量发放: ${reason || '管理员发放'}`,
              points: amount,
              balance: 0
            })

          results.push({ userId, success: true })
        }
      } catch (err) {
        results.push({ userId, success: false, error: err.message })
      }
    }

    logger.info(`管理员 ${adminId} 批量发放积分 ${amount} 给 ${userIds.length} 个用户`)
    return results
  }
}

export default new UserDetailService()
