/**
 * 统一API响应格式
 */

/**
 * 成功响应
 * @param {object} res - Express响应对象
 * @param {any} data - 响应数据
 * @param {string} message - 成功消息
 * @param {number} status - HTTP状态码
 */
export function success(res, data = null, message = '操作成功', status = 200) {
  return res.status(status).json({
    code: 0,
    data,
    message
  })
}

/**
 * 错误响应
 * @param {object} res - Express响应对象
 * @param {string} message - 错误消息
 * @param {number} code - 错误码
 * @param {number} status - HTTP状态码
 */
export function error(res, message = '操作失败', code = 400, status = 400) {
  return res.status(status).json({
    code,
    message,
    data: null
  })
}

/**
 * 参数错误响应
 */
export function badRequest(res, message = '参数错误') {
  return error(res, message, 400, 400)
}

/**
 * 未授权响应
 */
export function unauthorized(res, message = '请先登录') {
  return error(res, message, 401, 401)
}

/**
 * 禁止访问响应
 */
export function forbidden(res, message = '无权限访问') {
  return error(res, message, 403, 403)
}

/**
 * 资源不存在响应
 */
export function notFound(res, message = '资源不存在') {
  return error(res, message, 404, 404)
}

/**
 * 服务器错误响应
 */
export function serverError(res, message = '服务器错误') {
  return error(res, message, 500, 500)
}
