/**
 * AI发布助手服务
 * 处理用户与发布助手的交互，包括链接解析、任务发布、查询统计等
 */

import prisma from "../../utils/prisma.js"
import logger from "../../utils/logger.js"
import { TASK_ACTIONS, TASK_ACTION_NAMES, PLATFORMS, PLATFORM_NAMES, getPlatformName } from "../../constants/taskActions.js"
import { getConfig, getPublisherConfig } from "./configService.js"
import { logOperation } from "./operationLogService.js"
import { streamLLM } from "./llmService.js"

// 平台映射
const PLATFORM_MAP = {
  douyin: "抖音",
  xiaohongshu: "小红书",
  kuaishou: "快手",
  shipinhao: "视频号",
  bilibili: "B站"
}

const DEFAULT_TASK_CONFIG = {
  baseReward: 3,           // 默认积分
  timeLimitMinutes: 10,    // 默认时间限制
  dailyLimit: 0,           // 不限每日
  remain: 10,              // 默认剩余数量
  action: TASK_ACTIONS.SHORT_VIDEO_RESEARCH,  // 默认操作类型
  description: "AI自动发布任务"
}

// 操作类型映射
const ACTION_MAP = {
  "短视频内容体验调研": TASK_ACTIONS.SHORT_VIDEO_RESEARCH,
  "短视频调研": TASK_ACTIONS.SHORT_VIDEO_RESEARCH,
  "短视频": TASK_ACTIONS.SHORT_VIDEO_RESEARCH,
  "评论": TASK_ACTIONS.COMMENT,
  "点赞": TASK_ACTIONS.LIKE,
  "收藏": TASK_ACTIONS.COLLECT,
  "转发": TASK_ACTIONS.SHARE,
  "关注": TASK_ACTIONS.FOLLOW
}

// 反向映射（英文到中文）
const ACTION_REVERSE_MAP = {
  "comment": TASK_ACTIONS.COMMENT,
  "like": TASK_ACTIONS.LIKE,
  "collect": TASK_ACTIONS.COLLECT,
  "share": TASK_ACTIONS.SHARE,
  "follow": TASK_ACTIONS.FOLLOW,
  "short_video_research": TASK_ACTIONS.SHORT_VIDEO_RESEARCH
}

/**
 * 检测字符串中是否包含链接
 */
export function detectLink(text) {
  // 抖音链接
  const douyinMatch = text.match(/(https?:\/\/v\.douyin\.com\/[a-zA-Z0-9_-]+\/?)/i)
  if (douyinMatch) {
    return { type: "douyin", url: douyinMatch[1] }
  }
  
  // 小红书链接
  const xhsMatch = text.match(/(https?:\/\/(?:xhslink\.com|www\.xiaohongshu\.com)\/[a-zA-Z0-9_\\/]+)/i)
  if (xhsMatch) {
    return { type: "xiaohongshu", url: xhsMatch[1] }
  }
  
  // 快手链接
  const ksMatch = text.match(/(https?:\/\/v\.kuaishou\.com\/[a-zA-Z0-9_-]+)/i)
  if (ksMatch) {
    return { type: "kuaishou", url: ksMatch[1] }
  }
  
  // B站链接
  const biliMatch = text.match(/(https?:\/\/(?:www\.)?bilibili\.com\/[a-zA-Z0-9_\\/]+)/i)
  if (biliMatch) {
    return { type: "bilibili", url: biliMatch[1] }
  }
  
  return null
}



/**
 * 从抖音链接文本中提取信息
 */
