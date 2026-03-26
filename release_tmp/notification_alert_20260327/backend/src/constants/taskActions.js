/**
 * 任务操作类型常量定义
 * 
 * 当前系统只支持一种操作类型：短视频内容体验调研
 * 
 * 注意：虽然用户看到的是"短视频内容体验调研"，
 * 但实际审核标准要求用户完成：点赞 + 收藏 + 评论
 * 这是内部审核标准，不对用户明文展示
 */

// ==================== 平台定义 ====================

// 平台枚举（统一使用中文名称）
export const PLATFORMS = {
  DOUYIN: '抖音',
  XIAOHONGSHU: '小红书',
  KUAISHOU: '快手',
  SHIPINHAO: '视频号',
}

// 平台显示名称（中文）
export const PLATFORM_NAMES = {
  [PLATFORMS.DOUYIN]: '抖音',
  [PLATFORMS.XIAOHONGSHU]: '小红书',
  [PLATFORMS.KUAISHOU]: '快手',
  [PLATFORMS.SHIPINHAO]: '视频号',
}

// 获取平台显示名称
export function getPlatformName(platform) {
  return PLATFORM_NAMES[platform] || platform
}

// 验证平台是否有效
export function isValidPlatform(platform) {
  return Object.values(PLATFORMS).includes(platform)
}

// 获取所有平台选项（用于前端下拉框）
export function getPlatformOptions() {
  return Object.entries(PLATFORM_NAMES).map(([value, label]) => ({
    value,
    label,
  }))
}

// ==================== 操作类型定义 ====================

// 操作类型枚举
export const TASK_ACTIONS = {
  // 短视频内容体验调研（核心操作类型）
  // 实际要求：点赞 + 收藏 + 评论
  SHORT_VIDEO_RESEARCH: 'short_video_research',
  
  // 以下为保留的操作类型（暂不使用）
  LIKE: 'like',           // 点赞
  COMMENT: 'comment',     // 评论
  COLLECT: 'collect',     // 收藏
  FOLLOW: 'follow',       // 关注
  SHARE: 'share',         // 转发
}

// 操作类型显示名称
export const TASK_ACTION_NAMES = {
  [TASK_ACTIONS.SHORT_VIDEO_RESEARCH]: '短视频内容体验调研',
  [TASK_ACTIONS.LIKE]: '点赞',
  [TASK_ACTIONS.COMMENT]: '评论',
  [TASK_ACTIONS.COLLECT]: '收藏',
  [TASK_ACTIONS.FOLLOW]: '关注',
  [TASK_ACTIONS.SHARE]: '转发',
}

// 操作类型描述
export const TASK_ACTION_DESCRIPTIONS = {
  [TASK_ACTIONS.SHORT_VIDEO_RESEARCH]: '观看短视频并提交体验反馈',
  [TASK_ACTIONS.LIKE]: '点赞视频',
  [TASK_ACTIONS.COMMENT]: '发表评论',
  [TASK_ACTIONS.COLLECT]: '收藏视频',
  [TASK_ACTIONS.FOLLOW]: '关注创作者',
  [TASK_ACTIONS.SHARE]: '转发分享',
}

// 审核检测项配置
// 定义每种操作类型需要检测的内容
export const ACTION_CHECK_ITEMS = {
  [TASK_ACTIONS.SHORT_VIDEO_RESEARCH]: {
    // 短视频内容体验调研需要检测：点赞 + 收藏 + 评论
    requiredActions: ['like', 'collect', 'comment'],
    checkItems: [
      'like_button',      // 点赞按钮状态
      'collect_button',   // 收藏按钮状态
      'comment_content',  // 评论内容
      'comment_owner',    // 评论身份标识
      'author_match',     // 达人名字匹配
    ],
    weights: {
      screenshot: 40,      // 截图分析权重
      linkVerify: 30,      // 达人验证权重
      commentAnalysis: 20, // 评论分析权重
      userBehavior: 10,    // 用户行为权重
    },
  },
  [TASK_ACTIONS.LIKE]: {
    requiredActions: ['like'],
    checkItems: ['like_button', 'author_match'],
  },
  [TASK_ACTIONS.COMMENT]: {
    requiredActions: ['comment'],
    checkItems: ['comment_content', 'comment_owner', 'author_match'],
  },
  [TASK_ACTIONS.COLLECT]: {
    requiredActions: ['collect'],
    checkItems: ['collect_button', 'author_match'],
  },
  [TASK_ACTIONS.FOLLOW]: {
    requiredActions: ['follow'],
    checkItems: ['follow_button', 'author_match'],
  },
  [TASK_ACTIONS.SHARE]: {
    requiredActions: ['share'],
    checkItems: ['share_record', 'author_match'],
  },
}

// 验证操作类型是否有效
export function isValidAction(action) {
  return Object.values(TASK_ACTIONS).includes(action)
}

// 获取操作类型显示名称
export function getActionName(action) {
  return TASK_ACTION_NAMES[action] || action
}

// 获取操作类型检测配置
export function getActionCheckConfig(action) {
  return ACTION_CHECK_ITEMS[action] || ACTION_CHECK_ITEMS[TASK_ACTIONS.SHORT_VIDEO_RESEARCH]
}

