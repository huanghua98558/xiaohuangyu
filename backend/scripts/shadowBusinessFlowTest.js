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
    sampleManifest: '',
    stages: '4x60,8x90,12x120',
    thinkTimeMs: 200,
    timeoutMs: 30000,
    output: '',
    pretty: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--sampleManifest' && next) {
      options.sampleManifest = next
      index += 1
    } else if (arg === '--stages' && next) {
      options.stages = next
      index += 1
    } else if (arg === '--thinkTimeMs' && next) {
      options.thinkTimeMs = Math.max(0, Number.parseInt(next, 10) || 200)
      index += 1
    } else if (arg === '--timeoutMs' && next) {
      options.timeoutMs = Math.max(1000, Number.parseInt(next, 10) || 30000)
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

function parseStages(rawValue) {
  return String(rawValue)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => {
      const match = item.match(/^(\d+)x(\d+)$/)
      if (!match) {
        throw new Error(`无效的 stage 格式: ${item}，期望类似 4x60`)
      }
      return {
        name: `stage_${index + 1}`,
        concurrency: Number.parseInt(match[1], 10),
        durationSec: Number.parseInt(match[2], 10),
      }
    })
}

async function loadSamples(manifestPath) {
  if (!manifestPath) {
    throw new Error('缺少 --sampleManifest')
  }

  const resolvedPath = path.resolve(process.cwd(), manifestPath)
  const raw = await fs.readFile(resolvedPath, 'utf8')
  const parsed = JSON.parse(raw)
  const samples = Array.isArray(parsed?.samples) ? parsed.samples : []
  if (samples.length === 0) {
    throw new Error('sample manifest 中没有 samples')
  }

  for (const [index, sample] of samples.entries()) {
    if (!sample.homepageImageUrl || !sample.commentImageUrl || !sample.videoUrl) {
      throw new Error(`sample[${index}] 缺少 homepageImageUrl/commentImageUrl/videoUrl`)
    }
  }

  return samples
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

function createStageStats(stage) {
  return {
    stage: stage.name,
    concurrency: stage.concurrency,
    durationSec: stage.durationSec,
    claims: {
      total: 0,
      success: 0,
      failed: 0,
      latencies: [],
    },
    steps: {
      ocr_homepage: { total: 0, success: 0, failed: 0, latencies: [] },
      ocr_comment: { total: 0, success: 0, failed: 0, latencies: [] },
      yolo_comment: { total: 0, success: 0, failed: 0, latencies: [] },
      browser_visit: { total: 0, success: 0, failed: 0, latencies: [] },
    },
  }
}

function recordStep(stepStats, latency, success) {
  stepStats.total += 1
  stepStats.latencies.push(latency)
  if (success) {
    stepStats.success += 1
  } else {
    stepStats.failed += 1
  }
}

function summarizeLatency(latencies) {
  const sorted = [...latencies].sort((a, b) => a - b)
  return {
    avg: sorted.length ? round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length) : 0,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    max: sorted.length ? round(sorted[sorted.length - 1]) : 0,
  }
}

function summarizeStage(stageStats) {
  const stepSummary = {}
  for (const [stepName, stats] of Object.entries(stageStats.steps)) {
    stepSummary[stepName] = {
      total: stats.total,
      success: stats.success,
      failed: stats.failed,
      successRate: stats.total > 0 ? round((stats.success / stats.total) * 100, 2) : 0,
      latencyMs: summarizeLatency(stats.latencies),
    }
  }

  return {
    stage: stageStats.stage,
    concurrency: stageStats.concurrency,
    durationSec: stageStats.durationSec,
    claims: {
      total: stageStats.claims.total,
      success: stageStats.claims.success,
      failed: stageStats.claims.failed,
      successRate:
        stageStats.claims.total > 0
          ? round((stageStats.claims.success / stageStats.claims.total) * 100, 2)
          : 0,
      latencyMs: summarizeLatency(stageStats.claims.latencies),
    },
    steps: stepSummary,
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
    queueWaiting: {
      before: Number(before.queueTotals?.waiting || 0),
      after: Number(after.queueTotals?.waiting || 0),
      delta: Number(after.queueTotals?.waiting || 0) - Number(before.queueTotals?.waiting || 0),
    },
    browserAvailablePages: {
      before: Number(before.browserSummary?.availablePages || 0),
      after: Number(after.browserSummary?.availablePages || 0),
      delta: Number(after.browserSummary?.availablePages || 0) - Number(before.browserSummary?.availablePages || 0),
    },
  }
}

