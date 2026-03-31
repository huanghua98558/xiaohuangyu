-- 曝光系统表创建脚本
-- 创建时间：2026-03-21

-- 1. 任务曝光记录表
CREATE TABLE IF NOT EXISTS task_exposure (
    id BIGINT PRIMARY KEY DEFAULT unique_rowid(),
    task_id BIGINT NOT NULL,
    need_count INT NOT NULL DEFAULT 0,
    initial_exposure INT NOT NULL DEFAULT 0,
    current_exposure INT NOT NULL DEFAULT 0,
    max_exposure INT NOT NULL DEFAULT 0,
    accepted_count INT NOT NULL DEFAULT 0,
    submitted_count INT NOT NULL DEFAULT 0,
    status STRING NOT NULL DEFAULT 'active',  -- active, completed, expired
    queue_position INT NOT NULL DEFAULT 0,
    unlocked_at TIMESTAMP NULL,
    last_check_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    
    INDEX idx_task_id (task_id),
    INDEX idx_status (status),
    INDEX idx_queue_position (queue_position)
);

-- 2. 任务曝光日志表
CREATE TABLE IF NOT EXISTS task_exposure_logs (
    id BIGINT PRIMARY KEY DEFAULT unique_rowid(),
    task_id BIGINT NOT NULL,
    event_type STRING NOT NULL,  -- initial, add, completed, expired
    exposure_before INT NOT NULL DEFAULT 0,
    exposure_after INT NOT NULL DEFAULT 0,
    exposure_add INT NOT NULL DEFAULT 0,
    accept_rate FLOAT NULL,
    reason STRING NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    
    INDEX idx_task_id (task_id),
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at)
);

