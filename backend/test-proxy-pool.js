#!/usr/bin/env node

/**
 * 代理 IP 池快速测试
 */

import proxyPoolService from './src/services/ai/proxyPoolService.js'

async function testProxyPool() {
  console.log('='.repeat(60))
  console.log('🌐 代理 IP 池测试')
  console.log('='.repeat(60))
  
  try {
    // 1. 检查配置
    console.log('\n1️⃣ 检查配置...')
    console.log('   代理启用状态:', process.env.PROXY_ENABLED === 'true' ? '✅ 已启用' : '❌ 未启用')
    console.log('   API URL:', process.env.PROXY_API_URL || '❌ 未配置')
    console.log('   池最小大小:', process.env.PROXY_POOL_MIN_SIZE || '500')
    
    // 2. 获取可用 IP
    console.log('\n2️⃣ 获取可用 IP...')
    const ip = await proxyPoolService.getAvailableIP()
    
    if (ip) {
      console.log('   ✅ 获取到 IP:', ip.ip_address)
      console.log('   端口:', ip.port)
      console.log('   已使用次数:', ip.uses || 0)
      console.log('   成功率:', ip.successRate ? (ip.successRate * 100).toFixed(1) + '%' : 'N/A')
    } else {
      console.log('   ⚠️  暂无可用 IP')
      console.log('   → 尝试从 API 获取...')
      
      // 3. 手动获取 IP
      console.log('\n3️⃣ 从 API 获取 IP...')
      const newIPs = await proxyPoolService.fetchIPsFromAPI(10)
      console.log('   获取到 IP 数量:', newIPs.length)
      
      if (newIPs.length > 0) {
        console.log('   前 3 个 IP:')
        newIPs.slice(0, 3).forEach(ip => {
          console.log(`   - ${ip.ip}:${ip.port}`)
        })
      }
    }
    
    // 4. 测试 IP 可用性
    if (ip) {
      console.log('\n4️⃣ 测试 IP 可用性...')
      const result = await proxyPoolService.testIP(ip.ip_address, ip.port)
      console.log('   测试结果:', result.available ? '✅ 可用' : '❌ 不可用')
      console.log('   响应时间:', result.responseTime + 'ms')
      console.log('   位置:', result.location || '未知')
    }
    
    // 5. 统计信息
    console.log('\n5️⃣ IP 池统计...')
    const stats = await proxyPoolService.getPoolStats()
    console.log('   总 IP 数:', stats.total || 0)
    console.log('   可用 IP:', stats.available || 0)
    console.log('   已使用 IP:', stats.inUse || 0)
    console.log('   失败 IP:', stats.failed || 0)
    console.log('   平均成功率:', stats.avgSuccessRate ? (stats.avgSuccessRate * 100).toFixed(1) + '%' : 'N/A')
    
    console.log('\n' + '='.repeat(60))
    console.log('测试完成！')
    console.log('='.repeat(60))
    
  } catch (error) {
    console.log('\n❌ 测试失败:', error.message)
    console.log('错误堆栈:', error.stack)
  }
}

testProxyPool().catch(console.error)
