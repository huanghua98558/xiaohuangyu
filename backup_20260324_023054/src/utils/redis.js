/**
 * Redis 工具 - 修复版（严格单例模式）
 * 修复内容：
 * 1. 确保全局只创建一个 Redis 连接
 * 2. 防止并发创建多个连接
 * 3. 添加连接健康检查
 */
import { createClient } from 'redis'
import logger from './logger.js'

// Redis 配置
const REDIS_HOST = process.env.REDIS_HOST
const REDIS_PORT = process.env.REDIS_PORT || 6379
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined

// 是否启用 Redis
const REDIS_ENABLED = !!REDIS_HOST

// ============ P0 修复：严格单例模式 ============
// 全局 Redis 客户端（只创建一次）
let redisClient = null

// 连接状态
let isConnected = false

// 防止并发创建的 Promise
let connectPromise = null

// 连接创建时间（用于健康检查）
let connectionCreatedAt = null
// ===========================================

/**
 * 获取 Redis 客户端（单例入口）
 * 确保全局只创建一个连接
 */
async function getRedisClient() {
  // 如果已连接且健康，直接返回
  if (redisClient && isConnected && isConnectionHealthy()) {
    return redisClient
  }
  
  // 如果正在连接，等待完成
  if (connectPromise) {
    return connectPromise
  }
  
  // 开始创建新连接
  connectPromise = (async () => {
    try {
      if (!REDIS_ENABLED) {
        logger.info('Redis 未配置，使用无缓存模式')
        return null
      }
      
      logger.info('正在连接 Redis...')
      
      const REDIS_URL = `redis://${REDIS_HOST}:${REDIS_PORT}`
      
      redisClient = createClient({
        url: REDIS_URL,
        password: REDIS_PASSWORD,
        // 连接池配置
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('Redis 重连失败，放弃')
              return new Error('Redis 重连失败')
            }
            const delay = Math.min(retries * 100, 3000)
            logger.info(`Redis 重连中... (${retries}/10), ${delay}ms 后重试`)
            return delay
          }
        }
      })
      
      // 事件监听
      redisClient.on('connect', () => {
        logger.info('Redis 连接中...')
      })
      
      redisClient.on('ready', () => {
        isConnected = true
        connectionCreatedAt = Date.now()
        logger.info(`✅ Redis 连接成功 (单例模式)`)
      })
      
      redisClient.on('error', (err) => {
        logger.error('Redis 错误:', err.message)
        isConnected = false
      })
      
      redisClient.on('close', () => {
        isConnected = false
        logger.info('Redis 连接关闭')
      })
      
      redisClient.on('reconnecting', () => {
        logger.info('Redis 重连中...')
      })
      
      // 等待连接完成
      await redisClient.connect()
      
      return redisClient
    } catch (error) {
      logger.warn('Redis 连接失败，使用无缓存模式:', error.message)
      isConnected = false
      redisClient = null
      return null
    } finally {
      // 清除 Promise，允许下次连接
      connectPromise = null
    }
  })()
  
  return connectPromise
}

/**
 * 检查连接是否健康
 */
function isConnectionHealthy() {
  if (!redisClient || !isConnected) {
    return false
  }
  
  // 检查连接是否超过 24 小时（可选：定期重建连接）
  const maxConnectionAge = 24 * 60 * 60 * 1000 // 24 小时
  if (connectionCreatedAt && (Date.now() - connectionCreatedAt) > maxConnectionAge) {
    logger.info('Redis 连接超过 24 小时，建议重建')
    // 不立即断开，等待下次调用时重建
  }
  
  return true
}

/**
 * 连接 Redis（对外接口）
 */
async function connectRedis() {
  const client = await getRedisClient()
  return client !== null
}

/**
 * 断开 Redis 连接（用于优雅关闭）
 */
async function disconnectRedis() {
  if (redisClient && isConnected) {
    try {
      await redisClient.quit()
      logger.info('Redis 连接已关闭')
      redisClient = null
      isConnected = false
      connectionCreatedAt = null
    } catch (error) {
      logger.error('关闭 Redis 连接失败:', error.message)
    }
  }
}

// ============ 缓存工具函数 ============
export const cache = {
  /**
   * 获取缓存
   */
  async get(key) {
    const client = await getRedisClient()
    if (!client || !isConnected) {
      return null
    }
    try {
      const data = await client.get(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      logger.error(`缓存获取失败 [${key}]:`, error.message)
      return null
    }
  },

  /**
   * 设置缓存
   */
  async set(key, value, ttlSeconds = 300) {
    const client = await getRedisClient()
    if (!client || !isConnected) {
      return false
    }
    try {
      await client.setEx(key, ttlSeconds, JSON.stringify(value))
      return true
    } catch (error) {
      logger.error(`缓存设置失败 [${key}]:`, error.message)
      return false
    }
  },

  /**
   * 删除缓存
   */
  async del(key) {
    const client = await getRedisClient()
    if (!client || !isConnected) {
      return false
    }
    try {
      await client.del(key)
      return true
    } catch (error) {
      logger.error(`缓存删除失败 [${key}]:`, error.message)
      return false
    }
  },

  /**
   * 删除匹配的缓存
   */
  async delPattern(pattern) {
    const client = await getRedisClient()
    if (!client || !isConnected) {
      return false
    }
    try {
      const keys = await client.keys(pattern)
      if (keys.length > 0) {
        await client.del(keys)
      }
      return true
    } catch (error) {
      logger.error(`缓存批量删除失败 [${pattern}]:`, error.message)
      return false
    }
  },

  /**
   * 检查 Redis 是否可用
   */
  isReady() {
    return isConnected
  },
  
  /**
   * 获取 Redis 客户端（高级用法）
   */
  async getClient() {
    return await getRedisClient()
  }
}

// ============ 发布订阅模式（单例） ============
let pubClient = null
let subClient = null

/**
 * 获取发布客户端（单例）
 */
async function getPubClient() {
  if (!pubClient) {
    const client = await getRedisClient()
    if (client) {
      pubClient = client.duplicate()
      await pubClient.connect()
      logger.info('Redis 发布客户端已创建')
    }
  }
  return pubClient
}

/**
 * 获取订阅客户端（单例）
 */
async function getSubClient() {
  if (!subClient) {
    const client = await getRedisClient()
    if (client) {
      subClient = client.duplicate()
      await subClient.connect()
      logger.info('Redis 订阅客户端已创建')
    }
  }
  return subClient
}

// ============ 优雅关闭 ============
process.on('SIGINT', async () => {
  await disconnectRedis()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await disconnectRedis()
  process.exit(0)
})

process.on('beforeExit', async () => {
  await disconnectRedis()
})

// ============ 导出 ============
export { 
  redisClient, 
  connectRedis, 
  disconnectRedis, 
  REDIS_ENABLED,
  getRedisClient,
  getPubClient,
  getSubClient
}
export default cache
