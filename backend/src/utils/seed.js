import 'dotenv/config'
import supabase from './supabase.js'
import { hashPassword } from './password.js'
import logger from './logger.js'

// 标记是否已初始化
let seedCompleted = false

/**
 * 按需运行数据初始化（仅在数据为空时执行）
 */
async function runSeedIfNeeded() {
  if (seedCompleted) {
    return
  }
  
  try {
    // 检查是否需要初始化基础数据
    const { count: taskCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
    
    // 如果任务表为空，执行完整初始化
    if ((taskCount || 0) === 0) {
      logger.info('检测到数据库为空，开始初始化...')
      await seed()
    } else {
      // 数据库已有基础数据，但仍需检查排行榜测试数据
      logger.info('数据库已有基础数据，检查排行榜测试数据...')
      await createLeaderboardTestData()
    }
    
    // 始终确保 admin 用户积分正确
    await ensureAdminPoints()
    
    seedCompleted = true
  } catch (error) {
    logger.error('数据初始化检查失败:', error.message)
    // 不抛出错误，允许服务继续启动
  }
}

/**
 * 确保 admin 用户积分正确
 */
async function ensureAdminPoints() {
  const { data: admin } = await supabase
    .from('users')
    .select('points')
    .eq('username', 'admin')
    .maybeSingle()
  
  if (admin && admin.points < 500000) {
    await supabase
      .from('users')
      .update({
        points: 500000,
        total_points: 500000
      })
      .eq('username', 'admin')
    logger.info('更新管理员账号积分: 500000')
  }
}

async function seed() {
  logger.info('开始初始化数据...')

  const allowWeakDemoAccounts =
    process.env.NODE_ENV !== 'production' ||
    process.env.ALLOW_DEMO_SEED === '1' ||
    process.env.SEED_DEFAULT_ADMIN === '1'

  try {
    // 创建管理员账号（生产环境默认禁止弱口令演示账号，需 ALLOW_DEMO_SEED=1 或 SEED_DEFAULT_ADMIN=1）
    const { data: adminExists } = await supabase
      .from('users')
      .select('*')
      .eq('username', 'admin')
      .maybeSingle()
    
    if (!adminExists) {
      if (!allowWeakDemoAccounts) {
        logger.warn(
          '生产环境未创建默认 admin 账号。请通过管理流程创建管理员，或一次性设置 ALLOW_DEMO_SEED=1 后重启以完成空库初始化。'
        )
      } else {
        await supabase
          .from('users')
          .insert({
            username: 'admin',
            password_hash: await hashPassword('admin123'),
            role: 'admin',
            points: 500000,
            total_points: 500000,
            balance: 0,
            invite_code: 'ADMIN001'
          })
        logger.info('已创建默认管理员账号（请务必尽快修改为强密码）')
      }
    } else if (adminExists.points < 500000) {
      // 仅当积分不足时更新（避免覆盖正常扣减）
      await supabase
        .from('users')
        .update({
          points: 500000,
          total_points: 500000
        })
        .eq('username', 'admin')
      logger.info('更新管理员账号积分: 500000')
    }

    // 创建审核员 / 测试 / 发布者（与管理员相同策略）
    if (allowWeakDemoAccounts) {
      const { data: reviewerExists } = await supabase
        .from('users')
        .select('*')
        .eq('username', 'reviewer')
        .maybeSingle()

      if (!reviewerExists) {
        await supabase
          .from('users')
          .insert({
            username: 'reviewer',
            password_hash: await hashPassword('reviewer123'),
            role: 'reviewer',
            points: 0,
            balance: 0,
            invite_code: 'REVIEWER001'
          })
        logger.info('创建审核员账号: reviewer / reviewer123')
      }

      const { data: testUserExists } = await supabase
        .from('users')
        .select('*')
        .eq('username', 'test')
        .maybeSingle()

      if (!testUserExists) {
        await supabase
          .from('users')
          .insert({
            username: 'test',
            password_hash: await hashPassword('test123'),
            role: 'part_timer',
            points: 1000,
            balance: 10,
            invite_code: 'TEST001'
          })
        logger.info('创建测试用户: test / test123')
      }

      const { data: clientExists } = await supabase
        .from('users')
        .select('*')
        .eq('username', 'client')
        .maybeSingle()

      if (!clientExists) {
        await supabase
          .from('users')
          .insert({
            username: 'client',
            password_hash: await hashPassword('client123'),
            role: 'client',
            points: 0,
            balance: 0,
            invite_code: 'CLIENT001'
          })
        logger.info('创建任务发布者账号: client / client123')
      }
    }

    // 创建示例任务
    const { count: taskCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
    
    if ((taskCount || 0) === 0) {
      const tasks = [
        // 抖音平台任务
        { title: '抖音视频评论任务', platform: '抖音', action: '评论', video_url: 'https://v.douyin.com/example/', description: '打开下方视频链接，完成评论后提交截图。禁止刷量、虚假评论、使用脚本。', template_images: '[]', requirements: '["打开视频链接", "按要求完成评论", "提交抖音昵称和完成截图"]', reward: 20, remain: 50 },
        { title: '抖音关注账号', platform: '抖音', action: '关注', video_url: 'https://v.douyin.com/test3/', description: '关注指定抖音账号', template_images: '[]', requirements: '["搜索账号", "关注", "提交截图"]', reward: 10, remain: 150 },
        { title: '抖音转发任务', platform: '抖音', action: '转发', video_url: 'https://v.douyin.com/example2/', description: '转发指定视频到个人页，提交抖音昵称与截图。', template_images: '[]', requirements: '["转发视频", "提交昵称与截图"]', reward: 30, remain: 45 },
        { title: '抖音视频分享', platform: '抖音', action: '分享', video_url: 'https://v.douyin.com/test4/', description: '分享视频到微信或朋友圈', template_images: '[]', requirements: '["分享视频", "提交分享截图"]', reward: 35, remain: 60 },
        { title: '抖音评论互动', platform: '抖音', action: '评论', video_url: 'https://v.douyin.com/test5/', description: '在视频评论区发表指定内容', template_images: '[]', requirements: '["打开视频", "评论指定内容", "提交截图"]', reward: 20, remain: 120 },
        
        // 快手平台任务
        { title: '快手点赞收藏', platform: '快手', action: '点赞', video_url: 'https://www.kuaishou.com/short-video/example', description: '完成点赞与收藏，提交快手昵称及截图。', template_images: '[]', requirements: '["打开链接", "点赞+收藏", "提交昵称与截图"]', reward: 15, remain: 30 },
        { title: '快手直播观看', platform: '快手', action: '观看', video_url: 'https://www.kuaishou.com/test2/', description: '观看直播满5分钟', template_images: '[]', requirements: '["进入直播间", "观看5分钟", "提交截图"]', reward: 30, remain: 50 },
        { title: '快手双击红心', platform: '快手', action: '点赞', video_url: 'https://www.kuaishou.com/test4/', description: '双击视频给红心', template_images: '[]', requirements: '["打开视频", "双击红心", "提交截图"]', reward: 8, remain: 200 },
        
        // 小红书平台任务
        { title: '小红书笔记评论', platform: '小红书', action: '评论', video_url: 'https://www.xiaohongshu.com/explore/example', description: '在小红书笔记下按要求评论，提交昵称与截图。', template_images: '[]', requirements: '["打开笔记", "完成评论", "提交昵称与截图"]', reward: 25, remain: 80 },
        { title: '小红书笔记点赞', platform: '小红书', action: '点赞', video_url: 'https://www.xiaohongshu.com/test1/', description: '点赞小红书笔记', template_images: '[]', requirements: '["打开笔记", "点赞", "提交截图"]', reward: 15, remain: 80 },
        { title: '小红书收藏笔记', platform: '小红书', action: '收藏', video_url: 'https://www.xiaohongshu.com/test2/', description: '收藏指定笔记', template_images: '[]', requirements: '["打开笔记", "收藏", "提交截图"]', reward: 18, remain: 70 },
        { title: '小红书评论互动', platform: '小红书', action: '评论', video_url: 'https://www.xiaohongshu.com/test4/', description: '在笔记下发表评论', template_images: '[]', requirements: '["打开笔记", "评论", "提交截图"]', reward: 22, remain: 60 },
        { title: '小红书分享好友', platform: '小红书', action: '分享', video_url: 'https://www.xiaohongshu.com/test5/', description: '分享笔记给好友', template_images: '[]', requirements: '["分享笔记", "提交截图"]', reward: 28, remain: 40 },
        
        // 视频号任务
        { title: '视频号点赞', platform: '视频号', action: '点赞', video_url: 'https://mp.weixin.qq.com/s/example', description: '观看视频号并点赞，提交完成截图。', template_images: '[]', requirements: '["打开视频号", "点赞", "提交截图"]', reward: 18, remain: 20 },
        { title: '视频号转发朋友圈', platform: '视频号', action: '分享', video_url: 'https://mp.weixin.qq.com/test3/', description: '转发视频到朋友圈', template_images: '[]', requirements: '["转发视频", "提交截图"]', reward: 40, remain: 30 },
        { title: '视频号评论', platform: '视频号', action: '评论', video_url: 'https://mp.weixin.qq.com/test4/', description: '在视频下发表评论', template_images: '[]', requirements: '["打开视频", "评论", "提交截图"]', reward: 20, remain: 50 },
        
        // B站任务
        { title: 'B站三连', platform: 'B站', action: '三连', video_url: 'https://www.bilibili.com/test4/', description: '点赞投币收藏三连', template_images: '[]', requirements: '["打开视频", "三连", "提交截图"]', reward: 45, remain: 40 },
        { title: 'B站关注UP主', platform: 'B站', action: '关注', video_url: 'https://www.bilibili.com/test3/', description: '关注B站UP主', template_images: '[]', requirements: '["搜索UP主", "关注", "提交截图"]', reward: 10, remain: 120 },
        { title: 'B站评论', platform: 'B站', action: '评论', video_url: 'https://www.bilibili.com/test5/', description: '在视频下发表评论', template_images: '[]', requirements: '["打开视频", "评论", "提交截图"]', reward: 18, remain: 60 },
        
        // 微博任务
        { title: '微博点赞', platform: '微博', action: '点赞', video_url: 'https://weibo.com/test1/', description: '点赞微博动态', template_images: '[]', requirements: '["打开微博", "点赞", "提交截图"]', reward: 10, remain: 150 },
        { title: '微博关注', platform: '微博', action: '关注', video_url: 'https://weibo.com/test3/', description: '关注微博博主', template_images: '[]', requirements: '["搜索博主", "关注", "提交截图"]', reward: 10, remain: 120 },
        { title: '微博评论', platform: '微博', action: '评论', video_url: 'https://weibo.com/test4/', description: '在微博下发表评论', template_images: '[]', requirements: '["打开微博", "评论", "提交截图"]', reward: 18, remain: 60 },
        { title: '微博转发', platform: '微博', action: '转发', video_url: 'https://weibo.com/test5/', description: '转发微博', template_images: '[]', requirements: '["打开微博", "转发", "提交截图"]', reward: 25, remain: 50 },
        
        // 闲鱼任务
        { title: '闲鱼留言', platform: '闲鱼', action: '评论', video_url: 'https://www.goofish.com/test3/', description: '在商品下留言咨询', template_images: '[]', requirements: '["打开商品", "留言", "提交截图"]', reward: 15, remain: 60 },
        
        // 更多抖音任务
        { title: '视频号点赞互动', platform: '视频号', action: '点赞', video_url: 'https://mp.weixin.qq.com/test1/', description: '点赞视频号内容', template_images: '[]', requirements: '["打开视频号", "点赞", "提交截图"]', reward: 15, remain: 100 },
      ]

      const { error: insertError } = await supabase
        .from('tasks')
        .insert(tasks)
      
      if (!insertError) {
        logger.info(`创建 ${tasks.length} 个示例任务`)
      }
    }

    // 创建等级配置
    const { count: levelCount } = await supabase
      .from('level_configs')
      .select('*', { count: 'exact', head: true })
    
    if ((levelCount || 0) === 0) {
      const levels = [
        // 每天约500任务，平均每任务15积分
        // 等级设计：任务数和积分数对应不同时间周期
        { level: 1, name: '新手体验官', coefficient: 1.0, min_tasks: 0, min_points: 0, min_pass_rate: 0, concurrent_tasks: 1, priority_support: false, icon: '⭐' },
        { level: 2, name: '熟练体验官', coefficient: 1.05, min_tasks: 250, min_points: 5000, min_pass_rate: 80, concurrent_tasks: 2, priority_support: false, icon: '🌟' },
        { level: 3, name: '资深体验官', coefficient: 1.1, min_tasks: 1000, min_points: 20000, min_pass_rate: 85, concurrent_tasks: 3, priority_support: false, icon: '⭐⭐' },
        { level: 4, name: '金牌体验官', coefficient: 1.2, min_tasks: 5000, min_points: 100000, min_pass_rate: 88, concurrent_tasks: 5, priority_support: true, icon: '🏅' },
        { level: 5, name: '钻石体验官', coefficient: 1.3, min_tasks: 15000, min_points: 300000, min_pass_rate: 90, concurrent_tasks: 8, priority_support: true, icon: '💎' },
        { level: 6, name: '王牌体验官', coefficient: 1.5, min_tasks: 50000, min_points: 1000000, min_pass_rate: 92, concurrent_tasks: 10, priority_support: true, icon: '👑' },
        { level: 7, name: '皇冠体验官', coefficient: 1.8, min_tasks: 100000, min_points: 2000000, min_pass_rate: 95, concurrent_tasks: 15, priority_support: true, icon: '🏆' }
      ]

      const { error: insertError } = await supabase
        .from('level_configs')
        .insert(levels)
      
      if (!insertError) {
        logger.info(`创建 ${levels.length} 个等级配置`)
      } else {
        logger.error('创建等级配置失败:', insertError)
      }
    }

    // 创建默认系统配置
    const { count: configCount } = await supabase
      .from('configs')
      .select('*', { count: 'exact', head: true })
    
    if ((configCount || 0) === 0) {
      const configs = [
        { key: 'defaultTimeLimitMinutes', value: '10', desc: '任务默认时效（分钟）' },
        { key: 'maxConcurrentPerUser', value: '5', desc: '用户最大同时进行中任务数' },
        { key: 'cityLimitPerTask', value: '1', desc: '每个任务同城市名额限制' },
        { key: 'provinceLimitPerTask', value: '4', desc: '每个任务同省份名额限制' },
        { key: 'pointsToYuan', value: '10', desc: '积分兑换比例（多少积分=1元）' },
        { key: 'minWithdrawAmount', value: '10', desc: '最低提现金额（元）' }
      ]

      const { error: insertError } = await supabase
        .from('configs')
        .insert(configs)
      
      if (!insertError) {
        logger.info('创建系统默认配置')
      }
    }

    // 创建排行榜测试用户和数据
    await createLeaderboardTestData()

    // 创建夜间积分配置表数据
    await createNightPointConfig()

    logger.info('数据初始化完成！')
  } catch (error) {
    logger.error('数据初始化失败:', error)
    throw error
  }
}

/**
 * 创建排行榜测试数据
 */
async function createLeaderboardTestData() {
  // 检查是否已有排行榜测试数据
  const { count: userCount } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .like('username', 'ranker%')
  
  // 检查是否已有 claims 测试数据
  const { data: testClaims } = await supabase
    .from('claims')
    .select('id')
    .eq('status', 'done')
    .limit(1)
  
  const hasRankerUsers = (userCount || 0) > 0
  const hasClaimsData = testClaims && testClaims.length > 0
  
  if (hasRankerUsers && hasClaimsData) {
    logger.info('排行榜测试数据已存在，跳过')
    return
  }
  
  logger.info('创建排行榜测试数据...')
  
  let rankerUserIds = []
  
  // 如果没有 ranker 用户，创建它们
  if (!hasRankerUsers) {
    // 创建20个排行榜测试用户
    const rankerUsers = []
    for (let i = 1; i <= 20; i++) {
      rankerUsers.push({
        username: `ranker${String(i).padStart(2, '0')}`,
        password_hash: await hashPassword('ranker123'),
        role: 'part_timer', // 体验官
        points: 100 + (i * 50), // 积分从 150 到 1050，排名越靠前积分越高
        balance: 0,
        level: 1,
        total_tasks: i,
        total_points: 100 + (i * 50),
        invite_code: `RANKER${String(i).padStart(3, '0')}`
      })
    }
    
    const { data: insertedUsers, error: userError } = await supabase
      .from('users')
      .insert(rankerUsers)
      .select('id, username, points')
    
    if (userError || !insertedUsers) {
      logger.warn("创建排行榜测试用户跳过:", userError?.message || userError); return;
      return
    }
    
    logger.info(`创建 ${insertedUsers.length} 个排行榜测试用户`)
    rankerUserIds = insertedUsers.map(u => ({ id: u.id, points: u.points }))
  } else {
    // 获取现有 ranker 用户
    const { data: existingUsers } = await supabase
      .from('users')
      .select('id, points')
      .like('username', 'ranker%')
    
    rankerUserIds = existingUsers || []
    logger.info(`使用现有的 ${rankerUserIds.length} 个排行榜测试用户`)
  }
  
  // 如果已有 claims 数据，跳过创建
  if (hasClaimsData) {
    logger.info('已有 claims 数据，跳过创建')
    return
  }
  
  // 获取任务详情（需要标题、平台、操作类型）
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, platform, action')
    .limit(5)
  
  if (!tasks || tasks.length === 0) {
    logger.warn('没有任务数据，跳过创建claims')
    return
  }
  
  // 创建已完成的claims数据（用于周榜和月榜）
  const now = new Date()
  const claims = []
  
  // 为每个用户创建本周和本月的已完成任务记录
  for (const user of rankerUserIds) {
    // 本周数据 - 每个用户完成2-5个任务
    const weeklyTaskCount = 2 + Math.floor(Math.random() * 4)
    for (let i = 0; i < weeklyTaskCount; i++) {
      const randomTask = tasks[Math.floor(Math.random() * tasks.length)]
      const randomDaysAgo = Math.floor(Math.random() * 7) // 本周内随机日期
      const reviewedAt = new Date(now)
      reviewedAt.setDate(now.getDate() - randomDaysAgo)
      reviewedAt.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), 0, 0)
      
      const reward = 15 + Math.floor(Math.random() * 30) // 15-45积分
      
      claims.push({
        user_id: user.id,
        task_id: randomTask.id,
        title: randomTask.title,
        platform: randomTask.platform,
        action: randomTask.action,
        base_reward: reward,
        reward: reward,
        level_coefficient: 1.0,
        status: 'done',
        expires_at: new Date(reviewedAt.getTime() + 10 * 60 * 1000).toISOString(), // 过期时间为审核后10分钟
        claimed_at: new Date(reviewedAt.getTime() - 30 * 60 * 1000).toISOString(), // 领取时间为审核前30分钟
        submitted_at: new Date(reviewedAt.getTime() - 10 * 60 * 1000).toISOString(), // 提交时间为审核前10分钟
        reviewed_at: reviewedAt.toISOString()
      })
    }
    
    // 本月数据 - 每个用户额外完成5-15个任务
    const monthlyTaskCount = 5 + Math.floor(Math.random() * 11)
    for (let i = 0; i < monthlyTaskCount; i++) {
      const randomTask = tasks[Math.floor(Math.random() * tasks.length)]
      const randomDaysAgo = 7 + Math.floor(Math.random() * 23) // 本月内随机日期（排除本周）
      const reviewedAt = new Date(now)
      reviewedAt.setDate(now.getDate() - randomDaysAgo)
      reviewedAt.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), 0, 0)
      
      const reward = 15 + Math.floor(Math.random() * 30) // 15-45积分
      
      claims.push({
        user_id: user.id,
        task_id: randomTask.id,
        title: randomTask.title,
        platform: randomTask.platform,
        action: randomTask.action,
        base_reward: reward,
        reward: reward,
        level_coefficient: 1.0,
        status: 'done',
        expires_at: new Date(reviewedAt.getTime() + 10 * 60 * 1000).toISOString(), // 过期时间为审核后10分钟
        claimed_at: new Date(reviewedAt.getTime() - 30 * 60 * 1000).toISOString(), // 领取时间为审核前30分钟
        submitted_at: new Date(reviewedAt.getTime() - 10 * 60 * 1000).toISOString(), // 提交时间为审核前10分钟
        reviewed_at: reviewedAt.toISOString()
      })
    }
  }
  
  // 批量插入claims（分批处理，每批100条）
  const batchSize = 100
  for (let i = 0; i < claims.length; i += batchSize) {
    const batch = claims.slice(i, i + batchSize)
    const { error: claimError } = await supabase
      .from('claims')
      .insert(batch)
    
    if (claimError) {
      logger.error(`插入claims批次 ${Math.floor(i / batchSize) + 1} 失败:`, claimError)
    }
  }
  
  logger.info(`创建 ${claims.length} 条已完成任务记录（用于排行榜）`)
  
  // 创建一个排行榜快照示例（上周周榜）
  const lastWeekEnd = new Date(now)
  const dayOfWeek = now.getDay() || 7
  lastWeekEnd.setDate(now.getDate() - dayOfWeek)
  lastWeekEnd.setHours(23, 59, 59, 999)
  
  const lastWeekStart = new Date(lastWeekEnd)
  lastWeekStart.setDate(lastWeekEnd.getDate() - 6)
  lastWeekStart.setHours(0, 0, 0, 0)
  
  const weekNumber = getWeekNumber(lastWeekStart)
  const periodKey = `${lastWeekStart.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`
  
  // 获取上周积分前10名
  const weeklyRankings = rankerUserIds
    .map((u, i) => ({
      rank: i + 1,
      userId: u.id,
      points: u.points || 100 + (i * 50),
      taskCount: 5 + Math.floor(Math.random() * 10)
    }))
    .slice(0, 10)
  
  const { error: snapshotError } = await supabase
    .from('leaderboard_snapshots')
    .insert({
      type: 'weekly',
      period_key: periodKey,
      start_date: lastWeekStart.toISOString(),
      end_date: lastWeekEnd.toISOString(),
      total_participants: weeklyRankings.length,
      snapshot_data: JSON.stringify(weeklyRankings)
    })
  
  if (!snapshotError) {
    logger.info(`创建示例周榜快照: ${periodKey}`)
  }
}

