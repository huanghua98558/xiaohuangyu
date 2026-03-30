<template>
  <div class="app">
    <router-view v-slot="{ Component, route }">
      <keep-alive :exclude="['Login', 'Register']">
        <component :is="Component" :key="route.fullPath" />
      </keep-alive>
    </router-view>
    
    <!-- 实时通知弹窗 -->
    <Transition name="toast">
      <div v-if="showNotificationToast && currentToast" class="notification-toast" @click="closeToast">
        <div class="toast-content">
          <div class="toast-icon" :class="currentToast.type">
            <span v-if="currentToast.type === 'system'">📢</span>
            <span v-else-if="currentToast.type === 'task'">✅</span>
            <span v-else>🔔</span>
          </div>
          <div class="toast-body">
            <div class="toast-title">{{ currentToast.title }}</div>
            <div class="toast-text" v-if="currentToast.content">{{ currentToast.content }}</div>
          </div>
          <button class="toast-close" @click.stop="closeToast">✕</button>
        </div>
      </div>
    </Transition>
    
    <!-- 新任务推送弹窗 -->
    <Transition name="push">
      <div v-if="showTaskPush && currentTaskPush" class="task-push-modal">
        <div class="push-content">
          <div class="push-header">
            <span class="push-badge">🆕 新任务</span>
            <button class="push-close" @click="closeTaskPush">✕</button>
          </div>
          <div class="push-body">
            <div class="push-title">{{ currentTaskPush.title }}</div>
            <div class="push-meta">
              <span class="push-platform">{{ currentTaskPush.platform }}</span>
              <span class="push-action">{{ currentTaskPush.action }}</span>
              <span class="push-reward">+{{ currentTaskPush.reward }} 积分</span>
            </div>
            <div class="push-bonus" v-if="currentTaskPush.nightBonus">
              🌙 夜间专属 +20% 加成
            </div>
          </div>
          <div class="push-footer">
            <button class="push-btn push-btn-secondary" @click="closeTaskPush">稍后看看</button>
            <button class="push-btn push-btn-primary" @click="goToTask(currentTaskPush.taskId)">立即查看</button>
          </div>
        </div>
      </div>
    </Transition>
    
    <nav class="tabbar" v-if="$route.meta.showTabbar !== false">
      <div class="tabbar-bg"></div>
      <div class="tabbar-border"></div>
      
      <!-- 首页 -->
      <router-link to="/" class="tab-item" :class="{ active: $route.path === '/' }">
        <div class="icon-container">
          <svg class="tab-icon" viewBox="0 0 24 24" fill="none">
            <path class="icon-path" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
            <path class="icon-detail" d="M9 22V12h6v10"/>
          </svg>
          <div class="icon-glow"></div>
        </div>
        <span class="tab-label">首页</span>
      </router-link>
      
      <!-- 任务 -->
      <router-link to="/tasks" class="tab-item" :class="{ active: $route.path === '/tasks' }">
        <div class="icon-container">
          <svg class="tab-icon" viewBox="0 0 24 24" fill="none">
            <rect class="icon-path" x="3" y="3" width="7" height="7" rx="1.5"/>
            <rect class="icon-path" x="14" y="3" width="7" height="7" rx="1.5"/>
            <rect class="icon-path" x="3" y="14" width="7" height="7" rx="1.5"/>
            <rect class="icon-path" x="14" y="14" width="7" height="7" rx="1.5"/>
          </svg>
          <div class="icon-glow"></div>
        </div>
        <span class="tab-label">任务</span>
      </router-link>
      
      <!-- 中间突出的导航 - 圆形设计（根据角色显示不同入口） -->
      <router-link :to="centerLink" class="tab-center" :class="{ active: isCenterActive }">
        <div class="center-wrap">
          <!-- 外圈光环 -->
          <div class="outer-ring"></div>
          <!-- 旋转装饰 -->
          <div class="orbit-ring">
            <span class="orbit-dot"></span>
          </div>
          <!-- 主体圆形 -->
          <div class="main-circle">
            <div class="circle-gradient"></div>
            <svg class="center-icon" viewBox="0 0 24 24" fill="none">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
            <!-- 内部高光 -->
            <div class="inner-shine"></div>
          </div>
          <!-- 粒子效果 -->
          <div class="circle-particles">
            <span class="cp cp1"></span>
            <span class="cp cp2"></span>
            <span class="cp cp3"></span>
            <span class="cp cp4"></span>
          </div>
        </div>
        <span class="center-label">{{ centerLabel }}</span>
      </router-link>
      
      <!-- 我的 -->
      <router-link to="/my" class="tab-item" :class="{ active: $route.path === '/my' }">
        <div class="icon-container">
          <svg class="tab-icon" viewBox="0 0 24 24" fill="none">
            <circle class="icon-path" cx="12" cy="8" r="4"/>
            <path class="icon-path" d="M20 21a8 8 0 00-16 0"/>
          </svg>
          <div class="icon-glow"></div>
        </div>
        <span class="tab-label">我的</span>
      </router-link>
      
      <!-- 教学 -->
      <router-link to="/tutorial" class="tab-item" :class="{ active: $route.path === '/tutorial' }">
        <div class="icon-container">
          <svg class="tab-icon" viewBox="0 0 24 24" fill="none">
            <path class="icon-path" d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
            <path class="icon-path" d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
            <path class="icon-detail" d="M8 7h8M8 11h6"/>
          </svg>
          <div class="icon-glow"></div>
        </div>
        <span class="tab-label">教学</span>
      </router-link>
    </nav>
    
    <!-- 城市选择弹窗 -->
    <CitySelector 
      :visible="showCitySelector" 
      @select="handleCitySelect"
      @skip="handleCitySkip"
      @close="closeCitySelector"
    />
  </div>
