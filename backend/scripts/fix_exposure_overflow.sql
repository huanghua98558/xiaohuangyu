-- ============================================================
-- 修复 task_exposure 数据越界问题
-- ============================================================

-- 1. 查看越界数据
SELECT 
  task_id,
  current_exposure,
  max_exposure,
  current_exposure - max_exposure as overflow_amount
FROM task_exposure 
WHERE current_exposure > max_exposure
ORDER BY overflow_amount DESC
LIMIT 20;

-- 2. 修复越界数据（将 current_exposure 限制在 max_exposure 范围内）
UPDATE task_exposure 
SET 
  current_exposure = max_exposure,
  updated_at = NOW()
WHERE current_exposure > max_exposure;

-- 3. 添加触发器函数防止越界
CREATE OR REPLACE FUNCTION check_exposure_limit()
RETURNS TRIGGER AS $$
BEGIN
  -- 确保 current_exposure 不超过 max_exposure
  IF NEW.current_exposure > NEW.max_exposure THEN
    NEW.current_exposure := NEW.max_exposure;
    RAISE NOTICE '曝光量已限制到最大值: %', NEW.max_exposure;
  END IF;
  
  -- 确保 current_exposure 不为负数
  IF NEW.current_exposure < 0 THEN
    NEW.current_exposure := 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. 删除旧触发器（如果存在）
DROP TRIGGER IF EXISTS exposure_limit_trigger ON task_exposure;

-- 5. 创建触发器
CREATE TRIGGER exposure_limit_trigger
BEFORE INSERT OR UPDATE OF current_exposure ON task_exposure
FOR EACH ROW
EXECUTE FUNCTION check_exposure_limit();

-- 6. 验证修复结果
SELECT 
  COUNT(*) as total_tasks,
  COUNT(CASE WHEN current_exposure > max_exposure THEN 1 END) as overflow_tasks,
  COUNT(CASE WHEN current_exposure <= max_exposure THEN 1 END) as normal_tasks
FROM task_exposure;

-- 7. 查看修复后的数据样本
SELECT 
  task_id,
  current_exposure,
  max_exposure,
  ROUND((current_exposure::FLOAT / NULLIF(max_exposure, 0) * 100)::NUMERIC, 2) as usage_percent
FROM task_exposure
WHERE max_exposure > 0
ORDER BY usage_percent DESC
LIMIT 20;
