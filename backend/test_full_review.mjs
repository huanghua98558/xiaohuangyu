import { Queue } from 'bullmq';

async function createTestTask() {
  const reviewQueue = new Queue('review-queue', {
    connection: { host: '127.0.0.1', port: 6379, password: 'XHY_Redis_20260317184224' }
  });

  // 测试数据
  const testTask = {
    claimId: 999,
    taskId: 100,
    userId: 1,
    screenshots: [
      '/home/ubuntu/test_images/screenshot1.jpg',
      '/home/ubuntu/test_images/screenshot2.jpg'
    ],
    link: 'https://v.douyin.com/JPxit6nXhLw/',
    comment: '朋友推荐的，真的可以的🙏🙏🙏',
    submittedAt: new Date().toISOString()
  };

  console.log('创建审核任务...');
  console.log('任务数据:', JSON.stringify(testTask, null, 2));

  const job = await reviewQueue.add('review-task', testTask, {
    jobId: `test-review-${Date.now()}`,
    attempts: 1
  });

  console.log(`✅ 任务已创建，Job ID: ${job.id}`);
  
  await reviewQueue.close();
}

createTestTask().catch(console.error);
