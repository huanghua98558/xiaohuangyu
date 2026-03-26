import signInService from '../services/signInService.js'
import { success } from '../utils/response.js'

class SignInController {
  /**
   * 用户签到
   */
  async signIn(req, res, next) {
    try {
      const userId = req.userId
      const result = await signInService.signIn(userId)
      
      if (result.success) {
        // 正确传递 data 和 message，避免嵌套
        success(res, result.data, result.message)
      } else {
        res.status(400).json({ code: 400, message: result.message, data: result.data })
      }
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取签到状态
   */
  async getSignInStatus(req, res, next) {
    try {
      const userId = req.userId
      const result = await signInService.getSignInStatus(userId)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取签到日历
   */
  async getSignInCalendar(req, res, next) {
    try {
      const userId = req.userId
      const year = parseInt(req.query.year) || new Date().getFullYear()
      const month = parseInt(req.query.month) || new Date().getMonth() + 1
      
      const result = await signInService.getSignInCalendar(userId, year, month)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }
}

export default new SignInController()
