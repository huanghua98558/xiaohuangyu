<template>
  <div class="user-profile-card">
    <!-- 装饰背景 -->
    <div class="card-decoration">
      <div class="deco-circle deco-1"></div>
      <div class="deco-circle deco-2"></div>
      <div class="deco-circle deco-3"></div>
      <div class="deco-glow"></div>
    </div>
    
    <!-- 用户基本信息 -->
    <div class="user-header">
      <div class="avatar-wrapper">
        <div class="avatar-ring"></div>
        <div class="avatar">
          <span class="avatar-emoji">{{ avatarEmoji }}</span>
        </div>
        <div class="level-badge" v-if="levelInfo">
          <span class="level-icon">{{ levelInfo.levelIcon || '⭐' }}</span>
        </div>
      </div>
      <div class="user-info">
        <div class="username">{{ username }}</div>
        <div class="user-role">
          <span class="role-tag" :class="roleClass">
            <span class="role-dot"></span>
            {{ roleText }}
          </span>
          <span class="coefficient-tag" v-if="levelInfo && levelInfo.coefficient > 1">
            <span class="coef-icon">⚡</span>
            x{{ levelInfo.coefficient }}
          </span>
        </div>
      </div>
      <div class="action-slot">
        <slot name="action"></slot>
      </div>
    </div>
    
    <!-- 用户属性数据 -->
    <div class="user-stats">
      <div class="stat-item">
        <div class="stat-icon">💎</div>
        <div class="stat-content">
          <span class="stat-value">{{ points }}</span>
          <span class="stat-label">积分</span>
        </div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <div class="stat-icon">💰</div>
        <div class="stat-content">
          <span class="stat-value">¥{{ formatBalance }}</span>
          <span class="stat-label">余额</span>
        </div>
      </div>
      <div class="stat-divider" v-if="totalTasks > 0"></div>
      <div class="stat-item" v-if="totalTasks > 0">
        <div class="stat-icon">📋</div>
        <div class="stat-content">
          <span class="stat-value">{{ totalTasks }}</span>
          <span class="stat-label">任务</span>
        </div>
      </div>
    </div>
    
    <!-- 简化版等级进度 -->
    <div class="level-progress" v-if="levelInfo && levelInfo.nextLevel && levelInfo.progress">
      <div class="progress-header">
        <span class="progress-label">
          <span class="progress-icon">🚀</span>
          升级到 {{ levelInfo.nextLevel.name }}
        </span>
        <span class="progress-percent">{{ levelInfo.progress.overallPercent || 0 }}%</span>
      </div>
      <div class="progress-bar-wrapper">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: (levelInfo.progress.overallPercent || 0) + '%' }">
            <div class="progress-shine"></div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 最高等级 -->
    <div class="max-level-badge" v-else-if="levelInfo && !levelInfo.nextLevel">
      <span class="max-icon">👑</span>
      <span class="max-text">已达最高等级</span>
      <span class="max-sparkle">✨</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  username: {
    type: String,
    default: '未登录'
  },
  role: {
    type: String,
    default: ''
  },
  levelInfo: {
    type: Object,
    default: () => null
  },
  points: {
    type: Number,
    default: 0
  },
  balance: {
    type: [String, Number],
    default: '0.00'
  },
  totalTasks: {
    type: Number,
    default: 0
  }
})

const roleText = computed(() => {
  if (props.role === 'admin') return '管理员'
  if (props.role === 'reviewer') return '审核员'
  if (props.role === 'client') return '发布者'
  if (props.levelInfo) return props.levelInfo.levelName
  return '体验官'
})

const roleClass = computed(() => {
  if (props.role === 'admin') return 'role-admin'
  if (props.role === 'reviewer') return 'role-reviewer'
  if (props.role === 'client') return 'role-client'
  return 'role-user'
})

const avatarEmoji = computed(() => {
  if (props.role === 'admin') return '🛡️'
  if (props.role === 'reviewer') return '✅'
  if (props.role === 'client') return '💼'
  return '👤'
})

const formatBalance = computed(() => {
  const b = parseFloat(props.balance) || 0
  return b.toFixed(2)
})
</script>

