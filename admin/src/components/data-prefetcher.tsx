'use client'

import { useEffect } from 'react'
import { prefetchStats, prefetchTasks, prefetchUsers } from '@/lib/swr-hooks'

// 路由到预加载函数的映射
const prefetchMap: Record<string, () => Promise<unknown>> = {
  '/': prefetchStats,
  '/data-center': prefetchStats,
  '/statistics': prefetchStats,
  '/tasks': prefetchTasks,
  '/users': prefetchUsers,
}

// 数据预加载组件 - 在应用启动时预加载常用数据
export function DataPrefetcher() {
  useEffect(() => {
    // 应用启动时预加载首页数据
    prefetchStats()
  }, [])

  return null
}

// 导航预加载 Hook
export function usePrefetchOnHover() {
  const prefetch = (href: string) => {
    const prefetchFn = prefetchMap[href]
    if (prefetchFn) {
      prefetchFn()
    }
  }

  return { prefetch }
}

// 导航预加载组件
export function NavPrefetch({ href }: { href: string }) {
  const { prefetch } = usePrefetchOnHover()

  useEffect(() => {
    // 组件挂载时预加载
    prefetch(href)
  }, [href, prefetch])

  return null
}
