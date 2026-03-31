/**
 * 测试顺序曝光窗口限制
 * 验证已解锁任务也受窗口限制
 */

import supabase from '../src/utils/supabase.js'
import exposureService from '../src/services/exposureService.js'
import logger from '../src/utils/logger.js'

async function testExposureWindow() {
  console.log('========================================')
  console.log('测试顺序曝光窗口限制')
  console.log('========================================')
  
  try {
    // 获取曝光配置
    const config = await exposureService.getConfig()
    console.log('\n曝光配置:')
    console.log(`  模式: ${config.exposureMode}`)
    console.log(`  窗口大小: ${config.exposureWindow}`)
    console.log(`  完成率阈值: ${config.sequentialThreshold}`)
    
    // 测试获取顺序曝光任务列表
    console.log('\n调用 getSequentialExposedTaskIds...')
    const exposedTaskIds = await exposureService.getSequentialExposedTaskIds(config)
    
    console.log(`\n结果: 曝光 ${exposedTaskIds.length} 个任务`)
    console.log(`预期: 曝光 ${config.exposureWindow} 个任务（窗口限制）`)
    
    if (exposedTaskIds.length <= config.exposureWindow) {
      console.log('✅ 测试通过: 曝光任务数量符合窗口限制')
    } else {
      console.log('❌ 测试失败: 曝光任务数量超过窗口限制')
      console.log(`   曝光任务ID: ${exposedTaskIds.join(', ')}`)
    }
    
    // 获取任务详情
    if (exposedTaskIds.length > 0) {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title')
        .in('id', exposedTaskIds)
      
      console.log('\n曝光任务详情:')
      for (const task of (tasks || [])) {
        console.log(`  - ${task.id}: ${task.title}`)
      }
    }
    
  } catch (err) {
    console.error('测试失败:', err.message)
    console.error(err.stack)
  }
  
  console.log('\n========================================')
  console.log('测试完成')
  console.log('========================================')
  process.exit(0)
}

testExposureWindow()
