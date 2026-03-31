<template>
  <div class="my">
    <!-- 合并后的用户信息卡片 - 全宽 -->
    <div class="card-wrapper">
      <UserProfileCard
        v-if="user"
        :username="user.username"
        :role="user.role"
        :levelInfo="levelInfo"
        :points="points"
        :balance="balance"
        :totalTasks="totalTasks"
      >
        <template #action>
          <router-link to="/notifications" class="notification-btn">
            <span class="notification-icon">🔔</span>
            <span class="notification-badge" v-if="unreadCount > 0">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
          </router-link>
        </template>
      </UserProfileCard>
    </div>
    
    <!-- 未登录状态 -->
    <div class="card-wrapper" v-if="!user">
      <header class="user-card">
        <div class="avatar">👤</div>
        <div class="info">
          <div class="name">未登录</div>
          <div class="level">请登录以查看更多信息</div>
        </div>
        <router-link to="/login" class="login-btn">登录</router-link>
      </header>
    </div>
    
    <!-- 内容区域 - 统一边距 -->
    <div class="content-area" v-if="user">
      <!-- 快捷功能入口 -->
      <section class="quick-actions">
        <div class="section-title">快捷功能</div>
        <div class="quick-cards">
          <!-- 推广中心 - 第一位，更显眼 -->
          <router-link to="/invite" class="quick-item promote-item">
            <div class="quick-icon promote-icon">🎁</div>
            <div class="quick-info">
              <span class="quick-name">推广中心</span>
              <span class="quick-desc promote-desc">邀请好友赚积分</span>
            </div>
            <div class="promote-badge">HOT</div>
          </router-link>
          
          <router-link to="/sign-in" class="quick-item" :class="{ 'has-badge': !hasSignedToday }">
            <div class="quick-icon">📅</div>
            <div class="quick-info">
              <span class="quick-name">每日签到</span>
              <span class="quick-desc" v-if="!hasSignedToday">+3积分</span>
              <span class="quick-desc done" v-else>已签到</span>
            </div>
            <div class="quick-badge" v-if="!hasSignedToday">GO</div>
          </router-link>
          
          <router-link to="/achievements" class="quick-item">
            <div class="quick-icon">🏆</div>
            <div class="quick-info">
              <span class="quick-name">我的成就</span>
              <span class="quick-desc">{{ achievedCount }}/{{ totalAchievements }} 已解锁</span>
            </div>
            <div class="quick-arrow">›</div>
          </router-link>
        </div>
      </section>
      
      <!-- 功能菜单 -->
      <section class="menu-section">
        <div class="section-title">我的服务</div>
        <div class="menu-list">
          <!-- 我的任务：体验官和管理员都显示 -->
          <router-link to="/my/tasks" class="menu-item" v-if="user?.role === 'part_timer' || user?.role === 'admin'">
            <div class="menu-left">
              <span class="menu-icon">📋</span>
              <span class="menu-text">我的任务</span>
            </div>
            <span class="menu-arrow">›</span>
          </router-link>
          <!-- 任务管理：发布者、审核员、管理员显示 -->
          <router-link to="/publisher/tasks" class="menu-item" v-if="user?.role === 'admin' || user?.role === 'client' || user?.role === 'reviewer'">
            <div class="menu-left">
              <span class="menu-icon">📁</span>
              <span class="menu-text">任务管理</span>
            </div>
            <span class="menu-arrow">›</span>
          </router-link>
          <router-link to="/points" class="menu-item">
            <div class="menu-left">
              <span class="menu-icon">💰</span>
              <span class="menu-text">积分明细</span>
            </div>
            <span class="menu-arrow">›</span>
          </router-link>
          <router-link to="/withdraw" class="menu-item">
            <div class="menu-left">
              <span class="menu-icon">💵</span>
              <span class="menu-text">提现中心</span>
            </div>
            <span class="menu-arrow">›</span>
          </router-link>
          <router-link to="/rank" class="menu-item">
            <div class="menu-left">
              <span class="menu-icon">📊</span>
              <span class="menu-text">排行榜</span>
            </div>
            <span class="menu-arrow">›</span>
          </router-link>
          <!-- AI助手 - 仅发布者、审核员、管理员可见 -->
          <router-link to="/ai-assistant" class="menu-item ai-item" v-if="user?.role === 'admin' || user?.role === 'client' || user?.role === 'reviewer'">
            <div class="menu-left">
              <span class="menu-icon">🤖</span>
              <span class="menu-text">AI助手</span>
            </div>
            <span class="menu-badge">NEW</span>
          </router-link>
        </div>
      </section>
      
      <!-- 管理功能 -->
      <section class="menu-section admin-section" v-if="isPublisher">
        <div class="section-title">管理功能</div>
        <div class="menu-list">
          <router-link to="/publish" class="menu-item highlight">
            <div class="menu-left">
              <span class="menu-icon">📝</span>
              <span class="menu-text">发布任务</span>
            </div>
            <span class="menu-arrow">›</span>
          </router-link>
          <router-link to="/admin/review" class="menu-item highlight" v-if="isAdminOrReviewer">
            <div class="menu-left">
              <span class="menu-icon">🔐</span>
              <span class="menu-text">审核入口</span>
            </div>
            <span class="menu-arrow">›</span>
          </router-link>
          <a :href="adminUrl" class="menu-item highlight" v-if="user && user.role === 'admin'">
            <div class="menu-left">
              <span class="menu-icon">🎛️</span>
              <span class="menu-text">管理后台</span>
            </div>
            <span class="menu-arrow">›</span>
          </a>
        </div>
      </section>
      
      <!-- 底部 - 改为点击打开弹窗 -->
      <section class="legal">
        <a href="javascript:void(0)" @click.prevent="openLegal('agreement')">用户协议</a>
        <span class="divider">|</span>
        <a href="javascript:void(0)" @click.prevent="openLegal('privacy')">隐私政策</a>
        <span class="divider">|</span>
        <a href="javascript:void(0)" @click.prevent="openLegal('task-rules')">任务规范</a>
        <span class="divider">|</span>
        <router-link to="/pwa-guide">安装指南</router-link>
      </section>
      
      <div class="logout-section">
        <button type="button" class="btn-logout" @click="handleLogout">退出登录</button>
      </div>
    </div>
    
    <!-- 协议弹窗 -->
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
import UserProfileCard from '../components/UserProfileCard.vue'

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