function extractDouyinInfo(text) {
  const result = {
    author: null,
    title: null,
    videoId: null,
    cleanUrl: null
  }
  
  // 提取视频ID
  const videoIdMatch = text.match(/v\.douyin\.com\/([a-zA-Z0-9_\-]+)/)
  if (videoIdMatch) {
    result.videoId = videoIdMatch[1]
    result.cleanUrl = "https://v.douyin.com/" + videoIdMatch[1] + "/"
  }
  
  // 提取作者：【作者名】或【作者名的作品】格式
  const authorMatch = text.match(/【(.+?)】/)
  if (authorMatch) {
    let authorName = authorMatch[1].replace(/的作品$/, "").trim()
    result.author = authorName
    
    // 提取视频标题：在】后面、链接前面的内容
    const afterBracket = text.substring(text.indexOf("】") + 1)
    const linkIndex = afterBracket.indexOf("https://v.douyin")
    if (linkIndex > 0) {
      let videoTitle = afterBracket.substring(0, linkIndex).trim()
      videoTitle = videoTitle.replace(/^\d+\.?\d*\s*/, "")
      videoTitle = videoTitle.replace(/复制打开抖音.*/g, "")
      videoTitle = videoTitle.replace(/看看.*/g, "")
      videoTitle = videoTitle.trim()
      if (videoTitle && videoTitle.length > 0) {
        result.title = videoTitle
      }
    }
    return result
  }
  
  // 新格式：链接前面的文字就是作者
  const beforeUrlMatch = text.match(/([^\n]+?)\s+https:\/\/v\.douyin\.com/)
  if (beforeUrlMatch) {
    let authorText = beforeUrlMatch[1].trim()
    authorText = authorText.replace(/#\S+/g, "").trim()
    authorText = authorText.replace(/[\u{1F300}-\u{1F9FF}]/gu, "").trim()
    if (authorText && authorText.length > 0) {
      result.author = authorText.substring(0, 20)
    }
  }
  
  return result
}

/**
 * 从小红书链接文本中提取信息
 */
function extractXiaohongshuInfo(text) {
  const result = {
    title: null,
    cleanUrl: null
  }
  
  const titleMatch = text.match(/^(.+?)(?:\s*http)/)
  if (titleMatch) {
    result.title = titleMatch[1].trim()
  }
  
  const urlMatch = text.match(/xhslink\.com\/([a-zA-Z0-9_\-]+)/)
  if (urlMatch) {
    result.cleanUrl = "https://xhslink.com/" + urlMatch[1]
  }
  
  return result
}

/**
 * 从快手链接文本中提取信息
 */
function extractKuaishouInfo(text) {
  const result = {
    title: null,
    cleanUrl: null
  }
  
  const titleMatch = text.match(/^(.+?)(?:\s*http)/)
  if (titleMatch) {
    result.title = titleMatch[1].trim()
  }
  
  const urlMatch = text.match(/v\.kuaishou\.com\/([a-zA-Z0-9_\-]+)/)
  if (urlMatch) {
    result.cleanUrl = "https://v.kuaishou.com/" + urlMatch[1]
  }
  
  return result
}

/**
 * 智能提取任务标题
 */
export function extractTaskTitle(rawText, linkInfo) {
  const platformName = PLATFORM_MAP[linkInfo.type] || linkInfo.type

  switch (linkInfo.type) {
    case "douyin": {
      const info = extractDouyinInfo(rawText)
      if (info.author && info.title) {
        return info.author + " - " + info.title
      }
      if (info.author) {
        return info.author
      }
      const authorMatch = rawText.match(/【(.+?)】/)
      if (authorMatch) {
        return authorMatch[1]
      }
      return platformName + "达人"
    }

    case "xiaohongshu": {
      const info = extractXiaohongshuInfo(rawText)
      if (info.title) {
        return info.title
      }
      return platformName + "达人"
    }

    case "kuaishou": {
      const info = extractKuaishouInfo(rawText)
      if (info.title) {
        return info.title
      }
      return platformName + "达人"
    }

    default:
      return platformName + "达人"
  }
}

/**
 * 生成任务说明
 */
export function generateTaskDescription() {
  return "本任务属于短视频内容体验调研任务。请按照任务步骤打开指定的视频链接，完整观看视频内容，并根据您的真实观看体验填写评价信息。"
}

/**
 * 生成操作步骤
 */
export function generateTaskSteps() {
  return [
    { step: 1, title: "复制链接", description: "点击一键复制链接按钮" },
    { step: 2, title: "打开APP", description: "在抖音/快手/小红书等APP中打开" },
    { step: 3, title: "观看视频", description: "认真观看视频内容" },
    { step: 4, title: "提交截图", description: "截取包含您评价的截图并提交" },
    { step: 5, title: "等待审核", description: "审核通过后积分自动发放" }
  ]
}

/**
 * 解析用户输入中的任务参数
 */
export function extractTaskParams(text) {
  const params = {}
  
  const rewardMatch = text.match(/(\d+)\s*[积分分]/)
  if (rewardMatch) {
    params.reward = parseInt(rewardMatch[1])
  }
  
  const timeMatch = text.match(/(\d+)\s*[分钟]/)
  if (timeMatch) {
    params.timeLimit = parseInt(timeMatch[1])
  }
  
  const hourMatch = text.match(/(\d+)\s*小时/)
  if (hourMatch) {
    params.timeLimit = parseInt(hourMatch[1]) * 60
  }
  
  const countMatch = text.match(/(\d+)\s*[个名额]/)
  if (countMatch) {
    params.remain = parseInt(countMatch[1])
  }
  
  for (const [key, action] of Object.entries(ACTION_MAP)) {
    if (text.includes(key)) {
      params.action = action
      break
    }
  }
  
  return params
}

/**
 * 生成任务编号
 */
async function generateTaskCode() {
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "")
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const count = await prisma.tasks.count({
    where: { created_at: { gte: today } }
  })
  
  const seq = String((count || 0) + 1).padStart(4, "0")
  return "T" + dateStr + seq
}

