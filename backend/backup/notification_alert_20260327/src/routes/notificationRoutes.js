import { Router } from 'express'
import { authMiddleware, adminOnly } from '../middlewares/auth.js'
import notificationService from '../services/notificationService.js'
import { success } from '../utils/response.js'

const router = Router()

router.use(authMiddleware)

// 兼容旧用户消息接口，底层统一走 user_notifications
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const size = parseInt(req.query.size, 10) || 20
    const unreadOnly = req.query.unreadOnly === 'true'
    const type = typeof req.query.type === 'string' ? req.query.type : null
    const result = await notificationService.getUserNotifications({
      userId: req.userId,
      type,
      page,
      pageSize: size,
      unreadOnly,
    })

    success(res, {
      list: result.list,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      unreadCount: result.unreadCount,
    })
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

router.put('/:id/read', async (req, res, next) => {
  try {
    const data = await notificationService.markUserNotificationRead(req.params.id, req.userId)
    success(res, data, '已标记为已读')
  } catch (err) {
    next(err)
  }
})

router.post('/:id/read', async (req, res, next) => {
  try {
    const data = await notificationService.markUserNotificationRead(req.params.id, req.userId)
    success(res, data, '已标记为已读')
  } catch (err) {
    next(err)
  }
})

router.put('/read-all', async (req, res, next) => {
  try {
    const result = await notificationService.markAllUserNotificationsRead(req.userId)
    success(res, result, '已全部标记为已读')
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

router.post('/send', adminOnly, async (req, res, next) => {
  try {
    const { userId, title, content, type, data, priority } = req.body
    const result = await notificationService.sendUserNotification({
      userId,
      title,
      content,
      type,
      data,
      priority,
    })
    success(res, result, '发送成功')
  } catch (err) {
    next(err)
  }
})

router.post('/announcement', adminOnly, async (req, res, next) => {
  try {
    const { title, content, userIds } = req.body
    const result = await notificationService.sendSystemAnnouncement(title, content, userIds)
    success(res, result, '公告发送成功')
  } catch (err) {
    next(err)
  }
})

export default router
