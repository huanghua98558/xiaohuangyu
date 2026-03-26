import { Router } from 'express'
import { authMiddleware, adminOnly } from '../middlewares/auth.js'
import supabase from '../utils/supabaseToPrismaAdapter.js'

const router = Router()
router.use(authMiddleware, adminOnly)

// 获取封禁账号列表
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const size = parseInt(req.query.pageSize || req.query.size) || 20
    const offset = (page - 1) * size
    const { data: list, count } = await supabase
      .from('blocked_accounts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + size - 1)
    res.json({ code: 0, data: { list: list || [], total: count || 0, page, pageSize: size } })
  } catch (err) {
    res.json({ code: 0, data: { list: [], total: 0, page: 1, pageSize: 20 } })
  }
})

// 获取封禁统计
router.get('/stats', async (req, res) => {
  try {
    const { count: total } = await supabase.from('blocked_accounts').select('*', { count: 'exact', head: true })
    res.json({ code: 0, data: { total: total || 0, byStatus: {}, byPlatform: {} } })
  } catch (err) {
    res.json({ code: 0, data: { total: 0, byStatus: {}, byPlatform: {} } })
  }
})

// 检测封控
router.post('/check', async (req, res) => {
  try {
    const { platform, accountId } = req.body
    if (!platform || !accountId) return res.json({ code: 400, message: '缺少必要参数' })
    const { data } = await supabase.from('blocked_accounts').select('*').eq('platform', platform).eq('account_id', accountId).single()
    res.json({ code: 0, data: data || null })
  } catch (err) {
    res.json({ code: 0, data: null })
  }
})

// 批量检测
router.post('/batch-check', async (req, res) => {
  try {
    const { accounts } = req.body
    res.json({ code: 0, data: { results: [], total: 0 } })
  } catch (err) {
    res.json({ code: 0, data: { results: [], total: 0 } })
  }
})

// 确认封控
router.post('/:id/confirm', async (req, res) => {
  try {
    const { data } = await supabase.from('blocked_accounts').update({ status: 'confirmed' }).eq('id', req.params.id).select().single()
    res.json({ code: 0, data, message: '已确认封控' })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// 标记误报
router.post('/:id/false-positive', async (req, res) => {
  try {
    const { data } = await supabase.from('blocked_accounts').update({ status: 'false_positive' }).eq('id', req.params.id).select().single()
    res.json({ code: 0, data, message: '已标记为误报' })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

export default router
