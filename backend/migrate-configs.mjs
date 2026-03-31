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

async function migrateConfigs() {
  console.log('\n========== 迁移 configs 表 ==========');
  
  const oldData = await oldDb.query('SELECT * FROM configs');
  console.log('旧库数据: ' + oldData.rows.length + ' 条');
  
  let inserted = 0, updated = 0;
  
  for (const row of oldData.rows) {
    try {
      // 先尝试更新，再插入
      const existing = await newDb.query('SELECT key FROM configs WHERE key = $1', [row.key]);
      
      if (existing.rows.length > 0) {
        await newDb.query(
          'UPDATE configs SET value = $1, type = $2, description = $3, category = $4, is_enabled = $5, updated_at = NOW() WHERE key = $6',
          [row.value, row.type || 'text', row.description, row.category || 'general', row.is_enabled ?? true, row.key]
        );
        updated++;
      } else {
        await newDb.query(
          'INSERT INTO configs (key, value, type, description, category, is_enabled, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())',
          [row.key, row.value, row.type || 'text', row.description, row.category || 'general', row.is_enabled ?? true]
        );
        inserted++;
      }
    } catch (err) {
      console.log('  错误 ' + row.key + ': ' + err.message.substring(0, 50));
    }
  }
  
  console.log('结果: 插入 ' + inserted + ', 更新 ' + updated);
}

async function migrateSystemConfigs() {
  console.log('\n========== 迁移 system_configs 表 ==========');
  
  const oldData = await oldDb.query('SELECT * FROM system_configs');
  console.log('旧库数据: ' + oldData.rows.length + ' 条');
  
  let inserted = 0, updated = 0;
  
  for (const row of oldData.rows) {
    try {
      const existing = await newDb.query('SELECT key FROM system_configs WHERE key = $1', [row.key]);
      
      if (existing.rows.length > 0) {
        await newDb.query(
          'UPDATE system_configs SET value = $1, type = $2, description = $3, category = $4, is_enabled = $5, updated_at = NOW() WHERE key = $6',
          [row.value, row.type || 'text', row.description, row.category || 'general', row.is_enabled ?? true, row.key]
        );
        updated++;
      } else {
        await newDb.query(
          'INSERT INTO system_configs (key, value, type, description, category, is_enabled, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())',
          [row.key, row.value, row.type || 'text', row.description, row.category || 'general', row.is_enabled ?? true]
        );
        inserted++;
      }
    } catch (err) {
      console.log('  错误 ' + row.key + ': ' + err.message.substring(0, 50));
    }
  }
  
  console.log('结果: 插入 ' + inserted + ', 更新 ' + updated);
}

async function migrateAiConfigs() {
  console.log('\n========== 迁移 ai_configs 表 ==========');
  
  const oldData = await oldDb.query('SELECT * FROM ai_configs');
  console.log('旧库数据: ' + oldData.rows.length + ' 条');
  
  let inserted = 0, updated = 0;
  
  for (const row of oldData.rows) {
    try {
      const existing = await newDb.query('SELECT key FROM ai_configs WHERE key = $1', [row.key]);
      
      if (existing.rows.length > 0) {
        await newDb.query(
          'UPDATE ai_configs SET value = $1, type = $2, description = $3, category = $4, is_enabled = $5, updated_at = NOW() WHERE key = $6',
          [row.value, row.type || 'text', row.description, row.category || 'general', row.is_enabled ?? true, row.key]
        );
        updated++;
      } else {
        await newDb.query(
          'INSERT INTO ai_configs (key, value, type, description, category, is_enabled, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())',
          [row.key, row.value, row.type || 'text', row.description, row.category || 'general', row.is_enabled ?? true]
        );
        inserted++;
      }
    } catch (err) {
      console.log('  错误 ' + row.key + ': ' + err.message.substring(0, 50));
    }
  }
  
  console.log('结果: 插入 ' + inserted + ', 更新 ' + updated);
}

async function verify() {
  console.log('\n========== 验证迁移结果 ==========');
  
  const tables = ['configs', 'system_configs', 'ai_configs'];
  
  console.log('表名                旧库    新库');
  console.log('------------------------------------');
  
  for (const table of tables) {
    const oldCount = await oldDb.query('SELECT COUNT(*) as cnt FROM ' + table);
    const newCount = await newDb.query('SELECT COUNT(*) as cnt FROM ' + table);
    console.log(table.padEnd(20) + oldCount.rows[0].cnt.toString().padStart(5) + newCount.rows[0].cnt.toString().padStart(8));
  }
}

async function main() {
  await migrateConfigs();
  await migrateSystemConfigs();
  await migrateAiConfigs();
  await verify();
  
  await oldDb.end();
  await newDb.end();
  
  console.log('\n========== 迁移完成 ==========');
}

main();
