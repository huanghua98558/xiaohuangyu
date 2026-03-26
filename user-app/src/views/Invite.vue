<template>
  <div class="invite">
    <header class="header">
      <span class="back" @click="$router.back()">← 返回</span>
      <h1>推广中心</h1>
    </header>
    
    <!-- 推广统计卡片 -->
    <div class="card stats-card">
      <div class="stats-row">
        <div class="stat-item">
          <span class="num">{{ stats.level1Count }}</span>
          <span class="label">直接邀请</span>
        </div>
        <div class="stat-item">
          <span class="num">{{ stats.level2Count }}</span>
          <span class="label">间接邀请</span>
        </div>
        <div class="stat-item">
          <span class="num">{{ stats.totalPoints }}</span>
          <span class="label">累计收益</span>
        </div>
      </div>
      
      <div class="invite-code">
        <span>我的邀请码：</span>
        <strong class="code">{{ inviteCode || '加载中...' }}</strong>
        <button class="copy-btn" @click="copyCode">复制</button>
      </div>
      
      <div class="rate-info">
        <span class="rate-badge">一级 {{ stats.level1Rate }}%</span>
        <span class="rate-badge secondary">二级 {{ stats.level2Rate }}%</span>
      </div>
    </div>
    
    <!-- 标签切换 -->
    <div class="tabs">
      <button 
        :class="['tab', { active: activeTab === 'level1' }]" 
        @click="activeTab = 'level1'"
      >直接邀请</button>
      <button 
        :class="['tab', { active: activeTab === 'level2' }]" 
        @click="activeTab = 'level2'"
      >间接邀请</button>
      <button 
        :class="['tab', { active: activeTab === 'earnings' }]" 
        @click="activeTab = 'earnings'"
      >收益明细</button>
    </div>
    
    <!-- 下级列表 -->
    <div class="list-section" v-if="activeTab !== 'earnings'">
      <div class="empty" v-if="subordinates.length === 0">
        <span class="empty-icon">👥</span>
        <span>暂无{{ activeTab === 'level1' ? '直接邀请' : '间接邀请' }}的好友</span>
      </div>
      <div class="list" v-else>
        <div class="list-item" v-for="item in subordinates" :key="item.id">
          <div class="item-avatar">👤</div>
          <div class="item-info">
            <div class="item-name">{{ item.username }}</div>
            <div class="item-meta">
              <span class="level">Lv.{{ item.level }}</span>
              <span class="tasks">{{ item.totalTasks }}任务</span>
            </div>
          </div>
          <div class="item-date">{{ formatDate(item.createdAt) }}</div>
        </div>
      </div>
      
      <button class="load-more" v-if="hasMore" @click="loadMore">
        加载更多
      </button>
    </div>
    
    <!-- 收益明细 -->
    <div class="list-section" v-else>
      <div class="empty" v-if="earnings.length === 0">
        <span class="empty-icon">💰</span>
        <span>暂无收益记录</span>
      </div>
      <div class="list" v-else>
        <div class="earning-item" v-for="item in earnings" :key="item.id">
          <div class="earning-info">
            <div class="earning-title">
              <span class="level-badge" :class="'level-' + item.level">
                {{ item.level === 1 ? '一级' : '二级' }}
              </span>
              {{ item.taskTitle || '任务奖励' }}
            </div>
            <div class="earning-meta">
              <span>{{ formatDate(item.createdAt) }}</span>
              <span>基础积分 {{ item.sourcePoints }}</span>
            </div>
          </div>
          <div class="earning-points">+{{ item.points }}</div>
        </div>
      </div>
      
      <button class="load-more" v-if="hasMoreEarnings" @click="loadMoreEarnings">
        加载更多
      </button>
    </div>
    
    <!-- 推广说明 -->
    <div class="tips-card">
      <h3>推广规则说明</h3>
      <ul>
        <li>邀请好友注册，好友完成任务后您可获得奖励</li>
        <li>直接邀请：直接邀请的好友，奖励 {{ stats.level1Rate }}%</li>
        <li>间接邀请：好友邀请的好友，奖励 {{ stats.level2Rate }}%</li>
        <li>奖励在好友任务审核通过后自动发放到您的积分账户</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useAuth } from '../store/auth'
import { getCPromotionStats, getSubordinates, getCEarnings, getMe } from '../api/task'

const { user, setAuth } = useAuth()

// 邀请码优先从API获取，其次从本地存储获取
const userInviteCode = ref('')
const inviteCode = computed(() => userInviteCode.value || (user.value && user.value.inviteCode) || '')

const stats = ref({
  level1Count: 0,
  level2Count: 0,
  totalPoints: 0,
  todayPoints: 0,
  level1Rate: 10,
  level2Rate: 5
})

const activeTab = ref('level1')
const subordinates = ref([])
const earnings = ref([])
const page = ref(1)
const earningsPage = ref(1)
const hasMore = ref(false)
const hasMoreEarnings = ref(false)

