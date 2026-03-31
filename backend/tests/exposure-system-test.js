/**
 * 曝光系统和位置限制综合测试
 * 测试场景：
 * 1. 不同地区用户领取任务
 * 2. 城市/省份名额限制
 * 3. 顺序曝光模式
 * 4. 并发领取
 */

const BASE_URL = 'http://localhost:8080'

// 测试配置
const CONFIG = {
  totalTestRounds: 50,      // 总测试轮数
  concurrentUsers: 10,      // 每轮并发用户数
  cities: [
    { province: '湖南省', city: '长沙市' },
    { province: '湖南省', city: '怀化市' },
    { province: '湖南省', city: '株洲市' },
    { province: '湖南省', city: '湘潭市' },
    { province: '湖南省', city: '衡阳市' },
    { province: '广东省', city: '广州市' },
    { province: '广东省', city: '深圳市' },
    { province: '广东省', city: '东莞市' },
    { province: '北京市', city: '北京市' },
    { province: '上海市', city: '上海市' },
    { province: '浙江省', city: '杭州市' },
    { province: '浙江省', city: '宁波市' },
    { province: '江苏省', city: '南京市' },
    { province: '江苏省', city: '苏州市' },
    { province: '四川省', city: '成都市' },
    { province: '四川省', city: '绵阳市' },
    { province: '湖北省', city: '武汉市' },
    { province: '湖北省', city: '宜昌市' },
    { province: '山东省', city: '济南市' },
    { province: '山东省', city: '青岛市' },
  ],
  taskLimit: 5  // 每次获取的任务数量
}

// 测试统计
const stats = {
  total: 0,
  success: 0,
  failed: 0,
  errors: {},
  locationLimitHits: 0,
  cityLimitHits: 0,
  provinceLimitHits: 0,
  claimSuccess: 0,
  claimFailed: 0,
  exposureTests: 0,
  sequentialTests: 0
}

// 辅助函数：HTTP请求
async function request(method, path, token = null, body = null) {
  const url = `${BASE_URL}${path}`
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  
  const options = { method, headers }
  if (body) options.body = JSON.stringify(body)
  
  try {
    const response = await fetch(url, options)
    const data = await response.json()
    return { status: response.status, data }
  } catch (err) {
    return { status: 0, error: err.message }
  }
}

// 创建测试用户（如果不存在）
async function createTestUser(username, password = 'test123') {
  const { data } = await request('POST', '/api/auth/register', null, {
    username,
    password,
    phone: `138${Math.random().toString().slice(2, 11)}`,
    inviteCode: 'ZZAVXSXZ'
  })
  return data
}

// 登录获取token
async function login(username, password = 'test123') {
  const { data } = await request('POST', '/api/auth/login', null, {
    username,
    password
  })
  return data?.data?.token
}

// 获取用户信息
async function getUserInfo(token) {
  const { data } = await request('GET', '/api/user/info', token)
  return data?.data
}

// 获取任务列表
async function getTasks(token, city, province, limit = 5) {
  const params = new URLSearchParams({ city, province, limit: limit.toString() })
  const { data } = await request('GET', `/api/tasks?${params}`, token)
  return data?.data || []
}

// 领取任务
async function claimTask(token, taskId, city, province) {
  const { data } = await request('POST', `/api/tasks/${taskId}/claim`, token, {
    city,
    province
  })
  return data
}

// 提交任务
async function submitTask(token, claimId) {
  const { data } = await request('POST', `/api/tasks/my/${claimId}/submit`, token, {
    screenshots: ['test_screenshot.jpg'],
    comment: '测试提交'
  })
  return data
}

// 获取我的任务列表
async function getMyTasks(token) {
  const { data } = await request('GET', '/api/tasks/my/all', token)
  return data?.data || []
}

// 验证位置限制规则
async function testLocationLimit(token, taskId, city, province, expectedLimit) {
  const result = { taskId, city, province, expectedLimit, passed: true, message: '' }
  
  try {
    // 尝试领取任务
    const claimResult = await claimTask(token, taskId, city, province)
    
    if (claimResult?.code === 0) {
      result.claimed = true
      result.message = '领取成功'
    } else if (claimResult?.message?.includes('城市名额已满')) {
      result.claimed = false
      result.message = '城市名额已满'
      stats.cityLimitHits++
    } else if (claimResult?.message?.includes('省份名额已满')) {
      result.claimed = false
      result.message = '省份名额已满'
      stats.provinceLimitHits++
    } else {
      result.claimed = false
      result.message = claimResult?.message || '领取失败'
    }
  } catch (err) {
    result.passed = false
    result.message = err.message
  }
  
  return result
}

