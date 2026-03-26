import supabase from '../utils/supabaseToPrismaAdapter.js'
import prisma from '../utils/prisma.js'
import logger from '../utils/logger.js'
import alertService from './alertService.js'

/**
 * 业务监控服务
 * 监控关键业务指标并触发告警
 */
class BusinessMonitorService {
  constructor() {
    // 告警阈值配置
    this.thresholds = {
      // 审核队列
      queueBacklog: 500,           // 队列积压阈值
      queueProcessingTime: 600000, // 处理超时阈值（10分钟）
      
      // 审核通过率
      approvalRateMin: 70,         // 最低通过率
      approvalRateDrop: 20,        // 通过率下降阈值
      
      // 积分系统
      largePointsChange: 500,      // 大额积分变动阈值
      pointsAnomalyRatio: 3,       // 积分异常倍数
      
      // 用户行为
      abnormalLoginCount: 5,       // 异常登录次数阈值
      highFrequencyOps: 100        // 高频操作阈值（每分钟）
    }
    
    // 历史数据缓存
    this.historyCache = {
      approvalRates: [],
      queueSizes: []
    }
  }

  /**
   * 执行所有业务监控检查
   */
  async runAllChecks() {
    const results = []
    
    try {
      // 1. 审核队列监控
      results.push(await this.checkReviewQueue())
      
      // 2. 审核通过率监控
      results.push(await this.checkApprovalRate())
      
      // 3. 积分发放监控
      results.push(await this.checkPointsAnomaly())
      
      // 4. 用户行为监控
      results.push(await this.checkUserBehavior())
      
      logger.info('[业务监控] 检查完成:', results.filter(r => r.triggered).length, '个告警')
      
      return {
        timestamp: new Date().toISOString(),
        checks: results,
        alertCount: results.filter(r => r.triggered).length
      }
    } catch (error) {
      logger.error('[业务监控] 检查异常:', error.message)
      return {
        timestamp: new Date().toISOString(),
        error: error.message
      }
    }
  }

  /**
   * 检查审核队列
   */
  async checkReviewQueue() {
    try {
      // 获取队列统计
      const { data: queueStats, error } = await supabase
        .from('ai_review_queue')
        .select('status')
      
      if (error) throw error
      
      const stats = {
        total: queueStats?.length || 0,
        pending: queueStats?.filter(q => q.status === 'pending').length || 0,
        processing: queueStats?.filter(q => q.status === 'processing').length || 0
      }
      
      // 检查积压告警
      let triggered = false
      let alertData = null
      
      if (stats.pending > this.thresholds.queueBacklog) {
        triggered = true
        alertData = {
          type: 'queue_backlog',
          severity: stats.pending > this.thresholds.queueBacklog * 1.5 ? 'high' : 'medium',
          title: '审核队列积压告警',
          message: `当前待审核任务 ${stats.pending} 个，超过阈值 ${this.thresholds.queueBacklog}`,
          metadata: { stats }
        }
        
        await alertService.createAlert(alertData)
      }
      
      // 记录历史
      this.historyCache.queueSizes.push({
        timestamp: new Date().toISOString(),
        pending: stats.pending
      })
      
      // 保留最近100条记录
      if (this.historyCache.queueSizes.length > 100) {
        this.historyCache.queueSizes.shift()
      }
      
      return {
        name: 'review_queue',
        status: triggered ? 'alert' : 'ok',
        triggered,
        data: stats,
        alert: alertData
      }
    } catch (error) {
      logger.error('[业务监控] 审核队列检查失败:', error.message)
      return {
        name: 'review_queue',
        status: 'error',
        triggered: false,
        error: error.message
      }
    }
  }

