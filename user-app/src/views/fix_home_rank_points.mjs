import fs from 'fs'

const filePath = '/var/www/xiaohuangyu/user-app/src/views/Home.vue'
let content = fs.readFileSync(filePath, 'utf-8')

// 修复积分显示字段，每日排行使用 points 而不是 dailyPoints
const oldLine = '<span class="rank-points">{{ activeRankTab === \'total\' ? item.points : item.dailyPoints }} {{ activeRankTab === \'total\' ? \'积分\' : \'今日积分\' }}</span>'

const newLine = '<span class="rank-points">{{ item.points }} {{ activeRankTab === \'total\' ? \'积分\' : \'今日积分\' }}</span>'

content = content.replace(oldLine, newLine)

fs.writeFileSync(filePath, content)
console.log('✅ 已修复积分显示字段')
