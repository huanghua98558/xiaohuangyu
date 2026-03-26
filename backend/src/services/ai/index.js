/**
 * AI服务模块入口 - 升级版
 * 统一导出所有AI相关服务
 * 
 * 数据存储：
 * - 配置和会话存储在Supabase
 * - 双模型架构：发布助手和审核助手独立配置
 * 
 * 2025-03-21: 移除视觉模型(reviewerAssistantService)，改用 imageReviewService (PaddleOCR)
 */

import * as llmService from './llmService.js'
import * as conversationService from './conversationService.js'
import * as operationLogService from './operationLogService.js'
import * as configService from './configService.js'
import * as publisherAssistantService from './publisherAssistantService.js'
import * as imageReviewService from './imageReviewService.js'
import * as browserService from './browserService.js'
import * as reviewEngine from './reviewEngine.js'
import * as reviewCommandService from './reviewCommandService.js'

// 导出各服务
export { 
  llmService, 
  conversationService, 
  operationLogService, 
  configService,
  publisherAssistantService,
  imageReviewService,
  browserService,
  reviewEngine,
  reviewCommandService
}

// 便捷导出 - LLM服务
export const {
  createLLMClient,
  streamLLM,
  invokeLLM,
  analyzeImages,
  streamAnalyzeImages,
  think,
  MODELS
} = llmService

// 便捷导出 - 会话服务
export const {
  createConversation,
  getConversations,
  getConversation,
  addMessage,
  getMessages,
  updateContext,
  archiveConversation,
  deleteConversation
} = conversationService

// 便捷导出 - 日志服务
export const {
  logOperation,
  getOperationLogs,
  getOperationStats,
  withLogging
} = operationLogService

// 便捷导出 - 配置服务
export const {
  initDefaultConfigs,
  getConfig,
  getConfigs,
  setConfig,
  getPublisherConfig,
  getReviewerConfig,
  getUserAssistantConfig,
  getQueueConfig,
  clearCache
} = configService

// 便捷导出 - 发布助手服务
export const {
  chatWithPublisher,
  parseTaskUrl,
  extractTaskParams,
  queryStatistics,
  detectLink
} = publisherAssistantService

// 便捷导出 - 图片审核服务 (PaddleOCR)
export const {
  reviewImage,
  processReviewQueue,
  getQueueLength,
  reviewWithPaddleOCR,
  getReviewQueue,
  getReviewStats,
  manualApprove,
  manualReject
} = imageReviewService

// 便捷导出 - 浏览器自动化服务
export const {
  verifyComment,
  batchVerifyComments,
  closeBrowser,
  healthCheck,
  detectPlatform,
  checkBrowserAvailable
} = browserService

// 便捷导出 - 审核引擎
export const {
  comprehensiveReview,
  batchComprehensiveReview,
  analyzeScreenshotDimension,
  verifyLinkDimension,
  analyzeCommentDimension,
  analyzeUserBehavior,
  DIMENSION_RESULTS
} = reviewEngine

// 便捷导出 - 审核指令服务
export const {
  parseCommand,
  executeCommand,
  formatReviewList,
  COMMAND_TYPES
} = reviewCommandService

// 默认导出
export default {
  llm: llmService,
  conversation: conversationService,
  operationLog: operationLogService,
  config: configService,
  publisherAssistant: publisherAssistantService,
  imageReview: imageReviewService,
  browser: browserService,
  reviewEngine: reviewEngine,
  reviewCommand: reviewCommandService
}
