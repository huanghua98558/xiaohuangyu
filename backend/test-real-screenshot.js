/**
 * 实际截图审核测试脚本
 * 
 * 测试场景：基于用户提供的实际截图验证审核流程
 * 
 * 截图信息：
 * - 平台：抖音
 * - 达人：@丁丁呀
 * - 任务：武功山旅游推广
 * - 评论：朋友推荐的，真的可以的🙏🙏🙏
 * - 状态：已收藏，未点赞
 */

import supabase from './src/utils/supabase.js'
import { analyzeWithPaddleOCR } from './src/services/ai/paddleOcrClient.js'
import logger from './src/utils/logger.js'

async function testRealScreenshot() {
  console.log('='.repeat(60))
  console.log('📸 实际截图审核测试')
  console.log('='.repeat(60))
  
  // 模拟截图 URL（实际使用时替换为真实截图路径）
  const screenshotPath = '/var/www/xiaohuangyu/uploads/test-screenshot.jpg'
  
  console.log('\n1️⃣ 第一关：图片审核（OCR 识别）')
  console.log('-'.repeat(60))
  
  try {
    // 调用 OCR 服务
    const ocrResult = await analyzeWithPaddleOCR(screenshotPath, {
      action: 'short_video_research',
      taskAuthor: '丁丁呀',
      platform: '抖音'
    })
    
    console.log('OCR 识别结果:')
    console.log('   - 点赞状态:', ocrResult.likePassed ? '✓ 已点赞' : '✗ 未点赞')
    console.log('   - 收藏状态:', ocrResult.favoritePassed ? '✓ 已收藏' : '✗ 未收藏')
    console.log('   - 评论状态:', ocrResult.commentPassed ? '✓ 有评论' : '✗ 无评论')
    console.log('   - 达人匹配:', ocrResult.authorMatch?.matched ? '✓ 匹配' : '✗ 不匹配')
    console.log('   - 评论内容:', ocrResult.comment?.content || '未识别')
    console.log('   - 置信度:', (ocrResult.confidence * 100).toFixed(1) + '%')
    
    // 判定逻辑
    const checks = {
      like: ocrResult.likePassed,
      collect: ocrResult.favoritePassed,
      comment: ocrResult.commentPassed,
      authorMatch: ocrResult.authorMatch?.matched,
      commentLength: (ocrResult.comment?.length || 0) >= 8,
      commentOwner: ocrResult.comment?.isOwner,
      commentPositive: ocrResult.comment?.isPositive
    }
    
    console.log('\n审核判定:')
    console.log('   - 点赞检测:', checks.like ? '✓' : '✗')
    console.log('   - 收藏检测:', checks.collect ? '✓' : '✗')
    console.log('   - 评论检测:', checks.comment ? '✓' : '✗')
    console.log('   - 达人匹配:', checks.authorMatch ? '✓' : '✗')
    console.log('   - 评论字数:', checks.commentLength ? '✓' : '✗')
    console.log('   - 本人评论:', checks.commentOwner ? '✓' : '✗')
    console.log('   - 评论正向:', checks.commentPositive ? '✓' : '✗')
    
    // 综合判定
    const allPassed = Object.values(checks).every(v => v === true)
    const criticalPassed = checks.collect && checks.comment && checks.commentLength && checks.commentPositive
    
    console.log('\n综合判定:')
    if (allPassed) {
      console.log('   ✅ 全部通过 - 进入链接审核')
    } else if (criticalPassed) {
      console.log('   ⚠️  部分通过（收藏 + 评论合格，点赞失败）- 需人工判断')
    } else {
      console.log('   ❌ 未通过 - 拒绝或进入 AI 复审')
    }
    
  } catch (error) {
    console.log('   ❌ OCR 识别失败:', error.message)
    console.log('   → 进入 AI 复审流程')
  }
  
  console.log('\n2️⃣ 第二关：链接审核（如果图片审核通过）')
  console.log('-'.repeat(60))
  
  // 模拟链接审核
  const testData = {
    videoUrl: 'https://www.douyin.com/video/xxx',
    expectedComment: '朋友推荐的，真的可以的',
    expectedAuthor: '丁丁呀',
    actualComment: '朋友推荐的，真的可以的🙏🙏🙏',
    actualAuthor: '丁丁呀'
  }
  
  console.log('链接验证:')
  console.log('   - 视频 URL:', testData.videoUrl)
  console.log('   - 预期达人:', testData.expectedAuthor)
  console.log('   - 实际达人:', testData.actualAuthor)
  console.log('   - 达人匹配:', testData.expectedAuthor === testData.actualAuthor ? '✓' : '✗')
  console.log('   - 预期评论:', testData.expectedComment)
  console.log('   - 实际评论:', testData.actualComment)
  console.log('   - 评论匹配:', testData.actualComment.includes(testData.expectedComment) ? '✓' : '✗')
  
  console.log('\n3️⃣ 完整流程状态流转')
  console.log('-'.repeat(60))
  
  const statusFlow = [
    { step: 1, status: 'submitted', desc: '用户提交截图' },
    { step: 2, status: 'image_reviewing', desc: '进入图片审核' },
    { step: 3, status: 'image_reviewing → link_reviewing', desc: '图片审核通过，进入链接审核' },
    { step: 4, status: 'link_reviewing', desc: '延迟 15 分钟后审查链接' },
    { step: 5, status: 'link_reviewing → done', desc: '链接审核通过，发放积分' }
  ]
  
  statusFlow.forEach(item => {
    console.log(`   ${item.step}. ${item.status.padEnd(35)} - ${item.desc}`)
  })
  
  console.log('\n' + '='.repeat(60))
  console.log('测试完成！')
  console.log('='.repeat(60))
}

// 运行测试
testRealScreenshot().catch(console.error)
