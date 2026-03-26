<template>
  <div class="home">
    <!-- 顶部横幅 -->
    <header class="header">
      <div class="header-content">
        <div class="brand">
          <span class="logo">🐟</span>
          <div class="brand-text">
            <h1>小黄鱼任务中心</h1>
            <p>做任务 · 赚积分 · 兑好礼</p>
          </div>
        </div>
        <router-link v-if="!isLoggedIn" to="/login" class="login-btn">
          登录/注册
        </router-link>
        <router-link v-else to="/my" class="user-btn">
          <span class="user-icon">👤</span>
          <span>我的</span>
        </router-link>
      </div>
    </header>

    <!-- 奖励广告横幅 -->
    <router-link to="/rewards" class="reward-banner">
      <div class="banner-bg">
        <div class="sparkle sparkle-1">✦</div>
        <div class="sparkle sparkle-2">✧</div>
      </div>
      <!-- 主标题 -->
      <div class="banner-main-title">
        <span class="title-hilight">2000万积分</span>
        <span class="title-text">疯狂送！</span>
      </div>
      <!-- 次要信息 -->
      <div class="banner-sub-info">
        <span class="info-item">🔥 完成任务奖励 <strong>2000</strong> 积分</span>
        <span class="info-dot">·</span>
        <span class="info-item">🎁 新人注册送 <strong>200</strong> 积分</span>
      </div>
      <div class="banner-footer">了解详情 ›</div>
    </router-link>

    <!-- 积分排行榜 -->
    <section class="rank-section">
      <div class="rank-tabs">
        <div class="rank-tab" :class="{ active: activeRankTab === 'total' }" @click="activeRankTab = 'total'">
          🏆 总排行
        </div>
        <div class="rank-tab" :class="{ active: activeRankTab === 'daily' }" @click="activeRankTab = 'daily'">
          📅 今日排行
        </div>
      </div>
      
      <!-- 我的排名 -->
      <div class="my-rank" v-if="isLoggedIn && myRank && myRank.total">
        <div class="my-rank-content">
          <span class="my-rank-label">我的排名</span>
          <span class="my-rank-value" v-if="activeRankTab === 'total'">第 {{ myRank.total.rank }} 名</span>
          <span class="my-rank-value" v-else>{{ myRank.daily && myRank.daily.rank > 0 ? '第 ' + myRank.daily.rank + ' 名' : '未上榜' }}</span>
          <span class="my-rank-points" v-if="activeRankTab === 'total'">{{ myRank.total.points }} 积分</span>
          <span class="my-rank-points" v-else>{{ myRank.daily ? myRank.daily.points : 0 }} 今日积分</span>
        </div>
      </div>
      
      <!-- 排行榜列表 -->
      <div class="rank-list">
        <div class="rank-item" v-for="(item, index) in (activeRankTab === 'total' ? rankList : dailyRankList)" :key="item.id">
          <div class="rank-medal" :class="'rank-' + (index + 1)">
            <span v-if="index < 3" class="medal-icon">{{ ['🥇', '🥈', '🥉'][index] }}</span>
            <span v-else class="rank-num">{{ index + 1 }}</span>
          </div>
          <div class="rank-info">
            <span class="rank-name">{{ item.username }}</span>
            <span class="rank-points">{{ activeRankTab === 'total' ? item.points : item.dailyPoints }} {{ activeRankTab === 'total' ? '积分' : '今日积分' }}</span>
          </div>
        </div>
        <div class="rank-empty" v-if="(activeRankTab === 'total' ? !rankList.length : !dailyRankList.length) && !rankLoading">
          <span>暂无排行数据</span>
        </div>
        <div class="rank-loading" v-if="rankLoading">
          <span>加载中...</span>
        </div>
      </div>
      
      <router-link to="/rank" class="rank-more">查看完整排行 →</router-link>
    </section>

    <!-- 今日推荐任务 -->
    <section class="recommend-section">
      <div class="section-header">
        <h2>📋 今日推荐</h2>
        <router-link to="/tasks" class="more-link">更多任务 →</router-link>
      </div>
      
      <!-- 今日数据统计 -->
      <div class="today-stats" v-if="todayStats">
        <div class="today-stats-header">
          <span class="today-stats-date">📅 今日数据</span>
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
      <div class="location-status" @click="refreshLocation">
        <span class="location-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></span>
        <span class="location-text" v-if="locationLoading">正在获取位置...</span>
        <span class="location-text" v-else-if="userLocation">{{ userLocation.province }} {{ userLocation.city }}</span>
        <span class="location-text" v-else-if="locationError" style="color: #f44336;">{{ locationError }}</span>
        <span class="location-text" v-else>未获取位置</span>
        <button class="refresh-location-btn" @click="refreshLocation" :disabled="locationLoading">刷新</button>
      </div>
      
      <div class="task-cards" v-if="recommendTasks.length">
        <div class="task-card" v-for="t in recommendTasks" :key="t.id" @click="$router.push(`/task/${t.id}`)">
          <div class="task-platform">
            <span class="platform-tag" :class="getPlatformClass(t.platform)">{{ getPlatformName(t.platform) }}</span>
            <span class="action-tag">{{ getActionName(t.action) }}</span>
          </div>
          <div class="task-title">{{ t.title }}</div>
          <div class="task-footer">
            <span class="reward">+{{ t.reward }} 积分</span>
            <span class="remain">剩余 {{ t.remain }} 名额</span>
          </div>
        </div>
      </div>
      <div class="empty-tip" v-else-if="!locationLoading">
        <span class="empty-icon">📭</span>
        <span v-if="!userLocation">请先允许获取位置</span>
        <span v-else>暂无推荐任务</span>
      </div>
    </section>

    <!-- 快捷入口 -->
    <section class="quick-section">
      <div class="section-header">
        <h2>⚡ 快捷入口</h2>
      </div>
      <div class="quick-grid">
        <router-link to="/tasks" class="quick-item">
          <div class="quick-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">📋</div>
          <span class="quick-label">任务大厅</span>
        </router-link>
        <router-link to="/my/tasks" class="quick-item">
          <div class="quick-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">📌</div>
          <span class="quick-label">我的任务</span>
        </router-link>
        <router-link to="/points" class="quick-item">
          <div class="quick-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">💰</div>
          <span class="quick-label">积分中心</span>
        </router-link>
        <router-link to="/invite" class="quick-item">
          <div class="quick-icon" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">👥</div>
          <span class="quick-label">邀请好友</span>
        </router-link>
      </div>
    </section>

    <!-- PWA 安装提示 -->
    <section class="pwa-install-section" v-if="showInstallButton">
      <div class="pwa-install-card" @click="handleInstall">
        <div class="pwa-icon">📱</div>
        <div class="pwa-content">
          <div class="pwa-title">添加到桌面</div>
          <div class="pwa-desc">方便随时使用，体验更流畅</div>
        </div>
        <div class="pwa-action">
          <span class="pwa-btn">安装</span>
        </div>
      </div>
    </section>

    <!-- iOS 安装引导弹窗 -->
    <div class="ios-install-modal" v-if="showIOSGuide" @click="showIOSGuide = false">
      <div class="ios-modal-content" @click.stop>
        <div class="ios-modal-header">
          <span class="ios-modal-icon">📲</span>
          <h3>添加到主屏幕</h3>
        </div>
        <div class="ios-modal-body">
          <div class="ios-step">
            <span class="ios-step-num">1</span>
            <span class="ios-step-text">点击底部工具栏的<span class="ios-share-icon">↑</span>分享按钮</span>
          </div>
          <div class="ios-step">
            <span class="ios-step-num">2</span>
            <span class="ios-step-text">在弹出的菜单中找到并点击"添加到主屏幕"</span>
          </div>
          <div class="ios-step">
            <span class="ios-step-num">3</span>
            <span class="ios-step-text">点击右上角"添加"完成安装</span>
          </div>
        </div>
        <button class="ios-modal-close" @click="showIOSGuide = false">我知道了</button>
      </div>
    </div>

    <!-- 数据统计（仅登录后显示） -->
    <section class="stats-section" v-if="isLoggedIn">
      <div class="stat-card clickable" @click="$router.push('/points')">
        <div class="stat-icon">💎</div>
        <div class="stat-info">
          <span class="stat-value">{{ userPoints }}</span>
          <span class="stat-label">我的积分</span>
        </div>
      </div>
      <div class="stat-card clickable" @click="$router.push('/withdraw')">
        <div class="stat-icon">💵</div>
        <div class="stat-info">
          <span class="stat-value">¥{{ userBalance }}</span>
          <span class="stat-label">可提现</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated } from 'vue'
