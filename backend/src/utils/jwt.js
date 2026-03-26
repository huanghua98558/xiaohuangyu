import jwt from 'jsonwebtoken'

// 强制要求配置 JWT_SECRET（生产环境）
const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

// 启动时检查 JWT_SECRET
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ [JWT] 生产环境必须配置 JWT_SECRET 环境变量')
    process.exit(1)
  } else {
    // 开发环境使用默认值（仅用于开发）
    console.warn('⚠️ [JWT] 警告: 使用开发环境默认密钥，请确保生产环境配置 JWT_SECRET')
  }
}

// 实际使用的密钥
const SECRET = JWT_SECRET || 'dev-only-secret-key-do-not-use-in-production-min-32-chars'

/**
 * 生成JWT Token
 * 注意：userId 必须转换为字符串以避免 BigInt 精度丢失
 */
export function generateToken(payload) {
  // 确保 userId 是字符串
  const safePayload = {
    ...payload,
    userId: payload.userId ? String(payload.userId) : payload.userId
  }
  return jwt.sign(safePayload, SECRET, { expiresIn: JWT_EXPIRES_IN })
}

/**
 * 验证JWT Token
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET)
  } catch (error) {
    return null
  }
}

/**
 * 从请求头提取Token
 */
export function extractToken(req) {
  const auth = req.headers.authorization
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7)
  }
  return null
}
