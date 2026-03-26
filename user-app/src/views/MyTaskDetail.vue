<template>
  <div class="my-task-detail">
    <header class="header">
      <span class="back" @click="$router.back()">← 返回</span>
      <h1>任务详情</h1>
    </header>
    <div class="loading" v-if="loading">加载中...</div>
    <div class="error" v-else-if="error">{{ error }}</div>
    <div class="content" v-else-if="task && claim">
      <!-- 状态标签 -->
      <div class="status-tag" :class="statusClass">{{ statusText }}</div>
      
      <!-- 倒计时提醒（进行中任务） -->
      <div class="countdown-banner" v-if="showCountdown && !isExpired">
        <span class="countdown-icon">⏰</span>
        <span class="countdown-label">剩余时间：</span>
        <CountdownTimer 
          :expiresAt="claim.expiresAt" 
          :warningThreshold="2 * 60 * 60 * 1000"
          @expire="onTaskExpire"
          @warning="onTaskWarning"
        />
      </div>
      
      <!-- 已过期提示 -->
      <div class="expired-banner" v-if="showCountdown && isExpired">
        <span class="expired-icon">⚠️</span>
        <span>任务已过期，请放弃或重新领取</span>
      </div>
      
      <!-- 拒绝原因 -->
      <div class="reject-reason" v-if="claim.reviewNote && (isRejected || isManual || isReleased)">
        <h4>{{ isManual ? '人工复审说明' : '处理说明' }}</h4>
        <p>{{ claim.reviewNote }}</p>
      </div>
      
      <h2 class="title">{{ task.title }}</h2>
      <div class="meta">
        <span class="type">{{ getPlatformName(task.platform) }} · {{ getActionName(task.action) }}</span>
        <span class="reward">{{ claim.reward || task.reward }} 积分</span>
      </div>
      
      <div class="desc">
        <h3>任务说明</h3>
        <p>{{ task.description }}</p>
      </div>
      
      <div class="require">
        <h3>完成要求</h3>
        <ul>
          <li v-for="(r, i) in task.requirements" :key="i">
          <template v-if="typeof r === 'object'">
            <span class="step-num">{{ r.step || i + 1 }}.</span>
            <span class="step-title">{{ r.title }}</span>
            <span class="step-desc" v-if="r.description">：{{ r.description }}</span>
          </template>
          <template v-else>{{ r }}</template>
        </li>
        </ul>
      </div>
      
      <!-- 已提交信息展示（待审核/已拒绝/已完成） -->
      <div class="submitted-info" v-if="showSubmittedInfo">
        <h3>提交信息</h3>
        <div class="info-item">
          <label>平台昵称</label>
          <p>{{ claim.platformNickname || '-' }}</p>
        </div>
        <div class="info-item" v-if="displayScreenshots.length">
          <label>完成任务截图</label>
          <div class="screenshots">
            <img 
              v-for="(img, i) in displayScreenshots" 
              :key="i" 
              :src="img" 
              alt="" 
              @click="previewImage(img)"
            />
          </div>
        </div>
        <div class="info-item" v-if="isDone">
          <label>完成时间</label>
          <p>{{ formatTime(claim.reviewedAt) }}</p>
        </div>
        <div class="info-item" v-if="isDone && claim.reward">
          <label>最终到账</label>
          <p>{{ claim.reward }} 积分</p>
        </div>
      </div>

      <div class="submitted-info" v-if="reviewHistory.length">
        <h3>处理记录</h3>
        <div class="history-list">
          <div class="history-item" v-for="(item, index) in reviewHistory" :key="index">
            <div class="history-head">
              <span class="history-stage">{{ formatHistoryStage(item) }}</span>
              <span class="history-time">{{ formatTime(item.timestamp) }}</span>
            </div>
            <p class="history-reason">{{ item.reason || item.details?.reason || '-' }}</p>
          </div>
        </div>
      </div>
      
      <!-- 操作按钮 -->
      <div class="actions">
        <!-- 进行中/已拒绝：去提交/修改重提 -->
        <button 
          v-if="canSubmit" 
          class="btn-submit" 
          @click="goSubmit"
        >
          {{ isRejected ? '修改并重新提交' : '去提交' }}
        </button>
        
        <!-- 进行中/已拒绝：可以放弃任务 -->
        <button 
          v-if="canAbandon" 
          class="btn-abandon" 
          @click="handleAbandon"
          :disabled="abandoning"
        >
          {{ abandoning ? '放弃中...' : '放弃任务' }}
        </button>
        
        <!-- 待审核：可以撤回 -->
        <button 
          v-if="claim.canWithdraw" 
          class="btn-withdraw" 
          @click="handleWithdraw"
          :disabled="withdrawing"
        >
          {{ withdrawing ? '撤回中...' : '撤回提交' }}
        </button>
      </div>
    </div>
    
    <!-- 图片预览 -->
    <div class="image-preview" v-if="previewUrl" @click="previewUrl = ''">
      <img :src="previewUrl" alt="" @click.stop />
      <span class="close" @click="previewUrl = ''">×</span>
    </div>
    
    <!-- Toast 提示 -->
    <div class="toast" v-if="toast.show">{{ toast.message }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onActivated, onUnmounted, computed, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getMyClaimDetail, getTaskDetail, withdrawClaim, abandonClaim } from '../api/task'
