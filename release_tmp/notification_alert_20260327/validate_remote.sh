#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=/var/www/xiaohuangyu
BASE=http://127.0.0.1:5000
ADMIN_USER=admin
ADMIN_PASS=admin123

json_get() {
  local expr="$1"
  node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const obj=JSON.parse(s); const v=(function(){ return ${expr}; })(); if (typeof v === 'object') console.log(JSON.stringify(v)); else console.log(v ?? '');});"
}

status_of() {
  curl -s -o /dev/null -w '%{http_code}' "$1"
}

echo "[page] 5000_root $(status_of http://127.0.0.1:5000/)"
echo "[page] 5001_admin_login $(status_of http://127.0.0.1:5001/admin/login/)"
echo "[page] 5001_admin_notifications $(status_of http://127.0.0.1:5001/admin/notifications)"
echo "[page] 5001_admin_alerts $(status_of http://127.0.0.1:5001/admin/alerts)"
echo "[page] 5001_admin_notification_settings $(status_of http://127.0.0.1:5001/admin/config-center/notifications)"
echo "[page] 5002_root $(status_of http://127.0.0.1:5002/)"
echo "[page] 5002_notifications $(status_of http://127.0.0.1:5002/notifications)"
echo "[page] 5002_notification_settings $(status_of http://127.0.0.1:5002/notification-settings)"
echo "[page] 5002_admin_notifications $(status_of http://127.0.0.1:5002/admin/notifications)"
echo "[page] 5002_admin_alerts $(status_of http://127.0.0.1:5002/admin/alerts)"

ADMIN_JSON=$(curl -s -X POST "$BASE/api/admin-v2/auth/login" -H 'Content-Type: application/json' -d '{"username":"'"$ADMIN_USER"'","password":"'"$ADMIN_PASS"'"}')
USER_JSON=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"username":"'"$ADMIN_USER"'","password":"'"$ADMIN_PASS"'"}')

echo "[admin_login] $ADMIN_JSON"
echo "[user_login] $USER_JSON"

ADMIN_TOKEN=$(printf '%s' "$ADMIN_JSON" | json_get 'obj.data.token')
USER_TOKEN=$(printf '%s' "$USER_JSON" | json_get 'obj.data.token')
USER_ID=$(printf '%s' "$USER_JSON" | json_get 'obj.data.user.id')

ADMIN_UNREAD_BEFORE=$(curl -s "$BASE/api/admin-v2/admin-notifications/unread-count" -H "Authorization: Bearer $ADMIN_TOKEN")
ALERT_STATS_BEFORE=$(curl -s "$BASE/api/admin-v2/alerts/stats" -H "Authorization: Bearer $ADMIN_TOKEN")
USER_UNREAD_BEFORE=$(curl -s "$BASE/api/user-notifications/unread-count" -H "Authorization: Bearer $USER_TOKEN")
USER_SETTINGS=$(curl -s "$BASE/api/settings/notifications" -H "Authorization: Bearer $USER_TOKEN")
ADMIN_SETTINGS=$(curl -s "$BASE/api/admin-v2/notification-settings" -H "Authorization: Bearer $ADMIN_TOKEN")

echo "[admin_unread_before] $ADMIN_UNREAD_BEFORE"
echo "[alert_stats_before] $ALERT_STATS_BEFORE"
echo "[user_unread_before] $USER_UNREAD_BEFORE"
echo "[user_settings] $USER_SETTINGS"
echo "[admin_settings] $ADMIN_SETTINGS"