  /**
   * 检查审核通过率
   */
  async checkApprovalRate() {
    try {
      // 获取最近24小时的审核结果
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      
      const { data: claims, error } = await supabase
        .from('claims')
        .select('ai_review_status')
        .in('ai_review_status', ['approved', 'rejected'])
        .gte('reviewed_at', yesterday)
      
      if (error) throw error
      
      const total = claims?.length || 0
      const approved = claims?.filter(c => c.ai_review_status === 'approved').length || 0
      const currentRate = total > 0 ? Math.round((approved / total) * 100) : 100
      
      // 计算趋势
      const previousRate = this.historyCache.approvalRates.length > 0
        ? this.historyCache.approvalRates[this.historyCache.approvalRates.length - 1].rate
        : currentRate
      
      const rateDrop = previousRate - currentRate
      
      // 检查告警
      let triggered = false
      let alertData = null
      
      if (currentRate < this.thresholds.approvalRateMin) {
        triggered = true
        alertData = {
          type: 'low_approval_rate',
          severity: currentRate < 50 ? 'high' : 'medium',
          title: '审核通过率过低',
          message: `当前审核通过率 ${currentRate}%，低于阈值 ${this.thresholds.approvalRateMin}%`,
          metadata: { currentRate, previousRate, rateDrop }
        }
        
        await alertService.createAlert(alertData)
      } else if (rateDrop > this.thresholds.approvalRateDrop) {
        triggered = true
        alertData = {
          type: 'approval_rate_drop',
          severity: 'medium',
          title: '审核通过率下降',
          message: `审核通过率从 ${previousRate}% 下降到 ${currentRate}%，降幅 ${rateDrop}%`,
          metadata: { currentRate, previousRate, rateDrop }
        }
        
        await alertService.createAlert(alertData)
      }
      
      // 记录历史
      this.historyCache.approvalRates.push({
        timestamp: new Date().toISOString(),
        rate: currentRate
      })
      
      if (this.historyCache.approvalRates.length > 100) {
        this.historyCache.approvalRates.shift()
      }
      
      return {
        name: 'approval_rate',
        status: triggered ? 'alert' : 'ok',
        triggered,
        data: {
          currentRate,
          previousRate,
          rateDrop,
          total,
          approved
        },
        alert: alertData
      }
    } catch (error) {
      logger.error('[业务监控] 审核通过率检查失败:', error.message)
      return {
        name: 'approval_rate',
        status: 'error',
        triggered: false,
        error: error.message
      }
    }
  }

  /**
   * 检查积分异常
   */
  async checkPointsAnomaly() {
    try {
      // 获取最近1小时的积分变动
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      
      const { data: logs, error } = await supabase
        .from('points_logs')
        .select('user_id, change, type, created_at')
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: false })
        .limit(1000)
      
      if (error) throw error
      
      // 统计分析
      const userChanges = {}
      let totalChanges = 0
      let largeChanges = []
      
      logs?.forEach(log => {
        const change = Math.abs(log.change)
        totalChanges += change
        
        // 统计用户变动
        if (!userChanges[log.user_id]) {
          userChanges[log.user_id] = { count: 0, total: 0 }
        }
        userChanges[log.user_id].count++
        userChanges[log.user_id].total += change
        
        // 记录大额变动
        if (change > this.thresholds.largePointsChange) {
          largeChanges.push(log)
        }
      })
      
      // 计算平均值
      const avgChange = logs?.length > 0 ? totalChanges / logs.length : 0
      
      // 检测异常用户（变动超过平均值3倍）
      const anomalyUsers = Object.entries(userChanges)
        .filter(([_, data]) => data.total > avgChange * this.thresholds.pointsAnomalyRatio)
        .map(([userId, data]) => ({ userId, ...data }))
      
      // 触发告警
      let triggered = false
      let alertData = null
      
      if (anomalyUsers.length > 0) {
        triggered = true
        alertData = {
          type: 'points_anomaly',
          severity: 'medium',
          title: '积分异常变动告警',
          message: `发现 ${anomalyUsers.length} 个用户存在异常积分变动`,
          metadata: {
            anomalyUsers: anomalyUsers.slice(0, 10),
            largeChanges: largeChanges.slice(0, 10),
            avgChange
          }
        }
        
        await alertService.createAlert(alertData)
      }
      
