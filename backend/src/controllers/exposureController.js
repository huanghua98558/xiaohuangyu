import exposureService from '../services/exposureService.js'
import onlineUserService from '../services/onlineUserService.js'
import taskService from '../services/taskService.js'
import { success } from '../utils/response.js'
import logger from '../utils/logger.js'

function normalizeUserId(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : value
}

class ExposureController {
  // ═══════════════════════════════════════════════════════════════════════════
  // 用户端接口
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 用户心跳上报
   * POST /api/exposure/heartbeat
   */
  async heartbeat(req, res, next) {
    try {
      const userId = normalizeUserId(req.userId)
      const { level, city, province, currentPage, deviceId } = req.body

      const result = await onlineUserService.heartbeatEnhanced(userId, {
        level,
        city,
        province,
        currentPage,
        deviceId
      })

      // 同时初始化曝光额度缓存（如果需要）
      if (result.success && result.wasOffline) {
        await onlineUserService.initUserExposureQuotaCache(userId)
      }

      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 用户离线
   * POST /api/exposure/offline
   */
  async offline(req, res, next) {
    try {
      const userId = normalizeUserId(req.userId)
      const result = await onlineUserService.offlineEnhanced(userId)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取用户曝光额度
   * GET /api/exposure/quota
   */
  async getExposureQuota(req, res, next) {
    try {
      const userId = normalizeUserId(req.userId)
      const stats = await exposureService.getUserExposureStats(userId)
      success(res, stats)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取用户选择分数
   * GET /api/exposure/selection-score
   */
  async getSelectionScore(req, res, next) {
    try {
      const userId = normalizeUserId(req.userId)
      const score = await exposureService.calculateSelectionScore(userId)
      success(res, { score })
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取供需统计
   * GET /api/exposure/supply-demand
   */
  async getSupplyDemandStats(req, res, next) {
    try {
      const stats = await exposureService.getSupplyDemandStats()
      success(res, stats)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取全局在线统计
   * GET /api/exposure/online-stats
   */
  async getOnlineStats(req, res, next) {
    try {
      const stats = await onlineUserService.getGlobalOnlineStats()
      success(res, stats)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取城市在线用户
   * GET /api/exposure/city-online/:city
   */
  async getCityOnlineUsers(req, res, next) {
    try {
      const { city } = req.params
      const users = await onlineUserService.getOnlineUsersByCity(city)
      success(res, { city, users, count: users.length })
    } catch (err) {
      next(err)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 管理员接口
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 获取曝光配置
   * GET /api/exposure/config
   */
  async getConfig(req, res, next) {
    try {
      const config = await exposureService.getConfig()
      success(res, config)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 更新曝光配置
   * PUT /api/exposure/config
   */
  async updateConfig(req, res, next) {
    try {
      const config = req.body
      const result = await exposureService.updateConfig(config)
      success(res, result, '配置更新成功')
    } catch (err) {
      next(err)
    }
  }

  /**
   * 更新城市曝光限制
   * PUT /api/exposure/city-limit
   */
  async updateCityLimit(req, res, next) {
    try {
      const { limit } = req.body
      if (!limit || limit < 1 || limit > 20) {
        return res.status(400).json({ code: 400, message: '限制值必须在1-20之间' })
      }
      
      const success = await exposureService.updateCityExposureLimit(limit)
      if (success) {
        res.json({ code: 0, message: '城市曝光限制更新成功', data: { limit } })
      } else {
        res.status(500).json({ code: 500, message: '更新失败' })
      }
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取任务曝光详情
   * GET /api/exposure/task/:taskId
   */
  async getTaskExposureDetail(req, res, next) {
    try {
      const taskId = parseInt(req.params.taskId)
      const detail = await exposureService.getTaskExposureDetail(taskId)
      success(res, detail)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取任务动态容量
   * GET /api/exposure/task/:taskId/capacity
   */
  async getTaskDynamicCapacity(req, res, next) {
    try {
      const taskId = parseInt(req.params.taskId)
      const capacity = await exposureService.calculateDynamicCapacity(taskId)
      success(res, capacity)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取曝光统计
   * GET /api/exposure/stats
   */
  async getStats(req, res, next) {
    try {
      const { startDate, endDate } = req.query
      const stats = await exposureService.getStats(startDate, endDate)
      success(res, stats)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取在线用户快照
   * GET /api/exposure/online-snapshot
   */
  async getOnlineSnapshot(req, res, next) {
    try {
      const snapshot = await onlineUserService.getOnlineUsersSnapshot()
      success(res, {
        total: snapshot.length,
        users: snapshot
      })
    } catch (err) {
      next(err)
    }
  }

  /**
   * 设置用户曝光等级
   * PUT /api/exposure/user/:userId/level
   */
  async setUserExposureLevel(req, res, next) {
    try {
      const userId = parseInt(req.params.userId)
      const { level, priority } = req.body

      if (!['whitelist', 'normal', 'blacklist'].includes(level)) {
        return res.status(400).json({ code: 400, message: '无效的曝光等级' })
      }

      const result = await exposureService.setUserExposureLevel(userId, level, priority)
      if (result) {
        success(res, null, '曝光等级设置成功')
      } else {
        res.status(500).json({ code: 500, message: '设置失败' })
      }
    } catch (err) {
      next(err)
    }
  }

  /**
   * 设置用户白名单
   * PUT /api/exposure/user/:userId/whitelist
   */
  async setUserWhitelist(req, res, next) {
    try {
      const userId = parseInt(req.params.userId)
      const { isWhitelist } = req.body

      const result = await exposureService.setUserWhitelist(userId, isWhitelist)
      if (result) {
        success(res, null, isWhitelist ? '已加入白名单' : '已移出白名单')
      } else {
        res.status(500).json({ code: 500, message: '操作失败' })
      }
    } catch (err) {
      next(err)
    }
  }

  /**
   * 设置用户黑名单
   * PUT /api/exposure/user/:userId/blacklist
   */
  async setUserBlacklist(req, res, next) {
    try {
      const userId = parseInt(req.params.userId)
      const { isBlacklist } = req.body

      const result = await exposureService.setUserBlacklist(userId, isBlacklist)
      if (result) {
        success(res, null, isBlacklist ? '已加入黑名单' : '已移出黑名单')
      } else {
        res.status(500).json({ code: 500, message: '操作失败' })
      }
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取用户曝光详情
   * GET /api/exposure/user/:userId
   */
  async getUserExposureDetail(req, res, next) {
    try {
      const userId = parseInt(req.params.userId)
      const stats = await exposureService.getUserExposureStats(userId)
      const onlineInfo = await onlineUserService.getUserOnlineInfoWithExposure(userId)
      
      success(res, {
        stats,
        onlineInfo
      })
    } catch (err) {
      next(err)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 手动触发接口（管理员/测试）
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 手动触发曝光检查
   * POST /api/exposure/trigger/check
   */
  async triggerCheck(req, res, next) {
    try {
      const exposureCron = (await import('../services/exposureCron.js')).default
      await exposureCron.triggerCheck()
      success(res, null, '曝光检查已触发')
    } catch (err) {
      next(err)
    }
  }

  /**
   * 手动触发离线缓冲检查
   * POST /api/exposure/trigger/offline-buffer
   */
  async triggerOfflineBuffer(req, res, next) {
    try {
      const exposureCron = (await import('../services/exposureCron.js')).default
      await exposureCron.triggerOfflineBufferCheck()
      success(res, null, '离线缓冲检查已触发')
    } catch (err) {
      next(err)
    }
  }

  /**
   * 手动触发质量评分计算
   * POST /api/exposure/trigger/quality-score
   */
  async triggerQualityScore(req, res, next) {
    try {
      const exposureCron = (await import('../services/exposureCron.js')).default
      await exposureCron.triggerQualityScoreCalculation()
      success(res, null, '质量评分计算已触发')
    } catch (err) {
      next(err)
    }
  }

  /**
   * 手动触发曝光分配
   * POST /api/exposure/trigger/allocate
   */
  async triggerAllocate(req, res, next) {
    try {
      const exposureCron = (await import('../services/exposureCron.js')).default
      await exposureCron.triggerAllocation()
      success(res, null, '曝光分配已触发')
    } catch (err) {
      next(err)
    }
  }

  /**
   * 刷新全局统计
   * POST /api/exposure/refresh-stats
   */
  async refreshStats(req, res, next) {
    try {
      const stats = await onlineUserService.refreshGlobalStats()
      success(res, stats, '统计已刷新')
    } catch (err) {
      next(err)
    }
  }

  /**
   * 初始化现有任务的曝光记录
   * POST /api/exposure/init-existing-tasks
   */
  async initExistingTasks(req, res, next) {
    try {
      const count = await exposureService.initExistingTasks()
      success(res, { count }, `已初始化 ${count} 个任务的曝光记录`)
    } catch (err) {
      next(err)
    }
  }
}

export default new ExposureController()
