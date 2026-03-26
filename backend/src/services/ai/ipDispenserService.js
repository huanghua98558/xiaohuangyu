/**
 * IP 发放服务 (Redis 共享存储版)
 * 
 * 支持多进程共享 IP 池，适用于 PM2 Cluster 模式
 * 
 * Redis Key 设计:
 * - proxy:pool:available    → List: 可用 IP 池
 * - proxy:ip:{ip}:info      → Hash: IP 详细信息
 * - proxy:mode              → String: 当前模式 (direct/proxy)
 * - proxy:mode:cooldown     → String: 模式冷却结束时间
 * - proxy:direct:failCount  → String: 直连连续失败次数
 * - proxy:stats             → Hash: 统计信息
 */
import { getRedisClient } from '../../utils/redis.js'
import axios from 'axios'
import logger from '../../utils/logger.js'

// ============ 配置 ============
const CONFIG = {
  // 青果代理 API
  API_URL: process.env.PROXY_API_URL || 'https://share.proxy.qg.net/get?key=NHR9ADJV',
  
  // 智能切换参数
  QUEUE_THRESHOLD: parseInt(process.env.PROXY_QUEUE_THRESHOLD) || 20,        // 队列积压阈值
  DIRECT_FAIL_LIMIT: parseInt(process.env.PROXY_DIRECT_FAIL_LIMIT) || 3,     // 直连连续失败阈值
  DIRECT_COOLDOWN: parseInt(process.env.PROXY_DIRECT_COOLDOWN) || 30,        // 切换代理后冷却(分钟)
  CAPTCHA_COOLDOWN: parseInt(process.env.PROXY_CAPTCHA_COOLDOWN) || 60,      // 遇验证码冷却(分钟)
  
  // IP 管理
  IP_TTL_MIN: parseInt(process.env.PROXY_TTL_MIN) || 300,                    // IP 最小有效期(秒)
  IP_TTL_MAX: parseInt(process.env.PROXY_TTL_MAX) || 900,                    // IP 最大有效期(秒)
  IP_USAGE_LIMIT: parseInt(process.env.PROXY_USAGE_LIMIT) || 200,            // 每 IP 使用次数上限
  
  // 模式
  DEFAULT_MODE: process.env.PROXY_MODE || 'auto'                             // auto/direct/proxy
}

// Redis Key 前缀
const KEY = {
  POOL: 'proxy:pool:available',
  IP_INFO: (ip) => `proxy:ip:${ip}:info`,
  MODE: 'proxy:mode',
  MODE_COOLDOWN: 'proxy:mode:cooldown',
  DIRECT_FAIL: 'proxy:direct:failCount',
  STATS: 'proxy:stats',
  DIRECT_LAST_SUCCESS: 'proxy:direct:lastSuccess'
}

/**
 * IP 发放服务类
 */
class IPDispenserService {
  constructor() {
    this.initialized = false
    this.lastFetchTime = 0
    this.FETCH_INTERVAL = 60 * 1000  // 每 60 秒检查一次 IP 池
  }

  /**
   * 初始化服务
   */
  async init() {
    if (this.initialized) return
    
    try {
      const client = await getRedisClient()
      if (!client) {
        logger.warn('[IP发放] Redis 未连接，使用降级模式')
        return
      }
      
      // 设置初始模式
      const currentMode = await client.get(KEY.MODE)
      if (!currentMode) {
        await client.set(KEY.MODE, CONFIG.DEFAULT_MODE)
      }
      
      // 初始化统计
      await client.hSet(KEY.STATS, {
        totalIPs: 0,
        usedIPs: 0,
        directRequests: 0,
        proxyRequests: 0,
        captchaHits: 0,
        modeSwitches: 0
      })
      
      this.initialized = true
      logger.info('[IP发放] 服务初始化完成', { mode: CONFIG.DEFAULT_MODE })
    } catch (error) {
      logger.error('[IP发放] 初始化失败:', error.message)
    }
  }

  /**
   * 获取当前模式
   * @returns {Promise<'direct'|'proxy'>}
   */
  async getCurrentMode() {
    const client = await getRedisClient()
    if (!client) return 'direct'
    
    const mode = await client.get(KEY.MODE) || 'direct'
    
    // 检查冷却期
    const cooldownEnd = await client.get(KEY.MODE_COOLDOWN)
    if (cooldownEnd && Date.now() < parseInt(cooldownEnd)) {
      return mode  // 冷却期内，保持当前模式
    }
    
    return mode
  }

