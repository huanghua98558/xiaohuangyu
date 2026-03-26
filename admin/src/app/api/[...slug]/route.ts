import { NextRequest, NextResponse } from 'next/server'

// 后端API地址
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  return proxyRequest(request, params, 'GET')
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  return proxyRequest(request, params, 'POST')
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  return proxyRequest(request, params, 'PUT')
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  return proxyRequest(request, params, 'DELETE')
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  return proxyRequest(request, params, 'PATCH')
}

async function proxyRequest(
  request: NextRequest,
  params: Promise<{ slug: string[] }>,
  method: string
) {
  try {
    const { slug } = await params
    const path = slug.join('/')
    
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams
    const queryString = searchParams.toString()
    
    // 修复：保留 /api 前缀
    const url = `${BACKEND_URL}/api/${path}${queryString ? `?${queryString}` : ''}`
    
    // 准备请求头
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    
    // 转发Authorization头
    const authHeader = request.headers.get('Authorization')
    if (authHeader) {
      headers['Authorization'] = authHeader
    }
    
    // 准备请求体
    let body: string | undefined
    if (method !== 'GET' && method !== 'DELETE') {
      body = await request.text()
    }
    
    console.log(`[API Proxy] ${method} ${url}`)
    
    // 发送请求到后端
    const response = await fetch(url, {
      method,
      headers,
      body,
    })
    
    // 获取响应内容类型
    const contentType = response.headers.get('content-type') || ''
    
    // 检测是否是 SSE 流式响应
    if (contentType.includes('text/event-stream')) {
      console.log('[API Proxy] SSE stream detected, streaming response...')
      
      // 创建流式响应
      const stream = new ReadableStream({
        async start(controller) {
          const reader = response.body?.getReader()
          if (!reader) {
            controller.close()
            return
          }
          
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) {
                controller.close()
                break
              }
              controller.enqueue(value)
            }
          } catch (error) {
            console.error('[API Proxy] Stream error:', error)
            controller.error(error)
          }
        },
      })
      
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }
    
    // 普通 JSON 或文本响应
    let data
    
    if (contentType.includes('application/json')) {
      data = await response.json()
    } else {
      data = await response.text()
    }
    
    // 返回响应
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('API proxy error:', error)
    return NextResponse.json(
      { code: 500, message: 'API代理错误', data: null },
      { status: 500 }
    )
  }
}
