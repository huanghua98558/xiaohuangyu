/**
 * 审核5.0 高频测试脚本 - 修复版
 */

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const PADDLE_OCR_URL = process.env.PADDLE_OCR_URL || 'http://localhost:8088';

const stats = { total: 0, passed: 0, failed: 0, errors: [], results: [] };
const colors = { green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', blue: '\x1b[34m', reset: '\x1b[0m' };

function log(color, message) {
  console.log(`${colors[color]}[TEST] ${message}${colors.reset}`);
}

const testCases = [
  // 基础服务
  {
    name: 'PaddleOCR服务健康检查',
    category: '基础服务',
    async run() {
      const res = await axios.get(`${PADDLE_OCR_URL}/health`, { timeout: 5000 });
      return { success: res.data.status === 'ok', data: res.data };
    }
  },
  {
    name: '后端API健康检查',
    category: '基础服务',
    async run() {
      const res = await axios.get('http://localhost:5001/api/health', { timeout: 5000 });
      return { success: res.status === 200, data: res.data };
    }
  },

  // 百炼API
  {
    name: '百炼API连接测试',
    category: '百炼API',
    async run() {
      const res = await axios.post(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
        { model: 'qwen-vl-plus', input: { messages: [{ role: 'user', content: [{ text: '你好' }] }] } },
        { headers: { 'Authorization': `Bearer ${process.env.BAILIAN_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 30000 }
      );
      return { success: !!res.data.output, data: { model: res.data.output?.model } };
    }
  },

  // 队列服务
  {
    name: 'AI审核队列-待处理数量',
    category: '队列服务',
    async run() {
      const { count, error } = await supabase.from('ai_review_queue').select('*', { count: 'exact', head: true }).in('status', ['pending', 'image_reviewing']);
      if (error) throw error;
      return { success: true, count };
    }
  },
  {
    name: '链接审核队列-待处理数量',
    category: '队列服务',
    async run() {
      const { count, error } = await supabase.from('link_verification_queue').select('*', { count: 'exact', head: true }).in('status', ['pending', 'ready']);
      if (error) throw error;
      return { success: true, count };
    }
  },

  // Claims状态
  {
    name: 'Claims状态分布',
    category: '数据统计',
    async run() {
      const statuses = ['submitted', 'image_reviewing', 'link_reviewing', 'approved', 'rejected'];
      const counts = {};
      for (const status of statuses) {
        const { count } = await supabase.from('claims').select('*', { count: 'exact', head: true }).eq('status', status);
        counts[status] = count || 0;
      }
      return { success: true, counts };
    }
  },
  {
    name: 'Claims-AI审核状态分布',
    category: '数据统计',
    async run() {
      const statuses = ['pending', 'approved', 'rejected', 'manual'];
      const counts = {};
      for (const status of statuses) {
        const { count } = await supabase.from('claims').select('*', { count: 'exact', head: true }).eq('ai_review_status', status);
        counts[status] = count || 0;
      }
      return { success: true, counts };
    }
  },

  // 评论分析
  {
    name: '评论分析-有效评论',
    category: '评论分析',
    async run() {
      const { analyzeCommentDimensionV5 } = await import('./src/services/ai/commentAnalysisV5.js');
      const result = analyzeCommentDimensionV5('这个视频非常有用，学到了很多知识，感谢分享！');
      return { success: result.passed, data: { score: result.score, reason: result.reason } };
    }
  },
  {
    name: '评论分析-过短评论',
    category: '评论分析',
    async run() {
      const { analyzeCommentDimensionV5 } = await import('./src/services/ai/commentAnalysisV5.js');
      const result = analyzeCommentDimensionV5('好的');
      return { success: !result.passed, data: { score: result.score, reason: result.reason } };
    }
  },
  {
    name: '评论分析-无意义评论',
    category: '评论分析',
    async run() {
      const { analyzeCommentDimensionV5 } = await import('./src/services/ai/commentAnalysisV5.js');
      const result = analyzeCommentDimensionV5('。。。');
      return { success: !result.passed, data: { score: result.score, reason: result.reason } };
    }
  },

  // 链接审核
  {
    name: '链接审核-超时任务检查',
    category: '链接审核',
    async run() {
      const { count, error } = await supabase.from('link_verification_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending').lt('max_process_at', new Date().toISOString());
      if (error) throw error;
      return { success: true, overdueCount: count };
    }
  },

  // 封控账户
  {
    name: '封控账户检查',
    category: '封控检测',
    async run() {
      const { count, error } = await supabase.from('blocked_accounts').select('*', { count: 'exact', head: true });
      if (error) throw error;
      return { success: true, count };
    }
  },

  // 配置中心
  {
    name: 'AI配置检查',
    category: '配置中心',
    async run() {
      const { data, error } = await supabase.from('ai_configs').select('key, value').limit(10);
      if (error) throw error;
      return { success: true, count: data.length, data };
    }
  },

  // 完整流程测试
  {
    name: '审核流程-最近审核记录',
    category: '流程测试',
    async run() {
      const { data, error } = await supabase.from('claims').select('id, status, ai_review_status, created_at').order('updated_at', { ascending: false }).limit(5);
      if (error) throw error;
      return { success: true, count: data.length, data };
    }
  }
];

async function runTest(testCase) {
  const startTime = Date.now();
  try {
    const result = await testCase.run();
    const duration = Date.now() - startTime;
    stats.total++;
    if (result.success) {
      stats.passed++;
      log('green', `✓ ${testCase.name} [${duration}ms]`);
    } else {
      stats.failed++;
      log('red', `✗ ${testCase.name}: ${result.error || '失败'}`);
      stats.errors.push({ name: testCase.name, error: result.error });
    }
    stats.results.push({ name: testCase.name, category: testCase.category, success: result.success, duration, data: result.data });
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    stats.total++;
    stats.failed++;
    log('red', `✗ ${testCase.name}: ${error.message} [${duration}ms]`);
    stats.errors.push({ name: testCase.name, error: error.message });
    return { success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('       审核5.0 高频测试 - ' + new Date().toLocaleString());
  console.log('='.repeat(60) + '\n');
  
  const categories = [...new Set(testCases.map(t => t.category))];
  for (const category of categories) {
    log('yellow', `━━━ ${category} ━━━`);
    for (const test of testCases.filter(t => t.category === category)) {
      await runTest(test);
      await new Promise(r => setTimeout(r, 50));
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('       测试结果统计');
  console.log('='.repeat(60));
  console.log(`总计: ${stats.total} | 通过: ${stats.passed} | 失败: ${stats.failed}`);
  console.log(`通过率: ${((stats.passed / stats.total) * 100).toFixed(1)}%`);
  
  if (stats.errors.length > 0) {
    console.log('\n失败详情:');
    stats.errors.forEach((e, i) => console.log(`  ${i + 1}. ${e.name}: ${e.error}`));
  }
  
  return stats;
}

// 高频循环测试
async function loopTest(intervalMinutes = 5, maxLoops = 100) {
  let loop = 0;
  while (loop < maxLoops) {
    loop++;
    console.log(`\n${'#'.repeat(60)}`);
    console.log(`# 第 ${loop} 轮测试 - ${new Date().toLocaleString()}`);
    console.log(`#${'#'.repeat(59)}`);
    
    stats.total = 0; stats.passed = 0; stats.failed = 0; stats.errors = []; stats.results = [];
    await runAllTests();
    
    if (loop < maxLoops) {
      log('blue', `\n等待 ${intervalMinutes} 分钟后进行下一轮测试...`);
      await new Promise(r => setTimeout(r, intervalMinutes * 60 * 1000));
    }
  }
}

const args = process.argv.slice(2);
if (args.includes('--loop')) {
  const interval = parseInt(args[args.indexOf('--loop') + 1]) || 5;
  loopTest(interval);
} else {
  runAllTests();
}
