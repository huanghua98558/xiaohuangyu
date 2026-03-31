
import pkg from "@prisma/client"
const { PrismaClient } = pkg
const prisma = new PrismaClient()
const CLAIM_COMPLETED_AT_SQL = `
  COALESCE(
    GREATEST(
      COALESCE(c.reviewed_at, c.image_reviewed_at, c.link_reviewed_at),
      COALESCE(c.image_reviewed_at, c.reviewed_at, c.link_reviewed_at),
      COALESCE(c.link_reviewed_at, c.reviewed_at, c.image_reviewed_at)
    ),
    c.reviewed_at,
    c.image_reviewed_at,
    c.link_reviewed_at
  )
`
const days = 3
const today = new Date(); today.setHours(0,0,0,0)
const startDate = new Date(today); startDate.setDate(startDate.getDate() - (days - 1))
const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
const startSignDate = startDate.toISOString().split("T")[0]
const endSignDate = today.toISOString().split("T")[0]

const [claimsByDay, tasksByDay, completionsByDay, pointsByDay, signInsByDay] = await Promise.all([
  prisma.$queryRaw`SELECT CAST(DATE(claimed_at) AS STRING) AS day, COUNT(*)::int AS cnt FROM claims WHERE claimed_at >= ${startDate} AND claimed_at < ${tomorrow} GROUP BY 1`,
  prisma.$queryRaw`SELECT CAST(DATE(created_at) AS STRING) AS day, COUNT(*)::int AS cnt FROM tasks WHERE created_at >= ${startDate} AND created_at < ${tomorrow} GROUP BY 1`,
  prisma.$queryRawUnsafe(`SELECT CAST(DATE(${CLAIM_COMPLETED_AT_SQL}) AS STRING) AS day, COUNT(*)::int AS cnt FROM claims c WHERE c.status IN (approved, done) AND LOWER(COALESCE(TRIM(c.image_review_status), )) IN (approved, checked) AND LOWER(COALESCE(TRIM(c.link_review_status), )) IN (approved, skipped, passed, checked) AND ${CLAIM_COMPLETED_AT_SQL} >= $1 AND ${CLAIM_COMPLETED_AT_SQL} < $2 GROUP BY 1`, startDate, tomorrow),
  prisma.$queryRaw`SELECT CAST(DATE(created_at) AS STRING) AS day, COALESCE(SUM(CASE WHEN points > 0 THEN points ELSE 0 END), 0) AS total FROM records WHERE created_at >= ${startDate} AND created_at < ${tomorrow} GROUP BY 1`,
  prisma.$queryRawUnsafe("SELECT sign_date AS day, COUNT(*)::int AS cnt FROM sign_ins WHERE sign_date >= $1 AND sign_date <= $2 GROUP BY 1", startSignDate, endSignDate),
])

const trendMap = new Map()
for (let i = 0; i < days; i++) {
  const date = new Date(startDate)
  date.setDate(startDate.getDate() + i)
  const dateStr = date.toISOString().split("T")[0]
  trendMap.set(dateStr, { date: dateStr, publishedTasks: 0, claims: 0, completions: 0, pointsIssued: 0, signIns: 0 })
}
for (const row of claimsByDay || []) {
  const day = row.day ? String(row.day).trim() : null
  if (day && trendMap.has(day)) trendMap.get(day).claims = Number(row.cnt || 0)
}
for (const row of tasksByDay || []) {
  const day = row.day ? String(row.day).trim() : null
  if (day && trendMap.has(day)) trendMap.get(day).publishedTasks = Number(row.cnt || 0)
}
for (const row of completionsByDay || []) {
  const day = row.day ? String(row.day).trim() : null
  if (day && trendMap.has(day)) trendMap.get(day).completions = Number(row.cnt || 0)
}
for (const row of pointsByDay || []) {
  const day = row.day ? String(row.day).trim() : null
  if (day && trendMap.has(day)) trendMap.get(day).pointsIssued = Number(row.total || 0)
}
for (const row of signInsByDay || []) {
  const day = row.day ? String(row.day).trim() : null
  if (day && trendMap.has(day)) trendMap.get(day).signIns = Number(row.cnt || 0)
}
console.log(JSON.stringify(Array.from(trendMap.values()), null, 2))
await prisma.$disconnect()
