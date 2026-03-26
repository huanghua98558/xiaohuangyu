import { loadAdminNotificationSettings } from './admin-notification-settings'

let audioContext: AudioContext | null = null
let unlockBound = false

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

  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.connect(gain)
  gain.connect(ctx.destination)

  const now = ctx.currentTime
  const preset = kind === 'alert'
    ? { frequency: 480, duration: 0.22, gain: 0.08, type: 'square' as OscillatorType }
    : { frequency: 820, duration: 0.14, gain: 0.05, type: 'triangle' as OscillatorType }

  oscillator.type = preset.type
  oscillator.frequency.setValueAtTime(preset.frequency, now)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(preset.gain, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + preset.duration)
  oscillator.start(now)
  oscillator.stop(now + preset.duration + 0.02)
  return true
}
