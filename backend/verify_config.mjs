import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://xiaohuanyu2:d5XWShrEqwWHBPxuts-gCw@aware-bison-23613.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full',
  ssl: { rejectUnauthorized: false }
});

async function verify() {
  await client.connect();
  const result = await client.query('SELECT * FROM night_point_config WHERE id = 1');
  console.log('当前配置:', JSON.stringify(result.rows[0], null, 2));
  await client.end();
}

verify();
