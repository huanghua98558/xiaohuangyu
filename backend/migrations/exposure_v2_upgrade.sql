-- ============================================================================
-- 曝光分配系统升级 - 数据库迁移脚本
-- 版本: V2.0
-- 执行时间: 2026-03-17
-- ============================================================================

-- ============================================================================
-- 一、新增数据表
-- ============================================================================

-- 1. 城市在线用户统计表
CREATE TABLE IF NOT EXISTS city_online_stats (
  city VARCHAR(50) PRIMARY KEY,
  online_count INTEGER DEFAULT 0,
  level_distribution JSONB DEFAULT '{}',
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE city_online_stats IS '城市在线用户统计表';
COMMENT ON COLUMN city_online_stats.city IS '城市名称';
COMMENT ON COLUMN city_online_stats.online_count IS '当前在线人数';
COMMENT ON COLUMN city_online_stats.level_distribution IS '等级分布JSON';

-- 2. 城市任务曝光统计表
CREATE TABLE IF NOT EXISTS city_task_exposure (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  city VARCHAR(50) NOT NULL,
  exposure_count INTEGER DEFAULT 0,
  claim_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT city_task_exposure_unique UNIQUE(task_id, city)
);

CREATE INDEX IF NOT EXISTS idx_city_task_exposure_task ON city_task_exposure(task_id);
CREATE INDEX IF NOT EXISTS idx_city_task_exposure_city ON city_task_exposure(city);

COMMENT ON TABLE city_task_exposure IS '城市任务曝光统计表';
COMMENT ON COLUMN city_task_exposure.exposure_count IS '该城市已曝光数';
COMMENT ON COLUMN city_task_exposure.claim_count IS '该城市已领取数';

-- 3. 用户质量评分表
CREATE TABLE IF NOT EXISTS user_quality_score (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  activity_score DECIMAL(5,2) DEFAULT 0,
  quality_score DECIMAL(5,2) DEFAULT 0,
  online_score DECIMAL(5,2) DEFAULT 0,
  total_score DECIMAL(5,2) DEFAULT 0,
  level VARCHAR(20) DEFAULT 'new',
  last_calculated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_user_quality_score ON user_quality_score(total_score DESC);

COMMENT ON TABLE user_quality_score IS '用户质量评分表';
COMMENT ON COLUMN user_quality_score.activity_score IS '活跃度评分';
COMMENT ON COLUMN user_quality_score.quality_score IS '完成质量评分';
COMMENT ON COLUMN user_quality_score.online_score IS '在线时长评分';
COMMENT ON COLUMN user_quality_score.total_score IS '综合评分';

-- 4. 曝光分配日志表
CREATE TABLE IF NOT EXISTS exposure_allocation_logs (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  allocation_type VARCHAR(20) DEFAULT 'regular',
  selection_score DECIMAL(5,2),
  user_level INTEGER,
  user_city VARCHAR(50),
  allocated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exposure_allocation_logs_task ON exposure_allocation_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_exposure_allocation_logs_user ON exposure_allocation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_exposure_allocation_logs_time ON exposure_allocation_logs(allocated_at);

COMMENT ON TABLE exposure_allocation_logs IS '曝光分配日志表';
COMMENT ON COLUMN exposure_allocation_logs.allocation_type IS '分配类型: regular/additional';
COMMENT ON COLUMN exposure_allocation_logs.selection_score IS '分配时的选择分数';

-- ============================================================================
-- 二、修改现有数据表
-- ============================================================================

-- 1. exposure_config 表新增字段
ALTER TABLE exposure_config ADD COLUMN IF NOT EXISTS city_exposure_limit INTEGER DEFAULT 3;
ALTER TABLE exposure_config ADD COLUMN IF NOT EXISTS reserved_exposure_quota INTEGER DEFAULT 3;
ALTER TABLE exposure_config ADD COLUMN IF NOT EXISTS heartbeat_timeout INTEGER DEFAULT 120;
ALTER TABLE exposure_config ADD COLUMN IF NOT EXISTS offline_buffer_time INTEGER DEFAULT 300;
ALTER TABLE exposure_config ADD COLUMN IF NOT EXISTS exposure_allocation_interval INTEGER DEFAULT 300;
-- 优先级模式字段
ALTER TABLE exposure_config ADD COLUMN IF NOT EXISTS whitelist_bonus INTEGER DEFAULT 100;
ALTER TABLE exposure_config ADD COLUMN IF NOT EXISTS blacklist_penalty INTEGER DEFAULT -50;
ALTER TABLE exposure_config ADD COLUMN IF NOT EXISTS activity_weight DECIMAL(3,2) DEFAULT 0.4;
ALTER TABLE exposure_config ADD COLUMN IF NOT EXISTS speed_weight DECIMAL(3,2) DEFAULT 0.3;
ALTER TABLE exposure_config ADD COLUMN IF NOT EXISTS completion_weight DECIMAL(3,2) DEFAULT 0.3;

COMMENT ON COLUMN exposure_config.city_exposure_limit IS '每城市曝光上限';
COMMENT ON COLUMN exposure_config.reserved_exposure_quota IS '追加曝光预留额度';
COMMENT ON COLUMN exposure_config.heartbeat_timeout IS '心跳超时时间(秒)';
COMMENT ON COLUMN exposure_config.offline_buffer_time IS '离线缓冲时间(秒)';
COMMENT ON COLUMN exposure_config.exposure_allocation_interval IS '曝光分配定时任务间隔(秒)';
COMMENT ON COLUMN exposure_config.whitelist_bonus IS '白名单优先级加成分数';
COMMENT ON COLUMN exposure_config.blacklist_penalty IS '黑名单优先级惩罚分数';
COMMENT ON COLUMN exposure_config.activity_weight IS '活跃度评分权重';
COMMENT ON COLUMN exposure_config.speed_weight IS '提交速度评分权重';
COMMENT ON COLUMN exposure_config.completion_weight IS '完成率评分权重';

-- 2. task_view_records 表新增字段
ALTER TABLE task_view_records ADD COLUMN IF NOT EXISTS exposure_type VARCHAR(20) DEFAULT 'regular';
ALTER TABLE task_view_records ADD COLUMN IF NOT EXISTS user_online_at_exposure BOOLEAN DEFAULT TRUE;
ALTER TABLE task_view_records ADD COLUMN IF NOT EXISTS selection_score_at_exposure DECIMAL(5,2);

COMMENT ON COLUMN task_view_records.exposure_type IS '曝光类型: regular/additional';
COMMENT ON COLUMN task_view_records.user_online_at_exposure IS '曝光时用户是否在线';
COMMENT ON COLUMN task_view_records.selection_score_at_exposure IS '曝光时的选择分数';

-- 3. users 表新增曝光额度字段
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_exposure INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS regular_used INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reserved_used INTEGER DEFAULT 0;

COMMENT ON COLUMN users.current_exposure IS '当前已曝光任务数';
COMMENT ON COLUMN users.regular_used IS '常规曝光已用';
COMMENT ON COLUMN users.reserved_used IS '预留曝光已用';

-- 4. level_configs 表新增曝光相关配置
ALTER TABLE level_configs ADD COLUMN IF NOT EXISTS exposure_limit INTEGER DEFAULT 10;
ALTER TABLE level_configs ADD COLUMN IF NOT EXISTS regular_exposure_quota INTEGER DEFAULT 7;
ALTER TABLE level_configs ADD COLUMN IF NOT EXISTS level_weight INTEGER DEFAULT 1;

COMMENT ON COLUMN level_configs.exposure_limit IS '该等级用户曝光上限';
COMMENT ON COLUMN level_configs.regular_exposure_quota IS '常规曝光额度';
COMMENT ON COLUMN level_configs.level_weight IS '等级权重(用于选择分数计算)';

-- ============================================================================
-- 三、更新等级配置数据
-- ============================================================================

-- 更新现有等级配置的曝光权益
UPDATE level_configs SET 
  exposure_limit = CASE level
    WHEN 1 THEN 10
    WHEN 2 THEN 12
    WHEN 3 THEN 15
    WHEN 4 THEN 18
    WHEN 5 THEN 20
    WHEN 6 THEN 20
    ELSE 10
  END,
  regular_exposure_quota = CASE level
    WHEN 1 THEN 7
    WHEN 2 THEN 9
    WHEN 3 THEN 12
    WHEN 4 THEN 15
    WHEN 5 THEN 17
    WHEN 6 THEN 17
    ELSE 7
  END,
  level_weight = CASE level
    WHEN 1 THEN 1
    WHEN 2 THEN 2
    WHEN 3 THEN 3
    WHEN 4 THEN 4
    WHEN 5 THEN 5
    WHEN 6 THEN 5
    ELSE 1
  END
WHERE exposure_limit IS NULL OR exposure_limit = 10;

-- ============================================================================
-- 四、新增数据库函数
-- ============================================================================

-- 1. 增加任务曝光计数
CREATE OR REPLACE FUNCTION increment_task_exposure(
  p_task_id INTEGER,
  p_count INTEGER DEFAULT 1
)
RETURNS void AS $$
BEGIN
  UPDATE task_exposure
  SET current_exposure = current_exposure + p_count,
      last_check_at = NOW()
  WHERE task_id = p_task_id;
END;
$$ LANGUAGE plpgsql;

-- 2. 获取任务曝光统计
CREATE OR REPLACE FUNCTION get_task_exposure_stats(p_task_id INTEGER)
RETURNS TABLE(
  total_exposure INTEGER,
  total_accepted INTEGER,
  city_distribution JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    te.current_exposure::INTEGER,
    te.accepted_count::INTEGER,
    (
      SELECT jsonb_object_agg(city, exposure_count)
      FROM city_task_exposure
      WHERE city_task_exposure.task_id = p_task_id
    )::JSONB
  FROM task_exposure te
  WHERE te.task_id = p_task_id;
END;
$$ LANGUAGE plpgsql;

-- 3. 更新用户曝光额度
CREATE OR REPLACE FUNCTION update_user_exposure_quota(
  p_user_id INTEGER,
  p_delta INTEGER
)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET current_exposure = GREATEST(0, current_exposure + p_delta),
      regular_used = regular_used + GREATEST(0, p_delta),
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- 4. 获取在线用户曝光容量
CREATE OR REPLACE FUNCTION get_online_exposure_capacity()
RETURNS TABLE(
  total_capacity BIGINT,
  total_used BIGINT,
  online_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(lc.exposure_limit), 0)::BIGINT as total_capacity,
    COALESCE(SUM(u.current_exposure), 0)::BIGINT as total_used,
    COUNT(u.id)::BIGINT as online_count
  FROM users u
  JOIN level_configs lc ON lc.level = u.level
  WHERE u.last_task_date > NOW() - INTERVAL '2 minutes';
END;
$$ LANGUAGE plpgsql;

-- 5. 批量更新城市任务曝光统计
CREATE OR REPLACE FUNCTION batch_update_city_exposure(
  p_task_id INTEGER,
  p_city_data JSONB
)
RETURNS void AS $$
DECLARE
  city_item RECORD;
BEGIN
  FOR city_item IN SELECT * FROM jsonb_each_text(p_city_data)
  LOOP
    INSERT INTO city_task_exposure (task_id, city, exposure_count, updated_at)
    VALUES (p_task_id, city_item.key, city_item.value::INTEGER, NOW())
    ON CONFLICT (task_id, city) 
    DO UPDATE SET 
      exposure_count = city_task_exposure.exposure_count + EXCLUDED.exposure_count,
      updated_at = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 五、验证结果
-- ============================================================================

-- 验证新增表
SELECT 'city_online_stats' as table_name, COUNT(*) as row_count FROM city_online_stats
UNION ALL
SELECT 'city_task_exposure', COUNT(*) FROM city_task_exposure
UNION ALL
SELECT 'user_quality_score', COUNT(*) FROM user_quality_score
UNION ALL
SELECT 'exposure_allocation_logs', COUNT(*) FROM exposure_allocation_logs;

-- 验证等级配置更新
SELECT level, name, exposure_limit, regular_exposure_quota, level_weight 
FROM level_configs 
ORDER BY level;

-- 验证exposure_config新增字段
SELECT city_exposure_limit, reserved_exposure_quota, heartbeat_timeout, offline_buffer_time
FROM exposure_config 
LIMIT 1;
