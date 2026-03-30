#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=/var/www/xiaohuangyu
REL=$ROOT/release_tmp/notification_fixed_audio_20260327
ADMIN_BAK=$ROOT/admin/backup/notification_fixed_audio_20260327
USER_BAK=$ROOT/user-app/backup/notification_fixed_audio_20260327

mkdir -p "$REL" "$ADMIN_BAK" "$USER_BAK" "$ROOT/admin/public/sounds" "$ROOT/user-app/public/sounds"
cd "$REL"

tar -xzf admin.tar.gz
tar -xzf user-app.tar.gz

cp "$ROOT/admin/src/lib/notification-sound.ts" "$ADMIN_BAK/notification-sound.ts.bak"
cp "$ROOT/user-app/src/services/notificationSound.js" "$USER_BAK/notificationSound.js.bak"
[ -f "$ROOT/admin/public/sounds/notification.wav" ] && cp "$ROOT/admin/public/sounds/notification.wav" "$ADMIN_BAK/notification.wav.bak" || true
[ -f "$ROOT/admin/public/sounds/alert.wav" ] && cp "$ROOT/admin/public/sounds/alert.wav" "$ADMIN_BAK/alert.wav.bak" || true
[ -f "$ROOT/user-app/public/sounds/notification.wav" ] && cp "$ROOT/user-app/public/sounds/notification.wav" "$USER_BAK/notification.wav.bak" || true
[ -f "$ROOT/user-app/public/sounds/alert.wav" ] && cp "$ROOT/user-app/public/sounds/alert.wav" "$USER_BAK/alert.wav.bak" || true

install -m 644 "$REL/admin/src/lib/notification-sound.ts" "$ROOT/admin/src/lib/notification-sound.ts"
install -m 644 "$REL/user-app/src/services/notificationSound.js" "$ROOT/user-app/src/services/notificationSound.js"

install -m 644 "$REL/admin/public/sounds/notification.wav" "$ROOT/admin/public/sounds/notification.wav"
install -m 644 "$REL/admin/public/sounds/task.wav" "$ROOT/admin/public/sounds/task.wav"
install -m 644 "$REL/admin/public/sounds/points.wav" "$ROOT/admin/public/sounds/points.wav"
install -m 644 "$REL/admin/public/sounds/alert.wav" "$ROOT/admin/public/sounds/alert.wav"

install -m 644 "$REL/user-app/public/sounds/notification.wav" "$ROOT/user-app/public/sounds/notification.wav"
install -m 644 "$REL/user-app/public/sounds/task.wav" "$ROOT/user-app/public/sounds/task.wav"
install -m 644 "$REL/user-app/public/sounds/points.wav" "$ROOT/user-app/public/sounds/points.wav"
install -m 644 "$REL/user-app/public/sounds/alert.wav" "$ROOT/user-app/public/sounds/alert.wav"

cd "$ROOT/admin"
pnpm exec next build >/tmp/notification_fixed_audio_admin_build.log 2>&1

cd "$ROOT/user-app"
npm run build >/tmp/notification_fixed_audio_user_build.log 2>&1

pm2 restart xiaohuangyu-admin >/tmp/notification_fixed_audio_admin_restart.log 2>&1
pm2 restart xiaohuangyu-user-app >/tmp/notification_fixed_audio_user_restart.log 2>&1

echo deploy_fixed_audio_ok
