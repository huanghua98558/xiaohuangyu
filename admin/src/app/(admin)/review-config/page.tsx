'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Settings, Image as ImageIcon, Link2, Shield, Save, Loader2,
  AlertTriangle, Eye, Zap, Bot, RefreshCw, Info, Clock
} from 'lucide-react'
import { toast } from 'sonner'

// ========== 配置类型定义 ==========

/** 检测项开关 */
interface ChecksConfig {
  follow: boolean
  like: boolean
  favorite: boolean
  comment: boolean
  authorName: boolean
  commentNickname: boolean
}

/** 评论标准 */
interface CommentConfig {
  minLength: number
  maxLength: number
}

/** 语义识别配置 */
interface SemanticConfig {
  enabled: boolean
  mode: 'rule_only' | 'ai_only' | 'rule_and_ai'
  minRelevance: number
  minPositivity: number
  minEffectiveness: number
}

/** AI降级配置 */
interface AIFallbackConfig {
  enabled: boolean
  onReject: boolean
}

/** 链接验证配置 */
interface LinkVerifyConfig {
  enabled: boolean
  delayMinutes: number
  batchThreshold: number
  maxWaitMinutes: number
  batchSize: number
  retryCount: number
}

/** 状态流转配置 */
interface FlowConfig {
  autoTriggerImage: boolean
  autoTriggerLink: boolean
  blockedDetection: boolean
  notifyAdmin: boolean
  notifyUser: boolean
}

