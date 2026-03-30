import { Client } from 'pg';
import { readFileSync } from 'fs';

const client = new Client({
  connectionString: 'postgresql://1823985558qqcom:4-NJnwt94B-yljofZCocTw@cotton-tern-23589.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257/xiaohuangyu?sslmode=require'
});

try {
  await client.connect();
  console.log('CockroachDB 连接成功');
  
  const sql = readFileSync('/tmp/cockroach_setup.sql', 'utf8');
  const statements = sql.split(';').filter(s => s.trim());
  
  for (let i = 0; i < statements.length; i++) {
    const result = await client.query(statements[i]);
    if (result.rows && result.rows.length > 0) {
      console.log('结果:', JSON.stringify(result.rows, null, 2));
    }
  }
  
  console.log('所有 SQL 执行完成！');
  await client.end();
} catch (error) {
  console.error('错误:', error.message);
  await client.end();
  process.exit(1);
}
