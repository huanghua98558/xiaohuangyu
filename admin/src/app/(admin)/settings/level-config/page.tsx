'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { getLevelConfigs, updateLevelConfig, LevelConfig } from '@/lib/api'
import { TrendingUp, Save, Loader2 } from 'lucide-react'

export default function LevelConfigPage() {
  const [levels, setLevels] = useState<LevelConfig[]>([])
  const [editedLevels, setEditedLevels] = useState<Record<number, Partial<LevelConfig>>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [savingLevel, setSavingLevel] = useState<number | null>(null)

  useEffect(() => {
    loadLevels()
  }, [])

  const loadLevels = async () => {
    try {
      const data = await getLevelConfigs()
      setLevels(data)
    } catch (err) {
      console.error('加载等级配置失败', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async (level: number) => {
    const newValues = editedLevels[level]
    if (!newValues) return
    
    setSavingLevel(level)
    try {
      const updated = await updateLevelConfig(level, newValues)
      setLevels(levels.map(l => l.level === level ? updated : l))
      
      // 清除编辑状态
      setEditedLevels(prev => {
        const newEditedLevels = { ...prev }
        delete newEditedLevels[level]
        return newEditedLevels
      })
    } catch (err) {
      console.error('保存失败', err)
      alert('保存失败')
    } finally {
      setSavingLevel(null)
    }
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
          <TrendingUp className="w-6 h-6" />
          等级配置
        </h1>
        <p className="text-muted-foreground mt-1">配置各等级的名称、系数和升级条件</p>
      </div>

      <div className="grid gap-6">
        {levels.map((level) => (
          <Card key={level.level}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Lv.{level.level} - {level.name}</span>
                <Button
                  size="sm"
                  onClick={() => handleSave(level.level)}
                  disabled={savingLevel === level.level || !editedLevels[level.level]}
                >
                  {savingLevel === level.level ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  保存
                </Button>
              </CardTitle>
              <CardDescription>
                编辑等级 {level.level} 的配置参数
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">等级名称</Label>
                  <Input
                    value={editedLevels[level.level]?.name ?? level.name}
                    onChange={(e) => 
                      setEditedLevels({
                        ...editedLevels,
                        [level.level]: { ...editedLevels[level.level], name: e.target.value }
                      })
                    }
                    className="h-8"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">等级系数</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={editedLevels[level.level]?.levelWeight ?? level.levelWeight}
                    onChange={(e) => 
                      setEditedLevels({
                        ...editedLevels,
                        [level.level]: { ...editedLevels[level.level], levelWeight: parseFloat(e.target.value) }
                      })
                    }
                    className="h-8"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">最低积分</Label>
                  <Input
                    type="number"
                    value={editedLevels[level.level]?.minPoints ?? level.minPoints}
                    onChange={(e) => 
                      setEditedLevels({
                        ...editedLevels,
                        [level.level]: { ...editedLevels[level.level], minPoints: parseInt(e.target.value) }
                      })
                    }
                    className="h-8"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">同时任务数</Label>
                  <Input
                    type="number"
                    value={editedLevels[level.level]?.concurrentTasks ?? level.concurrentTasks}
                    onChange={(e) => 
                      setEditedLevels({
                        ...editedLevels,
                        [level.level]: { ...editedLevels[level.level], concurrentTasks: parseInt(e.target.value) }
                      })
                    }
                    className="h-8"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
