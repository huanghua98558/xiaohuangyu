/**
 * 执行曝光系统表创建脚本（简化版）
 */

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const prisma = new PrismaClient()

async function runMigration() {
  console.log('\n=== 开始创建曝光系统表 ===\n')
  
  try {
    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, 'prisma/migrations/20260321_create_exposure_system/init.sql')
    const sql = fs.readFileSync(sqlPath, 'utf-8')
    
    console.log('执行 SQL 语句（1）：创建 task_exposure 表...')
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS task_exposure (
        id BIGINT PRIMARY KEY DEFAULT unique_rowid(),
        task_id BIGINT NOT NULL,
        need_count INT NOT NULL DEFAULT 0,
        initial_exposure INT NOT NULL DEFAULT 0,
        current_exposure INT NOT NULL DEFAULT 0,
        max_exposure INT NOT NULL DEFAULT 0,
        accepted_count INT NOT NULL DEFAULT 0,
        submitted_count INT NOT NULL DEFAULT 0,
        status STRING NOT NULL DEFAULT 'active',
        queue_position INT NOT NULL DEFAULT 0,
        unlocked_at TIMESTAMP NULL,
        last_check_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `)
    console.log('✅ task_exposure 表创建成功')
    
    console.log('\n执行 SQL 语句（2）：创建 task_exposure_logs 表...')
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS task_exposure_logs (
        id BIGINT PRIMARY KEY DEFAULT unique_rowid(),
        task_id BIGINT NOT NULL,
        event_type STRING NOT NULL,
        exposure_before INT NOT NULL DEFAULT 0,
        exposure_after INT NOT NULL DEFAULT 0,
        exposure_add INT NOT NULL DEFAULT 0,
        accept_rate FLOAT NULL,
        reason STRING NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `)
    console.log('✅ task_exposure_logs 表创建成功')
    
    console.log('\n执行 SQL 语句（3）：创建 exposure_config 表...')
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS exposure_config (
        id BIGINT PRIMARY KEY DEFAULT unique_rowid(),
        is_active BOOLEAN NOT NULL DEFAULT true,
        initial_coefficient FLOAT NOT NULL DEFAULT 1.0,
        initial_min_extra INT NOT NULL DEFAULT 5,
        initial_max_extra INT NOT NULL DEFAULT 10,
        max_coefficient FLOAT NOT NULL DEFAULT 3.0,
        check_interval_minutes INT NOT NULL DEFAULT 5,
        add_ratio_high FLOAT NOT NULL DEFAULT 0.3,
        add_ratio_mid FLOAT NOT NULL DEFAULT 0.5,
        add_ratio_low FLOAT NOT NULL DEFAULT 1.0,
        rate_threshold_high FLOAT NOT NULL DEFAULT 0.7,
        rate_threshold_mid FLOAT NOT NULL DEFAULT 0.4,
        rate_threshold_low FLOAT NOT NULL DEFAULT 0.2,
        exposure_mode STRING NOT NULL DEFAULT 'priority',
        sequential_threshold FLOAT NOT NULL DEFAULT 0.8,
        exposure_window INT NOT NULL DEFAULT 9999,
        whitelist_bonus FLOAT NOT NULL DEFAULT 100,
        blacklist_penalty FLOAT NOT NULL DEFAULT -50,
        activity_weight FLOAT NOT NULL DEFAULT 0.4,
        speed_weight FLOAT NOT NULL DEFAULT 0.3,
        completion_weight FLOAT NOT NULL DEFAULT 0.3,
        city_exposure_limit INT NOT NULL DEFAULT 3,
        reserved_exposure_quota INT NOT NULL DEFAULT 3,
        heartbeat_timeout INT NOT NULL DEFAULT 120,
        offline_buffer_time INT NOT NULL DEFAULT 300,
        exposure_allocation_interval INT NOT NULL DEFAULT 300,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `)
    console.log('✅ exposure_config 表创建成功')
    
    console.log('\n执行 SQL 语句（4）：创建 task_view_records 表...')
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS task_view_records (
        id BIGINT PRIMARY KEY DEFAULT unique_rowid(),
        task_id BIGINT NOT NULL,
        user_id INT NOT NULL,
        city STRING NULL,
        province STRING NULL,
        source STRING NOT NULL DEFAULT 'list',
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE (task_id, user_id)
      )
    `)
    console.log('✅ task_view_records 表创建成功')
    
    console.log('\n执行 SQL 语句（5）：创建 user_quality_score 表...')
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS user_quality_score (
        id BIGINT PRIMARY KEY DEFAULT unique_rowid(),
        user_id INT NOT NULL UNIQUE,
        activity_score INT NOT NULL DEFAULT 0,
        quality_score INT NOT NULL DEFAULT 0,
        online_score INT NOT NULL DEFAULT 0,
        total_score INT NOT NULL DEFAULT 0,
        level STRING NOT NULL DEFAULT 'new',
        last_calculated_at TIMESTAMP NOT NULL DEFAULT now(),
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `)
    console.log('✅ user_quality_score 表创建成功')
    
    console.log('\n执行 SQL 语句（6）：创建 exposure_allocation_logs 表...')
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS exposure_allocation_logs (
        id BIGINT PRIMARY KEY DEFAULT unique_rowid(),
        task_id BIGINT NOT NULL,
        user_id INT NOT NULL,
        allocation_type STRING NOT NULL DEFAULT 'regular',
        selection_score INT NOT NULL DEFAULT 0,
        user_level INT NOT NULL DEFAULT 1,
        user_city STRING NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `)
    console.log('✅ exposure_allocation_logs 表创建成功')
    
    console.log('\n执行 SQL 语句（7）：插入默认曝光配置...')
    await prisma.$executeRawUnsafe(`
      INSERT INTO exposure_config (
        is_active, initial_coefficient, initial_min_extra, initial_max_extra,
        max_coefficient, check_interval_minutes, add_ratio_high, add_ratio_mid,
        add_ratio_low, rate_threshold_high, rate_threshold_mid, rate_threshold_low,
        exposure_mode, sequential_threshold, exposure_window, whitelist_bonus,
        blacklist_penalty, activity_weight, speed_weight, completion_weight,
        city_exposure_limit, reserved_exposure_quota, heartbeat_timeout,
        offline_buffer_time, exposure_allocation_interval
      ) VALUES (
        true, 1.0, 5, 10, 3.0, 5, 0.3, 0.5, 1.0, 0.7, 0.4, 0.2,
        'priority', 0.8, 9999, 100, -50, 0.4, 0.3, 0.3, 3, 3, 120, 300, 300
      ) ON CONFLICT (is_active) DO NOTHING
    `)
    console.log('✅ 默认配置插入成功')
    
    // 验证表是否创建成功
    console.log('\n=== 验证表创建情况 ===')
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('task_exposure', 'task_exposure_logs', 'exposure_config', 
                          'task_view_records', 'user_quality_score', 'exposure_allocation_logs')
      ORDER BY table_name
    `
    
    console.log('\n已创建的表:')
    tables.forEach(t => console.log(`  ✅ ${t.table_name}`))
    
    console.log(`\n共 ${tables.length} 个表\n`)
    console.log('=== 迁移完成 ===\n')
    
  } catch (err) {
    console.error('\n❌ 迁移失败:', err.message)
    if (err.message.includes('already exists')) {
      console.log('ℹ️  表已存在，可以忽略此错误')
    }
  } finally {
    await prisma.$disconnect()
  }
}

// 运行迁移
runMigration().catch(console.error)
