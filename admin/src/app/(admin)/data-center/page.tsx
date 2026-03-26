'use client'

import { useState } from 'react'
import { DataCenter } from '@/components/data-center/DataCenter'
import { cn } from '@/lib/utils'

export default function DataCenterPage() {
  const [isFullscreen, setIsFullscreen] = useState(false)

  return (
    <div 
      className={cn(
        "h-[calc(100vh-4rem)] -m-6", // 抵消父容器padding
        isFullscreen && "fixed inset-0 z-50 h-screen m-0"
      )}
    >
      <DataCenter onFullscreenChange={setIsFullscreen} />
    </div>
  )
}