// 协议弹窗状态
const showLegalModal = ref(false)
const currentLegal = ref('')

const legalTitle = computed(() => {
  const titles = {
    'agreement': '用户协议',
    'privacy': '隐私政策',
    'task-rules': '任务规范'
  }
  return titles[currentLegal.value] || ''
})

// 协议内容
const legalContents = {
  'agreement': `
    <div class="legal-section">
      <h4>小黄鱼任务中心用户协议</h4>
      <p class="update-date">更新日期：2026年3月15日</p>
      <p class="update-date">生效日期：2026年3月15日</p>
    </div>
    <div class="legal-section">
      <h5>一、服务条款的确认和接纳</h5>
      <p>1.1 小黄鱼任务中心的各项服务的所有权和运营权归小黄鱼任务中心所有。</p>
      <p>1.2 用户在使用小黄鱼任务中心提供的各项服务之前，应仔细阅读本服务协议。</p>
      <p>1.3 用户一旦注册使用小黄鱼任务中心的服务，即视为用户已了解并完全同意本服务协议各项内容。</p>
    </div>
    <div class="legal-section">
      <h5>二、用户注册</h5>
      <p>2.1 用户注册成功后，小黄鱼任务中心将给予每个用户一个用户账号及相应的密码，该用户账号和密码由用户负责保管。</p>
      <p>2.2 用户对以其用户账号进行的所有活动和事件负法律责任。</p>
    </div>
    <div class="legal-section">
      <h5>三、使用规则</h5>
      <p>3.1 用户在使用小黄鱼任务中心服务过程中，必须遵循以下原则：</p>
      <p>（1）遵守中国有关的法律和法规；</p>
      <p>（2）不得为任何非法目的而使用网络服务系统；</p>
      <p>（3）遵守所有与网络服务有关的网络协议、规定和程序；</p>
      <p>（4）不得利用小黄鱼任务中心服务进行任何可能对互联网的正常运转造成不利影响的行为；</p>
      <p>（5）不得利用小黄鱼任务中心服务传输任何骚扰性的、中伤他人的、辱骂性的、恐吓性的、庸俗淫秽的或其他任何非法的信息资料。</p>
    </div>
    <div class="legal-section">
      <h5>四、任务规则</h5>
      <p>4.1 用户可通过完成平台发布的任务获取相应积分奖励。</p>
      <p>4.2 任务类型包括：观看视频，评论真实的视频观看感受并提交。</p>
      <p>4.3 用户需按照任务要求真实完成任务，禁止作弊行为。</p>
      <p>4.4 平台有权对用户提交的任务进行审核，审核通过后发放相应积分。</p>
    </div>
    <div class="legal-section">
      <h5>五、积分规则</h5>
      <p>5.1 积分兑换比例：10积分 = 1元人民币。</p>
      <p>5.2 积分可在满足最低提现额度后申请提现。</p>
      <p>5.3 平台有权根据运营情况调整积分规则，调整将提前公告。</p>
    </div>
    <div class="legal-section">
      <h5>六、免责声明</h5>
      <p>6.1 用户明确同意其使用小黄鱼任务中心网络服务所存在的风险将完全由其自己承担。</p>
      <p>6.2 小黄鱼任务中心不担保服务一定能满足用户的要求，也不担保服务不会中断，对服务的及时性、安全性、准确性也都不作担保。</p>
    </div>
    <div class="legal-section">
      <h5>七、联系我们</h5>
      <p>如您对本协议有任何疑问，可通过以下方式联系我们：</p>
      <p>邮箱：1823985558@qq.com</p>
    </div>
  `,
  'privacy': `
    <div class="legal-section">
      <h4>小黄鱼任务中心隐私政策</h4>
      <p class="update-date">更新日期：2026年3月15日</p>
      <p class="update-date">生效日期：2026年3月15日</p>
    </div>
    <div class="legal-section">
      <h5>引言</h5>
      <p>小黄鱼任务中心（以下简称"我们"）非常重视用户的隐私和个人信息保护。本隐私政策将向您说明我们如何收集、使用、存储、共享和保护您的个人信息。</p>
    </div>
    <div class="legal-section">
      <h5>一、我们收集的信息</h5>
      <p>1.1 您注册账户时提供的信息：用户名、密码、手机号码等。</p>
      <p>1.2 您使用服务时产生的信息：任务完成记录、积分记录、提现记录等。</p>
      <p>1.3 设备信息：包括设备型号、操作系统版本、唯一设备标识符等。</p>
    </div>
    <div class="legal-section">
      <h5>二、我们如何使用收集的信息</h5>
      <p>2.1 为您提供、维护、改进我们的服务。</p>
      <p>2.2 用于身份验证、账户安全保护。</p>
      <p>2.3 用于向您发送服务通知和营销信息。</p>
      <p>2.4 用于数据分析研究，改进我们的产品和服务。</p>
    </div>
    <div class="legal-section">
      <h5>三、信息的共享</h5>
      <p>3.1 我们不会向第三方出售您的个人信息。</p>
      <p>3.2 我们仅在以下情况下才会共享您的个人信息：</p>
      <p>（1）获得您的明确同意后；</p>
      <p>（2）根据法律法规的要求；</p>
      <p>（3）根据政府主管部门的强制性要求。</p>
    </div>
    <div class="legal-section">
      <h5>四、信息存储与保护</h5>
      <p>4.1 我们将采取合理的安全措施保护您的个人信息。</p>
      <p>4.2 您的个人信息将被存储在中华人民共和国境内的服务器。</p>
      <p>4.3 我们会在实现您个人信息主体权益所必需的最短时间内保留您的个人信息。</p>
    </div>
    <div class="legal-section">
      <h5>五、您的权利</h5>
      <p>5.1 您有权访问、更正您的个人信息。</p>
      <p>5.2 您有权删除您的账户及相关信息。</p>
      <p>5.3 您有权撤回对个人信息处理的同意。</p>
    </div>
    <div class="legal-section">
      <h5>六、联系我们</h5>
      <p>如您对本隐私政策有任何疑问，可通过以下方式联系我们：</p>
      <p>邮箱：1823985558@qq.com</p>
    </div>
  `,
  'task-rules': `
    <div class="legal-section">
      <h4>小黄鱼任务中心任务规范</h4>
      <p class="update-date">更新日期：2026年3月15日</p>
      <p class="update-date">生效日期：2026年3月15日</p>
    </div>
    <div class="legal-section">
      <h5>一、任务类型</h5>
      <p>目前平台支持的任务类型包括：</p>
      <p>1.1 观看视频任务：观看视频，评论真实的视频观看感受并提交。</p>
      <p>任务完成后需提交真实的观看感受和评论，禁止提交虚假内容。</p>
    </div>
    <div class="legal-section">
      <h5>二、任务流程</h5>
      <p>2.1 用户可在任务大厅浏览可领取的任务。</p>
      <p>2.2 选择合适的任务进行领取。</p>
      <p>2.3 按照任务要求完成任务内容。</p>
      <p>2.4 提交任务完成证明材料。</p>
      <p>2.5 等待平台审核。</p>
      <p>2.6 审核通过后获得相应积分奖励。</p>
    </div>
    <div class="legal-section">
      <h5>三、积分规则</h5>
      <p>3.1 积分兑换比例：10积分 = 1元人民币。</p>
      <p>3.2 不同任务完成后可获得不同数量的积分。</p>
      <p>3.3 积分可通过提现功能兑换为现金。</p>
      <p>3.4 最低提现额度以平台公告为准。</p>
    </div>
    <div class="legal-section">
      <h5>四、用户等级制度</h5>
      <p>4.1 平台实行用户等级制度，等级越高享受的权益越多。</p>
      <p>4.2 当前等级配置（从低到高）：</p>
      <p>• 新手体验官（LV1）：完成任务获得基础积分</p>
      <p>• 青铜体验官（LV2）：完成任务获得基础积分×1.05倍</p>
      <p>• 白银体验官（LV3）：完成任务获得基础积分×1.10倍</p>
      <p>• 黄金体验官（LV4）：完成任务获得基础积分×1.20倍</p>
      <p>• 钻石体验官（LV5）：完成任务获得基础积分×1.35倍</p>
      <p>• 至尊体验官（LV6）：完成任务获得基础积分×1.55倍</p>
      <p>• 皇冠体验官（LV7）：完成任务获得基础积分×1.80倍</p>
      <p>4.3 用户通过完成积累任务数量提升等级。</p>
    </div>
    <div class="legal-section">
      <h5>五、违规处理</h5>
      <p>5.1 以下行为将被视为违规：</p>
      <p>（1）提交虚假任务完成证明；</p>
      <p>（2）使用自动化工具刷任务；</p>
      <p>（3）恶意注册多个账户；</p>
      <p>（4）其他违反平台规则的行为。</p>
      <p>5.2 违规处理措施：</p>
      <p>（1）警告；</p>
      <p>（2）扣除积分；</p>
      <p>（3）封禁账户。</p>
    </div>
    <div class="legal-section">
      <h5>六、联系我们</h5>
      <p>如您对任务规范有任何疑问，可通过以下方式联系我们：</p>
      <p>邮箱：1823985558@qq.com</p>
    </div>
  `
}

