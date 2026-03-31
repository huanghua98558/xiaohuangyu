<template>
  <div class="yx-page home-page">
    <header class="yx-header home-top-header">
      <div class="yx-header-main">
        <h1 class="home-main-title">小黄鱼任务中心</h1>
        <p class="home-main-subtitle">做任务，领积分，兑好礼</p>
      </div>
      <router-link v-if="!isLoggedIn" to="/login" class="yx-icon-btn">登</router-link>
      <router-link v-else to="/notifications" class="yx-icon-btn">🔔</router-link>
    </header>

    <section class="yx-card home-summary-card">
      <div class="summary-top-row">
        <div>
          <h3>{{ activeRankTab === 'total' ? '总排行' : '今日排行' }}</h3>
          <div class="yx-card-note">{{ activeRankTab === 'total' ? '累计积分排名' : '今日积分排名' }}</div>
        </div>
        <div class="summary-rank-pill compact">
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
      <div class="reward-banner-left">
        <span class="reward-badge">积分福利</span>
        <div class="reward-number-line">
          <strong>2000万</strong>
          <span>积分持续送</span>
        </div>
        <p>完成任务、签到、推广都能领取积分奖励</p>
      </div>
      <div class="reward-banner-right">
        <span class="reward-arrow">查看奖励</span>
      </div>
    </router-link>

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
          <span>今日发布任务</span>
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
          <h3>定位与匹配</h3>
          <div class="yx-card-note">按地区推荐</div>
        </div>
        <button class="yx-btn-ghost home-mini-btn" @click="refreshLocation">刷新</button>
      </div>
      <div class="location-strip">
        <span>📍</span>
        <span v-if="locationLoading">正在获取位置...</span>
        <span v-else-if="userLocation">{{ userLocation.province }} {{ userLocation.city }}</span>
        <span v-else-if="locationError" class="error-text">{{ locationError }}</span>
        <span v-else>尚未获取位置，点击刷新获取当前位置</span>
      </div>
    </section>

    <section class="yx-card">
      <div class="yx-card-head">
        <div>
          <h3>推荐任务</h3>
          <div class="yx-card-note">优先展示适合你的任务</div>
        </div>
        <router-link to="/tasks" class="yx-btn-ghost home-mini-btn">更多任务</router-link>
      </div>

      <div class="home-task-list" v-if="recommendTasks.length">
        <article class="yx-task-card" v-for="t in recommendTasks" :key="t.id" @click="$router.push(`/task/${t.id}`)">
          <div class="yx-task-head">
            <div>
              <p class="yx-task-title">{{ t.title }}</p>
              <div class="yx-task-sub">{{ getPlatformName(t.platform) }} · {{ getActionName(t.action) }} · 剩余 {{ t.remain }} 名额</div>
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
      <div class="yx-card-head">
        <div>
          <h3>快捷入口</h3>
          <div class="yx-card-note">常用功能入口</div>
        </div>
      </div>
      <div class="yx-shortcut-grid two">
        <router-link to="/tasks" class="yx-shortcut-card">
          <b>任务大厅</b>
          <small>浏览全部任务与筛选任务</small>
        </router-link>
        <router-link to="/my/tasks" class="yx-shortcut-card">
          <b>我的任务</b>
          <small>查看处理中、待审核、已完成</small>
        </router-link>
        <router-link to="/points" class="yx-shortcut-card">
          <b>积分中心</b>
          <small>查看积分、兑换和提现</small>
        </router-link>
        <router-link to="/invite" class="yx-shortcut-card">
          <b>推广中心</b>
          <small>邀请好友、查看返佣与奖励</small>
        </router-link>
      </div>
    </section>

    <section class="yx-soft-card" v-if="showInstallButton">
      <div class="yx-card-head" style="margin-bottom:0;">
        <div>
          <h3>添加到桌面</h3>
          <div class="yx-card-note">安装后打开更快</div>
        </div>
        <button class="yx-btn" @click="handleInstall">立即安装</button>
      </div>
    </section>

    <section class="yx-card" v-if="isLoggedIn">
      <div class="yx-card-head">
        <div>
          <h3>账户概览</h3>
          <div class="yx-card-note">积分与余额</div>
        </div>
      </div>
      <div class="yx-summary-grid two">
        <router-link to="/points" class="yx-stat-card">
          <strong>{{ userPoints }}</strong>
          <span>我的积分</span>
        </router-link>
        <router-link to="/withdraw" class="yx-stat-card">
          <strong>¥{{ userBalance }}</strong>
          <span>可提现余额</span>
        </router-link>
      </div>
    </section>

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
</template>

<script setup>
import { ref, computed, onMounted, onActivated } from 'vue'
import { useAuth } from '../store/auth'
import { getTasks, getTotalRank, getDailyPointsRank, getWallet, getMyRank, getTodayStats } from '../api/task'
import { getLocation, getSavedLocation, refreshLocation as refreshLocationAPI } from '../utils/location'
import { usePWAInstall, isIOS } from '../utils/pwa'

const { isLoggedIn, user } = useAuth()
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

