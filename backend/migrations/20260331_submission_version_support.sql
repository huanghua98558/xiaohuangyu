-- submissionVersion 正式落库（幂等）
-- 1) claims 持久化当前提审版本
-- 2) ai_review_queue 持久化对应审核版本，避免重提串单

ALTER TABLE claims
  ADD COLUMN IF NOT EXISTS submission_version TIMESTAMPTZ;

ALTER TABLE ai_review_queue
  ADD COLUMN IF NOT EXISTS submission_version TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_claims_submission_version
  ON claims(submission_version);

CREATE INDEX IF NOT EXISTS idx_ai_review_queue_claim_submission_version
  ON ai_review_queue(claim_id, submission_version);
