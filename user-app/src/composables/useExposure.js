/**
 * 曝光额度管理 - Vue Composable
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getExposureQuota, getSelectionScore, getSupplyDemandStats, getOnlineStats } from '../api/task.js'
import { useAuth } from '../store/auth.js'

// 全局状态
const exposureQuota = ref(null)
const selectionScore = ref(0)
const supplyDemandStats = ref(null)
const onlineStats = ref(null)
const loading = ref(false)
const error = ref(null)

// 自动刷新定时器
let refreshTimer = null

/**
 * 曝光额度管理 Composable
 */
export function useExposure() {
  const { isLoggedIn } = useAuth()

  // 计算属性
  const hasQuota = computed(() => {
    if (!exposureQuota.value) return true
    return exposureQuota.value.quota?.hasQuota ?? true
  })

  const availableQuota = computed(() => {
    if (!exposureQuota.value) return 0
    return exposureQuota.value.quota?.available ?? 0
  })

  const quotaUsageRate = computed(() => {
    if (!exposureQuota.value) return '0'
    return exposureQuota.value.quotaUsageRate ?? '0'
  })

  const currentExposure = computed(() => {
    if (!exposureQuota.value) return 0
    return exposureQuota.value.quota?.current ?? 0
  })

  const exposureLimit = computed(() => {
    if (!exposureQuota.value) return 10
    return exposureQuota.value.quota?.limit ?? 10
  })

  // 获取曝光额度
  async function fetchExposureQuota() {
    if (!isLoggedIn.value) return

    loading.value = true
    error.value = null

    try {
      const data = await getExposureQuota()
      exposureQuota.value = data
    } catch (e) {
      error.value = e.message
      console.warn('[Exposure] 获取曝光额度失败:', e.message)
    } finally {
      loading.value = false
    }
  }

  // 获取选择分数
  async function fetchSelectionScore() {
    if (!isLoggedIn.value) return

    try {
      const data = await getSelectionScore()
      selectionScore.value = data.score
    } catch (e) {
      console.warn('[Exposure] 获取选择分数失败:', e.message)
    }
  }

  // 获取供需统计
  async function fetchSupplyDemandStats() {
    try {
      const data = await getSupplyDemandStats()
      supplyDemandStats.value = data
    } catch (e) {
      console.warn('[Exposure] 获取供需统计失败:', e.message)
    }
  }

  // 获取在线统计
  async function fetchOnlineStats() {
    try {
      const data = await getOnlineStats()
      onlineStats.value = data
    } catch (e) {
      console.warn('[Exposure] 获取在线统计失败:', e.message)
    }
  }

  // 刷新所有数据
  async function refreshAll() {
    await Promise.all([
      fetchExposureQuota(),
      fetchSelectionScore(),
      fetchSupplyDemandStats(),
      fetchOnlineStats()
    ])
  }

  // 启动自动刷新
  function startAutoRefresh(interval = 60000) {
    stopAutoRefresh()
    refreshTimer = setInterval(() => {
      if (isLoggedIn.value) {
        fetchExposureQuota()
        fetchSelectionScore()
      }
      fetchSupplyDemandStats()
      fetchOnlineStats()
    }, interval)
  }

  // 停止自动刷新
  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
  }

  // 组件挂载时自动获取数据
  onMounted(() => {
    if (isLoggedIn.value) {
      fetchExposureQuota()
      fetchSelectionScore()
    }
    fetchSupplyDemandStats()
    fetchOnlineStats()
  })

  // 组件卸载时停止自动刷新
  onUnmounted(() => {
    stopAutoRefresh()
  })

  return {
    // 状态
    exposureQuota,
    selectionScore,
    supplyDemandStats,
    onlineStats,
    loading,
    error,

    // 计算属性
    hasQuota,
    availableQuota,
    quotaUsageRate,
    currentExposure,
    exposureLimit,

    // 方法
    fetchExposureQuota,
    fetchSelectionScore,
    fetchSupplyDemandStats,
    fetchOnlineStats,
    refreshAll,
    startAutoRefresh,
    stopAutoRefresh
  }
}

/**
 * 全局曝光状态（用于非组件环境）
 */
export function useExposureGlobal() {
  return {
    exposureQuota,
    selectionScore,
    supplyDemandStats,
    onlineStats,
    loading,
    error,
    
    async fetchExposureQuota() {
      if (exposureQuota.value) return exposureQuota.value
      
      try {
        const data = await getExposureQuota()
        exposureQuota.value = data
        return data
      } catch (e) {
        console.warn('[Exposure] 获取曝光额度失败:', e.message)
        return null
      }
    },
    
    async fetchSupplyDemandStats() {
      if (supplyDemandStats.value) return supplyDemandStats.value
      
      try {
        const data = await getSupplyDemandStats()
        supplyDemandStats.value = data
        return data
      } catch (e) {
        console.warn('[Exposure] 获取供需统计失败:', e.message)
        return null
      }
    }
  }
}

export default useExposure
