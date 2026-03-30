/**
 * 浏览器服务客户端
 * 调用有头浏览器服务 (Python FastAPI)
 * 
 * 支持：
 * - 多实例负载均衡
 * - 自动重试
 * - 健康检查
 */
import logger from '../../utils/logger.js'
import http from 'http'

// 浏览器服务端口列表
const BROWSER_PORTS = [8000, 8001, 8002]

// 轮询索引
let currentIndex = 0

/**
 * 获取下一个浏览器服务 URL（轮询）
 */
function getNextServiceUrl() {
    const port = BROWSER_PORTS[currentIndex]
    currentIndex = (currentIndex + 1) % BROWSER_PORTS.length
    return `http://localhost:${port}`
}

/**
 * 发送 HTTP 请求
 */
function httpRequest(url, options, body) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url)
        
        const req = http.request({
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            timeout: 120000 // 2 分钟超时
        }, (res) => {
            let data = ''
            res.on('data', chunk => data += chunk)
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: JSON.parse(data)
                    })
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        data: data
                    })
                }
            })
        })
        
        req.on('error', reject)
        req.on('timeout', () => {
            req.destroy()
            reject(new Error('请求超时'))
        })
        
        if (body) {
            req.write(JSON.stringify(body))
        }
        req.end()
    })
}

/**
 * 检测平台
 */
function detectPlatform(url) {
    if (url.includes('douyin.com')) return 'douyin'
    if (url.includes('xiaohongshu.com')) return 'xiaohongshu'
    if (url.includes('kuaishou.com')) return 'kuaishou'
    if (url.includes('bilibili.com')) return 'bilibili'
    return null
}

/**
 * 验证评论
 */
export async function verifyComment(videoUrl, comment, userName = null, options = {}) {
    const maxRetries = options.maxRetries || 3
    let lastError = null
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const serviceUrl = getNextServiceUrl()
            logger.info(`[BrowserClient] 尝试 ${attempt + 1}/${maxRetries}: ${serviceUrl}`)
            
            const response = await httpRequest(`${serviceUrl}/browser/visit`, {
                method: 'POST'
            }, {
                url: videoUrl,
                check_comment: true,
                target_comment: comment,
                max_comments: 50
            })
            
            if (response.status !== 200) {
                throw new Error(`服务返回错误: ${response.status}`)
            }
            
            const result = response.data
            
            logger.info(`[BrowserClient] 结果: success=${result.success}, author=${result.author_name}, comments=${result.comments?.length || 0}`)
            
            if (!result.success) {
                throw new Error(result.error || '未知错误')
            }
            
            // 检查是否找到目标评论
            let found = false
            let matchedComment = null
            
            if (result.comments && result.comments.length > 0) {
                // 尝试匹配评论
                const commentLower = comment.toLowerCase()
                const userNameLower = userName?.toLowerCase()
                
                for (const c of result.comments) {
                    const cLower = c.content?.toLowerCase() || ''
                    const nLower = c.nickname?.toLowerCase() || ''
                    
                    // 检查评论内容是否匹配
                    if (cLower.includes(commentLower) || commentLower.includes(cLower)) {
                        found = true
                        matchedComment = c
                        break
                    }
                    
                    // 检查用户名是否匹配
                    if (userNameLower && (nLower.includes(userNameLower) || userNameLower.includes(nLower))) {
                        found = true
                        matchedComment = c
                        break
                    }
                }
            }
            
            return {
                verified: found,
                confidence: found ? 0.9 : 0.1,
                authorName: result.author_name,
                comments: result.comments || [],
                matchedComment,
                proxyUsed: result.proxy_used || null,
                mode: result.mode || 'headed',
                error: found ? null : '未找到匹配的评论'
            }
            
        } catch (error) {
            lastError = error
            logger.error(`[BrowserClient] 尝试 ${attempt + 1} 失败: ${error.message}`)
            
            // 等待后重试
            if (attempt < maxRetries - 1) {
                await new Promise(r => setTimeout(r, 2000))
            }
        }
    }
    
    return {
        verified: false,
        confidence: 0,
        error: lastError?.message || '所有尝试失败',
        shouldRetry: true
    }
}

/**
 * 批量验证
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
        
        if (i + concurrency < items.length) {
            await new Promise(r => setTimeout(r, 2000))
        }
    }
    
    return results
}

/**
 * 健康检查
 */
export async function healthCheck() {
    const results = []
    
    for (const port of BROWSER_PORTS) {
        try {
            const response = await httpRequest(`http://localhost:${port}/health`, {
                method: 'GET'
            })
            results.push({
                port,
                status: response.status === 200 ? 'healthy' : 'unhealthy',
                data: response.data
            })
        } catch (error) {
            results.push({
                port,
                status: 'error',
                error: error.message
            })
        }
    }
    
    const healthyCount = results.filter(r => r.status === 'healthy').length
    
    return {
        status: healthyCount > 0 ? 'healthy' : 'unhealthy',
        services: results,
        healthyCount,
        totalCount: BROWSER_PORTS.length
    }
}

export default {
    verifyComment,
    batchVerifyComments,
    healthCheck,
    detectPlatform
}
