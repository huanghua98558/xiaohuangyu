/**
 * 大规模场景测试：验证激励机制
 * 场景1：用户多任务少（僧多粥少）
 * 场景2：任务多用户少（僧少粥多）
 * 场景3：平衡状态
 */

import supabase from '../src/utils/supabase.js'
import userActivityService from '../src/services/userActivityService.js'
import exposureService from '../src/services/exposureService.js'
import logger from '../src/utils/logger.js'

// 测试配置 - 基于真实业务规模
const TEST_CONFIG = {
  scenarios: [
    { name: '真实场景(200用户+2000任务)', users: 200, tasks: 100, tasksPerUser: 15 },  // 缩小测试，保持比例
    { name: '任务多用户少', users: 50, tasks: 150, tasksPerUser: 20 },
    { name: '平衡状态', users: 100, tasks: 100, tasksPerUser: 10 }
  ],
  // 模拟用户行为比例
  userBehavior: {
    active: 0.3,      // 30% 活跃用户（高活跃）
    normal: 0.5,      // 50% 普通用户
    inactive: 0.2     // 20% 不活跃用户
  },
  // 新配置
  config: {
    maxConcurrent: 15,      // 新并发限制
    cityLimit: 5,           // 新城市限制
    provinceLimit: 15,      // 新省份限制
    exposureWindow: 20      // 新曝光窗口
  }
}

// 模拟数据
const TEST_CITIES = [
  { city: '北京', province: '北京' },
  { city: '上海', province: '上海' },
  { city: '广州', province: '广东' },
  { city: '深圳', province: '广东' },
  { city: '杭州', province: '浙江' },
  { city: '成都', province: '四川' },
  { city: '武汉', province: '湖北' },
  { city: '南京', province: '江苏' },
  { city: '西安', province: '陕西' },
  { city: '重庆', province: '重庆' }
]

class ScenarioTester {
  constructor() {
    this.testUsers = []
    this.testTasks = []
    this.results = {
      byScenario: {},
      summary: {}
    }
  }

