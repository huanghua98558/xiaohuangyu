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

async function addColumn(table, column, definition) {
  try {
    await newDb.query('ALTER TABLE ' + table + ' ADD COLUMN IF NOT EXISTS ' + column + ' ' + definition);
    console.log('✅ ' + table + '.' + column);
    return true;
  } catch (err) {
    console.log('❌ ' + table + '.' + column + ': ' + err.message.substring(0, 60));
    return false;
  }
}

async function fix() {
  console.log('========== 补全剩余字段 ==========\n');
  
  // users
  await addColumn('users', 'has_blocked_account', 'BOOLEAN DEFAULT false');
  await addColumn('users', 'blocked_account_count', 'BIGINT DEFAULT 0');
  await addColumn('users', 'last_blocked_at', 'TIMESTAMP');
  await addColumn('users', 'total_approved_tasks', 'INT DEFAULT 0');
  
  // records - desc 是关键字，需要用双引号
  await addColumn('records', '"desc"', 'TEXT');
  
  // ai_conversations
  await addColumn('ai_conversations', 'status', "VARCHAR(50) DEFAULT 'active'");
  await addColumn('ai_conversations', 'updated_at', 'TIMESTAMP DEFAULT NOW()');
  
  // ai_messages
  await addColumn('ai_messages', 'metadata', "TEXT DEFAULT '{}'");
  
  // configs
  await addColumn('configs', 'type', "VARCHAR(50) DEFAULT 'text'");
  await addColumn('configs', 'category', "VARCHAR(100) DEFAULT 'general'");
  await addColumn('configs', 'is_enabled', 'BOOLEAN DEFAULT true');
  await addColumn('configs', 'created_at', 'TIMESTAMP DEFAULT NOW()');
  await addColumn('configs', 'updated_at', 'TIMESTAMP DEFAULT NOW()');
  
  // system_configs - id 可能需要特殊处理
  // 先跳过 id，因为可能需要改变主键
  
  // task_view_records
  await addColumn('task_view_records', 'viewed_at', 'TIMESTAMP DEFAULT NOW()');
  
  // user_achievements
  await addColumn('user_achievements', 'achievement_id', 'INT');
  await addColumn('user_achievements', 'earned_at', 'TIMESTAMP DEFAULT NOW()');
  await addColumn('user_achievements', 'created_at', 'TIMESTAMP DEFAULT NOW()');
  
  // audit_alerts
  await addColumn('audit_alerts', 'alert_level', "VARCHAR(20) DEFAULT 'info'");
  await addColumn('audit_alerts', 'user_id', 'INT');
  await addColumn('audit_alerts', 'ip_address', 'VARCHAR(50)');
  await addColumn('audit_alerts', 'location', 'VARCHAR(200)');
  await addColumn('audit_alerts', 'alert_detail', "TEXT DEFAULT '{}'");
  await addColumn('audit_alerts', 'is_resolved', 'BOOLEAN DEFAULT false');
  await addColumn('audit_alerts', 'resolved_by', 'INT');
  await addColumn('audit_alerts', 'resolved_at', 'TIMESTAMP');
  
  // blocked_accounts
  await addColumn('blocked_accounts', 'platform_nickname', 'VARCHAR(100)');
  await addColumn('blocked_accounts', 'platform_user_id', 'VARCHAR(100)');
  await addColumn('blocked_accounts', 'task_id', 'BIGINT');
  await addColumn('blocked_accounts', 'video_url', 'VARCHAR(500)');
  await addColumn('blocked_accounts', 'comment_content', 'TEXT');
  await addColumn('blocked_accounts', 'comment_submitted_at', 'TIMESTAMP');
  await addColumn('blocked_accounts', 'block_type', "VARCHAR(50) DEFAULT 'comment_hidden'");
  await addColumn('blocked_accounts', 'detection_method', 'VARCHAR(50)');
  await addColumn('blocked_accounts', 'reviewed_by', 'BIGINT');
  await addColumn('blocked_accounts', 'reviewed_at', 'TIMESTAMP');
  await addColumn('blocked_accounts', 'review_note', 'TEXT');
  await addColumn('blocked_accounts', 'occurrence_count', 'BIGINT DEFAULT 1');
  await addColumn('blocked_accounts', 'detected_at', 'TIMESTAMP DEFAULT NOW()');
  await addColumn('blocked_accounts', 'updated_at', 'TIMESTAMP DEFAULT NOW()');
  await addColumn('blocked_accounts', 'user_id', 'INT');
  await addColumn('blocked_accounts', 'claim_id', 'INT');
  
  // leaderboard_rewards
  await addColumn('leaderboard_rewards', 'period', 'VARCHAR(50)');
  await addColumn('leaderboard_rewards', 'rank', 'INT');
  await addColumn('leaderboard_rewards', 'reward', 'INT');
  await addColumn('leaderboard_rewards', 'claimed', 'BOOLEAN DEFAULT false');
  await addColumn('leaderboard_rewards', 'claimed_at', 'TIMESTAMP');
  
  // leaderboard_snapshots
  await addColumn('leaderboard_snapshots', 'period', 'VARCHAR(50)');
  await addColumn('leaderboard_snapshots', 'rank', 'INT');
  await addColumn('leaderboard_snapshots', 'tasks', 'INT');
  
  // promotion_earnings
  await addColumn('promotion_earnings', 'amount', 'FLOAT');
  await addColumn('promotion_earnings', 'source_user_id', 'INT');
  await addColumn('promotion_earnings', 'related_claim_id', 'INT');
  
  console.log('\n========== 完成 ==========');
  await newDb.end();
}

fix();
