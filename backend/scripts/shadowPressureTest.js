#!/usr/bin/env node
import 'dotenv/config'
import fs from 'fs/promises'
import path from 'path'
import axios from 'axios'
import monitorService from '../src/services/monitorService.js'
import capacityBaselineService from '../src/services/capacityBaselineService.js'
import businessMonitorService from '../src/services/businessMonitorService.js'
import db from '../src/config/database.js'
import redisConnection from '../src/config/queue.js'
import { disconnectRedis } from '../src/utils/redis.js'

function parseArgs(argv) {
  const options = {
    durationSec: 60,
    concurrency: 12,
    thinkTimeMs: 100,
    timeoutMs: 3000,
    output: '',
    pretty: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--durationSec' && next) {
      options.durationSec = Math.max(10, Number.parseInt(next, 10) || 60)
      index += 1
    } else if (arg === '--concurrency' && next) {
      options.concurrency = Math.max(1, Number.parseInt(next, 10) || 12)
      index += 1
    } else if (arg === '--thinkTimeMs' && next) {
      options.thinkTimeMs = Math.max(0, Number.parseInt(next, 10) || 100)
      index += 1
    } else if (arg === '--timeoutMs' && next) {
      options.timeoutMs = Math.max(500, Number.parseInt(next, 10) || 3000)
      index += 1
    } else if (arg === '--output' && next) {
      options.output = next
      index += 1
    } else if (arg === '--pretty') {
      options.pretty = true
    }
  }

  return options
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function round(value, digits = 2) {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0
  const factor = 10 ** digits
  return Math.round(num * factor) / factor
}

function percentile(sorted, ratio) {
  if (!sorted.length) return 0
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * ratio)))
  return round(sorted[index])
}

function formatStamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-')
}

function getTargets() {
  return [
    { name: 'backend_health', url: 'http://127.0.0.1:5000/health' },
    { name: 'backend_api_health', url: 'http://127.0.0.1:5000/api/health' },
    { name: 'internal_queue_status', url: 'http://127.0.0.1:5000/api/internal/queue/status' },
    { name: 'browser_status_8000', url: 'http://127.0.0.1:8000/browser/status' },
    { name: 'browser_status_8001', url: 'http://127.0.0.1:8001/browser/status' },
    { name: 'browser_status_8002', url: 'http://127.0.0.1:8002/browser/status' },
  ]
}

async function collectBaseline(label) {
  const [metrics, capacity, business] = await Promise.all([
    monitorService.getFullMetrics(),
    capacityBaselineService.getSnapshot(),
    businessMonitorService.getSummary(),
  ])

  return {
    label,
    capturedAt: new Date().toISOString(),
    healthScore: Number(metrics?.health?.score || 0),
    databaseLatencyMs: Number(metrics?.database?.latency || 0),
    redisLatencyMs: Number(metrics?.redis?.latency || 0),
    queueTotals: capacity?.queues?.totals || {},
    browserSummary: capacity?.browsers?.summary || {},
    capacityAssessment: capacity?.assessment || {},
    business,
  }
}

function createStatsMap(targets) {
  const perTarget = {}
  for (const target of targets) {
    perTarget[target.name] = {
      total: 0,
      success: 0,
      failed: 0,
      timeouts: 0,
      statusCodes: {},
      latencies: [],
    }
  }
  return perTarget
}

function recordResult(store, targetName, latency, statusCode, isSuccess, isTimeout) {
  const target = store[targetName]
  target.total += 1
  target.statusCodes[statusCode] = (target.statusCodes[statusCode] || 0) + 1
  target.latencies.push(latency)

  if (isSuccess) {
    target.success += 1
  } else {
    target.failed += 1
  }

  if (isTimeout) {
    target.timeouts += 1
  }
}

function summarizeStats(perTarget, startedAt, finishedAt) {
  const targetSummaries = {}
  let totalRequests = 0
  let totalSuccess = 0
  let totalFailed = 0
  let totalTimeouts = 0
  const allLatencies = []

  for (const [targetName, stats] of Object.entries(perTarget)) {
    const latencies = [...stats.latencies].sort((a, b) => a - b)
    targetSummaries[targetName] = {
      total: stats.total,
      success: stats.success,
      failed: stats.failed,
      timeouts: stats.timeouts,
      successRate: stats.total > 0 ? round((stats.success / stats.total) * 100, 2) : 0,
      latencyMs: {
        avg: latencies.length ? round(latencies.reduce((sum, item) => sum + item, 0) / latencies.length) : 0,
        p50: percentile(latencies, 0.5),
        p95: percentile(latencies, 0.95),
        p99: percentile(latencies, 0.99),
        max: latencies.length ? round(latencies[latencies.length - 1]) : 0,
      },
      statusCodes: stats.statusCodes,
    }

    totalRequests += stats.total
    totalSuccess += stats.success
    totalFailed += stats.failed
    totalTimeouts += stats.timeouts
    allLatencies.push(...latencies)
  }

  allLatencies.sort((a, b) => a - b)
  const durationMs = finishedAt - startedAt

  return {
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date(finishedAt).toISOString(),
    durationMs,
    totalRequests,
    totalSuccess,
    totalFailed,
    totalTimeouts,
    successRate: totalRequests > 0 ? round((totalSuccess / totalRequests) * 100, 2) : 0,
    rps: durationMs > 0 ? round(totalRequests / (durationMs / 1000), 2) : 0,
    latencyMs: {
      avg: allLatencies.length ? round(allLatencies.reduce((sum, item) => sum + item, 0) / allLatencies.length) : 0,
      p50: percentile(allLatencies, 0.5),
      p95: percentile(allLatencies, 0.95),
      p99: percentile(allLatencies, 0.99),
      max: allLatencies.length ? round(allLatencies[allLatencies.length - 1]) : 0,
    },
    targets: targetSummaries,
  }
}

