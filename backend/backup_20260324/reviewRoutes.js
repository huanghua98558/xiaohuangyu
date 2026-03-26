import { Router } from 'express'
import reviewController from '../controllers/reviewController.js'
import { validate, reviewSchema } from '../utils/validator.js'
import { authMiddleware, adminOrReviewer } from '../middlewares/auth.js'

const router = Router()

// 需要管理员或审核员权限
router.get('/pending', authMiddleware, adminOrReviewer, reviewController.getPending)
router.post('/review/:claimId', authMiddleware, adminOrReviewer, validate(reviewSchema), reviewController.review)
router.get('/stats', authMiddleware, adminOrReviewer, reviewController.getStats)

export default router
