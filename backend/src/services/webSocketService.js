import { WebSocketServer } from 'ws'
import jwt from 'jsonwebtoken'
import onlineUserService from './onlineUserService.js'
import statisticsService from './statisticsService.js'
import logger from '../utils/logger.js'

/**
 * WebSocket 服务 - 生产级版本
 * 
 * 支持 PM2 集群模式：
 * - Redis Pub/Sub 跨实例通信
 * - 实时推送通知
 * - 心跳检测
 * - 自动重连
 */

let wss = null
const clients = new Map() // userId -> WebSocket
let redisClient = null
let redisSubscriber = null
let lastServiceHealth = null  // 缓存最近的服务健康状态

// Redis Pub/Sub 频道
const WS_CHANNEL = 'ws:notify'
const WS_BROADCAST_CHANNEL = 'ws:broadcast'

// JWT 密钥
if (!process.env.JWT_SECRET) { console.warn('⚠️ JWT_SECRET 未设置，WebSocket 认证可能不安全！') }
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-please-change-in-production'

// Redis 配置
const REDIS_ENABLED = process.env.REDIS_HOST && process.env.REDIS_HOST.length > 0

class WebSocketService {
  /**
   * 初始化 WebSocket 服务
   */
  init(server) {
    // 初始化 Redis Pub/Sub（如果可用）
    this.initRedisPubSub()
    this.startTodayTrendBroadcast()
    this.startRealtimeStatsBroadcast()

    wss = new WebSocketServer({ 
      server,
      path: '/ws'
    })

    wss.on('connection', async (ws, req) => {
      let userId = null
      let userLevel = 1
      let userRole = 'user'

      try {
        // 从 URL 参数获取 token
        const fullUrl = req.url
        logger.debug(`WebSocket 连接请求: ${fullUrl}`)
        const url = new URL(req.url, `http://${req.headers.host}`)
        const token = url.searchParams.get('token')

        if (!token) {
          logger.warn('WebSocket 连接被拒绝: 缺少token')
          ws.close(4001, 'Missing token')
          return
        }

        // 验证 token
        const decoded = jwt.verify(token, JWT_SECRET)
        userId = decoded.userId
        userLevel = decoded.level || 1
        userRole = decoded.role || 'user'

        if (!userId) {
          logger.warn(`WebSocket token验证失败: 缺少userId`)
          ws.close(4002, 'Invalid token')
          return
        }

        // 存储客户端连接
        clients.set(userId, ws)

        // 标记用户在线（同时存入 Redis）
        await onlineUserService.heartbeat(userId, { 
          level: userLevel, 
          role: userRole,
          deviceType: 'desktop', // 管理后台默认是电脑
          deviceId: 'admin_web_' + userId
        })
        
        // 广播用户上线状态
        this.broadcastUserStatusChange(userId, true)

        // 绑定用户信息到 ws 对象
        ws.userId = userId
        ws.userLevel = userLevel
        ws.userRole = userRole
        ws.isAlive = true
        ws.connectedAt = Date.now()

        logger.info(`WebSocket 连接成功: 用户 ${userId} (等级:${userLevel}, 角色:${userRole})`)

        // 发送连接成功消息
        this.sendToClient(ws, {
          type: 'connected',
          data: { 
            userId,
            level: userLevel,
            role: userRole,
            timestamp: Date.now()
          }
        })

        // 如果是管理员，立即发送缓存的健康状态
        if (userRole === 'admin' && lastServiceHealth) {
          logger.info(`管理员 ${userId} 连接，发送缓存的健康状态`)
          this.sendToClient(ws, {
            type: 'service_health',
            data: lastServiceHealth,
            timestamp: Date.now()
          })
        }

        if (userRole === 'admin') {
          try {
            const todayTrend = await statisticsService.getTodayRealtimeTrend(10)
            this.sendToClient(ws, {
              type: 'today_realtime_trend',
              data: todayTrend,
              timestamp: Date.now()
            })
            logger.info(`管理员 ${userId} 连接，已即时发送今日实时趋势`)
          } catch (trendError) {
            logger.error(`管理员 ${userId} 初始实时趋势推送失败:`, trendError)
          }
        }

        // 心跳响应
        ws.on('pong', () => {
          ws.isAlive = true
        })

        // 接收消息
        ws.on('message', async (message) => {
          try {
            const msg = JSON.parse(message.toString())
            await this.handleMessage(ws, msg)
          } catch (error) {
            logger.error('WebSocket 消息处理错误:', error.message)
          }
        })

        // 关闭连接
        ws.on('close', async () => {
          if (userId) {
            clients.delete(userId)
            await onlineUserService.offline(userId)
            // 广播用户下线状态
            this.broadcastUserStatusChange(userId, false)
            logger.info(`WebSocket 断开: 用户 ${userId}`)
          }
        })

        // 错误处理
        ws.on('error', (error) => {
          logger.error(`WebSocket 错误 [用户 ${userId}]:`, error.message)
        })

      } catch (error) {
        logger.error('WebSocket 连接错误:', error.message)
        ws.close(4003, 'Connection error')
      }
    })

    // 心跳检测（每 30 秒）
    this.startHeartbeatCheck()

    // 定期清理离线用户（每分钟）
    this.startCleanupTask()

    logger.info(`WebSocket 服务已启动: /ws (Redis Pub/Sub: ${REDIS_ENABLED ? '启用' : '禁用'})`)
    return wss
  }

