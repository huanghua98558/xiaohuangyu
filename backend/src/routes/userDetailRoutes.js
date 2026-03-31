import { Router } from 'express'
import userDetailController from '../controllers/userDetailController.js'
import { authMiddleware, adminOnly } from '../middlewares/auth.js'

const router = Router()

// 所有接口都需要管理员权限
router.use(authMiddleware)
router.use(adminOnly)

// 用户详情
router.get('/users/:id', userDetailController.getUserDetail)
router.get('/users/:id/tasks', userDetailController.getUserTasks)
router.get('/users/:id/points-logs', userDetailController.getUserPointsLogs)
router.get('/users/:id/balance-logs', userDetailController.getUserBalanceLogs)
router.get('/users/:id/activity', userDetailController.getUserActivity)

// 批量操作
router.post('/users/batch-update', userDetailController.batchUpdateUsers)
router.post('/users/batch-grant-points', userDetailController.batchGrantPoints)

export default router
