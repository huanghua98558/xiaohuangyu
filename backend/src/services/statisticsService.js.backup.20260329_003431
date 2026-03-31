import supabase from '../utils/supabaseToPrismaAdapter.js'
import db from '../config/database.js'
import logger from '../utils/logger.js'
import { CLAIM_STATUS, FINAL_APPROVED_STATUSES, PENDING_REVIEW_STATUSES } from '../constants/claimLifecycle.js'

/**
 * 统计分析服务
 */
class StatisticsService {
  /**
   * 获取概览统计
   */
  async getOverviewStats() {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStart = today.toISOString()

      // 本周开始（周一）
      const weekStart = new Date(today)
      const dayOfWeek = weekStart.getDay() || 7
      weekStart.setDate(weekStart.getDate() - dayOfWeek + 1)
      
      // 上周开始
      const lastWeekStart = new Date(weekStart)
      lastWeekStart.setDate(lastWeekStart.getDate() - 7)
      const lastWeekEnd = new Date(weekStart)
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 1)

      // 本月开始
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      
      // 上月开始
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const overview = await db.queryOne(
        `
        SELECT
          (SELECT COUNT(*)::int FROM operation_logs) AS total_operations,
          (SELECT COUNT(*)::int FROM operation_logs WHERE created_at >= $1::timestamp) AS today_operations,
          (SELECT COUNT(*)::int FROM audit_alerts) AS total_alerts,
          (SELECT COUNT(*)::int FROM audit_alerts WHERE COALESCE(is_resolved, false) = false) AS unhandled_alerts,
          (SELECT COUNT(*)::int FROM login_logs) AS total_logins,
          (SELECT COUNT(*)::int FROM login_logs WHERE login_time >= $1::timestamp) AS today_logins,
          (SELECT COUNT(*)::int FROM users) AS total_users,
          (SELECT COUNT(*)::int FROM users WHERE created_at >= $1::timestamp) AS today_new_users,
          (SELECT COUNT(*)::int FROM tasks) AS total_tasks,
          (SELECT COUNT(*)::int FROM tasks WHERE created_at >= $1::timestamp) AS today_tasks,
          (SELECT COUNT(*)::int FROM tasks WHERE status = 'active') AS active_tasks,
          (SELECT COUNT(*)::int FROM claims) AS total_claims,
          (SELECT COUNT(*)::int FROM claims WHERE claimed_at >= $1::timestamp) AS today_claims,
          (SELECT COUNT(*)::int FROM claims WHERE status = ANY($6::text[])) AS total_completed,
          (SELECT COUNT(*)::int FROM claims WHERE status = ANY($6::text[]) AND reviewed_at >= $1::timestamp) AS today_completed,
          (SELECT COUNT(*)::int FROM claims WHERE status = ANY($6::text[]) AND reviewed_at >= $2::timestamp) AS week_completed,
          (SELECT COUNT(*)::int FROM claims WHERE status = ANY($6::text[]) AND reviewed_at >= $3::timestamp AND reviewed_at < $2::timestamp) AS last_week_completed,
          (SELECT COUNT(*)::int FROM claims WHERE status = ANY($6::text[]) AND reviewed_at >= $4::timestamp) AS month_completed,
          (SELECT COUNT(*)::int FROM claims WHERE status = ANY($6::text[]) AND reviewed_at >= $5::timestamp AND reviewed_at < $4::timestamp) AS last_month_completed,
          (SELECT COUNT(*)::int FROM claims WHERE status = ANY($7::text[])) AS pending_claims
        `,
        [
          todayStart,
          weekStart.toISOString(),
          lastWeekStart.toISOString(),
          monthStart.toISOString(),
          lastMonthStart.toISOString(),
          FINAL_APPROVED_STATUSES,
          PENDING_REVIEW_STATUSES,
        ]
      )

