const STORAGE_KEY = 'admin_notification_settings'

export type AdminNotificationSettings = {
  adminNotificationEnabled: boolean
  adminNotificationSoundEnabled: boolean
  adminNotificationWebEnabled: boolean
  adminNotificationMobileEnabled: boolean
  alertCooldownSeconds: number
  manualQueueThreshold: number
  staleTaskMinutes: number
  pendingPayoutMinutes: number
  userAnomalyThreshold: number
  rewardAnomalyThreshold: number
  rewardAnomalyLookbackMinutes: number
}

export const DEFAULT_ADMIN_NOTIFICATION_SETTINGS: AdminNotificationSettings = {
  adminNotificationEnabled: true,
  adminNotificationSoundEnabled: true,
  adminNotificationWebEnabled: true,
  adminNotificationMobileEnabled: true,
  alertCooldownSeconds: 300,
  manualQueueThreshold: 5,
  staleTaskMinutes: 120,
  pendingPayoutMinutes: 30,
  userAnomalyThreshold: 3,
  rewardAnomalyThreshold: 1,
  rewardAnomalyLookbackMinutes: 120,
}

export function normalizeAdminNotificationSettings(raw?: Partial<AdminNotificationSettings>): AdminNotificationSettings {
  return {
    adminNotificationEnabled: raw?.adminNotificationEnabled !== false,
    adminNotificationSoundEnabled: raw?.adminNotificationSoundEnabled !== false,
    adminNotificationWebEnabled: raw?.adminNotificationWebEnabled !== false,
    adminNotificationMobileEnabled: raw?.adminNotificationMobileEnabled !== false,
    alertCooldownSeconds: Number(raw?.alertCooldownSeconds || DEFAULT_ADMIN_NOTIFICATION_SETTINGS.alertCooldownSeconds),
    manualQueueThreshold: Number(raw?.manualQueueThreshold || DEFAULT_ADMIN_NOTIFICATION_SETTINGS.manualQueueThreshold),
    staleTaskMinutes: Number(raw?.staleTaskMinutes || DEFAULT_ADMIN_NOTIFICATION_SETTINGS.staleTaskMinutes),
    pendingPayoutMinutes: Number(raw?.pendingPayoutMinutes || DEFAULT_ADMIN_NOTIFICATION_SETTINGS.pendingPayoutMinutes),
    userAnomalyThreshold: Number(raw?.userAnomalyThreshold || DEFAULT_ADMIN_NOTIFICATION_SETTINGS.userAnomalyThreshold),
    rewardAnomalyThreshold: Number(raw?.rewardAnomalyThreshold || DEFAULT_ADMIN_NOTIFICATION_SETTINGS.rewardAnomalyThreshold),
    rewardAnomalyLookbackMinutes: Number(raw?.rewardAnomalyLookbackMinutes || DEFAULT_ADMIN_NOTIFICATION_SETTINGS.rewardAnomalyLookbackMinutes),
  }
}

export function loadAdminNotificationSettings(): AdminNotificationSettings {
  if (typeof window === 'undefined') return DEFAULT_ADMIN_NOTIFICATION_SETTINGS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_ADMIN_NOTIFICATION_SETTINGS
    return normalizeAdminNotificationSettings(JSON.parse(raw))
  } catch {
    return DEFAULT_ADMIN_NOTIFICATION_SETTINGS
  }
}

export function saveAdminNotificationSettings(settings: Partial<AdminNotificationSettings>): AdminNotificationSettings {
  const normalized = normalizeAdminNotificationSettings(settings)
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    window.dispatchEvent(new CustomEvent('admin-notification-settings-updated', {
      detail: normalized,
    }))
  }
  return normalized
}
