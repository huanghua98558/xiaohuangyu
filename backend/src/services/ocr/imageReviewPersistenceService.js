import db from '../../config/database.js';
import { CLAIM_STATUS } from '../../constants/claimLifecycle.js';
import { appendReviewHistory, createReviewHistoryEntry } from '../../utils/claimReviewHistory.js';

export async function saveImageReviewResult({ item, result, duration }) {
  await db.transaction(async (client) => {
    const historyRes = await client.query(`SELECT review_history FROM claims WHERE id = $1`, [item.claim_id]);
    const reviewHistory = appendReviewHistory(
      historyRes.rows?.[0]?.review_history,
      createReviewHistoryEntry({
        stage: 'image_review',
        action: result.passed ? 'approved' : 'rejected',
        reason: result.reasons.join('; ') || '审核通过',
        details: {
          type: result.type,
          hasComment: result.hasComment,
          interaction: result.interaction,
          source: result.source || 'ocr_yolo',
          durationMs: duration,
          recheck: result.recheck || null,
          commenterNickname: result.commenterNickname || '没有',
          comment: result.comment || '没有',
          authorName: result.authorName || '没有',
          screenshots: result.screenshotEvidence || [],
          detected: result.detected || {},
          checksEnabled: result.checksEnabled || {},
        },
      })
    );

    await client.query(`
      UPDATE claims
      SET image_review_status = $1,
          image_review_reason = $2,
          image_reviewed_at = NOW(),
          ocr_comment = $3,
          platform_nickname = COALESCE(NULLIF(platform_nickname, ''), $4),
          ai_review_status = $5,
          ai_reason = $6,
          review_history = $7
      WHERE id = $8
    `, [
      result.passed ? 'approved' : 'rejected',
      result.reasons.join('; ') || '审核通过',
      result.comment || null,
      result.commenterNickname || null,
      result.passed ? 'approved' : 'rejected',
      JSON.stringify(result),
      JSON.stringify(reviewHistory),
      item.claim_id,
    ]);

    await client.query(`
      UPDATE ai_review_queue
      SET status = 'completed',
          ai_result = $1,
          ai_confidence = $2,
          ai_reason = $3,
          processed_at = NOW()
      WHERE id = $4
    `, [
      result.passed ? 'approved' : 'rejected',
      result.passed ? 0.9 : 0.5,
      JSON.stringify(result),
      item.queue_id,
    ]);
  });
}

export async function markImageReviewTaskCompleted({ item, reason }) {
  await db.transaction(async (client) => {
    const historyRes = await client.query(`SELECT review_history FROM claims WHERE id = $1`, [item.claim_id]);
    const reviewHistory = appendReviewHistory(
      historyRes.rows?.[0]?.review_history,
      createReviewHistoryEntry({
        stage: 'task_complete',
        action: 'approved',
        reason,
        details: { source: 'image_review_worker' },
      })
    );

    await client.query(`
      UPDATE claims
      SET status = $1,
          link_review_status = 'skipped',
          link_review_reason = $2,
          review_note = $2,
          reviewed_at = NOW(),
          review_history = $3
      WHERE id = $4
    `, [CLAIM_STATUS.APPROVED, reason, JSON.stringify(reviewHistory), item.claim_id]);
  });
}

export async function markImageReviewRejected({ item, result, options = {} }) {
  return db.transaction(async (client) => {
    const claimRes = await client.query(`SELECT reject_count, review_history FROM claims WHERE id = $1`, [item.claim_id]);
    const rejectCount = Number(claimRes.rows[0]?.reject_count || 0) + 1;
    const reviewReason = result.reasons.join('; ') || '图片审核未通过';

    let reviewHistory = appendReviewHistory(
      claimRes.rows?.[0]?.review_history,
      createReviewHistoryEntry({
        stage: 'claim_flow',
        action: rejectCount >= 3 ? 'released' : 'returned',
        reason: reviewReason,
        details: {
          rejectCount,
          source: 'image_review',
        },
      })
    );

    if (options.pushToManualQueue) {
      reviewHistory = appendReviewHistory(
        reviewHistory,
        createReviewHistoryEntry({
          stage: 'manual_review',
          action: 'queued',
          reason: options.manualReason || '已加入人工检查列表',
          details: {
            ...(options.manualDetails || {}),
            previousDecision: 'rejected',
          },
        })
      );
    }

    const nextAiStatus = options.pushToManualQueue ? 'manual' : 'rejected';
    const aiReason = JSON.stringify({
      ...result,
      manualReview: options.pushToManualQueue ? {
        queued: true,
        reason: options.manualReason || '已加入人工检查列表',
        details: options.manualDetails || {},
      } : undefined,
    });

    if (rejectCount >= 3) {
      await client.query(`
        UPDATE claims
        SET status = 'released',
            reject_count = $1,
            submitted_at = NULL,
            reviewed_at = NOW(),
            review_note = $2,
            ai_review_status = $4,
            ai_reason = $5,
            image_review_status = 'rejected',
            image_review_reason = $2,
            review_history = $3
        WHERE id = $6
      `, [rejectCount, reviewReason, JSON.stringify(reviewHistory), nextAiStatus, aiReason, item.claim_id]);

      return {
        released: true,
        rejectCount,
        reviewReason,
      };
    }

    const timeLimitResult = await client.query(
      `SELECT t.time_limit_minutes FROM claims c JOIN tasks t ON c.task_id = t.id WHERE c.id = $1`,
      [item.claim_id]
    );
    const timeLimitMinutes = timeLimitResult.rows[0]?.time_limit_minutes || 15;
    const newExpiresAt = new Date(Date.now() + timeLimitMinutes * 60 * 1000);

    await client.query(`
      UPDATE claims
      SET status = $1,
          reject_count = $2,
          submitted_at = NULL,
          reviewed_at = NOW(),
          review_note = $3,
          ai_review_status = $5,
          ai_reason = $6,
          image_review_status = 'rejected',
          image_review_reason = $3,
          review_history = $4,
          expires_at = $7
      WHERE id = $8
    `, [CLAIM_STATUS.DOING, rejectCount, reviewReason, JSON.stringify(reviewHistory), nextAiStatus, aiReason, newExpiresAt, item.claim_id]);

    return {
      released: false,
      rejectCount,
      reviewReason,
      timeLimitMinutes,
    };
  });
}

export async function markImageReviewManual({ item, reason, details = {} }) {
  await db.transaction(async (client) => {
    const historyRes = await client.query(`SELECT review_history FROM claims WHERE id = $1`, [item.claim_id]);
    const reviewHistory = appendReviewHistory(
      historyRes.rows?.[0]?.review_history,
      createReviewHistoryEntry({
        stage: 'image_review',
        action: 'manual',
        reason,
        details: {
          ...details,
          blocking: details.blocking !== false,
        },
      })
    );

    await client.query(
      `
      UPDATE claims
      SET status = $1,
          ai_review_status = 'manual',
          ai_reason = $2,
          image_review_status = 'manual',
          image_review_reason = $2,
          review_note = $2,
          review_history = $3
      WHERE id = $4
      `,
      [CLAIM_STATUS.PENDING_MANUAL, reason, JSON.stringify(reviewHistory), item.claim_id]
    );

    await client.query(
      `
      UPDATE ai_review_queue
      SET status = 'completed',
          ai_result = 'manual',
          ai_reason = $1,
          processed_at = NOW()
      WHERE id = $2
      `,
      [JSON.stringify({ reason, details }), item.queue_id]
    );
  });
}

export default {
  markImageReviewManual,
  markImageReviewRejected,
  markImageReviewTaskCompleted,
  saveImageReviewResult,
};

