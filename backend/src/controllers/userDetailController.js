import userDetailService from '../services/userDetailService.js'
import { success } from '../utils/response.js'

class UserDetailController {
  /**
   * 获取用户详情
   */
  async getUserDetail(req, res, next) {
    try {
      const userId = parseInt(req.params.id)
      const detail = await userDetailService.getUserDetail(userId)
      success(res, detail)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取用户任务列表
   */
  async getUserTasks(req, res, next) {
    try {
      const userId = parseInt(req.params.id)
      const page = parseInt(req.query.page) || 1
      const size = parseInt(req.query.size) || 20
      const status = req.query.status || null
      
      const result = await userDetailService.getUserTasks(userId, page, size, status)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取用户积分流水
   */
  async getUserPointsLogs(req, res, next) {
    try {
      const userId = parseInt(req.params.id)
      const page = parseInt(req.query.page) || 1
      const size = parseInt(req.query.size) || 20
      
      const result = await userDetailService.getUserPointsLogs(userId, page, size)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取用户余额流水
   */
  async getUserBalanceLogs(req, res, next) {
    try {
      const userId = parseInt(req.params.id)
      const page = parseInt(req.query.page) || 1
      const size = parseInt(req.query.size) || 20
      
      const result = await userDetailService.getUserBalanceLogs(userId, page, size)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取用户活跃度分析
   */
  async getUserActivity(req, res, next) {
    try {
      const userId = parseInt(req.params.id)
      const days = parseInt(req.query.days) || 30
      
      const result = await userDetailService.getUserActivity(userId, days)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 批量更新用户
   */
  async batchUpdateUsers(req, res, next) {
    try {
      const { userIds, updates } = req.body
      const adminId = req.userId
      
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ code: 400, message: '请选择要更新的用户', data: null })
      }
      
      const result = await userDetailService.batchUpdateUsers(userIds, updates, adminId)
      success(res, result, '批量更新成功')
    } catch (err) {
      next(err)
    }
  }

  /**
   * 批量发放积分
   */
  async batchGrantPoints(req, res, next) {
    try {
      const { userIds, amount, reason } = req.body
      const adminId = req.userId
      
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ code: 400, message: '请选择要发放的用户', data: null })
      }
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ code: 400, message: '积分数量必须大于0', data: null })
      }
      
      const result = await userDetailService.batchGrantPoints(userIds, amount, reason, adminId)
      success(res, result, '批量发放成功')
    } catch (err) {
      next(err)
    }
  }
}

export default new UserDetailController()
