import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

/**
 * 哈希密码
 * @param {string} password - 明文密码
 * @returns {Promise<string>} - 哈希后的密码
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * 验证密码
 * @param {string} password - 明文密码
 * @param {string} hash - 哈希密码
 * @returns {Promise<boolean>} - 是否匹配
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash)
}