// 测试单轮
async function testRound(roundNum) {
  console.log(`\n===== 第 ${roundNum} 轮测试 =====`)
  
  const results = []
  const users = []
  
  // 创建/登录多个用户
  for (let i = 0; i < CONFIG.concurrentUsers; i++) {
    const username = `test_user_${roundNum}_${i}_${Date.now()}`
    const location = CONFIG.cities[Math.floor(Math.random() * CONFIG.cities.length)]
    
    try {
      await createTestUser(username)
      const token = await login(username)
      if (token) {
        users.push({ username, token, location })
      }
    } catch (err) {
      // 用户可能已存在，尝试登录
      const token = await login(username)
      if (token) {
        users.push({ username, token, location })
      }
    }
  }
  
  console.log(`创建了 ${users.length} 个测试用户`)
  
  // 每个用户获取任务列表并尝试领取
  for (const user of users) {
    stats.total++
    
    try {
      // 获取任务列表
      const tasks = await getTasks(user.token, user.location.city, user.location.province, CONFIG.taskLimit)
      
      if (tasks.length === 0) {
        results.push({
          user: user.username,
          location: user.location,
          result: 'no_tasks',
          message: '没有可用任务（可能被位置限制或曝光系统过滤）'
        })
        stats.exposureTests++
        continue
      }
      
      // 尝试领取第一个任务
      const task = tasks[0]
      const claimResult = await claimTask(user.token, task.id, user.location.city, user.location.province)
      
      if (claimResult?.code === 0) {
        stats.claimSuccess++
        results.push({
          user: user.username,
          location: user.location,
          taskId: task.id,
          taskTitle: task.title,
          result: 'success',
          message: '领取成功'
        })
      } else {
        stats.claimFailed++
        results.push({
          user: user.username,
          location: user.location,
          taskId: task.id,
          taskTitle: task.title,
          result: 'failed',
          message: claimResult?.message || '领取失败'
        })
        
        // 记录位置限制命中
        if (claimResult?.message?.includes('城市名额')) {
          stats.cityLimitHits++
        } else if (claimResult?.message?.includes('省份名额')) {
          stats.provinceLimitHits++
        }
      }
      
      stats.success++
    } catch (err) {
      stats.failed++
      const errMsg = err.message || 'Unknown error'
      stats.errors[errMsg] = (stats.errors[errMsg] || 0) + 1
      
      results.push({
        user: user.username,
        location: user.location,
        result: 'error',
        message: errMsg
      })
    }
  }
  
  return results
}

// 测试同一城市多个用户领取同一任务
async function testSameCityMultipleUsers() {
  console.log('\n===== 测试同城市多名额限制 =====')
  
  const city = '长沙市'
  const province = '湖南省'
  const users = []
  
  // 创建5个同城市用户
  for (let i = 0; i < 5; i++) {
    const username = `same_city_user_${i}_${Date.now()}`
    try {
      await createTestUser(username)
      const token = await login(username)
      if (token) {
        users.push({ username, token, city, province })
      }
    } catch (err) {}
  }
  
  console.log(`创建了 ${users.length} 个同城市用户`)
  
  // 获取一个任务
  const tasks = await getTasks(users[0]?.token, city, province, 1)
  if (tasks.length === 0) {
    console.log('没有可用任务')
    return
  }
  
  const taskId = tasks[0].id
  console.log(`测试任务: ${taskId} - ${tasks[0].title}`)
  
  // 多个用户尝试领取同一任务
  const results = []
  for (const user of users) {
    const result = await claimTask(user.token, taskId, city, province)
    results.push({
      user: user.username,
      success: result?.code === 0,
      message: result?.message
    })
    console.log(`用户 ${user.username}: ${result?.message}`)
    
    // 短暂延迟
    await new Promise(r => setTimeout(r, 100))
  }
  
  // 统计成功数量
  const successCount = results.filter(r => r.success).length
  console.log(`\n结果: ${successCount}/${users.length} 个用户成功领取`)
  console.log(`预期: 最多1个用户成功（cityLimit=1）`)
  
  if (successCount <= 1) {
    console.log('✅ 城市名额限制正常')
  } else {
    console.log('❌ 城市名额限制失效！')
  }
  
  return results
}

