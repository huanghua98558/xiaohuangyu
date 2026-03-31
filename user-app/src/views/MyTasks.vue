<template>
  <div class="yx-page my-tasks-page">
    <header class="yx-header center">
      <button class="yx-back-btn" @click="$router.back()">←</button>
      <div class="yx-header-main">
        <h1 class="yx-title sm">我的任务</h1>
        <p class="yx-subtitle">处理中、待审核和已完成任务。</p>
      </div>
      <div class="yx-icon-btn">📋</div>
    </header>
    <div class="tabs">
      <span :class="{active: tab==='doing'}" @click="setTab('doing')">进行中 <em class="tab-badge" v-if="doing.length > 0">{{ doing.length }}</em></span>
      <span :class="{active: tab==='pending'}" @click="setTab('pending')">待审核 <em class="tab-badge" v-if="pending.length > 0">{{ pending.length }}</em></span>
      <span :class="{active: tab==='done'}" @click="setTab('done')">已完成</span>
      <span :class="{active: tab==='blocked'}" @click="setTab('blocked')">封控记录 <em class="tab-badge" v-if="blockedRecords.length > 0">{{ blockedRecords.length }}</em></span>
    </div>
    <div class="yx-empty loading-state" v-if="loading">加载中...</div>
    <div class="list" v-else>
      <template v-if="tab==='doing'">
        <div :class="['task', 'task-clickable', { 'highlight-rejected': t.isRejected }]" v-for="t in doing" :key="t.id" @click="$router.push(`/my/task/${t.id}`)">
          <div class="task-info">
            <span class="task-title">{{ t.title }}</span>
            <div class="task-time-info">
              <span class="time-item" v-if="t.claimedAt">
                <span class="time-label">领取:</span>
                <span class="time-value">{{ formatTime(t.claimedAt) }}</span>
              </span>
              <span class="time-item" v-if="t.expiresAt">
                <span class="time-label">剩余:</span>
                <CountdownTimer 
                  :expiresAt="t.expiresAt" 
                  :warningThreshold="2 * 60 * 60 * 1000"
                  @expire="onTaskExpire(t)"
                />
              </span>
            </div>
            <span class="task-reason" v-if="t.isRejected && t.reviewNote">拒绝原因: {{ t.reviewNote }}</span>
            <span class="task-meta" v-if="t.isNightBonusTask">🌙 夜间系数 x{{ Number(t.nightCoefficient || 1).toFixed(2) }}</span>
            <div class="task-tags" v-if="t.isRejected || t.reviewDetail?.stageLabel">
              <span class="task-tag rejected-tag" v-if="t.isRejected">已退回({{ t.reviewDetail?.rejectCount || 0 }}/3)</span>
              <span class="task-tag retry-tag" v-if="t.isRejected && t.expiresAt">
                重提倒计时
                <CountdownTimer 
                  :expiresAt="t.expiresAt"
                  :warningThreshold="2 * 60 * 60 * 1000"
                  @expire="onTaskExpire(t)"
                />
              </span>
            </div>
            <div class="review-status" v-if="t.isRejected && t.reviewDetail">
              <span class="status-item" v-if="t.reviewDetail.imageStatus === 'approved'">✅ 图片审核通过</span>
              <span class="status-item warning" v-else-if="t.reviewDetail.imageStatus === 'rejected'">❌ 图片审核未通过</span>
              <span class="status-item warning" v-if="t.reviewDetail.linkStatus === 'rejected'">⚠️ 链接验证失败(换号重试)</span>
            </div>
          </div>
          <div class="actions">
            <span class="reward" :class="{ 'has-bonus': t.isNightBonusTask }">
              <template v-if="t.isNightBonusTask">
                {{ getBaseReward(t) }} +{{ getBonusReward(t) }} 积分
              </template>
              <template v-else>
                {{ getBaseReward(t) }} 积分
              </template>
            </span>
            <span class="arrow">›</span>
          </div>
        </div>
        <div class="yx-empty" v-if="!doing.length">暂无进行中的任务，去任务大厅领取吧</div>
      </template>
      <template v-else-if="tab==='pending'">
        <div class="task task-clickable" v-for="t in pending" :key="t.id" @click="$router.push(`/my/task/${t.id}`)">
          <div class="task-info">
            <span class="task-title">{{ t.title }}</span>
            <div class="task-time-info">
              <span class="time-item" v-if="t.claimedAt">
                <span class="time-label">领取:</span>
                <span class="time-value">{{ formatTime(t.claimedAt) }}</span>
              </span>
              <span class="time-item" v-if="t.submittedAt">
                <span class="time-label">提交:</span>
                <span class="time-value">{{ formatTime(t.submittedAt) }}</span>
              </span>
            </div>
            <span class="task-tag pending-tag">{{ t.reviewDetail?.stageLabel || '待审核' }}</span>
            <span class="task-meta" v-if="t.isNightBonusTask">🌙 夜间系数 x{{ Number(t.nightCoefficient || 1).toFixed(2) }}</span>
          </div>
          <div class="actions">
            <span class="reward" :class="{ 'has-bonus': t.isNightBonusTask }">
              <template v-if="t.isNightBonusTask">
                {{ getBaseReward(t) }} +{{ getBonusReward(t) }} 积分
              </template>
              <template v-else>
                {{ getBaseReward(t) }} 积分
              </template>
            </span>
            <span class="arrow">></span>
          </div>
        </div>
        <div class="yx-empty" v-if="!pending.length">暂无待审核的任务</div>
      </template>
      <template v-else-if="tab==='done'">
        <!-- 已完成统计 -->
        <div class="done-stats" v-if="doneStats.totalCount > 0">
          <div class="stat-item">
            <span class="stat-value">{{ doneStats.totalCount }}</span>
            <span class="stat-label">完成任务</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-value reward">+{{ doneStats.totalRewards }}</span>
            <span class="stat-label">累计积分</span>
          </div>
        </div>
        <!-- 已完成列表 -->
        <div class="task task-clickable" v-for="t in done" :key="t.id" @click="$router.push(`/my/task/${t.id}`)">
          <div class="task-info">
            <span class="task-title">{{ t.title }}</span>
            <div class="task-time-info">
              <span class="time-item" v-if="t.claimedAt">
                <span class="time-label">领取:</span>
                <span class="time-value">{{ formatTime(t.claimedAt) }}</span>
              </span>
            </div>
            <span class="task-meta">{{ getPlatformName(t.platform) }} · {{ getActionName(t.action) }}</span>
            <span class="task-meta" v-if="t.settlement">到账: 基础{{ t.settlement.basePoints || t.baseReward || 0 }} + 加成{{ t.settlement.bonusPoints || 0 }}</span>
            <span class="task-tag done-tag">已完成</span>
          </div>
          <div class="actions">
            <span class="reward">+{{ t.settlement?.finalPoints || t.reward }} 积分</span>
            <span class="arrow">></span>
          </div>
        </div>
        <div class="yx-empty" v-if="!done.length">暂无已完成任务</div>
      </template>
      <template v-else>
        <div class="task blocked-task" v-for="t in blockedRecords" :key="t.id" @click="$router.push(`/my/task/${t.id}`)">
          <div class="task-info">
            <span class="task-title">{{ t.title }}</span>
            <div class="task-time-info">
              <span class="time-item" v-if="t.submittedAt">
                <span class="time-label">提交:</span>
                <span class="time-value">{{ formatTime(t.submittedAt) }}</span>
              </span>
              <span class="time-item" v-if="t.blockedAt">
                <span class="time-label">确认:</span>
                <span class="time-value">{{ formatTime(t.blockedAt) }}</span>
              </span>
            </div>
            <span class="task-reason">{{ t.blockReason }}</span>
            <span class="task-tag blocked-tag">已确认封控</span>
          </div>
          <div class="actions">
            <span class="reward warning">查看记录</span>
            <span class="arrow">›</span>
          </div>
        </div>
        <div class="yx-empty" v-if="!blockedRecords.length">暂无评论封控记录</div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getMyTasks } from '../api/task'
