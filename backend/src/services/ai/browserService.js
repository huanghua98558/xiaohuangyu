/**
 * 浏览器自动化服务
 * 用于验证用户评论是否真实存在于视频页面
 * 
 * 支持平台：
 * - 抖音 (douyin)
 * - 小红书 (xiaohongshu)
 * - 快手 (kuaishou)
 * - B站 (bilibili)
 * 
 * V7.0 更新：
 * - 支持代理IP池
 * - IP失效自动检测
 * - IP健康度追踪
 */
import { chromium } from 'playwright'
import logger from '../../utils/logger.js'
import supabase from '../../utils/supabaseToPrismaAdapter.js'
import proxyPoolService from './proxyPoolService.js'

// 浏览器实例管理
let browserInstance = null
let browserLock = false
let browserAvailable = null // null=未检测, true=可用, false=不可用

// 平台配置
const PLATFORM_CONFIG = {
  douyin: {
    name: '抖音',
    selectors: {
      // 评论区域选择器
      commentSection: '[class*="CommentList"]',
      commentItem: '[class*="CommentItem"]',
      commentText: '[class*="CommentText"]',
      userName: '[class*="UserName"]',
      // 等待元素
      loadIndicator: '[class*="loading"]',
    },
    urlPatterns: {
      short: /v\.douyin\.com\/[\w-]+/,
      long: /www\.douyin\.com\/video\/(\d+)/,
      live: /live\.douyin\.com\/(\d+)/
    },
    // 是否需要登录才能查看评论
    requiresAuth: false,
    // 反爬策略：等待时间
    waitStrategy: {
      beforeAction: [1000, 3000], // 随机等待1-3秒
      scrollDelay: [500, 1000],
      maxRetries: 3
    }
  },
  xiaohongshu: {
    name: '小红书',
    selectors: {
      commentSection: '.comments-container, [class*="comment"]',
      commentItem: '.comment-item, [class*="CommentItem"]',
      commentText: '.comment-text, [class*="content"]',
      userName: '.user-name, [class*="name"]'
    },
    urlPatterns: {
      short: /xhslink\.com\/[\w-]+/,
      explore: /www\.xiaohongshu\.com\/explore\/([\w-]+)/,
      discovery: /www\.xiaohongshu\.com\/discovery\/item\/([\w-]+)/
    },
    requiresAuth: true, // 小红书需要登录
    waitStrategy: {
      beforeAction: [2000, 4000],
      scrollDelay: [800, 1500],
      maxRetries: 3
    }
  },
  kuaishou: {
    name: '快手',
    selectors: {
      commentSection: '.comment-list, [class*="comment"]',
      commentItem: '.comment-item, [class*="CommentItem"]',
      commentText: '.comment-content, [class*="content"]',
      userName: '.user-name, [class*="name"]'
    },
    urlPatterns: {
      short: /v\.kuaishou\.com\/[\w-]+/,
      long: /www\.kuaishou\.com\/short-video\/([\w-]+)/
    },
    requiresAuth: false,
    waitStrategy: {
      beforeAction: [1500, 3000],
      scrollDelay: [600, 1200],
      maxRetries: 3
    }
  },
  bilibili: {
    name: 'B站',
    selectors: {
      commentSection: '.comment-container, #comment',
      commentItem: '.comment-item, .reply-item',
      commentText: '.comment-text, .reply-content',
      userName: '.comment-user, .user-name'
    },
    urlPatterns: {
      video: /www\.bilibili\.com\/video\/(BV[\w-]+)/,
      short: /b23\.tv\/[\w-]+/
    },
    requiresAuth: false,
    waitStrategy: {
      beforeAction: [1000, 2000],
      scrollDelay: [500, 1000],
      maxRetries: 3
    }
  }
}

/**
 * 检测浏览器是否可用
 */
async function checkBrowserAvailable() {
  if (browserAvailable !== null) {
    return browserAvailable
  }
  
  try {
    // 尝试启动浏览器
    const testBrowser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    await testBrowser.close()
    browserAvailable = true
    logger.info('浏览器自动化功能可用')
    return true
  } catch (error) {
    browserAvailable = false
    logger.warn('浏览器自动化功能不可用:', error.message)
    logger.info('提示: 运行 "npx playwright install chromium" 安装浏览器')
    return false
  }
}

