-- 夜间积分结算快照字段补齐（幂等）

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS night_coefficient DECIMAL;

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS online_users BIGINT;

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS final_points BIGINT;

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS bonus_points BIGINT;

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS publish_time_snapshot TIMESTAMPTZ;

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS config_snapshot JSONB;

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS settlement_snapshot JSONB;

ALTER TABLE records
  ADD COLUMN IF NOT EXISTS task_id BIGINT;

ALTER TABLE records
  ADD COLUMN IF NOT EXISTS extra_data TEXT;

CREATE INDEX IF NOT EXISTS idx_records_task_id ON records(task_id);
CREATE INDEX IF NOT EXISTS idx_claims_publish_time_snapshot ON claims(publish_time_snapshot);
CREATE INDEX IF NOT EXISTS idx_claims_night_coefficient ON claims(night_coefficient);
