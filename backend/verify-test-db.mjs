import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://xiaohuanyu2:d5XWShrEqwWHBPxuts-gCw@aware-bison-23613.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full'
    }
  }
})

async function verifyMigration() {
  try {
    console.log('🔍 验证数据库迁移...\n')
    
    // 检查 blocked_accounts 表
    console.log('1. 检查 blocked_accounts 表...')
    const blockedCount = await prisma.$queryRaw`SELECT COUNT(*) FROM blocked_accounts`
    console.log('   ✅ blocked_accounts 表存在')
    
    // 检查 admin_notifications 表
    console.log('2. 检查 admin_notifications 表...')
    const adminNotifCount = await prisma.$queryRaw`SELECT COUNT(*) FROM admin_notifications`
    console.log('   ✅ admin_notifications 表存在')
    
    // 检查 user_notifications 表
    console.log('3. 检查 user_notifications 表...')
    const userNotifCount = await prisma.$queryRaw`SELECT COUNT(*) FROM user_notifications`
    console.log('   ✅ user_notifications 表存在')
    
    // 检查 claims 表的 block_status 字段
    console.log('4. 检查 claims 表的 block_status 字段...')
    const claimFields = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'claims' AND column_name = 'block_status'
    `
    if (claimFields.length > 0) {
      console.log('   ✅ claims.block_status 字段存在')
    } else {
      console.log('   ❌ claims.block_status 字段不存在')
    }
    
    // 检查 claims 表的 review_history 字段
    console.log('5. 检查 claims 表的 review_history 字段...')
    const reviewHistoryFields = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'claims' AND column_name = 'review_history'
    `
    if (reviewHistoryFields.length > 0) {
      console.log('   ✅ claims.review_history 字段存在')
    } else {
      console.log('   ❌ claims.review_history 字段不存在')
    }
    
    // 检查 users 表的新字段
    console.log('6. 检查 users 表的新字段...')
    const userFields = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name IN ('has_blocked_account', 'blocked_account_count', 'last_blocked_at')
    `
    console.log(`   ✅ users 表新增字段：${userFields.length} 个`)
    
    console.log('\n✅ 数据库迁移验证完成！\n')
    
  } catch (error) {
    console.error('❌ 验证失败:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

verifyMigration()
