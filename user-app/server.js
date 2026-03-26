import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn, execSync } from 'child_process'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 环境判断
const isProduction = process.env.NODE_ENV === 'production'

// 用户端服务配置
const USER_PORT = 5002  // 用户端 Vite dev server 端口
const USER_URL = `http://localhost:${USER_PORT}`

// 后端服务配置
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'
const BACKEND_PORT = 8080

// 管理后台服务配置
const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:5001'
const ADMIN_PORT = 5001

// 进程管理
let userProcess = null
let adminProcess = null
let backendProcess = null
let isShuttingDown = false

// 检查端口是否被占用
function isPortInUse(port) {
  try {
    const result = execSync(`ss -tlnp 2>/dev/null | grep -E ':${port}[[:space:]]' | grep -q LISTEN && echo "in_use" || echo "free"`, {
      encoding: 'utf-8',
      timeout: 5000
    })
    return result.trim() === 'in_use'
  } catch {
    return false
  }
}

// 启动用户端服务（开发环境：Vite dev server，生产环境：静态文件）
function startUser() {
  if (isShuttingDown) return
  
  // 生产环境不需要启动用户端服务，使用静态文件
  if (isProduction) {
    console.log('生产模式：用户端使用静态文件服务')
    return
  }
  
  // 检查端口是否已被占用
  if (isPortInUse(USER_PORT)) {
    console.log(`端口 ${USER_PORT} 已被占用，跳过用户端启动（可能已有服务运行）`)
    return
  }
  
  console.log('启动用户端服务 (Vite 开发模式)...')
  
  userProcess = spawn('npx', ['vite', '--port', String(USER_PORT), '--host'], {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' },
    shell: true
  })
  
  userProcess.on('error', (err) => {
    console.error('用户端服务启动失败:', err)
  })
  
  userProcess.on('exit', (code) => {
    console.log(`用户端服务退出，代码: ${code}`)
    userProcess = null
    if (code !== 0 && code !== null && !isShuttingDown) {
      console.log('5秒后重启用户端服务...')
      setTimeout(startUser, 5000)
    }
  })
}

// 启动管理后台服务（Next.js 独立服务）
function startAdmin() {
  if (isShuttingDown) return
  
  // 检查端口是否已被占用
  if (isPortInUse(ADMIN_PORT)) {
    console.log(`端口 ${ADMIN_PORT} 已被占用，跳过管理后台启动（可能已有服务运行）`)
    return
  }
  
  const adminPath = path.join(__dirname, 'xiaohuangyu-source/admin')
  
  if (isProduction) {
    // 生产环境：使用 pnpm start
    console.log('启动管理后台服务 (Next.js 生产模式)...')
    adminProcess = spawn('pnpm', ['start', '--port', String(ADMIN_PORT), '--host'], {
      cwd: adminPath,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' },
      shell: true
    })
  } else {
    // 开发环境：使用 next dev
    console.log('启动管理后台服务 (Next.js 开发模式)...')
    adminProcess = spawn('npx', ['next', 'dev', '--port', String(ADMIN_PORT)], {
      cwd: adminPath,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' },
      shell: true
    })
  }
  
  adminProcess.on('error', (err) => {
    console.error('管理后台服务启动失败:', err)
  })
  
  adminProcess.on('exit', (code) => {
    console.log(`管理后台服务退出，代码: ${code}`)
    adminProcess = null
    if (code !== 0 && code !== null && !isShuttingDown) {
      console.log('5秒后重启管理后台服务...')
      setTimeout(startAdmin, 5000)
    }
  })
}

// 启动后端服务
function startBackend() {
  if (isShuttingDown) return
  
  // 检查端口是否已被占用
  if (isPortInUse(BACKEND_PORT)) {
    console.log(`端口 ${BACKEND_PORT} 已被占用，跳过后端启动（可能已有后端服务运行）`)
    return
  }
  
  const backendPath = path.join(__dirname, 'xiaohuangyu-source/backend')
  console.log('启动后端服务...')
  
  backendProcess = spawn('node', ['src/app.js'], {
    cwd: backendPath,
    stdio: 'inherit',
    env: { ...process.env }
  })
  
  backendProcess.on('error', (err) => {
    console.error('后端服务启动失败:', err)
  })
  
  backendProcess.on('exit', (code) => {
    console.log(`后端服务退出，代码: ${code}`)
    backendProcess = null
    if (code !== 0 && code !== null && !isShuttingDown) {
      console.log('5秒后重启后端服务...')
      setTimeout(startBackend, 5000)
    }
  })
}