-- 3. 曝光配置表
CREATE TABLE IF NOT EXISTS exposure_config (
    id BIGINT PRIMARY KEY DEFAULT unique_rowid(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- 基础配置
    initial_coefficient FLOAT NOT NULL DEFAULT 1.0,
    initial_min_extra INT NOT NULL DEFAULT 5,
    initial_max_extra INT NOT NULL DEFAULT 10,
    max_coefficient FLOAT NOT NULL DEFAULT 3.0,
    check_interval_minutes INT NOT NULL DEFAULT 5,
    
    -- 追加曝光配置
    add_ratio_high FLOAT NOT NULL DEFAULT 0.3,
    add_ratio_mid FLOAT NOT NULL DEFAULT 0.5,
    add_ratio_low FLOAT NOT NULL DEFAULT 1.0,
    rate_threshold_high FLOAT NOT NULL DEFAULT 0.7,
    rate_threshold_mid FLOAT NOT NULL DEFAULT 0.4,
    rate_threshold_low FLOAT NOT NULL DEFAULT 0.2,
    
    -- 曝光模式配置
    exposure_mode STRING NOT NULL DEFAULT 'priority',  -- parallel, sequential, priority
    sequential_threshold FLOAT NOT NULL DEFAULT 0.8,
    exposure_window INT NOT NULL DEFAULT 9999,
    
    -- 优先级模式配置
    whitelist_bonus FLOAT NOT NULL DEFAULT 100,
    blacklist_penalty FLOAT NOT NULL DEFAULT -50,
    activity_weight FLOAT NOT NULL DEFAULT 0.4,
    speed_weight FLOAT NOT NULL DEFAULT 0.3,
    completion_weight FLOAT NOT NULL DEFAULT 0.3,
    freshness_weight FLOAT NOT NULL DEFAULT 1.0,
    remain_weight FLOAT NOT NULL DEFAULT 1.0,
    city_match_weight FLOAT NOT NULL DEFAULT 1.0,
    
    -- V2.0 新增配置
    city_exposure_limit INT NOT NULL DEFAULT 3,
    province_exposure_limit INT NOT NULL DEFAULT 10,
    reserved_exposure_quota INT NOT NULL DEFAULT 3,
    heartbeat_timeout INT NOT NULL DEFAULT 120,
    offline_buffer_time INT NOT NULL DEFAULT 300,
    exposure_allocation_interval INT NOT NULL DEFAULT 300,
    
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    
    UNIQUE INDEX idx_is_active (is_active)
);

-- 4. 任务浏览记录表
CREATE TABLE IF NOT EXISTS task_view_records (
    id BIGINT PRIMARY KEY DEFAULT unique_rowid(),
    task_id BIGINT NOT NULL,
    user_id INT NOT NULL,
    city STRING NULL,
    province STRING NULL,
    source STRING NOT NULL DEFAULT 'list',  -- list, detail, recommendation
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    
    INDEX idx_task_id (task_id),
    INDEX idx_user_id (user_id),
    INDEX idx_city (city),
    INDEX idx_province (province),
    
    -- 唯一约束：同一用户不能重复浏览同一任务
    UNIQUE INDEX idx_unique_view (task_id, user_id)
);

-- 5. 用户质量评分表
CREATE TABLE IF NOT EXISTS user_quality_score (
    id BIGINT PRIMARY KEY DEFAULT unique_rowid(),
    user_id INT NOT NULL UNIQUE,
    
    -- 各项评分
    activity_score INT NOT NULL DEFAULT 0,
    quality_score INT NOT NULL DEFAULT 0,
    online_score INT NOT NULL DEFAULT 0,
    total_score INT NOT NULL DEFAULT 0,
    
    -- 等级标签
    level STRING NOT NULL DEFAULT 'new',  -- new, normal, active, core, elite, blocked, low
    
    -- 计算时间
    last_calculated_at TIMESTAMP NOT NULL DEFAULT now(),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    
    INDEX idx_user_id (user_id),
    INDEX idx_level (level),
    INDEX idx_total_score (total_score)
);

-- 6. 曝光分配日志表
CREATE TABLE IF NOT EXISTS exposure_allocation_logs (
    id BIGINT PRIMARY KEY DEFAULT unique_rowid(),
    task_id BIGINT NOT NULL,
    user_id INT NOT NULL,
    allocation_type STRING NOT NULL DEFAULT 'regular',  -- regular, reserved, priority
    selection_score INT NOT NULL DEFAULT 0,
    user_level INT NOT NULL DEFAULT 1,
    user_city STRING NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    
    INDEX idx_task_id (task_id),
    INDEX idx_user_id (user_id),
    INDEX idx_allocation_type (allocation_type),
    INDEX idx_created_at (created_at)
);

-- 插入默认曝光配置
INSERT INTO exposure_config (
    is_active,
    initial_coefficient,
    initial_min_extra,
    initial_max_extra,
    max_coefficient,
    check_interval_minutes,
    add_ratio_high,
    add_ratio_mid,
    add_ratio_low,
    rate_threshold_high,
    rate_threshold_mid,
    rate_threshold_low,
    exposure_mode,
    sequential_threshold,
    exposure_window,
    whitelist_bonus,
    blacklist_penalty,
    activity_weight,
    speed_weight,
    completion_weight,
    city_exposure_limit,
    reserved_exposure_quota,
    heartbeat_timeout,
    offline_buffer_time,
    exposure_allocation_interval
) VALUES (
    true,
    1.0,
    5,
    10,
    3.0,
    5,
    0.3,
    0.5,
    1.0,
    0.7,
    0.4,
    0.2,
    'priority',
    0.8,
    9999,
    100,
    -50,
    0.4,
    0.3,
    0.3,
    3,
    3,
    120,
    300,
    300
) ON CONFLICT (is_active) DO NOTHING;

-- 添加外键约束（可选，如果需要数据完整性）
-- ALTER TABLE task_exposure ADD CONSTRAINT fk_task_exposure_task 
--     FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;

-- ALTER TABLE task_exposure_logs ADD CONSTRAINT fk_task_exposure_logs_task 
--     FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;

-- ALTER TABLE task_view_records ADD CONSTRAINT fk_task_view_records_task 
--     FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;

-- ALTER TABLE task_view_records ADD CONSTRAINT fk_task_view_records_user 
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ALTER TABLE user_quality_score ADD CONSTRAINT fk_user_quality_score_user 
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ALTER TABLE exposure_allocation_logs ADD CONSTRAINT fk_exposure_allocation_task 
--     FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;

-- ALTER TABLE exposure_allocation_logs ADD CONSTRAINT fk_exposure_allocation_user 
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

COMMENT ON TABLE task_exposure IS '任务曝光记录表 - 跟踪每个任务的曝光量和状态';
COMMENT ON TABLE task_exposure_logs IS '任务曝光日志表 - 记录曝光变化历史';
COMMENT ON TABLE exposure_config IS '曝光系统配置表 - 存储曝光算法参数';
COMMENT ON TABLE task_view_records IS '任务浏览记录表 - 记录用户浏览行为';
COMMENT ON TABLE user_quality_score IS '用户质量评分表 - 存储用户活跃度、质量等评分';
COMMENT ON TABLE exposure_allocation_logs IS '曝光分配日志表 - 记录曝光分配决策';
