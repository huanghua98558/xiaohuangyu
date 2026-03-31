/**
 * 图片审核服务 - 优化版
 */

import axios from 'axios';
import sharp from 'sharp';
import supabase from '../../utils/supabaseToPrismaAdapter.js';
import prisma from '../../utils/prisma.js';
import logger from '../../utils/logger.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import db from '../../config/database.js';
import pointsSettlementService from '../pointsSettlementService.js';
import { enqueueLinkVerificationCompat } from './queueService.js';
import { CLAIM_STATUS } from '../../constants/claimLifecycle.js';
import { appendReviewHistory, createReviewHistoryEntry } from '../../utils/claimReviewHistory.js';

dotenv.config();

const PADDLE_OCR_URL = process.env.PADDLE_OCR_URL || 'http://localhost:8088';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/** 仅允许正整数 ID，避免动态 IN 子句被注入（任务/用户 id 来自本库查询结果） */
function toSafePositiveIntIds(ids) {
  const out = []
  const seen = new Set()
  for (const id of ids) {
    const n = Number(id)
    if (!Number.isInteger(n) || n <= 0 || n > 2147483647) continue
    if (seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}

function urlToLocalPath(url) {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const localPath = path.join('/var/www/xiaohuangyu/uploads', pathname);
    if (fs.existsSync(localPath)) {
      return localPath;
    }
  } catch (e) {}
  return url;
}

function extractAuthorFromTitle(title) {
  if (!title) return null;
  const patterns = [
    /^([a-zA-Z0-9_\一-\龥]+)\s*[-–—]\s*/i,
    /^([a-zA-Z0-9_\一-\龥]+)\s*[|｜]\s*/i,
    /^([a-zA-Z0-9_\一-\龥]+)\s*[:：]\s*/i,
  ];
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match && match[1].length >= 2 && match[1].length <= 20) {
      return match[1].trim();
    }
  }
  return null;
}

async function reviewImage(imageUrl, userId) {
  return { provider: 'local', result: 'processed', confidence: 0.8 };
}

async function reviewWithPaddleOCR(imageUrl, userId) {
  return { provider: 'paddleocr', text: '', confidence: 0.8 };
}

async function reviewWithGemini(imageUrl, userId) {
  return { provider: 'gemini', result: 'skipped', confidence: 0.5 };
}

async function reviewWithBailian(imageUrl, userId) {
  return { provider: 'bailian', result: 'skipped', confidence: 0.5 };
}

