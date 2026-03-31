import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import userController from '../controllers/userController.js'
import walletController from '../controllers/walletController.js'
import {
  validate,
  registerSchema,
  loginSchema,
  changePasswordSchema,
  convertPointsSchema,
  withdrawSchema
} from '../utils/validator.js'
import { authMiddleware } from '../middlewares/auth.js'
import userLoginCaptchaService from '../services/userLoginCaptchaService.js'
import { success } from '../utils/response.js'
import logger from '../utils/logger.js'

const router = Router()

const userCaptchaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { code: 429, message: '获取验证码过于频繁，请稍后再试', data: null },
  standardHeaders: true,
  legacyHeaders: false
})

const userLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { code: 429, message: '登录尝试过于频繁，请稍后再试', data: null },
  standardHeaders: true,
  legacyHeaders: false
})

// 公开接口
router.get('/captcha', userCaptchaLimiter, async (req, res, next) => {
  try {
    const data = await userLoginCaptchaService.createCaptcha()
    success(res, data)
  } catch (err) {
    logger.error('[user] 生成登录验证码失败:', err)
    return res.status(503).json({ code: 503, message: '验证码服务暂不可用，请稍后重试', data: null })
  }
})

router.post('/register', validate(registerSchema), userController.register)
router.post('/login', userLoginLimiter, validate(loginSchema), userController.login)

// 需要登录的接口
router.get('/me', authMiddleware, userController.getMe)
router.put('/profile', authMiddleware, userController.updateProfile)
router.post('/change-password', authMiddleware, validate(changePasswordSchema), userController.changePassword)
router.get('/wallet', authMiddleware, userController.getWallet)
router.get('/records', authMiddleware, userController.getRecords)
router.get('/my-rank', authMiddleware, userController.getMyRank)
router.post('/convert', authMiddleware, validate(convertPointsSchema), walletController.convert)
router.post('/withdraw', authMiddleware, validate(withdrawSchema), walletController.withdraw)
router.get('/withdrawals', authMiddleware, walletController.getWithdrawals)

// 用户隐私合规接口
router.post('/clear-data', authMiddleware, userController.clearData)
router.post('/delete-account', authMiddleware, userController.deleteAccount)

// 公开接口 - 排行榜
router.get('/rank', userController.getPointsRank)
router.get('/rank/daily', userController.getDailyPointsRank)



export default router