// 测试同一省份不同城市用户领取同一任务
async function testSameProvinceDifferentCities() {
  console.log('\n===== 测试同省份不同城市名额限制 =====')
  
  const province = '湖南省'
  const cities = ['长沙市', '株洲市', '湘潭市', '衡阳市', '岳阳市']
  const users = []
  
  // 创建不同城市的用户
  for (let i = 0; i < cities.length; i++) {
    const username = `diff_city_user_${i}_${Date.now()}`
    try {
      await createTestUser(username)
      const token = await login(username)
      if (token) {
        users.push({ username, token, city: cities[i], province })
      }
    } catch (err) {}
  }
  
  console.log(`创建了 ${users.length} 个不同城市用户`)
  
  // 获取一个任务
  const tasks = await getTasks(users[0]?.token, cities[0], province, 1)
  if (tasks.length === 0) {
    console.log('没有可用任务')
    return
  }
  
  const taskId = tasks[0].id
  console.log(`测试任务: ${taskId} - ${tasks[0].title}`)
  
  // 不同城市用户尝试领取同一任务
  const results = []
  for (const user of users) {
    const result = await claimTask(user.token, taskId, user.city, province)
    results.push({
      user: user.username,
      city: user.city,
      success: result?.code === 0,
      message: result?.message
    })
    console.log(`用户 ${user.username} (${user.city}): ${result?.message}`)
    
    await new Promise(r => setTimeout(r, 100))
  }
  
  // 统计成功数量
  const successCount = results.filter(r => r.success).length
  console.log(`\n结果: ${successCount}/${users.length} 个用户成功领取`)
  console.log(`预期: 最多4个用户成功（provinceLimit=4）`)
  
  if (successCount <= 4) {
    console.log('✅ 省份名额限制正常')
  } else {
    console.log('❌ 省份名额限制失效！')
  }
  
  return results
}

// 测试顺序曝光模式
async function testSequentialExposure() {
  console.log('\n===== 测试顺序曝光模式 =====')
  
  const results = []
  const username = `seq_test_user_${Date.now()}`
  
  try {
    await createTestUser(username)
    const token = await login(username)
    
    // 多次获取任务列表，验证顺序一致性
    const taskOrders = []
    for (let i = 0; i < 5; i++) {
      const tasks = await getTasks(token, '北京市', '北京市', 10)
      const order = tasks.map(t => t.id).join(',')
      taskOrders.push(order)
      console.log(`第${i+1}次获取: ${tasks.length}个任务, ID顺序: ${order}`)
      
      await new Promise(r => setTimeout(r, 500))
    }
    
    // 检查顺序一致性
    const allSame = taskOrders.every(o => o === taskOrders[0])
    if (allSame) {
      console.log('✅ 顺序曝光一致性正常')
    } else {
      console.log('⚠️ 任务顺序可能不一致（可能受曝光窗口影响）')
    }
    
    // 获取曝光配置
    const adminToken = await login('admin', 'admin123')
    const { data: configData } = await request('GET', '/api/admin-v2/exposure/config', adminToken)
    console.log('\n曝光配置:', configData?.data)
    
    results.push({ allSame, taskOrders, config: configData?.data })
    stats.sequentialTests++
    
  } catch (err) {
    console.log('顺序曝光测试失败:', err.message)
  }
  
  return results
}

// 测试并发领取
async function testConcurrentClaim() {
  console.log('\n===== 测试并发领取 =====')
  
  const users = []
  const city = '广州市'
  const province = '广东省'
  
  // 创建多个用户
  for (let i = 0; i < 10; i++) {
    const username = `concurrent_user_${i}_${Date.now()}`
    try {
      await createTestUser(username)
      const token = await login(username)
      if (token) {
        users.push({ username, token })
      }
    } catch (err) {}
  }
  
  console.log(`创建了 ${users.length} 个用户进行并发测试`)
  
  // 获取一个任务
  const tasks = await getTasks(users[0]?.token, city, province, 1)
  if (tasks.length === 0) {
    console.log('没有可用任务')
    return
  }
  
  const taskId = tasks[0].id
  console.log(`测试任务: ${taskId}`)
  
  // 并发领取
  const startTime = Date.now()
  const promises = users.map(user => claimTask(user.token, taskId, city, province))
  const results = await Promise.all(promises)
  const duration = Date.now() - startTime
  
  console.log(`并发请求完成，耗时: ${duration}ms`)
  
  // 统计结果
  const successes = results.filter(r => r?.code === 0).length
  const failures = results.filter(r => r?.code !== 0).length
  
  console.log(`成功: ${successes}, 失败: ${failures}`)
  
  // 验证只有一个成功（城市限制=1）
  if (successes === 1) {
    console.log('✅ 并发领取限制正常')
  } else if (successes > 1) {
    console.log('❌ 并发领取导致名额超限！')
  } else {
    console.log('⚠️ 所有并发请求都失败')
  }
  
  return { successes, failures, duration, results }
}

