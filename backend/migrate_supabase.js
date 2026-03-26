
const { createClient } = require('@supabase/supabase-js');

async function migrate() {
  // 使用Service Role Key（有管理员权限）
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('开始迁移...');

  try {
    // 使用RPC执行原始SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        ALTER TABLE claims ADD COLUMN IF NOT EXISTS image_review_status VARCHAR(20);
        ALTER TABLE claims ADD COLUMN IF NOT EXISTS image_reviewed_at TIMESTAMP;
        ALTER TABLE claims ADD COLUMN IF NOT EXISTS image_review_reason TEXT;
        ALTER TABLE claims ADD COLUMN IF NOT EXISTS link_review_status VARCHAR(20);
        ALTER TABLE claims ADD COLUMN IF NOT EXISTS link_reviewed_at TIMESTAMP;
        ALTER TABLE claims ADD COLUMN IF NOT EXISTS link_review_reason TEXT;
      `
    });

    if (error) {
      console.log('RPC方法不存在，使用直接插入方式...');
      
      // 检查字段是否已存在
      const { data: columns, error: colError } = await supabase
        .from('claims')
        .select('id')
        .limit(1);
      
      if (colError) {
        console.error('查询失败:', colError.message);
      } else {
        console.log('表连接成功，准备手动添加字段...');
        console.log('\n请手动在Supabase Dashboard执行以下SQL:');
        console.log('========================================');
        console.log(`
ALTER TABLE claims ADD COLUMN IF NOT EXISTS image_review_status VARCHAR(20);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS image_reviewed_at TIMESTAMP;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS image_review_reason TEXT;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS link_review_status VARCHAR(20);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS link_reviewed_at TIMESTAMP;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS link_review_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_claims_image_review_status ON claims(image_review_status);
CREATE INDEX IF NOT EXISTS idx_claims_link_review_status ON claims(link_review_status);
        `);
        console.log('========================================');
        console.log('\nSupabase Dashboard URL:');
        console.log('https://supabase.com/dashboard/project/uupwoghhivtfapbntxzs/sql');
      }
    } else {
      console.log('迁移成功！');
    }
  } catch (err) {
    console.error('执行失败:', err.message);
  }
}

migrate();