</template>

<script setup>
import { computed, watch, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { startHeartbeat, stopHeartbeat } from './utils/heartbeat.js'
import { useWebSocket } from './services/websocket.js'
import { useNotification } from './store/notification.js'
import { setManualSelectCallback } from './utils/location.js'
import CitySelector from './components/CitySelector.vue'

const route = useRoute()
const router = useRouter()

// WebSocket 服务
const { connect: wsConnect, disconnect: wsDisconnect, isConnected, status } = useWebSocket()

// 通知服务
const { 
  unreadCount, 
  hasUnread, 
  showNotificationToast, 
  currentToast, 
  showTaskPush, 
  currentTaskPush,
  initNotification, 
  cleanupNotification,
  closeToast,
  closeTaskPush
} = useNotification()

// 从 localStorage 获取用户信息
const user = computed(() => {
  const userStr = localStorage.getItem('xiaohuangyu_user')
  return userStr ? JSON.parse(userStr) : null
})

// 检查是否已登录
const isLoggedIn = computed(() => {
  return !!localStorage.getItem('xiaohuangyu_token')
})

// WebSocket 状态显示
const wsStatusText = computed(() => {
  switch (status.value) {
    case 'connected': return '已连接'
    case 'connecting': return '连接中...'
    case 'error': return '连接错误'
    default: return '未连接'
  }
})

// 监听登录状态变化
watch(isLoggedIn, (newVal) => {
  if (newVal) {
    console.log('[App] 用户已登录，启动服务')
    
    // 启动心跳服务
    startHeartbeat()
    
    // 连接 WebSocket
    const token = localStorage.getItem('xiaohuangyu_token')
    if (token) {
      wsConnect(token)
      initNotification()
    }
  } else {
    console.log('[App] 用户已登出，停止服务')
    
    // 停止心跳服务
    stopHeartbeat()
    
    // 断开 WebSocket
    wsDisconnect()
    cleanupNotification()
  }
}, { immediate: true })

// 城市选择弹窗
const showCitySelector = ref(false)
let citySelectResolve = null

// 处理城市选择
const handleCitySelect = (location) => {
  showCitySelector.value = false
  if (citySelectResolve) {
    citySelectResolve(location)
    citySelectResolve = null
  }
}

const handleCitySkip = () => {
  showCitySelector.value = false
  if (citySelectResolve) {
    citySelectResolve(null)
    citySelectResolve = null
  }
}

const closeCitySelector = () => {
  showCitySelector.value = false
}

// 组件挂载时，如果已登录则启动服务
onMounted(() => {
  // 设置手动选择城市回调
  setManualSelectCallback((resolve) => {
    citySelectResolve = resolve
    showCitySelector.value = true
  })
  
  if (isLoggedIn.value) {
    console.log('[App] 已登录，启动服务')
    
    // 启动心跳服务
    startHeartbeat()
    
    // 连接 WebSocket
    const token = localStorage.getItem('xiaohuangyu_token')
    if (token) {
      wsConnect(token)
      initNotification()
    }
  }
})

// 组件卸载时清理
onUnmounted(() => {
  stopHeartbeat()
  wsDisconnect()
  cleanupNotification()
})

// 仅发布者/审核员底栏中间为「任务管理」；其余（含体验官、管理员、未加载）为「我的任务」
const centerLink = computed(() => {
  const r = user.value?.role
  if (r === 'client' || r === 'reviewer') {
    return '/publisher/tasks'
  }
  return '/my/tasks'
})

const centerLabel = computed(() => {
  const r = user.value?.role
  if (r === 'client' || r === 'reviewer') {
    return '任务管理'
  }
  return '我的任务'
})

// 中间按钮激活状态
const isCenterActive = computed(() => {
  const currentPath = route.path
  return currentPath === '/my/tasks' || currentPath === '/publisher/tasks'
})

// 跳转到任务详情
const goToTask = (taskId) => {
  closeTaskPush()
  router.push(`/task/${taskId}`)
}
</script>

<style scoped>
.app {
  min-height: 100vh;
  box-sizing: border-box;
}

/* 底部导航栏 */
.tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  transform: none;
  width: 100%;
  max-width: var(--max-width, 480px);
  margin: 0 auto;
  min-height: 64px;
  padding: 6px 8px calc(6px + env(safe-area-inset-bottom, 0px));
  display: flex;
  justify-content: space-around;
  align-items: center;
  z-index: 9999;
  overflow: visible;
  box-sizing: border-box;
}

