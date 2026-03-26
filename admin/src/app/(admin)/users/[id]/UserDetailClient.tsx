'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { getUserDetail, getUserTasks, getUserPointsLogs, getUserBalanceLogs, getUserActivity, updateUserStatus, updateUserLevel, updateUserRole, updateUserPoints, updateUserBalance, getLevelConfigs, getTargetLogs, OperationLog } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
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
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowLeft,
  User,
  Coins,
  Wallet,
  Trophy,
  Calendar,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  Edit,
  History,
  Activity,
  Award,
  Bell,
} from 'lucide-react'

interface UserDetailData {
  user: {
    id: number
    username: string
    phone: string | null
    avatar: string | null
    role: string
    level: number
    points: number
    balance: number
    totalTasks: number
    totalPoints: number
    status: number
    createdAt: string
    lastLoginAt: string | null
  }
  taskStats: {
    total: number
    pending: number
    done: number
    rejected: number
  }
  pointsLogs: Array<{
    id: number
    old_points: number
    new_points: number
    change: number
    type: string
    description: string
    created_at: string
  }>
  balanceLogs: Array<{
    id: number
    old_balance: number
    new_balance: number
    change: number
    type: string
    description: string
    created_at: string
  }>
  signInStats: {
    total: number
    records: Array<{
      sign_date: string
      points_earned: number
      continuous_days: number
    }>
  }
  achievements: Array<{
    achieved_at: string
    achievements: {
      id: number
      code: string
      name: string
      description: string
      icon: string
    }
  }>
  withdrawals: Array<{
    id: number
    amount: number
    status: string
    created_at: string
  }>
}

interface UserDetailClientProps {
  params: Promise<{ id: string }>
}