  /**
   * 切换模式
   * @param {'direct'|'proxy'} newMode
   * @param {number} cooldownMinutes 冷却时间(分钟)
   */
  async switchMode(newMode, cooldownMinutes = CONFIG.DIRECT_COOLDOWN) {
    const client = await getRedisClient()
    if (!client) return
    
    const oldMode = await client.get(KEY.MODE)
    if (oldMode === newMode) return
    
    await client.set(KEY.MODE, newMode)
    await client.set(KEY.MODE_COOLDOWN, Date.now() + cooldownMinutes * 60 * 1000)
    
    // 重置失败计数
    await client.set(KEY.DIRECT_FAIL, '0')
    
    // 更新统计
    await client.hIncrBy(KEY.STATS, 'modeSwitches', 1)
    
    logger.warn(`[IP发放] 模式切换: ${oldMode} → ${newMode}, 冷却 ${cooldownMinutes} 分钟`)
  }

  /**
   * 检查是否需要切换到代理模式
   * @param {number} queueSize 当前队列大小
   * @returns {Promise<boolean>}
   */
  async shouldSwitchToProxy(queueSize) {
    const client = await getRedisClient()
    if (!client) return false
    
    const mode = await this.getCurrentMode()
    if (mode === 'proxy') return false  // 已经是代理模式
    
    // 检查冷却期
    const cooldownEnd = await client.get(KEY.MODE_COOLDOWN)
    if (cooldownEnd && Date.now() < parseInt(cooldownEnd)) {
      return false  // 冷却期内不切换
    }
    
    // 条件 1: 队列积压
    if (queueSize >= CONFIG.QUEUE_THRESHOLD) {
      logger.warn(`[IP发放] 触发切换: 队列积压 ${queueSize} >= ${CONFIG.QUEUE_THRESHOLD}`)
      return true
    }
    
    // 条件 2: 直连连续失败
    const failCount = parseInt(await client.get(KEY.DIRECT_FAIL) || '0')
    if (failCount >= CONFIG.DIRECT_FAIL_LIMIT) {
      logger.warn(`[IP发放] 触发切换: 连续失败 ${failCount} >= ${CONFIG.DIRECT_FAIL_LIMIT}`)
      return true
    }
    
    return false
  }

  /**
   * 报告直连失败
   */
  async reportDirectFailure() {
    const client = await getRedisClient()
    if (!client) return
    
    const failCount = await client.incr(KEY.DIRECT_FAIL)
    logger.warn(`[IP发放] 直连失败次数: ${failCount}/${CONFIG.DIRECT_FAIL_LIMIT}`)
    
    if (failCount >= CONFIG.DIRECT_FAIL_LIMIT) {
      await this.switchMode('proxy', CONFIG.DIRECT_COOLDOWN)
    }
  }

  /**
   * 报告直连成功
   */
  async reportDirectSuccess() {
    const client = await getRedisClient()
    if (!client) return
    
    await client.set(KEY.DIRECT_FAIL, '0')
  }

  /**
   * 报告遇到验证码
   */
  async reportCaptcha() {
    const client = await getRedisClient()
    if (!client) return
    
    await client.hIncrBy(KEY.STATS, 'captchaHits', 1)
    await this.switchMode('proxy', CONFIG.CAPTCHA_COOLDOWN)
    
    logger.warn(`[IP发放] 遇到验证码，切换代理模式，冷却 ${CONFIG.CAPTCHA_COOLDOWN} 分钟`)
  }

  /**
   * 从青果代理获取新 IP
   * @returns {Promise<Object|null>}
   */
  async fetchNewIP() {
    try {
      const response = await axios.get(CONFIG.API_URL, { timeout: 10000 })
      const data = response.data
      
      // 青果代理返回格式: {code: "SUCCESS", data: [{proxy_ip, server, area, isp, deadline}]}
      if (data.code !== 'SUCCESS' || !data.data || data.data.length === 0) {
        logger.error('[IP发放] 青果API返回异常:', JSON.stringify(data))
        return null
      }
      
      const ipInfo = data.data[0]
      
      // server 是代理地址，格式为 "IP:端口"
      const [proxyHost, proxyPort] = ipInfo.server.split(':')
      
      // deadline 是过期时间字符串，格式为 "2023-02-25 15:38:36"
      const expireTime = new Date(ipInfo.deadline).getTime()
      const ttl = Math.max(CONFIG.IP_TTL_MIN, Math.min(CONFIG.IP_TTL_MAX, (expireTime - Date.now()) / 1000))
      
      return {
        ip: ipInfo.proxy_ip,           // 真实出口IP
        port: proxyPort,               // 代理端口
        server: ipInfo.server,         // 代理地址（IP:端口）
        area: ipInfo.area,             // 地区
        isp: ipInfo.isp,               // 运营商
        expireTime,
        ttl: Math.floor(ttl),
        proxyUrl: `http://${ipInfo.server}`,  // 代理URL
        fetchedAt: Date.now()
      }
    } catch (error) {
      logger.error('[IP发放] 获取新IP失败:', error.message)
      return null
    }
  }

