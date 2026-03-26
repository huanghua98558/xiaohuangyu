const { Queue } = require("bullmq");

async function main() {
  const queue = new Queue("link-verify-queue", {
    connection: {
      host: "localhost",
      port: 6379,
      password: "XHY_Redis_20260317184224"
    }
  });
  
  console.log("=== link-verify-queue 状态 ===");
  console.log("等待中:", await queue.getWaitingCount());
  console.log("活跃:", await queue.getActiveCount());
  console.log("已完成:", await queue.getCompletedCount());
  console.log("失败:", await queue.getFailedCount());
  console.log("延迟:", await queue.getDelayedCount());
  
  // 获取延迟任务详情
  const delayed = await queue.getDelayed();
  if (delayed.length > 0) {
    console.log("\n延迟任务详情:");
    delayed.forEach(job => {
      const delayMs = job.opts.delay || 0;
      const executeAt = new Date(delayMs).toLocaleString();
      console.log(`- Job ID: ${job.id}, claimId: ${job.data.claimId}, 执行时间: ${executeAt}`);
    });
  }
  
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
