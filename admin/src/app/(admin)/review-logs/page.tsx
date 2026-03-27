'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { 
  getTaskReviewLogs, 
  ReviewLogItem,
  ReviewLogListResponse,
  getStoredUser,
  User,
  getClaimById,
  ClaimDetail,
  getClaimReviewLogs,
  ReviewLog,
} from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  FileX,
  Search,
  RefreshCw,
  User as UserIcon,
  Calendar,
  Bot,
  Filter,
  Download,
  Eye,
  MapPin,
  Coins,
  ZoomIn,
  XCircle,
  History,
} from 'lucide-react'
import { exportReviews } from '@/lib/api'

// 图片预览组件
const ImagePreviewModal = ({ 
  imageUrl, 
  onClose,
  currentIndex,
  totalImages,
  onPrev,
  onNext 
}: { 
  imageUrl: string | null
  onClose: () => void
  currentIndex?: number
  totalImages?: number
  onPrev?: () => void
  onNext?: () => void
}) => {
  const [mounted, setMounted] = useState(false)
  const [scale, setScale] = useState(1)
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  useEffect(() => {
    if (imageUrl) {
      document.body.style.overflow = 'hidden'
      setScale(1)
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [imageUrl])
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!imageUrl) return
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && onPrev) onPrev()
      else if (e.key === 'ArrowRight' && onNext) onNext()
      else if (e.key === '+' || e.key === '=') setScale(s => Math.min(s + 0.5, 5))
      else if (e.key === '-') setScale(s => Math.max(s - 0.5, 0.5))
      else if (e.key === '0') setScale(1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [imageUrl, onClose, onPrev, onNext])
  
  if (!mounted || !imageUrl) return null
  
  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      <button 
        className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors z-10 bg-black/50 rounded-full p-2"
        onClick={onClose}
      >
        <XCircle className="h-8 w-8" />
      </button>
      {totalImages && totalImages > 1 && (
        <>
          <div className="absolute top-4 left-4 text-white/80 z-10 bg-black/50 rounded-lg px-3 py-1 text-sm">
            {currentIndex! + 1} / {totalImages}
          </div>
          <button 
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white z-10 bg-black/50 rounded-full p-2"
            onClick={(e) => { e.stopPropagation(); onPrev?.(); }}
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          <button 
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white z-10 bg-black/50 rounded-full p-2"
            onClick={(e) => { e.stopPropagation(); onNext?.(); }}
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        </>
      )}
      <img 
        src={imageUrl} 
        alt="预览" 
        className="max-w-[95vw] max-h-[95vh] object-contain transition-transform duration-200"
        style={{ transform: `scale(${scale})` }}
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />
    </div>,
    document.body
  )
}