/**
 * 获取或创建浏览器实例
 */
async function getBrowser() {
  // 检查浏览器是否可用
  if (!await checkBrowserAvailable()) {
    throw new Error('浏览器自动化功能不可用。请运行 "npx playwright install chromium" 安装浏览器，或将此功能部署到支持 Playwright 的环境。')
  }
  
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance
  }
  
  if (browserLock) {
    // 等待其他操作完成
    await new Promise(r => setTimeout(r, 1000))
    return getBrowser()
  }
  
  browserLock = true
  
  try {
    browserInstance = await chromium.launch({
      headless: true, // 无头模式
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    })
    
    logger.info('浏览器实例已创建')
    return browserInstance
  } catch (error) {
    logger.error('创建浏览器实例失败:', error)
    throw error
  } finally {
    browserLock = false
  }
}

/**
 * 随机等待
 */
function randomWait(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min
  return new Promise(r => setTimeout(r, ms))
}

/**
 * 检测URL所属平台
 */
export function detectPlatform(url) {
  for (const [platform, config] of Object.entries(PLATFORM_CONFIG)) {
    for (const pattern of Object.values(config.urlPatterns)) {
      if (pattern.test(url)) {
        return platform
      }
    }
  }
  return null
}

/**
 * 解析短链接获取真实URL
 */
async function resolveShortUrl(page, url) {
  try {
    const platform = detectPlatform(url)
    
    // 如果不是短链接，直接返回
    if (!platform || !url.includes('v.douyin') && !url.includes('xhslink') && !url.includes('b23.tv')) {
      return url
    }
    
    // 导航并获取最终 URL
    const response = await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000  // 增加到 60 秒，适配代理 IP 延迟
    })
    
    await randomWait(1000, 2000)
    
    return page.url()
  } catch (error) {
    logger.error('解析短链接失败:', error)
    return url
  }
}

/**
 * 验证抖音评论
 */

async function verifyDouyinComment(page, videoUrl, targetComment, userName, options = {}) {
  try {
    // 初始化达人名匹配结果
    let authorMatch = null
    const taskAuthorName = options.taskAuthorName
    // 从URL提取视频ID
    const videoIdMatch = videoUrl.match(/video\/(\d+)/)
    if (!videoIdMatch) {
      return {
        verified: false,
        error: '无法从URL提取视频ID',
        confidence: 0
      }
    }
    const videoId = videoIdMatch[1]
    
    logger.info(`[抖音评论] 视频ID: ${videoId}, 目标评论: ${targetComment.substring(0, 30)}...`)
    
    // 访问页面获取 cookie
    await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(2000)
    
    // 检查验证码
    const hasCaptcha = await page.locator('#captcha_container').count() > 0
    if (hasCaptcha) {
      logger.warn('[抖音评论] 触发验证码')
      return {
        verified: false,
        error: '触发验证码，需要更换IP',
        confidence: 0,
        shouldRetry: true
      }
    }
    
    // 提取页面达人名
    const pageAuthorName = await extractPageAuthorName(page, 'douyin').catch(() => null);
    if (pageAuthorName) {
      logger.info(`[抖音评论] 页面达人名: ${pageAuthorName}`);
    }

    // 使用API获取评论
    const comments = []
    let cursor = 0
    let hasMore = true
    const maxComments = 100
    
    while (hasMore && cursor < maxComments) {
      const apiUrl = `https://www.douyin.com/aweme/v1/web/comment/list/?device_platform=webapp&aid=6383&channel=channel_pc_web&aweme_id=${videoId}&cursor=${cursor}&count=20`
      
      const result = await page.evaluate(async (url) => {
        try {
          const response = await fetch(url, { credentials: 'include' })
          return await response.json()
        } catch (e) {
          return { error: e.message }
        }
      }, apiUrl)
      
      if (result.comments && result.comments.length > 0) {
        for (const c of result.comments) {
          comments.push({
            text: c.text || '',
            name: c.user?.nickname || '',
            likes: c.digg_count || 0,
            time: c.create_time ? new Date(c.create_time * 1000).toISOString() : null
          })
          
          // 检查是否匹配目标评论
          const textMatch = c.text && (c.text.includes(targetComment) || targetComment.includes(c.text))
          const nameMatch = !userName || (c.user?.nickname && (c.user.nickname.includes(userName) || userName.includes(c.user.nickname)))
          
          if (textMatch && nameMatch) {
            logger.info(`[抖音评论] 找到匹配评论: ${c.text.substring(0, 50)}...`)
            // 更新达人名匹配结果
            if (taskAuthorName && pageAuthorName) {
              const matched = taskAuthorName === pageAuthorName || 
                             pageAuthorName.includes(taskAuthorName) || 
                             taskAuthorName.includes(pageAuthorName)
              authorMatch = { matched, taskAuthorName, pageAuthorName }
              logger.info(`[抖音评论] 达人名匹配: 任务=${taskAuthorName}, 页面=${pageAuthorName}, 结果=${matched}`)
            }

            return {
              pageAuthorName,
              authorMatch,
              verified: true,
              matchType: 'exact',
              foundComment: { text: c.text, name: c.user?.nickname },
              confidence: 1.0,
              searchedComments: comments.length
            }
          }
        }
        
        cursor += result.comments.length
        hasMore = result.has_more
      } else {
        hasMore = false
      }
    }
    
    // 检查相似评论
    const similarComment = comments.find(c => {
      const similarity = calculateSimilarity(c.text, targetComment)
      return similarity > 0.8
    })
    
    if (similarComment) {
      logger.info(`[抖音评论] 找到相似评论`)
      return {
              pageAuthorName,
              authorMatch,
              verified: true,
              matchType: 'similar',
              foundComment: similarComment,
        targetComment,
        confidence: 0.85,
        searchedComments: comments.length
      }
    }
    
    // 未找到匹配评论
    logger.info(`[抖音评论] 未找到匹配，已搜索${comments.length}条评论`)
    return {
              pageAuthorName,
              authorMatch,
              verified: false,
              matchType: 'not_found',
              searchedComments: comments.length,
      targetComment,
      confidence: 0,
      message: `已搜索${comments.length}条评论，未找到匹配内容`
    }
    
  } catch (error) {
    logger.error('验证抖音评论失败:', error)
    return {
      verified: false,
      error: error.message,
      confidence: 0
    }
  }
}

