/**
 * 审核5.0 - 评论语义分析（本地免费版）
 * 零成本、毫秒级响应
 * 
 * 检测项：
 * 1. 字数检测（≥8字）
 * 2. 无意义内容检测
 * 3. 模板评论检测（降分不拒绝）
 */

// ==================== 配置常量 ====================

const COMMENT_CONFIG = {
  MIN_LENGTH: 8,           // 最小字数要求
  TEMPLATE_PENALTY: 0.3,   // 模板评论扣分
  MEANINGLESS_PENALTY: 1.0 // 无意义内容扣分（直接拒绝）
}

// 无意义内容模式
const MEANINGLESS_PATTERNS = [
  // 纯格式类
  { pattern: /^\d+$/, reason: '纯数字评论' },
  { pattern: /^[a-zA-Z]{1,3}$/, reason: '过短字母评论' },
  { pattern: /^(.)\1+$/, reason: '重复字符' },
  
  // 无中文类（纯表情、纯符号）
  { pattern: /^[^\u4e00-\u9fa5]+$/, reason: '无中文内容' },
  
  // 敷衍短语类
  { 
    pattern: /^(好的|收到|了解|知道了|好的好的|可以|行|嗯|哦|啊|哈)+$/, 
    reason: '敷衍短语' 
  },
  { 
    pattern: /^[\.。,，!！?？\s]+$/, 
    reason: '纯标点符号' 
  }
]

// 模板评论模式（降分不拒绝）
const TEMPLATE_PATTERNS = [
  // 简短表扬类
  { pattern: /^.{0,5}(不错|很好|可以|喜欢|支持|赞|棒|牛).{0,5}$/, score: 0.6 },
  { pattern: /^(好|不错|可以|还行|挺好)[啊哦呀~！!]+$/, score: 0.6 },
  
  // 通用客套类
  { pattern: /^(谢谢|感谢|多谢)(老师|博主|UP主|作者|楼主)?[！!。]?$/, score: 0.5 },
  { pattern: /^学到了?$/, score: 0.5 },
  { pattern: /^已[关注点赞收藏]$/, score: 0.5 },
  
  // 单句重复类
  { pattern: /^(.{2,6})\1{2,}$/, score: 0.4, reason: '重复内容' },
  
  // 过于简短但有中文
  { pattern: /^[\u4e00-\u9fa5]{1,4}$/, score: 0.5, reason: '评论过短' }
]

// 模板评论关键词组合（检测拼接模板）
const TEMPLATE_KEYWORDS = {
  prefixes: ['真的', '特别', '超级', '非常', '十分'],
  suffixes: ['不错', '好用', '喜欢', '推荐', '给力'],
  // 常见模板句式
  sentences: [
    '已关注',
    '已点赞', 
    '已收藏',
    '三连支持',
    '来晚了',
    '前排围观',
    '沙发'
  ]
}

// ==================== 检测函数 ====================

/**
 * 字数检测
 */
function checkLength(comment) {
  const len = comment.length
  if (len < COMMENT_CONFIG.MIN_LENGTH) {
    return {
      passed: false,
      reason: '评论过短：' + len + '字（要求≥' + COMMENT_CONFIG.MIN_LENGTH + '字）'
    }
  }
  return { passed: true }
}

/**
 * 无意义内容检测
 */
function checkMeaningless(comment) {
  for (const item of MEANINGLESS_PATTERNS) {
    if (item.pattern.test(comment)) {
      return {
        passed: false,
        reason: item.reason
      }
    }
  }
  return { passed: true }
}

/**
 * 模板评论检测
 */
function checkTemplate(comment) {
  let maxScore = 1.0
  let isTemplate = false
  let matchedReason = ''
  
  // 检测模板模式
  for (const item of TEMPLATE_PATTERNS) {
    if (item.pattern.test(comment)) {
      isTemplate = true
      if (item.score < maxScore) {
        maxScore = item.score
        matchedReason = item.reason || '疑似模板评论'
      }
    }
  }
  
  // 检测常见模板句式
  if (TEMPLATE_KEYWORDS.sentences.includes(comment)) {
    isTemplate = true
    maxScore = Math.min(maxScore, 0.6)
    matchedReason = '常见模板评论'
  }
  
  // 检测"程度副词+形容词"模板
  const hasTemplateCombo = TEMPLATE_KEYWORDS.prefixes.some(p => comment.startsWith(p)) &&
                           TEMPLATE_KEYWORDS.suffixes.some(s => comment.includes(s))
  if (hasTemplateCombo && comment.length < 15) {
    isTemplate = true
    maxScore = Math.min(maxScore, 0.7)
    matchedReason = '疑似模板表扬'
  }
  
  return {
    isTemplate,
    score: maxScore,
    reason: matchedReason
  }
}

