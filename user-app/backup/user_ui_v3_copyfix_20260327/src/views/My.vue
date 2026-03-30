<template>
  <div class="yx-page my-page">
    <header class="yx-header">
      <div class="yx-header-main">
        <span class="yx-eyebrow">我的账户</span>
        <h1 class="yx-title">把积分、成长和服务放在一页</h1>
        <p class="yx-subtitle">这一页不再碎成很多块，而是先看账户总览，再进入我的任务、消息、签到、成就、推广和提现。</p>
      </div>
      <router-link to="/notifications" class="yx-icon-btn">🔔</router-link>
    </header>

    <section class="yx-hero-card" v-if="user">
      <div class="profile-row">
        <div class="profile-avatar">{{ user.username?.slice(0, 1)?.toUpperCase() || '我' }}</div>
        <div class="profile-main">
          <h2>{{ user.username }}</h2>
          <p>{{ getRoleName(user.role) }} · {{ levelInfo?.levelName || '体验官' }}</p>
        </div>
        <div class="notify-badge" v-if="unreadCount > 0">{{ unreadCount > 99 ? '99+' : unreadCount }}</div>
      </div>

      <div class="yx-summary-grid two" style="margin-top:14px;">
        <div class="yx-stat-card">
          <strong>{{ points }}</strong>
          <span>总积分</span>
        </div>
        <div class="yx-stat-card">
          <strong>¥{{ balance }}</strong>
          <span>可提现余额</span>
        </div>
        <div class="yx-stat-card">
          <strong>{{ totalTasks }}</strong>
          <span>累计完成任务</span>
        </div>
        <div class="yx-stat-card">
          <strong>{{ achievementPercent }}%</strong>
          <span>成就解锁进度</span>
        </div>
      </div>
    </section>

    <section class="yx-card" v-else>
      <div class="yx-card-head">
        <div>
          <h3>未登录</h3>
          <div class="yx-card-note">登录后查看积分、任务、成长和消息</div>
        </div>
      </div>
      <router-link to="/login" class="yx-btn full">立即登录</router-link>
    </section>

    <section class="yx-card" v-if="user">
      <div class="yx-card-head">
        <div>
          <h3>成长入口</h3>
          <div class="yx-card-note">高频动作放在最前面</div>
        </div>
      </div>
      <div class="yx-promo-grid two">
        <router-link to="/sign-in" class="yx-promo-card">
          <b>每日签到</b>
          <small>{{ hasSignedToday ? '今日已签到' : '今天还没签到，可领积分' }}</small>
        </router-link>
        <router-link to="/achievements" class="yx-promo-card">
          <b>我的成就</b>
          <small>{{ achievedCount }}/{{ totalAchievements }} 已解锁</small>
        </router-link>
        <router-link to="/invite" class="yx-promo-card">
          <b>推广中心</b>
          <small>邀请好友、查看收益、复制邀请码</small>
        </router-link>
        <router-link to="/notification-settings" class="yx-promo-card">
          <b>通知设置</b>
          <small>调整声音、审核提醒和积分提醒</small>
        </router-link>
      </div>
    </section>

    <section class="yx-card" v-if="user">
      <div class="yx-card-head">
        <div>
          <h3>我的服务</h3>
          <div class="yx-card-note">主功能全部集中，少来回找入口</div>
        </div>
      </div>
      <div class="yx-menu-list">
        <router-link to="/my/tasks" class="yx-menu-item" v-if="user?.role === 'part_timer' || user?.role === 'admin'">
          <span class="yx-square-icon">📋</span>
          <div class="yx-list-main">
            <b>我的任务</b>
            <small>处理中、待审核、已完成、退回重做</small>
          </div>
          <span class="yx-list-side">›</span>
        </router-link>
        <router-link to="/publisher/tasks" class="yx-menu-item" v-if="user?.role === 'admin' || user?.role === 'client' || user?.role === 'reviewer'">
          <span class="yx-square-icon">📁</span>
          <div class="yx-list-main">
            <b>任务管理</b>
            <small>发布者 / 审核员 / 管理员入口</small>
          </div>
          <span class="yx-list-side">›</span>
        </router-link>
        <router-link to="/points" class="yx-menu-item">
          <span class="yx-square-icon">💰</span>
          <div class="yx-list-main">
            <b>积分明细</b>
            <small>查看到账记录、扣减、奖励和流水</small>
          </div>
          <span class="yx-list-side">›</span>
        </router-link>
        <router-link to="/withdraw" class="yx-menu-item">
          <span class="yx-square-icon">💵</span>
          <div class="yx-list-main">
            <b>提现中心</b>
            <small>申请提现、查看待打款状态</small>
          </div>
          <span class="yx-list-side">›</span>
        </router-link>
        <router-link to="/rank" class="yx-menu-item">
          <span class="yx-square-icon">🏆</span>
          <div class="yx-list-main">
            <b>排行榜</b>
            <small>查看总排行和今日排行</small>
          </div>
          <span class="yx-list-side">›</span>
        </router-link>
        <router-link to="/ai-assistant" class="yx-menu-item" v-if="user?.role === 'admin' || user?.role === 'client' || user?.role === 'reviewer'">
          <span class="yx-square-icon">🤖</span>
          <div class="yx-list-main">
            <b>AI 助手</b>
            <small>管理端辅助功能入口</small>
          </div>
          <span class="yx-list-side">›</span>
        </router-link>
      </div>
    </section>

    <section class="yx-card" v-if="isPublisher">
      <div class="yx-card-head">
        <div>
          <h3>管理功能</h3>
          <div class="yx-card-note">管理员和发布者入口单独收纳</div>
        </div>
      </div>
      <div class="yx-menu-list">
        <router-link to="/publish" class="yx-menu-item">
          <span class="yx-square-icon">📝</span>
          <div class="yx-list-main">
            <b>发布任务</b>
            <small>新建任务并查看投放情况</small>
          </div>
          <span class="yx-list-side">›</span>
        </router-link>
        <router-link to="/admin/review" class="yx-menu-item" v-if="isAdminOrReviewer">
          <span class="yx-square-icon">🔐</span>
          <div class="yx-list-main">
            <b>审核入口</b>
            <small>移动端进入审核相关页面</small>
          </div>
          <span class="yx-list-side">›</span>
        </router-link>
        <router-link to="/admin/notifications" class="yx-menu-item" v-if="user?.role === 'admin'">
          <span class="yx-square-icon">🔔</span>
          <div class="yx-list-main">
            <b>管理员通知</b>
            <small>查看管理员专属消息</small>
          </div>
          <span class="yx-list-side">›</span>
        </router-link>
        <router-link to="/admin/alerts" class="yx-menu-item" v-if="user?.role === 'admin'">
          <span class="yx-square-icon">🚨</span>
          <div class="yx-list-main">
            <b>管理员告警</b>
            <small>查看系统异常与人工待处理</small>
          </div>
          <span class="yx-list-side">›</span>
        </router-link>
        <a :href="adminUrl" class="yx-menu-item" v-if="user?.role === 'admin'">
          <span class="yx-square-icon">🎛️</span>
          <div class="yx-list-main">
            <b>管理后台</b>
            <small>进入 Web 管理后台</small>
          </div>
          <span class="yx-list-side">›</span>
        </a>
      </div>
    </section>

    <section class="yx-soft-card" v-if="user">
      <div class="legal-links">
        <a href="javascript:void(0)" @click.prevent="openLegal('agreement')">用户协议</a>
        <span>·</span>
        <a href="javascript:void(0)" @click.prevent="openLegal('privacy')">隐私政策</a>
        <span>·</span>
        <a href="javascript:void(0)" @click.prevent="openLegal('task-rules')">任务规范</a>
        <span>·</span>
        <router-link to="/pwa-guide">安装指南</router-link>
      </div>
      <button type="button" class="yx-btn-ghost full" style="margin-top:14px;" @click="handleLogout">退出登录</button>
    </section>

    <Teleport to="body">
      <Transition name="modal">
        <div class="legal-modal-overlay" v-if="showLegalModal" @click.self="closeLegal">
          <div class="legal-modal">
            <div class="legal-modal-header">
              <h3 class="legal-modal-title">{{ legalTitle }}</h3>
              <button class="legal-modal-close" @click="closeLegal">✕</button>
            </div>
            <div class="legal-modal-body">
              <div class="legal-content" v-html="legalContent"></div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../store/auth'
