'use client'

import { ReactNode, useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

// 页面骨架屏
function PageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* 标题骨架 */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>

      {/* 统计卡片骨架 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 表格骨架 */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-4 mt-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface PageContainerProps {
  children: ReactNode
  hasData?: boolean  // 是否有缓存数据
  loading?: boolean   // 是否正在加载
}

/**
 * 页面容器组件 - 统一页面加载体验
 * 
 * 策略：
 * 1. 如果有缓存数据（hasData=true），立即显示内容，后台更新
 * 2. 如果没有缓存数据（hasData=false），立即显示骨架屏
 * 3. 加载完成后平滑过渡
 */
export function PageContainer({ children, hasData = false, loading = false }: PageContainerProps) {
  // 如果有数据，立即显示内容（即使正在加载）
  if (hasData) {
    return <>{children}</>
  }

  // 如果没有数据，显示骨架屏
  if (!hasData) {
    return <PageSkeleton />
  }

  // 兜底：显示内容
  return <>{children}</>
}

/**
 * 智能页面容器 - 根据数据状态自动切换
 * 
 * 使用示例：
 * ```tsx
 * export default function MyPage() {
 *   const { data, isLoading } = useSWR('/api/data', fetcher)
 *   
 *   return (
 *     <SmartPageContainer isLoading={isLoading} data={data}>
 *       {/* 页面内容 *\/}
 *     </SmartPageContainer>
 *   )
 * }
 * ```
 */
export function SmartPageContainer({ 
  children, 
  isLoading, 
  data,
  skeleton
}: { 
  children: ReactNode
  isLoading: boolean
  data?: unknown
  skeleton?: ReactNode
}) {
  // 如果有数据（缓存或新数据），立即显示内容
  if (data) {
    return <>{children}</>
  }

  // 如果正在加载且没有数据，显示骨架屏
  if (isLoading && !data) {
    return <>{skeleton || <PageSkeleton />}</>
  }

  // 兜底：显示内容
  return <>{children}</>
}
