<template>
  <div class="yx-page no-tabbar task-detail-page">
    <header class="yx-header center">
      <button class="yx-back-btn" @click="$router.back()">←</button>
      <div class="yx-header-main">
        <h1 class="yx-title sm">任务详情</h1>
        <p class="yx-subtitle">查看要求后领取或提交。</p>
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
          <span class="yx-tag gold" v-if="task.isNightBonusTask">夜间 x{{ Number(task.nightCoefficient || 1).toFixed(2) }}</span>
        </div>
        <h2 class="detail-title">{{ task.title }}</h2>
        <p class="detail-sub">{{ task.description || '按要求完成体验后上传两张截图。' }}</p>
        <div class="yx-summary-grid three" style="margin-top:14px;">
          <div class="yx-stat-card" :class="{ 'has-bonus': task.isNightBonusTask }">
            <template v-if="task.isNightBonusTask">
              <strong class="reward-with-bonus" :class="{ 'count-pop': rewardPop }">{{ displayRewardBase }} +{{ displayRewardBonus }}</strong>
              <span>积分 (基础+夜间)</span>
            </template>
            <template v-else>
              <strong :class="{ 'count-pop': rewardPop }">{{ displayRewardBase }}</strong>
              <span>积分奖励</span>
            </template>
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
        <div class="yx-card-head-bar">
          <h3>任务概览<span class="yx-card-note">先看概览，再按标准执行</span></h3>
        </div>
        <div class="detail-copy">
          <p v-for="(line, index) in descriptionLines" :key="index">{{ line }}</p>
        </div>
      </section>

      <section class="yx-card tutorial-card" v-if="qualificationStandards.length > 0">
        <div class="yx-card-head-bar">
          <h3>任务合格标准说明<span class="yx-card-note">提交前逐项自查</span></h3>
        </div>
        <div class="tutorial-tip-box">
          <strong>提交前重点检查：</strong>
          <span>视频截图、评论截图、点赞收藏、本人评论、评论字数和内容导向都要同时满足。</span>
        </div>
        <div class="tutorial-standard-list">
          <div class="tutorial-standard-item" v-for="(item, index) in qualificationStandards" :key="item + index">
            <span class="tutorial-standard-index">{{ index + 1 }}</span>
            <p>{{ item }}</p>
          </div>
        </div>
      </section>

      <section class="yx-card tutorial-card" v-if="positiveCommentExamples.length > 0">
        <div class="yx-card-head-bar">
          <h3>正向推荐评论示例<span class="yx-card-note">点一条，直接复制</span></h3>
        </div>
        <div class="comment-example-grid">
          <button
            class="comment-example-item"
            v-for="(item, index) in positiveCommentExamples"
            :key="item + index"
            @click="copyComment(item)"
          >
            <span class="comment-example-copy">点击复制</span>
            <span>{{ item }}</span>
          </button>
        </div>
      </section>

      <section class="yx-card tutorial-card" v-if="commentLibrary.length > 0">
        <div class="yx-card-head-bar">
          <h3>参考评论库<span class="yx-card-note">共 {{ commentLibrary.length }} 条，点哪条复制哪条</span></h3>
        </div>
        <div class="comment-library-entry">
          <div class="comment-library-copy-tip">{{ tutorialCopyTip }}</div>
          <button class="yx-btn full" @click="openCommentLibrary">打开参考评论库</button>
        </div>
      </section>

      <section class="yx-card" v-if="exampleImages && exampleImages.length">
        <div class="yx-card-head-bar">
          <h3>示范图片<span class="yx-card-note">点击放大查看</span></h3>
        </div>
        <div class="example-grid">
          <button class="example-item" v-for="(img, i) in exampleImages" :key="i" @click="previewImage(img)">
            <img :src="img" :alt="'示范图片' + (i + 1)" />
            <span>示例 {{ i + 1 }}</span>
          </button>
        </div>
      </section>

      <section class="yx-card" v-if="requirementsList.length > 0">
        <div class="yx-card-head-bar">
          <h3>完成要求<span class="yx-card-note">按顺序完成并核对</span></h3>
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

    <div class="yx-modal-preview" v-if="showCommentLibrary" @click="closeCommentLibrary">
      <div class="yx-modal-card comment-library-modal" @click.stop>
        <div class="comment-library-header">
          <h3>参考评论库（详细）</h3>
          <p>{{ tutorialCopyTip }}</p>
        </div>
        <div class="comment-library-list">
          <button
            class="comment-library-item"
            v-for="(item, index) in commentLibrary"
            :key="item + index"
            @click="copyComment(item)"
          >
            <span class="comment-library-index">{{ index + 1 }}</span>
            <span class="comment-library-text">{{ item }}</span>
          </button>
        </div>
        <button class="yx-btn yx-modal-close" @click="closeCommentLibrary">关闭</button>
      </div>
    </div>

    <div class="toast" v-if="toast.show">{{ toast.message }}</div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onActivated, onUnmounted, computed, watch } from 'vue'
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
const displayRewardBase = ref(0)
const displayRewardBonus = ref(0)
const rewardPop = ref(false)
let rewardAnimTimer = null

