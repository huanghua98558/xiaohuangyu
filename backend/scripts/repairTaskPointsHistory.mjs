import 'dotenv/config'
import db from '../src/config/database.js'
import nightPointService from '../src/services/nightPointService.js'
import {
  calculatePointBreakdown,
  parseJsonObject,
  roundPoints,
  toSafeNumber,
} from '../src/utils/taskSettlement.js'

const DRY_RUN = process.argv.includes('--dry-run')
const CLAIM_FILTER = process.argv
  .find((arg) => arg.startsWith('--claim='))
  ?.split('=')[1]

function parseRecordClaimId(record = {}) {
  const extra = parseJsonObject(record.extra_data, {})
  if (extra?.claimId) return String(extra.claimId)
  const desc = String(record.desc || '')
  const match = desc.match(/claim:(\d+)/)
  return match?.[1] || null
}

async function getTaskRecordMap() {
  const rows = await db.queryMany(`
    SELECT id, user_id, task_id, points, "desc", extra_data, created_at
    FROM records
    WHERE type = 'task'
    ORDER BY id DESC
  `)

  const recordMap = new Map()
  for (const row of rows || []) {
    const claimId = parseRecordClaimId(row)
    if (!claimId || recordMap.has(claimId)) continue
    recordMap.set(claimId, row)
  }
  return recordMap
}

async function getCorrectionMap() {
  const rows = await db.queryMany(`
    SELECT id, points, "desc", extra_data
    FROM records
    WHERE type = 'task_adjustment'
      OR "desc" LIKE '%claim-adjust:%'
    ORDER BY id DESC
  `)

  const correctionMap = new Map()
  for (const row of rows || []) {
    const claimId = parseRecordClaimId(row) || String(row.desc || '').match(/claim-adjust:(\d+)/)?.[1]
    if (!claimId || correctionMap.has(claimId)) continue
    correctionMap.set(claimId, row)
  }
  return correctionMap
}

async function loadClaims() {
  const params = []
  let where = `
    WHERE 1 = 1
  `
  if (CLAIM_FILTER) {
    params.push(CLAIM_FILTER)
    where += ` AND c.id = $${params.length}`
  }

  return db.queryMany(
    `
    SELECT
      c.*,
      c.claimed_at::text AS claimed_at_text,
      t.base_reward AS task_base_reward,
      t.reward AS task_reward,
      t.created_at AS task_created_at,
      t.need_count,
      t.remain
    FROM claims c
    JOIN tasks t ON t.id = c.task_id
    ${where}
    ORDER BY c.id ASC
    `,
    params
  )
}

async function buildExpectedSettlement(claim) {
  const locked = parseJsonObject(claim.settlement_snapshot, {})
  const basePoints = roundPoints(
    claim.base_reward || claim.task_base_reward || claim.task_reward || claim.reward || 0
  )
  const onlineUsers =
    claim.online_users === null || claim.online_users === undefined
      ? null
      : toSafeNumber(claim.online_users, null)
  const acceptedCount = Math.max(
    0,
    Number(claim.need_count || 1) - Number(claim.remain || 0)
  )
  const coefficientResult = await nightPointService.calculateCoefficientByPublishTime({
    publishTime: claim.claimed_at || claim.claimed_at_text,
    onlineUsers,
    acceptedCount,
    needCount: Number(claim.need_count || 1),
  })
  const breakdown = calculatePointBreakdown(basePoints, coefficientResult.coefficient)

  return {
    ...breakdown,
    isNight: Boolean(coefficientResult.isNight),
    previewType: 'history_repair',
    businessTimezone: 'Asia/Shanghai',
    onlineUsers,
    config: coefficientResult.config || null,
    claimTime: claim.claimed_at,
    taskPublishedAt: claim.task_created_at,
    publishTimeSnapshot: claim.publish_time_snapshot || claim.task_created_at || null,
    legacySnapshot: locked,
    source: 'history_repair',
  }
}

