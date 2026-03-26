/**
 * 审核助手服务 - Supabase版
 * 
 * 核心逻辑：
 * 1. 用户提交任务 → 加入审核队列
 * 2. AI初审 → 分析截图、验证操作
 * 3. 置信度≥0.85 → 自动通过/拒绝
 * 4. 置信度<0.85 → 转人工审核
 * 
 * 数据存储：所有业务数据存储在Supabase
 * 
 * 支持的操作：
 * - 批量审核
 * - 单个审核
 * - 人工复核
 * - 与AI对话审核
 */
import { streamLLM, invokeLLM } from './llmService.js'
import { analyzeScreenshotsWithOCR } from './paddleOcrClient.js'
import { createConversation, addMessage, getMessages, getConversationHistory } from './conversationService.js'
import { getConfig, getReviewerConfig } from './configService.js'
import { logOperation } from './operationLogService.js'
import { TASK_ACTIONS, TASK_ACTION_NAMES, PLATFORMS, PLATFORM_NAMES, needsCommentCheck, getActionCheckConfig, getPlatformName } from '../../constants/taskActions.js'
import supabase from '../../utils/supabaseToPrismaAdapter.js'
import logger from '../../utils/logger.js'
import taskService from '../taskService.js'
import { enqueueLinkVerification } from './linkVerificationService.js'

/**
 * 添加任务到审核队列
 * @param {number} claimId - 领取记录ID
 * @param {Object} options - 选项
 */
export async function addToReviewQueue(claimId, options = {}) {
  // 获取领取记录
  const { data: claim, error: claimError } = await supabase
    .from('claims')
    .select('*, tasks!inner(*)')
    .eq('id', claimId)
    .single()
  
  if (claimError || !claim) {
    throw new Error('领取记录不存在')
  }
  
  // 检查是否已在队列中
  const { data: existing } = await supabase
    .from('ai_review_queue')
    .select('id')
    .eq('claim_id', claimId)
    .maybeSingle()
  
  if (existing) {
    return existing
  }
  
  // 添加到队列
  const { data: queueItem, error } = await supabase
    .from('ai_review_queue')
    .insert({
      claim_id: claimId,
      user_id: claim.user_id,
      task_id: claim.task_id,
      screenshots: claim.screenshots || '[]',
      status: 'pending',
      priority: options.priority || 0
    })
    .select()
    .single()
  
  if (error) {
    logger.error('添加审核队列失败:', error)
    throw error
  }
  
  // 更新Claim的AI审核状态
  await supabase
    .from('claims')
    .update({ ai_review_status: 'pending' })
    .eq('id', claimId)
  
  return queueItem
}

/**
 * 从任务标题中提取达人名字
 * @param {string} title - 任务标题，格式如 "Kim 根鸠-3月16日"
 * @returns {string} 达人名字
 */
function extractAuthorFromTitle(title) {
  if (!title) return ''
  // 格式: "达人名字-日期" 或 "达人名字 - 日期" 或 "达人名字-3月16日"
  // 匹配 "-" 后面跟数字的情况（日期格式）
  const match = title.match(/^(.+?)[-–—]\s*\d/)
  if (match) {
    return match[1].trim()
  }
  // 尝试匹配 "-" 后面跟中文日期的情况
  const chineseDateMatch = title.match(/^(.+?)[-–—]\s*[\d一二三四五六七八九十月日]+/)
  if (chineseDateMatch) {
    return chineseDateMatch[1].trim()
  }
  // 如果没有日期，返回整个标题
  return title.trim()
}

/**
 * 根据平台获取审核提示词
 * @param {string} platform - 平台：douyin, xiaohongshu, kuaishou
 * @param {string} action - 操作类型
 * @param {string} actionDesc - 操作描述
 * @param {string} taskAuthor - 达人名字
 * @param {string} taskTitle - 任务标题
 * @returns {string} 提示词
 */
