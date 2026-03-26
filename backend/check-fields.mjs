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

async function check() {
  // 获取 claims 表字段
  const result = await oldDb.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'claims' 
    ORDER BY ordinal_position
  `);
  
  console.log('旧库 claims 表字段:');
  result.rows.forEach(r => console.log('  ' + r.column_name + ' (' + r.data_type + ')'));
  
  // 查看数据样例
  const sample = await oldDb.query('SELECT * FROM claims LIMIT 2');
  console.log('\n数据样例:');
  console.log(JSON.stringify(sample.rows[0], null, 2));
  
  await oldDb.end();
}

check();