/* 毛玻璃背景 */
.tabbar-bg {
  position: absolute;
  inset: 0;
  border-radius: 20px 20px 0 0;
  background: linear-gradient(180deg,
    rgba(255, 255, 255, 0.72) 0%,
    rgba(255, 255, 255, 0.9) 55%,
    rgba(255, 255, 255, 0.96) 100%
  );
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  box-shadow:
    0 10px 30px rgba(15, 23, 42, 0.12),
    0 2px 0 rgba(255, 255, 255, 0.65) inset;
}

/* 顶部边框线 */
.tabbar-border {
  position: absolute;
  top: 0;
  left: 20px;
  right: 20px;
  height: 1px;
  background: linear-gradient(90deg, 
    transparent 0%,
    rgba(242, 106, 77, 0.3) 20%,
    rgba(242, 106, 77, 0.5) 50%,
    rgba(241, 164, 35, 0.3) 80%,
    transparent 100%
  );
}

/* 普通导航项 */
.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-decoration: none;
  color: rgba(80, 80, 80, 0.6);
  padding: 10px 0;
  position: relative;
  z-index: 1;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.icon-container {
  position: relative;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-icon {
  width: 28px;
  height: 28px;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.icon-path {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: all 0.35s ease;
}

.icon-detail {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0.7;
}

/* 图标光晕 */
.icon-glow {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: radial-gradient(circle, 
    rgba(242, 106, 77, 0.15) 0%,
    transparent 70%
  );
  opacity: 0;
  transform: scale(0.8);
  transition: all 0.35s ease;
}

.tab-label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.3px;
  transition: all 0.35s ease;
}

/* 激活状态 */
.tab-item.active {
  color: #f26a4d;
}

.tab-item.active .tab-icon {
  transform: scale(1.1);
  filter: drop-shadow(0 2px 8px rgba(242, 106, 77, 0.4));
}

.tab-item.active .icon-glow {
  opacity: 1;
  transform: scale(1.2);
  animation: iconPulse 2.5s ease-in-out infinite;
}

@keyframes iconPulse {
  0%, 100% { 
    opacity: 0.6;
    transform: scale(1.1);
  }
  50% { 
    opacity: 1;
    transform: scale(1.4);
  }
}

.tab-item.active .tab-label {
  font-weight: 600;
  color: #f26a4d;
}

/* 悬停效果 */
@media (hover: hover) {
  .tab-item:hover {
    color: #f26a4d;
  }
  
  .tab-item:hover .tab-icon {
    transform: scale(1.05);
  }
  
  .tab-item:hover .icon-glow {
    opacity: 0.5;
    transform: scale(1.1);
  }
}

/* ========== 中间圆形按钮 ========== */
.tab-center {
  flex: 1.2;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  margin-top: -8px;
  position: relative;
  z-index: 2;
}

.center-wrap {
  position: relative;
  width: 52px;
  height: 52px;
}

/* 外圈光环 */
.outer-ring {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 1px solid rgba(124, 77, 255, 0.3);
  opacity: 0;
  transition: all 0.4s ease;
}

.tab-center.active .outer-ring,
.tab-center:hover .outer-ring {
  opacity: 1;
  animation: ringExpand 2s ease-in-out infinite;
}

@keyframes ringExpand {
  0%, 100% {
    transform: scale(1);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.15);
    opacity: 0;
  }
}

