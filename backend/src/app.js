// BigInt JSON 序列化支持
BigInt.prototype.toJSON = function() { return this.toString() }
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import rateLimit from 'express-rate-limit'

// 导入路由
import userRoutes from './routes/userRoutes.js'
import blockedAccountsRoutes from './routes/blockedAccountsRoutes.js'
import taskRoutes from './routes/taskRoutes.js'
import walletRoutes from './routes/walletRoutes.js'
import uploadRoutes from './routes/uploadRoutes.js'
import locationRoutes from './routes/locationRoutes.js'
import levelRoutes from './routes/levelRoutes.js'
import promotionRoutes from './routes/promotionRoutes.js'
import leaderboardRoutes from './routes/leaderboardRoutes.js'
import leaderboardSnapshotRoutes from './routes/leaderboardSnapshotRoutes.js'
import adminNewRoutes from './routes/adminRoutes.js'
import nightPointRoutes from './routes/nightPointRoutes.js'
import userDetailRoutes from './routes/userDetailRoutes.js'
import notificationRoutes from './routes/notificationRoutes.js'
import userNotificationRoutes from './routes/userNotificationRoutes.js'
import signInRoutes from './routes/signInRoutes.js'
import achievementRoutes from './routes/achievementRoutes.js'
import taskTemplateRoutes from './routes/taskTemplateRoutes.js'
import operationLogRoutes from './routes/operationLogRoutes.js'
import systemLogRoutes from './routes/systemLogRoutes.js'
import publisherRoutes from './routes/publisherRoutes.js'
import aiRoutes from './routes/aiRoutes.js'
import internalRoutes from './routes/internalRoutes.js'
import ipMonitorRoutes from './routes/ipMonitorRoutes.js'
import pointsRewardRoutes from './routes/pointsRewardRoutes.js'
import statisticsRoutes from './routes/statisticsRoutes.js'
import exposureRoutes from './routes/exposureRoutes.js'
import monitorRoutes from './routes/monitorRoutes.js'
import settingsRoutes from './routes/settingsRoutes.js'
import cronService from './services/cronService.js'
import exposureCron from './services/exposureCron.js'
import webSocketService from './services/webSocketService.js'
import nightPointService from './services/nightPointService.js'

// 导入中间件
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js'
import { connectRedis } from './utils/redis.js'
import logger from './utils/logger.js'
import { runSeedIfNeeded } from './utils/seed.js'
import { initDefaultConfigs } from './services/ai/index.js'
import db from './config/database.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()

// 信任代理（用于反向代理环境）
app.set('trust proxy', 1)

// ============ 中间件配置 ============

// CORS配置
app.use(cors({
  origin: ["https://www.web3alpha.cn", "http://localhost:3000", "http://localhost:3001", "http://localhost:5000"],
  credentials: true
}))

// JSON解析
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// 静态文件服务（上传的文件）
app.use('/uploads', express.static(process.env.LOCAL_STORAGE_DIR || '/data/images/uploads'))

// ============ 用户端静态文件服务 ============
// v3.0 架构：后端同时托管用户端和管理后台静态文件
const userStaticPath = path.join(__dirname, '../public/user')
if (fs.existsSync(userStaticPath)) {
  app.use(express.static(userStaticPath, { index: false }))
}

// ============ 管理后台静态文件服务 ============
// 部署模式：管理后台构建为静态文件，由后端托管
const adminStaticPath = path.join(__dirname, '../public/admin')
if (fs.existsSync(adminStaticPath)) {
  // 管理后台静态资源
  app.use('/admin', express.static(adminStaticPath, { index: false }))
  // Next.js静态资源（/_next路径）
  app.use('/_next', express.static(path.join(adminStaticPath, '_next')))
}

// 请求日志
app.use((req, res, next) => {
  // 上传接口记录更多信息
  if (req.path.startsWith('/api/upload')) {
    logger.info(`[Upload] ${req.method} ${req.path}`, {
      ip: req.ip,
      userId: req.userId,
      contentType: req.headers['content-type']?.substring(0, 50)
    })
  } else {
    logger.debug(`${req.method} ${req.path}`, {
      ip: req.ip,
      userId: req.userId
    })
  }
  next()
})

// API限流
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000, // 每个IP最多1000次请求（开发环境放宽限制）
  message: {
    code: 429,
    message: '请求过于频繁，请稍后再试',
    data: null
  },
  standardHeaders: true,
  legacyHeaders: false
})

