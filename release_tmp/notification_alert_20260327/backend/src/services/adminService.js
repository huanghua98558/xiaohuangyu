import pkg from '@prisma/client'; const { PrismaClient } = pkg
const prisma = new PrismaClient()
import { redisClient, REDIS_ENABLED } from '../utils/redis.js'
import supabase from '../utils/supabaseToPrismaAdapter.js'
import onlineUserService from './onlineUserService.js'
import logger from '../utils/logger.js'
import { PLATFORMS, PLATFORM_NAMES, getPlatformName } from '../constants/taskActions.js'
import { verifyPassword } from "../utils/password.js"
import { generateToken } from "../utils/jwt.js"
import { notifyAdminPointsAdjusted } from './notificationService.js'

class AdminService {
  /**
   * 管理员登录
   */
  async adminLogin(username, password) {
    const users = await prisma.$queryRaw`
      SELECT id, username, phone, password_hash, role 
      FROM users 
      WHERE (username = ${username} OR phone = ${username})
      AND role IN ('admin', 'super_admin', 'reviewer')
    `

    const user = users && users[0]

    if (!user) {
      throw new Error('用户不存在或无管理权限')
    }

    const isValid = await verifyPassword(password, user.password_hash)
    if (!isValid) {
      throw new Error('密码错误')
    }

    const token = generateToken({ userId: user.id.toString(), role: user.role })

    logger.info("管理员登录成功: " + user.username)

    return {
      user: {
        id: user.id.toString(),
        username: user.username,
        phone: user.phone || "",
        role: user.role
      },
      token
    }
  }

  /**
   * 获取管理员信息
   */
  async getAdminById(userId) {
    const users = await prisma.$queryRaw`
      SELECT id, username, phone, role, created_at
      FROM users WHERE id = ${BigInt(userId)}
    `
    
    const user = users && users[0]

    if (!user) {
      throw new Error("用户不存在")
    }

    return {
      id: user.id.toString(),
      username: user.username,
      phone: user.phone || "",
      role: user.role,
      createdAt: user.created_at
    }
  }


  /**
   * 获取系统统计数据 - 新版
   */
  async getStats() {
    // Redis缓存: 30秒TTL，避免重复查询
    try {
      const cached = await redisClient?.get('admin:dashboard:stats')
      if (cached) return JSON.parse(cached)
    } catch(e) {}

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    const dayBeforeYesterday = new Date(today)
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2)

