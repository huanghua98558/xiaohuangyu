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
import { CLAIM_STATUS } from '../../constants/claimLifecycle.js';
import { appendReviewHistory, createReviewHistoryEntry } from '../../utils/claimReviewHistory.js';

dotenv.config();

const PADDLE_OCR_URL = process.env.PADDLE_OCR_URL || 'http://localhost:8088';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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
  
  // 构建基础查询
  let baseQuery = "SELECT c.id, c.user_id, c.task_id, c.screenshots, c.status, c.ai_review_status, c.ai_confidence, c.ai_reason, c.review_note, c.image_review_status, c.link_review_status, c.image_review_reason, c.link_review_reason, c.reject_count, c.review_history, c.claimed_at, c.submitted_at, c.reviewed_at FROM claims c WHERE c.screenshots IS NOT NULL AND c.screenshots::text != '[]'";
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
      baseQuery += " AND (c.status IN ('released', 'image_rejected', 'link_rejected', 'rejected') OR (c.status = 'doing' AND (c.image_review_status = 'rejected' OR c.link_review_status = 'rejected')))";
      countQuery += " AND (c.status IN ('released', 'image_rejected', 'link_rejected', 'rejected') OR (c.status = 'doing' AND (c.image_review_status = 'rejected' OR c.link_review_status = 'rejected')))";
    } else if (status === 'approved') {
      baseQuery += " AND c.status IN ('approved', 'done')";
      countQuery += " AND c.status IN ('approved', 'done')";
    } else if (status === 'manual') {
      baseQuery += " AND (c.status = 'pending_manual' OR c.ai_review_status = 'manual' OR c.link_review_status = 'manual')";
      countQuery += " AND (c.status = 'pending_manual' OR c.ai_review_status = 'manual' OR c.link_review_status = 'manual')";
    } else if (status === 'pending') {
      baseQuery += " AND c.status IN ('submitted', 'image_reviewing', 'pending_link', 'link_reviewing', 'pending_manual')";
      countQuery += " AND c.status IN ('submitted', 'image_reviewing', 'pending_link', 'link_reviewing', 'pending_manual')";
    } else if (status === 'submitted') {
      baseQuery += " AND c.status = 'submitted'";
      countQuery += " AND c.status = 'submitted'";
    } else {
      const validAiStatuses = ['manual', 'processing', 'ai_approved', 'ai_rejected'];
      if (validAiStatuses.includes(status)) {
        baseQuery += " AND c.ai_review_status = '" + status + "'";
        countQuery += " AND ai_review_status = '" + status + "'";
      }
    }
  }
  
  baseQuery += " ORDER BY c.id DESC LIMIT " + limit + " OFFSET " + offset;
  
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
  
  if (taskIds.length > 0) {
    tasks = await prisma.$queryRawUnsafe("SELECT id, title, platform, action FROM tasks WHERE id IN (" + taskIds.join(',') + ")");
  }
  if (userIds.length > 0) {
    users = await prisma.$queryRawUnsafe("SELECT id, username FROM users WHERE id IN (" + userIds.join(',') + ")");
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
      COUNT(*) FILTER (WHERE status = 'pending_manual' OR ai_review_status = 'manual' OR link_review_status = 'manual') as manual,
      COUNT(*) FILTER (WHERE status IN ('submitted', 'image_reviewing')) as image_reviewing,
      COUNT(*) FILTER (WHERE status = 'link_reviewing') as link_reviewing,
      COUNT(*) FILTER (WHERE status = 'pending_link') as pending_link,
      COUNT(*) FILTER (WHERE status = 'released' OR (status = 'doing' AND (image_review_status = 'rejected' OR link_review_status = 'rejected'))) as rejected,
      COUNT(*) FILTER (WHERE status IN ('approved', 'done')) as approved
    FROM claims
    WHERE screenshots IS NOT NULL
  `);
  
  // 今日统计
  const todayStatsResult = await prisma.$queryRawUnsafe(`
    SELECT 
      COUNT(*) FILTER (WHERE status IN ('approved', 'done') AND reviewed_at >= '${today.toISOString()}') as today_approved,
      COUNT(*) FILTER (WHERE (status = 'released' OR (status = 'doing' AND (image_review_status = 'rejected' OR link_review_status = 'rejected'))) AND reviewed_at >= '${today.toISOString()}') as today_rejected
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
    autoRate,
    todayApproved,
    todayRejected,
    todayReviewed: todayApproved + todayRejected
  };
}
async function manualApprove(claimId, reviewerId, note) {
  const claim = await db.queryOne(
    `
    SELECT c.id, c.user_id, c.task_id, c.status, c.review_history, c.image_review_status, c.link_review_status, t.video_url
    FROM claims c
    LEFT JOIN tasks t ON t.id = c.task_id
    WHERE c.id = $1
    `,
    [claimId]
  )

  if (!claim) {
    throw new Error('任务认领记录不存在')
  }

  await db.transaction(async (client) => {
    const nextHistory = appendReviewHistory(
      claim.review_history,
      createReviewHistoryEntry({
        stage: 'manual_review',
        action: 'approved',
        reason: note || '人工审核通过',
        details: {
          reviewerId: String(reviewerId),
          previousStatus: claim.status
        }
      })
    )

    await client.query(
      `
      UPDATE claims
      SET status = $1,
          image_review_status = CASE WHEN image_review_status IS NULL OR image_review_status = 'manual' THEN 'approved' ELSE image_review_status END,
          link_review_status = CASE
            WHEN $2 = true AND (link_review_status IS NULL OR link_review_status = 'manual') THEN 'approved'
            WHEN $2 = false THEN COALESCE(link_review_status, 'skipped')
            ELSE link_review_status
          END,
          reviewer_id = $3,
          review_note = $4,
          reviewed_at = NOW(),
          review_history = $5
      WHERE id = $6
      `,
      [
        CLAIM_STATUS.APPROVED,
        Boolean(claim.video_url),
        reviewerId,
        note || '人工审核通过',
        JSON.stringify(nextHistory),
        claimId
      ]
    )
  })

  await pointsSettlementService.awardClaimPoints({
    claimId,
    taskId: claim.task_id,
    userId: claim.user_id,
    awardReason: note || '人工审核通过',
    source: 'image_review_manual'
  })

  return { claimId, message: '审核通过' };
}

