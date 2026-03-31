<template>
  <div class="notifications-page">
    <!-- 页面头部 -->
    <header class="page-header">
      <button class="back-btn" @click="$router.back()">
        <span>←</span>
      </button>
      <h1>消息中心</h1>
      <button class="read-all-btn" @click="markAllAsRead" v-if="unreadCount > 0">
        全部已读
      </button>
    </header>

    <!-- 分类标签 -->
    <div class="tabs">
      <div 
        class="tab" 
        :class="{ active: activeType === '' }" 
        @click="activeType = ''"
      >
        全部
        <span class="badge" v-if="unreadCount > 0">{{ unreadCount }}</span>
      </div>
      <div 
        class="tab" 
        :class="{ active: activeType === 'system' }" 
        @click="activeType = 'system'"
      >
        系统
      </div>
      <div 
        class="tab" 
        :class="{ active: activeType === 'task' }" 
        @click="activeType = 'task'"
      >
        任务
      </div>
    </div>

    <!-- 加载状态 -->
    <div class="loading" v-if="loading">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- 通知列表 -->
    <div class="notifications-list" v-else>
      <div 
        class="notification-item" 
        :class="{ unread: !n.is_read }"
        v-for="n in notifications" 
        :key="n.id"
        @click="handleClick(n)"
      >
        <div class="notification-icon">
          {{ getIcon(n.type) }}
        </div>
        <div class="notification-content">
          <div class="notification-title">{{ n.title }}</div>
          <div class="notification-text" v-if="n.content">{{ n.content }}</div>
          <div class="notification-time">{{ formatTime(n.created_at) }}</div>
        </div>
        <span class="unread-dot" v-if="!n.is_read"></span>
      </div>

      <div class="empty" v-if="notifications.length === 0">
        <span class="empty-icon">📭</span>
        <span>暂无消息</span>
      </div>

      <div class="load-more" v-if="hasMore && !loading" @click="loadMore">
        加载更多
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { fetchNotifications, fetchUnreadCount, markAsRead, markAllRead } from '../api/notification'
import { useNotification } from '../store/notification'
import { wsService } from '../services/websocket'

const router = useRouter()
const { unreadCount, refreshUnreadCount, clearUnreadCount } = useNotification()

const loading = ref(true)
const notifications = ref([])
const activeType = ref('')
const page = ref(1)
const hasMore = ref(true)

const loadNotifications = async () => {
  loading.value = true
  try {
    const data = await fetchNotifications({ 
      page: page.value, 
      size: 20,
      type: activeType.value || undefined 
    })
    if (page.value === 1) {
      notifications.value = data.list
    } else {
      notifications.value.push(...data.list)
    }
    hasMore.value = data.list.length >= 20
  } catch (e) {
    console.error('加载通知失败', e)
  } finally {
    loading.value = false
  }
}

const loadUnreadCount = async () => {
  await refreshUnreadCount()
}

const handleClick = async (n) => {
  if (!n.is_read) {
    await markAsRead(n.id)
    n.is_read = true
    // 使用全局状态更新
    refreshUnreadCount()
  }
  
  // 根据类型跳转
  if (n.type === 'task' && n.data?.taskId) {
    router.push(`/my-tasks`)
  }
}

const markAllAsRead = async () => {
  try {
    await markAllRead()
    notifications.value.forEach(n => n.is_read = true)
    await refreshUnreadCount()
  } catch (e) {
    console.error('标记全部已读失败', e)
  }
}

const loadMore = () => {
  page.value++
  loadNotifications()
}

const getIcon = (type) => {
  const icons = {
    system: '📢',
    task: '📋',
    points: '💰',
    achievement: '🏆'
  }
  return icons[type] || '🔔'
}

const formatTime = (time) => {
  const date = new Date(time)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
  
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

// 处理实时通知更新
const handleNewNotification = (data) => {
  console.log('[Notifications] 收到新通知:', data)
  // 将新通知添加到列表顶部
  if (page.value === 1 && (!activeType.value || data.type === activeType.value)) {
    notifications.value.unshift({
      id: data.id || Date.now(),
      type: data.type || 'system',
      title: data.title,
      content: data.content,
      is_read: false,
      created_at: new Date().toISOString(),
      data: data.data
    })
  }
}

watch(activeType, () => {
  page.value = 1
  loadNotifications()
})

onMounted(() => {
  loadNotifications()
  loadUnreadCount()
  
  // 订阅实时通知
  wsService.on('notification', handleNewNotification)
})

onUnmounted(() => {
  wsService.off('notification', handleNewNotification)
})
</script>

<style scoped>
.notifications-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 80px;
}

.page-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #fff;
  border-bottom: 1px solid #eee;
}

.back-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: #f5f5f5;
  border-radius: 50%;
  font-size: 18px;
  cursor: pointer;
}

.page-header h1 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.read-all-btn {
  padding: 6px 12px;
  border: none;
  background: #3f51b5;
  color: #fff;
  border-radius: 16px;
  font-size: 12px;
  cursor: pointer;
}

.tabs {
  display: flex;
  background: #fff;
  padding: 12px 16px;
  gap: 12px;
  border-bottom: 1px solid #eee;
}

.tab {
  position: relative;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  color: #666;
  background: #f5f5f5;
  cursor: pointer;
  transition: all 0.2s;
}

.tab.active {
  background: #3f51b5;
  color: #fff;
}

.tab .badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: #f44336;
  color: #fff;
  font-size: 10px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 0;
  color: #666;
  gap: 12px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e0e0e0;
  border-top-color: #3f51b5;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.notifications-list {
  padding: 12px;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: #fff;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 10px;
  cursor: pointer;
  transition: background 0.2s;
  position: relative;
}

.notification-item:hover {
  background: #fafafa;
}

.notification-item.unread {
  background: #f0f4ff;
}

.notification-icon {
  width: 40px;
  height: 40px;
  background: #f5f5f5;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-size: 15px;
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;
}

.notification-text {
  font-size: 13px;
  color: #666;
  margin-bottom: 6px;
  line-height: 1.5;
}

.notification-time {
  font-size: 12px;
  color: #999;
}

.unread-dot {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 8px;
  height: 8px;
  background: #f44336;
  border-radius: 50%;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 0;
  color: #999;
  gap: 8px;
}

.empty-icon {
  font-size: 48px;
}

.load-more {
  text-align: center;
  padding: 16px;
  color: #3f51b5;
  cursor: pointer;
}
</style>
