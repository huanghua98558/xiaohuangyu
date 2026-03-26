/**
 * 语意识别服务
 * 
 * 功能：
 * 1. 判断评论内容是否与任务相关
 * 2. 检测评论是否为正面/负面/中性
 * 3. 识别评论是否为有效评论（非灌水、非广告）
 */

import axios from 'axios';
import logger from '../../utils/logger.js';

// 配置
const CONFIG = {
  bailianApiKey: process.env.BAILIAN_API_KEY || '',
  bailianTextModel: process.env.BAILIAN_TEXT_MODEL || 'qwen-plus',
  timeout: 30000
};

/**
 * 语意识别
 * @param {Object} params - 参数
 * @param {string} params.comment - 评论内容
 * @param {string} params.taskTitle - 任务标题
 * @param {string} params.taskDescription - 任务描述
 * @param {string} params.platform - 平台
 * @returns {Object} 识别结果
 */
export async function analyzeSemantic(params) {
  const { comment, taskTitle, taskDescription, platform } = params;
  
  if (!comment) {
    return { valid: false, reason: '无评论内容' };
  }
  
  if (!CONFIG.bailianApiKey) {
    logger.warn('[Semantic] 百炼API未配置，跳过语意识别');
    return { valid: true, reason: '语意识别未启用，默认通过' };
  }
  
  logger.info('[Semantic] 开始语意识别:', comment.substring(0, 50));
  
  const prompt = `你是一个专业的评论内容审核助手。请分析以下评论是否有效。

任务信息：
- 标题：${taskTitle || '未知'}
- 描述：${taskDescription || '无'}
- 平台：${platform || '抖音'}

用户评论：
${comment}

请从以下维度分析：
1. 相关性：评论是否与视频内容相关
2. 正面性：评论是否为正面评价（非负面攻击）
3. 有效性：评论是否为有效内容（非纯表情、非灌水、非广告）

返回JSON格式：
{
  valid: true或false,
  relevance: 0.0-1.0（相关性分数）,
  positivity: 0.0-1.0（正面性分数）,
  effectiveness: 0.0-1.0（有效性分数）,
  reason: 判断理由,
  suggestion: 改进建议（如果无效）
}`;

  try {
    const response = await axios.post(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      {
        model: CONFIG.bailianTextModel,
        input: {
          messages: [
            { role: 'system', content: '你是一个专业的评论内容审核助手，只返回JSON格式结果。' },
            { role: 'user', content: prompt }
          ]
        },
        parameters: {
          result_format: 'message'
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${CONFIG.bailianApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: CONFIG.timeout
      }
    );
    
    const text = response.data?.output?.choices?.[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      logger.info('[Semantic] 语意识别结果:', result.valid ? '有效' : '无效', result.reason);
      return {
        valid: result.valid,
        relevance: result.relevance,
        positivity: result.positivity,
        effectiveness: result.effectiveness,
        reason: result.reason,
        suggestion: result.suggestion
      };
    }
    
    return { valid: true, reason: '解析失败，默认通过' };
    
  } catch (error) {
    logger.error('[Semantic] 语意识别失败:', error.message);
    return { valid: true, reason: '识别失败，默认通过', error: error.message };
  }
}

/**
 * 批量语意识别
 */
export async function batchAnalyzeSemantic(comments, taskInfo) {
  const results = [];
  
  for (const comment of comments) {
    const result = await analyzeSemantic({
      comment,
      ...taskInfo
    });
    results.push(result);
    
    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return results;
}

export default {
  analyzeSemantic,
  batchAnalyzeSemantic
};
