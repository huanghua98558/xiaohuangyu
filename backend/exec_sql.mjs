import { Client } from 'pg';
import { readFileSync } from 'fs';

const client = new Client({
  connectionString: 'postgresql://xiaohuanyu2:d5XWShrEqwWHBPxuts-gCw@aware-bison-23613.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full',
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();
  console.log('连接成功');
  
  const sql = readFileSync('/var/www/xiaohuangyu/backend/create_night_tables.sql', 'utf8');
  const statements = sql.split(';');
  
  for (const stmt of statements) {
    if (stmt.trim()) {
      const result = await client.query(stmt);
      if (result.rows.length > 0) {
        console.log(JSON.stringify(result.rows, null, 2));
      }
    }
  }
  
  console.log('完成');
  await client.end();
} catch (error) {
  console.error('错误:', error.message);
  await client.end();
}
