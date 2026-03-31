/**
 * 登录框可填用户名或手机号：统一规范化，避免 +86、空格等导致匹配失败。
 * 若输入为大陆 11 位手机号，返回纯数字；否则返回 trim 后的原串（用户名登录）。
 */
export function normalizeLoginKey(raw) {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return ''
  const digits = trimmed.replace(/\D/g, '')
  if (/^1[3-9]\d{9}$/.test(digits)) {
    return digits
  }
  return trimmed
}
