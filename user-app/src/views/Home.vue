<template>
  <div class="yx-page home-page">
    <header class="yx-header home-top-header">
      <div class="yx-header-main">
        <h1 class="home-main-title"><span class="home-title-text">小黄鱼任务中心</span></h1>
        <p class="home-main-subtitle">做任务，领积分，兑好礼</p>
      </div>
      <router-link v-if="!isLoggedIn" to="/login" class="yx-icon-btn">登</router-link>
      <router-link v-else to="/notifications" class="yx-icon-btn home-notify-btn">
        🔔
        <span v-if="unreadNotifyCount > 0" class="home-notify-badge">{{ unreadBadgeText }}</span>
      </router-link>
    </header>

    <!-- PWA 安装浮动横幅 -->
    <div class="pwa-install-float" v-if="showInstallBanner && !isBuiltInBrowser()">
      <div class="pwa-float-icon">📱</div>
      <div class="pwa-float-text">
        <strong>安装小黄鱼APP</strong>
        <span>添加到桌面，体验更流畅</span>
      </div>
      <div class="pwa-float-actions">
        <button class="pwa-float-dismiss" v-on:click="handleDismissInstall">✕</button>
        <button class="pwa-float-install" v-on:click="handleInstall">安装</button>
      </div>
    </div>

    <!-- 微信/QQ 内置浏览器引导 -->
    <div class="pwa-browser-guide" v-if="showBrowserGuide">
      <span class="pwa-guide-icon">💡</span>
      <span>点击右上角 <b>⋮</b> 选择「浏览器打开」可安装APP</span>
      <button class="pwa-guide-close" v-on:click="showBrowserGuide = false">✕</button>
    </div>

    <section class="yx-card home-summary-card">
      <div class="rank-title-row">
        <h3><span class="rank-emoji">🏆</span>{{ activeRankTab === 'total' ? '总排行' : '今日排行' }}</h3>
        <div class="summary-rank-pill">
          <b>{{ currentRankLabel }}</b>
          <small>{{ rankHint }}</small>
        </div>
      </div>

      <div class="yx-segment summary-segment">
        <button :class="{ active: activeRankTab === 'total' }" @click="activeRankTab = 'total'">总排行</button>
        <button :class="{ active: activeRankTab === 'daily' }" @click="activeRankTab = 'daily'">今日排行</button>
      </div>

      <div class="summary-inline-stats">
        <div class="inline-stat">
          <strong>{{ activeRankTab === 'total' ? userPoints : (myRank?.daily?.points || 0) }}</strong>
          <span>{{ activeRankTab === 'total' ? '总积分' : '今日积分' }}</span>
        </div>
        <div class="inline-stat">
          <strong>{{ currentRankList.length || 0 }}</strong>
          <span>榜单人数</span>
        </div>
      </div>

      <div class="yx-rank-list compact" style="margin-top:10px;">
        <div class="yx-rank-item" v-for="(item, index) in currentRankList" :key="`${activeRankTab}-${item.userId || item.id || index}`">
          <div class="yx-rank-badge" :class="{ gold: index === 0 }">{{ index + 1 }}</div>
          <div class="yx-list-main">
            <b>{{ item.username }}</b>
            <small>{{ activeRankTab === 'total' ? '累计积分' : '今日积分' }}</small>
          </div>
          <div class="yx-list-side">
            <strong>{{ activeRankTab === 'total' ? item.points : item.dailyPoints }}</strong>
          </div>
        </div>
        <div class="yx-empty" v-if="!currentRankList.length && !rankLoading">
          <strong>暂无排行数据</strong>
          <span>当前暂无 {{ activeRankTab === 'total' ? '总排行' : '今日排行' }} 数据。</span>
        </div>
      </div>

      <router-link to="/rank" class="yx-btn-ghost full summary-more-btn">查看完整排行</router-link>
    </section>

    <router-link to="/rewards" class="home-reward-banner">
      <span class="reward-banner-tag reward-tag-corner">限时福利</span>
      <span class="reward-arrow reward-arrow-top">立即领取</span>
      <div class="reward-banner-body">
        <div class="reward-row reward-row-1">
          <span class="reward-mega gradient-mega">2000万</span><span class="reward-row-suffix">积分疯狂送</span>
        </div>
        <div class="reward-row reward-row-2">
          注册即送<span class="reward-accent-num">200</span>，最高可获得<span class="reward-accent-num">20000</span>积分奖励
        </div>
      </div>
    </router-link>

    <section class="yx-card home-today-stats" v-if="todayStats">
      <div class="yx-card-head-bar">
        <h3>今日数据<span class="yx-card-note">{{ todayDate }}</span></h3>
      </div>
      <div class="home-stats-inline">
        <div class="yx-metric-card compact">
          <strong>{{ todayStats.todayPublishedTasks }}</strong>
          <span>今日发布任务</span>
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
        <button class="yx-btn-ghost home-mini-btn" @click="refreshLocation">刷新</button>
      </div>
    </section>

    <section class="yx-card">
      <div class="yx-card-head-bar">
        <h3>推荐任务<span class="yx-card-note">优先展示适合你的任务</span></h3>
        <router-link to="/tasks" class="yx-btn-ghost">更多任务</router-link>
      </div>

      <div class="home-task-list" v-if="recommendTasks.length">
        <article class="yx-task-card" v-for="t in recommendTasks" :key="t.id" @click="$router.push(`/task/${t.id}`)">
          <div class="yx-task-head">
            <div>
              <p class="yx-task-title">{{ t.title }}</p>
              <div class="yx-task-sub">{{ getPlatformName(t.platform) }} · {{ getActionName(t.action) }} · <span class="remain-slot" :class="{ urgent: Number(t.remain) <= 5 }">剩余 {{ t.remain }} 名额</span></div>
            </div>
            <div class="yx-reward-box">
              <b>+{{ t.reward }}</b>
              <small>积分</small>
            </div>
          </div>
          <div class="yx-tag-row">
            <span class="yx-tag coral">{{ getPlatformName(t.platform) }}</span>
            <span class="yx-tag navy">{{ getActionName(t.action) }}</span>
            <span class="yx-tag mint">点击查看详情</span>
          </div>
        </article>
      </div>

      <div class="yx-empty" v-else-if="!locationLoading">
        <strong>{{ userLocation ? '暂无推荐任务' : '请先获取位置' }}</strong>
        <span>{{ userLocation ? '当前地区暂时没有可推荐任务。' : '获取位置后将优先推荐附近任务。' }}</span>
      </div>
    </section>

    <section class="yx-card">
      <div class="yx-card-head-bar">
        <h3>快捷入口<span class="yx-card-note">常用功能入口</span></h3>
      </div>
      <div class="yx-shortcut-grid two">
        <router-link to="/tasks" class="yx-shortcut-card shortcut-tone-peach">
          <span class="shortcut-icon">🗂️</span>
          <b>任务大厅</b>
          <small>浏览和领取任务</small>
        </router-link>
        <router-link to="/my/tasks" class="yx-shortcut-card shortcut-tone-blue">
          <span class="shortcut-icon">📋</span>
          <b>我的任务</b>
          <small>查看处理中和审核进度</small>
        </router-link>
        <router-link to="/points" class="yx-shortcut-card shortcut-tone-gold">
          <span class="shortcut-icon">💎</span>
          <b>积分中心</b>
          <small>查看积分、兑换和提现</small>
        </router-link>
        <router-link to="/invite" class="yx-shortcut-card shortcut-tone-mint">
          <span class="shortcut-icon">🎁</span>
          <b>推广中心</b>
          <small>邀请好友赚积分</small>
        </router-link>
      </div>
    </section>

    <section class="yx-soft-card home-pwa-install-section" v-if="showInstallButton">
      <div class="yx-card-head" style="margin-bottom:0;">
        <div>
          <h3>添加到桌面</h3>
          <div class="yx-card-note">安装后打开更快</div>
        </div>
        <button class="yx-btn" @click="handleInstall">立即安装</button>
      </div>
    </section>

    <section class="yx-card account-overview-section" v-if="isLoggedIn">
      <div class="yx-card-head-bar">
        <h3>账户概览<span class="yx-card-note">积分与余额</span></h3>
      </div>
      <div class="account-overview-grid">
        <router-link to="/points" class="account-card points-card">
          <span class="account-card-label">💎 我的积分</span>
          <strong>{{ userPoints }}</strong>
          <small>查看积分流水和兑换记录</small>
        </router-link>
        <router-link to="/withdraw" class="account-card balance-card">
          <span class="account-card-label">💰 可提现余额</span>
          <strong>¥{{ userBalance }}</strong>
          <small>申请提现并查看打款进度</small>
        </router-link>
      </div>
    </section>

    <footer class="home-legal-strip">
      <router-link to="/agreement">用户协议</router-link>
      <span class="home-legal-dot">·</span>
      <router-link to="/privacy">隐私政策</router-link>
      <span class="home-legal-dot">·</span>
      <router-link to="/task-rules">任务规范</router-link>
    </footer>

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
            <span class="ios-step-text">在弹出的菜单中找到并点击“添加到主屏幕”</span>
          </div>
          <div class="ios-step">
            <span class="ios-step-num">3</span>
            <span class="ios-step-text">点击右上角“添加”完成安装</span>
          </div>
        </div>
        <button class="ios-modal-close" @click="showIOSGuide = false">我知道了</button>
      </div>
    </div>
  </div>
    <!-- Android 安装引导弹窗 -->
    <div class="android-install-modal" v-if="showAndroidGuide" @click="showAndroidGuide = false">
      <div class="android-modal-content" @click.stop>
        <div class="android-modal-header">
          <span class="android-modal-icon">📲</span>
          <h3>安装应用</h3>
        </div>
        <div class="android-modal-body">
          <div class="android-step">
            <span class="android-step-num">1</span>
            <span class="android-step-text">点击浏览器右上角 <b>⋮</b> 菜单</span>
          </div>
          <div class="android-step">
            <span class="android-step-num">2</span>
            <span class="android-step-text">选择「添加到主屏幕」或「安装应用」</span>
          </div>
          <div class="android-step">
            <span class="android-step-num">3</span>
            <span class="android-step-text">按提示完成安装</span>
          </div>
        </div>
        <button class="android-modal-close" @click="showAndroidGuide = false">我知道了</button>
      </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated } from 'vue'
