#!/bin/bash
set -Eeuo pipefail

# 管理后台构建脚本 - 独立服务模式
# v3.0 架构：不再复制到后端，独立运行

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "${PROJECT_DIR}"

echo "========================================"
echo "小黄鱼管理后台 - 构建（独立服务模式）"
echo "========================================"
echo "Working directory: $(pwd)"

echo ""
echo "[1/2] 安装依赖..."
pnpm install --prefer-frozen-lockfile --prefer-offline

echo ""
echo "[2/2] 构建 Next.js 项目..."
npx next build

echo ""
echo "========================================"
echo "构建完成！"
echo "启动命令: pnpm start --port 5001"
echo "========================================"
