import { createClient } from '@supabase/supabase-js'

// 使用 CockroachDB 连接
const supabaseUrl = 'http://localhost:54321' // 占位符，实际使用 direct SQL
const supabaseKey = 'placeholder'

// 直接使用 pg 连接 CockroachDB
import pg from 'pg'

const connectionString = 'postgresql://xiaohuanyu2:d5XWShrEqwWHBPxuts-gCw@aware-bison-23613.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full'

const client = new pg.Client({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false,
    checkServerIdentity: () => undefined
  }
})

async function checkReviewRules() {
  try {
    console.log('📋 检查新数据库中的审核规则...\n')
    
    await client.connect()
    
    // 检查 review_rules 表
    console.log('1. 检查 review_rules 表...')
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'review_rules'
      ) as exists
    `)
    
    if (tableCheck.rows[0].exists) {
      console.log('   ✅ review_rules 表存在')
      
      // 查询规则数据
      const rules = await client.query(`
        SELECT * FROM review_rules ORDER BY created_at DESC
      `)
      
      console.log(`\n   共有 ${rules.rows.length} 条审核规则:\n`)
      
      rules.rows.forEach((rule, index) => {
        console.log(`${index + 1}. 平台：${rule.platform}, 动作：${rule.action}`)
        console.log(`   规则配置：${JSON.stringify(rule.rule_config || {})}`)
        console.log(`   阈值配置：${JSON.stringify(rule.thresholds || {})}`)
        console.log(`   状态：${rule.is_active ? '✅ 启用' : '❌ 禁用'}`)
        console.log('')
      })
    } else {
      console.log('   ❌ review_rules 表不存在')
    }
    
    // 检查 claims 表字段
    console.log('2. 检查 claims 表字段...')
    const fields = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'claims'
      AND column_name IN ('status', 'image_review_status', 'link_review_status', 'block_status', 'review_history')
      ORDER BY ordinal_position
    `)
    
    console.log('   claims 表审核相关字段:')
    fields.rows.forEach(field => {
      console.log(`   - ${field.column_name}: ${field.data_type} ${field.column_default ? '(默认:' + field.column_default + ')' : ''}`)
    })
    
    // 检查 blocked_accounts 表
    console.log('\n3. 检查 blocked_accounts 表...')
    const blockedTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'blocked_accounts'
      ) as exists
    `)
    
    if (blockedTableCheck.rows[0].exists) {
      console.log('   ✅ blocked_accounts 表存在')
      
      const blockedCount = await client.query('SELECT COUNT(*) FROM blocked_accounts')
      console.log(`   当前记录数：${blockedCount.rows[0].count}`)
    } else {
      console.log('   ❌ blocked_accounts 表不存在')
    }
    
    // 检查 notification 表
    console.log('\n4. 检查通知表...')
    const adminNotifCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'admin_notifications'
      ) as exists
    `)
    
    if (adminNotifCheck.rows[0].exists) {
      console.log('   ✅ admin_notifications 表存在')
    } else {
      console.log('   ❌ admin_notifications 表不存在')
    }
    
    const userNotifCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'user_notifications'
      ) as exists
    `)
    
    if (userNotifCheck.rows[0].exists) {
      console.log('   ✅ user_notifications 表存在')
    } else {
      console.log('   ❌ user_notifications 表不存在')
    }
    
    console.log('\n✅ 数据库检查完成！\n')
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message)
  } finally {
    await client.end()
  }
}

checkReviewRules()
