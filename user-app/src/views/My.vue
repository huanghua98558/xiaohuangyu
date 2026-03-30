<template>
  <div class="yx-page my-page">
    <header class="yx-header">
      <div class="yx-header-main">
        <h1 class="yx-title">我的</h1>
        <p class="yx-subtitle">任务、积分和账户信息。</p>
      </div>
      <router-link to="/notifications" class="yx-icon-btn my-notify-btn">
        🔔
        <span v-if="unreadCount > 0" class="my-notify-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
      </router-link>
    </header>

    <section class="yx-hero-card" v-if="user">
      <div class="profile-row">
        <div class="profile-avatar">{{ user.username?.slice(0, 1)?.toUpperCase() || '我' }}</div>
        <div class="profile-main">
          <h2>{{ user.username }}</h2>
          <p>{{ getRoleName(user.role) }} · {{ levelInfo?.levelName || '体验官' }}</p>
        </div>

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
      <div class="yx-card-head-bar">
        <h3>未登录<span class="yx-card-note">登录后查看账户信息</span></h3>
      </div>
      <router-link to="/login" class="yx-btn full">立即登录</router-link>
    </section>

    <section class="yx-card" v-if="user">
      <div class="yx-card-head-bar">
        <h3>常用功能<span class="yx-card-note">常用入口</span></h3>
      </div>
      <div class="yx-promo-grid two">
        <router-link to="/sign-in" class="yx-promo-card my-feature-card feature-peach">
          <span class="my-feature-icon">📅</span>
          <b>每日签到</b>
          <small>{{ hasSignedToday ? '今日已签到' : '今天还没签到，可领积分' }}</small>
        </router-link>
        <router-link to="/achievements" class="yx-promo-card my-feature-card feature-blue">
          <span class="my-feature-icon">🏅</span>
          <b>我的成就</b>
          <small>{{ achievedCount }}/{{ totalAchievements }} 已解锁</small>
        </router-link>
        <router-link to="/invite" class="yx-promo-card my-feature-card feature-gold">
          <span class="my-feature-icon">🎁</span>
          <b>推广中心</b>
          <small>邀请好友、查看收益、复制邀请码</small>
        </router-link>
        <router-link to="/points" class="yx-promo-card my-feature-card feature-mint">
          <span class="my-feature-icon">💰</span>
          <b>积分明细</b>
          <small>查看到账记录、扣减、奖励和流水</small>
        </router-link>
      </div>
    </section>

    <section class="yx-card" v-if="user">
      <div class="yx-card-head-bar">
        <h3>我的服务<span class="yx-card-note">任务与账户</span></h3>
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
        <router-link to="/publisher/tasks" class="yx-menu-item" v-if="user?.role === 'admin'">
          <span class="yx-square-icon">📁</span>
          <div class="yx-list-main">
            <b>任务管理</b>
            <small>发布者 / 审核员 / 管理员入口</small>
          </div>
          <span class="yx-list-side">›</span>
        </router-link>
        <router-link to="/notification-settings" class="yx-menu-item">
          <span class="yx-square-icon">🔔</span>
          <div class="yx-list-main">
            <b>通知设置</b>
            <small>调整声音、审核提醒和积分提醒</small>
          </div>
          <span class="yx-list-side">›</span>
        </router-link>
        <router-link to="/account-security" class="yx-menu-item">
          <span class="yx-square-icon">🔐</span>
          <div class="yx-list-main">
            <b>账户安全</b>
            <small>修改手机号、登录密码</small>
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
      <div class="yx-card-head-bar">
        <h3>管理功能<span class="yx-card-note">审核与后台</span></h3>
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
        <router-link to="/admin/review" class="yx-menu-item" v-if="user?.role === 'reviewer'">
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
        <button type="button" class="legal-link-btn" @click="openLegal('agreement')">用户协议</button>
        <span>·</span>
        <button type="button" class="legal-link-btn" @click="openLegal('privacy')">隐私政策</button>
        <span>·</span>
        <button type="button" class="legal-link-btn" @click="openLegal('task-rules')">任务规范</button>
        <span>·</span>
        <router-link to="/pwa-guide">安装指南</router-link>
      </div>
      <button type="button" class="yx-btn-ghost full" style="margin-top:14px;" @click="handleLogout">退出登录</button>
    </section>

    <Teleport to="body">
      <div
        v-if="legalModal"
        class="legal-overlay"
        @click.self="legalModal = null"
      >
        <div class="legal-sheet" role="dialog" aria-modal="true" @click.stop>
          <div class="legal-sheet-head">
            <span>{{ legalTitle }}</span>
            <button type="button" class="legal-sheet-x" @click="legalModal = null" aria-label="关闭">×</button>
          </div>
          <div class="legal-sheet-body">
            <Agreement v-if="legalModal === 'agreement'" embedded />
            <Privacy v-else-if="legalModal === 'privacy'" embedded />
            <TaskRules v-else-if="legalModal === 'task-rules'" embedded />
          </div>
        </div>
      </div>
    </Teleport>

    
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated } from 'vue'
import { useRouter } from 'vue-router'
import Agreement from './Agreement.vue'
import Privacy from './Privacy.vue'
import TaskRules from './TaskRules.vue'
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

