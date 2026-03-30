import notificationService from '../services/notificationService.js'
import { success } from '../utils/response.js'

class NotificationController {
  /**
   * 获取用户通知列表
   */
  async getNotifications(req, res, next) {
    try {
      const userId = req.userId
      const page = parseInt(req.query.page) || 1
      const size = parseInt(req.query.size) || 20
      const type = req.query.type || null
      
      const result = await notificationService.getUserNotifications(userId, page, size, type)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取未读通知数量
   */
  async getUnreadCount(req, res, next) {
    try {
      const userId = req.userId
      const count = await notificationService.getUserUnreadCount(userId)
      success(res, { count })
    } catch (err) {
      next(err)
    }
  }

  /**
   * 标记通知为已读
   */
  async markAsRead(req, res, next) {
    try {
      const userId = req.userId
      const notificationId = parseInt(req.params.id)
      
      const result = await notificationService.markAsRead(userId, notificationId)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 标记所有通知为已读
   */
  async markAllAsRead(req, res, next) {
    try {
      const userId = req.userId
      const result = await notificationService.markAllAsRead(userId)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 删除通知
   */
  async deleteNotification(req, res, next) {
    try {
      const userId = req.userId
      const notificationId = parseInt(req.params.id)
      
      const result = await notificationService.deleteNotification(userId, notificationId)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 发送系统公告（管理员）
   */
  async sendAnnouncement(req, res, next) {
    try {
      const { title, content, userIds } = req.body
      
      if (!title || !content) {
        return res.status(400).json({ code: 400, message: '标题和内容不能为空', data: null })
      }
      
      const result = await notificationService.sendSystemAnnouncement(title, content, userIds)
      success(res, result, '公告发送成功')
    } catch (err) {
      next(err)
    }
  }
}

export default new NotificationController()