export default function UserDetailClient({ params }: UserDetailClientProps) {
  const router = useRouter()
  const { user: currentUser } = useAuth()
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null)
  const userId = resolvedParams ? parseInt(resolvedParams.id) : 0
  
  useEffect(() => {
    params.then(setResolvedParams)
  }, [params])
  
  const [detail, setDetail] = useState<UserDetailData | null>(null)
  const [levels, setLevels] = useState<Array<{ level: number; name: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  
  // 积分调整
  const [pointsDialogOpen, setPointsDialogOpen] = useState(false)
  const [pointsAmount, setPointsAmount] = useState('')
  const [pointsReason, setPointsReason] = useState('')
  const [isUpdatingPoints, setIsUpdatingPoints] = useState(false)
  
  // 余额调整
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false)
  const [balanceAmount, setBalanceAmount] = useState('')
  const [balanceReason, setBalanceReason] = useState('')
  const [isUpdatingBalance, setIsUpdatingBalance] = useState(false)
  
  // 操作日志
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([])
  
  const isAdminUser = currentUser?.role === 'admin'
  
  const loadDetail = useCallback(async () => {
    setIsLoading(true)
    try {
      const [detailData, levelData] = await Promise.all([
        getUserDetail(userId),
        levels.length === 0 ? getLevelConfigs() : Promise.resolve(levels)
      ])
      
      setDetail(detailData)
      if (levels.length === 0) {
        setLevels(levelData.map(l => ({ level: l.level, name: l.name })))
      }
      
      // 加载操作日志
      try {
        const logsData = await getTargetLogs('user', userId)
        setOperationLogs(logsData.list)
      } catch {
        // 忽略日志加载失败
      }
    } catch (err) {
      console.error('加载用户详情失败', err)
    } finally {
      setIsLoading(false)
    }
  }, [userId, levels.length])
  
  useEffect(() => {
    loadDetail()
  }, [loadDetail])
  
  const handleUpdateStatus = async (status: boolean) => {
    if (!confirm(`确定要${status ? '启用' : '禁用'}该用户吗？`)) return
    try {
      await updateUserStatus(userId, status)
      toast({ title: '操作成功', description: `已${status ? '启用' : '禁用'}该用户`, variant: 'success' })
      loadDetail()
    } catch (err) {
      console.error('更新状态失败', err)
      toast({ title: '操作失败', description: '更新用户状态失败', variant: 'destructive' })
    }
  }
  
  const handleUpdateLevel = async (level: number) => {
    try {
      await updateUserLevel(userId, level)
      toast({ title: '操作成功', description: '用户等级已更新', variant: 'success' })
      loadDetail()
    } catch (err) {
      console.error('更新等级失败', err)
      toast({ title: '操作失败', description: '更新用户等级失败', variant: 'destructive' })
    }
  }
  
  const handleUpdateRole = async (role: string) => {
    if (!confirm(`确定要将用户角色改为 ${role} 吗？`)) return
    try {
      await updateUserRole(userId, role)
      toast({ title: '操作成功', description: '用户角色已更新', variant: 'success' })
      loadDetail()
    } catch (err) {
      console.error('更新角色失败', err)
      toast({ title: '操作失败', description: '更新用户角色失败', variant: 'destructive' })
    }
  }
  
  const handleUpdatePoints = async () => {
    if (!pointsAmount || isNaN(Number(pointsAmount))) {
      toast({ title: '输入错误', description: '请输入有效的积分数量', variant: 'destructive' })
      return
    }
    
    setIsUpdatingPoints(true)
    try {
      await updateUserPoints(userId, Number(pointsAmount), pointsReason)
      toast({ title: '操作成功', description: '积分调整成功', variant: 'success' })
      setPointsDialogOpen(false)
      setPointsAmount('')
      setPointsReason('')
      loadDetail()
    } catch (err) {
      console.error('调整积分失败', err)
      toast({ title: '操作失败', description: '调整积分失败', variant: 'destructive' })
    } finally {
      setIsUpdatingPoints(false)
    }
  }
  
  const handleUpdateBalance = async () => {
    if (!balanceAmount || isNaN(Number(balanceAmount))) {
      toast({ title: '输入错误', description: '请输入有效的余额数量', variant: 'destructive' })
      return
    }
    
    setIsUpdatingBalance(true)
    try {
      await updateUserBalance(userId, Number(balanceAmount), balanceReason)
      toast({ title: '操作成功', description: '余额调整成功', variant: 'success' })
      setBalanceDialogOpen(false)
      setBalanceAmount('')
      setBalanceReason('')
      loadDetail()
    } catch (err) {
      console.error('调整余额失败', err)
      toast({ title: '操作失败', description: '调整余额失败', variant: 'destructive' })
    } finally {
      setIsUpdatingBalance(false)
    }
  }
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN')
  }
  
  const getRoleName = (role: string) => {
    const roleMap: Record<string, string> = {
      user: '体验官', // 兼容旧数据
      part_timer: '体验官',
      client: '发布者',
      reviewer: '审核员',
      admin: '管理员'
    }
    return roleMap[role] || role
  }
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  
  if (!detail) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">用户不存在</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          返回
        </Button>
      </div>
    )
  }
  
  const { user, taskStats, pointsLogs, balanceLogs, signInStats, achievements, withdrawals } = detail
  
  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">用户详情</h1>
            <p className="text-muted-foreground">ID: {user.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={user.status === 1 ? 'default' : 'destructive'}>
            {user.status === 1 ? '正常' : '已禁用'}
          </Badge>
          <Badge variant="outline">{getRoleName(user.role)}</Badge>
          <Badge variant="secondary">Lv.{user.level}</Badge>
        </div>
      </div>
      
      {/* 核心信息卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">用户名</span>
            </div>
            <p className="text-2xl font-bold mt-2">{user.username}</p>
            <p className="text-sm text-muted-foreground">{user.phone || '未绑定手机'}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-yellow-500" />
              <span className="text-sm text-muted-foreground">积分</span>
            </div>
            <p className="text-2xl font-bold mt-2">{user.points.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">累计: {user.totalPoints.toLocaleString()}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-green-500" />
              <span className="text-sm text-muted-foreground">余额</span>
            </div>
            <p className="text-2xl font-bold mt-2">¥{user.balance.toFixed(2)}</p>
            <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => setBalanceDialogOpen(true)}>
              调整余额
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-orange-500" />
              <span className="text-sm text-muted-foreground">完成任务</span>
            </div>
            <p className="text-2xl font-bold mt-2">{user.totalTasks}</p>
            <p className="text-sm text-muted-foreground">通过率: {taskStats.total > 0 ? Math.round(taskStats.done / taskStats.total * 100) : 0}%</p>
          </CardContent>
        </Card>
      </div>
      
      {/* 标签页 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="tasks">任务记录</TabsTrigger>
          <TabsTrigger value="points">积分流水</TabsTrigger>
          <TabsTrigger value="balance">余额流水</TabsTrigger>
          <TabsTrigger value="achievements">成就</TabsTrigger>
          <TabsTrigger value="logs">操作日志</TabsTrigger>
        </TabsList>
        
        {/* 概览 */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 任务统计 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  任务统计
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{taskStats.total}</p>
                    <p className="text-sm text-muted-foreground">总领取</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-500">{taskStats.pending}</p>
                    <p className="text-sm text-muted-foreground">待审核</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-500">{taskStats.done}</p>
                    <p className="text-sm text-muted-foreground">已完成</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-500">{taskStats.rejected}</p>
                    <p className="text-sm text-muted-foreground">已拒绝</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* 签到统计 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  签到统计
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-4xl font-bold text-primary">{signInStats.total}</p>
                  <p className="text-sm text-muted-foreground">本月签到天数</p>
                </div>
                {signInStats.records.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1">
                    {signInStats.records.slice(0, 10).map((record, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {record.sign_date.slice(5)} +{record.points_earned}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* 提现记录 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  近期提现
                </CardTitle>
              </CardHeader>
              <CardContent>
                {withdrawals.length === 0 ? (
                  <p className="text-center text-muted-foreground">暂无提现记录</p>
                ) : (
                  <div className="space-y-2">
                    {withdrawals.slice(0, 5).map((w) => (
                      <div key={w.id} className="flex justify-between items-center">
                        <span className="text-sm">¥{w.amount.toFixed(2)}</span>
                        <Badge variant={w.status === 'paid' ? 'default' : 'secondary'}>
                          {w.status === 'paid' ? '已打款' : w.status === 'approved' ? '已批准' : '待审核'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* 操作面板 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Edit className="h-5 w-5" />
                  管理操作
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 状态切换 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm">用户状态</span>
                  <Button
                    size="sm"
                    variant={user.status === 1 ? 'destructive' : 'default'}
                    onClick={() => handleUpdateStatus(user.status !== 1)}
                  >
                    {user.status === 1 ? '禁用' : '启用'}
                  </Button>
                </div>
                
                {/* 等级调整 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm">用户等级</span>
                  <Select value={String(user.level)} onValueChange={(v) => handleUpdateLevel(Number(v))}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {levels.map((l) => (
                        <SelectItem key={l.level} value={String(l.level)}>
                          Lv.{l.level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* 角色调整（仅管理员） */}
                {isAdminUser && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">用户角色</span>
                    <Select value={user.role} onValueChange={handleUpdateRole}>
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="part_timer">体验官</SelectItem>
                        <SelectItem value="client">发布者</SelectItem>
                        <SelectItem value="reviewer">审核员</SelectItem>
                        <SelectItem value="admin">管理员</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {/* 积分调整 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm">调整积分</span>
                  <Button size="sm" variant="outline" onClick={() => setPointsDialogOpen(true)}>
                    <Coins className="h-4 w-4 mr-1" />
                    调整
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* 任务记录 */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>任务记录</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>任务</TableHead>
                    <TableHead>平台</TableHead>
                    <TableHead>奖励</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>领取时间</TableHead>
                    <TableHead>提交时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taskStats.total === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        暂无任务记录
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        <Button variant="link" onClick={() => router.push(`/users/${userId}/tasks`)}>
                          查看全部 {taskStats.total} 条记录
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* 积分流水 */}
        <TabsContent value="points">
          <Card>
            <CardHeader>
              <CardTitle>积分流水</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>类型</TableHead>
                    <TableHead>变化</TableHead>
                    <TableHead>变化前</TableHead>
                    <TableHead>变化后</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pointsLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        暂无积分流水
                      </TableCell>
                    </TableRow>
                  ) : pointsLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="outline">{log.type}</Badge>
                      </TableCell>
                      <TableCell className={log.change >= 0 ? 'text-green-500' : 'text-red-500'}>
                        {log.change >= 0 ? '+' : ''}{log.change}
                      </TableCell>
                      <TableCell>{log.old_points}</TableCell>
                      <TableCell>{log.new_points}</TableCell>
                      <TableCell className="max-w-xs truncate">{log.description}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(log.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* 余额流水 */}
        <TabsContent value="balance">
          <Card>
            <CardHeader>
              <CardTitle>余额流水</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>类型</TableHead>
                    <TableHead>变化</TableHead>
                    <TableHead>变化前</TableHead>
                    <TableHead>变化后</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balanceLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        暂无余额流水
                      </TableCell>
                    </TableRow>
                  ) : balanceLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="outline">{log.type}</Badge>
                      </TableCell>
                      <TableCell className={log.change >= 0 ? 'text-green-500' : 'text-red-500'}>
                        {log.change >= 0 ? '+' : ''}¥{log.change.toFixed(2)}
                      </TableCell>
                      <TableCell>¥{log.old_balance.toFixed(2)}</TableCell>
                      <TableCell>¥{log.new_balance.toFixed(2)}</TableCell>
                      <TableCell className="max-w-xs truncate">{log.description}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(log.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* 成就 */}
        <TabsContent value="achievements">
          <Card>
            <CardHeader>
              <CardTitle>已获得成就 ({achievements.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {achievements.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">暂无成就</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {achievements.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 p-4 border rounded-lg">
                      <span className="text-3xl">{a.achievements.icon}</span>
                      <div>
                        <p className="font-medium">{a.achievements.name}</p>
                        <p className="text-sm text-muted-foreground">{a.achievements.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          获得于 {formatDate(a.achieved_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* 操作日志 */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>操作日志</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>操作</TableHead>
                    <TableHead>操作人</TableHead>
                    <TableHead>变更前</TableHead>
                    <TableHead>变更后</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operationLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        暂无操作日志
                      </TableCell>
                    </TableRow>
                  ) : operationLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="outline">{log.action}</Badge>
                      </TableCell>
                      <TableCell>{log.admin_name || `管理员${log.admin_id}`}</TableCell>
                      <TableCell>{log.old_value ? JSON.stringify(log.old_value).slice(0, 50) : '-'}</TableCell>
                      <TableCell>{log.new_value ? JSON.stringify(log.new_value).slice(0, 50) : '-'}</TableCell>
                      <TableCell>{log.description || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(log.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* 积分调整对话框 */}
      <Dialog open={pointsDialogOpen} onOpenChange={setPointsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>调整积分</DialogTitle>
            <DialogDescription>
              当前积分: {user.points.toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>变化数量（正数增加，负数减少）</Label>
              <Input
                type="number"
                value={pointsAmount}
                onChange={(e) => setPointsAmount(e.target.value)}
                placeholder="输入积分数量"
              />
            </div>
            <div>
              <Label>原因</Label>
              <Textarea
                value={pointsReason}
                onChange={(e) => setPointsReason(e.target.value)}
                placeholder="请输入调整原因"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPointsDialogOpen(false)}>取消</Button>
            <Button onClick={handleUpdatePoints} disabled={isUpdatingPoints}>
              {isUpdatingPoints ? '处理中...' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 余额调整对话框 */}
      <Dialog open={balanceDialogOpen} onOpenChange={setBalanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>调整余额</DialogTitle>
            <DialogDescription>
              当前余额: ¥{user.balance.toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>变化数量（正数增加，负数减少）</Label>
              <Input
                type="number"
                step="0.01"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                placeholder="输入余额数量"
              />
            </div>
            <div>
              <Label>原因</Label>
              <Textarea
                value={balanceReason}
                onChange={(e) => setBalanceReason(e.target.value)}
                placeholder="请输入调整原因"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBalanceDialogOpen(false)}>取消</Button>
            <Button onClick={handleUpdateBalance} disabled={isUpdatingBalance}>
              {isUpdatingBalance ? '处理中...' : '确认'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