// 严格的限流（登录、注册等敏感接口）
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个IP最多100次请求
  message: {
    code: 429,
    message: '请求过于频繁，请稍后再试',
    data: null
  }
})

// ============ 路由配置 ============

async function buildHealthSnapshot() {
  const timestamp = new Date().toISOString()
  let dbConnected = false
  let redisConnected = false
  let taskCount = 0
  const details = {}

  try {
    await db.query('SELECT 1')
    dbConnected = true
    const countResult = await db.query('SELECT COUNT(*)::int AS count FROM tasks')
    taskCount = Number(countResult.rows?.[0]?.count || 0)
  } catch (error) {
    details.databaseError = error.message
  }

  try {
    redisConnected = await connectRedis()
  } catch (error) {
    details.redisError = error.message
  }

  return {
    status: dbConnected ? 'ok' : 'error',
    timestamp,
    db: dbConnected ? 'connected' : 'error',
    tasks: taskCount,
    services: {
      database: dbConnected,
      redis: redisConnected,
    },
    database: {
      type: 'cockroachdb',
      connected: dbConnected,
      taskCount,
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    },
    redis: {
      connected: redisConnected,
    },
    details,
  }
}

// 健康检查
app.get('/health', async (req, res) => {
  try {
    const snapshot = await buildHealthSnapshot()
    res.status(snapshot.status === 'ok' ? 200 : 503).json(snapshot)
  } catch (e) {
    logger.error('健康检查异常:', e)
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      db: 'error',
      services: {
        database: false,
        redis: false,
      },
      database: {
        type: 'cockroachdb',
        connected: false,
        taskCount: 0,
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      },
      redis: {
        connected: false,
      },
      error: e.message,
    })
  }
})

// API健康检查
app.get('/api/health', async (req, res) => {
  const snapshot = await buildHealthSnapshot()
  res.status(snapshot.status === 'ok' ? 200 : 503).json(snapshot)
})

// API路由
app.use('/api/auth', authLimiter, userRoutes)
app.use('/api/tasks', apiLimiter, taskRoutes)
app.use('/api/my', apiLimiter, taskRoutes)
app.use('/api/user', apiLimiter, userRoutes)  // 用户相关路由（包含排行榜）
app.use('/api/settings', apiLimiter, settingsRoutes)  // 用户设置路由（主题等）
app.use('/api/wallet', apiLimiter, walletRoutes)  // 钱包相关路由
app.use('/api/upload', apiLimiter, uploadRoutes)
app.use('/api/location', apiLimiter, locationRoutes)  // 位置解析路由
app.use('/api/level', apiLimiter, levelRoutes)  // 等级系统路由
app.use('/api/promotion', apiLimiter, promotionRoutes)  // 推广系统路由
app.use('/api/leaderboard', apiLimiter, leaderboardRoutes)  // 排行榜路由
app.use('/api/leaderboard/snapshots', apiLimiter, leaderboardSnapshotRoutes)  // 排行榜快照路由
app.use('/api/admin-v2', apiLimiter, adminNewRoutes)  // 管理后台V2路由
app.use('/api/night-points', apiLimiter, nightPointRoutes)  // 夜间积分路由

// 新增功能路由
app.use('/api/admin-v2/templates', apiLimiter, taskTemplateRoutes)  // 任务模板路由
app.use('/api/admin-v2/operation-logs', apiLimiter, operationLogRoutes)  // 操作日志路由
app.use('/api/admin-v2/logs', apiLimiter, systemLogRoutes)  // 统一系统日志路由
app.use('/api/publisher', apiLimiter, publisherRoutes)  // 发布者/审核员路由
app.use('/api/notifications', apiLimiter, notificationRoutes)  // 消息通知路由
app.use('/api/user-notifications', apiLimiter, userNotificationRoutes)
app.use('/api/blocked-accounts', apiLimiter, blockedAccountsRoutes)  // 封控账号管理路由
app.use('/api/sign-in', apiLimiter, signInRoutes)
app.use('/api/achievements', apiLimiter, achievementRoutes)  // 成就系统路由  // 签到路由

app.use('/api/internal', internalRoutes)  // 内部服务 API（无认证）
app.use('/api/ip-monitor', ipMonitorRoutes)  // IP 监控 API
app.use('/api/ai', apiLimiter, aiRoutes)  // AI服务路由
app.use('/api/admin-v2/points-rewards', apiLimiter, pointsRewardRoutes)  // 积分奖励统计路由
app.use('/api/admin/statistics', apiLimiter, statisticsRoutes)  // 统计分析路由
app.use('/api/exposure', apiLimiter, exposureRoutes)  // 曝光控制路由
app.use('/api/monitor', apiLimiter, monitorRoutes)  // 系统监控路由
app.use('/api/user-detail', apiLimiter, userDetailRoutes)  // 用户详情路由（管理员）

