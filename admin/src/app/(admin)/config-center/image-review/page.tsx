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
  Image as ImageIcon, Save, Loader2, RefreshCw, AlertTriangle, Eye, Cpu, Settings
} from 'lucide-react'
import { toast } from 'sonner'

// ========== 配置类型 ==========

interface ImageReviewConfig {
  // 检测项开关
  checks: {
    follow: boolean
    like: boolean
    favorite: boolean
    comment: boolean
    authorName: boolean
    commentNickname: boolean
  }
  // OCR配置
  ocr: {
    confidenceThreshold: number
    useGPU: boolean
    language: string
  }
  // YOLO配置
  yolo: {
    confidenceThreshold: number
    modelPath: string
  }
  // AI模型配置
  aiModel: {
    provider: string
    model: string
    apiKey: string
    baseUrl: string
  }
}

const defaultConfig: ImageReviewConfig = {
  checks: {
    follow: true,
    like: true,
    favorite: true,
    comment: true,
    authorName: true,
    commentNickname: true
  },
  ocr: {
    confidenceThreshold: 0.7,
    useGPU: false,
    language: 'ch'
  },
  yolo: {
    confidenceThreshold: 0.5,
    modelPath: '/models/yolo/best.pt'
  },
  aiModel: {
    provider: 'bailian',
    model: 'qwen-vl-max',
    apiKey: '',
    baseUrl: ''
  }
}

