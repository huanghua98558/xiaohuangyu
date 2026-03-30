'use client'

import { useState } from 'react'
import { DataCenter } from '@/components/data-center/DataCenter'
import { cn } from '@/lib/utils'

export default function DataCenterPage() {
  const [isFullscreen, setIsFullscreen] = useState(false)

  return (
    <div 
      className={cn(
        // dvh：动态视口高度，避免移动端/全屏地址栏导致裁切
        "min-h-0 h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] -m-6 flex flex-col",
        isFullscreen && "fixed inset-0 z-50 h-[100dvh] max-h-[100dvh] m-0"
      )}
    >
      <DataCenter onFullscreenChange={setIsFullscreen} />
    </div>
  )
}
