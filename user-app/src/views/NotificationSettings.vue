<template>
  <div class="yx-page notification-settings-page">
    <header class="yx-header center">
      <button class="yx-back-btn" @click="$router.back()">←</button>
      <div class="yx-header-main">
        <h1 class="yx-title sm">通知设置</h1>
        <p class="yx-subtitle">控制站内提醒与提示音，保存后立即生效。</p>
      </div>
      <div class="yx-icon-btn" aria-hidden="true">🔔</div>
    </header>

    <section class="yx-card" v-if="!loading">
      <div class="yx-card-head-bar">
        <h3>提醒开关<span class="yx-card-note">按需关闭某类消息</span></h3>
      </div>
      <div class="ns-list">
        <label class="ns-row">
          <div class="ns-text">
            <b>总开关 · 系统通知</b>
            <small>关闭后不再接收站内通知（仍可在通知中心查看历史）</small>
          </div>
          <input v-model="form.notificationEnabled" type="checkbox" class="ns-toggle" />
        </label>
        <label class="ns-row">
          <div class="ns-text">
            <b>声音提醒</b>
            <small>新消息到达时播放提示音（受总开关影响）</small>
          </div>
          <input v-model="form.notificationSoundEnabled" type="checkbox" class="ns-toggle" />
        </label>
        <label class="ns-row">
          <div class="ns-text">
            <b>审核结果</b>
            <small>任务拒绝、人工复核、退回重做等</small>
          </div>
          <input v-model="form.reviewNotificationEnabled" type="checkbox" class="ns-toggle" />
        </label>
        <label class="ns-row">
          <div class="ns-text">
            <b>积分与奖励</b>
            <small>到账、排行奖励、注册奖励解冻等</small>
          </div>
          <input v-model="form.pointsNotificationEnabled" type="checkbox" class="ns-toggle" />
        </label>
        <label class="ns-row">
          <div class="ns-text">
            <b>提现相关</b>
            <small>提交、审核、打款、拒绝等</small>
          </div>
          <input v-model="form.withdrawNotificationEnabled" type="checkbox" class="ns-toggle" />
        </label>
      </div>
      <button class="yx-btn full" style="margin-top:16px" :disabled="saving" @click="handleSave">
        {{ saving ? '保存中...' : '保存设置' }}
      </button>
    </section>

    <div class="yx-empty" v-else>
      <strong>加载中...</strong>
      <span>正在读取你的偏好</span>
    </div>
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

.notification-settings-page .ns-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.ns-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(31, 42, 65, 0.08);
  cursor: pointer;
}
.ns-row:last-of-type {
  border-bottom: none;
}
.ns-text b {
  display: block;
  font-size: 15px;
  color: #1a2332;
  margin-bottom: 4px;
}
.ns-text small {
  display: block;
  font-size: 12px;
  color: var(--yx-muted, #64748b);
  line-height: 1.45;
}
.ns-toggle {
  pointer-events: auto;
  width: 22px;
  height: 22px;
  accent-color: #f26a4d;
  flex-shrink: 0;
}
</style>

