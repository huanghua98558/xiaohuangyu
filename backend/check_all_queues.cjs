const { Queue } = require("bullmq");

async function main() {
  const redisConfig = {
    host: "localhost",
    port: 6379,
    password: "XHY_Redis_20260317184224"
  };
  
  console.log("\n【图片审核队列】");
  const imageQueue = new Queue("image-review-queue", { connection: redisConfig });
  console.log("  等待中:", await imageQueue.getWaitingCount());
  console.log("  活跃:", await imageQueue.getActiveCount());
  console.log("  延迟:", await imageQueue.getDelayedCount());
  
  console.log("\n【链接验证队列】");
  const linkQueue = new Queue("link-verify-queue", { connection: redisConfig });
  console.log("  等待中:", await linkQueue.getWaitingCount());
  console.log("  活跃:", await linkQueue.getActiveCount());
  console.log("  延迟:", await linkQueue.getDelayedCount());
  
  // 获取延迟任务详情
  const delayed = await linkQueue.getDelayed();
  if (delayed.length > 0) {
    console.log("  延迟任务详情:");
    delayed.slice(0, 5).forEach(job => {
      const delayMs = job.opts.delay || 0;
      const executeAt = new Date(delayMs).toLocaleString();
      console.log(`    - Job ${job.id}: 执行时间 ${executeAt}`);
    });
  }
  
  console.log("\n【延迟队列 (link-delay-queue)】");
  const delayQueue = new Queue("link-delay-queue", { connection: redisConfig });
  console.log("  等待中:", await delayQueue.getWaitingCount());
  console.log("  延迟:", await delayQueue.getDelayedCount());
  
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
