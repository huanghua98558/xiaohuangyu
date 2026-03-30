import db from '/var/www/xiaohuangyu/backend/src/config/database.js'
import notificationService from '/var/www/xiaohuangyu/backend/src/services/notificationService.js'
import alertService from '/var/www/xiaohuangyu/backend/src/services/alertService.js'

const BASE = 'http://127.0.0.1:5000'
const ADMIN = { username: 'admin', password: 'admin123' }
const now = new Date().toISOString()

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, options)
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text }
  }
  return { res, json }
}

async function headStatus(url) {
  const res = await fetch(url, { redirect: 'manual' })
  return res.status
}

const pageStatuses = {}
for (const url of [
  'http://127.0.0.1:5000/',
  'http://127.0.0.1:5001/admin/login/',
  'http://127.0.0.1:5001/admin/notifications',
  'http://127.0.0.1:5001/admin/alerts',
  'http://127.0.0.1:5001/admin/config-center/notifications',
  'http://127.0.0.1:5002/',
  'http://127.0.0.1:5002/notifications',
  'http://127.0.0.1:5002/notification-settings',
  'http://127.0.0.1:5002/admin/notifications',
  'http://127.0.0.1:5002/admin/alerts',
]) {
  pageStatuses[url] = await headStatus(url)
}

