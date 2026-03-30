'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertTriangle, CheckCircle, Clock, Filter, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminWebSocket } from '@/hooks/useAdminWebSocket'
import { playAdminNotificationSound, registerAdminNotificationSoundUnlock } from '@/lib/notification-sound'

interface Alert {
  id: number
  alert_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  related_entity_type: string
  related_entity_id: number
  metadata: any
  status: 'pending' | 'handling' | 'resolved' | 'ignored'
  handler_id: number | null
  handler_name: string | null
  handled_at: string | null
  handle_note: string | null
  created_at: string
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  // 筛选条件
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('pending')
  const [filterSeverity, setFilterSeverity] = useState('all')

  // 处理对话框
  const [handleDialogOpen, setHandleDialogOpen] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)
  const [handleNote, setHandleNote] = useState('')
  const [handleAction, setHandleAction] = useState<'resolve' | 'ignore'>('resolve')

  // 统计数据
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    handling: 0,
    resolved: 0,
    critical: 0
  })

  // WebSocket real-time alert notifications
  const { connected: wsConnected } = useAdminWebSocket(
    ['system_alert'],
    (data: any) => {
      if (data) {
        playAdminNotificationSound('alert').catch(() => null)
        toast.warning(data.name || data.message || 'New alert', {
          description: data.message
        })
        loadAlerts()
        loadStats()
      }
    }
  )

  // 加载告警列表
  const loadAlerts = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const params = new URLSearchParams()
      params.append('page', page.toString())
      params.append('pageSize', pageSize.toString())
      if (filterType !== 'all') params.append('alertType', filterType)
      if (filterStatus !== 'all') params.append('status', filterStatus)
      if (filterSeverity !== 'all') params.append('severity', filterSeverity)

      const response = await fetch(`/admin/api/admin-v2/alerts?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.code === 0) {
        setAlerts(data.data?.list || [])
        setTotal(data.data?.total || 0)
      } else {
        toast.error(data.message || '加载失败')
      }
    } catch (error) {
      toast.error('加载告警列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 加载统计
  const loadStats = async () => {
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/admin/api/admin-v2/alerts/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.code === 0) {
        setStats(data.data || stats)
      }
    } catch (error) {
      console.error('加载统计失败:', error)
    }
  }

  // 初始加载
  useEffect(() => {
    registerAdminNotificationSoundUnlock()
    loadAlerts()
    loadStats()
  }, [page, filterType, filterStatus, filterSeverity])

  // 打开处理对话框
  const openHandleDialog = (alert: Alert) => {
    setSelectedAlert(alert)
    setHandleNote('')
    setHandleAction('resolve')
    setHandleDialogOpen(true)
  }

  // 处理告警
  const handleAlert = async () => {
    if (!selectedAlert) return
    if (!handleNote.trim()) {
      toast.error('请填写处理说明')
      return
    }

    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch(`/admin/api/admin-v2/alerts/${selectedAlert.id}/handle`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: handleAction,
          note: handleNote
        })
      })
      const data = await response.json()
      if (data.code === 0) {
        toast.success(handleAction === 'resolve' ? '告警已解决' : '告警已忽略')
        setHandleDialogOpen(false)
        loadAlerts()
        loadStats()
      } else {
        toast.error(data.message || '处理失败')
      }
    } catch (error) {
      toast.error('处理失败')
    }
  }

  // 格式化时间
  const formatTime = (time: string) => {
    if (!time) return '-'
    return new Date(time).toLocaleString('zh-CN')
  }

  // 格式化告警类型
  const formatAlertType = (type: string) => {
    const map: Record<string, string> = {
      'abnormal_operation': '异常操作',
      'batch_operation': '批量操作',
      'sensitive_data': '敏感数据访问',
      'permission_change': '权限变更',
      'suspicious_login': '可疑登录',
      'data_tampering': '数据篡改风险'
    }
    return map[type] || type
  }

  // 获取严重级别样式
  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500 text-white'
      case 'high':
        return 'bg-orange-500 text-white'
      case 'medium':
        return 'bg-yellow-500 text-white'
      case 'low':
        return 'bg-blue-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  // 获取状态样式
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'handling':
        return 'bg-blue-100 text-blue-800'
      case 'resolved':
        return 'bg-green-100 text-green-800'
      case 'ignored':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // 格式化状态
  const formatStatus = (status: string) => {
    const map: Record<string, string> = {
      'pending': '待处理',
      'handling': '处理中',
      'resolved': '已解决',
      'ignored': '已忽略'
    }
    return map[status] || status
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">系统安全告警监控与处理</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总告警数</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待处理</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">处理中</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.handling}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已解决</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">高危告警</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
          </CardContent>
        </Card>
      </div>

      {/* 告警列表 */}
      <Card>
        <CardHeader>
          <CardTitle>告警列表</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 筛选条件 */}
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="告警类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="abnormal_operation">异常操作</SelectItem>
                  <SelectItem value="batch_operation">批量操作</SelectItem>
                  <SelectItem value="sensitive_data">敏感数据访问</SelectItem>
                  <SelectItem value="permission_change">权限变更</SelectItem>
                  <SelectItem value="suspicious_login">可疑登录</SelectItem>
                  <SelectItem value="data_tampering">数据篡改风险</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="pending">待处理</SelectItem>
                  <SelectItem value="handling">处理中</SelectItem>
                  <SelectItem value="resolved">已解决</SelectItem>
                  <SelectItem value="ignored">已忽略</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger>
                  <SelectValue placeholder="严重级别" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部级别</SelectItem>
                  <SelectItem value="critical">严重</SelectItem>
                  <SelectItem value="high">高</SelectItem>
                  <SelectItem value="medium">中</SelectItem>
                  <SelectItem value="low">低</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 表格 */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>严重级别</TableHead>
                <TableHead>告警类型</TableHead>
                <TableHead>告警标题</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>处理人</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    暂无告警记录
                  </TableCell>
                </TableRow>
              ) : (
                alerts.map((alert) => (
                  <TableRow key={alert.id} className={alert.severity === 'critical' ? 'bg-red-50 dark:bg-red-950' : ''}>
                    <TableCell>
                      <Badge className={getSeverityStyle(alert.severity)}>
                        {alert.severity.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatAlertType(alert.alert_type)}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{alert.title}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-xs">
                          {alert.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusStyle(alert.status)}>
                        {formatStatus(alert.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatTime(alert.created_at)}</TableCell>
                    <TableCell>{alert.handler_name || '-'}</TableCell>
                    <TableCell className="text-right">
                      {alert.status === 'pending' && (
                        <Button size="sm" onClick={() => openHandleDialog(alert)}>
                          处理
                        </Button>
                      )}
                      {alert.status !== 'pending' && (
                        <Button size="sm" variant="outline" onClick={() => openHandleDialog(alert)}>
                          <Eye className="h-4 w-4 mr-1" />
                          查看
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* 分页 */}
          {total > pageSize && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                上一页
              </Button>
              <span className="py-2 px-4 text-sm">
                {page} / {Math.ceil(total / pageSize)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= Math.ceil(total / pageSize)}
                onClick={() => setPage(page + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 处理对话框 */}
      <Dialog open={handleDialogOpen} onOpenChange={setHandleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedAlert?.status === 'pending' ? '处理告警' : '告警详情'}</DialogTitle>
          </DialogHeader>
          
          {selectedAlert && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">告警类型</Label>
                  <p className="font-medium">{formatAlertType(selectedAlert.alert_type)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">严重级别</Label>
                  <p><Badge className={getSeverityStyle(selectedAlert.severity)}>{selectedAlert.severity.toUpperCase()}</Badge></p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">告警标题</Label>
                  <p className="font-medium">{selectedAlert.title}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">详细描述</Label>
                  <p className="text-sm">{selectedAlert.description}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">创建时间</Label>
                  <p className="text-sm">{formatTime(selectedAlert.created_at)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">状态</Label>
                  <p><Badge className={getStatusStyle(selectedAlert.status)}>{formatStatus(selectedAlert.status)}</Badge></p>
                </div>
                {selectedAlert.handler_name && (
                  <>
                    <div>
                      <Label className="text-muted-foreground">处理人</Label>
                      <p className="text-sm">{selectedAlert.handler_name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">处理时间</Label>
                      <p className="text-sm">{formatTime(selectedAlert.handled_at || '')}</p>
                    </div>
                    {selectedAlert.handle_note && (
                      <div className="col-span-2">
                        <Label className="text-muted-foreground">处理说明</Label>
                        <p className="text-sm">{selectedAlert.handle_note}</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {selectedAlert.status === 'pending' && (
                <>
                  <div className="space-y-2">
                    <Label>处理方式</Label>
                    <div className="flex gap-4">
                      <Button
                        variant={handleAction === 'resolve' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setHandleAction('resolve')}
                      >
                        解决
                      </Button>
                      <Button
                        variant={handleAction === 'ignore' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setHandleAction('ignore')}
                      >
                        忽略
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>处理说明 *</Label>
                    <Textarea
                      placeholder="请详细描述处理过程和结果..."
                      value={handleNote}
                      onChange={e => setHandleNote(e.target.value)}
                      rows={3}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setHandleDialogOpen(false)}>
              取消
            </Button>
            {selectedAlert?.status === 'pending' && (
              <Button onClick={handleAlert}>
                确认处理
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
