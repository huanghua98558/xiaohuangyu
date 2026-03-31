/**
 * 曝光系统集成测试
 * 测试曝光系统的完整流程
 */

import supabase from './src/utils/supabaseToPrismaAdapter.js'
import logger from './src/utils/logger.js'

async function testExposureSystem() {
  console.log('\n=== 曝光系统集成测试开始 ===\n')
  
  try {
    // 测试 1: 获取曝光配置
    console.log('测试 1: 获取曝光配置...')
    const config = await supabase
      .from('exposure_config')
      .select('*')
      .eq('isActive', true)
      .single()
    
    if (config.error || !config.data) {
      console.log('❌ 获取配置失败:', config.error)
      return
    }
    
    console.log('✅ 曝光配置:', {
      mode: config.data.exposureMode,
      window: config.data.exposureWindow,
      cityLimit: config.data.cityExposureLimit,
      checkInterval: config.data.checkIntervalMinutes + ' minutes'
    })
    
    // 测试 2: 创建测试任务曝光记录
    console.log('\n测试 2: 创建任务曝光记录...')
    const testTaskId = Date.now()
    const needCount = 10
    
    const initialExposure = Math.ceil(needCount * config.data.initialCoefficient) + config.data.initialMinExtra
    const maxExposure = Math.ceil(needCount * config.data.maxCoefficient)
    
    const exposure = await supabase
      .from('task_exposure')
      .insert({
        taskId: testTaskId,
        needCount: needCount,
        initialExposure: initialExposure,
        currentExposure: 0,
        maxExposure: maxExposure,
        acceptedCount: 0,
        submittedCount: 0,
        status: 'active',
        queuePosition: 1,
        unlockedAt: new Date().toISOString()
      })
    
    if (exposure.error) {
      console.log('❌ 创建曝光记录失败:', exposure.error)
      return
    }
    
    console.log('✅ 创建曝光记录成功:', {
      taskId: testTaskId,
      initialExposure,
      maxExposure,
      status: 'active'
    })
    
    // 测试 3: 记录曝光日志
    console.log('\n测试 3: 记录曝光日志...')
    const log = await supabase
      .from('task_exposure_logs')
      .insert({
        taskId: testTaskId,
        eventType: 'initial',
        exposureBefore: 0,
        exposureAfter: initialExposure,
        exposureAdd: initialExposure,
        reason: '任务创建，初始化曝光量'
      })
    
    if (log.error) {
      console.log('❌ 记录日志失败:', log.error)
      return
    }
    
    console.log('✅ 曝光日志记录成功')
    
    // 测试 4: 更新曝光量
    console.log('\n测试 4: 更新曝光量...')
    const newExposure = initialExposure + 5
    const updateResult = await supabase
      .from('task_exposure')
      .update({
        currentExposure: newExposure,
        updatedAt: new Date().toISOString()
      })
      .eq('taskId', testTaskId)
    
    if (updateResult.error) {
      console.log('❌ 更新曝光量失败:', updateResult.error)
      return
    }
    
    console.log(`✅ 曝光量已更新：${initialExposure} -> ${newExposure}`)
    
    // 测试 5: 创建浏览记录
    console.log('\n测试 5: 创建浏览记录...')
    const viewRecord = await supabase
      .from('task_view_records')
      .insert({
        taskId: testTaskId,
        userId: 2111864833, // admin 用户
        city: '北京',
        province: '北京',
        source: 'list'
      })
    
    if (viewRecord.error && !viewRecord.error.message.includes('unique')) {
      console.log('❌ 创建浏览记录失败:', viewRecord.error)
    } else {
      console.log('✅ 浏览记录创建成功')
    }
    
    // 测试 6: 查询任务曝光状态
    console.log('\n测试 6: 查询任务曝光状态...')
    const exposureStatus = await supabase
      .from('task_exposure')
      .select('taskId, needCount, currentExposure, acceptedCount, status')
      .eq('taskId', testTaskId)
      .single()
    
    if (exposureStatus.error) {
      console.log('❌ 查询状态失败:', exposureStatus.error)
    } else {
      console.log('✅ 任务曝光状态:', exposureStatus.data)
    }
    
    // 测试 7: 创建用户质量评分
    console.log('\n测试 7: 创建用户质量评分...')
    const qualityScore = await supabase
      .from('user_quality_score')
      .upsert({
        userId: 2111864833,
        activityScore: 80,
        qualityScore: 90,
        onlineScore: 85,
        totalScore: 255,
        level: 'active'
      }, {
        onConflict: 'userId'
      })
    
    if (qualityScore.error) {
      console.log('❌ 创建质量评分失败:', qualityScore.error)
    } else {
      console.log('✅ 用户质量评分:', {
        userId: 2111864833,
        totalScore: 255,
        level: 'active'
      })
    }
    
    // 测试 8: 创建曝光分配日志
    console.log('\n测试 8: 创建曝光分配日志...')
    const allocationLog = await supabase
      .from('exposure_allocation_logs')
      .insert({
        taskId: testTaskId,
        userId: 2111864833,
        allocationType: 'regular',
        selectionScore: 95,
        userLevel: 3,
        userCity: '北京'
      })
    
    if (allocationLog.error) {
      console.log('❌ 创建分配日志失败:', allocationLog.error)
    } else {
      console.log('✅ 曝光分配日志创建成功')
    }
    
    // 测试 9: 事务测试
    console.log('\n测试 9: 事务测试...')
    try {
      const txResult = await supabase.transaction(async (tx) => {
        // 更新曝光量
        await tx.taskExposure.update({
          where: { id: exposure.data.id },
          data: { acceptedCount: 1 }
        })
        
        // 记录日志
        await tx.taskExposureLog.create({
          data: {
            taskId: testTaskId,
            eventType: 'accept',
            exposureBefore: newExposure,
            exposureAfter: newExposure,
            exposureAdd: 0,
            reason: '用户接受任务'
          }
        })
        
        return 'success'
      })
      
      console.log('✅ 事务执行成功:', txResult)
    } catch (txError) {
      console.log('❌ 事务执行失败:', txError.message)
    }
    
    console.log('\n=== 所有测试完成 ===\n')
    
  } catch (err) {
    console.error('\n❌ 测试异常:', err.message)
    console.error(err.stack)
  }
}

// 运行测试
testExposureSystem().catch(console.error)
