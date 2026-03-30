-- ============================================================================
-- 曝光系统性能优化 - 批量操作函数
-- 版本: V2.1
-- 执行时间: 2025-03-18
-- ============================================================================

-- ============================================================================
-- 一、批量曝光更新函数
-- ============================================================================

-- 1. 批量递增曝光计数（核心优化函数）
-- 替代循环调用 increment_exposure，减少数据库操作次数
CREATE OR REPLACE FUNCTION batch_increment_exposure(task_ids INTEGER[])
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- 批量更新，同时防止越界
  UPDATE task_exposure 
  SET current_exposure = current_exposure + 1,
      updated_at = NOW()
  WHERE task_id = ANY(task_ids)
  AND current_exposure < max_exposure;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION batch_increment_exposure IS '批量递增任务曝光计数，防止越界';

-- 2. 批量记录用户浏览（原子操作）
CREATE OR REPLACE FUNCTION batch_record_task_views(
  p_user_id INTEGER,
  p_task_ids INTEGER[],
  p_city VARCHAR(50),
  p_province VARCHAR(50),
  p_source VARCHAR(20) DEFAULT 'list'
)
RETURNS INTEGER AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  -- 批量插入，忽略已存在的记录（通过唯一约束）
  INSERT INTO task_view_records (task_id, user_id, city, province, source, created_at)
  SELECT 
    unnest(p_task_ids),
    p_user_id,
    p_city,
    p_province,
    p_source,
    NOW()
  ON CONFLICT (task_id, user_id) DO NOTHING;
  
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  
  -- 批量更新曝光计数
  PERFORM batch_increment_exposure(p_task_ids);
  
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION batch_record_task_views IS '批量记录用户任务浏览，原子操作';

-- ============================================================================
-- 二、曝光额度管理函数
-- ============================================================================

-- 1. 重置用户曝光额度（提交任务后调用）
-- 正确逻辑：重置到基础额度，而非清零
CREATE OR REPLACE FUNCTION reset_user_exposure_quota(
  p_user_id INTEGER,
  p_base_quota INTEGER DEFAULT 10
)
RETURNS INTEGER AS $$
DECLARE
  new_quota INTEGER;
BEGIN
  -- 获取用户等级对应的基础额度
  SELECT COALESCE(lc.exposure_limit, p_base_quota) INTO new_quota
  FROM users u
  LEFT JOIN level_configs lc ON lc.level = u.level
  WHERE u.id = p_user_id;
  
  -- 如果查不到，使用默认值
  IF new_quota IS NULL THEN
    new_quota := p_base_quota;
  END IF;
  
  -- 重置额度
  UPDATE users
  SET current_exposure = new_quota,
      updated_at = NOW()
  WHERE id = p_user_id;
  
  RETURN new_quota;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reset_user_exposure_quota IS '重置用户曝光额度到基础值';

-- 2. 用户上线预分配曝光额度
CREATE OR REPLACE FUNCTION allocate_exposure_quota_on_online(
  p_user_id INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_level INTEGER;
  v_base_quota INTEGER;
  v_current_quota INTEGER;
  v_allocated INTEGER;
BEGIN
  -- 获取用户等级和当前额度
  SELECT level, current_exposure INTO v_level, v_current_quota
  FROM users WHERE id = p_user_id;
  
  -- 获取等级对应的基础额度
  SELECT COALESCE(exposure_limit, 10) INTO v_base_quota
  FROM level_configs WHERE level = v_level;
  
  IF v_base_quota IS NULL THEN
    v_base_quota := 10;
  END IF;
  
  -- 如果当前额度不足，补充
  IF v_current_quota < v_base_quota THEN
    v_allocated := v_base_quota - v_current_quota;
    
    UPDATE users
    SET current_exposure = v_base_quota,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    RETURN v_allocated;
  END IF;
  
  RETURN 0; -- 无需分配
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION allocate_exposure_quota_on_online IS '用户上线时预分配曝光额度';

-- ============================================================================
-- 三、越界数据修复
-- ============================================================================

-- 修复 current_exposure > max_exposure 的数据
UPDATE task_exposure 
SET current_exposure = max_exposure
WHERE current_exposure > max_exposure;

-- ============================================================================
-- 四、性能优化索引
-- ============================================================================

-- 加速批量查询
CREATE INDEX IF NOT EXISTS idx_task_view_records_user_task 
ON task_view_records(user_id, task_id);

-- 加速任务列表查询
CREATE INDEX IF NOT EXISTS idx_tasks_status_created 
ON tasks(status, created_at DESC) 
WHERE status = 'active';

-- ============================================================================
-- 五、验证
-- ============================================================================

-- 验证函数创建
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('batch_increment_exposure', 'batch_record_task_views', 'reset_user_exposure_quota', 'allocate_exposure_quota_on_online');

-- 验证越界数据修复
SELECT COUNT(*) as overflow_count 
FROM task_exposure 
WHERE current_exposure > max_exposure;

-- ============================================================================
-- V3.0 新增：减少任务曝光计数函数
-- ============================================================================

-- 批量减少任务曝光计数（用户下线时调用）
CREATE OR REPLACE FUNCTION decrement_task_exposure(task_ids INTEGER[])
RETURNS INTEGER AS 35293
DECLARE
  updated_count INTEGER;
BEGIN
  -- 批量减少曝光计数，但不低于0
  UPDATE task_exposure 
  SET current_exposure = GREATEST(0, current_exposure - 1),
      updated_at = NOW()
  WHERE task_id = ANY(task_ids)
  AND current_exposure > 0;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
35293 LANGUAGE plpgsql;

COMMENT ON FUNCTION decrement_task_exposure IS '批量减少任务曝光计数，用于用户下线时释放曝光资源';