// 优化查询
async function getReviewQueue(options = {}) {
  const pageSize = Number(options.pageSize || options.limit || 20);
  const page = Math.max(1, Number(options.page || 1));
  const limit = pageSize;
  const offset = Number.isFinite(Number(options.offset)) ? Number(options.offset) : (page - 1) * limit;
  const status = typeof options.status === 'string' ? options.status.trim() : '';
  
  // 构建基础查询
  let baseQuery = `
    SELECT
      c.id,
      c.user_id,
      c.task_id,
      c.screenshots,
      c.status,
      c.ai_review_status,
      c.ai_confidence,
      c.ai_reason,
      c.review_note,
      c.image_review_status,
      c.link_review_status,
      c.image_review_reason,
      c.link_review_reason,
      c.reject_count,
      c.review_history,
      c.claimed_at,
      c.submitted_at,
      c.reviewed_at,
      c.block_status,
      ba.id AS blocked_record_id,
      ba.status AS blocked_record_status,
      ba.review_note AS blocked_review_note,
      ba.detected_at AS blocked_detected_at
    FROM claims c
    LEFT JOIN LATERAL (
      SELECT id, status, review_note, detected_at
      FROM blocked_accounts
      WHERE claim_id = c.id
      ORDER BY COALESCE(reviewed_at, detected_at, created_at) DESC, id DESC
      LIMIT 1
    ) ba ON true
    WHERE c.screenshots IS NOT NULL
      AND c.screenshots::text != '[]'
  `;
  let countQuery = "SELECT COUNT(*) as count FROM claims c WHERE c.screenshots IS NOT NULL AND c.screenshots::text != '[]'";
  
  // 添加状态过滤
  if (status) {
    if (status === 'image_reviewing') {
      baseQuery += " AND c.status IN ('submitted', 'image_reviewing')";
      countQuery += " AND c.status IN ('submitted', 'image_reviewing')";
    } else if (status === 'link_reviewing') {
      baseQuery += " AND c.status = 'link_reviewing'";
      countQuery += " AND c.status = 'link_reviewing'";
    } else if (status === 'pending_link') {
      baseQuery += " AND c.status = 'pending_link'";
      countQuery += " AND c.status = 'pending_link'";
    } else if (status === 'rejected') {
      baseQuery += " AND COALESCE(c.block_status, 'none') != 'confirmed' AND (c.status IN ('released', 'image_rejected', 'link_rejected', 'rejected') OR (c.status = 'doing' AND (c.image_review_status = 'rejected' OR c.link_review_status = 'rejected')))";
      countQuery += " AND COALESCE(c.block_status, 'none') != 'confirmed' AND (c.status IN ('released', 'image_rejected', 'link_rejected', 'rejected') OR (c.status = 'doing' AND (c.image_review_status = 'rejected' OR c.link_review_status = 'rejected')))";
    } else if (status === 'approved') {
      baseQuery += " AND c.status IN ('approved', 'done')";
      countQuery += " AND c.status IN ('approved', 'done')";
    } else if (status === 'manual') {
      baseQuery += " AND COALESCE(c.block_status, 'none') != 'confirmed' AND (c.status = 'pending_manual' OR c.ai_review_status = 'manual' OR c.link_review_status = 'manual')";
      countQuery += " AND COALESCE(c.block_status, 'none') != 'confirmed' AND (c.status = 'pending_manual' OR c.ai_review_status = 'manual' OR c.link_review_status = 'manual')";
    } else if (status === 'blocked') {
      baseQuery += " AND c.block_status = 'confirmed'";
      countQuery += " AND c.block_status = 'confirmed'";
    } else if (status === 'pending') {
      baseQuery += " AND c.status IN ('submitted', 'image_reviewing', 'pending_link', 'link_reviewing', 'pending_manual')";
      countQuery += " AND c.status IN ('submitted', 'image_reviewing', 'pending_link', 'link_reviewing', 'pending_manual')";
    } else if (status === 'submitted') {
      baseQuery += " AND c.status = 'submitted'";
      countQuery += " AND c.status = 'submitted'";
    } else {
      const validAiStatuses = ['manual', 'checked', 'processing', 'ai_approved', 'ai_rejected'];
      if (validAiStatuses.includes(status)) {
        baseQuery += " AND c.ai_review_status = '" + status + "'";
        countQuery += " AND ai_review_status = '" + status + "'";
      }
    }
  }

  const safeLimit = Math.min(200, Math.max(1, Math.floor(Number.isFinite(limit) ? limit : 20)))
  const safeOffset = Math.max(0, Math.floor(Number.isFinite(offset) ? offset : 0))
  baseQuery += ' ORDER BY c.id DESC LIMIT ' + safeLimit + ' OFFSET ' + safeOffset

  // 执行查询
  const [countResult, claims] = await Promise.all([
    prisma.$queryRawUnsafe(countQuery),
    prisma.$queryRawUnsafe(baseQuery)
  ]);
  
  const total = Number(countResult[0]?.count || 0);
  
  // 获取关联的任务和用户信息
  const taskIds = [...new Set(claims.map(c => c.task_id).filter(Boolean))];
  const userIds = [...new Set(claims.map(c => c.user_id).filter(Boolean))];
  
  let tasks = [];
  let users = [];
  
  const safeTaskIds = toSafePositiveIntIds(taskIds)
  const safeUserIds = toSafePositiveIntIds(userIds)
  if (safeTaskIds.length > 0) {
    tasks = await prisma.$queryRawUnsafe(
      'SELECT id, title, platform, action, video_url FROM tasks WHERE id IN (' + safeTaskIds.join(',') + ')'
    )
  }
  if (safeUserIds.length > 0) {
    users = await prisma.$queryRawUnsafe(
      'SELECT id, username FROM users WHERE id IN (' + safeUserIds.join(',') + ')'
    )
  }
  
  const taskMap = new Map(tasks.map(t => [String(t.id), t]));
  const userMap = new Map(users.map(u => [String(u.id), u]));
  
  const list = claims.map(c => {
    // 解析 review_history 为数组
    let reviewHistory = c.review_history;
    if (typeof reviewHistory === 'string') {
      try {
        reviewHistory = JSON.parse(reviewHistory);
      } catch (e) {
        reviewHistory = [];
      }
    }
    
    return {
      id: String(c.id),
      user_id: String(c.user_id),
      task_id: String(c.task_id),
      screenshots: c.screenshots,
      status: c.status,
      ai_review_status: c.ai_review_status,
      ai_confidence: c.ai_confidence,
      ai_reason: c.ai_reason,
      review_note: c.review_note,
      image_review_status: c.image_review_status,
      link_review_status: c.link_review_status,
      image_review_reason: c.image_review_reason,
      link_review_reason: c.link_review_reason,
      block_status: c.block_status || 'none',
      blocked_record_id: c.blocked_record_id ? String(c.blocked_record_id) : null,
      blocked_record_status: c.blocked_record_status || null,
      blocked_review_note: c.blocked_review_note || null,
      blocked_detected_at: c.blocked_detected_at || null,
      reject_count: c.reject_count,
      review_history: reviewHistory,
      claimed_at: c.claimed_at,
      submitted_at: c.submitted_at,
      reviewed_at: c.reviewed_at || c.submitted_at || c.claimed_at,
      tasks: taskMap.get(String(c.task_id)),
      users: userMap.get(String(c.user_id))
    };
  });
  
  return { list, total };
}

