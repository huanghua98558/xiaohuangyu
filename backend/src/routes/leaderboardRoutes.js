import { Router } from 'express'
import leaderboardController from '../controllers/leaderboardController.js'
import { authMiddleware } from '../middlewares/auth.js'

const router = Router()

// 公开接口
router.get('/total', leaderboardController.getTotalRank)
router.get('/daily', leaderboardController.getTotalRank)  // daily 使用 total 排行
router.get('/weekly', leaderboardController.getWeeklyRank)
router.get('/monthly', leaderboardController.getMonthlyRank)

// 需要登录的接口
router.get('/my', authMiddleware, leaderboardController.getMyRank)


// 兼容 ?type=xxx 查询参数格式
router.get('/', (req, res, next) => {
  const type = req.query.type || 'total'
  const mapping = { daily: '/total', total: '/total', weekly: '/weekly', monthly: '/monthly' }
  const target = mapping[type] || '/total'
  req.url = target
  return router.handle(req, res, next)
})

export default router
