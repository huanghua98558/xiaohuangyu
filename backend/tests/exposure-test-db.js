/**
 * 曝光系统和位置限制综合测试 - 直接数据库版本
 */

import supabase from '../src/utils/supabase.js'
import logger from '../src/utils/logger.js'
import exposureService from '../src/services/exposureService.js'
import taskService from '../src/services/taskService.js'
import userService from '../src/services/userService.js'

// 测试配置
const CONFIG = {
  testRounds: 20,
  cities: [
    { province: '湖南省', city: '长沙市' },
    { province: '湖南省', city: '怀化市' },
    { province: '湖南省', city: '株洲市' },
    { province: '湖南省', city: '湘潭市' },
    { province: '广东省', city: '广州市' },
    { province: '广东省', city: '深圳市' },
    { province: '北京市', city: '北京市' },
    { province: '上海市', city: '上海市' },
    { province: '浙江省', city: '杭州市' },
    { province: '四川省', city: '成都市' },
  ]
}

// 测试统计
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: [],
  cityLimitTests: 0,
  provinceLimitTests: 0,
  exposureTests: 0
}

// 创建测试用户（直接数据库）
async function createTestUser(index) {
  const username = `test_auto_${Date.now()}_${index}`
  const { data, error } = await supabase
    .from('users')
    .insert({
      username,
      password: '$2a$10$test_hash_placeholder', // 实际密码不重要，直接用数据库
      phone: `138${Math.random().toString().slice(2, 11)}`,
      role: 'user',
      points: 1000,
      invite_code: `TEST${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    })
    .select()
    .single()
  
  if (error) {
    console.log(`创建用户失败: ${error.message}`)
    return null
  }
  return data
}

// 测试1: 城市名额限制
async function testCityLimit() {
  console.log('\n===== 测试城市名额限制 =====')
  
  const city = '长沙市'
  const province = '湖南省'
  const results = []
  
  // 获取一个活跃任务
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'active')
    .gt('remain', 0)
    .limit(1)
  
  if (!tasks || tasks.length === 0) {
    console.log('没有可用任务')
    return
  }
  
  const task = tasks[0]
  console.log(`测试任务: ${task.id} - ${task.title}, cityLimit=${task.city_limit}`)
  
  // 创建多个同城市用户
  for (let i = 0; i < 3; i++) {
    const user = await createTestUser(i)
    if (!user) continue
    
    // 模拟领取任务（直接插入数据库）
    const { data: claim, error } = await supabase
      .from('claims')
      .insert({
        user_id: user.id,
        task_id: task.id,
        title: task.title,
        platform: task.platform,
        action: task.action,
        reward: task.reward,
        status: 'doing',
        city: city,
        province: province,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      })
      .select()
      .single()
    
    if (error) {
      results.push({ user: user.id, success: false, error: error.message })
      console.log(`用户${i + 1} 领取失败: ${error.message}`)
    } else {
      results.push({ user: user.id, success: true, claim: claim.id })
      console.log(`用户${i + 1} 领取成功, claimId=${claim.id}`)
    }
    
    stats.cityLimitTests++
  }
  
  // 检查结果
  const successCount = results.filter(r => r.success).length
  console.log(`\n结果: ${successCount}/3 个用户成功领取`)
  console.log(`预期: 最多 ${task.city_limit} 个用户成功（cityLimit=${task.city_limit}）`)
  
  if (successCount <= task.city_limit) {
    console.log('✅ 城市名额限制正常（或数据库没有唯一约束）')
    stats.passed++
  } else {
    console.log('❌ 城市名额限制失效！')
    stats.failed++
    stats.errors.push({ test: 'cityLimit', expected: task.city_limit, actual: successCount })
  }
  
  return results
}

// 测试2: 省份名额限制
async function testProvinceLimit() {
  console.log('\n===== 测试省份名额限制 =====')
  
  const province = '广东省'
  const cities = ['广州市', '深圳市', '东莞市', '佛山市', '珠海市']
  const results = []
  
  // 获取一个活跃任务
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'active')
    .gt('remain', 0)
    .limit(1)
  
  if (!tasks || tasks.length === 0) {
    console.log('没有可用任务')
    return
  }
  
  const task = tasks[0]
  console.log(`测试任务: ${task.id} - ${task.title}, provinceLimit=${task.province_limit}`)
  
  // 创建不同城市的用户领取同一任务
  for (let i = 0; i < cities.length; i++) {
    const user = await createTestUser(i + 10)
    if (!user) continue
    
    const { data: claim, error } = await supabase
      .from('claims')
      .insert({
        user_id: user.id,
        task_id: task.id,
        title: task.title,
        platform: task.platform,
        action: task.action,
        reward: task.reward,
        status: 'doing',
        city: cities[i],
        province: province,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      })
      .select()
      .single()
    
    if (error) {
      results.push({ user: user.id, city: cities[i], success: false, error: error.message })
      console.log(`用户${i + 1} (${cities[i]}) 领取失败: ${error.message}`)
    } else {
      results.push({ user: user.id, city: cities[i], success: true, claim: claim.id })
      console.log(`用户${i + 1} (${cities[i]}) 领取成功`)
    }
    
    stats.provinceLimitTests++
  }
  
  // 检查结果
  const successCount = results.filter(r => r.success).length
  console.log(`\n结果: ${successCount}/${cities.length} 个用户成功领取`)
  console.log(`预期: 最多 ${task.province_limit} 个用户成功（provinceLimit=${task.province_limit}）`)
  
  if (successCount <= task.province_limit) {
    console.log('✅ 省份名额限制正常（或数据库没有唯一约束）')
    stats.passed++
  } else {
    console.log('❌ 省份名额限制失效！')
    stats.failed++
    stats.errors.push({ test: 'provinceLimit', expected: task.province_limit, actual: successCount })
  }
  
  return results
}

// 测试3: 任务列表位置过滤
async function testTaskListLocationFilter() {
  console.log('\n===== 测试任务列表位置过滤 =====')
  
  const city = '北京市'
  const province = '北京市'
  
  // 创建用户1领取任务
  const user1 = await createTestUser(100)
  if (!user1) {
    console.log('创建用户失败')
    return
  }
  
  // 获取任务列表
  const config = await taskService.getConfig()
  const exposureConfig = await exposureService.getConfig()
  
  console.log(`曝光模式: ${exposureConfig.exposureMode}`)
  console.log(`城市限制: ${config.cityLimitPerTask}, 省份限制: ${config.provinceLimitPerTask}`)
  
  // 模拟获取任务列表（顺序模式）
  const tasks = await taskService.getTasks({}, { city, province }, 5, user1.id)
  console.log(`\n用户1看到 ${tasks.length} 个任务`)
  
  if (tasks.length === 0) {
    console.log('没有任务可测试')
    return
  }
  
  // 显示任务详情
  for (const task of tasks) {
    console.log(`  - 任务 ${task.id}: ${task.title}, cityLimit=${task.cityLimit}, provinceLimit=${task.provinceLimit}`)
  }
  
  // 用户1领取第一个任务
  const taskToClaim = tasks[0]
  
  // 直接插入领取记录
  const { error: claimError } = await supabase
    .from('claims')
    .insert({
      user_id: user1.id,
      task_id: taskToClaim.id,
      title: taskToClaim.title,
      platform: taskToClaim.platform,
      action: taskToClaim.action,
      reward: taskToClaim.reward,
      status: 'doing',
      city: city,
      province: province,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    })
  
  if (claimError) {
    console.log(`用户1领取失败: ${claimError.message}`)
  } else {
    console.log(`\n用户1领取任务 ${taskToClaim.id} 成功`)
  }
  
  // 创建用户2（同城市）
  const user2 = await createTestUser(101)
  if (!user2) {
    console.log('创建用户2失败')
    return
  }
  
  // 用户2获取任务列表
  const tasks2 = await taskService.getTasks({}, { city, province }, 5, user2.id)
  console.log(`\n用户2（同城市）看到 ${tasks2.length} 个任务`)
  
  // 检查用户2是否能看到用户1领取的任务
  const canSeeClaimedTask = tasks2.some(t => t.id === taskToClaim.id)
  
  if (canSeeClaimedTask) {
    console.log(`❌ 问题：同城市用户仍能看到任务 ${taskToClaim.id}！`)
    console.log('这说明位置过滤逻辑可能有问题')
    stats.failed++
    stats.errors.push({ test: 'locationFilter', message: '同城市用户能看到已满名额任务' })
  } else {
    console.log(`✅ 同城市用户看不到任务 ${taskToClaim.id}（位置过滤正常）`)
    stats.passed++
  }
  
  // 显示用户2看到的任务
  for (const task of tasks2) {
    console.log(`  - 任务 ${task.id}: ${task.title}`)
  }
  
  stats.exposureTests++
  return { canSeeClaimedTask, tasks2 }
}

// 测试4: 检查数据库中的领取记录分布
async function checkClaimsDistribution() {
  console.log('\n===== 检查领取记录分布 =====')
  
  // 查询每个任务的领取城市分布
  const { data: claims, error } = await supabase
    .from('claims')
    .select('task_id, city, province, status')
    .eq('status', 'doing')
    .not('city', 'is', null)
  
  if (error) {
    console.log('查询失败:', error.message)
    return
  }
  
  // 按任务分组统计
  const taskStats = {}
  for (const claim of (claims || [])) {
    if (!taskStats[claim.task_id]) {
      taskStats[claim.task_id] = { cities: {}, provinces: {}, total: 0 }
    }
    const stat = taskStats[claim.task_id]
    stat.total++
    stat.cities[claim.city] = (stat.cities[claim.city] || 0) + 1
    stat.provinces[claim.province] = (stat.provinces[claim.province] || 0) + 1
  }
  
  console.log('\n任务领取分布统计:')
  for (const [taskId, stat] of Object.entries(taskStats)) {
    console.log(`\n任务 ${taskId}:`)
    console.log(`  总领取: ${stat.total}`)
    console.log(`  城市分布: ${JSON.stringify(stat.cities)}`)
    console.log(`  省份分布: ${JSON.stringify(stat.provinces)}`)
    
    // 检查是否超过限制
    const maxCityCount = Math.max(...Object.values(stat.cities))
    const maxProvinceCount = Math.max(...Object.values(stat.provinces))
    
    if (maxCityCount > 1) {
      console.log(`  ⚠️ 警告: 有城市超过1人 (${maxCityCount}人)`)
    }
    if (maxProvinceCount > 4) {
      console.log(`  ⚠️ 警告: 有省份超过4人 (${maxProvinceCount}人)`)
    }
  }
  
  return taskStats
}

// 测试5: 验证位置过滤逻辑
async function testLocationFilterLogic() {
  console.log('\n===== 验证位置过滤逻辑 =====')
  
  // 获取配置
  const config = await taskService.getConfig()
  console.log(`配置: cityLimit=${config.cityLimitPerTask}, provinceLimit=${config.provinceLimitPerTask}`)
  
  // 获取一个有领取记录的任务
  const { data: claimsWithTask } = await supabase
    .from('claims')
    .select(`
      task_id,
      city,
      province,
      status,
      tasks(id, title, city_limit, province_limit)
    `)
    .eq('status', 'doing')
    .limit(5)
  
  if (!claimsWithTask || claimsWithTask.length === 0) {
    console.log('没有找到进行中的领取记录')
    return
  }
  
  // 分析每个任务的领取情况
  for (const claim of claimsWithTask) {
    const task = claim.tasks
    if (!task) continue
    
    console.log(`\n任务 ${task.id} - ${task.title}:`)
    console.log(`  限制: cityLimit=${task.city_limit}, provinceLimit=${task.province_limit}`)
    console.log(`  当前领取用户城市: ${claim.city}, 省份: ${claim.province}`)
    
    // 统计该任务的同城领取数
    const { count: cityCount } = await supabase
      .from('claims')
      .select('*', { count: 'exact', head: true })
      .eq('task_id', task.id)
      .eq('city', claim.city)
      .eq('status', 'doing')
    
    const { count: provinceCount } = await supabase
      .from('claims')
      .select('*', { count: 'exact', head: true })
      .eq('task_id', task.id)
      .eq('province', claim.province)
      .eq('status', 'doing')
    
    console.log(`  同城领取数: ${cityCount}, 同省领取数: ${provinceCount}`)
    
    if (cityCount >= task.city_limit) {
      console.log(`  ⚠️ 城市名额已满 (${cityCount}/${task.city_limit})`)
    }
    if (provinceCount >= task.province_limit) {
      console.log(`  ⚠️ 省份名额已满 (${provinceCount}/${task.province_limit})`)
    }
  }
  
  return claimsWithTask
}

// 测试6: 检查顺序曝光逻辑
async function testSequentialExposureLogic() {
  console.log('\n===== 检查顺序曝光逻辑 =====')
  
  const config = await exposureService.getConfig()
  console.log(`曝光模式: ${config.exposureMode}`)
  console.log(`曝光窗口: ${config.exposureWindow}`)
  console.log(`完成阈值: ${config.sequentialThreshold}`)
  
  // 获取曝光队列
  const { data: exposures } = await supabase
    .from('task_exposure')
    .select(`
      task_id,
      queue_position,
      unlocked_at,
      need_count,
      accepted_count,
      status,
      tasks(id, title, created_at, status)
    `)
    .eq('status', 'active')
    .eq('tasks.status', 'active')
    .order('queue_position', { ascending: true })
    .limit(10)
  
  if (!exposures || exposures.length === 0) {
    console.log('没有曝光记录')
    return
  }
  
  console.log('\n曝光队列（前10个）:')
  for (const exp of exposures) {
    const rate = exp.need_count > 0 ? (exp.accepted_count / exp.need_count * 100).toFixed(1) : 0
    const unlocked = exp.unlocked_at ? '✅' : '❌'
    console.log(`  ${exp.queue_position}. 任务${exp.task_id} (${exp.tasks?.title?.substring(0,15)}...) - 完成率:${rate}% 解锁:${unlocked}`)
  }
  
  // 模拟获取可曝光任务
  const exposedIds = await exposureService.getSequentialExposedTaskIds(config)
  console.log(`\n可曝光任务ID: ${exposedIds.join(', ')}`)
  console.log(`数量: ${exposedIds.length} (窗口: ${config.exposureWindow})`)
  
  return { config, exposures, exposedIds }
}

// 主测试函数
async function runAllTests() {
  console.log('========================================')
  console.log('曝光系统和位置限制综合测试（数据库版）')
  console.log('========================================\n')
  
  const startTime = Date.now()
  
  try {
    // 运行各项测试
    await testSequentialExposureLogic()
    await checkClaimsDistribution()
    await testLocationFilterLogic()
    await testTaskListLocationFilter()
    await testCityLimit()
    await testProvinceLimit()
    
    const duration = Date.now() - startTime
    
    // 输出统计
    console.log('\n========================================')
    console.log('测试统计')
    console.log('========================================')
    console.log(`总测试: ${stats.total}`)
    console.log(`通过: ${stats.passed}`)
    console.log(`失败: ${stats.failed}`)
    console.log(`城市限制测试: ${stats.cityLimitTests}`)
    console.log(`省份限制测试: ${stats.provinceLimitTests}`)
    console.log(`曝光测试: ${stats.exposureTests}`)
    console.log(`耗时: ${(duration / 1000).toFixed(2)}秒`)
    
    if (stats.errors.length > 0) {
      console.log('\n发现的问题:')
      for (const err of stats.errors) {
        console.log(`  - ${err.test}: ${JSON.stringify(err)}`)
      }
    }
    
    console.log('========================================')
    
  } catch (err) {
    console.error('测试执行失败:', err)
  }
}

runAllTests().catch(console.error)