// ==================== 主函数 ====================

/**
 * 评论语义分析 V5.0（本地免费版）
 * @param {string} comment - 评论内容
 * @param {string} requirements - 任务要求（可选）
 * @param {object} headers - 请求头（可选，保留兼容性）
 * @returns {object} 分析结果
 */
async function analyzeCommentDimensionV5(comment, requirements = '', headers = {}) {
  const startTime = Date.now()
  
  // 审核维度结果常量
  const DIMENSION_RESULTS = {
    APPROVED: 'approved',
    REJECTED: 'rejected',
    MANUAL: 'manual',
    ERROR: 'error'
  }
  
  // 空评论处理
  if (!comment || comment.trim() === '') {
    return {
      dimension: 'commentAnalysis',
      result: DIMENSION_RESULTS.APPROVED,
      confidence: 1.0,
      details: { 
        skipped: true, 
        reason: '无评论内容（允许通过）',
        version: '5.0-local'
      },
      duration: Date.now() - startTime
    }
  }
  
  const trimmedComment = comment.trim()
  const detectedIssues = []
  let finalScore = 1.0
  
  try {
    // ========== 1. 字数检测 ==========
    const lengthResult = checkLength(trimmedComment)
    if (!lengthResult.passed) {
      return {
        dimension: 'commentAnalysis',
        result: DIMENSION_RESULTS.REJECTED,
        confidence: 1.0,
        details: {
          version: '5.0-local',
          length: trimmedComment.length,
          required: COMMENT_CONFIG.MIN_LENGTH,
          issues: [lengthResult.reason],
          suggestion: '评论需要至少' + COMMENT_CONFIG.MIN_LENGTH + '个字'
        },
        duration: Date.now() - startTime
      }
    }
    
    // ========== 2. 无意义内容检测 ==========
    const meaninglessResult = checkMeaningless(trimmedComment)
    if (!meaninglessResult.passed) {
      return {
        dimension: 'commentAnalysis',
        result: DIMENSION_RESULTS.REJECTED,
        confidence: 0.9,
        details: {
          version: '5.0-local',
          length: trimmedComment.length,
          issues: [meaninglessResult.reason],
          suggestion: '请发表有意义的评论内容'
        },
        duration: Date.now() - startTime
      }
    }
    
    // ========== 3. 模板评论检测（降分不拒绝） ==========
    const templateResult = checkTemplate(trimmedComment)
    if (templateResult.isTemplate) {
      finalScore = templateResult.score
      detectedIssues.push(templateResult.reason || '疑似模板评论')
    }
    
    // ========== 4. 计算最终结果 ==========
    const passed = finalScore >= 0.5
    const result = passed ? DIMENSION_RESULTS.APPROVED : DIMENSION_RESULTS.MANUAL
    
    return {
      dimension: 'commentAnalysis',
      result,
      confidence: finalScore,
      details: {
        version: '5.0-local',
        length: trimmedComment.length,
        lengthValid: true,
        isTemplate: templateResult.isTemplate,
        templateScore: templateResult.score,
        issues: detectedIssues,
        suggestion: detectedIssues.length > 0 
          ? '评论略显简单，建议下次更详细一些' 
          : '评论质量合格'
      },
      duration: Date.now() - startTime
    }
    
  } catch (error) {
    console.error('评论语义分析V5失败:', error)
    return {
      dimension: 'commentAnalysis',
      result: DIMENSION_RESULTS.MANUAL,
      confidence: 0.5,
      details: {
        version: '5.0-local',
        error: error.message,
        issues: ['分析异常，转人工审核']
      },
      duration: Date.now() - startTime
    }
  }
}

// ES 模块导出
export {
  analyzeCommentDimensionV5,
  checkLength,
  checkMeaningless,
  checkTemplate,
  COMMENT_CONFIG,
  MEANINGLESS_PATTERNS,
  TEMPLATE_PATTERNS
}
