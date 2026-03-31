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

function normalizeJobRow(row) {
  if (!row) return null;
  return {
    ...row,
    ocr_result_json: normalizeJsonColumn(row.ocr_result_json),
    error_json: normalizeJsonColumn(row.error_json),
  };
}

export async function upsertImageReviewOcrJobs({
  runId,
  routePlan,
}) {
  return db.transaction(async (client) => {
    for (const route of routePlan.routes || []) {
      await client.query(
        `
        INSERT INTO image_review_ocr_jobs (
          run_id,
          claim_id,
          submission_version,
          dispatch_key,
          screenshot_index,
          sort_order,
          image_url,
          expected_role,
          precheck_role,
          resolved_role,
          precheck_confidence,
          precheck_reason,
          ocr_profile,
          status,
          attempt_count,
          created_at,
          updated_at
        ) VALUES (
          $1,
          $2,
          $3::timestamptz,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          'pending',
          0,
          NOW(),
          NOW()
        )
        ON CONFLICT (dispatch_key) DO UPDATE SET
          run_id = EXCLUDED.run_id,
          claim_id = EXCLUDED.claim_id,
          submission_version = EXCLUDED.submission_version,
          screenshot_index = EXCLUDED.screenshot_index,
          sort_order = EXCLUDED.sort_order,
          image_url = EXCLUDED.image_url,
          expected_role = EXCLUDED.expected_role,
          precheck_role = EXCLUDED.precheck_role,
          resolved_role = EXCLUDED.resolved_role,
          precheck_confidence = EXCLUDED.precheck_confidence,
          precheck_reason = EXCLUDED.precheck_reason,
          ocr_profile = EXCLUDED.ocr_profile,
          status = CASE
            WHEN image_review_ocr_jobs.status IN ('failed', 'quarantined') THEN 'pending'
            ELSE image_review_ocr_jobs.status
          END,
          attempt_count = CASE
            WHEN image_review_ocr_jobs.status IN ('failed', 'quarantined') THEN 0
            ELSE image_review_ocr_jobs.attempt_count
          END,
          claimed_by = CASE
            WHEN image_review_ocr_jobs.status IN ('failed', 'quarantined') THEN NULL
            ELSE image_review_ocr_jobs.claimed_by
          END,
          claimed_at = CASE
            WHEN image_review_ocr_jobs.status IN ('failed', 'quarantined') THEN NULL
            ELSE image_review_ocr_jobs.claimed_at
          END,
          error_json = CASE
            WHEN image_review_ocr_jobs.status IN ('failed', 'quarantined') THEN NULL
            ELSE image_review_ocr_jobs.error_json
          END,
          updated_at = NOW()
        `,
        [
          runId,
          routePlan.claimId,
          routePlan.submissionVersion,
          route.dispatchKey,
          route.screenshotIndex,
          route.sortOrder,
          route.url,
          route.expectedRole,
          route.precheckRole,
          route.resolvedRole,
          route.precheckConfidence,
          route.precheckReason,
          route.ocrProfile,
        ]
      );
    }

    const result = await client.query(
      `SELECT * FROM image_review_ocr_jobs WHERE run_id = $1 ORDER BY screenshot_index ASC`,
      [runId]
    );
    return result.rows.map(normalizeJobRow);
  });
}

export async function listImageReviewOcrJobsByRunId(runId) {
  const rows = await db.queryMany(
    `SELECT * FROM image_review_ocr_jobs WHERE run_id = $1 ORDER BY screenshot_index ASC`,
    [runId]
  );
  return rows.map(normalizeJobRow);
}

export async function claimNextPendingImageReviewOcrJob({
  ocrProfile,
  claimedBy,
}) {
  return db.transaction(async (client) => {
    const result = await client.query(
      `
      UPDATE image_review_ocr_jobs
      SET status = 'processing',
          claimed_by = $2,
          claimed_at = NOW(),
          attempt_count = attempt_count + 1,
          updated_at = NOW()
      WHERE id = (
        SELECT id
        FROM image_review_ocr_jobs
        WHERE ocr_profile = $1
          AND status = 'pending'
        ORDER BY created_at ASC
        LIMIT 1
      )
      RETURNING *
      `,
      [ocrProfile, claimedBy]
    );

    return normalizeJobRow(result.rows?.[0] || null);
  });
}

export async function markImageReviewOcrJobCompleted({
  dispatchKey,
  ocrResult,
}) {
  const row = await db.queryOne(
    `
    UPDATE image_review_ocr_jobs
    SET status = 'completed',
        attempt_count = attempt_count + 1,
        ocr_result_json = $2::jsonb,
        error_json = NULL,
        processed_at = NOW(),
        updated_at = NOW()
    WHERE dispatch_key = $1
    RETURNING *
    `,
    [dispatchKey, JSON.stringify(ocrResult)]
  );
  return normalizeJobRow(row);
}

export async function markImageReviewOcrJobProcessing({
  dispatchKey,
  claimedBy = null,
}) {
  const row = await db.queryOne(
    `
    UPDATE image_review_ocr_jobs
    SET status = 'processing',
        claimed_by = COALESCE($2, claimed_by),
        claimed_at = NOW(),
        updated_at = NOW()
    WHERE dispatch_key = $1
    RETURNING *
    `,
    [dispatchKey, claimedBy]
  );
  return normalizeJobRow(row);
}

export async function markImageReviewOcrJobFailed({
  dispatchKey,
  error,
  status = 'failed',
}) {
  const row = await db.queryOne(
    `
    UPDATE image_review_ocr_jobs
    SET status = $2,
        attempt_count = attempt_count + 1,
        error_json = $3::jsonb,
        processed_at = NOW(),
        updated_at = NOW()
    WHERE dispatch_key = $1
    RETURNING *
    `,
    [
      dispatchKey,
      status,
      JSON.stringify(error || {}),
    ]
  );
  return normalizeJobRow(row);
}

export default {
  claimNextPendingImageReviewOcrJob,
  listImageReviewOcrJobsByRunId,
  markImageReviewOcrJobCompleted,
  markImageReviewOcrJobProcessing,
  markImageReviewOcrJobFailed,
  upsertImageReviewOcrJobs,
};

