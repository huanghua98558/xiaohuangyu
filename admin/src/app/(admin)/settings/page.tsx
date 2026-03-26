'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { SystemConfig, getSystemConfigs, updateSystemConfig, uploadImage } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Settings, Save, ImageIcon, Upload, X, Loader2 } from 'lucide-react'

// 已迁移到独立页面的配置
const migratedKeys = [
  'frontend_theme',
  'admin_theme',
]

export default function SettingsPage() {
  const [configs, setConfigs] = useState<SystemConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState<string | null>(null)
  const [editedValues, setEditedValues] = useState<Record<string, string>>({})
  
  // 示范图片配置
  const [exampleImage1, setExampleImage1] = useState('')
  const [exampleImage2, setExampleImage2] = useState('')
  const [isUploading1, setIsUploading1] = useState(false)
  const [isUploading2, setIsUploading2] = useState(false)
  const fileInput1Ref = useRef<HTMLInputElement>(null)
  const fileInput2Ref = useRef<HTMLInputElement>(null)
  
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const configData = await getSystemConfigs()
      setConfigs(configData)
      
      // 加载示范图片
      const img1 = configData.find(c => c.key === 'example_image_1')
      const img2 = configData.find(c => c.key === 'example_image_2')
      if (img1) setExampleImage1(img1.value)
      if (img2) setExampleImage2(img2.value)
    } catch (err) {
      console.error('加载配置失败', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSaveConfig = async (key: string) => {
    const newValue = editedValues[key]
    if (newValue === undefined) return
    
    setIsSaving(key)
    try {
      await updateSystemConfig(key, newValue)
      
      setConfigs(configs.map(c => c.key === key ? { ...c, value: newValue } : c))
      
      setEditedValues(prev => {
        const newEdited = { ...prev }
        delete newEdited[key]
        return newEdited
      })
    } catch (err) {
      console.error('保存失败', err)
      alert('保存失败')
    } finally {
      setIsSaving(null)
    }
  }

  const triggerFileSelect = (index: number) => {
    if (index === 1) fileInput1Ref.current?.click()
    else fileInput2Ref.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (index === 1) setIsUploading1(true)
    else setIsUploading2(true)
    
    try {
      const { url } = await uploadImage(file)
      
      const configKey = index === 1 ? 'example_image_1' : 'example_image_2'
      await updateSystemConfig(configKey, url)
      
      if (index === 1) setExampleImage1(url)
      else setExampleImage2(url)
    } catch (err) {
      console.error('上传失败', err)
      alert('上传失败')
    } finally {
      if (index === 1) setIsUploading1(false)
      else setIsUploading2(false)
      e.target.value = ''
    }
  }

  const handleRemoveImage = async (index: number) => {
    const configKey = index === 1 ? 'example_image_1' : 'example_image_2'
    try {
      await updateSystemConfig(configKey, '')
      if (index === 1) setExampleImage1('')
      else setExampleImage2('')
    } catch (err) {
      console.error('删除失败', err)
    }
  }

  // 配置分组
  const configGroups: Record<string, SystemConfig[]> = {
    '推广系统': configs.filter(c => c.key.includes('promotion') && !migratedKeys.includes(c.key)),
    '任务系统': configs.filter(c => 
      (c.key.includes('task') || c.key.includes('limit') || c.key.includes('concurrent')) &&
      !migratedKeys.includes(c.key)
    ),
    '其他': configs.filter(c => 
      !c.key.includes('promotion') && 
      !c.key.includes('task') && 
      !c.key.includes('limit') &&
      !c.key.includes('concurrent') &&
      !c.key.includes('example_image') &&
      !c.key.startsWith('points_') &&
      !migratedKeys.includes(c.key)
    ),
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6" />
          系统配置
        </h1>
        <p className="text-muted-foreground mt-1">配置系统运行参数</p>
      </div>

      {/* 隐藏的文件上传input */}
      <input
        ref={fileInput1Ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileChange(e, 1)}
      />
      <input
        ref={fileInput2Ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileChange(e, 2)}
      />
      
      {/* 完成示范图片配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            完成示范图片配置
          </CardTitle>
          <CardDescription>
            配置短视频用户体验调研任务的完成示范图片
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 示范图片1 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">示范图片 1</Label>
              <div className="relative aspect-video rounded-lg overflow-hidden border bg-gray-50">
                {exampleImage1 ? (
                  <>
                    <img src={exampleImage1} alt="示范图片1" className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 flex items-center justify-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => triggerFileSelect(1)} disabled={isUploading1}>
                        {isUploading1 ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                        更换
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleRemoveImage(1)}>
                        <X className="h-4 w-4 mr-1" />删除
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Button variant="outline" onClick={() => triggerFileSelect(1)} disabled={isUploading1}>
                      {isUploading1 ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                      上传图片
                    </Button>
                  </div>
                )}
              </div>
            </div>
            
            {/* 示范图片2 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">示范图片 2</Label>
              <div className="relative aspect-video rounded-lg overflow-hidden border bg-gray-50">
                {exampleImage2 ? (
                  <>
                    <img src={exampleImage2} alt="示范图片2" className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 flex items-center justify-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => triggerFileSelect(2)} disabled={isUploading2}>
                        {isUploading2 ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                        更换
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleRemoveImage(2)}>
                        <X className="h-4 w-4 mr-1" />删除
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Button variant="outline" onClick={() => triggerFileSelect(2)} disabled={isUploading2}>
                      {isUploading2 ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                      上传图片
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* 系统配置 */}
      {Object.entries(configGroups).map(([groupName, groupConfigs]) => {
        if (groupConfigs.length === 0) return null
        
        return (
          <Card key={groupName}>
            <CardHeader>
              <CardTitle>{groupName}</CardTitle>
              <CardDescription>配置{groupName}相关参数</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {groupConfigs.map((config) => (
                  <div key={config.key} className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <Label className="font-medium">{config.key}</Label>
                      {config.description && (
                        <p className="text-xs text-gray-500 mt-1">{config.description}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Input
                        value={editedValues[config.key] ?? config.value}
                        onChange={(e) => 
                          setEditedValues({ ...editedValues, [config.key]: e.target.value })
                        }
                        className="w-48 h-8"
                      />
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSaveConfig(config.key)}
                        disabled={isSaving === config.key || editedValues[config.key] === undefined}
                      >
                        {isSaving === config.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
