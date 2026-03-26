/**
 * AI操作日志服务 - Supabase版
 * 记录AI系统的操作日志
 */
import supabase from '../../utils/supabaseToPrismaAdapter.js'
import logger from '../../utils/logger.js'

/**
 * 记录操作日志
 * @param {Object} logData - 日志数据
 * @returns {Object} 创建的日志
 */
export async function logOperation(logData) {
  const { userId, type, action, input = {}, output = {}, status = 'success', errorMsg = null, duration = 0 } = logData
  
  try {
    const { data: log, error } = await supabase
      .from('ai_operation_logs')
      .insert({
        user_id: userId,
        type,
        action,
        input: JSON.stringify(input),
        output: JSON.stringify(output),
        status,
        error_msg: errorMsg,
        duration
      })
      .select()
      .single()
    
    if (error) {
      logger.error('记录操作日志失败:', error)
      return null
    }
    
    logger.debug(`AI操作日志: userId=${userId}, type=${type}, action=${action}, status=${status}`)
    return log
  } catch (error) {
    logger.error('记录操作日志失败:', error)
    // 日志记录失败不应影响主流程
    return null
  }
}

/**
 * 获取操作日志列表
 * @param {Object} options - 查询选项
 * @returns {Object} 日志列表和分页信息
 */
export async function getOperationLogs(options = {}) {
  const { userId, type, status, page = 1, pageSize = 20, startDate, endDate } = options
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  
  try {
    let query = supabase
      .from('ai_operation_logs')
      .select('*', { count: 'exact' })
    
    if (userId) query = query.eq('user_id', userId)
    if (type) query = query.eq('type', type)
    if (status) query = query.eq('status', status)
    if (startDate) query = query.gte('created_at', startDate)
    if (endDate) query = query.lte('created_at', endDate)
    
    const { data: logs, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to)
    
    if (error) throw error
    
    // 解析JSON字段
    const parsedLogs = (logs || []).map(log => ({
      ...log,
      input: JSON.parse(log.input || '{}'),
      output: JSON.parse(log.output || '{}')
    }))
    
    return {
      list: parsedLogs,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize)
    }
  } catch (error) {
    logger.error('获取操作日志失败:', error)
    throw error
  }
}

/**
 * 获取操作统计
 * @param {Object} options - 查询选项
 * @returns {Object} 统计数据
 */
export async function getOperationStats(options = {}) {
  const { startDate, endDate } = options
  
  try {
    let query = supabase
      .from('ai_operation_logs')
      .select('id, type, action, status, duration')
    
    if (startDate) query = query.gte('created_at', startDate)
    if (endDate) query = query.lte('created_at', endDate)
    
    const { data: logs, error } = await query
    
    if (error) throw error
    
    // 计算统计
    const total = logs?.length || 0
    const success = logs?.filter(l => l.status === 'success').length || 0
    const failed = logs?.filter(l => l.status === 'failed').length || 0
    
    // 按类型统计
    const byType = {}
    logs?.forEach(l => {
      byType[l.type] = (byType[l.type] || 0) + 1
    })
    
    // 按操作统计
    const byAction = {}
    logs?.forEach(l => {
      byAction[l.action] = (byAction[l.action] || 0) + 1
    })
    
    // 平均执行时长
    const successLogs = logs?.filter(l => l.status === 'success') || []
    const avgDuration = successLogs.length > 0
      ? successLogs.reduce((sum, l) => sum + (l.duration || 0), 0) / successLogs.length
      : 0
    
    return {
      total,
      success,
      failed,
      successRate: total > 0 ? ((success / total) * 100).toFixed(2) : 0,
      avgDuration,
      byType: Object.entries(byType).map(([type, count]) => ({ type, count })),
      byAction: Object.entries(byAction)
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    }
  } catch (error) {
    logger.error('获取操作统计失败:', error)
    throw error
  }
}

/**
 * 记录带计时的操作
 * @param {Function} operation - 要执行的操作函数
 * @param {Object} logData - 日志数据
 * @returns {Object} 操作结果
 */
export async function withLogging(operation, logData) {
  const startTime = Date.now()
  const { userId, type, action, input } = logData
  
  try {
    const result = await operation()
    const duration = Date.now() - startTime
    
    await logOperation({
      userId,
      type,
      action,
      input,
      output: result,
      status: 'success',
      duration
    })
    
    return result
  } catch (error) {
    const duration = Date.now() - startTime
    
    await logOperation({
      userId,
      type,
      action,
      input,
      output: {},
      status: 'failed',
      errorMsg: error.message,
      duration
    })
    
    throw error
  }
}

export default {
  logOperation,
  getOperationLogs,
  getOperationStats,
  withLogging
}
