/**
 * WebSocket 服务 - 实时推送
 * 
 * 功能：
 * - 实时通知推送
 * - 新任务提醒
 * - 审核结果通知
 * - 心跳保活
 * - 自动重连
 */

import { ref, computed } from 'vue'

class WebSocketService {
  constructor() {
    this.ws = null
    this.reconnectTimer = null
    this.heartbeatTimer = null
    this.status = 'disconnected'
    this.token = ''
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectDelay = 3000
    this.callbacks = new Map()
    
    // 响应式状态
    this.statusRef = ref('disconnected')
    this.onlineCount = ref(0)
    this.lastHeartbeat = ref(null)
  }

  /**
   * 连接 WebSocket
   */
  connect(token) {
    if (!token) {
      console.warn('[WebSocket] 无 token，跳过连接')
      return
    }

    // 已连接或正在连接，跳过
    if (this.ws?.readyState === WebSocket.OPEN || 
        this.ws?.readyState === WebSocket.CONNECTING) {
      console.log('[WebSocket] 已连接或正在连接，跳过')
      return
    }

    this.token = token
    this.setStatus('connecting')
    
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      const wsUrl = `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`
      
      console.log('[WebSocket] 连接中...', wsUrl.substring(0, 50) + '...')
      
      this.ws = new WebSocket(wsUrl)
      
      this.ws.onopen = () => {
        console.log('[WebSocket] ✅ 连接成功')
        this.setStatus('connected')
        this.reconnectAttempts = 0
        this.startHeartbeat()
      }
      
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          this.handleMessage(msg)
        } catch (e) {
          console.error('[WebSocket] 解析消息失败:', e)
        }
      }
      
      this.ws.onclose = (event) => {
        console.log('[WebSocket] 连接关闭:', event.code, event.reason)
        this.setStatus('disconnected')
        this.stopHeartbeat()
        this.scheduleReconnect()
      }
      
      this.ws.onerror = (error) => {
        console.error('[WebSocket] 连接错误:', error)
        this.setStatus('error')
      }
      
    } catch (error) {
      console.error('[WebSocket] 创建连接失败:', error)
      this.setStatus('error')
      this.scheduleReconnect()
    }
  }

  /**
   * 断开连接
   */
  disconnect() {
    this.stopHeartbeat()
    this.clearReconnectTimer()
    
    if (this.ws) {
      this.ws.close(1000, 'User logout')
      this.ws = null
    }
    
    this.setStatus('disconnected')
    this.token = ''
    console.log('[WebSocket] 已断开连接')
  }

  /**
   * 发送消息
   */
  send(type, data) {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] 未连接，无法发送消息')
      return false
    }
    
    try {
      this.ws.send(JSON.stringify({ type, data }))
      return true
    } catch (e) {
      console.error('[WebSocket] 发送消息失败:', e)
      return false
    }
  }

  /**
   * 订阅消息
   */
  on(type, callback) {
    if (!this.callbacks.has(type)) {
      this.callbacks.set(type, new Set())
    }
    this.callbacks.get(type).add(callback)
    
    // 返回取消订阅函数
    return () => {
      this.callbacks.get(type)?.delete(callback)
    }
  }

  /**
   * 取消订阅
   */
  off(type, callback) {
    if (callback) {
      this.callbacks.get(type)?.delete(callback)
    } else {
      this.callbacks.delete(type)
    }
  }

  /**
   * 获取连接状态
   */
  getStatus() {
    return this.status
  }

  /**
   * 是否已连接
   */
  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN
  }

  // ============ 私有方法 ============

  setStatus(status) {
    this.status = status
    this.statusRef.value = status
  }

  handleMessage(msg) {
    const { type, data } = msg
    
    // 处理系统消息
    switch (type) {
      case 'connected':
        console.log('[WebSocket] 服务器确认连接:', data)
        break
        
      case 'heartbeat_ack':
        this.lastHeartbeat.value = new Date()
        if (data?.onlineCount) {
          this.onlineCount.value = data.onlineCount
        }
        break
        
      case 'pong':
        // 简单 pong 响应
        break
        
      default:
        // 分发给订阅者
        const callbacks = this.callbacks.get(type)
        if (callbacks) {
          callbacks.forEach(cb => {
            try {
              cb(data)
            } catch (e) {
              console.error(`[WebSocket] 回调执行错误 [${type}]:`, e)
            }
          })
        }
        
        // 通用通知处理
        if (type === 'notification' || type === 'new_task' || type === 'task_reviewed') {
          this.handleNotification(type, data)
        }
        
        // 审核结果实时推送
        if (type === 'review_result') {
          this.handleNotification('review_result', data)
          window.dispatchEvent(new CustomEvent('review-result', { detail: data }))
        }
        
        // 积分变动推送
        if (type === 'points_update') {
          this.handleNotification('points_update', data)
          window.dispatchEvent(new CustomEvent('points-update', { detail: data }))
        }
    }
  }

  handleNotification(type, data) {
    // 触发全局通知事件
    window.dispatchEvent(new CustomEvent('ws-notification', {
      detail: { type, data }
    }))
  }

  startHeartbeat() {
    this.stopHeartbeat()
    
    // 每 30 秒发送心跳
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send('heartbeat', { 
          timestamp: Date.now(),
          currentPage: window.location.pathname 
        })
      }
    }, 30000)
    
    // 立即发送一次
    this.send('heartbeat', { timestamp: Date.now() })
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  scheduleReconnect() {
    // 无 token 不重连
    if (!this.token) return
    
    // 达到最大重连次数
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WebSocket] 达到最大重连次数，停止重连')
      return
    }
    
    this.clearReconnectTimer()
    
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts)
    console.log(`[WebSocket] ${delay/1000}秒后重连 (第${this.reconnectAttempts + 1}次)`)
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      this.connect(this.token)
    }, delay)
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}

// 导出单例
export const wsService = new WebSocketService()

// 导出 Vue 组合式 API
export function useWebSocket() {
  const isConnected = computed(() => wsService.statusRef.value === 'connected')
  const status = computed(() => wsService.statusRef.value)
  const onlineCount = computed(() => wsService.onlineCount.value)
  
  return {
    wsService,
    isConnected,
    status,
    onlineCount,
    connect: wsService.connect.bind(wsService),
    disconnect: wsService.disconnect.bind(wsService),
    send: wsService.send.bind(wsService),
    on: wsService.on.bind(wsService),
    off: wsService.off.bind(wsService)
  }
}

export default wsService
