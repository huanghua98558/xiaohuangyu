'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  ClipboardCheck, Clock, CheckCircle, XCircle, AlertTriangle,
  Bot, Users, TrendingUp, RefreshCw, ArrowRight, Eye,
  FileText, Timer, Target, Zap, BarChart3, PieChart
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

const TOKEN_KEY = 'admin_token'

function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) headers['Authorization'] = 'Bearer ' + token
  }
  return headers
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch('/admin/api' + url, { ...options, headers: { ...getAuthHeaders(), ...options.headers } })
  const json = await res.json()
  if (json.code !== 0 && json.code !== 200) {
    if (json.code === 401) { localStorage.removeItem(TOKEN_KEY); window.location.href = '/admin/login/' }
    throw new Error(json.message || '请求失败')
  }
  return json.data ?? json
}

// 统计卡片组件
function StatCard({ title, value, subtitle, icon: Icon, color, trend }: {
  title: string
  value: number | string
  subtitle?: string
  icon: React.ElementType
  color: string
  trend?: number
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    green: 'bg-green-500/10 text-green-600 border-green-500/20',
    orange: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    purple: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
    red: 'bg-red-500/10 text-red-600 border-red-500/20',
  }
  
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">{title}</p>
            <p className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</p>
            {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
            {trend !== undefined && (
              <p className={"text-xs mt-1 flex items-center gap-1 " + (trend >= 0 ? "text-green-600" : "text-red-600")}>
                <TrendingUp className={"h-3 w-3 " + (trend < 0 ? "rotate-180" : "")} />
                {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
              </p>
            )}
          </div>
          <div className={"p-3 rounded-xl " + colorClasses[color]}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// 审核记录类型
interface ReviewRecord {
  id: string
  userId: string
  taskId: string
  username?: string
  taskTitle?: string
  status: string
  aiReviewStatus?: string
  aiConfidence?: number
  reward: number
  claimedAt: string
  submittedAt?: string
  reviewedAt?: string
  reviewNote?: string
}

interface Stats {
  pending: number
  todayReviewed: number
  todayApproved: number
  todayRejected: number
  avgReviewTime: number
  autoApprovedRate: number
  manualRate: number
}

export default function ReviewManagementPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [records, setRecords] = useState<ReviewRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  // 加载统计数据
  const loadStats = useCallback(async () => {
    try {
      // 从多个API获取统计数据
      const [statsData, queueData] = await Promise.all([
        request<any>('/ai/reviewer/stats').catch(() => null),
        request<any>('/ai/reviewer/queue?status=manual').catch(() => null)
      ])
      
      if (statsData) {
        setStats({
          pending: statsData.pending || statsData.manual || 0,
          todayReviewed: (statsData.todayApproved || 0) + (statsData.todayRejected || 0),
          todayApproved: statsData.todayApproved || 0,
          todayRejected: statsData.todayRejected || 0,
          avgReviewTime: statsData.avgReviewTime || 0,
          autoApprovedRate: statsData.autoRate || 0,
          manualRate: statsData.manual || 0
        })
      } else {
        // 模拟数据
        setStats({
          pending: 0,
          todayReviewed: 0,
          todayApproved: 0,
          todayRejected: 0,
          avgReviewTime: 0,
          autoApprovedRate: 0,
          manualRate: 0
        })
      }
    } catch (e) {
      console.error('加载统计失败:', e)
    }
  }, [])

  // 加载审核记录
  const loadRecords = useCallback(async () => {
    setRecordsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('size', String(pageSize))
      if (statusFilter !== 'all') params.set('status', statusFilter)
      
      const data = await request<{ list: ReviewRecord[]; total: number }>('/admin-v2/review/records?' + params.toString())
      
      setRecords(data.list || [])
      setTotal(data.total || 0)
    } catch (e) {
      console.error('加载记录失败:', e)
    } finally {
      setRecordsLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  useEffect(() => {
    if (activeTab === 'records') {
      loadRecords()
    }
  }, [activeTab, loadRecords])

  useEffect(() => {
    setLoading(false)
  }, [stats])

  // 状态标签映射
  const statusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: '待审核', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
    image_reviewing: { label: 'OCR处理', color: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
    link_reviewing: { label: '链接审核', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30' },
    manual: { label: '待人工', color: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
    approved: { label: '已通过', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
    rejected: { label: '已拒绝', color: 'bg-red-500/10 text-red-600 border-red-500/30' },
    done: { label: '已完成', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">审核管理</h1>
          <p className="text-sm text-gray-500 mt-1">审核任务总览与人工审核队列管理</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadStats()}>
            <RefreshCw className="h-4 w-4 mr-1" />刷新
          </Button>
          <Link href="/admin/ai-reviewer">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Bot className="h-4 w-4 mr-1" />AI审核中心
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="待审核任务"
          value={stats?.pending || 0}
          icon={Clock}
          color="orange"
          subtitle="需要人工处理"
        />
        <StatCard
          title="今日已审"
          value={stats?.todayReviewed || 0}
          icon={ClipboardCheck}
          color="blue"
        />
        <StatCard
          title="今日通过"
          value={stats?.todayApproved || 0}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="今日拒绝"
          value={stats?.todayRejected || 0}
          icon={XCircle}
          color="red"
        />
      </div>

      {/* 快捷入口 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/admin/ai-reviewer">
          <Card className="cursor-pointer hover:border-blue-500/50 transition-colors">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10">
                <Bot className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">AI审核中心</h3>
                <p className="text-xs text-gray-500">处理OCR、链接审核、AI审核队列</p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </CardContent>
          </Card>
        </Link>
        
        <Link href="/admin/review-config">
          <Card className="cursor-pointer hover:border-purple-500/50 transition-colors">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-500/10">
                <Target className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">审核配置中心</h3>
                <p className="text-xs text-gray-500">配置AI审核参数与策略</p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </CardContent>
          </Card>
        </Link>
        
        <Link href="/admin/review-logs">
          <Card className="cursor-pointer hover:border-cyan-500/50 transition-colors">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-cyan-500/10">
                <FileText className="h-6 w-6 text-cyan-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">审核记录</h3>
                <p className="text-xs text-gray-500">查看历史审核记录</p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 审核效率分析 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            审核效率分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">AI自动审核率</p>
              <p className="text-xl font-bold text-blue-600">
                {stats?.autoApprovedRate ? stats.autoApprovedRate.toFixed(1) : '0.0'}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">今日通过率</p>
              <p className="text-xl font-bold text-green-600">
                {stats?.todayReviewed ? ((stats.todayApproved / stats.todayReviewed) * 100).toFixed(1) : '0.0'}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">平均审核时间</p>
              <p className="text-xl font-bold text-orange-600">
                {stats?.avgReviewTime ? stats.avgReviewTime + "秒" : "-"}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">待人工处理</p>
              <p className="text-xl font-bold text-red-600">{stats?.pending || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 人工审核队列预览 */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              人工审核队列
            </CardTitle>
            <CardDescription>需要人工介入的审核任务</CardDescription>
          </div>
          <Link href="/admin/ai-reviewer">
            <Button variant="outline" size="sm">
              前往处理 <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">当前没有需要人工审核的任务</p>
            <p className="text-xs text-gray-400 mt-1">所有任务已由AI自动处理或无需审核</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
