<template>
  <div class="yx-page no-tabbar task-detail-page">
    <header class="yx-header center">
      <button class="yx-back-btn" @click="$router.back()">←</button>
      <div class="yx-header-main">
        <h1 class="yx-title sm">任务详情</h1>
        <p class="yx-subtitle">把任务说明、链接、示范图和完成要求按流程排开，让用户一屏一屏做下去。</p>
      </div>
      <div class="yx-icon-btn">⋯</div>
    </header>

    <div class="yx-empty" v-if="loading">
      <strong>加载中...</strong>
      <span>正在获取任务详情。</span>
    </div>

    <div class="yx-empty" v-else-if="error">
      <strong>加载失败</strong>
      <span>{{ error }}</span>
    </div>

    <div v-else-if="task">
      <section class="yx-hero-card">
        <div class="yx-tag-row" style="margin-bottom:10px;">
          <span class="yx-tag coral">{{ getPlatformName(task.platform) }}</span>
          <span class="yx-tag navy">{{ getActionName(task.action) }}</span>
          <span class="yx-tag gold" v-if="showNightUiWindow && task.isNightBonusTask">夜间 x{{ Number(task.nightCoefficient || 1).toFixed(2) }}</span>
        </div>
        <h2 class="detail-title">{{ task.title }}</h2>
        <p class="detail-sub">{{ task.description || '按任务要求完成视频体验、互动、评论并上传两张截图。' }}</p>
        <div class="yx-summary-grid three" style="margin-top:14px;">
          <div class="yx-stat-card">
            <strong>{{ task.estimatedReward || task.reward }}</strong>
            <span>积分奖励</span>
          </div>
          <div class="yx-stat-card">
            <strong>{{ task.timeLimitMinutes || 10 }}</strong>
            <span>限时分钟</span>
          </div>
          <div class="yx-stat-card">
            <strong>{{ task.remain }}</strong>
            <span>剩余名额</span>
          </div>
        </div>
      </section>

      <section class="yx-card" v-if="pureVideoLink">
        <div class="yx-card-head">
          <div>
            <h3>任务链接</h3>
            <div class="yx-card-note">复制后在{{ getPlatformName(task.platform) }} APP 中打开</div>
          </div>
        </div>
        <div class="link-box">{{ pureVideoLink }}</div>
        <div class="yx-actions">
          <button class="yx-btn-ghost">复制后在{{ getPlatformName(task.platform) }}打开</button>
          <button class="yx-btn" @click="copyUrl">一键复制</button>
        </div>
      </section>

      <section class="yx-card" v-if="task.description">
        <div class="yx-card-head">
          <div>
            <h3>任务说明</h3>
            <div class="yx-card-note">上下排版更紧凑</div>
          </div>
        </div>
        <div class="detail-copy">
          <p v-for="(line, index) in descriptionLines" :key="index">{{ line }}</p>
        </div>
      </section>

      <section class="yx-card" v-if="exampleImages && exampleImages.length">
        <div class="yx-card-head">
          <div>
            <h3>示范图片</h3>
            <div class="yx-card-note">任务说明卡与完成要求卡之间展示</div>
          </div>
        </div>
        <div class="example-grid">
          <button class="example-item" v-for="(img, i) in exampleImages" :key="i" @click="previewImage(img)">
            <img :src="img" :alt="'示范图片' + (i + 1)" />
            <span>示范图 {{ i + 1 }} · 点击放大</span>
          </button>
        </div>
      </section>

      <section class="yx-card" v-if="requirementsList.length > 0">
        <div class="yx-card-head">
          <div>
            <h3>完成要求</h3>
            <div class="yx-card-note">把必须做和避免误杀的点说清楚</div>
          </div>
        </div>
        <div class="requirement-stack">
          <div class="requirement-item" v-for="(step, index) in requirementsList" :key="index">
            <div class="requirement-head">
              <span class="requirement-index">{{ index + 1 }}</span>
              <b>{{ step.title }}</b>
            </div>
            <small v-if="step.description">{{ step.description }}</small>
            <div class="yx-tag-row" style="margin-top:8px;" v-if="step.warning || step.tips || step.success">
              <span class="yx-tag coral" v-if="step.warning">⚠ {{ step.warning }}</span>
              <span class="yx-tag navy" v-if="step.tips">💡 {{ step.tips }}</span>
              <span class="yx-tag mint" v-if="step.success">✓ {{ step.success }}</span>
            </div>
          </div>
        </div>
      </section>

      <div class="yx-floating-action">
        <div class="yx-card action-card">
          <div v-if="task.isCompleted" class="status-pill done">✅ 任务已完成</div>
          <div v-else-if="task.isPending" class="status-pill pending">⏳ 审核中，请耐心等待</div>
          <button v-else-if="task.canSubmit && showClaimButton" class="yx-btn full" @click="goToSubmit">提交任务</button>
          <button v-else-if="(task.canClaim || !task.isClaimed) && showClaimButton" class="yx-btn full" @click="handleClaim" :disabled="claiming">
            {{ claiming ? '领取中...' : '领取任务' }}
          </button>
          <div v-if="!showClaimButton && isLoggedIn" class="role-tip">您当前角色为{{ getRoleName(user?.role) }}，无法领取任务</div>
        </div>
      </div>
    </div>

    <div class="yx-modal-preview" v-if="showPreview" @click="closePreview">
      <div class="yx-modal-card" @click.stop>
        <img :src="previewUrl" alt="预览" />
        <button class="yx-btn yx-modal-close" @click="closePreview">关闭</button>
      </div>
    </div>

    <div class="toast" v-if="toast.show">{{ toast.message }}</div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onActivated, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getTaskDetail, claimTask } from '../api/task'
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