import CountdownTimer from '../components/CountdownTimer.vue'

const route = useRoute()
const router = useRouter()
const tab = ref('doing')
const loading = ref(true)
const doing = ref([])
const pending = ref([])
const done = ref([])
const blockedRecords = ref([])
const doneStats = ref({ totalCount: 0, totalRewards: 0 })

function getBaseReward(t) {
  return Number(t?.settlement?.basePoints ?? t?.baseReward ?? t?.base_reward ?? t?.reward ?? 0)
}

function getBonusReward(t) {
  const apiBonus = Number(t?.settlement?.bonusPoints ?? t?.nightBonusPoints)
  if (Number.isFinite(apiBonus) && apiBonus > 0) {
    return apiBonus
  }
  const base = getBaseReward(t)
  const c = Number((t?.settlement?.coefficient ?? t?.nightCoefficient) || 1)
  if (c <= 1) return 0
  return Math.round(base * (c - 1) * 100) / 100
}

function normalizeTab(value) {
  return ['doing', 'pending', 'done', 'blocked'].includes(value) ? value : 'doing'
}

function setTab(nextTab) {
  const normalized = normalizeTab(nextTab)
  tab.value = normalized
  if (route.query.tab !== normalized) {
    router.replace({ path: '/my/tasks', query: { ...route.query, tab: normalized } })
  }
}

