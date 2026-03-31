import db from '../../config/database.js';

function normalizeJsonColumn(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeRunRow(row) {
  if (!row) return null;
  return {
    ...row,
    route_plan_json: normalizeJsonColumn(row.route_plan_json),
    merge_payload_json: normalizeJsonColumn(row.merge_payload_json),
  };
}

export async function upsertImageReviewRun({
  routePlan,
  sourceQueueId = null,
  status = 'ocr_pending',
  lastError = null,
}) {
  const expectedCount = Array.isArray(routePlan?.routes) ? routePlan.routes.length : 0;
  const row = await db.queryOne(
    `
    INSERT INTO image_review_runs (
      claim_id,
      task_id,
      user_id,
      submission_version,
      merge_key,
      source_queue_id,
      status,
      route_plan_json,
      expected_count,
      ready_count,
      last_error,
      created_at,
      updated_at
    ) VALUES (
      $1,
      $2,
      $3,
      $4::timestamptz,
      $5,
      $6,
      $7,
      $8::jsonb,
      $9,
      0,
      $10,
      NOW(),
      NOW()
    )
    ON CONFLICT (claim_id, submission_version) DO UPDATE SET
      task_id = EXCLUDED.task_id,
      user_id = EXCLUDED.user_id,
      merge_key = EXCLUDED.merge_key,
      source_queue_id = COALESCE(EXCLUDED.source_queue_id, image_review_runs.source_queue_id),
      status = EXCLUDED.status,
      route_plan_json = EXCLUDED.route_plan_json,
      expected_count = EXCLUDED.expected_count,
      last_error = EXCLUDED.last_error,
      updated_at = NOW()
    RETURNING *
    `,
    [
      routePlan.claimId,
      routePlan.taskId,
      routePlan.userId,
      routePlan.submissionVersion,
      routePlan.mergeKey,
      sourceQueueId,
      status,
      JSON.stringify(routePlan),
      expectedCount,
      lastError,
    ]
  );

  return normalizeRunRow(row);
}

export async function getImageReviewRunByMergeKey(mergeKey) {
  const row = await db.queryOne(
    `SELECT * FROM image_review_runs WHERE merge_key = $1 LIMIT 1`,
    [mergeKey]
  );
  return normalizeRunRow(row);
}

export async function getImageReviewRunById(runId) {
  const row = await db.queryOne(
    `SELECT * FROM image_review_runs WHERE id = $1 LIMIT 1`,
    [runId]
  );
  return normalizeRunRow(row);
}

export async function claimNextMergeReadyImageReviewRun() {
  const row = await db.queryOne(
    `
    UPDATE image_review_runs
    SET status = 'merged',
        updated_at = NOW()
    WHERE id = (
      SELECT id
      FROM image_review_runs
      WHERE status = 'merge_ready'
      ORDER BY updated_at ASC
      LIMIT 1
    )
    RETURNING *
    `
  );
  return normalizeRunRow(row);
}

export async function getImageReviewRunByClaimVersion({ claimId, submissionVersion }) {
  const row = await db.queryOne(
    `SELECT * FROM image_review_runs WHERE claim_id = $1 AND submission_version = $2::timestamptz LIMIT 1`,
    [claimId, submissionVersion]
  );
  return normalizeRunRow(row);
}

export async function updateImageReviewRunMergeState({
  runId,
  mergePayload,
  status,
  readyCount = 0,
  lastError = null,
  mergedAt = null,
}) {
  const row = await db.queryOne(
    `
    UPDATE image_review_runs
    SET merge_payload_json = $2::jsonb,
        status = $3,
        ready_count = $4,
        last_error = $5,
        merged_at = COALESCE($6::timestamptz, merged_at),
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [
      runId,
      JSON.stringify(mergePayload),
      status,
      readyCount,
      lastError,
      mergedAt,
    ]
  );

  return normalizeRunRow(row);
}

export default {
  claimNextMergeReadyImageReviewRun,
  getImageReviewRunByClaimVersion,
  getImageReviewRunById,
  getImageReviewRunByMergeKey,
  updateImageReviewRunMergeState,
  upsertImageReviewRun,
};

