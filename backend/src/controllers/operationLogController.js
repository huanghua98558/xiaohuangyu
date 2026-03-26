import operationLogService from '../services/operationLogService.js'
import { success } from '../utils/response.js'

class OperationLogController {
  /**
   * 获取操作日志列表
   */
  async getLogs(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1
      const size = parseInt(req.query.size) || 20
      const filters = {
        adminId: req.query.adminId || null,
        action: req.query.action || null,
        targetType: req.query.targetType || null,
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null
      }
      
      const result = await operationLogService.getLogs(page, size, filters)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取特定目标的操作日志
   */
  async getTargetLogs(req, res, next) {
    try {
      const { targetType, targetId } = req.params
      const page = parseInt(req.query.page) || 1
      const size = parseInt(req.query.size) || 20
      
      const result = await operationLogService.getTargetLogs(targetType, parseInt(targetId), page, size)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取操作统计
   */
  async getActionStats(req, res, next) {
    try {
      const days = parseInt(req.query.days) || 7
      const result = await operationLogService.getActionStats(days)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }
}

export default new OperationLogController()
