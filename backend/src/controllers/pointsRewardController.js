import pointsRewardService from '../services/pointsRewardService.js'
import alertService from '../services/alertService.js'
import { success } from '../utils/response.js'

class PointsRewardController {
  /**
   * 获取奖励统计概览
   */
  async getOverview(req, res, next) {
    try {
      const { startDate, endDate } = req.query
      const data = await pointsRewardService.getOverview(startDate, endDate)
      success(res, data)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取今日统计
   */
  async getTodayStats(req, res, next) {
    try {
      const data = await pointsRewardService.getTodayStats()
      success(res, data)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取趋势数据
   */
  async getTrend(req, res, next) {
    try {
      const { days = 30 } = req.query
      const data = await pointsRewardService.getTrend(parseInt(days))
      success(res, data)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取奖励明细列表
   */
  async getRewardList(req, res, next) {
    try {
      const data = await pointsRewardService.getRewardList(req.query)
      success(res, data)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 导出奖励数据
   */
  async exportRewards(req, res, next) {
    try {
      const data = await pointsRewardService.exportRewards(req.query)
      success(res, data)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取积分配置
   */
  async getConfigs(req, res, next) {
    try {
      const data = await pointsRewardService.getConfigs()
      success(res, data)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 更新积分配置
   */
  async updateConfig(req, res, next) {
    try {
      const { key, value } = req.body
      const data = await pointsRewardService.updateConfig(key, value)
      success(res, data, '配置已更新')
    } catch (err) {
      next(err)
    }
  }

  /**
   * 批量更新积分配置
   */
  async updateConfigs(req, res, next) {
    try {
      const data = await pointsRewardService.updateConfigs(req.body)
      success(res, data, '配置已更新')
    } catch (err) {
      next(err)
    }
  }

  /**
   * 检测异常
   */
  async detectAnomaly(req, res, next) {
    try {
      const anomalies = await pointsRewardService.detectAnomaly()
      
      // 将高风险异常推送到告警中心
      for (const anomaly of anomalies) {
        if (anomaly.severity === 'high') {
          await alertService.createAlert({
            type: 'points_anomaly',
            severity: 'high',
            title: '积分异常告警',
            message: anomaly.message,
            source: 'points_monitor',
            metadata: anomaly
          })
        }
      }
      
      success(res, { anomalies, count: anomalies.length })
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取用户奖励汇总
   */
  async getUserRewardSummary(req, res, next) {
    try {
      const { userId } = req.params
      const data = await pointsRewardService.getUserRewardSummary(parseInt(userId))
      success(res, data)
    } catch (err) {
      next(err)
    }
  }
}

export default new PointsRewardController()
