-- 创建链接验证队列表
CREATE TABLE IF NOT EXISTS link_verification_queue (
  id BIGINT PRIMARY KEY DEFAULT unique_rowid(),
  claim_id INT NOT NULL,
  user_id INT NOT NULL,
  task_id INT NOT NULL,
  video_url STRING(500),
  comment STRING(500),
  user_name STRING(100),
  platform STRING(50),
  task_author_name STRING(100),
  status STRING(50) DEFAULT 'pending',
  priority INT DEFAULT 0,
  scheduled_at TIMESTAMP,
  max_process_at TIMESTAMP,
  retry_count INT DEFAULT 0,
  proxy_ip STRING(50),
  proxy_used_at TIMESTAMP,
  verification_result JSONB,
  verified BOOLEAN,
  error_message STRING(500),
  screenshot_verified_at TIMESTAMP,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_link_queue_status ON link_verification_queue(status);
CREATE INDEX IF NOT EXISTS idx_link_queue_scheduled_at ON link_verification_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_link_queue_max_process_at ON link_verification_queue(max_process_at);
CREATE INDEX IF NOT EXISTS idx_link_queue_claim_id ON link_verification_queue(claim_id);
CREATE INDEX IF NOT EXISTS idx_link_queue_created_at ON link_verification_queue(created_at);

-- 创建审核规则表
CREATE TABLE IF NOT EXISTS review_rules (
  id BIGINT PRIMARY KEY DEFAULT unique_rowid(),
  platform STRING(50) NOT NULL,
  action STRING(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  
  -- OCR 规则
  ocr_enabled BOOLEAN DEFAULT true,
  ocr_provider STRING(50) DEFAULT 'paddleocr',
  ocr_confidence_threshold DECIMAL(3,2) DEFAULT 0.70,
  
  -- 评论规则
  comment_required BOOLEAN DEFAULT true,
  comment_min_length INT DEFAULT 8,
  comment_owner_required BOOLEAN DEFAULT true,
  comment_owner_keyword STRING(50) DEFAULT '我',
  
  -- 达人匹配规则
  author_match_required BOOLEAN DEFAULT true,
  author_match_enabled BOOLEAN DEFAULT true,
  
  -- 点赞收藏规则
  like_required BOOLEAN DEFAULT true,
  collect_required BOOLEAN DEFAULT true,
  
  -- AI 审核规则
  ai_review_enabled BOOLEAN DEFAULT true,
  ai_review_trigger STRING(50) DEFAULT 'ocr_failed',  -- ocr_failed, always, never
  ai_provider STRING(50) DEFAULT 'gemini',
  
  -- 自动决策规则
  auto_approve_enabled BOOLEAN DEFAULT false,
  auto_approve_threshold DECIMAL(3,2) DEFAULT 0.85,
  auto_reject_enabled BOOLEAN DEFAULT false,
  auto_reject_threshold DECIMAL(3,2) DEFAULT 0.50,
  
  -- 链接审核规则
  link_verify_enabled BOOLEAN DEFAULT true,
  link_verify_delay_minutes INT DEFAULT 15,
  link_verify_batch_threshold INT DEFAULT 5,
  link_verify_max_wait_minutes INT DEFAULT 60,
  
  -- 元数据
  description STRING(500),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  created_by INT,
  updated_by INT
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_review_rules_platform ON review_rules(platform);
CREATE INDEX IF NOT EXISTS idx_review_rules_action ON review_rules(action);
CREATE INDEX IF NOT EXISTS idx_review_rules_active ON review_rules(is_active);

-- 初始化默认规则（抖音 - 短视频体验官）
INSERT INTO review_rules (
  platform, action, is_active,
  ocr_enabled, ocr_provider, ocr_confidence_threshold,
  comment_required, comment_min_length, comment_owner_required, comment_owner_keyword,
  author_match_required, author_match_enabled,
  like_required, collect_required,
  ai_review_enabled, ai_review_trigger, ai_provider,
  auto_approve_enabled, auto_approve_threshold, auto_reject_enabled, auto_reject_threshold,
  link_verify_enabled, link_verify_delay_minutes, link_verify_batch_threshold, link_verify_max_wait_minutes,
  description
) VALUES (
  '抖音', 'short_video_research', true,
  true, 'paddleocr', 0.70,
  true, 8, true, '我',
  true, true,
  true, true,
  true, 'ocr_failed', 'gemini',
  false, 0.85, false, 0.50,
  true, 15, 5, 60,
  '抖音短视频体验官默认规则：OCR 识别评论 + 达人匹配，AI 复审（仅 OCR 失败），链接审核延迟 15 分钟'
) ON CONFLICT DO NOTHING;

-- 初始化快手规则
INSERT INTO review_rules (
  platform, action, is_active,
  ocr_enabled, ocr_provider, ocr_confidence_threshold,
  comment_required, comment_min_length, comment_owner_required, comment_owner_keyword,
  author_match_required, author_match_enabled,
  like_required, collect_required,
  ai_review_enabled, ai_review_trigger, ai_provider,
  auto_approve_enabled, auto_approve_threshold, auto_reject_enabled, auto_reject_threshold,
  link_verify_enabled, link_verify_delay_minutes, link_verify_batch_threshold, link_verify_max_wait_minutes,
  description
) VALUES (
  '快手', 'short_video_research', true,
  true, 'paddleocr', 0.70,
  true, 8, true, '我',
  true, true,
  true, true,
  true, 'ocr_failed', 'gemini',
  false, 0.85, false, 0.50,
  true, 15, 5, 60,
  '快手短视频体验官默认规则'
) ON CONFLICT DO NOTHING;

-- 初始化小红书规则
INSERT INTO review_rules (
  platform, action, is_active,
  ocr_enabled, ocr_provider, ocr_confidence_threshold,
  comment_required, comment_min_length, comment_owner_required, comment_owner_keyword,
  author_match_required, author_match_enabled,
  like_required, collect_required,
  ai_review_enabled, ai_review_trigger, ai_provider,
  auto_approve_enabled, auto_approve_threshold, auto_reject_enabled, auto_reject_threshold,
  link_verify_enabled, link_verify_delay_minutes, link_verify_batch_threshold, link_verify_max_wait_minutes,
  description
) VALUES (
  '小红书', 'short_video_research', true,
  true, 'paddleocr', 0.70,
  true, 8, true, '我',
  true, true,
  true, true,
  true, 'ocr_failed', 'gemini',
  false, 0.85, false, 0.50,
  true, 15, 5, 60,
  '小红书短视频体验官默认规则'
) ON CONFLICT DO NOTHING;

-- 初始化视频号规则
INSERT INTO review_rules (
  platform, action, is_active,
  ocr_enabled, ocr_provider, ocr_confidence_threshold,
  comment_required, comment_min_length, comment_owner_required, comment_owner_keyword,
  author_match_required, author_match_enabled,
  like_required, collect_required,
  ai_review_enabled, ai_review_trigger, ai_provider,
  auto_approve_enabled, auto_approve_threshold, auto_reject_enabled, auto_reject_threshold,
  link_verify_enabled, link_verify_delay_minutes, link_verify_batch_threshold, link_verify_max_wait_minutes,
  description
) VALUES (
  '视频号', 'short_video_research', true,
  true, 'paddleocr', 0.70,
  true, 8, true, '我',
  true, true,
  true, true,
  true, 'ocr_failed', 'gemini',
  false, 0.85, false, 0.50,
  true, 15, 5, 60,
  '视频号短视频体验官默认规则'
) ON CONFLICT DO NOTHING;
