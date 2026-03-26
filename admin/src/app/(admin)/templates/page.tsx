'use client'

import { useEffect, useState, useCallback } from 'react'
import { getTaskTemplates, createTaskTemplate, updateTaskTemplate, deleteTaskTemplate, useTemplateToCreateTask, TaskTemplate } from '@/lib/api'
import { PLATFORMS, PLATFORM_NAMES, getPlatformName as getPlatformNameConst } from '@/constants/taskActions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText,
  Plus,
  ChevronLeft,
  ChevronRight,
  Copy,
  Trash2,
  Edit,
  Star,
  Zap,
} from 'lucide-react'

// 获取平台显示名称（使用常量，兼容旧数据）
const getPlatformLabel = (platform: string) => {
  if (platform === 'bilibili') return 'B站'
  if (platform === 'wechat') return '微信'
  return getPlatformNameConst(platform)
}

const ACTION_LABELS: Record<string, string> = {
  evaluator: '短视频评价官',
}

export default function TaskTemplatesPage() {
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [platformFilter, setPlatformFilter] = useState<string>('')
  
  // 编辑对话框
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null)
  const [formData, setFormData] = useState<{
    name: string
    description: string
    platform: string
    action: string
    reward: number
    timeLimitMinutes: number
    cityLimit: number
    provinceLimit: number
  }>({
    name: '',
    description: '',
    platform: PLATFORMS.DOUYIN,
    action: 'evaluator',
    reward: 30,
    timeLimitMinutes: 10,
    cityLimit: 1,
    provinceLimit: 4,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // 使用模板对话框
  const [useDialogOpen, setUseDialogOpen] = useState(false)
  const [usingTemplate, setUsingTemplate] = useState<TaskTemplate | null>(null)
  const [useFormData, setUseFormData] = useState({
    title: '',
    remain: 100,
  })
  const [isUsing, setIsUsing] = useState(false)
  
  const pageSize = 20
  
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getTaskTemplates({
        page,
        size: pageSize,
        platform: platformFilter || undefined,
      })
      
      setTemplates(data.list)
      setTotal(data.total)
    } catch (err) {
      console.error('加载任务模板失败', err)
    } finally {
      setIsLoading(false)
    }
  }, [page, platformFilter])
  
  useEffect(() => {
    loadData()
  }, [loadData])
  
  const totalPages = Math.ceil(total / pageSize)
  
  const handleOpenEdit = (template?: TaskTemplate) => {
    if (template) {
      setEditingTemplate(template)
      setFormData({
        name: template.name,
        description: template.description || '',
        platform: template.platform,
        action: template.action,
        reward: template.reward,
        timeLimitMinutes: template.time_limit_minutes,
        cityLimit: template.city_limit,
        provinceLimit: template.province_limit,
      })
    } else {
      setEditingTemplate(null)
      setFormData({
        name: '',
        description: '',
        platform: PLATFORMS.DOUYIN,
        action: 'evaluator',
        reward: 30,
        timeLimitMinutes: 10,
        cityLimit: 1,
        provinceLimit: 4,
      })
    }
    setEditDialogOpen(true)
  }
  
  const handleSubmit = async () => {
    if (!formData.name) {
      alert('请输入模板名称')
      return
    }
    
    setIsSubmitting(true)
    try {
      if (editingTemplate) {
        await updateTaskTemplate(editingTemplate.id, formData)
      } else {
        await createTaskTemplate(formData)
      }
      setEditDialogOpen(false)
      loadData()
    } catch (err) {
      console.error('保存模板失败', err)
      alert('保存失败')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleDelete = async (templateId: number) => {
    if (!confirm('确定要删除这个模板吗？')) return
    
    try {
      await deleteTaskTemplate(templateId)
      loadData()
    } catch (err) {
      console.error('删除模板失败', err)
    }
  }
  
  const handleOpenUse = (template: TaskTemplate) => {
    setUsingTemplate(template)
    setUseFormData({
      title: template.name,
      remain: 100,
    })
    setUseDialogOpen(true)
  }
  
  const handleUseTemplate = async () => {
    if (!usingTemplate) return
    
    setIsUsing(true)
    try {
      await useTemplateToCreateTask(usingTemplate.id, useFormData)
      alert('任务创建成功')
      setUseDialogOpen(false)
      loadData()
    } catch (err) {
      console.error('创建任务失败', err)
      alert('创建任务失败')
    } finally {
      setIsUsing(false)
    }
  }
  
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">快速创建常用任务</p>
        <Button onClick={() => handleOpenEdit()}>
          <Plus className="h-4 w-4 mr-1" />
          新建模板
        </Button>
      </div>
      
      {/* 筛选 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">平台</label>
              <Select value={platformFilter || "all"} onValueChange={(v) => setPlatformFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value={PLATFORMS.DOUYIN}>{PLATFORM_NAMES[PLATFORMS.DOUYIN]}</SelectItem>
                  <SelectItem value={PLATFORMS.XIAOHONGSHU}>{PLATFORM_NAMES[PLATFORMS.XIAOHONGSHU]}</SelectItem>
                  <SelectItem value={PLATFORMS.KUAISHOU}>{PLATFORM_NAMES[PLATFORMS.KUAISHOU]}</SelectItem>
                  <SelectItem value={PLATFORMS.SHIPINHAO}>{PLATFORM_NAMES[PLATFORMS.SHIPINHAO]}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* 模板列表 */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>模板名称</TableHead>
                  <TableHead>平台</TableHead>
                  <TableHead>操作</TableHead>
                  <TableHead>奖励</TableHead>
                  <TableHead>时限</TableHead>
                  <TableHead>使用次数</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      暂无任务模板
                    </TableCell>
                  </TableRow>
                ) : templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{template.name}</p>
                        {template.description && (
                          <p className="text-sm text-muted-foreground">{template.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getPlatformLabel(template.platform)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {ACTION_LABELS[template.action] || template.action}
                      </Badge>
                    </TableCell>
                    <TableCell>{template.reward}积分</TableCell>
                    <TableCell>{template.time_limit_minutes}分钟</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-500" />
                        {template.use_count}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenUse(template)}
                        >
                          <Zap className="h-4 w-4 mr-1" />
                          使用
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEdit(template)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => handleDelete(template.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                共 {total} 个模板
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  第 {page} / {totalPages} 页
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* 编辑模板对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? '编辑模板' : '新建模板'}</DialogTitle>
            <DialogDescription>
              创建任务模板，方便快速创建相同配置的任务
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>模板名称 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="如：抖音关注任务"
              />
            </div>
            <div>
              <Label>描述</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="任务描述"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>平台</Label>
                <Select value={formData.platform} onValueChange={(v) => setFormData({ ...formData, platform: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PLATFORMS.DOUYIN}>{PLATFORM_NAMES[PLATFORMS.DOUYIN]}</SelectItem>
                    <SelectItem value={PLATFORMS.XIAOHONGSHU}>{PLATFORM_NAMES[PLATFORMS.XIAOHONGSHU]}</SelectItem>
                    <SelectItem value={PLATFORMS.KUAISHOU}>{PLATFORM_NAMES[PLATFORMS.KUAISHOU]}</SelectItem>
                    <SelectItem value={PLATFORMS.SHIPINHAO}>{PLATFORM_NAMES[PLATFORMS.SHIPINHAO]}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>操作</Label>
                <Select value={formData.action} onValueChange={(v) => setFormData({ ...formData, action: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACTION_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>奖励积分</Label>
                <Input
                  type="number"
                  value={formData.reward}
                  onChange={(e) => setFormData({ ...formData, reward: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>时限(分钟)</Label>
                <Input
                  type="number"
                  value={formData.timeLimitMinutes}
                  onChange={(e) => setFormData({ ...formData, timeLimitMinutes: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>同城市上限</Label>
                <Input
                  type="number"
                  value={formData.cityLimit}
                  onChange={(e) => setFormData({ ...formData, cityLimit: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 使用模板对话框 */}
      <Dialog open={useDialogOpen} onOpenChange={setUseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>使用模板创建任务</DialogTitle>
            <DialogDescription>
              基于模板「{usingTemplate?.name}」创建新任务
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>任务标题</Label>
              <Input
                value={useFormData.title}
                onChange={(e) => setUseFormData({ ...useFormData, title: e.target.value })}
              />
            </div>
            <div>
              <Label>任务数量</Label>
              <Input
                type="number"
                value={useFormData.remain}
                onChange={(e) => setUseFormData({ ...useFormData, remain: Number(e.target.value) })}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <p>平台: {usingTemplate && getPlatformLabel(usingTemplate.platform)}</p>
              <p>操作: {usingTemplate && ACTION_LABELS[usingTemplate.action]}</p>
              <p>奖励: {usingTemplate?.reward}积分</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUseDialogOpen(false)}>取消</Button>
            <Button onClick={handleUseTemplate} disabled={isUsing}>
              {isUsing ? '创建中...' : '创建任务'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
