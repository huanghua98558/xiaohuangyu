/**
 * 业务错误类
 * 用于区分业务错误和系统错误，返回正确的 HTTP 状态码和错误信息
 */
class BusinessError extends Error {
  constructor(message, code = 400) {
    super(message)
    this.name = 'BusinessError'
    this.code = code
  }
}

export default BusinessError
