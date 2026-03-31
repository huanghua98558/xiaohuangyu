<template>
  <div class="yx-page task-list-page">
    <header class="yx-header">
      <div class="yx-header-main">
        <h1 class="yx-title">任务大厅</h1>
        <p class="yx-subtitle">查看当前可领取任务。</p>
      </div>
    </header>

    <section class="yx-card" v-if="todayStats">
      <div class="yx-card-head-bar">
        <h3>今日数据<span class="yx-card-note">{{ todayDate }}</span></h3>
      </div>
      <div class="task-stats-inline">
        <div class="yx-metric-card compact">
          <strong>{{ todayStats.todayPublishedTasks }}</strong>
          <span>发布任务</span>
        </div>
        <div class="yx-metric-card compact">
          <strong>{{ todayStats.todayTotalAmount }}</strong>
          <span>任务总量</span>
        </div>
        <div class="yx-metric-card compact">
          <strong>{{ todayStats.todayCompleted }}</strong>
          <span>已完成</span>
        </div>
        <div class="yx-metric-card compact">
          <strong>{{ todayStats.remainTotal }}</strong>
          <span>剩余总量</span>
        </div>
      </div>
    </section>

    <section class="yx-soft-card location-compact">
      <div class="location-strip">
        <span class="location-pin" :class="{ loading: locationLoading, error: !!locationError, idle: !locationLoading && !locationError && !userLocation }"></span>
        <span class="location-value" v-if="locationLoading">定位中</span>
        <span class="location-value" v-else-if="userLocation">{{ userLocation.province }} {{ userLocation.city }}</span>
        <span class="location-value error-text" v-else-if="locationError">定位失败</span>
        <span class="location-value" v-else>未定位</span>
        <button class="yx-btn-ghost list-mini-btn" @click="refreshLocation">刷新</button>
      </div>
    </section>

    <section class="yx-card night-banner-dark night-sky-banner" v-if="nightRealtime?.isNight">
      <div class="night-sky-layer" aria-hidden="true">
        <span class="ns s1"></span><span class="ns s2"></span><span class="ns s3"></span>
        <span class="ns s4"></span><span class="ns s5"></span><span class="ns s6"></span>
      </div>
      <div class="yx-card-head-bar night-sky-head">
        <h3>夜间加成进行中<span class="yx-card-note">领取时按当前时间计算加成</span></h3>
        <span class="yx-tag night-coef-tag">x{{ Number(nightRealtime.coefficient || 1).toFixed(2) }}</span>
      </div>
      <p class="night-fusion-line">{{ nightFusionText }}</p>
      <p class="night-copy">星空时段加成已开启，完成任务更划算。</p>
    </section>

    <div class="filter-inline-row filter-after-card">
      <select v-model="filterType" class="filter-select">
        <option value="">全部平台</option>
        <option value="抖音">抖音</option>
        <option value="快手">快手</option>
        <option value="视频号">视频号</option>
        <option value="小红书">小红书</option>
      </select>
      <select v-model="filterAction" class="filter-select">
        <option value="">全部操作</option>
        <option value="短视频评价官">短视频评价官</option>
      </select>
      <button class="yx-btn-ghost list-mini-btn" v-if="hasActiveFilters" @click="resetFilters">重置</button>
    </div>

    <div class="yx-empty loading-state" v-if="loading">
      <strong>加载中...</strong>
      <span>正在加载任务列表。</span>
    </div>

    <section class="task-list-stack" v-else>
      <article
        class="yx-task-card"
        v-for="t in filteredTasks"
        :key="t.id"
        @click="$router.push(`/task/${t.id}`)"
      >
        <div class="yx-task-head">
          <div>
            <p class="yx-task-title">{{ t.title }}</p>
            <div class="yx-task-sub">{{ getPlatformName(t.platform) }} · {{ getActionName(t.action) }} · <span class="remain-slot" :class="{ urgent: Number(t.remain) <= 5 }">剩余 {{ t.remain }} 名额</span></div>
          </div>
          <div class="yx-reward-box" :class="{ 'has-bonus': t.isNightBonusTask }">
            <template v-if="t.isNightBonusTask">
              <div class="reward-split">
                <span class="reward-base">+{{ getBaseReward(t) }}</span>
                <span class="reward-bonus">+{{ getBonusReward(t) }} 夜间</span>
              </div>
            </template>
            <template v-else>
              <b>+{{ getBaseReward(t) }}</b>
              <small>积分</small>
            </template>
          </div>
        </div>

        <div class="yx-tag-row">
          <span class="yx-tag coral">{{ getPlatformName(t.platform) }}</span>
          <span class="yx-tag navy">{{ getActionName(t.action) }}</span>
          <span class="yx-tag mint">可领取</span>
          <span class="yx-tag night" v-if="t.isNightBonusTask">🌙 x{{ Number(t.nightCoefficient || 1).toFixed(2) }}</span>
        </div>
      </article>

      <div class="yx-empty" v-if="!filteredTasks.length">
        <strong>{{ !userLocation ? '请先允许定位' : hasActiveFilters ? '没有符合筛选条件的任务' : '当前地区暂无可接任务' }}</strong>
        <span>{{ !userLocation ? '定位成功后会按地区匹配任务。' : '可以稍后刷新或调整筛选条件。' }}</span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated, onUnmounted } from 'vue'
