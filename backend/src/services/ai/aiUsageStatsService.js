import { getRedisClient } from '../../utils/redis.js'
import logger from '../../utils/logger.js'

const DAILY_PREFIX = 'ai:usage:daily'
const ROLLING_KEY = 'ai:usage:rolling'
const TTL_SECONDS = 7 * 24 * 60 * 60

function getDayKey(date = new Date()) {
  // 使用本地时间而非 UTC
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
// Old UTC version
function getDayKeyUTC(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeUsage(raw = {}) {
  const promptTokens = toNumber(
    raw.promptTokens ??
    raw.inputTokens ??
    raw.input_tokens ??
    raw.prompt_tokens ??
    raw.inputTokenCount
  )
  const completionTokens = toNumber(
    raw.completionTokens ??
    raw.outputTokens ??
    raw.output_tokens ??
    raw.completion_tokens ??
    raw.outputTokenCount
  )
  const totalTokens = toNumber(
    raw.totalTokens ??
    raw.total_tokens ??
    raw.totalTokenCount
  ) || (promptTokens + completionTokens)

  return {
    provider: raw.provider || 'unknown',
    model: raw.model || 'unknown',
    stage: raw.stage || 'unknown',
    promptTokens,
    completionTokens,
    totalTokens,
    requests: Math.max(1, toNumber(raw.requests || 1)),
    success: raw.success !== false
  }
}

async function incrementUsage(hashKey, usage) {
  const client = await getRedisClient()
  if (!client) {
    return false
  }

  const baseFields = {
    total_requests: usage.requests,
    total_prompt_tokens: usage.promptTokens,
    total_completion_tokens: usage.completionTokens,
    total_tokens: usage.totalTokens,
    total_failures: usage.success ? 0 : usage.requests
  }

  const scopedFields = {
    [`provider:${usage.provider}:requests`]: usage.requests,
    [`provider:${usage.provider}:tokens`]: usage.totalTokens,
    [`model:${usage.model}:requests`]: usage.requests,
    [`model:${usage.model}:tokens`]: usage.totalTokens,
    [`stage:${usage.stage}:requests`]: usage.requests,
    [`stage:${usage.stage}:promptTokens`]: usage.promptTokens,
    [`stage:${usage.stage}:completionTokens`]: usage.completionTokens,
    [`stage:${usage.stage}:tokens`]: usage.totalTokens
  }

  const multi = client.multi()

  for (const [field, value] of Object.entries({ ...baseFields, ...scopedFields })) {
    multi.hIncrBy(hashKey, field, value)
  }

  multi.expire(hashKey, TTL_SECONDS)
  await multi.exec()
  return true
}

export async function recordAIUsage(rawUsage = {}) {
  try {
    const usage = normalizeUsage(rawUsage)
    if (usage.totalTokens <= 0 && usage.requests <= 0) {
      return { success: false, skipped: true }
    }

    const dayKey = `${DAILY_PREFIX}:${getDayKey()}`
    await Promise.all([
      incrementUsage(dayKey, usage),
      incrementUsage(ROLLING_KEY, usage)
    ])

    return { success: true, usage }
  } catch (error) {
    logger.warn('[AIUsage] 记录 AI 消耗失败:', error.message)
    return { success: false, error: error.message }
  }
}

function collectScopedMetrics(data, prefix) {
  const metrics = []
  Object.entries(data || {}).forEach(([key, value]) => {
    if (!key.startsWith(prefix)) return
    const parts = key.split(':')
    if (parts.length < 3) return
    const name = parts[1]
    const metric = parts[2]
    const existing = metrics.find(item => item.name === name)
    if (existing) {
      existing[metric] = toNumber(value)
    } else {
      metrics.push({
        name,
        [metric]: toNumber(value)
      })
    }
  })
  // 确保 promptTokens 和 completionTokens 有默认值
  return metrics.map(m => ({
    ...m,
    promptTokens: m.promptTokens || 0,
    completionTokens: m.completionTokens || 0,
    tokens: m.tokens || 0,
    requests: m.requests || 0
  })).sort((a, b) => (b.tokens || 0) - (a.tokens || 0))
}

export async function getAIUsageStats({ day = getDayKey() } = {}) {
  try {
    const client = await getRedisClient()
    if (!client) {
      return {
        day,
        summary: {
          requests: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          failures: 0
        },
        providers: [],
        models: [],
        stages: []
      }
    }

    const hashKey = `${DAILY_PREFIX}:${day}`
    const data = await client.hGetAll(hashKey)

    return {
      day,
      summary: {
        requests: toNumber(data.total_requests),
        promptTokens: toNumber(data.total_prompt_tokens),
        completionTokens: toNumber(data.total_completion_tokens),
        totalTokens: toNumber(data.total_tokens),
        failures: toNumber(data.total_failures)
      },
      providers: collectScopedMetrics(data, 'provider:'),
      models: collectScopedMetrics(data, 'model:'),
      stages: collectScopedMetrics(data, 'stage:')
    }
  } catch (error) {
    logger.warn('[AIUsage] 获取 AI 消耗统计失败:', error.message)
    return {
      day,
      summary: {
        requests: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        failures: 0
      },
      providers: [],
      models: [],
      stages: []
    }
  }
}

export default {
  recordAIUsage,
  getAIUsageStats
}
