import prisma from '../utils/prisma.js'

/**
 * 系统日志服务 - 统一管理所有日志类型
 * 使用 Prisma 连接 CockroachDB
 */
class SystemLogService {
  
  // 日志保留配置（天数）
  RETENTION_CONFIG = {
    operation_logs: 90,
    login_logs: 90,
    error_logs: 30,
    debug_logs: 7,
    info_logs: 30,
  }

  /**
   * 获取操作日志
   */
  async getOperationLogs(params = {}) {
    const { page = 1, size = 20, startDate, endDate, action, targetType, operatorRole } = params
    const offset = (page - 1) * size
    
    let whereClause = 'WHERE 1=1'
    const params_list = []
    
    if (action) {
      whereClause += ` AND action = $${params_list.length + 1}`
      params_list.push(action)
    }
    
    if (targetType) {
      whereClause += ` AND target_type = $${params_list.length + 1}`
      params_list.push(targetType)
    }
    
    if (operatorRole) {
      whereClause += ` AND operator_role = $${params_list.length + 1}`
      params_list.push(operatorRole)
    }
    
    if (startDate) {
      whereClause += ` AND created_at >= $${params_list.length + 1}`
      params_list.push(startDate)
    }
    
    if (endDate) {
      whereClause += ` AND created_at <= $${params_list.length + 1}`
      params_list.push(endDate + 'T23:59:59')
    }
    
    // 获取总数
    const countResult = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM operation_logs ${whereClause}`,
      ...params_list
    )
    const total = Number(countResult[0]?.count || 0)
    
    // 获取列表
    const logs = await prisma.$queryRawUnsafe(
      `SELECT * FROM operation_logs ${whereClause} ORDER BY created_at DESC LIMIT $${params_list.length + 1} OFFSET $${params_list.length + 2}`,
      ...params_list, size, offset
    )
    
    return {
      list: (logs || []).map(log => ({
        id: log.id?.toString(),
        adminId: log.admin_id?.toString(),
        adminName: log.admin_name,
        operatorRole: log.operator_role,
        action: log.action,
        targetType: log.target_type,
        targetId: log.target_id?.toString(),
        targetName: log.target_name,
        description: log.description,
        ipAddress: log.ip_address,
        createdAt: log.created_at
      })),
      total,
      page,
      size
    }
  }

  /**
   * 获取登录日志
   */
async getLoginLogs(params = {}) {
    const { page = 1, size = 20, startDate, endDate, keyword, loginStatus, isAnomaly } = params
    const skip = (page - 1) * size

    const where = {}
    if (loginStatus) where.login_status = loginStatus
    if (isAnomaly !== undefined && isAnomaly !== 'all') {
      where.is_anomaly = isAnomaly === 'true' || isAnomaly === true
    }
    if (startDate || endDate) {
      where.login_time = {}
      if (startDate) where.login_time.gte = new Date(startDate)
      if (endDate) where.login_time.lte = new Date(endDate)
    }

    const [list, total] = await Promise.all([
      prisma.login_logs.findMany({
        where,
        skip,
        take: size,
        orderBy: { login_time: 'desc' }
      }),
      prisma.login_logs.count({ where })
    ])

    return {
      list: list.map(item => ({
        id: item.id?.toString(),
        userId: item.user_id?.toString(),
        username: item.username,
        loginStatus: item.login_status,
        failureReason: item.failure_reason,
        ipAddress: item.ip_address,
        location: item.location,
        device: item.device,
        userAgent: item.user_agent,
        loginTime: item.login_time,
        logoutTime: item.logout_time,
        isAnomaly: item.is_anomaly,
        anomalyReason: item.anomaly_reason,
      })),
      total,
      page,
      size,
      type: 'login'
    }
  }

  /**
   * 获取审核日志
   */
  async getReviewLogs(params = {}) {
    const { page = 1, size = 20, startDate, endDate, status, reviewerId } = params
    const skip = (page - 1) * size

    const where = {}
    if (status) {
      where.action = status === 'done' ? 'approve' : (status === 'rejected' ? 'reject' : status)
    }
    if (reviewerId) where.reviewer_id = BigInt(reviewerId)
    if (startDate || endDate) {
      where.created_at = {}
      if (startDate) where.created_at.gte = new Date(startDate)
      if (endDate) where.created_at.lte = new Date(endDate)
    }

    const [list, total] = await Promise.all([
      prisma.task_review_logs.findMany({
        where,
        skip,
        take: size,
        orderBy: { created_at: 'desc' }
      }),
      prisma.task_review_logs.count({ where })
    ])

    return {
      list: list.map(item => ({
        id: item.id?.toString(),
        taskId: item.task_id?.toString(),
        claimId: item.claim_id?.toString(),
        userId: item.user_id?.toString(),
        reviewerId: item.reviewer_id?.toString(),
        status: item.action === 'approve' ? 'done' : (item.action === 'reject' ? 'rejected' : item.action),
        reviewedAt: item.created_at,
        reviewNote: item.note,
        isAiReview: item.ai_reviewed
      })),
      total,
      page,
      size,
      type: 'review'
    }
  }

  /**
   * 获取系统错误日志
   */
  async getErrorLogs(params = {}) {
    const { page = 1, size = 20, startDate, endDate, level, keyword } = params
    const skip = (page - 1) * size

    const where = {}
    if (level) where.level = level
    if (startDate || endDate) {
      where.created_at = {}
      if (startDate) where.created_at.gte = new Date(startDate)
      if (endDate) where.created_at.lte = new Date(endDate)
    }

    const [list, total] = await Promise.all([
      prisma.system_logs.findMany({
        where,
        skip,
        take: size,
        orderBy: { created_at: 'desc' }
      }),
      prisma.system_logs.count({ where })
    ])

    return {
      list: list.map(item => ({
        id: item.id?.toString(),
        level: item.level,
        type: item.type,
        message: item.message,
        context: item.context,
        userId: item.user_id?.toString(),
        username: item.username,
        ipAddress: item.ip_address,
        createdAt: item.created_at
      })),
      total,
      page,
      size,
      type: 'error'
    }
  }

  /**
   * 获取日志统计概览
   */
  async getStatsOverview() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [
      operationCount,
      loginCount,
      todayLoginCount,
      reviewCount,
      anomalyCount
    ] = await Promise.all([
      prisma.operation_logs.count(),
      prisma.login_logs.count(),
      prisma.login_logs.count({ where: { login_time: { gte: today } } }),
      prisma.task_review_logs.count({ where: { created_at: { gte: weekAgo } } }),
      prisma.login_logs.count({ where: { is_anomaly: true } })
    ])

    return {
      totalLogs: operationCount + loginCount,
      operationLogs: operationCount,
      loginLogs: loginCount,
      todayLogins: todayLoginCount,
      weekReviews: reviewCount,
      anomalyLogins: anomalyCount,
      errorLogs: 0
    }
  }

  /**
   * 根据类型获取日志
   */
  async getLogsByType(logType, params = {}) {
    switch (logType) {
      case 'operation':
        return this.getOperationLogs(params)
      case 'login':
        return this.getLoginLogs(params)
      case 'review':
        return this.getReviewLogs(params)
      case 'error':
        return this.getErrorLogs(params)
      default:
        throw new Error('未知的日志类型: ' + logType)
    }
  }

  /**
   * 清理过期日志
   */
  async cleanExpiredLogs(logType) {
    const retentionDays = this.RETENTION_CONFIG[logType] || 30
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

    let result = { deleted: 0 }
    
    switch (logType) {
      case 'operation_logs':
        result.deleted = (
          await prisma.operation_logs.deleteMany({
            where: { created_at: { lt: cutoffDate } }
          })
        ).count
        break
      case 'login_logs':
        result.deleted = (
          await prisma.login_logs.deleteMany({
            where: { login_time: { lt: cutoffDate } }
          })
        ).count
        break
      case 'error_logs':
      case 'debug_logs':
      case 'info_logs':
        result.deleted = (
          await prisma.system_logs.deleteMany({
            where: {
              created_at: { lt: cutoffDate },
              ...(logType === 'error_logs' ? { level: 'error' } : {}),
              ...(logType === 'debug_logs' ? { level: 'debug' } : {}),
              ...(logType === 'info_logs' ? { level: 'info' } : {}),
            }
          })
        ).count
        break
    }
    
    return result
  }

  /**
   * 清理所有过期日志
   */
  async cleanAllExpiredLogs() {
    const results = {}
    for (const logType of Object.keys(this.RETENTION_CONFIG)) {
      results[logType] = await this.cleanExpiredLogs(logType)
    }
    return results
  }

  /**
   * 导出日志
   */
  async exportLogs(logType, params = {}) {
    const result = await this.getLogsByType(logType, { ...params, size: 10000 })
    return result.list
  }
}

export default new SystemLogService()
