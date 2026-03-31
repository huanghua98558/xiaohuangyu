'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CheckCircle, XCircle, Bot, RefreshCw, Scan, Globe, ClipboardCheck,
  ChevronLeft, ChevronRight, Eye, Clock, TrendingUp,
  FileText, ExternalLink, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAdminWebSocket } from '@/hooks/useAdminWebSocket'

interface Task { id: number; title: string; platform: string; action: string }
interface UserInfo { id: number; username: string }
interface ReviewItem {
  id: number; user_id: number; task_id: number; screenshots: string;
  status: string; ai_review_status?: string; ai_confidence?: number; ai_reason?: string;
  claimed_at: string; tasks?: Task; users?: UserInfo
}
interface LogItem {
  id: number; user_id: number; task_id: number; screenshots: string;
  status: string; ai_review_status: string; ai_confidence?: number; ai_reason?: string;
  review_note?: string; claimed_at: string; reviewed_at?: string;
  tasks?: Task; users?: UserInfo
}
interface Stats {
  total: number; pending: number; aiApproved: number; aiRejected: number;
  manual: number; autoRate: number; imageReviewing?: number; linkReviewing?: number
}

const PLATFORM_NAMES: Record<string, string> = { 
  xiaohongshu: '小红书', douyin: '抖音', weibo: '微博', kuaishou: '快手', bilibili: 'B站' 
}
const PLATFORM_COLORS: Record<string, string> = {
  xiaohongshu: 'text-rose-400', douyin: 'text-cyan-400', weibo: 'text-orange-400',
  kuaishou: 'text-amber-400', bilibili: 'text-sky-400'
}
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  'image_reviewing': { label: 'OCR处理', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  'link_reviewing': { label: '链接审核', color: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
  'pending': { label: 'AI审核', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  'manual': { label: '待人工', color: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
  'approved': { label: '已通过', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  'rejected': { label: '已拒绝', color: 'bg-red-500/10 text-red-600 border-red-500/30' },
}

export default function AIReviewerPage() {
  const [activeTab, setActiveTab] = useState('manual')
  const [queue, setQueue] = useState<ReviewItem[]>([])
  const [ocrQueue, setOcrQueue] = useState<ReviewItem[]>([])
  const [aiQueue, setAiQueue] = useState<ReviewItem[]>([])
  const [linkQueue, setLinkQueue] = useState<ReviewItem[]>([])
  const [logsQueue, setLogsQueue] = useState<LogItem[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, aiApproved: 0, aiRejected: 0, manual: 0, autoRate: 0 })
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null)
  const [selectedLog, setSelectedLog] = useState<LogItem | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showLogDetail, setShowLogDetail] = useState(false)
  const [showImagePreview, setShowImagePreview] = useState(false)
  const [previewImages, setPreviewImages] = useState<string[]>([])
  const [previewIndex, setPreviewIndex] = useState(0)
  const [reviewNote, setReviewNote] = useState('')
  const [processing, setProcessing] = useState(false)

  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
    return { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
  }

  const loadAllData = async () => {
    try {
      const headers = getAuthHeaders()
      const [queueRes, ocrRes, aiRes, linkRes, logsRes, statsRes] = await Promise.all([
        fetch('/admin/api/ai/reviewer/queue', { headers }),
        fetch('/admin/api/ai/reviewer/queue?status=image_reviewing', { headers }),
        fetch('/admin/api/ai/reviewer/queue?status=pending', { headers }),
        fetch('/admin/api/ai/reviewer/queue?status=link_reviewing', { headers }),
        fetch('/admin/api/ai/reviewer/logs', { headers }),
        fetch('/admin/api/ai/reviewer/stats', { headers })
      ])
      
      const [queueData, ocrData, aiData, linkData, logsData, statsData] = await Promise.all([
        queueRes.json(), ocrRes.json(), aiRes.json(), linkRes.json(), logsRes.json(), statsRes.json()
      ])
      
      if (queueData.code === 200) setQueue(queueData.data.list || [])
      if (ocrData.code === 200) setOcrQueue(ocrData.data.list || [])
      if (aiData.code === 200) setAiQueue(aiData.data.list || [])
      if (linkData.code === 200) setLinkQueue(linkData.data.list || [])
      if (logsData.code === 200) setLogsQueue(logsData.data.list || [])
      if (statsData.code === 200) setStats(statsData.data)
    } catch (e) {
      console.error('加载数据失败:', e)
    } finally {
      setLoading(false)
    }
  }

  const { connected: wsConnected } = useAdminWebSocket(
    ['ai_review_update', 'system_alert'],
    (data: any) => {
      loadAllData()
    }
  )

  useEffect(() => { 
    loadAllData()
  }, [])

  const handleManualReview = async (claimId: number, action: 'approve' | 'reject', note?: string) => {
    if (processing) return
    setProcessing(true)
    try {
      const res = await fetch('/admin/api/ai/reviewer/manual', { 
        method: 'POST', 
        headers: getAuthHeaders(), 
        body: JSON.stringify({ claimId, action, note: note || '' }) 
      })
      const data = await res.json()
      if (data.code === 200) { 
        toast.success(action === 'approve' ? '已通过' : '已拒绝')
        setShowDetail(false)
        setSelectedItem(null)
        setReviewNote('')
        // 重新加载数据
        await loadAllData()
      } else {
        toast.error(data.message || '操作失败')
      }
    } catch (e) { 
      toast.error('操作失败') 
    } finally {
      setProcessing(false)
    }
  }

  const openImagePreview = (images: string[], index: number = 0) => { 
    setPreviewImages(images)
    setPreviewIndex(index)
    setShowImagePreview(true)
  }
  
  const parseScreenshots = (s: string | null | undefined): string[] => { 
    if (!s) return []
    try { return JSON.parse(s) } catch { return [] }
  }
  
  const getStatusBadge = (item: ReviewItem) => {
    const statusKey = item.ai_review_status || item.status
    const statusInfo = STATUS_LABELS[statusKey]
    if (statusInfo) return <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5", statusInfo.color)}>{statusInfo.label}</Badge>
    return null
  }
  
  const getTaskLink = (item: ReviewItem | LogItem) => `/admin/tasks?taskId=${item.task_id}`

  const tabs = [
    { key: 'manual', label: '待人工', count: stats.manual, icon: ClipboardCheck },
    { key: 'all', label: '全部队列', count: null, icon: Eye },
    { key: 'ocr', label: 'OCR', count: stats.imageReviewing, icon: Scan },
    { key: 'ai', label: 'AI审核', count: stats.pending, icon: Bot },
    { key: 'link', label: '链接', count: stats.linkReviewing, icon: Globe },
  ]

  const getList = () => {
    switch (activeTab) {
      case 'manual': return queue.filter(item => item.ai_review_status === 'manual')
      case 'ocr': return ocrQueue
      case 'ai': return aiQueue
      case 'link': return linkQueue
      case 'all': return queue
      default: return queue
    }
  }

  const getRelativeTime = (dateStr: string) => {
    if (!dateStr) return '-'
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}分钟前`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}小时前`
    return `${Math.floor(hours / 24)}天前`
  }

  const renderListItem = (item: ReviewItem) => {
    const screenshots = parseScreenshots(item.screenshots)
    
    return (
      <div 
        key={item.id} 
        className="group flex items-center gap-3 px-4 py-3 border-b border-border/50 cursor-pointer hover:bg-accent/30 transition-colors"
        onClick={() => { setSelectedItem(item); setShowDetail(true) }}
      >
        <span className="font-mono text-sm w-14 text-muted-foreground">#{item.id}</span>
        <div className="flex gap-1.5">
          {screenshots.slice(0, 3).map((url, idx) => (
            <img 
              key={idx} 
              src={url} 
              alt="" 
              className="w-10 h-10 rounded object-cover ring-1 ring-border/50 hover:ring-primary cursor-pointer" 
              onClick={(e) => { e.stopPropagation(); openImagePreview(screenshots, idx) }} 
            />
          ))}
          {screenshots.length === 0 && <div className="w-10 h-10 rounded bg-muted flex items-center justify-center"><Eye className="w-4 h-4 text-muted-foreground" /></div>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{item.tasks?.title || `任务#${item.task_id}`}</span>
            {activeTab === 'all' && getStatusBadge(item)}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>@{item.users?.username || '未知'}</span>
            <span className={cn(PLATFORM_COLORS[item.tasks?.platform || ''])}>{PLATFORM_NAMES[item.tasks?.platform || ''] || item.tasks?.platform}</span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">{getRelativeTime(item.claimed_at)}</div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:bg-red-500/10" disabled={processing} onClick={() => handleManualReview(item.id, 'reject')}>拒绝</Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-green-500 hover:bg-green-500/10" disabled={processing} onClick={() => handleManualReview(item.id, 'approve')}>通过</Button>
        </div>
      </div>
    )
  }

  const renderLogItem = (item: LogItem) => {
    const screenshots = parseScreenshots(item.screenshots)
    const isApproved = item.ai_review_status === 'approved'
    
    return (
      <div key={item.id} className="flex items-center gap-2 px-3 py-2 border-b border-border/30 cursor-pointer hover:bg-accent/20" onClick={() => { setSelectedLog(item); setShowLogDetail(true) }}>
        <span className="font-mono text-xs w-10 text-muted-foreground">#{item.id}</span>
        <div className="flex gap-1">
          {screenshots.slice(0, 2).map((url, idx) => (
            <img key={idx} src={url} alt="" className="w-7 h-7 rounded object-cover" onClick={e => { e.stopPropagation(); openImagePreview(screenshots, idx) }} />
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs truncate">{item.tasks?.title || `#${item.task_id}`}</span>
            <Badge variant={isApproved ? 'default' : 'destructive'} className="text-[9px] h-4 px-1">{isApproved ? '通过' : '拒绝'}</Badge>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground">{getRelativeTime(item.reviewed_at || item.claimed_at)}</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 顶部 */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold">AI 审核中心</h1>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={loadAllData} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}刷新
        </Button>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-6 gap-3 p-4 shrink-0">
        {[
          { label: '待人工', value: stats.manual, icon: ClipboardCheck, color: 'from-orange-500 to-amber-500' },
          { label: 'OCR处理', value: stats.imageReviewing || 0, icon: Scan, color: 'from-yellow-500 to-orange-500' },
          { label: 'AI审核', value: stats.pending, icon: Bot, color: 'from-blue-500 to-cyan-500' },
          { label: '链接验证', value: stats.linkReviewing || 0, icon: Globe, color: 'from-purple-500 to-violet-500' },
          { label: '已通过', value: stats.aiApproved, icon: CheckCircle, color: 'from-emerald-500 to-green-500' },
          { label: '自动化率', value: `${stats.autoRate}%`, icon: TrendingUp, color: 'from-teal-500 to-cyan-500' },
        ].map((stat, i) => (
          <div key={i} className="rounded-lg p-3 border bg-gradient-to-br from-muted/50 to-background">
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={cn("w-4 h-4", "text-muted-foreground")} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <div className={cn("text-2xl font-bold bg-gradient-to-r bg-clip-text text-transparent", stat.color)}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* 主内容 */}
      <div className="flex-1 min-h-0 flex border-t">
        {/* 左侧队列 */}
        <div className="flex-1 flex flex-col min-w-0 border-r">
          <div className="flex items-center gap-1 px-4 pt-2 shrink-0">
            {tabs.map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={cn("flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors", activeTab === tab.key ? "bg-background border border-border border-b-0 -mb-px" : "text-muted-foreground hover:text-foreground")}>
                <tab.icon className="w-4 h-4" />{tab.label}
                {tab.count !== null && (tab.count ?? 0) > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1">{tab.count}</Badge>}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-auto border-t">
            {loading ? (
              <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : getList().length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20">
                <CheckCircle className="w-12 h-12 mb-4 opacity-50" />
                <p>暂无待审核项目</p>
              </div>
            ) : (
              <div>{getList().map(renderListItem)}</div>
            )}
          </div>
        </div>

        {/* 右侧日志 */}
        <div className="w-72 flex flex-col shrink-0 bg-muted/10">
          <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">审核日志</span>
            <Badge variant="secondary" className="ml-auto text-xs">{logsQueue.length}</Badge>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            {logsQueue.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-10">
                <FileText className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-xs">暂无记录</p>
              </div>
            ) : (
              <div>{logsQueue.map(renderLogItem)}</div>
            )}
          </div>
        </div>
      </div>

      {/* 图片预览 */}
      <Dialog open={showImagePreview} onOpenChange={setShowImagePreview}>
        <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
          <div className="relative flex items-center justify-center min-h-[300px]">
            {previewImages[previewIndex] && <img src={previewImages[previewIndex]} alt="" className="max-w-full max-h-[70vh] object-contain" />}
            {previewImages.length > 1 && (
              <>
                <Button variant="ghost" size="icon" className="absolute left-4 text-white/70 hover:text-white h-10 w-10 rounded-full" onClick={() => setPreviewIndex(i => (i - 1 + previewImages.length) % previewImages.length)}><ChevronLeft className="w-5 h-5" /></Button>
                <Button variant="ghost" size="icon" className="absolute right-4 text-white/70 hover:text-white h-10 w-10 rounded-full" onClick={() => setPreviewIndex(i => (i + 1) % previewImages.length)}><ChevronRight className="w-5 h-5" /></Button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 px-3 py-1 rounded-full text-white text-sm">{previewIndex + 1} / {previewImages.length}</div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 详情弹窗 */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Eye className="w-5 h-5 text-primary" />审核详情 #{selectedItem?.id}</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded bg-muted/50"><div className="text-xs text-muted-foreground mb-1">任务</div><div className="font-medium truncate">{selectedItem.tasks?.title || '-'}</div></div>
                <div className="p-3 rounded bg-muted/50"><div className="text-xs text-muted-foreground mb-1">用户</div><div className="font-medium">{selectedItem.users?.username || '-'}</div></div>
                <div className="p-3 rounded bg-muted/50"><div className="text-xs text-muted-foreground mb-1">平台</div><div className={cn("font-medium", PLATFORM_COLORS[selectedItem.tasks?.platform || ''])}>{PLATFORM_NAMES[selectedItem.tasks?.platform || ''] || '-'}</div></div>
                <div className="p-3 rounded bg-muted/50"><div className="text-xs text-muted-foreground mb-1">状态</div>{getStatusBadge(selectedItem)}</div>
              </div>
              <div className="p-3 rounded bg-blue-500/10 border border-blue-500/20">
                <div className="text-xs text-blue-400 font-medium mb-2">任务链接</div>
                <Button variant="link" className="h-auto p-0 text-blue-400 hover:text-blue-300 flex items-center gap-1" onClick={() => window.open(getTaskLink(selectedItem), '_blank')}><ExternalLink className="w-3 h-3" />查看任务详情 / 视频 / 评论</Button>
              </div>
              {selectedItem.ai_reason && <div className="p-3 rounded bg-muted/50 text-sm"><span className="text-muted-foreground">AI原因：</span>{selectedItem.ai_reason}</div>}
              {selectedItem.screenshots && <div><div className="text-xs text-muted-foreground mb-2">截图 ({parseScreenshots(selectedItem.screenshots).length}张)</div><div className="grid grid-cols-4 gap-2">{parseScreenshots(selectedItem.screenshots).map((url, i) => <img key={i} src={url} alt="" className="w-full aspect-square rounded object-cover cursor-pointer hover:ring-2 ring-primary" onClick={() => openImagePreview(parseScreenshots(selectedItem.screenshots), i)} />)}</div></div>}
            </div>
          )}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => setShowDetail(false)}>取消</Button>
            <Button variant="destructive" disabled={processing} onClick={() => handleManualReview(selectedItem?.id || 0, 'reject')}>{processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}拒绝</Button>
            <Button disabled={processing} onClick={() => handleManualReview(selectedItem?.id || 0, 'approve')}>{processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}通过</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 日志详情 */}
      <Dialog open={showLogDetail} onOpenChange={setShowLogDetail}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-primary" />审核记录 #{selectedLog?.id}</DialogTitle></DialogHeader>
          {selectedLog && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant={selectedLog.ai_review_status === 'approved' ? 'default' : 'destructive'}>{selectedLog.ai_review_status === 'approved' ? '已通过' : '已拒绝'}</Badge>
                <span className="text-xs text-muted-foreground">{selectedLog.reviewed_at ? new Date(selectedLog.reviewed_at).toLocaleString() : '-'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 rounded bg-muted/50"><div className="text-xs text-muted-foreground">任务</div><div className="font-medium truncate">{selectedLog.tasks?.title || '-'}</div></div>
                <div className="p-2 rounded bg-muted/50"><div className="text-xs text-muted-foreground">用户</div><div className="font-medium">{selectedLog.users?.username || '-'}</div></div>
              </div>
              <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20">
                <div className="text-xs text-blue-400 font-medium mb-1">任务链接</div>
                <Button variant="link" className="h-auto p-0 text-blue-400 hover:text-blue-300 flex items-center gap-1 text-xs" onClick={() => window.open(getTaskLink(selectedLog), '_blank')}><ExternalLink className="w-3 h-3" />查看任务详情 / 视频 / 评论</Button>
              </div>
              {selectedLog.review_note && <div className="p-2 rounded bg-muted/50 text-xs"><span className="text-muted-foreground">备注：</span>{selectedLog.review_note}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
