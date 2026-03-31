<template>
  <div class="rank">
    <header class="header">
      <span class="back" @click="$router.back()">← 返回</span>
      <h1>排行榜</h1>
    </header>
    
    <!-- 我的排名 -->
    <div class="my-rank-card" v-if="isLoggedIn && myRank">
      <div class="my-rank-title">我的排名</div>
      <div class="my-rank-content">
        <div class="my-rank-item">
          <span class="label">总排行</span>
          <span class="value">第 {{ myRank.total ? myRank.total.rank : '-' }} 名</span>
          <span class="points">{{ myRank.total ? myRank.total.points : 0 }} 积分</span>
        </div>
        <div class="my-rank-divider"></div>
        <div class="my-rank-item">
          <span class="label">周排行</span>
          <span class="value">{{ myRank.weekly && myRank.weekly.rank > 0 ? '第 ' + myRank.weekly.rank + ' 名' : '未上榜' }}</span>
          <span class="points">{{ myRank.weekly ? myRank.weekly.points : 0 }} 周积分</span>
        </div>
        <div class="my-rank-divider"></div>
        <div class="my-rank-item">
          <span class="label">月排行</span>
          <span class="value">{{ myRank.monthly && myRank.monthly.rank > 0 ? '第 ' + myRank.monthly.rank + ' 名' : '未上榜' }}</span>
          <span class="points">{{ myRank.monthly ? myRank.monthly.points : 0 }} 月积分</span>
        </div>
      </div>
    </div>
    
    <!-- 排行榜切换 -->
    <div class="tabs">
      <span :class="{active: tab==='total'}" @click="switchTab('total')">🏆 总榜</span>
      <span :class="{active: tab==='weekly'}" @click="switchTab('weekly')">📅 周榜</span>
      <span :class="{active: tab==='monthly'}" @click="switchTab('monthly')">📆 月榜</span>
    </div>
    
    <!-- 奖励规则展示 -->
    <div class="reward-section" v-if="tab !== 'total'">
      <div class="reward-header">
        <span class="reward-icon">🎁</span>
        <span class="reward-title">{{ tab === 'weekly' ? '周榜奖励' : '月榜奖励' }}</span>
        <span class="reward-badge">积分奖励</span>
      </div>
      <div class="reward-list">
        <div class="reward-item first">
          <div class="reward-rank">
            <span class="rank-medal">🥇</span>
            <span class="rank-text">第1名</span>
          </div>
          <div class="reward-value">
            <span class="value-num">{{ tab === 'weekly' ? '300' : '2000' }}</span>
            <span class="value-unit">积分</span>
          </div>
        </div>
        <div class="reward-item second">
          <div class="reward-rank">
            <span class="rank-medal">🥈</span>
            <span class="rank-text">第2名</span>
          </div>
          <div class="reward-value">
            <span class="value-num">{{ tab === 'weekly' ? '100' : '1000' }}</span>
            <span class="value-unit">积分</span>
          </div>
        </div>
        <div class="reward-item third">
          <div class="reward-rank">
            <span class="rank-medal">🥉</span>
            <span class="rank-text">第3-5名</span>
          </div>
          <div class="reward-value">
            <span class="value-num">{{ tab === 'weekly' ? '50' : '500' }}</span>
            <span class="value-unit">积分</span>
          </div>
        </div>
      </div>
      <div class="reward-tip">
        <span class="tip-icon">💡</span>
        <span>每周一 / 每月1日自动发放奖励积分</span>
      </div>
    </div>
    
    <!-- 前三名展示 -->
    <div class="top-three" v-if="currentList.length >= 3">
      <div class="top-item second">
        <div class="top-avatar">🥈</div>
        <div class="top-name">{{ currentList[1].username }}</div>
        <div class="top-points">{{ getPoints(currentList[1]) }}</div>
        <div class="top-level" v-if="currentList[1].level">Lv.{{ currentList[1].level }}</div>
      </div>
      <div class="top-item first">
        <div class="top-avatar">🥇</div>
        <div class="top-name">{{ currentList[0].username }}</div>
        <div class="top-points">{{ getPoints(currentList[0]) }}</div>
        <div class="top-level" v-if="currentList[0].level">Lv.{{ currentList[0].level }}</div>
      </div>
      <div class="top-item third">
        <div class="top-avatar">🥉</div>
        <div class="top-name">{{ currentList[2].username }}</div>
        <div class="top-points">{{ getPoints(currentList[2]) }}</div>
        <div class="top-level" v-if="currentList[2].level">Lv.{{ currentList[2].level }}</div>
      </div>
    </div>
    
    <!-- 排行榜列表 - 显示所有数据 -->
    <div class="list">
      <!-- 数据少于3条时直接显示列表 -->
      <template v-if="currentList.length < 3">
        <div class="item" v-for="(r, i) in currentList" :key="r.id">
          <span class="rank-medal">{{ getMedal(i) }}</span>
          <span class="name">{{ r.username }}</span>
          <span class="level-badge" v-if="r.level">Lv.{{ r.level }}</span>
          <span class="points">{{ getPoints(r) }}</span>
        </div>
      </template>
      <!-- 数据大于等于3条时从第4名开始显示 -->
      <template v-else>
        <div class="item" v-for="(r, i) in currentList.slice(3)" :key="r.id">
          <span class="rank-num">{{ i + 4 }}</span>
          <span class="name">{{ r.username }}</span>
          <span class="level-badge" v-if="r.level">Lv.{{ r.level }}</span>
          <span class="points">{{ getPoints(r) }}</span>
        </div>
      </template>
      <div class="empty" v-if="!currentList.length && !loading">
        <span>暂无排行数据</span>
      </div>
      <div class="loading" v-if="loading">
        <span>加载中...</span>
      </div>
    </div>
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

