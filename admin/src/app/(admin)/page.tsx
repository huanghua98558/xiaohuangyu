'use client'

import { useMemo, memo } from 'react'
import { useDashboardStats } from '@/lib/swr-hooks'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  FilePlus,
  AlertTriangle,
  Users,
  ClipboardList,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Radio,
  Coins,
  Calendar,
  Gift,
  RefreshCw,
  Monitor,
  ArrowRight,
  Trophy,
} from 'lucide-react'
import Link from 'next/link'

// 趋势指示器组件
const TrendIndicator = memo(function TrendIndicator({ change }: { change: number }) {
  if (change > 0) {
    return (
      <div className="flex items-center text-xs text-green-600">
        <TrendingUp className="h-3 w-3 mr-0.5" />
        +{change}%
      </div>
    )
  } else if (change < 0) {
    return (
      <div className="flex items-center text-xs text-red-600">
        <TrendingDown className="h-3 w-3 mr-0.5" />
        {change}%
      </div>
    )
  }
  return (
    <div className="flex items-center text-xs text-gray-500">
      <Minus className="h-3 w-3 mr-0.5" />
      0%
    </div>
  )
})

// 数据卡片组件
const DataCard = memo(function DataCard({
  title,
  value,
  icon,
  change,
  subText,
}: {
  title: string
  value: number | string | null | undefined
  icon: React.ReactNode
  change?: number
  subText?: string
}) {
  const displayValue = value == null ? '--' : (typeof value === 'number' ? value.toLocaleString() : value)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{displayValue}</div>
        <div className="flex items-center gap-2 mt-1">
          {change !== undefined && <TrendIndicator change={change} />}
          {subText && <span className="text-xs text-muted-foreground">{subText}</span>}
        </div>
      </CardContent>
    </Card>
  )
})

// 骨架卡片
const SkeletonCard = memo(function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  )
})

// 骨架屏组件
const DashboardSkeleton = memo(function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      
      {/* 今日核心数据 */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
      
      {/* 运营指标 */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
      
      {/* 累计数据 */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
      
      {/* 积分奖励统计 */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
      
      {/* 今日积分分布 */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <Skeleton className="h-4 w-16 mb-2" />
                <Skeleton className="h-6 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
})

export default function DashboardPage() {
  // SWR 会自动缓存数据，切换页面时立即可用
  const { stats, isLoading, refresh } = useDashboardStats()

  // 使用 useMemo 缓存计算结果
  const todayCompletionRate = useMemo(() => {
    return stats?.todayClaims && stats.todayClaims > 0
      ? Math.round((stats.todayCompletedClaims || 0) / stats.todayClaims * 100)
      : 0
  }, [stats?.todayClaims, stats?.todayCompletedClaims])

  // 如果没有缓存数据，显示骨架屏
  // 如果有缓存数据但正在重新验证，显示旧数据（后台更新）
  if (!stats) {
    return <DashboardSkeleton />
  }

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">实时监控系统运营数据</p>
        <div className="flex items-center gap-3">
          <Link href="/data-center">
            <Button variant="outline" className="gap-2">
              <Monitor className="h-4 w-4" />
              进入指挥中心
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Button variant="outline" size="icon" onClick={refresh}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* 今日核心数据 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <DataCard
            title="今日发布任务"
            value={stats?.todayPublishedTasks || 0}
            icon={<FilePlus className="h-4 w-4 text-muted-foreground" />}
            change={stats?.todayPublishedTasksChange?.change}
          />
          <DataCard
            title="今日任务名额"
            value={stats?.todayTaskAmount || 0}
            icon={<ClipboardList className="h-4 w-4 text-muted-foreground" />}
            change={stats?.todayTaskAmountChange?.change}
          />
          <DataCard
            title="今日领取次数"
            value={stats?.todayClaims || 0}
            icon={<CheckCircle className="h-4 w-4 text-muted-foreground" />}
            change={stats?.todayClaimsChange?.change}
          />
          <DataCard
            title="今日完成数量"
            value={stats?.todayCompletedClaims || 0}
            icon={<Activity className="h-4 w-4 text-muted-foreground" />}
            change={stats?.todayCompletedClaimsChange?.change}
          />
        </div>

      {/* 运营指标 */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          运营指标
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <DataCard
            title="当前在线"
            value={stats?.onlineUsers || 0}
            icon={<Radio className="h-4 w-4 text-muted-foreground" />}
            subText={stats?.onlineUsers == null ? "Redis未启用" : "实时在线"}
          />
          <DataCard
            title="待审核任务"
            value={stats?.pendingClaims || 0}
            icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          />
          <DataCard
            title="今日完成率"
            value={`${todayCompletionRate}%`}
            icon={<CheckCircle className="h-4 w-4 text-muted-foreground" />}
          />
          <DataCard
            title="今日积分发放"
            value={stats?.todayPointsIssued || 0}
            icon={<Gift className="h-4 w-4 text-muted-foreground" />}
            change={stats?.todayPointsIssuedChange?.change}
          />
          <Link href="/blocked-accounts" className="block">
            <Card className="h-full hover:shadow-md transition-shadow cursor-pointer border-orange-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">封控账号</CardTitle>
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{stats?.blockedAccounts || 0}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-orange-500">疑似 {stats?.suspectedBlocked || 0}</span>
                  <span className="text-xs text-red-500">已确认 {stats?.confirmedBlocked || 0}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* 累计数据 */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          累计数据
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <DataCard
            title="总用户数"
            value={stats?.totalUsers || 0}
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
          />
          <DataCard
            title="总任务数"
            value={stats?.totalTasks || 0}
            icon={<ClipboardList className="h-4 w-4 text-muted-foreground" />}
          />
          <DataCard
            title="总完成次数"
            value={stats?.totalCompletedClaims || 0}
            icon={<CheckCircle className="h-4 w-4 text-muted-foreground" />}
          />
          <DataCard
            title="总积分发放"
            value={stats?.totalPointsIssued || 0}
            icon={<Coins className="h-4 w-4 text-muted-foreground" />}
          />
        </div>
      </div>

      {/* 积分奖励统计 */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          积分奖励统计
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <DataCard
            title="本周发放"
            value={stats?.weekPointsIssued || 0}
            icon={<Gift className="h-4 w-4 text-muted-foreground" />}
          />
          <DataCard
            title="本月发放"
            value={stats?.monthPointsIssued || 0}
            icon={<Gift className="h-4 w-4 text-muted-foreground" />}
          />
          <DataCard
            title="今日签到"
            value={stats?.todaySignIns || 0}
            icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
            change={stats?.todaySignInsChange?.change}
          />
          <DataCard
            title="本周签到"
            value={stats?.weekSignIns || 0}
            icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
          />
        </div>
      </div>

      {/* 今日积分分布 */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          今日积分分布
        </h2>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-1">签到奖励</div>
              <div className="text-xl font-bold text-cyan-600">
                {(stats?.todayPointsByType?.sign_in || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-1">任务奖励</div>
              <div className="text-xl font-bold text-blue-600">
                {(stats?.todayPointsByType?.task || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-1">推广奖励</div>
              <div className="text-xl font-bold text-purple-600">
                {(stats?.todayPointsByType?.promotion_c || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-1">额外奖励</div>
              <div className="text-xl font-bold text-green-600">
                {(stats?.todayPointsByType?.reward || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-1">活动奖励</div>
              <div className="text-xl font-bold text-yellow-600">
                {(stats?.todayPointsByType?.bonus || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-1">成就奖励</div>
              <div className="text-xl font-bold text-pink-600">
                {(stats?.todayPointsByType?.achievement || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
