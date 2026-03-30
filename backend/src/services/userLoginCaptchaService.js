import crypto from 'crypto'
import { cache } from '../utils/redis.js'

const KEY_PREFIX = 'userLoginCaptcha:'
const TTL_SECONDS = 180
const MAX_ATTEMPTS = 5

const memoryStore = new Map()

function memoryGet(id) {
  const row = memoryStore.get(id)
  if (!row) return null
  if (Date.now() > row.expiresAt) {
    memoryStore.delete(id)
    return null
  }
  return { code: row.code, attempts: row.attempts }
}

function memorySet(id, payload, ttlSec) {
  memoryStore.set(id, {
    code: payload.code,
    attempts: payload.attempts || 0,
    expiresAt: Date.now() + ttlSec * 1000
  })
}

function memoryDel(id) {
  memoryStore.delete(id)
}

async function loadRecord(id) {
  const key = `${KEY_PREFIX}${id}`
  const fromRedis = await cache.get(key)
  if (fromRedis && typeof fromRedis === 'object' && typeof fromRedis.code === 'string') {
    return { code: fromRedis.code, attempts: Number(fromRedis.attempts) || 0 }
  }
  return memoryGet(id)
}

async function saveRecord(id, record, ttlSec = TTL_SECONDS) {
  const key = `${KEY_PREFIX}${id}`
  const ok = await cache.set(key, record, ttlSec)
  if (!ok) {
    memorySet(id, record, ttlSec)
  }
}

async function removeRecord(id) {
  const key = `${KEY_PREFIX}${id}`
  await cache.del(key)
  memoryDel(id)
}

function buildSvg(code) {
  const chars = String(code).split('')
  const parts = []
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i]
    const x = 14 + i * 24
    const y = 28 + (Math.random() * 8 - 4)
    const rot = Math.random() * 28 - 14
    parts.push(
      `<text x="${x}" y="${y}" fill="#1e293b" font-size="24" font-family="ui-monospace,monospace" transform="rotate(${rot} ${x} ${y})">${ch}</text>`
    )
  }
  let noise = ''
  for (let n = 0; n < 6; n += 1) {
    noise += `<line x1="${Math.random() * 120}" y1="${Math.random() * 44}" x2="${Math.random() * 120}" y2="${Math.random() * 44}" stroke="#94a3b8" stroke-width="0.8"/>`
  }
  for (let n = 0; n < 20; n += 1) {
    const cx = Math.random() * 120
    const cy = Math.random() * 44
    noise += `<circle cx="${cx}" cy="${cy}" r="0.8" fill="#cbd5e1"/>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="44" viewBox="0 0 120 44">${noise}${parts.join('')}</svg>`
}

export async function createCaptcha() {
  const code = String(crypto.randomInt(0, 10000)).padStart(4, '0')
  const captchaId = crypto.randomUUID()
  await saveRecord(captchaId, { code, attempts: 0 }, TTL_SECONDS)
  return { captchaId, svg: buildSvg(code) }
}

export async function verifyCaptcha(captchaId, rawInput) {
  if (!captchaId || rawInput === undefined || rawInput === null) {
    return { ok: false, message: '请完成数字验证码' }
  }
  const input = String(rawInput).replace(/\D/g, '')
  if (input.length !== 4) {
    return { ok: false, message: '请输入4位数字验证码' }
  }

  const record = await loadRecord(captchaId)
  if (!record) {
    return { ok: false, message: '验证码已失效，请刷新' }
  }

  if (input !== record.code) {
    const attempts = (record.attempts || 0) + 1
    if (attempts >= MAX_ATTEMPTS) {
      await removeRecord(captchaId)
      return { ok: false, message: '验证码错误次数过多，请刷新后重试' }
    }
    await saveRecord(captchaId, { code: record.code, attempts }, TTL_SECONDS)
    return { ok: false, message: '验证码错误' }
  }

  await removeRecord(captchaId)
  return { ok: true }
}

export default {
  createCaptcha,
  verifyCaptcha
}