/* 旋转轨道 */
.orbit-ring {
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  border: 1px dashed rgba(83, 109, 254, 0.2);
  animation: orbitRotate 12s linear infinite;
}

.orbit-dot {
  position: absolute;
  top: -3px;
  left: 50%;
  transform: translateX(-50%);
  width: 6px;
  height: 6px;
  background: linear-gradient(135deg, #7c4dff, #448aff);
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(124, 77, 255, 0.6);
}

@keyframes orbitRotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 主体圆形 */
.main-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 
    0 6px 18px rgba(83, 109, 254, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.circle-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(145deg, 
    #8b5cf6 0%,
    #7c4dff 25%,
    #536dfe 50%,
    #448aff 75%,
    #3b82f6 100%
  );
}

.main-circle::before {
  content: '';
  position: absolute;
  inset: 2px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  pointer-events: none;
}

/* 内部高光 */
.inner-shine {
  position: absolute;
  top: 4px;
  left: 10px;
  width: 18px;
  height: 9px;
  background: linear-gradient(180deg, 
    rgba(255, 255, 255, 0.4) 0%,
    transparent 100%
  );
  border-radius: 50%;
  filter: blur(2px);
}



/* 未选中中间按钮：暖色主调，避免在首页误显蓝紫高亮 */
.tab-center:not(.active) .circle-gradient {
  background: linear-gradient(145deg,
    #ffb088 0%,
    #ff8a5c 28%,
    #f26a4d 52%,
    #ea580c 78%,
    #f59e0b 100%
  );
}

.tab-center:not(.active) .center-label {
  color: rgba(90, 90, 90, 0.72);
  font-weight: 600;
  text-shadow: none;
}

.tab-center:not(.active) .main-circle {
  box-shadow:
    0 6px 16px rgba(242, 106, 77, 0.28),
    0 0 0 1px rgba(255, 255, 255, 0.12) inset;
}

.tab-center:not(.active) .orbit-ring {
  border-color: rgba(242, 106, 77, 0.28);
  animation: orbitRotate 14s linear infinite, ringBreathe 3.2s ease-in-out infinite;
}

.tab-center:not(.active) .outer-ring {
  border-color: rgba(242, 106, 77, 0.35);
}

.tab-center:not(.active) .orbit-dot {
  background: linear-gradient(135deg, #fb923c, #f97316);
  box-shadow: 0 0 8px rgba(251, 146, 60, 0.55);
}

@keyframes ringBreathe {
  0%, 100% { transform: scale(1); opacity: 0.55; }
  50% { transform: scale(1.06); opacity: 0.9; }
}
.center-icon {
  position: relative;
  width: 24px;
  height: 24px;
  stroke: white;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
  transition: all 0.3s ease;
  z-index: 1;
}

/* 粒子效果 */
.circle-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.cp {
  position: absolute;
  width: 3px;
  height: 3px;
  background: white;
  border-radius: 50%;
  opacity: 0;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.8);
}

.tab-center.active .cp,
.tab-center:hover .cp {
  animation: cpFloat 2.5s ease-in-out infinite;
}

.cp1 { top: -4px; left: 50%; animation-delay: 0s; }
.cp2 { top: 50%; right: -4px; animation-delay: 0.6s; }
.cp3 { bottom: -4px; left: 50%; animation-delay: 1.2s; }
.cp4 { top: 50%; left: -4px; animation-delay: 1.8s; }

@keyframes cpFloat {
  0%, 100% {
    opacity: 0;
    transform: translateY(0) scale(0.5);
  }
  50% {
    opacity: 0.9;
    transform: translateY(-6px) scale(1);
  }
}

.center-label {
  font-size: 12px;
  margin-top: 6px;
  color: #536dfe;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-shadow: 0 0 15px rgba(83, 109, 254, 0.3);
  transition: all 0.3s ease;
}

/* 激活状态 */
.tab-center.active .main-circle {
  transform: scale(1.08);
  box-shadow: 
    0 8px 20px rgba(83, 109, 254, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.15) inset;
}

.tab-center.active .center-icon {
  transform: scale(1.1);
}

.tab-center.active .center-label {
  color: #536dfe;
  font-weight: 700;
}

/* 悬停效果 */
@media (hover: hover) {
  .tab-center:hover .main-circle {
    transform: scale(1.05);
    box-shadow: 
      0 6px 18px rgba(83, 109, 254, 0.45),
      0 0 0 1px rgba(255, 255, 255, 0.12) inset;
  }
  
  .tab-center:hover .center-icon {
    transform: scale(1.05);
  }
}
/* ========== 通知弹窗样式 ========== */
.notification-toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  max-width: calc(100% - 32px);
  width: 360px;
}

