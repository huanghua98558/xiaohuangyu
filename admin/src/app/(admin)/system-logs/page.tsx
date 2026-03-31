'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
  History,
  LogIn,
  FileCheck,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  Trash2,
  Settings,
  Activity,
  Users,
  ShieldCheck,
  Clock,
  MapPin,
  Monitor,
  Filter,
} from 'lucide-react'

const API_BASE = '/admin/api'

// 操作类型标签
const ACTION_LABELS: Record<string, string> = {
  update_status: '更新状态',
  update_level: '更新等级',
  update_role: '更新角色',
  update_points: '调整积分',
  update_balance: '调整余额',
  update_info: '更新信息',
  update_password: '重置密码',
  create_task: '创建任务',
  update_task: '更新任务',
  delete_task: '删除任务',
  approve_claim: '审核通过',
  reject_claim: '审核拒绝',
  batch_approve: '批量通过',
  force_release: '强制释放',
  login: '登录',
  logout: '登出',
}

// 目标类型标签
const TARGET_TYPE_LABELS: Record<string, string> = {
  user: '用户',
  task: '任务',
  claim: '任务记录',
  withdrawal: '提现',
  system: '系统',
}

// 审核状态标签
const REVIEW_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  done: { label: '已通过', color: 'bg-green-100 text-green-700' },
  rejected: { label: '已拒绝', color: 'bg-red-100 text-red-700' },
  expired: { label: '已过期', color: 'bg-gray-100 text-gray-700' },
}

// 登录状态标签
const LOGIN_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  success: { label: '成功', color: 'bg-green-100 text-green-700' },
  failed: { label: '失败', color: 'bg-red-100 text-red-700' },
}

// 统计卡片组件
function StatCard({ title, value, icon, subText, color = 'text-primary' }: {
  title: string
  value: number | string
  icon: React.ReactNode
  subText?: string
  color?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        {subText && <p className="text-xs text-muted-foreground mt-1">{subText}</p>}
      </CardContent>
    </Card>
  )
}

