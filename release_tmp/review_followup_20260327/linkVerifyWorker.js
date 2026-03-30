/**
 * 链接验证 Worker - 支持多 IP 重试版本
 * 
 * 关键改进:
 * 1. 审核开始时判断是否跳过直连（全局状态）
 * 2. 直连失败后立即获取代理 IP（实时获取）
 * 3. 每个 IP 只测试一次，失败后立即获取下一个
 * 4. 最多尝试 3 个不同 IP
 * 5. 成功后报告直连成功（如果是直连）
 */

import { Queue, Worker } from 'bullmq';
import axios from 'axios';
import dotenv from 'dotenv';
import redisConnection from '../config/queue.js';
import db from '../config/database.js';
import { publishLinkVerifyComplete } from '../utils/wsEventPublisher.js';
import promotionService from '../services/promotionService.js';
import { verifyComment, compareComments } from '../services/commentVerifyService.js';
import reviewConfig from '../services/ai/reviewConfigService.js';
import { analyzeSemantic } from '../services/ai/semanticAnalysisService.js';
import { VERIFY_MODE, verifyNickname } from '../services/ai/ruleVerificationService.js';
import pointsSettlementService from '../services/pointsSettlementService.js';
import { CLAIM_STATUS } from '../constants/claimLifecycle.js';
import { appendReviewHistory, createReviewHistoryEntry } from '../utils/claimReviewHistory.js';

dotenv.config();

const BROWSER_PORTS = [8000, 8001, 8002];
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000';
const MAX_IP_RETRIES = 3; // 最多尝试 3 个不同 IP

let currentIndex = 0;
const linkVerifyQueue = new Queue('link-verify-queue', { connection: redisConnection });

function readIntegerConfig(value, fallback, minimum = null) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (minimum !== null) {
    return Math.max(minimum, parsed);
  }

  return parsed;
}

function normalizeSubmittedComment(evaluation) {
  if (!evaluation) {
    return null;
  }

  if (typeof evaluation === 'string') {
    const trimmed = evaluation.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed);
      return normalizeSubmittedComment(parsed);
    } catch (error) {
      return trimmed;
    }
  }

  if (typeof evaluation === 'object') {
    return normalizeSubmittedComment(
      evaluation.text ??
      evaluation.comment ??
      evaluation.content ??
      evaluation.value ??
      null
    );
  }

  return null;
}

function normalizeTextValue(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeNicknameValue(value) {
  const normalized = normalizeTextValue(value);
  if (!normalized) {
    return null;
  }

  return normalized.replace(/^@+/, '').trim() || null;
}

function extractCommentContent(comment) {
  if (!comment) {
    return null;
  }

  if (typeof comment === 'string') {
    return normalizeTextValue(comment);
  }

  return normalizeTextValue(
    comment.content ??
    comment.text ??
    comment.comment ??
    comment.value ??
    null
  );
}

function extractCommentNickname(comment) {
  if (!comment || typeof comment !== 'object') {
    return null;
  }

  return normalizeNicknameValue(
    comment.nickname ??
    comment.name ??
    comment.user?.nickname ??
    null
  );
}

function buildExtractedCommentCandidates(extractedComments = []) {
  if (!Array.isArray(extractedComments)) {
    return [];
  }

  return extractedComments
    .map((item, index) => ({
      index,
      raw: item,
      content: extractCommentContent(item),
      nickname: extractCommentNickname(item)
    }))
    .filter((item) => item.content || item.nickname);
}

function verifyLinkedCommentMatch({ userComment, ocrComment, extractedComments, minLength }) {
  const result = {
    passed: false,
    reasons: [],
    errorType: null,
    matchedComment: null,
    details: {
      targets: [],
      targetValidation: [],
      candidates: [],
      matches: [],
      bestMatch: null
    }
  };

  const targets = [];
  const normalizedUserComment = normalizeTextValue(userComment);
  const normalizedOcrComment = normalizeTextValue(ocrComment);

  if (normalizedUserComment) {
    targets.push({ source: 'user', text: normalizedUserComment });
  }
  if (normalizedOcrComment && normalizedOcrComment !== normalizedUserComment) {
    targets.push({ source: 'ocr', text: normalizedOcrComment });
  }

  result.details.targets = targets.map((target) => ({
    source: target.source,
    text: target.text
  }));
  result.details.targetValidation = targets.map((target) => ({
    source: target.source,
    ...verifyComment(target.text, { minLength })
  }));

  if (targets.length === 0) {
    result.errorType = 'missing_submitted_comment';
    result.reasons.push('用户未提交可比对的评论内容');
    return result;
  }

  const candidates = buildExtractedCommentCandidates(extractedComments);
  result.details.candidates = candidates.map((candidate) => ({
    index: candidate.index,
    content: candidate.content,
    nickname: candidate.nickname
  }));

  if (candidates.length === 0) {
    result.errorType = 'missing_page_comments';
    result.reasons.push('页面未提取到评论');
    return result;
  }

  let bestMatch = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    if (!candidate.content) {
      continue;
    }

    for (const target of targets) {
      const compare = compareComments(target.text, candidate.content);
      const similarity = Number(compare.similarity || 0);

      if (compare.match) {
        const matchRecord = {
          source: target.source,
          extracted: candidate.content,
          nickname: candidate.nickname,
          similarity,
          compareReason: compare.reason || null
        };
        result.details.matches.push(matchRecord);

        if (similarity > bestScore) {
          bestScore = similarity;
          bestMatch = {
            ...matchRecord,
            candidate
          };
        }
      }
    }
  }

  if (!bestMatch) {
    result.reasons.push('评论内容比对失败');
    return result;
  }

  result.passed = true;
  result.matchedComment = bestMatch.candidate;
  result.details.bestMatch = {
    source: bestMatch.source,
    extracted: bestMatch.extracted,
    nickname: bestMatch.nickname,
    similarity: bestMatch.similarity
  };

  return result;
}

