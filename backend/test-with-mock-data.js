#!/usr/bin/env node

/**
 * 使用模拟数据进行完整审核测试
 * 
 * 不需要真实截图，直接测试整个流程
 */

import supabase from './src/utils/supabase.js'
import { reviewScreenshots } from './src/services/ai/visionReviewService.js'
import { verifyComment } from './src/services/ai/browserService.js'
import proxyPoolService from './src/services/ai/proxyPoolService.js'
import logger from './src/utils/logger.js'

async function testWithMockData() {
  console.log('='.repeat(70))
  console.log('🎯 审核系统完整功能测试（模拟数据模式）')
  console.log('='.repeat(70))
  
  console.log('\n📋 测试场景:')
  console.log('   平台：抖音')
  console.log('   达人：丁丁呀')
  console.log('   视频：武功山旅游推广')
  console.log('   链接：https://v.douyin.com/JPxit6nXhLw/')
  console.log('   评论：朋友推荐的，真的可以的🙏🙏')
  console.log('   状态：已收藏，未点赞')
  
  const results = {
    imageReview: null,
    linkReview: null,
    finalDecision: null
  }
  
  // ==================== 第一关：图片审查 ====================
  console.log('\n' + '='.repeat(70))
  console.log('📸 第一关：图片审查（模拟结果）')
  console.log('='.repeat(70))
  
  console.log('\n✅ 模拟 OCR 识别结果:')
  console.log('   - 识别成功：是')
  console.log('   - 审核通过：是')
  console.log('   - 置信度：85.3%')
  console.log('   - 识别引擎：paddleocr')
  
  console.log('\n   达人匹配:')
  console.log('   - 匹配状态：✅ 匹配')
  console.log('   - 任务达人：丁丁呀')
  console.log('   - 截图达人：丁丁呀')
  
  console.log('\n   评论内容:')
  console.log('   - 内容：朋友推荐的，真的可以的🙏🙏')
  console.log('   - 长度：13 字 ✅')
  console.log('   - 本人评论：✅ 是')
  console.log('   - 正向评论：✅ 是')
  
  console.log('\n   详细检测:')
  console.log('   - 点赞状态：⚠️  未点赞')
  console.log('   - 收藏状态：✅ 已收藏')
  console.log('   - 评论状态：✅ 有评论')
  
  console.log('\n📋 图片审核判定:')
  console.log('   ✅ 图片审核通过 - 进入链接审核')
  console.log('   → 状态流转：image_reviewing → link_reviewing')
  
  results.imageReview = {
    passed: true,
    confidence: 0.853,
    authorMatch: true,
    commentFound: true,
    commentLength: 13,
    likePassed: false,
    collectPassed: true
  }
  
  // ==================== 第二关：链接审查 ====================
  console.log('\n' + '='.repeat(70))
  console.log('🔗 第二关：链接审查（真实测试）')
  console.log('='.repeat(70))
  
  const videoUrl = 'https://v.douyin.com/JPxit6nXhLw/'
  const expectedComment = '朋友推荐的，真的可以的'
  const userName = '135846594'
  const taskAuthor = '丁丁呀'
  
  console.log('\n测试配置:')
  console.log('   视频链接:', videoUrl)
  console.log('   预期评论:', expectedComment)
  console.log('   评论人:', userName)
  console.log('   达人:', taskAuthor)
  
  console.log('\n开始验证...')
  
  try {
    // 获取代理 IP
    const proxyIP = await proxyPoolService.getAvailableIP()
    
    if (proxyIP) {
      console.log('   使用代理 IP:', proxyIP.ip_address)
    } else {
      console.log('   ⚠️  无可用代理 IP，使用直连')
    }
    
    // 调用链接验证服务
    const linkResult = await verifyComment(
      videoUrl,
      expectedComment,
      userName,
      { 
        proxy: proxyIP,
        taskAuthorName: taskAuthor 
      }
    )
    
    results.linkReview = linkResult
    
    console.log('\n✅ 链接验证结果:')
    console.log('   - 验证通过:', linkResult.verified ? '✅ 是' : '❌ 否')
    console.log('   - 匹配类型:', linkResult.matchType || '未匹配')
    console.log('   - 找到评论:', linkResult.foundComment ? '✅ 是' : '❌ 否')
    
    if (linkResult.foundComment) {
      console.log('\n   评论详情:')
      console.log('   - 内容:', linkResult.foundComment.content)
      console.log('   - 评论人:', linkResult.foundComment.owner)
      console.log('   - 点赞数:', linkResult.foundComment.likes || 0)
    }
    
    console.log('   - 搜索评论数:', linkResult.searchedComments || 0)
    
    if (linkResult.error) {
      console.log('   - 错误信息:', linkResult.error)
    }
    
    // 判定逻辑
    console.log('\n📋 链接审核判定:')
    if (linkResult.verified) {
      console.log('   ✅ 链接审核通过 - 发放积分')
      console.log('   → 状态流转：link_reviewing → done')
      console.log('   → 触发通知：用户任务通过通知')
    } else {
      console.log('   ❌ 链接审核失败 - 触发封控检测')
      console.log('   → 状态流转：link_reviewing → pending_manual')
      console.log('   → 触发通知：管理员通知 + 用户账号异常通知')
    }
    
  } catch (error) {
    console.log('\n❌ 链接验证异常:', error.message)
    console.log('   错误堆栈:', error.stack)
    
    results.linkReview = {
      verified: false,
      error: error.message
    }
  }
  
  // ==================== 最终判定 ====================
  console.log('\n' + '='.repeat(70))
  console.log('🏆 最终审核判定')
  console.log('='.repeat(70))
  
  const imagePassed = results.imageReview?.passed || false
  const linkPassed = results.linkReview?.verified || false
  
  console.log('\n综合结果:')
  console.log('   - 图片审核:', imagePassed ? '✅ 通过' : '❌ 未通过')
  console.log('   - 链接审核:', linkPassed ? '✅ 通过' : '❌ 未通过')
  
  console.log('\n最终决策:')
  if (imagePassed && linkPassed) {
    console.log('   ✅✅ 审核通过 - 发放积分')
    console.log('   状态：done')
    console.log('   通知：发送任务通过通知给用户')
    results.finalDecision = 'approved'
  } else if (imagePassed && !linkPassed) {
    console.log('   ✅❌ 图片通过但链接失败 - 封控检测')
    console.log('   状态：pending_manual')
    console.log('   通知：发送管理员通知 + 用户账号异常通知')
    results.finalDecision = 'manual_review'
  } else if (!imagePassed) {
    console.log('   ❌ 图片审核失败 - 允许重新提交')
    console.log('   状态：doing')
    console.log('   通知：发送审核失败通知（可重试）')
    results.finalDecision = 'rejected'
  }
  
  console.log('\n' + '='.repeat(70))
  console.log('测试完成！')
  console.log('='.repeat(70))
  
  console.log('\n📊 测试结果摘要:')
  console.log(JSON.stringify(results, null, 2))
  
  return results
}

// 运行测试
testWithMockData()
  .then(results => {
    console.log('\n✅ 测试完成')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  })
