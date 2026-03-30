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

// Prisma Schema 定义的模型和字段
const prismaSchema = {
  achievements: ['id', 'name', 'description', 'condition_type', 'condition_value', 'reward_points', 'sort_order', 'is_active', 'created_at'],
  admin_notifications: ['id', 'type', 'title', 'content', 'data', 'priority', 'is_read', 'created_at'],
  ai_configs: ['key', 'value', 'type', 'description', 'category', 'is_enabled', 'created_at', 'updated_at'],
  ai_conversations: ['id', 'user_id', 'type', 'title', 'context', 'status', 'created_at', 'updated_at'],
  ai_messages: ['id', 'conversation_id', 'role', 'content', 'metadata', 'created_at'],
  ai_operation_logs: ['id', 'user_id', 'type', 'action', 'input', 'output', 'status', 'error_msg', 'duration', 'created_at'],
  ai_review_queue: ['id', 'claim_id', 'user_id', 'task_id', 'screenshots', 'ai_result', 'ai_confidence', 'ai_reason', 'status', 'priority', 'retry_count', 'processed_at', 'processed_by', 'created_at', 'updated_at'],
  ai_screenshot_fingerprints: ['id', 'user_id', 'claim_id', 'image_url', 'fingerprint', 'status', 'reason', 'created_at'],
  audit_alerts: ['id', 'alert_type', 'alert_level', 'user_id', 'ip_address', 'location', 'alert_detail', 'is_resolved', 'resolved_by', 'resolved_at', 'created_at'],
  blocked_accounts: ['id', 'platform', 'platform_nickname', 'platform_user_id', 'task_id', 'video_url', 'comment_content', 'comment_submitted_at', 'block_type', 'detection_method', 'status', 'reviewed_by', 'reviewed_at', 'review_note', 'occurrence_count', 'detected_at', 'created_at', 'updated_at', 'user_id', 'claim_id'],
  claims: ['id', 'user_id', 'task_id', 'title', 'platform', 'action', 'base_reward', 'reward', 'level_coefficient', 'status', 'city', 'province', 'platform_nickname', 'screenshots', 'expires_at', 'claimed_at', 'submitted_at', 'reviewed_at', 'reviewer_id', 'review_note', 'ai_review_status', 'ai_confidence', 'ai_reason', 'ai_reviewed_at', 'image_review_status', 'image_reviewed_at', 'image_review_reason', 'ocr_comment', 'reject_count', 'link_review_status', 'link_reviewed_at', 'link_review_reason', 'block_status', 'review_history'],
  configs: ['key', 'value', 'type', 'description', 'category', 'is_enabled', 'created_at', 'updated_at'],
  leaderboard_rewards: ['id', 'user_id', 'period', 'rank', 'reward', 'claimed', 'claimed_at', 'created_at'],
  leaderboard_snapshots: ['id', 'user_id', 'period', 'rank', 'points', 'tasks', 'created_at'],
  promotion_earnings: ['id', 'user_id', 'type', 'amount', 'source_user_id', 'related_claim_id', 'status', 'created_at'],
  promotion_relations: ['id', 'parent_id', 'child_id', 'level', 'created_at'],
  records: ['id', 'user_id', 'type', 'desc', 'points', 'balance', 'extra_data', 'created_at'],
  system_configs: ['id', 'key', 'value', 'type', 'description', 'category', 'is_enabled', 'created_at', 'updated_at'],
  task_view_records: ['id', 'user_id', 'task_id', 'viewed_at', 'created_at'],
  tasks: ['id', 'title', 'platform', 'action', 'video_url', 'description', 'task_code', 'example_images', 'need_count', 'template_images', 'requirements', 'base_reward', 'reward', 'remain', 'time_limit_minutes', 'city_limit', 'province_limit', 'publisher_type', 'publisher_id', 'platform_fee_rate', 'limit_cities', 'daily_limit', 'start_time', 'end_time', 'status', 'created_at', 'updated_at'],
  user_achievements: ['id', 'user_id', 'achievement_id', 'earned_at', 'created_at'],
  users: ['id', 'username', 'phone', 'password_hash', 'role', 'level', 'total_tasks', 'total_points', 'pass_rate_30d', 'last_task_date', 'points', 'balance', 'b_promotion_points', 'invite_code', 'invited_by', 'c_parent_id', 'c_grand_id', 'b_inviter_id', 'status', 'created_at', 'updated_at', 'has_blocked_account', 'blocked_account_count', 'last_blocked_at', 'exposure_level', 'exposure_priority', 'is_whitelist', 'is_blacklist', 'province', 'city', 'current_exposure', 'regular_used', 'reserved_used', 'completed_tasks', 'canceled_tasks', 'avg_submit_time', 'exchanged_points', 'task_points', 'total_approved_tasks'],
  withdrawals: ['id', 'user_id', 'type', 'amount', 'points', 'status', 'wechat_info', 'reviewed_at', 'reviewer_id', 'review_note', 'paid_at', 'created_at', 'updated_at'],
  balance_logs: ['id', 'user_id', 'admin_id', 'old_balance', 'new_balance', 'change', 'type', 'description', 'related_id', 'created_at'],
  ai_quick_templates: ['id', 'user_id', 'name', 'platform', 'action', 'reward', 'remain', 'time_limit_minutes', 'description', 'is_default', 'sort_order', 'status', 'created_at', 'updated_at']
};

async function verify() {
  console.log('========== 验证结果 ==========\n');
  
  let totalTables = 0;
  let completeTables = 0;
  const stillMissing = [];
  
  for (const [table, fields] of Object.entries(prismaSchema)) {
    totalTables++;
    
    try {
      const result = await newDb.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = $1
      `, [table]);
      
      if (result.rows.length === 0) {
        stillMissing.push({ table, missing: ['表不存在'] });
        console.log('❌ ' + table + ': 表不存在');
        continue;
      }
      
      const dbFields = new Set(result.rows.map(r => r.column_name));
      const missing = fields.filter(f => !dbFields.has(f));
      
      if (missing.length === 0) {
        completeTables++;
        console.log('✅ ' + table + ': 完整 (' + fields.length + ' 字段)');
      } else {
        stillMissing.push({ table, missing });
        console.log('⚠️ ' + table + ': 缺 ' + missing.length + ' 字段 - ' + missing.join(', '));
      }
    } catch (err) {
      console.log('❌ ' + table + ': 查询失败');
    }
  }
  
  console.log('\n========== 统计 ==========');
  console.log('完整表: ' + completeTables + '/' + totalTables);
  
  if (stillMissing.length > 0) {
    console.log('\n仍需处理的表/字段:');
    stillMissing.forEach(m => {
      console.log('  ' + m.table + ': ' + m.missing.join(', '));
    });
  } else {
    console.log('\n✅ 所有表和字段已完整!');
  }
  
  await newDb.end();
}

verify();
