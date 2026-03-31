
import pkg from "@prisma/client"
const { PrismaClient } = pkg
const prisma = new PrismaClient()

const today = new Date()
today.setHours(0, 0, 0, 0)
const startDate = new Date(today)
startDate.setDate(startDate.getDate() - 2)
const tomorrow = new Date(today)
tomorrow.setDate(tomorrow.getDate() + 1)

const rows = {
  tasks: await prisma.$queryRaw`SELECT to_char(DATE(created_at), YYYY-MM-DD) AS day, COUNT(*)::int AS cnt FROM tasks WHERE created_at >= ${startDate} AND created_at < ${tomorrow} GROUP BY 1 ORDER BY 1`,
  claims: await prisma.$queryRaw`SELECT to_char(DATE(claimed_at), YYYY-MM-DD) AS day, COUNT(*)::int AS cnt FROM claims WHERE claimed_at >= ${startDate} AND claimed_at < ${tomorrow} GROUP BY 1 ORDER BY 1`,
  points: await prisma.$queryRaw`SELECT to_char(DATE(created_at), YYYY-MM-DD) AS day, COALESCE(SUM(CASE WHEN points > 0 THEN points ELSE 0 END), 0) AS total FROM records WHERE created_at >= ${startDate} AND created_at < ${tomorrow} GROUP BY 1 ORDER BY 1`,
  signins: await prisma.$queryRawUnsafe("SELECT sign_date AS day, COUNT(*)::int AS cnt FROM sign_ins WHERE sign_date >= $1 AND sign_date <= $2 GROUP BY 1 ORDER BY 1", startDate.toISOString().split(T)[0], today.toISOString().split(T)[0])
}
console.log(JSON.stringify({ startDate, tomorrow, rows }, null, 2))
await prisma.$disconnect()
