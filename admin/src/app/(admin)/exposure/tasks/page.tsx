'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ClipboardList,
  Search,
  Filter,
  RefreshCw,
  Eye,
  BarChart3,
  Users,
  Clock,
  ChevronLeft,
  ChevronRight,
  Package,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  ExternalLink,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  getTasksWithStats,
  getTaskExposureDetail,
  type TaskWithStats,
} from '@/lib/api'

// 任务曝光详情类型
interface TaskExposureInfo {
  taskId: number
  title: string
  status: string
  platform: string
  action: string
  reward: number
  remain: number
  totalCapacity: number
  usedCapacity: number
  availableCapacity: number
  globalPoolQuota: number
  userPoolQuota: number
  exposureCount: number
  claimCount: number
  completeCount: number
  createdAt: string
  expiresAt?: string
}

export default function TaskExposurePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [tasks, setTasks] = useState<TaskWithStats[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  const [searchKeyword, setSearchKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  
  const pageSize = 20

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      const result = await getTasksWithStats({
        page,
        size: pageSize,
        status: statusFilter && statusFilter !== 'all' ? statusFilter : undefined,
        platform: platformFilter && platformFilter !== 'all' ? platformFilter : undefined,
      })
      setTasks(result.list)
      setTotal(result.total)
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, platformFilter])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchTasks()
    setTimeout(() => setRefreshing(false), 500)
  }

  const handleSearch = () => {
    setPage(1)
    fetchTasks()
  }

  const totalPages = Math.ceil(total / pageSize)

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      active: { label: '进行中', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' },
      paused: { label: '已暂停', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' },
      completed: { label: '已完成', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100' },
      expired: { label: '已过期', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100' },
      draft: { label: '草稿', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100' },
    }
    const config = statusConfig[status] || statusConfig.draft
    return <Badge className={config.className}>{config.label}</Badge>
  }

  const getPlatformBadge = (platform: string) => {
    const colors: Record<string, string> = {
      douyin: 'bg-black text-white',
      kuaishou: 'bg-orange-500 text-white',
      xiaohongshu: 'bg-red-500 text-white',
      bilibili: 'bg-blue-500 text-white',
      wechat: 'bg-green-500 text-white',
    }
    return (
      <Badge className={colors[platform] || 'bg-gray-500 text-white'}>
        {platform}
      </Badge>
    )
  }

  const getCapacityBar = (used: number, total: number) => {
    const percentage = total > 0 ? (used / total) * 100 : 0
    const color = percentage >= 90 ? 'bg-red-500' : percentage >= 70 ? 'bg-yellow-500' : 'bg-green-500'
    
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full ${color} transition-all`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {used}/{total}
        </span>
      </div>
    )
  }

  const getCompletionRate = (stats: TaskWithStats['stats']) => {
    if (stats.totalClaims === 0) return 0
    return Math.round((stats.doneCount / stats.totalClaims) * 100)
  }

  return (
    <div className="space-y-6 p-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">任务曝光详情</h1>
          <p className="text-muted-foreground">
            查看任务曝光量、剩余容量、分配记录等详细信息
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 筛选区域 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索任务标题..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="active">进行中</SelectItem>
                <SelectItem value="paused">已暂停</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
                <SelectItem value="expired">已过期</SelectItem>
              </SelectContent>
            </Select>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="平台" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部平台</SelectItem>
                <SelectItem value="douyin">抖音</SelectItem>
                <SelectItem value="kuaishou">快手</SelectItem>
                <SelectItem value="xiaohongshu">小红书</SelectItem>
                <SelectItem value="bilibili">B站</SelectItem>
                <SelectItem value="wechat">微信</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>
              <Filter className="mr-2 h-4 w-4" />
              筛选
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">总任务数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">进行中</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {tasks.filter((t) => t.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">总领取数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {tasks.reduce((sum, t) => sum + t.stats.totalClaims, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">总完成数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {tasks.reduce((sum, t) => sum + t.stats.doneCount, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 任务列表 */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>任务ID</TableHead>
                  <TableHead>任务标题</TableHead>
                  <TableHead>平台</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>剩余/总量</TableHead>
                  <TableHead>领取进度</TableHead>
                  <TableHead>完成率</TableHead>
                  <TableHead>奖励</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-mono">{task.id}</TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <div className="font-medium truncate">{task.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {task.action}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getPlatformBadge(task.platform)}</TableCell>
                      <TableCell>{getStatusBadge(task.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span>{task.remain} / {task.remain + task.stats.doneCount}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getCapacityBar(task.stats.totalClaims - task.stats.doingCount, task.stats.totalClaims)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getCompletionRate(task.stats) >= 80 ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : getCompletionRate(task.stats) >= 50 ? (
                            <TrendingUp className="h-4 w-4 text-yellow-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span>{getCompletionRate(task.stats)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{task.reward} 积分</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/tasks/${task.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          详情
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            共 {total} 条记录，第 {page}/{totalPages} 页
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
