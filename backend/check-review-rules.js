import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function checkReviewRules() {
  try {
    console.log('📋 检查审核规则...\n')
    
    const { data: rules, error } = await supabase
      .from('review_rules')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('❌ 查询失败:', error.message)
      return
    }
    
    console.log(`共有 ${rules?.length || 0} 条审核规则:\n`)
    
    rules?.forEach((rule, index) => {
      console.log(`${index + 1}. 平台：${rule.platform}, 动作：${rule.action}`)
      console.log(`   规则配置：${JSON.stringify(rule.rule_config)}`)
      console.log(`   阈值配置：${JSON.stringify(rule.thresholds)}`)
      console.log(`   状态：${rule.is_active ? '✅ 启用' : '❌ 禁用'}`)
      console.log('')
    })
    
  } catch (error) {
    console.error('❌ 查询失败:', error.message)
  }
}

checkReviewRules()