const app = express()

// 启用严格路由
app.set('strict routing', true)

// 请求日志中间件
app.use((req, res, next) => {
  if (req.url.startsWith('/ws') || req.url.includes('websocket')) {
    console.log(`[Request] ${req.method} ${req.url}`)
  }
  next()
})

// ============ API 代理到后端 ============
app.use('/api', createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[API Proxy] ${req.method} ${req.url} -> ${BACKEND_URL}`)
  },
  onProxyError: (err, req, res) => {
    console.error('[API Proxy Error]', err.message)
    res.status(502).json({ code: 502, message: '无法连接到后端服务', data: null })
  }
}))

// 上传文件代理
app.use('/uploads', createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true
}))

// ============ 管理后台代理 ============
app.use('/admin', createProxyMiddleware({
  target: ADMIN_URL,
  changeOrigin: true,
  ws: true,
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Admin Proxy] ${req.method} ${req.url} -> ${ADMIN_URL}`)
  },
  onProxyError: (err, req, res) => {
    console.error('[Admin Proxy Error]', err.message)
    res.status(502).send('管理后台服务不可用')
  }
}))

// Next.js 静态资源代理
app.use('/_next', createProxyMiddleware({
  target: ADMIN_URL,
  changeOrigin: true,
  ws: true
}))

// ============ 用户端处理 ============
if (isProduction) {
  // 生产环境：静态文件服务
  const distPath = path.join(__dirname, '../backend/public/user')
  
  // 静态资源服务 - 必须在 SPA 回退之前
  app.use('/assets', express.static(path.join(distPath, 'assets'), {
    maxAge: '1y',
    etag: true,
    immutable: true
  }))
  
  // 其他静态文件
  app.use(express.static(distPath, {
    maxAge: '1d',
    etag: true
  }))
  
  // SPA 路由回退 - 只处理非静态资源请求
  app.get('*', (req, res, next) => {
    // 跳过 API 和管理后台路径
    if (req.path.startsWith('/api') || req.path.startsWith('/admin') || req.path.startsWith('/_next')) {
      return next()
    }
    // 跳过静态资源文件（有扩展名的文件）
    if (req.path.match(/\.\w+$/)) {
      return next()
    }
    res.sendFile(path.join(distPath, 'index.html'))
  })
} else {
  // 开发环境：代理到 Vite dev server
  app.use('/', createProxyMiddleware({
    target: USER_URL,
    changeOrigin: true,
    ws: true,  // 支持 Vite HMR WebSocket
    onProxyReq: (proxyReq, req, res) => {
      console.log(`[User Proxy] ${req.method} ${req.url} -> ${USER_URL}`)
    },
    onProxyError: (err, req, res) => {
      console.error('[User Proxy Error]', err.message)
      res.status(502).send('用户端服务不可用')
    }
  }))
}

// 端口配置
function getPort() {
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      return parseInt(args[i + 1], 10)
    }
  }
  return parseInt(process.env.DEPLOY_RUN_PORT, 10) || parseInt(process.env.PORT, 10) || 5000
}
const PORT = getPort()

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭...')
  isShuttingDown = true
  if (userProcess) userProcess.kill('SIGTERM')
  if (adminProcess) adminProcess.kill('SIGTERM')
  if (backendProcess) backendProcess.kill('SIGTERM')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('收到 SIGINT 信号，正在关闭...')
  isShuttingDown = true
  if (userProcess) userProcess.kill('SIGINT')
  if (adminProcess) adminProcess.kill('SIGINT')
  if (backendProcess) backendProcess.kill('SIGINT')
  process.exit(0)
})

// 启动所有服务
// startBackend() - 后端已由 PM2 独立管理
startAdmin()
startUser()

