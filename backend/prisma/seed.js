/**
 * 数据库种子脚本 - 生成排行榜测试数据
 * 运行方式: node prisma/seed.js
 * 
 * 数据逻辑：总积分 = 历史积分之和 + 今日积分
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// 测试用户目标积分（最终总积分）
const testUsers = [
  { username: '张三', totalPoints: 8500 },
  { username: '李四', totalPoints: 6200 },
  { username: '王五', totalPoints: 4800 },
  { username: '赵六', totalPoints: 3500 },
  { username: '小明', totalPoints: 2900 },
  { username: '小红', totalPoints: 2100 },
  { username: '小华', totalPoints: 1500 },
  { username: '小丽', totalPoints: 800 },
  { username: '小刚', totalPoints: 500 },
  { username: '小美', totalPoints: 200 },
]

// 任务类型描述
const taskDescs = [
  { platform: '抖音', actions: ['评论', '点赞', '收藏', '转发'] },
  { platform: '快手', actions: ['评论', '点赞', '收藏', '转发'] },
  { platform: '小红书', actions: ['评论', '点赞', '收藏'] },
  { platform: '视频号', actions: ['点赞', '转发'] },
]

function getRandomTask() {
  const task = taskDescs[Math.floor(Math.random() * taskDescs.length)]
  const action = task.actions[Math.floor(Math.random() * task.actions.length)]
  return `${task.platform}${action}任务`
}

async function main() {
  console.log('🌱 开始填充数据库...\n')

  const passwordHash = await bcrypt.hash('123456', 10)
  const createdUsers = []

  // 1. 创建测试用户
  console.log('📝 创建测试用户...')
  for (const userData of testUsers) {
    const inviteCode = `INV${Date.now()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    try {
      // 先创建用户，积分稍后根据记录计算
      const user = await prisma.user.create({
        data: {
          username: userData.username,
          passwordHash: passwordHash,
          points: 0,  // 先设为0，最后更新
          balance: 0,
          inviteCode: inviteCode,
          role: 'user'
        }
      })
      createdUsers.push({ ...user, targetPoints: userData.totalPoints })
      console.log(`  ✅ 创建用户: ${user.username} (目标积分: ${userData.totalPoints})`)
    } catch (error) {
      if (error.code === 'P2002') {
        const user = await prisma.user.findUnique({ where: { username: userData.username } })
        if (user) {
          createdUsers.push({ ...user, targetPoints: userData.totalPoints })
          console.log(`  🔄 用户已存在: ${user.username}`)
        }
      } else {
        throw error
      }
    }
  }

  // 2. 为每个用户生成积分记录
  console.log('\n📊 生成积分记录...')
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  for (const user of createdUsers) {
    let remainingPoints = user.targetPoints
    const records = []

    // 随机分配今日积分 (总积分的 10%~30%，或者最小值)
    const todayPercent = 0.1 + Math.random() * 0.2  // 10%~30%
    const todayPoints = Math.max(10, Math.floor(user.targetPoints * todayPercent))
    
    // 确保今日积分不超过剩余积分
    const actualTodayPoints = Math.min(todayPoints, remainingPoints)
    
    if (actualTodayPoints > 0) {
      // 今日积分分成多条记录
      let todayRemaining = actualTodayPoints
      const todayRecordCount = Math.floor(Math.random() * 3) + 2  // 2-4条记录
      
      for (let i = 0; i < todayRecordCount && todayRemaining > 0; i++) {
        const recordPoints = i === todayRecordCount - 1 
          ? todayRemaining 
          : Math.min(Math.floor(Math.random() * 50) + 20, todayRemaining)
        
        if (recordPoints <= 0) break
        
        const recordTime = new Date(now)
        recordTime.setHours(Math.floor(Math.random() * 10) + 8, Math.floor(Math.random() * 60), 0, 0)
        
        records.push({
          userId: user.id,
          type: 'task',
          desc: getRandomTask(),
          points: recordPoints,
          balance: 0,
          createdAt: recordTime
        })
        
        todayRemaining -= recordPoints
      }
      
      remainingPoints -= actualTodayPoints
    }

    // 剩余积分分配到过去几天 (最近30天内)
    const daysToDistribute = Math.floor(Math.random() * 20) + 10  // 10-30天
    const pointsPerDay = Math.floor(remainingPoints / daysToDistribute)
    let extraPoints = remainingPoints % daysToDistribute

    for (let day = 1; day <= daysToDistribute && remainingPoints > 0; day++) {
      const recordDate = new Date(todayStart)
      recordDate.setDate(recordDate.getDate() - day)
      
      // 每天1-3条记录
      const dailyRecords = Math.floor(Math.random() * 3) + 1
      let dailyPoints = pointsPerDay + (day === 1 ? extraPoints : 0)
      
      for (let r = 0; r < dailyRecords && dailyPoints > 0; r++) {
        const recordPoints = r === dailyRecords - 1 
          ? dailyPoints 
          : Math.min(Math.floor(Math.random() * 100) + 30, dailyPoints)
        
        if (recordPoints <= 0) break
        
        const recordTime = new Date(recordDate)
        recordTime.setHours(Math.floor(Math.random() * 12) + 8, Math.floor(Math.random() * 60), 0, 0)
        
        records.push({
          userId: user.id,
          type: 'task',
          desc: getRandomTask(),
          points: recordPoints,
          balance: 0,
          createdAt: recordTime
        })
        
        dailyPoints -= recordPoints
        remainingPoints -= recordPoints
      }
    }

    // 批量创建记录
    if (records.length > 0) {
      await prisma.record.createMany({ data: records })
      
      // 计算实际总积分
      const totalFromRecords = records.reduce((sum, r) => sum + r.points, 0)
      
      // 更新用户积分
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          points: totalFromRecords,
          balance: Math.floor(totalFromRecords * 0.01 * 100) / 100
        }
      })
      
      user.actualPoints = totalFromRecords
      user.todayPoints = actualTodayPoints
    }
  }

  // 3. 统计结果
  console.log('\n✅ 数据生成完成！\n')
  console.log('═'.repeat(60))
  console.log('📈 排行榜数据统计')
  console.log('═'.repeat(60))

  // 总排行榜
  const totalRank = await prisma.user.findMany({
    where: { points: { gt: 0 } },
    orderBy: { points: 'desc' },
    take: 10,
    select: { username: true, points: true }
  })
  
  console.log('\n🏆 总积分排行榜 TOP 10:')
  totalRank.forEach((u, i) => {
    const medal = ['🥇', '🥈', '🥉'][i] || `  ${i + 1}.`
    console.log(`  ${medal} ${u.username.padEnd(6, '　')} ${u.points.toString().padStart(5, ' ')} 积分`)
  })

  // 今日排行榜
  const todayRecords = await prisma.record.findMany({
    where: {
      createdAt: { gte: todayStart },
      points: { gt: 0 }
    },
    select: { userId: true, points: true }
  })

  const todayPointsMap = new Map()
  for (const r of todayRecords) {
    const current = todayPointsMap.get(r.userId) || 0
    todayPointsMap.set(r.userId, current + r.points)
  }

  const todayRankUsers = await prisma.user.findMany({
    where: { id: { in: Array.from(todayPointsMap.keys()) } },
    select: { id: true, username: true }
  })

  const sortedTodayRank = todayRankUsers
    .map(u => ({ username: u.username, points: todayPointsMap.get(u.id) || 0 }))
    .sort((a, b) => b.points - a.points)

  console.log('\n📅 今日积分排行榜 TOP 10:')
  sortedTodayRank.slice(0, 10).forEach((u, i) => {
    const medal = ['🥇', '🥈', '🥉'][i] || `  ${i + 1}.`
    console.log(`  ${medal} ${u.username.padEnd(6, '　')} +${u.points.toString().padStart(4, ' ')} 积分`)
  })

  console.log('\n═'.repeat(60))
  console.log('💡 说明: 总积分 = 历史积分 + 今日积分')
  console.log('═'.repeat(60))
}

main()
  .catch((e) => {
    console.error('❌ 填充失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