  /**
   * 获取一个可用 IP

  /**
   * 获取一个可用 IP
   * @param {number} queueSize 当前队列大小
   * @returns {Promise<Object|null>} { proxyUrl, mode, ip }
   */

  /**
   * 获取一个代理 IP (别名方法)
   */
  async acquireIP(queueSize = 0) {
    return await this.getIP(queueSize)
  }

  async getIP(queueSize = 0) {
    await this.init()
    const client = await getRedisClient()
    
    // 检查是否需要切换模式
    if (await this.shouldSwitchToProxy(queueSize)) {
      await this.switchMode('proxy', CONFIG.DIRECT_COOLDOWN)
    }
    
    const mode = await this.getCurrentMode()
    
    // 直连模式
    if (mode === 'direct') {
      await client.hIncrBy(KEY.STATS, 'directRequests', 1)
      return { proxyUrl: null, mode: 'direct', ip: null }
    }
    
    // 代理模式 - 从池中获取
    let ipInfo = await this.popFromPool()
    
    // 池中无可用 IP，获取新的
    if (!ipInfo) {
      logger.info('[IP发放] IP池为空，获取新IP...')
      ipInfo = await this.fetchNewIP()
    }
    
    if (!ipInfo) {
      logger.error('[IP发放] 无法获取IP，降级直连')
      return { proxyUrl: null, mode: 'direct', ip: null }
    }
    
    // 检查是否过期
    if (Date.now() >= ipInfo.expireTime) {
      logger.warn(`[IP发放] IP ${ipInfo.ip} 已过期，获取新IP`)
      ipInfo = await this.fetchNewIP()
    }
    
    if (!ipInfo) {
      return { proxyUrl: null, mode: 'direct', ip: null }
    }
    
    // 更新统计
    await client.hIncrBy(KEY.STATS, 'proxyRequests', 1)
    await client.hIncrBy(KEY.STATS, 'usedIPs', 1)
    
    return { proxyUrl: ipInfo.proxyUrl, mode: 'proxy', ip: ipInfo.ip }
  }

  /**
   * 从池中弹出一个 IP
   * @returns {Promise<Object|null>}
   */

  /**
   * 获取一个代理 IP (别名方法)
   */
  async acquireIP(queueSize = 0) {
    return await this.getIP(queueSize)
  }

  async popFromPool() {
    const client = await getRedisClient()
    if (!client) return null
    
    const ipJson = await client.rPop(KEY.POOL)
    if (!ipJson) return null
    
    try {
      return JSON.parse(ipJson)
    } catch {
      return null
    }
  }

  /**
   * 将 IP 放回池中
   * @param {Object} ipInfo
   */
  async returnToPool(ipInfo) {
    const client = await getRedisClient()
    if (!client || !ipInfo) return
    
    // 检查使用次数
    const usageCount = await this.getUsageCount(ipInfo.ip)
    if (usageCount >= CONFIG.IP_USAGE_LIMIT) {
      logger.info(`[IP发放] IP ${ipInfo.ip} 达到使用上限 ${usageCount}/${CONFIG.IP_USAGE_LIMIT}，不再放回`)
      return
    }
    
    // 检查有效期
    if (Date.now() >= ipInfo.expireTime) {
      logger.info(`[IP发放] IP ${ipInfo.ip} 已过期，不再放回`)
      return
    }
    
    await client.lPush(KEY.POOL, JSON.stringify(ipInfo))
    logger.debug(`[IP发放] IP ${ipInfo.ip} 放回池中`)
  }

  /**
   * 获取 IP 使用次数
   * @param {string} ip
   */
  async getUsageCount(ip) {
    const client = await getRedisClient()
    if (!client) return 0
    
    const count = await client.hGet(KEY.IP_INFO(ip), 'usageCount')
    return parseInt(count || '0')
  }