/**
 * 创建夜间积分配置
 */
async function createNightPointConfig() {
  try {
    // 创建夜间积分主配置
    const { count: nightConfigCount } = await supabase
      .from('night_point_config')
      .select('*', { count: 'exact', head: true })
    
    if ((nightConfigCount || 0) === 0) {
      const { error } = await supabase
        .from('night_point_config')
        .insert({
          time_start: 0,
          time_end: 6,
          base_coefficient: 1.4,
          max_coefficient: 1.8,
          no_accept_bonus: 0.1,
          is_active: true
        })
      
      if (!error) {
        logger.info('创建夜间积分配置')
      }
    }

    // 创建在线用户-系数映射
    const { count: mapCount } = await supabase
      .from('online_user_coefficient_map')
      .select('*', { count: 'exact', head: true })
    
    if ((mapCount || 0) === 0) {
      const coefficientMap = [
        { online_users_max: 10, coefficient: 1.75, description: '极少人在线，高激励', sort_order: 1 },
        { online_users_max: 30, coefficient: 1.7, description: '少量人在线，中高激励', sort_order: 2 },
        { online_users_max: 50, coefficient: 1.6, description: '中等在线，适度激励', sort_order: 3 },
        { online_users_max: 100, coefficient: 1.5, description: '较多在线，低激励', sort_order: 4 },
        { online_users_max: 200, coefficient: 1.4, description: '大量在线，基础激励', sort_order: 5 }
      ]
      
      const { error } = await supabase
        .from('online_user_coefficient_map')
        .insert(coefficientMap)
      
      if (!error) {
        logger.info('创建在线用户系数映射')
      }
    }
  } catch (error) {
    logger.warn('创建夜间积分配置失败（表可能不存在）:', error.message)
  }
}

/**
 * 获取周数
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

// 导出函数供其他模块调用
export { runSeedIfNeeded, seed }

// 如果直接运行此文件，执行初始化
if (import.meta.url === `file://${process.argv[1]}`) {
  seed().catch(() => process.exit(1))
}