function getPoints(item) {
  if (tab.value === 'weekly') return (item.weeklyPoints || 0) + ' 周积分'
  if (tab.value === 'monthly') return (item.monthlyPoints || 0) + ' 月积分'
  return (item.points || 0) + ' 积分'
}

function getMedal(index) {
  const medals = ['🥇', '🥈', '🥉']
  return medals[index] || (index + 1)
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
    console.error('加载排行榜失败', e)
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
.rank { 
  min-height: 100vh; 
  background: #f5f5f5; 
  padding-bottom: 80px;
}

.header {
  background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%);
  color: #fff;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.header h1 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.back { 
  cursor: pointer;
  font-size: 14px;
}

/* 我的排名卡片 */
.my-rank-card {
  margin: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 16px;
  color: #fff;
}

.my-rank-title {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 12px;
}

.my-rank-content {
  display: flex;
  align-items: center;
}

.my-rank-item {
  flex: 1;
  text-align: center;
}

.my-rank-item .label {
  display: block;
  font-size: 12px;
  opacity: 0.8;
  margin-bottom: 4px;
}

.my-rank-item .value {
  display: block;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 2px;
}

.my-rank-item .points {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: #ffd700;
  text-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

.my-rank-divider {
  width: 1px;
  height: 40px;
  background: rgba(255, 255, 255, 0.3);
}

/* 切换标签 */
.tabs {
  display: flex;
  background: #fff;
  margin: 16px;
  border-radius: 12px;
  padding: 4px;
}

.tabs span {
  flex: 1;
  text-align: center;
  padding: 10px 0;
  font-size: 14px;
  color: #666;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.tabs span.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-weight: 500;
}

/* 奖励规则展示 */
.reward-section {
  margin: 0 16px 16px;
  background: linear-gradient(135deg, #fff9e6 0%, #fff3cd 100%);
  border-radius: 16px;
  overflow: hidden;
  border: 2px solid #ffd700;
  box-shadow: 0 4px 20px rgba(255, 215, 0, 0.3);
}

.reward-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  background: linear-gradient(135deg, #ffd700 0%, #ffb700 100%);
  border-bottom: 2px dashed #ffa000;
}

.reward-icon {
  font-size: 24px;
  animation: bounce 1s ease infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.reward-title {
  font-size: 16px;
  font-weight: 700;
  color: #5d4037;
}

.reward-badge {
  margin-left: auto;
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
  color: #fff;
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: 500;
}

.reward-list {
  padding: 12px;
}

.reward-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  margin-bottom: 8px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s, box-shadow 0.2s;
}

.reward-item:active {
  transform: scale(0.98);
}

.reward-item:last-child {
  margin-bottom: 0;
}

.reward-item.first {
  border-left: 4px solid #ffd700;
  background: linear-gradient(135deg, #fff 0%, #fffbe6 100%);
}

.reward-item.second {
  border-left: 4px solid #c0c0c0;
}

.reward-item.third {
  border-left: 4px solid #cd7f32;
}

.reward-rank {
  display: flex;
  align-items: center;
  gap: 10px;
}

.reward-rank .rank-medal {
  font-size: 24px;
  margin: 0;
}

.reward-rank .rank-text {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.reward-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.reward-value .value-num {
  font-size: 24px;
  font-weight: 700;
  color: #ff6b00;
}

.reward-value .value-unit {
  font-size: 12px;
  color: #666;
}

.reward-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  color: #666;
}

.tip-icon {
  font-size: 14px;
}

/* 前三名 */
.top-three {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 12px;
  padding: 20px 16px;
  background: #fff;
  margin: 0 16px;
  border-radius: 16px 16px 0 0;
}

.top-item {
  text-align: center;
}

.top-avatar {
  font-size: 32px;
  margin-bottom: 8px;
}

.top-name {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
  color: #333;
}

.top-points {
  font-size: 12px;
  color: #666;
}

.top-level {
  font-size: 11px;
  color: #667eea;
  margin-top: 2px;
}

.top-item.first .top-avatar {
  font-size: 48px;
}

.top-item.first .top-name {
  font-size: 16px;
  font-weight: 600;
}

.top-item.second,
.top-item.third {
  margin-bottom: 20px;
}

/* 列表 */
.list {
  background: #fff;
  margin: 0 16px 16px;
  border-radius: 0 0 16px 16px;
  padding: 12px 0;
  min-height: 200px;
}

.list .item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.list .item:last-child {
  border-bottom: none;
}

.rank-num {
  width: 28px;
  height: 28px;
  background: #f5f5f5;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #666;
  font-weight: 500;
  margin-right: 12px;
}

.rank-medal {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-right: 12px;
}

.name {
  flex: 1;
  font-size: 14px;
  color: #333;
}

.level-badge {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  margin-right: 8px;
}

.points {
  font-size: 13px;
  color: #666;
}

.empty, .loading {
  text-align: center;
  padding: 40px 0;
  color: #999;
  font-size: 14px;
}
</style>
