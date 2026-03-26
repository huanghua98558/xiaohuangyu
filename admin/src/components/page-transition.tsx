'use client'

import { ReactNode, useEffect, useState, useTransition } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface PageTransitionProps {
  children: ReactNode
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [displayChildren, setDisplayChildren] = useState(children)
  const [transitionStage, setTransitionStage] = useState<'fadeIn' | 'fadeOut'>('fadeIn')

  useEffect(() => {
    if (children !== displayChildren) {
      setTransitionStage('fadeOut')
    }
  }, [children, displayChildren])

  useEffect(() => {
    if (transitionStage === 'fadeOut') {
      const timeout = setTimeout(() => {
        startTransition(() => {
          setDisplayChildren(children)
          setTransitionStage('fadeIn')
        })
      }, 100)
      return () => clearTimeout(timeout)
    }
  }, [transitionStage, children])

  return (
    <div
      className={cn(
        'transition-opacity duration-150 ease-in-out',
        transitionStage === 'fadeIn' ? 'opacity-100' : 'opacity-0'
      )}
    >
      {displayChildren}
    </div>
  )
}

// 简化版 - 仅使用 CSS 过渡
export function FadeIn({ children }: { children: ReactNode }) {
  return (
    <div className="animate-in fade-in-0 duration-200">
      {children}
    </div>
  )
}
