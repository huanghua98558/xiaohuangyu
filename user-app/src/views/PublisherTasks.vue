<template>
  <div class="publisher-tasks">
    <header class="header">
      <h1>任务管理</h1>
    </header>
    
    <!-- 审核员/管理员标签页 -->
    <div class="tabs" v-if="isReviewer">
      <span :class="{active: tab==='pendingReview'}" @click="tab='pendingReview'">待审核</span>
      <span :class="{active: tab==='reviewed'}" @click="tab='reviewed'">已审核</span>
      <span :class="{active: tab==='published'}" @click="tab='published'">发布的任务</span>
      <span :class="{active: tab==='pendingMy'}" @click="tab='pendingMy'">待完成</span>
      <span :class="{active: tab==='done'}" @click="tab='done'">已完成</span>
    </div>
    
    <!-- 发布者标签页 -->
    <div class="tabs" v-else>
      <span :class="{active: tab==='published'}" @click="tab='published'">发布的任务</span>
      <span :class="{active: tab==='pending'}" @click="tab='pending'">待完成</span>
      <span :class="{active: tab==='done'}" @click="tab='done'">已完成</span>
    </div>
    
    <div class="loading" v-if="loading">加载中...</div>
    
    <!-- ==================== 待审核列表（审核员/管理员专用）==================== -->
    <div class="list" v-else-if="tab==='pendingReview'">
      <div class="claim-card" v-for="claim in pendingReviewList" :key="claim.id">
        <div class="claim-header">
          <span class="task-code">{{ claim.tasks?.task_code || `TASK-${claim.task_id}` }}</span>
          <span class="claim-status pending-tag">待审核</span>
        </div>
        <div class="claim-title-row">{{ claim.tasks?.title || claim.title || '未知任务' }}</div>
        <div class="claim-meta">
          <span>申请人: {{ claim.users?.username || '用户' }}</span>
          <span>·</span>
          <span>{{ getPlatformName(claim.tasks?.platform) }}</span>
          <span>·</span>
          <span>{{ claim.tasks?.base_reward || claim.base_reward }} 积分</span>
        </div>
        <div class="claim-publisher" v-if="claim.publisher_name">
          发布者: {{ claim.publisher_name }}
        </div>
        <div class="claim-time">
          提交时间: {{ formatTime(claim.submitted_at) }}
        </div>
        <div class="claim-actions">
          <button class="btn-approve" @click="handleReview(claim.id, 'approve')">通过</button>
          <button class="btn-reject" @click="showRejectDialog(claim.id)">拒绝</button>
          <button class="btn-detail" @click="goClaimDetail(claim)">查看详情</button>
        </div>
      </div>
      <div class="empty" v-if="pendingReviewList.length === 0">暂无待审核的任务</div>
      <div class="pagination" v-if="pendingReviewTotal > pageSize">
        <button :disabled="pendingReviewPage <= 1" @click="pendingReviewPage--; loadPendingReview()">上一页</button>
        <span>{{ pendingReviewPage }} / {{ Math.ceil(pendingReviewTotal / pageSize) }}</span>
        <button :disabled="pendingReviewPage >= Math.ceil(pendingReviewTotal / pageSize)" @click="pendingReviewPage++; loadPendingReview()">下一页</button>
      </div>
    </div>
    
    <!-- ==================== 已审核列表（审核员/管理员专用）==================== -->
    <div class="list" v-else-if="tab==='reviewed'">
      <div class="claim-card" v-for="claim in reviewedList" :key="claim.id" @click="goClaimDetail(claim)">
        <div class="claim-header">
          <span class="task-code">{{ claim.tasks?.task_code || `TASK-${claim.tasks?.id}` }}</span>
          <span class="claim-status" :class="claim.status === 'done' ? 'done-tag' : 'rejected-tag'">
            {{ claim.status === 'done' ? '已通过' : '已拒绝' }}
          </span>
        </div>
        <div class="claim-title-row">{{ claim.tasks?.title || '未知任务' }}</div>
        <div class="claim-meta">
          <span>申请人: {{ claim.users?.username || '用户' }}</span>
          <span>·</span>
          <span>{{ getPlatformName(claim.tasks?.platform) }}</span>
          <span>·</span>
          <span>{{ claim.tasks?.base_reward }} 积分</span>
        </div>
        <div class="claim-review-info" v-if="claim.reviewer_name">
          审核人: {{ claim.reviewer_name }}
        </div>
        <div class="claim-time">
          审核时间: {{ formatTime(claim.reviewed_at) }}
        </div>
        <div class="claim-footer">
          <span class="arrow">查看详情 ></span>
        </div>
      </div>
      <div class="empty" v-if="reviewedList.length === 0">暂无已审核的任务</div>
      <div class="pagination" v-if="reviewedTotal > pageSize">
        <button :disabled="reviewedPage <= 1" @click="reviewedPage--; loadReviewed()">上一页</button>
        <span>{{ reviewedPage }} / {{ Math.ceil(reviewedTotal / pageSize) }}</span>
        <button :disabled="reviewedPage >= Math.ceil(reviewedTotal / pageSize)" @click="reviewedPage++; loadReviewed()">下一页</button>
      </div>
    </div>
    
    <!-- ==================== 发布的任务列表 ==================== -->
    <div class="list" v-else-if="tab==='published'">
      <div class="task-card" v-for="task in publishedTasks" :key="task.id" @click="goTaskDetail(task)">
        <div class="task-header">
          <span class="task-code">{{ task.task_code || `TASK-${task.id}` }}</span>
          <span class="task-status" :class="getStatusClass(task.status)">{{ getStatusText(task.status) }}</span>
        </div>
        <div class="task-title-row">{{ task.title }}</div>
        <div class="task-meta">
          <span>{{ getPlatformName(task.platform) }}</span>
          <span>·</span>
          <span>{{ getActionName(task.action) }}</span>
          <span>·</span>
          <span>{{ task.base_reward }} 积分</span>
        </div>
        <div class="task-stats" v-if="task.claimsStats">
          <div class="stat">
            <span class="stat-value">{{ task.claimsStats.total }}</span>
            <span class="stat-label">领取</span>
          </div>
          <div class="stat pending">
            <span class="stat-value">{{ task.claimsStats.pending }}</span>
            <span class="stat-label">待审核</span>
          </div>
          <div class="stat done">
            <span class="stat-value">{{ task.claimsStats.done }}</span>
            <span class="stat-label">已完成</span>
          </div>
        </div>
        <div class="task-footer">
          <span class="task-time">{{ formatTime(task.created_at) }}</span>
          <span class="arrow">></span>
        </div>
      </div>
      <div class="empty" v-if="publishedTasks.length === 0">
        暂无发布的任务
        <div class="empty-action">
          <button @click="$router.push('/publish')">发布新任务</button>
        </div>
      </div>
    </div>
    
    <!-- ==================== 待完成列表（自己发布任务的待审核领取）==================== -->
    <div class="list" v-else-if="tab==='pendingMy' || tab==='pending'">
      <div class="claim-card" v-for="claim in pendingMyList" :key="claim.id">
        <div class="claim-header">
          <span class="claim-title">{{ claim.tasks?.title || '未知任务' }}</span>
          <span class="claim-status pending-tag">待完成</span>
        </div>
        <div class="claim-meta">
          <span>{{ claim.users?.username || '用户' }}</span>
          <span>·</span>
          <span>{{ getPlatformName(claim.tasks?.platform) }}</span>
          <span>·</span>
          <span>{{ claim.tasks?.base_reward }} 积分</span>
        </div>
        <div class="claim-time">
          提交时间: {{ formatTime(claim.submitted_at) }}
        </div>
        <div class="claim-actions">
          <button class="btn-detail" @click="goClaimDetail(claim)">查看详情</button>
        </div>
      </div>
      <div class="empty" v-if="pendingMyList.length === 0">暂无待完成的任务</div>
      <div class="pagination" v-if="pendingMyTotal > pageSize">
        <button :disabled="pendingMyPage <= 1" @click="pendingMyPage--; loadPendingMy()">上一页</button>
        <span>{{ pendingMyPage }} / {{ Math.ceil(pendingMyTotal / pageSize) }}</span>
        <button :disabled="pendingMyPage >= Math.ceil(pendingMyTotal / pageSize)" @click="pendingMyPage++; loadPendingMy()">下一页</button>
      </div>
    </div>
    
    <!-- ==================== 已完成列表 ==================== -->
    <div class="list" v-else-if="tab==='done'">
      <div class="claim-card" v-for="claim in doneList" :key="claim.id" @click="goClaimDetail(claim)">
        <div class="claim-header">
          <span class="claim-title">{{ claim.tasks?.title || '未知任务' }}</span>
          <span class="claim-status done-tag">已完成</span>
        </div>
        <div class="claim-meta">
          <span>{{ claim.users?.username || '用户' }}</span>
          <span>·</span>
          <span>{{ getPlatformName(claim.tasks?.platform) }}</span>
          <span>·</span>
          <span>+{{ claim.tasks?.base_reward }} 积分</span>
        </div>
        <div class="claim-time">
          完成时间: {{ formatTime(claim.reviewed_at) }}
        </div>
        <div class="claim-footer">
          <span class="arrow">查看详情 ></span>
        </div>
      </div>
      <div class="empty" v-if="doneList.length === 0">暂无已完成的任务</div>
      <div class="pagination" v-if="doneTotal > pageSize">
        <button :disabled="donePage <= 1" @click="donePage--; loadDone()">上一页</button>
        <span>{{ donePage }} / {{ Math.ceil(doneTotal / pageSize) }}</span>
        <button :disabled="donePage >= Math.ceil(doneTotal / pageSize)" @click="donePage++; loadDone()">下一页</button>
      </div>
    </div>
    
    <!-- 拒绝原因弹窗 -->
    <div class="dialog-overlay" v-if="showRejectReason" @click="showRejectReason = false">
      <div class="dialog" @click.stop>
        <h3>拒绝原因</h3>
        <textarea v-model="rejectReason" placeholder="请输入拒绝原因（可选）"></textarea>
        <div class="dialog-actions">
          <button @click="showRejectReason = false">取消</button>
          <button class="confirm" @click="handleReview(rejectingClaimId, 'reject', rejectReason)">确认拒绝</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getMyPublishedTasks, getPendingReviewList, getReviewedList, getMyTaskClaims, reviewTaskClaim } from '../api/task'