import { useAuth } from '../store/auth'
import { getTasks, getTotalRank, getDailyPointsRank, getWallet, getMyLeaderboardRank, getTodayStats } from '../api/task'
import { getLocation, getSavedLocation, refreshLocation as refreshLocationAPI } from '../utils/location'
import { usePWAInstall, isIOS } from '../utils/pwa'

const { isLoggedIn } = useAuth()
const { isInstallable, isInstalled, showInstallPrompt } = usePWAInstall()

const recommendTasks = ref([])
const rankList = ref([])
const dailyRankList = ref([])
const rankLoading = ref(false)
const userPoints = ref(0)
const userBalance = ref('0.00')
const myRank = ref(null)
const activeRankTab = ref('total')
const userLocation = ref(null)
const locationLoading = ref(false)
const locationError = ref('')
const showIOSGuide = ref(false)
const todayStats = ref(null)

// 是否显示安装按钮
const showInstallButton = computed(() => {
  if (isInstalled.value) return false
  if (isInstallable.value) return true
  if (isIOS() && !isInstalled.value) return true
  return false
})

// 处理安装
async function handleInstall() {
  if (isInstallable.value) {
    await showInstallPrompt()
  } else if (isIOS()) {
    showIOSGuide.value = true
  }
}

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

async function refreshLocation() {
  locationLoading.value = true
  locationError.value = ""
  
  try {
    userLocation.value = await refreshLocationAPI()
    if (userLocation.value) {
      fetchTasks()
    }
  } catch (e) {
    locationError.value = e.message || "定位失败"
    userLocation.value = null
  } finally {
    locationLoading.value = false
  }
}

