/**
 * AI LLM 服务 - 修复版（添加 HTTP 连接池）
 * 修复内容：
 * 1. 添加全局 HTTP/HTTPS Agent
 * 2. 配置连接池参数
 * 3. 所有 fetch 请求使用 Agent
 */
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk'
import { getConfig } from './configService.js'
import logger from '../../utils/logger.js'
import sharp from 'sharp'
import https from 'https'
import http from 'http'

// ============ P0 修复：HTTP 连接池 ============
// 创建全局 HTTP Agent（连接池）
const httpAgent = new http.Agent({
  keepAlive: true,           // 保持连接活跃
  maxSockets: 50,            // 最大并发连接数
  maxFreeSockets: 10,        // 最大空闲连接数
  timeout: 60000,            // 连接超时 (60 秒)
  scheduling: 'lifo'         // 后进先出调度
})

const httpsAgent = new https.Agent({
  keepAlive: true,           // 保持连接活跃
  maxSockets: 50,            // 最大并发连接数
  maxFreeSockets: 10,        // 最大空闲连接数
  timeout: 60000,            // 连接超时 (60 秒)
  scheduling: 'lifo',        // 后进先出调度
  rejectUnauthorized: true  // 生产环境启用 SSL 验证
})
// ===========================================

// 默认配置（SDK 内置）
const DEFAULT_MODEL = 'doubao-seed-1-8-251228'
const VISION_MODEL = 'doubao-seed-1-6-vision-250815'
const THINKING_MODEL = 'doubao-seed-1-6-thinking-250715'

/**
 * 下载图片（使用连接池）
 */
async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const agent = url.startsWith('https') ? httpsAgent : httpAgent
    const timeout = setTimeout(() => reject(new Error('下载超时')), 30000)
    
    const client = url.startsWith('https') ? https : http
    client.get(url, { agent, timeout: 30000 }, (res) => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        clearTimeout(timeout)
        resolve(Buffer.concat(chunks))
      })
      res.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })
    }).on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

/**
 * 下载并压缩图片
 */
async function downloadAndCompressImage(url) {
  try {
    // 检查是否已经是 base64 格式
    if (url.startsWith('data:image')) {
      return url
    }
    
    // 下载图片
    logger.debug('下载图片:', url)
    const imageBuffer = await downloadImage(url)
    const originalSize = imageBuffer.length
    
    // 如果图片小于 50KB，直接转 base64
    if (originalSize < 50 * 1024) {
      const base64 = imageBuffer.toString('base64')
      const ext = url.split('.').pop()?.toLowerCase() || 'png'
      return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${base64}`
    }
    
    // 压缩图片
    logger.debug(`压缩图片：${(originalSize / 1024).toFixed(2)}KB`)
    const compressedBuffer = await sharp(imageBuffer)
      .resize(1024, 1024, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .jpeg({ 
        quality: 70,
        progressive: true
      })
      .toBuffer()
    
    const compressedSize = compressedBuffer.length
    logger.debug(`压缩完成：${(compressedSize / 1024).toFixed(2)}KB (${((1 - compressedSize / originalSize) * 100).toFixed(1)}% 压缩率)`)
    
    // 转为 base64
    const base64 = compressedBuffer.toString('base64')
    return `data:image/jpeg;base64,${base64}`
    
  } catch (error) {
    logger.error('处理图片失败:', error.message)
    // 返回原始 URL 作为兜底
    return url
  }
}

/**
 * 获取指定类型的 API 配置
 */
async function getCustomAPIConfig(type) {
  try {
    const provider = await getConfig(`${type}_api_provider`, '')
    const apiBaseUrl = await getConfig(`${type}_api_base_url`, '')
    const apiKey = await getConfig(`${type}_api_key`, '')
    const model = await getConfig(`${type}_model`, '')
    
    // 如果没有配置 API Key，返回 null 使用 SDK 默认
    if (!apiKey || !provider) {
      return null
    }
    
    return {
      model: model || 'Qwen/Qwen2-VL-72B-Instruct',
      provider,
      apiBaseUrl,
      apiKey,
      model
    }
  } catch (error) {
    logger.error('获取 API 配置失败:', error)
    return null
  }
}

/**
 * 创建 LLM 客户端
 */
export function createLLMClient(headers = {}, customConfig = null) {
  const config = new Config()
  const customHeaders = HeaderUtils.extractForwardHeaders(headers)
  
  // 如果有自定义配置，返回配置信息
  if (customConfig) {
    return {
      model: customConfig.model || 'Qwen/Qwen2-VL-72B-Instruct',
      isCustom: true,
      config: customConfig,
      headers: customHeaders
    }
  }
  
  return new LLMClient(config, customHeaders)
}

/**
 * 使用自定义 API 调用 LLM（流式）- 使用连接池
 */
async function* streamWithCustomAPI(messages, customConfig, options = {}) {
  const { apiBaseUrl, apiKey, model } = customConfig
  
  const url = apiBaseUrl.endsWith('/') 
    ? `${apiBaseUrl}chat/completions` 
    : `${apiBaseUrl}/chat/completions`
  
  // ============ P0 修复：使用 HTTP Agent ============
  const agent = url.startsWith('https') ? httpsAgent : httpAgent
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens || 4096,
      stream: true
    }),
    agent: agent  // ✅ 使用连接池
  })
  // ===========================================
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API 调用失败：${response.status} - ${errorText}`)
  }
  
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') return
        try {
          const json = JSON.parse(data)
          const content = json.choices?.[0]?.delta?.content
          if (content) {
            yield content
          }
        } catch (e) {
          logger.warn('解析 SSE 数据失败:', e.message)
        }
      }
    }
  }
}

