/**
 * 视觉审核服务 - 完整降级链路
 * 
 * 审核流程：
 * 1. PaddleOCR（第一级）- 本地免费，优先使用
 *    - 重试机制：最多 3 次
 * 2. 百炼/阿里云（第二级）- 降级兜底
 * 3. 人工审核（最后）- 全部失败时
 */

import axios from 'axios';
import supabase from '../../utils/supabaseToPrismaAdapter.js';
import logger from '../../utils/logger.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// 配置
const CONFIG = {
  paddleOcrUrl: process.env.PADDLE_OCR_URL || 'http://localhost:9001',
  paddleOcrEnabled: process.env.PADDLE_OCR_ENABLED !== 'false',
  paddleOcrTimeout: parseInt(process.env.PADDLE_OCR_TIMEOUT) || 30000,
  bailianApiKey: process.env.BAILIAN_API_KEY || '',
  bailianModel: process.env.BAILIAN_MODEL || 'qwen-vl-plus',
  maxRetries: parseInt(process.env.OCR_MAX_RETRIES) || 3,
  retryDelay: 1000,
  imageStorageDir: process.env.IMAGE_STORAGE_DIR || '/data/images/uploads/images'
};

// 工具函数
function urlToLocalPath(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('/')) return imageUrl;
  const match = imageUrl.match(/\/uploads\/images\/(.+)/);
  if (match) return path.join(CONFIG.imageStorageDir, match[1]);
  const pathMatch = imageUrl.match(/\/images\/(.+)/);
  if (pathMatch) return path.join(CONFIG.imageStorageDir, pathMatch[1]);
  return null;
}

function localFileExists(filePath) {
  try { return fs.existsSync(filePath); } catch { return false; }
}

async function downloadImageAsBase64(url) {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
    return Buffer.from(response.data).toString('base64');
  } catch (error) {
    logger.error('[Vision] 下载图片失败:', error.message);
    return null;
  }
}

function readLocalFileAsBase64(filePath) {
  try { return fs.readFileSync(filePath).toString('base64'); } catch { return null; }
}

function extractAuthorFromTitle(title) {
  if (!title) return '';
  const match = title.match(/^(.+?)[-–—]\s*\d/);
  return match ? match[1].trim() : title.trim();
}

// 第一级：PaddleOCR
async function reviewWithPaddleOCR(imageInput, taskContext, retryCount = 0) {
  if (!CONFIG.paddleOcrEnabled) {
    return { success: false, error: 'PaddleOCR未启用', needFallback: true };
  }
  
  const startTime = Date.now();
  const attempt = retryCount + 1;
  
  try {
    logger.info(`[PaddleOCR] 第${attempt}次尝试...`);
    
    const requestBody = { check_type: 'all' };
    const isLocalPath = typeof imageInput === 'string' && imageInput.startsWith('/') && localFileExists(imageInput);
    
    if (isLocalPath) {
      requestBody.path = imageInput;
    } else if (typeof imageInput === 'string' && imageInput.length > 200) {
      requestBody.image = imageInput;
    } else if (typeof imageInput === 'string') {
      const localPath = urlToLocalPath(imageInput);
      if (localPath && localFileExists(localPath)) {
        requestBody.path = localPath;
      } else {
        return { success: false, error: '无法访问图片', needFallback: true };
      }
    }
    
    if (taskContext.taskAuthor) requestBody.task_author = taskContext.taskAuthor;
    if (taskContext.platform) requestBody.platform = taskContext.platform;
    
    const response = await axios.post(CONFIG.paddleOcrUrl + '/analyze', requestBody, { timeout: CONFIG.paddleOcrTimeout });
    const data = response.data;
    
    if (!data.success) {
      const errorMsg = data.error || 'OCR识别失败';
      logger.warn(`[PaddleOCR] 第${attempt}次失败: ${errorMsg}`);
      if (retryCount < CONFIG.maxRetries - 1) {
        await new Promise(r => setTimeout(r, CONFIG.retryDelay));
        return reviewWithPaddleOCR(imageInput, taskContext, retryCount + 1);
      }
      return { success: false, error: errorMsg, needFallback: true };
    }
    
    const ocrResult = data.ocr || {};
    const finalResult = data.final_result || {};
    const authorMatch = data.authorMatch || null;
    const comment = data.comment || null;
    
    const likePassed = finalResult.like_passed || false;
    const favoritePassed = finalResult.favorite_passed || false;
    const commentPassed = finalResult.comment_passed || false;
    const confidence = finalResult.confidence || 0.8;
    
    const { action } = taskContext;
    let passed = false;
    if (action === 'like') passed = likePassed;
    else if (action === 'collect' || action === 'favorite') passed = favoritePassed;
    else if (action === 'like_collect' || action === 'like_favorite') passed = likePassed && favoritePassed;
    else passed = likePassed && favoritePassed && commentPassed;
    
    const duration = Date.now() - startTime;
    logger.info(`[PaddleOCR] 成功: passed=${passed}, confidence=${confidence.toFixed(2)}, duration=${duration}ms`);
    
    return {
      success: true, provider: 'paddleocr', likePassed, favoritePassed, commentPassed, passed, confidence,
      reason: passed ? 'OCR检测通过' : '未检测到关键操作',
      details: `点赞:${likePassed ? '✓' : '✗'} 收藏:${favoritePassed ? '✓' : '✗'} 评论:${commentPassed ? '✓' : '✗'}`,
      duration, text: ocrResult.text || '',
      authorMatch: authorMatch ? { matched: authorMatch.matched, screenshotAuthor: authorMatch.screenshotAuthor, taskAuthor: authorMatch.taskAuthor } : null,
      comment, rawResult: data
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`[PaddleOCR] 第${attempt}次异常: ${error.message}`);
    if (retryCount < CONFIG.maxRetries - 1) {
      await new Promise(r => setTimeout(r, CONFIG.retryDelay));
      return reviewWithPaddleOCR(imageInput, taskContext, retryCount + 1);
    }
    return { success: false, error: error.message, needFallback: true, duration };
  }
}

