import { Router } from 'express'
import walletController from '../controllers/walletController.js'
import { validate, convertPointsSchema, withdrawSchema, reviewSchema } from '../utils/validator.js'
import { authMiddleware, adminOnly } from '../middlewares/auth.js'

const router = Router()

// 需要登录的接口
router.post('/convert', authMiddleware, validate(convertPointsSchema), walletController.convert)
router.post('/withdraw', authMiddleware, validate(withdrawSchema), walletController.withdraw)
router.get('/withdrawals', authMiddleware, walletController.getWithdrawals)
router.get('/convert-records', authMiddleware, walletController.getConvertRecords)

// 管理员接口
router.get('/admin/pending', authMiddleware, adminOnly, walletController.getPendingWithdrawals)
router.post('/admin/withdrawal/:id', authMiddleware, adminOnly, validate(reviewSchema), walletController.processWithdrawal)

export default router