// 优化统计
async function getReviewStats() {
  // 获取今日日期
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // 使用原始SQL查询统计各状态数量
  const statsResult = await prisma.$queryRawUnsafe(`
    SELECT 
      COUNT(*) FILTER (WHERE status IN ('submitted', 'image_reviewing', 'pending_link', 'link_reviewing', 'pending_manual')) as pending,
      COUNT(*) FILTER (WHERE ai_review_status = 'approved') as ai_approved,
      COUNT(*) FILTER (WHERE ai_review_status = 'rejected') as ai_rejected,
      COUNT(*) FILTER (WHERE COALESCE(block_status, 'none') != 'confirmed' AND (status = 'pending_manual' OR ai_review_status = 'manual' OR link_review_status = 'manual')) as manual,
      COUNT(*) FILTER (WHERE status IN ('submitted', 'image_reviewing')) as image_reviewing,
      COUNT(*) FILTER (WHERE status = 'link_reviewing') as link_reviewing,
      COUNT(*) FILTER (WHERE status = 'pending_link') as pending_link,
      COUNT(*) FILTER (WHERE COALESCE(block_status, 'none') != 'confirmed' AND (status IN ('released', 'image_rejected', 'link_rejected', 'rejected') OR (status = 'doing' AND (image_review_status = 'rejected' OR link_review_status = 'rejected')))) as rejected,
      COUNT(*) FILTER (WHERE status IN ('approved', 'done')) as approved,
      COUNT(*) FILTER (WHERE block_status = 'confirmed') as blocked
    FROM claims
    WHERE screenshots IS NOT NULL
  `);
  
  // 今日统计
  const todayStatsResult = await prisma.$queryRawUnsafe(`
    SELECT 
      COUNT(*) FILTER (WHERE status IN ('approved', 'done') AND reviewed_at >= '${today.toISOString()}') as today_approved,
      COUNT(*) FILTER (WHERE (status IN ('released', 'image_rejected', 'link_rejected', 'rejected') OR (status = 'doing' AND (image_review_status = 'rejected' OR link_review_status = 'rejected'))) AND reviewed_at >= '${today.toISOString()}') as today_rejected
    FROM claims
    WHERE screenshots IS NOT NULL
  `);
  
  const s = statsResult[0] || {};
  const t = todayStatsResult[0] || {};
  const total = (Number(s.pending) || 0) + (Number(s.ai_approved) || 0) + (Number(s.ai_rejected) || 0) + (Number(s.manual) || 0);
  const autoRate = total > 0 ? Math.round((Number(s.ai_approved) || 0) / total * 100) : 0;
  const todayApproved = Number(t.today_approved) || 0;
  const todayRejected = Number(t.today_rejected) || 0;
  
  return { 
    total, 
    pending: Number(s.pending) || 0, 
    aiApproved: Number(s.ai_approved) || 0, 
    aiRejected: Number(s.ai_rejected) || 0,
    manual: Number(s.manual) || 0, 
    imageReviewing: Number(s.image_reviewing) || 0, 
    linkReviewing: Number(s.link_reviewing) || 0,
    pendingLink: Number(s.pending_link) || 0,
    rejected: Number(s.rejected) || 0,
    approved: Number(s.approved) || 0,
    blocked: Number(s.blocked) || 0,
    autoRate,
    todayApproved,
    todayRejected,
    todayReviewed: todayApproved + todayRejected
  };
}

