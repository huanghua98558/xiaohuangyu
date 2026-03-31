import leaderboardService from '../services/leaderboardService.js'
import { success } from '../utils/response.js'

class LeaderboardController {
  /**
   * 获取总排行榜
   */
  async getTotalRank(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 50
      const data = await leaderboardService.getTotalRank(limit)
      success(res, data)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取周排行榜
   */
  async getWeeklyRank(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 50
      const data = await leaderboardService.getWeeklyRank(limit)
      success(res, data)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取月排行榜
   */
  async getMonthlyRank(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 50
      const data = await leaderboardService.getMonthlyRank(limit)
      success(res, data)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取我的排名
   */
  async getMyRank(req, res, next) {
    try {
      const data = await leaderboardService.getUserRank(req.userId)
      success(res, data)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取排行榜奖励配置
   */
  async getRewardConfig(req, res, next) {
    try {
      const data = await leaderboardService.getRewardConfig()
      success(res, data)
    } catch (err) {
      next(err)
    }
  }
}

export default new LeaderboardController()
