'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Trophy,
  Gift,
  TrendingUp,
  Calendar,
  Users,
  Download,
  Settings,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || ''

interface Stats {
  stats: {
    sign_in: { count: number; points: number }
    task: { count: number; points: number }
    promotion_c: { count: number; points: number }
    reward: { count: number; points: number }
    bonus: { count: number; points: number }
    achievement: { count: number; points: number }
    convert: { count: number; points: number }
  }
  totalReward: number
  totalDeduct: number
  netReward: number
}

interface TrendItem {
  date: string
  sign_in: number
  task: number
  promotion_c: number
  reward: number
  bonus: number
  achievement: number
  total: number
}

interface RewardItem {
  id: number
  userId: number
  username: string
  userRole: string
  type: string
  description: string
  points: number
  balance: number
  createdAt: string
}

interface Configs {
  sign_in_base: number
  sign_in_7: number
  sign_in_14: number
  sign_in_30: number
  promotion_level1: number
  promotion_level2: number
  points_to_yuan: number
  register_bonus: number
  min_withdraw: number
  // 周榜奖励配置
  rank_weekly_top1: number
  rank_weekly_top2: number
  rank_weekly_top3: number
  // 月榜奖励配置
  rank_monthly_top1: number
  rank_monthly_top2: number
  rank_monthly_top3: number
}

interface Anomaly {
  type: string
  severity: string
  userId: number
  details: Record<string, unknown>
  message: string
}

const typeLabels: Record<string, string> = {
  sign_in: '签到奖励',
  task: '任务奖励',
  promotion_c: '推广奖励',
  reward: '排行榜奖励',
  bonus: '注册奖励',
  achievement: '成就奖励',
  convert: '积分兑换',
  withdraw: '提现',
  admin_adjust: '管理员调整',
}

