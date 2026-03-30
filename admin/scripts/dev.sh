#!/bin/bash
set -Eeuo pipefail

# 管理后台开发脚本 - 独立服务模式
# v3.0 架构：端口 5001

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADMIN_DIR="$(dirname "$SCRIPT_DIR")"
PORT=5001
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-$PORT}"

cd "${ADMIN_DIR}"

# 清理端口函数
kill_port_if_listening() {
    local pids
    pids=$(ss -H -lntp 2>/dev/null | awk -v port="${DEPLOY_RUN_PORT}" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | paste -sd' ' - || true)
    if [[ -z "${pids}" ]]; then
      echo "Port ${DEPLOY_RUN_PORT} is free."
      return
    fi
    echo "Port ${DEPLOY_RUN_PORT} in use by PIDs: ${pids} (SIGKILL)"
    echo "${pids}" | xargs -I {} kill -9 {}
    sleep 1
    pids=$(ss -H -lntp 2>/dev/null | awk -v port="${DEPLOY_RUN_PORT}" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | paste -sd' ' - || true)
    if [[ -n "${pids}" ]]; then
      echo "Warning: port ${DEPLOY_RUN_PORT} still busy after SIGKILL, PIDs: ${pids}"
    else
      echo "Port ${DEPLOY_RUN_PORT} cleared."
    fi
}

echo "========================================"
echo "小黄鱼管理后台 - 开发服务"
echo "========================================"
echo "清理端口 ${DEPLOY_RUN_PORT}..."
kill_port_if_listening

echo ""
echo "启动开发服务器..."
echo "访问地址: http://localhost:${DEPLOY_RUN_PORT}/admin"
echo ""

npx next dev --webpack --port ${DEPLOY_RUN_PORT} --hostname 0.0.0.0
