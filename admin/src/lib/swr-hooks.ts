'use client'

import useSWR, { SWRConfig, mutate } from 'swr'

// 全局 SWR 配置
const swrConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  shouldRetryOnError: false,
  dedupingInterval: 5000, // 5秒内相同请求去重
  errorRetryCount: 1,
}

// 通用 fetcher
const fetcher = async (url: string) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
  const res = await fetch(url, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  })
  const data = await res.json()
  if (data.code !== 0) {
    throw new Error(data.message || '请求失败')
  }
  return data.data
}

// API fetcher (带 /api 前缀)
const apiFetcher = (url: string) => fetcher(`/admin/api${url}`)

// 导出配置和工具
export { SWRConfig, mutate, fetcher, apiFetcher, swrConfig }

// 预加载函数
export function prefetchStats() {
  return mutate('/api/admin-v2/stats', apiFetcher('/admin-v2/stats'))
}

export function prefetchTasks() {
  return mutate('/api/admin-v2/tasks', apiFetcher('/admin-v2/tasks?page=1&size=20'))
}

export function prefetchUsers() {
  return mutate('/api/admin-v2/users', apiFetcher('/admin-v2/users?page=1&size=20'))
}

// 统计数据 Hook
export function useDashboardStats() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/admin-v2/stats',
    apiFetcher,
    {
      ...swrConfig,
      refreshInterval: 0, // WS handles real-time updates // 30秒自动刷新
    }
  )

  return {
    stats: data,
    isLoading,
    isError: !!error,
    error,
    refresh: () => mutate(),
    mutate, // 暴露 mutate 用于实时更新
  }
}

// 趋势数据 Hook
export function useTrendData(days: number = 7) {
  const { data, error, isLoading } = useSWR(
    `/api/admin-v2/stats/trend?days=${days}`,
    apiFetcher,
    swrConfig
  )

  return {
    trendData: data || [],
    isLoading,
    isError: !!error,
  }
}

// 用户列表 Hook
export function useUsers(params: {
  page?: number
  size?: number
  role?: string
  level?: number
  search?: string
}) {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.size) query.set('size', String(params.size))
  if (params.role) query.set('role', params.role)
  if (params.level) query.set('level', String(params.level))
  if (params.search) query.set('search', params.search)

  const { data, error, isLoading, mutate } = useSWR(
    `/api/admin-v2/users?${query.toString()}`,
    apiFetcher,
    swrConfig
  )

  return {
    users: data?.list || [],
    total: data?.total || 0,
    page: data?.page || 1,
    size: data?.size || 20,
    isLoading,
    isError: !!error,
    refresh: () => mutate(),
  }
}

// 任务列表 Hook
export function useTasks(params: {
  page?: number
  size?: number
  status?: string
  platform?: string
  search?: string
}) {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.size) query.set('size', String(params.size))
  if (params.status) query.set('status', params.status)
  if (params.platform) query.set('platform', params.platform)
  if (params.search) query.set('search', params.search)

  const { data, error, isLoading, mutate } = useSWR(
    `/api/admin-v2/tasks?${query.toString()}`,
    apiFetcher,
    swrConfig
  )

  return {
    tasks: data?.list || [],
    total: data?.total || 0,
    page: data?.page || 1,
    size: data?.size || 20,
    isLoading,
    isError: !!error,
    refresh: () => mutate(),
  }
}

// 审核列表 Hook
export function useReviewList(params: {
  page?: number
  size?: number
  status?: string
}) {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.size) query.set('size', String(params.size))
  if (params.status) query.set('status', params.status)

  const { data, error, isLoading, mutate } = useSWR(
    `/api/admin-v2/review?${query.toString()}`,
    apiFetcher,
    swrConfig
  )

  return {
    claims: data?.list || [],
    total: data?.total || 0,
    page: data?.page || 1,
    size: data?.size || 20,
    isLoading,
    isError: !!error,
    refresh: () => mutate(),
  }
}
