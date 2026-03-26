import prisma from './src/utils/prisma.js'

async function checkTable() {
  const columns = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'leaderboard_snapshots' 
    ORDER BY ordinal_position
  `)
  console.log('leaderboard_snapshots 表字段:')
  console.log(JSON.stringify(columns, null, 2))
  await prisma.$disconnect()
}

checkTable()
