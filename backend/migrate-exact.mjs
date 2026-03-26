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

// Prisma Schema 定义的字段(来自代码需求)
const prismaFields = {
  users: [
    'id', 'username', 'phone', 'password_hash', 'role', 'level',
    'total_tasks', 'total_points', 'pass_rate_30d', 'last_task_date',
    'points', 'balance', 'b_promotion_points', 'invite_code', 'invited_by',
    'c_parent_id', 'c_grand_id', 'b_inviter_id', 'status', 'created_at', 'updated_at',
    'has_blocked_account', 'blocked_account_count', 'last_blocked_at',
    'exposure_level', 'exposure_priority', 'is_whitelist', 'is_blacklist',
    'province', 'city', 'current_exposure', 'regular_used', 'reserved_used',
    'completed_tasks', 'canceled_tasks', 'avg_submit_time', 'exchanged_points',
    'task_points', 'total_approved_tasks'
  ],
  tasks: [
    'id', 'title', 'platform', 'action', 'video_url', 'description',
    'task_code', 'example_images', 'need_count', 'template_images',
    'requirements', 'base_reward', 'reward', 'remain', 'time_limit_minutes',
    'city_limit', 'province_limit', 'publisher_type', 'publisher_id',
    'platform_fee_rate', 'limit_cities', 'daily_limit', 'start_time',
    'end_time', 'status', 'created_at', 'updated_at'
  ],
  claims: [
    'id', 'user_id', 'task_id', 'title', 'platform', 'action',
    'base_reward', 'reward', 'level_coefficient', 'status', 'city', 'province',
    'platform_nickname', 'screenshots', 'expires_at', 'claimed_at',
    'submitted_at', 'reviewed_at', 'reviewer_id', 'review_note',
    'ai_review_status', 'ai_confidence', 'ai_reason', 'ai_reviewed_at',
    'image_review_status', 'image_reviewed_at', 'image_review_reason',
    'ocr_comment', 'reject_count', 'link_review_status', 'link_reviewed_at',
    'link_review_reason', 'block_status', 'review_history'
  ],
  withdrawals: [
    'id', 'user_id', 'type', 'amount', 'points', 'status',
    'wechat_info', 'reviewed_at', 'reviewer_id', 'review_note',
    'paid_at', 'created_at', 'updated_at'
  ],
  records: [
    'id', 'user_id', 'type', 'desc', 'points', 'balance', 'extra_data', 'created_at'
  ]
};

// 字段映射(旧库字段名 -> 新库字段名)
const fieldMapping = {
  users: {
    'password_hash': 'password_hash'  // 旧库可能是 encrypted_password
  }
};

async function migrateTable(tableName, prismaFieldsList) {
  console.log('\n========== 迁移 ' + tableName + ' ==========');
  
  // 获取旧库数据
  const oldData = await oldDb.query('SELECT * FROM ' + tableName + ' ORDER BY id');
  console.log('旧库数据: ' + oldData.rows.length + ' 条');
  
  // 获取新库已有数据
  const newData = await newDb.query('SELECT id FROM ' + tableName);
  const newIds = new Set(newData.rows.map(r => r.id));
  console.log('新库已有: ' + newIds.size + ' 条');
  
  let inserted = 0, updated = 0, skipped = 0, errors = 0;
  
  for (const row of oldData.rows) {
    try {
      // 构建字段和值
      const fields = [];
      const values = [];
      
      for (const field of prismaFieldsList) {
        // 跳过关联字段
        if (['claims', 'tasks', 'users', 'withdrawals', 'records', 
             'leaderboard_rewards', 'leaderboard_snapshots', 'promotion_earnings',
             'user_achievements', 'other_users'].includes(field)) continue;
        
        // 获取值(处理字段名映射)
        let value = row[field];
        
        // 特殊处理 password_hash
        if (field === 'password_hash' && value === undefined) {
          value = row.encrypted_password;
        }
        
        // 处理 JSON 类型字段
        if (['screenshots', 'example_images', 'template_images', 'requirements', 
             'limit_cities', 'review_history', 'extra_data'].includes(field)) {
          if (value && typeof value === 'string') {
            // 已经是字符串格式
          } else if (value) {
            value = JSON.stringify(value);
          } else {
            value = field === 'review_history' ? '[]' : '[]';
          }
        }
        
        // 处理时间字段
        if (['created_at', 'updated_at', 'expires_at', 'claimed_at', 'submitted_at',
             'reviewed_at', 'ai_reviewed_at', 'image_reviewed_at', 'link_reviewed_at',
             'last_task_date', 'last_blocked_at', 'start_time', 'end_time', 'paid_at'].includes(field)) {
          if (value === null || value === undefined) {
            value = null;
          }
        }
        
        // 处理默认值
        if (value === undefined || value === null) {
          // 这些字段必须有值
          if (['updated_at'].includes(field)) {
            value = row.created_at || new Date();
          }
        }
        
        fields.push(field);
        values.push(value);
      }
      
      // 检查是否已存在
      if (newIds.has(row.id)) {
        // 更新
        const setClause = fields.map((f, i) => f + ' = $' + (i + 1)).join(', ');
        const updateSql = 'UPDATE ' + tableName + ' SET ' + setClause + ' WHERE id = $' + (fields.length + 1);
        await newDb.query(updateSql, [...values, row.id]);
        updated++;
      } else {
        // 插入
        const placeholders = fields.map((_, i) => '$' + (i + 1)).join(', ');
        const insertSql = 'INSERT INTO ' + tableName + ' (' + fields.join(', ') + ') VALUES (' + placeholders + ')';
        await newDb.query(insertSql, values);
        inserted++;
      }
      
      if ((inserted + updated) % 50 === 0) {
        console.log('  进度: 插入 ' + inserted + ', 更新 ' + updated);
      }
      
    } catch (err) {
      errors++;
      if (errors <= 5) {
        console.log('  错误 ID ' + row.id + ': ' + err.message.substring(0, 100));
      }
    }
  }
  
  console.log('结果: 插入 ' + inserted + ', 更新 ' + updated + ', 跳过 ' + skipped + ', 错误 ' + errors);
  return { inserted, updated, errors };
}

async function main() {
  console.log('========== 开始数据迁移 ==========');
  console.log('时间: ' + new Date().toISOString());
  
  const results = {};
  
  // 按顺序迁移(考虑外键依赖)
  results.users = await migrateTable('users', prismaFields.users);
  results.tasks = await migrateTable('tasks', prismaFields.tasks);
  results.claims = await migrateTable('claims', prismaFields.claims);
  results.withdrawals = await migrateTable('withdrawals', prismaFields.withdrawals);
  results.records = await migrateTable('records', prismaFields.records);
  
  // 验证
  console.log('\n========== 验证结果 ==========');
  for (const table of Object.keys(prismaFields)) {
    const count = await newDb.query('SELECT COUNT(*) as cnt FROM ' + table);
    console.log(table + ': ' + count.rows[0].cnt + ' 条');
  }
  
  await oldDb.end();
  await newDb.end();
  
  console.log('\n========== 迁移完成 ==========');
}

main();
