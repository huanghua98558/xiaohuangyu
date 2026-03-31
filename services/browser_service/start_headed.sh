#!/bin/bash
# 有头浏览器服务启动脚本 (Xvfb 虚拟显示)

echo "[启动] 有头浏览器服务 (Xvfb)"

# 设置环境变量
export DISPLAY=:99
export QT_QPA_PLATFORM=offscreen

# 启动虚拟显示
Xvfb :99 -screen 0 1920x1080x24 -ac &
XVFB_PID=$!
echo "[启动] Xvfb 进程: $XVFB_PID"

# 等待 Xvfb 启动
sleep 2

# 启动多个浏览器服务实例 (端口 8000-8002)
cd /var/www/xiaohuangyu/services/browser_service

# 实例 1 (端口 8000)
echo "[启动] 浏览器服务实例 1 (端口 8000)"
xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24" python3 app.py 8000 &
PID1=$!

sleep 3

# 实例 2 (端口 8001)
echo "[启动] 浏览器服务实例 2 (端口 8001)"
xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24" python3 app.py 8001 &
PID2=$!

sleep 3

# 实例 3 (端口 8002)
echo "[启动] 浏览器服务实例 3 (端口 8002)"
xvfb-run --auto-servernum --server-args="-screen 0 1920x1080x24" python3 app.py 8002 &
PID3=$!

echo "[启动] ✅ 所有实例已启动"
echo "[启动] PIDs: $PID1, $PID2, $PID3"

# 等待所有进程
wait