function extractPlayableUrl(rawUrl) {
  const text = String(rawUrl || '').trim()
  if (!text) return ''
  const match = text.match(/https?:\/\/[^\s"'<>]+/)
  if (!match) return text
  return match[0].replace(/[，。；、)]+$/u, '')
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function evaluateOcrHomepage(response) {
  const data = response?.data
  return (
    response?.status >= 200 &&
    response?.status < 300 &&
    isPlainObject(data) &&
    (Boolean(data.author) || Boolean(data.ocr_text))
  )
}

function evaluateOcrComment(response) {
  const data = response?.data
  return (
    response?.status >= 200 &&
    response?.status < 300 &&
    isPlainObject(data) &&
    (Boolean(data.comment) || Boolean(data.ocr_text))
  )
}

function evaluateYolo(response) {
  const data = response?.data
  return (
    response?.status >= 200 &&
    response?.status < 300 &&
    isPlainObject(data) &&
    !data.error
  )
}

function evaluateBrowserVisit(response) {
  const data = response?.data
  const totalComments = Number(data?.total_comments || 0)
  const comments = Array.isArray(data?.comments) ? data.comments.length : 0
  return (
    response?.status >= 200 &&
    response?.status < 300 &&
    isPlainObject(data) &&
    data.success === true &&
    (data.has_comment === true || totalComments > 0 || comments > 0)
  )
}

async function runStep(client, method, url, config = {}) {
  const startedAt = Date.now()
  const evaluator = typeof config.evaluate === 'function' ? config.evaluate : null
  const requestConfig = { ...config }
  delete requestConfig.evaluate

  try {
    const response = await client.request({
      method,
      url,
      ...requestConfig,
      validateStatus: () => true,
    })

    const success = evaluator
      ? evaluator(response)
      : response.status >= 200 && response.status < 300

    return {
      success,
      latency: Date.now() - startedAt,
      status: response.status,
      data: response.data,
    }
  } catch (error) {
    return {
      success: false,
      latency: Date.now() - startedAt,
      error: error.message,
    }
  }
}

async function runClaimScenario(client, sample, browserPort, ocrBaseUrl, stageStats) {
  const claimStartedAt = Date.now()
  const videoUrl = extractPlayableUrl(sample.videoUrl)

  const ocrHomepage = await runStep(client, 'post', `${ocrBaseUrl}/ocr/analyze`, {
    data: {
      image_url: sample.homepageImageUrl,
      image_type: 'homepage',
    },
    evaluate: evaluateOcrHomepage,
  })
  recordStep(stageStats.steps.ocr_homepage, ocrHomepage.latency, ocrHomepage.success)

  const ocrComment = await runStep(client, 'post', `${ocrBaseUrl}/ocr/analyze`, {
    data: {
      image_url: sample.commentImageUrl,
      image_type: 'comment',
    },
    evaluate: evaluateOcrComment,
  })
  recordStep(stageStats.steps.ocr_comment, ocrComment.latency, ocrComment.success)

  const yoloComment = await runStep(client, 'post', 'http://127.0.0.1:8003/yolo/detect', {
    params: {
      image_url: sample.commentImageUrl,
    },
    evaluate: evaluateYolo,
  })
  recordStep(stageStats.steps.yolo_comment, yoloComment.latency, yoloComment.success)

  const browserVisit = await runStep(
    client,
    'post',
    `http://127.0.0.1:${browserPort}/browser/visit`,
    {
      data: {
        url: videoUrl,
        max_comments: 10,
        check_comment: true,
        proxy_url: null,
      },
      evaluate: evaluateBrowserVisit,
    }
  )
  recordStep(stageStats.steps.browser_visit, browserVisit.latency, browserVisit.success)

  const claimSuccess = ocrHomepage.success && ocrComment.success && yoloComment.success && browserVisit.success
  const claimLatency = Date.now() - claimStartedAt

  stageStats.claims.total += 1
  stageStats.claims.latencies.push(claimLatency)
  if (claimSuccess) {
    stageStats.claims.success += 1
  } else {
    stageStats.claims.failed += 1
  }
}

async function runStage(stage, samples, options) {
  const stats = createStageStats(stage)
  const client = axios.create({
    timeout: options.timeoutMs,
  })
  const browserPorts = [8000, 8001, 8002]
  const ocrBaseUrls = ['http://127.0.0.1:9001', 'http://127.0.0.1:9002']
  const endAt = Date.now() + stage.durationSec * 1000

  await Promise.all(
    Array.from({ length: stage.concurrency }, async (_, workerIndex) => {
      let iteration = 0
      while (Date.now() < endAt) {
        const sample = samples[(workerIndex + iteration) % samples.length]
        const browserPort = browserPorts[(workerIndex + iteration) % browserPorts.length]
        const ocrBaseUrl = ocrBaseUrls[(workerIndex + iteration) % ocrBaseUrls.length]
        await runClaimScenario(client, sample, browserPort, ocrBaseUrl, stats)
        iteration += 1
        if (options.thinkTimeMs > 0) {
          await sleep(options.thinkTimeMs)
        }
      }
    })
  )

  return summarizeStage(stats)
}

function buildReportSummary(stageResults, before, after) {
  const stepNames = ['ocr_homepage', 'ocr_comment', 'yolo_comment', 'browser_visit']
  const totals = {
    claims: stageResults.reduce((sum, stage) => sum + stage.claims.total, 0),
    successfulClaims: stageResults.reduce((sum, stage) => sum + stage.claims.success, 0),
    failedClaims: stageResults.reduce((sum, stage) => sum + stage.claims.failed, 0),
  }
  totals.successRate = totals.claims > 0 ? round((totals.successfulClaims / totals.claims) * 100, 2) : 0
  totals.avgClaimDurationMs =
    totals.claims > 0
      ? round(
          stageResults.reduce(
            (sum, stage) => sum + stage.claims.latencyMs.avg * stage.claims.total,
            0
          ) / totals.claims
        )
      : 0
  totals.maxClaimP95Ms = Math.max(0, ...stageResults.map((stage) => stage.claims.latencyMs.p95))

  const steps = {}
  for (const stepName of stepNames) {
    const total = stageResults.reduce((sum, stage) => sum + stage.steps[stepName].total, 0)
    const success = stageResults.reduce((sum, stage) => sum + stage.steps[stepName].success, 0)
    const failed = stageResults.reduce((sum, stage) => sum + stage.steps[stepName].failed, 0)
    steps[stepName] = {
      total,
      success,
      failed,
      successRate: total > 0 ? round((success / total) * 100, 2) : 0,
      avgMs:
        total > 0
          ? round(
              stageResults.reduce(
                (sum, stage) => sum + stage.steps[stepName].latencyMs.avg * stage.steps[stepName].total,
                0
              ) / total
            )
          : 0,
      maxP95Ms: Math.max(0, ...stageResults.map((stage) => stage.steps[stepName].latencyMs.p95)),
      maxMs: Math.max(0, ...stageResults.map((stage) => stage.steps[stepName].latencyMs.max)),
    }
  }

  return {
    totals,
    steps,
    health: {
      before: before.healthScore,
      after: after.healthScore,
      delta: round(after.healthScore - before.healthScore),
    },
    databaseLatencyMs: {
      before: before.databaseLatencyMs,
      after: after.databaseLatencyMs,
      delta: round(after.databaseLatencyMs - before.databaseLatencyMs),
    },
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const samples = await loadSamples(options.sampleManifest)
  const stages = parseStages(options.stages)

  const before = await collectBaseline('before')
  const stageResults = []

  for (const stage of stages) {
    stageResults.push(await runStage(stage, samples, options))
  }

  const after = await collectBaseline('after')
  const report = {
    generatedAt: new Date().toISOString(),
    options,
    stages,
    before,
    stageResults,
    after,
    delta: buildDelta(before, after),
    summary: buildReportSummary(stageResults, before, after),
  }

  let outputPath = options.output
  if (!outputPath) {
    outputPath = path.resolve(
      process.cwd(),
      'reports',
      'capacity',
      `shadow-business-flow-${formatStamp()}.json`
    )
  } else {
    outputPath = path.resolve(process.cwd(), outputPath)
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, options.pretty ? 2 : 0)}\n`, 'utf8')

  console.log(JSON.stringify({
    ok: true,
    output: outputPath,
    stages: report.stageResults,
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
