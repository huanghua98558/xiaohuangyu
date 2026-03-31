/**
 * IP 监控 API 路由（供管理后台调用）
 */
import express from 'express'
import axios from 'axios'
import logger from '../utils/logger.js'
import { authMiddleware, adminOnly } from '../middlewares/auth.js'

const router = express.Router()
const BROWSER_PORTS = [8000, 8001, 8002]

function backendInternalBase() {
  if (process.env.BACKEND_INTERNAL_URL) {
    return String(process.env.BACKEND_INTERNAL_URL).replace(/\/$/, '')
  }
  const port = process.env.PORT || process.env.BACKEND_PORT || '8080'
  return `http://127.0.0.1:${port}`
}

// 所有路由需要管理员权限
router.use(authMiddleware, adminOnly)

/**
 * 获取 IP 池状态
 */
router.get('/ip-status', async (req, res) => {
  try {
    const response = await axios.get(`${backendInternalBase()}/api/internal/ip/status`, { timeout: 5000 })
    res.json({ code: 0, data: response.data?.data || response.data })
  } catch (error) {
    logger.error('[IP Monitor] 获取 IP 状态失败:', error.message)
    res.status(500).json({ code: 500, message: error.message, data: null })
  }
})

/**
 * 获取浏览器服务状态
 */
router.get('/browser-status', async (req, res) => {
  try {
    const results = await Promise.all(
      BROWSER_PORTS.map(async (port) => {
        try {
          const response = await axios.get(`http://127.0.0.1:${port}/`, { timeout: 3000 })
          return {
            port,
            status: 'online',
            version: response.data?.version || 'unknown',
            healthy: response.data?.status === 'ok'
          }
        } catch (e) {
          return { port, status: 'offline', error: e.message, healthy: false }
        }
      })
    )

    res.json({
      code: 0,
      data: {
        services: results,
        healthyCount: results.filter(r => r.healthy).length,
        totalCount: results.length
      }
    })
  } catch (error) {
    logger.error('[IP Monitor] 获取浏览器状态失败:', error.message)
    res.status(500).json({ code: 500, message: error.message, data: null })
  }
})

/**
 * 获取队列状态
 */
router.get('/queue-status', async (req, res) => {
  try {
    const response = await axios.get(`${backendInternalBase()}/api/internal/queue/status`, { timeout: 5000 })
    res.json({ code: 0, data: response.data?.data || response.data })
  } catch (error) {
    logger.error('[IP Monitor] 获取队列状态失败:', error.message)
    res.status(500).json({ code: 500, message: error.message, data: null })
  }
})

/**
 * 切换 IP 模式
 */
router.post('/switch-mode', async (req, res) => {
  try {
    const { mode } = req.body
    const response = await axios.post(`${backendInternalBase()}/api/internal/ip/switch-mode`, { mode }, { timeout: 5000 })
    res.json({ code: 0, data: response.data?.data || response.data })
  } catch (error) {
    logger.error('[IP Monitor] 切换模式失败:', error.message)
    res.status(500).json({ code: 500, message: error.message, data: null })
  }
})

/**
 * 获取完整监控数据（聚合接口）
 */
router.get('/full-status', async (req, res) => {
  try {
    const [ipStatus, browserStatus, queueStatus] = await Promise.all([
      axios.get(`${backendInternalBase()}/api/internal/ip/status`, { timeout: 5000 }).catch(() => ({ data: { code: 500, data: null } })),
      Promise.all(BROWSER_PORTS.map(async (port) => {
        try {
          const response = await axios.get(`http://127.0.0.1:${port}/`, { timeout: 3000 })
          return { port, status: 'online', version: response.data?.version, healthy: response.data?.status === 'ok' }
        } catch {
          return { port, status: 'offline', healthy: false }
        }
      })),
      axios.get(`${backendInternalBase()}/api/internal/queue/status`, { timeout: 5000 }).catch(() => ({ data: { code: 500, data: null } }))
    ])

    res.json({
      code: 0,
      data: {
        ip: ipStatus.data?.data || null,
        browsers: browserStatus,
        queues: queueStatus.data?.data || null
      }
    })
  } catch (error) {
    logger.error('[IP Monitor] 获取完整状态失败:', error.message)
    res.status(500).json({ code: 500, message: error.message, data: null })
  }
})



// 前端路径兼容（不用内部转发，直接调用内部API）
router.get('/status', async (req, res) => {
  try {
    const axios = (await import('axios')).default
    const r = await axios.get(`${backendInternalBase()}/api/internal/ip/status`, { timeout: 3000 })
    res.json({ code: 0, data: r.data?.data || r.data })
  } catch (e) {
    res.json({ code: 0, data: { mode: 'direct', status: 'unknown' } })
  }
})

router.get('/pool', async (req, res) => {
  try {
    const axios = (await import('axios')).default
    const r = await axios.get(`${backendInternalBase()}/api/internal/ip/status`, { timeout: 3000 })
    res.json({ code: 0, data: r.data?.data || r.data })
  } catch (e) {
    res.json({ code: 0, data: { ips: [], total: 0 } })
  }
})

router.get('/stats', async (req, res) => {
  try {
    const axios = (await import('axios')).default
    const r = await axios.get(`${backendInternalBase()}/api/internal/queue/status`, { timeout: 3000 })
    res.json({ code: 0, data: r.data?.data || r.data })
  } catch (e) {
    res.json({ code: 0, data: { queues: [] } })
  }
})

export default router
