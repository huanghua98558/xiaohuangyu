'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  WithdrawalItem,
  WithdrawalStats,
  WithdrawalReviewLog,
  getWithdrawalStats,
  getAllWithdrawals,
  processWithdrawal,
  getWithdrawalReviewLogs,
} from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Banknote,
  Clock,
  AlertCircle,
  History,
  Eye,
  Download,
} from 'lucide-react'

export default function WithdrawalsPage() {
  // 统计数据
  const [stats, setStats] = useState<WithdrawalStats | null>(null)
  // 提现列表
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  // 筛选条件
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  // 选中的提现
  const [selectedItem, setSelectedItem] = useState<WithdrawalItem | null>(null)
  const [reviewLogs, setReviewLogs] = useState<WithdrawalReviewLog[]>([])
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  // 操作相关
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'paid' | null>(null)
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pageSize = 20

  // 加载统计数据
  const loadStats = useCallback(async () => {
    try {
      const data = await getWithdrawalStats()
      setStats(data)
    } catch (err) {
      console.error('加载统计失败', err)
    }
  }, [])

  // 加载提现列表
  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getAllWithdrawals({
        page,
        size: pageSize,
        status: statusFilter === 'all' ? undefined : statusFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      })
      setWithdrawals(data.list)
      setTotal(data.total)
    } catch (err) {
      console.error('加载提现列表失败', err)
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setIsLoading(false)
    }
  }, [page, statusFilter, startDate, endDate])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  useEffect(() => {
    loadData()
  }, [loadData])

  const totalPages = Math.ceil(total / pageSize)

  // 打开详情对话框
  const openDetailDialog = async (item: WithdrawalItem) => {
    setSelectedItem(item)
    setShowDetailDialog(true)
    try {
      const logs = await getWithdrawalReviewLogs(item.id)
      setReviewLogs(logs)
    } catch (err) {
      console.error('加载审核记录失败', err)
      setReviewLogs([])
    }
  }

  // 打开操作对话框
  const openActionDialog = (item: WithdrawalItem, action: 'approve' | 'reject' | 'paid') => {
    setSelectedItem(item)
    setActionType(action)
    setNote('')
  }

  // 关闭对话框
  const closeDialog = () => {
    setSelectedItem(null)
    setActionType(null)
    setNote('')
    setShowDetailDialog(false)
  }

  // 执行审核操作
  const handleAction = async () => {
    if (!selectedItem || !actionType) return

    setIsSubmitting(true)
    try {
      await processWithdrawal(selectedItem.id, actionType, note || undefined)
      closeDialog()
      loadData()
      loadStats()
    } catch (err) {
      console.error('操作失败', err)
      alert(err instanceof Error ? err.message : '操作失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 状态徽章
  const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: '待审核', variant: 'secondary' },
      approved: { label: '已通过', variant: 'default' },
      rejected: { label: '已拒绝', variant: 'destructive' },
      paid: { label: '已打款', variant: 'outline' },
    }
    const { label, variant } = config[status] || { label: status, variant: 'outline' }
    return <Badge variant={variant}>{label}</Badge>
  }

  // 格式化时间
  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '-'
    return new Date(timeStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // 格式化金额
  const formatAmount = (amount: number) => {
    return `¥${amount.toFixed(2)}`
  }

  // 获取操作标题
  const getActionTitle = () => {
    switch (actionType) {
      case 'approve':
        return '通过提现申请'
      case 'reject':
        return '拒绝提现申请'
      case 'paid':
        return '确认打款'
      default:
        return ''
    }
  }

  // 获取操作描述
  const getActionDescription = () => {
    if (!selectedItem) return ''
    switch (actionType) {
      case 'approve':
        return `确认通过 ${selectedItem.user?.username || '用户'} 的提现申请 ¥${selectedItem.amount.toFixed(2)}？通过后将等待打款。`
      case 'reject':
        return `确认拒绝 ${selectedItem.user?.username || '用户'} 的提现申请 ¥${selectedItem.amount.toFixed(2)}？拒绝后金额将退回用户余额。`
      case 'paid':
        return `确认已向 ${selectedItem.user?.username || '用户'} 打款 ¥${selectedItem.amount.toFixed(2)}？`
      default:
        return ''
    }
  }

  // 导出数据
  const handleExport = () => {
    // 生成 CSV
    const headers = ['ID', '用户', '金额', '状态', '微信信息', '审核人', '审核时间', '打款时间', '创建时间']
    const rows = withdrawals.map(w => [
      w.id,
      w.user?.username || '',
      w.amount.toFixed(2),
      w.status,
      w.wechatInfo || '',
      w.reviewerId || '',
      w.reviewedAt || '',
      w.paidAt || '',
      w.createdAt
    ])
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `提现记录_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-full">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">待审核</p>
                <p className="text-xl font-bold">{stats?.pendingCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <CheckCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">待打款</p>
                <p className="text-xl font-bold">{stats?.approvedCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-full">
                <Banknote className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">已打款</p>
                <p className="text-xl font-bold">{stats?.paidCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-full">
                <span className="text-green-600 font-bold">¥</span>
              </div>
              <div>
                <p className="text-xs text-gray-500">已打款金额</p>
                <p className="text-xl font-bold">¥{stats?.paidAmount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">已拒绝</p>
                <p className="text-xl font-bold">{stats?.rejectedCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-full">
                <span className="text-red-600 font-bold">¥</span>
              </div>
              <div>
                <p className="text-xs text-gray-500">已拒绝金额</p>
                <p className="text-xl font-bold">¥{stats?.rejectedAmount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选和操作 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm">状态:</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="pending">待审核</SelectItem>
                  <SelectItem value="approved">已通过</SelectItem>
                  <SelectItem value="paid">已打款</SelectItem>
                  <SelectItem value="rejected">已拒绝</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">开始日期:</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">结束日期:</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            <Button variant="outline" onClick={() => { setStartDate(''); setEndDate(''); setStatusFilter('all'); }}>
              重置
            </Button>
            <Button variant="outline" className="ml-auto" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 提现列表 */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center text-red-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-4" />
            <p>{error}</p>
          </CardContent>
        </Card>
      ) : withdrawals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Banknote className="h-12 w-12 mx-auto mb-4" />
            <p>暂无提现记录</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>用户</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>微信信息</TableHead>
                <TableHead>审核时间</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withdrawals.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>{w.id}</TableCell>
                  <TableCell>{w.user?.username || `ID:${w.userId}`}</TableCell>
                  <TableCell className="font-bold text-primary">{formatAmount(w.amount)}</TableCell>
                  <TableCell><StatusBadge status={w.status} /></TableCell>
                  <TableCell>{w.wechatInfo || '-'}</TableCell>
                  <TableCell className="text-sm text-gray-500">{formatTime(w.reviewedAt)}</TableCell>
                  <TableCell className="text-sm text-gray-500">{formatTime(w.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openDetailDialog(w)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {w.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => openActionDialog(w, 'approve')}
                          >
                            通过
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openActionDialog(w, 'reject')}
                          >
                            拒绝
                          </Button>
                        </>
                      )}
                      {w.status === 'approved' && (
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                          onClick={() => openActionDialog(w, 'paid')}
                        >
                          确认打款
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            共 {total} 条记录，第 {page}/{totalPages} 页
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 详情对话框 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>提现详情</DialogTitle>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">用户:</span>
                  <span className="ml-2">{selectedItem.user?.username}</span>
                </div>
                <div>
                  <span className="text-gray-500">金额:</span>
                  <span className="ml-2 font-bold text-primary">{formatAmount(selectedItem.amount)}</span>
                </div>
                <div>
                  <span className="text-gray-500">状态:</span>
                  <span className="ml-2"><StatusBadge status={selectedItem.status} /></span>
                </div>
                <div>
                  <span className="text-gray-500">微信信息:</span>
                  <span className="ml-2">{selectedItem.wechatInfo || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500">申请时间:</span>
                  <span className="ml-2">{formatTime(selectedItem.createdAt)}</span>
                </div>
                <div>
                  <span className="text-gray-500">审核时间:</span>
                  <span className="ml-2">{formatTime(selectedItem.reviewedAt)}</span>
                </div>
                {selectedItem.paidAt && (
                  <div>
                    <span className="text-gray-500">打款时间:</span>
                    <span className="ml-2">{formatTime(selectedItem.paidAt)}</span>
                  </div>
                )}
              </div>
              
              {/* 审核记录 */}
              {reviewLogs.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2 flex items-center gap-1">
                    <History className="h-4 w-4" />
                    审核记录:
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {reviewLogs.map((log) => (
                      <div key={log.id} className="text-sm bg-gray-50 p-2 rounded">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={
                              log.action === 'approve' ? 'default' : 
                              log.action === 'reject' ? 'destructive' : 'outline'
                            } 
                            className="text-xs"
                          >
                            {log.action === 'approve' ? '通过' : 
                             log.action === 'reject' ? '拒绝' : '打款'}
                          </Badge>
                          <span className="text-gray-500">操作人: {log.reviewerName}</span>
                          <span className="text-gray-400 text-xs">
                            {formatTime(log.createdAt)}
                          </span>
                        </div>
                        {log.note && <p className="text-gray-600 mt-1">备注: {log.note}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 操作对话框 */}
      <Dialog open={!!actionType} onOpenChange={() => setActionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getActionTitle()}</DialogTitle>
            <DialogDescription>{getActionDescription()}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="备注（可选）..."
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              取消
            </Button>
            <Button
              variant={actionType === 'reject' ? 'destructive' : 'default'}
              className={actionType !== 'reject' ? 'bg-green-600 hover:bg-green-700' : ''}
              onClick={handleAction}
              disabled={isSubmitting}
            >
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
