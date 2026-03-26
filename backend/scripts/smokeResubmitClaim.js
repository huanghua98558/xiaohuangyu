import 'dotenv/config'
import taskService from '../src/services/taskService.js'
import db from '../src/config/database.js'

const DEFAULT_USER_ID = process.env.SMOKE_USER_ID || '2111864833'
const DEFAULT_CLAIM_ID = process.env.SMOKE_CLAIM_ID || '4'
const DEFAULT_PLATFORM_NICKNAME = process.env.SMOKE_PLATFORM_NICKNAME || 'smoke-resubmit'
const DEFAULT_EVALUATION = process.env.SMOKE_EVALUATION || 'smoke resubmit verification'
const POLL_INTERVAL_MS = Number.parseInt(process.env.SMOKE_POLL_INTERVAL_MS || '3000', 10)
const POLL_TIMEOUT_MS = Number.parseInt(process.env.SMOKE_POLL_TIMEOUT_MS || '90000', 10)

function safeParseJson(raw, fallback = null) {
  if (raw === undefined || raw === null) {
    return fallback
  }
  if (typeof raw !== 'string') {
    return raw
  }
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

async function getClaimSnapshot(claimId) {
  const claim = await db.queryOne(
    `
    SELECT
      id,
      user_id,
      task_id,
      status,
      platform_nickname,
      screenshots,
      submitted_at,
      reviewed_at,
      ai_review_status,
      ai_reason,
      image_review_status,
      image_review_reason,
      image_reviewed_at,
      link_review_status,
      link_review_reason,
      link_reviewed_at,
      reject_count,
      review_history
    FROM claims
    WHERE id = $1
    `,
    [Number(claimId)]
  )

  const queueRows = await db.queryMany(
    `
    SELECT id, status, retry_count, last_error, created_at, updated_at
    FROM ai_review_queue
    WHERE claim_id = $1
    ORDER BY updated_at DESC
    `,
    [Number(claimId)]
  )

  if (!claim) {
    return { claim: null, queue: queueRows }
  }

  const reviewHistory = safeParseJson(claim.review_history, [])

  return {
    claim: {
      ...claim,
      screenshots: safeParseJson(claim.screenshots, []),
      review_history_count: Array.isArray(reviewHistory) ? reviewHistory.length : 0,
      latest_review_history: Array.isArray(reviewHistory) && reviewHistory.length > 0
        ? reviewHistory[reviewHistory.length - 1]
        : null
    },
    queue: queueRows
  }
}

function isTerminalStatus(snapshot) {
  const status = snapshot?.claim?.status
  return [
    'approved',
    'released',
    'doing',
    'pending_manual',
    'image_rejected',
    'link_rejected',
    'rejected'
  ].includes(status)
}

async function main() {
  const claimId = DEFAULT_CLAIM_ID
  const userId = DEFAULT_USER_ID

  const before = await getClaimSnapshot(claimId)
  const screenshots = before?.claim?.screenshots || []

  const output = {
    claimId,
    userId,
    before,
    submitResult: null,
    submitError: null,
    timeline: []
  }

  try {
    output.submitResult = await taskService.submitTask(
      userId,
      claimId,
      DEFAULT_PLATFORM_NICKNAME,
      screenshots,
      DEFAULT_EVALUATION
    )
  } catch (error) {
    output.submitError = {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      statusCode: error?.statusCode,
      stack: error?.stack?.split('\n').slice(0, 8)
    }
    console.log(JSON.stringify(output, null, 2))
    await db.pool.end()
    process.exit(1)
  }

  const startedAt = Date.now()
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const snapshot = await getClaimSnapshot(claimId)
    output.timeline.push({
      at: new Date().toISOString(),
      snapshot
    })

    if (isTerminalStatus(snapshot)) {
      break
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  output.after = await getClaimSnapshot(claimId)
  console.log(JSON.stringify(output, null, 2))
  await db.pool.end()
}

main().catch(async (error) => {
  console.error(error)
  try {
    await db.pool.end()
  } catch {}
  process.exit(1)
})
