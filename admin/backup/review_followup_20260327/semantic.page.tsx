'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { 
  Bot, Save, Loader2, RefreshCw, AlertTriangle, Settings, Zap, Shield
} from 'lucide-react'
import { toast } from 'sonner'

// ========== 配置类型 ==========

interface SemanticConfig {
  enabled: boolean
  mode: 'rule_only' | 'ai_only' | 'rule_and_ai'
  minRelevance: number
  minPositivity: number
  minEffectiveness: number
}

interface AIConfig {
  provider: string
  model: string
  apiKey: string
  baseUrl: string
  temperature: number
  maxTokens: number
}

interface FallbackConfig {
  enabled: boolean
  onReject: boolean
  timeout: number
  maxRetries: number
}

const defaultSemanticConfig: SemanticConfig = {
  enabled: true,
  mode: 'rule_and_ai',
  minRelevance: 0.5,
  minPositivity: 0.3,
  minEffectiveness: 0.5
}

const defaultAIConfig: AIConfig = {
  provider: 'bailian',
  model: 'qwen-max',
  apiKey: '',
  baseUrl: '',
  temperature: 0.7,
  maxTokens: 2000
}

const defaultFallbackConfig: FallbackConfig = {
  enabled: true,
  onReject: true,
  timeout: 5000,
  maxRetries: 3
}