      return {
        totalOperations: Number(overview?.total_operations || 0),
        todayOperations: Number(overview?.today_operations || 0),
        totalAlerts: Number(overview?.total_alerts || 0),
        unhandledAlerts: Number(overview?.unhandled_alerts || 0),
        totalLogins: Number(overview?.total_logins || 0),
        todayLogins: Number(overview?.today_logins || 0),
        totalUsers: Number(overview?.total_users || 0),
        todayNewUsers: Number(overview?.today_new_users || 0),
        totalTasks: Number(overview?.total_tasks || 0),
        todayTasks: Number(overview?.today_tasks || 0),
        activeTasks: Number(overview?.active_tasks || 0),
        totalClaims: Number(overview?.total_claims || 0),
        todayClaims: Number(overview?.today_claims || 0),
        pendingClaims: Number(overview?.pending_claims || 0),
        // 完成统计
        totalCompleted: Number(overview?.total_completed || 0),
        todayCompleted: Number(overview?.today_completed || 0),
        weekCompleted: Number(overview?.week_completed || 0),
        lastWeekCompleted: Number(overview?.last_week_completed || 0),
        monthCompleted: Number(overview?.month_completed || 0),
        lastMonthCompleted: Number(overview?.last_month_completed || 0),
      }
    } catch (error) {
      logger.error('获取概览统计失败:', error)
      throw error
    }
  }

  /**
   * 获取审核员绩效统计
   */
  async getReviewerStats(options = {}) {
    const { startDate, endDate, sortBy = 'total_reviews', sortOrder = 'desc' } = options
    
    try {
      // 构建基础查询 - 从claims表获取审核记录
      let query = supabase
        .from('claims')
        .select('reviewer_id, status, reviewed_at')
        .not('reviewer_id', 'is', null)
        .in('status', [CLAIM_STATUS.APPROVED, CLAIM_STATUS.DONE, CLAIM_STATUS.REJECTED, CLAIM_STATUS.IMAGE_REJECTED, CLAIM_STATUS.LINK_REJECTED, CLAIM_STATUS.RELEASED])

      // 时间范围筛选
      if (startDate) {
        query = query.gte('reviewed_at', new Date(startDate).toISOString())
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        query = query.lte('reviewed_at', end.toISOString())
      }

      const { data: claims, error } = await query

      if (error) {
        logger.error('查询审核记录失败:', error)
        return []
      }

      // 获取所有审核员ID
      const reviewerIds = [...new Set((claims || []).map(c => c.reviewer_id).filter(Boolean))]
      
      // 查询审核员信息
      let reviewerMap = new Map()
      if (reviewerIds.length > 0) {
        const { data: reviewers } = await supabase
          .from('users')
          .select('id, username, name')
          .in('id', reviewerIds)
        
        ;(reviewers || []).forEach(r => {
          reviewerMap.set(r.id, r.name || r.username || `用户${r.id}`)
        })
      }

      // 按审核员分组统计
      const statsMap = new Map()

      for (const claim of claims || []) {
        const reviewerId = claim.reviewer_id
        if (!reviewerId) continue

        if (!statsMap.has(reviewerId)) {
          statsMap.set(reviewerId, {
            reviewer_id: reviewerId,
            reviewer_name: reviewerMap.get(reviewerId) || `用户${reviewerId}`,
            total_reviews: 0,
            approved: 0,
            rejected: 0,
            review_times: []
          })
        }

        const stats = statsMap.get(reviewerId)
        stats.total_reviews++
        
        if (claim.status === 'done') {
          stats.approved++
        } else if (claim.status === 'rejected') {
          stats.rejected++
        }

        if (claim.reviewed_at) {
          stats.review_times.push(new Date(claim.reviewed_at))
        }
      }

      // 计算通过率和平均审核时间
      const result = Array.from(statsMap.values()).map(stats => {
        const approvalRate = stats.total_reviews > 0 
          ? Math.round((stats.approved / stats.total_reviews) * 100) 
          : 0

        // 计算平均审核时间（简化版：基于审核记录的时间间隔）
        let avgReviewTime = 0
        if (stats.review_times.length > 1) {
          stats.review_times.sort((a, b) => a - b)
          let totalTime = 0
          for (let i = 1; i < stats.review_times.length; i++) {
            totalTime += stats.review_times[i] - stats.review_times[i - 1]
          }
          avgReviewTime = totalTime / (stats.review_times.length - 1) / 1000 / 60 // 转换为分钟
        }

        return {
          reviewer_id: stats.reviewer_id,
          reviewer_name: stats.reviewer_name,
          total_reviews: stats.total_reviews,
          approved: stats.approved,
          rejected: stats.rejected,
          approval_rate: approvalRate,
          avg_review_time: avgReviewTime
        }
      })

      // 排序
      result.sort((a, b) => {
        const aVal = a[sortBy] || 0
        const bVal = b[sortBy] || 0
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal
      })

      return result
    } catch (error) {
      logger.error('获取审核员统计失败:', error)
      throw error
    }
  }

  /**
   * 获取发布者任务质量统计
   */
  async getPublisherStats(options = {}) {
    const { startDate, endDate, sortBy = 'total_tasks', sortOrder = 'desc' } = options
    
    try {
      // 构建基础查询 - 从tasks表获取任务记录
      let query = supabase
        .from('tasks')
        .select('id, publisher_id, status, need_count')

      // 时间范围筛选
      if (startDate) {
        query = query.gte('created_at', new Date(startDate).toISOString())
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        query = query.lte('created_at', end.toISOString())
      }

      const { data: tasks, error: tasksError } = await query

      if (tasksError) {
        logger.error('查询任务记录失败:', tasksError)
        return []
      }

      // 获取所有发布者ID
      const publisherIds = [...new Set((tasks || []).map(t => t.publisher_id).filter(Boolean))]
      
      // 查询发布者信息
      let publisherMap = new Map()
      if (publisherIds.length > 0) {
        const { data: publishers } = await supabase
          .from('users')
          .select('id, username, name')
          .in('id', publisherIds)
        
        ;(publishers || []).forEach(p => {
          publisherMap.set(p.id, p.name || p.username || `用户${p.id}`)
        })
      }

      // 获取所有任务的领取记录
      const taskIds = (tasks || []).map(t => t.id)
      let claimsData = []
      
      if (taskIds.length > 0) {
        const { data } = await supabase
          .from('claims')
          .select('task_id, status')
          .in('task_id', taskIds)
        claimsData = data || []
      }

      // 统计每个任务的领取情况
      const taskClaimStats = new Map()
      for (const claim of claimsData) {
        if (!taskClaimStats.has(claim.task_id)) {
          taskClaimStats.set(claim.task_id, { total: 0, completed: 0 })
        }
        const stats = taskClaimStats.get(claim.task_id)
        stats.total++
        if (claim.status === 'done') {
          stats.completed++
        }
      }

      // 按发布者分组统计
      const statsMap = new Map()

      for (const task of tasks || []) {
        const publisherId = task.publisher_id
        if (!publisherId) continue

        if (!statsMap.has(publisherId)) {
          statsMap.set(publisherId, {
            publisher_id: publisherId,
            publisher_name: publisherMap.get(publisherId) || `用户${publisherId}`,
            total_tasks: 0,
            active_tasks: 0,
            total_claims: 0,
            completed_claims: 0,
            total_needed: 0
          })
        }

        const stats = statsMap.get(publisherId)
        stats.total_tasks++
        
        if (task.status === 'active') {
          stats.active_tasks++
        }

        const claimStats = taskClaimStats.get(task.id) || { total: 0, completed: 0 }
        stats.total_claims += claimStats.total
        stats.completed_claims += claimStats.completed
        stats.total_needed += task.need_count || 0
      }

      // 计算完成率和平均评分
      const result = Array.from(statsMap.values()).map(stats => {
        const completionRate = stats.total_claims > 0 
          ? Math.round((stats.completed_claims / stats.total_claims) * 100) 
          : 0

        // 平均评分暂时用完成率来模拟（实际项目中可以添加评分表）
        const avgRating = completionRate / 20 // 转换为1-5分

        return {
          publisher_id: stats.publisher_id,
          publisher_name: stats.publisher_name,
          total_tasks: stats.total_tasks,
          active_tasks: stats.active_tasks,
          total_claims: stats.total_claims,
          completion_rate: completionRate,
          avg_rating: Math.min(5, avgRating).toFixed(1)
        }
      })

      // 排序
      result.sort((a, b) => {
        let aVal = a[sortBy]
        let bVal = b[sortBy]
        
        // 字符串转数字
        if (sortBy === 'avg_rating') {
          aVal = parseFloat(aVal) || 0
          bVal = parseFloat(bVal) || 0
        }
        
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal
      })

      return result
    } catch (error) {
      logger.error('获取发布者统计失败:', error)
      throw error
    }
  }

  /**
   * 获取趋势数据
   */
  async getTrendData(days = 7) {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      startDate.setHours(0, 0, 0, 0)

      const { data: operations } = await supabase
        .from('operation_logs')
        .select('created_at')
        .gte('created_at', startDate.toISOString())

      const { data: logins } = await supabase
        .from('login_logs')
        .select('created_at')
        .gte('created_at', startDate.toISOString())

      const { data: claims } = await supabase
        .from('claims')
        .select('claimed_at, status')
        .gte('claimed_at', startDate.toISOString())

      // 按日期分组
      const dateMap = new Map()
      
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate)
        date.setDate(date.getDate() + i)
        const dateStr = date.toISOString().split('T')[0]
        dateMap.set(dateStr, {
          date: dateStr,
          operations: 0,
          logins: 0,
          claims: 0,
          completions: 0
        })
      }

      // 统计操作
      for (const op of operations || []) {
        const dateStr = op.created_at?.split('T')[0]
        if (dateMap.has(dateStr)) {
          dateMap.get(dateStr).operations++
        }
      }

      // 统计登录
      for (const login of logins || []) {
        const dateStr = login.created_at?.split('T')[0]
        if (dateMap.has(dateStr)) {
          dateMap.get(dateStr).logins++
        }
      }

      // 统计领取和完成
      for (const claim of claims || []) {
        const dateStr = claim.claimed_at?.split('T')[0]
        if (dateMap.has(dateStr)) {
          dateMap.get(dateStr).claims++
          if (claim.status === 'done') {
            dateMap.get(dateStr).completions++
          }
        }
      }

      return Array.from(dateMap.values())
    } catch (error) {
      logger.error('获取趋势数据失败:', error)
      throw error
    }
  }
}

export default new StatisticsService()
