#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=/var/www/xiaohuangyu
REL=$ROOT/release_tmp/notification_stronger_audio_20260327
ADMIN_BAK=$ROOT/admin/backup/notification_stronger_audio_20260327
USER_BAK=$ROOT/user-app/backup/notification_stronger_audio_20260327

mkdir -p "$REL" "$ADMIN_BAK" "$USER_BAK" "$ROOT/admin/public/sounds" "$ROOT/user-app/public/sounds" "$ROOT/backend/public/user/sounds"
cd "$REL"

tar -xzf admin.tar.gz
tar -xzf user-app.tar.gz

cp "$ROOT/admin/src/lib/notification-sound.ts" "$ADMIN_BAK/notification-sound.ts.bak"
cp "$ROOT/user-app/src/services/notificationSound.js" "$USER_BAK/notificationSound.js.bak"

install -m 644 "$REL/admin/src/lib/notification-sound.ts" "$ROOT/admin/src/lib/notification-sound.ts"
install -m 644 "$REL/user-app/src/services/notificationSound.js" "$ROOT/user-app/src/services/notificationSound.js"

for name in notification-strong.wav task-strong.wav points-strong.wav alert-strong.wav; do
  install -m 644 "$REL/admin/public/sounds/$name" "$ROOT/admin/public/sounds/$name"
  install -m 644 "$REL/user-app/public/sounds/$name" "$ROOT/user-app/public/sounds/$name"
  install -m 644 "$REL/user-app/public/sounds/$name" "$ROOT/backend/public/user/sounds/$name"
done

cd "$ROOT/admin"
pnpm exec next build >/tmp/notification_stronger_audio_admin_build.log 2>&1

cd "$ROOT/user-app"
npm run build >/tmp/notification_stronger_audio_user_build.log 2>&1

pm2 restart xiaohuangyu-admin >/tmp/notification_stronger_audio_admin_restart.log 2>&1
pm2 restart xiaohuangyu-user-app >/tmp/notification_stronger_audio_user_restart.log 2>&1

echo deploy_stronger_audio_ok