  /**
   * 增加使用次数
   * @param {string} ip
   */
  async incrementUsage(ip) {
    const client = await getRedisClient()
    if (!client) return
    
    await client.hIncrBy(KEY.IP_INFO(ip), 'usageCount', 1)
    await client.hSet(KEY.IP_INFO(ip), 'lastUsed', Date.now().toString())
  }

  /**
   * 报告 IP 失效
   * @param {string} ip
   */
  async reportIPInvalid(ip) {
    const client = await getRedisClient()
    if (!client) return
    
    logger.warn(`[IP发放] IP ${ip} 失效`)
    
    // 记录失效
    await client.hSet(KEY.IP_INFO(ip), 'invalidAt', Date.now().toString())
  }

  /**
   * 预热 IP 池
   * @param {number} count 预热数量
   */
  async warmup(count = 5) {
    logger.info(`[IP发放] 开始预热 IP 池，目标 ${count} 个`)
    
    for (let i = 0; i < count; i++) {
      const ipInfo = await this.fetchNewIP()
      if (ipInfo) {
        await this.returnToPool(ipInfo)
        logger.info(`[IP发放] 预热 IP ${i + 1}/${count}: ${ipInfo.ip}`)
      }
      
      // 间隔 1 秒，避免频繁请求
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    const client = await getRedisClient()
    const poolSize = await client.lLen(KEY.POOL)
    await client.hSet(KEY.STATS, 'totalIPs', poolSize)
    
    logger.info(`[IP发放] 预热完成，池中有 ${poolSize} 个 IP`)
  }

  /**
   * 获取统计信息
   */
  async getStats() {
    const client = await getRedisClient()
    if (!client) return {}
    
    const stats = await client.hGetAll(KEY.STATS)
    const poolSize = await client.lLen(KEY.POOL)
    const mode = await client.get(KEY.MODE)
    const failCount = await client.get(KEY.DIRECT_FAIL) || '0'
    const cooldownEnd = await client.get(KEY.MODE_COOLDOWN)
    
    return {
      ...stats,
      poolSize,
      mode,
      directFailCount: parseInt(failCount),
      cooldownRemaining: cooldownEnd ? Math.max(0, parseInt(cooldownEnd) - Date.now()) : 0
    }
  }

  /**
   * 定时维护任务
   */
  async maintenance() {
    const client = await getRedisClient()
    if (!client) return
    
    // 检查并清理过期 IP
    const poolSize = await client.lLen(KEY.POOL)
    let cleaned = 0
    
    for (let i = 0; i < poolSize; i++) {
      const ipJson = await client.rPop(KEY.POOL)
      if (!ipJson) break
      
      try {
        const ipInfo = JSON.parse(ipJson)
        
        // 检查是否过期
        if (Date.now() < ipInfo.expireTime) {
          // 未过期，放回池中
          await client.lPush(KEY.POOL, ipJson)
        } else {
          cleaned++
          logger.debug(`[IP发放] 清理过期 IP: ${ipInfo.ip}`)
        }
      } catch {
        cleaned++
      }
    }
    
    // 更新统计
    const newPoolSize = await client.lLen(KEY.POOL)
    await client.hSet(KEY.STATS, 'totalIPs', newPoolSize)
    
    if (cleaned > 0) {
      logger.info(`[IP发放] 维护完成，清理 ${cleaned} 个过期 IP，剩余 ${newPoolSize} 个`)
    }
    
    // 如果池中 IP 少于 3 个，自动补充
    if (newPoolSize < 3) {
      logger.info(`[IP发放] IP 池不足 (${newPoolSize}/3)，自动补充`)
      await this.warmup(3 - newPoolSize)
    }
  }

  /**
   * 实时获取新鲜 IP (优先检查池中有效期)
   */
  async acquireFreshIP() {
    const client = await getRedisClient()
    
    if (client) {
      const poolSize = await client.lLen(KEY.POOL)
      
      for (let i = 0; i < Math.min(poolSize, 5); i++) {
        const ipJson = await client.rPop(KEY.POOL)
        if (!ipJson) break
        
        try {
          const ipInfo = JSON.parse(ipJson)
          const remainingTTL = ipInfo.expireTime - Date.now()
          
          if (remainingTTL >= 120000) { // 2分钟
            logger.info(`[IP发放] 使用池中 IP: ${ipInfo.ip}, 剩余 ${Math.round(remainingTTL/1000)} 秒`)
            await client.hIncrBy(KEY.STATS, 'usedIPs', 1)
            return { ...ipInfo, remainingTTL: Math.round(remainingTTL / 1000) }
          }
        } catch (e) {}
      }
    }
    
    const freshIP = await this.fetchNewIP()
    
    if (freshIP) {
      const freshTTL = freshIP.expireTime - Date.now()
      logger.info(`[IP发放] 实时获取 IP: ${freshIP.ip}, 有效期 ${Math.round(freshTTL/1000)} 秒`)
      
      if (client) {
        await client.hIncrBy(KEY.STATS, 'usedIPs', 1)
      }
      
      return { ...freshIP, remainingTTL: Math.round(freshTTL / 1000) }
    }
    
    return null
  }

  /**
   * 检查是否应该跳过直连
   */
  async shouldSkipDirect() {
    const client = await getRedisClient()
    if (!client) return false
    
    const failCount = parseInt(await client.get(KEY.DIRECT_FAIL) || '0')
    const lastSuccess = parseInt(await client.get(KEY.DIRECT_LAST_SUCCESS) || '0')
    const timeSinceSuccess = Date.now() - lastSuccess
    
    const shouldSkip = failCount >= 5 && timeSinceSuccess > 600000 // 5次失败 且 10分钟无成功
    
    if (shouldSkip) {
      logger.warn(`[IP发放] 跳过直连: 连续失败 ${failCount} 次`)
    }
    
    return shouldSkip
  }

  /**
   * 报告直连成功 (增强版)
   */
  async reportDirectSuccessV2() {
    const client = await getRedisClient()
    if (!client) return
    
    await client.set(KEY.DIRECT_FAIL, '0')
    await client.set(KEY.DIRECT_LAST_SUCCESS, Date.now().toString())
    
    const mode = await client.get(KEY.MODE)
    if (mode === 'proxy') {
      const cooldownEnd = await client.get(KEY.MODE_COOLDOWN)
      if (!cooldownEnd || Date.now() >= parseInt(cooldownEnd)) {
        await client.set(KEY.MODE, 'direct')
        logger.info('[IP发放] 恢复直连模式')
      }
    }
    
    logger.info('[IP发放] 直连成功')
  }

  /**
   * 获取 IP 池状态
   */
  async getPoolStatus() {
    const client = await getRedisClient()
    if (!client) return { available: 0, mode: 'direct' }
    
    const mode = await client.get(KEY.MODE) || 'direct'
    const poolSize = await client.lLen(KEY.POOL)
    const failCount = parseInt(await client.get(KEY.DIRECT_FAIL) || '0')
    const lastSuccess = await client.get(KEY.DIRECT_LAST_SUCCESS)
    const cooldownEnd = await client.get(KEY.MODE_COOLDOWN)
    const stats = await client.hGetAll(KEY.STATS)
    
    return {
      mode,
      available: poolSize,
      directFailCount: failCount,
      lastDirectSuccess: lastSuccess ? new Date(parseInt(lastSuccess)).toISOString() : null,
      cooldownRemaining: cooldownEnd ? Math.max(0, parseInt(cooldownEnd) - Date.now()) : 0,
      stats: {
        totalIPs: parseInt(stats.totalIPs || '0'),
        usedIPs: parseInt(stats.usedIPs || '0'),
        modeSwitches: parseInt(stats.modeSwitches || '0'),
        captchaHits: parseInt(stats.captchaHits || '0'),
      }
    }
  }

  /**
   * 手动切换模式
   */
  async manualSwitchMode(newMode, cooldownMinutes = 30) {
    const client = await getRedisClient()
    if (!client) return { success: false, message: 'Redis 未连接' }
    
    if (!['direct', 'proxy'].includes(newMode)) {
      return { success: false, message: '无效的模式' }
    }
    
    const oldMode = await client.get(KEY.MODE)
    await client.set(KEY.MODE, newMode)
    
    if (cooldownMinutes > 0) {
      await client.set(KEY.MODE_COOLDOWN, Date.now() + cooldownMinutes * 60 * 1000)
    }
    
    await client.set(KEY.DIRECT_FAIL, '0')
    await client.hIncrBy(KEY.STATS, 'modeSwitches', 1)
    
    logger.warn(`[IP发放] 手动切换模式: ${oldMode} → ${newMode}`)
    
    return { success: true, message: `已切换到 ${newMode} 模式` }
  }
}

// 单例
const ipDispenser = new IPDispenserService()

export default ipDispenser
export { CONFIG, KEY }
