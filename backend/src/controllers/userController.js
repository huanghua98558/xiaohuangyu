import userService from '../services/userService.js'
import promotionService from '../services/promotionService.js'
import loginLogService from '../services/loginLogService.js'
import userLoginCaptchaService from '../services/userLoginCaptchaService.js'
import { success, error, badRequest } from '../utils/response.js'

class UserController {
  /**
   * 用户注册
   */
  async register(req, res, next) {
    try {
      const { username, password, phone, inviteCode, registrationCode, agreedToPrivacy, agreedToTerms } =
        req.validatedData || req.body

      // 传递协议同意状态
      const agreements = {
        privacy: agreedToPrivacy || false,
        terms: agreedToTerms || false
      }

      const result = await userService.register(username, password, phone, agreements, { registrationCode })
      
      // 如果有邀请码，绑定推广关系
      if (inviteCode && result.user && result.user.id) {
        try {
          await promotionService.bindCPromotion(result.user.id, inviteCode)
        } catch (e) {
          // 绑定失败不影响注册
          console.error('绑定邀请码失败:', e.message)
        }
      }
      
      success(res, result, '注册成功', 201)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 用户登录
   */
  async login(req, res, next) {
    let username = ''
    try {
      const body = req.validatedData || req.body
      username = body.username
      const { password, captchaId, captchaCode } = body

      if (process.env.SKIP_USER_LOGIN_CAPTCHA !== '1') {
        let captchaCheck
        try {
          captchaCheck = await userLoginCaptchaService.verifyCaptcha(captchaId, captchaCode)
        } catch (e) {
          return res.status(503).json({ code: 503, message: '验证码服务异常，请刷新后重试', data: null })
        }
        if (!captchaCheck.ok) {
          return res.status(400).json({ code: 400, message: captchaCheck.message, data: null })
        }
      }

      const result = await userService.login(username, password)
      
      // 记录登录成功日志（异步，不阻塞响应）
      loginLogService.log({
        userId: result.user.id,
        username: result.user.username,
        loginStatus: 'success',
        req
      }).catch(() => {})
      
      success(res, result, '登录成功')
    } catch (err) {
      // 记录登录失败日志（异步，不阻塞响应）
      if (username) {
        loginLogService.log({
          userId: null,
          username,
          loginStatus: 'failed',
          failureReason: err.message,
          req
        }).catch(() => {})
      }
      next(err)
    }
  }

  /**
   * 获取当前用户信息
   */
  async getMe(req, res, next) {
    try {
      const user = await userService.getUserById(req.userId)
      success(res, user)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取钱包信息
   */
  async getWallet(req, res, next) {
    try {
      const wallet = await userService.getWallet(req.userId)
      success(res, wallet)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取用户记录
   */
  async getRecords(req, res, next) {
    try {
      const { page = 1, size = 20 } = req.query
      const records = await userService.getRecords(req.userId, parseInt(page), parseInt(size))
      success(res, records)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取积分排行榜
   */
  async getPointsRank(req, res, next) {
    try {
      const { limit = 10 } = req.query
      const rank = await userService.getPointsRank(parseInt(limit))
      success(res, rank)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取单日积分排行榜
   */
  async getDailyPointsRank(req, res, next) {
    try {
      const { limit = 10 } = req.query
      const rank = await userService.getDailyPointsRank(parseInt(limit))
      success(res, rank)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取当前用户排名
   */
  async getMyRank(req, res, next) {
    try {
      const rank = await userService.getUserRank(req.userId)
      const dailyRank = await userService.getUserDailyRank(req.userId)
      success(res, { total: rank, daily: dailyRank })
    } catch (err) {
      next(err)
    }
  }

  /**
   * 清空用户数据
   * 用户隐私合规功能：允许用户自主清空评价记录
   */
  async clearData(req, res, next) {
    try {
      const result = await userService.clearUserData(req.userId)
      success(res, result, '数据已清空')
    } catch (err) {
      next(err)
    }
  }

  /**
   * 注销用户账号
   */
  async deleteAccount(req, res, next) {
    try {
      const result = await userService.deleteAccount(req.userId)
      success(res, result, '账号已注销')
    } catch (err) {
      next(err)
    }
  }

  /**
   * 修改登录密码
   */
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.validatedData || req.body
      const result = await userService.changePassword(req.userId, { currentPassword, newPassword })
      success(res, result, '密码已更新')
    } catch (err) {
      next(err)
    }
  }

  /**
   * 更新用户资料（位置信息等）
   */
  async updateProfile(req, res, next) {
    try {
      const { province, city, phone } = req.body
      
      // 至少提供一个更新字段
      if (province === undefined && city === undefined && phone === undefined) {
        return badRequest(res, '请提供要更新的字段')
      }

      const result = await userService.updateProfile(req.userId, { province, city, phone })
      success(res, result, '更新成功')
    } catch (err) {
      next(err)
    }
  }
}

export default new UserController()