function resolveManualStage(claim) {
  const linkStageStatuses = ['manual', 'rejected', 'reviewing', 'pending'];

  if (
    claim.link_review_status === 'manual' ||
    (claim.image_review_status === 'approved' && linkStageStatuses.includes(claim.link_review_status))
  ) {
    return 'link_review';
  }

  return 'image_review';
}

async function manualApprove(claimId, reviewerId, note) {
  const claim = await db.queryOne(
    `
    SELECT c.id, c.user_id, c.task_id, c.status, c.review_history, c.ai_review_status, c.image_review_status, c.link_review_status, c.submitted_at,
           t.video_url, t.title AS task_title, t.platform, t.action
    FROM claims c
    LEFT JOIN tasks t ON t.id = c.task_id
    WHERE c.id = $1
    `,
    [claimId]
  )

  if (!claim) {
    throw new Error('任务认领记录不存在')
  }

  if (claim.status === CLAIM_STATUS.RELEASED) {
    throw new Error('任务已释放，不能继续原流程，请重新领取后处理')
  }

  const stage = resolveManualStage(claim)
  const manualReason = note || (stage === 'image_review' ? '人工纠正图片审核通过' : '人工纠正连接审核通过')

  if (stage === 'image_review') {
    const hasLinkReview = Boolean(claim.video_url)

    if (hasLinkReview) {
      const queueResult = await enqueueLinkVerificationCompat({
        claimId,
        userId: claim.user_id,
        taskId: claim.task_id,
        videoUrl: claim.video_url,
        platform: claim.platform,
        taskAuthorName: extractAuthorFromTitle(claim.task_title),
        action: claim.action
      })

      if (queueResult?.queued) {
        await db.transaction(async (client) => {
          let nextHistory = appendReviewHistory(
            claim.review_history,
            createReviewHistoryEntry({
              stage: 'manual_review',
              action: 'approved',
              reason: manualReason,
              details: {
                reviewerId: String(reviewerId),
                previousStatus: claim.status,
                stage
              }
            })
          )

          nextHistory = appendReviewHistory(
            nextHistory,
            createReviewHistoryEntry({
              stage: 'link_review',
              action: 'queued',
              reason: `人工纠正后继续进入连接审核，基础延迟 ${queueResult.config.delayMinutes} 分钟`,
              details: {
                reviewerId: String(reviewerId),
                delayMinutes: queueResult.config.delayMinutes,
                batchThreshold: queueResult.config.batchThreshold,
                maxWaitMinutes: queueResult.config.maxWaitMinutes,
                batchSize: queueResult.config.batchSize
              }
            })
          )

          await client.query(
            `
            UPDATE claims
            SET status = $1,
                submitted_at = COALESCE(submitted_at, NOW()),
                ai_review_status = 'manual_approved',
                image_review_status = 'approved',
                image_review_reason = $2,
                image_reviewed_at = NOW(),
                link_review_status = 'pending',
                link_review_reason = $3,
                reviewer_id = $4,
                review_note = $3,
                review_history = $5
            WHERE id = $6
            `,
            [
              CLAIM_STATUS.PENDING_LINK,
              manualReason,
              '图片人工纠正通过，等待连接审核',
              reviewerId,
              JSON.stringify(nextHistory),
              claimId
            ]
          )
        })

        return { claimId, message: '已纠正为通过，继续进入连接审核' }
      }

      if (!queueResult?.skipped) {
        throw new Error('人工纠正后加入连接审核队列失败')
      }
    }

    await db.transaction(async (client) => {
      const nextHistory = appendReviewHistory(
        claim.review_history,
        createReviewHistoryEntry({
          stage: 'manual_review',
          action: 'approved',
          reason: manualReason,
          details: {
            reviewerId: String(reviewerId),
            previousStatus: claim.status,
            stage
          }
        })
      )

      await client.query(
        `
        UPDATE claims
        SET status = $1,
            ai_review_status = 'manual_approved',
            image_review_status = 'approved',
            image_review_reason = $2,
            image_reviewed_at = NOW(),
            link_review_status = 'skipped',
            link_review_reason = $3,
            reviewer_id = $4,
            review_note = $3,
            reviewed_at = NOW(),
            review_history = $5
        WHERE id = $6
        `,
        [
          CLAIM_STATUS.APPROVED,
          manualReason,
          hasLinkReview ? '连接审核已关闭，人工直接放行' : '人工审核通过（免连接审核）',
          reviewerId,
          JSON.stringify(nextHistory),
          claimId
        ]
      )
    })

    await pointsSettlementService.awardClaimPoints({
      claimId,
      taskId: claim.task_id,
      userId: claim.user_id,
      awardReason: manualReason,
      source: 'image_review_manual'
    })

    return { claimId, message: '审核通过' }
  }

  await db.transaction(async (client) => {
    const nextHistory = appendReviewHistory(
      claim.review_history,
      createReviewHistoryEntry({
        stage: 'manual_review',
        action: 'approved',
        reason: manualReason,
        details: {
          reviewerId: String(reviewerId),
          previousStatus: claim.status,
          stage
        }
      })
    )

    await client.query(
      `
      UPDATE claims
      SET status = $1,
          link_review_status = 'approved',
          link_review_reason = $2,
          link_reviewed_at = NOW(),
          link_verified = true,
          link_verify_result = $4,
          reviewed_at = NOW(),
          reviewer_id = $3,
          review_note = $2,
          review_history = $5
      WHERE id = $6
      `,
      [
        CLAIM_STATUS.APPROVED,
        manualReason,
        reviewerId,
        JSON.stringify({
          approvedBy: 'manual_review',
          reason: manualReason
        }),
        JSON.stringify(nextHistory),
        claimId
      ]
    )
  })

  await pointsSettlementService.awardClaimPoints({
    claimId,
    taskId: claim.task_id,
    userId: claim.user_id,
    awardReason: manualReason,
    source: 'link_review_manual'
  })

  return { claimId, message: '审核通过' };
}

