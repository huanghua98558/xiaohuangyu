'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  MessageSquare, Save, Loader2, RefreshCw, AlertTriangle, Plus, Trash2, Edit, FileText
} from 'lucide-react'
import { toast } from 'sonner'

// ========== 配置类型 ==========

interface TaskTemplate {
  id: number | string
  name: string
  platform: string
  action: string
  reward: number
  remain: number
  timeLimitMinutes: number
  desc: string
  isDefault?: boolean
}

interface TaskDescription {
  defaultDescription: string
  defaultSteps: string
  tutorial: {
    qualificationStandards: string
    positiveCommentExamples: string
    commentLibrary: string
    copyTip: string
  }
  platforms: {
    [key: string]: {
      description: string
      steps: string
    }
  }
}

const defaultTaskDescription: TaskDescription = {
  defaultDescription: '按照任务要求完成截图，确保截图清晰完整。',
  defaultSteps: '1. 打开指定平台\n2. 找到目标内容\n3. 完成互动操作\n4. 截图保存上传',
  tutorial: {
    qualificationStandards: [
      '必有本任务的视频截图和评论截图',
      '视频截图已经有了点赞和收藏（只完成一个会不通过）',
      '评论截图必须是本人截图（一般在评论第一条，评论人名字后面带我标签）',
      '评论至少8个字。少字直接不通过',
      '评论内容要带有正向推荐，不要没有意义的灌水，并尽量与视频展示的产品有关联性，如不知道关联尽可能用中性词。',
    ].join('\n'),
    positiveCommentExamples: [
      '买了好几次了，也没有什么复做用，总的来说比较好',
      '真的不错，用了下次再来够买',
      '第一次用了这个产品，决定以后就买他们家的了',
      '好用，已回购，早点发货',
      '朋友推荐的没想到这么好用',
      '昨天收到了，试了一下，笑果真心不错，久违的感觉',
      '真实不需要评价，我用真管用',
      '试了，非常好拥，立马下了一单了',
      '来回购，比在國外买的墙多了',
      '朋友推荐的，好期待',
    ].join('\n'),
    commentLibrary: [
      '拍过好几种了，就这种还不错',
      '本来对这些东西就半信半疑，用了才知道，选对的比选贵的重要，不错!',
      '我一般不做评论，但你家的这个真好！[赞]',
      '二次会购了，不错哦，比市面上的强多了，满意！',
      '这个真的很好，也推荐过给我的朋友',
      '拍了一单回来试试，好用给你介绍朋友[呲牙]',
      '好多次回购了，很满意，真的太牛了。',
      '确实不错，已经回购几次了',
      '不错，物有所值[赞][赞][赞]',
      '买了好几次了，也没有复做用，总的来说比较好',
      '老婆之前拍过不搓值得推荐',
      '感觉很好👌价钱也合适又回购了😃好极了😘',
      '上次朋友推荐拍的，真的好用哦',
      '不错不错，值得入手',
      '又来回购了，牛[强][强]',
      '身边的朋友都在拥',
      '真的给力，媳妇很满意[玫瑰]',
    ].join('\n'),
    copyTip: '参考评论库：用户点击哪条评论，就直接复制哪条评论。请优先选和视频产品相关、语气自然、满足 8 个字以上的内容。',
  },
  platforms: {
    xiaohongshu: {
      description: '打开小红书APP，找到目标笔记，完成点赞/收藏/评论操作后截图。',
      steps: '1. 打开小红书APP\n2. 搜索目标笔记\n3. 完成互动操作\n4. 截图上传'
    },
    douyin: {
      description: '打开抖音APP，找到目标视频，完成点赞/评论操作后截图。',
      steps: '1. 打开抖音APP\n2. 搜索目标视频\n3. 完成互动操作\n4. 截图上传'
    }
  }
}

const PLATFORMS = [
  { id: 'xiaohongshu', name: '小红书' },
  { id: 'douyin', name: '抖音' },
  { id: 'weibo', name: '微博' },
  { id: 'kuaishou', name: '快手' },
  { id: 'bilibili', name: 'B站' }
]

const ACTIONS = [
  { id: 'like', name: '点赞' },
  { id: 'favorite', name: '收藏' },
  { id: 'comment', name: '评论' },
  { id: 'follow', name: '关注' },
  { id: 'share', name: '分享' }
]

function parseArrayConfig(value: string | undefined, fallback: string): string {
  if (!value) return fallback
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item || '').trim()).filter(Boolean).join('\n')
    }
  } catch {
    // 兼容旧值直接存纯文本
  }
  return value
}

