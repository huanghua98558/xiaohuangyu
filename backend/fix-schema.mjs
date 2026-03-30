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

async function execute(sql, desc) {
  try {
    await newDb.query(sql);
    console.log('✅ ' + desc);
    return true;
  } catch (err) {
    if (err.message.includes('already exists') || err.message.includes('duplicate')) {
      console.log('⏭️ 已存在: ' + desc);
    } else {
      console.log('❌ 失败: ' + desc + ' - ' + err.message.substring(0, 60));
    }
    return false;
  }
}

async function fixSchema() {
  console.log('========== 开始补全缺失的表和字段 ==========\n');
  
  // ========== 1. 创建缺失的表 ==========
  console.log('=== 创建缺失的表 ===');
  
  // achievements 表
  await execute(`
    CREATE TABLE IF NOT EXISTS achievements (
      id INT PRIMARY KEY DEFAULT unique_rowid(),
      name VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      condition_type VARCHAR(100) NOT NULL,
      condition_value INT NOT NULL,
      reward_points INT DEFAULT 0,
      sort_order INT DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `, '创建 achievements 表');
  
  // admin_notifications 表
  await execute(`
    CREATE TABLE IF NOT EXISTS admin_notifications (
      id BIGINT PRIMARY KEY DEFAULT unique_rowid(),
      type VARCHAR(50) NOT NULL,
      title VARCHAR(200) NOT NULL,
      content TEXT,
      data JSONB,
      priority VARCHAR(20) DEFAULT 'normal',
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `, '创建 admin_notifications 表');
  
  // ai_configs 表
  await execute(`
    CREATE TABLE IF NOT EXISTS ai_configs (
      key VARCHAR(255) PRIMARY KEY,
      value TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'text',
      description TEXT,
      category VARCHAR(100) DEFAULT 'general',
      is_enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `, '创建 ai_configs 表');
  
  // ai_review_queue 表
  await execute(`
    CREATE TABLE IF NOT EXISTS ai_review_queue (
      id BIGINT PRIMARY KEY DEFAULT unique_rowid(),
      claim_id INT UNIQUE NOT NULL,
      user_id INT NOT NULL,
      task_id BIGINT NOT NULL,
      screenshots TEXT DEFAULT '[]',
      ai_result TEXT,
      ai_confidence FLOAT,
      ai_reason TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      priority INT DEFAULT 0,
      retry_count INT DEFAULT 0,
      processed_at TIMESTAMP,
      processed_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `, '创建 ai_review_queue 表');
  
  // ai_screenshot_fingerprints 表
  await execute(`
    CREATE TABLE IF NOT EXISTS ai_screenshot_fingerprints (
      id INT PRIMARY KEY DEFAULT unique_rowid(),
      user_id INT NOT NULL,
      claim_id INT,
      image_url TEXT NOT NULL,
      fingerprint VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'valid',
      reason TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `, '创建 ai_screenshot_fingerprints 表');
  
  // balance_logs 表
  await execute(`
    CREATE TABLE IF NOT EXISTS balance_logs (
      id BIGINT PRIMARY KEY DEFAULT unique_rowid(),
      user_id INT NOT NULL,
      admin_id INT,
      old_balance FLOAT DEFAULT 0,
      new_balance FLOAT DEFAULT 0,
      change FLOAT DEFAULT 0,
      type VARCHAR(50) DEFAULT 'admin_adjust',
      description TEXT,
      related_id INT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `, '创建 balance_logs 表');
  
  // ai_quick_templates 表
  await execute(`
    CREATE TABLE IF NOT EXISTS ai_quick_templates (
      id INT PRIMARY KEY DEFAULT unique_rowid(),
      user_id VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      platform VARCHAR(100) NOT NULL,
      action VARCHAR(100) DEFAULT 'short_video_research',
      reward INT DEFAULT 3,
      remain INT DEFAULT 10,
      time_limit_minutes INT DEFAULT 10,
      description TEXT,
      is_default BOOLEAN DEFAULT false,
      sort_order INT DEFAULT 0,
      status VARCHAR(50) DEFAULT 'online',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `, '创建 ai_quick_templates 表');
  
  // ========== 2. 补全缺失的字段 ==========
  console.log('\n=== 补全缺失的字段 ===');
  
  // users 表
  await execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS has_blocked_account BOOLEAN DEFAULT false', 'users.has_blocked_account');
  await execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_account_count BIGINT DEFAULT 0', 'users.blocked_account_count');
  await execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_blocked_at TIMESTAMP', 'users.last_blocked_at');
  await execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS task_points INT DEFAULT 0', 'users.task_points');
  await execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS total_approved_tasks INT DEFAULT 0', 'users.total_approved_tasks');
  
  // records 表 - 添加 desc 字段
  await execute('ALTER TABLE records ADD COLUMN IF NOT EXISTS "desc" TEXT', 'records.desc');
  
  // ai_conversations 表
  await execute('ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'active\'', 'ai_conversations.status');
  await execute('ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()', 'ai_conversations.updated_at');
  
  // ai_messages 表
  await execute('ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS metadata TEXT DEFAULT \'{}\'', 'ai_messages.metadata');
  
  // configs 表
  await execute('ALTER TABLE configs ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT \'text\'', 'configs.type');
  await execute('ALTER TABLE configs ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT \'general\'', 'configs.category');
  await execute('ALTER TABLE configs ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true', 'configs.is_enabled');
  await execute('ALTER TABLE configs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()', 'configs.created_at');
  await execute('ALTER TABLE configs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()', 'configs.updated_at');
  
  // system_configs 表
  await execute('ALTER TABLE system_configs ADD COLUMN IF NOT EXISTS id INT PRIMARY KEY DEFAULT unique_rowid()', 'system_configs.id');
  await execute('ALTER TABLE system_configs ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT \'text\'', 'system_configs.type');
  await execute('ALTER TABLE system_configs ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT \'general\'', 'system_configs.category');
  await execute('ALTER TABLE system_configs ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT true', 'system_configs.is_enabled');
  
  // task_view_records 表
  await execute('ALTER TABLE task_view_records ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP DEFAULT NOW()', 'task_view_records.viewed_at');
  
  // user_achievements 表
  await execute('ALTER TABLE user_achievements ADD COLUMN IF NOT EXISTS achievement_id INT', 'user_achievements.achievement_id');
  await execute('ALTER TABLE user_achievements ADD COLUMN IF NOT EXISTS earned_at TIMESTAMP DEFAULT NOW()', 'user_achievements.earned_at');
  await execute('ALTER TABLE user_achievements ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()', 'user_achievements.created_at');
  
  // ========== 3. 创建索引 ==========
  console.log('\n=== 创建索引 ===');
  
  await execute('CREATE INDEX IF NOT EXISTS idx_achievements_name ON achievements(name)', 'achievements name 索引');
  await execute('CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications(created_at)', 'admin_notifications created_at 索引');
  await execute('CREATE INDEX IF NOT EXISTS idx_ai_configs_category ON ai_configs(category)', 'ai_configs category 索引');
  await execute('CREATE INDEX IF NOT EXISTS idx_ai_review_queue_claim_id ON ai_review_queue(claim_id)', 'ai_review_queue claim_id 索引');
  await execute('CREATE INDEX IF NOT EXISTS idx_ai_review_queue_status ON ai_review_queue(status)', 'ai_review_queue status 索引');
  await execute('CREATE INDEX IF NOT EXISTS idx_balance_logs_user_id ON balance_logs(user_id)', 'balance_logs user_id 索引');
  await execute('CREATE INDEX IF NOT EXISTS idx_ai_quick_templates_user_id ON ai_quick_templates(user_id)', 'ai_quick_templates user_id 索引');
  
  console.log('\n========== 补全完成 ==========');
  
  await newDb.end();
}

fixSchema();