const legalContent = computed(() => {
  return legalContents[currentLegal.value] || ''
})

function openLegal(type) {
  currentLegal.value = type
  showLegalModal.value = true
  document.body.style.overflow = 'hidden'
}

function closeLegal() {
  showLegalModal.value = false
  document.body.style.overflow = ''
}

const achievementPercent = computed(() => {
  if (totalAchievements.value === 0) return 0
  return Math.round((achievedCount.value / totalAchievements.value) * 100)
})

// 管理后台地址
const adminUrl = '/admin/login/'

async function load() {
  try {
    const w = await getWallet()
    points.value = w.points || 0
    balance.value = String(w.balance !== null && w.balance !== undefined ? w.balance : 0)
  } catch (e) {
    points.value = 0
    balance.value = '0.00'
  }
  
  // 加载等级信息
  if (user.value) {
    try {
      const level = await getMyLevel()
      levelInfo.value = level
      totalTasks.value = level.totalTasks || 0
    } catch (e) {
      console.error('获取等级信息失败', e)
    }
    
    // 加载未读消息数
    try {
      const data = await fetchUnreadCount()
      unreadCount.value = data.count
    } catch (e) {
      // 忽略
    }
    
    // 加载签到状态
    try {
      const signInData = await getSignInStatus()
      hasSignedToday.value = signInData.hasSignedToday
    } catch (e) {
      // 忽略
    }
    
    // 加载成就统计
    try {
      const achievementData = await getAchievementStats()
      achievedCount.value = achievementData.achieved
      totalAchievements.value = achievementData.total
    } catch (e) {
      // 忽略
    }
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
.my {
  min-height: 100vh;
  background: #f5f5f5;
  max-width: 480px;
  margin: 0 auto;
  padding: 12px;
}

/* 内容区域 */
.content-area {
  padding-bottom: 100px;
}

/* 用户信息卡片 */
.card-wrapper {
  margin-bottom: 12px;
}

/* 未登录状态 */
.user-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px 16px;
  border-radius: 12px;
  color: #fff;
}


.user-card .avatar {
  width: 56px;
  height: 56px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}

.user-card .info {
  flex: 1;
}

.user-card .name {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}

.user-card .level {
  font-size: 13px;
  opacity: 0.85;
}

.login-btn {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
  padding: 8px 20px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
}

/* 消息通知按钮 */
.notification-btn {
  position: relative;
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

.notification-icon {
  font-size: 20px;
}

.notification-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 18px;
  height: 18px;
  background: #ff4757;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
}

/* 区块标题 */
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #666;
  padding: 16px 4px 8px 4px;
}