/**
 * 验证小红书评论
 */
async function verifyXiaohongshuComment(page, videoUrl, targetComment, userName) {
  const config = PLATFORM_CONFIG.xiaohongshu
  
  try {
    await page.goto(videoUrl, { waitUntil: 'networkidle', timeout: 60000 })
    await randomWait(...config.waitStrategy.beforeAction)
    
    // 小红书可能需要点击展开评论
    const expandBtn = await page.$('[class*="comment"], .expand-btn')
    if (expandBtn) {
      await expandBtn.click()
      await randomWait(1000, 2000)
    }
    
    // 获取评论
    const comments = []
    const items = await page.$$(config.selectors.commentItem)
    
    for (const item of items) {
      try {
        const text = await item.$eval(config.selectors.commentText, el => el.textContent?.trim()).catch(() => '')
        const name = await item.$eval(config.selectors.userName, el => el.textContent?.trim()).catch(() => '')
        
        if (text) {
          comments.push({ text, name })
          
          const textMatch = text.includes(targetComment) || targetComment.includes(text)
          const nameMatch = !userName || name.includes(userName)
          
          if (textMatch && nameMatch) {
            return {
              pageAuthorName,
              authorMatch,
              verified: true,
              matchType: 'exact',
              foundComment: { text, name },
              confidence: 1.0
            }
          }
        }
      } catch (e) {}
    }
    
    return {
              pageAuthorName,
              authorMatch,
              verified: false,
              matchType: 'not_found',
              searchedComments: comments.length,
      targetComment,
      confidence: 0
    }
    
  } catch (error) {
    logger.error('验证小红书评论失败:', error)
    return {
      verified: false,
      error: error.message,
      confidence: 0
    }
  }
}

/**
 * 验证快手评论
 */