// 骨架屏组件
function StatsSkeleton() {
  return (
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
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="rounded-md border">
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function PointsRewardsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [trend, setTrend] = useState<TrendItem[]>([])
  const [rewards, setRewards] = useState<RewardItem[]>([])
  const [configs, setConfigs] = useState<Configs | null>(null)
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(false)
  const [rewardTotal, setRewardTotal] = useState(0)
  const [rewardPage, setRewardPage] = useState(1)
  const [filterType, setFilterType] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [configDialogOpen, setConfigDialogOpen] = useState(false)

  // 获取统计概览
  const fetchOverview = async () => {
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`${API_BASE}/api/admin-v2/points-rewards/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.code === 0) {
        setStats(data.data)
      }
    } catch (e) {
      console.error('获取统计失败', e)
    }
  }

  // 获取趋势数据
  const fetchTrend = async () => {
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`${API_BASE}/api/admin-v2/points-rewards/trend?days=30`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.code === 0) {
        setTrend(data.data)
      }
    } catch (e) {
      console.error('获取趋势失败', e)
    }
  }

  // 获取奖励明细
  const fetchRewards = async (page = 1) => {
    try {
      const token = localStorage.getItem('admin_token')
      const params = new URLSearchParams()
      params.append('page', String(page))
      params.append('size', '20')
      if (filterType !== 'all') params.append('type', filterType)
      if (startDate) params.append('startDate', `${startDate}T00:00:00+08:00`)
      if (endDate) params.append('endDate', `${endDate}T23:59:59+08:00`)

      const res = await fetch(`${API_BASE}/api/admin-v2/points-rewards/list?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.code === 0) {
        setRewards(data.data.list)
        setRewardTotal(data.data.total)
        setRewardPage(page)
      }
    } catch (e) {
      console.error('获取明细失败', e)
    }
  }

  // 获取配置
  const fetchConfigs = async () => {
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`${API_BASE}/api/admin-v2/points-rewards/configs`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.code === 0) {
        setConfigs(data.data)
      }
    } catch (e) {
      console.error('获取配置失败', e)
    }
  }

  // 检测异常
  const detectAnomaly = async () => {
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`${API_BASE}/api/admin-v2/points-rewards/anomaly`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.code === 0) {
        setAnomalies(data.data.anomalies)
        if (data.data.count > 0) {
          toast.warning(`检测到 ${data.data.count} 个异常`)
        } else {
          toast.success('未检测到异常')
        }
      }
    } catch (e) {
      console.error('检测异常失败', e)
    }
  }

  // 导出数据
  const exportData = async () => {
    try {
      const token = localStorage.getItem('admin_token')
      const params = new URLSearchParams()
      if (filterType !== 'all') params.append('type', filterType)
      if (startDate) params.append('startDate', `${startDate}T00:00:00+08:00`)
      if (endDate) params.append('endDate', `${endDate}T23:59:59+08:00`)

      const res = await fetch(`${API_BASE}/api/admin-v2/points-rewards/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.code === 0) {
        // 创建CSV下载
        const csv = [
          Object.keys(data.data[0] || {}).join(','),
          ...data.data.map((row: Record<string, unknown>) => Object.values(row).join(','))
        ].join('\n')
        
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `积分奖励_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success('导出成功')
      }
    } catch (e) {
      console.error('导出失败', e)
      toast.error('导出失败')
    }
  }

  // 更新配置
  const updateConfigs = async (newConfigs: Partial<Configs>) => {
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`${API_BASE}/api/admin-v2/points-rewards/configs`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConfigs),
      })
      const data = await res.json()
      if (data.code === 0) {
        toast.success('配置已更新')
        fetchConfigs()
      }
    } catch (e) {
      console.error('更新配置失败', e)
      toast.error('更新失败')
    }
  }

  useEffect(() => {
    const init = async () => {
      // 立即开始加载数据，不阻塞页面渲染
      await Promise.all([fetchOverview(), fetchTrend(), fetchRewards(), fetchConfigs()])
    }
    init()
  }, [])

  useEffect(() => {
    fetchRewards(1)
  }, [filterType, startDate, endDate])

  // 计算趋势总计
  const trendTotal = trend.reduce((sum, t) => sum + t.total, 0)
  const avgDaily = trend.length > 0 ? Math.round(trendTotal / trend.length) : 0

  // 如果没有数据，显示骨架屏（立即显示，不等待）
  if (!stats) {
    return (
      <div className="space-y-6 p-6">
        <StatsSkeleton />
        <TableSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">统一管理所有积分奖励的统计分析与配置</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={detectAnomaly}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            异常检测
          </Button>
          <Button variant="outline" onClick={exportData}>
            <Download className="h-4 w-4 mr-2" />
            导出数据
          </Button>
          <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Settings className="h-4 w-4 mr-2" />
                奖励配置
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>积分奖励配置</DialogTitle>
                <DialogDescription>调整各类奖励的积分设置</DialogDescription>
              </DialogHeader>
              {configs && (
                <div className="grid grid-cols-2 gap-4 py-4 overflow-y-auto flex-1 min-h-0">
                  <div className="space-y-2">
                    <Label>签到基础积分</Label>
                    <Input
                      type="number"
                      value={configs.sign_in_base}
                      onChange={(e) => setConfigs({ ...configs, sign_in_base: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>连续7天签到</Label>
                    <Input
                      type="number"
                      value={configs.sign_in_7}
                      onChange={(e) => setConfigs({ ...configs, sign_in_7: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>连续14天签到</Label>
                    <Input
                      type="number"
                      value={configs.sign_in_14}
                      onChange={(e) => setConfigs({ ...configs, sign_in_14: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>连续30天签到</Label>
                    <Input
                      type="number"
                      value={configs.sign_in_30}
                      onChange={(e) => setConfigs({ ...configs, sign_in_30: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>一级推广奖励(%)</Label>
                    <Input
                      type="number"
                      value={configs.promotion_level1}
                      onChange={(e) => setConfigs({ ...configs, promotion_level1: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>二级推广奖励(%)</Label>
                    <Input
                      type="number"
                      value={configs.promotion_level2}
                      onChange={(e) => setConfigs({ ...configs, promotion_level2: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>注册奖励积分</Label>
                    <Input
                      type="number"
                      value={configs.register_bonus}
                      onChange={(e) => setConfigs({ ...configs, register_bonus: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>积分兑换比例</Label>
                    <Input
                      type="number"
                      value={configs.points_to_yuan}
                      onChange={(e) => setConfigs({ ...configs, points_to_yuan: Number(e.target.value) })}
                    />
                  </div>
                  {/* 周榜奖励配置 */}
                  <div className="col-span-2 mt-4">
                    <h4 className="font-medium text-sm mb-2 text-muted-foreground">周榜奖励配置</h4>
                  </div>
                  <div className="space-y-2">
                    <Label>周榜第1名奖励</Label>
                    <Input
                      type="number"
                      value={configs.rank_weekly_top1}
                      onChange={(e) => setConfigs({ ...configs, rank_weekly_top1: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>周榜第2名奖励</Label>
                    <Input
                      type="number"
                      value={configs.rank_weekly_top2}
                      onChange={(e) => setConfigs({ ...configs, rank_weekly_top2: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>周榜第3-5名奖励</Label>
                    <Input
                      type="number"
                      value={configs.rank_weekly_top3}
                      onChange={(e) => setConfigs({ ...configs, rank_weekly_top3: Number(e.target.value) })}
                    />
                  </div>
                  {/* 月榜奖励配置 */}
                  <div className="col-span-2 mt-4">
                    <h4 className="font-medium text-sm mb-2 text-muted-foreground">月榜奖励配置</h4>
                  </div>
                  <div className="space-y-2">
                    <Label>月榜第1名奖励</Label>
                    <Input
                      type="number"
                      value={configs.rank_monthly_top1}
                      onChange={(e) => setConfigs({ ...configs, rank_monthly_top1: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>月榜第2名奖励</Label>
                    <Input
                      type="number"
                      value={configs.rank_monthly_top2}
                      onChange={(e) => setConfigs({ ...configs, rank_monthly_top2: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>月榜第3-5名奖励</Label>
                    <Input
                      type="number"
                      value={configs.rank_monthly_top3}
                      onChange={(e) => setConfigs({ ...configs, rank_monthly_top3: Number(e.target.value) })}
                    />
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>取消</Button>
                <Button onClick={() => { updateConfigs(configs!); setConfigDialogOpen(false) }}>保存配置</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日发放积分</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">+{stats?.totalReward || 0}</div>
            <p className="text-xs text-muted-foreground">
              扣除: {stats?.totalDeduct || 0} | 净增: {stats?.netReward || 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">30天发放总计</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trendTotal.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">日均发放: {avgDaily}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">任务奖励</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.stats.task.points || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.stats.task.count || 0} 次奖励</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">签到奖励</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.stats.sign_in.points || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.stats.sign_in.count || 0} 次签到</p>
          </CardContent>
        </Card>
      </div>

      {/* 奖励类型统计 */}
      <Card>
        <CardHeader>
          <CardTitle>奖励类型分布（今日）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {stats && Object.entries(stats.stats).map(([key, value]) => {
              if (key === 'convert' || key === 'withdraw') return null
              return (
                <div key={key} className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold">{value.points}</div>
                  <div className="text-sm text-muted-foreground">{typeLabels[key] || key}</div>
                  <div className="text-xs text-muted-foreground mt-1">{value.count} 次</div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 异常告警 */}
      {anomalies.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              检测到 {anomalies.length} 个异常
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {anomalies.map((a, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-white rounded">
                  <div>
                    <Badge variant={a.severity === 'high' ? 'destructive' : 'secondary'}>
                      {a.severity === 'high' ? '高风险' : a.severity === 'medium' ? '中风险' : '低风险'}
                    </Badge>
                    <span className="ml-2">{a.message}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">用户 {a.userId}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 明细列表 */}
      <Card>
        <CardHeader>
          <CardTitle>奖励明细</CardTitle>
          <div className="flex gap-4 mt-4">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="奖励类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {Object.entries(typeLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-[150px]"
              placeholder="开始日期"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[150px]"
              placeholder="结束日期"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>用户</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>描述</TableHead>
                <TableHead className="text-right">积分变动</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rewards.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{new Date(r.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{r.username}</div>
                      <div className="text-xs text-muted-foreground">ID: {r.userId}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.points > 0 ? 'default' : 'secondary'}>
                      {typeLabels[r.type] || r.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{r.description}</TableCell>
                  <TableCell className={`text-right font-medium ${r.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {r.points > 0 ? '+' : ''}{r.points}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rewards.length < rewardTotal && (
            <div className="flex justify-center mt-4">
              <Button variant="outline" onClick={() => fetchRewards(rewardPage + 1)}>
                加载更多 ({rewards.length}/{rewardTotal})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
