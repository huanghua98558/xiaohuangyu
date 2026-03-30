import fs from 'fs'
import path from 'path'

const servicesDir = './src/services'
const files = fs.readdirSync(servicesDir).filter(f => f.endsWith('.js'))

console.log('=== 用户端服务数据库使用情况分析 ===\n')

const stats = {
  prismaOnly: [],
  supabaseAdapter: [],
  supabaseFrom: [],
  mixed: []
}

files.forEach(file => {
  const content = fs.readFileSync(path.join(servicesDir, file), 'utf-8')
  const hasPrisma = content.includes("import prisma")
  const hasSupabase = content.includes("import supabase")
  const hasSupabaseFrom = content.includes("supabase.from") || content.includes("supabase.rpc")
  
  if (hasPrisma && !hasSupabase) {
    stats.prismaOnly.push(file)
  } else if (hasSupabase && !hasPrisma) {
    if (hasSupabaseFrom) {
      stats.supabaseFrom.push(file)
    } else {
      stats.supabaseAdapter.push(file)
    }
  } else if (hasPrisma && hasSupabase) {
    stats.mixed.push(file)
  }
})

console.log('✅ 仅使用 Prisma (已完全迁移):')
stats.prismaOnly.forEach(f => console.log(`   - ${f}`))
console.log(`   共 ${stats.prismaOnly.length} 个\n`)

console.log('⚠️  使用 Supabase 适配器 (实际可能走 Prisma):')
stats.supabaseAdapter.forEach(f => console.log(`   - ${f}`))
console.log(`   共 ${stats.supabaseAdapter.length} 个\n`)

console.log('❌ 仍使用 supabase.from() 查询 (未迁移):')
stats.supabaseFrom.forEach(f => console.log(`   - ${f}`))
console.log(`   共 ${stats.supabaseFrom.length} 个\n`)

console.log('🔄 混合使用 Prisma 和 Supabase:')
stats.mixed.forEach(f => console.log(`   - ${f}`))
console.log(`   共 ${stats.mixed.length} 个\n`)

console.log('=== 统计汇总 ===')
console.log(`总服务数：${files.length}`)
console.log(`已迁移：${stats.prismaOnly.length} (${(stats.prismaOnly.length/files.length*100).toFixed(1)}%)`)
console.log(`适配器模式：${stats.supabaseAdapter.length} (${(stats.supabaseAdapter.length/files.length*100).toFixed(1)}%)`)
console.log(`未迁移：${stats.supabaseFrom.length} (${(stats.supabaseFrom.length/files.length*100).toFixed(1)}%)`)
console.log(`混合使用：${stats.mixed.length} (${(stats.mixed.length/files.length*100).toFixed(1)}%)`)