function getPlatformPrompt(platform, action, actionDesc, taskAuthor, taskTitle) {
  // 通用返回格式说明
  const returnFormat = `## 返回格式（严格按JSON格式）

\`\`\`json
{
  "passed": true或false,
  "confidence": 0.0到1.0之间的数值,
  "authorMatch": {
    "taskAuthor": "任务中的达人名字",
    "screenshotAuthor": "截图中看到的达人名字",
    "matched": true或false
  },
  "comment": {
    "content": "截图中识别到的评论内容",
    "length": 评论字数,
    "lengthValid": true或false,
    "isPositive": true或false,
    "isOwner": true或false,
    "ownerIndicator": "身份标识描述"
  },
  "foundActions": ["检测到的操作"],
  "missingActions": ["缺失的操作"],
  "details": "详细的审核说明",
  "rejectionReason": "如果拒绝，填写具体的拒绝理由"
}
\`\`\``

  // 短视频内容体验调研任务 - 核心审核提示词
  if (action === 'short_video_research') {
    // 根据平台获取不同的UI特征描述
    const platformUIFeatures = {
      'douyin': `
### 四、抖音UI特征验证
1. 点赞按钮：右侧爱心图标，已点赞为红色/粉色填充
2. 收藏按钮：右侧星星图标，已收藏为黄色填充
3. 评论区域：右侧评论气泡图标，点击后显示评论列表
4. 评论身份标识：自己的评论右下角有灰色"我"字标签
5. 截图底部应显示抖音导航栏`,
      'xiaohongshu': `
### 四、小红书UI特征验证
1. 点赞按钮：左侧爱心图标，已点赞为红色填充
2. 收藏按钮：星星图标，已收藏为黄色填充
3. 评论入口：底部显示评论气泡图标和数量
4. 评论身份标识：评论头像右下角有蓝色"我"字小标签
5. 截图应包含小红书特色：顶部搜索栏、笔记图片区域、底部互动栏`,
      'kuaishou': `
### 四、快手UI特征验证
1. 点赞按钮：右侧双击屏幕或点击爱心图标，已点赞为红色
2. 收藏按钮：右侧星星/收藏图标，已收藏为黄色
3. 评论区域：右侧评论图标，显示评论列表
4. 评论身份标识：自己的评论会显示"我"标签
5. 截图应包含快手特色：双列瀑布流、右侧功能栏、底部创作者信息`
    }

    return `你是一个专业的短视频内容体验调研审核助手，需要严格按照以下标准审核用户提交的截图。

## 审核任务信息
- 平台：${platform === 'douyin' ? '抖音' : platform === 'xiaohongshu' ? '小红书' : platform === 'kuaishou' ? '快手' : platform}
- 任务类型：短视频内容体验调研
- 任务标题：${taskTitle || '未知'}
- 视频达人名字：${taskAuthor || '未知'}

## 审核标准（必须全部满足才能通过）

### 一、达人名字一致性验证（必须项）
1. 检查截图中的视频达人名字是否与任务标题中的达人名字一致
2. 任务标题格式通常为 "{达人名字}{日期}"，如"贝加尔0316"
3. 判定标准：达人名字必须一致，允许日期差异
4. 注意：截图中达人名字通常在视频标题上方或头像旁

### 二、评论用户身份验证（必须项）
1. 检查评论是否为本人发送，需要有身份标识
2. 抖音：评论右下角有灰色"我"字标签
3. 小红书：评论头像右下角有蓝色"我"字小标签
4. 快手：自己的评论会显示"我"标签
5. 无身份标识 → 直接拒绝，拒绝理由：非本人评论截图

### 三、评论内容验证（必须项）
1. 评论字数要求：
   - 不少于8个字才能通过
   - 少于8字 → 拒绝，理由："评论字数不足8字"

2. 评论内容方向要求：
   - 必须是正向、真实、与视频内容相关的评论
   - 正向评论特征：
     * 真实分享：看过、学到了、不错
     * 互动提问：怎么做到的、在哪里
     * 情感共鸣：太真实了、有同感
   - 拒绝情况：
     * 纯表情或"1"、"好"等无意义内容
     * 与视频无关的内容
     * 负面或攻击性言论
${platformUIFeatures[platform] || platformUIFeatures['douyin']}

### 五、操作完成验证（核心检测项）
必须检测以下三个操作是否全部完成：
1. ✅ 点赞：点赞图标是否为已点赞状态（红色/粉色填充）
2. ✅ 收藏：收藏图标是否为已收藏状态（黄色填充）
3. ✅ 评论：是否有本人发布的合规评论

### 六、综合判定标准
- 通过条件：达人名字匹配 + 本人评论 + 评论合格 + 点赞+收藏+评论全部完成
- 拒绝条件：任一必须项不满足
- 置信度计算：
  * 所有检测项通过 → confidence >= 0.9
  * 部分检测项通过 → confidence = 0.6-0.8
  * 大部分检测项未通过 → confidence < 0.6

${returnFormat}

请仔细分析以下截图，严格按照上述标准进行审核：`
  }

  // 抖音审核提示词
  if (platform === 'douyin') {
    return `你是一个专业的抖音任务审核助手，需要严格按照以下标准审核用户提交的截图。

## 审核任务信息
- 平台：抖音
- 任务类型：${actionDesc}
- 任务标题：${taskTitle || '未知'}
- 视频达人名字：${taskAuthor || '未知'}

## 审核标准（必须全部满足才能通过）

### 一、达人名字一致性验证（必须项）
1. 检查截图中的视频达人名字是否与任务标题中的达人名字一致
2. 任务标题格式通常为 "{达人名字}-{日期}"
3. 判定标准：必须完全一致，任何差异都不通过

### 二、评论用户身份验证（必须项）
1. 检查评论用户名后面是否有灰色的"我"字标识
2. 有"我"字标识 → 确认为本人评论截图
3. 无"我"字标识 → 直接拒绝，拒绝理由：非本人评论或本人评论没有截图处理，请重新截图

### 三、评论内容验证（必须项）
1. 评论字数要求：
   - 不少于8个字才能通过
   - 少于8字 → 拒绝，理由："评论字数不足8字"

2. 评论内容方向要求：
   - 必须是正向推广该视频的评论
   - 正向评论特征：赞美类、推荐类、互动类
   - 拒绝情况：无意义评论、负面评论、与视频无关的内容

### 四、抖音UI特征验证
1. 点赞按钮：应为红色/粉色填充状态
2. 关注按钮：已关注状态显示"已关注"
3. 评论区域：显示评论列表，底部有评论输入框
4. 截图底部应显示抖音导航栏（首页、朋友、发布、消息、我）

${returnFormat}

请仔细分析以下截图，严格按照上述标准进行审核：`
  }

  // 小红书审核提示词
  if (platform === 'xiaohongshu') {
    return `你是一个专业的小红书任务审核助手，需要严格按照以下标准审核用户提交的截图。

## 审核任务信息
- 平台：小红书
- 任务类型：${actionDesc}
- 任务标题：${taskTitle || '未知'}
- 博主名字：${taskAuthor || '未知'}

## 审核标准（必须全部满足才能通过）

### 一、博主名字一致性验证（必须项）
1. 检查截图中的博主名字是否与任务标题中的博主名字一致
2. 小红书博主名字通常在笔记标题上方或头像旁边
3. 判定标准：必须完全一致，任何差异都不通过

### 二、评论用户身份验证（必须项）
1. 小红书评论身份标识：评论头像右下角有蓝色"我"字小标签
2. 或者评论区域显示"我发表的评论"
3. 无身份标识 → 直接拒绝，拒绝理由：非本人评论截图

### 三、评论内容验证（必须项）
1. 评论字数要求：
   - 不少于8个字才能通过
   - 小红书用户偏好真实、走心的评论

2. 评论内容方向要求：
   - 必须是真实的互动评论，与笔记内容相关
   - 正向评论特征：
     * 真实分享：用过、买了、效果不错
     * 互动提问：怎么买的、求链接、多少钱
     * 情感共鸣：太真实了、学到了、收藏了
   - 拒绝情况：
     * 纯表情或"1"、"好"等无意义内容
     * 与笔记无关的广告评论
     * 负面或攻击性言论

### 四、小红书UI特征验证
1. 点赞按钮：左侧爱心图标，已点赞为红色填充
2. 收藏按钮：星星图标，已收藏为黄色填充
3. 评论入口：底部显示评论气泡图标和数量
4. 关注按钮：已关注显示灰色"已关注"
5. 截图应包含小红书特色：
   - 顶部搜索栏
   - 笔记图片/视频区域
   - 底部互动栏（点赞、收藏、评论、分享）

### 五、笔记内容相关性（重要）
1. 评论内容需与笔记主题相关
2. 如果是种草笔记，评论应体现对产品的兴趣或使用体验
3. 如果是教程笔记，评论可以是学习反馈或提问

${returnFormat}

请仔细分析以下截图，严格按照上述标准进行审核：`
  }

  // 快手审核提示词
  if (platform === 'kuaishou') {
    return `你是一个专业的快手任务审核助手，需要严格按照以下标准审核用户提交的截图。

## 审核任务信息
- 平台：快手
- 任务类型：${actionDesc}
- 任务标题：${taskTitle || '未知'}
- 视频达人名字：${taskAuthor || '未知'}

## 审核标准（必须全部满足才能通过）

### 一、达人名字一致性验证（必须项）
1. 检查截图中的视频达人名字是否与任务标题中的达人名字一致
2. 快手达人名字显示在视频标题上方或头像旁
3. 判定标准：必须完全一致，任何差异都不通过

### 二、评论用户身份验证（必须项）
1. 快手评论身份标识：评论列表中自己的评论会显示"我"标签
2. 或评论右下角有特殊标识
3. 无身份标识 → 直接拒绝，拒绝理由：非本人评论截图

### 三、评论内容验证（必须项）
1. 评论字数要求：
   - 不少于8个字才能通过
   - 快手用户偏好接地气、真实的评论风格

2. 评论内容方向要求：
   - 必须是真实的互动评论
   - 正向评论特征：
     * 支持类：支持、加油、老铁给力、666
     * 互动类：问一下、在哪里、多少钱
     * 真实分享：真实、靠谱、已关注
   - 拒绝情况：
     * 纯数字或"1"、"好"等敷衍内容
     * 与视频无关的内容
     * 广告或刷屏内容

### 四、快手UI特征验证
1. 点赞按钮：左侧红心图标，已点赞为红色填充
2. 关注按钮：已关注显示"已关注"（灰色或绿色）
3. 评论区域：底部显示评论图标和数量
4. 快手特色元素：
   - 右侧功能栏（点赞、评论、分享、收藏）
   - 底部显示创作者信息和关注按钮
   - 视频标题区域

### 五、视频内容相关性（重要）
1. 评论内容需与视频主题相关
2. 快手社区偏向真实、接地气的内容
3. 评论风格应与快手社区文化相符

${returnFormat}

请仔细分析以下截图，严格按照上述标准进行审核：`
  }

  // 默认提示词（未知平台）
  return `你是一个专业的任务审核助手，需要严格按照以下标准审核用户提交的截图。

## 审核任务信息
- 平台：${platform}
- 任务类型：${actionDesc}
- 任务标题：${taskTitle || '未知'}
- 达人名字：${taskAuthor || '未知'}

## 审核标准

### 一、达人名字一致性验证
检查截图中的达人名字是否与任务标题中的达人名字一致。

### 二、评论用户身份验证
检查评论是否为本人发送，需要有身份标识。

### 三、评论内容验证
1. 评论字数不少于8字
2. 评论内容需正向、真实、相关

### 四、操作完成验证
检查任务要求的操作是否完成（点赞、关注、收藏、评论等）。

${returnFormat}

请仔细分析以下截图进行审核：`
}

