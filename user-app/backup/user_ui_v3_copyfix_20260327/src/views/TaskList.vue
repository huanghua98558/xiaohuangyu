<template>
  <div class="yx-page task-list-page">
    <header class="yx-header">
      <div class="yx-header-main">
        <span class="yx-eyebrow">任务大厅</span>
        <h1 class="yx-title">先筛条件，再快速下手</h1>
        <p class="yx-subtitle">把今日数据、定位状态、夜间提示和任务卡片排成一条更顺手的任务流，不让信息抢彼此。</p>
      </div>
      <button class="yx-icon-btn" @click="refreshLocation">📍</button>
    </header>

    <section class="yx-card" v-if="todayStats">
      <div class="yx-card-head">
        <div>
          <h3>今日数据</h3>
          <div class="yx-card-note">{{ todayDate }}</div>
        </div>
      </div>
      <div class="yx-stats-grid two">
        <div class="yx-metric-card">
          <strong>{{ todayStats.todayPublishedTasks }}</strong>
          <span>发布任务</span>
        </div>
        <div class="yx-metric-card">
          <strong>{{ todayStats.todayTotalAmount }}</strong>
          <span>任务总量</span>
        </div>
        <div class="yx-metric-card">
          <strong>{{ todayStats.todayCompleted }}</strong>
          <span>已完成</span>
        </div>
        <div class="yx-metric-card">
          <strong>{{ todayStats.remainTotal }}</strong>
          <span>剩余总量</span>
        </div>
      </div>
    </section>

    <section class="yx-soft-card">
      <div class="yx-card-head">
        <div>
          <h3>当前定位</h3>
          <div class="yx-card-note">任务推荐仍按地区匹配</div>
        </div>
        <button class="yx-btn-ghost list-mini-btn" @click="refreshLocation">刷新</button>
      </div>
      <div class="location-strip">
        <span>📍</span>
        <span v-if="locationLoading">正在定位...</span>
        <span v-else-if="userLocation">{{ userLocation.province }} {{ userLocation.city }}</span>
        <span v-else-if="locationError" class="error-text">{{ locationError }}（点击刷新重试）</span>
        <span v-else>点击刷新后开始匹配任务</span>
      </div>
    </section>

    <section class="yx-card night-banner" v-if="showNightUiWindow && nightRealtime?.isNight">
      <div class="yx-card-head" style="margin-bottom:8px;">
        <div>
          <h3>夜间加成进行中</h3>
          <div class="yx-card-note">按任务发布时间判断</div>
        </div>
        <span class="yx-tag coral">x{{ Number(nightRealtime.coefficient || 1).toFixed(2) }}</span>
      </div>
      <p class="night-copy">只有夜间时间窗内才展示这块提示，避免白天误导用户。</p>
    </section>

    <section class="yx-card">
      <div class="yx-card-head">
        <div>
          <h3>筛选条件</h3>
          <div class="yx-card-note">筛平台，再看任务是否适合当前账号</div>
        </div>
        <button class="yx-btn-ghost list-mini-btn" v-if="hasActiveFilters" @click="resetFilters">重置</button>
      </div>

      <div class="filter-stack">
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
      </div>

      <div class="yx-tag-row" v-if="hasActiveFilters" style="margin-top:10px;">
        <span class="yx-tag coral">已筛选 {{ filteredTasks.length }} 个任务</span>
      </div>
    </section>

    <div class="yx-empty" v-if="loading">
      <strong>加载中...</strong>
      <span>正在拉取任务大厅数据。</span>
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
            <div class="yx-task-sub">{{ getPlatformName(t.platform) }} · {{ getActionName(t.action) }} · 剩余 {{ t.remain }} 名额</div>
          </div>
          <div class="yx-reward-box">
            <b>+{{ getDisplayReward(t) }}</b>
            <small>积分</small>
          </div>
        </div>

        <div class="yx-tag-row">
          <span class="yx-tag coral">{{ getPlatformName(t.platform) }}</span>
          <span class="yx-tag navy">{{ getActionName(t.action) }}</span>
          <span class="yx-tag mint">任务详情可查看示范图</span>
          <span class="yx-tag gold" v-if="showNightUiWindow && t.isNightBonusTask">夜间 x{{ Number(t.nightCoefficient || 1).toFixed(2) }}</span>
        </div>

        <div class="task-footnote">系统先做 OCR + YOLO 图片审核，再进入连接审核，失败结果保留留痕并可进入人工检查。</div>

        <div class="yx-actions">
          <button class="yx-btn-ghost">查看说明</button>
          <button class="yx-btn">去做任务</button>
        </div>
      </article>

      <div class="yx-empty" v-if="!filteredTasks.length">
        <strong>{{ !userLocation ? '请先允许定位' : hasActiveFilters ? '没有符合筛选条件的任务' : '当前地区暂无可接任务' }}</strong>
        <span>{{ !userLocation ? '定位成功后，任务大厅会按你的地区给出更准确的任务。' : '可以稍后刷新或调整筛选条件。' }}</span>
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

const showNightUiWindow = computed(() => {
  const hour = new Date().getHours()
  return hour >= 0 && hour < 8
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

function getDisplayReward(task) {
  return Number(task?.estimatedReward || task?.reward || 0)
}

async function loadTasks() {
  loading.value = true
  try {
    const data = await getTasks()
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
  gap: 10px;
}

.filter-select {
  width: 100%;
  border: 1px solid var(--yx-line);
  background: rgba(255,255,255,0.92);
  border-radius: 16px;
  padding: 13px 14px;
  color: var(--yx-deep);
  font-size: 14px;
}

.task-list-stack {
  display: grid;
  gap: 12px;
}

.task-footnote {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(33,48,75,0.04);
  border: 1px solid rgba(33,48,75,0.06);
  color: var(--yx-muted);
  font-size: 12px;
  line-height: 1.65;
}

.list-mini-btn {
  padding: 10px 12px;
  border-radius: 14px;
  font-size: 12px;
}

.location-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--yx-deep);
  font-size: 13px;
  line-height: 1.6;
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
  font-size: 13px;
  line-height: 1.7;
}

.error-text {
  color: #cf4a33;
}
</style>
