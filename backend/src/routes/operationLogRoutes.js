import { Router } from 'express'
import { authMiddleware, adminOnly } from '../middlewares/auth.js'
import supabase from '../utils/supabaseToPrismaAdapter.js'

const router = Router()
router.use(authMiddleware, adminOnly)

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const size = parseInt(req.query.size) || 20
    const offset = (page - 1) * size

    const { data: list, count } = await supabase
      .from('operation_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + size - 1)

    res.json({ code: 0, data: { list: list || [], total: count || 0, page, size } })
  } catch (err) {
    res.json({ code: 0, data: { list: [], total: 0, page: 1, size: 20 }, message: '操作日志表尚未初始化' })
  }
})

router.get('/stats', async (req, res) => {
  try {
    const { count } = await supabase.from('operation_logs').select('*', { count: 'exact', head: true })
    res.json({ code: 0, data: { total: count || 0 } })
  } catch (err) {
    res.json({ code: 0, data: { total: 0 } })
  }
})

router.get('/:targetType/:targetId', async (req, res) => {
  try {
    const { targetType, targetId } = req.params
    const { data: list } = await supabase
      .from('operation_logs')
      .select('*')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .order('created_at', { ascending: false })
      .limit(50)
    res.json({ code: 0, data: { list: list || [] } })
  } catch (err) {
    res.json({ code: 0, data: { list: [] } })
  }
})

export default router