function buildDelta(before, after) {
  return {
    healthScore: {
      before: before.healthScore,
      after: after.healthScore,
      delta: round(after.healthScore - before.healthScore),
    },
    databaseLatencyMs: {
      before: before.databaseLatencyMs,
      after: after.databaseLatencyMs,
      delta: round(after.databaseLatencyMs - before.databaseLatencyMs),
    },
    redisLatencyMs: {
      before: before.redisLatencyMs,
      after: after.redisLatencyMs,
      delta: round(after.redisLatencyMs - before.redisLatencyMs),
    },
    queueWaiting: {
      before: Number(before.queueTotals?.waiting || 0),
      after: Number(after.queueTotals?.waiting || 0),
      delta: Number(after.queueTotals?.waiting || 0) - Number(before.queueTotals?.waiting || 0),
    },
    queueDelayed: {
      before: Number(before.queueTotals?.delayed || 0),
      after: Number(after.queueTotals?.delayed || 0),
      delta: Number(after.queueTotals?.delayed || 0) - Number(before.queueTotals?.delayed || 0),
    },
    browserAvailablePages: {
      before: Number(before.browserSummary?.availablePages || 0),
      after: Number(after.browserSummary?.availablePages || 0),
      delta: Number(after.browserSummary?.availablePages || 0) - Number(before.browserSummary?.availablePages || 0),
    },
  }
}

async function workerLoop(workerId, endAt, targets, client, perTarget, thinkTimeMs) {
  let targetIndex = workerId % targets.length

  while (Date.now() < endAt) {
    const target = targets[targetIndex % targets.length]
    targetIndex += 1
    const startedAt = Date.now()

    try {
      const response = await client.get(target.url, {
        validateStatus: () => true,
      })
      const latency = Date.now() - startedAt
      recordResult(
        perTarget,
        target.name,
        latency,
        response.status,
        response.status >= 200 && response.status < 500,
        false
      )
    } catch (error) {
      const latency = Date.now() - startedAt
      const isTimeout = error.code === 'ECONNABORTED'
      recordResult(perTarget, target.name, latency, isTimeout ? 'timeout' : 'error', false, isTimeout)
    }

    if (thinkTimeMs > 0) {
      await sleep(thinkTimeMs)
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const targets = getTargets()
  const client = axios.create({
    timeout: options.timeoutMs,
  })

  const before = await collectBaseline('before')
  const perTarget = createStatsMap(targets)
  const startedAt = Date.now()
  const endAt = startedAt + options.durationSec * 1000

  await Promise.all(
    Array.from({ length: options.concurrency }, (_, index) =>
      workerLoop(index, endAt, targets, client, perTarget, options.thinkTimeMs)
    )
  )

  const finishedAt = Date.now()
  const after = await collectBaseline('after')
  const loadSummary = summarizeStats(perTarget, startedAt, finishedAt)

  const report = {
    generatedAt: new Date().toISOString(),
    options,
    before,
    loadSummary,
    after,
    delta: buildDelta(before, after),
  }

  let outputPath = options.output
  if (!outputPath) {
    outputPath = path.resolve(
      process.cwd(),
      'reports',
      'capacity',
      `shadow-pressure-${formatStamp()}.json`
    )
  } else {
    outputPath = path.resolve(process.cwd(), outputPath)
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, options.pretty ? 2 : 0)}\n`, 'utf8')

  console.log(JSON.stringify({
    ok: true,
    output: outputPath,
    loadSummary: report.loadSummary,
    delta: report.delta,
  }, null, options.pretty ? 2 : 0))
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      error: error.message,
      stack: error.stack,
    }, null, 2))
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectRedis().catch(() => {})
    await redisConnection.quit().catch(() => {})
    await db.pool.end().catch(() => {})
  })
