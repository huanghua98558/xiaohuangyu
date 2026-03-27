import pkg from '@prisma/client'; const { PrismaClient } = pkg
import logger from '../utils/logger.js'
import { getRequestLocation } from '../utils/ipLocation.js'

const prisma = new PrismaClient()

/**
 * 登录日志服务
 * 使用 Prisma 连接 CockroachDB
 */
class LoginLogService {
  
  /**
   * 记录登录日志
   */
  async log({ userId, username, loginStatus = 'success', failureReason = null, req = null }) {
    try {
      let ip = 'unknown'
      let location = '未知位置'
      let device = '未知设备'
      let userAgent = ''
      
      if (req) {
        const locationInfo = await getRequestLocation(req)
        ip = locationInfo.ip
        location = locationInfo.location
        userAgent = req.headers['user-agent'] || ''
        device = this.parseDevice(userAgent)
      }
      
      const data = await prisma.login_logs.create({
        data: {
          user_id: userId ? Number(userId) : null,
          username,
          login_status: loginStatus || 'success',
          failure_reason: failureReason,
          ip_address: ip,
          location,
          device,
          user_agent: userAgent
        }
      })

      // 检测异地登录
      if (loginStatus === 'success') {
        await this.checkAbnormalLogin(userId, ip, location)
      }

      return data
    } catch (err) {
      logger.error('记录登录日志异常:', err)
      return null
    }
  }

  /**
   * 解析设备信息
   */
  parseDevice(userAgent) {
    if (!userAgent) return '未知设备'
    
    if (/Mobile|Android|iPhone|iPad|iPod/i.test(userAgent)) {
      if (/iPhone/i.test(userAgent)) return 'iPhone'
      if (/iPad/i.test(userAgent)) return 'iPad'
      if (/Android/i.test(userAgent)) return 'Android设备'
      return '移动设备'
    }
    
    if (/Windows/i.test(userAgent)) return 'Windows电脑'
    if (/Mac/i.test(userAgent)) return 'Mac电脑'
    if (/Linux/i.test(userAgent)) return 'Linux电脑'
    
    return '电脑设备'
  }

  /**
   * 检测异常登录（异地登录）
   */
  async checkAbnormalLogin(userId, currentIp, currentLocation) {
    try {
      // 获取最近一次成功登录
      const lastLogin = await prisma.login_logs.findFirst({
        where: {
          user_id: userId ? Number(userId) : null,
          login_status: 'success',
          NOT: { ip_address: currentIp }
        },
        orderBy: { login_time: 'desc' }
      })

      let isAnomaly = false
      let anomalyReason = null

      if (lastLogin && lastLogin.location !== currentLocation) {
        isAnomaly = true
        anomalyReason = `异地登录: 上次${lastLogin.location}, 本次${currentLocation}`
        
        // 记录告警
        try {
          await prisma.audit_alerts.create({
            data: {
              alertType: 'abnormal_login',
              severity: 'warning',
              title: '异地登录告警',
              message: `用户${userId}异地登录，上次: ${lastLogin.location}, 本次: ${currentLocation}`,
              source: 'login_detection',
              relatedId: userId,
              relatedType: 'user'
            }
          })
        } catch (e) {
          // 忽略告警创建失败
        }
        
        logger.warn(`检测到异地登录: 用户${userId}, 上次: ${lastLogin.location}, 本次: ${currentLocation}`)
      }

      // 检查短时间内多次登录失败后成功
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
      const recentFailures = await prisma.login_logs.count({
        where: {
          user_id: userId ? Number(userId) : null,
          login_status: 'failed',
          login_time: { gte: tenMinutesAgo }
        }
      })

      if (recentFailures >= 3) {
        isAnomaly = true
        anomalyReason = anomalyReason 
          ? `${anomalyReason}; 频繁失败后登录(${recentFailures}次)`
          : `频繁失败后登录(${recentFailures}次)`
      }

      // 更新当前登录记录的异常标记
      if (isAnomaly) {
        await prisma.login_logs.updateMany({
          where: {
            user_id: userId ? Number(userId) : null,
            ip_address: currentIp,
            logout_time: null
          },
          data: { 
            is_anomaly: true, 
            anomaly_reason: anomalyReason 
          }
        })
      }

      return { isAnomaly, anomalyReason }
    } catch (err) {
      logger.error('检测异常登录失败:', err)
      return { isAnomaly: false, anomalyReason: null }
    }
  }

  /**
   * 记录登出
   */
  async logout(userId) {
    try {
      // 更新最近的登录记录的登出时间
      await prisma.login_logs.updateMany({
        where: {
          user_id: userId ? Number(userId) : null,
          logout_time: null
        },
        data: { logout_time: new Date() }
      })
    } catch (err) {
      logger.error('记录登出异常:', err)
    }
  }

  /**
   * 获取登录日志列表
   */
  async getLogs(page = 1, size = 20, filters = {}) {
    const skip = (page - 1) * size
    
    const where = {}
    if (filters.userId) where.user_id = parseInt(filters.userId)
    if (filters.username) where.username = { contains: filters.username }
    if (filters.loginStatus) where.login_status = filters.loginStatus
    if (filters.startDate || filters.endDate) {
      where.login_time = {}
      if (filters.startDate) where.login_time.gte = new Date(filters.startDate)
      if (filters.endDate) where.login_time.lte = new Date(filters.endDate)
    }

    const [logs, total] = await Promise.all([
      prisma.login_logs.findMany({
        where,
        skip,
        take: size,
        orderBy: { login_time: 'desc' }
      }),
      prisma.login_logs.count({ where })
    ])

    return {
      list: logs.map(l => ({ ...l, userId: l.user_id?.toString() })),
      total,
      page,
      size
    }
  }

  /**
   * 获取用户登录统计
   */
  async getUserLoginStats(userId, days = 30) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const data = await prisma.login_logs.findMany({
      where: {
        user_id: userId ? Number(userId) : null,
        login_status: 'success',
        login_time: { gte: startDate }
      },
      orderBy: { login_time: 'desc' }
    })

    return {
      totalLogins: data.length,
      uniqueIPs: [...new Set(data.map(l => l.ip_address))].length,
      uniqueLocations: [...new Set(data.map(l => l.location))],
      devices: [...new Set(data.map(l => l.device))],
      lastLogin: data[0] || null
    }
  }
}

export default new LoginLogService()
