<template>
  <div class="task-detail">
    <header class="header">
      <span class="back" @click="$router.back()">← 返回</span>
      <h1>任务详情</h1>
    </header>
    
    <div class="loading" v-if="loading">加载中...</div>
    <div class="error" v-else-if="error">{{ error }}</div>
    
    <div class="content" v-else-if="task">
      <!-- 标题信息融合卡片 -->
      <div class="hero-card">
        <h2 class="hero-title">{{ task.title }}</h2>
        <div class="hero-tags">
          <span class="tag platform">{{ getPlatformName(task.platform) }}</span>
          <span class="tag action">{{ getActionName(task.action) }}</span>
        </div>
        <div class="hero-stats">
          <div class="stat-item reward">
            <span class="stat-label">积分：</span>
            <span class="stat-value">{{ task.estimatedReward || task.reward }}分</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item" v-if="task.timeLimitMinutes">
            <span class="stat-label">限时：</span>
            <span class="stat-value">{{ task.timeLimitMinutes }}分钟</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-label">剩余名额：</span>
            <span class="stat-value">{{ task.remain }}</span>
          </div>
        </div>
        <div class="night-info" v-if="task.isNightBonusTask">
          🌙 夜间奖励任务（按发布时间判定） · 系数 x{{ Number(task.nightCoefficient || 1).toFixed(2) }}
        </div>
      </div>
      
      <!-- 任务链接卡片 - 一键复制 -->
      <div class="link-card" v-if="pureVideoLink">
        <div class="link-header">
          <span class="link-title">📎 任务链接</span>
        </div>
        <div class="link-content">{{ pureVideoLink }}</div>
        <div class="link-tip-wrapper">
          <span class="link-tip-highlight">💡 复制后在{{ getPlatformName(task.platform) }}APP中打开</span>
        </div>
        <div class="link-footer">
          <button type="button" class="btn-copy" @click="copyUrl">
            <span class="copy-icon">📋</span>
            <span>一键复制</span>
          </button>
        </div>
      </div>
      
      <!-- 任务说明卡片 -->
      <div class="section-card description-card" v-if="task.description">
        <div class="section-title">📝 任务说明</div>
        <div class="description-content">
          <p v-for="(line, index) in descriptionLines" :key="index">{{ line }}</p>
        </div>
      </div>
      
      <!-- 完成示范图片 -->
      <div class="section-card" v-if="exampleImages && exampleImages.length">
        <div class="section-title">📸 完成示范</div>
        <p class="section-desc">请参考以下示范图片完成任务</p>
        <div class="images-grid">
          <div class="image-item" v-for="(img, i) in exampleImages" :key="i" @click="previewImage(img)">
            <img :src="img" :alt="'示范图片' + (i + 1)" />
            <div class="image-mask"><span>点击放大</span></div>
          </div>
        </div>
      </div>
      
      <!-- 完成要求 -->
      <div class="section-card" v-if="requirementsList.length > 0">
        <div class="section-title">✅ 完成要求</div>
        <div class="steps-list">
          <div class="step-item" v-for="(step, index) in requirementsList" :key="index">
            <div class="step-header">
              <span class="step-num">{{ index + 1 }}</span>
              <span class="step-title">{{ step.title }}</span>
            </div>
            <p class="step-desc" v-if="step.description">{{ step.description }}</p>
            <div class="step-warning" v-if="step.warning">⚠️ {{ step.warning }}</div>
            <div class="step-tip" v-if="step.tips">💡 {{ step.tips }}</div>
            <div class="step-success" v-if="step.success">✅ {{ step.success }}</div>
            <ul class="sub-steps" v-if="step.steps && step.steps.length">
              <li v-for="(sub, si) in step.steps" :key="si">{{ sub }}</li>
            </ul>
            <ul class="req-list" v-if="step.requirements && step.requirements.length">
              <li v-for="(req, ri) in step.requirements" :key="ri">📷 {{ req }}</li>
            </ul>
          </div>
        </div>
      </div>
      
      <!-- 已领取提示 -->
      <div class="claimed-tip" v-if="task.isClaimed">
        已领取，请在 {{ task.timeLimitMinutes || 10 }} 分钟内完成
      </div>
      
      <!-- 底部操作按钮 -->
      <div class="action-bar">
        <!-- 已完成 -->
        <div v-if="task.isCompleted" class="status-badge completed">
          ✅ 任务已完成
        </div>
        <!-- 审核中 -->
        <div v-else-if="task.isPending" class="status-badge pending">
          ⏳ 审核中，请耐心等待
        </div>
        <!-- 可以提交 -->
        <button v-else-if="task.canSubmit && showClaimButton" class="btn-primary btn-submit" @click="goToSubmit">提交任务</button>
        <!-- 可以领取 -->
        <button v-else-if="(task.canClaim || !task.isClaimed) && showClaimButton" class="btn-primary" @click="handleClaim" :disabled="claiming">{{ claiming ? '领取中...' : '领取任务' }}</button>
        <!-- 无权限 -->
        <div v-if="!showClaimButton && isLoggedIn" class="role-tip">您当前角色为{{ getRoleName(user?.role) }}，无法领取任务</div>
      </div>
    </div>
    
    <!-- 图片预览模态框 -->
    <div class="preview-modal" v-if="showPreview" @click="closePreview">
      <div class="preview-box" @click.stop>
        <img :src="previewUrl" alt="预览" />
        <button class="preview-close" @click="closePreview">×</button>
      </div>
    </div>
    
    <!-- Toast提示 -->
    <div class="toast" v-if="toast.show">{{ toast.message }}</div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onActivated, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getTaskDetail, claimTask, getConfig } from '../api/task'
