import prisma from './src/utils/prisma.js'

async function testDB() {
  console.log('=== 测试数据库连接 ===\n')
  
  const tables = [
    'users',
    'claims', 
    'records',
    'sign_ins',
    'user_achievements',
    'leaderboard_snapshots'
  ]
  
  for (const table of tables) {
    try {
      const result = await prisma.$queryRawUnsafe(`SELECT 1 FROM ${table} LIMIT 1`)
      console.log(`✅ ${table} 表 - CockroachDB 连接正常`)
    } catch(e) {
      console.log(`❌ ${table} 表 - 查询失败：${e.message}`)
    }
  }
  
  await prisma.$disconnect()
}

testDB()
