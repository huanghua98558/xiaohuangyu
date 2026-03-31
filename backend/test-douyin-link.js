/**
 * 真实抖音视频链接审核测试
 * 
 * 测试视频：https://v.douyin.com/JPxit6nXhLw/
 * 达人：丁丁呀
 * 任务：武功山旅游推广（288 元含门票 + 住宿 + 骑马）
 */

import { verifyComment } from './src/services/ai/browserService.js'
import proxyPoolService from './src/services/ai/proxyPoolService.js'
import logger from './src/utils/logger.js'

async function testRealDouyinLink() {
  console.log('='.repeat(60))
  console.log('🔗 真实抖音视频链接审核测试')
  console.log('='.repeat(60))
  
  const videoUrl = 'https://v.douyin.com/JPxit6nXhLw/'
  const expectedComment = '朋友推荐的，真的可以的'
  const expectedAuthor = '丁丁呀'
  const userName = '135846594' // 评论人
  
  console.log('\n测试信息:')
  console.log('   - 视频链接:', videoUrl)
  console.log('   - 预期达人:', expectedAuthor)
  console.log('   - 预期评论:', expectedComment)
  console.log('   - 评论人:', userName)
  
  console.log('\n开始验证...')
  
  try {
    // 获取代理 IP（如果需要）
    const proxyIP = await proxyPoolService.getAvailableIP()
    
    if (proxyIP) {
      console.log('   - 使用代理 IP:', proxyIP.ip_address)
    }
    
    // 调用链接验证服务
    const result = await verifyComment(
      videoUrl,
      expectedComment,
      userName,
      { 
        proxy: proxyIP,
        taskAuthorName: expectedAuthor 
      }
    )
    
    console.log('\n验证结果:')
    console.log('   - 验证通过:', result.verified ? '✅ 是' : '❌ 否')
    console.log('   - 匹配类型:', result.matchType || '未匹配')
    console.log('   - 找到评论:', result.foundComment ? '✅ 是' : '❌ 否')
    console.log('   - 评论内容:', result.foundComment?.content || '未找到')
    console.log('   - 评论人:', result.foundComment?.owner || '未找到')
    console.log('   - 搜索评论数:', result.searchedComments || 0)
    
    if (result.error) {
      console.log('   - 错误信息:', result.error)
    }
    
    // 判定逻辑
    console.log('\n审核判定:')
    if (result.verified) {
      console.log('   ✅ 链接审核通过 - 可以发放积分')
    } else {
      console.log('   ❌ 链接审核失败 - 触发封控检测')
    }
    
    return result
    
  } catch (error) {
    console.log('\n❌ 验证失败:', error.message)
    console.log('   错误堆栈:', error.stack)
    
    return {
      verified: false,
      error: error.message
    }
  }
}

// 运行测试
testRealDouyinLink().catch(console.error)
