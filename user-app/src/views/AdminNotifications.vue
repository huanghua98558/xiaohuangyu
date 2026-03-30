<template>
  <div class="admin-page">
    <header class="page-header">
      <button class="back-btn" @click="$router.back()">‹</button>
      <h1>管理员通知</h1>
      <button class="action-btn" @click="handleReadAll" :disabled="loading || unreadCount === 0">
        全部已读
      </button>
    </header>

    <div class="summary-card">
      <div class="summary-label">未读提醒</div>
      <div class="summary-value">{{ unreadCount }}</div>
    </div>

    <div class="loading" v-if="loading">加载中...</div>

    <div v-else class="list">
      <div
        v-for="item in notifications"
        :key="item.id"
        class="item"
        :class="{ unread: !item.is_read }"
        @click="handleClick(item)"
      >
        <div class="item-top">
          <span class="type">{{ item.type }}</span>
          <span class="time">{{ formatTime(item.created_at) }}</span>
        </div>
        <div class="title">{{ item.title }}</div>
        <div class="content">{{ item.content }}</div>
        <div class="action">{{ getActionLabel(item) }} ›</div>
      </div>
      <div class="empty" v-if="notifications.length === 0">暂无管理员通知</div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { wsService } from '../services/websocket'
import {
  fetchAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from '../api/adminNotification'
import {
  getAdminNotificationActionLabel,
  getAdminNotificationTarget,
} from '../utils/notificationTarget'

const router = useRouter()
const loading = ref(true)
const unreadCount = ref(0)
const notifications = ref([])

const loadData = async () => {
  loading.value = true
  try {
    const data = await fetchAdminNotifications({ page: 1, size: 50 })
    notifications.value = data.list || []
    unreadCount.value = Number(data.unreadCount || 0)
  } catch (error) {
    console.error('加载管理员通知失败', error)
  } finally {
    loading.value = false
  }
}

const handleRead = async (item) => {
  if (item.is_read) return true
  try {
    await markAdminNotificationRead(item.id)
    item.is_read = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
    return true
  } catch (error) {
    console.error('标记管理员通知已读失败', error)
    return false
  }
}

const handleClick = async (item) => {
  if (!item.is_read) {
    await handleRead(item)
  }

  const target = getAdminNotificationTarget(item)
  if (target && target !== router.currentRoute.value.fullPath) {
    router.push(target)
  }
}

const handleReadAll = async () => {
  try {
    await markAllAdminNotificationsRead()
    notifications.value = notifications.value.map((item) => ({ ...item, is_read: true }))
    unreadCount.value = 0
  } catch (error) {
    console.error('全部已读失败', error)
  }
}

const handleRealtime = () => {
  loadData()
}

const formatTime = (time) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}

const getActionLabel = (item) => getAdminNotificationActionLabel(item)

onMounted(() => {
  loadData()
  wsService.on('admin_notification', handleRealtime)
})

onUnmounted(() => {
  wsService.off('admin_notification', handleRealtime)
})
</script>

<style scoped>
.admin-page {
  min-height: 100vh;
  background: #f5f7fb;
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
  border-bottom: 1px solid #e5e7eb;
}

.page-header h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.back-btn,
.action-btn {
  border: 0;
  background: transparent;
}

.back-btn {
  font-size: 28px;
  line-height: 1;
}

.action-btn {
  color: #2563eb;
  font-size: 13px;
}

.summary-card {
  margin: 16px;
  padding: 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, #111827, #1d4ed8);
  color: #fff;
}

.summary-label {
  font-size: 13px;
  opacity: 0.8;
}

.summary-value {
  margin-top: 8px;
  font-size: 30px;
  font-weight: 700;
}

.loading,
.empty {
  padding: 24px;
  text-align: center;
  color: #6b7280;
}

.list {
  padding: 0 16px 24px;
}

.item {
  margin-bottom: 12px;
  padding: 16px;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
}

.item.unread {
  border: 1px solid #93c5fd;
}

.item-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #6b7280;
  font-size: 12px;
}

.title {
  margin-top: 8px;
  font-weight: 600;
  color: #111827;
}

.content {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.5;
  color: #4b5563;
}

.action {
  margin-top: 10px;
  text-align: right;
  font-size: 12px;
  color: #2563eb;
  font-weight: 600;
}
</style>