async function verifyKuaishouComment(page, videoUrl, targetComment, userName) {
  const config = PLATFORM_CONFIG.kuaishou
  
  try {
    await page.goto(videoUrl, { waitUntil: 'networkidle', timeout: 60000 })
    await randomWait(...config.waitStrategy.beforeAction)
    
    const comments = []
    const items = await page.$$(config.selectors.commentItem)
    
    for (const item of items) {
      try {
        const text = await item.$eval(config.selectors.commentText, el => el.textContent?.trim()).catch(() => '')
        const name = await item.$eval(config.selectors.userName, el => el.textContent?.trim()).catch(() => '')
        
        if (text) {
          comments.push({ text, name })
          
          if (text.includes(targetComment) || targetComment.includes(text)) {
            return {
              pageAuthorName,
              authorMatch,
              verified: true,
              matchType: 'exact',
              foundComment: { text, name },
              confidence: 1.0
            }
          }
        }
      } catch (e) {}
    }
    
    return {
              pageAuthorName,
              authorMatch,
              verified: false,
              matchType: 'not_found',
              searchedComments: comments.length,
      confidence: 0
    }
    
  } catch (error) {
    logger.error('验证快手评论失败:', error)
    return {
      verified: false,
      error: error.message,
      confidence: 0
    }
  }
}

/**
 * 计算文本相似度
 */
function calculateSimilarity(text1, text2) {
  if (!text1 || !text2) return 0
  
  const s1 = text1.toLowerCase()
  const s2 = text2.toLowerCase()
  
  // 完全匹配
  if (s1 === s2) return 1
  
  // 包含关系
  if (s1.includes(s2) || s2.includes(s1)) {
    const longer = s1.length > s2.length ? s1 : s2
    const shorter = s1.length > s2.length ? s2 : s1
    return shorter.length / longer.length
  }
  
  // Levenshtein距离
  const matrix = Array(s1.length + 1).fill(null).map(() => Array(s2.length + 1).fill(null))
  
  for (let i = 0; i <= s1.length; i++) matrix[i][0] = i
  for (let j = 0; j <= s2.length; j++) matrix[0][j] = j
  
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  
  const distance = matrix[s1.length][s2.length]
  const maxLen = Math.max(s1.length, s2.length)
  
  return maxLen === 0 ? 1 : 1 - distance / maxLen
}

/**
 * 主入口：验证用户评论
 * @param {string} videoUrl - 视频链接
 * @param {string} targetComment - 目标评论内容
 * @param {string} userName - 用户昵称（可选）
 * @param {Object} options - 选项
 * @returns {Object} 验证结果
 */
