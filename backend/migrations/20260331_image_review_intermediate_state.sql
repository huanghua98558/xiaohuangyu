-- 图片审核中间状态落库（幂等）
-- 1) image_review_runs: 一次 claim + submission_version 的整次运行态
-- 2) image_review_ocr_jobs: 每张图 / 每个 dispatch_key 的 OCR 子任务态

CREATE TABLE IF NOT EXISTS image_review_runs (
  id BIGINT PRIMARY KEY DEFAULT unique_rowid(),
  claim_id INT NOT NULL,
  task_id BIGINT NOT NULL,
  user_id INT NOT NULL,
  submission_version TIMESTAMPTZ NOT NULL,
  merge_key STRING NOT NULL,
  source_queue_id BIGINT NULL,
  status STRING NOT NULL DEFAULT 'pending_router',
  route_plan_json JSONB NULL,
  merge_payload_json JSONB NULL,
  expected_count INT NOT NULL DEFAULT 0,
  ready_count INT NOT NULL DEFAULT 0,
  last_error STRING NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  merged_at TIMESTAMPTZ NULL,
  CONSTRAINT uq_image_review_runs_claim_submission UNIQUE (claim_id, submission_version),
  CONSTRAINT uq_image_review_runs_merge_key UNIQUE (merge_key)
);

CREATE INDEX IF NOT EXISTS idx_image_review_runs_status
  ON image_review_runs(status);

CREATE INDEX IF NOT EXISTS idx_image_review_runs_source_queue
  ON image_review_runs(source_queue_id);

CREATE INDEX IF NOT EXISTS idx_image_review_runs_submission_version
  ON image_review_runs(submission_version);

CREATE TABLE IF NOT EXISTS image_review_ocr_jobs (
  id BIGINT PRIMARY KEY DEFAULT unique_rowid(),
  run_id BIGINT NOT NULL,
  claim_id INT NOT NULL,
  submission_version TIMESTAMPTZ NOT NULL,
  dispatch_key STRING NOT NULL,
  screenshot_index INT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  image_url STRING NOT NULL,
  expected_role STRING NOT NULL,
  precheck_role STRING NULL,
  resolved_role STRING NOT NULL,
  precheck_confidence STRING NULL,
  precheck_reason STRING NULL,
  ocr_profile STRING NOT NULL,
  status STRING NOT NULL DEFAULT 'pending',
  attempt_count INT NOT NULL DEFAULT 0,
  claimed_by STRING NULL,
  claimed_at TIMESTAMPTZ NULL,
  ocr_result_json JSONB NULL,
  error_json JSONB NULL,
  processed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_image_review_ocr_jobs_dispatch_key UNIQUE (dispatch_key)
);

CREATE INDEX IF NOT EXISTS idx_image_review_ocr_jobs_run_status
  ON image_review_ocr_jobs(run_id, status);

CREATE INDEX IF NOT EXISTS idx_image_review_ocr_jobs_claim_submission
  ON image_review_ocr_jobs(claim_id, submission_version);

CREATE INDEX IF NOT EXISTS idx_image_review_ocr_jobs_profile_status_created
  ON image_review_ocr_jobs(ocr_profile, status, created_at);