function buildNicknameMatchResult({ submittedNickname, matchedNickname, enabled }) {
  if (!enabled) {
    return {
      passed: true,
      skipped: true,
      reason: '评论人昵称校验已关闭',
      submittedNickname: normalizeNicknameValue(submittedNickname),
      matchedNickname: normalizeNicknameValue(matchedNickname)
    };
  }

  const normalizedSubmitted = normalizeNicknameValue(submittedNickname);
  const normalizedMatched = normalizeNicknameValue(matchedNickname);

  if (!normalizedSubmitted) {
    return {
      passed: false,
      reason: '用户未提交评论人昵称',
      errorType: 'missing_submitted_nickname',
      submittedNickname: null,
      matchedNickname: normalizedMatched
    };
  }

  if (!normalizedMatched) {
    return {
      passed: false,
      reason: '页面未提取到评论人昵称',
      errorType: 'missing_page_nickname',
      requiresManual: true,
      submittedNickname: normalizedSubmitted,
      matchedNickname: null
    };
  }

  return {
    ...verifyNickname(normalizedMatched, normalizedSubmitted, {
      enabled: true,
      matchMode: 'contains',
      minSimilarity: 0.7,
      ignoreCase: true
    }),
    submittedNickname: normalizedSubmitted,
    matchedNickname: normalizedMatched
  };
}

async function runFinalCommentJudgement({ mode, matchedComment, taskInfo = {}, minLength, aiEnabled }) {
  const finalMode = Object.values(VERIFY_MODE).includes(mode) ? mode : VERIFY_MODE.RULE_AND_AI;
  const comment = normalizeTextValue(matchedComment);

  const result = {
    passed: false,
    mode: finalMode,
    reason: '缺少待判定评论内容',
    ruleResult: null,
    aiResult: null,
    requiresManual: false
  };

  if (!comment) {
    return result;
  }

  if (finalMode === VERIFY_MODE.DEFAULT_PASS) {
    result.passed = true;
    result.reason = '默认通过模式，跳过最终评论判定';
    return result;
  }

  result.ruleResult = verifyComment(comment, { minLength });

  if (finalMode !== VERIFY_MODE.RULE_ONLY) {
    if (aiEnabled === false) {
      result.aiResult = { valid: true, skipped: true, reason: 'AI语义判定已关闭，默认通过' };
    } else {
      result.aiResult = await analyzeSemantic({
        comment,
        taskTitle: taskInfo.title || taskInfo.action || '',
        taskDescription: taskInfo.description || '',
        platform: taskInfo.platform || ''
      });
    }

    if (result.aiResult?.error) {
      result.requiresManual = true;
      result.reason = '最终评论 AI 判定失败，已转人工检查';
      return result;
    }
  } else {
    result.aiResult = { valid: true, skipped: true, reason: '规则模式无需 AI 判定' };
  }

  switch (finalMode) {
    case VERIFY_MODE.RULE_ONLY:
      result.passed = result.ruleResult.valid;
      result.reason = result.passed
        ? '最终评论规则判定通过'
        : `最终评论规则判定未通过: ${result.ruleResult.reasons.join('、') || '规则未通过'}`;
      break;
    case VERIFY_MODE.AI_ONLY:
      result.passed = Boolean(result.aiResult?.valid);
      result.reason = result.passed
        ? '最终评论 AI 判定通过'
        : `最终评论 AI 判定未通过: ${result.aiResult?.reason || 'AI 未通过'}`;
      break;
    case VERIFY_MODE.RULE_AND_AI:
    default:
      result.passed = Boolean(result.ruleResult.valid) && Boolean(result.aiResult?.valid);
      if (result.passed) {
        result.reason = '最终评论规则和 AI 判定都通过';
      } else if (!result.ruleResult.valid && !result.aiResult?.valid) {
        result.reason = `最终评论规则与 AI 均未通过: ${(result.ruleResult.reasons || []).join('、') || result.aiResult?.reason || '未通过'}`;
      } else if (!result.ruleResult.valid) {
        result.reason = `最终评论规则判定未通过: ${result.ruleResult.reasons.join('、') || '规则未通过'}`;
      } else {
        result.reason = `最终评论 AI 判定未通过: ${result.aiResult?.reason || 'AI 未通过'}`;
      }
      break;
  }

  return result;
}

async function getLinkVerifyRuntimeConfig(jobData = {}) {
  const config = {
    batchThreshold: readIntegerConfig(jobData.batchThreshold, 5, 1),
    maxWaitMinutes: readIntegerConfig(jobData.maxWaitMinutes, 120, 0),
    batchSize: readIntegerConfig(jobData.batchSize, 10, 1),
    retryCount: readIntegerConfig(jobData.retryCount, 3, 1)
  };

  try {
    const rows = await db.queryMany(
      "SELECT key, value FROM ai_configs WHERE key IN ('link_verify_batch_threshold', 'link_verify_max_wait_minutes', 'link_verify_batch_size', 'link_verify_retry_count')"
    );

    for (const row of rows) {
      if (row.key === 'link_verify_batch_threshold') {
        config.batchThreshold = readIntegerConfig(row.value, config.batchThreshold, 1);
      }
      if (row.key === 'link_verify_max_wait_minutes') {
        config.maxWaitMinutes = readIntegerConfig(row.value, config.maxWaitMinutes, 0);
      }
      if (row.key === 'link_verify_batch_size') {
        config.batchSize = readIntegerConfig(row.value, config.batchSize, 1);
      }
      if (row.key === 'link_verify_retry_count') {
        config.retryCount = readIntegerConfig(row.value, config.retryCount, 1);
      }
    }
  } catch (e) {
    console.log('[LinkWorker] 读取连接审核配置失败，使用任务快照:', e.message);
  }

  return config;
}

