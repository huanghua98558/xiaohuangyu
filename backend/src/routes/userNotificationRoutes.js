/**
 * 用户通知路由
 */

import express from 'express'
import { authMiddleware } from '../middlewares/auth.js'
import supabase from '../utils/supabaseToPrismaAdapter.js'

const router = express.Router()

// 所有路由需要认证
router.use(authMiddleware)

/**
 * GET /api/user-notifications
 */
router.get('/', async (req, res) => {
  try {
    const { unreadOnly, page = 1, pageSize = 20 } = req.query
    const userId = req.userId // 从认证中间件获取

    let query = supabase
      .from('user_notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (unreadOnly === 'true') {
      query = query.eq('is_read', false)
    }

    const from = (parseInt(page) - 1) * parseInt(pageSize)
    const to = from + parseInt(pageSize) - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error('[UserNotifications] 查询失败:', error)
      return res.status(500).json({ success: false, error: error.message })
    }

    res.json({
      success: true,
      data: {
        list: data || [],
        total: count || 0,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    })
  } catch (error) {
    console.error('[UserNotifications] 请求失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/user-notifications/:id/read
 */
router.post('/:id/read', async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.userId // 从认证中间件获取

    const { data, error } = await supabase
      .from('user_notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      return res.status(500).json({ success: false, error: error.message })
    }

    res.json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/user-notifications/read-all
 */
router.post('/read-all', async (req, res) => {
  try {
    const userId = req.userId // 从认证中间件获取

    const { data, error } = await supabase
      .from('user_notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('is_read', false)
      .select()

    if (error) {
      return res.status(500).json({ success: false, error: error.message })
    }

    res.json({ success: true, updatedCount: data?.length || 0 })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