// 测试位置过滤 - 同城市用户看不到已满的任务
async function testLocationFilter() {
  console.log('\n===== 测试位置过滤（任务列表不可见） =====')
  
  const city = '深圳市'
  const province = '广东省'
  
  // 用户1领取任务
  const user1Name = `filter_user_1_${Date.now()}`
  await createTestUser(user1Name)
  const token1 = await login(user1Name)
  
  // 获取任务列表
  const tasks1 = await getTasks(token1, city, province, 10)
  console.log(`用户1看到 ${tasks1.length} 个任务`)
  
  if (tasks1.length === 0) {
    console.log('没有任务可测试')
    return
  }
  
  // 领取第一个任务
  const taskToClaim = tasks1[0]
  const claimResult = await claimTask(token1, taskToClaim.id, city, province)
  console.log(`用户1领取任务 ${taskToClaim.id}: ${claimResult?.message}`)
  
  // 用户2（同城市）获取任务列表
  const user2Name = `filter_user_2_${Date.now()}`
  await createTestUser(user2Name)
  const token2 = await login(user2Name)
  
  const tasks2 = await getTasks(token2, city, province, 10)
  console.log(`用户2（同城市）看到 ${tasks2.length} 个任务`)
  
  // 检查用户2是否能看到用户1领取的任务
  const canSeeClaimedTask = tasks2.some(t => t.id === taskToClaim.id)
  
  if (canSeeClaimedTask) {
    console.log('❌ 同城市用户仍能看到已满名额的任务！')
  } else {
    console.log('✅ 同城市用户看不到已满名额的任务')
  }
  
  return { canSeeClaimedTask }
}

// 主测试函数
async function runAllTests() {
  console.log('========================================')
  console.log('曝光系统和位置限制综合测试')
  console.log('========================================')
  console.log(`测试轮数: ${CONFIG.totalTestRounds}`)
  console.log(`每轮并发用户: ${CONFIG.concurrentUsers}`)
  console.log(`城市数量: ${CONFIG.cities.length}`)
  console.log('========================================\n')
  
  const startTime = Date.now()
  
  // 运行多轮测试
  for (let i = 1; i <= CONFIG.totalTestRounds; i++) {
    try {
      await testRound(i)
    } catch (err) {
      console.error(`第 ${i} 轮测试失败:`, err.message)
    }
    
    // 每轮之间短暂休息
    await new Promise(r => setTimeout(r, 200))
  }
  
  // 运行专项测试
  await testSameCityMultipleUsers()
  await testSameProvinceDifferentCities()
  await testSequentialExposure()
  await testConcurrentClaim()
  await testLocationFilter()
  
  const duration = Date.now() - startTime
  
  // 输出统计结果
  console.log('\n========================================')
  console.log('测试统计')
  console.log('========================================')
  console.log(`总测试次数: ${stats.total}`)
  console.log(`成功: ${stats.success}`)
  console.log(`失败: ${stats.failed}`)
  console.log(`成功率: ${((stats.success / stats.total) * 100).toFixed(2)}%`)
  console.log(`领取成功: ${stats.claimSuccess}`)
  console.log(`领取失败: ${stats.claimFailed}`)
  console.log(`城市名额限制命中: ${stats.cityLimitHits}`)
  console.log(`省份名额限制命中: ${stats.provinceLimitHits}`)
  console.log(`曝光测试次数: ${stats.exposureTests}`)
  console.log(`顺序曝光测试: ${stats.sequentialTests}`)
  console.log(`总耗时: ${(duration / 1000).toFixed(2)}秒`)
  
  if (Object.keys(stats.errors).length > 0) {
    console.log('\n错误统计:')
    for (const [err, count] of Object.entries(stats.errors)) {
      console.log(`  ${err}: ${count}次`)
    }
  }
  
  console.log('========================================')
  console.log('测试完成!')
  console.log('========================================')
  
  return stats
}

// 运行测试
runAllTests().catch(console.error)