import CountdownTimer from '../components/CountdownTimer.vue'

const route = useRoute()
const router = useRouter()
const claimId = route.params.claimId
const task = ref(null)
const claim = ref(null)
const loading = ref(true)
const error = ref('')
const previewUrl = ref('')
const withdrawing = ref(false)
const abandoning = ref(false)
const toast = reactive({ show: false, message: '' })

function showToast(message) {
  toast.message = message
  toast.show = true
  setTimeout(() => { toast.show = false }, 3000)
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
  const map = {
    'like': '点赞',
    'comment': '评论',
    'collect': '收藏',
    'follow': '关注',
    'share': '分享',
    'short_video_research': '短视频评价官',
    '点赞': '点赞',
    '评论': '评论',
    '收藏': '收藏',
    '关注': '关注',
    '分享': '分享',
    '短视频评价官': '短视频评价官'
  }
  return map[action] || action
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

// 状态计算
const statusClass = computed(() => {
  if (!claim.value) return ''
  switch (claim.value.status) {
    case 'doing': return claim.value.isRejected ? 'rejected' : 'doing'
    case 'submitted':
    case 'image_reviewing':
    case 'pending_link':
    case 'link_reviewing':
    case 'pending_manual':
      return 'pending'
    case 'approved':
    case 'done':
      return 'done'
    case 'released':
      return 'rejected'
    default: return ''
  }
})

const statusText = computed(() => {
  if (!claim.value) return ''
  switch (claim.value.status) {
    case 'doing': return claim.value.isRejected ? '待重新提交' : '进行中'
    case 'submitted': return '待图片审核'
    case 'image_reviewing': return '图片审核中'
    case 'pending_link': return '图片通过，待连接审核'
    case 'link_reviewing': return '连接审核中'
    case 'pending_manual': return '人工复审中'
    case 'approved':
    case 'done':
      return '已完成'
    case 'released':
      return '已释放'
    default: return claim.value.status
  }
})

const isDoing = computed(() => {
  return claim.value?.status === 'doing' && !claim.value?.isRejected
})

const isPending = computed(() => {
  return ['submitted', 'image_reviewing', 'pending_link', 'link_reviewing', 'pending_manual'].includes(claim.value?.status)
})

const isRejected = computed(() => {
  return Boolean(claim.value?.isRejected)
})

const isDone = computed(() => {
  return ['approved', 'done'].includes(claim.value?.status)
})

const isManual = computed(() => {
  return claim.value?.status === 'pending_manual'
})

const isReleased = computed(() => {
  return claim.value?.status === 'released'
})

const isExpired = computed(() => {
  if (!claim.value?.expiresAt) return false
  return new Date(claim.value.expiresAt) < new Date()
})

const showCountdown = computed(() => {
  return isDoing.value && claim.value?.expiresAt
})

const canSubmit = computed(() => {
  return (isDoing.value || claim.value?.canResubmit) && !isExpired.value && !isReleased.value
})

const canAbandon = computed(() => {
  return (isDoing.value || claim.value?.canResubmit) && !isReleased.value
})

const showSubmittedInfo = computed(() => {
  return isPending.value || isRejected.value || isDone.value || isManual.value
})

const displayScreenshots = computed(() => {
  if (!claim.value) return []
  if (Array.isArray(claim.value.screenshotUrls) && claim.value.screenshotUrls.length) {
    return claim.value.screenshotUrls
  }
  if (Array.isArray(claim.value.screenshots)) {
    return claim.value.screenshots
  }
  if (typeof claim.value.screenshots === 'string') {
    try {
      const parsed = JSON.parse(claim.value.screenshots)
      return Array.isArray(parsed) ? parsed.map(item => typeof item === 'string' ? item : item?.url).filter(Boolean) : []
    } catch (e) {
      return []
    }
  }
  return []
})

const reviewHistory = computed(() => {
  return Array.isArray(claim.value?.review_history) ? claim.value.review_history : []
})

// 倒计时回调
function onTaskExpire() {
  showToast('任务已过期')
}

function onTaskWarning() {
  showToast('任务即将过期，请尽快完成！')
}

async function load() {
  try {
    loading.value = true
    error.value = ''

    const claimData = await getMyClaimDetail(claimId)
    claim.value = claimData

    const taskData = await getTaskDetail(claimData.taskId || claimData.task?.id)
    task.value = taskData
    
    // 解析 requirements
    if (typeof task.value.requirements === 'string') {
      try {
        task.value.requirements = JSON.parse(task.value.requirements)
      } catch (e) {
        task.value.requirements = []
      }
    }
    
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function goSubmit() {
  router.push(`/submit/${claimId}`)
}

async function handleWithdraw() {
  if (withdrawing.value) return
  withdrawing.value = true
  try {
    await withdrawClaim(claimId)
    showToast('撤回成功')
    router.push('/my/tasks')
  } catch (e) {
    showToast(e.message || '撤回失败')
  } finally {
    withdrawing.value = false
  }
}

async function handleAbandon() {
  if (abandoning.value) return
  if (!confirm('确定要放弃这个任务吗？')) return
  
  abandoning.value = true
  try {
    await abandonClaim(claimId)
    showToast('已放弃任务')
    router.push('/my/tasks')
  } catch (e) {
    showToast(e.message || '放弃失败')
  } finally {
    abandoning.value = false
  }
}

function previewImage(url) {
  previewUrl.value = url
}

function formatHistoryStage(item) {
  const actionMap = {
    submitted: '提交',
    resubmitted: '重新提交',
    withdrawn: '撤回提交',
    approved: '审核通过',
    rejected: '审核拒绝',
    queued: '进入队列',
    started: '开始处理',
    manual: '人工复审',
    returned: '退回用户',
    released: '自动释放'
  }
  const stageMap = {
    submission: '提交',
    image_review: '图片审核',
    link_review: '连接审核',
    claim_flow: '任务流转',
    task_complete: '任务完成',
    manual_review: '人工审核',
    points_settlement: '积分发放'
  }
  return `${stageMap[item.stage] || item.stage || '处理'} · ${actionMap[item.action] || item.action || '记录'}`
}

const reloadFromEvent = (event) => {
  if (!event?.detail?.claimId || String(event.detail.claimId) === String(claimId)) {
    load()
  }
}

onMounted(() => {
  load()
  window.addEventListener('review-result', reloadFromEvent)
  window.addEventListener('points-update', reloadFromEvent)
})
onActivated(load)
onUnmounted(() => {
  window.removeEventListener('review-result', reloadFromEvent)
  window.removeEventListener('points-update', reloadFromEvent)
})
</script>

<style scoped>
.my-task-detail {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 100px;
}

.header {
  background: #3f51b5;
  color: #fff;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.back { cursor: pointer; }
.header h1 {
  flex: 1;
  text-align: center;
  font-size: 17px;
  font-weight: 500;
}

.loading, .error {
  text-align: center;
  padding: 40px;
  color: #666;
}

.content {
  padding: 16px;
}

.status-tag {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 12px;
}
.status-tag.doing {
  background: #e8f5e9;
  color: #2e7d32;
}
.status-tag.pending {
  background: #fff3e0;
  color: #f57c00;
}
.status-tag.rejected {
  background: #ffebee;
  color: #c62828;
}
.status-tag.done {
  background: #e3f2fd;
  color: #1565c0;
}

/* 倒计时横幅 */
.countdown-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%);
  color: #fff;
  padding: 12px 16px;
  border-radius: 12px;
  margin-bottom: 12px;
  font-size: 14px;
}

.countdown-icon {
  font-size: 18px;
}

.countdown-label {
  opacity: 0.9;
}

/* 已过期横幅 */
.expired-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #ffebee;
  color: #c62828;
  padding: 12px 16px;
  border-radius: 12px;
  margin-bottom: 12px;
  font-size: 14px;
}

.expired-icon {
  font-size: 18px;
}

.reject-reason {
  background: #ffebee;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 12px;
}
.reject-reason h4 {
  font-size: 13px;
  color: #c62828;
  margin-bottom: 6px;
}
.reject-reason p {
  font-size: 14px;
  color: #333;
  line-height: 1.5;
}

.title { font-size: 18px; margin-bottom: 12px; }
.meta { display: flex; gap: 12px; margin-bottom: 20px; }
.type {
  font-size: 12px;
  color: #666;
  padding: 4px 8px;
  background: #e8eaf6;
  border-radius: 4px;
}
.reward { color: #f44336; font-weight: 600; font-size: 18px; }
.desc, .require, .submitted-info {
  background: #fff;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 12px;
}
.desc h3, .require h3, .submitted-info h3 {
  font-size: 14px;
  margin-bottom: 8px;
  color: #666;
}
.desc p, .require ul {
  font-size: 14px;
  line-height: 1.6;
}
.require ul { padding-left: 18px; }

.submitted-info .info-item {
  margin-bottom: 12px;
}
.submitted-info .info-item:last-child {
  margin-bottom: 0;
}
.submitted-info label {
  display: block;
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}
.submitted-info p {
  font-size: 14px;
  color: #333;
}
.screenshots {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.screenshots img {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid #eee;
}
.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.history-item {
  padding: 10px 12px;
  border-radius: 10px;
  background: #f8f9fb;
}
.history-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}
.history-stage {
  font-size: 12px;
  font-weight: 600;
  color: #3f51b5;
}
.history-time {
  font-size: 12px;
  color: #999;
}
.history-reason {
  font-size: 13px;
  line-height: 1.6;
  color: #333;
}

.actions {
  margin-top: 16px;
}
.btn-submit {
  width: 100%;
  padding: 14px;
  background: #3f51b5;
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
}
.btn-submit:active { opacity: 0.9; }

.btn-withdraw {
  width: 100%;
  padding: 14px;
  background: #fff;
  color: #666;
  border: 1px solid #ddd;
  border-radius: 12px;
  font-size: 16px;
  cursor: pointer;
  margin-top: 12px;
}
.btn-withdraw:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-abandon {
  width: 100%;
  padding: 14px;
  background: #fff;
  color: #f44336;
  border: 1px solid #ffcdd2;
  border-radius: 12px;
  font-size: 16px;
  cursor: pointer;
  margin-top: 12px;
}
.btn-abandon:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-abandon:active { background: #ffebee; }

.image-preview {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.image-preview img {
  max-width: 90%;
  max-height: 90%;
  object-fit: contain;
}
.image-preview .close {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  cursor: pointer;
}

.step-num { font-weight: bold; color: #3f51b5; margin-right: 4px; }
.step-title { font-weight: 500; }
.step-desc { color: #666; }
.require li { margin: 10px 0; line-height: 1.6; padding-left: 4px; }

/* Toast 样式 */
.toast {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 12px 24px;
  border-radius: 24px;
  font-size: 14px;
  z-index: 1001;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(20px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
</style>