import { useAuth } from '../store/auth'
import { getTasks, getTotalRank, getDailyPointsRank, getWallet, getMyRank, getTodayStats } from '../api/task'
import { fetchUnreadCount } from '../api/notification'
import { getLocation, getSavedLocation, refreshLocation as refreshLocationAPI } from '../utils/location'
import { usePWAInstall, isIOS, isAndroid, isWeChat, isQQBrowser, isBuiltInBrowser, canNativeInstall } from '../utils/pwa'

const { isLoggedIn, user } = useAuth()
const { isInstallable, isInstalled, showInstallPrompt, showInstallBanner, dismissInstall } = usePWAInstall()

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
const showAndroidGuide = ref(false)
const showBrowserGuide = ref(isBuiltInBrowser())
const todayStats = ref(null)
const unreadNotifyCount = ref(0)

const unreadBadgeText = computed(() => {
  const n = unreadNotifyCount.value
  if (n > 99) return '99+'
  return String(n)
})

const showInstallButton = computed(() => {
  if (isInstalled.value) return false
  if (isInstallable.value) return true
  if (isIOS() && !isInstalled.value) return true
  if (isAndroid() && !isInstalled.value) return true
  return false
})

const todayDate = computed(() => {
  const now = new Date()
  return `${now.getMonth() + 1}月${now.getDate()}日`
})

