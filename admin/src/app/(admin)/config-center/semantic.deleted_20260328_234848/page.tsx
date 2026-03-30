'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { 
  FileText, Save, Loader2, RefreshCw, AlertTriangle, Plus, X, 
  AlertCircle, MessageSquare, Filter, Settings2
} from 'lucide-react'
import { toast } from 'sonner'

// ========== 配置类型 ==========

interface RuleConfig {
  // 无意义内容规则
  meaningless: {
    enabled: boolean
    patterns: Array<{ pattern: string; reason: string; enabled: boolean }>
  }
  // 模板评论规则
  template: {
    enabled: boolean
    penalty: number  // 扣分
    patterns: Array<{ pattern: string; score: number; reason: string; enabled: boolean }>
  }
  // 关键词配置
  keywords: {
    prefixes: string[]      // 程度副词
    suffixes: string[]      // 形容词
    whitelist: string[]     // 白名单关键词（出现则不算模板）
  }
}

const defaultRuleConfig: RuleConfig = {
  meaningless: {
    enabled: true,
    patterns: [
      { pattern: '^\\d+$', reason: '纯数字评论', enabled: true },
      { pattern: '^[a-zA-Z]{1,3}$', reason: '过短字母评论', enabled: true },
      { pattern: '^(.)\\1+$', reason: '重复字符', enabled: true },
      { pattern: '^[^\\u4e00-\\u9fa5]+$', reason: '无中文内容', enabled: true },
      { pattern: '^(好的|收到|了解|知道了|好的好的|可以|行|嗯|哦|啊|哈)+$', reason: '敷衍短语', enabled: true },
      { pattern: '^[\\.。,，!！?？\\s]+$', reason: '纯标点符号', enabled: true },
    ]
  },
  template: {
    enabled: true,
    penalty: 0.3,
    patterns: [
      { pattern: '^.{0,5}(不错|很好|可以|喜欢|支持|赞|棒|牛).{0,5}$', score: 0.6, reason: '简短表扬', enabled: true },
      { pattern: '^(好|不错|可以|还行|挺好)[啊哦呀~！!]+$', score: 0.6, reason: '简短表扬+语气词', enabled: true },
      { pattern: '^(谢谢|感谢|多谢)(老师|博主|UP主|作者|楼主)?[！!。]?$', score: 0.5, reason: '通用客套', enabled: true },
      { pattern: '^学到了?$', score: 0.5, reason: '客套评论', enabled: true },
      { pattern: '^已[关注点赞收藏]$', score: 0.5, reason: '已关注类', enabled: true },
      { pattern: '^(.{2,6})\\1{2,}$', score: 0.4, reason: '重复内容', enabled: true },
      { pattern: '^[\\u4e00-\\u9fa5]{1,4}$', score: 0.5, reason: '评论过短', enabled: true },
    ]
  },
  keywords: {
    prefixes: ['真的', '特别', '超级', '非常', '十分'],
    suffixes: ['不错', '好用', '喜欢', '推荐', '给力'],
    whitelist: ['回购', '已购', '下单', '收到', '朋友推荐', '推荐的', '推荐给']
  }
}