async function fetchTasks() {
  try {
    const filters = { limit: 5 }
    if (userLocation.value) {
      filters.city = userLocation.value.city
      filters.province = userLocation.value.province
    }
    const list = await getTasks(filters)
    recommendTasks.value = list
  } catch (e) {
    recommendTasks.value = []
  }
}

async function fetchTodayStats() {
  try {
    todayStats.value = await getTodayStats()
  } catch (e) {
    console.error('加载今日统计失败', e)
    todayStats.value = null
  }
}

async function fetchRank() {
  rankLoading.value = true
  try {
    const [total, daily] = await Promise.all([
      getTotalRank(3),
      getDailyPointsRank(3)
    ])
    rankList.value = total || []
    dailyRankList.value = daily || []
  } catch (e) {
    console.error('加载排行榜失败', e)
    rankList.value = []
    dailyRankList.value = []
  } finally {
    rankLoading.value = false
  }
}

async function fetchMyRank() {
  if (!isLoggedIn.value) return
  try {
    myRank.value = await getMyLeaderboardRank()
  } catch (e) {
    myRank.value = null
  }
}

async function fetchWallet() {
  if (!isLoggedIn.value) return
  try {
    const w = await getWallet()
    userPoints.value = w.points || 0
    userBalance.value = (w.balance !== null && w.balance !== undefined ? w.balance : 0).toFixed(2)
  } catch (e) {
    // ignore
  }
}

onMounted(async () => {
  const saved = getSavedLocation()
  if (saved) {
    userLocation.value = saved
  }
  
  await fetchTasks()
  fetchRank()
  fetchWallet()
  fetchMyRank()
  fetchTodayStats()
  
  if (!saved) {
    refreshLocation().then(() => {
      if (userLocation.value) {
        fetchTasks()
      }
    })
  }
})

onActivated(() => {
  fetchTasks()
  fetchRank()
  fetchTodayStats()
  fetchWallet()
  fetchMyRank()
})
</script>


<style scoped lang="scss">
/* ========== 页面容器 ========== */
.home {
  padding: 16px;
  padding-bottom: 100px;
  background: #f5f5f5;
}

/* ========== 顶部横幅 ========== */
.header {
  background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%);
  color: #fff;
  border-radius: 16px;
  margin-bottom: 16px;
  overflow: hidden;
}

.header-content {
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo {
  font-size: 40px;
  line-height: 1;
  filter: sepia(0.8) saturate(3) hue-rotate(5deg) brightness(1.1);
}

.brand-text h1 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
  margin-top: 0;
}

.brand-text p {
  font-size: 12px;
  opacity: 0.9;
  margin: 0;
}

.login-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  font-size: 13px;
  color: #fff;
  text-decoration: none;
  transition: background 0.2s;
}

.login-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.user-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  color: #fff;
  text-decoration: none;
  font-size: 12px;
}

.user-icon {
  font-size: 24px;
}

