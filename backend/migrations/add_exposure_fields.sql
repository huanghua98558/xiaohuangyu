-- 添加用户曝光相关字段
-- 执行时间：2026-03-17

-- 1. 添加曝光等级字段（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'exposure_level'
  ) THEN
    ALTER TABLE users ADD COLUMN exposure_level INTEGER DEFAULT 1;
    COMMENT ON COLUMN users.exposure_level IS '曝光等级：1=新手，2=活跃，3=高活跃，4=核心用户';
  END IF;
END $$;

-- 2. 添加曝光优先级字段（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'exposure_priority'
  ) THEN
    ALTER TABLE users ADD COLUMN exposure_priority INTEGER;
    COMMENT ON COLUMN users.exposure_priority IS '曝光优先级分数：0-100，越高越优先';
  END IF;
END $$;

-- 3. 添加白名单字段（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'is_whitelist'
  ) THEN
    ALTER TABLE users ADD COLUMN is_whitelist BOOLEAN DEFAULT FALSE;
    COMMENT ON COLUMN users.is_whitelist IS '是否在白名单：白名单用户享有最高曝光优先级';
  END IF;
END $$;

-- 4. 添加黑名单字段（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'is_blacklist'
  ) THEN
    ALTER TABLE users ADD COLUMN is_blacklist BOOLEAN DEFAULT FALSE;
    COMMENT ON COLUMN users.is_blacklist IS '是否在黑名单：黑名单用户曝光优先级最低';
  END IF;
END $$;

-- 5. 添加平均提交时间字段（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'avg_submit_time'
  ) THEN
    ALTER TABLE users ADD COLUMN avg_submit_time INTEGER DEFAULT 0;
    COMMENT ON COLUMN users.avg_submit_time IS '平均提交时间（分钟）：用于计算提交速度评分';
  END IF;
END $$;

-- 6. 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_users_exposure_level ON users(exposure_level);
CREATE INDEX IF NOT EXISTS idx_users_is_whitelist ON users(is_whitelist) WHERE is_whitelist = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_is_blacklist ON users(is_blacklist) WHERE is_blacklist = TRUE;

-- 7. 初始化现有用户的曝光等级（基于历史数据）
UPDATE users
SET 
  exposure_level = CASE
    WHEN total_tasks >= 100 AND (completed_tasks::FLOAT / NULLIF(total_tasks, 0)) >= 0.9 THEN 4
    WHEN total_tasks >= 50 AND (completed_tasks::FLOAT / NULLIF(total_tasks, 0)) >= 0.8 THEN 3
    WHEN total_tasks >= 10 AND (completed_tasks::FLOAT / NULLIF(total_tasks, 0)) >= 0.7 THEN 2
    ELSE 1
  END
WHERE exposure_level IS NULL OR exposure_level = 1;

-- 8. 更新曝光配置，将曝光模式改为 'priority'
UPDATE exposure_config
SET 
  exposure_mode = 'priority',
  exposure_window = 9999,  -- 移除窗口限制
  updated_at = NOW()
WHERE id = 1;

-- 9. 验证结果
SELECT 
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE exposure_level = 1) as level_1_newbie,
  COUNT(*) FILTER (WHERE exposure_level = 2) as level_2_active,
  COUNT(*) FILTER (WHERE exposure_level = 3) as level_3_highly_active,
  COUNT(*) FILTER (WHERE exposure_level = 4) as level_4_core,
  COUNT(*) FILTER (WHERE is_whitelist = TRUE) as whitelist_count,
  COUNT(*) FILTER (WHERE is_blacklist = TRUE) as blacklist_count
FROM users;
