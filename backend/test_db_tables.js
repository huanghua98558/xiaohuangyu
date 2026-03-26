/**
 * 数据库表结构验证脚本
 * 检查必需的表是否存在
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const REQUIRED_TABLES = [
  'blocked_accounts',
  'admin_notifications',
  'user_notifications',
  'claims',
  'claim_links',
  'claim_images',
  'claim_reviews',
  'review_queue',
  'link_verify_queue',
  'users'
];

async function checkTables() {
  console.log('🔍 开始检查数据库表结构...\n');
  
  const results = {};
  
  for (const table of REQUIRED_TABLES) {
    try {
      // 尝试查询表（只查 1 条记录）
      const { data, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .limit(1);
      
      if (error) {
        if (error.code === '42P01') {
          // 表不存在
          results[table] = { exists: false, error: '表不存在' };
          console.log(`❌ ${table}: 表不存在`);
        } else {
          // 其他错误
          results[table] = { exists: false, error: error.message };
          console.log(`⚠️  ${table}: 查询失败 - ${error.message}`);
        }
      } else {
        // 表存在
        results[table] = { exists: true };
        console.log(`✅ ${table}: 表存在`);
      }
    } catch (error) {
      results[table] = { exists: false, error: error.message };
      console.log(`❌ ${table}: 异常 - ${error.message}`);
    }
  }
  
  console.log('\n📊 检查结果汇总:');
  console.log('==============');
  const existsCount = Object.values(results).filter(r => r.exists).length;
  const notExistsCount = Object.values(results).filter(r => !r.exists).length;
  
  console.log(`✅ 存在的表：${existsCount}`);
  console.log(`❌ 不存在的表：${notExistsCount}`);
  
  if (notExistsCount > 0) {
    console.log('\n⚠️  以下表需要创建:');
    Object.entries(results)
      .filter(([_, r]) => !r.exists)
      .forEach(([table, r]) => {
        console.log(`  - ${table}: ${r.error}`);
      });
  }
  
  return results;
}

// 检查 blocked_accounts 表的字段
async function checkBlockedAccountsFields() {
  console.log('\n🔍 检查 blocked_accounts 表字段...\n');
  
  try {
    const { data, error } = await supabase
      .from('blocked_accounts')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log(`❌ 查询失败：${error.message}`);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('✅ 表中有数据，字段包括:');
      console.log(Object.keys(data[0]).join(', '));
    } else {
      console.log('ℹ️  表中暂无数据，但表结构存在');
    }
  } catch (error) {
    console.log(`❌ 检查失败：${error.message}`);
  }
}

// 检查 admin_notifications 表的字段
async function checkAdminNotificationsFields() {
  console.log('\n🔍 检查 admin_notifications 表字段...\n');
  
  try {
    const { data, error } = await supabase
      .from('admin_notifications')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log(`❌ 查询失败：${error.message}`);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('✅ 表中有数据，字段包括:');
      console.log(Object.keys(data[0]).join(', '));
    } else {
      console.log('ℹ️  表中暂无数据，但表结构存在');
    }
  } catch (error) {
    console.log(`❌ 检查失败：${error.message}`);
  }
}

// 检查 user_notifications 表的字段
async function checkUserNotificationsFields() {
  console.log('\n🔍 检查 user_notifications 表字段...\n');
  
  try {
    const { data, error } = await supabase
      .from('user_notifications')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log(`❌ 查询失败：${error.message}`);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('✅ 表中有数据，字段包括:');
      console.log(Object.keys(data[0]).join(', '));
    } else {
      console.log('ℹ️  表中暂无数据，但表结构存在');
    }
  } catch (error) {
    console.log(`❌ 检查失败：${error.message}`);
  }
}

async function main() {
  console.log('=====================================');
  console.log('   数据库表结构验证工具');
  console.log('=====================================\n');
  
  const results = await checkTables();
  
  // 如果关键表存在，检查字段
  if (results['blocked_accounts']?.exists) {
    await checkBlockedAccountsFields();
  }
  
  if (results['admin_notifications']?.exists) {
    await checkAdminNotificationsFields();
  }
  
  if (results['user_notifications']?.exists) {
    await checkUserNotificationsFields();
  }
  
  console.log('\n=====================================');
  console.log('   验证完成');
  console.log('=====================================\n');
}

main().catch(console.error);
