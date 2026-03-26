import supabase from '../utils/supabaseToPrismaAdapter.js'
import logger from '../utils/logger.js'

/**
 * 告警服务
 * 统一管理所有告警的创建和查询
 */
class AlertService {
  /**
   * 创建告警
   */
  async createAlert({ type, severity, title, message, source = 'system', metadata = {} }) {
    try {
      const { data, error } = await supabase
        .from('audit_alerts')
        .insert({
          alert_type: type,
          alert_level: severity === 'high' ? 'error' : severity === 'medium' ? 'warning' : 'info',
          alert_detail: {
            title,
            message,
            source,
            ...metadata
          },
          is_handled: false
        })
        .select()
        .single()

      if (error) {
        logger.error('创建告警失败:', error)
        return null
      }

      logger.info(`创建告警: [${severity}] ${title} - ${message}`)
      return data
    } catch (e) {
      logger.error('创建告警异常:', e)
      return null
    }
  }

  /**
   * 获取未处理告警数量
   */
  async getUnhandledCount() {
    const { count, error } = await supabase
      .from('audit_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('is_handled', false)

    return count || 0
  }

  /**
   * 获取告警列表
   */
  async getAlerts(page = 1, size = 20, filters = {}) {
    const offset = (page - 1) * size
    let query = supabase
      .from('audit_alerts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (filters.isHandled !== undefined) {
      query = query.eq('is_handled', filters.isHandled)
    }
    if (filters.alertLevel) {
      query = query.eq('alert_level', filters.alertLevel)
    }
    if (filters.alertType) {
      query = query.eq('alert_type', filters.alertType)
    }

    const { data, count, error } = await query.range(offset, offset + size - 1)

    if (error) {
      logger.error('获取告警列表失败:', error)
      return { list: [], total: 0 }
    }

    return {
      list: data || [],
      total: count || 0,
      page,
      size
    }
  }

  /**
   * 处理告警
   */
  async handleAlert(alertId, handlerId, note = '') {
    const { error } = await supabase
      .from('audit_alerts')
      .update({
        is_handled: true,
        handled_at: new Date().toISOString(),
        handler_id: handlerId,
        handle_note: note
      })
      .eq('id', alertId)

    if (error) {
      logger.error('处理告警失败:', error)
      throw new Error('处理告警失败')
    }

    return { success: true }
  }
}

export default new AlertService()
