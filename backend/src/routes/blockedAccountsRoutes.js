import { Router } from 'express'
import { authMiddleware, adminOnly } from '../middlewares/auth.js'
import {
  checkAccountBlocked,
  confirmBlock,
  getBlockedAccounts,
  getBlockStats,
  markAsFalsePositive,
} from '../services/blockedAccountsService.js'

const router = Router()

router.use(authMiddleware, adminOnly)

router.get('/', async (req, res) => {
  try {
    const result = await getBlockedAccounts({
      status: req.query.status,
      platform: req.query.platform,
      userId: req.query.userId,
      page: req.query.page,
      pageSize: req.query.pageSize || req.query.size,
    })
    res.json(result)
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/stats', async (_req, res) => {
  try {
    const result = await getBlockStats()
    res.json(result)
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/check', async (req, res) => {
  try {
    const { platform, accountId } = req.body || {}
    if (!platform || !accountId) {
      return res.status(400).json({ success: false, error: '缺少必要参数' })
    }

    const result = await checkAccountBlocked(platform, accountId)
    res.json(result)
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/:id/confirm', async (req, res) => {
  try {
    const result = await confirmBlock(req.params.id, req.userId, req.body?.notes || req.body?.note || '')
    res.status(result.success ? 200 : 400).json(result)
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/:id/false-positive', async (req, res) => {
  try {
    const result = await markAsFalsePositive(req.params.id, req.userId, req.body?.notes || req.body?.note || '')
    res.status(result.success ? 200 : 400).json(result)
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