async function manualInspect(claimId, reviewerId, note) {
  const claim = await db.queryOne(
    `
    SELECT id, status, review_history, ai_review_status, image_review_status, link_review_status, review_note
    FROM claims
    WHERE id = $1
    `,
    [claimId]
  )

  if (!claim) {
    throw new Error('任务认领记录不存在')
  }

  const stage = resolveManualStage(claim)
  const inspectReason = note || '人工已检查，维持当前结论'
  const nextHistory = appendReviewHistory(
    claim.review_history,
    createReviewHistoryEntry({
      stage: 'manual_review',
      action: 'inspected',
      reason: inspectReason,
      details: {
        reviewerId: String(reviewerId),
        previousStatus: claim.status,
        stage
      }
    })
  )

  await db.query(
    `
    UPDATE claims
    SET ai_review_status = 'checked',
        reviewer_id = $1,
        review_note = $2,
        review_history = $3
    WHERE id = $4
    `,
    [reviewerId, inspectReason, JSON.stringify(nextHistory), claimId]
  )

  return { claimId, message: '已标记为已检查', aiReviewStatus: 'checked' }
}

// 审核拒绝 - 确保同时更新status
async function manualReject(claimId, reviewerId, note) {
  const claim = await db.queryOne(
    `
    SELECT id, status, reject_count, review_history, ai_review_status, image_review_status, link_review_status
    FROM claims
    WHERE id = $1
    `,
    [claimId]
  )

  if (!claim) {
    throw new Error('任务认领记录不存在')
  }

  const rejectReason = note || '人工审核拒绝'
  const stage = resolveManualStage(claim)
  const isOptionalManualReview =
    (stage === 'image_review' && claim.image_review_status === 'rejected' && claim.status !== CLAIM_STATUS.PENDING_MANUAL) ||
    (stage === 'link_review' && claim.link_review_status === 'rejected' && claim.status !== CLAIM_STATUS.PENDING_MANUAL)

  if (isOptionalManualReview) {
    const nextHistory = appendReviewHistory(
      claim.review_history,
      createReviewHistoryEntry({
        stage: 'manual_review',
        action: 'rejected',
        reason: rejectReason,
        details: {
          reviewerId: String(reviewerId),
          previousStatus: claim.status,
          stage,
          confirmed: true
        }
      })
    )

    if (stage === 'image_review') {
      await db.query(
        `
        UPDATE claims
        SET ai_review_status = 'manual_rejected',
            reviewer_id = $1,
            review_note = $2,
            review_history = $3
        WHERE id = $4
        `,
        [reviewerId, rejectReason, JSON.stringify(nextHistory), claimId]
      )
    } else {
      await db.query(
        `
        UPDATE claims
        SET reviewer_id = $1,
            review_note = $2,
            ai_review_status = 'manual_rejected',
            link_review_reason = COALESCE(NULLIF(link_review_reason, ''), $2),
            reviewed_at = NOW(),
            review_history = $3
        WHERE id = $4
        `,
        [reviewerId, rejectReason, JSON.stringify(nextHistory), claimId]
      )
    }

    return { claimId, message: '已确认拒绝' }
  }

  const rejectCount = Number(claim.reject_count || 0) + 1
  const shouldRelease = rejectCount >= 3
  const nextHistory = appendReviewHistory(
    appendReviewHistory(
      claim.review_history,
      createReviewHistoryEntry({
        stage: 'manual_review',
        action: 'rejected',
        reason: rejectReason,
        details: {
          reviewerId: String(reviewerId),
          previousStatus: claim.status,
          rejectCount,
          stage
        }
      })
    ),
    createReviewHistoryEntry({
      stage: 'claim_flow',
      action: shouldRelease ? 'released' : 'returned',
      reason: rejectReason,
      details: {
        source: 'manual_review',
        rejectCount,
        stage
      }
    })
  )

  if (stage === 'image_review') {
    await db.query(
      `
      UPDATE claims
      SET status = $1,
          reject_count = $2,
          submitted_at = NULL,
          reviewed_at = NOW(),
          reviewer_id = $3,
          review_note = $4,
          ai_review_status = 'manual_rejected',
          image_review_status = 'rejected',
          image_review_reason = $4,
          review_history = $5
      WHERE id = $6
      `,
      [
        shouldRelease ? CLAIM_STATUS.RELEASED : CLAIM_STATUS.DOING,
        rejectCount,
        reviewerId,
        rejectReason,
        JSON.stringify(nextHistory),
        claimId
      ]
    )
  } else {
    await db.query(
      `
      UPDATE claims
      SET status = $1,
          reject_count = $2,
          submitted_at = NULL,
          reviewed_at = NOW(),
          reviewer_id = $3,
          review_note = $4,
          link_review_status = 'rejected',
          link_review_reason = $4,
          link_reviewed_at = NOW(),
          link_verified = false,
          review_history = $5
      WHERE id = $6
      `,
      [
        shouldRelease ? CLAIM_STATUS.RELEASED : CLAIM_STATUS.DOING,
        rejectCount,
        reviewerId,
        rejectReason,
        JSON.stringify(nextHistory),
        claimId
      ]
    )
  }

  return { claimId, message: '审核拒绝' };
}

