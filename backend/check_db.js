const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkDatabase() {
  console.log('=== 数据库结构检查 ===');
  console.log('');
  
  // 1. 检查blocked_accounts表
  console.log('1. 检查blocked_accounts表...');
  try {
    const { data, error } = await supabase
      .from('blocked_accounts')
      .select('id')
      .limit(1);
    
    if (error) {
      if (error.code === '42P01') {
        console.log('   ❌ 表不存在，需要创建');
      } else {
        console.log('   错误:', error.message);
      }
    } else {
      console.log('   ✅ 表已存在');
    }
  } catch (e) {
    console.log('   错误:', e.message);
  }
  
  // 2. 检查admin_notifications表
  console.log('');
  console.log('2. 检查admin_notifications表...');
  try {
    const { error } = await supabase
      .from('admin_notifications')
      .select('id')
      .limit(1);
    
    if (error && error.code === '42P01') {
      console.log('   ❌ 表不存在，需要创建');
    } else {
      console.log('   ✅ 表已存在');
    }
  } catch (e) {}
  
  // 3. 检查user_notifications表
  console.log('');
  console.log('3. 检查user_notifications表...');
  try {
    const { error } = await supabase
      .from('user_notifications')
      .select('id')
      .limit(1);
    
    if (error && error.code === '42P01') {
      console.log('   ❌ 表不存在，需要创建');
    } else {
      console.log('   ✅ 表已存在');
    }
  } catch (e) {}
  
  // 4. 检查claims表字段
  console.log('');
  console.log('4. 检查claims表字段...');
  try {
    const { data, error } = await supabase
      .from('claims')
      .select('*')
      .limit(1);
    
    if (data && data[0]) {
      const fields = Object.keys(data[0]);
      console.log('   现有字段数:', fields.length);
      
      if (fields.includes('block_status')) {
        console.log('   ✅ block_status字段已存在');
      } else {
        console.log('   ❌ block_status字段不存在，需要添加');
      }
      
      if (fields.includes('review_history')) {
        console.log('   ✅ review_history字段已存在');
      } else {
        console.log('   ❌ review_history字段不存在，需要添加');
      }
    }
  } catch (e) {
    console.log('   错误:', e.message);
  }
  
  // 5. 检查users表字段
  console.log('');
  console.log('5. 检查users表字段...');
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (data && data[0]) {
      const fields = Object.keys(data[0]);
      
      if (fields.includes('has_blocked_account')) {
        console.log('   ✅ has_blocked_account字段已存在');
      } else {
        console.log('   ❌ has_blocked_account字段不存在，需要添加');
      }
      
      if (fields.includes('blocked_account_count')) {
        console.log('   ✅ blocked_account_count字段已存在');
      } else {
        console.log('   ❌ blocked_account_count字段不存在，需要添加');
      }
      
      if (fields.includes('last_blocked_at')) {
        console.log('   ✅ last_blocked_at字段已存在');
      } else {
        console.log('   ❌ last_blocked_at字段不存在，需要添加');
      }
    }
  } catch (e) {
    console.log('   错误:', e.message);
  }
  
  console.log('');
  console.log('=== 检查完成 ===');
}

checkDatabase();
