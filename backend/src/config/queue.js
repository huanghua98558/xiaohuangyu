/**
 * BullMQ 队列配置
 */

import 'dotenv/config'; // 确保 dotenv 最先加载
import IORedis from 'ioredis';

// Redis 连接配置
export const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    if (times > 3) {
      return null;
    }
    return Math.min(times * 200, 2000);
  }
});

// 测试连接
redisConnection.on('connect', () => {
  console.log('[Redis] 连接成功');
});

redisConnection.on('error', (err) => {
  console.error('[Redis] 连接失败:', err.message);
});

export default redisConnection;