const router = useRouter()

// 从 localStorage 获取用户信息
const user = computed(() => {
  const userStr = localStorage.getItem('xiaohuangyu_user')
  return userStr ? JSON.parse(userStr) : null
})

const isReviewer = computed(() => user.value?.role === 'reviewer' || user.value?.role === 'admin')

// 审核员/管理员默认显示待审核，发布者默认显示发布的任务
const tab = ref(isReviewer.value ? 'pendingReview' : 'published')
const loading = ref(false)
const pageSize = 20

// 发布的任务
const publishedTasks = ref([])

// 待审核列表（审核员/管理员专用 - 所有待审核）
const pendingReviewList = ref([])
const pendingReviewPage = ref(1)
const pendingReviewTotal = ref(0)

// 已审核列表（审核员/管理员专用 - 所有已审核）
const reviewedList = ref([])
const reviewedPage = ref(1)
const reviewedTotal = ref(0)

// 待完成列表（自己发布任务的待审核领取）
const pendingMyList = ref([])
const pendingMyPage = ref(1)
const pendingMyTotal = ref(0)

// 已完成列表
const doneList = ref([])
const donePage = ref(1)
const doneTotal = ref(0)

// 拒绝弹窗
const showRejectReason = ref(false)
const rejectReason = ref('')
const rejectingClaimId = ref(null)