import { getTasks, getTodayStats, getNightCoefficient } from '../api/task'
import { getLocation, getSavedLocation } from '../utils/location'

const filterType = ref('')
const filterAction = ref('')
const loading = ref(true)
const tasks = ref([])
const userLocation = ref(null)
const locationLoading = ref(false)
const locationError = ref('')
const todayStats = ref(null)
const nightRealtime = ref(null)
let nightTimer = null

const todayDate = computed(() => {
  const now = new Date()
  return `${now.getMonth() + 1}月${now.getDate()}日`
})

const minRemainAmongNightTasks = computed(() => {
  const list = (tasks.value || []).filter(x => x.isNightBonusTask)
  if (!list.length) return null
  return Math.min(...list.map(x => Number(x.remain || 0)))
})

const nightSlotLabel = computed(() => {
  const h = new Date().getHours()
  if (h >= 0 && h < 3) return '凌晨0-3点专属'
  if (h < 6) return '凌晨3-6点专属'
  return '夜间时段专属'
})

const nightFusionText = computed(() => {
  const coef = Number(nightRealtime.value?.coefficient || 1).toFixed(2)
  const rem = minRemainAmongNightTasks.value
  let remPart = ''
  if (rem != null && rem <= 5) remPart = `仅剩${rem}席 ⚡`
  else if (rem != null) remPart = `剩${rem}名额`
  return [nightSlotLabel.value, `${coef}倍积分`, remPart].filter(Boolean).join(' | ')
})

const hasActiveFilters = computed(() => Boolean(filterType.value || filterAction.value))

const filteredTasks = computed(() => {
  let result = [...tasks.value]
  if (filterType.value) result = result.filter(t => t.platform === filterType.value)
  if (filterAction.value) result = result.filter(t => t.action === filterAction.value)
  return result
})

function resetFilters() {
  filterType.value = ''
  filterAction.value = ''
}

function getPlatformName(platform) {
  const map = {
    douyin: '抖音',
    kuaishou: '快手',
    weibo: '视频号',
    xiaohongshu: '小红书',
    抖音: '抖音',
    快手: '快手',
    视频号: '视频号',
    小红书: '小红书'
  }
  return map[platform] || platform
}

function getActionName() {
  return '短视频评价官'
}

function getBaseReward(task) {
  return Number((task?.baseReward ?? task?.settlementPreview?.basePoints ?? task?.base_reward ?? task?.reward ?? task?.estimatedReward) || 0)
}

function getBonusReward(task) {
  const apiBonus = Number(task?.nightBonusPoints ?? task?.settlementPreview?.bonusPoints)
  if (task?.isNightBonusTask && Number.isFinite(apiBonus) && apiBonus > 0) {
    return Math.round(apiBonus * 10) / 10
  }
  const base = Number((task?.baseReward ?? task?.reward ?? task?.base_reward) || 0)
  const coefficient = Number((task?.nightCoefficient ?? task?.settlementPreview?.coefficient) || 1)
  if (coefficient <= 1) return 0
  return Math.round(Math.max(0, base * (coefficient - 1)) * 10) / 10
}

function getDisplayReward(task) {
  // 保留原函数兼容性
  return getBaseReward(task)
}

async function loadTasks() {
  loading.value = true
  try {
    const data = await getTasks({ limit: 48 })
    tasks.value = Array.isArray(data) ? data : []
  } catch (e) {
    tasks.value = []
  } finally {
    loading.value = false
  }
}

async function loadTodayStats() {
  try {
    todayStats.value = await getTodayStats()
  } catch (e) {
    todayStats.value = null
  }
}

async function loadNightRealtime() {
  try {
    nightRealtime.value = await getNightCoefficient()
  } catch (e) {
    nightRealtime.value = null
  }
}

async function refreshLocation() {
  locationLoading.value = true
  locationError.value = ''
  try {
    userLocation.value = await getLocation()
  } catch (e) {
    locationError.value = e.message || '定位失败'
  } finally {
    locationLoading.value = false
  }
}

async function loadLocation() {
  locationLoading.value = true
  try {
    userLocation.value = getSavedLocation() || await getLocation()
    locationError.value = ''
  } catch (e) {
    locationError.value = e.message || '定位失败'
  } finally {
    locationLoading.value = false
  }
}

async function load() {
  await Promise.all([
    loadTasks(),
    loadTodayStats(),
    loadNightRealtime(),
    loadLocation()
  ])
}

onMounted(() => {
  load()
  nightTimer = setInterval(loadNightRealtime, 60 * 1000)
})

onActivated(load)

onUnmounted(() => {
  if (nightTimer) clearInterval(nightTimer)
})
</script>

<style scoped>
.task-list-page {
  padding-top: 18px;
}

.filter-stack {
  display: grid;
  gap: 8px;
}

.filter-after-card {
  margin-top: 14px;
}

.filter-inline-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 8px;
  margin-bottom: 8px;
}

