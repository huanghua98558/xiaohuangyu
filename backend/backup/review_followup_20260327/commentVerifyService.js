/**
 * 评论内容验证服务
 * 
 * 功能：
 * 1. 字数检查 (≥8字)
 * 2. 正向性检测
 * 3. 无意义评论检测
 * 4. 模板评论检测
 */

// 正向情感词库
const POSITIVE_WORDS = [
  '好', '棒', '赞', '喜欢', '爱', '支持', '优秀', '精彩', '厉害', '牛',
  '不错', '很好', '真棒', '给力', '厉害', '厉害', '好看', '好听', '美',
  '漂亮', '帅', '酷', '暖', '感动', '温馨', '可爱', '有趣', '有意思',
  '太棒了', '太好了', '绝了', '顶', '强', '666', '牛逼', '厉害了',
  '收藏', '关注', '点赞', '推荐', '必看', '精品', '神作'
];

// 负面情感词库
const NEGATIVE_WORDS = [
  '差', '烂', '垃圾', '无聊', '难看', '难听', '讨厌', '恶心', '失望',
  '不行', '不好', '太差', '无聊', '没用', '骗人', '骗子', '坑人',
  '浪费时间', '什么玩意', '垃圾视频', '取关', '不感兴趣', '划走'
];

// 无意义模式
const MEANINGLESS_PATTERNS = [
  /^[\d\s]+$/,  // 纯数字
  /^[.。,，!！?？\s]+$/,  // 纯标点
  /^(哈{1,}|呵{1,}|嘿{1,}|嘻{1,})+$/,  // 纯语气词
  /^(啊{1,}|哦{1,}|嗯{1,}|额{1,})+$/,  // 纯语气词
  /^(好的?|收到|了解|ok|OK)+$/,  // 过于简单
  /^(.)\1{5,}$/,  // 重复字符
];

// 模板评论特征
const TEMPLATE_PATTERNS = [
  /已(点赞|关注|收藏|评论)/,
  /完成(点赞|关注|收藏|评论)/,
  /(点赞|关注|收藏).*完成/,
  /^已+$/,
  /^完成$/,
  /^任务完成$/,
  /^打卡$/,
  /^签到$/,
  /^(点赞|关注|收藏)了$/,
  /^来(了|过)$/,
  /^支持一下$/,
  /^打卡(成功)?$/,
];

/**
 * 验证评论内容
 * @param {string} comment 评论内容
 * @returns {Object} 验证结果
 */
export function verifyComment(comment) {
  const result = {
    valid: true,
    score: 100,
    reasons: [],
    details: {
      length: 0,
      positive: false,
      negative: false,
      meaningless: false,
      template: false,
      sentiment: 'neutral'
    }
  };

  if (!comment || typeof comment !== 'string') {
    result.valid = false;
    result.reasons.push('评论内容为空');
    result.score = 0;
    return result;
  }

  const trimmed = comment.trim();
  result.details.length = trimmed.length;

  // 1. 字数检查 (≥8字)
  if (trimmed.length < 8) {
    result.valid = false;
    result.reasons.push(`字数不足 (当前${trimmed.length}字，需≥8字)`);
    result.score -= 30;
  }

  // 2. 无意义检测
  for (const pattern of MEANINGLESS_PATTERNS) {
    if (pattern.test(trimmed)) {
      result.details.meaningless = true;
      result.valid = false;
      result.reasons.push('评论内容无意义');
      result.score -= 50;
      break;
    }
  }

  // 3. 模板评论检测
  for (const pattern of TEMPLATE_PATTERNS) {
    if (pattern.test(trimmed)) {
      result.details.template = true;
      result.valid = false;
      result.reasons.push('疑似模板评论');
      result.score -= 40;
      break;
    }
  }

  // 4. 正向性检测
  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of POSITIVE_WORDS) {
    if (trimmed.includes(word)) {
      positiveCount++;
    }
  }

  for (const word of NEGATIVE_WORDS) {
    if (trimmed.includes(word)) {
      negativeCount++;
    }
  }

  if (positiveCount > 0) {
    result.details.positive = true;
    result.details.sentiment = 'positive';
    result.score += 10;  // 正向评论加分
  }

  if (negativeCount > positiveCount) {
    result.details.negative = true;
    result.details.sentiment = 'negative';
    result.valid = false;
    result.reasons.push('评论内容偏负面');
    result.score -= 20;
  }

  // 确保分数在 0-100 之间
  result.score = Math.max(0, Math.min(100, result.score));

  return result;
}

/**
 * 批量验证评论
 * @param {string[]} comments 评论数组
 * @returns {Object} 批量验证结果
 */
export function verifyComments(comments) {
  const results = comments.map(c => ({
    comment: c,
    ...verifyComment(c)
  }));

  const validCount = results.filter(r => r.valid).length;
  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;

  return {
    total: comments.length,
    valid: validCount,
    invalid: comments.length - validCount,
    passRate: validCount / comments.length,
    avgScore,
    results
  };
}

/**
 * 比较用户评论与提取的评论
 * @param {string} userComment 用户提交的评论
 * @param {string} extractedComment 从页面提取的评论
 * @returns {Object} 比较结果
 */
export function compareComments(userComment, extractedComment) {
  const result = {
    match: false,
    similarity: 0,
    reason: null
  };

  if (!userComment || !extractedComment) {
    result.reason = '评论内容缺失';
    return result;
  }

  // 预处理：去除表情符号、标点符号、空白
  const normalize = (str) => {
    return str
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
      // 去除抖音表情符号 [xxx]
      .replace(/\[[^\]]+\]/g, '')
      // 去除常见标点
      .replace(/[,，。！？!?.;；:：、]/g, '');
  };

  const userNorm = normalize(userComment);
  const extractedNorm = normalize(extractedComment);

  // 完全匹配
  if (userNorm === extractedNorm) {
    result.match = true;
    result.similarity = 100;
    return result;
  }

  // 包含关系
  if (userNorm.includes(extractedNorm) || extractedNorm.includes(userNorm)) {
    result.match = true;
    result.similarity = 80;
    return result;
  }

  // 计算相似度 (简单的词重叠)
  const userWords = userNorm.split('');
  const extractedWords = extractedNorm.split('');
  
  let matchCount = 0;
  for (const word of userWords) {
    if (extractedWords.includes(word)) {
      matchCount++;
    }
  }

  result.similarity = Math.round((matchCount / Math.max(userWords.length, extractedWords.length)) * 100);

  // 相似度超过 60% 视为匹配
  if (result.similarity >= 60) {
    result.match = true;
    result.reason = `相似度 ${result.similarity}%`;
  } else {
    result.reason = `评论不匹配 (相似度 ${result.similarity}%)`;
  }

  return result;
}

export default {
  verifyComment,
  verifyComments,
  compareComments
};