SMOKE_JSON=$(SMOKE_USER_ID="$USER_ID" node --env-file=$ROOT/backend/.env --input-type=module <<'NODE' | tail -n 1
import db from '/var/www/xiaohuangyu/backend/src/config/database.js'
import notificationService from '/var/www/xiaohuangyu/backend/src/services/notificationService.js'
import alertService from '/var/www/xiaohuangyu/backend/src/services/alertService.js'
const now = new Date().toISOString()
const adminNotification = await notificationService.sendAdminNotification({
  type: 'system_alert',
  title: '[部署烟测] 管理员通知',
  content: `通知告警系统部署烟测 ${now}`,
  data: { smoke: true, now },
  priority: 'high',
})
const alert = await alertService.createAlert({
  type: 'deploy_smoke',
  severity: 'low',
  title: '[部署烟测] 管理员告警',
  message: `通知告警系统告警烟测 ${now}`,
  source: 'deploy_validation',
  metadata: { smoke: true, now },
})
const userNotification = await notificationService.sendUserNotification({
  userId: BigInt(process.env.SMOKE_USER_ID),
  type: 'points_awarded',
  title: '[部署烟测] 用户通知',
  content: `通知告警系统用户烟测 ${now}`,
  data: { smoke: true, now },
  priority: 'normal',
})
console.log(JSON.stringify({
  adminNotificationId: String(adminNotification.id),
  alertId: String(alert.id),
  userNotificationId: String(userNotification.id)
}))
await db.pool.end()
process.exit(0)
NODE
)

echo "[smoke_ids] $SMOKE_JSON"
ADMIN_NOTIFICATION_ID=$(printf '%s' "$SMOKE_JSON" | json_get 'obj.adminNotificationId')
ALERT_ID=$(printf '%s' "$SMOKE_JSON" | json_get 'obj.alertId')
USER_NOTIFICATION_ID=$(printf '%s' "$SMOKE_JSON" | json_get 'obj.userNotificationId')

ADMIN_LIST=$(curl -s "$BASE/api/admin-v2/admin-notifications?page=1&size=10" -H "Authorization: Bearer $ADMIN_TOKEN")
ALERT_LIST=$(curl -s "$BASE/api/admin-v2/alerts?page=1&size=10" -H "Authorization: Bearer $ADMIN_TOKEN")
USER_LIST=$(curl -s "$BASE/api/user-notifications?page=1&pageSize=10" -H "Authorization: Bearer $USER_TOKEN")

echo "[admin_list] $ADMIN_LIST"
echo "[alert_list] $ALERT_LIST"
echo "[user_list] $USER_LIST"

echo "$ADMIN_LIST" | grep -q "$ADMIN_NOTIFICATION_ID"
echo "$ALERT_LIST" | grep -q "$ALERT_ID"
echo "$USER_LIST" | grep -q "$USER_NOTIFICATION_ID"

echo "[admin_mark_read] $(curl -s -X POST "$BASE/api/admin-v2/admin-notifications/$ADMIN_NOTIFICATION_ID/read" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json')"
echo "[alert_handle] $(curl -s -X POST "$BASE/api/admin-v2/alerts/$ALERT_ID/handle" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"action":"resolve","note":"部署烟测已确认"}')"
echo "[user_mark_read] $(curl -s -X POST "$BASE/api/user-notifications/$USER_NOTIFICATION_ID/read" -H "Authorization: Bearer $USER_TOKEN" -H 'Content-Type: application/json')"

echo "[user_settings_save] $(curl -s -X PUT "$BASE/api/settings/notifications" -H "Authorization: Bearer $USER_TOKEN" -H 'Content-Type: application/json' -d "$(printf '%s' "$USER_SETTINGS" | json_get 'JSON.stringify(obj.data)')")"
echo "[admin_settings_save] $(curl -s -X POST "$BASE/api/admin-v2/notification-settings" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' -d "$(printf '%s' "$ADMIN_SETTINGS" | json_get 'JSON.stringify(obj.data)')")"

echo "[admin_unread_after] $(curl -s "$BASE/api/admin-v2/admin-notifications/unread-count" -H "Authorization: Bearer $ADMIN_TOKEN")"
echo "[alert_stats_after] $(curl -s "$BASE/api/admin-v2/alerts/stats" -H "Authorization: Bearer $ADMIN_TOKEN")"
echo "[user_unread_after] $(curl -s "$BASE/api/user-notifications/unread-count" -H "Authorization: Bearer $USER_TOKEN")"

echo smoke_validation_ok