/* ========== 奖励广告横幅 ========== */
.reward-banner {
  display: block;
  position: relative;
  border-radius: 12px;
  margin-bottom: 16px;
  overflow: hidden;
  text-decoration: none;
  background: linear-gradient(135deg, #ff2d55 0%, #ff6b35 50%, #ff9500 100%);
  padding: 12px 14px 22px;
  box-shadow: 0 4px 16px rgba(255, 45, 85, 0.35);
  transition: transform 0.3s, box-shadow 0.3s;
}

.reward-banner:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 45, 85, 0.45);
}

.banner-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  pointer-events: none;
}

.sparkle {
  position: absolute;
  color: rgba(255, 255, 255, 0.15);
  animation: sparkle 2s ease-in-out infinite;
}

.sparkle-1 { top: 10%; left: 5%; font-size: 14px; animation-delay: 0s; }
.sparkle-2 { top: 30%; right: 10%; font-size: 12px; animation-delay: 0.7s; }

@keyframes sparkle {
  0%, 100% { opacity: 0.2; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

.banner-main-title {
  text-align: center;
  position: relative;
  z-index: 1;
  margin-bottom: 8px;
}

.title-hilight {
  font-size: 26px;
  font-weight: 900;
  color: #ffe066;
  text-shadow: 0 0 8px rgba(255, 224, 102, 0.6);
}

.title-text {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  margin-left: 4px;
}

.banner-sub-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  position: relative;
  z-index: 1;
  flex-wrap: wrap;
}

.info-item {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.95);
}

.info-item strong {
  font-size: 18px;
  font-weight: 800;
  color: #ffe066;
  text-shadow: 0 0 6px rgba(255, 224, 102, 0.5);
  margin: 0 2px;
}

.info-dot {
  color: rgba(255, 255, 255, 0.5);
  margin: 0 4px;
  font-size: 14px;
}

.banner-footer {
  position: absolute;
  right: 10px;
  bottom: 6px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.45);
  z-index: 1;
}

/* ========== 通用区块样式 ========== */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-header h2 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: #333;
}

.more-link {
  font-size: 13px;
  color: #666;
  text-decoration: none;
}

/* ========== 排行榜 ========== */
.rank-section {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.rank-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.rank-tab {
  flex: 1;
  padding: 10px;
  text-align: center;
  border-radius: 8px;
  background: #f5f5f5;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.rank-tab.active {
  background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%);
  color: #fff;
}

