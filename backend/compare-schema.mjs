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

async function getTableSchema(pool, tableName) {
  const result = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);
  return result.rows;
}

async function compare() {
  const tables = ['users', 'tasks', 'claims', 'withdrawals', 'records'];
  
  for (const table of tables) {
    console.log('\n========== ' + table + ' 表对比 ==========');
    
    try {
      const oldSchema = await getTableSchema(oldDb, table);
      const newSchema = await getTableSchema(newDb, table);
      
      const oldCols = new Map(oldSchema.map(r => [r.column_name, r]));
      const newCols = new Map(newSchema.map(r => [r.column_name, r]));
      
      // 找出新库缺少的字段
      const missing = [...oldCols.keys()].filter(c => !newCols.has(c));
      if (missing.length > 0) {
        console.log('\n❌ 新库缺少的字段 (' + missing.length + '):');
        missing.forEach(c => {
          const info = oldCols.get(c);
          console.log('  - ' + c + ' (' + info.data_type + ', nullable=' + info.is_nullable + ')');
        });
      } else {
        console.log('✅ 新库包含旧库所有字段');
      }
      
      // 找出新库新增的字段
      const extra = [...newCols.keys()].filter(c => !oldCols.has(c));
      if (extra.length > 0) {
        console.log('\n🆕 新库新增的字段 (' + extra.length + '):');
        extra.forEach(c => {
          const info = newCols.get(c);
          console.log('  + ' + c + ' (' + info.data_type + ', default=' + (info.column_default || 'null') + ')');
        });
      }
      
      // 统计
      console.log('\n统计: 旧库 ' + oldCols.size + ' 字段, 新库 ' + newCols.size + ' 字段');
      
    } catch (e) {
      console.log('表 ' + table + ' 查询失败: ' + e.message);
    }
  }
  
  await oldDb.end();
  await newDb.end();
}

compare();