const currentRankList = computed(() => activeRankTab.value === 'total' ? rankList.value : dailyRankList.value)

const currentRankLabel = computed(() => {
  if (!myRank.value) return '未上榜'
  const current = activeRankTab.value === 'total' ? myRank.value.total : myRank.value.daily
  return current?.rank > 0 ? `第${current.rank}名` : '未上榜'
})

const rankHint = computed(() => {
  if (!currentRankList.value.length) return '等待开榜'
  if (!myRank.value) return '登录后看排行'
  const current = activeRankTab.value === 'total' ? myRank.value.total : myRank.value.daily
  if (!current || !current.rank || current.rank <= 0) return '继续完成任务冲榜'
  if (current.rank === 1) return '当前已领先'
  const list = currentRankList.value
  const prevIndex = current.rank - 2
  const prev = list[prevIndex]
  if (!prev) return '继续提升排名'
  const currentPoints = activeRankTab.value === 'total' ? current.points : current.points
  const prevPoints = activeRankTab.value === 'total' ? prev.points : prev.dailyPoints
  const diff = Math.max(1, Number(prevPoints || 0) - Number(currentPoints || 0))
  return `还差 ${diff} 分`
})

async function handleInstall() {
  // Android: 有原生安装能力
  if (canNativeInstall()) {
    const result = await showInstallPrompt()
    if (!result) {
      console.log("[PWA] 安装被拒绝或失败")
    }
  }
  // iOS: 显示 iOS 安装指南
  else if (isIOS()) {
    showIOSGuide.value = true
  }
  // Android: 没有原生安装能力，显示引导
  else if (isAndroid()) {
    showAndroidGuide.value = true
  }
}