function getNextBrowserUrl() {
  const port = BROWSER_PORTS[currentIndex];
  currentIndex = (currentIndex + 1) % BROWSER_PORTS.length;
  return `http://127.0.0.1:${port}`;
}

async function checkAllServicesHealth() {
  const results = [];
  for (const port of BROWSER_PORTS) {
    try {
      const res = await axios.get(`http://127.0.0.1:${port}/`, { timeout: 3000 });
      results.push({ port, healthy: res.data.status === 'ok', version: res.data.version });
    } catch (e) {
      results.push({ port, healthy: false, error: e.message });
    }
  }
  return results;
}

async function getHealthyBrowserUrl() {
  for (let i = 0; i < BROWSER_PORTS.length; i++) {
    const url = getNextBrowserUrl();
    try {
      const res = await axios.get(`${url}/`, { timeout: 2000 });
      if (res.data.status === 'ok') return url;
    } catch (e) {}
  }
  return null;
}

/**
 * 检查是否应该跳过直连
 */
async function shouldSkipDirect() {
  try {
    const res = await axios.get(`${BACKEND_URL}/api/internal/ip/should-skip-direct`, { timeout: 5000 });
    return res.data?.data === true;
  } catch (e) {
    console.log('[LinkWorker] 检查跳过直连失败，默认不跳过:', e.message);
    return false;
  }
}

/**
 * 实时获取新鲜代理 IP
 */
async function acquireFreshIP() {
  try {
    const res = await axios.post(`${BACKEND_URL}/api/internal/ip/acquire-fresh`, {}, { timeout: 15000 });
    if (res.data?.code === 200 && res.data?.data) {
      return res.data.data;
    }
    return null;
  } catch (e) {
    console.log('[LinkWorker] 获取代理 IP 失败:', e.message);
    return null;
  }
}

/**
 * 报告直连成功
 */
async function reportDirectSuccess() {
  try {
    await axios.post(`${BACKEND_URL}/api/internal/ip/direct-success`, {}, { timeout: 5000 });
  } catch (e) {
    console.log('[LinkWorker] 报告直连成功失败:', e.message);
  }
}

/**
 * 报告直连失败
 */
async function reportDirectFailure() {
  try {
    await axios.post(`${BACKEND_URL}/api/internal/ip/direct-failure`, {}, { timeout: 5000 });
  } catch (e) {
    console.log('[LinkWorker] 报告直连失败失败:', e.message);
  }
}

/**
 * 报告 IP 失效
 */
async function reportIPInvalid(ip) {
  try {
    await axios.post(`${BACKEND_URL}/api/internal/ip/invalidate`, { ip }, { timeout: 5000 });
  } catch (e) {
    console.log('[LinkWorker] 报告 IP 失效失败:', e.message);
  }
}

/**
 * 验证链接 - 支持传入代理 URL
 */
async function verifyLink(link, taskAuthor, platform, targetComment, proxyUrl = null) {
  const browserUrl = await getHealthyBrowserUrl();
  if (!browserUrl) {
    console.error('[LinkWorker] 所有 Browser Service 不可用');
    return { success: false, error: 'Browser Service unavailable' };
  }

  try {
    const requestData = {
      url: link,
      check_comment: true,
      target_comment: targetComment || null,
      max_comments: 50
    };
    
    // 如果有代理 URL，传递给 Browser Service
    if (proxyUrl) {
      requestData.proxy_url = proxyUrl;
    }

    console.log(`[LinkWorker] 验证链接: ${link} ${proxyUrl ? `(代理: ${proxyUrl.split('@')[1] || proxyUrl})` : '(直连)'}`);
    
    console.log("[LinkWorker] 📤 发送请求:", JSON.stringify(requestData));
    const res = await axios.post(`${browserUrl}/browser/visit`, requestData, { timeout: 120000 });
    
    const data = res.data;
    
    return {
      success: data.success,
      page_title: data.page_title,
      author_name: data.author_name,
      comments: data.comments || [],
      has_comment: data.has_comment,
      comment_text: data.comment_text,
      blocked_account: data.blocked_account,
      suspicious_behavior: data.suspicious_behavior,
      error: data.error,
      used_proxy: !!proxyUrl
    };
  } catch (e) {
    console.error(`[LinkWorker] 验证失败: ${e.message}`);
    return { success: false, error: e.message, used_proxy: !!proxyUrl };
  }
}

/**
 * 带多 IP 重试的链接验证
 * 1. 先检查是否跳过直连
 * 2. 尝试直连（如果允许）
 * 3. 直连失败后获取代理 IP，每个 IP 只测试一次
 * 4. 最多尝试 3 个不同 IP
 */
