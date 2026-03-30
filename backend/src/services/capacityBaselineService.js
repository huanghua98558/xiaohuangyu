import axios from 'axios'
import { Queue } from 'bullmq'
import db from '../config/database.js'
import redisConnection from '../config/queue.js'
import reviewConfigService from './ai/reviewConfigService.js'
import logger from '../utils/logger.js'

const DEFAULT_BROWSER_PORTS = [8000, 8001, 8002]
const DAILY_TARGETS = {
  ocrImages: 60000,
  yoloImages: 30000,
  linkReviews: 30000,
}

function round(value, digits = 2) {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0
  const factor = 10 ** digits
  return Math.round(num * factor) / factor
}

function toInt(value, fallback = 0) {
  const num = Number.parseInt(value, 10)
  return Number.isFinite(num) ? num : fallback
}

function parsePortList(rawValue) {
  if (!rawValue) return [...DEFAULT_BROWSER_PORTS]
  const ports = String(rawValue)
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0)
  return ports.length > 0 ? ports : [...DEFAULT_BROWSER_PORTS]
}

function buildTargetRate(total) {
  return {
    daily: total,
    hourly: round(total / 24, 2),
    perMinute: round(total / (24 * 60), 2),
    perSecond: round(total / (24 * 60 * 60), 4),
  }
}

function normalizeBrowserStatus(port, payload) {
  const data = payload?.data || {}
  return {
    port,
    healthy: Boolean(data.healthy),
    availablePages: toInt(data.available_pages),
    totalPages: toInt(data.total_pages),
    targetPages: toInt(data.target_pages),
    requestCount: toInt(data.request_count),
    ageMinutes: round(data.age_minutes, 2),
    config: data.config || {},
  }
}

async function getQueueMetricsByName(queueName, displayName) {
  const queue = new Queue(queueName, { connection: redisConnection })
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ])

    return {
      queueName,
      name: displayName,
      waiting,
      active,
      delayed,
      completed,
      failed,
    }
  } catch (error) {
    return {
      queueName,
      name: displayName,
      waiting: 0,
      active: 0,
      delayed: 0,
      completed: 0,
      failed: 0,
      error: error.message,
    }
  } finally {
    await queue.close().catch(() => {})
  }
}

class CapacityBaselineService {
  constructor() {
    this.browserPorts = parsePortList(process.env.LINK_VERIFY_BROWSER_PORTS)
  }

  getTargets() {
    return {
      ocrImages: buildTargetRate(DAILY_TARGETS.ocrImages),
      yoloImages: buildTargetRate(DAILY_TARGETS.yoloImages),
      linkReviews: buildTargetRate(DAILY_TARGETS.linkReviews),
    }
  }

  async getQueueSnapshot() {
    const [imageQueue, ...bullQueues] = await Promise.all([
      db.queryOne(
        `
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending')::int AS waiting,
          COUNT(*) FILTER (WHERE status = 'processing')::int AS active,
          COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
          COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
        FROM ai_review_queue
        `
      ),
      getQueueMetricsByName('link-verify-queue', '链接验证队列'),
      getQueueMetricsByName('link-delay-queue', '连接延迟队列'),
    ])

    const queues = [
      {
        queueName: 'ai_review_queue',
        name: '图片审核队列',
        waiting: toInt(imageQueue?.waiting),
        active: toInt(imageQueue?.active),
        delayed: 0,
        completed: toInt(imageQueue?.completed),
        failed: toInt(imageQueue?.failed),
      },
      ...bullQueues,
    ]

    return {
      queues,
      totals: {
        waiting: queues.reduce((sum, item) => sum + toInt(item.waiting), 0),
        active: queues.reduce((sum, item) => sum + toInt(item.active), 0),
        delayed: queues.reduce((sum, item) => sum + toInt(item.delayed), 0),
        completed: queues.reduce((sum, item) => sum + toInt(item.completed), 0),
        failed: queues.reduce((sum, item) => sum + toInt(item.failed), 0),
      },
    }
  }

  async getBrowserPoolSnapshot() {
    const results = await Promise.all(
      this.browserPorts.map(async (port) => {
        try {
          const response = await axios.get(`http://127.0.0.1:${port}/browser/status`, { timeout: 3000 })
          return normalizeBrowserStatus(port, response)
        } catch (error) {
          return {
            port,
            healthy: false,
            availablePages: 0,
            totalPages: 0,
            targetPages: 0,
            requestCount: 0,
            ageMinutes: 0,
            config: {},
            error: error.message,
          }
        }
      })
    )

    return {
      instances: results,
      summary: {
        healthyCount: results.filter((item) => item.healthy).length,
        totalInstances: results.length,
        totalPages: results.reduce((sum, item) => sum + toInt(item.totalPages), 0),
        availablePages: results.reduce((sum, item) => sum + toInt(item.availablePages), 0),
        targetPages: results.reduce((sum, item) => sum + toInt(item.targetPages), 0),
        busyPages: results.reduce(
          (sum, item) => sum + Math.max(0, toInt(item.totalPages) - toInt(item.availablePages)),
          0
        ),
      },
    }
  }

  async getRuntimeConfigSnapshot() {
    try {
      const config = await reviewConfigService.getConfig()
      return {
        review: {
          linkVerify: config?.linkVerify || null,
          semantic: config?.semantic || null,
          aiFallback: config?.aiFallback || null,
        },
      }
    } catch (error) {
      logger.warn(`[CapacityBaseline] 获取运行配置失败: ${error.message}`)
      return {
        review: {
          linkVerify: null,
          semantic: null,
          aiFallback: null,
        },
      }
    }
  }

  buildAssessment({ queues, browsers, runtimeConfig }) {
    const issues = []
    const queueWaiting = queues?.totals?.waiting || 0
    const delayed = queues?.totals?.delayed || 0
    const totalPages = browsers?.summary?.totalPages || 0
    const availablePages = browsers?.summary?.availablePages || 0
    const healthyCount = browsers?.summary?.healthyCount || 0
    const totalInstances = browsers?.summary?.totalInstances || 0
    const batchThreshold = runtimeConfig?.review?.linkVerify?.batchThreshold || 0
    const queueSoftLimit = Math.max(batchThreshold * 3, 12)

    if (healthyCount < totalInstances) {
      issues.push(`浏览器实例异常: ${healthyCount}/${totalInstances} 健康`)
    }
    if (queueWaiting > queueSoftLimit) {
      issues.push(`队列等待偏高: waiting=${queueWaiting}, softLimit=${queueSoftLimit}`)
    }
    if (delayed > queueSoftLimit * 2) {
      issues.push(`延迟队列堆积偏高: delayed=${delayed}`)
    }
    if (totalPages > 0 && availablePages === 0) {
      issues.push('浏览器页签已满载')
    }

    let status = 'healthy'
    if (issues.length >= 3) {
      status = 'critical'
    } else if (issues.length > 0) {
      status = 'warning'
    }

    return {
      status,
      issues,
      queueSoftLimit,
    }
  }

  async getSnapshot() {
    const [queues, browsers, runtimeConfig] = await Promise.all([
      this.getQueueSnapshot(),
      this.getBrowserPoolSnapshot(),
      this.getRuntimeConfigSnapshot(),
    ])

    return {
      timestamp: new Date().toISOString(),
      targets: this.getTargets(),
      queues,
      browsers,
      runtimeConfig,
      assessment: this.buildAssessment({ queues, browsers, runtimeConfig }),
    }
  }
}

export default new CapacityBaselineService()
