<template>
  <div class="achievements-page">
    <!-- 页面头部 -->
    <header class="page-header">
      <button class="back-btn" @click="$router.back()">
        <span>←</span>
      </button>
      <h1>我的成就</h1>
      <div style="width: 36px;"></div>
    </header>

    <!-- 成就统计 -->
    <div class="stats-card">
      <div class="stats-bg"></div>
      <div class="stats-content">
        <div class="stat-item">
          <span class="stat-value">{{ stats.achieved }}</span>
          <span class="stat-label">已获得</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.total }}</span>
          <span class="stat-label">总成就</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.totalRewardPoints }}</span>
          <span class="stat-label">奖励积分</span>
        </div>
      </div>
    </div>

    <!-- 成就分类标签 -->
    <div class="tabs">
      <div 
        class="tab" 
        :class="{ active: activeTab === 'all' }" 
        @click="activeTab = 'all'"
      >
        全部
      </div>
      <div 
        class="tab" 
        :class="{ active: activeTab === 'achieved' }" 
        @click="activeTab = 'achieved'"
      >
        已获得
      </div>
      <div 
        class="tab" 
        :class="{ active: activeTab === 'locked' }" 
        @click="activeTab = 'locked'"
      >
        未解锁
      </div>
    </div>

    <!-- 加载状态 -->
    <div class="loading" v-if="loading">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- 成就列表 -->
    <div class="achievements-list" v-else>
      <div 
        class="achievement-item"
        :class="{ achieved: a.is_achieved }"
        v-for="a in filteredAchievements"
        :key="a.id"
      >
        <div class="achievement-icon">{{ a.icon }}</div>
        <div class="achievement-info">
          <div class="achievement-header">
            <span class="achievement-name">{{ a.name }}</span>
            <span class="achievement-reward" v-if="a.reward_points > 0">
              +{{ a.reward_points }}积分
            </span>
          </div>
          <p class="achievement-desc">{{ a.description }}</p>
          
          <!-- 进度条 -->
          <div class="progress-bar" v-if="!a.is_achieved && a.progress">
            <div class="progress-fill" :style="{ width: a.progress.percent + '%' }"></div>
            <span class="progress-text">
              {{ a.progress.current }}/{{ a.progress.target }}
            </span>
          </div>
          
          <span class="achieved-time" v-if="a.is_achieved">
            获得于 {{ formatDate(a.achieved_at) }}
          </span>
        </div>
        <div class="achievement-status">
          <span v-if="a.is_achieved" class="status-achieved">✓</span>
          <span v-else class="status-locked">🔒</span>
        </div>
      </div>

      <div class="empty" v-if="filteredAchievements.length === 0">
        <span class="empty-icon">🏆</span>
        <span>暂无成就</span>
      </div>
    </div>
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
  if (activeTab.value === 'achieved') {
    return achievements.value.filter(a => a.is_achieved)
  } else if (activeTab.value === 'locked') {
    return achievements.value.filter(a => !a.is_achieved)
  }
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
    console.error('加载成就失败', e)
  } finally {
    loading.value = false
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.achievements-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 80px;
}

.page-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #fff;
  border-bottom: 1px solid #eee;
}

.back-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: #f5f5f5;
  border-radius: 50%;
  font-size: 18px;
  cursor: pointer;
}

.page-header h1 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.stats-card {
  position: relative;
  background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%);
  margin: 16px;
  padding: 24px;
  border-radius: 16px;
  overflow: hidden;
}

.stats-bg {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 50%;
  background: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Ctext x='50' y='60' font-size='60' text-anchor='middle'%3E🏆%3C/text%3E%3C/svg%3E") no-repeat center;
  opacity: 0.3;
}

.stats-content {
  position: relative;
  display: flex;
  justify-content: space-around;
}

.stat-item {
  text-align: center;
  color: #fff;
}

.stat-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  text-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.stat-label {
  font-size: 13px;
  opacity: 0.9;
}

.stat-divider {
  width: 1px;
  background: rgba(255,255,255,0.3);
}

.tabs {
  display: flex;
  background: #fff;
  padding: 12px 16px;
  gap: 12px;
  border-bottom: 1px solid #eee;
}

.tab {
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  color: #666;
  background: #f5f5f5;
  cursor: pointer;
  transition: all 0.2s;
}

.tab.active {
  background: #3f51b5;
  color: #fff;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
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

.achievements-list {
  padding: 12px;
}

.achievement-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  background: #fff;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 10px;
}

.achievement-item.achieved {
  background: linear-gradient(135deg, #fff 0%, #f0fff0 100%);
  border: 1px solid #c8e6c9;
}

.achievement-icon {
  width: 50px;
  height: 50px;
  background: #f5f5f5;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  flex-shrink: 0;
}

.achievement-item.achieved .achievement-icon {
  background: #e8f5e9;
}

.achievement-info {
  flex: 1;
  min-width: 0;
}

.achievement-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.achievement-name {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.achievement-reward {
  font-size: 13px;
  color: #ff6b00;
  font-weight: 500;
}

.achievement-desc {
  font-size: 13px;
  color: #666;
  margin: 0 0 8px 0;
  line-height: 1.4;
}

.progress-bar {
  position: relative;
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  overflow: hidden;
  margin-top: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3f51b5, #5c6bc0);
  border-radius: 3px;
  transition: width 0.3s;
}

.progress-text {
  position: absolute;
  right: 0;
  top: -18px;
  font-size: 11px;
  color: #999;
}

.achieved-time {
  font-size: 11px;
  color: #4caf50;
}

.achievement-status {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
}

.status-achieved {
  width: 24px;
  height: 24px;
  background: #4caf50;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.status-locked {
  font-size: 18px;
  opacity: 0.5;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 0;
  color: #999;
  gap: 8px;
}

.empty-icon {
  font-size: 48px;
}
</style>
