<template>
  <div class="yx-page achievements-page">
    <header class="yx-header center">
      <button class="yx-back-btn" @click="$router.back()">←</button>
      <div class="yx-header-main">
        <h1 class="yx-title sm">我的成就</h1>
        <p class="yx-subtitle">查看成就进度。</p>
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
      <div class="unlock-journey" v-if="stats.total > 0">
        <div class="unlock-journey-top">
          <span class="unlock-journey-label">成长路线</span>
          <span class="unlock-journey-count">{{ stats.achieved }}/{{ stats.total }} 已解锁</span>
        </div>
        <div class="unlock-journey-track">
          <div class="unlock-journey-fill" :style="{ width: unlockPercent + '%' }"></div>
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
      <span>正在读取成就。</span>
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
        <span>完成更多任务后会逐步点亮。</span>
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

const unlockPercent = computed(() => {
  const total = Number(stats.value.total || 0)
  if (!total) return 0
  return Math.min(100, Math.round((Number(stats.value.achieved || 0) / total) * 100))
})

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
  gap: 10px;
}

.achievement-card {
  display: flex;
  gap: 10px;
  padding: 14px;
  border-radius: 20px;
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
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  border-radius: 16px;
  background: rgba(33,48,75,0.06);
  display: grid;
  place-items: center;
  font-size: 22px;
}

.achievement-main {
  flex: 1;
  min-width: 0;
}

.achievement-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: flex-start;
  margin-bottom: 4px;
}

.achievement-head b {
  font-size: 15px;
  line-height: 1.35;
}

.achievement-main small,
.achieved-time {
  display: block;
  color: var(--yx-muted);
  line-height: 1.55;
  font-size: 11px;
}

.reward-chip {
  flex-shrink: 0;
  padding: 5px 8px;
  border-radius: 999px;
  background: var(--yx-gold-soft);
  color: #9a6200;
  font-size: 10px;
  font-weight: 800;
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  color: var(--yx-muted);
  font-size: 11px;
}

.progress-track {
  flex: 1;
  height: 7px;
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
  font-size: 18px;
  font-weight: 800;
}

.unlock-journey {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed rgba(31, 42, 65, 0.12);
}

.unlock-journey-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
}

.unlock-journey-label {
  font-weight: 800;
  color: var(--yx-deep);
}

.unlock-journey-count {
  font-weight: 800;
  background: linear-gradient(90deg, #6b7280, #d97706, #ca8a04);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.unlock-journey-track {
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(107,114,128,0.2), rgba(212,175,55,0.15));
  overflow: hidden;
  box-shadow: inset 0 1px 2px rgba(15,23,42,0.08);
}

.unlock-journey-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #9ca3af 0%, #fcd34d 38%, #f59e0b 72%, #d97706 100%);
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

</style>
