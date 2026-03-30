import { Router } from 'express'
import { authMiddleware, adminOnly } from '../middlewares/auth.js'
import systemLogService from '../services/systemLogService.js'
import logger from '../utils/logger.js'

const router = Router()
router.use(authMiddleware, adminOnly)

function ok(res, data, message = 'ok') {
  res.json({ code: 0, data, message })
}

router.get('/overview', async (req, res) => {
  try {
    const data = await systemLogService.getStatsOverview()
    ok(res, data)
  } catch (err) {
    logger.error('[systemLogRoutes] overview', err)
    ok(res, {
      totalLogs: 0,
      operationLogs: 0,
      loginLogs: 0,
      todayLogins: 0,
      weekReviews: 0,
      anomalyLogins: 0,
      errorLogs: 0
    })
  }
})

router.get('/operation', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const size = parseInt(req.query.size, 10) || 20
    const data = await systemLogService.getOperationLogs({
      page,
      size,
      startDate: req.query.startDate || undefined,
      endDate: req.query.endDate || undefined,
      action: req.query.action || undefined,
      targetType: req.query.targetType || undefined,
      operatorRole: req.query.operatorRole || undefined
    })
    ok(res, data)
  } catch (err) {
    logger.error('[systemLogRoutes] operation', err)
    ok(res, { list: [], total: 0, page: 1, size: 20 })
  }
})

router.get('/login', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const size = parseInt(req.query.size, 10) || 20
    const data = await systemLogService.getLoginLogs({
      page,
      size,
      startDate: req.query.startDate || undefined,
      endDate: req.query.endDate || undefined,
      keyword: req.query.keyword || undefined,
      loginStatus: req.query.loginStatus || undefined,
      isAnomaly: req.query.isAnomaly
    })
    ok(res, data)
  } catch (err) {
    logger.error('[systemLogRoutes] login', err)
    ok(res, { list: [], total: 0, page: 1, size: 20, type: 'login' })
  }
})

router.get('/review', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const size = parseInt(req.query.size, 10) || 20
    const data = await systemLogService.getReviewLogs({
      page,
      size,
      startDate: req.query.startDate || undefined,
      endDate: req.query.endDate || undefined,
      status: req.query.status || undefined,
      reviewerId: req.query.reviewerId || undefined
    })
    ok(res, data)
  } catch (err) {
    logger.error('[systemLogRoutes] review', err)
    ok(res, { list: [], total: 0, page: 1, size: 20, type: 'review' })
  }
})

router.get('/error', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const size = parseInt(req.query.size, 10) || 20
    const data = await systemLogService.getErrorLogs({
      page,
      size,
      startDate: req.query.startDate || undefined,
      endDate: req.query.endDate || undefined,
      level: req.query.level || undefined,
      keyword: req.query.keyword || undefined
    })
    ok(res, data)
  } catch (err) {
    logger.error('[systemLogRoutes] error', err)
    ok(res, { list: [], total: 0, page: 1, size: 20, type: 'error' })
  }
})

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const size = parseInt(req.query.size, 10) || 20
    const data = await systemLogService.getErrorLogs({ page, size })
    ok(res, data)
  } catch (err) {
    logger.error('[systemLogRoutes] list', err)
    ok(res, { list: [], total: 0, page: 1, size: 20 })
  }
})

router.get('/retention-config', (req, res) => {
  ok(res, { retentionDays: 90, maxSize: '1GB' })
})

router.get('/action-stats', async (req, res) => {
  ok(res, [])
})

router.post('/clean', async (req, res) => {
  res.json({ code: 0, message: '清理任务已提交' })
})

router.get('/export/:type', async (req, res) => {
  ok(res, [])
})

export default router
