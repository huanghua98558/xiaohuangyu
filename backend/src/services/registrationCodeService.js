/**
 * 注册码（与推广邀请码分离）：用于管理员控制是否必须持码注册
 */

export function normalizeRegistrationCode(raw) {
  return String(raw || '').trim().toUpperCase()
}

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {string} registrationCodeRaw
 * @returns {Promise<bigint | null>} 需扣减的注册码 id；不需要注册码时返回 null
 */
export async function lockAndValidateRegistrationCode(tx, registrationCodeRaw) {
  const cfgRows = await tx.$queryRaw`
    SELECT value FROM system_configs WHERE key = 'register_code_required' LIMIT 1
  `
  const required = cfgRows[0]?.value === 'true'
  if (!required) return null

  const code = normalizeRegistrationCode(registrationCodeRaw)
  if (!code) {
    throw new Error('请输入注册码')
  }

  const rows = await tx.$queryRaw`
    SELECT id, max_uses, used_count, expires_at, disabled
    FROM registration_codes
    WHERE code = ${code}
    FOR UPDATE
  `
  const r = rows[0]
  if (!r || r.disabled) {
    throw new Error('注册码无效')
  }
  if (r.expires_at && new Date(r.expires_at) < new Date()) {
    throw new Error('注册码已过期')
  }
  const maxUses = Number(r.max_uses)
  const used = Number(r.used_count)
  if (!Number.isFinite(maxUses) || maxUses < 1 || used >= maxUses) {
    throw new Error('注册码已用完')
  }
  return r.id
}

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {bigint} id
 */
export async function incrementRegistrationCodeUse(tx, id) {
  await tx.$queryRaw`
    UPDATE registration_codes
    SET used_count = used_count + 1
    WHERE id = ${id}
      AND used_count < max_uses
  `
}