// 等待服务启动后再启动代理入口
setTimeout(() => {
  const server = http.createServer(app)
  
  // 手动处理 WebSocket 升级请求，确保查询参数被正确传递
  server.on('upgrade', (req, socket, head) => {
    console.log(`[WS Upgrade] 原始请求URL: ${req.url}`)
    
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`)
    const { pathname, search } = parsedUrl
    
    // 后端 WebSocket（/ws 路径）
    if (pathname === '/ws' || pathname.startsWith('/api/v1')) {
      console.log(`[WS Upgrade] 代理到后端: ${pathname}${search}`)
      
      const headers = {
        host: 'localhost:8080',
        connection: 'upgrade',
        upgrade: 'websocket'
      }
      
      const wsHeaders = ['sec-websocket-key', 'sec-websocket-version', 'sec-websocket-extensions', 'sec-websocket-protocol', 'origin']
      for (const h of wsHeaders) {
        if (req.headers[h] !== undefined) {
          headers[h] = req.headers[h]
        }
      }
      
      const proxyReq = http.request({
        hostname: 'localhost',
        port: 8080,
        path: `${pathname}${search}`,
        method: 'GET',
        headers
      })
      
      proxyReq.on('upgrade', (proxyRes, proxySocket) => {
        console.log(`[WS Upgrade] 后端返回: ${proxyRes.statusCode}`)
        
        socket.write(`HTTP/1.1 101 Switching Protocols\r\n`)
        for (const [key, value] of Object.entries(proxyRes.headers)) {
          socket.write(`${key}: ${value}\r\n`)
        }
        socket.write('\r\n')
        
        proxySocket.pipe(socket)
        socket.pipe(proxySocket)
        
        proxySocket.on('error', (err) => console.error('[WS] 代理错误:', err.message))
        socket.on('error', (err) => console.error('[WS] 客户端错误:', err.message))
      })
      
      proxyReq.on('error', (err) => {
        console.error('[WS Upgrade] 请求错误:', err.message)
        socket.destroy()
      })
      
      proxyReq.end()
      return
    }
    
    // 管理后台热更新 WebSocket
    if (pathname.includes('/_next/webpack-hmr') || pathname.includes('/admin/_next')) {
      console.log(`[WS Upgrade] 代理到管理后台: ${pathname}`)
      
      const proxyReq = http.request({
        hostname: 'localhost',
        port: 5001,
        path: req.url,
        method: 'GET',
        headers: {
          ...req.headers,
          host: 'localhost:5001',
          connection: 'upgrade',
          upgrade: 'websocket'
        }
      })
      
      proxyReq.on('upgrade', (proxyRes, proxySocket) => {
        socket.write(`HTTP/1.1 101 Switching Protocols\r\n`)
        for (const [key, value] of Object.entries(proxyRes.headers)) {
          socket.write(`${key}: ${value}\r\n`)
        }
        socket.write('\r\n')
        proxySocket.pipe(socket)
        socket.pipe(proxySocket)
      })
      
      proxyReq.on('error', () => socket.destroy())
      proxyReq.end()
      return
    }
    
    // 用户端热更新 WebSocket（开发环境）
    if (!isProduction && (pathname === '/' || pathname.startsWith('/__vite') || pathname.includes('hmr'))) {
      console.log(`[WS Upgrade] 代理到用户端: ${pathname}`)
      
      const proxyReq = http.request({
        hostname: 'localhost',
        port: USER_PORT,
        path: req.url,
        method: 'GET',
        headers: {
          ...req.headers,
          host: `localhost:${USER_PORT}`,
          connection: 'upgrade',
          upgrade: 'websocket'
        }
      })
      
      proxyReq.on('upgrade', (proxyRes, proxySocket) => {
        socket.write(`HTTP/1.1 101 Switching Protocols\r\n`)
        for (const [key, value] of Object.entries(proxyRes.headers)) {
          socket.write(`${key}: ${value}\r\n`)
        }
        socket.write('\r\n')
        proxySocket.pipe(socket)
        socket.pipe(proxySocket)
      })
      
      proxyReq.on('error', () => socket.destroy())
      proxyReq.end()
      return
    }
  })
  
  server.listen(PORT, () => {
    console.log(`\n========================================`)
    console.log(`小黄鱼任务中心 - 统一入口 (v3.1)`)
    console.log(`========================================`)
    console.log(`Server running at http://localhost:${PORT}`)
    console.log(`\n服务架构:`)
    if (isProduction) {
      console.log(`  用户端: 静态文件 (backend/public/user)`)
    } else {
      console.log(`  用户端: Vite Dev Server (端口 ${USER_PORT})`)
    }
    console.log(`  管理后台: Next.js Server (端口 ${ADMIN_PORT})`)
    console.log(`  后端API: Express Server (端口 ${BACKEND_PORT})`)
    console.log(`\n代理规则:`)
    console.log(`  /api/* -> ${BACKEND_URL}`)
    console.log(`  /admin/* -> ${ADMIN_URL}`)
    console.log(`  /ws -> ${BACKEND_URL} (WebSocket)`)
    console.log(`========================================\n`)
  })
}, 3000)
