import taskService from '../services/taskService.js'
import { success } from '../utils/response.js'

class ReviewController {
  /**
   * 获取待审核列表
   */
  async getPending(req, res, next) {
    try {
      const { page = 1, size = 20 } = req.query
      const result = await taskService.getPendingReview(parseInt(page), parseInt(size))
      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 审核任务
   */
  async review(req, res, next) {
    try {
      const claimId = parseInt(req.params.claimId)
      const { action, note } = req.validatedData || req.body
      const result = await taskService.reviewClaim(claimId, req.userId, action, note)
      success(res, result, result.message)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取审核统计
   */
  async getStats(req, res, next) {
    try {
      const { startDate, endDate } = req.query
      
      // 获取统计数据
      const stats = await taskService.getReviewStats(startDate, endDate)
      success(res, stats)
    } catch (err) {
      next(err)
    }
  }
}

export default new ReviewController()