/**
 * 执行发布任务指令
 */
async function executePublishCommand(userId, linkInfo, rawInput, user) {
  const pubConfig = await getPublisherConfig()
  const extraParams = extractTaskParams(rawInput)
  const title = extractTaskTitle(rawInput, linkInfo)
  const taskCode = await generateTaskCode()
  
  const isAdmin = user?.role === "admin"
  const status = "active"
  const remain = extraParams.remain || DEFAULT_TASK_CONFIG.remain
  
  let task
  try {
    task = await prisma.tasks.create({
      data: {
        title,
        task_code: taskCode,
        platform: PLATFORM_MAP[linkInfo.type] || linkInfo.type,
        action: extraParams.action || DEFAULT_TASK_CONFIG.action,
        video_url: rawInput,
        description: generateTaskDescription(),
        template_images: "[]",
        example_images: "[]",
        requirements: JSON.stringify(generateTaskSteps()),
        reward: extraParams.reward || DEFAULT_TASK_CONFIG.baseReward,
        base_reward: extraParams.reward || DEFAULT_TASK_CONFIG.baseReward,
        remain: remain,
        need_count: remain,
        time_limit_minutes: extraParams.timeLimit || DEFAULT_TASK_CONFIG.timeLimitMinutes,
        city_limit: 1,
        province_limit: 4,
        status,
        publisher_id: Number(String(userId).slice(-9)),
        publisher_type: isAdmin ? "official" : "third_party",
        updated_at: new Date()
      }
    })
  } catch (err) {
    logger.error("创建任务失败:", err)
    return { success: false, message: "任务发布失败: " + err.message }
  }
  
  logger.info("AI发布任务: " + task.task_code + " - " + task.title + ", 发布者: " + userId)
  
  return {
    success: true,
    taskId: task.id,
    taskCode: task.task_code,
    task: {
      id: task.id.toString(),
      title: task.title,
      taskCode: task.task_code,
      platform: task.platform,
      action: task.action,
      reward: task.reward,
      status: task.status,
      videoUrl: task.video_url
    },
    message: "任务发布成功！\n- 任务编号: " + task.task_code + "\n- 标题: " + task.title + "\n- 平台: " + task.platform + "\n- 操作: " + task.action + "\n- 奖励: " + task.reward + "积分\n- 名额: " + remain + "个\n- 状态: 已上线"
  }
}

/**
 * 执行查询命令
 */
async function executeQueryCommand(userId, queryType, options = {}, user) {
  const result = { success: true, type: queryType }
  
  switch (queryType) {
    case "query_my_tasks":
      const myTasks = await prisma.tasks.findMany({
        where: { publisher_id: Number(String(userId).slice(-9)) },
        select: {
          id: true,
          title: true,
          task_code: true,
          platform: true,
          status: true,
          reward: true,
          remain: true,
          created_at: true
        },
        orderBy: { created_at: "desc" },
        take: 20
      })
      
      const formattedMyTasks = myTasks.map(t => ({
        ...t,
        id: t.id.toString()
      }))
      
      const myStatsData = await prisma.tasks.findMany({
        where: { publisher_id: Number(String(userId).slice(-9)) },
        select: { id: true, reward: true }
      })
      
      const myStats = {
        total: myStatsData?.length || 0,
        totalReward: myStatsData?.reduce((sum, t) => sum + (t.reward || 0), 0) || 0
      }
      
      result.data = { tasks: formattedMyTasks || [], stats: myStats }
      result.message = "您发布的任务统计：\n- 总任务数: " + myStats.total + "\n- 总奖励积分: " + myStats.totalReward
      break
      
    case "query_pending_tasks":
    case "query_pending":
      // 查询待审核的任务（通过 claims 表）
      const pendingClaims = await prisma.claims.findMany({
        where: { 
          status: "pending"
        },
        select: {
          id: true,
          title: true,
          platform: true,
          status: true,
          reward: true,
          claimed_at: true,
          submitted_at: true,
          user_id: true,
          task_id: true
        },
        orderBy: { submitted_at: "desc" },
        take: 20
      })
      
      // 获取用户名
      const pendingUserIds = [...new Set(pendingClaims.map(c => c.user_id))]
      const pendingUsers = await prisma.users.findMany({
        where: { id: { in: pendingUserIds } },
        select: { id: true, username: true }
      })
      const pendingUserMap = Object.fromEntries(pendingUsers.map(u => [u.id, u.username]))
      
      const formattedPending = pendingClaims.map(c => ({
        id: c.id.toString(),
        title: c.title,
        platform: c.platform,
        reward: c.reward,
        username: pendingUserMap[c.user_id] || "未知用户",
        submitted_at: c.submitted_at
      }))
      
      result.data = { claims: formattedPending, total: pendingClaims.length }
      result.message = "📋 待审核任务列表：\n" + 
        (formattedPending.length > 0 
          ? formattedPending.slice(0, 5).map((c, i) => 
              `${i + 1}. ${c.title?.substring(0, 20) || "无标题"}... (${c.platform || "未知平台"}) - ${c.reward}积分 - ${c.username}`
            ).join("\n")
          : "暂无待审核任务") +
        (formattedPending.length > 5 ? `\n... 还有 ${formattedPending.length - 5} 个待审核任务` : "")
      break
      
    case "query_all_tasks":
      if (user?.role !== "admin") {
        return { success: false, message: "权限不足，仅管理员可查询所有任务" }
      }
      
      const allTasks = await prisma.tasks.findMany({
        select: {
          id: true,
          title: true,
          task_code: true,
          platform: true,
          status: true,
          reward: true,
          remain: true,
          publisher_id: true,
          created_at: true
        },
        orderBy: { created_at: "desc" },
        take: 50
      })
      
      result.data = { tasks: allTasks.map(t => ({ ...t, id: t.id.toString() })) }
      result.message = "共查询到 " + allTasks.length + " 个任务"
      break
  }
  
  return result
}

