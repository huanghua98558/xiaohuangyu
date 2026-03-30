<template>
  <div class="admin-page">
    <header class="page-header">
      <button class="back-btn" @click="$router.back()">‹</button>
      <h1>管理员告警</h1>
      <span class="placeholder"></span>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">待处理</div>
        <div class="stat-value">{{ stats.pending || 0 }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">处理中</div>
        <div class="stat-value">{{ stats.handling || 0 }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">严重</div>
        <div class="stat-value">{{ stats.critical || 0 }}</div>
      </div>
    </div>

    <div class="loading" v-if="loading">加载中...</div>

    <div v-else class="list">
      <div v-for="item in alerts" :key="item.id" class="item">
        <div class="item-top">
          <span class="severity" :class="item.severity">{{ item.severity }}</span>
          <span class="status">{{ formatStatus(item.status) }}</span>
        </div>
        <div class="title">{{ item.title }}</div>
        <div class="content">{{ item.description }}</div>
        <div class="time">{{ formatTime(item.created_at) }}</div>
        <div class="actions" v-if="item.status === 'pending' || item.status === 'handling'">
          <button class="btn resolve" @click="handleAlertAction(item, 'resolve')">标记已解决</button>
          <button class="btn ignore" @click="handleAlertAction(item, 'ignore')">忽略</button>
        </div>
      </div>
      <div class="empty" v-if="alerts.length === 0">暂无管理员告警</div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { wsService } from '../services/websocket'
import { fetchAdminAlerts, fetchAdminAlertStats, handleAdminAlert } from '../api/adminNotification'

const loading = ref(true)
const alerts = ref([])
const stats = ref({})

const loadData = async () => {
  loading.value = true
  try {
    const [alertData, statsData] = await Promise.all([
      fetchAdminAlerts({ page: 1, pageSize: 50, status: 'pending' }),
      fetchAdminAlertStats(),
    ])
    alerts.value = alertData.list || []
    stats.value = statsData || {}
  } catch (error) {
    console.error('加载管理员告警失败', error)
  } finally {
    loading.value = false
  }
}

const handleAlertAction = async (item, action) => {
  const note = window.prompt(action === 'resolve' ? '请输入解决说明' : '请输入忽略说明', '')
  if (!note) return
  try {
    await handleAdminAlert(item.id, { action, note })
    loadData()
  } catch (error) {
    console.error('处理告警失败', error)
  }
}

const formatTime = (time) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}

const formatStatus = (status) => {
  const map = {
    pending: '待处理',
    handling: '处理中',
    resolved: '已解决',
    ignored: '已忽略',
  }
  return map[status] || status
}

const refreshRealtime = () => {
  loadData()
}

onMounted(() => {
  loadData()
  wsService.on('system_alert', refreshRealtime)
})

onUnmounted(() => {
  wsService.off('system_alert', refreshRealtime)
})
</script>

<style scoped>
.admin-page {
  min-height: 100vh;
  background: #f8fafc;
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
.placeholder {
  width: 28px;
}

.back-btn {
  border: 0;
  background: transparent;
  font-size: 28px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 16px;
}

.stat-card {
  padding: 14px;
  border-radius: 16px;
  background: #fff;
  text-align: center;
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
}

.stat-value {
  margin-top: 8px;
  font-size: 24px;
  font-weight: 700;
  color: #111827;
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

.item-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}

.severity {
  text-transform: uppercase;
  font-weight: 700;
}

.severity.critical,
.severity.high {
  color: #dc2626;
}

.severity.medium {
  color: #d97706;
}

.severity.low {
  color: #2563eb;
}

.status {
  color: #6b7280;
}

.title {
  margin-top: 8px;
  font-weight: 600;
  color: #111827;
}

.content,
.time {
  margin-top: 6px;
  font-size: 13px;
  color: #4b5563;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

.btn {
  flex: 1;
  padding: 10px 12px;
  border: 0;
  border-radius: 12px;
  font-size: 13px;
}

.btn.resolve {
  background: #111827;
  color: #fff;
}

.btn.ignore {
  background: #e5e7eb;
  color: #111827;
}
</style>