function handleDismissInstall() {
  dismissInstall()
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

function getActionName() {
  return '短视频评价官'
}

async function refreshLocation() {
  locationLoading.value = true
  locationError.value = ''
  try {
    const location = await refreshLocationAPI()
    userLocation.value = location
    await loadRecommendTasks()
  } catch (e) {
    locationError.value = e.message || '定位失败'
  } finally {
    locationLoading.value = false
  }
}

async function loadRecommendTasks() {
  try {
    const list = await getTasks()
    recommendTasks.value = Array.isArray(list) ? list.slice(0, 5) : []
  } catch (e) {
    recommendTasks.value = []
  }
}

async function loadRanks() {
  rankLoading.value = true
  try {
    const [total, daily] = await Promise.all([
      getTotalRank(3),
      getDailyPointsRank(3)
    ])
    rankList.value = total || []
    dailyRankList.value = daily || []
  } catch (e) {
    rankList.value = []
    dailyRankList.value = []
  } finally {
    rankLoading.value = false
  }
}

async function loadMyRank() {
  if (!isLoggedIn.value) {
    myRank.value = null
    return
  }
  try {
    myRank.value = await getMyRank()
  } catch (e) {
    myRank.value = null
  }
}

async function loadWallet() {
  if (!isLoggedIn.value) return
  try {
    const wallet = await getWallet()
    userPoints.value = wallet.points || 0
    userBalance.value = String(wallet.balance ?? '0.00')
  } catch (e) {
    userPoints.value = 0
    userBalance.value = '0.00'
  }
}

async function loadTodayStats() {
  try {
    todayStats.value = await getTodayStats()
  } catch (e) {
    todayStats.value = null
  }
}

async function loadLocationFromCache() {
  locationLoading.value = true
  locationError.value = ''
  try {
    // 始终走 getLocation：内部会优先用未过期且完整的缓存，并统一走 GPS 配额 / IP 兜底
    userLocation.value = await getLocation()
  } catch (e) {
    locationError.value = e.message || '定位失败'
  } finally {
    locationLoading.value = false
  }
}

async function loadUnreadNotify() {
  if (!isLoggedIn.value) {
    unreadNotifyCount.value = 0
    return
  }
  try {
    unreadNotifyCount.value = await fetchUnreadCount()
  } catch (e) {
    unreadNotifyCount.value = 0
  }
}

function scheduleDeferredHomeLoad() {
  const run = async () => {
    try {
      await loadLocationFromCache()
      await loadRecommendTasks()
    } catch (e) {}
  }
  if (typeof globalThis.requestIdleCallback === 'function') {
    globalThis.requestIdleCallback(() => { run() }, { timeout: 2200 })
  } else {
    setTimeout(run, 300)
  }
}

async function load() {
  await Promise.all([
    loadWallet(),
    loadRanks(),
    loadMyRank(),
    loadTodayStats(),
    loadUnreadNotify(),
  ])
  scheduleDeferredHomeLoad()
}

onMounted(load)
onActivated(load)
</script>

<style scoped>
.home-page {
  padding-top: 18px;
}

.home-top-header {
  padding: 8px 0 4px;
  align-items: flex-start;
}

.home-main-title {
  margin: 0;
  font-size: 26px;
  line-height: 1.1;
  letter-spacing: -0.03em;
  color: #1a2332;
  font-weight: 800;
}

.home-main-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: #8b95a5;
  font-weight: 500;
}

.home-summary-card {
  border-radius: 22px;
  padding: 12px 12px 10px;
  background:
    radial-gradient(circle at top right, rgba(241,164,35,0.16), transparent 28%),
    linear-gradient(180deg, rgba(255,252,247,0.98), rgba(255,255,255,0.94));
}

.summary-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.summary-rank-pill {
  min-width: 72px;
  padding: 6px 10px;
  text-align: center;
  border-radius: 12px;
  background: linear-gradient(135deg, #f26a4d 0%, #e85a3c 100%);
  color: #fff;
  box-shadow: 0 4px 14px rgba(242, 106, 77, 0.35);
}

.summary-rank-pill.compact {
  min-width: 68px;
  padding: 5px 8px;
  border-radius: 10px;
  box-shadow: 0 3px 10px rgba(242, 106, 77, 0.28);
  box-shadow: 0 4px 14px rgba(242, 106, 77, 0.35);
}

.summary-rank-pill b {
  display: block;
  font-size: 15px;
  line-height: 1.2;
  margin-bottom: 1px;
  letter-spacing: -0.02em;
}

.summary-rank-pill small {
  font-size: 10px;
  opacity: 0.9;
  font-weight: 600;
}

.summary-rank-pill.compact b {
  font-size: 14px;
  margin-bottom: 1px;
}

.summary-rank-pill.compact small {
  display: block;
  font-size: 9px;
  line-height: 1.1;
}

.summary-segment {
  margin-top: 4px;
}

.summary-inline-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 8px;
}