import { getWallet, getMyLevel } from '../api/task'
import { fetchUnreadCount } from '../api/notification'
import { getSignInStatus } from '../api/signIn'
import { getAchievementStats } from '../api/achievement'

const router = useRouter()
const { user, isAdminOrReviewer, isPublisher, logout } = useAuth()
const points = ref(0)
const balance = ref('0.00')
const totalTasks = ref(0)
const levelInfo = ref(null)
const unreadCount = ref(0)
const hasSignedToday = ref(false)
const achievedCount = ref(0)
const totalAchievements = ref(0)

const showLegalModal = ref(false)
const currentLegal = ref('')

const legalTitle = computed(() => {
  const titles = {
    agreement: '用户协议',
    privacy: '隐私政策',
    'task-rules': '任务规范'
  }
  return titles[currentLegal.value] || ''
})

const legalContents = {
  agreement: '<div class="legal-section"><h4>小黄鱼任务中心用户协议</h4><p class="update-date">更新日期：2026年3月15日</p><p>用户在使用平台服务前，应仔细阅读并同意相关服务条款。</p></div>',
  privacy: '<div class="legal-section"><h4>小黄鱼任务中心隐私政策</h4><p class="update-date">更新日期：2026年3月15日</p><p>我们会依法收集、使用并保护您的个人信息，用于提供、维护和改进服务。</p></div>',
  'task-rules': '<div class="legal-section"><h4>小黄鱼任务中心任务规范</h4><p class="update-date">更新日期：2026年3月15日</p><p>请按任务要求真实完成体验、上传双图并等待系统审核。</p></div>'
}

