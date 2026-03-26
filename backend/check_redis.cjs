const { Queue } = require("bullmq");

async function main() {
  const linkVerifyQueue = new Queue("link-verify-queue", {
    connection: { host: "localhost", port: 6379 }
  });
  
  console.log("=== link-verify-queue 状态 ===");
  console.log("等待中:", await linkVerifyQueue.getWaitingCount());
  console.log("活跃:", await linkVerifyQueue.getActiveCount());
  console.log("已完成:", await linkVerifyQueue.getCompletedCount());
  console.log("失败:", await linkVerifyQueue.getFailedCount());
  console.log("延迟:", await linkVerifyQueue.getDelayedCount());
  
  // 获取等待中的任务
  const waiting = await linkVerifyQueue.getWaiting();
  if (waiting.length > 0) {
    console.log("\n等待中的任务:");
    waiting.forEach(job => {
      console.log(`- Job ID: ${job.id}, claimId: ${job.data.claimId}`);
    });
  }
  
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
