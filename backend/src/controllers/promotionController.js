import promotionService from '../services/promotionService.js'
import { success } from '../utils/response.js'

class PromotionController {
  // ==================== C端推广 ====================

  /**
   * 绑定邀请码
   */
  async bindInviteCode(req, res, next) {
    try {
      const { inviteCode } = req.body
      if (!inviteCode) {
        return res.status(400).json({ error: '请输入邀请码' })
      }

      const result = await promotionService.bindCPromotion(req.userId, inviteCode)
      success(res, result, result.bound ? '绑定成功' : result.message)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取C端推广统计
   */
  async getCStats(req, res, next) {
    try {
      const stats = await promotionService.getCStats(req.userId)
      success(res, stats)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取下级列表
   */
  async getSubordinates(req, res, next) {
    try {
      const level = parseInt(req.query.level) || 1
      const page = parseInt(req.query.page) || 1
      const result = await promotionService.getSubordinates(req.userId, level, page)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取推广收益明细
   */
  async getCEarnings(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1
      const result = await promotionService.getCEarnings(req.userId, page)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  // ==================== B端推广 ====================

  /**
   * 获取B端推广统计
   */
  async getBStats(req, res, next) {
    try {
      const stats = await promotionService.getBStats(req.userId)
      success(res, stats)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取已邀请企业列表
   */
  async getPartners(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1
      const result = await promotionService.getPartners(req.userId, page)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }
}

export default new PromotionController()
