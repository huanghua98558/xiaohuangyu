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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  Link2, Save, Loader2, RefreshCw, AlertTriangle, Globe, Shield, 
  Clock, Zap, Settings, ArrowRightLeft, Server, Activity
} from 'lucide-react'
import { toast } from 'sonner'

// ========== 配置类型 ==========

interface LinkReviewConfig {
  // 基础配置
  basic: {
    batchSize: number           // 批量处理数量
    waitTime: number            // 页面等待时间(秒)
    timeout: number             // 超时时间(秒)
    maxRetries: number          // 最大重试次数
    concurrentLimit: number     // 并发限制
    delayMinutes: number        // 延迟审查时间(分钟) - 让评论生效
    batchThreshold: number      // 批量处理阈值 - 满多少个开始审核
    maxWaitMinutes: number      // 最大等待时间(分钟)
  }
  // 代理配置
  proxy: {
    enabled: boolean            // 是否启用代理
    mode: 'auto' | 'direct' | 'proxy'  // 模式
    queueThreshold: number      // 队列积压阈值
    directFailLimit: number     // 直连失败阈值
    directCooldown: number      // 直连冷却时间(分钟)
    captchaCooldown: number     // 验证码冷却时间(分钟)
    ipUsageLimit: number        // IP 使用上限
    ipTtlMin: number            // IP 最小有效期(秒)
    ipTtlMax: number            // IP 最大有效期(秒)
  }
  // 风控检测
  riskDetection: {
    enabled: boolean
    keywords: string[]          // 风控关键词
    autoSwitchOnCaptcha: boolean // 遇验证码自动切换
  }
  // 浏览器配置
  browser: {
    browserCount: number        // 浏览器数量
    contextsPerBrowser: number  // 每浏览器 Context 数
    headless: boolean           // 无头模式
    disableImages: boolean      // 禁用图片
  }
}

const defaultConfig: LinkReviewConfig = {
  basic: {
    batchSize: 10,
    waitTime: 5,
    timeout: 30,
    maxRetries: 3,
    concurrentLimit: 5,
    delayMinutes: 15,     // 延迟审查时间（分钟）
    batchThreshold: 5,    // 批量处理阈值
    maxWaitMinutes: 60    // 最大等待时间
  },
  proxy: {
    enabled: true,
    mode: 'auto',
    queueThreshold: 20,
    directFailLimit: 3,
    directCooldown: 30,
    captchaCooldown: 60,
    ipUsageLimit: 200,
    ipTtlMin: 300,
    ipTtlMax: 900
  },
  riskDetection: {
    enabled: true,
    keywords: ['验证码', '访问频繁', '安全验证', '滑动验证'],
    autoSwitchOnCaptcha: true
  },
  browser: {
    browserCount: 3,
    contextsPerBrowser: 10,
    headless: true,
    disableImages: true
  }
}