const achievementPercent = computed(() => {
  if (totalAchievements.value === 0) return 0
  return Math.round((achievedCount.value / totalAchievements.value) * 100)
})

const legalModal = ref(null)
const legalTitle = computed(() => {
  if (legalModal.value === 'agreement') return '用户协议'
  if (legalModal.value === 'privacy') return '隐私政策'
  if (legalModal.value === 'task-rules') return '任务规范'
  return ''
})
function openLegal(type) {
  legalModal.value = type
}

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
.legal-link-btn {
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  font: inherit;
  color: #5b6b7f;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.legal-overlay {
  position: fixed;
  inset: 0;
  z-index: 10050;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  box-sizing: border-box;
}
.legal-sheet {
  width: 100%;
  max-width: 480px;
  height: 50vh;
  max-height: 560px;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.legal-sheet-head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(31, 42, 65, 0.08);
  font-weight: 800;
  font-size: 16px;
  color: #1a2332;
}
.legal-sheet-x {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 12px;
  background: rgba(31, 42, 65, 0.06);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  color: #64748b;
}
.legal-sheet-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}
.legal-sheet-body :deep(.agreement-page),
.legal-sheet-body :deep(.privacy-page),
.legal-sheet-body :deep(.task-rules-page) {
  min-height: auto !important;
  background: #fff;
}
.legal-sheet-body :deep(.content-wrapper) {
  padding-bottom: 24px;
}

.my-page {
  padding-top: 0;
}

/* 简洁标题 */
.my-page .yx-header {
  padding: 10px 0 16px;
  margin-bottom: 14px;
  background: transparent;
  border-radius: 0;
  box-shadow: none;
  align-items: center;
}

.my-page .yx-header-main {
  flex: 1;
}

.my-page .yx-title {
  color: #1a2332;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0;
}

.my-page .yx-subtitle {
  color: #8b95a5;
  font-size: 12px;
  margin: 3px 0 0;
  font-weight: 500;
}

.my-page .yx-icon-btn {
  background: linear-gradient(135deg, #f26a4d 0%, #e55436 100%);
  color: #fff;
  border: none;
  min-width: 36px;
  height: 36px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(242, 106, 77, 0.25);
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

.my-page .my-notify-btn {
  position: relative;
}
.my-page .my-notify-badge {
  position: absolute;
  top: -5px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #ef4444;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.45);
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

.my-feature-card {
  position: relative;
  overflow: hidden;
  min-height: 112px;
  padding: 18px 16px;
  border-radius: 24px;
  border: 1px solid rgba(28, 43, 73, 0.08);
  box-shadow: 0 8px 24px rgba(19, 30, 48, 0.1);;
}

.my-feature-card::after {
  content: '';
  position: absolute;
  inset: auto -20px -24px auto;
  width: 78px;
  height: 78px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.34);
  filter: blur(2px);
}

.my-feature-icon {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  font-size: 20px;
  background: rgba(255, 255, 255, 0.7);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.55);
}

.my-feature-card b,
.my-feature-card small {
  position: relative;
  z-index: 1;
}

.feature-peach {
  background: linear-gradient(135deg, #fff5f2 0%, #ffe8e0 100%);
  background: linear-gradient(135deg, rgba(255, 239, 228, 0.98), rgba(255, 225, 207, 0.94));
}

.feature-blue {
  background: linear-gradient(135deg, #f0f7ff 0%, #e0efff 100%);
  background: linear-gradient(135deg, rgba(231, 241, 255, 0.98), rgba(214, 230, 255, 0.95));
}

.feature-gold {
  background: linear-gradient(135deg, #fffbf0 0%, #fff3d6 100%);
  background: linear-gradient(135deg, rgba(255, 245, 214, 0.98), rgba(255, 231, 177, 0.94));
}

.feature-mint {
  background: linear-gradient(135deg, #f0fdf9 0%, #d9faef 100%);
  background: linear-gradient(135deg, rgba(230, 248, 240, 0.98), rgba(208, 239, 226, 0.94));
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
