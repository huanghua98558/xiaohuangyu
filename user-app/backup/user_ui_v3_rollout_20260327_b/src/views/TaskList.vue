<template>
  <div class="task-list">
    <!-- 页面头部 -->
    <header class="page-header">
      <div class="header-bg"></div>
      <div class="header-content">
        <div class="header-icon">🎯</div>
        <div class="header-text">
          <h1>任务大厅</h1>
          <p>选择任务 · 完成任务 · 领取奖励</p>
        </div>
      </div>
      <div class="header-decoration">
        <span class="deco-item">💰</span>
        <span class="deco-item">🎁</span>
        <span class="deco-item">⚡</span>
      </div>
    </header>

    <!-- 今日数据统计 -->
    <div class="today-stats-card" v-if="todayStats">
      <div class="today-stats-header">
        <span class="today-stats-icon">📅</span>
        <span class="today-stats-title">今日数据</span>
        <span class="today-stats-date">{{ todayDate }}</span>
      </div>
      <div class="today-stats-grid">
        <div class="today-stat-item">
          <span class="today-stat-value">{{ todayStats.todayPublishedTasks }}</span>
          <span class="today-stat-label">发布任务</span>
        </div>
        <div class="today-stat-item">
          <span class="today-stat-value highlight">{{ todayStats.todayTotalAmount }}</span>
          <span class="today-stat-label">任务总量</span>
        </div>
        <div class="today-stat-item">
          <span class="today-stat-value success">{{ todayStats.todayCompleted }}</span>
          <span class="today-stat-label">已完成</span>
        </div>
        <div class="today-stat-item">
          <span class="today-stat-value warning">{{ todayStats.remainTotal }}</span>
          <span class="today-stat-label">剩余总量</span>
        </div>
      </div>
    </div>

    <!-- 位置状态 -->
    <div class="location-bar" @click="refreshLocation">
      <span class="location-icon">📍</span>
      <span class="location-text" v-if="locationLoading">正在定位...</span>
      <span class="location-text" v-else-if="userLocation">{{ userLocation.province }} {{ userLocation.city }}</span>
      <span class="location-text" v-else-if="locationError" style="color: #f44336;">{{ locationError }}（点击重试）</span>
      <span class="location-text" v-else>点击获取位置</span>
      <span class="location-arrow" v-if="!locationLoading">›</span>
      <span class="location-loading" v-else>⏳</span>
    </div>

    <div class="night-status" v-if="showNightUiWindow && nightRealtime?.isNight">
      <span class="night-icon">🌙</span>
      <span class="night-text">
        <span class="night-label">夜间加成进行中</span>
        <span class="coefficient-separator">·</span>
        <span class="night-label">按发布时间判断</span>
        <span class="coefficient-value">
          x{{ Number(nightRealtime.coefficient || 1).toFixed(2) }}
          <span class="fire-icon">🔥</span>
        </span>
      </span>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-section">
      <div class="filter-row">
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
      <div class="filter-info" v-if="hasActiveFilters">
        <span class="filter-count">已筛选 {{ filteredTasks.length }} 个任务</span>
        <span class="filter-reset" @click="resetFilters">重置筛选</span>
      </div>
    </div>

    <div class="loading" v-if="loading">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <div class="tasks" v-else>
      <div
        class="task-card"
        v-for="t in filteredTasks"
        :key="t.id"
        @click="$router.push(`/task/${t.id}`)"
      >
        <div class="task-platform">
          <span class="platform-tag" :class="getPlatformClass(t.platform)">{{ getPlatformName(t.platform) }}</span>
          <span class="action-tag">{{ getActionName(t.action) }}</span>
        </div>
        <div class="task-title">{{ t.title }}</div>
        <div class="task-footer">
          <span class="reward">+{{ getDisplayReward(t) }} 积分</span>
          <span class="night-tag" v-if="showNightUiWindow && t.isNightBonusTask">🌙 x{{ Number(t.nightCoefficient || 1).toFixed(2) }}</span>
          <span class="remain">剩余 {{ t.remain }} 名额</span>
        </div>
      </div>
      <div class="empty" v-if="!filteredTasks.length && !loading">
        <span class="empty-icon">📭</span>
        <span v-if="!userLocation">请先允许获取位置</span>
        <span v-else-if="hasActiveFilters">没有符合筛选条件的任务</span>
        <span v-else>当前地区暂无可接任务</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated, onUnmounted, watch } from 'vue'