const showInstallButton = computed(() => {
  if (isInstalled.value) return false
  if (isInstallable.value) return true
  if (isIOS() && !isInstalled.value) return true
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
  return current?.rank > 0 ? `#${current.rank}` : '未上榜'
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
    recommendTasks.value = Array.isArray(list) ? list.slice(0, 3) : []
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
    const cached = getSavedLocation()
    if (cached) {
      userLocation.value = cached
    } else {
      userLocation.value = await getLocation()
    }
  } catch (e) {
    locationError.value = e.message || '定位失败'
  } finally {
    locationLoading.value = false
  }
}

async function load() {
  await Promise.all([
    loadWallet(),
    loadRanks(),
    loadMyRank(),
    loadTodayStats(),
    loadLocationFromCache(),
    loadRecommendTasks()
  ])
}

onMounted(load)
onActivated(load)
</script>

<style scoped>
.home-page {
  padding-top: 18px;
}

.home-top-header {
  align-items: flex-start;
}

.home-main-title {
  margin: 0;
  font-size: 28px;
  line-height: 1.08;
  letter-spacing: -0.04em;
  color: var(--yx-deep);
  font-weight: 900;
}

.home-main-subtitle {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--yx-muted);
  font-weight: 600;
}

.home-summary-card {
  border-radius: 26px;
  padding: 16px 16px 14px;
  background:
    radial-gradient(circle at top right, rgba(241,164,35,0.16), transparent 28%),
    linear-gradient(180deg, rgba(255,252,247,0.98), rgba(255,255,255,0.94));
}

.summary-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.summary-rank-pill {
  min-width: 86px;
  padding: 10px 12px;
  text-align: center;
  border-radius: 18px;
  background: linear-gradient(180deg, #24344d, #31496f);
  color: #fff;
  box-shadow: 0 12px 26px rgba(36, 52, 77, 0.18);
}

.summary-rank-pill.compact {
  min-width: 92px;
  padding: 8px 10px;
  border-radius: 16px;
  box-shadow: 0 8px 20px rgba(36, 52, 77, 0.14);
}

.summary-rank-pill b {
  display: block;
  font-size: 24px;
  line-height: 1;
  margin-bottom: 4px;
  letter-spacing: -0.05em;
}

.summary-rank-pill small {
  font-size: 11px;
  opacity: 0.78;
  font-weight: 700;
}

.summary-rank-pill.compact b {
  font-size: 20px;
  margin-bottom: 3px;
}

.summary-rank-pill.compact small {
  display: block;
  font-size: 10px;
  line-height: 1.2;
}

.summary-segment {
  margin-top: 10px;
}

.summary-inline-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.inline-stat {
  padding: 10px 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(217, 226, 239, 0.88);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.inline-stat strong {
  color: var(--yx-deep);
  font-size: 18px;
  letter-spacing: -0.03em;
}

.inline-stat span {
  color: var(--yx-muted);
  font-size: 12px;
  font-weight: 600;
}

.yx-rank-list.compact {
  gap: 8px;
}

.yx-rank-list.compact :deep(.yx-rank-item) {
  min-height: 0;
  padding: 8px 10px;
  border-radius: 14px;
}

.yx-rank-list.compact :deep(.yx-list-main b) {
  font-size: 14px;
}

.yx-rank-list.compact :deep(.yx-list-main small) {
  margin-top: 1px;
  font-size: 11px;
}

.yx-rank-list.compact :deep(.yx-list-side strong) {
  font-size: 15px;
}

.summary-more-btn {
  margin-top: 10px;
  padding-top: 10px;
  padding-bottom: 10px;
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
  line-height: 1.6;
}

.error-text {
  color: #cf4a33;
}

.home-reward-ribbon {
  margin-top: 12px;
}

.home-reward-banner {
  margin-top: 12px;
  padding: 18px 18px 16px;
  border-radius: 24px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: #fff;
  background:
    radial-gradient(circle at top left, rgba(255,255,255,0.24), transparent 28%),
    linear-gradient(135deg, #ff9458 0%, #f66e32 48%, #cf4c24 100%);
  box-shadow: 0 18px 34px rgba(224, 104, 53, 0.26);
}

.reward-banner-left {
  min-width: 0;
}

.reward-badge {
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.reward-number-line {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 8px;
}

.reward-number-line strong {
  font-size: 34px;
  line-height: 1;
  letter-spacing: -0.06em;
  font-weight: 900;
  text-shadow: 0 8px 16px rgba(118, 31, 0, 0.18);
}

.reward-number-line span {
  font-size: 18px;
  font-weight: 800;
  line-height: 1.1;
}

.home-reward-banner p {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.55;
  color: rgba(255, 247, 242, 0.94);
}

.reward-banner-right {
  display: flex;
  align-items: center;
}

.reward-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 76px;
  padding: 11px 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.22);
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.home-task-list {
  display: grid;
  gap: 12px;
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
  margin-top: 16px;
  width: 100%;
  border: none;
  border-radius: 14px;
  padding: 12px 14px;
  background: var(--yx-coral);
  color: #fff;
  font-weight: 800;
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
</style>
