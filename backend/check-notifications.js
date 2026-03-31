const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://xiaohuangyu:s3cretP@ssword@free-tier.g01.cockroachlabs.cloud:26257/xiaohuangyu?sslmode=verify-full&sslrootcert=/var/www/xiaohuangyu/backend/aware-bison-ca.crt&options=--cluster%3Daware-bison-23613',
  });
  
  await client.connect();
  
  const result = await client.query('SELECT id, title, created_at, NOW() as db_now FROM admin_notifications ORDER BY created_at DESC LIMIT 3');
  console.log('Server time:', new Date().toISOString());
  console.log('Server local time:', new Date().toString());
  console.log('Results:', JSON.stringify(result.rows, null, 2));
  
  await client.end();
}

main().catch(console.error);
