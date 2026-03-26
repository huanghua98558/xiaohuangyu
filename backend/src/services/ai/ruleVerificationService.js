/**
 * 规则验证服务
 * 
 * 功能：
 * 1. 验证评论人昵称一致性
 * 2. 验证评论内容一致性
 * 3. 可配置规则模式：规则+AI / 仅AI / 仅规则
 */

import logger from '../../utils/logger.js';
import { analyzeSemantic } from './semanticAnalysisService.js';

/**
 * 验证模式枚举
 */
export const VERIFY_MODE = {
  RULE_AND_AI: 'rule_and_ai',    // 规则+AI（两者都通过才算通过）
  AI_ONLY: 'ai_only',            // 仅AI
  RULE_ONLY: 'rule_only'         // 仅规则
};

/**
 * 规则验证配置
 */
const DEFAULT_RULES = {
  // 昵称匹配规则
  nickname: {
    enabled: true,
    matchMode: 'contains',       // contains / exact / fuzzy
    minSimilarity: 0.7           // 模糊匹配最低相似度
  },
  // 评论内容规则
  comment: {
    enabled: true,
    minMatchLength: 5,           // 最小匹配长度
    matchKeywords: true,         // 是否匹配关键词
    ignoreEmoji: true,           // 是否忽略表情
    ignoreCase: true             // 是否忽略大小写
  },
  // 语意识别规则
  semantic: {
    enabled: true,               // 是否启用语意识别
    mode: VERIFY_MODE.RULE_AND_AI,
    minRelevance: 0.5,           // 最低相关性
    minPositivity: 0.3,          // 最低正面性
    minEffectiveness: 0.5        // 最低有效性
  }
};

/**
 * 从数据库获取规则配置
 */
export async function getRuleConfig() {
  try {
    const supabase = (await import('../../utils/supabaseToPrismaAdapter.js')).default;
    
    const { data, error } = await supabase
      .from('ai_configs')
      .select('key, value')
      .like('key', 'verify_rule_%');
    
    if (error || !data) {
      return DEFAULT_RULES;
    }
    
    const config = { ...DEFAULT_RULES };
    
    for (const item of data) {
      const key = item.key.replace('verify_rule_', '');
      try {
        config[key] = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
      } catch (e) {
        config[key] = item.value;
      }
    }
    
    return config;
  } catch (e) {
    return DEFAULT_RULES;
  }
}

/**
 * 计算字符串相似度（Levenshtein距离）
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;
  
  const matrix = [];
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const maxLen = Math.max(len1, len2);
  return (maxLen - matrix[len1][len2]) / maxLen;
}

/**
 * 验证昵称一致性
 */
export function verifyNickname(screenshotNickname, claimNickname, rules = DEFAULT_RULES.nickname) {
  if (!rules.enabled) {
    return { passed: true, reason: '昵称验证已禁用' };
  }
  
  if (!screenshotNickname || !claimNickname) {
    return { passed: false, reason: '昵称信息缺失' };
  }
  
  // 预处理
  const normalize = (str) => {
    let result = str.trim();
    if (rules.ignoreCase) {
      result = result.toLowerCase();
    }
    return result;
  };
  
  const name1 = normalize(screenshotNickname);
  const name2 = normalize(claimNickname);
  
  switch (rules.matchMode) {
    case 'exact':
      // 精确匹配
      if (name1 === name2) {
        return { passed: true, reason: '昵称完全匹配', similarity: 1 };
      }
      return { passed: false, reason: '昵称不匹配', similarity: 0 };
      
    case 'contains':
      // 包含匹配
      if (name1.includes(name2) || name2.includes(name1)) {
        return { passed: true, reason: '昵称包含匹配', similarity: 0.8 };
      }
      // 降级到模糊匹配
      const similarity1 = calculateSimilarity(name1, name2);
      if (similarity1 >= rules.minSimilarity) {
        return { passed: true, reason: '昵称模糊匹配', similarity: similarity1 };
      }
      return { passed: false, reason: '昵称不匹配', similarity: similarity1 };
      
    case 'fuzzy':
      // 模糊匹配
      const similarity2 = calculateSimilarity(name1, name2);
      if (similarity2 >= rules.minSimilarity) {
        return { passed: true, reason: '昵称模糊匹配', similarity: similarity2 };
      }
      return { passed: false, reason: '昵称相似度不足', similarity: similarity2 };
      
    default:
      return { passed: false, reason: '未知匹配模式' };
  }
}

/**
 * 验证评论内容一致性
 */