// AI提供商列表
const AI_PROVIDERS = [
  { id: 'bailian', name: '百炼AI', baseUrl: 'https://bailian.console.aliyun.com' },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { id: 'siliconflow', name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
  { id: 'kimi', name: 'Kimi (月之暗面)', baseUrl: 'https://api.moonshot.cn/v1' },
  { id: 'custom', name: '自定义', baseUrl: '' }
]

export default function SemanticPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [semanticConfig, setSemanticConfig] = useState<SemanticConfig>(defaultSemanticConfig)
  const [aiConfig, setAIConfig] = useState<AIConfig>(defaultAIConfig)
  const [fallbackConfig, setFallbackConfig] = useState<FallbackConfig>(defaultFallbackConfig)
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
      // 加载语义配置
      const res = await fetch('/admin/api/ai/admin/review-settings', { headers: getAuthHeaders() })
      const data = await res.json()
      
      if (data.code === 200 && data.data) {
        setSemanticConfig(data.data.semantic || defaultSemanticConfig)
        setFallbackConfig({
          enabled: data.data.aiFallback?.enabled ?? true,
          onReject: data.data.aiFallback?.onReject ?? true,
          timeout: 5000,
          maxRetries: 3
        })
      }
      
      // 加载AI模型配置
      const aiRes = await fetch('/admin/api/ai/admin/configs?category=semantic', { headers: getAuthHeaders() })
      const aiData = await aiRes.json()
      
      if (aiData.code === 200 && aiData.data) {
        const configs = aiData.data
        const getValue = (key: string) => {
          const item = configs.find((c: any) => c.key === key)
          return item?.value
        }
        
        setAIConfig({
          provider: getValue('semantic_ai_provider') || 'bailian',
          model: getValue('semantic_ai_model') || 'qwen-max',
          apiKey: getValue('semantic_ai_api_key') || '',
          baseUrl: getValue('semantic_ai_base_url') || '',
          temperature: parseFloat(getValue('semantic_ai_temperature') || '0.7'),
          maxTokens: parseInt(getValue('semantic_ai_max_tokens') || '2000')
        })
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
      // 保存语义配置
      await fetch('/admin/api/ai/admin/review-settings', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          semantic: semanticConfig,
          aiFallback: fallbackConfig
        })
      })
      
      // 保存AI模型配置
      const updates = [
        { key: 'semantic_ai_provider', value: aiConfig.provider, category: 'semantic' },
        { key: 'semantic_ai_model', value: aiConfig.model, category: 'semantic' },
        { key: 'semantic_ai_api_key', value: aiConfig.apiKey, category: 'semantic' },
        { key: 'semantic_ai_base_url', value: aiConfig.baseUrl, category: 'semantic' },
        { key: 'semantic_ai_temperature', value: String(aiConfig.temperature), category: 'semantic' },
        { key: 'semantic_ai_max_tokens', value: String(aiConfig.maxTokens), category: 'semantic' }
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
            <Bot className="w-6 h-6" />
            语义检测设置
          </h1>
          <p className="text-muted-foreground mt-1">配置AI语义识别和模型参数</p>
        </div>
        {hasChanges && (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
            <AlertTriangle className="w-3 h-3 mr-1" />
            有未保存的更改
          </Badge>
        )}
      </div>

      {/* 语义识别配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">语义识别配置</CardTitle>
          <CardDescription>控制AI语义分析的行为</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 启用开关 */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="font-medium">启用语义识别</Label>
              <p className="text-sm text-muted-foreground">是否启用AI语义分析功能</p>
            </div>
            <Switch
              checked={semanticConfig.enabled}
              onCheckedChange={(checked) => { 
                setSemanticConfig(prev => ({ ...prev, enabled: checked }))
                setHasChanges(true)
              }}
            />
          </div>

          {semanticConfig.enabled && (
            <>
              {/* 验证模式 */}
              <div className="space-y-3">
                <Label className="font-medium">验证模式</Label>
                <Select
                  value={semanticConfig.mode}
                  onValueChange={(value) => { 
                    setSemanticConfig(prev => ({ ...prev, mode: value as any }))
                    setHasChanges(true)
                  }}
                >
                  <SelectTrigger className="w-full md:w-[300px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rule_only">
                      <div>
                        <div className="font-medium">仅规则验证</div>
                        <div className="text-xs text-muted-foreground">只使用规则匹配</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="ai_only">
                      <div>
                        <div className="font-medium">仅AI验证</div>
                        <div className="text-xs text-muted-foreground">只使用AI语义分析</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="rule_and_ai">
                      <div>
                        <div className="font-medium">规则+AI双重验证</div>
                        <div className="text-xs text-muted-foreground">同时使用规则和AI验证</div>
                      </div>
                    </SelectItem>
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
                    value={semanticConfig.minRelevance}
                    onChange={(e) => { 
                      setSemanticConfig(prev => ({ ...prev, minRelevance: parseFloat(e.target.value) }))
                      setHasChanges(true)
                    }}
                  />
                  <p className="text-xs text-muted-foreground">评论与任务相关程度</p>
                </div>
                <div className="space-y-2">
                  <Label>积极性阈值</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={semanticConfig.minPositivity}
                    onChange={(e) => { 
                      setSemanticConfig(prev => ({ ...prev, minPositivity: parseFloat(e.target.value) }))
                      setHasChanges(true)
                    }}
                  />
                  <p className="text-xs text-muted-foreground">评论情感积极性</p>
                </div>
                <div className="space-y-2">
                  <Label>有效性阈值</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={semanticConfig.minEffectiveness}
                    onChange={(e) => { 
                      setSemanticConfig(prev => ({ ...prev, minEffectiveness: parseFloat(e.target.value) }))
                      setHasChanges(true)
                    }}
                  />
                  <p className="text-xs text-muted-foreground">评论内容有效性</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* AI模型配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="w-4 h-4" />
            AI模型配置
          </CardTitle>
          <CardDescription>用于语义分析的AI模型参数</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>服务提供商</Label>
              <Select 
                value={aiConfig.provider} 
                onValueChange={(v) => { 
                  const provider = AI_PROVIDERS.find(p => p.id === v)
                  setAIConfig(prev => ({ 
                    ...prev, 
                    provider: v,
                    baseUrl: provider?.baseUrl || ''
                  }))
                  setHasChanges(true)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_PROVIDERS.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>模型名称</Label>
              <Input
                value={aiConfig.model}
                onChange={(e) => { 
                  setAIConfig(prev => ({ ...prev, model: e.target.value }))
                  setHasChanges(true)
                }}
                placeholder="qwen-max / gpt-4o"
              />
            </div>
          </div>
          
          {aiConfig.provider === 'custom' && (
            <div className="space-y-2">
              <Label>API Base URL</Label>
              <Input
                value={aiConfig.baseUrl}
                onChange={(e) => { 
                  setAIConfig(prev => ({ ...prev, baseUrl: e.target.value }))
                  setHasChanges(true)
                }}
                placeholder="https://api.example.com/v1"
              />
            </div>
          )}
          
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input
              type="password"
              value={aiConfig.apiKey}
              onChange={(e) => { 
                setAIConfig(prev => ({ ...prev, apiKey: e.target.value }))
                setHasChanges(true)
              }}
              placeholder="sk-xxx"
            />
          </div>
          
          <Separator />
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Temperature</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={aiConfig.temperature}
                onChange={(e) => { 
                  setAIConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))
                  setHasChanges(true)
                }}
              />
              <p className="text-xs text-muted-foreground">生成随机性 (0-2)</p>
            </div>
            <div className="space-y-2">
              <Label>Max Tokens</Label>
              <Input
                type="number"
                min="100"
                max="8000"
                value={aiConfig.maxTokens}
                onChange={(e) => { 
                  setAIConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))
                  setHasChanges(true)
                }}
              />
              <p className="text-xs text-muted-foreground">最大生成Token数</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI降级配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4" />
            AI降级配置
          </CardTitle>
          <CardDescription>AI服务异常时的处理策略</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="font-medium">启用降级机制</Label>
              <p className="text-sm text-muted-foreground">AI失败时自动降级处理</p>
            </div>
            <Switch
              checked={fallbackConfig.enabled}
              onCheckedChange={(checked) => { 
                setFallbackConfig(prev => ({ ...prev, enabled: checked }))
                setHasChanges(true)
              }}
            />
          </div>
          
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="font-medium">拒绝时降级</Label>
              <p className="text-sm text-muted-foreground">AI拒绝时降级到规则验证</p>
            </div>
            <Switch
              checked={fallbackConfig.onReject}
              onCheckedChange={(checked) => { 
                setFallbackConfig(prev => ({ ...prev, onReject: checked }))
                setHasChanges(true)
              }}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>超时时间(ms)</Label>
              <Input
                type="number"
                min="1000"
                max="30000"
                value={fallbackConfig.timeout}
                onChange={(e) => { 
                  setFallbackConfig(prev => ({ ...prev, timeout: parseInt(e.target.value) }))
                  setHasChanges(true)
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>最大重试次数</Label>
              <Input
                type="number"
                min="0"
                max="5"
                value={fallbackConfig.maxRetries}
                onChange={(e) => { 
                  setFallbackConfig(prev => ({ ...prev, maxRetries: parseInt(e.target.value) }))
                  setHasChanges(true)
                }}
              />
            </div>
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