// 平台和操作类型映射
function getPlatformName(platform) {
  const map = {
    'douyin': '抖音',
    'kuaishou': '快手',
    'weibo': '视频号',
    'xiaohongshu': '小红书'
  }
  return map[platform] || platform || '未知平台'
}

function getActionName(action) {
  return '短视频评价官'
}

function getStatusClass(status) {
  const map = {
    'active': 'status-active',
    'paused': 'status-paused',
    'completed': 'status-completed'
  }
  return map[status] || ''
}

function getStatusText(status) {
  const map = {
    'active': '进行中',
    'paused': '已暂停',
    'completed': '已结束'
  }
  return map[status] || status
}

function formatTime(time) {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 加载发布的任务
async function loadPublishedTasks() {
  loading.value = true
  try {
    const data = await getMyPublishedTasks(1, 50)
    publishedTasks.value = data?.list || []
  } catch (e) {
    console.error('加载失败:', e)
    publishedTasks.value = []
  } finally {
    loading.value = false
  }
}

// 加载待审核列表（审核员/管理员专用）
async function loadPendingReview() {
  loading.value = true
  try {
    const data = await getPendingReviewList(pendingReviewPage.value, pageSize)
    pendingReviewList.value = data?.list || []
    pendingReviewTotal.value = data?.total || 0
  } catch (e) {
    console.error('加载失败:', e)
    pendingReviewList.value = []
  } finally {
    loading.value = false
  }
}

// 加载已审核列表（审核员/管理员专用）
async function loadReviewed() {
  loading.value = true
  try {
    const data = await getReviewedList(reviewedPage.value, pageSize)
    reviewedList.value = data?.list || []
    reviewedTotal.value = data?.total || 0
  } catch (e) {
    console.error('加载失败:', e)
    reviewedList.value = []
  } finally {
    loading.value = false
  }
}

// 加载待完成列表（自己发布任务的待审核领取）
async function loadPendingMy() {
  loading.value = true
  try {
    const data = await getMyTaskClaims(pendingMyPage.value, pageSize, 'pending')
    pendingMyList.value = data?.list || []
    pendingMyTotal.value = data?.total || 0
  } catch (e) {
    console.error('加载失败:', e)
    pendingMyList.value = []
  } finally {
    loading.value = false
  }
}

// 加载已完成列表
async function loadDone() {
  loading.value = true
  try {
    const data = await getMyTaskClaims(donePage.value, pageSize, 'done')
    doneList.value = data?.list || []
    doneTotal.value = data?.total || 0
  } catch (e) {
    console.error('加载失败:', e)
    doneList.value = []
  } finally {
    loading.value = false
  }
}

// 审核任务
async function handleReview(claimId, action, note = '') {
  try {
    await reviewTaskClaim(claimId, action, note)
    showRejectReason.value = false
    rejectReason.value = ''
    rejectingClaimId.value = null
    alert(action === 'approve' ? '审核通过' : '已拒绝')
    // 重新加载当前列表
    if (tab.value === 'pendingReview') {
      loadPendingReview()
    }
  } catch (e) {
    alert('操作失败: ' + e.message)
  }
}

function showRejectDialog(claimId) {
  rejectingClaimId.value = claimId
  rejectReason.value = ''
  showRejectReason.value = true
}

// 页面跳转
function goTaskDetail(task) {
  router.push(`/task/${task.id}`)
}

function goClaimDetail(claim) {
  router.push(`/publisher/claim/${claim.id}`)
}

// 切换标签页时加载数据
watch(tab, (newTab) => {
  if (newTab === 'pendingReview') {
    loadPendingReview()
  } else if (newTab === 'reviewed') {
    loadReviewed()
  } else if (newTab === 'published') {
    loadPublishedTasks()
  } else if (newTab === 'pendingMy' || newTab === 'pending') {
    loadPendingMy()
  } else if (newTab === 'done') {
    loadDone()
  }
})

onMounted(() => {
  // 根据角色加载初始数据
  if (isReviewer.value) {
    loadPendingReview()
  } else {
    loadPublishedTasks()
  }
})
</script>

<style scoped>
.publisher-tasks {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 100px;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header h1 {
  font-size: 18px;
  font-weight: 600;
}

.tabs {
  display: flex;
  background: #fff;
  padding: 0 8px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.tabs span {
  flex-shrink: 0;
  text-align: center;
  padding: 14px 12px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
}

.tabs span.active {
  color: #667eea;
  font-weight: 600;
  border-bottom-color: #667eea;
}

.loading {
  padding: 40px;
  text-align: center;
  color: #666;
}

.list {
  padding: 12px;
}

/* 任务卡片样式 */
.task-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.task-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.task-code {
  font-size: 13px;
  font-weight: 600;
  color: #667eea;
  background: #f0f2ff;
  padding: 2px 8px;
  border-radius: 4px;
}

.task-title {
  font-size: 15px;
  font-weight: 500;
  color: #333;
  flex: 1;
  margin-right: 8px;
}

.task-title-row {
  font-size: 15px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
}

.task-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
}

.status-active {
  background: #e8f5e9;
  color: #4caf50;
}

.status-paused {
  background: #fff3e0;
  color: #ff9800;
}

.status-completed {
  background: #f5f5f5;
  color: #999;
}

.task-meta {
  font-size: 12px;
  color: #999;
  margin-bottom: 12px;
}

.task-meta span {
  margin: 0 2px;
}

.task-stats {
  display: flex;
  gap: 20px;
  padding: 12px 0;
  border-top: 1px solid #f0f0f0;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 12px;
}

.stat {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.stat-label {
  font-size: 11px;
  color: #999;
}

.stat.pending .stat-value {
  color: #ff9800;
}

.stat.done .stat-value {
  color: #4caf50;
}

.task-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-time {
  font-size: 12px;
  color: #999;
}

.arrow {
  color: #667eea;
  font-size: 14px;
}

/* 领取卡片样式 */
.claim-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  cursor: pointer;
}

.claim-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.claim-title {
  font-size: 15px;
  font-weight: 500;
  color: #333;
  flex: 1;
  margin-right: 8px;
}

.claim-title-row {
  font-size: 15px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
}

.claim-task-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.task-title-text {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.claim-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
}

.pending-tag {
  background: #fff3e0;
  color: #ff9800;
}

.done-tag {
  background: #e8f5e9;
  color: #4caf50;
}

.rejected-tag {
  background: #ffebee;
  color: #f44336;
}

.claim-meta {
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
}

.claim-meta span {
  margin: 0 2px;
}

.claim-publisher,
.claim-review-info {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
  padding: 4px 8px;
  background: #f9f9f9;
  border-radius: 4px;
}

.claim-time {
  font-size: 12px;
  color: #999;
  margin-bottom: 12px;
}

.claim-footer {
  display: flex;
  justify-content: flex-end;
}

.claim-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.claim-actions button {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  border: none;
  cursor: pointer;
}

.btn-approve {
  background: #4caf50;
  color: #fff;
}

.btn-reject {
  background: #f44336;
  color: #fff;
}

.btn-detail {
  background: #667eea;
  color: #fff;
}

.empty {
  text-align: center;
  color: #999;
  padding: 40px;
  font-size: 14px;
}

.empty-action {
  margin-top: 16px;
}

.empty-action button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
  padding: 10px 24px;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
}

/* 分页 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.pagination button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 弹窗 */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  width: 90%;
  max-width: 400px;
}

.dialog h3 {
  margin: 0 0 16px;
  font-size: 16px;
}

.dialog textarea {
  width: 100%;
  height: 100px;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  resize: none;
  box-sizing: border-box;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.dialog-actions button {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.dialog-actions button:first-child {
  background: #f5f5f5;
  color: #666;
}

.dialog-actions .confirm {
  background: #f44336;
  color: #fff;
}
</style>
