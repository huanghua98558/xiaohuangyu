import ipDispenser from './src/services/ai/ipDispenserService.js'

async function warmup() {
  console.log("=== 测试 IP 池预热 ===")
  
  try {
    // 初始化
    await ipDispenser.init()
    
    // 清空旧池
    console.log("\n清空旧 IP 池...")
    const { getRedisClient } = await import('./src/utils/redis.js')
    const client = await getRedisClient()
    await client.del('proxy:pool:available')
    
    // 预热 3 个 IP
    console.log("\n开始预热 3 个 IP...")
    await ipDispenser.warmup(3)
    
    // 查看状态
    const stats = await ipDispenser.getStats()
    console.log("\n预热后状态:")
    console.log("  - 池中 IP 数量:", stats.poolSize)
    console.log("  - 当前模式:", stats.mode)
    
    // 查看池中 IP
    const poolData = await client.lRange('proxy:pool:available', 0, -1)
    console.log("\n池中 IP 详情:")
    poolData.forEach((item, i) => {
      const ip = JSON.parse(item)
      console.log(`  ${i+1}. IP: ${ip.ip}, 代理: ${ip.proxyUrl}, 过期: ${new Date(ip.expireTime).toLocaleString()}`)
    })
  } catch (error) {
    console.error("错误:", error.message)
    console.error(error.stack)
  }
  
  process.exit(0)
}

warmup()