async function verifyLinkWithRetry(link, taskAuthor, platform, targetComment) {
  const attemptLog = [];
  
  // Step 1: 检查是否跳过直连
  const skipDirect = await shouldSkipDirect();
  
  if (skipDirect) {
    console.log('[LinkWorker] 全局直连状态不佳，跳过直连，直接使用代理');
    attemptLog.push({ type: 'skip_direct', reason: '全局连续失败>=5次且10分钟无成功' });
  }
  
  // Step 2: 尝试直连（如果允许）
  if (!skipDirect) {
    console.log('[LinkWorker] 尝试直连访问...');
    const directResult = await verifyLink(link, taskAuthor, platform, targetComment, null);
    
    if (directResult.success) {
      // 直连成功，报告成功并返回
      await reportDirectSuccess();
      console.log('[LinkWorker] ✅ 直连成功');
      return { ...directResult, attemptLog: [{ type: 'direct', success: true }] };
    }
    
    // 直连失败
    await reportDirectFailure();
    console.log('[LinkWorker] ❌ 直连失败:', directResult.error);
    attemptLog.push({ type: 'direct', success: false, error: directResult.error });
  }
  
  // Step 3: 尝试代理 IP（最多 MAX_IP_RETRIES 个）
  let proxyAttempts = 0;
  
  while (proxyAttempts < MAX_IP_RETRIES) {
    proxyAttempts++;
    
    // 实时获取新鲜代理 IP
    console.log(`[LinkWorker] 获取第 ${proxyAttempts} 个代理 IP...`);
    const ipInfo = await acquireFreshIP();
    
    if (!ipInfo) {
      console.log(`[LinkWorker] 无法获取代理 IP (第 ${proxyAttempts} 次)`);
      attemptLog.push({ type: 'proxy_acquire_failed', attempt: proxyAttempts });
      
      // 如果连续 2 次获取 IP 失败，放弃重试
      if (proxyAttempts >= 2) {
        console.log('[LinkWorker] 连续获取 IP 失败，放弃重试');
        break;
      }
      continue;
    }
    
    console.log(`[LinkWorker] 获取到代理 IP: ${ipInfo.ip}:${ipInfo.port}, 有效期 ${ipInfo.ttlSeconds || '未知'}秒`);
    
    // 使用该 IP 尝试验证
    const proxyResult = await verifyLink(link, taskAuthor, platform, targetComment, ipInfo.proxyUrl);
    
    if (proxyResult.success) {
      console.log(`[LinkWorker] ✅ 代理 IP ${ipInfo.ip} 验证成功`);
      return { 
        ...proxyResult, 
        attemptLog: [...attemptLog, { 
          type: 'proxy', 
          success: true, 
          ip: ipInfo.ip, 
          attempt: proxyAttempts 
        }] 
      };
    }
    
    // 该 IP 失败，报告失效并继续尝试下一个
    console.log(`[LinkWorker] ❌ 代理 IP ${ipInfo.ip} 失败:`, proxyResult.error);
    await reportIPInvalid(ipInfo.ip);
    attemptLog.push({ 
      type: 'proxy', 
      success: false, 
      ip: ipInfo.ip, 
      attempt: proxyAttempts, 
      error: proxyResult.error 
    });
    
    // 不重试同一个 IP，继续获取下一个
  }
  
  // 所有尝试都失败
  console.log(`[LinkWorker] 所有 ${proxyAttempts} 次 IP 尝试均失败`);
  return { 
    success: false, 
    error: `尝试了 ${proxyAttempts} 个 IP 均失败`, 
    attemptLog 
  };
}

/**
 * 验证达人名字是否匹配
 */
function verifyAuthor(taskAuthor, pageAuthor) {
  if (!taskAuthor) {
    return { match: true, reason: '无需验证达人' };
  }
  
  if (!pageAuthor) {
    // 如果页面没有识别到达人，暂时通过（可能是页面加载问题）
    return { match: true, reason: '页面未识别到达人，默认通过' };
  }
  
  const t = taskAuthor.replace('@', '').toLowerCase().trim();
  const p = pageAuthor.replace('@', '').toLowerCase().trim();
  
  if (t === p || t.includes(p) || p.includes(t)) {
    return { match: true, reason: '达人匹配成功' };
  }
  
  return { match: false, reason: `达人不匹配: 期望 ${taskAuthor}, 实际 ${pageAuthor}` };
}