import { getTasks, getTodayStats, getNightCoefficient } from '../api/task'
import { getLocation, getSavedLocation } from '../utils/location'

const filterType = ref('')
const filterAction = ref('')
const filterReward = ref('')
const sortBy = ref('default')
const searchKeyword = ref('')
const loading = ref(true)
const tasks = ref([])
const userLocation = ref(null)
const locationLoading = ref(false)
const locationError = ref('')
const todayStats = ref(null)
const nightRealtime = ref(null)
let nightTimer = null

// 防抖搜索
let searchTimer = null
const debouncedSearch = () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    // 搜索逻辑已在computed中处理
  }, 300)
}

const clearSearch = () => {
  searchKeyword.value = ''
}

const resetFilters = () => {
  filterType.value = ''
  filterAction.value = ''
  filterReward.value = ''
  sortBy.value = 'default'
  searchKeyword.value = ''
}

const hasActiveFilters = computed(() => {
  return filterType.value || filterAction.value || filterReward.value || searchKeyword.value
})

// 今日日期
const todayDate = computed(() => {
  const now = new Date()
  return `${now.getMonth() + 1}月${now.getDate()}日`
})

const showNightUiWindow = computed(() => {
  const hour = new Date().getHours()
  return hour >= 0 && hour < 8
})

const filteredTasks = computed(() => {
  let result = [...tasks.value]
  
  // 搜索过滤
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(t => 
      t.title.toLowerCase().includes(keyword)
    )
  }
  
  // 平台筛选
  if (filterType.value) {
    result = result.filter(t => t.platform === filterType.value)
  }
  
  // 操作筛选
  if (filterAction.value) {
    result = result.filter(t => t.action === filterAction.value)
  }
  
  // 奖励筛选
  if (filterReward.value) {
    const [min, max] = filterReward.value.split('-').map(v => v === '+' ? Infinity : parseInt(v))
    if (filterReward.value.includes('+')) {
      result = result.filter(t => t.reward >= 100)
    } else {
      result = result.filter(t => t.reward >= min && t.reward <= max)
    }
  }
  
  // 排序
  if (sortBy.value === 'reward-desc') {
    result.sort((a, b) => b.reward - a.reward)
  } else if (sortBy.value === 'reward-asc') {
    result.sort((a, b) => a.reward - b.reward)
  } else if (sortBy.value === 'remain-desc') {
    result.sort((a, b) => b.remain - a.remain)
  }
  
  return result
})

function getPlatformClass(platform) {
  const map = {
    '抖音': 'douyin',
    '快手': 'kuaishou',
    '视频号': 'shipinhao',
    '小红书': 'xiaohongshu',
    'douyin': 'douyin',
    'kuaishou': 'kuaishou',
    'weibo': 'shipinhao',
    'xiaohongshu': 'xiaohongshu'
  }
  return map[platform] || ''
}

function getPlatformName(platform) {
  const map = {
    'douyin': '抖音',
    'kuaishou': '快手',
    'weibo': '视频号',
    'xiaohongshu': '小红书',
    '抖音': '抖音',
    '快手': '快手',
    '视频号': '视频号',
    '小红书': '小红书'
  }
  return map[platform] || platform
}

function getActionName(action) {
  return '短视频评价官'
}

function getDisplayReward(task) {
  return Number(task?.estimatedReward || task?.reward || 0)
}

