import achievementService from '../services/achievementService.js'
import { success } from '../utils/response.js'

class AchievementController {
  /**
   * 获取所有成就列表
   */
  async getAllAchievements(req, res, next) {
    try {
      const result = await achievementService.getAllAchievements()
      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取用户成就
   */
  async getUserAchievements(req, res, next) {
    try {
      const userId = req.userId
      const result = await achievementService.getUserAchievements(userId)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取成就统计
   */
  async getAchievementStats(req, res, next) {
    try {
      const userId = req.userId
      const result = await achievementService.getAchievementStats(userId)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 检查并授予成就
   */
  async checkAchievements(req, res, next) {
    try {
      const userId = req.userId
      const result = await achievementService.checkAndGrantAchievements(userId)
      success(res, { newlyGranted: result })
    } catch (err) {
      next(err)
    }
  }
}

export default new AchievementController()
