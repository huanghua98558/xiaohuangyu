const { Pool } = require('pg');

async function migrate() {
  // 使用环境变量中的数据库连接
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('错误: DATABASE_URL 环境变量未设置');
    process.exit(1);
  }
  
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  
  try {
    console.log('开始迁移...');
    
    // 添加图片审核字段
    await client.query('ALTER TABLE claims ADD COLUMN IF NOT EXISTS image_review_status VARCHAR(20)');
    console.log('✓ 添加 image_review_status');
    
    await client.query('ALTER TABLE claims ADD COLUMN IF NOT EXISTS image_reviewed_at TIMESTAMP');
    console.log('✓ 添加 image_reviewed_at');
    
    await client.query('ALTER TABLE claims ADD COLUMN IF NOT EXISTS image_review_reason TEXT');
    console.log('✓ 添加 image_review_reason');
    
    // 添加链接审查字段
    await client.query('ALTER TABLE claims ADD COLUMN IF NOT EXISTS link_review_status VARCHAR(20)');
    console.log('✓ 添加 link_review_status');
    
    await client.query('ALTER TABLE claims ADD COLUMN IF NOT EXISTS link_reviewed_at TIMESTAMP');
    console.log('✓ 添加 link_reviewed_at');
    
    await client.query('ALTER TABLE claims ADD COLUMN IF NOT EXISTS link_review_reason TEXT');
    console.log('✓ 添加 link_review_reason');
    
    // 添加其他缺失字段
    await client.query('ALTER TABLE claims ADD COLUMN IF NOT EXISTS reject_count BIGINT DEFAULT 0');
    console.log('✓ 添加 reject_count');
    
    await client.query('ALTER TABLE claims ADD COLUMN IF NOT EXISTS ocr_comment TEXT');
    console.log('✓ 添加 ocr_comment');
    
    await client.query('ALTER TABLE claims ADD COLUMN IF NOT EXISTS block_status VARCHAR(20) DEFAULT \'none\'');
    console.log('✓ 添加 block_status');
    
    await client.query('ALTER TABLE claims ADD COLUMN IF NOT EXISTS review_history JSONB DEFAULT \'[]\'::jsonb');
    console.log('✓ 添加 review_history');
    
    // 创建索引
    await client.query('CREATE INDEX IF NOT EXISTS idx_claims_image_review_status ON claims(image_review_status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_claims_link_review_status ON claims(link_review_status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_claims_block_status ON claims(block_status)');
    console.log('✓ 创建索引');
    
    console.log('\n迁移完成！');
  } catch (error) {
    console.error('迁移失败:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
