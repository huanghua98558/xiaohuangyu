#!/bin/bash
set -Eeuo pipefail

# 后端构建脚本
# v3.0 独立服务模式：仅构建后端服务

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo "小黄鱼任务中心 - 后端构建"
echo "========================================"

# 0. 安装 Playwright 系统依赖（需要 root 权限）
echo ""
echo "[0/3] 安装 Playwright 系统依赖..."
if command -v apt-get &> /dev/null; then
  apt-get update -qq
  apt-get install -y -qq \
    libatk1.0-0 libatk-bridge2.0-0 libxkbcommon0 libatspi2.0-0 \
    libxcomposite1 libxdamage1 libxfixes3 libgbm1 libpango-1.0-0 \
    libasound2t64 libcups2 libdrm2 libxkbfile1 libxrandr2 \
    libxshmfence1 libgtk-3-0 libnss3 libnspr4 libxss1 2>/dev/null || {
    echo "⚠️  系统依赖安装失败，浏览器自动化功能可能不可用"
  }
fi

# 1. 安装后端依赖
echo ""
echo "[1/3] 安装后端依赖..."
cd "${PROJECT_DIR}"
pnpm install --prefer-frozen-lockfile --prefer-offline

# 2. 安装 Playwright 浏览器
echo ""
echo "[2/3] 安装 Playwright 浏览器..."
npx playwright install chromium 2>/dev/null || {
  echo "⚠️  Playwright 浏览器安装失败，浏览器自动化功能可能不可用"
}

# 3. 验证
echo ""
echo "[3/3] 验证构建..."
if [ -f "${PROJECT_DIR}/src/app.js" ]; then
  echo "✅ 后端构建成功"
else
  echo "❌ 后端构建失败"
  exit 1
fi

# 验证 Playwright
echo ""
echo "验证 Playwright 浏览器..."
if [ -d "${HOME}/.cache/ms-playwright/chromium_headless_shell-"* ] || [ -d "${HOME}/.cache/ms-playwright/chromium-"* ]; then
  echo "✅ Playwright 浏览器安装成功"
else
  echo "⚠️  Playwright 浏览器未安装，浏览器自动化功能可能不可用"
fi

echo ""
echo "========================================"
echo "构建完成！"
echo "========================================"
echo ""
echo "启动命令:"
echo "  后端: node src/app.js (端口 8080)"
echo "  管理后台: cd ../admin && pnpm start --port 5001"