// 日志查询
async function getReviewLogs(options = {}) {
  const { limit = 50, offset = 0 } = options;
  const safeLimit = Math.min(500, Math.max(1, Math.floor(Number(limit) || 50)))
  const safeOffset = Math.max(0, Math.floor(Number(offset) || 0))

  // 查询已审核的记录（包括 AI 审核和人工审核）
  const claims = await prisma.$queryRawUnsafe(`
    SELECT c.id, c.user_id, c.task_id, c.screenshots, c.status, c.ai_review_status, 
           c.ai_confidence, c.ai_reason, c.review_note, c.claimed_at, c.submitted_at,
           c.image_review_status, c.image_review_reason, c.link_review_status, c.link_review_reason,
           c.reject_count, c.review_history
    FROM claims c
    WHERE c.screenshots IS NOT NULL 
    AND c.screenshots::text != '[]'
    AND c.review_history IS NOT NULL
    AND c.review_history::text != '[]'
    ORDER BY COALESCE(c.submitted_at, c.claimed_at) DESC
    LIMIT ${safeLimit} OFFSET ${safeOffset}
  `);
  
  // 获取总数
  const countResult = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) as count FROM claims
    WHERE screenshots IS NOT NULL 
    AND screenshots::text != '[]'
    AND review_history IS NOT NULL
    AND review_history::text != '[]'
  `);
  const total = Number(countResult[0]?.count || 0);
  
  // 获取关联的任务和用户信息
  const taskIds = [...new Set(claims.map(c => c.task_id).filter(Boolean))];
  const userIds = [...new Set(claims.map(c => c.user_id).filter(Boolean))];
  
  let tasks = [];
  let users = [];
  
  const safeTaskIds = toSafePositiveIntIds(taskIds)
  const safeUserIds = toSafePositiveIntIds(userIds)
  if (safeTaskIds.length > 0) {
    tasks = await prisma.$queryRawUnsafe(
      'SELECT id, title, platform, action, video_url FROM tasks WHERE id IN (' + safeTaskIds.join(',') + ')'
    )
  }
  if (safeUserIds.length > 0) {
    users = await prisma.$queryRawUnsafe(
      'SELECT id, username FROM users WHERE id IN (' + safeUserIds.join(',') + ')'
    )
  }
  
  const taskMap = new Map(tasks.map(t => [String(t.id), t]));
  const userMap = new Map(users.map(u => [String(u.id), u]));
  
  const list = claims.map(c => {
    // 解析 review_history 为数组
    let reviewHistory = c.review_history;
    if (typeof reviewHistory === 'string') {
      try {
        reviewHistory = JSON.parse(reviewHistory);
      } catch (e) {
        reviewHistory = [];
      }
    }
    
    return {
      id: String(c.id),
      user_id: String(c.user_id),
      task_id: String(c.task_id),
      screenshots: c.screenshots,
      status: c.status,
      ai_review_status: c.ai_review_status,
      ai_confidence: c.ai_confidence,
      ai_reason: c.ai_reason,
      review_note: c.review_note,
      image_review_status: c.image_review_status,
      link_review_status: c.link_review_status,
      image_review_reason: c.image_review_reason,
      link_review_reason: c.link_review_reason,
      reject_count: c.reject_count,
      review_history: reviewHistory,
      claimed_at: c.claimed_at,
      submitted_at: c.submitted_at,
      reviewed_at: c.reviewed_at || c.submitted_at || c.claimed_at,
      tasks: taskMap.get(String(c.task_id)),
      users: userMap.get(String(c.user_id))
    };
  });
  
  return { list, total };
}

export {
  getReviewLogs, reviewImage, reviewWithPaddleOCR, reviewWithGemini, reviewWithBailian,
  getReviewQueue, getReviewStats, manualApprove, manualReject, manualInspect, urlToLocalPath, extractAuthorFromTitle
};

export default {
  getReviewLogs, reviewImage, reviewWithPaddleOCR, reviewWithGemini, reviewWithBailian,
  getReviewQueue, getReviewStats, manualApprove, manualReject, manualInspect, urlToLocalPath, extractAuthorFromTitle
};
