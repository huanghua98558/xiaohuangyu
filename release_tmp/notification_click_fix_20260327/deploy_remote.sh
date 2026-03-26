#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=/var/www/xiaohuangyu
REL=$ROOT/release_tmp/notification_click_fix_20260327
ADMIN_BAK=$ROOT/admin/backup/notification_click_fix_20260327
USER_BAK=$ROOT/user-app/backup/notification_click_fix_20260327

mkdir -p "$REL" "$ADMIN_BAK" "$USER_BAK"
cd "$REL"

tar -xzf admin.tar.gz
tar -xzf user-app.tar.gz

cp "$ROOT/admin/src/lib/notification-sound.ts" "$ADMIN_BAK/notification-sound.ts.bak"
cp "$ROOT/admin/src/components/notification/NotificationPopover.tsx" "$ADMIN_BAK/NotificationPopover.tsx.bak"
cp "$ROOT/admin/src/app/(admin)/notifications/page.tsx" "$ADMIN_BAK/notifications.page.tsx.bak"
[ -f "$ROOT/admin/src/lib/notification-target.ts" ] && cp "$ROOT/admin/src/lib/notification-target.ts" "$ADMIN_BAK/notification-target.ts.bak" || true

cp "$ROOT/user-app/src/services/notificationSound.js" "$USER_BAK/notificationSound.js.bak"
cp "$ROOT/user-app/src/views/Notifications.vue" "$USER_BAK/Notifications.vue.bak"
cp "$ROOT/user-app/src/views/AdminNotifications.vue" "$USER_BAK/AdminNotifications.vue.bak"
[ -f "$ROOT/user-app/src/utils/notificationTarget.js" ] && cp "$ROOT/user-app/src/utils/notificationTarget.js" "$USER_BAK/notificationTarget.js.bak" || true

find "$ADMIN_BAK" -maxdepth 1 \( -name '*.ts' -o -name '*.tsx' \) -exec sh -c 'mv "$1" "$1.bak"' _ {} \;

install -m 644 "$REL/admin/src/lib/notification-sound.ts" "$ROOT/admin/src/lib/notification-sound.ts"
install -m 644 "$REL/admin/src/lib/notification-target.ts" "$ROOT/admin/src/lib/notification-target.ts"
install -m 644 "$REL/admin/src/components/notification/NotificationPopover.tsx" "$ROOT/admin/src/components/notification/NotificationPopover.tsx"
install -m 644 "$REL/admin/src/app/(admin)/notifications/page.tsx" "$ROOT/admin/src/app/(admin)/notifications/page.tsx"

install -m 644 "$REL/user-app/src/services/notificationSound.js" "$ROOT/user-app/src/services/notificationSound.js"
install -m 644 "$REL/user-app/src/utils/notificationTarget.js" "$ROOT/user-app/src/utils/notificationTarget.js"
install -m 644 "$REL/user-app/src/views/Notifications.vue" "$ROOT/user-app/src/views/Notifications.vue"
install -m 644 "$REL/user-app/src/views/AdminNotifications.vue" "$ROOT/user-app/src/views/AdminNotifications.vue"

cd "$ROOT/admin"
pnpm exec next build >/tmp/notification_click_admin_build.log 2>&1

cd "$ROOT/user-app"
npm run build >/tmp/notification_click_user_build.log 2>&1

pm2 restart xiaohuangyu-admin >/tmp/notification_click_admin_restart.log 2>&1
pm2 restart xiaohuangyu-user-app >/tmp/notification_click_user_restart.log 2>&1

echo deploy_click_fix_ok