function toConfigArray(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

export default function AssistantPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  
  // 任务说明配置
  const [taskDescription, setTaskDescription] = useState<TaskDescription>(defaultTaskDescription)
  
  // 任务模板列表
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null)
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)

  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
    return { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }

  const loadConfig = async () => {
    try {
      // 加载任务说明配置
      const res = await fetch('/admin/api/ai/admin/configs?category=assistant', { headers: getAuthHeaders() })
      const data = await res.json()
      
      if (data.code === 200 && data.data) {
        const configs = data.data
        const getValue = (key: string) => {
          const item = configs.find((c: any) => c.key === key)
          return item?.value
        }
        
        setTaskDescription({
          defaultDescription: getValue('task_default_description') || defaultTaskDescription.defaultDescription,
          defaultSteps: getValue('task_default_steps') || defaultTaskDescription.defaultSteps,
          tutorial: {
            qualificationStandards: parseArrayConfig(
              getValue('task_tutorial_qualification_standards'),
              defaultTaskDescription.tutorial.qualificationStandards
            ),
            positiveCommentExamples: parseArrayConfig(
              getValue('task_tutorial_positive_comment_examples'),
              defaultTaskDescription.tutorial.positiveCommentExamples
            ),
            commentLibrary: parseArrayConfig(
              getValue('task_tutorial_comment_library'),
              defaultTaskDescription.tutorial.commentLibrary
            ),
            copyTip: getValue('task_tutorial_copy_tip') || defaultTaskDescription.tutorial.copyTip,
          },
          platforms: {
            xiaohongshu: {
              description: getValue('task_xiaohongshu_description') || '',
              steps: getValue('task_xiaohongshu_steps') || ''
            },
            douyin: {
              description: getValue('task_douyin_description') || '',
              steps: getValue('task_douyin_steps') || ''
            },
            weibo: {
              description: getValue('task_weibo_description') || '',
              steps: getValue('task_weibo_steps') || ''
            }
          }
        })
      }
      
      // 加载任务模板
      const templateRes = await fetch('/admin/api/ai/admin/task-templates', { headers: getAuthHeaders() })
      const templateData = await templateRes.json()
      if (templateData.code === 200) {
        setTemplates(templateData.data || [])
      }
      
    } catch (e) {
      console.error('加载配置失败:', e)
      toast.error('加载配置失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadConfig() }, [])

  const saveConfig = async () => {
    setSaving(true)
    try {
      const updates = [
        { key: 'task_default_description', value: taskDescription.defaultDescription, category: 'assistant' },
        { key: 'task_default_steps', value: taskDescription.defaultSteps, category: 'assistant' },
        {
          key: 'task_tutorial_qualification_standards',
          value: JSON.stringify(toConfigArray(taskDescription.tutorial.qualificationStandards)),
          category: 'assistant'
        },
        {
          key: 'task_tutorial_positive_comment_examples',
          value: JSON.stringify(toConfigArray(taskDescription.tutorial.positiveCommentExamples)),
          category: 'assistant'
        },
        {
          key: 'task_tutorial_comment_library',
          value: JSON.stringify(toConfigArray(taskDescription.tutorial.commentLibrary)),
          category: 'assistant'
        },
        {
          key: 'task_tutorial_copy_tip',
          value: taskDescription.tutorial.copyTip,
          category: 'assistant'
        },
        { key: 'task_xiaohongshu_description', value: taskDescription.platforms.xiaohongshu?.description || '', category: 'assistant' },
        { key: 'task_xiaohongshu_steps', value: taskDescription.platforms.xiaohongshu?.steps || '', category: 'assistant' },
        { key: 'task_douyin_description', value: taskDescription.platforms.douyin?.description || '', category: 'assistant' },
        { key: 'task_douyin_steps', value: taskDescription.platforms.douyin?.steps || '', category: 'assistant' },
        { key: 'task_weibo_description', value: taskDescription.platforms.weibo?.description || '', category: 'assistant' },
        { key: 'task_weibo_steps', value: taskDescription.platforms.weibo?.steps || '', category: 'assistant' }
      ]
      
      await fetch('/admin/api/ai/admin/configs/batch', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ updates })
      })
      
      toast.success('配置已保存')
      setHasChanges(false)
    } catch (e) {
      console.error('保存失败:', e)
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const updateTaskDescription = (field: string, value: string) => {
    if (field.startsWith('tutorial.')) {
      const [, prop] = field.split('.')
      setTaskDescription(prev => ({
        ...prev,
        tutorial: {
          ...prev.tutorial,
          [prop]: value
        }
      }))
    } else if (field.includes('.')) {
      const [platform, prop] = field.split('.')
      setTaskDescription(prev => ({
        ...prev,
        platforms: {
          ...prev.platforms,
          [platform]: {
            ...prev.platforms[platform],
            [prop]: value
          }
        }
      }))
    } else {
      setTaskDescription(prev => ({ ...prev, [field]: value }))
    }
    setHasChanges(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6" />
            AI发布助手
          </h1>
          <p className="text-muted-foreground mt-1">配置任务模板和默认说明</p>
        </div>
        {hasChanges && (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
            <AlertTriangle className="w-3 h-3 mr-1" />
            有未保存的更改
          </Badge>
        )}
      </div>

      {/* 默认任务说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            默认任务说明
          </CardTitle>
          <CardDescription>用户查看任务详情时显示的默认说明</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>任务说明</Label>
            <Textarea
              value={taskDescription.defaultDescription}
              onChange={(e) => updateTaskDescription('defaultDescription', e.target.value)}
              rows={3}
              placeholder="输入任务说明..."
            />
            <p className="text-xs text-muted-foreground">前端调用：直接显示在任务详情页</p>
          </div>
          
          <div className="space-y-2">
            <Label>操作步骤</Label>
            <Textarea
              value={taskDescription.defaultSteps}
              onChange={(e) => updateTaskDescription('defaultSteps', e.target.value)}
              rows={4}
              placeholder="1. 第一步\n2. 第二步\n..."
            />
            <p className="text-xs text-muted-foreground">前端调用：按行解析显示为步骤列表</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            教学式任务说明配置
          </CardTitle>
          <CardDescription>这里维护用户端任务详情中的合格标准、评论示例、评论库弹窗和醒目复制提示。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>任务合格标准</Label>
            <Textarea
              value={taskDescription.tutorial.qualificationStandards}
              onChange={(e) => updateTaskDescription('tutorial.qualificationStandards', e.target.value)}
              rows={6}
              placeholder={'每行一条，例如：\n必有本任务的视频截图和评论截图'}
            />
            <p className="text-xs text-muted-foreground">每行一条，前端会渲染成醒目的标准说明卡片。</p>
          </div>

          <div className="space-y-2">
            <Label>正向推荐评论示例</Label>
            <Textarea
              value={taskDescription.tutorial.positiveCommentExamples}
              onChange={(e) => updateTaskDescription('tutorial.positiveCommentExamples', e.target.value)}
              rows={8}
              placeholder="每行一条示例评论"
            />
            <p className="text-xs text-muted-foreground">用于任务详情页直接展示，帮助用户快速理解评论风格。</p>
          </div>

          <div className="space-y-2">
            <Label>参考评论库（详细）</Label>
            <Textarea
              value={taskDescription.tutorial.commentLibrary}
              onChange={(e) => updateTaskDescription('tutorial.commentLibrary', e.target.value)}
              rows={12}
              placeholder="每行一条评论库内容"
            />
            <p className="text-xs text-muted-foreground">前端弹窗会按单条展示，用户点击后即可一键复制该条评论。</p>
          </div>

          <div className="space-y-2">
            <Label>复制提示文案</Label>
            <Textarea
              value={taskDescription.tutorial.copyTip}
              onChange={(e) => updateTaskDescription('tutorial.copyTip', e.target.value)}
              rows={3}
              placeholder="输入弹窗顶部或按钮区域的醒目提示"
            />
            <p className="text-xs text-muted-foreground">建议明确写出“点击哪条评论，就复制哪条评论”。</p>
          </div>
        </CardContent>
      </Card>

      {/* 平台特定说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">平台特定说明</CardTitle>
          <CardDescription>针对不同平台的个性化说明（可选）</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {PLATFORMS.slice(0, 3).map(platform => (
            <div key={platform.id} className="space-y-3">
              <h4 className="font-medium">{platform.name}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">说明</Label>
                  <Textarea
                    value={taskDescription.platforms[platform.id]?.description || ''}
                    onChange={(e) => updateTaskDescription(`${platform.id}.description`, e.target.value)}
                    rows={2}
                    placeholder="留空则使用默认说明"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">步骤</Label>
                  <Textarea
                    value={taskDescription.platforms[platform.id]?.steps || ''}
                    onChange={(e) => updateTaskDescription(`${platform.id}.steps`, e.target.value)}
                    rows={2}
                    placeholder="留空则使用默认步骤"
                  />
                </div>
              </div>
              <Separator />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 任务模板 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">任务模板</CardTitle>
              <CardDescription>快速创建任务的预设模板</CardDescription>
            </div>
            <Button size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              添加模板
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>暂无模板，点击上方按钮添加</p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <div key={template.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{PLATFORMS.find(p => p.id === template.platform)?.name || template.platform}</Badge>
                    <span className="font-medium">{template.name}</span>
                    {template.isDefault && <Badge className="text-xs">默认</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => { setEditingTemplate(template); setShowTemplateDialog(true); }}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 底部保存栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
        <div className="container max-w-5xl py-4 px-6 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={() => { setHasChanges(false); loadConfig(); }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            重置
          </Button>
          <Button onClick={saveConfig} disabled={saving || !hasChanges}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                保存配置
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
