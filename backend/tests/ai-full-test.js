/**
 * AI系统完整功能测试
 * 测试链接标题提取和任务发布功能
 */

import 'dotenv/config'
import crypto from 'crypto'
import * as configService from '../src/services/ai/configService.js'
import { detectLink, extractTaskTitle, extractTaskParams, parseTaskUrl } from '../src/services/ai/publisherAssistantService.js'
import supabase from '../src/utils/supabase.js'

// 测试用例
const TEST_CASES = [
  // 小红书链接测试
  {
    name: '小红书链接 - 提取视频标题',
    input: '男性私域，我成功了，每天爆单！ http://xhslink.com/o/4VURBXxQmil 复制后打开【小红书】查看笔记！',
    expected: {
      platform: '小红书',
      title: '男性私域，我成功了，每天爆单！'
    }
  },
  // 快手链接测试
  {
    name: '快手链接 - 提取视频标题',
    input: 'https://v.kuaishou.com/nsdq2LE3 21岁小伙狂赚86亿，专门买4栋别墅放钱 "财富 "认知 "贪婪 该作品在快手被播放过91.2万次，点击链接，打开【快手】直接观看！',
    expected: {
      platform: '快手',
      title: '21岁小伙狂赚86亿，专门买4栋别墅放钱'
    }
  },
  // 抖音链接测试 - 作者名优先
  {
    name: '抖音链接 - 提取作者名',
    input: '89 复制打开抖音，看看【Kim 根鸠的作品】当AI继承了人类的"面子工程" 当成了机器人也要被... https://v.douyin.com/rbxd_kAbZKk/',
    expected: {
      platform: '抖音',
      title: 'Kim 根鸠' // 作者名 + 日期
    }
  },
  // 抖音链接测试 - 完整分享文本
  {
    name: '抖音链接 - 完整分享文本',
    input: '5.23 CkL:/ 听泉猫猫很可爱# 抖音小助手 #猫咪 https://v.douyin.com/abc123/ 复制此链接，打开抖音搜索，直接观看视频！',
    expected: {
      platform: '抖音',
      titleContains: '月' // 标题包含日期
    }
  }
]

// 测试结果统计
let passed = 0
let failed = 0

console.log('═'.repeat(60))
console.log('  AI系统完整功能测试 - 链接标题提取')
console.log('═'.repeat(60))

// 测试链接检测和标题提取
console.log('\n📋 测试套件1: 链接标题提取')
console.log('='.repeat(50))

for (const testCase of TEST_CASES) {
  console.log(`\n🧪 ${testCase.name}`)
  console.log('─'.repeat(50))
  
  try {
    // 检测链接
    const linkInfo = detectLink(testCase.input)
    
    if (!linkInfo) {
      console.log('❌ 失败: 未检测到链接')
      failed++
      continue
    }
    
    // 提取标题
    const title = extractTaskTitle(testCase.input, linkInfo)
    const platform = linkInfo.type === 'douyin' ? '抖音' : 
                     linkInfo.type === 'kuaishou' ? '快手' :
                     linkInfo.type === 'xiaohongshu' ? '小红书' : linkInfo.type
    
    console.log(`  平台: ${platform}`)
    console.log(`  提取标题: ${title}`)
    
    // 验证结果
    if (testCase.expected.platform && platform !== testCase.expected.platform) {
      console.log(`❌ 失败: 平台不匹配，期望 ${testCase.expected.platform}`)
      failed++
      continue
    }
    
    if (testCase.expected.title) {
      if (title.includes(testCase.expected.title)) {
        console.log(`  ✅ 标题验证通过`)
        passed++
      } else {
        console.log(`❌ 失败: 标题不匹配，期望包含 "${testCase.expected.title}"`)
        failed++
      }
    } else if (testCase.expected.titleContains) {
      if (title.includes(testCase.expected.titleContains)) {
        console.log(`  ✅ 标题验证通过`)
        passed++
      } else {
        console.log(`❌ 失败: 标题不包含 "${testCase.expected.titleContains}"`)
        failed++
      }
    } else {
      passed++
    }
    
  } catch (error) {
    console.log(`❌ 失败: ${error.message}`)
    failed++
  }
}

// 测试数据库表
console.log('\n📋 测试套件2: 数据库表可用性')
console.log('='.repeat(50))

const tables = ['ai_conversations', 'ai_messages', 'ai_operation_logs', 'ai_review_queue']

for (const table of tables) {
  try {
    const { error } = await supabase.from(table).select('id').limit(1)
    if (error) {
      console.log(`  ❌ ${table}: ${error.message}`)
    } else {
      console.log(`  ✅ ${table}: 可用`)
    }
  } catch (e) {
    console.log(`  ❌ ${table}: ${e.message}`)
  }
}

// 测试配置服务
console.log('\n📋 测试套件3: 配置服务')
console.log('='.repeat(50))

try {
  const pubConfig = await configService.getPublisherConfig()
  console.log(`  ✅ 发布助手配置获取成功`)
  console.log(`    - 模型: ${pubConfig.model}`)
  console.log(`    - 默认积分: ${pubConfig.defaultReward}`)
  console.log(`    - 默认名额: ${pubConfig.defaultRemain}`)
  passed++
} catch (error) {
  console.log(`  ❌ 配置获取失败: ${error.message}`)
  failed++
}

try {
  const reviewConfig = await configService.getReviewerConfig()
  console.log(`  ✅ 审核助手配置获取成功`)
  console.log(`    - 模型: ${reviewConfig.model}`)
  console.log(`    - 通过阈值: ${reviewConfig.approveThreshold}`)
  passed++
} catch (error) {
  console.log(`  ❌ 配置获取失败: ${error.message}`)
  failed++
}

// 输出结果
console.log('\n' + '═'.repeat(60))
console.log('  测试结果汇总')
console.log('═'.repeat(60))
console.log(`  总计: ${passed + failed} 个测试`)
console.log(`  ✅ 通过: ${passed}`)
console.log(`  ❌ 失败: ${failed}`)
console.log(`  成功率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`)
console.log('═'.repeat(60))

process.exit(failed > 0 ? 1 : 0)
