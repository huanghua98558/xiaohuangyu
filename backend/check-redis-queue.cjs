const Redis = require('ioredis');
const redis = new Redis({
  host: '127.0.0.1',
  port: 6379,
  password: 'Xhy_redis_2024!'
});

async function main() {
  // 检查 link_verify_queue 队列
  const linkQueue = await redis.lrange('bull:link_verify_queue:wait', 0, 10);
  console.log('链接验证队列 (wait):', linkQueue.length, '个任务');
  
  const linkQueueActive = await redis.lrange('bull:link_verify_queue:active', 0, 10);
  console.log('链接验证队列 (active):', linkQueueActive.length, '个任务');
  
  const linkQueueDelayed = await redis.lrange('bull:link_verify_queue:delayed', 0, 10);
  console.log('链接验证队列 (delayed):', linkQueueDelayed.length, '个任务');
  
  await redis.quit();
}

main().catch(e => console.error('错误:', e));
