#!/bin/bash
# 本地不执行构建：只把源码同步到服务器；依赖安装、Next/Vite 构建、PM2 重启全部在服务器完成。
#
# 用法示例：
#   export SSHPASS='你的SSH密码'   # 密码登录时；推荐改用 SSH 公钥
#   ./scripts/deploy_to_server.sh
#
# 可选环境变量：
#   DEPLOY_SERVER=ubuntu@1.2.3.4
#   DEPLOY_REMOTE=/var/www/xiaohuangyu
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER="${DEPLOY_SERVER:-ubuntu@43.161.224.174}"
REMOTE="${DEPLOY_REMOTE:-/var/www/xiaohuangyu}"

EXCLUDES=(
  --exclude node_modules
  --exclude .next
  --exclude out
  --exclude dist
  --exclude .turbo
  --exclude coverage
  --exclude uploads
  --exclude .env
  --exclude .env.local
  --exclude .env.production.local
  --exclude '*.log'
)

SSH_BASE=(ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=60 -o ServerAliveInterval=30 -o ServerAliveCountMax=4)
if [[ -n "${SSHPASS:-}" ]]; then
  RSYNC_RSH="sshpass -e ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=60 -o ServerAliveInterval=30"
else
  RSYNC_RSH="ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=60 -o ServerAliveInterval=30"
fi

remote() {
  if [[ -n "${SSHPASS:-}" ]]; then
    SSHPASS="$SSHPASS" sshpass -e "${SSH_BASE[@]}" "$SERVER" "$@"
  else
    "${SSH_BASE[@]}" "$SERVER" "$@"
  fi
}

echo "=========================================="
echo "部署目标: ${SERVER}:${REMOTE}"
echo "=========================================="

push_dir() {
  local name="$1"
  echo ""
  echo "[同步] ${name}/"
  # -O 省略目录时间戳，避免远端目录无写权限时 rsync 以 23 退出
  rsync -avz -O "${EXCLUDES[@]}" -e "$RSYNC_RSH" \
    "${ROOT}/${name}/" "${SERVER}:${REMOTE}/${name}/"
}

push_dir backend
push_dir admin
if [[ -d "${ROOT}/user-app" ]]; then push_dir user-app; fi
if [[ -d "${ROOT}/server_scripts" ]]; then
  push_dir server_scripts || echo "[提示] server_scripts 同步跳过（远端目录权限不足时可忽略）"
fi

rsync -avz -O -e "$RSYNC_RSH" "${ROOT}/ecosystem.config.js" "${SERVER}:${REMOTE}/ecosystem.config.js"
"${SSH_BASE[@]}" "$SERVER" "mkdir -p '${REMOTE}/scripts'"
rsync -avz -O -e "$RSYNC_RSH" "${ROOT}/scripts/deploy_to_server.sh" "${SERVER}:${REMOTE}/scripts/deploy_to_server.sh"

echo ""
echo "[远程] 安装依赖、迁移、构建、修复、重启 PM2"
remote bash -s -- "$REMOTE" <<'REMOTE_EOF'
set -euo pipefail
REMOTE_ROOT="$1"
cd "$REMOTE_ROOT"

echo "[1/6] backend npm install"
cd "$REMOTE_ROOT/backend"
npm install --no-audit --no-fund

echo "[2/6] 执行积分联动迁移脚本"
if [[ -f "$REMOTE_ROOT/backend/scripts/runIntegratedPointsMigration.mjs" ]]; then
  node "$REMOTE_ROOT/backend/scripts/runIntegratedPointsMigration.mjs"
else
  echo "[提示] 跳过迁移（未找到 runIntegratedPointsMigration.mjs）"
fi

echo "[3/6] admin pnpm install + next build"
cd "$REMOTE_ROOT/admin"
if command -v corepack >/dev/null 2>&1; then
  corepack enable pnpm 2>/dev/null || true
fi
if ! command -v pnpm >/dev/null 2>&1; then
  npm install -g pnpm
fi
chmod +x scripts/start.sh 2>/dev/null || true
export BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:5000}"
pnpm install --no-frozen-lockfile
pnpm exec next build

echo "[4/6] user-app npm install + vite build（产物 → backend/public/user）"
if [[ -d "$REMOTE_ROOT/user-app" ]]; then
  cd "$REMOTE_ROOT/user-app"
  npm install --no-audit --no-fund
  npm run build
else
  echo "[提示] 跳过 user-app（目录不存在）"
fi

echo "[5/6] 历史积分修复脚本"
cd "$REMOTE_ROOT/backend"
node scripts/repairTaskPointsHistory.mjs

echo "[6/6] PM2：重启后端与管理后台"
cd "$REMOTE_ROOT"
pm2 restart ecosystem.config.js --only xiaohuangyu-backend 2>/dev/null || pm2 restart xiaohuangyu-backend
if pm2 describe xiaohuangyu-admin >/dev/null 2>&1; then
  pm2 restart xiaohuangyu-admin
else
  pm2 start ecosystem.config.js --only xiaohuangyu-admin
fi
pm2 save

echo "[post] 本机探测（忽略失败）"
curl -sS -o /dev/null -w "health HTTP %{http_code}\n" http://127.0.0.1:5000/health || true
curl -sS -o /dev/null -w "captcha HTTP %{http_code}\n" http://127.0.0.1:5000/api/admin-v2/auth/captcha || true
curl -sS -o /dev/null -w "admin next HTTP %{http_code}\n" http://127.0.0.1:5001/admin/login/ || true

echo "完成。"
REMOTE_EOF

echo ""
echo "=========================================="
echo "全部完成。请确认 Nginx："
echo "  - 管理后台页面反代到 http://127.0.0.1:5001（Next，含 /admin 与 /admin/_next）"
echo "  - 后端 API：5000；验证码 GET /api/admin-v2/auth/captcha 或 /admin/api/auth/captcha"
echo "=========================================="
