<template>
  <div class="yx-page no-tabbar rank-page">
    <header class="yx-header center">
      <button class="yx-back-btn" @click="$router.back()">←</button>
      <div class="yx-header-main">
        <h1 class="yx-title sm">排行榜</h1>
        <p class="yx-subtitle">总榜、周榜和月榜。</p>
      </div>
      <div class="yx-icon-btn">🏆</div>
    </header>

    <section class="yx-hero-card" v-if="isLoggedIn && myRank">
      <div class="yx-card-head-bar">
        <h3>我的排名<span class="yx-card-note">我的排行</span></h3>
      </div>
      <div class="yx-stats-grid three">
        <div class="yx-stat-card">
          <strong>{{ myRank.total ? myRank.total.rank : '-' }}</strong>
          <span>{{ myRank.total ? myRank.total.points : 0 }} 总积分</span>
        </div>
        <div class="yx-stat-card">
          <strong>{{ myRank.weekly && myRank.weekly.rank > 0 ? myRank.weekly.rank : '-' }}</strong>
          <span>{{ myRank.weekly ? myRank.weekly.points : 0 }} 周积分</span>
        </div>
        <div class="yx-stat-card">
          <strong>{{ myRank.monthly && myRank.monthly.rank > 0 ? myRank.monthly.rank : '-' }}</strong>
          <span>{{ myRank.monthly ? myRank.monthly.points : 0 }} 月积分</span>
        </div>
      </div>
    </section>

    <section class="yx-card">
      <div class="yx-segment">
        <button :class="{ active: tab==='total' }" @click="switchTab('total')">总排行</button>
        <button :class="{ active: tab==='weekly' }" @click="switchTab('weekly')">周排行</button>
        <button :class="{ active: tab==='monthly' }" @click="switchTab('monthly')">月排行</button>
      </div>
    </section>

    <section class="yx-card" v-if="tab !== 'total'">
      <div class="yx-card-head-bar">
        <h3>{{ tab === 'weekly' ? '周榜奖励' : '月榜奖励' }}<span class="yx-card-note">排行奖励说明</span></h3>
      </div>
      <div class="rank-reward-alert" :class="{ off: !currentRewardEnabled }">
        <strong>{{ currentRewardEnabled ? '奖励发放中' : '奖励已关闭' }}</strong>
        <span>{{ currentRewardEnabled ? '排行榜奖励以后台当前设置为准。' : '当前周期仍展示榜单，但不会自动发放排行奖励。' }}</span>
      </div>
      <div class="yx-list">
        <div class="yx-list-item" v-for="item in currentRewardList" :key="`${tab}-${item.key}`">
          <div class="yx-list-main"><b>{{ item.label }}</b><small>{{ item.subLabel }}</small></div>
          <div class="yx-list-side">{{ formatPoints(item.points) }} 积分</div>
        </div>
      </div>
    </section>

    <section class="yx-card top-three-card" v-if="currentList.length >= 3">
      <div class="podium">
        <div class="podium-item second">
          <span class="podium-medal">🥈</span>
          <b>{{ currentList[1].username }}</b>
          <small>{{ getPoints(currentList[1]) }}</small>
        </div>
        <div class="podium-item first">
          <span class="podium-medal">🥇</span>
          <b>{{ currentList[0].username }}</b>
          <small>{{ getPoints(currentList[0]) }}</small>
        </div>
        <div class="podium-item third">
          <span class="podium-medal">🥉</span>
          <b>{{ currentList[2].username }}</b>
          <small>{{ getPoints(currentList[2]) }}</small>
        </div>
      </div>
    </section>

    <section class="yx-card">
      <div class="yx-card-head-bar">
        <h3>{{ currentTitle }}<span class="yx-card-note">当前榜单</span></h3>
      </div>

      <div class="yx-list" v-if="currentList.length">
        <div class="yx-list-item" v-for="(r, i) in displayList" :key="r.id || `${tab}-${i}`">
          <span class="yx-rank-badge" :class="{ gold: getRankNumber(i) === 1 }">{{ getRankNumber(i) }}</span>
          <div class="yx-list-main">
            <b>{{ r.username }}</b>
            <small v-if="r.level">Lv.{{ r.level }}</small>
          </div>
          <div class="yx-list-side">{{ getPoints(r) }}</div>
        </div>
      </div>
      <div class="yx-empty" v-else-if="!loading">
        <strong>暂无排行数据</strong>
        <span>当前暂无数据。</span>
      </div>
      <div class="yx-empty" v-else>
        <strong>加载中...</strong>
        <span>正在加载榜单。</span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated } from 'vue'