<style scoped>
.user-profile-card {
  position: relative;
  background: linear-gradient(135deg, 
    rgba(102, 126, 234, 0.9) 0%, 
    rgba(118, 75, 162, 0.9) 50%,
    rgba(156, 39, 176, 0.85) 100%
  );
  color: #fff;
  padding: 16px 14px;
  border-radius: 20px;
  overflow: hidden;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 
    0 8px 32px rgba(102, 126, 234, 0.35),
    0 2px 8px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

/* 装饰背景 */
.card-decoration {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.deco-circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
}

.deco-1 {
  width: 120px;
  height: 120px;
  top: -30px;
  right: -20px;
  animation: float 8s ease-in-out infinite;
}

.deco-2 {
  width: 80px;
  height: 80px;
  bottom: -20px;
  left: -10px;
  animation: float 6s ease-in-out infinite reverse;
}

.deco-3 {
  width: 40px;
  height: 40px;
  top: 50%;
  right: 30%;
  background: rgba(255, 255, 255, 0.05);
  animation: float 5s ease-in-out infinite;
}

.deco-glow {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(
    circle at 30% 30%,
    rgba(255, 255, 255, 0.1) 0%,
    transparent 50%
  );
  animation: rotate 20s linear infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-10px) scale(1.05); }
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 用户头部 */
.user-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 14px;
}

/* 头像 */
.avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}

.avatar-ring {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    rgba(255, 255, 255, 0.4),
    rgba(255, 255, 255, 0.1),
    rgba(255, 255, 255, 0.4),
    rgba(255, 255, 255, 0.1),
    rgba(255, 255, 255, 0.4)
  );
  animation: spin 4s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.avatar {
  position: relative;
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.3),
    rgba(255, 255, 255, 0.1)
  );
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 2px solid rgba(255, 255, 255, 0.2);
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.avatar-emoji {
  font-size: 22px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.level-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 26px;
  height: 26px;
  background: linear-gradient(135deg, #ffd700, #ffb300);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 2px 8px rgba(255, 215, 0, 0.5);
}

.level-icon {
  font-size: 12px;
}

/* 用户信息 */
.user-info {
  flex: 1;
  min-width: 0;
}

.username {
  font-size: 17px;
  font-weight: 700;
  margin-bottom: 8px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  letter-spacing: 0.5px;
}

.user-role {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.role-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.role-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.8); }
}

.role-tag.role-admin {
  background: linear-gradient(135deg, rgba(255, 107, 107, 0.4), rgba(238, 90, 90, 0.3));
  color: #fff;
}

.role-tag.role-reviewer {
  background: linear-gradient(135deg, rgba(78, 205, 196, 0.4), rgba(68, 160, 141, 0.3));
  color: #fff;
}

.role-tag.role-client {
  background: linear-gradient(135deg, rgba(240, 147, 251, 0.4), rgba(245, 87, 108, 0.3));
  color: #fff;
}

.role-tag.role-user {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.coefficient-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, 
    rgba(255, 215, 0, 0.3),
    rgba(255, 200, 0, 0.2)
  );
  padding: 5px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid rgba(255, 215, 0, 0.3);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.coef-icon {
  font-size: 10px;
}

.action-slot {
  flex-shrink: 0;
}

/* 用户属性数据 */
.user-stats {
  position: relative;
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.15),
    rgba(255, 255, 255, 0.08)
  );
  border-radius: 16px;
  padding: 16px 8px;
  margin-bottom: 16px;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.stat-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 4px 12px;
}

.stat-icon {
  font-size: 17px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.2;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.stat-label {
  font-size: 11px;
  opacity: 0.8;
  letter-spacing: 0.5px;
}

.stat-divider {
  width: 1px;
  height: 36px;
  background: linear-gradient(180deg, 
    transparent,
    rgba(255, 255, 255, 0.3) 20%,
    rgba(255, 255, 255, 0.3) 80%,
    transparent
  );
}

/* 等级进度 */
.level-progress {
  position: relative;
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.12),
    rgba(255, 255, 255, 0.05)
  );
  border-radius: 14px;
  padding: 10px 12px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
}

.progress-label {
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0.9;
}

.progress-icon {
  font-size: 14px;
}

.progress-percent {
  font-weight: 700;
  background: linear-gradient(90deg, #ffd700, #ffec8b);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.progress-bar-wrapper {
  overflow: hidden;
}

.progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, 
    #ffd700 0%, 
    #ffec8b 50%, 
    #ffd700 100%
  );
  border-radius: 4px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  box-shadow: 0 0 12px rgba(255, 215, 0, 0.5);
}

.progress-shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, 
    transparent,
    rgba(255, 255, 255, 0.4),
    transparent
  );
  animation: shine 2s ease-in-out infinite;
}

@keyframes shine {
  0% { left: -100%; }
  50%, 100% { left: 100%; }
}

/* 最高等级 */
.max-level-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(135deg, 
    rgba(255, 215, 0, 0.25),
    rgba(255, 200, 0, 0.15)
  );
  border-radius: 14px;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 215, 0, 0.25);
}

.max-icon {
  font-size: 17px;
  animation: bounce 2s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.max-text {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.max-sparkle {
  font-size: 16px;
  animation: sparkle 1.5s ease-in-out infinite;
}

@keyframes sparkle {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.9); }
}
</style>
