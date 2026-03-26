import { Client } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CockroachDB 连接配置
const client = new Client({
  connectionString: 'postgresql://xiaohuanyu2:d5XWShrEqwWHBPxuts-gCw@aware-bison-23613.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full',
  ssl: {
    rejectUnauthorized: false
  }
});

async function executeUpdate() {
  try {
    console.log('正在连接 CockroachDB...');
    await client.connect();
    console.log('连接成功！');
    
    // 读取 SQL 文件
    const sqlPath = join('/var/www/xiaohuangyu/backend', 'update_night_config.sql');
    const sql = readFileSync(sqlPath, 'utf-8');
    
    console.log('正在执行更新...');
    await client.query(sql);
    
    console.log('✅ 更新成功！');
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

executeUpdate();