import { useAuth } from '../store/auth'
import { getTotalRank, getWeeklyRank, getMonthlyRank, getMyLeaderboardRank, getLeaderboardRewardConfig } from '../api/task'

const { isLoggedIn } = useAuth()
const tab = ref('total')
const totalList = ref([])
const weeklyList = ref([])
const monthlyList = ref([])
const myRank = ref(null)
const loading = ref(false)
const rewardConfig = ref({
  weekly: {
    enabled: true,
    rewards: [
      { key: 'top1', label: '第 1 名', subLabel: '榜首奖励', points: 300 },
      { key: 'top2', label: '第 2 名', subLabel: '第二名奖励', points: 100 },
      { key: 'top3', label: '第 3-5 名', subLabel: '前五奖励', points: 50 }
    ]
  },
  monthly: {
    enabled: true,
    rewards: [
      { key: 'top1', label: '第 1 名', subLabel: '榜首奖励', points: 2000 },
      { key: 'top2', label: '第 2 名', subLabel: '第二名奖励', points: 1000 },
      { key: 'top3', label: '第 3-5 名', subLabel: '前五奖励', points: 500 }
    ]
  }
})

const currentList = computed(() => {
  if (tab.value === 'total') return totalList.value
  if (tab.value === 'weekly') return weeklyList.value
  return monthlyList.value
})

const currentTitle = computed(() => {
  if (tab.value === 'weekly') return '周排行'
  if (tab.value === 'monthly') return '月排行'
  return '总排行'
})

const currentRewardConfig = computed(() => {
  if (tab.value === 'weekly') return rewardConfig.value.weekly
  if (tab.value === 'monthly') return rewardConfig.value.monthly
  return null
})

const currentRewardList = computed(() => currentRewardConfig.value?.rewards || [])
const currentRewardEnabled = computed(() => currentRewardConfig.value?.enabled !== false)

const displayList = computed(() => currentList.value.length < 3 ? currentList.value : currentList.value)

function getPoints(item) {
  if (tab.value === 'weekly') return `${item.weeklyPoints || 0} 周积分`
  if (tab.value === 'monthly') return `${item.monthlyPoints || 0} 月积分`
  return `${item.points || 0} 积分`
}

function getRankNumber(index) {
  return index + 1
}

function formatPoints(value) {
  const safeValue = Number(value || 0)
  return Number.isInteger(safeValue)
    ? String(safeValue)
    : safeValue.toFixed(2).replace(/\.?0+$/, '')
}

function switchTab(newTab) {
  tab.value = newTab
}

async function loadData() {
  loading.value = true
  try {
    const [total, weekly, monthly] = await Promise.all([
      getTotalRank(50),
      getWeeklyRank(50),
      getMonthlyRank(50)
    ])
    totalList.value = total || []
    weeklyList.value = weekly || []
    monthlyList.value = monthly || []
  } catch (e) {
    totalList.value = []
    weeklyList.value = []
    monthlyList.value = []
  } finally {
    loading.value = false
  }
}

async function loadMyRank() {
  if (!isLoggedIn.value) return
  try {
    myRank.value = await getMyLeaderboardRank()
  } catch (e) {
    myRank.value = null
  }
}

async function loadRewardConfig() {
  try {
    const data = await getLeaderboardRewardConfig()
    rewardConfig.value = data || rewardConfig.value
  } catch (e) {
    // 保留本地兜底配置，避免接口异常时页面空白
  }
}

onMounted(() => {
  loadData()
  loadMyRank()
  loadRewardConfig()
})
onActivated(() => {
  loadData()
  loadMyRank()
  loadRewardConfig()
})
</script>

<style scoped>
.rank-page {
  padding-top: 18px;
}

.top-three-card {
  background:
    radial-gradient(circle at top right, rgba(241,164,35,0.16), transparent 26%),
    rgba(255,255,255,0.94);
}

.podium {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  align-items: end;
}

.podium-item {
  padding: 8px 6px;
  border-radius: 18px;
  text-align: center;
  background: rgba(33,48,75,0.04);
  border: 1px solid rgba(33,48,75,0.06);
}

.podium-item.first {
  padding-top: 11px;
  padding-bottom: 11px;
}

.podium-medal {
  display: block;
  font-size: 18px;
  margin-bottom: 4px;
}

.podium-item b {
  display: block;
  font-size: 13px;
  margin-bottom: 3px;
}

.podium-item small {
  color: var(--yx-muted);
  line-height: 1.55;
}

.rank-reward-alert {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(56, 80, 126, 0.08);
  color: #38507e;
}

.rank-reward-alert strong {
  font-size: 14px;
}

.rank-reward-alert span {
  font-size: 12px;
  opacity: 0.8;
}

.rank-reward-alert.off {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}
</style>
