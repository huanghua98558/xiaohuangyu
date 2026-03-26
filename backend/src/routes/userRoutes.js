import { Router } from 'express'
import userController from '../controllers/userController.js'
import walletController from '../controllers/walletController.js'
import { validate, registerSchema, loginSchema, convertPointsSchema, withdrawSchema } from '../utils/validator.js'
import { authMiddleware, optionalAuth } from '../middlewares/auth.js'

const router = Router()

// 公开接口
router.post('/register', validate(registerSchema), userController.register)
router.post('/login', validate(loginSchema), userController.login)

// 需要登录的接口
router.get('/me', authMiddleware, userController.getMe)
router.put('/profile', authMiddleware, userController.updateProfile)
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