/* 快捷功能 */
.quick-actions {
  margin-bottom: 12px;
}

.quick-cards {
  background: #fff;
  overflow: hidden;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.quick-item {
  display: flex;
  align-items: center;
  padding: 16px;
  text-decoration: none;
  color: inherit;
  transition: background 0.2s;
}

.quick-item:not(:last-child) {
  border-bottom: 1px solid #f0f0f0;
}

.quick-item:active {
  background: #f9f9f9;
}

.quick-item.has-badge {
  background: linear-gradient(135deg, #fff9e6 0%, #fff 100%);
}

.quick-icon {
  width: 44px;
  height: 44px;
  background: #f5f5f5;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  margin-right: 12px;
}

.quick-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.quick-name {
  font-size: 15px;
  font-weight: 500;
  color: #333;
}

.quick-desc {
  font-size: 12px;
  color: #999;
}

.quick-desc.done {
  color: #52c41a;
}

.quick-badge {
  background: linear-gradient(135deg, #ffd700, #ffb300);
  color: #fff;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(255, 215, 0, 0.4);
}

.quick-arrow {
  color: #ccc;
  font-size: 20px;
  font-weight: 300;
}

/* 推广中心特殊样式 */
.promote-item {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow: hidden;
}

.promote-item::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -50%;
  width: 100%;
  height: 200%;
  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
  animation: shimmer 3s infinite linear;
  pointer-events: none;
}

@keyframes shimmer {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.promote-icon {
  width: 44px;
  height: 44px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  margin-right: 12px;
}

.promote-item .quick-name {
  color: #fff;
  font-weight: 600;
}

.promote-desc {
  color: rgba(255, 255, 255, 0.85);
}

.promote-badge {
  background: linear-gradient(135deg, #ffd700, #ff6b6b);
  color: #fff;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(255, 107, 107, 0.4);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

/* 菜单列表 */
.menu-section {
  margin-bottom: 12px;
}

.menu-list {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  text-decoration: none;
  color: inherit;
  transition: background 0.2s;
}

.menu-item:not(:last-child) {
  border-bottom: 1px solid #f0f0f0;
}

.menu-item:active {
  background: #f9f9f9;
}

.menu-item.highlight {
  background: linear-gradient(135deg, #f8f9ff 0%, #fff 100%);
}

.menu-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.menu-icon {
  font-size: 20px;
}

.menu-text {
  font-size: 15px;
  color: #333;
}

.menu-arrow {
  color: #ccc;
  font-size: 20px;
  font-weight: 300;
}

.menu-badge {
  background: linear-gradient(135deg, #8B5CF6, #3B82F6);
  color: #fff;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
}

.ai-item {
  background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
}

.ai-item .menu-icon {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

/* 底部协议链接 */
.legal {
  text-align: center;
  padding: 20px 0 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.legal a {
  color: #999;
  font-size: 13px;
  text-decoration: none;
  transition: color 0.2s;
}

.legal a:active {
  color: #667eea;
}

.divider {
  color: #ddd;
  font-size: 12px;
}

/* 退出登录 */
.logout-section {
  padding: 10px 0 30px;
}

.btn-logout {
  width: 100%;
  padding: 14px;
  background: #fff;
  border: 1px solid #ff4757;
  border-radius: 12px;
  color: #ff4757;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-logout:active {
  background: #fff5f5;
}

/* 协议弹窗样式 */
.legal-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
}

.legal-modal {
  background: #fff;
  width: 85%;
  max-width: 400px;
  max-height: 60vh;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.legal-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.legal-modal-title {
  font-size: 17px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.legal-modal-close {
  width: 32px;
  height: 32px;
  background: #f5f5f5;
  border: none;
  border-radius: 50%;
  font-size: 16px;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.legal-modal-close:active {
  background: #eee;
  transform: scale(0.95);
}

.legal-modal-body {
  flex: 1;
  min-height: 0;
  max-height: calc(60vh - 60px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 20px;
}

.legal-content {
  font-size: 14px;
  line-height: 1.8;
  color: #333;
}

.legal-content :deep(.legal-section) {
  margin-bottom: 20px;
}

.legal-content :deep(h4) {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 0 0 12px 0;
}

.legal-content :deep(h5) {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin: 0 0 10px 0;
}

.legal-content :deep(p) {
  margin: 0 0 8px 0;
  color: #666;
}

.legal-content :deep(.update-date) {
  font-size: 13px;
  color: #999;
  margin-bottom: 4px;
}

/* 弹窗动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .legal-modal,
.modal-leave-active .legal-modal {
  transition: transform 0.3s ease;
}

.modal-enter-from .legal-modal,
.modal-leave-to .legal-modal {
  transform: translateY(100%);
}
</style>