const legalContent = computed(() => legalContents[currentLegal.value] || '')

const achievementPercent = computed(() => {
  if (totalAchievements.value === 0) return 0
  return Math.round((achievedCount.value / totalAchievements.value) * 100)
})

const adminUrl = '/admin/login/'

function getRoleName(role) {
  const map = {
    admin: '管理员',
    client: '发布者',
    reviewer: '审核员',
    part_timer: '体验官'
  }
  return map[role] || role
}

function openLegal(type) {
  currentLegal.value = type
  showLegalModal.value = true
  document.body.style.overflow = 'hidden'
}

function closeLegal() {
  showLegalModal.value = false
  document.body.style.overflow = ''
}

async function load() {
  try {
    const w = await getWallet()
    points.value = w.points || 0
    balance.value = String(w.balance !== null && w.balance !== undefined ? w.balance : 0)
  } catch (e) {
    points.value = 0
    balance.value = '0.00'
  }

  if (user.value) {
    try {
      const level = await getMyLevel()
      levelInfo.value = level
      totalTasks.value = level.totalTasks || 0
    } catch (e) {}

    try {
      unreadCount.value = await fetchUnreadCount()
    } catch (e) {}

    try {
      const signInData = await getSignInStatus()
      hasSignedToday.value = signInData.hasSignedToday
    } catch (e) {}

    try {
      const achievementData = await getAchievementStats()
      achievedCount.value = achievementData.achieved
      totalAchievements.value = achievementData.total
    } catch (e) {}
  }
}

function handleLogout() {
  logout()
  router.push('/login')
}

onMounted(load)
onActivated(load)
</script>

<style scoped>
.my-page {
  padding-top: 18px;
}

.profile-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.profile-avatar {
  width: 58px;
  height: 58px;
  flex-shrink: 0;
  border-radius: 20px;
  background: linear-gradient(135deg, #24344d, #31496f);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 24px;
  font-weight: 800;
}

.profile-main {
  flex: 1;
  min-width: 0;
}

.profile-main h2 {
  margin: 0;
  font-size: 24px;
  letter-spacing: -0.04em;
}

.profile-main p {
  margin: 8px 0 0;
  color: var(--yx-muted);
  font-size: 13px;
}

.notify-badge {
  min-width: 34px;
  height: 34px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(255,255,255,0.28);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
}

.legal-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  color: var(--yx-muted);
  font-size: 12px;
}

.legal-links a {
  color: var(--yx-muted);
}

.legal-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(18, 24, 36, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  z-index: 10000;
}

.legal-modal {
  width: min(100%, 380px);
  max-height: 80vh;
  overflow: auto;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 28px 60px rgba(11, 16, 28, 0.32);
}

.legal-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 18px 0;
}

.legal-modal-title {
  margin: 0;
  font-size: 18px;
}

.legal-modal-close {
  border: none;
  background: rgba(33,48,75,0.06);
  width: 34px;
  height: 34px;
  border-radius: 12px;
}

.legal-modal-body {
  padding: 16px 18px 20px;
}

.legal-content {
  color: var(--yx-muted);
  line-height: 1.8;
  font-size: 13px;
}

.legal-content h4,
.legal-content h5 {
  color: var(--yx-ink);
  margin: 12px 0 8px;
}

.update-date {
  color: var(--yx-muted);
  font-size: 12px;
}
</style>
