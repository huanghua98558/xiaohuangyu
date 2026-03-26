#!/usr/bin/env bash
set -Eeuo pipefail
ROOT=/var/www/xiaohuangyu
REL=$ROOT/release_tmp/notification_alert_20260327
BACKEND_BAK=$ROOT/backend/backup/notification_alert_20260327
ADMIN_BAK=$ROOT/admin/backup/notification_alert_20260327
USER_BAK=$ROOT/user-app/backup/notification_alert_20260327

cd "$REL"
[ -f backend.tar.gz ] && tar -xzf backend.tar.gz
[ -f admin.tar.gz ] && tar -xzf admin.tar.gz
[ -f user-app.tar.gz ] && tar -xzf user-app.tar.gz

backend_files=(
  src/services/notificationService.js
  src/services/alertService.js
  src/services/alertEngine.js
  src/services/cronService.js
  src/routes/adminRoutes.js
  src/routes/notificationRoutes.js
  src/routes/userNotificationRoutes.js
  src/routes/settingsRoutes.js
  src/services/userService.js
  src/services/walletService.js
  src/services/pointsSettlementService.js
  src/workers/imageReviewWorker.js
  src/workers/linkVerifyWorker.js
  src/services/signInService.js
  src/services/achievementService.js
  src/services/promotionService.js
  src/services/leaderboardSnapshotService.js
  src/services/adminService.js
  src/constants/taskActions.js
)

admin_files=(
  src/components/notification/NotificationPopover.tsx
  src/app/\(admin\)/notifications/page.tsx
  src/app/\(admin\)/alerts/page.tsx
  src/app/\(admin\)/config-center/notifications/page.tsx
  src/app/\(admin\)/config-center/layout.tsx
  src/app/admin-layout.tsx
  src/lib/admin-notification-settings.ts
  src/lib/notification-sound.ts
)

user_files=(
  src/api/notification.js
  src/api/settings.js
  src/api/adminNotification.js
  src/store/notification.js
  src/services/notificationSound.js
  src/views/Notifications.vue
  src/views/NotificationSettings.vue
  src/views/AdminNotifications.vue
  src/views/AdminAlerts.vue
  src/views/My.vue
  src/router/index.js
)

backup_and_install() {
  local base="$1"
  local rel_src_prefix="$2"
  local backup_root="$3"
  shift 3
  local files=("$@")
  local f src target bak
  for f in "${files[@]}"; do
    src="$REL/$rel_src_prefix/$f"
    target="$base/$f"
    bak="$backup_root/$f"
    if [ ! -f "$src" ]; then
      echo "[skip-missing-src] $src"
      continue
    fi
    mkdir -p "$(dirname "$target")" "$(dirname "$bak")"
    if [ -f "$target" ]; then
      cp "$target" "$bak"
      echo "[backup] $target -> $bak"
    else
      echo "[new-file] $target"
    fi
    install -D -m 644 "$src" "$target"
    echo "[install] $src -> $target"
  done
}

backup_and_install "$ROOT/backend" backend "$BACKEND_BAK" "${backend_files[@]}"
backup_and_install "$ROOT/admin" admin "$ADMIN_BAK" "${admin_files[@]}"
backup_and_install "$ROOT/user-app" user-app "$USER_BAK" "${user_files[@]}"

cd "$ROOT/backend"
node --env-file=.env --input-type=module <<'NODE'
import db from './src/config/database.js'
const queries = [
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_enabled BOOL DEFAULT true`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_sound_enabled BOOL DEFAULT true`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS review_notification_enabled BOOL DEFAULT true`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS points_notification_enabled BOOL DEFAULT true`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS withdraw_notification_enabled BOOL DEFAULT true`,
  `ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS data JSONB`,
  `ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS priority STRING DEFAULT 'normal'`,
  `ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP`,
]
for (const sql of queries) {
  await db.query(sql)
  console.log('[db]', sql)
}
const checks = [
  ['users','notification_enabled'],
  ['users','notification_sound_enabled'],
  ['users','review_notification_enabled'],
  ['users','points_notification_enabled'],
  ['users','withdraw_notification_enabled'],
  ['user_notifications','data'],
  ['user_notifications','priority'],
  ['admin_notifications','read_at'],
]
for (const [table, column] of checks) {
  const sql = `SELECT COUNT(*)::int AS count FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${column}'`
  const res = await db.query(sql)
  console.log('[column]', table, column, res.rows?.[0]?.count ?? 0)
}
NODE

echo deploy_files_ok