const pureVideoLink = computed(() => {
  if (!task.value?.videoUrl) return ''
  const rawUrl = task.value.videoUrl
  if (rawUrl.includes('https://')) {
    const httpsIndex = rawUrl.indexOf('https://')
    const beforeHttps = rawUrl.substring(0, httpsIndex)
    const shareMatch = beforeHttps.match(/(\d+[\.\d]*\s*复制打开[^\n]*)$/)
    if (shareMatch) return shareMatch[1] + rawUrl.substring(httpsIndex)
    return rawUrl.substring(httpsIndex)
  }
  return rawUrl
})

const showNightUiWindow = computed(() => {
  const hour = new Date().getHours()
  return hour >= 0 && hour < 8
})

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
    return reqs.map((r) => typeof r === 'string' ? { title: r } : r)
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
    const res = await getTaskDetail(route.params.id)
    task.value = res
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
    showToast('领取成功，正在跳转到我的任务...')
    setTimeout(() => router.push('/my/tasks'), 1200)
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
  const map = { douyin: '抖音', kuaishou: '快手', xiaohongshu: '小红书', bilibili: 'B站', 抖音: '抖音', 快手: '快手', 小红书: '小红书', B站: 'B站' }
  return map[platform] || platform
}

const getActionName = () => '短视频体验官'

const getRoleName = (role) => {
  const map = { admin: '管理员', reviewer: '审核员', client: '发布者', part_timer: '体验官' }
  return map[role] || role
}

const previewImage = (url) => {
  previewUrl.value = url
  showPreview.value = true
}

const closePreview = () => {
  showPreview.value = false
  previewUrl.value = ''
}

const copyUrl = async () => {
  try {
    await navigator.clipboard.writeText(pureVideoLink.value)
    showToast('链接已复制')
  } catch (e) {
    showToast('复制失败，请手动复制')
  }
}

const showToast = (message) => {
  toast.message = message
  toast.show = true
  setTimeout(() => { toast.show = false }, 1800)
}

onMounted(fetchData)
onActivated(fetchData)
</script>

<style scoped>
.task-detail-page {
  padding-top: 18px;
}

.detail-title {
  margin: 0;
  font-size: 24px;
  line-height: 1.35;
  letter-spacing: -0.04em;
}

.detail-sub {
  margin: 10px 0 0;
  color: var(--yx-muted);
  line-height: 1.75;
  font-size: 13px;
}

.link-box {
  padding: 14px;
  border-radius: 18px;
  background: rgba(33,48,75,0.05);
  border: 1px solid rgba(33,48,75,0.06);
  word-break: break-all;
  color: var(--yx-deep);
  line-height: 1.7;
  font-size: 13px;
}

.detail-copy p {
  margin: 0 0 10px;
  color: var(--yx-muted);
  line-height: 1.8;
  font-size: 13px;
}

.detail-copy p:last-child {
  margin-bottom: 0;
}

.example-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.example-item {
  border: 1px solid var(--yx-line);
  background: rgba(255,255,255,0.78);
  border-radius: 18px;
  padding: 10px;
  text-align: left;
}

.example-item img {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: 14px;
  display: block;
  margin-bottom: 8px;
}

.example-item span {
  color: var(--yx-muted);
  font-size: 12px;
  line-height: 1.55;
}

.requirement-stack {
  display: grid;
  gap: 12px;
}

.requirement-item {
  padding: 14px;
  border-radius: 18px;
  background: rgba(33,48,75,0.04);
  border: 1px solid rgba(33,48,75,0.06);
}

.requirement-head {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 8px;
}

.requirement-index {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--yx-coral-soft);
  color: #be4d31;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
}

.requirement-item small {
  color: var(--yx-muted);
  line-height: 1.7;
}

.action-card {
  padding: 14px;
}

.status-pill {
  width: 100%;
  padding: 14px 16px;
  border-radius: 16px;
  text-align: center;
  font-weight: 800;
}

.status-pill.done {
  background: var(--yx-mint-soft);
  color: #216f59;
}

.status-pill.pending {
  background: var(--yx-gold-soft);
  color: #986000;
}

.role-tip {
  color: var(--yx-muted);
  font-size: 12px;
  line-height: 1.65;
  text-align: center;
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 32px;
  transform: translateX(-50%);
  padding: 12px 16px;
  background: rgba(30, 41, 64, 0.92);
  color: #fff;
  border-radius: 14px;
  font-size: 13px;
  z-index: 11000;
}
</style>