const adminLogin = await jsonFetch(`${BASE}/api/admin-v2/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(ADMIN),
})
assert(adminLogin.res.ok && adminLogin.json?.code === 0, `admin login failed: ${JSON.stringify(adminLogin.json)}`)
const adminToken = adminLogin.json.data.token
const adminUser = adminLogin.json.data.user

const userLogin = await jsonFetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(ADMIN),
})
assert(userLogin.res.ok && userLogin.json?.code === 0, `user login failed: ${JSON.stringify(userLogin.json)}`)
const userToken = userLogin.json.data.token
const userInfo = userLogin.json.data.user

const authHeaders = (token) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' })

const adminUnreadBefore = await jsonFetch(`${BASE}/api/admin/admin-v2/admin-notifications/unread-count`, { headers: authHeaders(adminToken) })
const alertStatsBefore = await jsonFetch(`${BASE}/api/admin/admin-v2/alerts/stats`, { headers: authHeaders(adminToken) })
const userUnreadBefore = await jsonFetch(`${BASE}/api/user-notifications/unread-count`, { headers: authHeaders(userToken) })
const userSettingsBefore = await jsonFetch(`${BASE}/api/settings/notifications`, { headers: authHeaders(userToken) })
const adminSettingsBefore = await jsonFetch(`${BASE}/api/admin/admin-v2/notification-settings`, { headers: authHeaders(adminToken) })

assert(adminUnreadBefore.json?.code === 0, 'admin unread-count api failed')
assert(alertStatsBefore.json?.code === 0, 'admin alerts stats api failed')
assert(userUnreadBefore.json?.code === 0, 'user unread-count api failed')
assert(userSettingsBefore.json?.code === 0, 'user settings get api failed')
assert(adminSettingsBefore.json?.code === 0, 'admin settings get api failed')

const smokeAdminNotification = await notificationService.sendAdminNotification({
  type: 'system_alert',
  title: '[部署烟测] 管理员通知',
  content: `通知告警系统部署烟测 ${now}`,
  data: { smoke: true, kind: 'admin_notification', now },
  priority: 'high',
})
assert(smokeAdminNotification?.id, 'failed to create admin smoke notification')

const smokeAlert = await alertService.createAlert({
  type: 'deploy_smoke',
  severity: 'low',
  title: '[部署烟测] 管理员告警',
  message: `通知告警系统告警烟测 ${now}`,
  source: 'deploy_validation',
  metadata: { smoke: true, now },
})
assert(smokeAlert?.id, 'failed to create smoke alert')

const smokeUserNotification = await notificationService.sendUserNotification({
  userId: BigInt(userInfo.id),
  type: 'points_awarded',
  title: '[部署烟测] 用户通知',
  content: `通知告警系统用户烟测 ${now}`,
  data: { smoke: true, kind: 'user_notification', now },
  priority: 'normal',
})
assert(smokeUserNotification?.id, 'failed to create user smoke notification')

const adminList = await jsonFetch(`${BASE}/api/admin/admin-v2/admin-notifications?page=1&size=10`, { headers: authHeaders(adminToken) })
const alertList = await jsonFetch(`${BASE}/api/admin/admin-v2/alerts?page=1&size=10`, { headers: authHeaders(adminToken) })
const userList = await jsonFetch(`${BASE}/api/user-notifications?page=1&pageSize=10`, { headers: authHeaders(userToken) })

assert(adminList.json?.code === 0, 'admin notifications list api failed')
assert(alertList.json?.code === 0, 'alerts list api failed')
assert(userList.json?.code === 0, 'user notifications list api failed')

const adminListItems = adminList.json.data?.list || []
const alertListItems = alertList.json.data?.list || []
const userListItems = userList.json.data?.list || []

assert(adminListItems.some(item => String(item.id) === String(smokeAdminNotification.id)), 'admin smoke notification not visible in api')
assert(alertListItems.some(item => String(item.id) === String(smokeAlert.id)), 'smoke alert not visible in api')
assert(userListItems.some(item => String(item.id) === String(smokeUserNotification.id)), 'user smoke notification not visible in api')

const adminRead = await jsonFetch(`${BASE}/api/admin/admin-v2/admin-notifications/${smokeAdminNotification.id}/read`, {
  method: 'POST',
  headers: authHeaders(adminToken),
})
assert(adminRead.json?.code === 0, 'admin mark-read failed')

const alertHandle = await jsonFetch(`${BASE}/api/admin/admin-v2/alerts/${smokeAlert.id}/handle`, {
  method: 'POST',
  headers: authHeaders(adminToken),
  body: JSON.stringify({ action: 'resolve', note: '部署烟测已确认' }),
})
assert(alertHandle.json?.code === 0, 'alert handle failed')

const userRead = await jsonFetch(`${BASE}/api/user-notifications/${smokeUserNotification.id}/read`, {
  method: 'POST',
  headers: authHeaders(userToken),
})
assert(userRead.json?.code === 0, 'user mark-read failed')

const userSettingsSave = await jsonFetch(`${BASE}/api/settings/notifications`, {
  method: 'PUT',
  headers: authHeaders(userToken),
  body: JSON.stringify(userSettingsBefore.json.data),
})
assert(userSettingsSave.json?.code === 0, 'user settings save failed')

const adminSettingsSave = await jsonFetch(`${BASE}/api/admin/admin-v2/notification-settings`, {
  method: 'POST',
  headers: authHeaders(adminToken),
  body: JSON.stringify(adminSettingsBefore.json.data),
})
assert(adminSettingsSave.json?.code === 0, 'admin settings save failed')

const adminUnreadAfter = await jsonFetch(`${BASE}/api/admin/admin-v2/admin-notifications/unread-count`, { headers: authHeaders(adminToken) })
const userUnreadAfter = await jsonFetch(`${BASE}/api/user-notifications/unread-count`, { headers: authHeaders(userToken) })
const alertStatsAfter = await jsonFetch(`${BASE}/api/admin/admin-v2/alerts/stats`, { headers: authHeaders(adminToken) })

const summary = {
  pageStatuses,
  adminUser,
  userInfo,
  adminUnreadBefore: adminUnreadBefore.json.data,
  adminUnreadAfter: adminUnreadAfter.json.data,
  userUnreadBefore: userUnreadBefore.json.data,
  userUnreadAfter: userUnreadAfter.json.data,
  alertStatsBefore: alertStatsBefore.json.data,
  alertStatsAfter: alertStatsAfter.json.data,
  smoke: {
    adminNotificationId: String(smokeAdminNotification.id),
    alertId: String(smokeAlert.id),
    userNotificationId: String(smokeUserNotification.id),
  },
  settings: {
    user: userSettingsSave.json.data,
    admin: adminSettingsSave.json.data,
  },
}

console.log(JSON.stringify(summary, null, 2))
await db.pool.end()
