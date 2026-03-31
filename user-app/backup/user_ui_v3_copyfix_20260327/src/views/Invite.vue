<template>
  <div class="yx-page invite-page">
    <header class="yx-header center">
      <button class="yx-back-btn" @click="$router.back()">←</button>
      <div class="yx-header-main">
        <h1 class="yx-title sm">推广中心</h1>
        <p class="yx-subtitle">邀请码、返佣比例、邀请列表和收益明细放在一页里，底部导航继续保留。</p>
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
      <div class="yx-card-head">
        <div>
          <h3>{{ activeTab === 'level1' ? '直接邀请好友' : '间接邀请好友' }}</h3>
          <div class="yx-card-note">邀请关系和成长情况集中展示</div>
        </div>
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
        <span>复制邀请码后邀请好友注册并完成任务，你会自动获得奖励。</span>
      </div>

      <button class="yx-btn-ghost full" v-if="hasMore" @click="loadMore">加载更多</button>
    </section>

    <section class="yx-card" v-else>
      <div class="yx-card-head">
        <div>
          <h3>收益明细</h3>
          <div class="yx-card-note">把返佣来源、日期和积分放清楚</div>
        </div>
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
        <span>好友完成任务并审核通过后，返佣积分会在这里累计。</span>
      </div>

      <button class="yx-btn-ghost full" v-if="hasMoreEarnings" @click="loadMoreEarnings">加载更多</button>
    </section>

    <section class="yx-soft-card">
      <div class="yx-card-head">
        <div>
          <h3>推广规则说明</h3>
          <div class="yx-card-note">用更短的话把规则讲清楚</div>
        </div>
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
  gap: 12px;
  align-items: center;
  margin-top: 14px;
  padding: 14px;
  border-radius: 20px;
  background: rgba(255,255,255,0.76);
  border: 1px solid rgba(33,48,75,0.07);
}

.invite-code-block b {
  display: block;
  font-size: 14px;
  margin-bottom: 6px;
}

.invite-code-block small {
  color: var(--yx-deep);
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.06em;
}
</style>
