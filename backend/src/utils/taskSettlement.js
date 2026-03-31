const BUSINESS_TIME_ZONE = 'Asia/Shanghai'
const POINT_PRECISION = 2

export function toSafeNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

export function roundPoints(value, precision = POINT_PRECISION) {
  const num = toSafeNumber(value, 0)
  const factor = 10 ** precision
  return Math.round((num + Number.EPSILON) * factor) / factor
}

export function clampMin(value, min = 0) {
  return Math.max(min, roundPoints(value))
}

export function parseJsonObject(raw, fallback = null) {
  if (raw === null || raw === undefined || raw === '') return fallback
  if (typeof raw === 'object') return raw
  if (typeof raw !== 'string') return fallback

  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function getBusinessHour(referenceTime, timeZone = BUSINESS_TIME_ZONE) {
  if (!referenceTime) return null

  const target = referenceTime instanceof Date ? referenceTime : new Date(referenceTime)
  if (Number.isNaN(target.getTime())) {
    return null
  }

  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(target)

  const parsedHour = Number(hour)
  return Number.isFinite(parsedHour) ? parsedHour : null
}

export function calculatePointBreakdown(basePoints, coefficient = 1) {
  const normalizedBase = clampMin(basePoints, 0)
  const normalizedCoefficient = Math.max(0, toSafeNumber(coefficient, 1))
  const finalPoints = clampMin(normalizedBase * normalizedCoefficient, 0)
  const bonusPoints = clampMin(finalPoints - normalizedBase, 0)
  const extraRate = clampMin(normalizedCoefficient - 1, 0)

  return {
    basePoints: normalizedBase,
    coefficient: roundPoints(normalizedCoefficient),
    extraRate,
    bonusPoints,
    finalPoints,
  }
}

export function buildSettlementDisplay(rawSnapshot = {}, fallback = {}) {
  const snapshot = parseJsonObject(rawSnapshot, rawSnapshot) || {}
  const basePoints = snapshot.basePoints ?? fallback.basePoints ?? fallback.base_reward ?? fallback.reward ?? 0
  const coefficient = snapshot.coefficient ?? fallback.coefficient ?? fallback.night_coefficient ?? 1
  const breakdown = calculatePointBreakdown(basePoints, coefficient)

  return {
    basePoints: breakdown.basePoints,
    coefficient: breakdown.coefficient,
    extraRate: breakdown.extraRate,
    bonusPoints: roundPoints(snapshot.bonusPoints ?? fallback.bonus_points ?? breakdown.bonusPoints),
    finalPoints: roundPoints(snapshot.finalPoints ?? fallback.final_points ?? breakdown.finalPoints),
    isNight: Boolean(snapshot.isNight ?? fallback.isNight ?? breakdown.coefficient > 1),
    lockTime: snapshot.lockTime ?? snapshot.claimTime ?? fallback.claimed_at ?? null,
    previewType: snapshot.previewType || fallback.previewType || 'preview',
    businessTimezone: snapshot.businessTimezone || BUSINESS_TIME_ZONE,
    onlineUsers: snapshot.onlineUsers ?? fallback.online_users ?? null,
    source: snapshot.source || fallback.source || null,
  }
}

export { BUSINESS_TIME_ZONE, POINT_PRECISION }