async function main() {
  const [recordMap, correctionMap, claims] = await Promise.all([
    getTaskRecordMap(),
    getCorrectionMap(),
    loadClaims(),
  ])

  const repairs = []

  for (const claim of claims || []) {
    const claimId = String(claim.id)
    const taskRecord = recordMap.get(claimId)
    if (!taskRecord) continue

    const expected = await buildExpectedSettlement(claim)
    const actualPoints = roundPoints(
      claim.final_points || taskRecord.points || claim.reward || 0
    )
    const diff = roundPoints(expected.finalPoints - actualPoints)
    if (Math.abs(diff) < 0.001) continue

    repairs.push({
      claim,
      expected,
      taskRecord,
      correction: correctionMap.get(claimId),
      diff,
    })
  }

  console.log(`[repairTaskPointsHistory] 待修复 ${repairs.length} 条`)
  if (DRY_RUN) {
    for (const item of repairs) {
      console.log(
        JSON.stringify({
          claimId: String(item.claim.id),
          userId: item.claim.user_id,
          taskId: String(item.claim.task_id),
          basePoints: item.expected.basePoints,
          expectedFinal: item.expected.finalPoints,
          actualFinal: roundPoints(item.claim.final_points || item.taskRecord.points || item.claim.reward || 0),
          diff: item.diff,
          coefficient: item.expected.coefficient,
        })
      )
    }
    process.exit(0)
  }

  for (const item of repairs) {
    const claimId = String(item.claim.id)
    const extraData = {
      source: 'history_repair',
      claimId,
      taskId: String(item.claim.task_id),
      userId: String(item.claim.user_id),
      diff: item.diff,
      expectedFinalPoints: item.expected.finalPoints,
      previousFinalPoints: roundPoints(item.claim.final_points || item.taskRecord.points || item.claim.reward || 0),
      repairedAt: new Date().toISOString(),
    }

    await db.transaction(async (client) => {
      if (!item.correction) {
        await client.query(
          `
          INSERT INTO records (user_id, type, points, task_id, "desc", extra_data, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
          `,
          [
            item.claim.user_id,
            'task_adjustment',
            item.diff,
            item.claim.task_id,
            `任务积分历史修正 (claim-adjust:${claimId})`,
            JSON.stringify(extraData),
          ]
        )

        await client.query(
          `
          UPDATE users
          SET points = COALESCE(points, 0) + $1,
              total_points = COALESCE(total_points, 0) + $1,
              updated_at = NOW()
          WHERE id = $2
          `,
          [item.diff, item.claim.user_id]
        )
      }

      await client.query(
        `
        UPDATE claims
        SET reward = $1,
            final_points = $2,
            bonus_points = $3,
            night_coefficient = $4,
            online_users = $5,
            publish_time_snapshot = $6,
            config_snapshot = $7,
            settlement_snapshot = $8
        WHERE id = $9
        `,
        [
          Math.round(toSafeNumber(item.claim.base_reward || item.claim.task_base_reward || 0, 0)),
          item.expected.finalPoints,
          item.expected.bonusPoints,
          item.expected.coefficient,
          item.expected.onlineUsers,
          item.expected.publishTimeSnapshot,
          JSON.stringify(item.expected.config || null),
          JSON.stringify({
            ...(parseJsonObject(item.claim.settlement_snapshot, {}) || {}),
            ...item.expected,
            claimId,
            taskId: String(item.claim.task_id),
            userId: String(item.claim.user_id),
            metadata: { repairedBy: 'repairTaskPointsHistory' },
            calculatedAt: new Date().toISOString(),
          }),
          item.claim.id,
        ]
      )
    })
  }

  console.log(`[repairTaskPointsHistory] 已修复 ${repairs.length} 条`)
  process.exit(0)
}

main().catch((error) => {
  console.error('[repairTaskPointsHistory] 失败:', error)
  process.exit(1)
})