import { useAuth } from '../store/auth'

const route = useRoute()
const router = useRouter()
const { isLoggedIn, user } = useAuth()
const task = ref(null)
const loading = ref(true)
const error = ref('')
const claiming = ref(false)
const toast = reactive({ show: false, message: '' })
const exampleImages = ref([])
const showPreview = ref(false)
const previewUrl = ref('')

// 提取纯净的视频分享链接
const pureVideoLink = computed(() => {
  if (!task.value?.videoUrl) return ''
  const rawUrl = task.value.videoUrl
  
  // 如果包含https://，提取链接及前后的分享口令
  if (rawUrl.includes('https://')) {
    const httpsIndex = rawUrl.indexOf('https://')
    const beforeHttps = rawUrl.substring(0, httpsIndex)
    const shareMatch = beforeHttps.match(/(\d+[\.\d]*\s*复制打开[^\n]*)$/)
    if (shareMatch) {
      return shareMatch[1] + rawUrl.substring(httpsIndex)
    }
    return rawUrl.substring(httpsIndex)
  }
  
  return rawUrl
})

// 任务说明按行分割
const descriptionLines = computed(() => {
  if (!task.value?.description) return []
  return task.value.description.split('\n').filter(line => line.trim())
})

const requirementsList = computed(() => {
  if (!task.value?.requirements) return []
  let reqs = task.value.requirements
  if (typeof reqs === 'string') {
    try { reqs = JSON.parse(reqs) } catch (e) { return [] }
  }
  if (Array.isArray(reqs)) {
    return reqs.map((r, index) => {
      if (typeof r === 'string') {
        return { title: r }
      }
      return r
    })
  }
  return []
})

const showClaimButton = computed(() => {
  return user.value?.role === 'part_timer' || user.value?.role === 'admin' || !isLoggedIn.value
})