export default function ReviewLogsPage() {
  const router = useRouter()
  const [logs, setLogs] = useState<ReviewLogItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  
  // 筛选条件
  const [filterTaskId, setFilterTaskId] = useState('')
  const [filterClaimId, setFilterClaimId] = useState('')
  const [filterReviewerId, setFilterReviewerId] = useState('')
  const [filterAction, setFilterAction] = useState<string>('all')
  
  // 导出状态
  const [isExporting, setIsExporting] = useState(false)
  
  // 详情弹窗
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [selectedClaimId, setSelectedClaimId] = useState<number | null>(null)
  const [claimDetail, setClaimDetail] = useState<ClaimDetail | null>(null)
  const [claimLogs, setClaimLogs] = useState<ReviewLog[]>([])
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  
  // 图片预览
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewImageIndex, setPreviewImageIndex] = useState(0)
  const [previewImages, setPreviewImages] = useState<string[]>([])
  
  const pageSize = 20
  
  const loadLogs = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: {
        page: number
        size: number
        taskId?: number
        claimId?: number
        reviewerId?: number
        action?: string
      } = { page, size: pageSize }
      
      if (filterTaskId) params.taskId = parseInt(filterTaskId)
      if (filterClaimId) params.claimId = parseInt(filterClaimId)
      if (filterReviewerId) params.reviewerId = parseInt(filterReviewerId)
      if (filterAction && filterAction !== 'all') params.action = filterAction
      
      const data = await getTaskReviewLogs(params)
      setLogs(data.list)
      setTotal(data.total)
    } catch (err) {
      console.error('加载审核记录失败', err)
    } finally {
      setIsLoading(false)
    }
  }, [page, filterTaskId, filterClaimId, filterReviewerId, filterAction])
  
  useEffect(() => {
    setCurrentUser(getStoredUser())
  }, [])
  
  useEffect(() => {
    loadLogs()
  }, [loadLogs])
  
  const handleSearch = () => {
    setPage(1)
    loadLogs()
  }
  
  const handleReset = () => {
    setFilterTaskId('')
    setFilterClaimId('')
    setFilterReviewerId('')
    setFilterAction('all')
    setPage(1)
  }
  
  const handleViewClaim = async (claimId: number | string) => {
    const claimIdNum = typeof claimId === 'string' ? parseInt(claimId, 10) : claimId
    console.log('handleViewClaim called with claimId:', claimId, 'converted to:', claimIdNum)
    setSelectedClaimId(claimIdNum)
    setShowDetailDialog(true)
    setIsLoadingDetail(true)
    try {
      console.log('Fetching claim detail for id:', claimIdNum)
      // 获取详情（主要数据）
      const detail = await getClaimById(claimIdNum)
      console.log('Claim detail result:', detail)
      setClaimDetail(detail)
      
      // 尝试获取审核日志（可选数据，失败不影响主流程）
      try {
        const logs = await getClaimReviewLogs(claimIdNum)
        console.log('Claim logs result:', logs)
        setClaimLogs(logs)
      } catch (logErr) {
        console.warn('获取审核日志失败（可忽略）:', logErr)
        setClaimLogs([])
      }
    } catch (err) {
      console.error('获取提交详情失败', err)
      setClaimDetail(null)
      setClaimLogs([])
    } finally {
      setIsLoadingDetail(false)
    }
  }
  
  const totalPages = Math.ceil(total / pageSize)
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }
  
  const getPlatformName = (platform: string) => {
    // 数据库已统一使用中文，直接返回或兼容旧数据
    const map: Record<string, string> = {
      '抖音': '抖音',
      '快手': '快手',
      '小红书': '小红书',
      '视频号': '视频号',
      // 兼容旧数据
      douyin: '抖音',
      kuaishou: '快手',
      xiaohongshu: '小红书',
      weibo: '视频号',
      shipinhao: '视频号',
    }
    return map[platform] || platform
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">共 {total} 条记录，点击行可查看详情</p>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => router.push('/trace')}
          >
            <History className="h-4 w-4 mr-2" />
            追溯查询
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={async () => {
              setIsExporting(true)
              try {
                await exportReviews({
                  status: filterAction !== 'all' ? filterAction : undefined,
                })
              } catch (err) {
                console.error('导出失败', err)
                alert('导出失败')
              } finally {
                setIsExporting(false)
              }
            }}
            disabled={isExporting}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? '导出中...' : '导出CSV'}
          </Button>
          <Button variant="outline" size="sm" onClick={loadLogs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
        </div>
      </div>
      
      {/* 筛选条件 */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" />
            筛选条件
          </CardTitle>
        </CardHeader>
        <CardContent className="py-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-500">任务ID</label>
              <Input 
                placeholder="输入任务ID" 
                value={filterTaskId}
                onChange={(e) => setFilterTaskId(e.target.value)}
                type="number"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">提交ID</label>
              <Input 
                placeholder="输入提交ID" 
                value={filterClaimId}
                onChange={(e) => setFilterClaimId(e.target.value)}
                type="number"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">审核员ID</label>
              <Input 
                placeholder="输入审核员ID" 
                value={filterReviewerId}
                onChange={(e) => setFilterReviewerId(e.target.value)}
                type="number"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">审核动作</label>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger>
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="approve">通过</SelectItem>
                  <SelectItem value="reject">拒绝</SelectItem>
                  <SelectItem value="manual">转人工</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button size="sm" onClick={handleSearch}>
                <Search className="h-4 w-4 mr-1" />
                查询
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset}>
                重置
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* 统计信息 */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>共 {total} 条记录</span>
        {currentUser && (
          <span>当前用户: {currentUser.username} (ID: {currentUser.id})</span>
        )}
      </div>
      
      {/* 数据表格 */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">暂无审核记录</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">ID</TableHead>
                  <TableHead className="w-20">提交ID</TableHead>
                  <TableHead className="w-32">任务编号</TableHead>
                  <TableHead className="w-24">任务标题</TableHead>
                  <TableHead>用户</TableHead>
                  <TableHead className="w-24">审核员</TableHead>
                  <TableHead className="w-20">动作</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead className="w-40">时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow 
                    key={log.id}
                    className="cursor-pointer hover:bg-blue-50"
                    onClick={() => handleViewClaim(log.claimId)}
                  >
                    <TableCell className="font-mono text-xs">{log.id}</TableCell>
                    <TableCell className="font-mono text-xs">{log.claimId}</TableCell>
                    <TableCell>
                      <div className="font-mono text-xs text-blue-600" title={log.taskCode || ''}>
                        {log.taskCode || `TASK-${log.taskId}`}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[120px] truncate text-xs" title={log.taskTitle}>
                        {log.taskTitle}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <UserIcon className="h-3 w-3 text-gray-400" />
                        <span className="text-xs">{log.userName || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {log.isAiReview ? (
                          <>
                            <Bot className="h-3 w-3 text-purple-500" />
                            <span className="text-xs text-purple-600 font-medium">AI审核</span>
                          </>
                        ) : (
                          <>
                            <UserIcon className="h-3 w-3 text-gray-400" />
                            <span className="text-xs">{log.reviewerName}</span>
                          </>
                        )}
                      </div>
                      {!log.isAiReview && <div className="text-[10px] text-gray-400">ID: {log.reviewerId}</div>}
                      {log.isAiReview && log.aiConfidence !== undefined && (
                        <div className="text-[10px] text-gray-400">置信度: {(log.aiConfidence * 100).toFixed(0)}%</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.action === 'approve' ? (
                        <Badge className="bg-green-100 text-green-700 text-xs">
                          <FileCheck className="h-3 w-3 mr-1" />
                          通过
                        </Badge>
                      ) : log.action === 'manual' ? (
                        <Badge className="bg-orange-100 text-orange-700 text-xs">
                          <History className="h-3 w-3 mr-1" />
                          转人工
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 text-xs">
                          <FileX className="h-3 w-3 mr-1" />
                          拒绝
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[150px] truncate text-xs" title={log.note || ''}>
                        {log.note || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs">
                        <Calendar className="h-3 w-3 text-gray-400" />
                        {formatDate(log.createdAt)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            第 {page} / {totalPages} 页
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
      {/* 详情弹窗 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Eye className="h-4 w-4" />
              提交详情 (ID: {selectedClaimId})
            </DialogTitle>
          </DialogHeader>
          {isLoadingDetail ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : claimDetail ? (
            <div className="space-y-3 text-xs overflow-y-auto flex-1">
              {/* 任务信息 */}
              {claimDetail.task && (
                <div className="bg-gray-50 p-2 rounded-lg">
                  <div className="flex items-center gap-1 text-gray-500 mb-1.5">
                    <FileCheck className="h-3 w-3" />
                    <span className="font-medium">任务信息</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div><span className="text-gray-400">任务ID：</span>{claimDetail.task.id}</div>
                    <div><span className="text-gray-400">平台：</span>{getPlatformName(claimDetail.task.platform)}</div>
                    <div className="col-span-2"><span className="text-gray-400">标题：</span>{claimDetail.task.title}</div>
                  </div>
                </div>
              )}
              
              {/* 用户信息 */}
              <div className="bg-gray-50 p-2 rounded-lg">
                <div className="flex items-center gap-1 text-gray-500 mb-1.5">
                  <UserIcon className="h-3 w-3" />
                  <span className="font-medium">用户信息</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <div><span className="text-gray-400">用户名：</span><span className="font-medium">{claimDetail.user?.username || `ID:${claimDetail.userId}`}</span></div>
                  <div><span className="text-gray-400">平台昵称：</span>{claimDetail.platformNickname || '-'}</div>
                  <div className="flex items-center gap-1"><MapPin className="h-3 w-3 text-gray-400" /><span className="text-gray-400">城市：</span>{claimDetail.city || '-'}{claimDetail.province ? ` (${claimDetail.province})` : ''}</div>
                  <div className="flex items-center gap-1"><Coins className="h-3 w-3 text-gray-400" /><span className="text-gray-400">奖励：</span><span className="text-primary font-bold">{claimDetail.reward}积分</span></div>
                </div>
              </div>
              
              {/* 时间信息 */}
              <div className="bg-gray-50 p-2 rounded-lg">
                <div className="flex items-center gap-1 text-gray-500 mb-1.5">
                  <Calendar className="h-3 w-3" />
                  <span className="font-medium">时间信息</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <div><span className="text-gray-400">领取时间：</span>{new Date(claimDetail.claimedAt).toLocaleString('zh-CN')}</div>
                  <div><span className="text-gray-400">提交时间：</span>{claimDetail.submittedAt ? new Date(claimDetail.submittedAt).toLocaleString('zh-CN') : '-'}</div>
                  {claimDetail.reviewedAt && (
                    <div><span className="text-gray-400">审核时间：</span>{new Date(claimDetail.reviewedAt).toLocaleString('zh-CN')}</div>
                  )}
                  {claimDetail.submittedAt && claimDetail.claimedAt && (
                    <div>
                      <span className="text-gray-400">完成用时：</span>
                      <span className="text-green-600">
                        {(() => {
                          const diff = new Date(claimDetail.submittedAt).getTime() - new Date(claimDetail.claimedAt).getTime()
                          const minutes = Math.floor(diff / 60000)
                          const seconds = Math.floor((diff % 60000) / 1000)
                          if (minutes > 60) {
                            const hours = Math.floor(minutes / 60)
                            const remainMins = minutes % 60
                            return `${hours}小时${remainMins}分`
                          }
                          return `${minutes}分${seconds}秒`
                        })()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* 状态 */}
              <div className="bg-gray-50 p-2 rounded-lg">
                <div className="text-gray-500 mb-1">审核状态：</div>
                {claimDetail.status === 'done' ? (
                  <Badge className="bg-green-100 text-green-700"><FileCheck className="h-3 w-3 mr-1" />已通过</Badge>
                ) : claimDetail.status === 'rejected' ? (
                  <Badge className="bg-red-100 text-red-700"><FileX className="h-3 w-3 mr-1" />已拒绝</Badge>
                ) : claimDetail.status === 'submitted' ? (
                  <Badge className="bg-blue-100 text-blue-700">已提交</Badge>
                ) : claimDetail.status === 'image_reviewing' ? (
                  <Badge className="bg-purple-100 text-purple-700">图片审核中</Badge>
                ) : claimDetail.status === 'image_failed' ? (
                  <Badge className="bg-orange-100 text-orange-700">图片审核失败</Badge>
                ) : claimDetail.status === 'link_reviewing' ? (
                  <Badge className="bg-cyan-100 text-cyan-700">链接审核中</Badge>
                ) : claimDetail.status === 'pending_manual' ? (
                  <Badge className="bg-yellow-100 text-yellow-700">待人工审核</Badge>
                ) : (
                  <Badge className="bg-gray-100 text-gray-700">{claimDetail.status}</Badge>
                )}
              </div>
              
              {/* 图片审核状态 */}
              {claimDetail.image_review_status && (
                <div className="bg-gray-50 p-2 rounded-lg">
                  <div className="text-gray-500 mb-1">图片审核：</div>
                  {claimDetail.image_review_status === 'passed' ? (
                    <Badge className="bg-green-100 text-green-700">通过</Badge>
                  ) : claimDetail.image_review_status === 'failed' ? (
                    <div>
                      <Badge className="bg-red-100 text-red-700">失败</Badge>
                      {claimDetail.image_review_reason && (
                        <div className="text-[10px] text-red-600 mt-1 bg-red-50 p-1 rounded">原因: {claimDetail.image_review_reason}</div>
                      )}
                    </div>
                  ) : claimDetail.image_review_status === 'pending' ? (
                    <Badge className="bg-yellow-100 text-yellow-700">待审核</Badge>
                  ) : claimDetail.image_review_status === 'reviewing' ? (
                    <Badge className="bg-blue-100 text-blue-700">审核中</Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-700">{claimDetail.image_review_status}</Badge>
                  )}
                </div>
              )}
              
              {/* 链接审核状态 */}
              {claimDetail.link_review_status && (
                <div className="bg-gray-50 p-2 rounded-lg">
                  <div className="text-gray-500 mb-1">链接审核：</div>
                  {claimDetail.link_review_status === 'passed' ? (
                    <Badge className="bg-green-100 text-green-700">通过</Badge>
                  ) : claimDetail.link_review_status === 'failed' ? (
                    <div>
                      <Badge className="bg-red-100 text-red-700">失败</Badge>
                      {claimDetail.link_review_reason && (
                        <div className="text-[10px] text-red-600 mt-1 bg-red-50 p-1 rounded">原因: {claimDetail.link_review_reason}</div>
                      )}
                    </div>
                  ) : claimDetail.link_review_status === 'pending' ? (
                    <Badge className="bg-yellow-100 text-yellow-700">待审核</Badge>
                  ) : claimDetail.link_review_status === 'reviewing' ? (
                    <Badge className="bg-blue-100 text-blue-700">审核中</Badge>
                  ) : claimDetail.link_review_status === 'skipped' ? (
                    <Badge className="bg-gray-100 text-gray-700">已跳过</Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-700">{claimDetail.link_review_status}</Badge>
                  )}
                </div>
              )}
              
              {/* 封控状态 */}
              {claimDetail.block_status && claimDetail.block_status !== 'none' && (
                <div className="bg-orange-50 p-2 rounded-lg border border-orange-200">
                  <div className="text-gray-500 mb-1">封控状态：</div>
                  {claimDetail.block_status === 'suspected' ? (
                    <Badge className="bg-orange-100 text-orange-700"><AlertTriangle className="h-3 w-3 mr-1" />疑似封控</Badge>
                  ) : claimDetail.block_status === 'confirmed' ? (
                    <Badge className="bg-red-100 text-red-700"><XCircle className="h-3 w-3 mr-1" />已确认封控</Badge>
                  ) : claimDetail.block_status === 'false_positive' ? (
                    <Badge className="bg-blue-100 text-blue-700"><CheckCircle className="h-3 w-3 mr-1" />误报</Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-700">{claimDetail.block_status}</Badge>
                  )}
                </div>
              )}
              
              {/* 凭证图片 */}
              {claimDetail.screenshotUrls && claimDetail.screenshotUrls.length > 0 ? (
                <div className="bg-gray-50 p-2 rounded-lg">
                  <div className="flex items-center gap-1 text-gray-500 mb-1.5">
                    <Eye className="h-3 w-3" />
                    <span className="font-medium">凭证图片（{claimDetail.screenshotUrls.length}张）</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {claimDetail.screenshotUrls.map((img: string, i: number) => (
                      <div 
                        key={i} 
                        className="relative group cursor-pointer"
                        onClick={() => {
                          setPreviewImages(claimDetail.screenshotUrls || [])
                          setPreviewImageIndex(i)
                          setPreviewImage(img)
                        }}
                      >
                        <img 
                          src={img} 
                          alt={`凭证${i+1}`} 
                          className="w-full h-20 object-cover rounded border hover:border-blue-400 transition-colors" 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                          <ZoomIn className="h-5 w-5 text-white" />
                        </div>
                        <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1 rounded">
                          {i + 1}/{claimDetail.screenshotUrls!.length}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">点击图片可放大查看</p>
                </div>
              ) : (
                <div className="bg-gray-50 p-2 rounded-lg text-center text-gray-400 text-xs">
                  <Eye className="h-6 w-6 mx-auto mb-1 opacity-50" />
                  暂无凭证图片
                </div>
              )}
              
              {/* 审核备注 */}
              {claimDetail.reviewNote && (
                <div className="bg-yellow-50 p-2 rounded-lg border border-yellow-200">
                  <div className="text-gray-500 mb-0.5">审核备注：</div>
                  <p className="text-gray-700">{claimDetail.reviewNote}</p>
                </div>
              )}
              
              {/* 审核历史记录 */}
              {claimDetail.review_history && claimDetail.review_history.length > 0 && (
                <div className="bg-orange-50 p-2 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-1 text-orange-600 mb-1.5">
                    <History className="h-3 w-3" />
                    <span className="font-medium">审核历史（共 {claimDetail.review_history.length} 次）</span>
                    {claimDetail.reject_count && claimDetail.reject_count > 0 && (
                      <span className="ml-1 text-red-600 font-normal">- 已拒绝 {claimDetail.reject_count} 次</span>
                    )}
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {claimDetail.review_history.map((h, i) => (
                      <div key={i} className="text-[10px] text-gray-600 bg-white/50 p-1.5 rounded">
                        <span className="text-gray-400">{new Date(h.timestamp).toLocaleString('zh-CN')}</span>
                        <span className={`ml-2 ${h.action.includes('rejected') ? 'text-red-600' : 'text-green-600'}`}>
                          {h.action === 'image_rejected' ? '图片审核未通过' : 
                           h.action === 'link_rejected' ? '链接验证未通过' : 
                           h.action === 'approved' ? '通过' : h.action}
                        </span>
                        {h.data?.reason && <span className="text-gray-500 ml-1">: {h.data.reason}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 审核记录 */}
              {claimLogs.length > 0 && (
                <div className="border-t pt-2">
                  <div className="text-gray-500 mb-1">审核记录：</div>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {claimLogs.map((log, i) => (
                      <div key={i} className="text-[10px] text-gray-600 bg-gray-50 p-1.5 rounded">
                        <span className="text-gray-400">{new Date(log.createdAt).toLocaleString('zh-CN')}</span>
                        <span className={`ml-2 ${log.action === 'approve' ? 'text-green-600' : 'text-red-600'}`}>
                          {log.action === 'approve' ? '通过' : '拒绝'}
                        </span>
                        {log.reviewerName && <span className="ml-1">by {log.reviewerName}</span>}
                        {log.note && <span className="text-gray-500 ml-1">: {log.note}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">未找到提交详情</div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* 图片预览弹窗 */}
      <ImagePreviewModal 
        imageUrl={previewImage} 
        onClose={() => {
          setPreviewImage(null)
          setPreviewImages([])
          setPreviewImageIndex(0)
        }}
        currentIndex={previewImageIndex}
        totalImages={previewImages.length}
        onPrev={() => {
          if (previewImages.length > 0) {
            const newIndex = previewImageIndex > 0 ? previewImageIndex - 1 : previewImages.length - 1
            setPreviewImageIndex(newIndex)
            setPreviewImage(previewImages[newIndex])
          }
        }}
        onNext={() => {
          if (previewImages.length > 0) {
            const newIndex = previewImageIndex < previewImages.length - 1 ? previewImageIndex + 1 : 0
            setPreviewImageIndex(newIndex)
            setPreviewImage(previewImages[newIndex])
          }
        }}
      />
    </div>
  )
}
