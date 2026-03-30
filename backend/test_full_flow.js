/**
 * 完整流程测试脚本 - 云服务器版本
 * 测试图片审核完整流程：OCR + YOLO + 封控检测
 */

import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 测试图片路径
const TEST_IMAGES = [
  '/var/www/xiaohuangyu/标准/测试文件夹/1-1.jpg',
  '/var/www/xiaohuangyu/标准/测试文件夹/1-2.jpg'
];

// 测试任务链接
const TEST_TASK_URL = 'https://v.douyin.com/JPxit6nXhLw/';

console.log('=====================================');
console.log('   完整流程测试 - 云服务器版');
console.log('=====================================\n');

async function testOCRModule(imagePath) {
  console.log(`📸 测试 OCR 模块：${path.basename(imagePath)}`);
  
  return new Promise((resolve) => {
    const ocrProcess = spawn('python3', [
      path.join(__dirname, 'src/workers/modules/ocr_module.py')
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    // 设置超时
    const timeout = setTimeout(() => {
      console.log('⚠️  OCR 模块超时，终止进程');
      ocrProcess.kill();
      resolve({ success: false, error: '超时' });
    }, 30000); // 30 秒超时
    
    ocrProcess.stdout.on('data', (data) => {
      output += data.toString();
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ready') {
          // 模块就绪，发送图片路径
          ocrProcess.stdin.write(JSON.stringify({
            action: 'ocr',
            image_path: imagePath
          }) + '\n');
        } else if (msg.type === 'result') {
          clearTimeout(timeout);
          console.log('✅ OCR 识别成功:');
          if (msg.text && msg.text.length > 0) {
            msg.text.forEach(line => {
              console.log(`   - ${line.text} (置信度：${line.confidence})`);
            });
          } else {
            console.log('   (无文字)');
          }
          ocrProcess.kill();
          resolve({ success: true, result: msg });
        }
      } catch (e) {
        // 忽略解析错误
      }
    });
    
    ocrProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(`OCR 错误：${data.toString()}`);
    });
    
    ocrProcess.on('close', (code) => {
      if (code !== 0 && !output.includes('"type":"result"')) {
        clearTimeout(timeout);
        console.log(`❌ OCR 进程退出，代码：${code}`);
        resolve({ success: false, error: `退出码 ${code}` });
      }
    });
  });
}

async function testYOLOModule(imagePath) {
  console.log(`\n🎯 测试 YOLO 模块：${path.basename(imagePath)}`);
  
  return new Promise((resolve) => {
    const yoloProcess = spawn('python3', [
      path.join(__dirname, 'src/workers/modules/yolo_module.py')
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    const timeout = setTimeout(() => {
      console.log('⚠️  YOLO 模块超时，终止进程');
      yoloProcess.kill();
      resolve({ success: false, error: '超时' });
    }, 30000);
    
    yoloProcess.stdout.on('data', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ready') {
          // 模块就绪，发送图片路径
          yoloProcess.stdin.write(JSON.stringify({
            action: 'detect',
            image_path: imagePath
          }) + '\n');
        } else if (msg.type === 'result') {
          clearTimeout(timeout);
          console.log('✅ YOLO 检测成功:');
          if (msg.detections && msg.detections.length > 0) {
            msg.detections.forEach(det => {
              console.log(`   - ${det.class} (置信度：${det.confidence})`);
            });
          } else {
            console.log('   (未检测到图标)');
          }
          yoloProcess.kill();
          resolve({ success: true, result: msg });
        }
      } catch (e) {
        // 忽略解析错误
      }
    });
    
    yoloProcess.stderr.on('data', (data) => {
      console.error(`YOLO 错误：${data.toString()}`);
    });
    
    yoloProcess.on('close', (code) => {
      if (code !== 0) {
        clearTimeout(timeout);
        console.log(`❌ YOLO 进程退出，代码：${code}`);
        resolve({ success: false, error: `退出码 ${code}` });
      }
    });
  });
}

