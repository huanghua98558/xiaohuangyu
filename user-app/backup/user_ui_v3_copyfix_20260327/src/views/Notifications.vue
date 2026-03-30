<template>
  <div class="yx-page no-tabbar notifications-page">
    <header class="yx-header center">
      <button class="yx-back-btn" @click="$router.back()">←</button>
      <div class="yx-header-main">
        <h1 class="yx-title sm">消息中心</h1>
        <p class="yx-subtitle">审核、积分、提现和系统消息分层展示，减少一屏过乱。</p>
      </div>
      <button class="yx-icon-btn" v-if="unreadCount > 0" @click="markAllAsRead">✓</button>
      <div class="yx-icon-btn" v-else>—</div>
    </header>

    <section class="yx-card">
      <div class="yx-segment">
        <button :class="{ active: activeType === '' }" @click="activeType = ''">全部 <span v-if="unreadCount > 0">({{ unreadCount }})</span></button>
        <button :class="{ active: activeType === 'system' }" @click="activeType = 'system'">系统</button>
        <button :class="{ active: activeType === 'task' }" @click="activeType = 'task'">任务</button>
      </div>
    </section>

    <div class="yx-empty" v-if="loading">
      <strong>加载中...</strong>
      <span>正在获取你的消息列表。</span>
    </div>

    <section class="notice-stack" v-else>
      <article
        class="yx-list-item notice-item"
        :class="{ unread: !n.is_read }"
        v-for="n in notifications"
        :key="n.id"
        @click="handleClick(n)"
      >
        <div class="yx-square-icon">{{ getIcon(n.type) }}</div>
        <div class="yx-list-main">
          <b>{{ n.title }}</b>
          <small>{{ n.content || '暂无补充说明' }}</small>
          <div class="notice-meta">
            <span>{{ formatTime(n.created_at) }}</span>
            <span>{{ getActionLabel(n) }} ›</span>
          </div>
        </div>
        <span class="notice-dot" v-if="!n.is_read"></span>
      </article>

      <div class="yx-empty" v-if="notifications.length === 0">
        <strong>暂无消息</strong>
        <span>新的审核结果、积分到账和提现进度都会显示在这里。</span>
      </div>

      <button class="yx-btn-ghost full" v-if="hasMore && !loading" @click="loadMore">加载更多</button>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { fetchNotifications, markAsRead, markAllRead } from '../api/notification'
import { useAuth } from '../store/auth'
import { useNotification } from '../store/notification'
import { wsService } from '../services/websocket'
import {
  getUserNotificationActionLabel,
  getUserNotificationTarget,
} from '../utils/notificationTarget'

const router = useRouter()
const { user } = useAuth()
const { unreadCount, refreshUnreadCount } = useNotification()

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
    if (page.value === 1) notifications.value = data.list
    else notifications.value.push(...data.list)
    hasMore.value = data.list.length >= 20
  } catch (e) {
    notifications.value = []
  } finally {
    loading.value = false
  }
}

const handleClick = async (n) => {
  if (!n.is_read) {
    await markAsRead(n.id)
    n.is_read = true
    await refreshUnreadCount()
  }

  const target = getUserNotificationTarget(n, user.value)
  if (target && target !== router.currentRoute.value.fullPath) {
    router.push(target)
  }
}

const markAllAsRead = async () => {
  try {
    await markAllRead()
    notifications.value.forEach(n => { n.is_read = true })
    await refreshUnreadCount()
  } catch (e) {}
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

const getActionLabel = (notification) => getUserNotificationActionLabel(notification, user.value)

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

const handleNewNotification = (data) => {
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
  refreshUnreadCount()
  wsService.on('notification', handleNewNotification)
})

onUnmounted(() => {
  wsService.off('notification', handleNewNotification)
})
</script>

<style scoped>
.notice-stack {
  display: grid;
  gap: 10px;
}

.notice-item {
  position: relative;
  align-items: flex-start;
}

.notice-item.unread {
  border-color: rgba(242,106,77,0.18);
  background: rgba(255,250,245,0.96);
}

.notice-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 8px;
  color: var(--yx-muted);
  font-size: 12px;
}

.notice-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--yx-coral);
  flex-shrink: 0;
  margin-top: 6px;
  box-shadow: 0 0 0 5px rgba(242,106,77,0.12);
}
</style>