export default function SemanticRulePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<RuleConfig>(defaultRuleConfig)
  const [hasChanges, setHasChanges] = useState(false)
  
  // 新增输入
  const [newPrefix, setNewPrefix] = useState('')
  const [newSuffix, setNewSuffix] = useState('')
  const [newWhitelist, setNewWhitelist] = useState('')

  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
    return { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }

  const loadConfig = async () => {
    try {
      const res = await fetch('/admin/api/ai/admin/semantic-rules', { headers: getAuthHeaders() })
      const data = await res.json()
      
      if (data.code === 200 && data.data) {
        setConfig({
          ...defaultRuleConfig,
          ...data.data
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
      const res = await fetch('/admin/api/ai/admin/semantic-rules', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(config)
      })
      
      const data = await res.json()
      
      if (data.code === 200) {
        toast.success('规则配置已保存')
        setHasChanges(false)
      } else {
        toast.error(data.message || '保存失败')
      }
    } catch (e) {
      console.error('保存失败:', e)
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 添加关键词
  const addKeyword = (type: 'prefixes' | 'suffixes' | 'whitelist', value: string) => {
    if (!value.trim()) return
    setConfig(prev => ({
      ...prev,
      keywords: {
        ...prev.keywords,
        [type]: [...prev.keywords[type], value.trim()]
      }
    }))
    setHasChanges(true)
    if (type === 'prefixes') setNewPrefix('')
    if (type === 'suffixes') setNewSuffix('')
    if (type === 'whitelist') setNewWhitelist('')
  }

  // 删除关键词
  const removeKeyword = (type: 'prefixes' | 'suffixes' | 'whitelist', index: number) => {
    setConfig(prev => ({
      ...prev,
      keywords: {
        ...prev.keywords,
        [type]: prev.keywords[type].filter((_, i) => i !== index)
      }
    }))
    setHasChanges(true)
  }

  // 切换规则启用状态
  const togglePattern = (section: 'meaningless' | 'template', index: number) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        patterns: prev[section].patterns.map((p, i) => 
          i === index ? { ...p, enabled: !p.enabled } : p
        )
      }
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
    <div className="space-y-6 pb-20">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6" />
            语意规则配置
          </h1>
          <p className="text-muted-foreground mt-1">
            配置评论审查的匹配规则（本地免费版，无需AI）
          </p>
        </div>
        {hasChanges && (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
            <AlertTriangle className="w-3 h-3 mr-1" />
            有未保存的更改
          </Badge>
        )}
      </div>

      {/* 无意义内容规则 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                无意义内容规则
              </CardTitle>
              <CardDescription>匹配这些规则的评论将直接拒绝</CardDescription>
            </div>
            <Switch
              checked={config.meaningless.enabled}
              onCheckedChange={(checked) => {
                setConfig(prev => ({ ...prev, meaningless: { ...prev.meaningless, enabled: checked } }))
                setHasChanges(true)
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {config.meaningless.patterns.map((item, index) => (
            <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
              <Switch
                checked={item.enabled}
                onCheckedChange={() => togglePattern('meaningless', index)}
              />
              <div className="flex-1">
                <code className="text-xs bg-muted px-2 py-1 rounded">{item.pattern}</code>
              </div>
              <Badge variant={item.enabled ? "destructive" : "outline"} className="text-xs">
                {item.reason}
              </Badge>
            </div>
          ))}
          <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <p className="font-medium mb-1">规则说明：</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li><strong>纯数字</strong>：如 "123456"</li>
              <li><strong>过短字母</strong>：如 "ok", "yes", "good"</li>
              <li><strong>重复字符</strong>：如 "aaaaa", "！！！"</li>
              <li><strong>无中文内容</strong>：纯表情、纯符号</li>
              <li><strong>敷衍短语</strong>：如 "好的", "收到", "嗯"</li>
              <li><strong>纯标点</strong>：如 "！！！", "。。。"</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 模板评论规则 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-orange-500" />
                模板评论规则
              </CardTitle>
              <CardDescription>匹配这些规则的评论将降分（不直接拒绝）</CardDescription>
            </div>
            <Switch
              checked={config.template.enabled}
              onCheckedChange={(checked) => {
                setConfig(prev => ({ ...prev, template: { ...prev.template, enabled: checked } }))
                setHasChanges(true)
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4 p-3 border rounded-lg bg-orange-50/50">
            <Label className="text-sm whitespace-nowrap">模板扣分</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="1"
              className="w-20"
              value={config.template.penalty}
              onChange={(e) => {
                setConfig(prev => ({ 
                  ...prev, 
                  template: { ...prev.template, penalty: parseFloat(e.target.value) } 
                }))
                setHasChanges(true)
              }}
            />
            <span className="text-sm text-muted-foreground">
              扣分后评论置信度 = 1.0 - 扣分值
            </span>
          </div>
          
          {config.template.patterns.map((item, index) => (
            <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
              <Switch
                checked={item.enabled}
                onCheckedChange={() => togglePattern('template', index)}
              />
              <div className="flex-1">
                <code className="text-xs bg-muted px-2 py-1 rounded">{item.pattern}</code>
              </div>
              <Badge variant="outline" className="text-xs">
                {item.score}分
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {item.reason}
              </Badge>
            </div>
          ))}
          <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <p className="font-medium mb-1">评分说明：</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li><strong>1.0分</strong>：完全通过，非模板评论</li>
              <li><strong>0.6分</strong>：疑似模板，降分但通过</li>
              <li><strong>0.5分</strong>：高度疑似模板，接近人工审核阈值</li>
              <li><strong>0.4分</strong>：模板特征明显，可能转人工</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 关键词配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-500" />
            关键词配置
          </CardTitle>
          <CardDescription>配置模板检测的关键词和白名单</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 白名单关键词 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">白名单关键词</Label>
                <p className="text-xs text-muted-foreground">包含这些关键词的评论不算模板</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {config.keywords.whitelist.map((keyword, index) => (
                <Badge key={index} variant="secondary" className="gap-1">
                  {keyword}
                  <X 
                    className="w-3 h-3 cursor-pointer hover:text-red-500" 
                    onClick={() => removeKeyword('whitelist', index)}
                  />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newWhitelist}
                onChange={(e) => setNewWhitelist(e.target.value)}
                placeholder="如：回购、朋友推荐"
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && addKeyword('whitelist', newWhitelist)}
              />
              <Button variant="outline" size="sm" onClick={() => addKeyword('whitelist', newWhitelist)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <Separator />

          {/* 程度副词 */}
          <div className="space-y-3">
            <div>
              <Label className="font-medium">程度副词</Label>
              <p className="text-xs text-muted-foreground">用于检测"程度副词+形容词"模板</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {config.keywords.prefixes.map((keyword, index) => (
                <Badge key={index} variant="outline" className="gap-1">
                  {keyword}
                  <X 
                    className="w-3 h-3 cursor-pointer hover:text-red-500" 
                    onClick={() => removeKeyword('prefixes', index)}
                  />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newPrefix}
                onChange={(e) => setNewPrefix(e.target.value)}
                placeholder="如：真的、特别"
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && addKeyword('prefixes', newPrefix)}
              />
              <Button variant="outline" size="sm" onClick={() => addKeyword('prefixes', newPrefix)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <Separator />

          {/* 形容词 */}
          <div className="space-y-3">
            <div>
              <Label className="font-medium">形容词</Label>
              <p className="text-xs text-muted-foreground">用于检测"程度副词+形容词"模板</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {config.keywords.suffixes.map((keyword, index) => (
                <Badge key={index} variant="outline" className="gap-1">
                  {keyword}
                  <X 
                    className="w-3 h-3 cursor-pointer hover:text-red-500" 
                    onClick={() => removeKeyword('suffixes', index)}
                  />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newSuffix}
                onChange={(e) => setNewSuffix(e.target.value)}
                placeholder="如：不错、好用"
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && addKeyword('suffixes', newSuffix)}
              />
              <Button variant="outline" size="sm" onClick={() => addKeyword('suffixes', newSuffix)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 规则说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            审核流程说明
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted border">
              评论提交
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-red-50 border border-red-200 text-red-700">
              字数检测
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-orange-50 border border-orange-200 text-orange-700">
              无意义检测
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-yellow-50 border border-yellow-200 text-yellow-700">
              模板检测
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-green-50 border border-green-200 text-green-700">
              最终评分
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            <p>• 字数不足：直接拒绝</p>
            <p>• 无意义内容：直接拒绝</p>
            <p>• 模板评论：降分但通过（置信度 ≥ 0.5）</p>
            <p>• 白名单关键词：跳过模板检测，直接通过</p>
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
