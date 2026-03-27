import { loadAdminNotificationSettings } from './admin-notification-settings'

let audioContext: AudioContext | null = null
let unlockBound = false
const audioTemplates = new Map<string, HTMLAudioElement>()

const SOUND_URLS = {
  notification: '/admin/sounds/notification-strong.wav',
  alert: '/admin/sounds/alert-strong.wav',
}

function primeAudio(kind: 'notification' | 'alert') {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null
  if (!audioTemplates.has(kind)) {
    const audio = new Audio(SOUND_URLS[kind])
    audio.preload = 'auto'
    audioTemplates.set(kind, audio)
  }
  return audioTemplates.get(kind) || null
}

function scheduleTone(
  ctx: AudioContext,
  startAt: number,
  tone: {
    frequency: number
    duration: number
    gain: number
    type: OscillatorType
  }
) {
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

function ensureAudioContext() {
  if (typeof window === 'undefined') return null
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return null
  if (!audioContext) {
    audioContext = new AudioCtx()
  }
  return audioContext
}

async function unlockAudio() {
  const ctx = ensureAudioContext()
  if (ctx && ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {}
  }

  ;(['notification', 'alert'] as const).forEach((kind) => {
    const audio = primeAudio(kind)
    if (audio) {
      try {
        audio.load()
      } catch {}
    }
  })
}

export function registerAdminNotificationSoundUnlock() {
  if (typeof window === 'undefined' || unlockBound) return
  unlockBound = true
  const handler = () => {
    unlockAudio()
  }
  ;['click', 'touchstart', 'keydown'].forEach((eventName) => {
    window.addEventListener(eventName, handler, { passive: true })
  })
}

async function playFixedAdminNotificationSound(kind: 'notification' | 'alert') {
  const template = primeAudio(kind)
  if (!template) return false

  try {
    const audio = template.cloneNode() as HTMLAudioElement
    audio.volume = kind === 'alert' ? 1 : 0.95
    audio.currentTime = 0
    await audio.play()
    return true
  } catch {
    return false
  }
}

export async function playAdminNotificationSound(kind: 'notification' | 'alert' = 'notification') {
  const settings = loadAdminNotificationSettings()
  if (!settings.adminNotificationEnabled || !settings.adminNotificationSoundEnabled || !settings.adminNotificationWebEnabled) {
    return false
  }

  if (await playFixedAdminNotificationSound(kind)) {
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
  const preset = kind === 'alert'
    ? [
        { frequency: 500, duration: 0.24, gain: 0.09, type: 'square' as OscillatorType, gap: 0 },
        { frequency: 420, duration: 0.28, gain: 0.1, type: 'square' as OscillatorType, gap: 0.1 },
        { frequency: 500, duration: 0.24, gain: 0.09, type: 'square' as OscillatorType, gap: 0.12 },
      ]
    : [
        { frequency: 820, duration: 0.18, gain: 0.06, type: 'triangle' as OscillatorType, gap: 0 },
        { frequency: 980, duration: 0.22, gain: 0.07, type: 'triangle' as OscillatorType, gap: 0.09 },
      ]

  let cursor = now
  preset.forEach((tone) => {
    cursor += tone.gap || 0
    scheduleTone(ctx, cursor, tone)
    cursor += tone.duration
  })
  return true
}