.toast-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%);
  border-radius: 12px;
  box-shadow: 
    0 8px 32px rgba(83, 109, 254, 0.2),
    0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(83, 109, 254, 0.15);
  cursor: pointer;
  transition: all 0.3s ease;
}

.toast-content:hover {
  transform: translateY(-2px);
  box-shadow: 
    0 12px 40px rgba(83, 109, 254, 0.25),
    0 4px 12px rgba(0, 0, 0, 0.1);
}

.toast-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.toast-icon.system {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
}

.toast-icon.task {
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
}

.toast-icon.default {
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
}

.toast-body {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 2px;
}

.toast-text {
  font-size: 12px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toast-close {
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 50%;
  color: #999;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.toast-close:hover {
  background: rgba(0, 0, 0, 0.1);
  color: #666;
}

/* ========== 任务推送弹窗样式 ========== */
.task-push-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.push-content {
  width: 100%;
  max-width: 340px;
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.push-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 0;
}

.push-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  border-radius: 20px;
}

.push-close {
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 50%;
  color: #999;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.push-close:hover {
  background: rgba(0, 0, 0, 0.1);
  color: #666;
}

.push-body {
  padding: 16px;
}

.push-title {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 10px;
  line-height: 1.3;
}

.push-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.push-platform,
.push-action,
.push-reward {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}

.push-platform {
  background: #e3f2fd;
  color: #1976d2;
}

.push-action {
  background: #f3e5f5;
  color: #7b1fa2;
}

.push-reward {
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
  color: #e65100;
  font-weight: 600;
}

.push-bonus {
  margin-top: 10px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #1a1a2e 0%, #2d2d44 100%);
  color: #ffd700;
  font-size: 12px;
  font-weight: 500;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.push-footer {
  display: flex;
  gap: 10px;
  padding: 0 16px 16px;
}

.push-btn {
  flex: 1;
  padding: 12px 16px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.push-btn-secondary {
  background: #f5f5f5;
  color: #666;
}

.push-btn-secondary:hover {
  background: #eee;
}

.push-btn-primary {
  background: linear-gradient(135deg, #536dfe 0%, #7c4dff 100%);
  color: #fff;
}

.push-btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(83, 109, 254, 0.4);
}

/* ========== 动画 ========== */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}

.push-enter-active,
.push-leave-active {
  transition: all 0.3s ease;
}

.push-enter-from,
.push-leave-to {
  opacity: 0;
}

.push-enter-from .push-content,
.push-leave-to .push-content {
  transform: scale(0.9);
}
</style>

/* ========== 页面过渡动画 ========== */
.yx-page {
  animation: pageFadeIn 0.25s ease-out;
}

@keyframes pageFadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 卡片悬停效果 */
.yx-card:active,
.yx-task-card:active,
.yx-list-item:active,
.yx-menu-item:active {
  transform: scale(0.98);
  transition: transform 0.15s ease;
}

/* 按钮点击效果增强 */
.yx-btn:active {
  transform: scale(0.96);
}

/* 列表项渐入动画 */
.yx-rank-item,
.yx-list-item,
.yx-menu-item {
  animation: listFadeIn 0.2s ease-out;
}

@keyframes listFadeIn {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 加载状态动画 */
.loading-state {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