const fetchData = async () => {
  try {
    loading.value = true
    error.value = ''
    const taskId = route.params.id
    const res = await getTaskDetail(taskId)
    task.value = res
    
    // 处理示范图片
    if (res.exampleImages) {
      let imgs = res.exampleImages
      if (typeof imgs === 'string') {
        try { imgs = JSON.parse(imgs) } catch (e) { imgs = [] }
      }
      exampleImages.value = Array.isArray(imgs) ? imgs : []
    }
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

const handleClaim = async () => {
  if (!isLoggedIn.value) {
    showToast('请先登录')
    router.push('/login')
    return
  }
  
  claiming.value = true
  try {
    await claimTask(task.value.id)
    task.value.isClaimed = true
    showToast('领取成功！正在跳转到我的任务...')
    
    // 自动跳转到我的任务页面
    setTimeout(() => {
      router.push('/my/tasks')
    }, 1500)
  } catch (e) {
    showToast(e.message || '领取失败')
  } finally {
    claiming.value = false
  }
}

const goToSubmit = () => {
  router.push(`/submit/${task.value.myClaimId}`)
}

const getPlatformName = (platform) => {
  const map = {
    'douyin': '抖音',
    'kuaishou': '快手',
    'xiaohongshu': '小红书',
    'bilibili': 'B站',
    'weixin': '微信',
    'other': '其他'
  }
  return map[platform] || platform || '未知平台'
}

const getActionName = (action) => {
  return '短视频评价官'
}

const getRoleName = (role) => {
  const map = {
    'part_timer': '体验官',
    'client': '客户',
    'admin': '管理员',
    'reviewer': '审核员',
  }
  return map[role] || role || '未知角色'
}

const copyUrl = async () => {
  try {
    await navigator.clipboard.writeText(pureVideoLink.value)
    showToast('链接已复制，请打开APP粘贴')
  } catch (e) {
    // 降级方案
    const input = document.createElement('input')
    input.value = pureVideoLink.value
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    showToast('链接已复制，请打开APP粘贴')
  }
}

const showToast = (message) => {
  toast.message = message
  toast.show = true
  setTimeout(() => { toast.show = false }, 2000)
}

const previewImage = (url) => {
  previewUrl.value = url
  showPreview.value = true
}

const closePreview = () => {
  showPreview.value = false
}

const handlePointsUpdate = (event) => {
  const detail = event?.detail || {}
  if (!task.value) return
  if (String(detail.taskId || '') !== String(task.value.id || '')) return
  const points = Number(detail.finalPoints || detail.points || 0)
  if (points > 0) {
    showToast(`积分到账 +${points}`)
  }
  fetchData()
}

onMounted(() => {
  fetchData()
  window.addEventListener('points-update', handlePointsUpdate)
})
onActivated(fetchData)
onUnmounted(() => {
  window.removeEventListener('points-update', handlePointsUpdate)
})
</script>

<style scoped>
.task-detail {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 80px;
}

.header {
  position: sticky;
  top: 0;
  background: #fff;
  padding: 16px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #eee;
  z-index: 100;
}

.header .back {
  font-size: 17px;
  color: #666;
  cursor: pointer;
}

.header h1 {
  flex: 1;
  text-align: center;
  font-size: 19px;
  font-weight: 600;
  margin: 0;
}

.loading, .error {
  text-align: center;
  padding: 60px 20px;
  font-size: 17px;
  color: #888;
}

.content {
  padding: 16px;
}

/* Hero Card */
.hero-card {
  background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  color: #fff;
}

.night-info {
  margin-top: 10px;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(255, 214, 102, 0.22);
  font-size: 12px;
  color: #fff8e1;
}

.hero-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 12px;
  line-height: 1.4;
}

.hero-tags {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.tag {
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 15px;
  font-weight: 500;
}

.tag.platform {
  background: rgba(255,255,255,0.25);
}

.tag.action {
  background: rgba(255,255,255,0.15);
}

.hero-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat-label {
  font-size: 15px;
  opacity: 0.9;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
}

.stat-item.reward .stat-value {
  color: #ffd54f;
  font-size: 20px;
}

.stat-divider {
  width: 1px;
  height: 18px;
  background: rgba(255,255,255,0.3);
}

/* Link Card */
.link-card {
  background: #fff;
  border-radius: 16px;
  padding: 18px;
  margin-bottom: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}

.link-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.link-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.link-content {
  background: #f5f5f5;
  border-radius: 10px;
  padding: 14px;
  font-size: 15px;
  color: #555;
  word-break: break-all;
  line-height: 1.6;
  margin-bottom: 12px;
}

.link-tip-wrapper {
  text-align: center;
  margin-bottom: 14px;
}

.link-tip-highlight {
  display: inline-block;
  background: linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%);
  color: #fff;
  padding: 10px 20px;
  border-radius: 25px;
  font-size: 17px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
}

.link-footer {
  display: flex;
  justify-content: center;
}

.btn-copy {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 32px;
  background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%);
  color: #fff;
  border: none;
  border-radius: 25px;
  font-size: 17px;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-copy:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(63, 81, 181, 0.3);
}

