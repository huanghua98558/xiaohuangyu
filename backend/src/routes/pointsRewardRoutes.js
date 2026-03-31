import { Router } from 'express'
import pointsRewardController from '../controllers/pointsRewardController.js'
import { authMiddleware, adminOnly } from '../middlewares/auth.js'

const router = Router()

// 所有接口需要管理员权限
router.use(authMiddleware)
router.use(adminOnly)

// 统计概览
router.get('/overview', pointsRewardController.getOverview)
router.get('/today', pointsRewardController.getTodayStats)
router.get('/trend', pointsRewardController.getTrend)

// 奖励明细
router.get('/list', pointsRewardController.getRewardList)
router.get('/export', pointsRewardController.exportRewards)
router.get('/user/:userId', pointsRewardController.getUserRewardSummary)

// 配置管理
router.get('/configs', pointsRewardController.getConfigs)
router.put('/config', pointsRewardController.updateConfig)
router.put('/configs', pointsRewardController.updateConfigs)

// 异常检测
router.get('/anomaly', pointsRewardController.detectAnomaly)


// 兼容前端路径
router.get('/stats', (req, res, next) => {
  req.url = '/overview'
  return router.handle(req, res, next)
})




// 兼容前端路径 /stats -> /overview
router.get('/stats', async (req, res, next) => {
  req.url = '/overview'
  return router.handle(req, res, next)
})

// 兼容 /history -> /list
router.get('/history', async (req, res) => {
  try {
    const supabase = (await import('../utils/supabaseToPrismaAdapter.js')).default
    const page = parseInt(req.query.page) || 1
    const size = parseInt(req.query.size) || 20
    const offset = (page - 1) * size
    const { data: list, count } = await supabase.from('records').select('*', { count: 'exact' }).eq('type', 'task').order('created_at', { ascending: false }).range(offset, offset + size - 1)
    res.json({ code: 0, data: { list: list || [], total: count || 0, page, size } })
  } catch (err) {
    res.json({ code: 0, data: { list: [], total: 0 } })
  }
})

export default router
