import pg from 'pg';

const { Pool } = pg;

const newDb = new Pool({
  host: 'cotton-tern-23589.j77.aws-ap-southeast-1.cockroachlabs.cloud',
  port: 26257,
  user: '1823985558qqcom',
  password: '4-NJnwt94B-yljofZCocTw',
  database: 'xiaohuangyu',
  ssl: { rejectUnauthorized: false }
});

// 需要添加的字段 - 基于 Prisma Schema 和业务需求
const columnsToAdd = {
  users: [
    // V2.0 曝光系统字段
    { name: 'exposure_level', type: 'INT', default: '1' },
    { name: 'exposure_priority', type: 'INT', default: '50' },
    { name: 'is_whitelist', type: 'BOOLEAN', default: 'false' },
    { name: 'is_blacklist', type: 'BOOLEAN', default: 'false' },
    { name: 'province', type: 'VARCHAR(100)', default: null },
    { name: 'city', type: 'VARCHAR(100)', default: null },
    { name: 'current_exposure', type: 'INT', default: '0' },
    { name: 'regular_used', type: 'INT', default: '0' },
    { name: 'reserved_used', type: 'INT', default: '0' },
    { name: 'completed_tasks', type: 'INT', default: '0' },
    { name: 'canceled_tasks', type: 'INT', default: '0' },
    { name: 'avg_submit_time', type: 'FLOAT', default: '0' },
    { name: 'exchanged_points', type: 'INT', default: '0' },
    { name: 'task_points', type: 'INT', default: '0' },
    { name: 'total_approved_tasks', type: 'INT', default: '0' },
    // 封号相关字段
    { name: 'has_blocked_account', type: 'BOOLEAN', default: 'false' },
    { name: 'blocked_account_count', type: 'BIGINT', default: '0' },
    { name: 'last_blocked_at', type: 'TIMESTAMP', default: null },
    // 其他业务字段
    { name: 'bonus_points', type: 'INT', default: '0' },
    { name: 'bonus_unlocked_1', type: 'BOOLEAN', default: 'false' },
    { name: 'bonus_unlocked_2', type: 'BOOLEAN', default: 'false' },
    { name: 'bonus_unlocked_3', type: 'BOOLEAN', default: 'false' },
    { name: 'bonus_unlock_1_at', type: 'TIMESTAMP', default: null },
    { name: 'bonus_unlock_2_at', type: 'TIMESTAMP', default: null },
    { name: 'bonus_unlock_3_at', type: 'TIMESTAMP', default: null },
    { name: 'first_withdraw_done', type: 'BOOLEAN', default: 'false' },
  ],
  tasks: [
    { name: 'clean_url', type: 'TEXT', default: null },
    { name: 'exposure_limit', type: 'INT', default: '0' },
    { name: 'publisher_name', type: 'VARCHAR(100)', default: null },
    { name: 'publisher_level', type: 'INT', default: '1' },
    { name: 'publisher_avatar', type: 'VARCHAR(500)', default: null },
    { name: 'publisher_verified', type: 'BOOLEAN', default: 'false' },
    { name: 'exposure_enabled', type: 'BOOLEAN', default: 'false' },
    { name: 'publisher_ip', type: 'VARCHAR(50)', default: null },
    { name: 'publisher_location', type: 'VARCHAR(200)', default: null },
    { name: 'updated_at', type: 'TIMESTAMP', default: 'NOW()' },
  ],
  claims: [
    { name: 'evaluation', type: 'JSONB', default: null },
    { name: 'link_verified', type: 'BOOLEAN', default: null },
    { name: 'link_verify_result', type: 'JSONB', default: null },
    { name: 'night_coefficient', type: 'FLOAT', default: null },
    { name: 'online_users', type: 'INT', default: null },
    { name: 'reviewer_ip', type: 'VARCHAR(50)', default: null },
    { name: 'reviewer_location', type: 'VARCHAR(200)', default: null },
  ],
  records: [
    { name: 'desc', type: 'TEXT', default: null },
  ],
  ai_conversations: [
    { name: 'updated_at', type: 'TIMESTAMP', default: 'NOW()' },
  ],
  system_configs: [
    { name: 'updated_at', type: 'TIMESTAMP', default: 'NOW()' },
  ],
};

async function addColumns() {
  console.log('========== 开始添加缺失字段 ==========\n');
  
  for (const [table, columns] of Object.entries(columnsToAdd)) {
    console.log('=== 处理表: ' + table + ' ===');
    
    for (const col of columns) {
      try {
        let sql = 'ALTER TABLE ' + table + ' ADD COLUMN IF NOT EXISTS ' + col.name + ' ' + col.type;
        if (col.default !== null) {
          sql += ' DEFAULT ' + col.default;
        }
        
        await newDb.query(sql);
        console.log('  ✅ 添加字段: ' + col.name);
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log('  ⏭️ 字段已存在: ' + col.name);
        } else {
          console.log('  ❌ 添加失败: ' + col.name + ' - ' + err.message.substring(0, 60));
        }
      }
    }
  }
  
  // 验证结果
  console.log('\n========== 验证字段 ==========');
  
  for (const table of ['users', 'tasks', 'claims', 'records']) {
    const result = await newDb.query(
      "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name = $1",
      [table]
    );
    console.log(table + ' 表字段数: ' + result.rows[0].count);
  }
  
  await newDb.end();
  console.log('\n========== 完成 ==========');
}

addColumns();
