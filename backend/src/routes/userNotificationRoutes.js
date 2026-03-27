/**
 * 用户通知路由
 * 新标准接口，和 /api/notifications 兼容层共用同一套服务
 */

import express from 'express'
import { authMiddleware } from '../middlewares/auth.js'
import notificationService from '../services/notificationService.js'
import { success } from '../utils/response.js'

const router = express.Router()

router.use(authMiddleware)

router.get('/', async (req, res, next) => {
  try {
    const unreadOnly = req.query.unreadOnly === 'true'
    const page = parseInt(req.query.page, 10) || 1
    const pageSize = parseInt(req.query.pageSize, 10) || 20
    const type = typeof req.query.type === 'string' ? req.query.type : null

    const result = await notificationService.getUserNotifications({
      userId: req.userId,
      type,
      unreadOnly,
      page,
      pageSize,
    })

    success(res, result)
  } catch (err) {
    next(err)
  }
})

router.get('/unread-count', async (req, res, next) => {
  try {
    const count = await notificationService.getUserUnreadCount(req.userId)
    success(res, { count })
  } catch (err) {
    next(err)
  }
})

router.post('/:id/read', async (req, res, next) => {
  try {
    const result = await notificationService.markUserNotificationRead(req.params.id, req.userId)
    success(res, result, '已标记为已读')
  } catch (err) {
    next(err)
  }
})

router.post('/read-all', async (req, res, next) => {
  try {
    const result = await notificationService.markAllUserNotificationsRead(req.userId)
    success(res, result, '已全部标记为已读')
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await notificationService.deleteUserNotification(req.params.id, req.userId)
    success(res, result, '通知已删除')
  } catch (err) {
    next(err)
  }
})

export default router