export async function verifyComment(videoUrl, targetComment, userName = '', options = {}) {
  // 检查浏览器是否可用
  if (!await checkBrowserAvailable()) {
    return {
      verified: false,
      error: '浏览器自动化功能不可用',
      fallback: true,
      message: '请运行 "npx playwright install chromium" 安装浏览器，或将此功能部署到支持 Playwright 的环境',
      confidence: 0
    }
  }
  
  // 获取代理IP（如果启用）
  let proxyIP = null
  let proxyAddress = null
  
  if (process.env.PROXY_ENABLED === 'true') {
    proxyIP = await proxyPoolService.getAvailableIP()
    if (proxyIP) {
      proxyAddress = proxyIP.ip_address
      logger.info(`使用代理IP: ${proxyAddress}`)
    } else {
      logger.warn('无可用代理IP，使用直连模式')
    }
  }
  
  // 构建浏览器上下文配置
  const contextOptions = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'zh-CN'
  }
  
  // 添加代理配置
  if (proxyAddress) {
    const [ip, port] = proxyAddress.split(':')
    contextOptions.proxy = {
      server: `http://${ip}:${port}`
    }
  }
  
  const browser = await getBrowser()
  const context = await browser.newContext(contextOptions)
  const page = await context.newPage()
  
  // IP失效标记
  let ipFailed = false
  let ipFailReason = ''
  
  try {
    // 解析短链接
    const resolvedUrl = await resolveShortUrl(page, videoUrl)
    logger.info(`链接解析: ${videoUrl} -> ${resolvedUrl}`)
    
    // 检测平台
    const platform = detectPlatform(resolvedUrl)
    
    if (!platform) {
      return {
        verified: false,
        error: '不支持的平台',
        platform: 'unknown',
        confidence: 0
      }
    }
    
    // 根据平台调用验证函数
    let result
    
    switch (platform) {
      case 'douyin':
        result = await verifyDouyinComment(page, resolvedUrl, targetComment, userName, options)
        break
      case 'xiaohongshu':
        result = await verifyXiaohongshuComment(page, resolvedUrl, targetComment, userName, options)
        break
      case 'kuaishou':
        result = await verifyKuaishouComment(page, resolvedUrl, targetComment, userName, options)
        break
      default:
        result = {
          verified: false,
          error: '平台验证方法未实现',
          confidence: 0
        }
    }
    
    // 检测IP是否失效（通过页面内容）
    if (proxyAddress && page) {
      const ipCheck = await proxyPoolService.detectIPFailure(null, null, page)
      if (ipCheck.failed) {
        ipFailed = true
        ipFailReason = ipCheck.reason
      }
    }
    
    // 记录IP使用结果
    if (proxyAddress) {
      await proxyPoolService.recordIPResult(proxyAddress, !ipFailed, ipFailReason)
    }
    
    return {
      ...result,
      platform,
      resolvedUrl,
      originalUrl: videoUrl,
      verifiedAt: new Date().toISOString(),
      proxyUsed: proxyAddress || null,
      ipFailed
    }
    
  } catch (error) {
    logger.error('评论验证失败:', error)
    
    // 检测IP是否失效（通过错误）
    if (proxyAddress) {
      const ipCheck = await proxyPoolService.detectIPFailure(error, null, null)
      ipFailed = ipCheck.failed
      ipFailReason = ipCheck.reason || error.message
      
      await proxyPoolService.recordIPResult(proxyAddress, false, ipFailReason)
    }
    
    return {
      verified: false,
      error: error.message,
      confidence: 0,
      proxyUsed: proxyAddress || null,
      ipFailed,
      shouldRetry: ipFailed // IP失效时允许重试
    }
  } finally {
    await page.close()
    await context.close()
  }
}

/**
 * 批量验证评论
 */
export async function batchVerifyComments(items, options = {}) {
  const results = []
  const concurrency = options.concurrency || 2
  
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map(item => verifyComment(item.videoUrl, item.comment, item.userName, options))
    )
    results.push(...batchResults)
    
    // 批次间延迟
    if (i + concurrency < items.length) {
      await randomWait(2000, 5000)
    }
  }
  
  return results
}

/**
 * 关闭浏览器实例
 */
export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close()
    browserInstance = null
    logger.info('浏览器实例已关闭')
  }
}

/**
 * 健康检查
 */
export async function healthCheck() {
  const available = await checkBrowserAvailable()
  
  if (!available) {
    return {
      status: 'unavailable',
      browserConnected: false,
      message: '浏览器未安装。请运行 "npx playwright install chromium"',
      hint: '此功能为可选功能，不影响核心业务运行'
    }
  }
  
  try {
    const browser = await getBrowser()
    const page = await browser.newPage()
    await page.goto('about:blank')
    await page.close()
    
    return {
      status: 'healthy',
      browserConnected: browser.isConnected()
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    }
  }
}


/**
 * 从页面提取达人名
 */
export async function extractPageAuthorName(page, platform) {
  try {
    if (platform === 'douyin') {
      const metaAuthor = await page.$eval('meta[property="og:title"]', el => el.content).catch(() => null);
      if (metaAuthor) {
        const parts = metaAuthor.split(' - ');
        if (parts.length >= 2) {
          return parts[parts.length - 2].replace('@', '').trim();
        }
      }
      const authorEl = await page.$('[class*="author"], [class*="AuthorName"]');
      if (authorEl) {
        const text = await authorEl.textContent();
        const match = text.match(/@?([\u4e00-\u9fa5\w]+)/);
        if (match) return match[1];
      }
      return null;
    }
    if (platform === 'xiaohongshu' || platform === 'kuaishou') {
      const authorEl = await page.$('[class*="author"], [class*="userName"]');
      if (authorEl) {
        return (await authorEl.textContent()).trim();
      }
      return null;
    }
    return null;
  } catch (error) {
    return null;
  }
}

export default {
  verifyComment,
  batchVerifyComments,
  closeBrowser,
  healthCheck,
  detectPlatform,
  checkBrowserAvailable,
  PLATFORM_CONFIG
}
