import { verifyToken, extractToken } from '../utils/jwt.js'
import { unauthorized, forbidden } from '../utils/response.js'
import logger from '../utils/logger.js'

/**
 * JWT认证中间件
 */
export function authMiddleware(req, res, next) {
  const token = extractToken(req)
  
  if (!token) {
    return unauthorized(res, '请先登录')
  }

  const payload = verifyToken(token)
  
  if (!payload) {
    return unauthorized(res, '登录已过期，请重新登录')
  }

  req.userId = payload.userId
  req.userRole = payload.role
  next()
}

/**
 * 可选认证中间件（不强制登录）
 */
export function optionalAuth(req, res, next) {
  const token = extractToken(req)
  
  if (token) {
    const payload = verifyToken(token)
    if (payload) {
      req.userId = payload.userId
      req.userRole = payload.role
    }
  }
  
  next()
}

/**
 * 角色权限中间件
 * @param {string[]} roles - 允许的角色列表
 */
export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.userId) {
      return unauthorized(res, '请先登录')
    }

    if (!roles.includes(req.userRole)) {
      logger.warn(`用户 ${req.userId} 尝试访问需要 ${roles.join('/')} 角色的资源`)
      return forbidden(res, '无权限访问')
    }

    next()
  }
}

/**
 * 管理员或审核员权限
 */
export function adminOrReviewer(req, res, next) {
  return requireRoles('admin', 'reviewer')(req, res, next)
}

/**
 * 仅管理员权限
 */
export function adminOnly(req, res, next) {
  return requireRoles('admin')(req, res, next)
}

/**
 * 管理员或任务发布者权限
 */
export function clientOrAdmin(req, res, next) {
  return requireRoles('admin', 'client')(req, res, next)
}

/**
 * 发布者权限（包含审核员，因为审核员也可以发布任务）
 */
export function publisherOrAdmin(req, res, next) {
  return requireRoles('admin', 'client', 'reviewer')(req, res, next)
}