function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3)
}

function animateNumber(from, to, setter, duration = 520) {
  const start = performance.now()
  const diff = to - from
  const tick = (now) => {
    const p = Math.min(1, (now - start) / duration)
    const v = Math.round(from + diff * easeOutCubic(p))
    setter(v)
    if (p < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

const toast = reactive({ show: false, message: '' })
const exampleImages = ref([])
const showPreview = ref(false)
const previewUrl = ref('')
const showCommentLibrary = ref(false)

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

const descriptionLines = computed(() => {
  if (!task.value?.description) return []
  return task.value.description.split('\n').filter(line => line.trim())
})

const normalizeStringList = (source) => {
  if (!Array.isArray(source)) return []
  return source.map((item) => String(item || '').trim()).filter(Boolean)
}

const tutorialConfig = computed(() => task.value?.tutorialConfig || null)

const qualificationStandards = computed(() =>
  normalizeStringList(tutorialConfig.value?.qualificationStandards)
)

const positiveCommentExamples = computed(() =>
  normalizeStringList(tutorialConfig.value?.positiveCommentExamples)
)

const commentLibrary = computed(() =>
  normalizeStringList(tutorialConfig.value?.commentLibrary)
)

const tutorialCopyTip = computed(() =>
  String(
    tutorialConfig.value?.copyTip ||
    '点击哪条评论，就会复制哪条评论。请选择与视频产品更相关、字数更完整的内容。'
  ).trim()
)

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


const getBaseReward = (tk) => {
  if (!tk) return 0
  return Number((tk.baseReward ?? tk?.settlementPreview?.basePoints ?? tk.base_reward ?? tk.reward ?? tk.estimatedReward) || 0)
}

const getBonusReward = (tk) => {
  const apiBonus = Number(tk?.nightBonusPoints ?? tk?.settlementPreview?.bonusPoints)
  if (tk?.isNightBonusTask && Number.isFinite(apiBonus) && apiBonus > 0) {
    return Math.round(apiBonus * 10) / 10
  }
  const base = Number((tk?.baseReward ?? tk?.reward ?? tk?.base_reward) || 0)
  const c = Number((tk?.nightCoefficient ?? tk?.settlementPreview?.coefficient) || 1)
  if (c <= 1) return 0
  return Math.round(Math.max(0, base * (c - 1)) * 10) / 10
}

const syncRewardDisplays = () => {
  if (!task.value) return
  const base = getBaseReward(task.value)
  const bonus = task.value.isNightBonusTask ? getBonusReward(task.value) : 0
  displayRewardBase.value = base
  displayRewardBonus.value = bonus
}

watch(
  () => [
    task.value?.id,
    task.value?.reward,
    task.value?.base_reward,
    task.value?.nightCoefficient,
    task.value?.isNightBonusTask,
  ],
  () => syncRewardDisplays(),
  { immediate: true }
)

const showClaimButton = computed(() => {
  return user.value?.role === 'part_timer' || user.value?.role === 'admin' || !isLoggedIn.value
})

const fetchData = async () => {
  try {
    loading.value = true
    error.value = ''
    const res = await getTaskDetail(route.params.id)
    if (res?.shouldRedirectToMyTask && res?.redirectToClaimId) {
      showToast('该任务已进入我的任务，正在为你跳转...')
      router.replace(`/my/task/${res.redirectToClaimId}`)
      return
    }
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
    rewardPop.value = true
    if (rewardAnimTimer) clearTimeout(rewardAnimTimer)
    rewardAnimTimer = setTimeout(() => {
      rewardPop.value = false
    }, 650)
    const base = getBaseReward(task.value)
    const bonus = task.value.isNightBonusTask ? getBonusReward(task.value) : 0
    displayRewardBase.value = 0
    displayRewardBonus.value = 0
    animateNumber(0, base, (v) => {
      displayRewardBase.value = v
    })
    animateNumber(0, bonus, (v) => {
      displayRewardBonus.value = v
    })
    showToast('领取成功，正在跳转到我的任务...')
    setTimeout(() => router.push({ path: '/my/tasks', query: { tab: 'doing' } }), 1200)
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

const openCommentLibrary = () => {
  showCommentLibrary.value = true
}

const closeCommentLibrary = () => {
  showCommentLibrary.value = false
}

const copyUrl = async () => {
  try {
    await navigator.clipboard.writeText(pureVideoLink.value)
    showToast('链接已复制')
  } catch (e) {
    showToast('复制失败，请手动复制')
  }
}

const copyComment = async (content) => {
  try {
    await navigator.clipboard.writeText(content)
    showToast('评论已复制，可直接去粘贴')
  } catch (e) {
    showToast('复制失败，请手动长按复制')
  }
}

const showToast = (message) => {
  toast.message = message
  toast.show = true
  setTimeout(() => { toast.show = false }, 1800)
}

onUnmounted(() => {
  if (rewardAnimTimer) clearTimeout(rewardAnimTimer)
})
onMounted(fetchData)
onActivated(fetchData)
</script>

<style scoped>
.task-detail-page {
  padding-top: 18px;
  padding-bottom: 128px;
}

.yx-stat-card.has-bonus {
  background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
  border-color: rgba(251, 146, 60, 0.2);
}

.reward-with-bonus {
  color: #ea580c;
}

.detail-title {
  margin: 0;
  font-size: 24px;
  line-height: 1.3;
  letter-spacing: -0.04em;
}

.detail-sub {
  margin: 8px 0 0;
  color: var(--yx-muted);
  line-height: 1.6;
  font-size: 15px;
}

.link-box {
  padding: 12px;
  border-radius: 16px;
  background: rgba(33,48,75,0.05);
  border: 1px solid rgba(33,48,75,0.06);
  word-break: break-all;
  color: var(--yx-deep);
  line-height: 1.6;
  font-size: 14px;
}

.detail-copy p {
  margin: 0 0 8px;
  color: var(--yx-muted);
  line-height: 1.7;
  font-size: 15px;
}

.detail-copy p:last-child {
  margin-bottom: 0;
}

.tutorial-card {
  background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,248,240,0.98) 100%);
}

.tutorial-tip-box {
  display: grid;
  gap: 4px;
  padding: 12px;
  margin-bottom: 12px;
  border-radius: 16px;
  background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
  border: 1px solid rgba(249, 115, 22, 0.16);
}

.tutorial-tip-box strong {
  color: #c2410c;
  font-size: 14px;
}

.tutorial-tip-box span {
  color: #7c2d12;
  line-height: 1.7;
  font-size: 14px;
}

.tutorial-standard-list {
  display: grid;
  gap: 10px;
}

.tutorial-standard-item {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 10px;
  align-items: start;
  padding: 12px;
  border-radius: 16px;
  background: rgba(255,255,255,0.88);
  border: 1px solid rgba(249, 115, 22, 0.1);
}

.tutorial-standard-index {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fb923c;
  color: #fff;
  font-size: 12px;
  font-weight: 800;
}

.tutorial-standard-item p {
  margin: 0;
  color: var(--yx-deep);
  line-height: 1.7;
  font-size: 15px;
}

.comment-example-grid {
  display: grid;
  gap: 10px;
}

.comment-example-item {
  display: grid;
  gap: 8px;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid rgba(33,48,75,0.08);
  background: rgba(255,255,255,0.88);
  text-align: left;
  font-size: 15px;
  line-height: 1.65;
}

.comment-example-copy {
  display: inline-flex;
  width: fit-content;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(242, 106, 77, 0.12);
  color: #c2410c;
  font-size: 12px;
  font-weight: 700;
}

.comment-library-entry {
  display: grid;
  gap: 12px;
}

.comment-library-copy-tip {
  padding: 12px;
  border-radius: 16px;
  background: rgba(33,48,75,0.05);
  border: 1px solid rgba(33,48,75,0.06);
  color: var(--yx-deep);
  line-height: 1.7;
  font-size: 14px;
}

.comment-library-modal {
  max-height: min(78vh, 720px);
  overflow: auto;
}

.comment-library-header {
  display: grid;
  gap: 6px;
  margin-bottom: 14px;
}

.comment-library-header h3 {
  margin: 0;
  font-size: 18px;
}

.comment-library-header p {
  margin: 0;
  color: var(--yx-muted);
  line-height: 1.65;
  font-size: 14px;
}

.comment-library-list {
  display: grid;
  gap: 12px;
  margin-bottom: 14px;
}

.comment-library-item {
  display: grid;
  grid-template-columns: 32px 1fr;
  gap: 10px;
  align-items: start;
  width: 100%;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid rgba(33,48,75,0.08);
  background: rgba(255,255,255,0.9);
  text-align: left;
}

.comment-library-index {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(242, 106, 77, 0.12);
  color: #c2410c;
  font-size: 12px;
  font-weight: 800;
}

.comment-library-text {
  color: var(--yx-deep);
  line-height: 1.7;
  font-size: 15px;
}

.example-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.example-item {
  border: 1px solid var(--yx-line);
  background: rgba(255,255,255,0.78);
  border-radius: 16px;
  padding: 9px;
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
  font-size: 14px;
  line-height: 1.55;
}

.requirement-stack {
  display: grid;
  gap: 8px;
}

.requirement-item {
  padding: 12px;
  border-radius: 16px;
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
  font-size: 14px;
}

.requirement-head b {
  font-size: 15px;
}

.action-card {
  padding: 14px;
  box-shadow: 0 18px 34px rgba(24, 36, 58, 0.14);
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
  font-size: 13px;
  line-height: 1.65;
  text-align: center;
}

.task-detail-page :deep(.yx-floating-action) {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  width: min(460px, calc(100vw - 20px));
  bottom: calc(env(safe-area-inset-bottom, 0px) + 12px);
  margin-top: 0;
  z-index: 24;
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
  font-size: 14px;
  z-index: 11000;
}

.reward-with-bonus.count-pop,
strong.count-pop {
  animation: rewardCountPop 0.65s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes rewardCountPop {
  0% { transform: scale(1); filter: brightness(1); }
  40% { transform: scale(1.08); filter: brightness(1.08); }
  100% { transform: scale(1); filter: brightness(1); }
}

</style>
