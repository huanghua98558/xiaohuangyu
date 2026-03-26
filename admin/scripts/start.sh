#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
PORT=5001
DEPLOY_RUN_PORT="${DEPLOY_RUN_PORT:-$PORT}"

cd "${COZE_WORKSPACE_PATH}"

echo "========================================"
echo "小黄鱼管理后台 - 生产服务"
echo "========================================"
echo "启动端口: ${DEPLOY_RUN_PORT}"
echo ""

npx next start --port ${DEPLOY_RUN_PORT} --hostname 0.0.0.0
