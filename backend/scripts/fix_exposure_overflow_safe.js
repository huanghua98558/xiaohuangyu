/**
 * 修复 task_exposure 数据越界问题（安全版本）
 * 
 * 执行方式：node scripts/fix_exposure_overflow_safe.js
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少 Supabase 配置')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixExposureOverflow() {
  try {
    console.log('🔍 开始检查 task_exposure 数据越界问题...\n')
    
    // 1. 查询所有数据
    console.log('1️⃣ 查询所有曝光数据...')
    const { data: allData, error: queryError } = await supabase
      .from('task_exposure')
      .select('task_id, current_exposure, max_exposure')
      .limit(100)
    
    if (queryError) {
      console.error('❌ 查询失败:', queryError.message)
      return
    }
    
    // 手动过滤越界数据
    const overflowData = allData.filter(item => item.current_exposure > item.max_exposure)
    
    if (!overflowData || overflowData.length === 0) {
      console.log('✅ 没有发现越界数据\n')
    } else {
      console.log(`⚠️  发现 ${overflowData.length} 条越界数据:`)
      overflowData.forEach(item => {
        const overflow = item.current_exposure - item.max_exposure
        console.log(`   任务 ${item.task_id}: ${item.current_exposure}/${item.max_exposure} (超出 ${overflow})`)
      })
      console.log()
      
      // 2. 逐个修复越界数据
      console.log('2️⃣ 修复越界数据...')
      let fixedCount = 0
      
      for (const item of overflowData) {
        const { error: updateError } = await supabase
          .from('task_exposure')
          .update({ 
            current_exposure: item.max_exposure,
            updated_at: new Date().toISOString()
          })
          .eq('task_id', item.task_id)
        
        if (updateError) {
          console.error(`   ❌ 任务 ${item.task_id} 修复失败:`, updateError.message)
        } else {
          fixedCount++
          console.log(`   ✅ 任务 ${item.task_id} 已修复`)
        }
      }
      
      console.log(`\n✅ 成功修复 ${fixedCount}/${overflowData.length} 条数据\n`)
    }
    
    // 3. 查询所有数据统计
    console.log('3️⃣ 数据统计...')
    const { data: allDataForStats, count: totalCount, error: totalError } = await supabase
      .from('task_exposure')
      .select('task_id, current_exposure, max_exposure', { count: 'exact' })
    
    if (totalCount !== null && allDataForStats) {
      const normalCount = allDataForStats.filter(item => item.current_exposure <= item.max_exposure).length
      console.log(`   总任务数: ${totalCount}`)
      console.log(`   正常任务数: ${normalCount}`)
      console.log(`   越界任务数: ${totalCount - normalCount}\n`)
    }
    
    console.log('✅ 修复完成！')
    console.log('\n📝 提示: 请在 Supabase 控制台执行以下 SQL 创建触发器防止越界:')
    console.log(`
CREATE OR REPLACE FUNCTION check_exposure_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_exposure > NEW.max_exposure THEN
    NEW.current_exposure := NEW.max_exposure;
  END IF;
  IF NEW.current_exposure < 0 THEN
    NEW.current_exposure := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS exposure_limit_trigger ON task_exposure;
CREATE TRIGGER exposure_limit_trigger
BEFORE INSERT OR UPDATE OF current_exposure ON task_exposure
FOR EACH ROW
EXECUTE FUNCTION check_exposure_limit();
    `)
    
    process.exit(0)
  } catch (err) {
    console.error('❌ 修复过程异常:', err)
    process.exit(1)
  }
}

fixExposureOverflow()