async function loadStats() {
  try {
    const data = await getCPromotionStats()
    stats.value = {
      ...data,
      level1Rate: data.level1Rate || 10,
      level2Rate: data.level2Rate || 5
    }
  } catch (e) {
    console.error('加载推广统计失败', e)
  }
}

async function loadSubordinates() {
  try {
    const level = activeTab.value === 'level1' ? 1 : 2
    const data = await getSubordinates(level, page.value)
    if (page.value === 1) {
      subordinates.value = data.list || []
    } else {
      subordinates.value = subordinates.value.concat(data.list || [])
    }
    hasMore.value = subordinates.value.length < data.total
  } catch (e) {
    console.error('加载下级列表失败', e)
  }
}

async function loadEarnings() {
  try {
    const data = await getCEarnings(earningsPage.value)
    if (earningsPage.value === 1) {
      earnings.value = data.list || []
    } else {
      earnings.value = earnings.value.concat(data.list || [])
    }
    hasMoreEarnings.value = earnings.value.length < data.total
  } catch (e) {
    console.error('加载收益明细失败', e)
  }
}

function loadMore() {
  page.value++
  loadSubordinates()
}

function loadMoreEarnings() {
  earningsPage.value++
  loadEarnings()
}

function copyCode() {
  const code = inviteCode.value
  if (code) {
    navigator.clipboard.writeText(code)
    alert('邀请码已复制')
  }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

watch(activeTab, (newTab) => {
  if (newTab === 'earnings') {
    earningsPage.value = 1
    loadEarnings()
  } else {
    page.value = 1
    loadSubordinates()
  }
})

onMounted(async () => {
  // 获取最新用户信息（包含邀请码）
  if (!user.value?.inviteCode) {
    try {
      const userData = await getMe()
      if (userData?.inviteCode) {
        userInviteCode.value = userData.inviteCode
        // 更新本地存储的用户信息
        if (user.value) {
          setAuth(localStorage.getItem('xiaohuangyu_token'), { ...user.value, inviteCode: userData.inviteCode })
        }
      }
    } catch (e) {
      console.error('获取用户信息失败', e)
    }
  }
  loadStats()
  loadSubordinates()
})
</script>

<style scoped>
.invite {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 40px;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.header h1 {
  font-size: 18px;
  flex: 1;
  text-align: center;
  margin-right: 40px;
}

.back {
  cursor: pointer;
  font-size: 14px;
}

.stats-card {
  margin: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 20px;
  border-radius: 16px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.stat-item {
  text-align: center;
}

.stat-item .num {
  display: block;
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
}

.stat-item .label {
  font-size: 12px;
  opacity: 0.9;
}

.invite-code {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.2);
  padding: 12px 16px;
  border-radius: 12px;
  margin-bottom: 12px;
}

.invite-code .code {
  flex: 1;
  font-size: 18px;
  letter-spacing: 2px;
}

.copy-btn {
  padding: 8px 16px;
  background: #fff;
  color: #667eea;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.rate-info {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.rate-badge {
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
}

.rate-badge.secondary {
  background: rgba(255, 255, 255, 0.15);
}

.tabs {
  display: flex;
  margin: 16px;
  background: #fff;
  border-radius: 12px;
  padding: 4px;
}

.tab {
  flex: 1;
  padding: 10px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.tab.active {
  background: #667eea;
  color: #fff;
}

.list-section {
  margin: 0 16px;
}

.empty {
  text-align: center;
  padding: 40px;
  color: #999;
}

.empty-icon {
  display: block;
  font-size: 48px;
  margin-bottom: 12px;
}

.list {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}

.list-item {
  display: flex;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.list-item:last-child {
  border-bottom: none;
}

.item-avatar {
  width: 40px;
  height: 40px;
  background: #f5f5f5;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-right: 12px;
}

.item-info {
  flex: 1;
}

.item-name {
  font-size: 15px;
  margin-bottom: 4px;
}

.item-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: #999;
}

.item-meta .level {
  color: #667eea;
}

.item-date {
  font-size: 12px;
  color: #ccc;
}

.earning-item {
  display: flex;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.earning-item:last-child {
  border-bottom: none;
}

.earning-info {
  flex: 1;
}

.earning-title {
  font-size: 14px;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.level-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #667eea;
  color: #fff;
}

.level-badge.level-2 {
  background: #9c27b0;
}

.earning-meta {
  font-size: 12px;
  color: #999;
  display: flex;
  gap: 12px;
}

.earning-points {
  font-size: 18px;
  font-weight: 600;
  color: #4caf50;
}

.load-more {
  width: 100%;
  padding: 12px;
  background: #fff;
  border: none;
  color: #667eea;
  font-size: 14px;
  cursor: pointer;
  margin-top: 8px;
  border-radius: 12px;
}

.tips-card {
  margin: 16px;
  background: #fff;
  padding: 16px;
  border-radius: 12px;
}

.tips-card h3 {
  font-size: 14px;
  margin-bottom: 12px;
  color: #333;
}

.tips-card ul {
  padding-left: 16px;
  margin: 0;
}

.tips-card li {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
  line-height: 1.6;
}
</style>