  /**
   * 初始化 Redis Pub/Sub
   */
  async initRedisPubSub() {
    if (!REDIS_ENABLED) {
      logger.info('Redis 未配置，跳过 Pub/Sub 初始化')
      return
    }

    try {
      const { createClient } = await import('redis')
      
      // 创建订阅客户端
      redisSubscriber = createClient({
        url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`,
        password: process.env.REDIS_PASSWORD || undefined
      })

      await redisSubscriber.connect()
      
      // 订阅频道
      await redisSubscriber.subscribe(WS_CHANNEL, (message) => {
        this.handleRedisMessage(message)
      })

      await redisSubscriber.subscribe(WS_BROADCAST_CHANNEL, (message) => {
        this.handleRedisBroadcast(message)
      })

      // 创建发布客户端
      redisClient = createClient({
        url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`,
        password: process.env.REDIS_PASSWORD || undefined
      })
      await redisClient.connect()

      logger.info('Redis Pub/Sub 初始化成功')
    } catch (error) {
      logger.error('Redis Pub/Sub 初始化失败:', error.message)
      // 继续运行，降级为单实例模式
    }
  }

  /**
   * 处理 Redis 消息（定向推送）
   */
  handleRedisMessage(message) {
    try {
      const { userId, data } = JSON.parse(message)
      // 只推送给本实例的连接
      const ws = clients.get(userId)
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify(data))
      }
    } catch (error) {
      logger.error('处理 Redis 消息错误:', error.message)
    }
  }

  /**
   * 处理 Redis 广播消息
   */
  handleRedisBroadcast(message) {
    try {
      const data = JSON.parse(message)
      const msgStr = JSON.stringify(data)
      
      // 广播给本实例的所有连接
      for (const [userId, ws] of clients) {
        if (ws.readyState === 1) {
          ws.send(msgStr)
        }
      }
    } catch (error) {
      logger.error('处理 Redis 广播错误:', error.message)
    }
  }

  /**
   * 处理客户端消息
   */
  async handleMessage(ws, msg) {
    const { type, data } = msg

    switch (type) {
      case 'heartbeat':
        // 心跳消息
        ws.isAlive = true
        ws.currentPage = data?.currentPage || ''
        await onlineUserService.heartbeat(ws.userId, {
          level: ws.userLevel,
          role: ws.userRole,
          currentPage: ws.currentPage,
          deviceType: data?.deviceType || 'desktop',
          deviceId: data?.deviceId || 'unknown',
          userAgent: data?.userAgent || ''
        })
        
        // 返回心跳响应
        this.sendToClient(ws, {
          type: 'heartbeat_ack',
          data: {
            timestamp: Date.now(),
            onlineCount: await onlineUserService.getOnlineCount()
          }
        })
        break

      case 'ping':
        this.sendToClient(ws, { type: 'pong', data: { timestamp: Date.now() } })
        break


      case "request_health":
        // 管理员请求健康状态
        if (ws.userRole === "admin" && lastServiceHealth) {
          logger.info(`管理员 ${ws.userId} 请求健康状态`)
          this.sendToClient(ws, {
            type: "service_health",
            data: lastServiceHealth,
            timestamp: Date.now()
          })
        }
        break

      default:
        logger.debug(`未知消息类型: ${type}`)
    }
  }

  /**
   * 发送消息给客户端
   */
  sendToClient(ws, message) {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(message))
    }
  }

  /**
   * 广播消息给所有在线用户（集群模式）
   */
  broadcast(message) {
    const msgStr = JSON.stringify(message)
    let count = 0
    
    // 本实例广播
    for (const [userId, ws] of clients) {
      if (ws.readyState === 1) {
        ws.send(msgStr)
        count++
      }
    }
    
    // 通过 Redis 广播到其他实例
    if (redisClient) {
      redisClient.publish(WS_BROADCAST_CHANNEL, msgStr).catch(err => {
        logger.error('Redis 广播失败:', err.message)
      })
    }
    
    return count
  }

  /**
   * 发送消息给特定用户（集群模式）
   */
  sendToUser(userId, message) {
    // 本实例发送
    const ws = clients.get(userId)
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(message))
      return true
    }
    
    // 通过 Redis 发送到其他实例
    if (redisClient) {
      redisClient.publish(WS_CHANNEL, JSON.stringify({ 
        userId, 
        data: message 
      })).catch(err => {
        logger.error('Redis 发送失败:', err.message)
      })
    }
    
    return false
  }

  /**
   * 发送消息给特定角色（集群模式）
   */
  sendToRole(role, message) {
    const msgStr = JSON.stringify(message)
    let count = 0
    
    // 本实例发送
    for (const [userId, ws] of clients) {
      if (ws.userRole === role && ws.readyState === 1) {
        ws.send(msgStr)
        count++
      }
    }
    
    // 通过 Redis 广播（附带角色过滤条件）
    if (redisClient) {
      redisClient.publish(WS_BROADCAST_CHANNEL, JSON.stringify({
        ...message,
        _filter: { role }
      })).catch(err => {
        logger.error('Redis 广播失败:', err.message)
      })
    }
    
    return count
  }

  /**
   * 发送消息给特定等级的用户
   */
  sendToLevel(level, message) {
    const msgStr = JSON.stringify(message)
    let count = 0
    
    for (const [userId, ws] of clients) {
      if (ws.userLevel === level && ws.readyState === 1) {
        ws.send(msgStr)
        count++
      }
    }
    
    return count
  }

  /**
   * 发送审核结果通知给用户
   */
  sendReviewResult(userId, result) {
    return this.sendToUser(userId, {
      type: 'review_result',
      data: result,
      timestamp: Date.now()
    })
  }

  /**
   * 发送新任务通知给所有用户
   */
  sendNewTaskNotification(task) {
    return this.broadcast({
      type: 'new_task',
      data: task,
      timestamp: Date.now()
    })
  }

  /**
   * 发送系统公告
   */
  sendSystemAnnouncement(announcement) {
    return this.broadcast({
      type: 'system_announcement',
      data: announcement,
      timestamp: Date.now()
    })
  }

  /**
   * 广播统计数据更新（用于数据中心实时推送）
   */
  async broadcastStatsUpdate(stats) {
    console.log("[WS] 广播统计数据更新, clients:", this.getClientCount())
    return this.broadcast({
      type: 'stats_update',
      data: stats,
      timestamp: Date.now()
    })
  }
  /**
   * 广播用户状态变化（上线/下线）
   * 用于用户管理页面实时更新
   */
  broadcastUserStatusChange(userId, isOnline, userData = null) {
    const message = {
      type: 'user_status_change',
      data: {
        userId,
        isOnline,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    }
    
    // 如果有用户数据，一并发送
    if (userData) {
      message.data.userData = userData
    }
    
    return this.broadcast(message)
  }

  /**
   * 广播批量用户状态变化
   */
  broadcastUsersStatusChange(changes) {
    return this.broadcast({
      type: 'users_status_change',
      data: {
        changes,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    })
  }

  broadcastToAdmins(message) {
    const msgStr = JSON.stringify(message)
    let count = 0
    for (const [userId, ws] of clients) {
      if (ws.userRole === 'admin' && ws.readyState === 1) {
        ws.send(msgStr)
        count++
      }
    }
    return count
  }

  broadcastAIReviewUpdate(data) {
    return this.broadcastToAdmins({ type: 'ai_review_update', data, timestamp: Date.now() })
  }

  broadcastSystemMetrics(metrics) {
    return this.broadcastToAdmins({ type: 'system_metrics', data: metrics, timestamp: Date.now() })
  }

  broadcastServiceHealth(health) {
    lastServiceHealth = health  // 缓存健康状态
    logger.info(`服务健康状态已缓存`)
    return this.broadcastToAdmins({ type: 'service_health', data: health, timestamp: Date.now() })
  }

  broadcastAlert(alert) {
    return this.broadcastToAdmins({ type: 'system_alert', data: alert, timestamp: Date.now() })
  }

  getClientCount() {
    return clients.size
  }

    /**
   * 心跳检测
   */
  startHeartbeatCheck() {
    setInterval(() => {
      wss?.clients.forEach((ws) => {
        if (!ws.isAlive) {
          if (ws.userId) {
            clients.delete(ws.userId)
            onlineUserService.offline(ws.userId)
            logger.info(`WebSocket 超时断开: 用户 ${ws.userId}`)
            // 广播用户下线状态
            this.broadcastUserStatusChange(ws.userId, false)
          }
          return ws.terminate()
        }
        
        ws.isAlive = false
        ws.ping()
      })
    }, 30000)
  }

  /**
   * 定期清理离线用户
   */
  startCleanupTask() {
    setInterval(async () => {
      await onlineUserService.cleanupOfflineUsers()
    }, 60000)
  }

  /**
   * 获取在线用户数
   */
  getOnlineCount() {
    return clients.size
  }

  /**
   * 获取所有在线用户 ID
   */
  getOnlineUserIds() {
    return Array.from(clients.keys())
  }

  /**
   * 获取所有在线客户端
   */
  getOnlineClients() {
    return clients
  }

  /**
   * 获取在线用户详情列表
   */
  getOnlineUsersDetail() {
    const users = []
    for (const [userId, ws] of clients) {
      users.push({
        userId,
        level: ws.userLevel || 1,
        role: ws.userRole || 'user',
        currentPage: ws.currentPage || '',
        isAlive: ws.isAlive,
        connectedAt: ws.connectedAt
      })
    }
    return users
  }

  /**
   * 启动定时推送今日实时趋势（每 10 分钟）
   */
  startTodayTrendBroadcast() {
    setInterval(async () => {
      try {
        const todayTrend = await statisticsService.getTodayRealtimeTrend(10)

        this.broadcast({
          type: 'today_realtime_trend',
          data: todayTrend,
          timestamp: Date.now()
        })

        logger.debug('已推送今日实时趋势')
      } catch (error) {
        logger.error('推送今日实时趋势失败:', error)
      }
    }, 10 * 60 * 1000)

    logger.info('已启动今日实时趋势定时推送')
  }

  /**
   * 启动定时推送实时统计（每 30 秒）
   */
  startRealtimeStatsBroadcast() {
    setInterval(async () => {
      try {
        const realtimeStats = await statisticsService.getRealtimeStats()

        this.broadcast({
          type: 'realtime_stats',
          data: realtimeStats,
          timestamp: Date.now()
        })

        logger.debug('已推送实时统计')
      } catch (error) {
        logger.error('推送实时统计失败:', error)
      }
    }, 30 * 1000)

    logger.info('已启动实时统计定时推送')
  }

  /**
   * 关闭 WebSocket 服务
   */
  async close() {
    // 关闭 Redis 连接
    if (redisSubscriber) {
      await redisSubscriber.unsubscribe()
      await redisSubscriber.quit()
    }
    if (redisClient) {
      await redisClient.quit()
    }
    
    // 关闭 WebSocket 服务器
    if (wss) {
      wss.close(() => {
        logger.info('WebSocket 服务已关闭')
      })
    }
  }
}

export default new WebSocketService()
