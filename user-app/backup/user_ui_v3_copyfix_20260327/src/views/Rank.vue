<template>
  <div class="yx-page no-tabbar rank-page">
    <header class="yx-header center">
      <button class="yx-back-btn" @click="$router.back()">←</button>
      <div class="yx-header-main">
        <h1 class="yx-title sm">排行榜</h1>
        <p class="yx-subtitle">总排行、周排行、月排行放成一个完整榜单页，奖励规则和我的位置一起展示。</p>
      </div>
      <div class="yx-icon-btn">🏆</div>
    </header>

    <section class="yx-hero-card" v-if="isLoggedIn && myRank">
      <div class="yx-card-head">
        <div>
          <h3>我的排名</h3>
          <div class="yx-card-note">总榜、周榜、月榜一页看完</div>
        </div>
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
      <div class="yx-card-head">
        <div>
          <h3>{{ tab === 'weekly' ? '周榜奖励' : '月榜奖励' }}</h3>
          <div class="yx-card-note">排行奖励会自动发放到积分账户</div>
        </div>
      </div>
      <div class="yx-list">
        <div class="yx-list-item">
          <div class="yx-list-main"><b>第 1 名</b><small>榜首奖励</small></div>
          <div class="yx-list-side">{{ tab === 'weekly' ? '300' : '2000' }} 积分</div>
        </div>
        <div class="yx-list-item">
          <div class="yx-list-main"><b>第 2 名</b><small>第二名奖励</small></div>
          <div class="yx-list-side">{{ tab === 'weekly' ? '100' : '1000' }} 积分</div>
        </div>
        <div class="yx-list-item">
          <div class="yx-list-main"><b>第 3-5 名</b><small>前五奖励</small></div>
          <div class="yx-list-side">{{ tab === 'weekly' ? '50' : '500' }} 积分</div>
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
      <div class="yx-card-head">
        <div>
          <h3>{{ currentTitle }}</h3>
          <div class="yx-card-note">完整榜单列表</div>
        </div>
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
        <span>当前榜单还没有可展示的数据。</span>
      </div>
      <div class="yx-empty" v-else>
        <strong>加载中...</strong>
        <span>正在拉取排行榜数据。</span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated } from 'vue'
import { useAuth } from '../store/auth'
import { getTotalRank, getWeeklyRank, getMonthlyRank, getMyLeaderboardRank } from '../api/task'

const { isLoggedIn } = useAuth()
const tab = ref('total')
const totalList = ref([])
const weeklyList = ref([])
const monthlyList = ref([])
const myRank = ref(null)
const loading = ref(false)

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

const displayList = computed(() => currentList.value.length < 3 ? currentList.value : currentList.value)

function getPoints(item) {
  if (tab.value === 'weekly') return `${item.weeklyPoints || 0} 周积分`
  if (tab.value === 'monthly') return `${item.monthlyPoints || 0} 月积分`
  return `${item.points || 0} 积分`
}

function getRankNumber(index) {
  return index + 1
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

onMounted(() => {
  loadData()
  loadMyRank()
})
onActivated(() => {
  loadData()
  loadMyRank()
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
  gap: 10px;
  align-items: end;
}

.podium-item {
  padding: 14px 10px;
  border-radius: 20px;
  text-align: center;
  background: rgba(33,48,75,0.04);
  border: 1px solid rgba(33,48,75,0.06);
}

.podium-item.first {
  padding-top: 20px;
  padding-bottom: 20px;
}

.podium-medal {
  display: block;
  font-size: 22px;
  margin-bottom: 8px;
}

.podium-item b {
  display: block;
  font-size: 14px;
  margin-bottom: 4px;
}

.podium-item small {
  color: var(--yx-muted);
  line-height: 1.55;
}
</style>
