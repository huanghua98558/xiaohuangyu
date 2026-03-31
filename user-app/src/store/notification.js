/**
 * 实时通知状态管理
 * 
 * 功能：
 * - 未读消息数实时更新
 * - 新消息弹窗提醒
 * - 消息列表实时刷新
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { wsService } from '../services/websocket.js'
import { fetchUnreadCount, fetchNotifications } from '../api/notification.js'
import {
  playNotificationSound,
  registerNotificationSoundUnlock,
  shouldDisplayRealtimeNotification,
} from '../services/notificationSound.js'

// 全局状态
const unreadCount = ref(0)
const latestNotifications = ref([])
const showNotificationToast = ref(false)
const currentToast = ref(null)

// 新任务推送
const showTaskPush = ref(false)
const currentTaskPush = ref(null)
const pointsDigest = ref({
  count: 0,
  totalPoints: 0,
  bonusPoints: 0,
})
let pointsDigestTimer = null

/**
 * 通知状态管理
 */
export function useNotification() {
  
  // 计算属性
  const hasUnread = computed(() => unreadCount.value > 0)
  
  /**
   * 初始化通知服务
   */
  const initNotification = async () => {
    registerNotificationSoundUnlock()

    // 获取初始未读数
    try {
      const count = await fetchUnreadCount()
      unreadCount.value = count
    } catch (e) {
      console.warn('[Notification] 获取未读数失败:', e)
    }
    
    // 订阅 WebSocket 消息
    wsService.on('notification', handleNewNotification)
    wsService.on('new_task', handleNewTask)
    wsService.on('task_reviewed', handleTaskReviewed)
    wsService.on('points_update', handlePointsUpdate)
    wsService.on('admin_notification', handleAdminNotification)
    wsService.on('system_alert', handleSystemAlert)
    
    // 监听全局通知事件（备用）
    window.addEventListener('ws-notification', handleWSNotification)
  }
  
  /**
   * 清理通知服务
   */
  const cleanupNotification = () => {
    wsService.off('notification', handleNewNotification)
    wsService.off('new_task', handleNewTask)
    wsService.off('task_reviewed', handleTaskReviewed)
    wsService.off('points_update', handlePointsUpdate)
    wsService.off('admin_notification', handleAdminNotification)
    wsService.off('system_alert', handleSystemAlert)
    window.removeEventListener('ws-notification', handleWSNotification)
  }

  const showToastWithSound = (payload, options = {}) => {
    const {
      sound = 'default',
      duration = 3000,
      skipDisplay = false,
    } = options

    if (!skipDisplay) {
      currentToast.value = {
        ...payload,
        time: new Date(),
      }
      showNotificationToast.value = true
      setTimeout(() => {
        showNotificationToast.value = false
      }, duration)
    }

    playNotificationSound(sound).catch(() => {})
  }

  const getCurrentUser = () => {
    try {
      const raw = localStorage.getItem('xiaohuangyu_user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }
  
  /**
   * 处理新通知
   */
  const handleNewNotification = (data) => {
    console.log('[Notification] 收到新通知:', data)
    
    // 增加未读数
    unreadCount.value++

    if (!shouldDisplayRealtimeNotification(data.type || 'system')) {
      return
    }

    showToastWithSound({
      type: data.type || 'system',
      title: data.title || '新消息',
      content: data.content || '',
    }, {
      sound: data.type === 'points_awarded' ? 'points' : 'default',
      duration: 3000,
    })
  }
  
  /**
   * 处理新任务推送
   */
  const handleNewTask = (data) => {
    console.log('[Notification] 收到新任务推送:', data)
    
    currentTaskPush.value = {
      taskId: data.taskId,
      title: data.title,
      platform: data.platform,
      action: data.action,
      reward: data.reward,
      pushType: data.pushType,
      nightBonus: data.nightBonus
    }
    showTaskPush.value = true
    playNotificationSound('task').catch(() => {})
    
    // 10秒后自动关闭
    setTimeout(() => {
      showTaskPush.value = false
    }, 10000)
  }
  
  /**
   * 处理审核结果
   */
  const handleTaskReviewed = (data) => {
    console.log('[Notification] 收到审核结果:', data)
    
    // 增加未读数
    unreadCount.value++
    const isApproved = data.status === 'approved'

    if (!shouldDisplayRealtimeNotification(isApproved ? 'claim_approved' : 'claim_rejected')) {
      return
    }
    showToastWithSound({
      type: 'task',
      title: isApproved ? '任务审核通过' : '任务审核未通过',
      content: isApproved 
        ? `任务"${data.taskTitle}"已审核通过，积分已到账！` 
        : `任务"${data.taskTitle}"审核未通过，请查看原因。`,
      taskId: data.taskId,
      isApproved,
    }, {
      sound: isApproved ? 'task' : 'alert',
      duration: 5000,
    })
  }

  /**
   * 处理积分到账推送
   */
  const handlePointsUpdate = (data) => {
    const points = Number(data?.finalPoints || data?.points || 0)
    const coef = Number(data?.nightCoefficient || 1)
    const bonus = Number(data?.bonusPoints || 0)

    // 同步更新本地用户积分，保证前端实时可见
    try {
      const raw = localStorage.getItem('xiaohuangyu_user')
      if (raw && points > 0) {
        const localUser = JSON.parse(raw)
        localUser.points = Number(localUser.points || 0) + points
        localStorage.setItem('xiaohuangyu_user', JSON.stringify(localUser))
      }
    } catch (e) {
      console.warn('[Notification] 更新本地积分失败:', e)
    }

    if (!shouldDisplayRealtimeNotification('points_awarded')) {
      return
    }

    pointsDigest.value.count += 1
    pointsDigest.value.totalPoints += points
    pointsDigest.value.bonusPoints += bonus
    if (pointsDigestTimer) {
      clearTimeout(pointsDigestTimer)
    }
    pointsDigestTimer = setTimeout(() => {
      pointsDigest.value = {
        count: 0,
        totalPoints: 0,
        bonusPoints: 0,
      }
      pointsDigestTimer = null
    }, 120000)

    const count = pointsDigest.value.count
    const totalPoints = pointsDigest.value.totalPoints
    const totalBonus = pointsDigest.value.bonusPoints
    const extra = totalBonus > 0
      ? `，其中加成 ${totalBonus} 积分`
      : coef > 1
        ? `（夜间系数 x${coef.toFixed(2)}）`
        : ''

    showToastWithSound({
      type: 'task',
      title: count > 1 ? '任务奖励汇总到账' : '积分到账',
      content: count > 1
        ? `最近连续完成 ${count} 个任务，累计到账 ${totalPoints} 积分${extra}`
        : `已到账 +${points} 积分${extra}`,
    }, {
      sound: 'points',
      duration: 5000,
    })
  }

  const handleAdminNotification = (data) => {
    const user = getCurrentUser()
    if (!user || user.role !== 'admin') return

    if (!shouldDisplayRealtimeNotification('system')) {
      return
    }

    showToastWithSound({
      type: 'system',
      title: data?.title || '管理员通知',
      content: data?.content || '',
    }, {
      sound: data?.priority === 'high' ? 'alert' : 'default',
      duration: 5000,
    })
  }

  const handleSystemAlert = (data) => {
    const user = getCurrentUser()
    if (!user || user.role !== 'admin') return

    if (!shouldDisplayRealtimeNotification('system')) {
      return
    }

    showToastWithSound({
      type: 'system',
      title: data?.name || '系统告警',
      content: data?.message || '系统发生新的告警',
    }, {
      sound: 'alert',
      duration: 6000,
    })
  }
  
  /**
   * 处理全局 WebSocket 通知事件
   */
  const handleWSNotification = (event) => {
    const { type, data } = event.detail
    
    switch (type) {
      case 'notification':
        handleNewNotification(data)
        break
      case 'new_task':
        handleNewTask(data)
        break
      case 'task_reviewed':
        handleTaskReviewed(data)
        break
      case 'points_update':
        handlePointsUpdate(data)
        break
      case 'admin_notification':
        handleAdminNotification(data)
        break
      case 'system_alert':
        handleSystemAlert(data)
        break
    }
  }
  
  /**
   * 刷新未读数
   */
  const refreshUnreadCount = async () => {
    try {
      const count = await fetchUnreadCount()
      unreadCount.value = count
    } catch (e) {
      console.warn('[Notification] 刷新未读数失败:', e)
    }
  }
  
  /**
   * 清除未读数（进入通知页面时调用）
   */
  const clearUnreadCount = () => {
    unreadCount.value = 0
  }
  
  /**
   * 关闭通知弹窗
   */
  const closeToast = () => {
    showNotificationToast.value = false
    currentToast.value = null
  }
  
  /**
   * 关闭任务推送弹窗
   */
  const closeTaskPush = () => {
    showTaskPush.value = false
    currentTaskPush.value = null
  }
  
  return {
    // 状态
    unreadCount,
    hasUnread,
    latestNotifications,
    showNotificationToast,
    currentToast,
    showTaskPush,
    currentTaskPush,
    
    // 方法
    initNotification,
    cleanupNotification,
    refreshUnreadCount,
    clearUnreadCount,
    closeToast,
    closeTaskPush
  }
}

/**
 * 全局通知状态（非响应式场景使用）
 */
export const notificationState = {
  unreadCount,
  showNotificationToast,
  currentToast,
  showTaskPush,
  currentTaskPush
}

export default useNotification
