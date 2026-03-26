/**
 * 心跳服务 - 定期上报用户在线状态
 */

import { exposureHeartbeat, exposureOffline } from '../api/task.js'
import { getSavedLocation } from './location.js'

// 心跳配置
const HEARTBEAT_INTERVAL = 30 * 1000 // 30秒上报一次
const HEARTBEAT_KEY = 'xiaohuangyu_heartbeat'
const DEVICE_ID_KEY = 'xiaohuangyu_device_id'

let heartbeatTimer = null
let isRunning = false

/**
 * 生成设备ID
 */
function getDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY)
  if (!deviceId) {
    deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15)
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }
  return deviceId
}

/**
 * 获取当前页面路径
 */
function getCurrentPage() {
  return window.location.pathname
}

/**
 * 发送心跳
 */
async function sendHeartbeat() {
  try {
    const location = getSavedLocation()
    const deviceId = getDeviceId()
    const currentPage = getCurrentPage()
    
    // 从localStorage获取用户等级（如果有）
    const userStr = localStorage.getItem('xiaohuangyu_user')
    let level = 1
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        level = user.level || 1
      } catch (e) {
        // ignore
      }
    }

    const heartbeatData = {
      level,
      city: location?.city || '',
      province: location?.province || '',
      currentPage,
      deviceId
    }

    const result = await exposureHeartbeat(heartbeatData)
    
    // 保存心跳状态
    localStorage.setItem(HEARTBEAT_KEY, JSON.stringify({
      lastHeartbeat: Date.now(),
      success: result.success
    }))

    // 返回曝光额度信息
    if (result.exposureQuota) {
      return result.exposureQuota
    }

    return result
  } catch (error) {
    console.warn('[Heartbeat] 上报失败:', error.message)
    return { success: false, reason: error.message }
  }
}

/**
 * 启动心跳服务
 */
export function startHeartbeat() {
  if (isRunning) {
    console.log('[Heartbeat] 服务已在运行')
    return
  }

  // 检查是否登录
  const token = localStorage.getItem('xiaohuangyu_token')
  if (!token) {
    console.log('[Heartbeat] 未登录，不启动心跳')
    return
  }

  isRunning = true
  console.log('[Heartbeat] 启动心跳服务')

  // 立即发送一次心跳
  sendHeartbeat()

  // 定期发送心跳
  heartbeatTimer = setInterval(() => {
    // 检查登录状态
    const currentToken = localStorage.getItem('xiaohuangyu_token')
    if (!currentToken) {
      stopHeartbeat()
      return
    }
    sendHeartbeat()
  }, HEARTBEAT_INTERVAL)

  // 页面关闭时发送离线通知
  window.addEventListener('beforeunload', handleBeforeUnload)

  // 页面可见性变化时处理
  document.addEventListener('visibilitychange', handleVisibilityChange)
}

/**
 * 停止心跳服务
 */
export function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
  isRunning = false
  console.log('[Heartbeat] 停止心跳服务')

  // 移除事件监听
  window.removeEventListener('beforeunload', handleBeforeUnload)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
}

/**
 * 页面关闭前处理
 */
async function handleBeforeUnload() {
  try {
    // 发送离线通知（使用 navigator.sendBeacon 确保请求能发出）
    const token = localStorage.getItem('xiaohuangyu_token')
    if (token) {
      const BASE = import.meta.env.VITE_API_BASE || '/api'
      navigator.sendBeacon(`${BASE}/exposure/offline`, JSON.stringify({
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }))
    }
  } catch (e) {
    // ignore
  }
}

/**
 * 页面可见性变化处理
 */
function handleVisibilityChange() {
  if (document.hidden) {
    // 页面隐藏，记录时间
    localStorage.setItem('xiaohuangyu_hidden_time', Date.now().toString())
  } else {
    // 页面恢复，检查是否需要发送心跳
    const hiddenTime = localStorage.getItem('xiaohuangyu_hidden_time')
    if (hiddenTime) {
      const elapsed = Date.now() - parseInt(hiddenTime)
      // 如果隐藏超过1分钟，立即发送心跳
      if (elapsed > 60 * 1000) {
        console.log('[Heartbeat] 页面恢复，立即发送心跳')
        sendHeartbeat()
      }
      localStorage.removeItem('xiaohuangyu_hidden_time')
    }
  }
}

/**
 * 检查心跳服务状态
 */
export function getHeartbeatStatus() {
  const heartbeatData = localStorage.getItem(HEARTBEAT_KEY)
  if (!heartbeatData) {
    return { running: isRunning, lastHeartbeat: null, success: false }
  }

  try {
    const data = JSON.parse(heartbeatData)
    return {
      running: isRunning,
      lastHeartbeat: new Date(data.lastHeartbeat),
      success: data.success
    }
  } catch (e) {
    return { running: isRunning, lastHeartbeat: null, success: false }
  }
}

/**
 * 手动发送心跳
 */
export async function triggerHeartbeat() {
  return await sendHeartbeat()
}

export default {
  startHeartbeat,
  stopHeartbeat,
  getHeartbeatStatus,
  triggerHeartbeat
}