.my-rank {
  background: linear-gradient(135deg, #e8eaf6 0%, #c5cae9 100%);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 12px;
}

.my-rank-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.my-rank-label {
  font-size: 13px;
  color: #666;
}

.my-rank-value {
  font-size: 16px;
  font-weight: 600;
  color: #3f51b5;
}

.my-rank-points {
  font-size: 12px;
  color: #888;
  margin-left: auto;
}

.rank-list {
  max-height: 240px;
  overflow-y: auto;
}

.rank-item {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}

.rank-item:last-child {
  border-bottom: none;
}

.rank-medal {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
}

.medal-icon {
  font-size: 24px;
}

.rank-num {
  font-size: 14px;
  font-weight: 600;
  color: #666;
}

.rank-info {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.rank-name {
  font-size: 14px;
  color: #333;
}

.rank-points {
  font-size: 13px;
  color: #888;
}

.rank-empty, .rank-loading {
  text-align: center;
  padding: 20px;
  color: #999;
  font-size: 14px;
}

.rank-more {
  display: block;
  text-align: center;
  padding: 12px;
  color: #3f51b5;
  font-size: 14px;
  text-decoration: none;
  margin-top: 8px;
}

/* ========== 今日推荐 ========== */
.recommend-section {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

/* 今日统计卡片 */
.today-stats {
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
  margin-bottom: 10px;
}

.today-stats-date {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
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

.location-status {
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 13px;
}

.location-icon {
  display: flex;
  align-items: center;
  color: #3f51b5;
  font-size: 16px;
}

.location-text {
  flex: 1;
  color: #666;
}

.refresh-location-btn {
  padding: 4px 12px;
  background: #3f51b5;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}

.refresh-location-btn:disabled {
  background: #ccc;
}

.task-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-card {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.task-card:hover {
  background: #f0f1f2;
  transform: translateY(-1px);
}

.task-card:active {
  transform: translateY(0);
}

.task-platform {
  display: inline-block;
  padding: 2px 8px;
  background: linear-gradient(135deg, #ff2d55 0%, #ff6b35 100%);
  color: #fff;
  border-radius: 4px;
  font-size: 11px;
  margin-bottom: 8px;
}

.task-title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-reward {
  font-size: 16px;
  font-weight: 600;
  color: #ff6b35;
}

.task-time {
  font-size: 12px;
  color: #888;
}


/* 任务卡片底部 */
.task-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.task-footer .reward {
  font-size: 16px;
  font-weight: 600;
  color: #ff6b35;
}

.task-footer .remain {
  font-size: 12px;
  color: #888;
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 4px;
}

/* 平台标签 */
.platform-tag {
  display: inline-block;
  padding: 2px 8px;
  background: linear-gradient(135deg, #ff2d55 0%, #ff6b35 100%);
  color: #fff;
  border-radius: 4px;
  font-size: 11px;
  margin-right: 6px;
}

.platform-tag.douyin {
  background: linear-gradient(135deg, #000 0%, #333 100%);
}

.platform-tag.kuaishou {
  background: linear-gradient(135deg, #ff6a00 0%, #ff9500 100%);
}

.platform-tag.xiaohongshu {
  background: linear-gradient(135deg, #ff2442 0%, #ff6b6b 100%);
}

/* 操作标签 */
.action-tag {
  display: inline-block;
  padding: 2px 8px;
  background: #e8eaf6;
  color: #3f51b5;
  border-radius: 4px;
  font-size: 11px;
}
.empty-tip {
  text-align: center;
  padding: 30px;
  color: #999;
}

.empty-icon {
  display: block;
  font-size: 40px;
  margin-bottom: 8px;
}

/* ========== 快捷入口 ========== */
.quick-section {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  transition: transform 0.2s;
}

.quick-item:hover {
  transform: translateY(-2px);
}

.quick-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 20px;
}

.quick-label {
  font-size: 12px;
  color: #666;
}

/* ========== PWA 安装提示 ========== */
.pwa-install-section {
  margin-bottom: 16px;
}

.pwa-install-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  cursor: pointer;
  transition: transform 0.2s;
}

.pwa-install-card:hover {
  transform: translateY(-2px);
}

.pwa-icon {
  font-size: 32px;
}

.pwa-content {
  flex: 1;
}

.pwa-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 2px;
}

.pwa-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.pwa-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  color: #fff;
  font-size: 13px;
}

/* ========== iOS 安装引导弹窗 ========== */
.ios-install-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.ios-modal-content {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  width: 85%;
  max-width: 320px;
}

.ios-modal-header {
  text-align: center;
  margin-bottom: 20px;
}

.ios-modal-icon {
  font-size: 40px;
  display: block;
  margin-bottom: 8px;
}

.ios-modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.ios-modal-body {
  margin-bottom: 20px;
}

.ios-step {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.ios-step-num {
  width: 24px;
  height: 24px;
  background: #3f51b5;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
}

.ios-step-text {
  font-size: 14px;
  color: #333;
}

.ios-share-icon {
  color: #3f51b5;
  font-weight: 600;
}

.ios-modal-close {
  display: block;
  width: 100%;
  padding: 12px;
  background: #3f51b5;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.ios-modal-close:hover {
  background: #303f9f;
}

/* ========== 桌面端适配 ========== */
@media (min-width: 481px) {
  .home {
    padding: 20px;
    padding-bottom: 80px;
  }
  
  .header-content {
    padding: 24px;
  }
  
  .quick-grid {
    gap: 16px;
  }
  
  .quick-icon {
    width: 56px;
    height: 56px;
    font-size: 24px;
  }
}

/* ========== 积分统计 ========== */
.stats-section {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.stat-card {
  background: linear-gradient(135deg, #fff 0%, #f8f9ff 100%);
  border-radius: 12px;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  box-shadow: 0 2px 8px rgba(83, 109, 254, 0.06);
  border: 1px solid rgba(83, 109, 254, 0.08);
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(83, 109, 254, 0.15);
}
.stat-card.clickable {  cursor: pointer;}.stat-card.clickable:active {  transform: scale(0.98);}


.stat-icon {
  font-size: 20px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(83, 109, 254, 0.1) 0%, rgba(124, 77, 255, 0.1) 100%);
  border-radius: 50%;
  flex-shrink: 0;
}

.stat-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #3f51b5;
  margin-bottom: 2px;
  line-height: 1.2;
}

.stat-label {
  font-size: 11px;
  color: #666;
  font-weight: 500;
}
</style>
