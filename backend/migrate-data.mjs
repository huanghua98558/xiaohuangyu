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

async function migrateClaims() {
  console.log('\n========== 迁移 claims ==========');
  
  // 先检查新库字段
  const newCols = await newDb.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'claims'
  `);
  const newColSet = new Set(newCols.rows.map(r => r.column_name));
  
  // 获取旧库数据
  const oldData = await oldDb.query('SELECT * FROM claims ORDER BY id');
  console.log('旧库数据: ' + oldData.rows.length + ' 条');
  
  let inserted = 0, errors = 0;
  const errorList = [];
  
  for (const row of oldData.rows) {
    try {
      // 只使用新库有的字段
      const fields = [];
      const values = [];
      
      for (const [key, value] of Object.entries(row)) {
        if (newColSet.has(key)) {
          fields.push(key);
          // 处理 JSON 字段
          if (key === 'review_history' && value === null) {
            values.push('[]');
          } else if (key === 'screenshots' && value === null) {
            values.push('[]');
          } else {
            values.push(value);
          }
        }
      }
      
      // 添加缺失的必填字段
      if (!fields.includes('ocr_comment')) {
        fields.push('ocr_comment');
        values.push(null);
      }
      if (!fields.includes('reject_count')) {
        fields.push('reject_count');
        values.push(0);
      }
      
      const placeholders = fields.map((_, i) => '$' + (i + 1)).join(', ');
      const sql = 'INSERT INTO claims (' + fields.join(', ') + ') VALUES (' + placeholders + ')';
      
      await newDb.query(sql, values);
      inserted++;
      
      if (inserted % 100 === 0) {
        console.log('  已迁移: ' + inserted + ' 条');
      }
    } catch (err) {
      errors++;
      if (errorList.length < 10) {
        errorList.push('ID ' + row.id + ': ' + err.message.substring(0, 80));
      }
    }
  }
  
  console.log('结果: 成功 ' + inserted + ', 失败 ' + errors);
  if (errorList.length > 0) {
    console.log('错误详情:');
    errorList.forEach(e => console.log('  ' + e));
  }
  
  return { inserted, errors };
}

async function migrateWithdrawals() {
  console.log('\n========== 迁移 withdrawals ==========');
  
  const newCols = await newDb.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'withdrawals'
  `);
  const newColSet = new Set(newCols.rows.map(r => r.column_name));
  
  const oldData = await oldDb.query('SELECT * FROM withdrawals ORDER BY id');
  console.log('旧库数据: ' + oldData.rows.length + ' 条');
  
  let inserted = 0, errors = 0;
  
  for (const row of oldData.rows) {
    try {
      const fields = [];
      const values = [];
      
      for (const [key, value] of Object.entries(row)) {
        if (newColSet.has(key)) {
          fields.push(key);
          values.push(value);
        }
      }
      
      // 确保 updated_at 有值
      if (!fields.includes('updated_at')) {
        fields.push('updated_at');
        values.push(row.created_at || new Date());
      }
      
      const placeholders = fields.map((_, i) => '$' + (i + 1)).join(', ');
      const sql = 'INSERT INTO withdrawals (' + fields.join(', ') + ') VALUES (' + placeholders + ')';
      
      await newDb.query(sql, values);
      inserted++;
    } catch (err) {
      errors++;
      console.log('  错误 ID ' + row.id + ': ' + err.message.substring(0, 60));
    }
  }
  
  console.log('结果: 成功 ' + inserted + ', 失败 ' + errors);
  return { inserted, errors };
}

async function migrateRecords() {
  console.log('\n========== 迁移 records ==========');
  
  const newCols = await newDb.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'records'
  `);
  const newColSet = new Set(newCols.rows.map(r => r.column_name));
  
  const oldData = await oldDb.query('SELECT * FROM records ORDER BY id');
  console.log('旧库数据: ' + oldData.rows.length + ' 条');
  
  let inserted = 0, errors = 0;
  
  for (const row of oldData.rows) {
    try {
      const fields = [];
      const values = [];
      
      for (const [key, value] of Object.entries(row)) {
        if (newColSet.has(key)) {
          fields.push(key);
          values.push(value);
        }
      }
      
      const placeholders = fields.map((_, i) => '$' + (i + 1)).join(', ');
      const sql = 'INSERT INTO records (' + fields.join(', ') + ') VALUES (' + placeholders + ')';
      
      await newDb.query(sql, values);
      inserted++;
    } catch (err) {
      errors++;
      console.log('  错误 ID ' + row.id + ': ' + err.message.substring(0, 60));
    }
  }
  
  console.log('结果: 成功 ' + inserted + ', 失败 ' + errors);
  return { inserted, errors };
}

async function main() {
  console.log('========== 开始数据迁移 ==========');
  console.log('时间: ' + new Date().toISOString());
  
  await migrateClaims();
  await migrateWithdrawals();
  await migrateRecords();
  
  // 验证结果
  console.log('\n========== 验证结果 ==========');
  
  const tables = ['users', 'tasks', 'claims', 'withdrawals', 'records'];
  console.log('表名                旧库              新库');
  console.log('------------------------------------------');
  
  for (const table of tables) {
    const oldCount = await oldDb.query('SELECT COUNT(*) as cnt FROM ' + table);
    const newCount = await newDb.query('SELECT COUNT(*) as cnt FROM ' + table);
    console.log(table.padEnd(20) + oldCount.rows[0].cnt.toString().padStart(5) + newCount.rows[0].cnt.toString().padStart(15));
  }
  
  await oldDb.end();
  await newDb.end();
  
  console.log('\n========== 迁移完成 ==========');
}

main();
