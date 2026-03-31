#!/usr/bin/env python3
import re

# 读取文件
with open('/var/www/xiaohuangyu/admin/src/components/data-center/DataCenter.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 添加状态变量（如果还没有）
if 'todayRealtimeData' not in content:
    content = content.replace(
        'const [isFullscreen, setIsFullscreen] = useState(false)',
        '''const [isFullscreen, setIsFullscreen] = useState(false)
  const [todayRealtimeData, setTodayRealtimeData] = useState<any[]>([])'''
    )
    print("✅ 状态变量已添加")

# 2. 添加 WebSocket 消息处理
old_message = '''if (data.type === 'stats_update') {
            // 直接使用广播数据中的在线用户数（实时更新）
            if (data.data && typeof data.data.onlineUsers === 'number') {
              mutate('/api/admin-v2/stats', (prev) => ({...prev, onlineUsers: data.data.onlineUsers}), false)
            }
            refreshRef.current()
            setLastUpdate(new Date())
          } else if (data.type === 'heartbeat_ack') {'''

new_message = '''if (data.type === 'stats_update') {
            // 直接使用广播数据中的在线用户数（实时更新）
            if (data.data && typeof data.data.onlineUsers === 'number') {
              mutate('/api/admin-v2/stats', (prev) => ({...prev, onlineUsers: data.data.onlineUsers}), false)
            }
            refreshRef.current()
            setLastUpdate(new Date())
          } else if (data.type === 'today_realtime_trend') {
            // 处理今日实时趋势数据
            if (data.data && data.data.data) {
              setTodayRealtimeData(data.data.data)
              setLastUpdate(new Date(data.data.lastUpdated))
            }
          } else if (data.type === 'realtime_stats') {
            // 处理实时统计数据
            if (data.data) {
              mutate('/api/admin-v2/stats', (prev) => ({
                ...prev,
                onlineUsers: data.data.onlineUsers || prev?.onlineUsers
              }), false)
            }
            setLastUpdate(new Date())
          } else if (data.type === 'heartbeat_ack') {'''

if old_message in content:
    content = content.replace(old_message, new_message)
    print("✅ WebSocket 消息处理已添加")
else:
    print("❌ 未找到旧消息处理代码")

# 写入文件
with open('/var/www/xiaohuangyu/admin/src/components/data-center/DataCenter.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ 前端代码更新完成！")