      return {
        name: 'points_anomaly',
        status: triggered ? 'alert' : 'ok',
        triggered,
        data: {
          totalLogs: logs?.length || 0,
          avgChange: Math.round(avgChange),
          largeChangeCount: largeChanges.length,
          anomalyUserCount: anomalyUsers.length
        },
        alert: alertData
      }
    } catch (error) {
      logger.error('[业务监控] 积分异常检查失败:', error.message)
      return {
        name: 'points_anomaly',
        status: 'error',
        triggered: false,
        error: error.message
      }
    }
  }

  /**
   * 检查用户行为异常
   */
  async checkUserBehavior() {
    try {
      // 获取最近1小时的登录日志
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      
      // 检查异常登录（使用 Prisma）
      const abnormalLogins = await prisma.login_logs.groupBy({
        by: ['user_id'],
        where: {
          login_time: { gte: oneHourAgo },
          is_anomaly: true
        },
        _count: { id: true }
      })
      
      const suspiciousUsers = abnormalLogins.filter(
        g => g._count.id >= this.thresholds.abnormalLoginCount
      )
      
      // 触发告警
      let triggered = false
      let alertData = null
      
      if (suspiciousUsers.length > 0) {
        triggered = true
        alertData = {
          type: 'abnormal_behavior',
          severity: 'high',
          title: '用户异常行为告警',
          message: `发现 ${suspiciousUsers.length} 个用户存在异常登录行为`,
          metadata: {
            users: suspiciousUsers.slice(0, 10)
          }
        }
        
        await alertService.createAlert(alertData)
      }
      
      return {
        name: 'user_behavior',
        status: triggered ? 'alert' : 'ok',
        triggered,
        data: {
          abnormalLoginCount: abnormalLogins.length,
          suspiciousUserCount: suspiciousUsers.length
        },
        alert: alertData
      }
    } catch (error) {
      logger.error('[业务监控] 用户行为检查失败:', error.message)
      return {
        name: 'user_behavior',
        status: 'error',
        triggered: false,
        error: error.message
      }
    }
  }

  /**
   * 获取监控统计摘要
   */
  async getSummary() {
    try {
      // 获取今日统计
      const today = new Date().toISOString().split('T')[0]
      
      // 并行获取多个指标
      const [
        queueStats,
        todayClaims,
        todayPointsLogs,
        activeAlerts
      ] = await Promise.all([
        // 队列统计
        supabase.from('ai_review_queue').select('status'),
        // 今日任务
        supabase.from('claims').select('status, ai_review_status').gte('claimed_at', today),
        // 今日积分日志
        supabase.from('points_logs').select('change').gte('created_at', today),
        // 活跃告警
        supabase.from('audit_alerts').select('*', { count: 'exact', head: true }).eq('is_handled', false)
      ])
      
      // 计算统计
      const pendingQueue = queueStats.data?.filter(q => q.status === 'pending').length || 0
      const processingQueue = queueStats.data?.filter(q => q.status === 'processing').length || 0
      
      const totalClaims = todayClaims.data?.length || 0
      const approvedClaims = todayClaims.data?.filter(c => c.ai_review_status === 'approved').length || 0
      const approvalRate = totalClaims > 0 ? Math.round((approvedClaims / totalClaims) * 100) : 0
      
      const pointsGranted = todayPointsLogs.data?.reduce((sum, log) => sum + (log.change > 0 ? log.change : 0), 0) || 0
      const pointsConsumed = todayPointsLogs.data?.reduce((sum, log) => sum + Math.abs(log.change < 0 ? log.change : 0), 0) || 0
      
      return {
        timestamp: new Date().toISOString(),
        queue: {
          pending: pendingQueue,
          processing: processingQueue,
          total: queueStats.data?.length || 0
        },
        claims: {
          total: totalClaims,
          approved: approvedClaims,
          approvalRate
        },
        points: {
          granted: pointsGranted,
          consumed: pointsConsumed,
          net: pointsGranted - pointsConsumed
        },
        alerts: {
          unhandled: activeAlerts.count || 0
        }
      }
    } catch (error) {
      logger.error('[业务监控] 获取摘要失败:', error.message)
      return {
        timestamp: new Date().toISOString(),
        error: error.message
      }
    }
  }

  /**
   * 更新阈值配置
   */
  updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds }
    logger.info('[业务监控] 阈值配置已更新:', this.thresholds)
    return this.thresholds
  }

  /**
   * 获取当前阈值配置
   */
  getThresholds() {
    return { ...this.thresholds }
  }

  /**
   * 获取历史数据
   */
  getHistory() {
    return { ...this.historyCache }
  }
}

export default new BusinessMonitorService()
