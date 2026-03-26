import { Router } from 'express'
import levelController from '../controllers/levelController.js'
import { authMiddleware, adminOnly } from '../middlewares/auth.js'

const router = Router()

// 公开接口
router.get('/configs', levelController.getLevelConfigs)

// 需要登录的接口
router.get('/my', authMiddleware, levelController.getMyLevel)
router.get('/progress', authMiddleware, levelController.getUpgradeProgress)

// 管理员接口
router.put('/configs/:level', authMiddleware, adminOnly, levelController.updateLevelConfig)


// 兼容 /config 路径
router.get('/config', async (req, res) => {
  try {
    const supabase = (await import('../utils/supabaseToPrismaAdapter.js')).default
    const { data } = await supabase.from('level_configs').select('id, level, name, min_points, max_points, icon, color')
    res.json({ code: 0, data: data || [] })
  } catch (err) {
    res.json({ code: 0, data: [
      { level: 1, name: '青铜', min_points: 0, max_points: 99 },
      { level: 2, name: '白银', min_points: 100, max_points: 499 },
      { level: 3, name: '黄金', min_points: 500, max_points: 1999 },
      { level: 4, name: '铂金', min_points: 2000, max_points: 4999 },
      { level: 5, name: '钻石', min_points: 5000, max_points: 999999 }
    ] })
  }
})

export default router
