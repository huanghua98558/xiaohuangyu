const { Queue } = require("bullmq");

async function main() {
  const redisConfig = {
    host: "localhost",
    port: 6379,
    password: "XHY_Redis_20260317184224"
  };
  
  const queues = [
    { name: "link-verify-queue", desc: "链接验证队列" },
    { name: "link-delay-queue", desc: "延迟队列" }
  ];
  
  for (const q of queues) {
    const queue = new Queue(q.name, { connection: redisConfig });
    
    console.log(`\n=== ${q.desc} (${q.name}) ===`);
    console.log("等待中:", await queue.getWaitingCount());
    console.log("活跃:", await queue.getActiveCount());
    console.log("已完成:", await queue.getCompletedCount());
    console.log("失败:", await queue.getFailedCount());
    console.log("延迟:", await queue.getDelayedCount());
    
    // 获取等待中的任务
    const waiting = await queue.getWaiting();
    if (waiting.length > 0) {
      console.log("\n等待中的任务:");
      for (const job of waiting.slice(0, 5)) {
        console.log(`- Job ID: ${job.id}, claimId: ${job.data.claimId}`);
      }
    }
    
    // 获取延迟任务
    const delayed = await queue.getDelayed();
    if (delayed.length > 0) {
      console.log("\n延迟任务:");
      for (const job of delayed.slice(0, 5)) {
        const delayMs = job.opts.delay || 0;
        const executeAt = new Date(delayMs).toLocaleString();
        console.log(`- Job ID: ${job.id}, claimId: ${job.data.claimId}, 执行时间: ${executeAt}`);
      }
    }
  }
  
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