function threeWayCommentVerification(userComment, ocrComment, extractedComments) {
  const result = {
    passed: false,
    reasons: [],
    details: { userComment, ocrComment, extractedCount: extractedComments?.length || 0, matches: [] }
  };
  const validFallbackSources = [];

  if (userComment) {
    const userVerify = verifyComment(userComment);
    if (!userVerify.valid) {
      result.reasons.push(`用户评论无效: ${userVerify.reasons.join(', ')}`);
    } else {
      validFallbackSources.push('user');
    }
  }

  if (ocrComment) {
    const ocrVerify = verifyComment(ocrComment);
    if (!ocrVerify.valid) {
      console.log(`[LinkWorker] OCR评论验证: ${ocrVerify.reasons.join(', ')}`);
    } else {
      validFallbackSources.push('ocr');
    }
  }

  if (!extractedComments || extractedComments.length === 0) {
    if (validFallbackSources.length > 0) {
      const fallbackSource = validFallbackSources.includes('user') ? '用户提交评论' : 'OCR评论';
      result.passed = true;
      result.reasons.push(`无法从页面提取评论，但${fallbackSource}有效`);
      console.log(`[LinkWorker] ✅ ${fallbackSource}有效，审核通过`);
      return result;
    }
    result.reasons.push('无法从页面提取评论');
    return result;
  }
  
  const validComments = extractedComments.map(c => typeof c === 'object' ? (c.content || c.nickname || '') : c).filter(c => {
    const text = c?.trim() || '';
    if (text.length < 4) return false;
    if (/^(浙江|河南|湖南|广东|北京|上海|深圳|杭州|\d+)$/.test(text)) return false;
    return true;
  });
  
  if (validComments.length === 0) {
    if (validFallbackSources.length > 0) {
      const fallbackSource = validFallbackSources.includes('user') ? '用户提交评论' : 'OCR评论';
      result.passed = true;
      result.reasons.push(`页面评论无效，但${fallbackSource}有效`);
      console.log(`[LinkWorker] ✅ 页面评论无效，${fallbackSource}有效，审核通过`);
      return result;
    }
    result.reasons.push('页面评论无效');
    return result;
  }

  let bestMatch = null;
  let bestSimilarity = 0;

  for (const extracted of validComments) {
    const extractedText = typeof extracted === 'string' ? extracted : (extracted.content || extracted.text || extracted);
    
    if (userComment) {
      const userCompare = compareComments(userComment, extractedText);
      if (userCompare.match && userCompare.similarity > bestSimilarity) {
        bestSimilarity = userCompare.similarity;
        bestMatch = { type: 'user_vs_extracted', extracted: extractedText, similarity: userCompare.similarity };
      }
    }

    if (ocrComment) {
      const ocrCompare = compareComments(ocrComment, extractedText);
      if (ocrCompare.match && ocrCompare.similarity > bestSimilarity) {
        bestSimilarity = ocrCompare.similarity;
        bestMatch = { type: 'ocr_vs_extracted', extracted: extractedText, similarity: ocrCompare.similarity };
      }
    }
  }

  if (bestMatch) {
    result.passed = true;
    result.details.matches.push(bestMatch);
    console.log(`[LinkWorker] ✅ 评论匹配成功: ${bestMatch.type}, 相似度=${(bestMatch.similarity * 100).toFixed(1)}%`);
  } else {
    result.reasons.push('评论未在页面中找到匹配');
  }

  return result;
}

async function rewardPoints(userId, taskId, claimId, points, reason) {
  try {
    const existing = await db.queryOne(
      'SELECT id FROM records WHERE user_id = $1 AND task_id = $2 AND type = $3 AND "desc" LIKE $4',
      [userId, taskId, 'task', `%claim:${claimId}%`]
    );

    if (existing) {
      console.log('[LinkWorker] 积分已发放，跳过');
      return { success: true, skipped: true };
    }

    await db.transaction(async (client) => {
      await client.query(
        'INSERT INTO records (user_id, type, points, task_id, "desc", created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
        [userId, 'task', points, taskId, `任务奖励 - ${reason} (claim:${claimId})`]
      );
      await client.query('UPDATE users SET points = points + $1, updated_at = NOW() WHERE id = $2', [points, userId]);
    });

    console.log(`[LinkWorker] ✅ 积分发放成功: 用户${userId} +${points}积分`);
    return { success: true, points };
  } catch (e) {
    console.error(`[LinkWorker] 积分发放失败: ${e.message}`);
    return { success: false, error: e.message };
  }
}

async function updateReviewStatus(claimId, status, result) {
  const linkStatus = status === 'approved' ? 'approved' : (status === 'manual' ? 'pending' : 'rejected');
  await db.query(
    'UPDATE claims SET status = $1, link_review_status = $2, link_review_reason = $3, link_reviewed_at = NOW(), reviewed_at = NOW() WHERE id = $4',
    [status, linkStatus, JSON.stringify(result), claimId]
  );
}


// 更新拒绝次数并返回是否需要释放
async function updateRejectCount(claimId) {
  try {
    const result = await db.query(
      "UPDATE claims SET reject_count = COALESCE(reject_count, 0) + 1 WHERE id = $1 RETURNING reject_count",
      [claimId]
    );
    const count = result.rows?.[0]?.reject_count || 1;
    console.log(`[LinkWorker] 拒绝次数更新: claimId=${claimId}, count=${count}`);
    return { count, shouldRelease: count >= 3 };
  } catch (e) {
    console.error(`[LinkWorker] 更新拒绝次数失败: ${e.message}`);
    return { count: 1, shouldRelease: false };
  }
}

// 添加审核历史记录
async function addReviewHistory(claimId, action, data) {
  try {
    // 获取现有历史
    const existing = await db.queryOne(
      "SELECT review_history FROM claims WHERE id = $1",
      [claimId]
    );
    
    let history = [];
    if (existing?.review_history) {
      history = typeof existing.review_history === 'string' 
        ? JSON.parse(existing.review_history) 
        : existing.review_history;
    }
    
    // 添加新记录
    history.push({
      action,
      data,
      timestamp: new Date().toISOString()
    });
    
    // 更新数据库
    await db.query(
      "UPDATE claims SET review_history = $1 WHERE id = $2",
      [JSON.stringify(history), claimId]
    );
    console.log(`[LinkWorker] 已添加审核历史: claimId=${claimId}, action=${action}`);
  } catch (e) {
    console.error(`[LinkWorker] 添加审核历史失败: ${e.message}`);
  }
}

