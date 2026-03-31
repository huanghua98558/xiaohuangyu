/**
 * 曝光系统和位置限制问题分析报告
 * 
 * 发现的问题：
 * 1. 并发领取竞争条件
 * 2. 缺少数据库唯一约束
 * 3. 顺序曝光逻辑问题
 */

import supabase from '../src/utils/supabase.js'
import logger from '../src/utils/logger.js'

console.log('========================================')
console.log('曝光系统和位置限制问题分析')
console.log('========================================\n')

// 问题1：检查数据库约束
async function checkDatabaseConstraints() {
  console.log('===== 检查数据库约束 =====\n')
  
  console.log('约束检查:')
  console.log('1. claims表应该有唯一约束：(task_id, city, status) 或 (task_id, province, status)')
  console.log('2. 当前检查发现：缺少针对城市/省份的唯一约束\n')
}

// 问题2：分析位置过滤逻辑
async function analyzeLocationFilterLogic() {
  console.log('\n===== 分析位置过滤逻辑 =====\n')
  
  console.log('当前逻辑流程:')
  console.log('1. 获取任务列表时：')
  console.log('   - 查询 status=doing 的领取记录')
  console.log('   - 检查 cityCount < cityLimitPerTask')
  console.log('   - 检查 provinceCount < provinceLimitPerTask')
  console.log('   - 问题：只过滤 doing 状态，不包括 pending 状态')
  console.log('')
  console.log('2. 领取任务时：')
  console.log('   - 先检查城市/省份数量')
  console.log('   - 再减少任务名额')
  console.log('   - 最后创建领取记录')
  console.log('   - 问题：没有使用事务，存在竞争条件')
  console.log('')
  console.log('3. 潜在问题：')
  console.log('   - 并发领取时，多个用户可能同时通过检查')
  console.log('   - 没有数据库级别的唯一约束保护')
  console.log('')
}

// 问题3：分析顺序曝光逻辑
async function analyzeSequentialExposureLogic() {
  console.log('\n===== 分析顺序曝光逻辑 =====\n')
  
  // 获取曝光配置
  const { data: config } = await supabase
    .from('exposure_config')
    .select('*')
    .eq('is_active', true)
    .single()
  
  console.log('曝光配置:')
  console.log(`  模式: ${config?.exposure_mode || 'parallel'}`)
  console.log(`  窗口: ${config?.exposure_window || 3}`)
  console.log(`  阈值: ${config?.sequential_threshold || 0.8}`)
  console.log('')
  
  // 获取曝光队列
  const { data: exposures } = await supabase
    .from('task_exposure')
    .select(`
      task_id,
      queue_position,
      unlocked_at,
      need_count,
      accepted_count,
      tasks(id, title, created_at)
    `)
    .eq('status', 'active')
    .order('queue_position', { ascending: true })
    .limit(15)
  
  console.log('曝光队列分析:')
  let window = config?.exposure_window || 3
  let threshold = config?.sequential_threshold || 0.8
  
  console.log(`\n预期行为：`)
  console.log(`  - 曝光窗口=${window}，最多同时曝光${window}个任务`)
  console.log(`  - 完成率>=${threshold*100}%时解锁下一个任务`)
  console.log('')
  
  console.log('当前状态:')
  let exposed = []
  let blocked = false
  
  for (let i = 0; i < (exposures || []).length; i++) {
    const exp = exposures[i]
    const rate = exp.need_count > 0 ? (exp.accepted_count / exp.need_count) : 0
    const unlocked = !!exp.unlocked_at
    
    let status = ''
    if (unlocked) {
      exposed.push(exp.task_id)
      status = '✅ 已解锁'
    } else if (!blocked && exposed.length < window) {
      exposed.push(exp.task_id)
      status = '🟡 窗口内'
      if (rate < threshold) {
        blocked = true
        status += ' | 阻塞后续'
      }
    } else {
      status = '❌ 被阻塞'
    }
    
    console.log(`  ${exp.queue_position}. 任务${exp.task_id} - 完成率:${(rate*100).toFixed(0)}% ${status}`)
  }
  
  console.log(`\n最终曝光: ${exposed.length} 个任务 (预期窗口: ${window})`)
  
  if (exposed.length > window) {
    console.log('⚠️ 问题：曝光任务数超过窗口限制！')
    console.log('原因：已解锁的任务会直接加入曝光列表，不受窗口限制')
  }
  console.log('')
}