// 审核拒绝 - 确保同时更新status
async function manualReject(claimId, reviewerId, note) {
  const claim = await db.queryOne(
    `
    SELECT id, status, reject_count, review_history, image_review_status, link_review_status
    FROM claims
    WHERE id = $1
    `,
    [claimId]
  )

  if (!claim) {
    throw new Error('任务认领记录不存在')
  }

  const rejectCount = Number(claim.reject_count || 0) + 1
  const shouldRelease = rejectCount >= 3
  const stageField = claim.image_review_status !== 'approved' ? 'image_review_status' : 'link_review_status'
  const rejectReason = note || '人工审核拒绝'
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
          rejectCount
        }
      })
    ),
    createReviewHistoryEntry({
      stage: 'claim_flow',
      action: shouldRelease ? 'released' : 'returned',
      reason: rejectReason,
      details: {
        source: 'manual_review',
        rejectCount
      }
    })
  )

  await db.query(
    `
    UPDATE claims
    SET status = $1,
        reject_count = $2,
        submitted_at = NULL,
        reviewed_at = NOW(),
        reviewer_id = $3,
        review_note = $4,
        ${stageField} = 'rejected',
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

  return { claimId, message: '审核拒绝' };
}

// 日志查询
async function getReviewLogs(options = {}) {
  const { limit = 50, offset = 0 } = options;
  
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
    LIMIT ${limit} OFFSET ${offset}
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
  
  if (taskIds.length > 0) {
    tasks = await prisma.$queryRawUnsafe("SELECT id, title, platform, action FROM tasks WHERE id IN (" + taskIds.join(',') + ")");
  }
  if (userIds.length > 0) {
    users = await prisma.$queryRawUnsafe("SELECT id, username FROM users WHERE id IN (" + userIds.join(',') + ")");
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
  getReviewQueue, getReviewStats, manualApprove, manualReject, urlToLocalPath, extractAuthorFromTitle
};

export default {
  getReviewLogs, reviewImage, reviewWithPaddleOCR, reviewWithGemini, reviewWithBailian,
  getReviewQueue, getReviewStats, manualApprove, manualReject, urlToLocalPath, extractAuthorFromTitle
};
