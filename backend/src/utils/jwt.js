import jwt from 'jsonwebtoken'

// 强制要求配置 JWT_SECRET（生产环境）
const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

function databaseUrlLooksRemote(url) {
  if (!url || typeof url !== 'string') return false
  return !/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(url)
}

const requireJwtBecauseRemoteDb =
  databaseUrlLooksRemote(process.env.DATABASE_URL) &&
  process.env.ALLOW_INSECURE_JWT_FALLBACK !== '1'

// 启动时检查 JWT_SECRET
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production' || requireJwtBecauseRemoteDb) {
    console.error(
      '❌ [JWT] 必须配置 JWT_SECRET（生产环境或已配置远程 DATABASE_URL）。本地纯本地库可设 ALLOW_INSECURE_JWT_FALLBACK=1 仅用于开发。'
    )
    process.exit(1)
  } else {
    console.warn('⚠️ [JWT] 警告: 使用开发环境默认密钥，请确保生产环境配置 JWT_SECRET')
  }
}

const DEV_FALLBACK_SECRET = 'dev-only-secret-key-do-not-use-in-production-min-32-chars'

function assertSecretLength(secret, label) {
  if (typeof secret !== 'string' || secret.length < 32) {
    const msg = `[JWT] ${label}：JWT_SECRET 长度须不少于 32 个字符（当前 ${secret ? secret.length : 0}）`
    if (process.env.NODE_ENV === 'production') {
      console.error(`❌ ${msg}`)
      process.exit(1)
    }
    console.warn(`⚠️ ${msg}`)
  }
}

if (JWT_SECRET) {
  assertSecretLength(JWT_SECRET, '已配置密钥')
} else {
  assertSecretLength(DEV_FALLBACK_SECRET, '开发环境默认密钥')
}

// 实际使用的密钥
const SECRET = JWT_SECRET || DEV_FALLBACK_SECRET

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