export function verifyCommentContent(screenshotComment, claimedComment, rules = DEFAULT_RULES.comment) {
  if (!rules.enabled) {
    return { passed: true, reason: '评论验证已禁用' };
  }
  
  if (!screenshotComment || !claimedComment) {
    return { passed: false, reason: '评论信息缺失' };
  }
  
  // 预处理
  let text1 = screenshotComment.trim();
  let text2 = claimedComment.trim();
  
  if (rules.ignoreCase) {
    text1 = text1.toLowerCase();
    text2 = text2.toLowerCase();
  }
  
  if (rules.ignoreEmoji) {
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    text1 = text1.replace(emojiRegex, '');
    text2 = text2.replace(emojiRegex, '');
  }
  
  // 长度检查
  if (text2.length < rules.minMatchLength) {
    return { passed: false, reason: '评论内容过短', minLength: rules.minMatchLength };
  }
  
  // 包含匹配
  if (text1.includes(text2) || text2.includes(text1)) {
    return { passed: true, reason: '评论内容匹配', matchType: 'contains' };
  }
  
  // 相似度匹配
  const similarity = calculateSimilarity(text1, text2);
  if (similarity >= 0.6) {
    return { passed: true, reason: '评论内容相似', matchType: 'similar', similarity };
  }
  
  return { passed: false, reason: '评论内容不匹配', similarity };
}

/**
 * 综合验证
 * @param {Object} params - 验证参数
 * @param {string} params.screenshotNickname - 截图中的评论人昵称
 * @param {string} params.claimNickname - 用户填写的平台昵称
 * @param {string} params.screenshotComment - 截图中的评论内容
 * @param {string} params.claimedComment - 用户填写的评论内容
 * @param {Object} params.taskInfo - 任务信息
 * @returns {Object} 验证结果
 */
export async function comprehensiveVerify(params, externalConfig = null) {
  const {
    screenshotNickname,
    claimNickname,
    screenshotComment,
    claimedComment,
    taskInfo = {}
  } = params;
  
  // 支持外部传入配置，否则从数据库获取
  const config = externalConfig || await getRuleConfig();
  const mode = config.semantic?.mode || VERIFY_MODE.RULE_AND_AI;
  
  logger.info('[RuleVerify] 开始综合验证, 模式:', mode);
  
  const result = {
    passed: false,
    mode,
    nicknameVerify: null,
    commentVerify: null,
    semanticVerify: null,
    rulePassed: false,
    aiPassed: false
  };
  
  // 1. 规则验证
  result.nicknameVerify = verifyNickname(screenshotNickname, claimNickname, config.nickname);
  result.commentVerify = verifyCommentContent(screenshotComment, claimedComment, config.comment);
  result.rulePassed = result.nicknameVerify.passed && result.commentVerify.passed;
  
  logger.info('[RuleVerify] 规则验证:', {
    nickname: result.nicknameVerify.passed,
    comment: result.commentVerify.passed
  });
  
  // 2. AI语意识别（如果启用）
  if (config.semantic?.enabled && mode !== VERIFY_MODE.RULE_ONLY) {
    result.semanticVerify = await analyzeSemantic({
      comment: screenshotComment || claimedComment,
      taskTitle: taskInfo.title,
      taskDescription: taskInfo.description,
      platform: taskInfo.platform
    });
    result.aiPassed = result.semanticVerify.valid;
    
    logger.info('[RuleVerify] AI验证:', result.aiPassed, result.semanticVerify.reason);
  } else {
    result.aiPassed = true; // 未启用AI时默认通过
  }
  
  // 3. 根据模式综合判断
  switch (mode) {
    case VERIFY_MODE.RULE_ONLY:
      result.passed = result.rulePassed;
      result.reason = result.rulePassed ? '规则验证通过' : '规则验证未通过';
      break;
      
    case VERIFY_MODE.AI_ONLY:
      result.passed = result.aiPassed;
      result.reason = result.aiPassed ? 'AI验证通过' : 'AI验证未通过';
      break;
      
    case VERIFY_MODE.RULE_AND_AI:
    default:
      result.passed = result.rulePassed && result.aiPassed;
      if (result.passed) {
        result.reason = '规则和AI验证都通过';
      } else if (!result.rulePassed && !result.aiPassed) {
        result.reason = '规则和AI验证都未通过';
      } else if (!result.rulePassed) {
        result.reason = '规则验证未通过';
      } else {
        result.reason = 'AI验证未通过';
      }
      break;
  }
  
  logger.info('[RuleVerify] 最终结果:', result.passed, result.reason);
  
  return result;
}

export default {
  VERIFY_MODE,
  getRuleConfig,
  verifyNickname,
  verifyCommentContent,
  comprehensiveVerify
};
