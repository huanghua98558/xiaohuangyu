/**
 * 数据库种子脚本 V2 - 等级系统 + 推广系统
 * 运行方式: node prisma/seed-v2.js
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 开始填充数据库 V2...\n')

  // 1. 创建角色
  console.log('📝 创建角色...')
  const roles = [
    { code: 'admin', name: '后台管理员', roleType: 'official', canBPromotion: true, description: '全局超管', permissions: '["all"]' },
    { code: 'official_publisher', name: '官方任务发布员', roleType: 'official', canBPromotion: true, description: '发布官方任务', permissions: '["task:create","task:edit","task:view","b_promotion"]' },
    { code: 'official_auditor', name: '官方任务审核员', roleType: 'official', canBPromotion: true, description: '审核所有任务', permissions: '["task:audit","task:view","b_promotion"]' },
    { code: 'official_manager', name: '官方运营主管', roleType: 'official', canBPromotion: true, description: '管理内部团队', permissions: '["task:create","task:edit","task:view","team:manage","b_promotion"]' },
    { code: 'official_operator', name: '官方运营人员', roleType: 'official', canBPromotion: true, description: '执行任务发布', permissions: '["task:create","task:view","b_promotion"]' },
    { code: 'third_party', name: '第三方运营主管', roleType: 'third_party', canBPromotion: true, description: '外部合作方', permissions: '["task:create","task:edit","task:view","b_promotion"]' },
    { code: 'part_timer', name: '兼职人员', roleType: 'part_timer', canBPromotion: false, description: '领取任务执行', permissions: '["task:claim","task:submit","c_promotion"]' },
  ]

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: role,
      create: role
    })
    console.log(`  ✅ 角色: ${role.name}`)
  }

  // 2. 创建等级配置
  console.log('\n📊 创建等级配置...')
  const levels = [
    { level: 1, name: '普通兼职', coefficient: 1.0, minTasks: 0, minPoints: 0, minPassRate: 0, concurrentTasks: 1, prioritySupport: false, icon: '⭐' },
    { level: 2, name: '高级兼职', coefficient: 1.2, minTasks: 3500, minPoints: 105000, minPassRate: 85, concurrentTasks: 2, prioritySupport: false, icon: '⭐⭐' },
    { level: 3, name: '资深兼职', coefficient: 1.5, minTasks: 15000, minPoints: 450000, minPassRate: 90, concurrentTasks: 3, prioritySupport: true, icon: '⭐⭐⭐' },
  ]

  for (const lv of levels) {
    await prisma.levelConfig.upsert({
      where: { level: lv.level },
      update: lv,
      create: lv
    })
    console.log(`  ✅ Lv.${lv.level}: ${lv.name} (${lv.coefficient}x)`)
  }

  // 3. 创建系统配置
  console.log('\n⚙️ 创建系统配置...')
  const configs = [
    { key: 'c_promotion_enabled', value: 'true', description: 'C端推广系统开关' },
    { key: 'c_promotion_level1_rate', value: '10', description: 'C端一级推广比例(%)' },
    { key: 'c_promotion_level2_rate', value: '5', description: 'C端二级推广比例(%)' },
    { key: 'b_promotion_enabled', value: 'true', description: 'B端推广系统开关' },
    { key: 'b_promotion_rate', value: '2', description: 'B端推广流水抽成比例(%)' },
    { key: 'b_promotion_settle_days', value: '7', description: 'B端推广结算周期(天)' },
    { key: 'leaderboard_enabled', value: 'true', description: '排行榜系统开关' },
    { key: 'leaderboard_new_user_days', value: '7', description: '新用户延迟上榜天数' },
    { key: 'level_demotion_inactive_days', value: '30', description: '降级-连续不活跃天数' },
    { key: 'level_demotion_pass_rate', value: '70', description: '降级-通过率低于此值(%)' },
    { key: 'points_to_yuan', value: '100', description: '积分兑换比例' },
    { key: 'min_withdraw_amount', value: '10', description: '最低提现金额(元)' },
    { key: 'withdraw_fee_rate', value: '5', description: '提现手续费(%)' },
    { key: 'default_time_limit_minutes', value: '10', description: '任务默认时效(分钟)' },
    { key: 'max_concurrent_per_user', value: '5', description: '用户最大同时进行任务数' },
  ]

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: { value: config.value, description: config.description },
      create: config
    })
  }
  console.log(`  ✅ 已创建 ${configs.length} 项配置`)

  // 4. 创建管理员账号
  console.log('\n👤 创建管理员账号...')
  const passwordHash = await bcrypt.hash('admin123', 10)
  const inviteCode = `ADM${Date.now()}`
  
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { role: 'admin' },
    create: {
      username: 'admin',
      passwordHash: passwordHash,
      role: 'admin',
      inviteCode: inviteCode,
      level: 1,
      points: 0,
      balance: 0
    }
  })
  console.log(`  ✅ 管理员账号: admin / admin123`)

  // 5. 创建测试兼职账号
  console.log('\n👥 创建测试兼职账号...')
  const testUsers = [
    { username: '测试用户1', level: 1 },
    { username: '测试用户2', level: 1 },
    { username: '测试用户3', level: 2 },
  ]

  for (const u of testUsers) {
    const code = `TEST${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    await prisma.user.upsert({
      where: { username: u.username },
      update: { level: u.level },
      create: {
        username: u.username,
        passwordHash: passwordHash,
        role: 'part_timer',
        inviteCode: code,
        level: u.level,
        points: u.level === 2 ? 105000 : 0,
        totalPoints: u.level === 2 ? 105000 : 0,
        totalTasks: u.level === 2 ? 3500 : 0
      }
    })
    console.log(`  ✅ 测试账号: ${u.username} (Lv.${u.level})`)
  }

  console.log('\n✅ 数据库填充完成！')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
