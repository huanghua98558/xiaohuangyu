const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

BigInt.prototype.toJSON = function() { return this.toString(); }

async function add() {
  const claimId = 1161237685590884353n;
  
  // 获取 claim 和 task 信息
  const result = await prisma.$queryRawUnsafe(`
    SELECT 
      c.id as claim_id,
      c.user_id,
      c.task_id,
      c.status,
      t.video_url,
      t.title as task_title,
      t.platform,
      t.action
    FROM claims c
    LEFT JOIN tasks t ON c.task_id = t.id
    WHERE c.id = ${claimId}
  `);
  
  if (result.length === 0) {
    console.log("Claim 不存在");
    return;
  }
  
  const item = result[0];
  console.log("=== 当前任务信息 ===");
  console.log({
    claim_id: item.claim_id.toString(),
    user_id: item.user_id.toString(),
    task_id: item.task_id.toString(),
    status: item.status,
    video_url: item.video_url,
    platform: item.platform,
    action: item.action
  });
  
  // 提取链接
  const videoUrl = item.video_url || "";
  const linkMatch = videoUrl.match(/https?:\/\/[^\s]+/);
  const link = linkMatch ? linkMatch[0] : null;
  
  console.log("\n提取的链接:", link);
  
  if (link) {
    // 更新 claim 状态为 link_reviewing
    await prisma.$queryRawUnsafe(`
      UPDATE claims 
      SET status = 'link_reviewing'
      WHERE id = ${claimId}
    `);
    
    // 加入链接验证队列（使用 BullMQ）
    const { Queue } = require('bullmq');
    const redisConnection = {
      host: 'localhost',
      port: 6379
    };
    
    const linkVerifyQueue = new Queue('link_verify_queue', { connection: redisConnection });
    
    await linkVerifyQueue.add('link-verify', {
      claimId: item.claim_id.toString(),
      userId: item.user_id.toString(),
      taskId: item.task_id.toString(),
      links: [link],
      platform: item.platform || 'douyin',
      taskContext: {
        author: item.task_title,
        action: item.action
      }
    });
    
    console.log("\n✅ 已加入链接验证队列");
  } else {
    console.log("\n❌ 无法提取链接");
  }
  
  await prisma.$disconnect();
}

add();
