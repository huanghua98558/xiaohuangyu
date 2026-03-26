import leaderboardSnapshotService from '../services/leaderboardSnapshotService.js'
import cronService from '../services/cronService.js'
import { success } from '../utils/response.js'

class LeaderboardSnapshotController {
  /**
   * 获取快照列表
   */
  async getSnapshots(req, res, next) {
    try {
      const type = req.query.type // 'weekly' | 'monthly'
      const page = parseInt(req.query.page) || 1
      const size = parseInt(req.query.size) || 20
      const result = await leaderboardSnapshotService.getSnapshots(type, page, size)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }
  
  /**
   * 获取快照详情
   */
  async getSnapshotDetail(req, res, next) {
    try {
      const id = parseInt(req.params.id)
      const result = await leaderboardSnapshotService.getSnapshotDetail(id)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }
  
  /**
   * 获取我的排行榜奖励
   */
  async getMyRewards(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1
      const result = await leaderboardSnapshotService.getUserRewards(req.userId, page)
      success(res, result)
    } catch (err) {
      next(err)
    }
  }
  
  /**
   * 手动触发生成周榜快照（管理员）
   */
  async triggerWeekly(req, res, next) {
    try {
      const result = await cronService.triggerWeeklySnapshot()
      success(res, result, '周榜快照生成成功')
    } catch (err) {
      next(err)
    }
  }
  
  /**
   * 手动触发生成月榜快照（管理员）
   */
  async triggerMonthly(req, res, next) {
    try {
      const result = await cronService.triggerMonthlySnapshot()
      success(res, result, '月榜快照生成成功')
    } catch (err) {
      next(err)
    }
  }
}

export default new LeaderboardSnapshotController()
