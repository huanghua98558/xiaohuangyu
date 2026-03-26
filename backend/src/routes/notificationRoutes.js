import { Router } from 'express'
import { authMiddleware, adminOnly } from '../middlewares/auth.js'
import supabase from '../utils/supabaseToPrismaAdapter.js'

const router = Router()

router.get('/', authMiddleware, async (req, res) => {
  try {
    if (!req.userId) return res.json({ code: 0, data: { list: [], total: 0 } })
    const page = parseInt(req.query.page) || 1
    const size = parseInt(req.query.size) || 20
    const offset = (page - 1) * size
    const { data: list, count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + size - 1)
    res.json({ code: 0, data: { list: list || [], total: count || 0 } })
  } catch (err) {
    res.json({ code: 0, data: { list: [], total: 0 } })
  }
})

router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', req.userId).eq('is_read', false)
    res.json({ code: 0, data: { count: count || 0 } })
  } catch (err) {
    res.json({ code: 0, data: { count: 0 } })
  }
})

router.post('/read-all', authMiddleware, async (req, res) => {
  try {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', req.userId)
    res.json({ code: 0, message: '已全部标记为已读' })
  } catch (err) {
    res.json({ code: 0, message: '操作完成' })
  }
})

router.post('/send', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { userId, title, content, type } = req.body
    await supabase.from('notifications').insert({ user_id: userId, title, content, type: type || 'system', is_read: false })
    res.json({ code: 0, message: '发送成功' })
  } catch (err) {
    res.json({ code: 0, message: '通知表尚未创建' })
  }
})

export default router
