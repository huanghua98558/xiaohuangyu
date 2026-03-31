/**
 * 审核系统完整功能验证脚本
 * 
 * 验证流程：
 * 1. 检查数据库连接
 * 2. 检查核心表结构
 * 3. 检查服务代码语法
 * 4. 检查状态流转配置
 * 5. 检查通知服务集成
 * 6. 检查队列服务
 */

import { PrismaClient } from '@prisma/client'
import supabase from './src/utils/supabase.js'
import logger from './src/utils/logger.js'

const prisma = new PrismaClient()

async function runValidation() {
  console.log('='.repeat(60))
  console.log('🔍 开始验证审核系统功能')
  console.log('='.repeat(60))
  
  const results = {
    passed: [],
    failed: [],
    warnings: []
  }
  
  // 1. 检查数据库连接
  console.log('\n1️⃣ 检查数据库连接...')
  try {
    await prisma.$connect()
    console.log('   ✅ CockroachDB 连接成功')
    results.passed.push('CockroachDB 连接正常')
  } catch (error) {
    console.log('   ❌ CockroachDB 连接失败:', error.message)
    results.failed.push(`CockroachDB 连接失败：${error.message}`)
    process.exit(1)
  }
  
  // 2. 检查 Supabase 连接
  console.log('\n2️⃣ 检查 Supabase 连接...')
  try {
    const { data, error } = await supabase.from('claims').select('id').limit(1)
    if (error) throw error
    console.log('   ✅ Supabase 连接成功')
    results.passed.push('Supabase 连接正常')
  } catch (error) {
    console.log('   ⚠️  Supabase 连接警告:', error.message)
    results.warnings.push(`Supabase 连接问题：${error.message}`)
  }
  
  // 3. 检查核心表结构
  console.log('\n3️⃣ 检查核心表结构...')
  const requiredTables = [
    'claims',
    'tasks',
    'users',
    'blocked_accounts',
    'user_notifications',
    'admin_notifications',
    'ai_review_queue',
    'link_verification_queue',
    'review_rules'
  ]
  
  for (const table of requiredTables) {
    try {
      const result = await prisma.$queryRawUnsafe(`SELECT 1 FROM ${table} LIMIT 1`)
      console.log(`   ✅ 表 ${table} 存在`)
      results.passed.push(`表 ${table} 存在`)
    } catch (error) {
      console.log(`   ❌ 表 ${table} 不存在或无法访问`)
      results.failed.push(`表 ${table} 不存在`)
    }
  }
  
  // 4. 检查 claims 表字段
  console.log('\n4️⃣ 检查 claims 表关键字段...')
  const requiredClaimFields = [
    'status',
    'image_review_status',
    'link_review_status',
    'block_status',
    'ai_review_status',
    'ai_confidence',
    'ai_reason',
    'ai_reviewed_at',
    'link_reviewed_at'
  ]
  
  try {
    const tableInfo = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'claims' 
      ORDER BY ordinal_position
    `)
    
    const columns = tableInfo.map(c => c.column_name)
    
    for (const field of requiredClaimFields) {
      if (columns.includes(field)) {
        console.log(`   ✅ 字段 ${field} 存在`)
        results.passed.push(`claims.${field} 字段存在`)
      } else {
        console.log(`   ❌ 字段 ${field} 缺失`)
        results.failed.push(`claims.${field} 字段缺失`)
      }
    }
  } catch (error) {
    console.log('   ❌ 检查 claims 表结构失败:', error.message)
    results.failed.push(`检查 claims 表结构失败：${error.message}`)
  }
  
  // 5. 检查 blocked_accounts 表字段类型
  console.log('\n5️⃣ 检查 blocked_accounts 表字段类型...')
  try {
    const fieldTypes = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'blocked_accounts' 
      AND column_name IN ('user_id', 'claim_id', 'reviewed_by')
      ORDER BY column_name
    `)
    
    for (const field of fieldTypes) {
      const isInt = field.data_type.includes('INT')
      console.log(`   ${isInt ? '✅' : '⚠️'} 字段 ${field.column_name} 类型：${field.data_type}`)
      if (isInt) {
        results.passed.push(`blocked_accounts.${field.column_name} 类型为 INT`)
      } else {
        results.warnings.push(`blocked_accounts.${field.column_name} 类型为 ${field.data_type}，建议为 INT`)
      }
    }
  } catch (error) {
    console.log('   ❌ 检查 blocked_accounts 表字段类型失败:', error.message)
    results.failed.push(`检查 blocked_accounts 表字段类型失败`)
  }
  
  // 6. 检查服务代码语法
  console.log('\n6️⃣ 检查核心服务代码语法...')
  const services = [
    './src/services/ai/queueService.js',
    './src/services/ai/linkVerificationService.js',
    './src/services/ai/imageReviewService.js',
    './src/services/ai/visionReviewService.js',
    './src/services/ai/blockedAccountsService.js',
    './src/services/notificationService.js'
  ]
  
  for (const service of services) {
    try {
      await import(service)
      console.log(`   ✅ ${service} 语法正确`)
      results.passed.push(`${service} 语法正确`)
    } catch (error) {
      console.log(`   ❌ ${service} 语法错误:`, error.message)
      results.failed.push(`${service} 语法错误：${error.message}`)
    }
  }
  
  // 7. 检查状态流转配置
  console.log('\n7️⃣ 检查状态流转配置...')
  try {
    const { CLAIM_STATUS, IMAGE_REVIEW_STATUS, LINK_REVIEW_STATUS, BLOCK_STATUS } = await import('./src/constants/taskActions.js')
    
    console.log('   ✅ CLAIM_STATUS 定义完整')
    console.log('      -', Object.values(CLAIM_STATUS).join(', '))
    results.passed.push('CLAIM_STATUS 定义完整')
    
    console.log('   ✅ IMAGE_REVIEW_STATUS 定义完整')
    console.log('      -', Object.values(IMAGE_REVIEW_STATUS).join(', '))
    results.passed.push('IMAGE_REVIEW_STATUS 定义完整')
    
    console.log('   ✅ LINK_REVIEW_STATUS 定义完整')
    console.log('      -', Object.values(LINK_REVIEW_STATUS).join(', '))
    results.passed.push('LINK_REVIEW_STATUS 定义完整')
    
    console.log('   ✅ BLOCK_STATUS 定义完整')
    console.log('      -', Object.values(BLOCK_STATUS).join(', '))
    results.passed.push('BLOCK_STATUS 定义完整')
  } catch (error) {
    console.log('   ❌ 检查状态配置失败:', error.message)
    results.failed.push(`检查状态配置失败：${error.message}`)
  }
  
  // 8. 检查通知服务集成
  console.log('\n8️⃣ 检查通知服务集成...')
  try {
    const { sendAdminNotification, sendUserNotification } = await import('./src/services/notificationService.js')
    console.log('   ✅ 通知服务导出正确')
    results.passed.push('通知服务导出正确')
    
    // 检查 linkVerificationService 是否导入了通知服务
    const linkVerificationService = await import('./src/services/ai/linkVerificationService.js')
    const serviceCode = await import('fs').then(fs => fs.readFileSync('./src/services/ai/linkVerificationService.js', 'utf8'))
    
    if (serviceCode.includes('sendAdminNotification') && serviceCode.includes('sendUserNotification')) {
      console.log('   ✅ 封控检测已集成通知服务')
      results.passed.push('封控检测已集成通知服务')
    } else {
      console.log('   ❌ 封控检测未集成通知服务')
      results.failed.push('封控检测未集成通知服务')
    }
  } catch (error) {
    console.log('   ❌ 检查通知服务失败:', error.message)
    results.failed.push(`检查通知服务失败：${error.message}`)
  }
  
  // 9. 检查队列服务
  console.log('\n9️⃣ 检查队列服务...')
  try {
    const queueService = await import('./src/services/ai/queueService.js')
    
    const requiredFunctions = [
      'enqueueReview',
      'dequeueReviews',
      'processQueueItem',
      'batchProcessQueue'
    ]
    
    for (const func of requiredFunctions) {
      if (typeof queueService[func] === 'function') {
        console.log(`   ✅ ${func} 函数存在`)
        results.passed.push(`queueService.${func} 函数存在`)
      } else {
        console.log(`   ❌ ${func} 函数缺失`)
        results.failed.push(`queueService.${func} 函数缺失`)
      }
    }
  } catch (error) {
    console.log('   ❌ 检查队列服务失败:', error.message)
    results.failed.push(`检查队列服务失败：${error.message}`)
  }
  
  // 10. 检查链接审核队列
  console.log('\n🔟 检查链接审核队列...')
  try {
    const linkVerificationService = await import('./src/services/ai/linkVerificationService.js')
    
    const requiredFunctions = [
      'enqueueLinkVerification',
      'processPendingLinks',
      'processReadyBatch',
      'updateClaimLinkVerificationWithBlock',
      'detectBlockAccount'
    ]
    
    for (const func of requiredFunctions) {
      if (typeof linkVerificationService[func] === 'function' || 
          (linkVerificationService.default && typeof linkVerificationService.default[func] === 'function')) {
        console.log(`   ✅ ${func} 函数存在`)
        results.passed.push(`linkVerificationService.${func} 函数存在`)
      } else {
        console.log(`   ❌ ${func} 函数缺失`)
        results.failed.push(`linkVerificationService.${func} 函数缺失`)
      }
    }
  } catch (error) {
    console.log('   ❌ 检查链接审核队列失败:', error.message)
    results.failed.push(`检查链接审核队列失败：${error.message}`)
  }
  
  // 关闭数据库连接
  await prisma.$disconnect()
  
  // 输出验证结果
  console.log('\n' + '='.repeat(60))
  console.log('📊 验证结果汇总')
  console.log('='.repeat(60))
  console.log(`✅ 通过：${results.passed.length}`)
  console.log(`❌ 失败：${results.failed.length}`)
  console.log(`⚠️  警告：${results.warnings.length}`)
  console.log('='.repeat(60))
  
  if (results.failed.length > 0) {
    console.log('\n❌ 失败项:')
    results.failed.forEach((item, i) => {
      console.log(`   ${i + 1}. ${item}`)
    })
  }
  
  if (results.warnings.length > 0) {
    console.log('\n⚠️  警告项:')
    results.warnings.forEach((item, i) => {
      console.log(`   ${i + 1}. ${item}`)
    })
  }
  
  if (results.failed.length === 0) {
    console.log('\n🎉 所有验证通过！系统功能正常！')
    process.exit(0)
  } else {
    console.log('\n⚠️  存在失败项，请检查并修复')
    process.exit(1)
  }
}

// 运行验证
runValidation().catch(error => {
  console.error('验证过程出错:', error)
  process.exit(1)
})
