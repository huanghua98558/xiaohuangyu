<template>
  <div class="yx-page invite-page">
    <header class="yx-header center">
      <button class="yx-back-btn" @click="$router.back()">←</button>
      <div class="yx-header-main">
        <h1 class="yx-title sm">推广中心</h1>
        <p class="yx-subtitle">邀请好友赚积分。</p>
      </div>
      <div class="yx-icon-btn">🎁</div>
    </header>

    <section class="yx-hero-card">
      <div class="yx-summary-grid three">
        <div class="yx-stat-card">
          <strong>{{ stats.level1Count }}</strong>
          <span>直接邀请</span>
        </div>
        <div class="yx-stat-card">
          <strong>{{ stats.level2Count }}</strong>
          <span>间接邀请</span>
        </div>
        <div class="yx-stat-card">
          <strong>{{ stats.totalPoints }}</strong>
          <span>累计收益</span>
        </div>
      </div>

      <div class="invite-code-block">
        <div>
          <b>我的邀请码</b>
          <small>{{ inviteCode || '加载中...' }}</small>
        </div>
        <button class="yx-btn" @click="copyCode">一键复制</button>
      </div>

      <div class="yx-tag-row" style="margin-top:12px;">
        <span class="yx-tag coral">一级 {{ stats.level1Rate }}%</span>
        <span class="yx-tag navy">二级 {{ stats.level2Rate }}%</span>
      </div>
    </section>

    <section class="yx-card">
      <div class="yx-segment">
        <button :class="{ active: activeTab === 'level1' }" @click="activeTab = 'level1'">直接邀请</button>
        <button :class="{ active: activeTab === 'level2' }" @click="activeTab = 'level2'">间接邀请</button>
        <button :class="{ active: activeTab === 'earnings' }" @click="activeTab = 'earnings'">收益明细</button>
      </div>
    </section>

    <section class="yx-card" v-if="activeTab !== 'earnings'">
      <div class="yx-card-head-bar">
        <h3>{{ activeTab === 'level1' ? '直接邀请好友' : '间接邀请好友' }}<span class="yx-card-note">邀请记录</span></h3>
      </div>

      <div class="yx-list" v-if="subordinates.length">
        <div class="yx-list-item" v-for="item in subordinates" :key="item.id">
          <span class="yx-avatar">👤</span>
          <div class="yx-list-main">
            <b>{{ item.username }}</b>
            <small>Lv.{{ item.level }} · 已完成 {{ item.totalTasks }} 个任务</small>
          </div>
          <div class="yx-list-side">{{ formatDate(item.createdAt) }}</div>
        </div>
      </div>

      <div class="yx-empty" v-else>
        <strong>暂无{{ activeTab === 'level1' ? '直接邀请' : '间接邀请' }}好友</strong>
        <span>邀请好友完成任务后会自动获得奖励。</span>
      </div>

      <button class="yx-btn-ghost full" v-if="hasMore" @click="loadMore">加载更多</button>
    </section>

    <section class="yx-card" v-else>
      <div class="yx-card-head-bar">
        <h3>收益明细<span class="yx-card-note">返佣积分</span></h3>
      </div>

      <div class="yx-list" v-if="earnings.length">
        <div class="yx-list-item" v-for="item in earnings" :key="item.id">
          <span class="yx-square-icon">{{ item.level === 1 ? '一' : '二' }}</span>
          <div class="yx-list-main">
            <b>{{ item.taskTitle || '任务奖励' }}</b>
            <small>{{ formatDate(item.createdAt) }} · 基础积分 {{ item.sourcePoints }}</small>
          </div>
          <div class="yx-list-side">+{{ item.points }}</div>
        </div>
      </div>

      <div class="yx-empty" v-else>
        <strong>暂无收益记录</strong>
        <span>返佣积分会累计在这里。</span>
      </div>

      <button class="yx-btn-ghost full" v-if="hasMoreEarnings" @click="loadMoreEarnings">加载更多</button>
    </section>

    <section class="yx-soft-card">
      <div class="yx-card-head-bar">
        <h3>推广规则说明<span class="yx-card-note">返佣规则</span></h3>
      </div>
      <div class="yx-list">
        <div class="yx-list-item">
          <div class="yx-list-main"><b>邀请好友注册</b><small>好友完成任务后，你将获得返佣奖励。</small></div>
        </div>
        <div class="yx-list-item">
          <div class="yx-list-main"><b>直接邀请奖励</b><small>一级返佣比例为 {{ stats.level1Rate }}%。</small></div>
        </div>
        <div class="yx-list-item">
          <div class="yx-list-main"><b>间接邀请奖励</b><small>二级返佣比例为 {{ stats.level2Rate }}%。</small></div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useAuth } from '../store/auth'
import { getCPromotionStats, getSubordinates, getCEarnings, getMe } from '../api/task'

const { user, setAuth } = useAuth()
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
  } catch (e) {}
}

async function loadSubordinates() {
  try {
    const level = activeTab.value === 'level1' ? 1 : 2
    const data = await getSubordinates(level, page.value)
    if (page.value === 1) subordinates.value = data.list || []
    else subordinates.value = subordinates.value.concat(data.list || [])
    hasMore.value = subordinates.value.length < data.total
  } catch (e) {
    subordinates.value = []
  }
}

async function loadEarnings() {
  try {
    const data = await getCEarnings(earningsPage.value)
    if (earningsPage.value === 1) earnings.value = data.list || []
    else earnings.value = earnings.value.concat(data.list || [])
    hasMoreEarnings.value = earnings.value.length < data.total
  } catch (e) {
    earnings.value = []
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
  if (!user.value?.inviteCode) {
    try {
      const userData = await getMe()
      if (userData?.inviteCode) {
        userInviteCode.value = userData.inviteCode
        if (user.value) {
          setAuth(localStorage.getItem('xiaohuangyu_token'), { ...user.value, inviteCode: userData.inviteCode })
        }
      }
    } catch (e) {}
  }
  loadStats()
  loadSubordinates()
})
</script>

<style scoped>
.invite-page {
  padding-top: 18px;
}

.invite-code-block {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  margin-top: 12px;
  padding: 12px;
  border-radius: 18px;
  background: rgba(255,255,255,0.76);
  border: 1px solid rgba(33,48,75,0.07);
}

.invite-code-block b {
  display: block;
  font-size: 13px;
  margin-bottom: 4px;
}

.invite-code-block small {
  color: var(--yx-deep);
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.06em;
}
</style>