// 第二级：百炼/阿里云 Qwen-VL-Plus
async function reviewWithBailian(imageBase64, taskContext) {
  if (!CONFIG.bailianApiKey) {
    logger.warn('[百炼] API Key未配置');
    return { success: false, error: 'BAILIAN_API_KEY未配置', needFallback: true };
  }
  
  const startTime = Date.now();
  try {
    logger.info('[百炼] 开始审核...');
    const { action, platform, taskAuthor } = taskContext;
    
    const prompt = `分析这张手机截图，判断用户是否完成了以下操作：
任务类型: ${action || '短视频体验官'}
平台: ${platform || '抖音'}
任务达人: ${taskAuthor || '未知'}

请检查：
1. 是否有点赞（红心/已点赞状态）
2. 是否有收藏（星星/已收藏状态）
3. 是否有评论（评论内容）

返回JSON格式：
{
  "like_passed": true/false,
  "favorite_passed": true/false,
  "comment_passed": true/false,
  "confidence": 0.0-1.0,
  "reason": "说明理由"
}`;

    const response = await axios.post(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
      {
        model: CONFIG.bailianModel,
        input: {
          messages: [{
            role: 'user',
            content: [
              { image: `data:image/jpeg;base64,${imageBase64}` },
              { text: prompt }
            ]
          }]
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${CONFIG.bailianApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );
    
    const text = response.data?.output?.choices?.[0]?.message?.content?.[0]?.text || '';
    logger.info(`[百炼] 响应: ${text.substring(0, 200)}`);
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: '百炼返回格式错误', needFallback: true, duration: Date.now() - startTime };
    }
    
    const result = JSON.parse(jsonMatch[0]);
    const passed = (result.like_passed || false) && (result.favorite_passed || false);
    const duration = Date.now() - startTime;
    
    logger.info(`[百炼] 完成: passed=${passed}, duration=${duration}ms`);
    
    return {
      success: true,
      provider: 'bailian',
      likePassed: result.like_passed || false,
      favoritePassed: result.favorite_passed || false,
      commentPassed: result.comment_passed || false,
      passed,
      confidence: result.confidence || 0.7,
      reason: result.reason || '百炼审核',
      details: `点赞:${result.like_passed ? '✓' : '✗'} 收藏:${result.favorite_passed ? '✓' : '✗'} 评论:${result.comment_passed ? '✓' : '✗'}`,
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('[百炼] 审核失败:', error.message);
    return { success: false, error: error.message, needFallback: true, duration };
  }
}

// 主函数：审核截图
export async function reviewScreenshots(screenshots, taskContext = {}) {
  const startTime = Date.now();
  
  if (!screenshots || screenshots.length === 0) {
    return { success: false, passed: false, confidence: 0, reason: '没有截图', provider: 'none' };
  }
  
  const taskAuthor = taskContext.taskAuthor || extractAuthorFromTitle(taskContext.taskTitle);
  const context = { ...taskContext, taskAuthor };
  
  logger.info(`[VisionReview] 开始审核 ${screenshots.length} 张截图...`);
  
  let base64Image = null;
  const results = [];
  
  for (const screenshot of screenshots) {
    const localPath = urlToLocalPath(screenshot);
    const useLocalPath = localPath && localFileExists(localPath);
    const imageInput = useLocalPath ? localPath : screenshot;
    
    // 第一级：PaddleOCR
    let result = await reviewWithPaddleOCR(imageInput, context);
    if (result.success) {
      results.push(result);
      continue;
    }
    
    logger.info('[VisionReview] PaddleOCR失败，尝试百炼降级...');
    
    // 获取base64用于百炼
    if (!base64Image) {
      base64Image = useLocalPath ? readLocalFileAsBase64(localPath) : await downloadImageAsBase64(screenshot);
    }
    
    if (!base64Image) {
      results.push(result);
      continue;
    }
    
    // 第二级：百炼
    result = await reviewWithBailian(base64Image, context);
    results.push(result);
  }
  
  // 汇总结果
  let allPassed = true;
  let totalConfidence = 0;
  let details = [];
  let provider = 'paddleocr';
  let authorMatch = null;
  let comment = null;
  
  for (const r of results) {
    if (r.success) {
      if (!r.passed) allPassed = false;
      totalConfidence += r.confidence || 0.7;
      details.push(r.details || '');
      provider = r.provider;
      if (r.authorMatch) authorMatch = r.authorMatch;
      if (r.comment) comment = r.comment;
    } else {
      allPassed = false;
      details.push(`失败: ${r.error}`);
    }
  }
  
  const avgConfidence = results.length > 0 ? totalConfidence / results.length : 0;
  const duration = Date.now() - startTime;
  
  logger.info(`[VisionReview] 完成: passed=${allPassed}, provider=${provider}, confidence=${avgConfidence.toFixed(2)}, duration=${duration}ms`);
  
  return {
    success: results.some(r => r.success),
    passed: allPassed,
    confidence: avgConfidence,
    reason: allPassed ? '审核通过' : '审核未通过',
    details: details.join(' | '),
    provider,
    duration,
    authorMatch,
    comment,
    results
  };
}

export default { reviewScreenshots, reviewWithPaddleOCR, reviewWithBailian };
