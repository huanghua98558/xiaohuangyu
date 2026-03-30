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
const audioTemplates = new Map()

const SOUND_URLS = {
  default: '/sounds/notification.wav',
  task: '/sounds/task.wav',
  points: '/sounds/points.wav',
  alert: '/sounds/alert.wav',
}

function primeAudio(kind) {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null
  const key = SOUND_URLS[kind] ? kind : 'default'
  if (!audioTemplates.has(key)) {
    const audio = new Audio(SOUND_URLS[key])
    audio.preload = 'auto'
    audioTemplates.set(key, audio)
  }
  return audioTemplates.get(key) || null
}

function scheduleTone(ctx, startAt, tone) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.connect(gain)
  gain.connect(ctx.destination)

  oscillator.type = tone.type
  oscillator.frequency.setValueAtTime(tone.frequency, startAt)
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(tone.gain, startAt + 0.03)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + tone.duration)

  oscillator.start(startAt)
  oscillator.stop(startAt + tone.duration + 0.04)
}

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

  Object.keys(SOUND_URLS).forEach((kind) => {
    const audio = primeAudio(kind)
    if (audio) {
      try {
        audio.load()
      } catch {}
    }
  })
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

async function playFixedNotificationSound(kind = 'default') {
  const template = primeAudio(kind) || primeAudio('default')
  if (!template) return false

  try {
    const audio = template.cloneNode()
    audio.volume = kind === 'alert' ? 1 : 0.95
    audio.currentTime = 0
    await audio.play()
    return true
  } catch {
    return false
  }
}

export async function playNotificationSound(kind = 'default') {
  const settings = loadNotificationSettings()
  if (!settings.notificationEnabled || !settings.notificationSoundEnabled) {
    return false
  }

  if (await playFixedNotificationSound(kind)) {
    return true
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

  const now = ctx.currentTime
  const presets = {
    default: [
      { frequency: 880, duration: 0.18, gain: 0.06, type: 'sine', gap: 0 },
      { frequency: 740, duration: 0.22, gain: 0.06, type: 'sine', gap: 0.1 },
    ],
    task: [
      { frequency: 660, duration: 0.18, gain: 0.06, type: 'triangle', gap: 0 },
      { frequency: 820, duration: 0.2, gain: 0.07, type: 'triangle', gap: 0.09 },
      { frequency: 980, duration: 0.22, gain: 0.07, type: 'triangle', gap: 0.09 },
    ],
    points: [
      { frequency: 920, duration: 0.16, gain: 0.07, type: 'triangle', gap: 0 },
      { frequency: 1160, duration: 0.18, gain: 0.08, type: 'triangle', gap: 0.07 },
      { frequency: 1380, duration: 0.22, gain: 0.08, type: 'triangle', gap: 0.07 },
    ],
    alert: [
      { frequency: 540, duration: 0.24, gain: 0.09, type: 'square', gap: 0 },
      { frequency: 420, duration: 0.28, gain: 0.1, type: 'square', gap: 0.1 },
      { frequency: 540, duration: 0.24, gain: 0.09, type: 'square', gap: 0.12 },
    ],
  }
  const preset = presets[kind] || presets.default

  let cursor = now
  preset.forEach((tone) => {
    cursor += tone.gap || 0
    scheduleTone(ctx, cursor, tone)
    cursor += tone.duration
  })
  return true
}
