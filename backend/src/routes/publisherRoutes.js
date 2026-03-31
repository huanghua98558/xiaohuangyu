import { Router } from 'express'
import supabase from '../utils/supabaseToPrismaAdapter.js'
import { authMiddleware, adminOrReviewer, publisherOrAdmin } from '../middlewares/auth.js'
import { success, error } from '../utils/response.js'
import logger from '../utils/logger.js'
import pointsSettlementService from '../services/pointsSettlementService.js'

const router = Router()

// 所有接口都需要登录
router.use(authMiddleware)

/**
 * 获取我发布的任务列表
 * 返回任务编号、发布者信息等完整追溯信息
 */
router.get('/my-tasks', publisherOrAdmin, async (req, res, next) => {
  try {
    const { page = 1, size = 20, status } = req.query
    const offset = (parseInt(page) - 1) * parseInt(size)
    
    let query = supabase
      .from('tasks')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (req.userRole !== 'admin') {
      query = query.eq('publisher_id', req.userId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: tasks, count, error: dbError } = await query
      .range(offset, offset + parseInt(size) - 1)

    if (dbError) throw dbError

    let publisherNameMap = {}
    if (req.userRole === 'admin') {
      const ids = [...new Set((tasks || []).map((x) => x.publisher_id).filter(Boolean))]
      if (ids.length > 0) {
        const { data: plist } = await supabase.from('users').select('id, username').in('id', ids)
        plist?.forEach((u) => {
          publisherNameMap[u.id] = u.username
        })
      }
    }

    const { data: publisher } = await supabase
      .from('users')
      .select('id, username')
      .eq('id', req.userId)
      .single()

    const taskIds = (tasks || []).map(t => t.id)
    let claimsStats = {}

    if (taskIds.length > 0) {
      const { data: claims } = await supabase
        .from('claims')
        .select('task_id, status')
        .in('task_id', taskIds)

      claims?.forEach(c => {
        if (!claimsStats[c.task_id]) {
          claimsStats[c.task_id] = { total: 0, pending: 0, done: 0, rejected: 0 }
        }
        claimsStats[c.task_id].total++
        if (c.status === 'pending') claimsStats[c.task_id].pending++
        if (c.status === 'done') claimsStats[c.task_id].done++
        if (c.status === 'rejected') claimsStats[c.task_id].rejected++
      })
    }

    const tasksWithStats = (tasks || []).map(t => ({
      ...t,
      publisher_name:
        req.userRole === 'admin'
          ? (publisherNameMap[t.publisher_id] || '未知')
          : (publisher?.username || '未知'),
      claimsStats: claimsStats[t.id] || { total: 0, pending: 0, done: 0, rejected: 0 }
    }))
    
    success(res, {
      list: tasksWithStats,
      total: count || 0,
      page: parseInt(page),
      size: parseInt(size)
    })
  } catch (err) {
    next(err)
  }
})

/**
 * 获取我发布任务的领取列表
 */
router.get('/my-claims', publisherOrAdmin, async (req, res, next) => {
  try {
    const { page = 1, size = 20, status, taskId } = req.query
    const offset = (parseInt(page) - 1) * parseInt(size)
    
    // 先获取我发布的任务ID
    const { data: myTasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('publisher_id', req.userId)
    
    const myTaskIds = (myTasks || []).map(t => t.id)
    
    if (myTaskIds.length === 0) {
      return success(res, {
        list: [],
        total: 0,
        page: parseInt(page),
        size: parseInt(size)
      })
    }
    
    let query = supabase
      .from('claims')
      .select('*', { count: 'exact' })
      .in('task_id', myTaskIds)
      .order('claimed_at', { ascending: false })
    
    if (status) {
      query = query.eq('status', status)
    }
    
    if (taskId) {
      query = query.eq('task_id', parseInt(taskId))
    }
    
    const { data: claims, count, error: dbError } = await query
      .range(offset, offset + parseInt(size) - 1)
    
    if (dbError) throw dbError
    
    // 获取任务信息
    const claimTaskIds = [...new Set((claims || []).map(c => c.task_id).filter(Boolean))]
    let tasks = {}
    if (claimTaskIds.length > 0) {
      const { data: taskList } = await supabase
        .from('tasks')
        .select('id, title, platform, action, base_reward')
        .in('id', claimTaskIds)
      taskList?.forEach(t => { tasks[t.id] = t })
    }
    
    // 获取用户信息
    const userIds = [...new Set((claims || []).map(c => c.user_id).filter(Boolean))]
    let users = {}
    if (userIds.length > 0) {
      const { data: userList } = await supabase
        .from('users')
        .select('id, username')
        .in('id', userIds)
      userList?.forEach(u => { users[u.id] = u })
    }
    
    // 组合数据
    const claimsWithInfo = (claims || []).map(c => ({
      ...c,
      tasks: tasks[c.task_id] || null,
      users: users[c.user_id] || null
    }))
    
    success(res, {
      list: claimsWithInfo,
      total: count || 0,
      page: parseInt(page),
      size: parseInt(size)
    })
  } catch (err) {
    next(err)
  }
})

/**
 * 获取待审核的领取列表（审核员专用）
 * 返回任务编号等完整信息
 */
router.get('/pending-review', adminOrReviewer, async (req, res, next) => {
  try {
    const { page = 1, size = 20 } = req.query
    const offset = (parseInt(page) - 1) * parseInt(size)
    
    const { data: claims, count, error: dbError } = await supabase
      .from('claims')
      .select('*', { count: 'exact' })
      .eq('status', 'pending')
      .order('submitted_at', { ascending: true })
      .range(offset, offset + parseInt(size) - 1)
    
    if (dbError) throw dbError
    
    // 获取任务信息
    const taskIds = [...new Set((claims || []).map(c => c.task_id).filter(Boolean))]
    let tasks = {}
    if (taskIds.length > 0) {
      const { data: taskList } = await supabase
        .from('tasks')
        .select('id, title, task_code, platform, action, base_reward, publisher_id')
        .in('id', taskIds)
      taskList?.forEach(t => { tasks[t.id] = t })
    }
    
    // 获取用户信息
    const userIds = [...new Set((claims || []).map(c => c.user_id).filter(Boolean))]
    let users = {}
    if (userIds.length > 0) {
      const { data: userList } = await supabase
        .from('users')
        .select('id, username')
        .in('id', userIds)
      userList?.forEach(u => { users[u.id] = u })
    }
    
    // 获取发布者信息
    const publisherIds = [...new Set(Object.values(tasks).map(t => t.publisher_id).filter(Boolean))]
    let publishers = {}
    if (publisherIds.length > 0) {
      const { data: publisherList } = await supabase
        .from('users')
        .select('id, username')
        .in('id', publisherIds)
      publisherList?.forEach(p => { publishers[p.id] = p.username })
    }
    
    // 组合数据
    const claimsWithPublisher = (claims || []).map(c => ({
      ...c,
      tasks: tasks[c.task_id] || null,
      users: users[c.user_id] || null,
      publisher_name: publishers[tasks[c.task_id]?.publisher_id] || '未知'
    }))
    
    success(res, {
      list: claimsWithPublisher,
      total: count || 0,
      page: parseInt(page),
      size: parseInt(size)
    })
  } catch (err) {
    next(err)
  }
})

/**
 * 获取已审核的领取列表（审核员专用）
 * 权限说明：
 * - 管理员：可以看到所有已审核的记录
 * - 审核员：只能看到自己审核过的记录
 */
router.get('/reviewed', adminOrReviewer, async (req, res, next) => {
  try {
    const { page = 1, size = 20 } = req.query
    const offset = (parseInt(page) - 1) * parseInt(size)
    
    let query = supabase
      .from('claims')
      .select('*', { count: 'exact' })
      .in('status', ['done', 'rejected'])
    
    // 审核员只能看自己审核的记录
    if (req.userRole === 'reviewer') {
      query = query.eq('reviewer_id', req.userId)
    }
    
    const { data: claims, count, error: dbError } = await query
      .order('reviewed_at', { ascending: false })
      .range(offset, offset + parseInt(size) - 1)
    
    if (dbError) throw dbError
    
    // 获取任务信息
    const taskIds = [...new Set((claims || []).map(c => c.task_id).filter(Boolean))]
    let tasks = {}
    if (taskIds.length > 0) {
      const { data: taskList } = await supabase
        .from('tasks')
        .select('id, title, platform, action, base_reward, task_code')
        .in('id', taskIds)
      taskList?.forEach(t => { tasks[t.id] = t })
    }
    
    // 获取用户信息
    const userIds = [...new Set((claims || []).map(c => c.user_id).filter(Boolean))]
    let users = {}
    if (userIds.length > 0) {
      const { data: userList } = await supabase
        .from('users')
        .select('id, username')
        .in('id', userIds)
      userList?.forEach(u => { users[u.id] = u })
    }
    
    // 获取审核者信息
    const reviewerIds = [...new Set((claims || []).map(c => c.reviewer_id).filter(Boolean))]
    let reviewers = {}
    if (reviewerIds.length > 0) {
      const { data: reviewerList } = await supabase
        .from('users')
        .select('id, username')
        .in('id', reviewerIds)
      reviewerList?.forEach(r => { reviewers[r.id] = r.username })
    }
    
    // 组合数据
    const claimsWithInfo = (claims || []).map(c => ({
      ...c,
      tasks: tasks[c.task_id] || null,
      users: users[c.user_id] || null,
      reviewer_name: reviewers[c.reviewer_id] || null
    }))
    
    success(res, {
      list: claimsWithInfo,
      total: count || 0,
      page: parseInt(page),
      size: parseInt(size)
    })
  } catch (err) {
    next(err)
  }
})

/**
 * 审核任务领取（审核员专用）
 * 记录完整追溯信息
 */
router.post('/review/:claimId', adminOrReviewer, async (req, res, next) => {
  try {
    const claimId = parseInt(req.params.claimId)
    const { action, note } = req.body // action: 'approve' 或 'reject'
    
    if (!['approve', 'reject'].includes(action)) {
      return error(res, '无效的审核操作')
    }
    
    // 获取领取记录
    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select('*')
      .eq('id', claimId)
      .single()
    
    if (claimError || !claim) {
      return error(res, '领取记录不存在')
    }
    
    if (claim.status !== 'pending') {
      return error(res, '该任务不在待审核状态')
    }
    
    // 获取任务信息
    const { data: task } = await supabase
      .from('tasks')
      .select('base_reward, title, task_code')
      .eq('id', claim.task_id)
      .single()
    
    const newStatus = action === 'approve' ? 'done' : 'rejected'
    
    // 获取审核者信息
    const ipLocation = await import('../utils/ipLocation.js')
    const locationInfo = await ipLocation.getRequestLocation(req)
    
    // 获取审核者用户名
    const { data: reviewer } = await supabase
      .from('users')
      .select('username')
      .eq('id', req.userId)
      .single()
    
    // 更新领取状态（包含追溯信息）
    const { error: updateError } = await supabase
      .from('claims')
      .update({
        status: newStatus,
        reviewed_at: new Date().toISOString(),
        reviewer_id: req.userId,
        review_note: note || null,
        reviewer_ip: locationInfo.ip,
        reviewer_location: locationInfo.location
      })
      .eq('id', claimId)
    
    if (updateError) throw updateError
    
    let settlementResult = null

    // 如果通过审核，统一结算积分
    if (action === 'approve') {
      settlementResult = await pointsSettlementService.awardClaimPoints({
        claimId,
        userId: claim.user_id,
        taskId: claim.task_id,
        awardReason: '人工审核通过',
        source: 'publisher_manual_review'
      })
    }
    
    // 记录操作日志
    try {
      const operationLogService = (await import('../services/operationLogService.js')).default
      await operationLogService.log({
        operatorId: req.userId,
        operatorName: reviewer?.username || 'unknown',
        operatorRole: req.userRole,
        action: action,
        targetType: 'claim',
        targetId: claimId,
        targetName: task?.title || claim.title,
        oldValue: 'pending',
        newValue: newStatus,
        description: `${action === 'approve' ? '通过' : '拒绝'}任务领取: ${task?.task_code || claim.task_id}`,
        ipAddress: locationInfo.ip,
        location: locationInfo.location,
        userAgent: req.headers['user-agent']
      })
    } catch (logErr) {
      logger.warn('记录审核日志失败:', logErr.message)
    }
    
    logger.info(`审核员 ${req.userId} ${action === 'approve' ? '通过' : '拒绝'}了任务领取 ${claimId} @ ${locationInfo.location}`)
    
    success(res, {
      claimId,
      status: newStatus,
      pointsAwarded: settlementResult?.finalPoints || 0,
      message: action === 'approve'
        ? `审核通过，积分已发放${settlementResult?.finalPoints ? ` (+${settlementResult.finalPoints})` : ''}`
        : '已拒绝'
    })
  } catch (err) {
    next(err)
  }
})

/**
 * 获取领取详情
 */
router.get('/claim/:claimId', publisherOrAdmin, async (req, res, next) => {
  try {
    const claimId = parseInt(req.params.claimId)
    
    const { data: claim, error } = await supabase
      .from('claims')
      .select(`
        *,
        tasks(id, title, task_code, platform, action, base_reward, publisher_id, status),
        users(id, username, phone)
      `)
      .eq('id', claimId)
      .single()
    
    if (error) throw error
    
    // 验证权限：发布者只能查看自己任务的领取
    if (req.userRole !== 'admin' && req.userRole !== 'reviewer') {
      if (claim.tasks?.publisher_id !== req.userId) {
        return error(res, '无权查看此领取记录', 403)
      }
    }
    
    // 解析截图JSON
    if (claim && typeof claim.screenshots === 'string') {
      try {
        claim.screenshots = JSON.parse(claim.screenshots)
      } catch (e) {
        claim.screenshots = []
      }
    }
    
    success(res, claim)
  } catch (err) {
    next(err)
  }
})

export default router