function syncTabFromRoute() {
  tab.value = normalizeTab(route.query.tab)
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

function getActionName(action) {
  return '短视频评价官'
}

function formatTime(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const hour = date.getHours().toString().padStart(2, '0')
  const min = date.getMinutes().toString().padStart(2, '0')
  return `${month}-${day} ${hour}:${min}`
}

// 任务过期回调
function onTaskExpire(task) {
  console.log('任务已过期:', task.id)
  // 可以在这里刷新列表
  load()
}

async function load() {
  loading.value = true
  try {
    const data = await getMyTasks()
    doing.value = data.doing || []
    pending.value = data.pending || []
    done.value = data.done || []
    blockedRecords.value = data.blockedRecords || []
    doneStats.value = data.doneStats || { totalCount: 0, totalRewards: 0 }
  } catch (e) {
    doing.value = []
    pending.value = []
    done.value = []
    blockedRecords.value = []
    doneStats.value = { totalCount: 0, totalRewards: 0 }
  } finally {
    loading.value = false
  }
}

const handlePointsUpdate = () => {
  load()
}

const handleReviewUpdate = () => {
  load()
}

onMounted(() => {
  syncTabFromRoute()
  load()
  window.addEventListener('points-update', handlePointsUpdate)
  window.addEventListener('review-result', handleReviewUpdate)
})

// 每次进入页面都刷新数据
onActivated(() => {
  syncTabFromRoute()
  load()
})

watch(() => route.query.tab, () => {
  syncTabFromRoute()
})

onUnmounted(() => {
  window.removeEventListener('points-update', handlePointsUpdate)
  window.removeEventListener('review-result', handleReviewUpdate)
})
</script>

<style scoped>
.my-tasks-page {
  padding-top: 18px;
}
.tabs {
  display: flex;
  background: rgba(255,255,255,0.82);
  padding: 4px;
  border-radius: 999px;
  border: 1px solid var(--yx-line);
  margin-bottom: 10px;
  gap: 4px;
}
.tabs span {
  flex: 1;
  padding: 10px 12px;
  font-size: 12px;
  color: var(--yx-muted);
  cursor: pointer;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
  min-width: 0;
}
.tabs span.active { color: var(--yx-deep); font-weight: 700; background: #fff; box-shadow: 0 8px 18px rgba(29,39,58,0.08); }
.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  margin-left: 0;
  padding: 0 5px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-style: normal;
  font-size: 12px;
  font-weight: 700;
}
.loading { padding: 32px 0; text-align: center; color: var(--yx-muted); }
.list { padding: 0; }
.task {
  background: rgba(255,255,255,0.92);
  padding: 14px;
  border-radius: 18px;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid var(--yx-line);
  box-shadow: var(--yx-shadow-soft);
}
.blocked-task {
  border: 1px solid rgba(239, 68, 68, 0.12);
  background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(254,242,242,0.92));
}
.blocked-tag {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
}
.reward.warning {
  color: #dc2626;
}
.actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.task-info { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.task-title { font-size: 15px; font-weight: 700; color: var(--yx-deep); }
.task-meta { font-size: 11px; color: var(--yx-muted); }
.task-time-info { display: flex; gap: 10px; font-size: 11px; color: var(--yx-muted); margin-top: 2px; flex-wrap: wrap; }
.time-item { display: flex; gap: 4px; align-items: center; }
.time-label { color: var(--yx-muted); }
.time-value { color: #5f6673; }
.task-reason { font-size: 11px; color: #cf4a33; margin-top: 4px; }
.task-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}
.task-tag { font-size: 12px; padding: 4px 8px; border-radius: 999px; display: inline-block; width: fit-content; margin-top: 4px; font-weight: 800; }
.rejected-tag { background: #ffebee; color: #f44336; }
.retry-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(251, 191, 36, 0.16);
  color: #b45309;
}
.highlight-rejected {
  background: linear-gradient(135deg, #fff6f4 0%, #fff 100%);
  border-left: 3px solid #f44336;
  animation: pulse-highlight 2s ease-in-out infinite;
}
@keyframes pulse-highlight {
  0%, 100% { box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.2); }
  50% { box-shadow: 0 0 8px 2px rgba(244, 67, 54, 0.3); }
}
.review-status {
  margin-top: 4px;
  font-size: 11px;
}
.status-item {
  display: inline-block;
  padding: 4px 8px;
  margin-right: 4px;
  margin-bottom: 2px;
  border-radius: 999px;
  background: #e8f5e9;
  color: #2e7d32;
}
.status-item.warning {
  background: #fff3e0;
  color: #e65100;
}
.pending-tag { background: #fff3e0; color: #ff9800; }
.done-tag { background: #e8f5e9; color: #4caf50; }
.task-clickable { cursor: pointer; }
.task-clickable:hover .task-title { color: #38507e; }
.actions { display: flex; align-items: center; gap: 12px; }
.reward { color: #2d9a7b; font-weight: 700; font-size: 13px; }
.reward.has-bonus { color: #ea580c; }
.arrow { color: #38507e; font-size: 16px; }
.status { color: #ff9800; font-size: 13px; }
.empty { text-align: center; color: var(--yx-muted); padding: 30px 0; font-size: 13px; }

/* 已完成统计样式 */
.done-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #24344d 0%, #355177 100%);
  border-radius: 18px;
  padding: 16px;
  margin-bottom: 10px;
  color: #fff;
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}
.stat-value {
  font-size: 24px;
  font-weight: 600;
}
.stat-value.reward {
  color: #ffc107;
}
.stat-label {
  font-size: 11px;
  opacity: 0.9;
  margin-top: 4px;
}
.stat-divider {
  width: 1px;
  height: 40px;
  background: rgba(255, 255, 255, 0.3);
}
</style>