.inline-stat {
  padding: 8px 10px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(217, 226, 239, 0.88);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.inline-stat strong {
  color: var(--yx-deep);
  font-size: 16px;
  letter-spacing: -0.03em;
}

.inline-stat span {
  color: var(--yx-muted);
  font-size: 11px;
  font-weight: 600;
}

.yx-rank-list.compact {
  gap: 6px;
}

.yx-rank-list.compact :deep(.yx-rank-item) {
  min-height: 0;
  padding: 7px 9px;
  border-radius: 12px;
}

.yx-rank-list.compact :deep(.yx-list-main b) {
  font-size: 13px;
}

.yx-rank-list.compact :deep(.yx-list-main small) {
  margin-top: 1px;
  font-size: 10px;
}

.yx-rank-list.compact :deep(.yx-list-side strong) {
  font-size: 14px;
}

.summary-more-btn {
  margin-top: 8px;
  padding-top: 8px;
  padding-bottom: 8px;
}

.home-stats-inline {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.home-stats-inline .yx-metric-card.compact {
  padding: 10px 8px;
  border-radius: 14px;
  text-align: center;
}

.home-stats-inline .yx-metric-card.compact strong {
  font-size: 18px;
  margin-bottom: 3px;
}

.home-stats-inline .yx-metric-card.compact span {
  font-size: 10px;
  line-height: 1.35;
}

.home-mini-btn {
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
  line-height: 1.3;
}

.location-pin {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #5e7fd5, #7ea5ff);
  box-shadow: 0 10px 18px rgba(78, 111, 182, 0.2);
  position: relative;
}

.location-pin::before {
  content: '';
  position: absolute;
  inset: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
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

.home-reward-ribbon {
  margin-top: 12px;
}

.home-reward-banner {
  margin-top: 12px;
  padding: 10px 12px 10px;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  text-decoration: none;
  color: #fff;
  background:
    radial-gradient(circle at top left, rgba(255,255,255,0.24), transparent 28%),
    linear-gradient(135deg, #ff9458 0%, #f66e32 48%, #cf4c24 100%);
  box-shadow: 0 14px 26px rgba(224, 104, 53, 0.24);
}

.reward-banner-left {
  min-width: 0;
}

.reward-number-line {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.reward-number-line strong {
  font-size: 30px;
  line-height: 1;
  letter-spacing: -0.06em;
  font-weight: 900;
  text-shadow: 0 8px 16px rgba(118, 31, 0, 0.18);
}

.reward-number-line span {
  font-size: 16px;
  font-weight: 800;
  line-height: 1.1;
}

.home-reward-banner p {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: rgba(255, 247, 242, 0.94);
  font-weight: 700;
}

.reward-banner-right {
  display: flex;
  align-items: flex-start;
}

.reward-arrow {
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  padding: 9px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.35);
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}

.home-task-list {
  display: grid;
  gap: 12px;
}

.home-task-list :deep(.yx-task-card) {
  padding: 14px;
  border-radius: 20px;
}

.home-task-list :deep(.yx-task-head) {
  margin-bottom: 10px;
}

.home-task-list :deep(.yx-task-title) {
  font-size: 16px;
  margin-bottom: 4px;
}

.home-task-list :deep(.yx-task-sub) {
  font-size: 12px;
  line-height: 1.45;
}

.home-task-list :deep(.yx-reward-box) {
  min-width: 76px;
  padding: 8px 10px;
  border-radius: 16px;
}

.shortcut-icon {
  width: 38px;
  height: 38px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.72);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.35);
  font-size: 18px;
  margin-bottom: 10px;
}

.shortcut-tone-peach {
  background: linear-gradient(180deg, rgba(255, 239, 233, 0.92), rgba(255,255,255,0.88));
}

.shortcut-tone-blue {
  background: linear-gradient(180deg, rgba(233, 241, 255, 0.92), rgba(255,255,255,0.88));
}

.shortcut-tone-gold {
  background: linear-gradient(180deg, rgba(255, 246, 217, 0.92), rgba(255,255,255,0.88));
}

.shortcut-tone-mint {
  background: linear-gradient(180deg, rgba(226, 249, 241, 0.92), rgba(255,255,255,0.88));
}

.account-overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.account-card {
  display: block;
  padding: 14px;
  border-radius: 20px;
  color: inherit;
  border: 1px solid var(--yx-line);
  box-shadow: var(--yx-shadow-soft);
}

.points-card {
  background: linear-gradient(180deg, rgba(232, 240, 255, 0.96), rgba(255,255,255,0.92));
}

.balance-card {
  background: linear-gradient(180deg, rgba(255, 242, 207, 0.96), rgba(255,255,255,0.92));
}

.account-card-label {
  display: inline-flex;
  margin-bottom: 12px;
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(255,255,255,0.7);
  font-size: 11px;
  font-weight: 800;
  color: var(--yx-deep);
}

.account-card strong {
  display: block;
  font-size: 26px;
  line-height: 1;
  letter-spacing: -0.05em;
  color: var(--yx-deep);
}

.account-card small {
  display: block;
  margin-top: 8px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--yx-muted);
}

.ios-install-modal {
  position: fixed;
  inset: 0;
  background: rgba(18, 24, 36, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  z-index: 10000;
}

.ios-modal-content {
  width: min(100%, 360px);
  border-radius: 24px;
  background: #fff;
  padding: 20px;
  box-shadow: 0 28px 60px rgba(11, 16, 28, 0.32);
}

.ios-modal-header {
  text-align: center;
  margin-bottom: 16px;
}

.ios-modal-header h3 {
  margin: 8px 0 0;
}

.ios-modal-body {
  display: grid;
  gap: 10px;
}

.ios-step {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 12px;
  align-items: flex-start;
}

.ios-step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--yx-coral-soft);
  color: #be4d31;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
}

.ios-step-text {
  color: var(--yx-muted);
  line-height: 1.7;
  font-size: 13px;
}

