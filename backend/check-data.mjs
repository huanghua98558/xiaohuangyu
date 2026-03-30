import pg from 'pg';

const { Pool } = pg;

// 旧 Supabase 数据库
const oldDb = new Pool({
  host: 'aws-1-ap-south-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.uupwoghhivtfapbntxzs',
  password: 'n9PMo08FHepPLg4W',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

// 新 CockroachDB 数据库
const newDb = new Pool({
  host: 'cotton-tern-23589.j77.aws-ap-southeast-1.cockroachlabs.cloud',
  port: 26257,
  user: '1823985558qqcom',
  password: '4-NJnwt94B-yljofZCocTw',
  database: 'xiaohuangyu',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  console.log('========== 数据对比 ==========\n');
  
  const tables = ['users', 'tasks', 'claims', 'withdrawals', 'records'];
  
  console.log('表名                旧库(Supabase)    新库(CockroachDB)');
  console.log('----------------------------------------------------');
  
  for (const table of tables) {
    try {
      const oldCount = await oldDb.query('SELECT COUNT(*) as cnt FROM ' + table);
      const newCount = await newDb.query('SELECT COUNT(*) as cnt FROM ' + table);
      
      const oldNum = parseInt(oldCount.rows[0].cnt);
      const newNum = parseInt(newCount.rows[0].cnt);
      const diff = oldNum - newNum;
      
      console.log(table.padEnd(20) + oldNum.toString().padStart(10) + newNum.toString().padStart(15) + (diff > 0 ? '  差' + diff : ''));
    } catch (e) {
      console.log(table + ': 查询失败 - ' + e.message.substring(0, 50));
    }
  }
  
  // 查看旧库 claims 数据样例
  console.log('\n========== 旧库 claims 数据样例 ==========');
  const claimsSample = await oldDb.query('SELECT id, user_id, task_id, status, created_at FROM claims LIMIT 5');
  console.table(claimsSample.rows);
  
  // 查看旧库 users ID 范围
  console.log('\n========== 旧库 users ID 范围 ==========');
  const userIds = await oldDb.query('SELECT MIN(id) as min, MAX(id) as max FROM users');
  console.log('ID范围:', userIds.rows[0]);
  
  // 查看新库 users ID 范围
  console.log('\n========== 新库 users ID 范围 ==========');
  const newUserIds = await newDb.query('SELECT MIN(id) as min, MAX(id) as max FROM users');
  console.log('ID范围:', newUserIds.rows[0]);
  
  await oldDb.end();
  await newDb.end();
}

check();
