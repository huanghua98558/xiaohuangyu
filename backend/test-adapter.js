/**
 * 测试 Supabase 到 Prisma 适配器
 */

import supabase from './src/utils/supabaseToPrismaAdapter.js'
import logger from './src/utils/logger.js'

async function testAdapter() {
  console.log('\n=== 开始测试 Supabase 到 Prisma 适配器 ===\n')
  
  try {
    // 测试 1: 简单查询
    console.log('测试 1: 简单查询 users 表...')
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username')
      .limit(5)
    
    if (error) {
      console.log('❌ 查询失败:', error.message)
    } else {
      console.log('✅ 查询成功，找到', users?.length || 0, '个用户')
      if (users && users.length > 0) {
        console.log('   示例用户:', users[0])
      }
    }
    
    // 测试 2: 条件查询
    console.log('\n测试 2: 条件查询...')
    const { data: admin, error: adminError } = await supabase
      .from('users')
      .select('id, username, role')
      .eq('username', 'admin')
      .single()
    
    if (adminError) {
      console.log('❌ 查询失败:', adminError.message)
    } else {
      console.log('✅ 查询成功，管理员:', admin)
    }
    
    // 测试 3: 曝光配置查询
    console.log('\n测试 3: 查询曝光配置...')
    const { data: config, error: configError } = await supabase
      .from('exposure_config')
      .select('*')
      .eq('is_active', true)
      .single()
    
    if (configError) {
      console.log('ℹ️  曝光配置不存在或查询失败:', configError.message)
    } else {
      console.log('✅ 曝光配置:', {
        mode: config.exposureMode,
        window: config.exposureWindow,
        cityLimit: config.cityExposureLimit
      })
    }
    
    // 测试 4: 插入测试
    console.log('\n测试 4: 插入测试（曝光日志）...')
    const testLog = {
      task_id: 999999,
      event_type: 'test',
      reason: '适配器测试',
      created_at: new Date().toISOString()
    }
    
    const { data: inserted, error: insertError } = await supabase
      .from('task_exposure_logs')
      .insert(testLog)
    
    if (insertError) {
      console.log('ℹ️  插入失败（可能是外键约束）:', insertError.message)
    } else {
      console.log('✅ 插入成功')
    }
    
    // 测试 5: 更新测试
    console.log('\n测试 5: 更新测试...')
    const { data: updated, error: updateError } = await supabase
      .from('users')
      .update({ updated_at: new Date().toISOString() })
      .eq('username', 'admin')
    
    if (updateError) {
      console.log('❌ 更新失败:', updateError.message)
    } else {
      console.log('✅ 更新成功，影响了', updated?.count || 0, '行')
    }
    
    console.log('\n=== 测试完成 ===\n')
    
  } catch (err) {
    console.error('\n❌ 测试异常:', err.message)
    console.error(err.stack)
  }
}

// 运行测试
testAdapter().catch(console.error)
