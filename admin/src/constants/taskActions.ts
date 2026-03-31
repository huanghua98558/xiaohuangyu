/**
 * 任务操作类型常量定义
 * 
 * 当前系统只支持一种操作类型：短视频内容体验调研
 * 用户看到的显示名称：短视频评价官
 * 
 * 内部审核标准：点赞 + 收藏 + 评论
 */

// ==================== 平台定义 ====================

export const PLATFORMS = {
  DOUYIN: '抖音',
  XIAOHONGSHU: '小红书',
  KUAISHOU: '快手',
  SHIPINHAO: '视频号',
} as const

export type Platform = typeof PLATFORMS[keyof typeof PLATFORMS]

export const PLATFORM_NAMES: Record<string, string> = {
  [PLATFORMS.DOUYIN]: '抖音',
  [PLATFORMS.XIAOHONGSHU]: '小红书',
  [PLATFORMS.KUAISHOU]: '快手',
  [PLATFORMS.SHIPINHAO]: '视频号',
}

export function getPlatformName(platform: string): string {
  return PLATFORM_NAMES[platform] || platform
}

export function isValidPlatform(platform: string): boolean {
  return Object.values(PLATFORMS).includes(platform as Platform)
}

export function getPlatformOptions(): { value: string; label: string }[] {
  return Object.entries(PLATFORM_NAMES).map(([value, label]) => ({ value, label }))
}

// ==================== 操作类型定义 ====================

// 唯一支持的操作类型
export const TASK_ACTIONS = {
  SHORT_VIDEO_RESEARCH: 'short_video_research',
} as const

export type TaskAction = typeof TASK_ACTIONS[keyof typeof TASK_ACTIONS]

// 操作类型显示名称
export const TASK_ACTION_NAMES: Record<string, string> = {
  [TASK_ACTIONS.SHORT_VIDEO_RESEARCH]: '短视频评价官',
}

// 操作类型描述
export const TASK_ACTION_DESCRIPTIONS: Record<string, string> = {
  [TASK_ACTIONS.SHORT_VIDEO_RESEARCH]: '观看短视频并提交体验反馈',
}

// 审核检测项配置（内部使用）
export const ACTION_CHECK_ITEMS: Record<string, {
  requiredActions: string[]
  checkItems: string[]
  weights?: Record<string, number>
}> = {
  [TASK_ACTIONS.SHORT_VIDEO_RESEARCH]: {
    requiredActions: ['like', 'collect', 'comment'],
    checkItems: ['like_button', 'collect_button', 'comment_content', 'comment_owner', 'author_match'],
    weights: {
      screenshot: 40,
      linkVerify: 30,
      commentAnalysis: 20,
      userBehavior: 10,
    },
  },
}

export function isValidAction(action: string): boolean {
  return action === TASK_ACTIONS.SHORT_VIDEO_RESEARCH
}

export function getActionName(action: string): string {
  return TASK_ACTION_NAMES[action] || '短视频评价官'
}

export function getActionCheckConfig(action: string) {
  return ACTION_CHECK_ITEMS[TASK_ACTIONS.SHORT_VIDEO_RESEARCH]
}

export function needsCommentCheck(action: string): boolean {
  return true  // 短视频评价官需要评论检测
}

export function getAllActions(): string[] {
  return [TASK_ACTIONS.SHORT_VIDEO_RESEARCH]
}

export function getActionOptions(): { value: string; label: string; description: string }[] {
  return [{
    value: TASK_ACTIONS.SHORT_VIDEO_RESEARCH,
    label: TASK_ACTION_NAMES[TASK_ACTIONS.SHORT_VIDEO_RESEARCH],
    description: TASK_ACTION_DESCRIPTIONS[TASK_ACTIONS.SHORT_VIDEO_RESEARCH],
  }]
}
