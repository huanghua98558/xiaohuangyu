<template>
  <span :class="['countdown-timer', { 'expiring': isExpiring, 'expired': isExpired }]">
    <span v-if="isExpired" class="expired-text">已过期</span>
    <span v-else-if="isExpiring" class="expiring-text">
      <span class="warning-icon">⚠️</span>
      {{ displayTime }}
    </span>
    <span v-else>{{ displayTime }}</span>
  </span>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'

const props = defineProps({
  expiresAt: { 
    type: String, 
    required: true 
  },
  // 预警阈值（毫秒），默认2小时
  warningThreshold: { 
    type: Number, 
    default: 2 * 60 * 60 * 1000 
  },
  // 更新间隔（毫秒），默认1分钟
  updateInterval: {
    type: Number,
    default: 60000
  }
})

const emit = defineEmits(['expire', 'warning'])

const now = ref(Date.now())
let timer = null

// 计算时间差
const diff = computed(() => {
  const expires = new Date(props.expiresAt).getTime()
  return expires - now.value
})

// 是否已过期
const isExpired = computed(() => diff.value <= 0)

// 是否即将过期
const isExpiring = computed(() => {
  return diff.value > 0 && diff.value < props.warningThreshold
})

// 格式化显示时间
const displayTime = computed(() => {
  if (diff.value <= 0) return '已过期'
  
  const totalMinutes = Math.floor(diff.value / (1000 * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  
  if (hours > 24) {
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    if (remainingHours > 0) {
      return `${days}天${remainingHours}小时`
    }
    return `${days}天`
  }
  
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  }
  
  return `${minutes}分钟`
})

// 启动定时器
const startTimer = () => {
  stopTimer()
  timer = setInterval(() => {
    now.value = Date.now()
    
    // 触发过期事件
    if (isExpired.value) {
      emit('expire')
      stopTimer()
    }
    
    // 触发预警事件（只触发一次）
    if (isExpiring.value && !hasEmittedWarning) {
      emit('warning')
      hasEmittedWarning = true
    }
  }, props.updateInterval)
}

// 停止定时器
const stopTimer = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

let hasEmittedWarning = false

// 监听 expiresAt 变化
watch(() => props.expiresAt, () => {
  now.value = Date.now()
  hasEmittedWarning = false
  if (!isExpired.value) {
    startTimer()
  }
})

onMounted(() => {
  now.value = Date.now()
  if (!isExpired.value) {
    startTimer()
  }
})

onUnmounted(() => {
  stopTimer()
})
</script>

<style scoped>
.countdown-timer {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
}

.expired-text {
  color: #999;
  font-size: 12px;
}

.expiring-text {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #f44336;
  animation: pulse 1s ease-in-out infinite;
}

.warning-icon {
  font-size: 12px;
}

.expiring .countdown-timer {
  color: #f44336;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
</style>
