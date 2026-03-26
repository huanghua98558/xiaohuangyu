/**
 * PaddleOCR客户端封装 - 队列版
 * 支持：同步分析、异步队列、批量处理
 */

import axios from 'axios';
import logger from '../../utils/logger.js';

const PADDLE_OCR_URL = process.env.PADDLE_OCR_URL || 'http://127.0.0.1:9001';
const PADDLE_OCR_ENABLED = process.env.PADDLE_OCR_ENABLED !== 'false';
const PADDLE_OCR_TIMEOUT = parseInt(process.env.PADDLE_OCR_TIMEOUT) || 120000; // 增加到 120 秒，适配 PaddleOCR 模型加载时间
const PADDLE_OCR_QUEUE_MODE = process.env.PADDLE_OCR_QUEUE_MODE === 'true';

/**
 * 同步分析截图（兼容现有逻辑）
 */
export async function analyzeWithPaddleOCR(imagePath, options = {}) {
  const { action = '短视频体验官', taskAuthor = null, platform = 'douyin' } = options;

  if (!PADDLE_OCR_ENABLED) {
    return { success: false, error: 'PaddleOCR未启用', needFallback: true };
  }

  const startTime = Date.now();

  try {
    logger.info('[PaddleOCR] 开始分析:', imagePath?.substring(0, 50) + '...');

    const response = await axios.post(
      PADDLE_OCR_URL + '/analyze',
      { 
        path: imagePath,
        task_author: taskAuthor,
        platform: platform
      },
      { timeout: PADDLE_OCR_TIMEOUT }
    );

    const data = response.data;
    
    if (!data.success) {
      return { 
        success: false, 
        error: data.error || 'OCR识别失败', 
        needFallback: true 
      };
    }

    const duration = Date.now() - startTime;
    const ocr = data.ocr || {};
    const final = data.final_result || {};

    const authorMatch = data.authorMatch || null;
    const comment = data.comment || null;
    const screenshotAuthor = data.author || null;

    let passed = false;
    let details = '';

    if (action === '短视频体验官') {
      const likeOk = final.like_passed || ocr.has_like;
      const favoriteOk = final.favorite_passed || ocr.has_favorite;
      const commentOk = final.comment_passed || ocr.has_comment;

      passed = likeOk && favoriteOk && commentOk;
      details = `点赞: ${likeOk ? '✓' : '✗'}, 收藏: ${favoriteOk ? '✓' : '✗'}, 评论: ${commentOk ? '✓' : '✗'}`;
      
      if (authorMatch) {
        details += ` | 达人: ${authorMatch.matched ? '✓匹配' : '✗不匹配'}`;
      }
    } else {
      passed = (final.like_passed || final.favorite_passed || final.comment_passed);
      details = `识别: like=${final.like_passed}, fav=${final.favorite_passed}, cmt=${final.comment_passed}`;
    }

    logger.info(`[PaddleOCR] 分析完成: passed=${passed}, author=${screenshotAuthor || '未识别'}, duration=${duration}ms`);

    return {
      success: true,
      provider: 'paddleocr',
      passed,
      confidence: final.confidence || 0.85,
      details,
      text: ocr.text?.substring(0, 200) || '',
      duration,
      author: screenshotAuthor,
      authorMatch,
      comment,
      rawResult: data
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('[PaddleOCR] 分析失败:', error.message);
    
    return {
      success: false,
      error: error.message,
      needFallback: true,
      duration
    };
  }
}

/**
 * 异步提交任务到队列
 * @param {string} imagePath - 图片路径
 * @param {Object} options - 选项
 * @returns {Promise<{taskId: string}>}
 */
export async function enqueueOCRTask(imagePath, options = {}) {
  const { action = '短视频体验官', taskAuthor = null, platform = 'douyin', taskId = null } = options;

  try {
    const response = await axios.post(
      PADDLE_OCR_URL + '/enqueue',
      {
        image: imagePath,
        taskId,
        task_author: taskAuthor,
        platform,
        action
      },
      { timeout: 5000 }
    );

    return response.data;
  } catch (error) {
    logger.error('[PaddleOCR] 提交队列失败:', error.message);
    throw error;
  }
}

/**
 * 查询任务结果
 * @param {string} taskId - 任务ID
 * @param {number} maxWait - 最大等待时间(ms)
 */
export async function getOCRResult(taskId, maxWait = 30000) {
  const startTime = Date.now();
  const pollInterval = 500;

  while (Date.now() - startTime < maxWait) {
    try {
      const response = await axios.get(
        `${PADDLE_OCR_URL}/result/${taskId}`,
        { timeout: 5000 }
      );

      const data = response.data;
      
      if (data.status === 'completed') {
        return data;
      } else if (data.status === 'failed' || data.status === 'error') {
        return { success: false, error: data.error || '处理失败' };
      }

      // 等待后继续轮询
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (error) {
      logger.error('[PaddleOCR] 查询结果失败:', error.message);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  return { success: false, error: '查询超时' };
}

/**
 * 批量提交任务到队列
 * @param {Array} tasks - 任务列表
 */
export async function batchEnqueueOCR(tasks) {
  try {
    const response = await axios.post(
      PADDLE_OCR_URL + '/batch',
      { tasks },
      { timeout: 10000 }
    );

    return response.data;
  } catch (error) {
    logger.error('[PaddleOCR] 批量提交失败:', error.message);
    throw error;
  }
}

/**
 * 队列模式分析（提交+等待结果）
 */
export async function analyzeWithQueue(imagePath, options = {}) {
  const startTime = Date.now();
  
  try {
    // 提交任务
    const enqueueResult = await enqueueOCRTask(imagePath, options);
    
    if (!enqueueResult.success) {
      return { success: false, error: enqueueResult.error };
    }

    const taskId = enqueueResult.taskId;
    
    // 等待结果
    const result = await getOCRResult(taskId, options.maxWait || 30000);
    
    if (!result.success) {
      return { success: false, error: result.error };
    }

    const duration = Date.now() - startTime;
    const ocrResult = result.result || {};

    return {
      success: true,
      provider: 'paddleocr-queue',
      taskId,
      passed: ocrResult.has_like && ocrResult.has_favorite && ocrResult.has_comment,
      confidence: ocrResult.confidence || 0.85,
      details: `点赞: ${ocrResult.has_like ? '✓' : '✗'}, 收藏: ${ocrResult.has_favorite ? '✓' : '✗'}, 评论: ${ocrResult.has_comment ? '✓' : '✗'}`,
      duration,
      author: ocrResult.author,
      authorMatch: ocrResult.authorMatch,
      comment: ocrResult.comment
    };

  } catch (error) {
    logger.error('[PaddleOCR] 队列分析失败:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 批量分析多张截图
 */
export async function analyzeScreenshotsWithOCR(imagePaths, options = {}) {
  const { action = '短视频体验官', taskAuthor = null, platform = 'douyin' } = options;

  if (!imagePaths || imagePaths.length === 0) {
    return { success: false, error: '没有截图' };
  }

  // 队列模式：批量提交
  if (PADDLE_OCR_QUEUE_MODE && imagePaths.length > 3) {
    logger.info(`[PaddleOCR] 使用队列模式处理 ${imagePaths.length} 张图片`);
    
    const tasks = imagePaths.map((path, index) => ({
      image: path,
      taskId: `ocr_${Date.now()}_${index}`,
      task_author: taskAuthor,
      platform,
      action
    }));

    const batchResult = await batchEnqueueOCR(tasks);
    
    if (!batchResult.success) {
      // 降级到同步模式
      return analyzeSync(imagePaths, options);
    }

    // 等待所有结果
    const results = [];
    for (const taskId of batchResult.taskIds) {
      const result = await getOCRResult(taskId, 60000);
      results.push(result);
    }

    return processResults(results, imagePaths.length);
  }

  // 同步模式
  return analyzeSync(imagePaths, options);
}

/**
 * 同步批量分析
 */
async function analyzeSync(imagePaths, options) {
  const { action = '短视频体验官', taskAuthor = null, platform = 'douyin' } = options;

  const results = [];
  let allPassed = true;
  let totalConfidence = 0;
  let allDetails = [];
  let authorMatchResult = null;
  let anyAuthorMatched = false;
  let bestCommentInfo = null;

  for (const path of imagePaths) {
    const result = await analyzeWithPaddleOCR(path, { action, taskAuthor, platform });
    results.push(result);

    if (result.success && !result.passed) {
      allPassed = false;
    }
    
    if (result.success) {
      totalConfidence += result.confidence || 0.85;
      allDetails.push(result.details);
      
      if (result.authorMatch) {
        if (result.authorMatch.matched) {
          anyAuthorMatched = true;
          authorMatchResult = result.authorMatch;
        } else if (!authorMatchResult) {
          authorMatchResult = result.authorMatch;
        }
      }
      
      if (result.comment && (!bestCommentInfo || result.comment.length > (bestCommentInfo.length || 0))) {
        bestCommentInfo = result.comment;
      }
    } else {
      return {
        success: false,
        needFallback: true,
        error: 'PaddleOCR分析失败',
        results
      };
    }
  }

  const avgConfidence = totalConfidence / results.length;
  
  const finalResult = {
    success: true,
    provider: 'paddleocr',
    passed: allPassed,
    confidence: avgConfidence,
    details: allDetails.join(' | '),
    results
  };
  
  if (authorMatchResult) {
    finalResult.authorMatch = {
      matched: anyAuthorMatched,
      screenshotAuthor: authorMatchResult.screenshotAuthor,
      taskAuthor: authorMatchResult.taskAuthor
    };
  }
  
  if (bestCommentInfo) {
    finalResult.comment = bestCommentInfo;
  }

  return finalResult;
}

/**
 * 处理批量结果
 */
function processResults(results, totalCount) {
  let allPassed = true;
  let totalConfidence = 0;
  let allDetails = [];
  let authorMatchResult = null;
  let anyAuthorMatched = false;
  let bestCommentInfo = null;

  for (const result of results) {
    if (result.status === 'completed' && result.result?.success) {
      const ocr = result.result;
      
      if (!ocr.has_like || !ocr.has_favorite || !ocr.has_comment) {
        allPassed = false;
      }
      
      totalConfidence += ocr.confidence || 0.85;
      allDetails.push(`点赞:${ocr.has_like ? '✓' : '✗'} 收藏:${ocr.has_favorite ? '✓' : '✗'} 评论:${ocr.has_comment ? '✓' : '✗'}`);
      
      if (ocr.authorMatch) {
        if (ocr.authorMatch.matched) {
          anyAuthorMatched = true;
          authorMatchResult = ocr.authorMatch;
        } else if (!authorMatchResult) {
          authorMatchResult = ocr.authorMatch;
        }
      }
      
      if (ocr.comment && (!bestCommentInfo || ocr.comment.length > (bestCommentInfo.length || 0))) {
        bestCommentInfo = ocr.comment;
      }
    } else {
      allPassed = false;
    }
  }

  const avgConfidence = totalConfidence / (results.length || 1);

  const finalResult = {
    success: true,
    provider: 'paddleocr-queue',
    passed: allPassed,
    confidence: avgConfidence,
    details: allDetails.join(' | '),
    results
  };

  if (authorMatchResult) {
    finalResult.authorMatch = {
      matched: anyAuthorMatched,
      screenshotAuthor: authorMatchResult.screenshotAuthor,
      taskAuthor: authorMatchResult.taskAuthor
    };
  }

  if (bestCommentInfo) {
    finalResult.comment = bestCommentInfo;
  }

  return finalResult;
}

/**
 * 获取队列统计
 */
export async function getOCRStats() {
  try {
    const response = await axios.get(`${PADDLE_OCR_URL}/stats`, { timeout: 5000 });
    return response.data;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export default {
  analyzeWithPaddleOCR,
  analyzeScreenshotsWithOCR,
  enqueueOCRTask,
  getOCRResult,
  batchEnqueueOCR,
  analyzeWithQueue,
  getOCRStats
};
