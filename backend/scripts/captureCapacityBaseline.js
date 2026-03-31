#!/usr/bin/env node
import 'dotenv/config'
import fs from 'fs/promises'
import path from 'path'
import monitorService from '../src/services/monitorService.js'
import capacityBaselineService from '../src/services/capacityBaselineService.js'
import businessMonitorService from '../src/services/businessMonitorService.js'
import db from '../src/config/database.js'
import redisConnection from '../src/config/queue.js'
import { disconnectRedis } from '../src/utils/redis.js'

function parseArgs(argv) {
  const options = {
    samples: 1,
    intervalMs: 5000,
    output: '',
    pretty: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--samples' && next) {
      options.samples = Math.max(1, Number.parseInt(next, 10) || 1)
      index += 1
    } else if (arg === '--intervalMs' && next) {
      options.intervalMs = Math.max(1000, Number.parseInt(next, 10) || 5000)
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

function formatStamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-')
}

function buildSummary(samples) {
  const healthScores = samples.map((item) => Number(item.metrics?.health?.score || 0))
  const dbLatencies = samples
    .map((item) => Number(item.metrics?.database?.latency || 0))
    .filter((value) => Number.isFinite(value) && value >= 0)
  const redisLatencies = samples
    .map((item) => Number(item.metrics?.redis?.latency || 0))
    .filter((value) => Number.isFinite(value) && value >= 0)

  const waitingSeries = samples.map((item) => Number(item.capacity?.queues?.totals?.waiting || 0))
  const delayedSeries = samples.map((item) => Number(item.capacity?.queues?.totals?.delayed || 0))
  const activeSeries = samples.map((item) => Number(item.capacity?.queues?.totals?.active || 0))
  const availablePagesSeries = samples.map((item) => Number(item.capacity?.browsers?.summary?.availablePages || 0))
  const busyPagesSeries = samples.map((item) => Number(item.capacity?.browsers?.summary?.busyPages || 0))

  return {
    sampleCount: samples.length,
    windowMs:
      samples.length > 1
        ? new Date(samples[samples.length - 1].timestamp).getTime() - new Date(samples[0].timestamp).getTime()
        : 0,
    health: {
      min: Math.min(...healthScores),
      max: Math.max(...healthScores),
      avg: round(healthScores.reduce((sum, value) => sum + value, 0) / Math.max(healthScores.length, 1)),
    },
    latency: {
      databaseAvgMs: round(dbLatencies.reduce((sum, value) => sum + value, 0) / Math.max(dbLatencies.length, 1)),
      redisAvgMs: round(redisLatencies.reduce((sum, value) => sum + value, 0) / Math.max(redisLatencies.length, 1)),
    },
    queues: {
      waitingMax: Math.max(...waitingSeries),
      delayedMax: Math.max(...delayedSeries),
      activeMax: Math.max(...activeSeries),
    },
    browsers: {
      availablePagesMin: Math.min(...availablePagesSeries),
      busyPagesMax: Math.max(...busyPagesSeries),
    },
    latestAssessment: samples[samples.length - 1]?.capacity?.assessment || null,
    targets: samples[samples.length - 1]?.capacity?.targets || null,
  }
}

async function collectSample(index) {
  const [metrics, capacity, business] = await Promise.all([
    monitorService.getFullMetrics(),
    capacityBaselineService.getSnapshot(),
    businessMonitorService.getSummary(),
  ])

  return {
    index,
    timestamp: new Date().toISOString(),
    metrics,
    capacity,
    business,
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const samples = []

  for (let index = 0; index < options.samples; index += 1) {
    samples.push(await collectSample(index + 1))
    if (index < options.samples - 1) {
      await sleep(options.intervalMs)
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    options,
    summary: buildSummary(samples),
    latest: samples[samples.length - 1] || null,
    samples,
  }

  let outputPath = options.output
  if (!outputPath) {
    outputPath = path.resolve(
      process.cwd(),
      'reports',
      'capacity',
      `capacity-baseline-${formatStamp()}.json`
    )
  } else {
    outputPath = path.resolve(process.cwd(), outputPath)
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, options.pretty ? 2 : 0)}\n`, 'utf8')

  console.log(JSON.stringify({
    ok: true,
    output: outputPath,
    summary: report.summary,
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