function parseNumberInput(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

// ========== 统计数据 ==========

interface ProxyStats {
  mode: string
  poolSize: number
  directRequests: number
  proxyRequests: number
  captchaHits: number
  modeSwitches: number
  directFailCount: number
  cooldownRemaining: number
}

export default function LinkReviewPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<LinkReviewConfig>(defaultConfig)
  const [stats, setStats] = useState<ProxyStats | null>(null)
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
      setLoading(true)
      
      // 加载配置
      const configRes = await fetch('/admin/api/ai/admin/link-review-settings', { 
        headers: getAuthHeaders() 
      })
      const configData = await configRes.json()
      
      if ((configData.code === 200 || configData.code === 0) && configData.data) {
        setConfig(prev => ({
          ...prev,
          ...configData.data
        }))
        setHasChanges(false)
      }
      
      // 加载统计
      const statsRes = await fetch('/admin/api/ai/admin/proxy-stats', { 
        headers: getAuthHeaders() 
      })
      const statsData = await statsRes.json()
      
      if (statsData.code === 200 && statsData.data) {
        setStats(statsData.data)
      }
      
    } catch (error) {
      console.error('加载配置失败:', error)
      toast.error('加载配置失败')
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async () => {
    try {
      setSaving(true)
      
      const res = await fetch('/admin/api/ai/admin/link-review-settings', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(config)
      })
      
      const data = await res.json()
      
      if (data.code === 200) {
        toast.success('配置保存成功')
        setHasChanges(false)
      } else {
        toast.error(data.message || '保存失败')
      }
    } catch (error) {
      console.error('保存配置失败:', error)
      toast.error('保存配置失败')
    } finally {
      setSaving(false)
    }
  }

  const setProxyMode = async (mode: 'direct' | 'proxy') => {
    try {
      const res = await fetch('/admin/api/ai/admin/proxy-mode', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ mode })
      })
      
      const data = await res.json()
      
      if (data.code === 200) {
        toast.success(`已切换到${mode === 'direct' ? '直连' : '代理'}模式`)
        loadConfig()
      } else {
        toast.error(data.message || '切换失败')
      }
    } catch (error) {
      toast.error('切换模式失败')
    }
  }

  const updateConfig = (section: keyof LinkReviewConfig, key: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }))
    setHasChanges(true)
  }

  useEffect(() => {
    loadConfig()
    
    // 每 30 秒刷新统计
    const interval = setInterval(() => {
      fetch('/admin/api/ai/admin/proxy-stats', { headers: getAuthHeaders() })
        .then(res => res.json())
        .then(data => {
          if (data.code === 200 && data.data) {
            setStats(data.data)
          }
        })
        .catch(() => {})
    }, 30000)
    
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="w-6 h-6" />
            链接审查配置
          </h1>
          <p className="text-muted-foreground mt-1">
            管理链接审查的代理 IP、风控检测和浏览器池配置
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadConfig}>
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新
          </Button>
          <Button onClick={saveConfig} disabled={!hasChanges || saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            保存配置
          </Button>
        </div>
      </div>

      {/* 状态概览 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">当前模式</p>
                  <p className="text-2xl font-bold">
                    {stats.mode === 'direct' ? '直连' : '代理'}
                  </p>
                </div>
                <Badge variant={stats.mode === 'direct' ? 'default' : 'secondary'}>
                  {stats.mode === 'direct' ? '免费' : '付费'}
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">代理池大小</p>
                  <p className="text-2xl font-bold">{stats.poolSize}</p>
                </div>
                <Server className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">直连/代理请求</p>
                  <p className="text-2xl font-bold">
                    {stats.directRequests}/{stats.proxyRequests}
                  </p>
                </div>
                <ArrowRightLeft className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">验证码/切换次数</p>
                  <p className="text-2xl font-bold">
                    {stats.captchaHits}/{stats.modeSwitches}
                  </p>
                </div>
                <Activity className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 配置 Tabs */}
      <Tabs defaultValue="proxy" className="space-y-4">
        <TabsList>
          <TabsTrigger value="proxy">代理配置</TabsTrigger>
          <TabsTrigger value="basic">基础配置</TabsTrigger>
          <TabsTrigger value="risk">风控检测</TabsTrigger>
          <TabsTrigger value="browser">浏览器池</TabsTrigger>
        </TabsList>

        {/* 代理配置 */}
        <TabsContent value="proxy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                代理 IP 配置
              </CardTitle>
              <CardDescription>
                配置智能代理切换策略，自动在直连和代理模式间切换
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 开关 */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>启用代理</Label>
                  <p className="text-sm text-muted-foreground">
                    开启后可使用代理 IP 避免风控
                  </p>
                </div>
                <Switch
                  checked={config.proxy.enabled}
                  onCheckedChange={(v) => updateConfig('proxy', 'enabled', v)}
                />
              </div>

              <Separator />

              {/* 模式选择 */}
              <div className="space-y-3">
                <Label>代理模式</Label>
                <div className="flex gap-2">
                  {[
                    { value: 'auto', label: '智能切换', desc: '自动判断' },
                    { value: 'direct', label: '直连优先', desc: '免费' },
                    { value: 'proxy', label: '代理优先', desc: '付费' }
                  ].map((item) => (
                    <Button
                      key={item.value}
                      variant={config.proxy.mode === item.value ? 'default' : 'outline'}
                      onClick={() => updateConfig('proxy', 'mode', item.value)}
                      className="flex-1"
                    >
                      <div className="text-center">
                        <div>{item.label}</div>
                        <div className="text-xs opacity-70">{item.desc}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* 切换策略 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>队列积压阈值</Label>
                  <Input
                    type="number"
                    value={config.proxy.queueThreshold}
                    onChange={(e) => updateConfig('proxy', 'queueThreshold', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">队列积压超过此值时切换代理</p>
                </div>
                <div className="space-y-2">
                  <Label>直连失败阈值</Label>
                  <Input
                    type="number"
                    value={config.proxy.directFailLimit}
                    onChange={(e) => updateConfig('proxy', 'directFailLimit', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">连续失败超过此值时切换代理</p>
                </div>
              </div>

              {/* 冷却时间 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>切换冷却时间 (分钟)</Label>
                  <Input
                    type="number"
                    value={config.proxy.directCooldown}
                    onChange={(e) => updateConfig('proxy', 'directCooldown', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>验证码冷却时间 (分钟)</Label>
                  <Input
                    type="number"
                    value={config.proxy.captchaCooldown}
                    onChange={(e) => updateConfig('proxy', 'captchaCooldown', parseInt(e.target.value))}
                  />
                </div>
              </div>

              {/* IP 管理 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>每 IP 使用上限</Label>
                  <Input
                    type="number"
                    value={config.proxy.ipUsageLimit}
                    onChange={(e) => updateConfig('proxy', 'ipUsageLimit', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>IP 最小有效期 (秒)</Label>
                  <Input
                    type="number"
                    value={config.proxy.ipTtlMin}
                    onChange={(e) => updateConfig('proxy', 'ipTtlMin', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>IP 最大有效期 (秒)</Label>
                  <Input
                    type="number"
                    value={config.proxy.ipTtlMax}
                    onChange={(e) => updateConfig('proxy', 'ipTtlMax', parseInt(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 快速切换 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                快速操作
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setProxyMode('direct')}
                  disabled={stats?.mode === 'direct'}
                >
                  切换到直连模式
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setProxyMode('proxy')}
                  disabled={stats?.mode === 'proxy'}
                >
                  切换到代理模式
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 基础配置 */}
        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                基础配置
              </CardTitle>
              <CardDescription>
                配置链接审查的基础参数
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>批量处理数量</Label>
                  <Input
                    type="number"
                    value={config.basic.batchSize}
                    onChange={(e) => updateConfig('basic', 'batchSize', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>并发限制</Label>
                  <Input
                    type="number"
                    value={config.basic.concurrentLimit}
                    onChange={(e) => updateConfig('basic', 'concurrentLimit', parseInt(e.target.value))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>页面等待时间 (秒)</Label>
                  <Input
                    type="number"
                    value={config.basic.waitTime}
                    onChange={(e) => updateConfig('basic', 'waitTime', parseNumberInput(e.target.value, defaultConfig.basic.waitTime))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>超时时间 (秒)</Label>
                  <Input
                    type="number"
                    value={config.basic.timeout}
                    onChange={(e) => updateConfig('basic', 'timeout', parseNumberInput(e.target.value, defaultConfig.basic.timeout))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>最大重试次数</Label>
                  <Input
                    type="number"
                    value={config.basic.maxRetries}
                    onChange={(e) => updateConfig('basic', 'maxRetries', parseNumberInput(e.target.value, defaultConfig.basic.maxRetries))}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>基础延迟 (分钟)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={config.basic.delayMinutes}
                    onChange={(e) => updateConfig('basic', 'delayMinutes', parseNumberInput(e.target.value, defaultConfig.basic.delayMinutes))}
                  />
                  <p className="text-xs text-muted-foreground">评论生效等待时间，测试可设为 0</p>
                </div>
                <div className="space-y-2">
                  <Label>批量触发阈值</Label>
                  <Input
                    type="number"
                    min={1}
                    value={config.basic.batchThreshold}
                    onChange={(e) => updateConfig('basic', 'batchThreshold', parseNumberInput(e.target.value, defaultConfig.basic.batchThreshold))}
                  />
                  <p className="text-xs text-muted-foreground">连接审核累计到多少条后优先开始</p>
                </div>
                <div className="space-y-2">
                  <Label>最大等待时间 (分钟)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={config.basic.maxWaitMinutes}
                    onChange={(e) => updateConfig('basic', 'maxWaitMinutes', parseNumberInput(e.target.value, defaultConfig.basic.maxWaitMinutes))}
                  />
                  <p className="text-xs text-muted-foreground">未满批量时，超过此时间也会强制进入审核</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 风控检测 */}
        <TabsContent value="risk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                风控检测配置
              </CardTitle>
              <CardDescription>
                配置风控关键词检测和自动切换策略
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>启用风控检测</Label>
                  <p className="text-sm text-muted-foreground">
                    检测页面中的风控关键词
                  </p>
                </div>
                <Switch
                  checked={config.riskDetection.enabled}
                  onCheckedChange={(v) => updateConfig('riskDetection', 'enabled', v)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>遇验证码自动切换代理</Label>
                  <p className="text-sm text-muted-foreground">
                    检测到验证码时自动切换到代理模式
                  </p>
                </div>
                <Switch
                  checked={config.riskDetection.autoSwitchOnCaptcha}
                  onCheckedChange={(v) => updateConfig('riskDetection', 'autoSwitchOnCaptcha', v)}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>风控关键词</Label>
                <div className="flex flex-wrap gap-2">
                  {config.riskDetection.keywords.map((keyword, index) => (
                    <Badge key={index} variant="secondary">
                      {keyword}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  检测到这些关键词时触发风控处理
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 浏览器池 */}
        <TabsContent value="browser" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" />
                浏览器池配置
              </CardTitle>
              <CardDescription>
                配置 Playwright 浏览器池参数
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>浏览器数量</Label>
                  <Input
                    type="number"
                    value={config.browser.browserCount}
                    onChange={(e) => updateConfig('browser', 'browserCount', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>每浏览器 Context 数</Label>
                  <Input
                    type="number"
                    value={config.browser.contextsPerBrowser}
                    onChange={(e) => updateConfig('browser', 'contextsPerBrowser', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    总 Context 数: {config.browser.browserCount * config.browser.contextsPerBrowser}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>无头模式</Label>
                  <p className="text-sm text-muted-foreground">
                    后台运行，不显示浏览器窗口
                  </p>
                </div>
                <Switch
                  checked={config.browser.headless}
                  onCheckedChange={(v) => updateConfig('browser', 'headless', v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>禁用图片加载</Label>
                  <p className="text-sm text-muted-foreground">
                    加速页面加载，节省带宽
                  </p>
                </div>
                <Switch
                  checked={config.browser.disableImages}
                  onCheckedChange={(v) => updateConfig('browser', 'disableImages', v)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 未保存提示 */}
      {hasChanges && (
        <div className="fixed bottom-4 right-4">
          <Alert className="w-80">
            <AlertTriangle className="w-4 h-4" />
            <AlertTitle>有未保存的更改</AlertTitle>
            <AlertDescription>
              请点击保存按钮保存您的更改
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  )
}
