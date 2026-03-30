const SETTINGS_KEY = 'xiaohuangyu_notification_settings'

const DEFAULT_SETTINGS = {
  notificationEnabled: true,
  notificationSoundEnabled: true,
  reviewNotificationEnabled: true,
  pointsNotificationEnabled: true,
  withdrawNotificationEnabled: true,
}

let audioContext = null
let unlockBound = false

function normalizeSettings(raw = {}) {
  return {
    notificationEnabled: raw.notificationEnabled !== false,
    notificationSoundEnabled: raw.notificationSoundEnabled !== false,
    reviewNotificationEnabled: raw.reviewNotificationEnabled !== false,
    pointsNotificationEnabled: raw.pointsNotificationEnabled !== false,
    withdrawNotificationEnabled: raw.withdrawNotificationEnabled !== false,
  }
}

export function loadNotificationSettings() {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return normalizeSettings(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveNotificationSettingsToCache(settings = {}) {
  if (typeof window === 'undefined') return normalizeSettings(settings)
  const normalized = normalizeSettings(settings)
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized))
  window.dispatchEvent(new CustomEvent('notification-settings-updated', {
    detail: normalized,
  }))
  return normalized
}

function ensureAudioContext() {
  if (typeof window === 'undefined') return null
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null
  if (!audioContext) {
    audioContext = new AudioCtx()
  }
  return audioContext
}

async function unlockAudio() {
  const ctx = ensureAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {}
  }
}

export function registerNotificationSoundUnlock() {
  if (typeof window === 'undefined' || unlockBound) return
  unlockBound = true
  const events = ['click', 'touchstart', 'keydown']
  const handler = () => {
    unlockAudio()
  }
  events.forEach((eventName) => {
    window.addEventListener(eventName, handler, { passive: true })
  })
}

function getCategory(type) {
  if ([
    'claim_approved',
    'claim_rejected',
    'review_failed',
    'manual_review',
    'claim_manual_queued',
    'claim_manual_corrected',
  ].includes(type)) return 'review'
  if ([
    'points_awarded',
    'points_converted',
    'sign_in_reward',
    'achievement_reward',
    'leaderboard_reward',
    'promotion_reward',
    'register_bonus',
    'register_bonus_unlock',
    'admin_points_adjusted',
  ].includes(type)) return 'points'
  if ([
    'withdraw_submitted',
    'withdraw_approved',
    'withdraw_rejected',
    'withdraw_paid',
  ].includes(type)) return 'withdraw'
  return 'system'
}

export function shouldDisplayRealtimeNotification(type = 'system') {
  const settings = loadNotificationSettings()
  if (!settings.notificationEnabled) return false
  const category = getCategory(type)
  if (category === 'review') return settings.reviewNotificationEnabled
  if (category === 'points') return settings.pointsNotificationEnabled
  if (category === 'withdraw') return settings.withdrawNotificationEnabled
  return true
}

export async function playNotificationSound(kind = 'default') {
  const settings = loadNotificationSettings()
  if (!settings.notificationEnabled || !settings.notificationSoundEnabled) {
    return false
  }

  const ctx = ensureAudioContext()
  if (!ctx) return false

  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      return false
    }
  }

  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.connect(gain)
  gain.connect(ctx.destination)

  const now = ctx.currentTime
  const presets = {
    default: { frequency: 880, duration: 0.12, gain: 0.05, type: 'sine' },
    task: { frequency: 660, duration: 0.14, gain: 0.05, type: 'triangle' },
    points: { frequency: 960, duration: 0.16, gain: 0.06, type: 'triangle' },
    alert: { frequency: 520, duration: 0.22, gain: 0.08, type: 'square' },
  }
  const preset = presets[kind] || presets.default

  oscillator.type = preset.type
  oscillator.frequency.setValueAtTime(preset.frequency, now)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(preset.gain, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + preset.duration)

  oscillator.start(now)
  oscillator.stop(now + preset.duration + 0.02)
  return true
}