// 兼容旧API路径
app.use('/api/my/tasks', apiLimiter, (req, res, next) => {
  // 转发到 taskRoutes
  req.url = req.originalUrl.replace('/api/my/tasks', '/api/tasks/my')
  return taskRoutes(req, res, next)
})

// ============ 用户端 SPA 路由回退 ============

// PWA 相关文件不进行 SPA 回退
const isPWAFile = (pathname) => {
  const pwaPaths = [
    '/manifest.webmanifest',
    '/manifest.json',
    '/sw.js',
    '/registerSW.js',
  ]
  // 精确匹配 PWA 文件
  if (pwaPaths.includes(pathname)) return true
  // workbox 文件前缀匹配
  if (pathname.startsWith('/workbox-')) return true
  return false
}

// 用户端和管理后台 SPA 回退
app.get('*', (req, res, next) => {
  // 跳过 API 路径
  if (req.path.startsWith('/api')) {
    return next()
  }
  // 跳过上传文件路径
  if (req.path.startsWith('/uploads')) {
    return next()
  }
  // 跳过 PWA 相关文件
  if (isPWAFile(req.path)) {
    return next()
  }
  // 跳过静态资源文件
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|html)$/i)) {
    return next()
  }
  
  // 管理后台 SPA 回退（/admin 路径）
  if (req.path.startsWith('/admin')) {
    const adminIndexPath = path.join(__dirname, '../public/admin/index.html')
    if (fs.existsSync(adminIndexPath)) {
      return res.sendFile(adminIndexPath)
    }
  }
  
  // 用户端 SPA 回退
  const indexPath = path.join(__dirname, '../public/user/index.html')
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath, (err) => {
      if (err) {
        next()
      }
    })
  }
  
  // 如果没有用户端，返回 API 信息
  res.json({
    name: '小黄鱼任务中心 API',
    version: '3.0',
    endpoints: {
      api: '/api',
      health: '/health',
      websocket: '/ws'
    }
  })
})

// ============ 错误处理 ============

// 404处理
app.use(notFoundHandler)

// 全局错误处理
app.use(errorHandler)

// ============ 启动服务 ============
// v3.0 架构端口配置：
// - 后端 API 服务：端口 8080
// - 管理后台服务：端口 5001（独立 Next.js 服务）
// - 用户端：由 Nginx 托管静态文件
const getPort = () => {
  const envPort = process.env.PORT
  
  // 如果 PORT 存在且不是系统保留端口，使用它（部署环境）
  if (envPort && envPort !== '9000') {
    return parseInt(envPort, 10)
  }
  
  // 开发环境：使用 BACKEND_PORT 或默认 8080
  return process.env.BACKEND_PORT ? parseInt(process.env.BACKEND_PORT, 10) : 8080
}
const PORT = getPort()

async function startServer() {
  // 立即启动 HTTP 服务（确保端口监听，满足 FAAS 30秒限制）
  const server = 

app.listen(PORT, () => {
    logger.info(`========================================`)
    logger.info(`小黄鱼后端服务已启动 (v3.0 独立服务模式)`)
    logger.info(`========================================`)
    logger.info(`HTTP Server: http://localhost:${PORT}`)
    logger.info(`WebSocket: ws://localhost:${PORT}/ws`)
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`)
    logger.info(`========================================`)
    logger.info(`管理后台请访问: http://localhost:5001/admin`)
    logger.info(`========================================`)
  })
  
  // 初始化 WebSocket 服务
  webSocketService.init(server)
  
  // 后台异步执行初始化（不阻塞端口监听）
  ;(async () => {
    try {
      // 按需初始化数据库（仅在数据为空时执行）
      await runSeedIfNeeded()
      
      // 连接Redis
      await connectRedis()
      
      // 初始化夜间积分表
      await nightPointService.initTables()
      
      // 初始化AI配置
      await initDefaultConfigs()
      
      // 启动定时任务
      cronService.start()
      // 启动统计数据实时推送
      cronService.startStatsBroadcast(webSocketService)
      
      // 启动曝光控制定时任务
      exposureCron.start()
      
      logger.info('后台初始化完成')
    } catch (error) {
      logger.error('后台初始化失败:', error)
      // 不退出进程，允许服务继续运行
    }
  })()
}

startServer()

export default app



