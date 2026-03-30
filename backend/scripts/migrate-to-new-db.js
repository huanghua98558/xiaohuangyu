import { createClient } from '@supabase/supabase-js';

// 旧数据库配置（火山引擎）
const OLD_SUPABASE_URL = process.env.OLD_SUPABASE_URL || 'https://br-slick-skua-6010974e.supabase2.aidap-global.cn-beijing.volces.com';
const OLD_SUPABASE_KEY = process.env.OLD_SUPABASE_ANON_KEY || process.env.COZE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// 新数据库配置
const NEW_SUPABASE_URL = 'https://uupwoghhivtfapbntxzs.supabase.co';
const NEW_SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1cHdvZ2hoaXZ0ZmFwYm50eHpzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY4NTY0MSwiZXhwIjoyMDg5MjYxNjQxfQ.NopVH_WnC4GxNfmb873aTBqs_tcT6LFKM9VfPYRbBJY';

const oldDb = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY);
const newDb = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_KEY);

// 迁移顺序（按外键依赖）
const MIGRATION_ORDER = [
  { name: 'roles', primaryKey: 'id' },
  { name: 'level_configs', primaryKey: 'level' },
  { name: 'system_configs', primaryKey: 'key' },
  { name: 'configs', primaryKey: 'id' },
  { name: 'ai_configs', primaryKey: 'key' },
  { name: 'users', primaryKey: 'id' },
  { name: 'tasks', primaryKey: 'id' },
  { name: 'claims', primaryKey: 'id' },
  { name: 'records', primaryKey: 'id' },
  { name: 'withdrawals', primaryKey: 'id' },
  { name: 'leaderboard_snapshots', primaryKey: 'id' },
  { name: 'leaderboard_rewards', primaryKey: 'id' },
  { name: 'promotion_relations', primaryKey: 'id' },
  { name: 'promotion_earnings', primaryKey: 'id' },
  { name: 'ai_conversations', primaryKey: 'id' },
  { name: 'ai_messages', primaryKey: 'id' },
  { name: 'ai_operation_logs', primaryKey: 'id' },
  { name: 'ai_review_queue', primaryKey: 'id' },
  { name: 'ai_screenshot_fingerprints', primaryKey: 'id' },
  { name: 'user_credit_scores', primaryKey: 'id' },
];

async function migrateTable(tableName, primaryKey = 'id') {
  console.log(`\n📋 迁移表: ${tableName}`);
  
  try {
    // 1. 从旧数据库读取数据
    const { data: oldData, error: fetchError } = await oldDb
      .from(tableName)
      .select('*');
    
    if (fetchError) {
      console.log(`  ❌ 读取失败: ${fetchError.message}`);
      return { success: false, error: fetchError.message };
    }
    
    if (!oldData || oldData.length === 0) {
      console.log(`  ℹ️  无数据需要迁移`);
      return { success: true, count: 0 };
    }
    
    console.log(`  📊 读取到 ${oldData.length} 条记录`);
    
    // 2. 检查新数据库是否已有数据
    const { count: existingCount, error: countError } = await newDb
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.log(`  ⚠️  无法检查现有数据: ${countError.message}`);
    } else if (existingCount > 0) {
      console.log(`  ⚠️  新数据库已有 ${existingCount} 条记录，将跳过已存在的记录`);
    }
    
    // 3. 批量插入到新数据库
    let insertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // 分批处理（每批 100 条）
    const batchSize = 100;
    for (let i = 0; i < oldData.length; i += batchSize) {
      const batch = oldData.slice(i, i + batchSize);
      
      // 使用 upsert 避免主键冲突
      const { data: inserted, error: insertError } = await newDb
        .from(tableName)
        .upsert(batch, { 
          onConflict: primaryKey,
          ignoreDuplicates: false 
        });
      
      if (insertError) {
        console.log(`  ⚠️  批次插入部分失败: ${insertError.message}`);
        // 尝试逐条插入
        for (const row of batch) {
          const { error: singleError } = await newDb
            .from(tableName)
            .upsert(row, { onConflict: primaryKey });
          
          if (singleError) {
            errorCount++;
          } else {
            insertedCount++;
          }
        }
      } else {
        insertedCount += batch.length;
      }
    }
    
    console.log(`  ✅ 完成: 插入 ${insertedCount}, 跳过 ${skippedCount}, 失败 ${errorCount}`);
    return { success: true, count: insertedCount };
    
  } catch (e) {
    console.log(`  ❌ 迁移失败: ${e.message}`);
    return { success: false, error: e.message };
  }
}

async function runMigration() {
  console.log('========================================');
  console.log('开始数据库迁移');
  console.log('========================================');
  console.log(`源数据库: ${OLD_SUPABASE_URL}`);
  console.log(`目标数据库: ${NEW_SUPABASE_URL}`);
  console.log('========================================\n');
  
  const results = {};
  
  for (const table of MIGRATION_ORDER) {
    const result = await migrateTable(table.name, table.primaryKey);
    results[table.name] = result;
  }
  
  console.log('\n========================================');
  console.log('迁移完成汇总');
  console.log('========================================');
  
  let totalInserted = 0;
  let failedTables = [];
  
  for (const [table, result] of Object.entries(results)) {
    if (result.success) {
      totalInserted += result.count || 0;
      console.log(`✅ ${table}: ${result.count || 0} 条`);
    } else {
      failedTables.push(table);
      console.log(`❌ ${table}: ${result.error}`);
    }
  }
  
  console.log(`\n总计迁移: ${totalInserted} 条记录`);
  
  if (failedTables.length > 0) {
    console.log(`\n失败的表: ${failedTables.join(', ')}`);
  }
  
  console.log('\n迁移完成！');
}

// 运行迁移
runMigration().catch(console.error);