// 问题4：测试并发领取
async function testConcurrentClaim() {
  console.log('\n===== 测试并发领取（模拟） =====\n')
  
  // 创建测试用户（直接插入）
  const users = []
  for (let i = 0; i < 5; i++) {
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        username: `test_concurrent_${Date.now()}_${i}`,
        password_hash: '$2a$10$test',
        phone: `139${Math.random().toString().slice(2, 11)}`,
        role: 'user',
        points: 1000,
        invite_code: `TC${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      })
      .select()
      .single()
    
    if (user) users.push(user)
  }
  
  if (users.length < 2) {
    console.log('创建测试用户失败')
    return
  }
  
  console.log(`创建了 ${users.length} 个测试用户`)
  
  // 获取一个测试任务
  const { data: task } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'active')
    .gt('remain', 0)
    .limit(1)
    .single()
  
  if (!task) {
    console.log('没有可用任务')
    return
  }
  
  console.log(`测试任务: ${task.id} - ${task.title}`)
  console.log(`城市限制: ${task.city_limit}, 省份限制: ${task.province_limit}`)
  
  const testCity = '测试城市_A'
  const testProvince = '测试省份_A'
  
  // 模拟并发领取（不经过应用层检查，直接插入数据库）
  console.log('\n模拟5个同城市用户并发领取...')
  
  const promises = users.map(user => 
    supabase
      .from('claims')
      .insert({
        user_id: user.id,
        task_id: task.id,
        title: task.title,
        platform: task.platform,
        action: task.action,
        reward: task.reward,
        status: 'doing',
        city: testCity,
        province: testProvince,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      })
      .select()
      .single()
  )
  
  const results = await Promise.all(promises)
  
  // 统计成功数量
  const successes = results.filter(r => !r.error).length
  const failures = results.filter(r => r.error).length
  
  console.log(`\n结果: ${successes} 成功, ${failures} 失败`)
  
  if (successes > task.city_limit) {
    console.log(`❌ 问题确认：同城市超过${task.city_limit}人成功领取！`)
    console.log('   这说明数据库没有城市级别的唯一约束')
  } else {
    console.log(`✅ 正常：同城市只有${successes}人成功领取`)
  }
  
  // 清理测试数据
  console.log('\n清理测试数据...')
  const testUserIds = users.map(u => u.id)
  await supabase.from('claims').delete().in('user_id', testUserIds)
  await supabase.from('users').delete().in('id', testUserIds)
  console.log('清理完成')
}

// 问题5：分析解决方案
async function analyzeSolutions() {
  console.log('\n========================================')
  console.log('问题分析和解决方案')
  console.log('========================================\n')
  
  console.log('问题1：并发领取竞争条件')
  console.log('  原因：检查名额和创建记录不是原子操作')
  console.log('  解决方案：')
  console.log('    A. 使用数据库事务（推荐）')
  console.log('    B. 添加分布式锁（Redis）')
  console.log('    C. 使用数据库唯一约束')
  console.log('')
  
  console.log('问题2：缺少数据库唯一约束')
  console.log('  原因：claims表没有(task_id, city, status)的唯一约束')
  console.log('  解决方案：')
  console.log('    CREATE UNIQUE INDEX idx_claims_task_city_unique')
  console.log('    ON claims (task_id, city, status) WHERE city IS NOT NULL;')
  console.log('    CREATE UNIQUE INDEX idx_claims_task_province_unique')
  console.log('    ON claims (task_id, province, status) WHERE province IS NOT NULL;')
  console.log('')
  
  console.log('问题3：顺序曝光窗口限制问题')
  console.log('  原因：已解锁任务直接加入曝光列表，不受窗口限制')
  console.log('  解决方案：')
  console.log('    修改逻辑：已解锁任务也应该受窗口限制')
  console.log('    或：明确区分"已解锁"和"当前窗口"的概念')
  console.log('')
  
  console.log('问题4：位置过滤只检查doing状态')
  console.log('  原因：pending状态的领取也应该计入名额')
  console.log('  解决方案：')
  console.log('    将 pending 状态也纳入统计')
  console.log('')
}

// 运行分析
async function runAnalysis() {
  try {
    await checkDatabaseConstraints()
    await analyzeLocationFilterLogic()
    await analyzeSequentialExposureLogic()
    await testConcurrentClaim()
    await analyzeSolutions()
    
    console.log('\n========================================')
    console.log('分析完成')
    console.log('========================================')
  } catch (err) {
    console.error('分析失败:', err)
  }
}

runAnalysis()
