/**
 * 审核5.0 夜间高频测试脚本
 * 模拟各种审核场景，持续监控流转规则
 */

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const PADDLE_OCR_URL = process.env.PADDLE_OCR_URL || 'http://localhost:8088';

// 日志文件
const LOG_FILE = '/tmp/audit_overnight.log';
const RESULT_FILE = '/tmp/audit_overnight_results.json';

// 统计数据
const stats = {
  startTime: new Date().toISOString(),
  loops: 0,
  totalTests: 0,
  totalPassed: 0,
  totalFailed: 0,
  errors: [],
  flowIssues: [],
  performanceMetrics: {
    ocrAvgTime: [],
    bailianAvgTime: [],
    dbQueryTime: []
  }
};

function log(msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// ========== 流程测试 ==========

async function testOCRFlow() {
  const startTime = Date.now();
  try {
    const res = await axios.get(`${PADDLE_OCR_URL}/health`, { timeout: 5000 });
    const duration = Date.now() - startTime;
    stats.performanceMetrics.ocrAvgTime.push(duration);
    return { success: true, duration };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function testBailianFlow() {
  const startTime = Date.now();
  try {
    const res = await axios.post(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
      { model: 'qwen-vl-plus', input: { messages: [{ role: 'user', content: [{ text: '测试响应' }] }] } },
      { headers: { 'Authorization': `Bearer ${process.env.BAILIAN_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 30000 }
    );
    const duration = Date.now() - startTime;
    stats.performanceMetrics.bailianAvgTime.push(duration);
    return { success: !!res.data.output, duration };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function testQueueFlow() {
  const startTime = Date.now();
  try {
    // 检查AI审核队列
    const { data: aiQueue, error: aiError } = await supabase
      .from('ai_review_queue')
      .select('id, status, created_at')
      .in('status', ['pending', 'image_reviewing'])
      .limit(20);
    
    // 检查链接审核队列
    const { data: linkQueue, error: linkError } = await supabase
      .from('link_verification_queue')
      .select('id, status, scheduled_at')
      .in('status', ['pending', 'ready'])
      .limit(20);
    
    const duration = Date.now() - startTime;
    stats.performanceMetrics.dbQueryTime.push(duration);
    
    // 检查卡住的任务
    const now = new Date();
    const stuckTasks = [];
    
    if (aiQueue) {
      for (const task of aiQueue) {
        const created = new Date(task.created_at);
        const minutes = (now - created) / 60000;
        if (minutes > 30) {
          stuckTasks.push({ type: 'ai_review', id: task.id, minutes: Math.round(minutes) });
        }
      }
    }
    
    return { 
      success: true, 
      duration,
      aiQueueCount: aiQueue?.length || 0,
      linkQueueCount: linkQueue?.length || 0,
      stuckTasks
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function testClaimsFlow() {
  try {
    // 检查各状态数量
    const statuses = ['submitted', 'image_reviewing', 'link_reviewing', 'approved', 'rejected', 'expired'];
    const counts = {};
    
    for (const status of statuses) {
      const { count } = await supabase.from('claims').select('*', { count: 'exact', head: true }).eq('status', status);
      counts[status] = count || 0;
    }
    
    // 检查ai_review_status分布
    const aiStatuses = ['pending', 'approved', 'rejected', 'manual'];
    const aiCounts = {};
    
    for (const status of aiStatuses) {
      const { count } = await supabase.from('claims').select('*', { count: 'exact', head: true }).eq('ai_review_status', status);
      aiCounts[status] = count || 0;
    }
    
    return { success: true, counts, aiCounts };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ========== 流转规则检测 ==========

async function detectFlowIssues() {
  const issues = [];
  
  try {
    // 1. 检测状态不一致
    const { data: inconsistentClaims } = await supabase
      .from('claims')
      .select('id, status, ai_review_status')
      .eq('status', 'approved')
      .is('ai_review_status', null);
    
    if (inconsistentClaims && inconsistentClaims.length > 0) {
      issues.push({
        type: '状态不一致',
        description: `发现 ${inconsistentClaims.length} 个已通过但未设置AI审核状态的claims`,
        severity: 'medium',
        ids: inconsistentClaims.map(c => c.id)
      });
    }
    
    // 2. 检测队列积压
    const { count: aiQueueBacklog } = await supabase
      .from('ai_review_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    if (aiQueueBacklog > 50) {
      issues.push({
        type: '队列积压',
        description: `AI审核队列积压 ${aiQueueBacklog} 条`,
        severity: 'high'
      });
    }
    
    // 3. 检测长时间处理中的任务
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: processingTooLong } = await supabase
      .from('claims')
      .select('id, status, updated_at')
      .eq('status', 'image_reviewing')
      .lt('updated_at', thirtyMinAgo);
    
    if (processingTooLong && processingTooLong.length > 0) {
      issues.push({
        type: '处理超时',
        description: `发现 ${processingTooLong.length} 个处理超过30分钟的任务`,
        severity: 'medium',
        ids: processingTooLong.map(c => c.id)
      });
    }
    
    // 4. 检测链接审核队列超时
    const now = new Date();
    const { data: overdueLinks } = await supabase
      .from('link_verification_queue')
      .select('id, claim_id, max_process_at')
      .eq('status', 'pending')
      .lt('max_process_at', now.toISOString());
    
    if (overdueLinks && overdueLinks.length > 0) {
      issues.push({
        type: '链接审核超时',
        description: `发现 ${overdueLinks.length} 个超时的链接审核任务`,
        severity: 'medium'
      });
    }
    
  } catch (e) {
    issues.push({ type: '检测异常', description: e.message, severity: 'error' });
  }
  
  return issues;
}

// ========== 主测试循环 ==========

async function runTestCycle() {
  stats.loops++;
  const cycleStart = Date.now();
  
  log(`\n${'═'.repeat(50)}`);
  log(`第 ${stats.loops} 轮测试开始`);
  log(`${'═'.repeat(50)}`);
  
  const results = {
    ocr: await testOCRFlow(),
    bailian: await testBailianFlow(),
    queue: await testQueueFlow(),
    claims: await testClaimsFlow()
  };
  
  // 统计
  const passed = Object.values(results).filter(r => r.success).length;
  const failed = Object.values(results).filter(r => !r.success).length;
  
  stats.totalTests += Object.keys(results).length;
  stats.totalPassed += passed;
  stats.totalFailed += failed;
  
  log(`测试结果: 通过 ${passed}/${Object.keys(results).length}`);
  
  // 记录失败
  for (const [name, result] of Object.entries(results)) {
    if (!result.success) {
      stats.errors.push({ loop: stats.loops, test: name, error: result.error, time: new Date().toISOString() });
      log(`❌ ${name}: ${result.error}`);
    } else {
      log(`✅ ${name} ${result.duration ? `(${result.duration}ms)` : ''}`);
    }
  }
  
  // 检测流转问题
  const flowIssues = await detectFlowIssues();
  if (flowIssues.length > 0) {
    stats.flowIssues.push(...flowIssues.map(i => ({ ...i, loop: stats.loops, time: new Date().toISOString() })));
    for (const issue of flowIssues) {
      log(`⚠️  [${issue.severity}] ${issue.type}: ${issue.description}`);
    }
  }
  
  // 输出队列状态
  if (results.queue.success) {
    log(`队列状态: AI审核=${results.queue.aiQueueCount}, 链接审核=${results.queue.linkQueueCount}`);
    if (results.queue.stuckTasks.length > 0) {
      log(`卡住任务: ${results.queue.stuckTasks.map(t => `#${t.id}(${t.minutes}分钟)`).join(', ')}`);
    }
  }
  
  // 输出Claims分布
  if (results.claims.success) {
    const c = results.claims.counts;
    log(`Claims分布: submitted=${c.submitted}, reviewing=${c.image_reviewing + c.link_reviewing}, approved=${c.approved}, rejected=${c.rejected}`);
  }
  
  const cycleDuration = Date.now() - cycleStart;
  log(`本轮耗时: ${cycleDuration}ms`);
  
  // 保存结果
  fs.writeFileSync(RESULT_FILE, JSON.stringify(stats, null, 2));
}

async function startOvernightTest(intervalMinutes = 5, maxLoops = 100) {
  log('审核5.0 夜间高频测试启动');
  log(`测试间隔: ${intervalMinutes} 分钟`);
  log(`最大轮数: ${maxLoops}`);
  log(`日志文件: ${LOG_FILE}`);
  log(`结果文件: ${RESULT_FILE}`);
  
  let loop = 0;
  while (loop < maxLoops) {
    loop++;
    try {
      await runTestCycle();
    } catch (e) {
      log(`测试异常: ${e.message}`);
    }
    
    if (loop < maxLoops) {
      log(`等待 ${intervalMinutes} 分钟后继续...`);
      await new Promise(r => setTimeout(r, intervalMinutes * 60 * 1000));
    }
  }
  
  // 最终报告
  log(`\n${'═'.repeat(50)}`);
  log('测试完成 - 最终报告');
  log(`${'═'.repeat(50)}`);
  log(`总轮数: ${stats.loops}`);
  log(`总测试: ${stats.totalTests}`);
  log(`通过率: ${((stats.totalPassed / stats.totalTests) * 100).toFixed(1)}%`);
  log(`错误数: ${stats.errors.length}`);
  log(`流转问题: ${stats.flowIssues.length}`);
  
  if (stats.performanceMetrics.ocrAvgTime.length > 0) {
    const avg = stats.performanceMetrics.ocrAvgTime.reduce((a, b) => a + b, 0) / stats.performanceMetrics.ocrAvgTime.length;
    log(`OCR平均响应时间: ${avg.toFixed(0)}ms`);
  }
  
  if (stats.performanceMetrics.bailianAvgTime.length > 0) {
    const avg = stats.performanceMetrics.bailianAvgTime.reduce((a, b) => a + b, 0) / stats.performanceMetrics.bailianAvgTime.length;
    log(`百炼平均响应时间: ${avg.toFixed(0)}ms`);
  }
}

// 启动
const args = process.argv.slice(2);
const interval = parseInt(args[0]) || 5;
const maxLoops = parseInt(args[1]) || 100;

startOvernightTest(interval, maxLoops);
