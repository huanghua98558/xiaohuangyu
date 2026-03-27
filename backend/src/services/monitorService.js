import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import db from '../config/database.js'
import { redisClient, REDIS_ENABLED } from '../utils/redis.js'
import logger from '../utils/logger.js'
import webSocketService from './webSocketService.js'
import alertService from './alertService.js'
import capacityBaselineService from './capacityBaselineService.js'

const execAsync = promisify(exec)

class MonitorService {
  constructor() {
    this.startTime = Date.now()
    this.metricsHistory = []
    this.maxHistoryLength = 100
  }

  /**
   * 获取系统基础信息
   */
  getSystemInfo() {
    const cpus = os.cpus()
    const totalMemory = os.totalmem()
    const freeMemory = os.freemem()
    const usedMemory = totalMemory - freeMemory
    const loadAvg = os.loadavg()
    const uptime = os.uptime()

    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: cpus.length,
      cpuModel: cpus[0]?.model || 'Unknown',
      totalMemory: Math.round(totalMemory / 1024 / 1024 / 1024 * 100) / 100,
      usedMemory: Math.round(usedMemory / 1024 / 1024 / 1024 * 100) / 100,
      freeMemory: Math.round(freeMemory / 1024 / 1024 / 1024 * 100) / 100,
      memoryUsagePercent: Math.round(usedMemory / totalMemory * 100),
      loadAverage: {
        '1m': Math.round(loadAvg[0] * 100) / 100,
        '5m': Math.round(loadAvg[1] * 100) / 100,
        '15m': Math.round(loadAvg[2] * 100) / 100
      },
      uptime: {
        seconds: Math.floor(uptime),
        formatted: this.formatUptime(uptime)
      },
      processUptime: {
        seconds: Math.floor((Date.now() - this.startTime) / 1000),
        formatted: this.formatUptime((Date.now() - this.startTime) / 1000)
      }
    }
  }

  /**
   * 获取磁盘使用情况
   */
  async getDiskUsage() {
    try {
      const { stdout } = await execAsync('df -h / | tail -1')
      const parts = stdout.trim().split(/\s+/)
      const total = parts[1] || 'Unknown'
      const used = parts[2] || 'Unknown'
      const available = parts[3] || 'Unknown'
      const percentStr = parts[4] || '0%'
      const percent = parseInt(percentStr.replace('%', '')) || 0
      return {
        total,
        used,
        available,
        percent,
        status: percent > 90 ? 'warning' : 'ok'
      }
    } catch (error) {
      logger.error('获取磁盘信息失败:', error.message)
      return { total: 'Unknown', used: 'Unknown', available: 'Unknown', percent: 0, status: 'error' }
    }
  }

  /**
   * 获取网络统计
   */
  async getNetworkStats() {
    try {
      const { stdout } = await execAsync('cat /proc/net/dev | grep -E "eth0|ens"')
      const line = stdout.trim()
      if (!line) {
        return { interface: 'unknown', rxBytes: 0, txBytes: 0, rxMB: 0, txMB: 0 }
      }
      const parts = line.replace(':', ' ').split(/\s+/).filter(Boolean)
      const iface = parts[0] || 'eth0'
      const rxBytes = parseInt(parts[1]) || 0
      const txBytes = parseInt(parts[9]) || 0
      return {
        interface: iface,
        rxBytes,
        txBytes,
        rxMB: Math.round(rxBytes / 1024 / 1024 * 100) / 100,
        txMB: Math.round(txBytes / 1024 / 1024 * 100) / 100
      }
    } catch (error) {
      return { interface: 'unknown', rxBytes: 0, txBytes: 0, rxMB: 0, txMB: 0 }
    }
  }

  /**
   * 获取PM2进程状态
   */
  async getPM2Status() {
    try {
      const { stdout } = await execAsync('pm2 jlist')
      const processes = JSON.parse(stdout)
      return processes.map(p => ({
        name: p.name,
        pmId: p.pm_id,
        status: p.pm2_env?.status,
        cpu: Math.round(p.monit?.cpu || 0),
        memory: Math.round((p.monit?.memory || 0) / 1024 / 1024 * 100) / 100,
        uptime: p.pm2_env?.pm_uptime,
        restarts: p.pm2_env?.restart_time,
        version: p.pm2_env?.version,
        mode: p.pm2_env?.exec_mode
      }))
    } catch (error) {
      logger.error('获取PM2状态失败:', error.message)
      return []
    }
  }

  /**
   * 获取Nginx状态
   */
  async getNginxStatus() {
    try {
      const { stdout } = await execAsync('systemctl is-active nginx')
      return {
        status: stdout.trim() === 'active' ? 'running' : 'stopped',
        active: stdout.trim() === 'active'
      }
    } catch (error) {
      return { status: 'unknown', active: false }
    }
  }

  /**
   * 获取Redis状态
   * 修复：从 INFO clients 获取 connected_clients
   */
  async getRedisStatus() {
    if (!REDIS_ENABLED || !redisClient) {
      return { status: 'disabled', connected: false }
    }

    try {
      const start = Date.now()
      await redisClient.ping()
      const latency = Date.now() - start

      // 分别获取 server、clients、memory 信息
      const serverInfo = await redisClient.info('server')
      const clientsInfo = await redisClient.info('clients')
      const memoryInfo = await redisClient.info('memory')

      const parseInfo = (str, key) => {
        const match = str.match(new RegExp(`${key}:(.+)`))
        return match ? match[1].trim() : 'unknown'
      }

      return {
        status: 'connected',
        connected: true,
        version: parseInfo(serverInfo, 'redis_version'),
        usedMemory: parseInfo(memoryInfo, 'used_memory_human'),
        connectedClients: parseInt(parseInfo(clientsInfo, 'connected_clients')) || 0,
        latency
      }
    } catch (error) {
      return { status: 'error', connected: false, error: error.message }
    }
  }

  /**
   * 获取数据库状态
   */
  async getDatabaseStatus() {
    try {
      const start = Date.now()
      const result = await db.queryOne(
        `
        SELECT
          current_database() AS database_name,
          version() AS version
        `
      )
      const latency = Date.now() - start

      return {
        status: 'connected',
        connected: true,
        latency,
        type: 'CockroachDB',
        database: result?.database_name || null,
        version: result?.version || null,
        pool: {
          total: db.pool?.totalCount ?? 0,
          idle: db.pool?.idleCount ?? 0,
          waiting: db.pool?.waitingCount ?? 0,
        },
      }
    } catch (error) {
      return { status: 'error', connected: false, error: error.message }
    }
  }

  /**
   * 获取WebSocket连接统计
   * 修复：从 webSocketService 获取真实的 WebSocket 连接数
   */
  async getWebSocketStats() {
    try {
      // 从 webSocketService 获取真实的 WebSocket 连接数
      const wsConnections = webSocketService.getOnlineCount()
      const wsUsersDetail = webSocketService.getOnlineUsersDetail()

      // 如果 Redis 可用，获取 Redis 中存储的在线用户数作为参考
      let redisOnlineCount = 0
      let cityCount = 0
      
      if (REDIS_ENABLED && redisClient) {
        try {
          redisOnlineCount = await redisClient.zCard('online_users:set').catch(() => 0)
          const cityKeys = await redisClient.keys('city_online:*').catch(() => [])
          cityCount = cityKeys.length
        } catch (error) {
          logger.debug('获取 Redis 在线用户数失败:', error.message)
        }
      }

      return {
        onlineUsers: wsConnections,  // 真实的 WebSocket 连接数
        connections: wsConnections,   // 连接数 = 在线用户数
        redisOnlineUsers: redisOnlineCount,  // Redis 中存储的在线用户数（心跳上报）
        cityCount,
        userDetails: wsUsersDetail.slice(0, 10)  // 返回前10个在线用户详情
      }
    } catch (error) {
      logger.error('获取 WebSocket 统计失败:', error.message)
      return { onlineUsers: 0, connections: 0, cityCount: 0 }
    }
  }

  /**
   * 获取告警统计
   */
  async getAlertStats() {
    try {
      const stats = await alertService.getStats()
      return {
        total: Number(stats?.total || 0),
        pending: Number(stats?.pending || 0),
        handling: Number(stats?.handling || 0),
        resolved: Number(stats?.resolved || 0),
        critical: Number(stats?.critical || 0),
      }
    } catch (error) {
      logger.error('获取告警统计失败:', error.message)
      return {
        total: 0,
        pending: 0,
        handling: 0,
        resolved: 0,
        critical: 0,
      }
    }
  }

  /**
   * 计算系统健康分数
   */
  calculateHealthScore(metrics) {
    let score = 100
    const issues = []

    if (metrics.system.loadAverage['1m'] > metrics.system.cpus * 0.9) {
      score -= 20
      issues.push('CPU负载过高')
    } else if (metrics.system.loadAverage['1m'] > metrics.system.cpus * 0.7) {
      score -= 10
      issues.push('CPU负载较高')
    }

    if (metrics.system.memoryUsagePercent > 90) {
      score -= 25
      issues.push('内存使用率过高')
    } else if (metrics.system.memoryUsagePercent > 80) {
      score -= 10
      issues.push('内存使用率较高')
    }

    if (metrics.disk.percent > 90) {
      score -= 20
      issues.push('磁盘空间不足')
    } else if (metrics.disk.percent > 80) {
      score -= 10
      issues.push('磁盘空间紧张')
    }

    if (!metrics.nginx.active) {
      score -= 15
      issues.push('Nginx服务异常')
    }
    if (!metrics.redis.connected && metrics.redis.status !== 'disabled') {
      score -= 15
      issues.push('Redis连接异常')
    }
    if (!metrics.database.connected) {
      score -= 20
      issues.push('数据库连接异常')
    }

    if (metrics.capacity?.assessment?.status === 'warning') {
      score -= 10
      issues.push(...(metrics.capacity.assessment.issues || []).slice(0, 2))
    } else if (metrics.capacity?.assessment?.status === 'critical') {
      score -= 20
      issues.push(...(metrics.capacity.assessment.issues || []).slice(0, 3))
    }

    if (metrics.alerts.critical > 0) {
      score -= 10
      issues.push(`存在${metrics.alerts.critical}个严重告警`)
    }

    return {
      score: Math.max(0, score),
      status: score >= 80 ? 'healthy' : score >= 60 ? 'warning' : 'critical',
      issues
    }
  }

  /**
   * 获取完整监控数据
   */
  async getFullMetrics() {
    const [
      diskUsage,
      networkStats,
      pm2Status,
      nginxStatus,
      redisStatus,
      databaseStatus,
      wsStats,
      alertStats,
      capacityStats,
    ] = await Promise.all([
      this.getDiskUsage(),
      this.getNetworkStats(),
      this.getPM2Status(),
      this.getNginxStatus(),
      this.getRedisStatus(),
      this.getDatabaseStatus(),
      this.getWebSocketStats(),
      this.getAlertStats(),
      capacityBaselineService.getSnapshot(),
    ])

    const system = this.getSystemInfo()

    const metrics = {
      timestamp: new Date().toISOString(),
      system,
      disk: diskUsage,
      network: networkStats,
      pm2: pm2Status,
      nginx: nginxStatus,
      redis: redisStatus,
      database: databaseStatus,
      websocket: wsStats,
      alerts: alertStats,
      capacity: capacityStats,
    }

    metrics.health = this.calculateHealthScore(metrics)

    this.metricsHistory.push({
      timestamp: metrics.timestamp,
      cpu: metrics.system.loadAverage['1m'],
      memory: metrics.system.memoryUsagePercent,
      health: metrics.health.score
    })
    if (this.metricsHistory.length > this.maxHistoryLength) {
      this.metricsHistory.shift()
    }

    return metrics
  }

  /**
   * 获取历史趋势
   */
  getHistory() {
    return this.metricsHistory
  }

  /**
   * 格式化运行时间
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    const parts = []
    if (days > 0) parts.push(`${days}天`)
    if (hours > 0) parts.push(`${hours}小时`)
    parts.push(`${minutes}分钟`)
    
    return parts.join(' ')
  }
}

export default new MonitorService()
