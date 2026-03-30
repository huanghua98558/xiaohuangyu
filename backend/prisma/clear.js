/**
 * 清除测试数据脚本
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🗑️  清除测试数据...')

  // 删除所有积分记录
  const deletedRecords = await prisma.record.deleteMany({})
  console.log(`  ✅ 删除 ${deletedRecords.count} 条积分记录`)

  // 删除所有提现记录
  const deletedWithdrawals = await prisma.withdrawal.deleteMany({})
  console.log(`  ✅ 删除 ${deletedWithdrawals.count} 条提现记录`)

  // 删除所有任务领取记录
  const deletedClaims = await prisma.claim.deleteMany({})
  console.log(`  ✅ 删除 ${deletedClaims.count} 条任务领取记录`)

  // 删除测试用户（保留 admin 和 test）
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      username: {
        in: ['张三', '李四', '王五', '赵六', '小明', '小红', '小华', '小丽', '小刚', '小美']
      }
    }
  })
  console.log(`  ✅ 删除 ${deletedUsers.count} 个测试用户`)

  console.log('✅ 清除完成！')
}

main()
  .catch((e) => {
    console.error('❌ 清除失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
