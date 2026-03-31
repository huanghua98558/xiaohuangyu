'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Palette, Monitor, Smartphone, Save, Check, Loader2 } from 'lucide-react'

const THEMES = {
  professional: {
    id: 'professional',
    name: '专业蓝',
    description: '高效、信任、专业',
    icon: '💼',
    primary: '#2563EB',
    bg: '#F8FAFC',
    features: ['适合企业应用', '高对比度']
  },
  glassmorphism: {
    id: 'glassmorphism',
    name: '玻璃拟态',
    description: '现代、透明、层次感',
    icon: '🔮',
    primary: '#818CF8',
    bg: 'linear-gradient(135deg, #667EEA, #764BA2)',
    features: ['毛玻璃效果', '现代感强']
  },
  'dark-tech': {
    id: 'dark-tech',
    name: '暗黑科技',
    description: '酷炫、科技感、沉浸式',
    icon: '🌙',
    primary: '#00FFFF',
    bg: '#000000',
    features: ['深色背景', '霓虹色彩']
  },
  'soft-cure': {
    id: 'soft-cure',
    name: '柔和治愈',
    description: '舒适、友好、无压力',
    icon: '🌸',
    primary: '#87CEEB',
    bg: '#FAFAFA',
    features: ['柔和色调', '温暖氛围']
  },
  minimal: {
    id: 'minimal',
    name: '极简扁平',
    description: '快速、清晰、无干扰',
    icon: '⚡',
    primary: '#1E293B',
    bg: '#FFFFFF',
    features: ['极简设计', '快速加载']
  }
}

type ThemeId = keyof typeof THEMES

interface ThemeConfig {
  frontendTheme: ThemeId
  adminTheme: ThemeId
}

export default function UIThemePage() {
  const [config, setConfig] = useState<ThemeConfig>({
    frontendTheme: 'professional',
    adminTheme: 'minimal'
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'frontend' | 'admin'>('frontend')

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const token = localStorage.getItem('admin_token')
        if (!token) {
          setIsLoading(false)
          return
        }
        const response = await fetch('/admin/api/admin-v2/ui-theme', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (response.ok) {
          const data = await response.json()
          if (data.code === 0 && data.data) {
            setConfig({
              frontendTheme: data.data.frontendTheme || 'professional',
              adminTheme: data.data.adminTheme || 'minimal'
            })
          }
        }
      } catch (err) {
        console.error('加载失败', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadConfig()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const token = localStorage.getItem('admin_token')
      const response = await fetch('/admin/api/admin-v2/ui-theme', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(config)
      })
      if (response.ok) {
        alert('保存成功！')
      }
    } catch (err) {
      alert('保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  const ThemeCard = ({ theme, isSelected, onClick }: { 
    theme: typeof THEMES[ThemeId], 
    isSelected: boolean,
    onClick: () => void 
  }) => (
    <div 
      onClick={onClick}
      className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
      }`}
    >
      {isSelected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{theme.icon}</span>
        <div>
          <h4 className="font-medium">{theme.name}</h4>
          <p className="text-sm text-muted-foreground">{theme.description}</p>
        </div>
      </div>
      <div className="flex gap-1 mt-2">
        {theme.features.map((f, i) => (
          <Badge key={i} variant="secondary" className="text-xs">{f}</Badge>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <div className="w-6 h-6 rounded border" style={{ backgroundColor: theme.primary }} />
        <div className="w-6 h-6 rounded border bg-white" style={{ background: theme.bg }} />
      </div>
    </div>
  )

  if (isLoading) {
    return <div className="p-6"><Skeleton className="h-96" /></div>
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Palette className="w-6 h-6" />
            UI主题配置
          </h1>
          <p className="text-muted-foreground mt-1">配置前端用户端和管理后台的主题风格</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          保存配置
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'frontend' | 'admin')}>
        <TabsList>
          <TabsTrigger value="frontend"><Smartphone className="w-4 h-4 mr-2" />用户端主题</TabsTrigger>
          <TabsTrigger value="admin"><Monitor className="w-4 h-4 mr-2" />管理后台主题</TabsTrigger>
        </TabsList>

        <TabsContent value="frontend" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>用户端主题</CardTitle>
              <CardDescription>选择用户端应用的默认主题风格</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.values(THEMES).map(theme => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    isSelected={config.frontendTheme === theme.id}
                    onClick={() => setConfig({ ...config, frontendTheme: theme.id as ThemeId })}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admin" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>管理后台主题</CardTitle>
              <CardDescription>选择管理后台的主题风格</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.values(THEMES).map(theme => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    isSelected={config.adminTheme === theme.id}
                    onClick={() => setConfig({ ...config, adminTheme: theme.id as ThemeId })}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