async function refreshLocation() {
  locationLoading.value = true
  locationError.value = ''
  
  try {
    userLocation.value = await getLocation()
    // 位置获取成功后刷新任务列表
    await fetchTasks()
  } catch (e) {
    locationError.value = e.message || '定位失败'
    userLocation.value = null
  } finally {
    locationLoading.value = false
  }
}

async function fetchTasks() {
  loading.value = true
  try {
    const filters = {}
    if (userLocation.value) {
      filters.city = userLocation.value.city
      filters.province = userLocation.value.province
    }
    tasks.value = await getTasks(filters)
  } catch (e) {
    tasks.value = []
  } finally {
    loading.value = false
  }
}

async function fetchTodayStats() {
  try {
    todayStats.value = await getTodayStats()
  } catch (e) {
    console.error('加载今日统计失败', e)
  }
}

async function fetchNightRealtime() {
  try {
    nightRealtime.value = await getNightCoefficient(100)
  } catch (e) {
    nightRealtime.value = null
  }
}

onMounted(async () => {
  // 先尝试从缓存读取位置
  const saved = getSavedLocation()
  if (saved) {
    userLocation.value = saved
  }
  
  // 加载数据
  await fetchTasks()
  fetchTodayStats()
  fetchNightRealtime()
  if (!nightTimer) {
    nightTimer = setInterval(fetchNightRealtime, 30000)
  }
  
  // 如果没有缓存的位置，尝试获取
  if (!saved) {
    refreshLocation()
  }
})

onActivated(() => {
  // 检查位置缓存是否有效
  const saved = getSavedLocation()
  if (saved) {
    userLocation.value = saved
  }
  fetchTasks()
  fetchTodayStats()
  fetchNightRealtime()
})

onUnmounted(() => {
  if (nightTimer) {
    clearInterval(nightTimer)
    nightTimer = null
  }
})
</script>

<style scoped>
.task-list {
  padding: 16px;
  padding-bottom: 100px;
  background: #f5f5f5;
}

.page-header {
  position: relative;
  background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 50%, #7986cb 100%);
  border-radius: 16px;
  padding: 20px 16px;
  margin-bottom: 16px;
  overflow: hidden;
}

.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  opacity: 0.5;
}

.header-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  backdrop-filter: blur(10px);
}

.header-text h1 {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 4px 0;
  color: #fff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header-text p {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
}

.header-decoration {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 8px;
}

.deco-item {
  font-size: 20px;
  opacity: 0.6;
  animation: float 3s ease-in-out infinite;
}

.deco-item:nth-child(2) {
  animation-delay: 0.5s;
}

.deco-item:nth-child(3) {
  animation-delay: 1s;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

/* 今日统计卡片 */
.today-stats-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

.today-stats-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}

.today-stats-icon {
  font-size: 16px;
}

.today-stats-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.today-stats-date {
  margin-left: auto;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.today-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.today-stat-item {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  padding: 10px 6px;
  text-align: center;
  backdrop-filter: blur(10px);
}

.today-stat-value {
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 2px;
}

.today-stat-value.highlight {
  color: #ffd700;
}

.today-stat-value.success {
  color: #7fff7f;
}

.today-stat-value.warning {
  color: #ffb347;
}

.today-stat-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.9);
}

/* 位置设置栏 */
.location-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 10px;
  margin-bottom: 12px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.location-icon {
  font-size: 18px;
}

.location-text {
  flex: 1;
  font-size: 14px;
  color: #333;
}

.location-arrow {
  color: #999;
  font-size: 18px;
}

.location-loading {
  font-size: 14px;
}

.night-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
  background: #fff8e1;
  border: 1px solid #ffe082;
  border-radius: 10px;
}

.night-text {
  font-size: 12px;
  color: #8d6e63;
}

