<template>
  <div class="settings-page">
    <div class="page-header">
      <button class="back-btn" @click="$router.back()">‹</button>
      <h1>通知设置</h1>
      <span class="placeholder"></span>
    </div>

    <div class="content" v-if="!loading">
      <div class="setting-card">
        <div class="setting-row">
          <div>
            <div class="setting-title">系统通知</div>
            <div class="setting-desc">关闭后将不再接收站内通知提醒</div>
          </div>
          <input v-model="form.notificationEnabled" type="checkbox" class="toggle" />
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-title">声音提醒</div>
            <div class="setting-desc">新消息到达时播放提示音</div>
          </div>
          <input v-model="form.notificationSoundEnabled" type="checkbox" class="toggle" />
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-title">审核结果提醒</div>
            <div class="setting-desc">任务拒绝、人工处理等审核消息</div>
          </div>
          <input v-model="form.reviewNotificationEnabled" type="checkbox" class="toggle" />
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-title">积分提醒</div>
            <div class="setting-desc">积分到账、排行奖励、奖励解冻等消息</div>
          </div>
          <input v-model="form.pointsNotificationEnabled" type="checkbox" class="toggle" />
        </div>

        <div class="setting-row">
          <div>
            <div class="setting-title">提现提醒</div>
            <div class="setting-desc">提现提交、审核通过、拒绝、打款通知</div>
          </div>
          <input v-model="form.withdrawNotificationEnabled" type="checkbox" class="toggle" />
        </div>
      </div>

      <button class="save-btn" :disabled="saving" @click="handleSave">
        {{ saving ? '保存中...' : '保存设置' }}
      </button>
    </div>

    <div class="loading" v-else>加载中...</div>
  </div>
</template>

<script setup>
import { reactive, onMounted, ref } from 'vue'
import { fetchNotificationSettings, saveNotificationSettings } from '../api/settings'
import { saveNotificationSettingsToCache } from '../services/notificationSound'

const loading = ref(true)
const saving = ref(false)
const form = reactive({
  notificationEnabled: true,
  notificationSoundEnabled: true,
  reviewNotificationEnabled: true,
  pointsNotificationEnabled: true,
  withdrawNotificationEnabled: true,
})

const loadSettings = async () => {
  loading.value = true
  try {
    const data = await fetchNotificationSettings()
    saveNotificationSettingsToCache(data)
    form.notificationEnabled = Boolean(data.notificationEnabled)
    form.notificationSoundEnabled = Boolean(data.notificationSoundEnabled)
    form.reviewNotificationEnabled = Boolean(data.reviewNotificationEnabled)
    form.pointsNotificationEnabled = Boolean(data.pointsNotificationEnabled)
    form.withdrawNotificationEnabled = Boolean(data.withdrawNotificationEnabled)
  } catch (error) {
    console.error('加载通知设置失败', error)
  } finally {
    loading.value = false
  }
}

const handleSave = async () => {
  saving.value = true
  try {
    const saved = await saveNotificationSettings({ ...form })
    saveNotificationSettingsToCache(saved || form)
    alert('通知设置已保存')
  } catch (error) {
    console.error('保存通知设置失败', error)
    alert(error.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(loadSettings)
</script>

<style scoped>
.settings-page {
  min-height: 100vh;
  background: #f5f5f5;
}

.page-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
}

.page-header h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.back-btn,
.placeholder {
  width: 32px;
}

.back-btn {
  border: 0;
  background: transparent;
  font-size: 28px;
  line-height: 1;
  color: #111827;
}

.content {
  padding: 16px;
}

.setting-card {
  background: #ffffff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 16px;
  border-bottom: 1px solid #f1f5f9;
}

.setting-row:last-child {
  border-bottom: 0;
}

.setting-title {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.setting-desc {
  margin-top: 4px;
  font-size: 13px;
  color: #6b7280;
}

.toggle {
  width: 20px;
  height: 20px;
}

.save-btn {
  width: 100%;
  margin-top: 16px;
  padding: 14px 16px;
  border: 0;
  border-radius: 14px;
  background: #111827;
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
}

.save-btn:disabled {
  opacity: 0.6;
}

.loading {
  padding: 32px 16px;
  text-align: center;
  color: #6b7280;
}
</style>
