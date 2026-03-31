/**
 * 创建缺失的数据表
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function createTables() {
  console.log('开始创建缺失的数据表...\n')
  
  // 创建 link_verification_queue 表
  console.log('1️⃣ 创建 link_verification_queue 表...')
  const createLinkQueueSQL = `
    CREATE TABLE IF NOT EXISTS link_verification_queue (
      id BIGINT PRIMARY KEY DEFAULT unique_rowid(),
      claim_id INT NOT NULL,
      user_id INT NOT NULL,
      task_id INT NOT NULL,
      video_url STRING(500),
      comment STRING(500),
      user_name STRING(100),
      platform STRING(50),
      task_author_name STRING(100),
      status STRING(50) DEFAULT 'pending',
      priority INT DEFAULT 0,
      scheduled_at TIMESTAMP,
      max_process_at TIMESTAMP,
      retry_count INT DEFAULT 0,
      proxy_ip STRING(50),
      proxy_used_at TIMESTAMP,
      verification_result JSONB,
      verified BOOLEAN,
      error_message STRING(500),
      screenshot_verified_at TIMESTAMP,
      processed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )
  `
  
  try {
    // 使用 Supabase RPC 执行 SQL（如果支持）
    console.log('   ⚠️  需要通过 Prisma 或直接连接执行 SQL')
    console.log('   请运行：npx prisma db execute --file create-missing-tables.sql')
  } catch (error) {
    console.log('   ❌ 创建失败:', error.message)
  }
  
  // 创建 review_rules 表
  console.log('\n2️⃣ 创建 review_rules 表...')
  const createReviewRulesSQL = `
    CREATE TABLE IF NOT EXISTS review_rules (
      id BIGINT PRIMARY KEY DEFAULT unique_rowid(),
      platform STRING(50) NOT NULL,
      action STRING(50) NOT NULL,
      is_active BOOLEAN DEFAULT true,
      ocr_enabled BOOLEAN DEFAULT true,
      ocr_provider STRING(50) DEFAULT 'paddleocr',
      ocr_confidence_threshold DECIMAL(3,2) DEFAULT 0.70,
      comment_required BOOLEAN DEFAULT true,
      comment_min_length INT DEFAULT 8,
      comment_owner_required BOOLEAN DEFAULT true,
      comment_owner_keyword STRING(50) DEFAULT '我',
      author_match_required BOOLEAN DEFAULT true,
      author_match_enabled BOOLEAN DEFAULT true,
      like_required BOOLEAN DEFAULT true,
      collect_required BOOLEAN DEFAULT true,
      ai_review_enabled BOOLEAN DEFAULT true,
      ai_review_trigger STRING(50) DEFAULT 'ocr_failed',
      ai_provider STRING(50) DEFAULT 'gemini',
      auto_approve_enabled BOOLEAN DEFAULT false,
      auto_approve_threshold DECIMAL(3,2) DEFAULT 0.85,
      auto_reject_enabled BOOLEAN DEFAULT false,
      auto_reject_threshold DECIMAL(3,2) DEFAULT 0.50,
      link_verify_enabled BOOLEAN DEFAULT true,
      link_verify_delay_minutes INT DEFAULT 15,
      link_verify_batch_threshold INT DEFAULT 5,
      link_verify_max_wait_minutes INT DEFAULT 60,
      description STRING(500),
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now(),
      created_by INT,
      updated_by INT
    )
  `
  
  try {
    console.log('   ⚠️  需要通过 Prisma 或直接连接执行 SQL')
    console.log('   请运行：npx prisma db execute --file create-missing-tables.sql')
  } catch (error) {
    console.log('   ❌ 创建失败:', error.message)
  }
  
  console.log('\n✅ 表创建 SQL 已生成')
  console.log('\n📝 手动执行步骤:')
  console.log('   1. 使用 CockroachDB 客户端连接数据库')
  console.log('   2. 执行 create-missing-tables.sql 文件中的 SQL')
  console.log('   3. 或者使用 Prisma: npx prisma db execute --file create-missing-tables.sql')
}

createTables().catch(console.error)