// 判断是否需要评论检测
export function needsCommentCheck(action) {
  const config = ACTION_CHECK_ITEMS[action]
  return config?.requiredActions?.includes('comment') || action === TASK_ACTIONS.SHORT_VIDEO_RESEARCH
}

// 获取所有有效操作类型列表
export function getAllActions() {
  return Object.values(TASK_ACTIONS)
}

// 获取操作类型选项（用于前端下拉框）
export function getActionOptions() {
  return Object.entries(TASK_ACTION_NAMES).map(([value, label]) => ({
    value,
    label,
    description: TASK_ACTION_DESCRIPTIONS[value],
  }))
}

// ==================== 审核状态定义（两道关卡审核）====================

// 主状态枚举（claims.status）
export const CLAIM_STATUS = {
  SUBMITTED: 'submitted',           // 已提交 - 刚提交，等待图片审核
  IMAGE_REVIEWING: 'image_reviewing', // 图片审核中
  IMAGE_FAILED: 'image_failed',     // 图片审核失败 - 进入复审流程
  LINK_REVIEWING: 'link_reviewing', // 链接审核中 - 图片审核通过
  PENDING_MANUAL: 'pending_manual', // 待人工审核
  DONE: 'done',                     // 已完成
  REJECTED: 'rejected',             // 已拒绝
  EXPIRED: 'expired',                // 已过期
  ABANDONED: 'abandoned',            // 已放弃
}

// 主状态显示名称
export const CLAIM_STATUS_NAMES = {
  [CLAIM_STATUS.SUBMITTED]: '已提交',
  [CLAIM_STATUS.IMAGE_REVIEWING]: '图片审核中',
  [CLAIM_STATUS.IMAGE_FAILED]: '图片审核失败',
  [CLAIM_STATUS.LINK_REVIEWING]: '链接审核中',
  [CLAIM_STATUS.PENDING_MANUAL]: '待人工审核',
  [CLAIM_STATUS.DONE]: '已完成',
  [CLAIM_STATUS.REJECTED]: '已拒绝',
  [CLAIM_STATUS.EXPIRED]: '已过期',
  [CLAIM_STATUS.ABANDONED]: '已放弃',
}

// 图片审核状态枚举（claims.image_review_status）
export const IMAGE_REVIEW_STATUS = {
  PENDING: 'pending',       // 待审核
  REVIEWING: 'reviewing',   // 审核中
  PASSED: 'passed',         // 审核通过
  FAILED: 'failed',         // 审核失败（待复审）
  SKIPPED: 'skipped',       // 跳过审核
}

// 图片审核状态显示名称
export const IMAGE_REVIEW_STATUS_NAMES = {
  [IMAGE_REVIEW_STATUS.PENDING]: '待审核',
  [IMAGE_REVIEW_STATUS.REVIEWING]: '审核中',
  [IMAGE_REVIEW_STATUS.PASSED]: '审核通过',
  [IMAGE_REVIEW_STATUS.FAILED]: '审核失败',
  [IMAGE_REVIEW_STATUS.SKIPPED]: '跳过审核',
}

// 链接审核状态枚举（claims.link_review_status）
export const LINK_REVIEW_STATUS = {
  PENDING: 'pending',       // 待审核
  REVIEWING: 'reviewing',   // 审核中
  PASSED: 'passed',         // 审核通过
  FAILED: 'failed',         // 审核失败（触发封控检测）
  SKIPPED: 'skipped',       // 跳过审核
}

// 链接审核状态显示名称
export const LINK_REVIEW_STATUS_NAMES = {
  [LINK_REVIEW_STATUS.PENDING]: '待审核',
  [LINK_REVIEW_STATUS.REVIEWING]: '审核中',
  [LINK_REVIEW_STATUS.PASSED]: '审核通过',
  [LINK_REVIEW_STATUS.FAILED]: '审核失败',
  [LINK_REVIEW_STATUS.SKIPPED]: '跳过审核',
}

// 封控状态枚举（claims.block_status）
export const BLOCK_STATUS = {
  NONE: 'none',                   // 正常，无封控
  SUSPECTED: 'suspected',         // 疑似封控
  CONFIRMED: 'confirmed',         // 已确认封控
  FALSE_POSITIVE: 'false_positive', // 误报
}

// 封控状态显示名称
export const BLOCK_STATUS_NAMES = {
  [BLOCK_STATUS.NONE]: '正常',
  [BLOCK_STATUS.SUSPECTED]: '疑似封控',
  [BLOCK_STATUS.CONFIRMED]: '已确认封控',
  [BLOCK_STATUS.FALSE_POSITIVE]: '误报',
}

// 封控状态颜色（用于前端显示）
export const BLOCK_STATUS_COLORS = {
  [BLOCK_STATUS.NONE]: 'green',
  [BLOCK_STATUS.SUSPECTED]: 'orange',
  [BLOCK_STATUS.CONFIRMED]: 'red',
  [BLOCK_STATUS.FALSE_POSITIVE]: 'blue',
}

// ==================== 通知类型定义 ====================

