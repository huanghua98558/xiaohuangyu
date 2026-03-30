import logger from './logger.js'

/**
 * IP 地址解析服务
 * 
 * 功能：
 * 1. 解析IP地址获取地理位置
 * 2. 支持离线/在线多种方式
 * 3. 缓存机制优化性能
 */

// 简单的IP位置缓存
const locationCache = new Map()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24小时缓存

// 中国主要城市IP段映射（简化版）
const IP_RANGE_MAP = {
  // 北京
  '116.': '北京',
  '117.136': '北京',
  // 上海
  '101.224': '上海',
  '101.225': '上海',
  '101.226': '上海',
  '180.153': '上海',
  // 广州
  '113.88': '广州',
  '113.89': '广州',
  '183.3': '广州',
  '183.6': '广州',
  // 深圳
  '113.90': '深圳',
  '113.91': '深圳',
  '183.4': '深圳',
  '183.5': '深圳',
  // 杭州
  '115.192': '杭州',
  '115.193': '杭州',
  '115.194': '杭州',
  // 成都
  '118.112': '成都',
  '118.113': '成都',
  // 武汉
  '119.96': '武汉',
  '119.97': '武汉',
  // 南京
  '122.192': '南京',
  '122.193': '南京',
  // 西安
  '123.138': '西安',
  '123.139': '西安',
  // 重庆
  '113.240': '重庆',
  '113.241': '重庆',
  // 天津
  '117.8': '天津',
  '117.9': '天津',
  // 苏州
  '114.216': '苏州',
  '114.217': '苏州',
  // 郑州
  '123.52': '郑州',
  '123.53': '郑州',
  // 长沙
  '118.250': '长沙',
  '118.251': '长沙',
  // 合肥
  '117.64': '合肥',
  '117.65': '合肥',
  // 福州
  '117.25': '福州',
  '117.26': '福州',
  // 厦门
  '117.28': '厦门',
  '117.29': '厦门',
  // 济南
  '119.160': '济南',
  '119.161': '济南',
  // 青岛
  '119.166': '青岛',
  '119.167': '青岛',
  // 大连
  '123.92': '大连',
  '123.93': '大连',
  // 沈阳
  '123.184': '沈阳',
  '123.185': '沈阳',
  // 哈尔滨
  '125.210': '哈尔滨',
  '125.211': '哈尔滨',
  // 昆明
  '116.52': '昆明',
  '116.53': '昆明',
  // 贵阳
  '117.40': '贵阳',
  '117.41': '贵阳',
  // 南宁
  '116.252': '南宁',
  '116.253': '南宁',
  // 海口
  '119.40': '海口',
  '119.41': '海口',
  // 三亚
  '119.41': '三亚',
  // 兰州
  '125.74': '兰州',
  '125.75': '兰州',
  // 乌鲁木齐
  '125.84': '乌鲁木齐',
  '125.85': '乌鲁木齐',
  // 拉萨
  '221.13': '拉萨',
  // 呼和浩特
  '116.116': '呼和浩特',
  // 银川
  '125.76': '银川',
  // 西宁
  '125.72': '西宁'
}

/**
 * 从IP地址获取地理位置（本地简化版）
 * @param {string} ip - IP地址
 * @returns {string} 地理位置
 */
function getLocationByLocalIP(ip) {
  if (!ip || ip === 'unknown') return '未知位置'
  
  // 处理本地IP
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
    return '本地'
  }
  
  // 处理内网IP
  if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return '内网'
  }
  
  // 匹配IP段
  for (const [prefix, location] of Object.entries(IP_RANGE_MAP)) {
    if (ip.startsWith(prefix)) {
      return location
    }
  }
  
  return '未知位置'
}

/**
 * 获取IP地理位置（在线API）
 * @param {string} ip - IP地址
 * @returns {Promise<string>} 地理位置
 */
async function getLocationByOnlineAPI(ip) {
  try {
    // 使用免费的IP定位API
    const response = await fetch(`http://ip-api.com/json/${ip}?lang=zh-CN`, {
      timeout: 3000
    })
    
    if (response.ok) {
      const data = await response.json()
      if (data.status === 'success') {
        return `${data.city || data.regionName || '未知城市'}, ${data.country}`
      }
    }
  } catch (err) {
    // 在线API失败，降级到本地
    logger.debug(`在线IP解析失败: ${err.message}`)
  }
  
  return null
}

/**
 * 获取IP地理位置（主入口）
 * @param {string} ip - IP地址
 * @param {Object} options - 选项
 * @param {boolean} options.useOnlineAPI - 是否使用在线API
 * @returns {Promise<string>} 地理位置
 */
async function getLocation(ip, options = {}) {
  if (!ip || ip === 'unknown') {
    return '未知位置'
  }
  
  // 提取IPv4地址（处理IPv6映射）
  let cleanIP = ip
  if (ip.includes('::ffff:')) {
    cleanIP = ip.split('::ffff:')[1]
  }
  
  // 检查缓存
  const cached = locationCache.get(cleanIP)
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.location
  }
  
  // 先尝试本地解析（快速）
  const localLocation = getLocationByLocalIP(cleanIP)
  
  // 如果本地解析成功且不是"未知位置"，直接返回
  if (localLocation !== '未知位置') {
    locationCache.set(cleanIP, { location: localLocation, time: Date.now() })
    return localLocation
  }
  
  // 可选：尝试在线API
  if (options.useOnlineAPI) {
    const onlineLocation = await getLocationByOnlineAPI(cleanIP)
    if (onlineLocation) {
      locationCache.set(cleanIP, { location: onlineLocation, time: Date.now() })
      return onlineLocation
    }
  }
  
  // 返回本地结果
  locationCache.set(cleanIP, { location: localLocation, time: Date.now() })
  return localLocation
}

/**
 * 从请求中提取IP地址
 * @param {Object} req - Express请求对象
 * @returns {string} IP地址
 */
function extractIP(req) {
  let ip = 
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.headers['cf-connecting-ip'] ||  // Cloudflare
    req.headers['true-client-ip'] ||     // Akamai
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown'
  
  // 处理IPv6映射的IPv4
  if (ip.includes('::ffff:')) {
    ip = ip.split('::ffff:')[1]
  }
  
  return ip
}

/**
 * 从请求中获取完整的位置信息
 * @param {Object} req - Express请求对象
 * @returns {Promise<{ip: string, location: string}>}
 */
async function getRequestLocation(req) {
  const ip = extractIP(req)
  const location = await getLocation(ip)
  return { ip, location }
}

/**
 * 获取IP地址信息（包含更多详情）
 * @param {string} ip - IP地址
 * @returns {Promise<Object>}
 */
async function getIPInfo(ip) {
  const location = await getLocation(ip)
  
  return {
    ip,
    location,
    isLocal: ip === '127.0.0.1' || ip === '::1' || ip === 'unknown',
    isPrivate: ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.'),
    parsedAt: new Date().toISOString()
  }
}

/**
 * 清理缓存
 */
function clearCache() {
  locationCache.clear()
}

/**
 * 获取缓存统计
 */
function getCacheStats() {
  return {
    size: locationCache.size,
    entries: Array.from(locationCache.entries()).map(([ip, data]) => ({
      ip,
      location: data.location,
      age: Date.now() - data.time
    }))
  }
}

export default {
  getLocation,
  extractIP,
  getRequestLocation,
  getIPInfo,
  clearCache,
  getCacheStats
}

export {
  getLocation,
  extractIP,
  getRequestLocation,
  getIPInfo,
  clearCache,
  getCacheStats
}
