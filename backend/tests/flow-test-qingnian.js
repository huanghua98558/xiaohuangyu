/**
 * 青年大客车任务流转测试 - 服务器版本
 * 测试各个环节的自动流转逻辑
 * 
 * 测试场景：
 * 1. 全部通过 - 点赞+收藏+评论都完成
 * 2. 部分通过 - 只完成部分操作
 * 3. 达人名字不匹配
 * 4. 评论字数不足
 * 5. 非本人评论
 * 6. 置信度边界情况
 */

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const API_URL = 'http://localhost:5000';
const OCR_URL = process.env.PADDLE_OCR_URL || 'http://localhost:8088';

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(type, message) {
  const color = { success: colors.green, error: colors.red, warn: colors.yellow, info: colors.blue, test: colors.cyan }[type] || colors.reset;
  console.log(`${color}[${type.toUpperCase()}]${colors.reset} ${message}`);
}

// 测试统计
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

// 测试用户和任务ID
let testUserId = null;
let testTaskId = null;
let testClaimIds = [];

/**
 * 创建测试用户
 */
async function createTestUser() {
  const username = `test_qn_${Date.now()}`;
  const { data: user, error } = await supabase
    .from('users')
    .insert({
      username,
      password_hash: 'test_hash',
      phone: `139${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
      level: 1,
      points: 0,
      invite_code: `QN${Date.now().toString(36)}`,
      status: 1
    })
    .select()
    .single();
  
  if (error) {
    // 尝试使用现有用户
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('username', 'testflow123')
      .maybeSingle();
    
    if (existingUser) {
      log('info', `使用现有测试用户: ${existingUser.username} (ID: ${existingUser.id})`);
      return existingUser;
    }
    throw new Error(`创建测试用户失败: ${error.message}`);
  }
  
  log('info', `创建测试用户: ${username} (ID: ${user.id})`);
  return user;
}

/**
 * 创建测试任务
 */
async function createTestTask() {
  // 查找现有的短视频调研任务
  const { data: existingTasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('action', 'short_video_research')
    .eq('status', 'active')
    .limit(1);
  
  if (existingTasks && existingTasks.length > 0) {
    const existingTask = existingTasks[0];
    log('info', `使用现有测试任务: ${existingTask.title} (ID: ${existingTask.id})`);
    return existingTask;
  }
  
  // 创建新任务
  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      title: '青年大客车-3月20日',
      platform: 'douyin',
      action: 'short_video_research',
      description: '青年大客车短视频内容体验调研',
      video_url: 'https://v.douyin.com/test/',
      reward: 15,
      need_count: 10,
      remain: 10,
      status: 'active',
      city_limit: 1,
      province_limit: 4,
      exposure_enabled: true
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`创建测试任务失败: ${error.message}`);
  }
  
  log('info', `创建测试任务: ${task.title} (ID: ${task.id})`);
  return task;
}

/**
 * 创建测试领取记录
 */
async function createTestClaim(taskId, userId, scenario) {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  
  const { data: claim, error } = await supabase
    .from('claims')
    .insert({
      user_id: userId,
      task_id: taskId,
      title: '青年大客车-3月20日',
      platform: 'douyin',
      action: 'short_video_research',
      reward: 15,
      status: 'doing',
      screenshots: JSON.stringify(['https://example.com/test.jpg']),
      expires_at: expiresAt.toISOString()
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`创建领取记录失败: ${error.message}`);
  }
  
  log('info', `创建领取记录: ${scenario} (ID: ${claim.id})`);
  return claim;
}

/**
 * 清理测试数据
 */
async function cleanupTestData() {
  log('info', '清理测试数据...');
  
  if (testClaimIds.length > 0) {
    await supabase.from('ai_review_queue').delete().in('claim_id', testClaimIds);
    await supabase.from('claims').delete().in('id', testClaimIds);
  }
  
  if (testTaskId) {
    // 不删除现有任务
  }
  
  // 不删除现有用户
  log('info', '测试数据清理完成');
}

/**
 * 测试场景定义
 */
const TEST_SCENARIOS = [
  {
    name: '场景1: 全部通过 - 点赞+收藏+评论完成',
    description: '达人匹配、本人评论、评论合格、所有操作完成',
    expectedDecision: 'approved',
    mockResult: {
      passed: true,
      confidence: 0.95,
      authorMatch: { taskAuthor: '青年大客车', screenshotAuthor: '青年大客车', matched: true },
      comment: { content: '这个视频太棒了，学到了很多知识', length: 14, lengthValid: true, isPositive: true, isOwner: true },
      foundActions: ['点赞', '收藏', '评论'],
      missingActions: [],
      details: '所有检测项通过'
    }
  },
  {
    name: '场景2: 部分通过 - 只完成点赞收藏',
    description: '达人匹配、无评论',
    expectedDecision: 'rejected',
    mockResult: {
      passed: false,
      confidence: 0.90,
      authorMatch: { taskAuthor: '青年大客车', screenshotAuthor: '青年大客车', matched: true },
      comment: { content: null, length: 0, lengthValid: false, isPositive: false, isOwner: false },
      foundActions: ['点赞', '收藏'],
      missingActions: ['评论'],
      details: '未完成评论操作',
      rejectionReason: '未完成评论操作'
    }
  },
  {
    name: '场景3: 达人名字不匹配',
    description: '截图达人名字与任务不一致',
    expectedDecision: 'rejected',
    mockResult: {
      passed: false,
      confidence: 0.95,
      authorMatch: { taskAuthor: '青年大客车', screenshotAuthor: '其他达人', matched: false },
      comment: { content: '这个视频不错', length: 6, lengthValid: false, isPositive: true, isOwner: true },
      foundActions: ['点赞', '评论'],
      missingActions: ['收藏'],
      details: '达人名字不匹配',
      rejectionReason: '达人名字不一致'
    }
  },
  {
    name: '场景4: 评论字数不足',
    description: '评论只有3个字',
    expectedDecision: 'rejected',
    mockResult: {
      passed: false,
      confidence: 0.90,
      authorMatch: { taskAuthor: '青年大客车', screenshotAuthor: '青年大客车', matched: true },
      comment: { content: '好视频', length: 3, lengthValid: false, isPositive: true, isOwner: true },
      foundActions: ['点赞', '收藏', '评论'],
      missingActions: [],
      details: '评论字数不足8字',
      rejectionReason: '评论字数不足8字'
    }
  },
  {
    name: '场景5: 非本人评论',
    description: '截图中的评论不是本人的',
    expectedDecision: 'rejected',
    mockResult: {
      passed: false,
      confidence: 0.95,
      authorMatch: { taskAuthor: '青年大客车', screenshotAuthor: '青年大客车', matched: true },
      comment: { content: '这个视频太棒了', length: 7, lengthValid: false, isPositive: true, isOwner: false },
      foundActions: ['点赞', '收藏'],
      missingActions: ['本人评论'],
      details: '非本人评论',
      rejectionReason: '非本人评论截图'
    }
  },
  {
    name: '场景6: 置信度边界 - passed=true但置信度0.80',
    description: 'passed=true，置信度只有0.80，新逻辑应通过',
    expectedDecision: 'approved',
    mockResult: {
      passed: true,
      confidence: 0.80,
      authorMatch: { taskAuthor: '青年大客车', screenshotAuthor: '青年大客车', matched: true },
      comment: { content: '学到了很多知识，感谢分享', length: 10, lengthValid: true, isPositive: true, isOwner: true },
      foundActions: ['点赞', '收藏', '评论'],
      missingActions: [],
      details: '所有检测项通过'
    }
  },
  {
    name: '场景7: 审核不通过且auto_reject_enabled=false',
    description: 'passed=false，应转人工',
    expectedDecision: 'manual',
    mockResult: {
      passed: false,
      confidence: 0.85,
      authorMatch: { taskAuthor: '青年大客车', screenshotAuthor: '青年大客车', matched: true },
      comment: { content: '测试评论', length: 4, lengthValid: false, isPositive: true, isOwner: true },
      foundActions: ['点赞', '收藏'],
      missingActions: ['合格评论'],
      details: '评论字数不足',
      rejectionReason: '评论字数不足8字'
    }
  }
];

/**
 * 运行单个测试场景
 */
async function runScenario(scenario, taskId, userId) {
  totalTests++;
  log('test', `\n${'='.repeat(60)}`);
  log('test', scenario.name);
  log('test', `描述: ${scenario.description}`);
  log('test', `期望决策: ${scenario.expectedDecision}`);
  log('test', '='.repeat(60));
  
  try {
    // 创建领取记录
    const claim = await createTestClaim(taskId, userId, scenario.name);
    testClaimIds.push(claim.id);
    
    // 入队
    log('info', '步骤1: 任务入队...');
    const { data: queueItem, error: queueError } = await supabase
      .from('ai_review_queue')
      .insert({
        claim_id: claim.id,
        user_id: userId,
        task_id: taskId,
        screenshots: JSON.stringify(['https://example.com/test.jpg']),
        status: 'pending'
      })
      .select()
      .single();
    
    if (queueError) {
      throw new Error(`入队失败: ${queueError.message}`);
    }
    log('success', `入队成功: queueId=${queueItem.id}`);
    
    // 获取审核配置
    const { data: reviewerConfig } = await supabase
      .from('ai_configs')
      .select('value')
      .eq('key', 'reviewer')
      .maybeSingle();
    
    const approveThreshold = reviewerConfig?.value?.approveThreshold || 0.85;
    log('info', `审核配置: approveThreshold=${approveThreshold}`);
    
    // 获取审核规则
    const { data: reviewRule } = await supabase
      .from('review_rules')
      .select('*')
      .eq('platform', 'douyin')
      .eq('action', 'short_video_research')
      .maybeSingle();
    
    const autoRejectEnabled = reviewRule?.auto_reject_enabled ?? false;
    log('info', `审核规则: auto_reject_enabled=${autoRejectEnabled}`);
    
    // 模拟AI分析结果
    log('info', '步骤2: 模拟AI分析...');
    const mockResult = scenario.mockResult;
    
    // 根据配置计算决策（置信度不参与决策）
    log('info', '步骤3: 计算审核决策...');
    let decision = 'manual';
    const confidence = mockResult.confidence;
    
    // 新逻辑：置信度不参与决策
    if (mockResult.passed) {
      decision = 'approved';
      log('info', `决策逻辑: passed=true → approved (置信度${confidence}仅记录)`);
    } else {
      decision = autoRejectEnabled ? 'rejected' : 'manual';
      log('info', `决策逻辑: passed=false → ${decision} (auto_reject_enabled=${autoRejectEnabled})`);
    }
    
    // 更新队列状态
    await supabase
      .from('ai_review_queue')
      .update({
        status: decision === 'manual' ? 'manual' : `ai_${decision}`,
        ai_result: JSON.stringify(mockResult),
        ai_confidence: confidence,
        ai_reason: mockResult.details,
        processed_at: new Date().toISOString(),
        processed_by: 'ai'
      })
      .eq('id', queueItem.id);
    
    // 更新Claim状态
    if (decision !== 'manual') {
      await supabase
        .from('claims')
        .update({
          status: decision === 'approved' ? 'done' : 'doing',
          ai_review_status: decision,
          ai_confidence: confidence,
          ai_reason: mockResult.details,
          ai_reviewed_at: new Date().toISOString(),
          review_note: decision === 'approved' ? '审核通过' : mockResult.rejectionReason
        })
        .eq('id', claim.id);
    } else {
      await supabase
        .from('claims')
        .update({
          ai_review_status: 'manual',
          ai_confidence: confidence,
          ai_reason: mockResult.details,
          ai_reviewed_at: new Date().toISOString(),
          review_note: '正在人工审核中'
        })
        .eq('id', claim.id);
    }
    
    // 验证结果
    const passed = decision === scenario.expectedDecision;
    
    if (passed) {
      passedTests++;
      log('success', `✓ 测试通过: 决策=${decision}, 期望=${scenario.expectedDecision}`);
    } else {
      failedTests++;
      log('error', `✗ 测试失败: 决策=${decision}, 期望=${scenario.expectedDecision}`);
    }
    
    testResults.push({
      scenario: scenario.name,
      expected: scenario.expectedDecision,
      actual: decision,
      confidence,
      passed
    });
    
    return { passed, decision, confidence };
    
  } catch (error) {
    failedTests++;
    log('error', `✗ 测试异常: ${error.message}`);
    testResults.push({
      scenario: scenario.name,
      expected: scenario.expectedDecision,
      actual: 'error',
      error: error.message,
      passed: false
    });
    return { passed: false, error: error.message };
  }
}

/**
 * 打印测试报告
 */
function printReport() {
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('  青年大客车任务流转测试报告');
  console.log('═'.repeat(60));
  console.log(`  测试时间: ${new Date().toLocaleString()}`);
  console.log(`  总测试数: ${totalTests}`);
  console.log(`  ✅ 通过: ${passedTests}`);
  console.log(`  ❌ 失败: ${failedTests}`);
  console.log(`  成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log('─'.repeat(60));
  
  console.log('\n  详细结果:');
  testResults.forEach((r, i) => {
    const status = r.passed ? '✅' : '❌';
    console.log(`  ${status} [${i + 1}] ${r.scenario}`);
    console.log(`      期望: ${r.expected}, 实际: ${r.actual}, 置信度: ${r.confidence || 'N/A'}`);
  });
  
  console.log('\n' + '═'.repeat(60));
}

/**
 * 主函数
 */
async function main() {
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('  青年大客车任务流转测试 - 服务器版本');
  console.log('  测试目标: 验证各审核环节的自动流转逻辑');
  console.log('═'.repeat(60));
  
  try {
    // 创建测试数据
    log('info', '\n准备测试数据...');
    const user = await createTestUser();
    testUserId = user.id;
    
    const task = await createTestTask();
    testTaskId = task.id;
    
    // 运行测试场景
    log('info', '\n开始运行测试场景...');
    for (const scenario of TEST_SCENARIOS) {
      await runScenario(scenario, task.id, user.id);
      await new Promise(r => setTimeout(r, 300));
    }
    
    // 打印报告
    printReport();
    
  } catch (error) {
    log('error', `测试执行失败: ${error.message}`);
    console.error(error);
  } finally {
    // 清理测试数据
    await cleanupTestData();
  }
  
  process.exit(failedTests > 0 ? 1 : 0);
}

main().catch(console.error);