export default function SystemLogsPage() {
  // 当前Tab
  const [activeTab, setActiveTab] = useState('operation')
  
  // 加载状态
  const [isLoading, setIsLoading] = useState(false)
  
  // 数据
  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 20
  
  // 统计概览
  const [overview, setOverview] = useState<any>(null)
  
  // 筛选条件
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [keyword, setKeyword] = useState('')
  
  // 操作日志筛选
  const [actionFilter, setActionFilter] = useState('__all__')
  const [targetTypeFilter, setTargetTypeFilter] = useState('__all__')
  
  // 登录日志筛选
  const [loginStatusFilter, setLoginStatusFilter] = useState('__all__')
  const [anomalyFilter, setAnomalyFilter] = useState('__all__')
  
  // 审核日志筛选
  const [reviewStatusFilter, setReviewStatusFilter] = useState('__all__')
  
  // 清理对话框
  const [cleanDialogOpen, setCleanDialogOpen] = useState(false)
  const [cleaningType, setCleaningType] = useState<string | null>(null)
  const [isCleaning, setIsCleaning] = useState(false)
  
  // 详情对话框
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedLog, setSelectedLog] = useState<any>(null)

  // 加载统计概览
  const loadOverview = async () => {
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`${API_BASE}/admin-v2/logs/overview`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.code === 0) {
        setOverview(data.data)
      }
    } catch (e) {
      console.error('加载统计失败', e)
    }
  }

  // 加载日志数据
  const loadLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const params = new URLSearchParams()
      params.append('page', String(page))
      params.append('size', String(pageSize))
      if (startDate) params.append('startDate', `${startDate}T00:00:00+08:00`)
      if (endDate) params.append('endDate', `${endDate}T23:59:59+08:00`)
      if (keyword) params.append('keyword', keyword)
      
      // 根据Tab添加不同筛选条件
      if (activeTab === 'operation') {
        if (actionFilter && actionFilter !== '__all__') params.append('action', actionFilter)
        if (targetTypeFilter && targetTypeFilter !== '__all__') params.append('targetType', targetTypeFilter)
      } else if (activeTab === 'login') {
        if (loginStatusFilter && loginStatusFilter !== '__all__') params.append('loginStatus', loginStatusFilter)
        if (anomalyFilter && anomalyFilter !== '__all__') params.append('isAnomaly', anomalyFilter)
      } else if (activeTab === 'review') {
        if (reviewStatusFilter && reviewStatusFilter !== '__all__') params.append('status', reviewStatusFilter)
      }
      
      const res = await fetch(`${API_BASE}/admin-v2/logs/${activeTab}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.code === 0) {
        setLogs(data.data.list || [])
        setTotal(data.data.total || 0)
      } else {
        toast.error(data.message || '加载失败')
      }
    } catch (e) {
      console.error('加载日志失败', e)
      toast.error('加载日志失败')
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, page, startDate, endDate, keyword, actionFilter, targetTypeFilter, loginStatusFilter, anomalyFilter, reviewStatusFilter])

  // 初始化
  useEffect(() => {
    loadOverview()
  }, [])

  useEffect(() => {
    setPage(1)
    loadLogs()
  }, [activeTab])

  useEffect(() => {
    loadLogs()
  }, [page])

  // 搜索
  const handleSearch = () => {
    setPage(1)
    loadLogs()
  }

  // 重置筛选
  const handleReset = () => {
    setStartDate('')
    setEndDate('')
    setKeyword('')
    setActionFilter('__all__')
    setTargetTypeFilter('__all__')
    setLoginStatusFilter('__all__')
    setAnomalyFilter('__all__')
    setReviewStatusFilter('__all__')
    setPage(1)
    setTimeout(() => loadLogs(), 100)
  }

  // 导出日志
  const handleExport = async () => {
    try {
      const token = localStorage.getItem('admin_token')
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', `${startDate}T00:00:00+08:00`)
      if (endDate) params.append('endDate', `${endDate}T23:59:59+08:00`)
      
      const res = await fetch(`${API_BASE}/admin-v2/logs/export/${activeTab}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      
      if (data.code === 0) {
        // 创建CSV下载
        const exportData = data.data
        if (exportData.length === 0) {
          toast.info('没有可导出的数据')
          return
        }
        
        const headers = Object.keys(exportData[0])
        const csv = [
          headers.join(','),
          ...exportData.map((row: any) => 
            headers.map(h => {
              const val = row[h]
              if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
                return `"${val.replace(/"/g, '""')}"`
              }
              return val ?? ''
            }).join(',')
          )
        ].join('\n')
        
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${activeTab}_logs_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success('导出成功')
      }
    } catch (e) {
      toast.error('导出失败')
    }
  }

  // 清理过期日志
  const handleClean = async () => {
    if (!cleaningType) return
    
    setIsCleaning(true)
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`${API_BASE}/admin-v2/logs/clean`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ logType: cleaningType === 'all' ? null : cleaningType })
      })
      const data = await res.json()
      
      if (data.code === 0) {
        toast.success('清理完成')
        loadOverview()
        loadLogs()
      } else {
        toast.error(data.message || '清理失败')
      }
    } catch (e) {
      toast.error('清理失败')
    } finally {
      setIsCleaning(false)
      setCleanDialogOpen(false)
    }
  }

  // 查看详情
  const handleViewDetail = (log: any) => {
    setSelectedLog(log)
    setDetailDialogOpen(true)
  }

  // 格式化日期时间
  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  // 计算总页数
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">统一管理操作日志、登录日志、审核日志</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { loadOverview(); loadLogs(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button variant="outline" onClick={() => setCleanDialogOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            清理
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      {overview && (
        <div className="grid gap-4 md:grid-cols-5">
          <StatCard
            title="操作日志"
            value={overview.operationTotal || 0}
            icon={<History className="h-4 w-4 text-muted-foreground" />}
            subText="总记录数"
          />
          <StatCard
            title="登录日志"
            value={overview.loginTotal || 0}
            icon={<LogIn className="h-4 w-4 text-muted-foreground" />}
            subText={`今日 ${overview.todayLogin || 0} 次`}
          />
          <StatCard
            title="审核记录"
            value={overview.reviewTotal || 0}
            icon={<FileCheck className="h-4 w-4 text-muted-foreground" />}
            subText="已审核任务"
          />
          <StatCard
            title="异常登录"
            value={overview.anomalyTotal || 0}
            icon={<AlertTriangle className="h-4 w-4 text-orange-500" />}
            subText="需要关注"
            color="text-orange-600"
          />
          <StatCard
            title="系统状态"
            value="正常"
            icon={<ShieldCheck className="h-4 w-4 text-green-500" />}
            subText="所有服务运行正常"
            color="text-green-600"
          />
        </div>
      )}

      {/* 日志内容区域 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="operation">
            <History className="h-4 w-4 mr-2" />
            操作日志
          </TabsTrigger>
          <TabsTrigger value="login">
            <LogIn className="h-4 w-4 mr-2" />
            登录日志
          </TabsTrigger>
          <TabsTrigger value="error">
            <AlertTriangle className="h-4 w-4 mr-2" />
            错误日志
          </TabsTrigger>
        </TabsList>

        {/* 筛选区域 */}
        <Card className="mt-4">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex gap-2 items-center">
                <Label className="whitespace-nowrap">日期范围</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-[150px]"
                />
                <span>至</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-[150px]"
                />
              </div>
              
              <div className="flex gap-2 items-center">
                <Label className="whitespace-nowrap">关键词</Label>
                <Input
                  placeholder="搜索..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="w-[200px]"
                />
              </div>

              {/* 操作日志筛选 */}
              {activeTab === 'operation' && (
                <>
                  <Select value={actionFilter} onValueChange={setActionFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="操作类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">全部操作</SelectItem>
                      {Object.entries(ACTION_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={targetTypeFilter} onValueChange={setTargetTypeFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="目标类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">全部目标</SelectItem>
                      {Object.entries(TARGET_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}

              {/* 登录日志筛选 */}
              {activeTab === 'login' && (
                <>
                  <Select value={loginStatusFilter} onValueChange={setLoginStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="登录状态" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">全部状态</SelectItem>
                      <SelectItem value="success">成功</SelectItem>
                      <SelectItem value="failed">失败</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={anomalyFilter} onValueChange={setAnomalyFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="异常筛选" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">全部</SelectItem>
                      <SelectItem value="true">仅异常</SelectItem>
                      <SelectItem value="false">仅正常</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}

              {/* 审核日志筛选 */}
              {activeTab === 'review' && (
                <Select value={reviewStatusFilter} onValueChange={setReviewStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="审核结果" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">全部结果</SelectItem>
                    <SelectItem value="done">已通过</SelectItem>
                    <SelectItem value="rejected">已拒绝</SelectItem>
                    <SelectItem value="expired">已过期</SelectItem>
                  </SelectContent>
                </Select>
              )}

              <div className="flex gap-2">
                <Button onClick={handleSearch}>
                  <Search className="h-4 w-4 mr-2" />
                  搜索
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  重置
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 操作日志 */}
        <TabsContent value="operation">
          <Card>
            <CardContent className="pt-4">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>时间</TableHead>
                      <TableHead>操作者</TableHead>
                      <TableHead>操作类型</TableHead>
                      <TableHead>目标</TableHead>
                      <TableHead>描述</TableHead>
                      <TableHead>IP地址</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          暂无数据
                        </TableCell>
                      </TableRow>
                    ) : logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">{formatDateTime(log.created_at)}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{log.admin_name}</div>
                            <div className="text-xs text-muted-foreground">{log.operator_role}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{ACTION_LABELS[log.action] || log.action}</Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <Badge variant="secondary" className="mr-1">
                              {TARGET_TYPE_LABELS[log.target_type] || log.target_type}
                            </Badge>
                            {log.target_name}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{log.description}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span>{log.ip_address || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => handleViewDetail(log)}>
                            详情
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 登录日志 */}
        <TabsContent value="login">
          <Card>
            <CardContent className="pt-4">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>登录时间</TableHead>
                      <TableHead>用户</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>IP地址</TableHead>
                      <TableHead>位置</TableHead>
                      <TableHead>设备</TableHead>
                      <TableHead>异常</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          暂无数据
                        </TableCell>
                      </TableRow>
                    ) : logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">{formatDateTime(log.login_time)}</TableCell>
                        <TableCell className="font-medium">{log.username}</TableCell>
                        <TableCell>
                          <Badge className={LOGIN_STATUS_LABELS[log.login_status]?.color || ''}>
                            {LOGIN_STATUS_LABELS[log.login_status]?.label || log.login_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{log.ip_address}</TableCell>
                        <TableCell>{log.location || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Monitor className="h-3 w-3 text-muted-foreground" />
                            {log.device || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.is_anomaly ? (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {log.anomaly_reason || '异常'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600 border-green-600">正常</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => handleViewDetail(log)}>
                            详情
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 审核日志 */}
        <TabsContent value="error">
          <Card>
            <CardContent className="pt-4">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>审核时间</TableHead>
                      <TableHead>任务</TableHead>
                      <TableHead>提交用户</TableHead>
                      <TableHead>审核人</TableHead>
                      <TableHead>结果</TableHead>
                      <TableHead>备注</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          暂无数据
                        </TableCell>
                      </TableRow>
                    ) : logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">{formatDateTime(log.reviewedAt)}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium truncate max-w-[200px]">{log.taskTitle}</div>
                            <div className="text-xs text-muted-foreground">{log.platform}</div>
                          </div>
                        </TableCell>
                        <TableCell>{log.username}</TableCell>
                        <TableCell>{log.reviewerName}</TableCell>
                        <TableCell>
                          <Badge className={REVIEW_STATUS_LABELS[log.status]?.color || ''}>
                            {REVIEW_STATUS_LABELS[log.status]?.label || log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{log.reviewNote || '-'}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => handleViewDetail(log)}>
                            详情
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 分页 */}
      {total > pageSize && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            共 {total} 条记录，第 {page}/{totalPages} 页
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 清理对话框 */}
      <AlertDialog open={cleanDialogOpen} onOpenChange={setCleanDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清理过期日志</AlertDialogTitle>
            <AlertDialogDescription>
              选择要清理的日志类型。清理操作将删除超过保留期限的日志记录。
              <div className="mt-4 space-y-2">
                <Button
                  variant={cleaningType === 'operation_logs' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => setCleaningType('operation_logs')}
                >
                  操作日志（保留90天）
                </Button>
                <Button
                  variant={cleaningType === 'login_logs' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => setCleaningType('login_logs')}
                >
                  登录日志（保留90天）
                </Button>
                <Button
                  variant={cleaningType === 'all' ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => setCleaningType('all')}
                >
                  清理全部
                </Button>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCleaningType(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleClean} disabled={!cleaningType || isCleaning}>
              {isCleaning ? '清理中...' : '确认清理'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>日志详情</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(selectedLog).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-muted-foreground">{key}</Label>
                    <div className="text-sm break-all">
                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '-')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setDetailDialogOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