function parseNumberInput(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** 全局审核配置 */
interface ReviewSettings {
  checks: ChecksConfig
  comment: CommentConfig
  semantic: SemanticConfig
  aiFallback: AIFallbackConfig
  passMode: 'all' | 'any'
  linkVerify: LinkVerifyConfig
  flow: FlowConfig
}

// ========== 默认配置 ==========

const defaultSettings: ReviewSettings = {
  checks: {
    follow: true,
    like: true,
    favorite: true,
    comment: true,
    authorName: true,
    commentNickname: true
  },
  comment: {
    minLength: 8,
    maxLength: 500
  },
  semantic: {
    enabled: true,
    mode: 'rule_and_ai',
    minRelevance: 0.5,
    minPositivity: 0.3,
    minEffectiveness: 0.5
  },
  aiFallback: {
    enabled: true,
    onReject: true
  },
  passMode: 'all',
  linkVerify: {
    enabled: true,
    delayMinutes: 15,
    batchThreshold: 5,
    maxWaitMinutes: 60,
    batchSize: 10,
    retryCount: 3
  },
  flow: {
    autoTriggerImage: true,
    autoTriggerLink: true,
    blockedDetection: true,
    notifyAdmin: true,
    notifyUser: true
  }
}

export default function ReviewConfigPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<ReviewSettings>(defaultSettings)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // ========== 数据加载 ==========
  
  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('admin_token')
      
      const res = await fetch('/admin/api/ai/admin/review-settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      
      if (data.code === 200 && data.data) {
        setSettings({
          checks: data.data.checks || defaultSettings.checks,
          comment: data.data.comment || defaultSettings.comment,
          semantic: data.data.semantic || defaultSettings.semantic,
          aiFallback: data.data.aiFallback || defaultSettings.aiFallback,
          passMode: data.data.passMode || defaultSettings.passMode,
          linkVerify: data.data.linkVerify || defaultSettings.linkVerify,
          flow: data.data.flow || defaultSettings.flow
        })
        setLastUpdated(data.data.updatedAt || null)
      }
    } catch (e) {
      console.error('获取配置失败:', e)
      toast.error('获取配置失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { 
    fetchSettings() 
  }, [])

  // ========== 保存配置 ==========
  
  const saveSettings = async () => {
    setSaving(true)
    try {
      const token = localStorage.getItem('admin_token')
      
      const res = await fetch('/admin/api/ai/admin/review-settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      })
      const data = await res.json()
      
      if (data.code === 200) {
        toast.success('配置保存成功，1分钟内自动生效')
        setHasChanges(false)
        setLastUpdated(data.data?.updatedAt || new Date().toISOString())
        fetchSettings()
      } else {
        toast.error(data.message || '保存失败')
      }
    } catch (e) {
      console.error('保存配置失败:', e)
      toast.error('保存配置失败')
    } finally {
      setSaving(false)
    }
  }

  // ========== 更新辅助函数 ==========
  
  const updateChecks = (key: keyof ChecksConfig, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      checks: { ...prev.checks, [key]: value }
    }))
    setHasChanges(true)
  }

  const updateComment = (updates: Partial<CommentConfig>) => {
    setSettings(prev => ({
      ...prev,
      comment: { ...prev.comment, ...updates }
    }))
    setHasChanges(true)
  }

  const updateSemantic = (updates: Partial<SemanticConfig>) => {
    setSettings(prev => ({
      ...prev,
      semantic: { ...prev.semantic, ...updates }
    }))
    setHasChanges(true)
  }

  const updateAIFallback = (updates: Partial<AIFallbackConfig>) => {
    setSettings(prev => ({
      ...prev,
      aiFallback: { ...prev.aiFallback, ...updates }
    }))
    setHasChanges(true)
  }

  const updateLinkVerify = (updates: Partial<LinkVerifyConfig>) => {
    setSettings(prev => ({
      ...prev,
      linkVerify: { ...prev.linkVerify, ...updates }
    }))
    setHasChanges(true)
  }

  const updateFlow = (updates: Partial<FlowConfig>) => {
    setSettings(prev => ({
      ...prev,
      flow: { ...prev.flow, ...updates }
    }))
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
    <div className="container mx-auto p-6 space-y-6 max-w-5xl pb-24">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6" />
            全局审核设置
          </h1>
          <p className="text-muted-foreground mt-1">
            统一管理图片审核和链接审核的检测项配置
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <RefreshCw className="w-3 h-3" />
          热更新（1分钟缓存）
        </Badge>
      </div>

      {/* 最后更新信息 */}
      {lastUpdated && (
        <Card className="bg-muted/50">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                最后更新: {new Date(lastUpdated).toLocaleString('zh-CN')}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 检测项开关配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            图片检测项开关
          </CardTitle>
          <CardDescription>
            配置图片审核时启用的检测项，关闭的检测项不参与审核
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { key: 'follow', label: '关注检测', desc: '检测关注按钮状态' },
              { key: 'like', label: '点赞检测', desc: '检测点赞状态' },
              { key: 'favorite', label: '收藏检测', desc: '检测收藏状态' },
              { key: 'comment', label: '评论检测', desc: '检测评论内容' },
              { key: 'authorName', label: '作者名检测', desc: '检测作者昵称' },
              { key: 'commentNickname', label: '评论昵称检测', desc: '检测评论者昵称' }
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <Label className="font-medium">{item.label}</Label>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
                <Switch
                  checked={settings.checks[item.key as keyof ChecksConfig]}
                  onCheckedChange={(checked) => updateChecks(item.key as keyof ChecksConfig, checked)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 评论标准 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            评论审核标准
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>最小长度</Label>
              <Input
                type="number"
                value={settings.comment.minLength}
                onChange={(e) => updateComment({ minLength: parseInt(e.target.value) || 8 })}
                min="1"
                max="100"
              />
              <p className="text-xs text-muted-foreground">评论最少字符数</p>
            </div>
            <div className="space-y-2">
              <Label>最大长度</Label>
              <Input
                type="number"
                value={settings.comment.maxLength}
                onChange={(e) => updateComment({ maxLength: parseInt(e.target.value) || 500 })}
                min="50"
                max="2000"
              />
              <p className="text-xs text-muted-foreground">评论最大字符数</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 语义识别配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            语义识别配置
          </CardTitle>
          <CardDescription>
            配置AI语义识别的运行模式
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 启用开关 */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="font-medium">启用语义识别</Label>
              <p className="text-sm text-muted-foreground">是否启用AI语义分析功能</p>
            </div>
            <Switch
              checked={settings.semantic.enabled}
              onCheckedChange={(checked) => updateSemantic({ enabled: checked })}
            />
          </div>

          {settings.semantic.enabled && (
            <>
              {/* 验证模式 */}
              <div className="space-y-3">
                <Label className="font-medium">验证模式</Label>
                <Select
                  value={settings.semantic.mode}
                  onValueChange={(value) => updateSemantic({ mode: value as SemanticConfig['mode'] })}
                >
                  <SelectTrigger className="w-full md:w-[300px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rule_only">仅规则验证</SelectItem>
                    <SelectItem value="ai_only">仅AI验证</SelectItem>
                    <SelectItem value="rule_and_ai">规则+AI双重验证</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 阈值配置 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>相关性阈值</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={settings.semantic.minRelevance}
                    onChange={(e) => updateSemantic({ minRelevance: parseFloat(e.target.value) || 0.5 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>积极性阈值</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={settings.semantic.minPositivity}
                    onChange={(e) => updateSemantic({ minPositivity: parseFloat(e.target.value) || 0.3 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>有效性阈值</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={settings.semantic.minEffectiveness}
                    onChange={(e) => updateSemantic({ minEffectiveness: parseFloat(e.target.value) || 0.5 })}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* AI降级配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            AI降级配置
          </CardTitle>
          <CardDescription>
            配置AI服务异常时的降级策略
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="font-medium">启用降级机制</Label>
              <p className="text-sm text-muted-foreground">AI服务异常时自动降级处理</p>
            </div>
            <Switch
              checked={settings.aiFallback.enabled}
              onCheckedChange={(checked) => updateAIFallback({ enabled: checked })}
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="font-medium">拒绝时降级</Label>
              <p className="text-sm text-muted-foreground">AI拒绝时降级到规则验证</p>
            </div>
            <Switch
              checked={settings.aiFallback.onReject}
              onCheckedChange={(checked) => updateAIFallback({ onReject: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* 链接验证配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            链接验证配置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="font-medium">启用链接验证</Label>
              <p className="text-sm text-muted-foreground">是否启用链接验证功能</p>
            </div>
            <Switch
              checked={settings.linkVerify.enabled}
              onCheckedChange={(checked) => updateLinkVerify({ enabled: checked })}
            />
          </div>

          {settings.linkVerify.enabled && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>延迟时间(分钟)</Label>
                <Input
                  type="number"
                  value={settings.linkVerify.delayMinutes}
                  onChange={(e) => updateLinkVerify({ delayMinutes: parseNumberInput(e.target.value, 15) })}
                  min="0"
                  max="120"
                />
              </div>
              <div className="space-y-2">
                <Label>批量阈值</Label>
                <Input
                  type="number"
                  value={settings.linkVerify.batchThreshold}
                  onChange={(e) => updateLinkVerify({ batchThreshold: parseNumberInput(e.target.value, 5) })}
                  min="1"
                  max="50"
                />
              </div>
              <div className="space-y-2">
                <Label>最大等待(分钟)</Label>
                <Input
                  type="number"
                  value={settings.linkVerify.maxWaitMinutes}
                  onChange={(e) => updateLinkVerify({ maxWaitMinutes: parseNumberInput(e.target.value, 60) })}
                  min="0"
                  max="480"
                />
              </div>
              <div className="space-y-2">
                <Label>批次大小</Label>
                <Input
                  type="number"
                  value={settings.linkVerify.batchSize}
                  onChange={(e) => updateLinkVerify({ batchSize: parseNumberInput(e.target.value, 10) })}
                  min="1"
                  max="50"
                />
              </div>
              <div className="space-y-2">
                <Label>重试次数</Label>
                <Input
                  type="number"
                  value={settings.linkVerify.retryCount}
                  onChange={(e) => updateLinkVerify({ retryCount: parseNumberInput(e.target.value, 3) })}
                  min="0"
                  max="10"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 状态流转配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            状态流转配置
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'autoTriggerImage', label: '自动触发图片审核', desc: '提交后自动开始图片审核' },
              { key: 'autoTriggerLink', label: '自动触发链接审核', desc: '图片审核通过后自动开始链接审核' },
              { key: 'blockedDetection', label: '封控检测', desc: '检测异常行为并触发封控' },
              { key: 'notifyAdmin', label: '管理员通知', desc: '异常情况通知管理员' },
              { key: 'notifyUser', label: '用户通知', desc: '审核结果通知用户' }
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <Label className="font-medium">{item.label}</Label>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
                <Switch
                  checked={settings.flow[item.key as keyof FlowConfig]}
                  onCheckedChange={(checked) => updateFlow({ [item.key]: checked })}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 说明信息 */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4 px-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">配置生效说明</p>
              <ul className="list-disc list-inside space-y-1 text-blue-600">
                <li>配置修改后，系统会在1分钟内自动刷新缓存生效</li>
                <li>关闭的检测项不会参与审核，不影响审核结果</li>
                <li>所有配置修改都会记录操作人和时间</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 底部固定保存栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
        <div className="container mx-auto max-w-5xl py-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {hasChanges && (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                <AlertTriangle className="w-3 h-3 mr-1" />
                有未保存的更改
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => { setHasChanges(false); fetchSettings(); }}
              disabled={saving}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              刷新
            </Button>
            <Button
              onClick={saveSettings}
              disabled={saving || !hasChanges}
              className="min-w-[120px]"
            >
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
    </div>
  )
}