/**
 * 检测命令类型
 */
function detectCommand(text) {
  const lowerText = text.toLowerCase()
  
  // 查询类命令
  if (lowerText.includes("查询") || lowerText.includes("统计") || lowerText.includes("我的任务")) {
    if (lowerText.includes("所有") || lowerText.includes("全部")) {
      return { type: "query_all", action: "query_all_tasks" }
    }
    // 待审核任务查询
    if (lowerText.includes("待审核") || lowerText.includes("审核中") || lowerText.includes("pending")) {
      return { type: "query_pending", action: "query_pending_tasks" }
    }
    return { type: "query_my", action: "query_my_tasks" }
  }
  
  if (lowerText.includes("提醒") || lowerText.includes("通知")) {
    const userMatch = text.match(/(?:提醒|通知)[：:]*\s*(\S+)/)
    return { type: "notify", action: "send_notification", targetUser: userMatch?.[1] }
  }
  
  return null
}

/**
 * 与发布助手交互
 */
export async function* chatWithPublisher(userId, message, conversationId, user, headers) {
  try {
    // 1. 检测链接
    const linkInfo = detectLink(message)
    
    if (linkInfo) {
      const result = await executePublishCommand(userId, linkInfo, message, user)
      yield result.message
      return
    }
    
    // 2. 检测命令
    const command = detectCommand(message)
    if (command) {
      let result
      
      switch (command.type) {
        case "query_my":
        case "query_all":
        case "query_user":
        case "query_pending":
          result = await executeQueryCommand(userId, command.action, command, user)
          break
        default:
          result = { success: false, message: "未知命令" }
      }
      
      yield result.message
      return
    }
    
    // 3. 普通对话模式
    const pubConfig = await getPublisherConfig()
    
    let convId = conversationId
    if (!convId) {
      // 创建新会话（简化处理）
      convId = "conv_" + Date.now()
    }
    
    let fullResponse = ""
    for await (const chunk of streamLLM(
      [{ role: "user", content: message }],
      { model: pubConfig.model || "doubao-seed-1-8-251228" },
      headers
    )) {
      fullResponse += chunk
      yield chunk
    }
    
    await logOperation({
      userId,
      type: "publisher",
      action: "chat",
      input: { inputLength: message.length },
      output: { outputLength: fullResponse.length },
      status: "success"
    }).catch(e => logger.error("记录日志失败:", e))
    
  } catch (error) {
    logger.error("发布助手交互失败:", error)
    yield "处理失败: " + error.message
  }
}

/**
 * 查询统计
 */
export async function queryStatistics(userId, type, user) {
  return executeQueryCommand(userId, type, {}, user)
}

/**
 * 解析任务URL
 */
export async function parseTaskUrl(url, headers = {}) {
  const linkInfo = detectLink(url)
  if (!linkInfo) {
    return null
  }
  
  const title = extractTaskTitle(url, linkInfo)
  const platform = PLATFORM_MAP[linkInfo.type] || linkInfo.type
  
  return {
    platform,
    originalText: url,
    title,
    url: linkInfo.url
  }
}

export default {
  detectLink,
  extractTaskTitle,
  extractTaskParams,
  parseTaskUrl,
  chatWithPublisher,
  queryStatistics
}
