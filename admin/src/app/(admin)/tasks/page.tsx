'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Task, TaskWithStats, TasksOverview, TodayStats, getTasksWithStats, getTasksOverview, getTodayStats, getTaskStats, createTask, updateTask, deleteTask, TaskDetailStats, uploadImage, getTaskClaimsList, TaskClaimItem, forceReleaseClaim } from '@/lib/api'
import { TASK_ACTIONS, TASK_ACTION_NAMES, PLATFORMS, PLATFORM_NAMES, getActionName as getActionNameConst, getPlatformName as getPlatformNameConst } from '@/constants/taskActions'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Calendar,
  ClipboardList,
  CheckCircle2,
  Hourglass,
  Download,
  Square,
  CheckSquare,
  XCircle,
  Upload,
  X,
  Loader2,
  FileText,
} from 'lucide-react'
import { exportTasks, getSystemConfigs, updateSystemConfig } from '@/lib/api'

type SortField = 'createdAt' | 'remain' | 'completedRate' | 'totalClaims' | 'doneCount'
type SortOrder = 'asc' | 'desc'
type CompletionStatus = 'all' | 'completed' | 'incomplete'
type DateFilter = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskWithStats[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [platformFilter, setPlatformFilter] = useState<string>('')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [completionStatus, setCompletionStatus] = useState<CompletionStatus>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [customDateStart, setCustomDateStart] = useState<string>('')
  const [customDateEnd, setCustomDateEnd] = useState<string>('')
  
  const [overview, setOverview] = useState<TasksOverview | null>(null)
  const [todayStats, setTodayStats] = useState<TodayStats | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [selectedTaskStats, setSelectedTaskStats] = useState<TaskDetailStats | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  
  // 领取用户列表状态
  const [claimsList, setClaimsList] = useState<TaskClaimItem[]>([])
  const [claimsTotal, setClaimsTotal] = useState(0)
  const [claimsPage, setClaimsPage] = useState(1)
  const [claimsStatusFilter, setClaimsStatusFilter] = useState<string>('all')
  const [isLoadingClaims, setIsLoadingClaims] = useState(false)
  const [releasingClaimId, setReleasingClaimId] = useState<number | null>(null)
  
  // 默认示范图片（系统配置）
  const [defaultExampleImages, setDefaultExampleImages] = useState<string[]>([])
  
  const [formData, setFormData] = useState<{
    title: string
    platform: string
    action: string
    videoUrl: string
    description: string
    reward: number
    remain: number
    timeLimitMinutes: number
    cityLimit: number
    provinceLimit: number
    exampleImages: string[]
  }>({
    title: '',
    platform: PLATFORMS.DOUYIN,
    action: TASK_ACTIONS.SHORT_VIDEO_RESEARCH,
    videoUrl: '',
    description: `任务流程：
1.打开指定视频链接；
2.以正常用户视角真实观看内容；
3.根据真实感受填写内容吸引力、创意度、观看体验等评价；
4.提交反馈即完成任务。

重要说明：
•本任务不涉及任何点赞、关注、评论、收藏、转发等互动行为；
•无需任何额外操作，仅需真实观看与客观反馈；
•所有数据仅用于内容研究与体验分析，不影响平台推荐机制；
•严禁使用脚本、模拟器、批量操作等非正常方式完成任务。

完成真实体验并提交有效评价后，审核通过可获得相应积分奖励。`,
    reward: 30,
    remain: 10,
    timeLimitMinutes: 15,
    cityLimit: 1,
    provinceLimit: 4,
    exampleImages: [],
  })
  
  // 示范图片上传状态
  const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(null)
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const [useDefaultExample, setUseDefaultExample] = useState(true)
  
  // 批量新建任务状态
  const [showBatchDialog, setShowBatchDialog] = useState(false)
  const [batchLinks, setBatchLinks] = useState('')
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false)
  
  // 从链接中提取标题（名字+当前日期）
  const extractTitleFromLink = (link: string): string => {
    // 匹配 【xxx的作品】 格式
    const nameMatch = link.match(/【(.+?)的作品】/)
    const name = nameMatch ? nameMatch[1] : ''
    
    // 使用当前日期
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const date = `${month}${day}`
    
    if (name) {
      return `${name}${date}`
    }
    return ''
  }
  
  // 导出状态
  const [isExporting, setIsExporting] = useState(false)
  
  // 批量操作状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBatchOperating, setIsBatchOperating] = useState(false)
  
  const pageSize = 20
  
  // 获取日期范围
  const getDateRange = useCallback(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    switch (dateFilter) {
      case 'today':
        return { startDate: today.toISOString().split('T')[0], endDate: null }
      case 'yesterday': {
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        return { startDate: yesterday.toISOString().split('T')[0], endDate: yesterday.toISOString().split('T')[0] }
      }
      case 'week': {
        const weekAgo = new Date(today)
        weekAgo.setDate(weekAgo.getDate() - 6)
        return { startDate: weekAgo.toISOString().split('T')[0], endDate: today.toISOString().split('T')[0] }
      }
      case 'month': {
        const monthAgo = new Date(today)
        monthAgo.setDate(monthAgo.getDate() - 29)
        return { startDate: monthAgo.toISOString().split('T')[0], endDate: today.toISOString().split('T')[0] }
      }
      case 'custom':
        return { startDate: customDateStart, endDate: customDateEnd }
      default:
        return { startDate: null, endDate: null }
    }
  }, [dateFilter, customDateStart, customDateEnd])
  
  const loadOverview = useCallback(async () => {
    try {
      const { startDate, endDate } = getDateRange()
      const data = await getTasksOverview({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        status: statusFilter || undefined,
        platform: platformFilter || undefined,
        completionStatus: completionStatus !== 'all' ? completionStatus : undefined,
      })
      setOverview(data)
    } catch (err) {
      console.error('加载统计概览失败', err)
    }
  }, [getDateRange, statusFilter, platformFilter, completionStatus])
  
  const loadTodayStats = useCallback(async () => {
    try {
      const data = await getTodayStats()
      setTodayStats(data)
    } catch (err) {
      console.error('加载今日统计失败', err)
    }
  }, [])
  
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const { startDate, endDate } = getDateRange()
      const data = await getTasksWithStats({
        page,
        size: pageSize,
        status: statusFilter || undefined,
        platform: platformFilter || undefined,
        sortField,
        sortOrder,
        completionStatus: completionStatus !== 'all' ? completionStatus : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      })
      
      setTasks(data.list)
      setTotal(data.total)
    } catch (err) {
      console.error('加载任务列表失败', err)
    } finally {
      setIsLoading(false)
    }
  }, [page, statusFilter, platformFilter, sortField, sortOrder, completionStatus, getDateRange])
  
  useEffect(() => {
    loadOverview()
  }, [loadOverview])
  
  useEffect(() => {
    loadTodayStats()
  }, []) // 今日数据独立，只在初始化时加载
  
  useEffect(() => {
    loadData()
  }, [loadData])
  
  // 加载默认示范图片配置
  useEffect(() => {
    const loadDefaultImages = async () => {
      try {
        const configs = await getSystemConfigs()
        const exampleConfig = configs.find(c => c.key === 'example_images_short_video_research')
        if (exampleConfig?.value) {
          setDefaultExampleImages(JSON.parse(exampleConfig.value))
        }
      } catch (err) {
        console.error('加载默认示范图片失败', err)
      }
    }
    loadDefaultImages()
  }, [])
  
  const totalPages = Math.ceil(total / pageSize)
  
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }
  
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-gray-400" />
    return sortOrder === 'desc' 
      ? <ArrowDown className="h-3 w-3 text-primary" />
      : <ArrowUp className="h-3 w-3 text-primary" />
  }
  
  const handleCreate = () => {
    setEditingTask(null)
    setFormData({
      title: '',
      platform: 'douyin',
      action: TASK_ACTIONS.SHORT_VIDEO_RESEARCH,
      videoUrl: '',
      description: `任务流程：
1.打开指定视频链接；
2.以正常用户视角真实观看内容；
3.根据真实感受填写内容吸引力、创意度、观看体验等评价；
4.提交反馈即完成任务。

重要说明：
•本任务不涉及任何点赞、关注、评论、收藏、转发等互动行为；
•无需任何额外操作，仅需真实观看与客观反馈；
•所有数据仅用于内容研究与体验分析，不影响平台推荐机制；
•严禁使用脚本、模拟器、批量操作等非正常方式完成任务。

完成真实体验并提交有效评价后，审核通过可获得相应积分奖励。`,
      reward: 30,
      remain: 10,
      timeLimitMinutes: 15,
      cityLimit: 1,
      provinceLimit: 4,
      exampleImages: [],
    })
    setUseDefaultExample(true)
    setShowEditDialog(true)
  }
  
  // 处理链接变化，自动提取标题
  const handleVideoUrlChange = (url: string) => {
    setFormData({ ...formData, videoUrl: url })
    
    // 如果标题为空，自动提取标题
    if (!formData.title && url) {
      const extractedTitle = extractTitleFromLink(url)
      if (extractedTitle) {
        setFormData(prev => ({ ...prev, videoUrl: url, title: extractedTitle }))
      }
    }
  }
  
  const handleEdit = (task: Task) => {
    setEditingTask(task)
    const taskExampleImages = task.exampleImages || []
    setFormData({
      title: task.title,
      platform: task.platform,
      action: task.action,
      videoUrl: task.videoUrl || '',
      description: task.description,
      reward: task.reward,
      remain: task.remain,
      timeLimitMinutes: task.timeLimitMinutes,
      cityLimit: task.cityLimit,
      provinceLimit: task.provinceLimit,
      exampleImages: taskExampleImages,
    })
    // 如果任务有自定义示范图片，则不使用默认值
    setUseDefaultExample(taskExampleImages.length === 0)
    setShowEditDialog(true)
  }
  
  // 示范图片上传处理
  const handleImageUpload = async (file: File, index: number) => {
    setUploadingImageIndex(index)
    try {
      const result = await uploadImage(file)
      const newImages = [...formData.exampleImages]
      newImages[index] = result.url
      setFormData({ ...formData, exampleImages: newImages })
      // 一旦上传了自定义图片，就不再使用默认值
      setUseDefaultExample(false)
    } catch (err) {
      console.error('上传失败', err)
      alert('上传失败')
    } finally {
      setUploadingImageIndex(null)
    }
  }
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImageUpload(file, index)
    }
    e.target.value = ''
  }
  
  const handleRemoveImage = (index: number) => {
    const newImages = [...formData.exampleImages]
    newImages[index] = ''
    setFormData({ ...formData, exampleImages: newImages.filter(Boolean) })
  }
  
  const triggerFileSelect = (index: number) => {
    fileInputRefs.current[index]?.click()
  }
  
  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const submitData = {
        ...formData,
        // 如果使用默认值，则不传递 exampleImages（让后端使用默认）
        exampleImages: useDefaultExample ? [] : formData.exampleImages.filter(Boolean)
      }
      if (editingTask) {
        await updateTask(editingTask.id, submitData)
      } else {
        await createTask(submitData)
      }
      setShowEditDialog(false)
      loadData()
      loadOverview()
      loadTodayStats()
    } catch (err) {
      console.error('保存失败', err)
      alert('操作失败')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  // 批量创建任务
  const handleBatchSubmit = async () => {
    const links = batchLinks.split('\n').map(l => l.trim()).filter(l => l)
    if (links.length === 0) {
      alert('请输入至少一个任务链接')
      return
    }
    
    setIsBatchSubmitting(true)
    let successCount = 0
    let failCount = 0
    
    // 确定示范图片：如果使用默认，则传空数组让后端使用系统配置
    const exampleImages = useDefaultExample ? [] : formData.exampleImages.filter(Boolean)
    
    for (const link of links) {
      try {
        // 从链接提取标题
        const title = extractTitleFromLink(link) || `任务_${Date.now()}`
        
        const taskData = {
          ...formData,
          title,
          videoUrl: link,
          exampleImages
        }
        
        await createTask(taskData)
        successCount++
      } catch (err) {
        console.error('创建任务失败:', link, err)
        failCount++
      }
    }
    
    setIsBatchSubmitting(false)
    setShowBatchDialog(false)
    setBatchLinks('')
    loadData()
    loadOverview()
    loadTodayStats()
    
    alert(`批量创建完成！成功: ${successCount}，失败: ${failCount}`)
  }
  
  const handleDelete = async (taskId: string) => {
    if (!confirm('确定要删除这个任务吗？')) return
    try {
      await deleteTask(taskId)
      loadData()
      loadOverview()
      loadTodayStats()
    } catch (err) {
      console.error('删除失败', err)
      alert('删除失败')
    }
  }
  
  const handleToggleStatus = async (task: Task) => {
    const newStatus = task.status === 'active' ? 'inactive' : 'active'
    try {
      await updateTask(task.id, { status: newStatus } as Partial<Task>)
      loadData()
      loadOverview()
      loadTodayStats()
    } catch (err) {
      console.error('操作失败', err)
      alert('操作失败')
    }
  }
  
  // 批量操作
  const handleSelectAll = () => {
    if (selectedIds.size === tasks.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(tasks.map(t => t.id.toString())))
    }
  }
  
  const handleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }
  
  const handleBatchStatus = async (status: 'active' | 'inactive') => {
    if (selectedIds.size === 0) return
    if (!confirm(`确定要${status === 'active' ? '上架' : '下架'}选中的 ${selectedIds.size} 个任务吗？`)) return
    
    setIsBatchOperating(true)
    try {
      const promises = Array.from(selectedIds).map(id => 
        updateTask(id, { status } as Partial<Task>)
      )
      await Promise.all(promises)
      setSelectedIds(new Set())
      loadData()
      loadOverview()
      loadTodayStats()
    } catch (err) {
      console.error('批量操作失败', err)
      alert('批量操作失败')
    } finally {
      setIsBatchOperating(false)
    }
  }
  
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 个任务吗？此操作不可恢复！`)) return
    
    setIsBatchOperating(true)
    try {
      const promises = Array.from(selectedIds).map(id => deleteTask(id))
      await Promise.all(promises)
      setSelectedIds(new Set())
      loadData()
      loadOverview()
      loadTodayStats()
    } catch (err) {
      console.error('批量删除失败', err)
      alert('批量删除失败')
    } finally {
      setIsBatchOperating(false)
    }
  }
  
  const handleViewDetail = async (taskId: string) => {
    setIsLoadingDetail(true)
    setIsLoadingClaims(true)
    setShowDetailDialog(true)
    setClaimsList([])
    setClaimsTotal(0)
    setClaimsPage(1)
    setClaimsStatusFilter('all')
    try {
      const data = await getTaskStats(taskId)
      setSelectedTaskStats(data)
      // 同时加载领取用户列表
      const claimsData = await getTaskClaimsList(taskId, { page: 1, size: 10 })
      setClaimsList(claimsData.list || [])
      setClaimsTotal(claimsData.total || 0)
    } catch (err) {
      console.error('获取任务详情失败', err)
      setShowDetailDialog(false)
    } finally {
      setIsLoadingDetail(false)
      setIsLoadingClaims(false)
    }
  }
  
  // 加载领取用户列表
  const loadClaimsList = async (taskId: string, page: number = 1, status: string = 'all') => {
    if (!taskId) return
    setIsLoadingClaims(true)
    try {
      const data = await getTaskClaimsList(taskId, { page, size: 10, status: status === 'all' ? undefined : status })
      setClaimsList(data.list || [])
      setClaimsTotal(data.total || 0)
      setClaimsPage(page)
    } catch (err) {
      console.error('获取领取列表失败', err)
    } finally {
      setIsLoadingClaims(false)
    }
  }
  
  // 强制释放任务名额
  const handleForceRelease = async (claimId: number) => {
    if (!selectedTaskStats?.task.id) return
    if (!confirm('确定要强制释放该用户的任务名额吗？此操作不可撤销。')) return
    
    setReleasingClaimId(claimId)
    try {
      await forceReleaseClaim(claimId)
      alert('释放成功')
      // 重新加载列表和统计数据
      loadClaimsList(selectedTaskStats.task.id.toString(), claimsPage, claimsStatusFilter)
      const data = await getTaskStats(selectedTaskStats.task.id.toString())
      setSelectedTaskStats(data)
    } catch (err) {
      console.error('强制释放失败', err)
      alert('操作失败')
    } finally {
      setReleasingClaimId(null)
    }
  }
  
  const getPlatformName = (platform: string) => {
    // 使用常量文件中的定义，兼容旧数据
    if (platform === 'bilibili') return 'B站'
    return getPlatformNameConst(platform)
  }
  
  const getActionName = (action: string) => {
    return getActionNameConst(action)
  }
  
  return (
    <div className="space-y-3">
      {/* 今日统计 - 置顶醒目区域 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-100">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-700">今日数据</span>
          <span className="text-xs text-gray-400 ml-auto">{new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {/* 今日已发布任务 */}
          <div className="bg-white rounded-lg p-2.5 shadow-sm border border-blue-50">
            <div className="flex items-center gap-1.5 mb-1">
              <ClipboardList className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-[11px] text-gray-500">已发布任务</span>
            </div>
            <p className="text-xl font-bold text-blue-600">{todayStats?.todayPublishedTasks ?? '-'}</p>
          </div>
          {/* 今日任务总量 */}
          <div className="bg-white rounded-lg p-2.5 shadow-sm border border-purple-50">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="h-3.5 w-3.5 rounded bg-purple-500 flex items-center justify-center">
                <span className="text-white text-[8px]">总</span>
              </div>
              <span className="text-[11px] text-gray-500">任务总量</span>
            </div>
            <p className="text-xl font-bold text-purple-600">{todayStats?.todayTotalAmount ?? '-'}</p>
          </div>
          {/* 今日已完成 */}
          <div className="bg-white rounded-lg p-2.5 shadow-sm border border-green-50">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              <span className="text-[11px] text-gray-500">今日完成</span>
            </div>
            <p className="text-xl font-bold text-green-600">{todayStats?.todayCompleted ?? '-'}</p>
          </div>
          {/* 剩余任务总量 */}
          <div className="bg-white rounded-lg p-2.5 shadow-sm border border-orange-50">
            <div className="flex items-center gap-1.5 mb-1">
              <Hourglass className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-[11px] text-gray-500">剩余总量</span>
            </div>
            <p className="text-xl font-bold text-orange-600">{todayStats?.remainTotal ?? '-'}</p>
          </div>
        </div>
      </div>
      
      {/* 全局统计概览 */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5">
        {[
          { label: '总任务', value: overview?.totalTasks || 0 },
          { label: '上架中', value: overview?.activeTasks || 0, color: 'text-green-600' },
          { label: '已下架', value: overview?.inactiveTasks || 0 },
          { label: '总领取', value: overview?.totalClaims || 0 },
          { label: '参与人', value: overview?.uniqueClaimUsers || 0 },
          { label: '已提交', value: overview?.totalSubmitted || 0 },
          { label: '已完成', value: overview?.totalCompleted || 0, color: 'text-emerald-600' },
          { label: '待审核', value: overview?.totalPending || 0, color: 'text-yellow-600' },
        ].map((item, i) => (
          <Card key={i} className="py-1.5">
            <CardContent className="p-1.5 text-center">
              <p className="text-[10px] text-gray-500">{item.label}</p>
              <p className={`text-sm font-bold ${item.color || ''}`}>{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* 筛选和操作栏 */}
      <div className="flex items-center justify-between gap-2 flex-wrap bg-gray-50 p-2 rounded-lg">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 状态筛选 */}
          <Select
            value={statusFilter || 'all'}
            onValueChange={(v) => {
              setStatusFilter(v === 'all' ? '' : v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[90px] h-7 text-xs">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="active">上架中</SelectItem>
              <SelectItem value="inactive">已下架</SelectItem>
            </SelectContent>
          </Select>
          
          {/* 平台筛选 */}
          <Select
            value={platformFilter || 'all'}
            onValueChange={(v) => {
              setPlatformFilter(v === 'all' ? '' : v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[90px] h-7 text-xs">
              <SelectValue placeholder="平台" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部平台</SelectItem>
              <SelectItem value={PLATFORMS.DOUYIN}>{PLATFORM_NAMES[PLATFORMS.DOUYIN]}</SelectItem>
              <SelectItem value={PLATFORMS.KUAISHOU}>{PLATFORM_NAMES[PLATFORMS.KUAISHOU]}</SelectItem>
              <SelectItem value={PLATFORMS.XIAOHONGSHU}>{PLATFORM_NAMES[PLATFORMS.XIAOHONGSHU]}</SelectItem>
              <SelectItem value={PLATFORMS.SHIPINHAO}>{PLATFORM_NAMES[PLATFORMS.SHIPINHAO]}</SelectItem>
            </SelectContent>
          </Select>
          
          {/* 完成状态筛选 */}
          <Select
            value={completionStatus}
            onValueChange={(v) => {
              setCompletionStatus(v as CompletionStatus)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[100px] h-7 text-xs">
              <SelectValue placeholder="完成状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部任务</SelectItem>
              <SelectItem value="completed">已完成</SelectItem>
              <SelectItem value="incomplete">未完成</SelectItem>
            </SelectContent>
          </Select>
          
          {/* 发布时间筛选 */}
          <Select
            value={dateFilter}
            onValueChange={(v) => {
              setDateFilter(v as DateFilter)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-[100px] h-7 text-xs">
              <SelectValue placeholder="发布时间" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部时间</SelectItem>
              <SelectItem value="today">今天</SelectItem>
              <SelectItem value="yesterday">昨天</SelectItem>
              <SelectItem value="week">近7天</SelectItem>
              <SelectItem value="month">近30天</SelectItem>
              <SelectItem value="custom">自定义</SelectItem>
            </SelectContent>
          </Select>
          
          {/* 自定义日期 */}
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-1">
              <Input
                type="date"
                className="w-[120px] h-7 text-xs"
                value={customDateStart}
                onChange={(e) => {
                  setCustomDateStart(e.target.value)
                  setPage(1)
                }}
              />
              <span className="text-xs text-gray-400">至</span>
              <Input
                type="date"
                className="w-[120px] h-7 text-xs"
                value={customDateEnd}
                onChange={(e) => {
                  setCustomDateEnd(e.target.value)
                  setPage(1)
                }}
              />
            </div>
          )}
          
          {/* 排序按钮 */}
          <div className="flex items-center gap-1">
            <Button 
              variant={sortField === 'createdAt' ? 'default' : 'outline'} 
              size="sm" 
              className="h-7 text-xs px-2"
              onClick={() => toggleSort('createdAt')}
            >
              时间 <SortIcon field="createdAt" />
            </Button>
            <Button 
              variant={sortField === 'remain' ? 'default' : 'outline'} 
              size="sm" 
              className="h-7 text-xs px-2"
              onClick={() => toggleSort('remain')}
            >
              剩余 <SortIcon field="remain" />
            </Button>
            <Button 
              variant={sortField === 'completedRate' ? 'default' : 'outline'} 
              size="sm" 
              className="h-7 text-xs px-2"
              onClick={() => toggleSort('completedRate')}
            >
              完成率 <SortIcon field="completedRate" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 批量操作按钮 */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded">
              <span className="text-xs text-blue-600">已选 {selectedIds.size} 项</span>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-6 text-xs px-2 text-green-600 border-green-300 hover:bg-green-50"
                onClick={() => handleBatchStatus('active')}
                disabled={isBatchOperating}
              >
                批量上架
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-6 text-xs px-2 text-orange-600 border-orange-300 hover:bg-orange-50"
                onClick={() => handleBatchStatus('inactive')}
                disabled={isBatchOperating}
              >
                批量下架
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-6 text-xs px-2 text-red-600 border-red-300 hover:bg-red-50"
                onClick={handleBatchDelete}
                disabled={isBatchOperating}
              >
                批量删除
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0"
                onClick={() => setSelectedIds(new Set())}
              >
                <XCircle className="h-3 w-3" />
              </Button>
            </div>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7"
            onClick={async () => {
              setIsExporting(true)
              try {
                const dateRange = getDateRange()
                await exportTasks({
                  status: statusFilter || undefined,
                  platform: platformFilter || undefined,
                  startDate: dateRange.startDate || undefined,
                  endDate: dateRange.endDate || undefined,
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
            <Download className="h-3 w-3 mr-1" />
            {isExporting ? '导出中...' : '导出'}
          </Button>
          <Button size="sm" className="h-7" onClick={handleCreate}>
            <Plus className="h-3 w-3 mr-1" />
            新建
          </Button>
          <Button size="sm" className="h-7 bg-purple-600 hover:bg-purple-700" onClick={() => setShowBatchDialog(true)}>
            <Plus className="h-3 w-3 mr-1" />
            批量新建
          </Button>
          <Link href="/templates">
            <Button size="sm" variant="outline" className="h-7">
              <FileText className="h-3 w-3 mr-1" />
              任务模板
            </Button>
          </Link>
        </div>
      </div>
      
      {/* 任务列表 - 紧凑表格 */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="w-8 p-2">
                  <button 
                    className="flex items-center justify-center"
                    onClick={handleSelectAll}
                  >
                    {selectedIds.size === tasks.length && tasks.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-blue-500" />
                    ) : (
                      <Square className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </th>
                <th className="text-left p-2 font-medium">任务信息</th>
                <th className="text-center p-2 font-medium w-28">任务编号</th>
                <th className="text-center p-2 font-medium w-16">平台</th>
                <th className="text-center p-2 font-medium w-12">剩余</th>
                <th className="text-center p-2 font-medium w-12">领取</th>
                <th className="text-center p-2 font-medium w-12">提交</th>
                <th className="text-center p-2 font-medium w-12">完成</th>
                <th className="text-center p-2 font-medium w-12">审核</th>
                <th className="text-center p-2 font-medium w-14">完成率</th>
                <th className="text-center p-2 font-medium w-20">发布时间</th>
                <th className="text-center p-2 font-medium w-20">完成时间</th>
                <th className="text-center p-2 font-medium w-12">状态</th>
                <th className="text-center p-2 font-medium w-20">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i} className="border-b">
                    <td colSpan={14} className="p-2"><Skeleton className="h-6" /></td>
                  </tr>
                ))
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center py-8 text-gray-400">暂无数据</td>
                </tr>
              ) : (
                tasks.map((task) => {
                  const s = task.stats
                  return (
                    <tr key={task.id} className={`border-b hover:bg-gray-50 ${selectedIds.has(task.id.toString()) ? 'bg-blue-50' : ''}`}>
                      <td className="w-8 p-2">
                        <button 
                          className="flex items-center justify-center"
                          onClick={() => handleSelectOne(task.id.toString())}
                        >
                          {selectedIds.has(task.id.toString()) ? (
                            <CheckSquare className="h-4 w-4 text-blue-500" />
                          ) : (
                            <Square className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1.5">
                          <span 
                            className="font-medium truncate max-w-[160px] cursor-pointer hover:text-blue-600 hover:underline" 
                            title={task.title}
                            onClick={() => handleViewDetail(task.id)}
                          >
                            {task.title}
                          </span>
                          <span className="text-primary font-bold">{task.reward}分</span>
                        </div>
                      </td>
                      <td className="p-2 text-center">
                        <span className="font-mono text-xs text-blue-600" title={task.taskCode || ''}>
                          {task.taskCode || `TASK-${task.id}`}
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {getPlatformName(task.platform)}
                        </Badge>
                      </td>
                      <td className="p-2 text-center">
                        <span className={task.remain < 10 ? 'text-red-500 font-bold' : ''}>
                          {task.remain}
                        </span>
                      </td>
                      <td className="p-2 text-center font-mono">{s.totalClaims}</td>
                      <td className="p-2 text-center font-mono text-orange-600">{s.submittedCount}</td>
                      <td className="p-2 text-center font-mono text-green-600">{s.doneCount}</td>
                      <td className="p-2 text-center font-mono text-yellow-600">{s.pendingCount}</td>
                      <td className="p-2 text-center">
                        <span className={`font-bold ${s.completedRate >= 80 ? 'text-green-600' : s.completedRate >= 50 ? 'text-blue-600' : ''}`}>
                          {s.completedRate}%
                        </span>
                      </td>
                      <td className="p-2 text-center text-[10px] text-gray-500">
                        {new Date(task.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-2 text-center text-[10px] text-gray-500">
                        {s.completedRate === 100 ? (
                          <span className="text-green-600">已完成</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <Badge 
                          variant={task.status === 'active' ? 'default' : 'secondary'} 
                          className={`text-[10px] px-1 py-0 ${task.status === 'active' ? 'bg-green-100 text-green-700' : ''}`}
                        >
                          {task.status === 'active' ? '上架' : '下架'}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => handleEdit(task)}>
                            <Pencil className="h-3 w-3 mr-1" />
                            编辑
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleToggleStatus(task)}>
                            {task.status === 'active' ? (
                              <EyeOff className="h-3 w-3 text-orange-500" />
                            ) : (
                              <Eye className="h-3 w-3 text-green-500" />
                            )}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" onClick={() => handleDelete(task.id.toString())}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
      
      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>共 {total} 条</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-6 w-6 p-0" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="px-2">{page}/{totalPages}</span>
            <Button variant="outline" size="sm" className="h-6 w-6 p-0" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
      
      {/* 编辑弹窗 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTask ? '编辑任务' : '新建任务'}</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-3 py-3">
            <div className="grid gap-2">
              <Label className="text-xs">任务标题 *</Label>
              <Input className="h-8 text-sm" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-xs">平台</Label>
                <Select value={formData.platform} onValueChange={(v) => setFormData({ ...formData, platform: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PLATFORMS.DOUYIN}>{PLATFORM_NAMES[PLATFORMS.DOUYIN]}</SelectItem>
                    <SelectItem value={PLATFORMS.KUAISHOU}>{PLATFORM_NAMES[PLATFORMS.KUAISHOU]}</SelectItem>
                    <SelectItem value={PLATFORMS.XIAOHONGSHU}>{PLATFORM_NAMES[PLATFORMS.XIAOHONGSHU]}</SelectItem>
                    <SelectItem value={PLATFORMS.SHIPINHAO}>{PLATFORM_NAMES[PLATFORMS.SHIPINHAO]}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">操作类型</Label>
                <Select value={formData.action} onValueChange={(v) => setFormData({ ...formData, action: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TASK_ACTIONS.SHORT_VIDEO_RESEARCH}>短视频内容体验调研</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label className="text-xs">视频链接</Label>
              <Input 
                className="h-8 text-sm" 
                value={formData.videoUrl} 
                onChange={(e) => handleVideoUrlChange(e.target.value)} 
                placeholder="粘贴完整链接，系统将自动提取标题"
              />
              <p className="text-[10px] text-gray-400">填入链接后，系统将自动从【作者名+当前日期】生成标题</p>
            </div>
            
            <div className="grid gap-2">
              <Label className="text-xs">任务描述</Label>
              <Textarea className="text-sm min-h-[120px]" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={6} />
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label className="text-xs">奖励积分</Label>
                <Input type="number" className="h-8 text-sm" value={formData.reward} onChange={(e) => setFormData({ ...formData, reward: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">剩余名额</Label>
                <Input type="number" className="h-8 text-sm" value={formData.remain} onChange={(e) => setFormData({ ...formData, remain: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">时限(分钟)</Label>
                <Input type="number" className="h-8 text-sm" value={formData.timeLimitMinutes} onChange={(e) => setFormData({ ...formData, timeLimitMinutes: parseInt(e.target.value) || 10 })} />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-xs">同城限制</Label>
                <Input type="number" className="h-8 text-sm" value={formData.cityLimit} onChange={(e) => setFormData({ ...formData, cityLimit: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">同省限制</Label>
                <Input type="number" className="h-8 text-sm" value={formData.provinceLimit} onChange={(e) => setFormData({ ...formData, provinceLimit: parseInt(e.target.value) || 4 })} />
              </div>
            </div>
            
            {/* 示范图片上传 */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">完成示范图片</Label>
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useDefaultExample}
                    onChange={(e) => setUseDefaultExample(e.target.checked)}
                    className="w-3 h-3"
                  />
                  使用系统默认示范图片
                </label>
              </div>
              
              {useDefaultExample ? (
                <>
                  <p className="text-[10px] text-gray-500">当前默认示范图片（可在"系统设置"页面修改）：</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[0, 1].map((index) => (
                      <div key={index} className="relative aspect-video rounded-md overflow-hidden border bg-gray-50">
                        {defaultExampleImages[index] ? (
                          <img
                            src={defaultExampleImages[index]}
                            alt={`默认示范图片${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                            暂无图片
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[10px] text-gray-400">上传自定义示范图片，仅对当前任务生效</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[0, 1].map((index) => (
                      <div key={index} className="space-y-1">
                        <input
                          ref={(el) => { fileInputRefs.current[index] = el }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileChange(e, index)}
                        />
                        {formData.exampleImages[index] ? (
                          <div className="relative aspect-video rounded-md overflow-hidden border bg-gray-50 group">
                            <img
                              src={formData.exampleImages[index]}
                              alt={`示范图片${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-6 px-2 text-xs"
                                onClick={() => triggerFileSelect(index)}
                                disabled={uploadingImageIndex === index}
                              >
                                <Upload className="h-3 w-3 mr-1" />
                                更换
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-6 px-2 text-xs"
                                onClick={() => handleRemoveImage(index)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="aspect-video rounded-md border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
                            onClick={() => triggerFileSelect(index)}
                          >
                            {uploadingImageIndex === index ? (
                              <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                            ) : (
                              <>
                                <Upload className="h-5 w-5 text-gray-400" />
                                <span className="text-[10px] text-gray-500">图片 {index + 1}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowEditDialog(false)}>取消</Button>
            <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? '保存中...' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 任务详情弹窗 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>任务详情</DialogTitle>
          </DialogHeader>
          
          {isLoadingDetail ? (
            <div className="py-6 text-center">
              <RefreshCw className="h-5 w-5 mx-auto animate-spin text-gray-400" />
            </div>
          ) : selectedTaskStats ? (
            <div className="space-y-4">
              {/* 基本信息 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-3 text-gray-700">基本信息</h3>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-blue-100 text-blue-700 text-xs">{getPlatformName(selectedTaskStats.task.platform)}</Badge>
                  <Badge variant="outline" className="text-xs">{getActionName(selectedTaskStats.task.action)}</Badge>
                  <Badge className={`text-xs ${selectedTaskStats.task.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {selectedTaskStats.task.status === 'active' ? '上架中' : '已下架'}
                  </Badge>
                </div>
                <p className="text-base font-medium mb-2">{selectedTaskStats.task.title}</p>
                <p className="text-xs text-gray-400">创建时间：{new Date(selectedTaskStats.task.createdAt).toLocaleString('zh-CN')}</p>
              </div>
              
              {/* 任务配置 */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-3 text-blue-700">任务配置</h3>
                <div className="grid grid-cols-4 gap-3">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">奖励积分</p>
                    <p className="text-lg font-bold text-blue-600">{selectedTaskStats.task.reward}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">剩余名额</p>
                    <p className="text-lg font-bold text-orange-600">{selectedTaskStats.task.remain}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">完成时限</p>
                    <p className="text-lg font-bold text-purple-600">{selectedTaskStats.task.timeLimitMinutes}分钟</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">地域限制</p>
                    <p className="text-sm font-bold text-gray-700">{selectedTaskStats.task.cityLimit}城/{selectedTaskStats.task.provinceLimit}省</p>
                  </div>
                </div>
              </div>
              
              {/* 任务描述 */}
              <div className="bg-white border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-2 text-gray-700">任务描述</h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedTaskStats.task.description || '暂无描述'}</p>
              </div>
              
              {/* 视频链接 */}
              {selectedTaskStats.task.videoUrl && (
                <div className="bg-purple-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-2 text-purple-700">视频链接</h3>
                  <div className="bg-white rounded p-2 text-xs break-all">
                    <code className="text-purple-600">{selectedTaskStats.task.videoUrl}</code>
                  </div>
                </div>
              )}
              
              {/* 示例图片 */}
              {selectedTaskStats.task.exampleImages && selectedTaskStats.task.exampleImages.length > 0 && (
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3 text-green-700">示例图片</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedTaskStats.task.exampleImages.map((img, idx) => (
                      <div key={idx} className="relative aspect-video rounded overflow-hidden border bg-white">
                        <img 
                          src={img} 
                          alt={`示例图片${idx + 1}`} 
                          className="w-full h-full object-cover"
                          onClick={() => window.open(img, '_blank')}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder.png'
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">点击图片可查看大图</p>
                </div>
              )}
              
              {/* 统计数据 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-3 text-gray-700">任务统计</h3>
                <div className="grid grid-cols-4 gap-2 text-center mb-3">
                  {[
                    { label: '领取', value: selectedTaskStats.stats.totalClaims, bg: 'bg-purple-50', color: 'text-purple-600' },
                    { label: '提交', value: selectedTaskStats.stats.submittedCount, bg: 'bg-orange-50', color: 'text-orange-600' },
                    { label: '完成', value: selectedTaskStats.stats.doneCount, bg: 'bg-green-50', color: 'text-green-600' },
                    { label: '待审', value: selectedTaskStats.stats.pendingCount, bg: 'bg-yellow-50', color: 'text-yellow-600' },
                  ].map((item, i) => (
                    <div key={i} className={`${item.bg} rounded p-2`}>
                      <p className="text-xs text-gray-500">{item.label}</p>
                      <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div className="bg-blue-50 rounded p-2">
                    <p className="text-xs text-blue-600">进行中</p>
                    <p className="font-bold text-blue-700">{selectedTaskStats.stats.doingCount}</p>
                  </div>
                  <div className="bg-red-50 rounded p-2">
                    <p className="text-xs text-red-600">已拒绝</p>
                    <p className="font-bold text-red-700">{selectedTaskStats.stats.rejectedCount}</p>
                  </div>
                  <div className="bg-gray-100 rounded p-2">
                    <p className="text-xs text-gray-600">已过期</p>
                    <p className="font-bold text-gray-700">{selectedTaskStats.stats.expiredCount}</p>
                  </div>
                </div>
                
                <div className="bg-emerald-100 rounded p-3 text-center">
                  <p className="text-xs text-emerald-700">完成率</p>
                  <p className="text-2xl font-bold text-emerald-700">{selectedTaskStats.stats.completedRate}%</p>
                </div>
              </div>
              
              {/* 领取用户列表 */}
              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">领取用户列表</h3>
                  <div className="flex items-center gap-2">
                    <Select 
                      value={claimsStatusFilter} 
                      onValueChange={(v) => {
                        setClaimsStatusFilter(v)
                        loadClaimsList(selectedTaskStats.task.id.toString(), 1, v)
                      }}
                    >
                      <SelectTrigger className="h-7 w-24 text-xs">
                        <SelectValue placeholder="全部状态" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="doing">进行中</SelectItem>
                        <SelectItem value="pending">待审核</SelectItem>
                        <SelectItem value="done">已完成</SelectItem>
                        <SelectItem value="rejected">已拒绝</SelectItem>
                        <SelectItem value="expired">已过期</SelectItem>
                        <SelectItem value="released">已释放</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-gray-500">共 {claimsTotal} 条</span>
                  </div>
                </div>
                
                {isLoadingClaims ? (
                  <div className="text-center py-4 text-gray-500 text-sm">加载中...</div>
                ) : claimsList.length > 0 ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 border-b pb-1.5">
                      <div className="col-span-2">用户</div>
                      <div className="col-span-1 text-center">状态</div>
                      <div className="col-span-2 text-center">领取时间</div>
                      <div className="col-span-2 text-center">提交时间</div>
                      <div className="col-span-1 text-center">耗时</div>
                      <div className="col-span-2 text-center">地区</div>
                      <div className="col-span-2 text-center">操作</div>
                    </div>
                    {claimsList.map((claim) => (
                      <div key={claim.id} className="grid grid-cols-12 gap-2 text-xs border-b pb-2 items-center">
                        <div className="col-span-2">
                          <p className="font-medium truncate">{claim.username || '-'}</p>
                          <p className="text-gray-400 text-[10px]">{claim.phone}</p>
                        </div>
                        <div className="col-span-1 text-center">
                          <Badge variant="outline" className={`text-[10px] px-1 ${
                            claim.status === 'done' ? 'border-green-500 text-green-600' :
                            claim.status === 'pending' ? 'border-yellow-500 text-yellow-600' :
                            claim.status === 'doing' ? 'border-blue-500 text-blue-600' :
                            claim.status === 'rejected' ? 'border-red-500 text-red-600' :
                            claim.status === 'expired' ? 'border-gray-400 text-gray-500' :
                            'border-gray-300 text-gray-400'
                          }`}>
                            {claim.status === 'done' ? '已完成' :
                             claim.status === 'pending' ? '待审核' :
                             claim.status === 'doing' ? '进行中' :
                             claim.status === 'rejected' ? '已拒绝' :
                             claim.status === 'expired' ? '已过期' :
                             claim.status === 'released' ? '已释放' : claim.status}
                          </Badge>
                        </div>
                        <div className="col-span-2 text-center text-gray-600">
                          {new Date(claim.claimedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="col-span-2 text-center text-gray-600">
                          {claim.submittedAt ? new Date(claim.submittedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </div>
                        <div className="col-span-1 text-center text-gray-600">
                          {claim.timeSpent !== null ? `${claim.timeSpent}分` : '-'}
                        </div>
                        <div className="col-span-2 text-center text-gray-600">
                          {claim.city || claim.province ? `${claim.city || ''}${claim.province ? (claim.city ? ', ' : '') + claim.province : ''}` : '-'}
                        </div>
                        <div className="col-span-2 text-center">
                          {(claim.status === 'doing' || claim.status === 'pending') && (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => handleForceRelease(claim.id)}
                              disabled={releasingClaimId === claim.id}
                            >
                              {releasingClaimId === claim.id ? '释放中...' : '强制释放'}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {/* 分页 */}
                    {claimsTotal > 10 && (
                      <div className="flex items-center justify-center gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={claimsPage === 1}
                          onClick={() => loadClaimsList(selectedTaskStats.task.id.toString(), claimsPage - 1, claimsStatusFilter)}
                        >
                          上一页
                        </Button>
                        <span className="text-xs text-gray-500">
                          第 {claimsPage} 页 / 共 {Math.ceil(claimsTotal / 10)} 页
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={claimsPage >= Math.ceil(claimsTotal / 10)}
                          onClick={() => loadClaimsList(selectedTaskStats.task.id.toString(), claimsPage + 1, claimsStatusFilter)}
                        >
                          下一页
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-400 text-sm">暂无领取记录</div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      
      {/* 批量新建任务弹窗 */}
      <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>批量新建任务</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-3 py-3">
            <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700">
              <p className="font-medium mb-1">使用说明：</p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-600">
                <li>每个链接单独生成一个任务</li>
                <li>链接格式示例：2.84 复制打开抖音，看看【阿健DL HOPE的作品】现在的老板呐，  https://v.douyin.com/pi_CWztq-ck/ e@O.kP ygb:/ 04/07</li>
                <li>系统将自动从链接中提取【作者名+当前日期】作为任务标题</li>
                <li>其他设置（平台、描述、积分等）将统一应用</li>
              </ul>
            </div>
            
            <div className="grid gap-2">
              <Label className="text-xs">任务链接（每行一个）</Label>
              <Textarea 
                className="text-sm min-h-[150px]" 
                value={batchLinks} 
                onChange={(e) => setBatchLinks(e.target.value)} 
                placeholder="粘贴任务链接，每行一个链接..."
                rows={8}
              />
              <p className="text-[10px] text-gray-400">已输入 {batchLinks.split('\n').filter(l => l.trim()).length} 个链接</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-xs">平台</Label>
                <Select value={formData.platform} onValueChange={(v) => setFormData({ ...formData, platform: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PLATFORMS.DOUYIN}>{PLATFORM_NAMES[PLATFORMS.DOUYIN]}</SelectItem>
                    <SelectItem value={PLATFORMS.KUAISHOU}>{PLATFORM_NAMES[PLATFORMS.KUAISHOU]}</SelectItem>
                    <SelectItem value={PLATFORMS.XIAOHONGSHU}>{PLATFORM_NAMES[PLATFORMS.XIAOHONGSHU]}</SelectItem>
                    <SelectItem value={PLATFORMS.SHIPINHAO}>{PLATFORM_NAMES[PLATFORMS.SHIPINHAO]}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">操作类型</Label>
                <Select value={formData.action} onValueChange={(v) => setFormData({ ...formData, action: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TASK_ACTIONS.SHORT_VIDEO_RESEARCH}>短视频内容体验调研</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label className="text-xs">任务描述</Label>
              <Textarea className="text-sm min-h-[80px]" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={4} />
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label className="text-xs">奖励积分</Label>
                <Input type="number" className="h-8 text-sm" value={formData.reward} onChange={(e) => setFormData({ ...formData, reward: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">名额</Label>
                <Input type="number" className="h-8 text-sm" value={formData.remain} onChange={(e) => setFormData({ ...formData, remain: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">时限(分钟)</Label>
                <Input type="number" className="h-8 text-sm" value={formData.timeLimitMinutes} onChange={(e) => setFormData({ ...formData, timeLimitMinutes: parseInt(e.target.value) || 10 })} />
              </div>
            </div>
            
            {/* 示范图片上传 */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">完成示范图片</Label>
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useDefaultExample}
                    onChange={(e) => setUseDefaultExample(e.target.checked)}
                    className="w-3 h-3"
                  />
                  使用系统默认示范图片
                </label>
              </div>
              
              {useDefaultExample ? (
                <>
                  <p className="text-[10px] text-gray-500">当前默认示范图片（可在"系统设置"页面修改）：</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[0, 1].map((index) => (
                      <div key={index} className="relative aspect-video rounded-md overflow-hidden border bg-gray-50">
                        {defaultExampleImages[index] ? (
                          <img
                            src={defaultExampleImages[index]}
                            alt={`默认示范图片${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                            暂无图片
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[10px] text-gray-400">上传自定义示范图片，将应用到所有批量创建的任务</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[0, 1].map((index) => (
                      <div key={index} className="space-y-1">
                        <input
                          ref={(el) => { fileInputRefs.current[index] = el }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileChange(e, index)}
                        />
                        {formData.exampleImages[index] ? (
                          <div className="relative aspect-video rounded-md overflow-hidden border bg-gray-50 group">
                            <img
                              src={formData.exampleImages[index]}
                              alt={`示范图片${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-6 px-2 text-xs"
                                onClick={() => triggerFileSelect(index)}
                                disabled={uploadingImageIndex === index}
                              >
                                <Upload className="h-3 w-3 mr-1" />
                                更换
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-6 px-2 text-xs"
                                onClick={() => handleRemoveImage(index)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="aspect-video rounded-md border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
                            onClick={() => triggerFileSelect(index)}
                          >
                            {uploadingImageIndex === index ? (
                              <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                            ) : (
                              <>
                                <Upload className="h-5 w-5 text-gray-400" />
                                <span className="text-[10px] text-gray-500">图片 {index + 1}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => {
              setShowBatchDialog(false)
              setBatchLinks('')
            }}>取消</Button>
            <Button 
              size="sm" 
              onClick={handleBatchSubmit} 
              disabled={isBatchSubmitting || !batchLinks.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isBatchSubmitting ? '创建中...' : `批量创建 ${batchLinks.split('\n').filter(l => l.trim()).length} 个任务`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
