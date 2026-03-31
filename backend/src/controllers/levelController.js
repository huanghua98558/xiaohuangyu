import levelService from '../services/levelService.js'
import { success } from '../utils/response.js'

class LevelController {
  /**
   * 获取所有等级配置
   */
  async getLevelConfigs(req, res, next) {
    try {
      const configs = await levelService.getLevelConfigs()
      success(res, configs)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取我的等级信息
   */
  async getMyLevel(req, res, next) {
    try {
      const info = await levelService.getUserLevelInfo(req.userId)
      success(res, info)
    } catch (err) {
      next(err)
    }
  }

  /**
   * 获取升级进度
   */
  async getUpgradeProgress(req, res, next) {
    try {
      const info = await levelService.getUserLevelInfo(req.userId)
      success(res, {
        currentLevel: info.currentLevel,
        canUpgrade: info.canUpgrade,
        nextLevel: info.nextLevel,
        progress: info.progress
      })
    } catch (err) {
      next(err)
    }
  }

  /**
   * 更新等级配置（管理员）
   */
  async updateLevelConfig(req, res, next) {
    try {
      const level = parseInt(req.params.level)
      const data = req.body
      const config = await levelService.updateLevelConfig(level, data)
      success(res, config, '更新成功')
    } catch (err) {
      next(err)
    }
  }
}

export default new LevelController()