/* 搜索栏 */
.search-bar {
  margin-bottom: 12px;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 10px;
  padding: 0 14px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.search-icon {
  font-size: 16px;
  margin-right: 8px;
}

.search-input {
  flex: 1;
  border: none;
  padding: 12px 0;
  font-size: 14px;
  outline: none;
  background: transparent;
}

.search-input::placeholder {
  color: #999;
}

.search-clear {
  font-size: 14px;
  color: #999;
  cursor: pointer;
  padding: 4px;
}

.search-clear:hover {
  color: #666;
}

/* 筛选区域 */
.filter-section {
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.filter-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 10px;
}

.filter-row:last-of-type {
  margin-bottom: 0;
}

.filter-select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 13px;
  background: #f8f9fa;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-select:focus {
  border-color: #3f51b5;
  background: #fff;
}

.filter-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid #eee;
  margin-top: 10px;
}

.filter-count {
  font-size: 12px;
  color: #666;
}

.filter-reset {
  font-size: 12px;
  color: #3f51b5;
  cursor: pointer;
}

.filter-reset:hover {
  text-decoration: underline;
}

.filter-bar {
  margin-bottom: 16px;
}

.filter-bar select {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  font-size: 14px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.2s;
}

.filter-bar select:focus {
  border-color: #3f51b5;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
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

.tasks {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-card {
  background: #fff;
  padding: 16px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.task-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.task-card:active {
  transform: scale(0.98);
}

.task-platform {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.platform-tag, .action-tag {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.platform-tag {
  background: #e8eaf6;
  color: #3f51b5;
}

.platform-tag.douyin { background: #fce4ec; color: #e91e63; }
.platform-tag.kuaishou { background: #fff3e0; color: #ff9800; }
.platform-tag.shipinhao { background: #e8f5e9; color: #4caf50; }
.platform-tag.xiaohongshu { background: #ffebee; color: #f44336; }

.action-tag {
  background: #f5f5f5;
  color: #666;
}

.claimed-tag {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 500;
  background: #e8f5e9;
  color: #4caf50;
  margin-left: auto;
}

.task-title {
  font-size: 15px;
  font-weight: 500;
  color: #333;
  margin-bottom: 10px;
  line-height: 1.4;
}

.task-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.night-tag {
  font-size: 12px;
  color: #f57c00;
}

.reward {
  font-size: 16px;
  font-weight: 600;
  color: #ff6b00;
}

.remain {
  font-size: 12px;
  color: #999;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #999;
  gap: 8px;
}

.empty-icon {
  font-size: 48px;
}

/* 夜间系数高亮闪烁样式 */
.night-status {
  background: linear-gradient(135deg, rgba(30, 30, 60, 0.9) 0%, rgba(45, 45, 80, 0.9) 100%);
  border-radius: 12px;
  padding: 12px 16px;
  margin: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.night-icon {
  font-size: 20px;
  animation: moonRotate 3s ease-in-out infinite;
  display: inline-block;
}

@keyframes moonRotate {
  0%, 100% { transform: rotate(-10deg); }
  50% { transform: rotate(10deg); }
}

.night-text {
  color: #fff;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.night-label {
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
}

.coefficient-separator {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}

.coefficient-value {
  color: #ffd700;
  font-size: 18px;
  font-weight: 700;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
  animation: coefficientPulse 1.5s ease-in-out infinite;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

@keyframes coefficientPulse {
  0%, 100% {
    transform: scale(1);
    text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
    opacity: 1;
  }
  50% {
    transform: scale(1.08);
    text-shadow: 0 0 20px rgba(255, 215, 0, 0.8),
                 0 0 30px rgba(255, 215, 0, 0.4);
    opacity: 0.9;
  }
}

.fire-icon {
  font-size: 16px;
  animation: fireFlicker 0.8s ease-in-out infinite;
  display: inline-block;
}

@keyframes fireFlicker {
  0%, 100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
  50% {
    transform: scale(1.2) rotate(-5deg);
    opacity: 0.8;
  }
}
</style>