.ios-share-icon {
  display: inline-flex;
  width: 18px;
  height: 18px;
  border-radius: 6px;
  align-items: center;
  justify-content: center;
  background: rgba(33, 48, 75, 0.06);
  color: var(--yx-deep);
  margin: 0 4px;
}

.ios-modal-close {

/* Android 安装引导弹窗 */
.android-install-modal {
  position: fixed;
  inset: 0;
  background: rgba(18, 24, 36, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  z-index: 10000;
}

.android-modal-content {
  width: min(100%, 360px);
  border-radius: 24px;
  background: #fff;
  padding: 20px;
  box-shadow: 0 28px 60px rgba(11, 16, 28, 0.32);
}

.android-modal-header {
  text-align: center;
  margin-bottom: 16px;
}

.android-modal-header h3 {
  margin: 8px 0 0;
}

.android-modal-body {
  display: grid;
  gap: 10px;
}

.android-step {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 12px;
  align-items: flex-start;
}

.android-step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.android-step-text {
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  padding-top: 4px;
}

.android-modal-close {
  margin-top: 18px;
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
  margin-top: 16px;

/* Android 安装引导弹窗 */
.android-install-modal {
  position: fixed;
  inset: 0;
  background: rgba(18, 24, 36, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  z-index: 10000;
}

.android-modal-content {
  width: min(100%, 360px);
  border-radius: 24px;
  background: #fff;
  padding: 20px;
  box-shadow: 0 28px 60px rgba(11, 16, 28, 0.32);
}

.android-modal-header {
  text-align: center;
  margin-bottom: 16px;
}

.android-modal-header h3 {
  margin: 8px 0 0;
}

.android-modal-body {
  display: grid;
  gap: 10px;
}

.android-step {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 12px;
  align-items: flex-start;
}

.android-step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.android-step-text {
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  padding-top: 4px;
}

.android-modal-close {
  margin-top: 18px;
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
  width: 100%;

/* Android 安装引导弹窗 */
.android-install-modal {
  position: fixed;
  inset: 0;
  background: rgba(18, 24, 36, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  z-index: 10000;
}

.android-modal-content {
  width: min(100%, 360px);
  border-radius: 24px;
  background: #fff;
  padding: 20px;
  box-shadow: 0 28px 60px rgba(11, 16, 28, 0.32);
}

.android-modal-header {
  text-align: center;
  margin-bottom: 16px;
}

.android-modal-header h3 {
  margin: 8px 0 0;
}

.android-modal-body {
  display: grid;
  gap: 10px;
}

.android-step {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 12px;
  align-items: flex-start;
}

.android-step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.android-step-text {
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  padding-top: 4px;
}

.android-modal-close {
  margin-top: 18px;
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
  border: none;

/* Android 安装引导弹窗 */
.android-install-modal {
  position: fixed;
  inset: 0;
  background: rgba(18, 24, 36, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  z-index: 10000;
}

.android-modal-content {
  width: min(100%, 360px);
  border-radius: 24px;
  background: #fff;
  padding: 20px;
  box-shadow: 0 28px 60px rgba(11, 16, 28, 0.32);
}

.android-modal-header {
  text-align: center;
  margin-bottom: 16px;
}

.android-modal-header h3 {
  margin: 8px 0 0;
}

.android-modal-body {
  display: grid;
  gap: 10px;
}

.android-step {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 12px;
  align-items: flex-start;
}

.android-step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.android-step-text {
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  padding-top: 4px;
}

.android-modal-close {
  margin-top: 18px;
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
  border-radius: 14px;

/* Android 安装引导弹窗 */
.android-install-modal {
  position: fixed;
  inset: 0;
  background: rgba(18, 24, 36, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  z-index: 10000;
}

.android-modal-content {
  width: min(100%, 360px);
  border-radius: 24px;
  background: #fff;
  padding: 20px;
  box-shadow: 0 28px 60px rgba(11, 16, 28, 0.32);
}

.android-modal-header {
  text-align: center;
  margin-bottom: 16px;
}

.android-modal-header h3 {
  margin: 8px 0 0;
}

.android-modal-body {
  display: grid;
  gap: 10px;
}

.android-step {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 12px;
  align-items: flex-start;
}

.android-step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.android-step-text {
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  padding-top: 4px;
}

.android-modal-close {
  margin-top: 18px;
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
  padding: 12px 14px;

/* Android 安装引导弹窗 */
.android-install-modal {
  position: fixed;
  inset: 0;
  background: rgba(18, 24, 36, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  z-index: 10000;
}

.android-modal-content {
  width: min(100%, 360px);
  border-radius: 24px;
  background: #fff;
  padding: 20px;
  box-shadow: 0 28px 60px rgba(11, 16, 28, 0.32);
}

.android-modal-header {
  text-align: center;
  margin-bottom: 16px;
}

.android-modal-header h3 {
  margin: 8px 0 0;
}

.android-modal-body {
  display: grid;
  gap: 10px;
}

.android-step {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 12px;
  align-items: flex-start;
}

.android-step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.android-step-text {
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  padding-top: 4px;
}

.android-modal-close {
  margin-top: 18px;
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
  background: var(--yx-coral);

/* Android 安装引导弹窗 */
.android-install-modal {
  position: fixed;
  inset: 0;
  background: rgba(18, 24, 36, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  z-index: 10000;
}

.android-modal-content {
  width: min(100%, 360px);
  border-radius: 24px;
  background: #fff;
  padding: 20px;
  box-shadow: 0 28px 60px rgba(11, 16, 28, 0.32);
}

.android-modal-header {
  text-align: center;
  margin-bottom: 16px;
}

.android-modal-header h3 {
  margin: 8px 0 0;
}

.android-modal-body {
  display: grid;
  gap: 10px;
}

.android-step {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 12px;
  align-items: flex-start;
}

.android-step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.android-step-text {
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  padding-top: 4px;
}

.android-modal-close {
  margin-top: 18px;
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
  color: #fff;

/* Android 安装引导弹窗 */
.android-install-modal {
  position: fixed;
  inset: 0;
  background: rgba(18, 24, 36, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  z-index: 10000;
}

.android-modal-content {
  width: min(100%, 360px);
  border-radius: 24px;
  background: #fff;
  padding: 20px;
  box-shadow: 0 28px 60px rgba(11, 16, 28, 0.32);
}

.android-modal-header {
  text-align: center;
  margin-bottom: 16px;
}

.android-modal-header h3 {
  margin: 8px 0 0;
}

.android-modal-body {
  display: grid;
  gap: 10px;
}

.android-step {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 12px;
  align-items: flex-start;
}

.android-step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.android-step-text {
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  padding-top: 4px;
}

.android-modal-close {
  margin-top: 18px;
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
  font-weight: 800;

/* Android 安装引导弹窗 */
.android-install-modal {
  position: fixed;
  inset: 0;
  background: rgba(18, 24, 36, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  z-index: 10000;
}

.android-modal-content {
  width: min(100%, 360px);
  border-radius: 24px;
  background: #fff;
  padding: 20px;
  box-shadow: 0 28px 60px rgba(11, 16, 28, 0.32);
}

.android-modal-header {
  text-align: center;
  margin-bottom: 16px;
}

.android-modal-header h3 {
  margin: 8px 0 0;
}

.android-modal-body {
  display: grid;
  gap: 10px;
}

.android-step {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 12px;
  align-items: flex-start;
}

.android-step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.android-step-text {
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  padding-top: 4px;
}

.android-modal-close {
  margin-top: 18px;
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
}

/* Android 安装引导弹窗 */
.android-install-modal {
  position: fixed;
  inset: 0;
  background: rgba(18, 24, 36, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  z-index: 10000;
}

.android-modal-content {
  width: min(100%, 360px);
  border-radius: 24px;
  background: #fff;
  padding: 20px;
  box-shadow: 0 28px 60px rgba(11, 16, 28, 0.32);
}

.android-modal-header {
  text-align: center;
  margin-bottom: 16px;
}

.android-modal-header h3 {
  margin: 8px 0 0;
}

.android-modal-body {
  display: grid;
  gap: 10px;
}

.android-step {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 12px;
  align-items: flex-start;
}

.android-step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.android-step-text {
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  padding-top: 4px;
}

.android-modal-close {
  margin-top: 18px;
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

@media (max-width: 480px) {
  .reward-number-line {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .reward-number-line strong {
    font-size: 30px;
  }
}

.home-title-text {
  display: inline-block;
  background: linear-gradient(110deg, #1a2332 0%, #f26a4d 22%, #f1a423 45%, #7c3aed 72%, #1a2332 100%);
  background-size: 220% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  animation: titleShine 4.5s ease-in-out infinite;
  position: relative;
}

.home-title-text::after {
  content: "";
  pointer-events: none;
  position: absolute;
  inset: 0;
  background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.92) 45%, transparent 80%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  mix-blend-mode: overlay;
  animation: titleGlint 3.2s ease-in-out infinite;
  opacity: 0.35;
}

@keyframes titleShine {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

@keyframes titleGlint {
  0%, 100% { background-position: -80% 0; opacity: 0.2; }
  50% { background-position: 120% 0; opacity: 0.55; }
}

.rank-title-row {
  margin-bottom: 2px;
}

.rank-title-row h3 {
  margin: 0;
  font-size: 15px;
}

.home-summary-card {
  padding: 8px 10px 6px;
}

.summary-segment {
  margin-top: 4px;
}

.summary-inline-stats {
  margin-top: 4px;
}

.summary-inline-stats .inline-stat {
  padding: 6px 8px;
}

.yx-rank-list.compact {
  margin-top: 6px !important;
}

.summary-rank-pill {
  background: linear-gradient(135deg, #ffd8c8 0%, #ffc9b3 48%, #ffb39c 100%) !important;
  color: #6b2f22 !important;
  box-shadow: 0 3px 10px rgba(242, 106, 77, 0.18) !important;
}

.summary-rank-pill small {
  color: rgba(90, 40, 30, 0.75) !important;
  opacity: 1 !important;
}

.reward-row {
  text-align: center;
}

.reward-row-1 {
  display: flex;
  align-items: baseline;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px 8px;
  margin-top: 2px;
  line-height: 1.05;
}

.gradient-mega {
  font-size: clamp(28px, 8vw, 34px);
  font-weight: 900;
  letter-spacing: -0.04em;
  background: linear-gradient(100deg, #fff7ed 0%, #fde68a 35%, #fff 55%, #fde68a 75%, #fff7ed 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: megaGlow 3s ease-in-out infinite;
}

.reward-row-suffix {
  font-size: 16px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.96);
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
}

.reward-row-2 {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.5;
  color: rgba(255, 252, 248, 0.95);
}

.reward-accent-num {
  display: inline-block;
  font-size: 19px;
  font-weight: 900;
  margin: 0 2px;
  color: #fff6d6;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}

@keyframes megaGlow {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

.home-reward-banner {
  align-items: center;
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
  box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.45);
}

@keyframes slotPulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.35); }
  50% { transform: scale(1.03); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
}




.reward-tag-corner {
  position: absolute;
  top: 10px;
  left: 12px;
  z-index: 3;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.35);
  color: #fff;
}
.reward-banner-body {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  min-height: 72px;
  padding: 4px 4px 2px;
}

/* --- mar29: 福利条、排行可读色、底部协议 --- */
.home-reward-banner {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: stretch;
  min-height: 108px;
  padding: 38px 12px 14px;
  margin-bottom: 14px;
}

.home-reward-banner .reward-banner-body {
  flex: 1;
  justify-content: center;
}

.reward-arrow-top {
  position: absolute;
  top: 8px;
  right: 10px;
  z-index: 2;
}

.home-today-stats {
  margin-top: 0;
}

.home-summary-card :deep(.yx-rank-badge.gold) {
  background: linear-gradient(135deg, #c2410c, #ea580c) !important;
  color: #fff !important;
  box-shadow: 0 2px 8px rgba(234, 88, 12, 0.35);
}

.home-summary-card :deep(.yx-rank-badge:not(.gold)) {
  background: rgba(31, 42, 65, 0.1);
  color: #1a2332;
}

.home-summary-card :deep(.yx-list-main b) {
  color: #1a2332;
}

.home-summary-card :deep(.yx-list-main small) {
  color: #4b5563;
}

.home-summary-card :deep(.yx-list-side strong) {
  color: #0f172a;
}

.rank-title-row h3 {
  color: #1a2332;
}

.home-summary-card .inline-stat strong {
  color: #0f172a !important;
}

.home-summary-card .inline-stat span {
  color: #4b5563 !important;
}

.home-legal-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px 10px;
  margin: 22px 0 10px;
  font-size: 12px;
  font-weight: 600;
}

.home-legal-strip a {
  color: #5c6b8a;
  text-decoration: none;
}

.home-legal-strip a:active {
  color: var(--yx-coral);
}

.home-legal-dot {
  opacity: 0.45;
  color: var(--yx-muted);
}


.home-notify-btn {
  position: relative;
}

.home-notify-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  line-height: 16px;
  text-align: center;
  box-shadow: 0 2px 6px rgba(239, 68, 68, 0.45);
}


/* PWA 安装浮动横幅 */
.pwa-install-float {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
  color: #fff;
  margin-bottom: 8px;
}

/* 主屏图标独立窗口打开时隐藏安装提示（与 JS 的 display-mode 双保险，避免安卓偶发未识别） */
@media (display-mode: standalone) {
  .pwa-install-float,
  .home-pwa-install-section {
    display: none !important;
  }
}

.pwa-float-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.pwa-float-text {
  flex: 1;
  min-width: 0;
}

.pwa-float-text strong {
  display: block;
  font-size: 14px;
  font-weight: 700;
}

.pwa-float-text span {
  font-size: 12px;
  opacity: 0.9;
}

.pwa-float-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pwa-float-dismiss {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}

.pwa-float-install {
  padding: 8px 16px;
  border: none;
  border-radius: 20px;
  background: #fff;
  color: #7c3aed;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

/* 微信/QQ 浏览器引导 */
.pwa-browser-guide {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);
  color: #fff;
  font-size: 13px;
  margin-bottom: 8px;
}

.pwa-guide-icon {
  font-size: 16px;
}

.pwa-browser-guide b {
  font-weight: 700;
}

.pwa-guide-close {
  margin-left: auto;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}

</style>
