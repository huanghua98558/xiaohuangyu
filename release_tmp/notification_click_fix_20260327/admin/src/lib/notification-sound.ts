import { loadAdminNotificationSettings } from './admin-notification-settings'

let audioContext: AudioContext | null = null
let unlockBound = false

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

export async function playAdminNotificationSound(kind: 'notification' | 'alert' = 'notification') {
  const settings = loadAdminNotificationSettings()
  if (!settings.adminNotificationEnabled || !settings.adminNotificationSoundEnabled || !settings.adminNotificationWebEnabled) {
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
