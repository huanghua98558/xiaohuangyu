import { Router } from 'express'
import achievementController from '../controllers/achievementController.js'
import { authMiddleware } from '../middlewares/auth.js'

const router = Router()

router.use(authMiddleware)

router.get('/', achievementController.getUserAchievements)
router.get('/all', achievementController.getAllAchievements)
router.get('/stats', achievementController.getAchievementStats)
router.post('/check', achievementController.checkAchievements)

export default router
