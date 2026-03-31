<template>
  <div class="yx-page achievements-page">
    <header class="yx-header center">
      <button class="yx-back-btn" @click="$router.back()">←</button>
      <div class="yx-header-main">
        <h1 class="yx-title sm">我的成就</h1>
        <p class="yx-subtitle">成就图标、解锁状态、进度条和奖励积分统一到一套更完整的成长界面里。</p>
      </div>
      <div class="yx-icon-btn">🏅</div>
    </header>

    <section class="yx-hero-card">
      <div class="yx-summary-grid three">
        <div class="yx-stat-card">
          <strong>{{ stats.achieved }}</strong>
          <span>已获得</span>
        </div>
        <div class="yx-stat-card">
          <strong>{{ stats.total }}</strong>
          <span>总成就</span>
        </div>
        <div class="yx-stat-card">
          <strong>{{ stats.totalRewardPoints }}</strong>
          <span>奖励积分</span>
        </div>
      </div>
    </section>

    <section class="yx-card">
      <div class="yx-segment">
        <button :class="{ active: activeTab === 'all' }" @click="activeTab = 'all'">全部</button>
        <button :class="{ active: activeTab === 'achieved' }" @click="activeTab = 'achieved'">已获得</button>
        <button :class="{ active: activeTab === 'locked' }" @click="activeTab = 'locked'">未解锁</button>
      </div>
    </section>

    <div class="yx-empty" v-if="loading">
      <strong>加载中...</strong>
      <span>正在读取你的成就与进度信息。</span>
    </div>

    <section class="achievement-stack" v-else>
      <article class="achievement-card" :class="{ achieved: a.is_achieved }" v-for="a in filteredAchievements" :key="a.id">
        <div class="achievement-icon">{{ getAchievementIcon(a) }}</div>
        <div class="achievement-main">
          <div class="achievement-head">
            <b>{{ a.name }}</b>
            <span class="reward-chip" v-if="a.reward_points > 0">+{{ a.reward_points }}积分</span>
          </div>
          <small>{{ a.description }}</small>

          <div class="progress-row" v-if="!a.is_achieved && a.progress">
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: a.progress.percent + '%' }"></div>
            </div>
            <span>{{ a.progress.current }}/{{ a.progress.target }}</span>
          </div>

          <div class="achieved-time" v-if="a.is_achieved">获得于 {{ formatDate(a.achieved_at) }}</div>
        </div>
        <div class="achievement-state">{{ a.is_achieved ? '✓' : '🔒' }}</div>
      </article>

      <div class="yx-empty" v-if="filteredAchievements.length === 0">
        <strong>暂无成就</strong>
        <span>完成更多任务、签到、推广或累计积分后，这里会逐步点亮。</span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getUserAchievements, getAchievementStats } from '../api/achievement'

const loading = ref(true)
const achievements = ref([])
const stats = ref({
  total: 0,
  achieved: 0,
  totalRewardPoints: 0
})
const activeTab = ref('all')

const filteredAchievements = computed(() => {
  if (activeTab.value === 'achieved') return achievements.value.filter(a => a.is_achieved)
  if (activeTab.value === 'locked') return achievements.value.filter(a => !a.is_achieved)
  return achievements.value
})

const loadData = async () => {
  loading.value = true
  try {
    const [achievementsData, statsData] = await Promise.all([
      getUserAchievements(),
      getAchievementStats()
    ])
    achievements.value = achievementsData
    stats.value = statsData
  } catch (e) {
    achievements.value = []
  } finally {
    loading.value = false
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

const getAchievementIcon = (achievement) => {
  if (achievement?.icon) return achievement.icon
  const conditionType = achievement?.condition_type || achievement?.conditionType
  const conditionValue = Number(achievement?.condition_value || achievement?.conditionValue || 0)
  const name = achievement?.name || ''
  if (conditionType === 'continuous_sign' || name.includes('签到')) {
    if (conditionValue >= 30) return '📆'
    if (conditionValue >= 7) return '🗓️'
    return '📅'
  }
  if (conditionType === 'total_points' || name.includes('积分')) {
    if (conditionValue >= 1000) return '💎'
    if (conditionValue >= 500) return '💠'
    return '✨'
  }
  if (conditionType === 'total_tasks' || name.includes('任务')) {
    if (conditionValue >= 100) return '🏆'
    if (conditionValue >= 50) return '🔥'
    if (conditionValue >= 10) return '⚡'
    return '🎯'
  }
  if (name.includes('邀请') || name.includes('推广')) return '🎉'
  if (name.includes('达人')) return '🌟'
  return '🏅'
}

onMounted(loadData)
</script>

<style scoped>
.achievements-page {
  padding-top: 18px;
}

.achievement-stack {
  display: grid;
  gap: 12px;
}

.achievement-card {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-radius: 24px;
  border: 1px solid var(--yx-line);
  background: rgba(255,255,255,0.92);
  box-shadow: var(--yx-shadow-soft);
}

.achievement-card.achieved {
  background:
    radial-gradient(circle at top right, rgba(241,164,35,0.16), transparent 28%),
    rgba(255,255,255,0.96);
}

.achievement-icon {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  border-radius: 18px;
  background: rgba(33,48,75,0.06);
  display: grid;
  place-items: center;
  font-size: 24px;
}

.achievement-main {
  flex: 1;
  min-width: 0;
}

.achievement-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 6px;
}

.achievement-head b {
  font-size: 16px;
  line-height: 1.4;
}

.achievement-main small,
.achieved-time {
  display: block;
  color: var(--yx-muted);
  line-height: 1.65;
  font-size: 12px;
}

.reward-chip {
  flex-shrink: 0;
  padding: 6px 9px;
  border-radius: 999px;
  background: var(--yx-gold-soft);
  color: #9a6200;
  font-size: 11px;
  font-weight: 800;
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  color: var(--yx-muted);
  font-size: 12px;
}

.progress-track {
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background: rgba(33,48,75,0.08);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--yx-coral), var(--yx-gold));
}

.achievement-state {
  color: var(--yx-coral);
  font-size: 20px;
  font-weight: 800;
}
</style>
