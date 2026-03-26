import pg from 'pg';

const { Pool } = pg;

const oldDb = new Pool({
  host: 'aws-1-ap-south-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.uupwoghhivtfapbntxzs',
  password: 'n9PMo08FHepPLg4W',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

const newDb = new Pool({
  host: 'cotton-tern-23589.j77.aws-ap-southeast-1.cockroachlabs.cloud',
  port: 26257,
  user: '1823985558qqcom',
  password: '4-NJnwt94B-yljofZCocTw',
  database: 'xiaohuangyu',
  ssl: { rejectUnauthorized: false }
});

async function analyze() {
  console.log('========== 分析 ID 匹配情况 ==========\n');
  
  // 对比 users ID
  console.log('=== Users ID 对比 ===');
  const oldUsers = await oldDb.query('SELECT id, username FROM users ORDER BY id LIMIT 10');
  const newUsers = await newDb.query('SELECT id, username FROM users ORDER BY id LIMIT 10');
  
  console.log('旧库 users:');
  oldUsers.rows.forEach(r => console.log('  ID ' + r.id + ': ' + r.username));
  
  console.log('\n新库 users:');
  newUsers.rows.forEach(r => console.log('  ID ' + r.id + ': ' + r.username));
  
  // 检查 claims 关联的 user_id 范围
  console.log('\n=== Claims 关联的 user_id 范围 ===');
  const claimsUserRange = await oldDb.query('SELECT MIN(user_id) as min, MAX(user_id) as max FROM claims');
  console.log('旧库 claims.user_id 范围:', claimsUserRange.rows[0]);
  
  // 检查新库 users ID 范围
  const newUserIdRange = await newDb.query('SELECT MIN(id) as min, MAX(id) as max FROM users');
  console.log('新库 users.id 范围:', newUserIdRange.rows[0]);
  
  // 检查旧库 users ID 范围
  const oldUserIdRange = await oldDb.query('SELECT MIN(id) as min, MAX(id) as max FROM users');
  console.log('旧库 users.id 范围:', oldUserIdRange.rows[0]);
  
  // 检查 claims 关联的 task_id 范围
  console.log('\n=== Claims 关联的 task_id 范围 ===');
  const claimsTaskRange = await oldDb.query('SELECT MIN(task_id) as min, MAX(task_id) as max FROM claims');
  console.log('旧库 claims.task_id 范围:', claimsTaskRange.rows[0]);
  
  // 检查新库 tasks ID 范围
  const newTaskIdRange = await newDb.query('SELECT MIN(id) as min, MAX(id) as max FROM tasks');
  console.log('新库 tasks.id 范围:', newTaskIdRange.rows[0]);
  
  // 检查旧库 tasks ID 范围
  const oldTaskIdRange = await oldDb.query('SELECT MIN(id) as min, MAX(id) as max FROM tasks');
  console.log('旧库 tasks.id 范围:', oldTaskIdRange.rows[0]);
  
  await oldDb.end();
  await newDb.end();
}

analyze();
