import fs from 'fs'

const filePath = '/var/www/xiaohuangyu/backend/src/services/userService.js'
let content = fs.readFileSync(filePath, 'utf-8')

// 找到旧的 getDailyPointsRank 方法并替换
const oldMethodStart = content.indexOf('  /**\n   * 获取今日积分排行\n   */\n  async getDailyPointsRank')
const oldMethodEnd = content.indexOf('  async clearUserData(userId)')

if (oldMethodStart === -1 || oldMethodEnd === -1) {
  console.log('找不到要替换的方法')
  process.exit(1)
}

const newMethod = `  /**
   * 获取今日积分排行
   */
  async getDailyPointsRank(limit = 10) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // CockroachDB 需要使用 to_timestamp 进行比较
    const records = await prisma.\$queryRaw\`
      SELECT user_id, SUM(points) as daily_points
      FROM records
      WHERE created_at >= to_timestamp(\${today.toISOString()})
        AND points > 0
      GROUP BY user_id
      ORDER BY daily_points DESC
      LIMIT \${limit}
    \`

    if (!records || records.length === 0) return []

    // 获取用户信息
    const userIds = records.map(r => r.user_id)
    const users = await prisma.\$queryRaw\`
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

const newContent = content.slice(0, oldMethodStart) + newMethod + content.slice(oldMethodEnd)

fs.writeFileSync(filePath, newContent)
console.log('✅ 已修复 getDailyPointsRank 方法')