/**
 * 使用自定义 API 调用 LLM（非流式）- 使用连接池
 */
async function invokeWithCustomAPI(messages, customConfig, options = {}) {
  const { apiBaseUrl, apiKey, model } = customConfig
  
  const url = apiBaseUrl.endsWith('/') 
    ? `${apiBaseUrl}chat/completions` 
    : `${apiBaseUrl}/chat/completions`
  
  // ============ P0 修复：使用 HTTP Agent ============
  const agent = url.startsWith('https') ? httpsAgent : httpAgent
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens || 4096
    }),
    agent: agent  // ✅ 使用连接池
  })
  // ===========================================
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API 调用失败：${response.status} - ${errorText}`)
  }
  
  return await response.json()
}

/**
 * 流式 LLM 调用
 */
export async function* streamLLM(messages, options = {}, headers = {}) {
  try {
    const customConfig = await getCustomAPIConfig(options.type || 'publisher')
    
    if (customConfig) {
      // 使用自定义 API
      for await (const chunk of streamWithCustomAPI(messages, customConfig, options)) {
        yield chunk
      }
    } else {
      // 使用 SDK 默认
      const client = createLLMClient(headers)
      const model = options.model || DEFAULT_MODEL
      
      const stream = await client.chat.completions.create({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens || 4096,
        stream: true
      })
      
      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content
        if (content) {
          yield content
        }
      }
    }
  } catch (error) {
    logger.error('流式 LLM 调用失败:', error.message)
    throw error
  }
}

/**
 * 非流式 LLM 调用
 */
export async function invokeLLM(messages, options = {}, headers = {}) {
  try {
    const customConfig = await getCustomAPIConfig(options.type || 'publisher')
    
    if (customConfig) {
      // 使用自定义 API
      return await invokeWithCustomAPI(messages, customConfig, options)
    } else {
      // 使用 SDK 默认
      const client = createLLMClient(headers)
      const model = options.model || DEFAULT_MODEL
      
      const response = await client.chat.completions.create({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens || 4096
      })
      
      return response
    }
  } catch (error) {
    logger.error('LLM 调用失败:', error.message)
    throw error
  }
}

/**
 * 分析图片（多模态）
 */
export async function analyzeImages(images, prompt, options = {}, headers = {}) {
  try {
    // 下载并压缩图片
    const processedImages = await Promise.all(
      images.map(img => downloadAndCompressImage(img))
    )
    
    // 构建消息
    const content = [
      { type: 'text', text: prompt },
      ...processedImages.map(img => ({
        type: 'image_url',
        image_url: { url: img }
      }))
    ]
    
    const messages = [
      {
        role: 'user',
        content
      }
    ]
    
    // 调用 LLM
    const result = await invokeLLM(messages, {
      ...options,
      model: options.model || VISION_MODEL
    }, headers)
    
    return result.choices?.[0]?.message?.content || ''
  } catch (error) {
    logger.error('图片分析失败:', error.message)
    throw error
  }
}

/**
 * 流式分析图片
 */
export async function* streamAnalyzeImages(images, prompt, options = {}, headers = {}) {
  try {
    // 下载并压缩图片
    const processedImages = await Promise.all(
      images.map(img => downloadAndCompressImage(img))
    )
    
    // 构建消息
    const content = [
      { type: 'text', text: prompt },
      ...processedImages.map(img => ({
        type: 'image_url',
        image_url: { url: img }
      }))
    ]
    
    const messages = [
      {
        role: 'user',
        content
      }
    ]
    
    // 流式调用
    const customConfig = await getCustomAPIConfig(options.type || 'reviewer')
    
    if (customConfig) {
      for await (const chunk of streamWithCustomAPI(messages, customConfig, {
        ...options,
        model: options.model || VISION_MODEL
      })) {
        yield chunk
      }
    } else {
      const client = createLLMClient(headers)
      const model = options.model || VISION_MODEL
      
      const stream = await client.chat.completions.create({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens || 4096,
        stream: true
      })
      
      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content
        if (content) {
          yield content
        }
      }
    }
  } catch (error) {
    logger.error('流式图片分析失败:', error.message)
    throw error
  }
}

/**
 * 深度思考模式
 */
export async function think(prompt, options = {}, headers = {}) {
  const messages = [
    {
      role: 'user',
      content: `请逐步思考这个问题，然后给出答案：${prompt}`
    }
  ]
  
  return await invokeLLM(messages, {
    ...options,
    model: options.model || THINKING_MODEL
  }, headers)
}

// 导出模型常量
export const MODELS = {
  DEFAULT: DEFAULT_MODEL,
  VISION: VISION_MODEL,
  THINKING: THINKING_MODEL
}

export default {
  createLLMClient,
  streamLLM,
  invokeLLM,
  analyzeImages,
  streamAnalyzeImages,
  think,
  MODELS
}
