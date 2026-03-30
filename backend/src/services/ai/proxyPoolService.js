/**
 * 代理 IP 池服务 (Redis 共享存储版)
 * 
 * 核心功能:
 * 1. 从青果代理获取 IP
 * 2. Redis 共享 IP 池（支持多进程）
 * 3. IP 有效性检测与自动清理
 * 4. 统计与监控
 */
import { getRedisClient } from '../../utils/redis.js'
import axios from 'axios'
import logger from '../../utils/logger.js'

// 配置
const CONFIG = {
  API_URL: process.env.PROXY_API_URL || 'https://share.proxy.qg.net/get?key=NHR9ADJV',
  IP_TTL_MIN: parseInt(process.env.PROXY_TTL_MIN) || 300,
  IP_TTL_MAX: parseInt(process.env.PROXY_TTL_MAX) || 900,
  USAGE_LIMIT: parseInt(process.env.PROXY_USAGE_LIMIT) || 200,
  WARMUP_COUNT: parseInt(process.env.PROXY_WARMUP_COUNT) || 5
}

// Redis Keys
const KEY = {
  POOL: 'proxy:pool:available',
  IP_INFO: (ip) => `proxy:ip:${ip}:info`,
  STATS: 'proxy:stats'
}

/**
 * 代理池服务类
 */
class ProxyPoolService {
  constructor() {
    this.initialized = false
  }

  /**
   * 初始化
   */
  async init() {
    if (this.initialized) return
    
    const client = await getRedisClient()
    if (!client) {
      logger.warn('[代理池] Redis 未连接')
      return
    }
    
    this.initialized = true
    logger.info('[代理池] 服务初始化完成')
  }

  /**
   * 从青果代理获取新 IP
   */
  async fetchIP() {
    try {
      const response = await axios.get(CONFIG.API_URL, { timeout: 10000 })
      const data = response.data
      
      if (data.code !== 0 || !data.data || data.data.length === 0) {
        logger.error('[代理池] API 返回异常:', JSON.stringify(data))
        return null
      }
      
      const ipInfo = data.data[0]
      const expireTime = new Date(ipInfo.expire_time).getTime()
      const ttl = Math.max(CONFIG.IP_TTL_MIN, Math.min(CONFIG.IP_TTL_MAX, (expireTime - Date.now()) / 1000))
      
      return {
        ip: ipInfo.ip,
        port: ipInfo.port,
        expireTime,
        ttl: Math.floor(ttl),
        proxyUrl: `http://${ipInfo.ip}:${ipInfo.port}`,
        fetchedAt: Date.now()
      }
    } catch (error) {
      logger.error('[代理池] 获取IP失败:', error.message)
      return null
    }
  }

  /**
   * 添加 IP 到池中
   */
  async addIP(ipInfo) {
    const client = await getRedisClient()
    if (!client || !ipInfo) return false
    
    await client.lPush(KEY.POOL, JSON.stringify(ipInfo))
    await client.hSet(KEY.IP_INFO(ipInfo.ip), {
      ip: ipInfo.ip,
      port: ipInfo.port.toString(),
      proxyUrl: ipInfo.proxyUrl,
      expireTime: ipInfo.expireTime.toString(),
      usageCount: '0',
      fetchedAt: ipInfo.fetchedAt.toString()
    })
    
    logger.info(`[代理池] 添加 IP: ${ipInfo.ip}:${ipInfo.port}`)
    return true
  }

  /**
   * 从池中获取 IP
   */
  async getIP() {
    const client = await getRedisClient()
    if (!client) return null
    
    // 尝试获取有效 IP
    let attempts = 0
    const maxAttempts = 10
    
    while (attempts < maxAttempts) {
      const ipJson = await client.rPop(KEY.POOL)
      if (!ipJson) {
        // 池为空，获取新 IP
        const newIP = await this.fetchIP()
        if (newIP) {
          await this.addIP(newIP)
          return newIP
        }
        return null
      }
      
      try {
        const ipInfo = JSON.parse(ipJson)
        
        // 检查是否过期
        if (Date.now() >= ipInfo.expireTime) {
          logger.debug(`[代理池] IP ${ipInfo.ip} 已过期`)
          attempts++
          continue
        }
        
        // 增加使用次数
        const usageCount = await client.hIncrBy(KEY.IP_INFO(ipInfo.ip), 'usageCount', 1)
        
        // 检查使用次数限制
        if (usageCount > CONFIG.USAGE_LIMIT) {
          logger.debug(`[代理池] IP ${ipInfo.ip} 达到使用上限`)
          attempts++
          continue
        }
        
        return ipInfo
      } catch {
        attempts++
      }
    }
    
    return null
  }

  /**
   * 将 IP 放回池中
   */
  async returnIP(ipInfo) {
    const client = await getRedisClient()
    if (!client || !ipInfo) return
    
    // 检查是否过期
    if (Date.now() >= ipInfo.expireTime) {
      logger.debug(`[代理池] IP ${ipInfo.ip} 已过期，不再放回`)
      return
    }
    
    await client.lPush(KEY.POOL, JSON.stringify(ipInfo))
  }

  /**
   * 获取池大小
   */
  async getPoolSize() {
    const client = await getRedisClient()
    if (!client) return 0
    return await client.lLen(KEY.POOL)
  }

  /**
   * 预热 IP 池
   */
  async warmup(count = CONFIG.WARMUP_COUNT) {
    logger.info(`[代理池] 开始预热 ${count} 个 IP`)
    
    for (let i = 0; i < count; i++) {
      const ipInfo = await this.fetchIP()
      if (ipInfo) {
        await this.addIP(ipInfo)
        logger.info(`[代理池] 预热 ${i + 1}/${count}: ${ipInfo.ip}`)
      }
      
      if (i < count - 1) {
        await new Promise(r => setTimeout(r, 1000))
      }
    }
    
    const poolSize = await this.getPoolSize()
    logger.info(`[代理池] 预热完成，池大小: ${poolSize}`)
  }

  /**
   * 清理过期 IP
   */
  async cleanup() {
    const client = await getRedisClient()
    if (!client) return
    
    const poolSize = await client.lLen(KEY.POOL)
    let cleaned = 0
    
    for (let i = 0; i < poolSize; i++) {
      const ipJson = await client.rPop(KEY.POOL)
      if (!ipJson) break
      
      try {
        const ipInfo = JSON.parse(ipJson)
        
        if (Date.now() < ipInfo.expireTime) {
          await client.lPush(KEY.POOL, ipJson)
        } else {
          cleaned++
        }
      } catch {
        cleaned++
      }
    }
    
    if (cleaned > 0) {
      logger.info(`[代理池] 清理 ${cleaned} 个过期 IP`)
    }
  }

  /**
   * 获取统计信息
   */
  async getStats() {
    const client = await getRedisClient()
    if (!client) return {}
    
    return {
      poolSize: await client.lLen(KEY.POOL),
      stats: await client.hGetAll(KEY.STATS)
    }
  }
}

// 单例
const proxyPool = new ProxyPoolService()

export default proxyPool
export { CONFIG, KEY }
