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
import { getConfigs } from './configService.js';
import reviewConfig from './reviewConfigService.js';
import { recordAIUsage } from './aiUsageStatsService.js';

const DEFAULT_TIMEOUT = 30000;

async function getSemanticRuntimeConfig() {
  const configs = await getConfigs([
    'semantic_ai_provider',
    'semantic_ai_model',
    'semantic_ai_api_key',
    'semantic_ai_base_url',
    'semantic_ai_temperature',
    'semantic_ai_max_tokens'
  ]);

  return {
    provider: configs.semantic_ai_provider || 'bailian',
    model: configs.semantic_ai_model || process.env.BAILIAN_TEXT_MODEL || 'qwen-plus',
    apiKey: configs.semantic_ai_api_key || process.env.BAILIAN_API_KEY || '',
    baseUrl: configs.semantic_ai_base_url || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    temperature: Number.parseFloat(configs.semantic_ai_temperature || '0.7'),
    maxTokens: Number.parseInt(configs.semantic_ai_max_tokens || '500', 10) || 500,
    timeout: DEFAULT_TIMEOUT
  };
}

function parseUsage(responseData = {}) {
  const usage = responseData?.usage || responseData?.output?.usage || {};
  return {
    promptTokens: usage.input_tokens ?? usage.prompt_tokens ?? usage.inputTokens ?? 0,
    completionTokens: usage.output_tokens ?? usage.completion_tokens ?? usage.outputTokens ?? 0,
    totalTokens: usage.total_tokens ?? usage.totalTokens ?? 0
  };
}

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
  
  const reviewSettings = await reviewConfig.getConfig();
  const runtimeConfig = await getSemanticRuntimeConfig();

  if (!reviewSettings?.semantic?.enabled) {
    return { valid: true, reason: '语义检测未启用，默认通过', skipped: true };
  }

  if (!runtimeConfig.apiKey) {
    logger.warn('[Semantic] 百炼API未配置，无法执行语意识别');
    return { valid: false, reason: '语义服务未配置', error: 'semantic_api_key_missing' };
  }
  
  logger.info('[Semantic] 开始语意识别:', comment.substring(0, 50));
  
  const taskRef = (taskTitle && !/^[a-z_]+$/.test(taskTitle)) ? taskTitle : '';
  const prompt = `评论审核。平台:${platform || '抖音'}${taskRef ? ',内容:' + taskRef : ''}${taskDescription ? ',描述:' + taskDescription : ''}
评论:"${comment}"
判断标准:
- 正面性:非攻击/辱骂即可,正面或中性均可
- 有效性:非纯表情/纯符号/复制粘贴广告即可
- 相关性:${taskRef ? '与内容是否相关' : '在社交平台语境下是否属于合理互动'}
注意:短视频平台上"挺好的""很厉害""朋友推荐的"等简短正面评论属于正常互动,应判定有效
返回JSON:{"valid":bool,"relevance":0-1,"positivity":0-1,"effectiveness":0-1,"reason":"简短理由"}`;

  try {
    const response = await axios.post(
      runtimeConfig.baseUrl,
      {
        model: runtimeConfig.model,
        input: {
          messages: [
            { role: 'system', content: '评论审核助手,只返回JSON。' },
            { role: 'user', content: prompt }
          ]
        },
        parameters: {
          result_format: 'message',
          temperature: Number.isFinite(runtimeConfig.temperature) ? runtimeConfig.temperature : 0.7,
          max_tokens: runtimeConfig.maxTokens
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${runtimeConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: runtimeConfig.timeout
      }
    );

    await recordAIUsage({
      provider: runtimeConfig.provider,
      model: runtimeConfig.model,
      stage: 'semantic_analysis',
      success: true,
      ...parseUsage(response.data)
    });
    
    const text = response.data?.output?.choices?.[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      logger.info('[Semantic] 语意识别结果:', result.valid ? '有效' : '无效', result.reason);
      const semanticResult = {
        valid: result.valid,
        relevance: result.relevance,
        positivity: result.positivity,
        effectiveness: result.effectiveness,
        reason: result.reason,
        suggestion: result.suggestion
      };
      semanticResult.valid = Boolean(
        semanticResult.valid &&
        (semanticResult.relevance ?? 1) >= (reviewSettings.semantic?.minRelevance ?? 0) &&
        (semanticResult.positivity ?? 1) >= (reviewSettings.semantic?.minPositivity ?? 0) &&
        (semanticResult.effectiveness ?? 1) >= (reviewSettings.semantic?.minEffectiveness ?? 0)
      );

      if (!semanticResult.valid && !semanticResult.reason) {
        semanticResult.reason = '语义评分未达到阈值';
      }

      return semanticResult;
    }
    
    return { valid: false, reason: '语义响应解析失败', error: 'semantic_response_parse_failed' };
    
  } catch (error) {
    logger.error('[Semantic] 语意识别失败:', error.message);
    await recordAIUsage({
      provider: runtimeConfig.provider,
      model: runtimeConfig.model,
      stage: 'semantic_analysis',
      success: false
    });
    return { valid: false, reason: '语意识别失败', error: error.message };
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
