import { Router } from 'express'
import leaderboardSnapshotController from '../controllers/leaderboardSnapshotController.js'
import { authMiddleware, adminOnly } from '../middlewares/auth.js'

const router = Router()

// 公开接口
router.get('/', leaderboardSnapshotController.getSnapshots)
router.get('/:id', leaderboardSnapshotController.getSnapshotDetail)

// 需要登录的接口
router.get('/my/rewards', authMiddleware, leaderboardSnapshotController.getMyRewards)

// 管理员接口
router.post('/trigger/weekly', authMiddleware, adminOnly, leaderboardSnapshotController.triggerWeekly)
router.post('/trigger/monthly', authMiddleware, adminOnly, leaderboardSnapshotController.triggerMonthly)

export default router
