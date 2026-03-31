<template>
  <div class="claim-detail">
    <header class="header">
      <span class="back" @click="$router.back()">← 返回</span>
      <h1>领取详情</h1>
    </header>
    
    <div class="loading" v-if="loading">加载中...</div>
    
    <div class="content" v-else-if="claim">
      <!-- 状态卡片 -->
      <div class="status-card" :class="getStatusClass(claim.status)">
        <div class="status-icon">{{ getStatusIcon(claim.status) }}</div>
        <div class="status-text">{{ getStatusText(claim.status) }}</div>
        <div class="status-time" v-if="claim.reviewed_at">
          {{ claim.reviewed_at ? formatTime(claim.reviewed_at) : '' }}
        </div>
      </div>
      
      <!-- 任务信息 -->
      <div class="section">
        <h3>任务信息</h3>
        <div class="info-item">
          <span class="label">任务标题</span>
          <span class="value">{{ claim.title }}</span>
        </div>
        <div class="info-item">
          <span class="label">平台</span>
          <span class="value">{{ getPlatformName(claim.platform) }}</span>
        </div>
        <div class="info-item">
          <span class="label">操作类型</span>
          <span class="value">{{ getActionName(claim.action) }}</span>
        </div>
        <div class="info-item">
          <span class="label">奖励积分</span>
          <span class="value reward">+{{ claim.final_points || claim.reward }}</span>
        </div>
      </div>
      
      <!-- 领取信息 -->
      <div class="section">
        <h3>领取信息</h3>
        <div class="info-item">
          <span class="label">领取用户</span>
          <span class="value">{{ claim.users?.username || '用户' }}</span>
        </div>
        <div class="info-item">
          <span class="label">领取时间</span>
          <span class="value">{{ formatTime(claim.claimed_at) }}</span>
        </div>
        <div class="info-item" v-if="claim.platform_nickname">
          <span class="label">平台昵称</span>
          <span class="value">{{ claim.platform_nickname }}</span>
        </div>
        <div class="info-item" v-if="claim.city || claim.province">
          <span class="label">地区</span>
          <span class="value">{{ claim.province }} {{ claim.city }}</span>
        </div>
        <div class="info-item" v-if="claim.submitted_at">
          <span class="label">提交时间</span>
          <span class="value">{{ formatTime(claim.submitted_at) }}</span>
        </div>
      </div>
      
      <!-- 提交截图 -->
      <div class="section" v-if="claim.screenshots && claim.screenshots.length">
        <h3>提交截图</h3>
        <div class="screenshots">
          <img 
            v-for="(img, index) in claim.screenshots" 
            :key="index" 
            :src="img" 
            @click="previewImage(img)"
            alt="截图"
          />
        </div>
      </div>
      
      <!-- 审核信息 -->
      <div class="section" v-if="claim.review_note">
        <h3>审核备注</h3>
        <div class="review-note" :class="{ rejected: claim.status === 'rejected' }">
          {{ claim.review_note }}
        </div>
      </div>
      
      <!-- 审核操作（仅待审核状态显示） -->
      <div class="actions" v-if="claim.status === 'pending' && canReview">
        <button class="btn-approve" @click="handleReview('approve')">通过审核</button>
        <button class="btn-reject" @click="showRejectDialog = true">拒绝</button>
      </div>
      
      <!-- 拒绝原因弹窗 -->
      <div class="dialog-overlay" v-if="showRejectDialog" @click="showRejectDialog = false">
        <div class="dialog" @click.stop>
          <h3>拒绝原因</h3>
          <textarea v-model="rejectReason" placeholder="请输入拒绝原因（可选）"></textarea>
          <div class="dialog-actions">
            <button @click="showRejectDialog = false">取消</button>
            <button class="confirm" @click="handleReview('reject')">确认拒绝</button>
          </div>
        </div>
      </div>
    </div>
    
    <div class="empty" v-else>
      未找到领取记录
    </div>
    
    <!-- 图片预览 -->
    <div class="image-preview" v-if="previewUrl" @click="previewUrl = ''">
      <img :src="previewUrl" @click.stop />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getClaimDetail, reviewTaskClaim } from '../api/task'

const route = useRoute()
const router = useRouter()

const claim = ref(null)
const loading = ref(true)
const showRejectDialog = ref(false)
const rejectReason = ref('')
const previewUrl = ref('')

