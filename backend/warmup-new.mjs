import ipDispenser from './src/services/ai/ipDispenserService.js'

async function warmup() {
  await ipDispenser.init()
  
  const { getRedisClient } = await import('./src/utils/redis.js')
  const client = await getRedisClient()
  await client.del('proxy:pool:available')
  
  await ipDispenser.warmup(2)
  
  const poolData = await client.lRange('proxy:pool:available', 0, -1)
  console.log("\n新 IP 池:")
  poolData.forEach((item, i) => {
    const ip = JSON.parse(item)
    console.log(`  ${i+1}. 出口IP: ${ip.ip}, 代理: ${ip.proxyUrl}, 地区: ${ip.area}`)
  })
  
  process.exit(0)
}

warmup()
