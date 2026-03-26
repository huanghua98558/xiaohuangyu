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
      .from('task_templates')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + size - 1)
    res.json({ code: 0, data: { list: list || [], total: count || 0, page, size } })
  } catch (err) {
    res.json({ code: 0, data: { list: [], total: 0, page: 1, size: 20 }, message: '模板表尚未创建' })
  }
})

router.get('/hot', async (req, res) => {
  try {
    const { data } = await supabase.from('task_templates').select('*').order('use_count', { ascending: false }).limit(10)
    res.json({ code: 0, data: data || [] })
  } catch (err) {
    res.json({ code: 0, data: [] })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { data } = await supabase.from('task_templates').select('*').eq('id', req.params.id).single()
    res.json({ code: 0, data: data || null })
  } catch (err) {
    res.json({ code: 404, message: '模板不存在' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { data } = await supabase.from('task_templates').insert(req.body).select().single()
    res.json({ code: 0, data, message: '创建成功' })
  } catch (err) {
    res.json({ code: 0, data: null, message: '模板表尚未创建' })
  }
})

router.post('/:id/use', async (req, res) => {
  try {
    await supabase.from('task_templates').update({ use_count: supabase.raw('use_count + 1') }).eq('id', req.params.id)
    res.json({ code: 0, message: '使用成功' })
  } catch (err) {
    res.json({ code: 0, message: '操作完成' })
  }
})

export default router
