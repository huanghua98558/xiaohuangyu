import prisma from './src/utils/prisma.js'
import supabase from './src/utils/supabaseToPrismaAdapter.js'
import logger from './src/utils/logger.js'
import { toIdString } from './utils/id.js'

async function addDailyRankMethod() {
  // 读取 userService.js 文件
  const fs = await import('fs')
  const filePath = '/var/www/xiaohuangyu/backend/src/services/userService.js'
  let content = fs.readFileSync(filePath, 'utf-8')
  
  // 在 getPointsRank 方法后添加 getDailyPointsRank 方法
  const newMethod = `
  /**
   * 获取今日积分排行
   */
  async getDailyPointsRank(limit = 10) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    // 从 records 表统计今日所有正向积分变动
    const records = await prisma.$queryRaw\`
      SELECT user_id, SUM(points) as daily_points
      FROM records
      WHERE created_at >= \${todayStr}
        AND points > 0
      GROUP BY user_id
      ORDER BY daily_points DESC
      LIMIT \${limit}
    \`

    if (!records || records.length === 0) return []

    // 获取用户信息
    const userIds = records.map(r => r.user_id)
    const users = await prisma.$queryRaw\`
      SELECT id, username, level
      FROM users
      WHERE id IN (\${userIds.join(',')})
    \`

    const userMap = new Map(users.map(u => [Number(u.id), u]))

    // 组合数据
    return (records || []).map((r, i) => {
      const user = userMap.get(Number(r.user_id))
      return {
        rank: i + 1,
        userId: toIdString(r.user_id),
        username: user ? user.username : '未知用户',
        points: Number(r.daily_points),
        level: user ? Number(user.level) : 1
      }
    })
  }

`
  
  // 找到 getPointsRank 方法的结尾位置
  const getPointsRankEnd = content.indexOf('  async clearUserData(userId)')
  
  if (getPointsRankEnd === -1) {
    console.log('找不到插入位置')
    return
  }
  
  // 插入新方法
  const newContent = content.slice(0, getPointsRankEnd) + newMethod + content.slice(getPointsRankEnd)
  
  // 写回文件
  fs.writeFileSync(filePath, newContent)
  console.log('✅ 已添加 getDailyPointsRank 方法')
}

addDailyRankMethod()
