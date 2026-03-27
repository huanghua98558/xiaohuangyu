import fs from 'fs'

const filePath = '/var/www/xiaohuangyu/user-app/src/views/Home.vue'
let content = fs.readFileSync(filePath, 'utf-8')

// 修复 key 绑定，兼容 id 和 userId
const oldLine = '<div class="rank-item" v-for="(item, index) in (activeRankTab === \'total\' ? rankList : dailyRankList)" :key="item.id">'

const newLine = '<div class="rank-item" v-for="(item, index) in (activeRankTab === \'total\' ? rankList : dailyRankList)" :key="item.id || item.userId">'

content = content.replace(oldLine, newLine)

fs.writeFileSync(filePath, content)
console.log('✅ 已修复排行榜 key 绑定问题')
