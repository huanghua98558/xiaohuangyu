import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://xiaohuanyu2:d5XWShrEqwWHBPxuts-gCw@aware-bison-23613.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full'
    }
  }
})

async function checkReviewRules() {
  try {
    console.log('📋 检查审核规则...\n')
    
    const rules = await prisma.review_rules.findMany({
      orderBy: { created_at: 'desc' }
    })
    
    console.log(`共有 ${rules.length} 条审核规则:\n`)
    
    rules.forEach((rule, index) => {
      console.log(`${index + 1}. 平台：${rule.platform}, 动作：${rule.action}`)
      console.log(`   规则配置: ${JSON.stringify(rule.rule_config)}`)
      console.log(`   阈值配置：${JSON.stringify(rule.thresholds)}`)
      console.log(`   状态：${rule.is_active ? '✅ 启用' : '❌ 禁用'}`)
      console.log('')
    })
    
  } catch (error) {
    console.error('❌ 查询失败:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

checkReviewRules()