    const weekStart = new Date(today)
    const dayOfWeek = weekStart.getDay() || 7
    weekStart.setDate(weekStart.getDate() - dayOfWeek + 1)
    weekStart.setHours(0, 0, 0, 0)
    
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0)

    // ========== 全部查询一次性并行执行 ==========
    const [
      r_pendingClaims,
      r_totalCompletedClaims,
      r_todayPubTasks, r_yesterdayPubTasks, r_dayBeforePubTasks,
      r_todayClaims, r_yesterdayClaims, r_dayBeforeClaims,
      r_todayDone, r_yesterdayDone, r_dayBeforeDone,
      r_todayPoints, r_yesterdayPoints,
      r_todaySignIns, r_yesterdaySignIns,
      r_todayTasks, r_yesterdayTasks, r_dayBeforeTasks,
      r_compToday, r_compYesterday, r_compDayBefore,
      r_allDoneReward,
      r_weekPoints, r_monthPoints,
      r_totalSignIns, r_weekSignIns,
      r_totalUsers, r_totalTasks, r_totalClaims,
      r_blockedAll, r_suspected, r_confirmed,
    ] = await Promise.all([
      supabase.from('claims').select('*', { count: 'exact', head: true }).in('status', ['submitted', 'image_reviewing', 'pending_link', 'link_reviewing', 'pending_manual']),
      supabase.from('claims').select('*', { count: 'exact', head: true }).in('status', ['approved', 'done']),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).gte('created_at', yesterday.toISOString()).lt('created_at', today.toISOString()),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).gte('created_at', dayBeforeYesterday.toISOString()).lt('created_at', yesterday.toISOString()),
      supabase.from('claims').select('*', { count: 'exact', head: true }).gte('claimed_at', today.toISOString()),
      supabase.from('claims').select('*', { count: 'exact', head: true }).gte('claimed_at', yesterday.toISOString()).lt('claimed_at', today.toISOString()),
      supabase.from('claims').select('*', { count: 'exact', head: true }).gte('claimed_at', dayBeforeYesterday.toISOString()).lt('claimed_at', yesterday.toISOString()),
      supabase.from('claims').select('*', { count: 'exact', head: true }).in('status', ['approved', 'done']).gte('reviewed_at', today.toISOString()),
      supabase.from('claims').select('*', { count: 'exact', head: true }).in('status', ['approved', 'done']).gte('reviewed_at', yesterday.toISOString()).lt('reviewed_at', today.toISOString()),
      supabase.from('claims').select('*', { count: 'exact', head: true }).in('status', ['approved', 'done']).gte('reviewed_at', dayBeforeYesterday.toISOString()).lt('reviewed_at', yesterday.toISOString()),
      supabase.from('records').select('points, type').gte('created_at', today.toISOString()),
      supabase.from('records').select('points, type').gte('created_at', yesterday.toISOString()).lt('created_at', today.toISOString()),
      supabase.from('sign_ins').select('*', { count: 'exact', head: true }).gte('sign_date', today.toISOString().split('T')[0]),
      supabase.from('sign_ins').select('*', { count: 'exact', head: true }).eq('sign_date', yesterday.toISOString().split('T')[0]),
      supabase.from('tasks').select('need_count, remain').gte('created_at', today.toISOString()),
      supabase.from('tasks').select('need_count, remain').gte('created_at', yesterday.toISOString()).lt('created_at', today.toISOString()),
      supabase.from('tasks').select('need_count, remain').gte('created_at', dayBeforeYesterday.toISOString()).lt('created_at', yesterday.toISOString()),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('updated_at', today.toISOString()),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('updated_at', yesterday.toISOString()).lt('updated_at', today.toISOString()),
      supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('updated_at', dayBeforeYesterday.toISOString()).lt('updated_at', yesterday.toISOString()),
      supabase.from('claims').select('reward').in('status', ['approved', 'done']),
      supabase.from('records').select('points').gte('created_at', weekStart.toISOString()),
      supabase.from('records').select('points').gte('created_at', monthStart.toISOString()),
      supabase.from('sign_ins').select('*', { count: 'exact', head: true }),
      supabase.from('sign_ins').select('*', { count: 'exact', head: true }).gte('sign_date', weekStart.toISOString().split('T')[0]),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('tasks').select('*', { count: 'exact', head: true }),
      supabase.from('claims').select('*', { count: 'exact', head: true }),
      supabase.from('blocked_accounts').select('*', { count: 'exact', head: true }).in('status', ['suspected', 'confirmed']),
      supabase.from('blocked_accounts').select('*', { count: 'exact', head: true }).eq('status', 'suspected'),
      supabase.from('blocked_accounts').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
    ])

    // 在线用户(Redis查询,极快)
    const onlineUsers = await onlineUserService.getOnlineCount()

    // ========== 数据解构 ==========
    const pendingClaims = r_pendingClaims.count || 0
    const totalCompletedClaims = r_totalCompletedClaims.count || 0
    const todayPublishedTasks = r_todayPubTasks.count || 0
    const yesterdayPublishedTasks = r_yesterdayPubTasks.count || 0
    const dayBeforePublishedTasks = r_dayBeforePubTasks.count || 0
    const todayClaims = r_todayClaims.count || 0
    const yesterdayClaims = r_yesterdayClaims.count || 0
    const dayBeforeClaims = r_dayBeforeClaims.count || 0
    const todayCompletedClaims = r_todayDone.count || 0
    const yesterdayCompletedClaims = r_yesterdayDone.count || 0
    const dayBeforeCompletedClaims = r_dayBeforeDone.count || 0
    const todaySignIns = r_todaySignIns.count || 0
    const yesterdaySignIns = r_yesterdaySignIns.count || 0

    const todayPointsData = r_todayPoints.data || []
    const yesterdayPointsData = r_yesterdayPoints.data || []

    // 任务名额
    const sumAmount = (arr) => (arr || []).reduce((s, t) => s + (t.need_count || t.remain || 0), 0)
    const todayTaskAmount = sumAmount(r_todayTasks.data)
    const yesterdayTaskAmount = sumAmount(r_yesterdayTasks.data)
    const dayBeforeTaskAmount = sumAmount(r_dayBeforeTasks.data)

    // 完成任务数
    const todayCompletedTasksCount = r_compToday.count || 0
    const yesterdayCompletedTasksCount = r_compYesterday.count || 0
    const dayBeforeCompletedTasksCount = r_compDayBefore.count || 0

    // 总积分发放
    const totalPointsIssued = (r_allDoneReward.data || []).reduce((s, c) => s + (c.reward || 0), 0)

    // 积分统计
    const sumPositive = (arr) => (arr || []).reduce((s, r) => s + (r.points > 0 ? r.points : 0), 0)
    const sumNegative = (arr) => (arr || []).reduce((s, r) => s + (r.points < 0 ? Math.abs(r.points) : 0), 0)
    const todayPointsIssued = sumPositive(todayPointsData)
    const yesterdayPointsIssued = sumPositive(yesterdayPointsData)

    const todayPointsByType = { sign_in: 0, task: 0, promotion_c: 0, reward: 0, bonus: 0, achievement: 0 }
    todayPointsData.forEach(r => {
      if (r.points > 0 && todayPointsByType[r.type] !== undefined) {
        todayPointsByType[r.type] += r.points
      }
    })

    const weekPointsIssued = sumPositive(r_weekPoints.data)
    const weekPointsDeduct = sumNegative(r_weekPoints.data)
    const monthPointsIssued = sumPositive(r_monthPoints.data)
    const monthPointsDeduct = sumNegative(r_monthPoints.data)

    const calcChange = (today, yesterday, dayBefore) => {
      const todayVsYesterday = yesterday > 0 
        ? Math.round((today - yesterday) / yesterday * 100)
        : (today > 0 ? 100 : 0)
      const yesterdayVsDayBefore = dayBefore > 0
        ? Math.round((yesterday - dayBefore) / dayBefore * 100)
        : (yesterday > 0 ? 100 : 0)
      return { change: todayVsYesterday, trend3d: [todayVsYesterday, yesterdayVsDayBefore] }
    }

    const result = {
      todayPublishedTasks,
      todayPublishedTasksChange: calcChange(todayPublishedTasks, yesterdayPublishedTasks, dayBeforePublishedTasks),
      todayTaskAmount,
      todayTaskAmountChange: calcChange(todayTaskAmount, yesterdayTaskAmount, dayBeforeTaskAmount),
      todayClaims,
      todayClaimsChange: calcChange(todayClaims, yesterdayClaims, dayBeforeClaims),
      todayCompletedClaims,
      todayCompletedClaimsChange: calcChange(todayCompletedClaims, yesterdayCompletedClaims, dayBeforeCompletedClaims),
      onlineUsers,
      pendingClaims,
      totalCompletedClaims,
      todayCompletedTasks: todayCompletedTasksCount,
      todayCompletedTasksChange: calcChange(todayCompletedTasksCount, yesterdayCompletedTasksCount, dayBeforeCompletedTasksCount),
      todayPointsIssued,
      todayPointsIssuedChange: calcChange(todayPointsIssued, yesterdayPointsIssued, 0),
      todaySignIns,
      todaySignInsChange: calcChange(todaySignIns, yesterdaySignIns, 0),
      todayPointsByType,
      weekPointsIssued,
      weekPointsDeduct,
      monthPointsIssued,
      monthPointsDeduct,
      totalSignIns: r_totalSignIns.count || 0,
      weekSignIns: r_weekSignIns.count || 0,
      totalPointsIssued,
      totalUsers: r_totalUsers.count || 0,
      totalTasks: r_totalTasks.count || 0,
      totalClaims: r_totalClaims.count || 0,
      blockedAccounts: r_blockedAll.count || 0,
      suspectedBlocked: r_suspected.count || 0,
      confirmedBlocked: r_confirmed.count || 0,
    }

    // 写入Redis缓存,30秒过期
    try {
      await redisClient?.set('admin:dashboard:stats', JSON.stringify(result), 'EX', 30)
    } catch(e) {}

    return result
  }


  /**
   * 获取趋势数据
   */
  async getTrendData(days = 7) {
    const cacheKey = `admin:dashboard:trend:${days}`
    try {
      const cached = await redisClient?.get(cacheKey)
      if (cached) return JSON.parse(cached)
    } catch(e) {}

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)
    
    const { data: claims } = await supabase
      .from('claims')
      .select('claimed_at, reviewed_at, reward, status')
      .or(`claimed_at.gte.${startDate.toISOString()},reviewed_at.gte.${startDate.toISOString()}`)
    
    const trendMap = new Map()
    for (let i = 0; i < days; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      trendMap.set(dateStr, { date: dateStr, claims: 0, completions: 0, pointsIssued: 0 })
    }
    
    for (const claim of (claims || [])) {
      if (claim.claimed_at) {
        const date = claim.claimed_at.split('T')[0]
        if (trendMap.has(date)) trendMap.get(date).claims++
      }
      if (claim.status === 'done' && claim.reviewed_at) {
        const date = claim.reviewed_at.split('T')[0]
        if (trendMap.has(date)) {
          trendMap.get(date).completions++
          trendMap.get(date).pointsIssued += claim.reward || 0
        }
      }
    }
    
    const result = Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date))
    try { await redisClient?.set(cacheKey, JSON.stringify(result), 'EX', 60) } catch(e) {}
    return result
  }

  /**
   * 获取用户列表
   */
      async getUsers(page = 1, size = 20, filters = {}) {
    const offset = (page - 1) * size
    
    // 构建基础查询
    let whereSql = '1=1'
    const params = []
    
    if (filters.role) {
      whereSql += ` AND role = ${params.length + 1}`
      params.push(filters.role)
    }
    if (filters.level) {
      whereSql += ` AND level = ${params.length + 1}`
      params.push(parseInt(filters.level))
    }
    if (filters.search) {
      whereSql += ` AND (username ILIKE ${params.length + 1} OR phone ILIKE ${params.length + 1})`
      params.push(`%${filters.search}%`)
    }

    // 查询总数 - 使用正确的 $queryRawUnsafe
    const countSql = `SELECT COUNT(*) as count FROM users WHERE ${whereSql}`
    const countResult = await prisma.$queryRawUnsafe(countSql, ...params)
    const total = Number(countResult[0]?.count || 0)

    // 查询用户列表
    const listSql = `SELECT id, username, phone, role, level, points, balance, 
             total_tasks, total_points, province, city, status, created_at
      FROM users 
      WHERE ${whereSql}
      ORDER BY created_at DESC
      LIMIT ${size} OFFSET ${offset}`
    const users = await prisma.$queryRawUnsafe(listSql, ...params)

    // 获取用户位置信息（从 claims 表）
    const userIds = users.map(u => u.id)
    let userCities = {}
    
    if (userIds.length > 0) {
      // 从 claims 获取最新位置
      const claims = await prisma.$queryRaw`
        SELECT DISTINCT ON (user_id) user_id, city, province
        FROM claims
        WHERE user_id = ANY(${userIds}::bigint[])
        ORDER BY user_id, claimed_at DESC
      `
      
      for (const claim of claims) {
        if (claim.city) {
          userCities[claim.user_id.toString()] = {
            city: claim.city,
            province: claim.province
          }
        }
      }
    }

    return {
      list: users.map(u => ({
        id: u.id.toString(),
        username: u.username,
        phone: u.phone || '',
        role: u.role,
        level: u.level || 1,
        points: Number(u.points || 0),
        balance: Number(u.balance || 0),
        totalTasks: Number(u.total_tasks || 0),
        totalPoints: Number(u.total_points || 0),
        province: u.province,
        city: u.city || userCities[u.id.toString()]?.city || null,
        status: u.status || 'active',
        createdAt: u.created_at,
        isWhitelist: false,
        isBlacklist: false,
        exposureLevel: 1,
        isOnline: false
      })),
      total,
      page,
      size
    }
  }

  /**
   * 获取用户列表（包含在线状态）
   */
  async getUsersWithOnlineStatus(page = 1, size = 20, filters = {}) {
    // 获取用户列表
    const result = await this.getUsers(page, size, filters)
    
    if (result.list.length === 0) {
      return result
    }
    
    // 批量检查在线状态
    const userIds = result.list.map(u => u.id)
    const onlineMap = await onlineUserService.batchCheckOnline(userIds)
    
    // 批量获取设备信息
    const devicesMap = await onlineUserService.batchGetUserDevices(userIds)
    
    // 更新在线状态和设备信息
    result.list = result.list.map(user => ({
      ...user,
      isOnline: onlineMap.get(user.id) || false,
      devices: devicesMap.get(user.id) || []
    }))
    
    return result
  }

  /**
   * 获取用户列表（包含在线状态）- 旧版保留兼容
   */
  async getUsersWithOnlineStatusOld(page = 1, size = 20, filters = {}) {
    // 如果有在线状态筛选，需要特殊处理
    if (filters.isOnline !== undefined) {
      // 先获取更多用户（或全部），然后根据在线状态筛选
      const pageSize = size * 5 // 获取更多用户以便筛选后有足够数据
      const result = await this.getUsers(1, pageSize, { ...filters, isOnline: undefined })
      
      if (result.list.length > 0) {
        const userIds = result.list.map(u => u.id)
        const onlineStatusMap = await onlineUserService.batchCheckOnline(userIds)
        
        // 更新在线状态并筛选
        const filteredList = result.list
          .map(user => ({
            ...user,
            isOnline: onlineStatusMap.get(user.id) || false
          }))
          .filter(user => user.isOnline === filters.isOnline)
        
        // 分页
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
    
    // 没有在线状态筛选，正常处理
    const result = await this.getUsers(page, size, filters)
    
    // 批量检查用户在线状态
    if (result.list.length > 0) {
      const userIds = result.list.map(u => u.id)
      const onlineStatusMap = await onlineUserService.batchCheckOnline(userIds)
      
      // 更新在线状态
      result.list = result.list.map(user => ({
        ...user,
        isOnline: onlineStatusMap.get(user.id) || false
      }))
    }
    
    return result
  }

  /**
   * 更新用户状态
   */
  async updateUserStatus(userId, status) {
    const { data: user, error } = await supabase
      .from('users')
      .update({ status: status ? 1 : 0 })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      throw new Error('更新用户状态失败')
    }
    
    logger.info(`管理员更新用户 ${userId} 状态为 ${status}`)
    return user
  }

  /**
   * 更新用户等级
   */
  async updateUserLevel(userId, level) {
    const { data: user, error } = await supabase
      .from('users')
      .update({ level })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      throw new Error('更新用户等级失败')
    }
    
    logger.info(`管理员更新用户 ${userId} 等级为 ${level}`)
    return user
  }

  /**
   * 更新用户角色
   */
  async updateUserRole(userId, role) {
    // 验证角色是否有效
    const validRoles = ['part_timer', 'client', 'reviewer', 'admin']
    if (!validRoles.includes(role)) {
      throw new Error('无效的角色类型')
    }

    const { data: user, error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      throw new Error('更新用户角色失败')
    }
    
    logger.info(`管理员更新用户 ${userId} 角色为 ${role}`)
    return user
  }

  /**
   * 调整用户积分（管理员专用）
   * @param userId 用户ID
   * @param amount 变化量（正数增加，负数减少）
   * @param reason 调整原因
   * @param adminId 管理员ID
   */
  async updateUserPoints(userId, amount, reason, adminId) {
    // 获取用户当前积分
    const { data: currentUser, error: fetchError } = await supabase
      .from('users')
      .select('id, username, points')
      .eq('id', userId)
      .single()

    if (fetchError || !currentUser) {
      throw new Error('用户不存在')
    }

    const oldPoints = currentUser.points
    const newPoints = Math.max(0, oldPoints + amount) // 确保积分不为负

    // 更新用户积分
    const { data: user, error } = await supabase
      .from('users')
      .update({ points: newPoints })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      throw new Error('更新用户积分失败')
    }
    
    // 记录积分变更日志
    const { error: logError } = await supabase
      .from('records')
      .insert({
        user_id: userId,
        type: 'admin_adjust',
        desc: `管理员调整积分: ${reason || '无原因'}`,
        points: amount,
        balance: 0,
        extra_data: JSON.stringify({ admin_id: Number(adminId), old_points: oldPoints, new_points: newPoints })
      })

    if (logError) {
      logger.warn(`积分日志记录失败: ${logError.message}`)
    }
    
    logger.info(`管理员 ${adminId} 调整用户 ${userId}(${currentUser.username}) 积分: ${oldPoints} -> ${newPoints} (${amount >= 0 ? '+' : ''}${amount}), 原因: ${reason || '无'}`)

    try {
      await notifyAdminPointsAdjusted(userId, {
        amount,
        reason,
        balance: newPoints,
      })
    } catch (notifyError) {
      logger.error(`发送管理员积分调整通知失败: 用户${userId}`, notifyError)
    }
    
    return {
      id: user.id,
      username: user.username,
      oldPoints,
      newPoints,
      change: amount
    }
  }

  /**
   * 调整用户余额（管理员专用）
   * @param userId 用户ID
   * @param amount 变化量（正数增加，负数减少）
   * @param reason 调整原因
   * @param adminId 管理员ID
   */
  async updateUserBalance(userId, amount, reason, adminId) {
    // 获取用户当前余额
    const { data: currentUser, error: fetchError } = await supabase
      .from('users')
      .select('id, username, balance')
      .eq('id', userId)
      .single()

    if (fetchError || !currentUser) {
      throw new Error('用户不存在')
    }

    const oldBalance = Number(currentUser.balance) || 0
    const newBalance = Math.max(0, oldBalance + amount) // 确保余额不为负

    // 更新用户余额
    const { data: user, error } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      throw new Error('更新用户余额失败')
    }
    
    // 记录余额变更日志
    const { error: logError } = await supabase
      .from('balance_logs')
      .insert({
        user_id: userId,
        admin_id: Number(adminId),
        old_balance: oldBalance,
        new_balance: newBalance,
        change: amount,
        type: 'admin_adjust',
        description: `管理员调整余额: ${reason || '无原因'}`,
        related_id: Number(adminId)
      })

    if (logError) {
      logger.warn(`余额日志记录失败: ${logError.message}`)
    }
    
    logger.info(`管理员 ${adminId} 调整用户 ${userId}(${currentUser.username}) 余额: ${oldBalance} -> ${newBalance} (${amount >= 0 ? '+' : ''}${amount}), 原因: ${reason || '无'}`)
    
    return {
      id: user.id,
      username: user.username,
      oldBalance,
      newBalance,
      change: amount
    }
  }

  /**
   * 获取所有角色
   */
  async getRoles() {
    const { data: roles, error } = await supabase
      .from('roles')
      .select('*')
      .order('id', { ascending: true })

    return roles || []
  }

  /**
   * 获取系统配置
   */
  async getSystemConfigs() {
    const { data: configs, error } = await supabase
      .from('system_configs')
      .select('*')
      .order('key', { ascending: true })

    return configs || []
  }

  /**
   * 更新系统配置
   */
  async updateSystemConfig(key, value) {
    const { data: config, error } = await supabase
      .from('system_configs')
      .update({ value })
      .eq('key', key)
      .select()
      .single()

    if (error) {
      throw new Error('更新系统配置失败')
    }
    
    logger.info(`管理员更新系统配置 ${key} = ${value}`)
    return config
  }

  /**
   * 获取任务列表（管理后台）
   */
  async getTasks(page = 1, size = 20, filters = {}) {
    const offset = (page - 1) * size
    
    let query = supabase
      .from('tasks')
      .select('*', { count: 'exact' })
    
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    if (filters.platform) {
      query = query.eq('platform', filters.platform)
    }

    const { data: tasks, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + size - 1)

    if (error) {
      logger.error('获取任务列表失败:', error)
      throw new Error('获取任务列表失败')
    }

    return {
      list: (tasks || []).map(t => ({
        id: t.id,
        title: t.title,
        platform: t.platform,
        action: t.action,
        videoUrl: t.video_url,
        description: t.description,
        templateImages: t.template_images,
        requirements: t.requirements,
        reward: t.reward,
        remain: t.remain,
        timeLimitMinutes: t.time_limit_minutes,
        cityLimit: t.city_limit,
        provinceLimit: t.province_limit,
        status: t.status,
        createdAt: t.created_at
      })),
      total: count || 0,
      page,
      size
    }
  }

  /**
   * 生成任务编号
   * 格式: TASK-YYYYMMDD-XXXX
   */
  async generateTaskCode() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
    
    // 获取今天的任务数量
    const count = await prisma.tasks.count({
      where: { createdAt: { gte: today } }
    })
    
    const seq = String((count || 0) + 1).padStart(4, '0')
    return `TASK-${dateStr}-${seq}`
  }

  /**
   * 创建任务（带完整追溯信息）
   * @param {Object} data - 任务数据
   * @param {number} publisherId - 发布者ID
   * @param {Object} operator - 操作者信息 {name, role, ip, location}
   */
  async createTask(data, publisherId, operator = {}) {
    const needCount = data.remain || 100
    
    // 生成任务编号
    const taskCode = await this.generateTaskCode()
    
    let task
    try {
      task = await prisma.tasks.create({
        data: {
          title: data.title,
          taskCode: taskCode,
          platform: data.platform || 'xiaohuangyu',
          action: data.action || 'default',
          videoUrl: data.videoUrl || null,
          description: data.description || '',
          templateImages: data.templateImages || '[]',
          exampleImages: JSON.stringify(data.exampleImages || []),
          requirements: data.requirements || '[]',
          reward: data.reward || 30,
          baseReward: data.reward || 30,
          remain: needCount,
          needCount: needCount,
          timeLimitMinutes: data.timeLimitMinutes || 10,
          cityLimit: data.cityLimit || 1,
          provinceLimit: data.provinceLimit || 4,
          status: data.status || 'active',
          publisherId: publisherId ? Number(publisherId.toString().slice(-9)) : null
        }
      })
    } catch (err) {
      logger.error('创建任务失败:', err)
      throw new Error('创建任务失败')
    }
    
    logger.info(`创建任务: ${task.taskCode} - ${task.title}, 发布者: ${operator.name || publisherId}`)
    
    // 创建任务快照
    try {
      const taskSnapshotService = (await import('./taskSnapshotService.js')).default
      await taskSnapshotService.createSnapshot(task.id, 'create', operator)
    } catch (err) {
      logger.warn('创建任务快照失败:', err.message)
    }
    
    // 记录操作日志
    try {
      const operationLogService = (await import('./operationLogService.js')).default
      await operationLogService.log({
        operatorId: publisherId,
        operatorName: operator.name || 'unknown',
        operatorRole: operator.role || 'unknown',
        action: 'create',
        targetType: 'task',
        targetId: task.id,
        targetName: task.title,
        oldValue: null,
        newValue: task.status,
        description: `创建任务: ${task.taskCode} - ${task.title}`,
        ipAddress: operator.ip,
        location: operator.location,
        userAgent: operator.userAgent
      })
    } catch (err) {
      logger.warn('记录操作日志失败:', err.message)
    }
    
    // 初始化曝光记录
    try {
      const exposureService = (await import('./exposureService.js')).default
      await exposureService.initTaskExposure(task.id, needCount)
    } catch (err) {
      logger.warn('初始化曝光记录失败:', err.message)
    }
    
    // 触发任务推送（异步，不阻塞响应）
    this.triggerTaskPush(task).catch(err => {
      logger.error('触发任务推送失败:', err.message)
    })
    
    return task
  }

  /**
   * 触发任务推送
   */
  async triggerTaskPush(task) {
    try {
      const pushService = (await import('./pushService.js')).default
      await pushService.onTaskCreated(task)
    } catch (err) {
      logger.error('推送任务失败:', err.message)
    }
  }

  /**
   * 更新任务（带追溯）
   * @param {number} taskId - 任务ID
   * @param {Object} data - 更新数据
   * @param {Object} operator - 操作者信息
   */
  async updateTask(taskId, data, operator = {}) {
    // 获取旧值用于日志
    const oldTasks = await prisma.$queryRaw`SELECT * FROM tasks WHERE id = ${taskId}`
    const oldTask = oldTasks?.[0]
    
    // 构建更新数据
    const now = new Date()
    const updateFields = []
    const updateValues = []
    let paramIndex = 1
    
    const addField = (fieldName, value) => {
      if (value !== undefined) {
        updateFields.push(`${fieldName} = $${paramIndex}`)
        updateValues.push(value)
        paramIndex++
      }
    }
    
    addField("title", data.title)
    addField("platform", data.platform)
    addField("action", data.action)
    addField("video_url", data.videoUrl)
    addField("description", data.description)
    addField("template_images", data.templateImages)
    addField("example_images", data.exampleImages ? JSON.stringify(data.exampleImages) : undefined)
    addField("requirements", data.requirements)
    addField("reward", data.reward)
    addField("remain", data.remain)
    addField("time_limit_minutes", data.timeLimitMinutes)
    addField("city_limit", data.cityLimit)
    addField("province_limit", data.provinceLimit)
    addField("status", data.status)
    
    if (updateFields.length > 0) {
      updateFields.push(`updated_at = $${paramIndex}`)
      updateValues.push(now)
      paramIndex++
      
      updateValues.push(taskId)
      
      const updateSql = `UPDATE tasks SET ${updateFields.join(", ")} WHERE id = $${paramIndex}`
      await prisma.$queryRawUnsafe(updateSql, ...updateValues)
    }
    
    // 获取更新后的任务
    const updatedTasks = await prisma.$queryRaw`SELECT * FROM tasks WHERE id = ${taskId}`
    const task = updatedTasks?.[0]
    
    if (!task) {
      throw new Error("更新任务失败")
    }
    
    logger.info(`更新任务: ${task.task_code || taskId} - ${task.title}`)
    
    // 创建任务快照
    try {
      const taskSnapshotService = (await import("./taskSnapshotService.js")).default
      await taskSnapshotService.createSnapshot(taskId, "update", operator)
    } catch (err) {
      logger.warn("创建任务快照失败:", err.message)
    }
    
    // 记录操作日志
    try {
      const operationLogService = (await import("./operationLogService.js")).default
      await operationLogService.log({
        operatorId: operator.id,
        operatorName: operator.name,
        operatorRole: operator.role,
        action: "update",
        targetType: "task",
        targetId: taskId,
        targetName: task.title,
        oldValue: oldTask?.status,
        newValue: task.status,
        description: `更新任务: ${task.task_code || taskId}`,
        ipAddress: operator.ip,
        location: operator.location,
        userAgent: operator.userAgent
      })
    } catch (err) {
      logger.warn("记录操作日志失败:", err.message)
    }
    
    return {
      id: task.id.toString(),
      title: task.title,
      taskCode: task.task_code,
      platform: task.platform,
      action: task.action,
      videoUrl: task.video_url,
      description: task.description,
      templateImages: task.template_images,
      exampleImages: typeof task.example_images === "string" ? JSON.parse(task.example_images || "[]") : (task.example_images || []),
      requirements: task.requirements,
      reward: Number(task.reward || 0),
      remain: Number(task.remain || 0),
      timeLimitMinutes: Number(task.time_limit_minutes || 15),
      cityLimit: Number(task.city_limit || 1),
      provinceLimit: Number(task.province_limit || 4),
      status: task.status,
      createdAt: task.created_at,
      updatedAt: task.updated_at
    }
  }


  async deleteTask(taskId, operator = {}) {
    const oldTasks = await prisma.$queryRaw`SELECT * FROM tasks WHERE id = ${taskId}`
    const oldTask = oldTasks?.[0]
    try {
      const taskSnapshotService = (await import("./taskSnapshotService.js")).default
      await taskSnapshotService.createSnapshot(taskId, "delete", operator)
    } catch (err) {
      logger.warn("创建删除快照失败:", err.message)
    }
    await prisma.$queryRaw`DELETE FROM claims WHERE task_id = ${taskId}`
    await prisma.$queryRaw`DELETE FROM tasks WHERE id = ${taskId}`
    logger.info("删除任务:", oldTask?.task_code || taskId, "-", oldTask?.title)
    try {
      const operationLogService = (await import("./operationLogService.js")).default
      await operationLogService.log({
        operatorId: operator.id,
        operatorName: operator.name,
        operatorRole: operator.role,
        action: "delete",
        targetType: "task",
        targetId: taskId,
        targetName: oldTask?.title,
        oldValue: oldTask?.status,
        newValue: null,
        description: "删除任务: " + (oldTask?.task_code || taskId) + " - " + oldTask?.title,
        ipAddress: operator.ip,
        location: operator.location,
        userAgent: operator.userAgent
      })
    } catch (err) {
      logger.warn("记录操作日志失败:", err.message)
    }
    return { success: true }
  }


  /**
   * 导出用户数据为CSV
   */
  async exportUsers(filters = {}) {
    let query = supabase
      .from('users')
      .select('id, username, phone, role, level, points, balance, total_tasks, total_points, status, created_at')
    
    if (filters.role) {
      query = query.eq('role', filters.role)
    }
    if (filters.level) {
      query = query.eq('level', parseInt(filters.level))
    }
    if (filters.status !== undefined) {
      query = query.eq('status', filters.status ? 1 : 0)
    }

    const { data: users, error } = await query.order('created_at', { ascending: false })

    if (error) {
      throw new Error('导出用户数据失败')
    }

    // 生成CSV
    const headers = ['ID', '用户名', '手机号', '角色', '等级', '积分', '余额', '完成任务数', '累计积分', '状态', '注册时间']
    const rows = (users || []).map(u => [
      u.id,
      u.username,
      u.phone || '',
      u.role,
      u.level,
      u.points,
      Number(u.balance).toFixed(2),
      u.total_tasks,
      u.total_points,
      u.status === 1 ? '正常' : '冻结',
      new Date(u.created_at).toLocaleString('zh-CN')
    ])

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    return csv
  }

  /**
   * 导出任务数据为CSV
   */
  async exportTasks(filters = {}) {
    let query = supabase
      .from('tasks')
      .select('*')
    
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    if (filters.platform) {
      query = query.eq('platform', filters.platform)
    }
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate)
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate + 'T23:59:59')
    }

    const { data: tasks, error } = await query.order('created_at', { ascending: false })

    if (error) {
      throw new Error('导出任务数据失败')
    }

    // 获取每个任务的统计数据
    const taskIds = (tasks || []).map(t => t.id)
    let statsMap = new Map()
    
    if (taskIds.length > 0) {
      const { data: claims } = await supabase
        .from('claims')
        .select('task_id, status')
        .in('task_id', taskIds)
      
      for (const claim of (claims || [])) {
        if (!statsMap.has(claim.task_id)) {
          statsMap.set(claim.task_id, { total: 0, done: 0, pending: 0, rejected: 0 })
        }
        const stats = statsMap.get(claim.task_id)
        stats.total++
        if (claim.status === 'done') stats.done++
        else if (claim.status === 'pending') stats.pending++
        else if (claim.status === 'rejected') stats.rejected++
      }
    }

    const statusLabels = {
      'active': '进行中',
      'paused': '已暂停',
      'closed': '已关闭',
      'pending_audit': '待审核'
    }

    const platformLabels = {
      [PLATFORMS.DOUYIN]: PLATFORM_NAMES[PLATFORMS.DOUYIN],
      [PLATFORMS.KUAISHOU]: PLATFORM_NAMES[PLATFORMS.KUAISHOU],
      [PLATFORMS.XIAOHONGSHU]: PLATFORM_NAMES[PLATFORMS.XIAOHONGSHU],
      [PLATFORMS.SHIPINHAO]: PLATFORM_NAMES[PLATFORMS.SHIPINHAO],
    }

    const headers = ['ID', '标题', '平台', '操作类型', '奖励积分', '剩余数量', '完成数', '待审核', '已拒绝', '状态', '创建时间']
    const rows = (tasks || []).map(t => {
      const stats = statsMap.get(t.id) || { total: 0, done: 0, pending: 0, rejected: 0 }
      return [
        t.id,
        t.title,
        platformLabels[t.platform] || t.platform,
        t.action,
        t.reward,
        t.remain,
        stats.done,
        stats.pending,
        stats.rejected,
        statusLabels[t.status] || t.status,
        new Date(t.created_at).toLocaleString('zh-CN')
      ]
    })

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    return csv
  }

  /**
   * 导出审核记录为CSV
   */
  async exportReviewClaims(filters = {}) {
    let query = supabase
      .from('claims')
      .select(`
        id,
        title,
        platform,
        action,
        reward,
        status,
        city,
        province,
        platform_nickname,
        claimed_at,
        submitted_at,
        reviewed_at,
        review_note,
        user_id,
        users (username)
      `)
      .in('status', ['done', 'rejected'])

    if (filters.startDate) {
      query = query.gte('reviewed_at', filters.startDate)
    }
    if (filters.endDate) {
      query = query.lte('reviewed_at', filters.endDate + 'T23:59:59')
    }
    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    const { data: claims, error } = await query.order('reviewed_at', { ascending: false })

    if (error) {
      throw new Error('导出审核记录失败')
    }

    const statusLabels = {
      'done': '已通过',
      'rejected': '已拒绝',
      'pending': '待审核',
      'doing': '进行中'
    }

    const platformLabels = {
      [PLATFORMS.DOUYIN]: PLATFORM_NAMES[PLATFORMS.DOUYIN],
      [PLATFORMS.KUAISHOU]: PLATFORM_NAMES[PLATFORMS.KUAISHOU],
      [PLATFORMS.XIAOHONGSHU]: PLATFORM_NAMES[PLATFORMS.XIAOHONGSHU],
      [PLATFORMS.SHIPINHAO]: PLATFORM_NAMES[PLATFORMS.SHIPINHAO],
    }

    const headers = ['ID', '用户', '任务标题', '平台', '奖励', '状态', '城市', '平台昵称', '领取时间', '提交时间', '审核时间', '审核备注']
    const rows = (claims || []).map(c => [
      c.id,
      c.users?.username || '',
      c.title,
      platformLabels[c.platform] || c.platform,
      c.reward,
      statusLabels[c.status] || c.status,
      c.city || '',
      c.platform_nickname || '',
      c.claimed_at ? new Date(c.claimed_at).toLocaleString('zh-CN') : '',
      c.submitted_at ? new Date(c.submitted_at).toLocaleString('zh-CN') : '',
      c.reviewed_at ? new Date(c.reviewed_at).toLocaleString('zh-CN') : '',
      (c.review_note || '').replace(/"/g, '""')
    ])

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    return csv
  }

  /**
   * 获取用户等级统计
   */
  async getUserLevelStats() {
    const users = await prisma.$queryRaw`
      SELECT level, COUNT(*) as count
      FROM users
      GROUP BY level
      ORDER BY level
    `
    
    return (users || []).map(u => ({
      level: Number(u.level || 1),
      count: Number(u.count || 0)
    }))
  }

  /**
   * 获取用户角色统计
   */
  async getUserRoleStats() {
    const users = await prisma.$queryRaw`
      SELECT role, COUNT(*) as count
      FROM users
      GROUP BY role
    `
    
    return (users || []).map(u => ({
      role: u.role || 'user',
      count: Number(u.count || 0)
    }))
  }

  /**
   * 获取日志概览统计
   */
  async getLogOverviewStats() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // 使用 Prisma ORM 而不是原始 SQL
    const todayOps = await prisma.operation_logs.count({
      where: { created_at: { gte: today } }
    })
    
    const todayLogins = await prisma.login_logs.count({
      where: { login_time: { gte: today } }
    })
    
    const totalOps = await prisma.operation_logs.count()
    const totalLogins = await prisma.login_logs.count()
    
    return {
      todayOperations: todayOps,
      todayLogins: todayLogins,
      totalOperations: totalOps,
      totalLogins: totalLogins
    }
  }
}

export default new AdminService()
