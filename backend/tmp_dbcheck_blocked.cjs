
require("dotenv/config")
const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()
;(async () => {
  const columns = await prisma.$queryRawUnsafe("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = blocked_accounts ORDER BY ordinal_position")
  console.log("columns", columns)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const total = await prisma.$queryRawUnsafe("SELECT COUNT(*)::int AS c FROM blocked_accounts WHERE status IN (suspected,confirmed)")
  const todayRows = await prisma.$queryRawUnsafe("SELECT COUNT(*)::int AS c FROM blocked_accounts WHERE status IN (suspected,confirmed) AND created_at >= $1", today)
  console.log("counts", { total, todayRows })
  await prisma.$disconnect()
})().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
