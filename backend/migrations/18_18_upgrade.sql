-- 18.18改造计划 - 数据库迁移
-- 创建时间: 2025-03-19
-- 说明: 创建审核系统所需的数据表

-- ============================================
-- 1. 审核规则表 (review_rules)
-- ============================================
CREATE TABLE IF NOT EXISTS review_rules (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  auto_reject_enabled BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  rule_config JSONB DEFAULT '{}',
  thresholds JSONB DEFAULT '{"approve": 0.85, "reject": 0.6}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_rules_platform ON review_rules(platform);
CREATE INDEX IF NOT EXISTS idx_review_rules_action ON review_rules(action);
CREATE INDEX IF NOT EXISTS idx_review_rules_active ON review_rules(is_active);

-- 插入默认规则
INSERT INTO review_rules (platform, action, rule_config, thresholds) VALUES
('douyin', 'like', '{"keywords": ["点赞", "已赞"], "checkItems": ["like_button"]}', '{"approve": 0.8, "reject": 0.5}'),
('douyin', 'collect', '{"keywords": ["收藏", "已收藏"], "checkItems": ["collect_button"]}', '{"approve": 0.8, "reject": 0.5}'),
('douyin', 'follow', '{"keywords": ["关注", "已关注"], "checkItems": ["follow_button"]}', '{"approve": 0.8, "reject": 0.5}'),
('douyin', 'like_collect', '{"keywords": ["点赞", "收藏"], "checkItems": ["like_button", "collect_button"]}', '{"approve": 0.85, "reject": 0.6}'),
('kuaishou', 'like', '{"keywords": ["点赞", "已赞"], "checkItems": ["like_button"]}', '{"approve": 0.8, "reject": 0.5}')
ON CONFLICT DO NOTHING;

-- ============================================
-- 2. 审核报告表 (review_reports)
-- ============================================
CREATE TABLE IF NOT EXISTS review_reports (
  id SERIAL PRIMARY KEY,
  claim_id INTEGER NOT NULL,
  report_type VARCHAR(50) DEFAULT 'ai_undetermined',
  difficulty_reasons JSONB DEFAULT '[]',
  ai_analysis JSONB DEFAULT '{}',
  human_required BOOLEAN DEFAULT false,
  priority INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_reports_claim ON review_reports(claim_id);
CREATE INDEX IF NOT EXISTS idx_review_reports_status ON review_reports(status);

-- ============================================
-- 3. 添加可疑用户类型列
-- ============================================
ALTER TABLE suspicious_users 
ADD COLUMN IF NOT EXISTS suspicion_type VARCHAR(50);

-- ============================================
-- 4. 插入AI配置
-- ============================================
INSERT INTO ai_configs (key, value, description, category, is_enabled) VALUES
('paddle_ocr_enabled', 'true', 'PaddleOCR开关', 'image_review', true),
('paddle_ocr_url', 'http://localhost:8080', 'PaddleOCR服务地址', 'image_review', true),
('paddle_ocr_timeout', '30000', 'PaddleOCR请求超时(ms)', 'image_review', true),
('ocr_confidence_threshold', '0.7', 'OCR置信度阈值', 'image_review', true),
('image_review_enabled', 'true', '图片审核开关', 'image_review', true)
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description;

-- ============================================
-- 完成
-- ============================================
-- 执行完成后，请验证:
-- SELECT * FROM review_rules LIMIT 5;
-- SELECT * FROM ai_configs WHERE key LIKE '%paddle%';