// 管理员通知类型
export const ADMIN_NOTIFICATION_TYPES = {
  BLOCK_DETECTED: 'block_detected',       // 封控账号检测
  MANUAL_REVIEW: 'manual_review',         // 人工审核请求
  SYSTEM_ALERT: 'system_alert',           // 系统告警
}

// 管理员通知类型显示名称
export const ADMIN_NOTIFICATION_TYPE_NAMES = {
  [ADMIN_NOTIFICATION_TYPES.BLOCK_DETECTED]: '封控账号检测',
  [ADMIN_NOTIFICATION_TYPES.MANUAL_REVIEW]: '人工审核请求',
  [ADMIN_NOTIFICATION_TYPES.SYSTEM_ALERT]: '系统告警',
}

// 用户通知类型
export const USER_NOTIFICATION_TYPES = {
  CLAIM_APPROVED: 'claim_approved',       // 任务通过
  LEVEL_UP: 'level_up',           // 等级提升
  CLAIM_REJECTED: 'claim_rejected',       // 任务拒绝
  LEVEL_DOWN: 'level_down',         // 等级降低
  BLOCK_DETECTED: 'block_detected',       // 账号封控
  REVIEW_FAILED: 'review_failed',         // 审核失败
}

// 用户通知类型显示名称
export const USER_NOTIFICATION_TYPE_NAMES = {
  [USER_NOTIFICATION_TYPES.CLAIM_APPROVED]: '任务通过',
  [USER_NOTIFICATION_TYPES.LEVEL_UP]: '等级提升',
  [USER_NOTIFICATION_TYPES.CLAIM_REJECTED]: '任务拒绝',
  [USER_NOTIFICATION_TYPES.LEVEL_DOWN]: '等级降低',
  [USER_NOTIFICATION_TYPES.BLOCK_DETECTED]: '账号封控',
  [USER_NOTIFICATION_TYPES.REVIEW_FAILED]: '审核失败',
}

// ==================== 审核流程常量 ====================

// 审核引擎类型
export const REVIEW_ENGINES = {
  PADDLEOCR: 'paddleocr',   // PaddleOCR（本地，优先）
  GEMINI: 'gemini',         // Gemini（技术降级）
  BAILIAN: 'bailian',       // 百炼（兜底）
  MANUAL: 'manual',         // 人工审核
}

// 审核引擎显示名称
export const REVIEW_ENGINE_NAMES = {
  [REVIEW_ENGINES.PADDLEOCR]: 'PaddleOCR',
  [REVIEW_ENGINES.GEMINI]: 'Gemini',
  [REVIEW_ENGINES.BAILIAN]: '百炼',
  [REVIEW_ENGINES.MANUAL]: '人工审核',
}

// 审核降级顺序
export const REVIEW_FALLBACK_ORDER = [
  REVIEW_ENGINES.PADDLEOCR,  // 第一道：PaddleOCR
  REVIEW_ENGINES.GEMINI,     // 第二道：Gemini（技术失败时）
  REVIEW_ENGINES.BAILIAN,    // 第三道：百炼（兜底）
  REVIEW_ENGINES.MANUAL,     // 最后：人工审核
]

// 审核复审顺序（PaddleOCR拒绝时）
export const REVIEW_APPEAL_ORDER = [
  REVIEW_ENGINES.GEMINI,     // 第一道复审：Gemini
  REVIEW_ENGINES.BAILIAN,    // 第二道复审：百炼
  REVIEW_ENGINES.MANUAL,     // 最后：人工审核
]

// ==================== 辅助函数 ====================

// 获取主状态显示名称
export function getClaimStatusName(status) {
  return CLAIM_STATUS_NAMES[status] || status
}

// 获取图片审核状态显示名称
export function getImageReviewStatusName(status) {
  return IMAGE_REVIEW_STATUS_NAMES[status] || status
}

// 获取链接审核状态显示名称
export function getLinkReviewStatusName(status) {
  return LINK_REVIEW_STATUS_NAMES[status] || status
}

// 获取封控状态显示名称
export function getBlockStatusName(status) {
  return BLOCK_STATUS_NAMES[status] || status
}

// 判断是否需要图片审核
export function needsImageReview(status) {
  return [
    CLAIM_STATUS.SUBMITTED,
    CLAIM_STATUS.IMAGE_REVIEWING,
  ].includes(status)
}

// 判断是否需要链接审核
export function needsLinkReview(status) {
  return [
    CLAIM_STATUS.LINK_REVIEWING,
  ].includes(status)
}

// 判断是否为封控状态
export function isBlockedStatus(blockStatus) {
  return [
    BLOCK_STATUS.SUSPECTED,
    BLOCK_STATUS.CONFIRMED,
  ].includes(blockStatus)
}

// 获取状态选项列表（用于前端）
export function getClaimStatusOptions() {
  return Object.entries(CLAIM_STATUS_NAMES).map(([value, label]) => ({
    value,
    label,
  }))
}

export function getBlockStatusOptions() {
  return Object.entries(BLOCK_STATUS_NAMES).map(([value, label]) => ({
    value,
    label,
    color: BLOCK_STATUS_COLORS[value],
  }))
}