.copy-icon {
  font-size: 18px;
}

/* Section Card */
.section-card {
  background: #fff;
  border-radius: 16px;
  padding: 18px;
  margin-bottom: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.section-desc {
  font-size: 16px;
  color: #666;
  margin-bottom: 14px;
}

/* Description Card */
.description-card .description-content p {
  font-size: 16px;
  line-height: 1.8;
  color: #444;
  margin: 0;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}

.description-card .description-content p:last-child {
  border-bottom: none;
}

/* Images Grid */
.images-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.image-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
}

.image-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-mask {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.image-item:hover .image-mask {
  opacity: 1;
}

.image-mask span {
  color: #fff;
  font-size: 14px;
}

/* Steps List */
.steps-list {
  margin-top: 10px;
}

.step-item {
  padding: 16px;
  background: #f8f9fa;
  border-radius: 12px;
  margin-bottom: 12px;
}

.step-item:last-child {
  margin-bottom: 0;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.step-num {
  width: 28px;
  height: 28px;
  background: #3f51b5;
  color: #fff;
  border-radius: 50%;
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-title {
  font-size: 17px;
  font-weight: 500;
  color: #333;
}

.step-desc {
  font-size: 16px;
  color: #666;
  margin: 8px 0 0 40px;
  line-height: 1.6;
}

.step-warning {
  margin: 10px 0 0 40px;
  padding: 10px 14px;
  background: #fff3cd;
  border-radius: 8px;
  font-size: 15px;
  color: #856404;
}

.step-tip {
  margin: 10px 0 0 40px;
  padding: 10px 14px;
  background: #e3f2fd;
  border-radius: 8px;
  font-size: 15px;
  color: #1565c0;
}

.step-success {
  margin: 10px 0 0 40px;
  padding: 10px 14px;
  background: #e8f5e9;
  border-radius: 8px;
  font-size: 15px;
  color: #2e7d32;
}

.sub-steps, .req-list {
  margin: 10px 0 0 40px;
  padding-left: 18px;
}

.sub-steps li, .req-list li {
  font-size: 16px;
  color: #555;
  margin-bottom: 6px;
  line-height: 1.6;
}

/* Claimed Tip */
.claimed-tip {
  background: #fff3cd;
  color: #856404;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-size: 17px;
  margin-bottom: 16px;
  font-weight: 500;
}

/* Action Bar */
.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 14px 16px;
  background: #fff;
  border-top: 1px solid #eee;
}

.btn-primary {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%);
  color: #fff;
  border: none;
  border-radius: 14px;
  font-size: 18px;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-submit {
  background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%);
}

.role-tip {
  text-align: center;
  color: #888;
  font-size: 16px;
}

/* Status Badge */
.status-badge {
  width: 100%;
  padding: 16px;
  border-radius: 14px;
  text-align: center;
  font-size: 18px;
  font-weight: 500;
}

.status-badge.completed {
  background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%);
  color: #fff;
}

.status-badge.pending {
  background: linear-gradient(135deg, #ff9800 0%, #ffb74d 100%);
  color: #fff;
}

/* Preview Modal */
.preview-modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.preview-box {
  position: relative;
  max-width: 90%;
  max-height: 90%;
}

.preview-box img {
  max-width: 100%;
  max-height: 80vh;
  border-radius: 8px;
}

.preview-close {
  position: absolute;
  top: -40px;
  right: 0;
  width: 36px;
  height: 36px;
  background: rgba(255,255,255,0.2);
  border: none;
  border-radius: 50%;
  color: #fff;
  font-size: 24px;
  cursor: pointer;
}

/* Toast */
.toast {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.8);
  color: #fff;
  padding: 14px 28px;
  border-radius: 28px;
  font-size: 17px;
  z-index: 1001;
}
</style>