export default function ImageReviewPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<ImageReviewConfig>(defaultConfig)
  const [hasChanges, setHasChanges] = useState(false)

  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
    return { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }

  const loadConfig = async () => {
    try {
      const res = await fetch('/admin/api/ai/admin/review-settings', { headers: getAuthHeaders() })
      const data = await res.json()
      
      if (data.code === 200 && data.data) {
        setConfig(prev => ({
          ...prev,
          checks: data.data.checks || defaultConfig.checks
        }))
      }
      
      // 加载AI模型配置
      const aiRes = await fetch('/admin/api/ai/admin/configs?category=image_review', { headers: getAuthHeaders() })
      const aiData = await aiRes.json()
      
      if (aiData.code === 200 && aiData.data) {
        const configs = aiData.data
        const getValue = (key: string) => {
          const item = configs.find((c: any) => c.key === key)
          return item?.value
        }
        
        setConfig(prev => ({
          ...prev,
          ocr: {
            confidenceThreshold: parseFloat(getValue('ocr_confidence_threshold') || '0.7'),
            useGPU: getValue('ocr_use_gpu') === 'true',
            language: getValue('ocr_language') || 'ch'
          },
          yolo: {
            confidenceThreshold: parseFloat(getValue('yolo_confidence_threshold') || '0.5'),
            modelPath: getValue('yolo_model_path') || '/models/yolo/best.pt'
          },
          aiModel: {
            provider: getValue('image_ai_provider') || 'bailian',
            model: getValue('image_ai_model') || 'qwen-vl-max',
            apiKey: getValue('image_ai_api_key') || '',
            baseUrl: getValue('image_ai_base_url') || ''
          }
        }))
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
      // 保存检测项配置
      const res = await fetch('/admin/api/ai/admin/review-settings', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ checks: config.checks })
      })
      
      // 保存OCR/YOLO/AI模型配置
      const updates = [
        { key: 'ocr_confidence_threshold', value: String(config.ocr.confidenceThreshold), category: 'image_review' },
        { key: 'ocr_use_gpu', value: String(config.ocr.useGPU), category: 'image_review' },
        { key: 'ocr_language', value: config.ocr.language, category: 'image_review' },
        { key: 'yolo_confidence_threshold', value: String(config.yolo.confidenceThreshold), category: 'image_review' },
        { key: 'yolo_model_path', value: config.yolo.modelPath, category: 'image_review' },
        { key: 'image_ai_provider', value: config.aiModel.provider, category: 'image_review' },
        { key: 'image_ai_model', value: config.aiModel.model, category: 'image_review' },
        { key: 'image_ai_api_key', value: config.aiModel.apiKey, category: 'image_review' },
        { key: 'image_ai_base_url', value: config.aiModel.baseUrl, category: 'image_review' }
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

  const updateChecks = (key: keyof typeof config.checks, value: boolean) => {
    setConfig(prev => ({ ...prev, checks: { ...prev.checks, [key]: value } }))
    setHasChanges(true)
  }

  const updateOCR = (updates: Partial<typeof config.ocr>) => {
    setConfig(prev => ({ ...prev, ocr: { ...prev.ocr, ...updates } }))
    setHasChanges(true)
  }

  const updateYOLO = (updates: Partial<typeof config.yolo>) => {
    setConfig(prev => ({ ...prev, yolo: { ...prev.yolo, ...updates } }))
    setHasChanges(true)
  }

  const updateAIModel = (updates: Partial<typeof config.aiModel>) => {
    setConfig(prev => ({ ...prev, aiModel: { ...prev.aiModel, ...updates } }))
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
            <ImageIcon className="w-6 h-6" />
            图片审核设置
          </h1>
          <p className="text-muted-foreground mt-1">配置图片审核检测项和AI模型</p>
        </div>
        {hasChanges && (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
            <AlertTriangle className="w-3 h-3 mr-1" />
            有未保存的更改
          </Badge>
        )}
      </div>

      {/* 检测项开关 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">检测项开关</CardTitle>
          <CardDescription>关闭的检测项不参与审核</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { key: 'follow', label: '关注检测', desc: '检测关注按钮状态' },
              { key: 'like', label: '点赞检测', desc: '检测点赞状态' },
              { key: 'favorite', label: '收藏检测', desc: '检测收藏状态' },
              { key: 'comment', label: '评论检测', desc: '检测评论内容' },
              { key: 'authorName', label: '作者昵称', desc: '检测作者昵称匹配' },
              { key: 'commentNickname', label: '评论昵称', desc: '检测评论者昵称' }
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <Label className="font-medium">{item.label}</Label>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch
                  checked={config.checks[item.key as keyof typeof config.checks]}
                  onCheckedChange={(checked) => updateChecks(item.key as keyof typeof config.checks, checked)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* OCR配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="w-4 h-4" />
            OCR配置
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>置信度阈值</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={config.ocr.confidenceThreshold}
                onChange={(e) => updateOCR({ confidenceThreshold: parseFloat(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">文字识别最低置信度</p>
            </div>
            <div className="space-y-2">
              <Label>语言</Label>
              <Select value={config.ocr.language} onValueChange={(v) => updateOCR({ language: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ch">中文</SelectItem>
                  <SelectItem value="en">英文</SelectItem>
                  <SelectItem value="ch_en">中英文</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label>启用GPU</Label>
                <p className="text-xs text-muted-foreground">GPU加速识别</p>
              </div>
              <Switch
                checked={config.ocr.useGPU}
                onCheckedChange={(checked) => updateOCR({ useGPU: checked })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* YOLO配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            YOLO配置
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>置信度阈值</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={config.yolo.confidenceThreshold}
                onChange={(e) => updateYOLO({ confidenceThreshold: parseFloat(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">目标检测最低置信度</p>
            </div>
            <div className="space-y-2">
              <Label>模型路径</Label>
              <Input
                value={config.yolo.modelPath}
                onChange={(e) => updateYOLO({ modelPath: e.target.value })}
                placeholder="/models/yolo/best.pt"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI模型配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="w-4 h-4" />
            AI模型配置
          </CardTitle>
          <CardDescription>用于图片理解分析的AI模型</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>服务提供商</Label>
              <Select 
                value={config.aiModel.provider} 
                onValueChange={(v) => updateAIModel({ provider: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bailian">百炼AI</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="siliconflow">硅基流动</SelectItem>
                  <SelectItem value="custom">自定义</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>模型</Label>
              <Input
                value={config.aiModel.model}
                onChange={(e) => updateAIModel({ model: e.target.value })}
                placeholder="qwen-vl-max"
              />
            </div>
          </div>
          
          {config.aiModel.provider === 'custom' && (
            <>
              <div className="space-y-2">
                <Label>API Base URL</Label>
                <Input
                  value={config.aiModel.baseUrl}
                  onChange={(e) => updateAIModel({ baseUrl: e.target.value })}
                  placeholder="https://api.example.com/v1"
                />
              </div>
            </>
          )}
          
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input
              type="password"
              value={config.aiModel.apiKey}
              onChange={(e) => updateAIModel({ apiKey: e.target.value })}
              placeholder="sk-xxx"
            />
          </div>
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