/**
 * 分析截图内容
 * @param {string[]} screenshots - 截图URL数组
 * @param {string} action - 任务操作类型
 * @param {Object} headers - 请求头
 * @param {Object} context - 审核上下文（任务标题、达人名字、平台等）
 * @returns {Object} 分析结果
 */
export async function analyzeScreenshots(screenshots, action, headers = {}, context = {}) {
  // 获取审核助手配置
  const reviewerConfig = await getReviewerConfig()
  
  // 提取达人名字
  const taskAuthor = context.taskAuthor || extractAuthorFromTitle(context.taskTitle || '')
  
  // 获取平台（默认抖音）
  const platform = context.platform || 'douyin'
  
  // 使用统一常量获取操作类型显示名称
  const actionDesc = TASK_ACTION_NAMES[action] || action

  try {
    // 使用 PaddleOCR 分析截图（已删除视觉模型）
    const ocrResult = await analyzeScreenshotsWithOCR(screenshots, actionDesc)
    
    if (!ocrResult.success) {
      return {
        passed: false,
        confidence: 0,
        details: ocrResult.error || 'OCR分析失败',
        error: ocrResult.error
      }
    }
    
    // 适配返回格式
    const result = {
      passed: ocrResult.passed,
      confidence: ocrResult.confidence,
      details: ocrResult.details,
      provider: 'paddleocr'
    }
    
    // 根据审核结果调整置信度
    if (result.passed) {
      result.confidence = Math.min(result.confidence, 1.0)
    } else {
      result.confidence = Math.max(result.confidence, 0.8)
    }
    
    return result
  } catch (error) {
    logger.error('截图分析失败:', error)
    return {
      passed: false,
      confidence: 0,
      error: error.message
    }
  }
}