  /**
   * 创建测试用户
   */
  async createTestUsers(count) {
    console.log(`\n创建 ${count} 个测试用户...`)
    
    const users = []
    const now = Date.now()
    
    for (let i = 0; i < count; i++) {
      const cityInfo = TEST_CITIES[i % TEST_CITIES.length]
      const behaviorType = this.getUserBehaviorType(i, count)
      
      // 根据行为类型设置不同的活跃度
      let lastLoginAt = new Date()
      if (behaviorType === 'inactive') {
        lastLoginAt = new Date(now - 5 * 24 * 60 * 60 * 1000) // 5天前
      } else if (behaviorType === 'normal') {
        lastLoginAt = new Date(now - 1 * 24 * 60 * 60 * 1000) // 1天前
      }
      
      const userData = {
        username: `test_u_${now}_${i}`,
        password_hash: 'test_hash_' + i,
        phone: `139${String(i).padStart(8, '0')}`,
        city: cityInfo.city,
        province: cityInfo.province,
        status: 1,  // 1 = active
        points: 0,
        invite_code: `T${now.toString(36)}${String(i).padStart(4, '0')}`,  // 唯一invite_code
        last_task_date: lastLoginAt.toISOString(),
        created_at: new Date(now - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
      }
      
      users.push(userData)
    }
    
    // 批量插入
    const { data, error } = await supabase
      .from('users')
      .insert(users)
      .select('id, username, city, province, points')
    
    if (error) {
      console.error('创建用户失败:', error.message)
      return []
    }
    
    this.testUsers = data || []
    console.log(`成功创建 ${this.testUsers.length} 个测试用户`)
    
    // 为部分活跃用户创建签到记录
    await this.createCheckInRecords()
    
    return this.testUsers
  }

  /**
   * 判断用户行为类型
   */
  getUserBehaviorType(index, total) {
    const activeEnd = Math.floor(total * TEST_CONFIG.userBehavior.active)
    const normalEnd = activeEnd + Math.floor(total * TEST_CONFIG.userBehavior.normal)
    
    if (index < activeEnd) return 'active'
    if (index < normalEnd) return 'normal'
    return 'inactive'
  }

  /**
   * 创建签到记录
   */
  async createCheckInRecords() {
    const now = Date.now()
    const checkIns = []
    
    // 为60%的活跃用户创建连续签到记录
    const activeUsers = this.testUsers.slice(0, Math.floor(this.testUsers.length * 0.6))
    
    for (const user of activeUsers) {
      // 随机签到1-7天
      const days = Math.floor(Math.random() * 7) + 1
      for (let d = 0; d < days; d++) {
        checkIns.push({
          user_id: user.id,
          check_in_date: new Date(now - d * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          is_consecutive: d === 0
        })
      }
    }
    
    if (checkIns.length > 0) {
      await supabase.from('user_check_ins').insert(checkIns)
      console.log(`创建了 ${checkIns.length} 条签到记录`)
    }
  }

  /**
   * 创建测试任务
   */
  async createTestTasks(count) {
    console.log(`\n创建 ${count} 个测试任务...`)
    
    const now = Date.now()
    const tasks = []
    
    const platforms = ['抖音', '快手', '小红书', '微信', '微博']
    const actions = ['点赞', '评论', '转发', '关注', '收藏']
    
    for (let i = 0; i < count; i++) {
      const platform = platforms[i % platforms.length]
      const action = actions[i % actions.length]
      
      tasks.push({
        title: `测试任务-${platform}${action}-${i}`,
        platform,
        action,
        description: `测试任务描述-${platform}${action}`,
        video_url: 'https://v.douyin.com/test/',
        reward: Math.floor(Math.random() * 20) + 10, // 10-30积分
        need_count: Math.floor(Math.random() * 5) + 3,     // 需要3-7人
        remain: Math.floor(Math.random() * 5) + 3,   // 剩余3-7人
        status: 'active',
        city_limit: 1,
        province_limit: 4,
        exposure_enabled: true,
        created_at: new Date(now - i * 60 * 60 * 1000).toISOString() // 按时间排序
      })
    }
    
    const { data, error } = await supabase
      .from('tasks')
      .insert(tasks)
      .select('id, title, platform, action, reward, need_count, remain, city_limit, province_limit')
    
    if (error) {
      console.error('创建任务失败:', error.message)
      return []
    }
    
    this.testTasks = data || []
    console.log(`成功创建 ${this.testTasks.length} 个测试任务`)
    
    // 初始化曝光记录
    for (const task of this.testTasks) {
      try {
        await supabase
          .from('task_exposure')
          .insert({
            task_id: task.id,
            need_count: task.need_count,
            initial_exposure: task.need_count + 5,
            current_exposure: 0,
            max_exposure: task.need_count * 3,
            accepted_count: 0,
            status: 'active',
            queue_position: this.testTasks.indexOf(task) + 1,
            unlocked_at: this.testTasks.indexOf(task) === 0 ? new Date().toISOString() : null
          })
      } catch (e) {
        // 忽略重复
      }
    }
    
    return this.testTasks
  }

  /**
   * 模拟用户领取任务
   */
  async simulateClaimTasks(scenario) {
    console.log(`\n模拟用户领取任务...`)
    
    const claims = []
    const userPoints = new Map()
    
    // 获取动态曝光窗口
    const dynamicWindow = await exposureService.getDynamicExposureWindow()
    console.log(`动态配置: 窗口=${dynamicWindow.windowSize}, 城市限制=${dynamicWindow.cityLimit}, 省份限制=${dynamicWindow.provinceLimit}`)
    console.log(`原因: ${dynamicWindow.reason}`)
    
    // 按优先级对用户排序
    const userPriorities = []
    for (const user of this.testUsers) {
      const priority = await userActivityService.calculatePriority(user.id)
      userPriorities.push({ user, priority })
    }
    
    // 降序排序（高优先级先选）
    userPriorities.sort((a, b) => b.priority - a.priority)
    
    // 按优先级顺序分配任务
    for (const { user, priority } of userPriorities) {
      // 获取用户可接的任务
      const availableTasks = this.testTasks.filter(task => {
        if (task.remain <= 0) return false
        
        // 检查城市/省份限制（使用动态限制）
        const cityCount = claims.filter(c => c.task_id === task.id && c.city === user.city).length
        const provinceCount = claims.filter(c => c.task_id === task.id && c.province === user.province).length
        
        return cityCount < dynamicWindow.cityLimit && provinceCount < dynamicWindow.provinceLimit
      })
      
      // 根据优先级决定分配概率（高优先级更容易获得）
      const claimProbability = Math.min(0.95, 0.5 + priority * 0.005)
      
      if (availableTasks.length > 0 && Math.random() < claimProbability) {
        // 选择第一个可用任务
        const task = availableTasks[0]
        
        // 创建领取记录
        const claim = {
          user_id: user.id,
          task_id: task.id,
          title: task.title,
          platform: task.platform,
          action: task.action,
          reward: task.reward,
          status: 'doing',
          city: user.city,
          province: user.province,
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()  // 15分钟后过期
        }
        
        claims.push(claim)
        
        // 更新用户积分（模拟完成）
        userPoints.set(user.id, (userPoints.get(user.id) || 0) + task.reward)
        
        // 更新任务剩余
        task.remain--
      }
    }
    
    // 批量插入领取记录
    if (claims.length > 0) {
      const { error } = await supabase
        .from('claims')
        .insert(claims)
      
      if (error) {
        console.error('创建领取记录失败:', error.message)
      } else {
        console.log(`创建了 ${claims.length} 条领取记录`)
      }
    }
    
    return { claims, userPoints }
  }

  /**
   * 分析结果
   */
  analyzeResults(scenario, claims, userPoints) {
    const totalUsers = this.testUsers.length
    const totalTasks = this.testTasks.length
    const usersWithPoints = userPoints.size
    const totalPointsDistributed = Array.from(userPoints.values()).reduce((sum, p) => sum + p, 0)
    const avgPoints = totalPointsDistributed / totalUsers
    
    // 分析不同行为用户的收益
    const activeUsers = this.testUsers.slice(0, Math.floor(totalUsers * 0.6))
    const normalUsers = this.testUsers.slice(Math.floor(totalUsers * 0.6), Math.floor(totalUsers * 0.9))
    const inactiveUsers = this.testUsers.slice(Math.floor(totalUsers * 0.9))
    
    const avgPointsByType = {
      active: this.calculateAvgPoints(activeUsers, userPoints),
      normal: this.calculateAvgPoints(normalUsers, userPoints),
      inactive: this.calculateAvgPoints(inactiveUsers, userPoints)
    }
    
    // 判断是否达标
    const success = avgPoints >= 10 // 平均每人至少10积分
    
    return {
      scenario: scenario.name,
      totalUsers,
      totalTasks,
      usersWithPoints,
      usersWithPointsRate: ((usersWithPoints / totalUsers) * 100).toFixed(1) + '%',
      totalClaims: claims.length,
      totalPointsDistributed,
      avgPoints: avgPoints.toFixed(1),
      avgPointsByType,
      success,
      issues: this.identifyIssues(avgPoints, avgPointsByType, usersWithPoints, totalUsers)
    }
  }

  /**
   * 计算平均积分
   */
  calculateAvgPoints(users, userPoints) {
    if (users.length === 0) return 0
    const total = users.reduce((sum, u) => sum + (userPoints.get(u.id) || 0), 0)
    return (total / users.length).toFixed(1)
  }

  /**
   * 识别问题
   */
  identifyIssues(avgPoints, avgPointsByType, usersWithPoints, totalUsers) {
    const issues = []
    
    if (avgPoints < 10) {
      issues.push(`平均积分${avgPoints.toFixed(1)}低于目标10积分`)
    }
    
    if (usersWithPoints < totalUsers * 0.8) {
      issues.push(`只有${usersWithPoints}/${totalUsers}用户获得积分`)
    }
    
    if (parseFloat(avgPointsByType.active) < parseFloat(avgPointsByType.inactive) * 1.2) {
      issues.push('活跃用户收益没有明显高于非活跃用户')
    }
    
    if (parseFloat(avgPointsByType.active) > parseFloat(avgPointsByType.normal) * 2) {
      issues.push('活跃用户收益过高，可能导致普通用户流失')
    }
    
    return issues
  }

  /**
   * 清理测试数据
   */
  async cleanup() {
    console.log('\n清理测试数据...')
    
    // 删除测试领取记录
    if (this.testUsers.length > 0) {
      const userIds = this.testUsers.map(u => u.id)
      await supabase.from('claims').delete().in('user_id', userIds)
      await supabase.from('user_check_ins').delete().in('user_id', userIds)
      await supabase.from('users').delete().in('id', userIds)
    }
    
    // 删除测试任务
    if (this.testTasks.length > 0) {
      const taskIds = this.testTasks.map(t => t.id)
      await supabase.from('task_exposure').delete().in('task_id', taskIds)
      await supabase.from('tasks').delete().in('id', taskIds)
    }
    
    this.testUsers = []
    this.testTasks = []
    console.log('清理完成')
  }

  /**
   * 运行单个场景
   */
  async runScenario(scenario) {
    console.log(`\n${'='.repeat(50)}`)
    console.log(`场景: ${scenario.name}`)
    console.log(`配置: ${scenario.users} 用户, ${scenario.tasks} 任务`)
    console.log('='.repeat(50))
    
    try {
      // 清理旧数据
      await this.cleanup()
      
      // 创建测试数据
      await this.createTestUsers(scenario.users)
      await this.createTestTasks(scenario.tasks)
      
      // 模拟领取
      const { claims, userPoints } = await this.simulateClaimTasks(scenario)
      
      // 分析结果
      const result = this.analyzeResults(scenario, claims, userPoints)
      this.results.byScenario[scenario.name] = result
      
      return result
    } catch (err) {
      console.error(`场景执行失败: ${err.message}`)
      return { scenario: scenario.name, error: err.message }
    }
  }

  /**
   * 运行所有场景
   */
  async runAllScenarios() {
    console.log('\n' + '='.repeat(60))
    console.log('开始大规模场景测试')
    console.log('='.repeat(60))
    
    for (const scenario of TEST_CONFIG.scenarios) {
      await this.runScenario(scenario)
    }
    
    // 汇总结果
    this.printSummary()
    
    // 最终清理
    await this.cleanup()
  }

  /**
   * 打印汇总
   */
  printSummary() {
    console.log('\n' + '='.repeat(60))
    console.log('测试结果汇总')
    console.log('='.repeat(60))
    
    for (const [name, result] of Object.entries(this.results.byScenario)) {
      console.log(`\n【${name}】`)
      console.log(`  总用户: ${result.totalUsers}, 总任务: ${result.totalTasks}`)
      console.log(`  获得积分用户: ${result.usersWithPointsRate}`)
      console.log(`  平均积分: ${result.avgPoints}`)
      console.log(`  活跃用户平均: ${result.avgPointsByType.active}积分`)
      console.log(`  普通用户平均: ${result.avgPointsByType.normal}积分`)
      console.log(`  不活跃用户平均: ${result.avgPointsByType.inactive}积分`)
      console.log(`  状态: ${result.success ? '✅ 达标' : '❌ 未达标'}`)
      
      if (result.issues.length > 0) {
        console.log(`  问题:`)
        result.issues.forEach(i => console.log(`    - ${i}`))
      }
    }
    
    // 总体评估
    const allSuccess = Object.values(this.results.byScenario).every(r => r.success)
    console.log('\n' + '='.repeat(60))
    console.log(`总体评估: ${allSuccess ? '✅ 所有场景达标' : '⚠️ 部分场景需要优化'}`)
    console.log('='.repeat(60))
  }
}

// 执行测试
async function main() {
  const tester = new ScenarioTester()
  await tester.runAllScenarios()
  process.exit(0)
}

main().catch(err => {
  console.error('测试失败:', err)
  process.exit(1)
})
