/**
 * 错误处理中间件 - ES Modules 版本
 */
import logger from '../utils/logger.js'
import BusinessError from '../utils/BusinessError.js'

// ============ P1 修复：错误分类 ============
/**
 * 成功响应辅助函数
 */
export function success(res, data = null, message = "操作成功") {
  return res.json({
    code: 0,
    message,
    data
  })
}

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.isOperational = true
    
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message = '参数验证失败') {
    super(message, 400, 'VALIDATION_ERROR')
  }
}

export class AuthenticationError extends AppError {
  constructor(message = '认证失败') {
    super(message, 401, 'AUTHENTICATION_ERROR')
  }
}

export class AuthorizationError extends AppError {
  constructor(message = '权限不足') {
    super(message, 403, 'AUTHORIZATION_ERROR')
  }
}

export class NotFoundError extends AppError {
  constructor(message = '资源不存在') {
    super(message, 404, 'NOT_FOUND')
  }
}

export class RateLimitError extends AppError {
  constructor(message = '请求过于频繁') {
    super(message, 429, 'RATE_LIMIT_ERROR')
  }
}

/**
 * 错误日志脱敏
 */
function sanitizeError(error) {
  const sanitized = {
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode,
    code: error.code
  }
  
  if (error.config) {
    sanitized.config = { ...error.config }
    if (sanitized.config.headers?.Authorization) {
      sanitized.config.headers.Authorization = '***REDACTED***'
    }
    if (sanitized.config.password) {
      sanitized.config.password = '***REDACTED***'
    }
    if (sanitized.config.apiKey) {
      sanitized.config.apiKey = '***REDACTED***'
    }
  }
  
  return sanitized
}

/**
 * 记录错误日志
 */
function logError(error, context = {}) {
  const sanitized = sanitizeError(error)
  
  const logData = {
    timestamp: new Date().toISOString(),
    path: context.path,
    method: context.method,
    userId: context.userId,
    error: sanitized
  }
  
  if (error.statusCode >= 500) {
    logger.error('[服务器错误] ' + error.message, logData)
  } else if (error.statusCode >= 400) {
    logger.warn('[客户端错误] ' + error.message, logData)
  } else {
    logger.info('[业务错误] ' + error.message, logData)
  }
}

/**
 * 全局错误处理中间件
 */
export function errorHandler(err, req, res, next) {
  logError(err, {
    path: req.path,
    method: req.method,
    userId: req.user?.id
  })
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      code: 400,
      message: '参数验证失败',
      details: err.details || err.message
    })
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      code: 401,
      message: '未授权访问'
    })
  }
  
    // 处理业务错误
  if (err instanceof BusinessError) {
    return res.status(err.code || 400).json({
      code: err.code || 400,
      message: err.message,
      error: 'BUSINESS_ERROR'
    })
  }

if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      code: err.statusCode,
      message: err.message,
      error: err.code
    })
  }
  
  if (err.code === '23505') {
    return res.status(409).json({
      code: 409,
      message: '数据已存在'
    })
  }
  
  if (err.code === '23503') {
    return res.status(400).json({
      code: 400,
      message: '关联数据不存在'
    })
  }
  
  res.status(err.statusCode || 500).json({
    code: err.statusCode || 500,
    message: process.env.NODE_ENV === 'production' 
      ? '服务器内部错误' 
      : err.message,
    error: err.code || 'INTERNAL_ERROR'
  })
}

/**
 * 404处理中间件
 */
export function notFoundHandler(req, res) {
  const message =
    process.env.NODE_ENV === 'production'
      ? '资源不存在'
      : `路由不存在: ${req.method} ${req.path}`
  res.status(404).json({
    code: 404,
    message,
    data: null
  })
}

/**
 * 异步处理器
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

export default {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  errorHandler,
  notFoundHandler,
  asyncHandler
}
