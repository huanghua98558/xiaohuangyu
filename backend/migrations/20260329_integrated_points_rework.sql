-- 任务积分联动重构
-- 1) 冻结领取时结算快照
-- 2) 分离 claim 基础分与最终实发分
-- 3) 支持积分流水与用户积分小数精度

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS night_coefficient DECIMAL(10, 2);

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS online_users BIGINT;

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS final_points DECIMAL(12, 2);

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS bonus_points DECIMAL(12, 2);

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS publish_time_snapshot TIMESTAMP;

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS config_snapshot JSONB;

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS settlement_snapshot JSONB;

ALTER TABLE records
  ALTER COLUMN points TYPE DECIMAL(12, 2)
  USING points::DECIMAL(12, 2);

ALTER TABLE users
  ALTER COLUMN points TYPE DECIMAL(12, 2)
  USING points::DECIMAL(12, 2);

ALTER TABLE users
  ALTER COLUMN total_points TYPE DECIMAL(12, 2)
  USING total_points::DECIMAL(12, 2);

CREATE INDEX IF NOT EXISTS idx_claims_publish_time_snapshot
  ON claims(publish_time_snapshot);

CREATE INDEX IF NOT EXISTS idx_claims_night_coefficient
  ON claims(night_coefficient);

CREATE INDEX IF NOT EXISTS idx_records_task_id
  ON records(task_id);
