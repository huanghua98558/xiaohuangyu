import pg from 'pg';

const { Pool } = pg;

// 旧 Supabase 数据库连接
const oldDb = new Pool({
  host: 'aws-1-ap-south-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.uupwoghhivtfapbntxzs',
  password: 'n9PMo08FHepPLg4W',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

// 新 CockroachDB 数据库连接
const newDb = new Pool({
  host: 'cotton-tern-23589.j77.aws-ap-southeast-1.cockroachlabs.cloud',
  port: 26257,
  user: '1823985558qqcom',
  password: '4-NJnwt94B-yljofZCocTw',
  database: 'xiaohuangyu',
  ssl: { rejectUnauthorized: false }
});

// 获取新库字段
async function getNewTableColumns(tableName) {
  const result = await newDb.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);
  return result.rows.map(r => r.column_name);
}

async function migrate() {
  console.log('========== 开始完整数据迁移 ==========\n');
  
  try {
    // ==================== 1. 迁移 users 数据 ====================
    console.log('=== 1. 迁移 users 数据 ===');
    
    const oldUsers = await oldDb.query('SELECT * FROM users ORDER BY id');
    const newUserColumns = await getNewTableColumns('users');
    
    console.log(`旧库 users: ${oldUsers.rows.length} 条`);
    console.log('新库字段:', newUserColumns.join(', '));
    
    let usersSuccess = 0, usersError = 0;
    
    for (const row of oldUsers.rows) {
      try {
        const fields = newUserColumns.filter(f => row[f] !== undefined || f === 'id');
        const values = fields.map(f => row[f] ?? null);
        const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
        
        await newDb.query(`
          INSERT INTO users (${fields.join(', ')})
          VALUES (${placeholders})
          ON CONFLICT (id) DO UPDATE SET
            phone = EXCLUDED.phone,
            username = EXCLUDED.username,
            points = EXCLUDED.points,
            balance = EXCLUDED.balance,
            total_points = EXCLUDED.total_points,
            total_tasks = EXCLUDED.total_tasks,
            status = EXCLUDED.status,
            role = EXCLUDED.role,
            level = EXCLUDED.level,
            updated_at = NOW()
        `, values);
        usersSuccess++;
      } catch (err) {
        usersError++;
        if (usersError <= 5) console.log('  错误 ID ' + row.id + ': ' + err.message.substring(0, 80));
      }
    }
    console.log(`Users 迁移: 成功 ${usersSuccess}, 失败 ${usersError}`);
    
    // ==================== 2. 迁移 tasks 数据 ====================
    console.log('\n=== 2. 迁移 tasks 数据 ===');
    
    const oldTasks = await oldDb.query('SELECT * FROM tasks ORDER BY id');
    const newTaskColumns = await getNewTableColumns('tasks');
    
    console.log(`旧库 tasks: ${oldTasks.rows.length} 条`);
    
    let tasksSuccess = 0, tasksError = 0;
    
    for (const row of oldTasks.rows) {
      try {
        const fields = newTaskColumns.filter(f => row[f] !== undefined || f === 'id');
        const values = fields.map(f => row[f] ?? null);
        const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
        
        await newDb.query(`
          INSERT INTO tasks (${fields.join(', ')})
          VALUES (${placeholders})
          ON CONFLICT (id) DO NOTHING
        `, values);
        tasksSuccess++;
      } catch (err) {
        tasksError++;
        if (tasksError <= 5) console.log('  错误 ID ' + row.id + ': ' + err.message.substring(0, 80));
      }
    }
    console.log(`Tasks 迁移: 成功 ${tasksSuccess}, 失败 ${tasksError}`);
    
    // ==================== 3. 迁移 claims 数据 ====================
    console.log('\n=== 3. 迁移 claims 数据 ===');
    
    const oldClaims = await oldDb.query('SELECT * FROM claims ORDER BY id');
    const newClaimColumns = await getNewTableColumns('claims');
    
    console.log(`旧库 claims: ${oldClaims.rows.length} 条`);
    console.log('新库字段:', newClaimColumns.join(', '));
    
    let claimsSuccess = 0, claimsError = 0;
    const claimsErrors = [];
    
    for (const row of oldClaims.rows) {
      try {
        // 只插入新库有的字段
        const fields = [];
        const values = [];
        
        for (const col of newClaimColumns) {
          if (col === 'reject_count') {
            fields.push('reject_count');
            values.push(0);
          } else if (col === 'ocr_comment') {
            fields.push('ocr_comment');
            values.push(null);
          } else if (row[col] !== undefined) {
            fields.push(col);
            values.push(row[col]);
          }
        }
        
        const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
        
        await newDb.query(`
          INSERT INTO claims (${fields.join(', ')})
          VALUES (${placeholders})
          ON CONFLICT (id) DO NOTHING
        `, values);
        claimsSuccess++;
        
        if (claimsSuccess % 100 === 0) console.log(`  已迁移 ${claimsSuccess} 条...`);
      } catch (err) {
        claimsError++;
        if (claimsErrors.length < 10) claimsErrors.push(`ID ${row.id}: ${err.message.substring(0, 60)}`);
      }
    }
    console.log(`Claims 迁移: 成功 ${claimsSuccess}, 失败 ${claimsError}`);
    if (claimsErrors.length > 0) {
      console.log('错误详情:', claimsErrors);
    }
    
    // ==================== 4. 迁移 withdrawals 数据 ====================
    console.log('\n=== 4. 迁移 withdrawals 数据 ===');
    
    try {
      const oldWithdrawals = await oldDb.query('SELECT * FROM withdrawals ORDER BY id');
      const newWithdrawalColumns = await getNewTableColumns('withdrawals');
      
      console.log(`旧库 withdrawals: ${oldWithdrawals.rows.length} 条`);
      
      let wSuccess = 0, wError = 0;
      
      for (const row of oldWithdrawals.rows) {
        try {
          const fields = newWithdrawalColumns.filter(f => row[f] !== undefined || f === 'id');
          const values = fields.map(f => row[f] ?? null);
          const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
          
          await newDb.query(`
            INSERT INTO withdrawals (${fields.join(', ')})
            VALUES (${placeholders})
            ON CONFLICT (id) DO NOTHING
          `, values);
          wSuccess++;
        } catch (err) {
          wError++;
        }
      }
      console.log(`Withdrawals 迁移: 成功 ${wSuccess}, 失败 ${wError}`);
    } catch (e) {
      console.log('Withdrawals 表不存在或查询失败');
    }
    
    // ==================== 5. 迁移 records 数据 ====================
    console.log('\n=== 5. 迁移 records 数据 ===');
    
    try {
      const oldRecords = await oldDb.query('SELECT * FROM records ORDER BY id LIMIT 1000');
      const newRecordColumns = await getNewTableColumns('records');
      
      console.log(`旧库 records: ${oldRecords.rows.length} 条`);
      
      let rSuccess = 0, rError = 0;
      
      for (const row of oldRecords.rows) {
        try {
          const fields = newRecordColumns.filter(f => row[f] !== undefined || f === 'id');
          const values = fields.map(f => row[f] ?? null);
          const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
          
          await newDb.query(`
            INSERT INTO records (${fields.join(', ')})
            VALUES (${placeholders})
            ON CONFLICT (id) DO NOTHING
          `, values);
          rSuccess++;
        } catch (err) {
          rError++;
        }
      }
      console.log(`Records 迁移: 成功 ${rSuccess}, 失败 ${rError}`);
    } catch (e) {
      console.log('Records 表不存在或查询失败');
    }
    
    // ==================== 验证迁移结果 ====================
    console.log('\n========== 验证迁移结果 ==========');
    
    const stats = await newDb.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM tasks) as tasks,
        (SELECT COUNT(*) FROM claims) as claims,
        (SELECT COUNT(*) FROM withdrawals) as withdrawals,
        (SELECT COUNT(*) FROM records) as records
    `);
    
    console.log('新库数据统计:');
    console.log('  Users:', stats.rows[0].users);
    console.log('  Tasks:', stats.rows[0].tasks);
    console.log('  Claims:', stats.rows[0].claims);
    console.log('  Withdrawals:', stats.rows[0].withdrawals);
    console.log('  Records:', stats.rows[0].records);
    
    // 按状态统计 claims
    const claimStats = await newDb.query(`
      SELECT status, COUNT(*) as count
      FROM claims
      GROUP BY status
      ORDER BY count DESC
    `);
    console.log('\nClaims 状态分布:');
    claimStats.rows.forEach(s => console.log('  ' + s.status + ': ' + s.count));
    
    console.log('\n========== 迁移完成 ==========');
    
  } catch (err) {
    console.error('迁移失败:', err);
  } finally {
    await oldDb.end();
    await newDb.end();
  }
}

migrate();
