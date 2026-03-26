import walletService from '../services/walletService.js'
import { success } from '../utils/response.js'

class WalletController {
  /**
   * 积分兑换余额
   */
  async convert(req, res, next) {
    try {
      const { points } = req.validatedData || req.body
      const result = await walletService.convertPoints(req.userId, points)
      success(res, result, result.message)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 提现申请
   */
  async withdraw(req, res, next) {
    try {
      const { amount, wechatInfo } = req.validatedData || req.body
      const result = await walletService.withdraw(req.userId, amount, wechatInfo)
      success(res, result, result.message)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取提现记录
   */
  async getWithdrawals(req, res, next) {
    try {
      const { page = 1, size = 20 } = req.query
      const result = await walletService.getWithdrawals(req.userId, parseInt(page), parseInt(size))
      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取积分兑换记录
   */
  async getConvertRecords(req, res, next) {
    try {
      const { page = 1, size = 20 } = req.query
      const result = await walletService.getConvertRecords(req.userId, parseInt(page), parseInt(size))
      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取待处理提现（管理员）
   */
  async getPendingWithdrawals(req, res, next) {
    try {
      const { page = 1, size = 20 } = req.query
      const result = await walletService.getPendingWithdrawals(parseInt(page), parseInt(size))
      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 处理提现申请（管理员）
   */
  async processWithdrawal(req, res, next) {
    try {
      const withdrawalId = parseInt(req.params.id)
      const { action, note } = req.validatedData || req.body
      const result = await walletService.processWithdrawal(withdrawalId, req.userId, action, note)
      success(res, result, result.message)
    } catch (err) {
      next(err)
    }
  }
}

export default new WalletController()