// 从 localStorage 获取用户信息
const user = computed(() => {
  const userStr = localStorage.getItem('xiaohuangyu_user')
  return userStr ? JSON.parse(userStr) : null
})

const canReview = computed(() => user.value?.role === 'reviewer' || user.value?.role === 'admin')

function getPlatformName(platform) {
  const map = {
    'douyin': '抖音',
    'kuaishou': '快手',
    'weibo': '视频号',
    'xiaohongshu': '小红书'
  }
  return map[platform] || platform
}

function getActionName(action) {
  return '短视频评价官'
}

function getStatusClass(status) {
  const map = {
    'doing': 'status-doing',
    'pending': 'status-pending',
    'done': 'status-done',
    'rejected': 'status-rejected'
  }
  return map[status] || ''
}

function getStatusIcon(status) {
  const map = {
    'doing': '⏳',
    'pending': '📝',
    'done': '✅',
    'rejected': '❌'
  }
  return map[status] || '❓'
}

function getStatusText(status) {
  const map = {
    'doing': '进行中',
    'pending': '待审核',
    'done': '已完成',
    'rejected': '已拒绝'
  }
  return map[status] || status
}

function formatTime(timeStr) {
  if (!timeStr) return '-'
  const date = new Date(timeStr)
  return date.toLocaleString('zh-CN')
}

function previewImage(url) {
  previewUrl.value = url
}

async function loadClaim() {
  loading.value = true
  try {
    const claimId = route.params.claimId
    const data = await getClaimDetail(claimId)
    
    // 解析截图
    if (data) {
      if (typeof data.screenshots === 'string') {
        try {
          data.screenshots = JSON.parse(data.screenshots)
        } catch (e) {
          data.screenshots = []
        }
      }
    }
    
    claim.value = data
  } catch (e) {
    console.error('加载失败:', e)
    claim.value = null
  } finally {
    loading.value = false
  }
}

async function handleReview(action) {
  try {
    await reviewTaskClaim(claim.value.id, action, rejectReason.value)
    showRejectDialog.value = false
    alert(action === 'approve' ? '审核通过' : '已拒绝')
    // 重新加载数据
    loadClaim()
  } catch (e) {
    alert('操作失败: ' + e.message)
  }
}

onMounted(() => {
  loadClaim()
})
</script>

<style scoped>
.claim-detail {
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
  gap: 12px;
}

.back {
  cursor: pointer;
}

.header h1 {
  flex: 1;
  text-align: center;
  margin: 0;
  font-size: 18px;
}

.loading, .empty {
  padding: 40px;
  text-align: center;
  color: #666;
}

.content {
  padding: 16px;
}

/* 状态卡片 */
.status-card {
  text-align: center;
  padding: 24px;
  border-radius: 12px;
  margin-bottom: 16px;
}

.status-doing { background: #e3f2fd; }
.status-pending { background: #fff3e0; }
.status-done { background: #e8f5e9; }
.status-rejected { background: #ffebee; }

.status-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.status-text {
  font-size: 20px;
  font-weight: 600;
}

.status-time {
  font-size: 13px;
  color: #666;
  margin-top: 8px;
}

/* 信息区块 */
.section {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.section h3 {
  font-size: 15px;
  color: #666;
  margin: 0 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
}

.info-item .label {
  color: #999;
  font-size: 14px;
}

.info-item .value {
  color: #333;
  font-size: 14px;
}

.info-item .value.reward {
  color: #4caf50;
  font-weight: 600;
}

/* 截图展示 */
.screenshots {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.screenshots img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
}

/* 审核备注 */
.review-note {
  padding: 12px;
  background: #f5f5f5;
  border-radius: 8px;
  font-size: 14px;
  color: #333;
}

.review-note.rejected {
  background: #ffebee;
  color: #f44336;
}

/* 操作按钮 */
.actions {
  display: flex;
  gap: 12px;
  padding: 16px;
}

.actions button {
  flex: 1;
  padding: 14px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
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

/* 弹窗样式 */
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
  font-size: 18px;
}

.dialog textarea {
  width: 100%;
  height: 100px;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  resize: none;
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

/* 图片预览 */
.image-preview {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.image-preview img {
  max-width: 90%;
  max-height: 90%;
  object-fit: contain;
}
</style>
