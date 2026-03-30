import 'dotenv/config';
import { getAIUsageStats } from './src/services/ai/aiUsageStatsService.js';

async function test() {
  console.log('REDIS_HOST:', process.env.REDIS_HOST);
  const stats = await getAIUsageStats();
  console.log('\nAPI 返回数据:');
  console.log(JSON.stringify(stats, null, 2));
}

test().catch(console.error);
