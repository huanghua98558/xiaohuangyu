import ipDispenser from './src/services/ai/ipDispenserService.js'

async function test() {
  console.log("=== 测试 IP 服务 ===")
  
  try {
    // 1. 初始化
    console.log("1. 初始化服务...")
    await ipDispenser.init()
    console.log("初始化完成")
    
    // 2. 获取当前模式
    console.log("\n2. 获取当前模式...")
    const mode = await ipDispenser.getCurrentMode()
    console.log("当前模式:", mode)
    
    // 3. 获取统计
    console.log("\n3. 获取统计信息...")
    const stats = await ipDispenser.getStats()
    console.log("统计信息:", stats)
    
    // 4. 尝试获取 IP
    console.log("\n4. 尝试获取代理 IP...")
    const ipInfo = await ipDispenser.acquireIP()
    console.log("获取结果:", ipInfo)
    
  } catch (error) {
    console.error("错误:", error.message)
    console.error(error.stack)
  }
  
  process.exit(0)
}

test()
