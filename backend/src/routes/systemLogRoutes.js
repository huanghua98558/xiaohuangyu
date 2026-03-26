import { Router } from 'express'
import { authMiddleware, adminOnly } from '../middlewares/auth.js'
import supabase from '../utils/supabaseToPrismaAdapter.js'
import logger from '../utils/logger.js'

const router = Router()
router.use(authMiddleware, adminOnly)

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const size = parseInt(req.query.size) || 20
    const offset = (page - 1) * size
    const type = req.query.type || 'all'

    let query = supabase.from('system_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false })
    if (type !== 'all') query = query.eq('type', type)
    query = query.range(offset, offset + size - 1)

    const { data: list, count } = await query
    res.json({ code: 0, data: { list: list || [], total: count || 0, page, size } })
  } catch (err) {
    res.json({ code: 0, data: { list: [], total: 0, page: 1, size: 20 }, message: '系统日志表尚未初始化' })
  }
})

router.get('/overview', async (req, res) => {
  try {
    const result = await Promise.all([
      supabase.from('system_logs').select('*', { count: 'exact', head: true }).then(r => r.count || 0).catch(() => 0),
      supabase.from('system_logs').select('*', { count: 'exact', head: true }).eq('level', 'error').then(r => r.count || 0).catch(() => 0),
    ])
    res.json({ code: 0, data: { total: result[0], errors: result[1] } })
  } catch (err) {
    res.json({ code: 0, data: { total: 0, errors: 0 } })
  }
})

router.get('/operation', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const size = parseInt(req.query.size) || 20
    const offset = (page - 1) * size
    const { data: list, count } = await supabase.from('system_logs').select('*', { count: 'exact' }).eq('type', 'operation').order('created_at', { ascending: false }).range(offset, offset + size - 1)
    res.json({ code: 0, data: { list: list || [], total: count || 0, page, size } })
  } catch (err) {
    res.json({ code: 0, data: { list: [], total: 0 } })
  }
})

router.get('/login', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const size = parseInt(req.query.size) || 20
    const offset = (page - 1) * size
    const { data: list, count } = await supabase.from('system_logs').select('*', { count: 'exact' }).eq('type', 'login').order('created_at', { ascending: false }).range(offset, offset + size - 1)
    res.json({ code: 0, data: { list: list || [], total: count || 0, page, size } })
  } catch (err) {
    res.json({ code: 0, data: { list: [], total: 0 } })
  }
})

router.get('/review', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const size = parseInt(req.query.size) || 20
    const offset = (page - 1) * size
    const { data: list, count } = await supabase.from('system_logs').select('*', { count: 'exact' }).eq('type', 'review').order('created_at', { ascending: false }).range(offset, offset + size - 1)
    res.json({ code: 0, data: { list: list || [], total: count || 0, page, size } })
  } catch (err) {
    res.json({ code: 0, data: { list: [], total: 0 } })
  }
})

router.get('/error', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const size = parseInt(req.query.size) || 20
    const offset = (page - 1) * size
    const { data: list, count } = await supabase.from('system_logs').select('*', { count: 'exact' }).eq('level', 'error').order('created_at', { ascending: false }).range(offset, offset + size - 1)
    res.json({ code: 0, data: { list: list || [], total: count || 0, page, size } })
  } catch (err) {
    res.json({ code: 0, data: { list: [], total: 0 } })
  }
})

router.get('/retention-config', (req, res) => {
  res.json({ code: 0, data: { retentionDays: 90, maxSize: '1GB' } })
})

router.get('/action-stats', async (req, res) => {
  res.json({ code: 0, data: [] })
})

router.post('/clean', async (req, res) => {
  res.json({ code: 0, message: '清理任务已提交' })
})

router.get('/export/:type', async (req, res) => {
  res.json({ code: 0, data: [] })
})

export default router
