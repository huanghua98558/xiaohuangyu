import { createClient } from '@supabase/supabase-js'
import { execSync } from 'child_process'
import logger from './logger.js'

let envLoaded = false
let supabaseInstance = null

/**
 * 加载环境变量
 */
function loadEnv() {
  // 检查是否已经有环境变量（支持两种格式）
  const hasEnv = (process.env.COZE_SUPABASE_URL || process.env.SUPABASE_URL) && 
                 (process.env.COZE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)
  
  if (envLoaded || hasEnv) {
    // 检查数据库类型
    const dbUrl = process.env.DATABASE_URL || process.env.COZE_DATABASE_URL || ''
    if (dbUrl.includes('cockroachlabs.cloud')) {
      logger.info('CockroachDB 数据库配置已就绪')
    } else {
      logger.info('数据库配置已就绪')
    }
    return
  }

  try {
    // 尝试从 dotenv 加载（同步方式）
    try {
      const dotenv = require('dotenv')
      dotenv.config()
      if (process.env.COZE_SUPABASE_URL && process.env.COZE_SUPABASE_ANON_KEY) {
        envLoaded = true
        logger.info('从 dotenv 加载数据库配置成功')
        return
      }
    } catch {
      // dotenv not available
    }

    // 从 Coze 环境变量服务获取
    logger.info('尝试从 Coze 环境变量服务获取...')
    const pythonCode = `
import os
import sys
try:
    from coze_workload_identity import Client
    client = Client()
    env_vars = client.get_project_env_vars()
    client.close()
    for env_var in env_vars:
        print(f"{env_var.key}={env_var.value}")
except Exception as e:
    print(f"# Error: {e}", file=sys.stderr)
`

    const output = execSync(`python3 -c '${pythonCode.replace(/'/g, "'\"'\"'")}'`, {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    const lines = output.trim().split('\n')
    let loadedCount = 0
    for (const line of lines) {
      if (line.startsWith('#')) continue
      const eqIndex = line.indexOf('=')
      if (eqIndex > 0) {
        const key = line.substring(0, eqIndex)
        let value = line.substring(eqIndex + 1)
        if ((value.startsWith("'") && value.endsWith("'")) ||
            (value.startsWith('"') && value.endsWith('"'))) {
          value = value.slice(1, -1)
        }
        if (!process.env[key]) {
          process.env[key] = value
          loadedCount++
        }
      }
    }

    logger.info(`从 Coze 服务加载了 ${loadedCount} 个环境变量`)
    envLoaded = true
  } catch (error) {
    logger.error('Failed to load environment variables:', error.message)
    // 尝试输出更多调试信息
    logger.error('Python 可能未安装或 coze_workload_identity 库不可用')
  }
}

/**
 * 获取 Supabase 凭据
 * 支持两种环境变量格式：
 * - COZE_SUPABASE_URL / COZE_SUPABASE_ANON_KEY (Coze 平台)
 * - SUPABASE_URL / SUPABASE_ANON_KEY (通用格式)
 */
function getSupabaseCredentials() {
  loadEnv()

  // 优先使用 COZE_ 前缀，其次使用通用格式
  const url = process.env.COZE_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.COZE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!url) {
    throw new Error('SUPABASE_URL or COZE_SUPABASE_URL is not set')
  }
  if (!anonKey) {
    throw new Error('SUPABASE_ANON_KEY or COZE_SUPABASE_ANON_KEY is not set')
  }

  return { url, anonKey }
}

/**
 * 获取 Supabase 客户端
 * @param {string} token - 可选的 JWT token
 * @returns {SupabaseClient}
 */
function getSupabaseClient(token) {
  const { url, anonKey } = getSupabaseCredentials()

  const options = {
    db: {
      timeout: 60000
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }

  if (token) {
    options.global = {
      headers: { Authorization: `Bearer ${token}` }
    }
  }

  return createClient(url, anonKey, options)
}

// 创建默认客户端实例（延迟初始化）
function getSupabase() {
  if (!supabaseInstance) {
    supabaseInstance = getSupabaseClient()
  }
  return supabaseInstance
}



// 导出一个 Proxy，使得可以直接使用 supabase.from() 等方法
const supabase = new Proxy({}, {
  get(target, prop) {
    const client = getSupabase()
    return client[prop]
  }
})

export { loadEnv, getSupabaseCredentials, getSupabaseClient, supabase }
export default supabase
