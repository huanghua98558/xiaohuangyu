import statisticsService from '../services/statisticsService.js'
import logger from '../utils/logger.js'

/**
 * 获取概览统计
 */
export async function getOverview(req, res) {
  try {
    const data = await statisticsService.getOverviewStats()
    res.json({ success: true, data })
  } catch (error) {
    logger.error('获取概览统计失败:', error)
    res.status(500).json({ success: false, error: '获取概览统计失败' })
  }
}

/**
 * 获取审核员绩效统计
 */
export async function getReviewerStats(req, res) {
  try {
    const { startDate, endDate, sortBy, sortOrder } = req.query
    const data = await statisticsService.getReviewerStats({
      startDate,
      endDate,
      sortBy,
      sortOrder
    })
    res.json({ success: true, data })
  } catch (error) {
    logger.error('获取审核员统计失败:', error)
    res.status(500).json({ success: false, error: '获取审核员统计失败' })
  }
}

/**
 * 获取发布者任务质量统计
 */
export async function getPublisherStats(req, res) {
  try {
    const { startDate, endDate, sortBy, sortOrder } = req.query
    const data = await statisticsService.getPublisherStats({
      startDate,
      endDate,
      sortBy,
      sortOrder
    })
    res.json({ success: true, data })
  } catch (error) {
    logger.error('获取发布者统计失败:', error)
    res.status(500).json({ success: false, error: '获取发布者统计失败' })
  }
}

/**
 * 获取趋势数据
 */
export async function getTrendData(req, res) {
  try {
    const { days = 7 } = req.query
    const data = await statisticsService.getTrendData(parseInt(days))
    res.json({ success: true, data })
  } catch (error) {
    logger.error('获取趋势数据失败:', error)
    res.status(500).json({ success: false, error: '获取趋势数据失败' })
  }
}