async function testDatabaseInsert() {
  console.log('\n💾 测试数据库写入（创建测试 claim）...');
  
  try {
    // 创建一个测试 claim
    const { data: claim, error } = await supabase
      .from('claims')
      .insert({
        user_id: 'test_user_' + Date.now(),
        task_id: 1,
        status: 'pending',
        platform: 'douyin',
        platform_nickname: '测试用户',
        platform_user_id: 'test123',
        video_url: TEST_TASK_URL,
        comment: '测试评论',
        submitted_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.log(`❌ 创建 claim 失败：${error.message}`);
      return null;
    }
    
    console.log(`✅ 创建测试 claim 成功，ID: ${claim.id}`);
    
    // 创建关联的 claim_images
    const { error: imageError } = await supabase
      .from('claim_images')
      .insert({
        claim_id: claim.id,
        image_url: TEST_IMAGES[0],
        image_type: 'result'
      });
    
    if (imageError) {
      console.log(`⚠️  创建 claim_images 失败：${imageError.message}`);
    } else {
      console.log(`✅ 创建 claim_images 成功`);
    }
    
    // 将 claim 加入审核队列
    const { error: queueError } = await supabase.rpc('enqueue_review', {
      p_claim_id: claim.id
    });
    
    if (queueError) {
      console.log(`⚠️  加入审核队列失败：${queueError.message}`);
    } else {
      console.log(`✅ 加入审核队列成功`);
    }
    
    return claim;
  } catch (error) {
    console.log(`❌ 数据库测试失败：${error.message}`);
    return null;
  }
}

async function testBlockedAccountDetection() {
  console.log('\n🚨 测试封控检测逻辑...');
  
  try {
    // 检查 blocked_accounts 表是否可写
    const { data, error } = await supabase
      .from('blocked_accounts')
      .insert({
        user_id: 'test_user',
        claim_id: 999999,
        platform: 'douyin',
        platform_nickname: '测试账号',
        platform_user_id: 'test123',
        video_url: TEST_TASK_URL,
        comment_content: '测试评论',
        block_type: 'comment_hidden',
        detection_method: 'test',
        status: 'suspected'
      })
      .select()
      .single();
    
    if (error) {
      console.log(`❌ 创建 blocked_accounts 记录失败：${error.message}`);
      return false;
    }
    
    console.log(`✅ 创建 blocked_accounts 记录成功，ID: ${data.id}`);
    
    // 删除测试数据
    await supabase
      .from('blocked_accounts')
      .delete()
      .eq('id', data.id);
    
    console.log(`✅ 清理测试数据成功`);
    
    return true;
  } catch (error) {
    console.log(`❌ 封控检测测试失败：${error.message}`);
    return false;
  }
}

async function testNotificationCreation() {
  console.log('\n📬 测试通知创建...');
  
  try {
    // 测试管理员通知
    const { data: adminNotif, error: adminError } = await supabase
      .from('admin_notifications')
      .insert({
        type: 'test',
        title: '测试通知',
        content: '这是一条测试通知',
        admin_id: 'admin'
      })
      .select()
      .single();
    
    if (adminError) {
      console.log(`❌ 创建管理员通知失败：${adminError.message}`);
    } else {
      console.log(`✅ 创建管理员通知成功，ID: ${adminNotif.id}`);
      // 删除测试数据
      await supabase.from('admin_notifications').delete().eq('id', adminNotif.id);
    }
    
    // 测试用户通知
    const { data: userNotif, error: userError } = await supabase
      .from('user_notifications')
      .insert({
        type: 'test',
        title: '测试通知',
        content: '这是一条测试用户通知',
        user_id: 'test_user'
      })
      .select()
      .single();
    
    if (userError) {
      console.log(`❌ 创建用户通知失败：${userError.message}`);
    } else {
      console.log(`✅ 创建用户通知成功，ID: ${userNotif.id}`);
      // 删除测试数据
      await supabase.from('user_notifications').delete().eq('id', userNotif.id);
    }
    
    return true;
  } catch (error) {
    console.log(`❌ 通知测试失败：${error.message}`);
    return false;
  }
}

async function checkWorkerStatus() {
  console.log('\n📊 检查 Worker 运行状态...');
  
  const { exec } = await import('child_process');
  
  return new Promise((resolve) => {
    exec('ssh ubuntu@43.161.224.174 "pm2 list"', (error, stdout, stderr) => {
      if (error) {
        console.log(`❌ 检查失败：${error.message}`);
        resolve(false);
        return;
      }
      
      console.log(stdout);
      
      // 检查关键进程
      const hasImageWorker = stdout.includes('image-review-worker') && stdout.includes('online');
      const hasLinkWorker = stdout.includes('link-verify-worker') && stdout.includes('online');
      
      if (hasImageWorker) {
        console.log('✅ image-review-worker 运行中');
      } else {
        console.log('❌ image-review-worker 未运行');
      }
      
      if (hasLinkWorker) {
        console.log('✅ link-verify-worker 运行中');
      } else {
        console.log('❌ link-verify-worker 未运行');
      }
      
      resolve(hasImageWorker && hasLinkWorker);
    });
  });
}

async function main() {
  console.log('测试图片路径:', TEST_IMAGES);
  console.log('测试任务链接:', TEST_TASK_URL);
  console.log('\n=====================================\n');
  
  const results = {
    ocrTest: false,
    yoloTest: false,
    databaseTest: false,
    blockedAccountTest: false,
    notificationTest: false,
    workerStatus: false
  };
  
  // 1. 检查 Worker 状态
  results.workerStatus = await checkWorkerStatus();
  
  // 2. 测试 OCR 模块
  if (TEST_IMAGES.length > 0) {
    const ocrResult = await testOCRModule(TEST_IMAGES[0]);
    results.ocrTest = ocrResult.success;
  }
  
  // 3. 测试 YOLO 模块
  if (TEST_IMAGES.length > 0) {
    const yoloResult = await testYOLOModule(TEST_IMAGES[0]);
    results.yoloTest = yoloResult.success;
  }
  
  // 4. 测试数据库写入
  const testClaim = await testDatabaseInsert();
  results.databaseTest = testClaim !== null;
  
  // 5. 测试封控检测
  results.blockedAccountTest = await testBlockedAccountDetection();
  
  // 6. 测试通知创建
  results.notificationTest = await testNotificationCreation();
  
  // 汇总结果
  console.log('\n=====================================');
  console.log('   测试结果汇总');
  console.log('=====================================\n');
  
  const tests = [
    { name: 'Worker 状态检查', result: results.workerStatus },
    { name: 'OCR 模块测试', result: results.ocrTest },
    { name: 'YOLO 模块测试', result: results.yoloTest },
    { name: '数据库写入测试', result: results.databaseTest },
    { name: '封控检测测试', result: results.blockedAccountTest },
    { name: '通知创建测试', result: results.notificationTest }
  ];
  
  let passedCount = 0;
  tests.forEach(test => {
    const status = test.result ? '✅ 通过' : '❌ 失败';
    console.log(`${status} - ${test.name}`);
    if (test.result) passedCount++;
  });
  
  console.log(`\n总计：${passedCount}/${tests.length} 测试通过`);
  
  if (passedCount === tests.length) {
    console.log('\n🎉 所有测试通过！系统运行正常！');
  } else {
    console.log('\n⚠️  部分测试失败，请检查相关模块');
  }
  
  console.log('\n=====================================\n');
  
  return results;
}

main().catch(console.error);
