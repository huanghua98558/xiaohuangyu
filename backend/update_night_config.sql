-- 更新夜间积分配置，将结束时间从 6 点改为 8 点
UPDATE night_point_config 
SET time_end = 8, 
    updated_at = current_timestamp()
WHERE id = 1;

-- 验证更新结果
SELECT * FROM night_point_config WHERE id = 1;