async function addToHighlightQueue(claimId, userId, reason, details) {
  try {
    const user = await db.queryOne('SELECT username, phone FROM users WHERE id = $1', [userId]);
    const claim = await db.queryOne(
      'SELECT t.title, c.screenshots, t.video_url AS link_url FROM claims c JOIN tasks t ON c.task_id = t.id WHERE c.id = $1',
      [claimId]
    );
    
    await db.query(
      `INSERT INTO highlight_queue 
       (claim_id, user_id, user_nickname, user_phone, task_title, screenshot_url, link_url, reason, details, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW())`,
      [claimId, userId, user?.username || '未知', user?.phone || '', claim?.title || '', 
       claim?.screenshots || '', claim?.link_url || '', reason, JSON.stringify(details)]
    );
    console.log(`[LinkWorker] 已加入高亮队列: claimId=${claimId}, reason=${reason}`);
  } catch (e) {
    console.error(`[LinkWorker] 加入高亮队列失败: ${e.message}`);
  }
}

const linkVerifyWorker = new Worker('link-verify-queue', async (job) => {
  const { claimId, userId, taskId, links, platform, taskContext, readyAt } = job.data;
  const linkUrl = links?.[0];
  const taskAuthor = taskContext?.author;
  let userComment = normalizeSubmittedComment(job.data?.comment || job.data?.evaluation);
  let submittedNickname = normalizeNicknameValue(job.data?.platformNickname);

  if (!linkUrl) {
    throw new Error('缺少待验证链接');
  }

  const runtimeConfig = await getLinkVerifyRuntimeConfig(job.data);
  const reviewSettings = await reviewConfig.getConfig();
  const commentMinLength = Math.max(1, Number(reviewSettings?.comment?.minLength || 8));
  const pendingSince = Number(readyAt || Date.now());
  const maxWaitMs = runtimeConfig.maxWaitMinutes * 60 * 1000;
  const [waitingCount, activeCount] = await Promise.all([
    linkVerifyQueue.getWaitingCount(),
    linkVerifyQueue.getActiveCount()
  ]);
  const queueDepth = waitingCount + activeCount;

  if (queueDepth < runtimeConfig.batchThreshold && Date.now() - pendingSince < maxWaitMs) {
    const waitReason = `等待批量触发（${queueDepth}/${runtimeConfig.batchThreshold}）`;
    await db.query(
      `
      UPDATE claims
      SET status = $1,
          link_review_status = 'pending',
          link_review_reason = $2,
          review_note = $2
      WHERE id = $3
      `,
      [CLAIM_STATUS.PENDING_LINK, waitReason, claimId]
    );

    await linkVerifyQueue.add(
      'link-verify',
      { ...job.data, readyAt: pendingSince },
      {
        delay: 60000,
        attempts: Math.max(1, Number(runtimeConfig.retryCount) || 1)
      }
    );
    return { claimId, deferred: true, reason: waitReason };
  }

  let ocrComment = null;
  try {
    const claimData = await db.queryOne('SELECT ocr_comment, evaluation, review_history, platform_nickname FROM claims WHERE id = $1', [claimId]);
    ocrComment = claimData?.ocr_comment || null;
    userComment = userComment || normalizeSubmittedComment(claimData?.evaluation);
    submittedNickname = submittedNickname || normalizeNicknameValue(claimData?.platform_nickname);
  } catch (e) {
    console.error(`[LinkWorker] 读取 OCR 评论失败: ${e.message}`);
  }

  console.log(`\n[LinkWorker] ========== 开始处理 claimId=${claimId} ==========`);
  console.log(`[LinkWorker] 链接: ${linkUrl}`);
  console.log(`[LinkWorker] OCR评论: ${ocrComment}`);
  console.log(`[LinkWorker] 用户评论: ${userComment}`);

  try {
    await db.transaction(async (client) => {
      const historyRes = await client.query('SELECT review_history FROM claims WHERE id = $1', [claimId]);
      const nextHistory = appendReviewHistory(
        historyRes.rows?.[0]?.review_history,
        createReviewHistoryEntry({
          stage: 'link_review',
          action: 'started',
          reason: '连接审核开始',
          details: {
            queueDepth,
            batchThreshold: runtimeConfig.batchThreshold,
            maxWaitMinutes: runtimeConfig.maxWaitMinutes
          }
        })
      );

      await client.query(
        `
        UPDATE claims
        SET status = $1,
            link_review_status = 'reviewing',
            link_review_reason = '连接审核中',
            review_note = '连接审核中',
            review_history = $2
        WHERE id = $3
        `,
        [CLAIM_STATUS.LINK_REVIEWING, JSON.stringify(nextHistory), claimId]
      );
    });

    const linkResult = await verifyLinkWithRetry(linkUrl, taskAuthor, platform, userComment || ocrComment);
    console.log(`[LinkWorker] 链接验证完成: ${linkResult.success ? '✅ 成功' : '❌ 失败'}`);
    if (linkResult.attemptLog) {
      console.log('[LinkWorker] 尝试记录:', JSON.stringify(linkResult.attemptLog));
    }

    const extractedComments = linkResult.comments || [];
    const commentResult = verifyLinkedCommentMatch({
      userComment,
      ocrComment,
      extractedComments,
      minLength: commentMinLength
    });
    const nicknameResult = buildNicknameMatchResult({
      submittedNickname,
      matchedNickname: commentResult.matchedComment?.nickname,
      enabled: reviewSettings?.checks?.commentNickname !== false
    });
    const authorResult = verifyAuthor(taskAuthor, linkResult.author_name);
    const finalCommentJudgement = await runFinalCommentJudgement({
      mode: reviewSettings?.semantic?.mode,
      matchedComment: commentResult.matchedComment?.content,
      taskInfo: {
        title: taskContext?.title || taskContext?.action || '',
        description: taskContext?.description || '',
        action: taskContext?.action || '',
        platform
      },
      minLength: commentMinLength,
      aiEnabled: reviewSettings?.semantic?.enabled !== false
    });
    const passed =
      linkResult.success &&
      commentResult.passed &&
      nicknameResult.passed &&
      authorResult.match &&
      finalCommentJudgement.passed;

    const isSystemError = !linkResult.success && (
      linkResult.error?.includes('IP 均失败') ||
      linkResult.error?.includes('Browser Service') ||
      linkResult.error?.includes('timeout') ||
      linkResult.error?.includes('ECONNREFUSED') ||
      linkResult.error?.includes('unavailable') ||
      (Array.isArray(linkResult.attemptLog) &&
        linkResult.attemptLog.length > 0 &&
        linkResult.attemptLog.every(log => !log.success))
    );

    const requiresManual =
      isSystemError ||
      commentResult.errorType === 'missing_page_comments' ||
      nicknameResult.requiresManual ||
      finalCommentJudgement.requiresManual;

    const isCommentMismatch = linkResult.success && !commentResult.passed && !requiresManual;
    const isNicknameMismatch = linkResult.success && commentResult.passed && !nicknameResult.passed && !requiresManual;
    const blockReasons = [];
    if (linkResult.blocked_account) blockReasons.push('账号被封禁');
    if (linkResult.suspicious_behavior) blockReasons.push('检测到可疑行为');
    if (isCommentMismatch && extractedComments.length > 0) blockReasons.push('评论不匹配');
    if (isNicknameMismatch) blockReasons.push('评论人昵称不匹配');
    if (!authorResult.match) blockReasons.push('达人不匹配');

    const reviewDetails = {
      passed,
      submitted: {
        userComment: userComment || null,
        ocrComment: ocrComment || null,
        commenterNickname: submittedNickname || null
      },
      linkUrl,
      linkResult: {
        valid: linkResult.success,
        error: linkResult.error || null,
        pageTitle: linkResult.page_title || null,
        authorName: linkResult.author_name || null,
        extractedCommentCount: extractedComments.length,
        blockedAccount: Boolean(linkResult.blocked_account),
        suspiciousBehavior: Boolean(linkResult.suspicious_behavior)
      },
      commentResult: {
        passed: commentResult.passed,
        reasons: commentResult.reasons,
        errorType: commentResult.errorType || null,
        matches: commentResult.details?.matches || [],
        matchedComment: commentResult.matchedComment?.content || null,
        matchedNickname: commentResult.matchedComment?.nickname || null
      },
      nicknameResult,
      authorResult,
      finalCommentJudgement,
      attemptLog: linkResult.attemptLog || []
    };

    if (blockReasons.length > 0) {
      await addToHighlightQueue(claimId, userId, blockReasons.join('; '), {
        linkResult,
        commentResult,
        extractedComments
      });
    }

    if (passed) {
      await db.transaction(async (client) => {
        const historyRes = await client.query('SELECT review_history FROM claims WHERE id = $1', [claimId]);
        const nextHistory = appendReviewHistory(
          historyRes.rows?.[0]?.review_history,
          createReviewHistoryEntry({
            stage: 'link_review',
            action: 'approved',
            reason: '连接审核通过',
            details: reviewDetails
          })
        );

        await client.query(
          `
          UPDATE claims
          SET status = $1,
              link_review_status = 'approved',
              link_review_reason = $2,
              link_reviewed_at = NOW(),
              reviewed_at = NOW(),
              review_note = $2,
              link_verified = true,
              link_verify_result = $3,
              review_history = $4
          WHERE id = $5
          `,
          [
            CLAIM_STATUS.APPROVED,
            '连接审核通过',
            JSON.stringify(reviewDetails),
            JSON.stringify(nextHistory),
            claimId
          ]
        );
      });

      const settlement = await pointsSettlementService.awardClaimPoints({
        claimId,
        taskId,
        userId,
        awardReason: '链接审核通过',
        source: 'link_verify_worker'
      });

      const awardedPoints = settlement?.finalPoints || 0;
      try {
        await promotionService.calculateCPromotionEarnings(claimId, userId, awardedPoints);
      } catch (promoErr) {
        console.error('[LinkWorker] 推广积分计算失败:', promoErr.message);
      }

      try {
        await publishLinkVerifyComplete(claimId, userId, true, {
          approved: true,
          reason: '连接审核通过'
        });
      } catch (e) {}

      return {
        claimId,
        passed: true,
        linkValid: linkResult.success,
        commentValid: commentResult.passed,
        reasons: []
      };
    }

    if (requiresManual) {
      const manualReason =
        commentResult.errorType === 'missing_page_comments'
          ? '连接审核未提取到评论，已转人工检查'
          : nicknameResult.requiresManual
            ? `${nicknameResult.reason}，已转人工检查`
            : finalCommentJudgement.requiresManual
              ? finalCommentJudgement.reason
              : '连接审核异常，已转人工复审';
      await db.transaction(async (client) => {
        const historyRes = await client.query('SELECT review_history FROM claims WHERE id = $1', [claimId]);
        const nextHistory = appendReviewHistory(
          historyRes.rows?.[0]?.review_history,
          createReviewHistoryEntry({
            stage: 'link_review',
            action: 'manual',
            reason: manualReason,
            details: reviewDetails
          })
        );

        await client.query(
          `
          UPDATE claims
          SET status = $1,
              link_review_status = 'manual',
              link_review_reason = $2,
              link_reviewed_at = NOW(),
              review_note = $2,
              link_verified = false,
              link_verify_result = $3,
              review_history = $4
          WHERE id = $5
          `,
          [
            CLAIM_STATUS.PENDING_MANUAL,
            manualReason,
            JSON.stringify(reviewDetails),
            JSON.stringify(nextHistory),
            claimId
          ]
        );
      });

      try {
        await publishLinkVerifyComplete(claimId, userId, false, {
          manual: true,
          reason: manualReason
        });
      } catch (e) {}

      return { claimId, manual: true, reason: manualReason };
    }

    const rejectReason = [
      ...commentResult.reasons,
      !nicknameResult.passed && !nicknameResult.requiresManual ? nicknameResult.reason : null,
      !authorResult.match ? authorResult.reason : null,
      !finalCommentJudgement.passed && !finalCommentJudgement.requiresManual ? finalCommentJudgement.reason : null,
      linkResult.error || null
    ].filter(Boolean).join('; ') || '连接审核未通过';

    const claimRow = await db.queryOne('SELECT reject_count, review_history FROM claims WHERE id = $1', [claimId]);
    const rejectCount = Number(claimRow?.reject_count || 0) + 1;
    const shouldRelease = rejectCount >= 3;
    const nextHistory = appendReviewHistory(
      claimRow?.review_history,
      createReviewHistoryEntry({
        stage: 'link_review',
        action: 'rejected',
        reason: rejectReason,
        details: {
          ...reviewDetails,
          rejectCount
        }
      })
    );
    const finalHistory = appendReviewHistory(
      nextHistory,
      createReviewHistoryEntry({
        stage: 'claim_flow',
        action: shouldRelease ? 'released' : 'returned',
        reason: rejectReason,
        details: {
          source: 'link_review',
          rejectCount
        }
      })
    );

    await db.query(
      `
      UPDATE claims
      SET status = $1,
          reject_count = $2,
          submitted_at = NULL,
          reviewed_at = NOW(),
          link_review_status = 'rejected',
          link_review_reason = $3,
          link_reviewed_at = NOW(),
          review_note = $3,
          link_verified = false,
          link_verify_result = $4,
          review_history = $5
      WHERE id = $6
      `,
      [
        shouldRelease ? CLAIM_STATUS.RELEASED : CLAIM_STATUS.DOING,
        rejectCount,
        rejectReason,
        JSON.stringify(reviewDetails),
        JSON.stringify(finalHistory),
        claimId
      ]
    );

    if (!shouldRelease && blockReasons.length === 0) {
      await addToHighlightQueue(claimId, userId, '评论验证失败，建议更换账号重新提交', {
        type: 'account_blocked',
        suggestion: '您的评论账号可能被限制，建议更换抖音账号重新完成任务'
      });
    }

    try {
      await publishLinkVerifyComplete(claimId, userId, false, {
        rejected: true,
        released: shouldRelease,
        reason: rejectReason
      });
    } catch (e) {}

    return {
      claimId,
      passed: false,
      released: shouldRelease,
      reasons: rejectReason ? rejectReason.split('; ') : []
    };

  } catch (error) {
    console.error(`[LinkWorker] ❌ 处理失败: ${error.message}`);
    const manualReason = `连接审核执行失败，已转人工复审: ${error.message}`;

    await db.transaction(async (client) => {
      const historyRes = await client.query('SELECT review_history FROM claims WHERE id = $1', [claimId]);
      const nextHistory = appendReviewHistory(
        historyRes.rows?.[0]?.review_history,
        createReviewHistoryEntry({
          stage: 'link_review',
          action: 'manual',
          reason: manualReason,
          details: { error: error.message }
        })
      );

      await client.query(
        `
        UPDATE claims
        SET status = $1,
            link_review_status = 'manual',
            link_review_reason = $2,
            review_note = $2,
            review_history = $3
        WHERE id = $4
        `,
        [CLAIM_STATUS.PENDING_MANUAL, manualReason, JSON.stringify(nextHistory), claimId]
      );
    });

    try {
      await publishLinkVerifyComplete(claimId, userId, false, {
        manual: true,
        reason: manualReason
      });
    } catch (e) {}

    return { claimId, manual: true, reason: manualReason };
  }
}, {
  connection: redisConnection,
  concurrency: 3,
  limiter: { max: 5, duration: 1000 }
});

linkVerifyWorker.on('completed', (job) => console.log(`[LinkWorker] ✅ Job 完成: ${job.id}`));
linkVerifyWorker.on('failed', (job, err) => console.error(`[LinkWorker] ❌ Job 失败: ${job?.id}`, err.message));
linkVerifyWorker.on('error', (err) => console.error('[LinkWorker] Worker 错误:', err.message));

checkAllServicesHealth().then(results => {
  const healthyCount = results.filter(r => r.healthy).length;
  if (healthyCount > 0) {
    console.log(`[LinkWorker] ✅ 已启动，可用服务: ${healthyCount}/${BROWSER_PORTS.length}`);
    console.log(`[LinkWorker] 多 IP 重试机制: 最多尝试 ${MAX_IP_RETRIES} 个不同 IP`);
    results.forEach(r => console.log(`  - 端口 ${r.port}: ${r.healthy ? '✅' : '❌'} ${r.version || r.error || ''}`));
  } else {
    console.warn('[LinkWorker] ⚠️ 所有 Browser Service 不可用');
  }
});

export default linkVerifyWorker;