.filter-select {
  width: 100%;
  border: 1px solid rgba(31, 42, 65, 0.1);
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);;
  border-radius: 16px;
  padding: 11px 13px;
  color: var(--yx-deep);
  font-size: 13px;
}

.task-list-stack {
  display: grid;
  gap: 10px;
}

.task-stats-inline {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.yx-metric-card.compact {
  padding: 10px 8px;
  border-radius: 16px;
  text-align: center;
}

.yx-metric-card.compact strong {
  font-size: 18px;
  margin-bottom: 3px;
}

.yx-metric-card.compact span {
  font-size: 10px;
  line-height: 1.35;
}

.task-list-stack :deep(.yx-task-card) {
  padding: 14px;
  border-radius: 20px;
}

.task-list-stack :deep(.yx-task-head) {
  margin-bottom: 10px;
}

.task-list-stack :deep(.yx-task-title) {
  font-size: 16px;
  margin-bottom: 4px;
}

.task-list-stack :deep(.yx-task-sub) {
  font-size: 12px;
  line-height: 1.45;
}

.task-list-stack :deep(.yx-reward-box) {
  min-width: 78px;
  padding: 8px 10px;
  border-radius: 16px;
}

.task-list-stack :deep(.yx-reward-box.has-bonus) {
  min-width: 100px;
  background: linear-gradient(180deg, #ffd47a 0%, #f1a423 100%);
  border: 1px solid rgba(245, 158, 11, 0.35);
  color: #6c4100;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.45);
}

.reward-split {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.reward-base {
  font-weight: 800;
  font-size: 16px;
  color: #6c4100;
}

.reward-bonus {
  font-size: 10px;
  color: #7c2d12;
  font-weight: 800;
  background: rgba(255, 255, 255, 0.55);
  padding: 2px 6px;
  border-radius: 6px;
  margin-top: 2px;
  display: inline-block;
  border: 1px solid rgba(180, 83, 9, 0.2);
}

.yx-tag.night {
  background: linear-gradient(135deg, rgba(255, 237, 213, 0.95) 0%, rgba(254, 215, 170, 0.98) 100%);
  color: #9a3412;
  border: 1px solid rgba(234, 88, 12, 0.25);
  font-weight: 800;
  box-shadow: 0 2px 8px rgba(234, 88, 12, 0.12);
}

.remain-slot.urgent {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  animation: slotPulse 1.4s ease-in-out infinite;
}

@keyframes slotPulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.35); }
  50% { transform: scale(1.03); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
}

.night-sky-banner {
  position: relative;
  overflow: hidden;
}

.night-sky-layer {
  pointer-events: none;
  position: absolute;
  inset: 0;
  opacity: 0.9;
}

.night-sky-layer .ns {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 10px rgba(255,255,255,0.9);
  animation: starTwinkle 2.8s ease-in-out infinite;
}

.night-sky-layer .s1 { top: 18%; left: 12%; animation-delay: 0s; }
.night-sky-layer .s2 { top: 28%; left: 72%; animation-delay: 0.4s; width: 2px; height: 2px; }
.night-sky-layer .s3 { top: 62%; left: 22%; animation-delay: 0.9s; }
.night-sky-layer .s4 { top: 48%; left: 58%; animation-delay: 1.2s; width: 2px; height: 2px; }
.night-sky-layer .s5 { top: 74%; left: 80%; animation-delay: 1.6s; }
.night-sky-layer .s6 { top: 12%; left: 44%; animation-delay: 2s; width: 2px; height: 2px; }

@keyframes starTwinkle {
  0%, 100% { opacity: 0.35; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1.15); }
}

.night-fusion-line {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: rgba(255,255,255,0.92);
  line-height: 1.45;
  position: relative;
  z-index: 1;
}

.night-sky-head {
  position: relative;
  z-index: 1;
}

.list-mini-btn {
  padding: 8px 10px;
  border-radius: 12px;
  font-size: 12px;
}

.location-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--yx-deep);
  font-size: 12px;
  line-height: 1.3;
}

.location-pin {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #5f80d8, #7ca1ff);
  box-shadow: 0 10px 18px rgba(82, 114, 183, 0.18);
  position: relative;
}

.location-pin::before {
  content: '';
  position: absolute;
  inset: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
}

.location-pin.loading {
  animation: locationPulse 1.2s ease-in-out infinite;
}

.location-pin.error {
  background: linear-gradient(135deg, #f48d63, #ef5e43);
  box-shadow: 0 10px 18px rgba(226, 104, 69, 0.2);
}

.location-pin.idle {
  background: linear-gradient(135deg, #8ba0bf, #6582b4);
}

.location-value {
  font-weight: 700;
}

.night-banner {
  background:
    radial-gradient(circle at top right, rgba(242,106,77,0.12), transparent 28%),
    linear-gradient(180deg, rgba(255,251,245,0.98), rgba(255,255,255,0.94));
}

.night-copy,
.error-text {
  margin: 0;
  color: var(--yx-muted);
  font-size: 11px;
  line-height: 1.5;
}

.error-text {
  color: #cf4a33;
}

@keyframes locationPulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.08);
    opacity: 0.82;
  }
}
</style>
