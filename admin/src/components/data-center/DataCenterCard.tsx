'use client'

import { useEffect, useState, useRef, memo } from 'react'
import { cn } from '@/lib/utils'

// 数字跳动动画组件
interface AnimatedCounterProps {
  value: number | null | undefined
  duration?: number
  className?: string
  prefix?: string
  suffix?: string
  decimals?: number
}

export const AnimatedCounter = memo(function AnimatedCounter({
  value,
  duration = 1000,
  className,
  prefix = '',
  suffix = '',
  decimals = 0,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(value ?? 0)
  const previousValue = useRef(value ?? 0)
  const animationRef = useRef<number | null>(null)
  const startTime = useRef<number | null>(null)

  useEffect(() => {
    const startVal = previousValue.current
    const endVal = value ?? 0
    const diff = endVal - startVal

    if (diff === 0) return

    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp
      const progress = Math.min((timestamp - startTime.current) / duration, 1)
      
      // 使用 easeOutQuart 缓动函数
      const easeProgress = 1 - Math.pow(1 - progress, 4)
      const current = startVal + diff * easeProgress
      
      setDisplayValue(current)
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        previousValue.current = value ?? 0
        startTime.current = null
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [value, duration])

  return (
    <span className={cn('tabular-nums', className)}>
      {prefix}
      {(displayValue ?? 0).toLocaleString('zh-CN', { 
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals 
      })}
      {suffix}
    </span>
  )
})

// 环形进度条组件
interface GaugeChartProps {
  value: number | null | undefined
  max?: number
  size?: number
  strokeWidth?: number
  label?: string
  color?: string
  showValue?: boolean
  unit?: string
}

export const GaugeChart = memo(function GaugeChart({
  value,
  max = 100,
  size = 120,
  strokeWidth = 8,
  label,
  color = '#3b82f6',
  showValue = true,
  unit = '%',
}: GaugeChartProps) {
  const safeValue = value ?? 0
  const percentage = Math.min((safeValue / max) * 100, 100)
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative inline-flex flex-col items-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* 背景圆环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-800/50"
        />
        {/* 进度圆环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">
            <AnimatedCounter value={Math.round(percentage)} />
          </span>
          <span className="text-xs text-slate-400">{unit}</span>
        </div>
      )}
      {label && (
        <span className="mt-2 text-sm text-slate-400">{label}</span>
      )}
    </div>
  )
})

// 数据卡片组件
interface DataCardProps {
  title: string
  value: number | null | undefined
  icon?: React.ReactNode
  trend?: number | null | undefined
  trendLabel?: string
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'cyan' | 'pink'
  size?: 'normal' | 'large'
  prefix?: string
  suffix?: string
  decimals?: number
  children?: React.ReactNode
}

const colorMap = {
  blue: {
    bg: 'from-blue-500/10 to-blue-600/5',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    glow: 'shadow-blue-500/10',
    icon: 'text-blue-500',
  },
  green: {
    bg: 'from-green-500/10 to-green-600/5',
    border: 'border-green-500/20',
    text: 'text-green-400',
    glow: 'shadow-green-500/10',
    icon: 'text-green-500',
  },
  orange: {
    bg: 'from-orange-500/10 to-orange-600/5',
    border: 'border-orange-500/20',
    text: 'text-orange-400',
    glow: 'shadow-orange-500/10',
    icon: 'text-orange-500',
  },
  purple: {
    bg: 'from-purple-500/10 to-purple-600/5',
    border: 'border-purple-500/20',
    text: 'text-purple-400',
    glow: 'shadow-purple-500/10',
    icon: 'text-purple-500',
  },
  cyan: {
    bg: 'from-cyan-500/10 to-cyan-600/5',
    border: 'border-cyan-500/20',
    text: 'text-cyan-400',
    glow: 'shadow-cyan-500/10',
    icon: 'text-cyan-500',
  },
  pink: {
    bg: 'from-pink-500/10 to-pink-600/5',
    border: 'border-pink-500/20',
    text: 'text-pink-400',
    glow: 'shadow-pink-500/10',
    icon: 'text-pink-500',
  },
}

export const DataCard = memo(function DataCard({
  title,
  value,
  icon,
  trend,
  trendLabel,
  color = 'blue',
  size = 'normal',
  prefix = '',
  suffix = '',
  decimals = 0,
  children,
}: DataCardProps) {
  const colors = colorMap[color]
  const safeValue = value ?? 0

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border bg-gradient-to-br p-4 backdrop-blur-sm',
        'transition-all duration-300 hover:scale-[1.02]',
        colors.bg,
        colors.border,
        size === 'large' ? 'p-6' : 'p-4'
      )}
      style={{
        boxShadow: `0 0 40px -10px ${color === 'blue' ? 'rgba(59, 130, 246, 0.3)' : 
                    color === 'green' ? 'rgba(34, 197, 94, 0.3)' :
                    color === 'orange' ? 'rgba(249, 115, 22, 0.3)' :
                    color === 'purple' ? 'rgba(168, 85, 247, 0.3)' :
                    color === 'cyan' ? 'rgba(6, 182, 212, 0.3)' :
                    'rgba(236, 72, 153, 0.3)'}`
      }}
    >
      {/* 扫描线动画 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-scan" />
      </div>

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {icon && <span className={colors.icon}>{icon}</span>}
            <span className="text-sm text-slate-400">{title}</span>
          </div>
          <div className={cn(
            'font-bold tracking-tight',
            size === 'large' ? 'text-4xl' : 'text-3xl',
            colors.text
          )}>
            <AnimatedCounter value={safeValue} prefix={prefix} suffix={suffix} decimals={decimals} />
          </div>
          {(trend !== undefined || trendLabel) && (
            <div className="flex items-center gap-2 mt-2">
              {trend !== undefined && (
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded',
                  (trend ?? 0) >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                )}>
                  {(trend ?? 0) >= 0 ? '↑' : '↓'} {Math.abs(trend ?? 0)}%
                </span>
              )}
              {trendLabel && <span className="text-xs text-slate-500">{trendLabel}</span>}
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  )
})

// 实时时钟组件
export function RealtimeClock() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="text-right">
      <div className="text-2xl font-mono text-white font-bold">
        {time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
      <div className="text-sm text-slate-400">
        {time.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
      </div>
    </div>
  )
}

// 滚动数字组件
interface RollingNumberProps {
  value: number | null | undefined
  className?: string
  duration?: number
}

export const RollingNumber = memo(function RollingNumber({
  value,
  className,
  duration = 500,
}: RollingNumberProps) {
  const [displayValue, setDisplayValue] = useState(value ?? 0)
  const [isRolling, setIsRolling] = useState(false)
  const prevValueRef = useRef(value ?? 0)

  useEffect(() => {
    const safeValue = value ?? 0
    if (safeValue === prevValueRef.current) return
    
    setIsRolling(true)
    const startVal = prevValueRef.current
    const diff = safeValue - startVal
    const startTime = Date.now()
    
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easeProgress = 1 - Math.pow(1 - progress, 4)
      const current = Math.round(startVal + diff * easeProgress)
      
      setDisplayValue(current)
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setIsRolling(false)
        prevValueRef.current = safeValue
      }
    }
    
    requestAnimationFrame(animate)
  }, [value, duration])
  
  return (
    <span className={cn(
      'tabular-nums inline-block transition-transform',
      isRolling && 'scale-105',
      className
    )}>
      {(displayValue ?? 0).toLocaleString('zh-CN')}
    </span>
  )
})

// 迷你趋势图组件
interface MiniTrendProps {
  data: number[]
  color?: string
  height?: number
  animated?: boolean
}

export function MiniTrend({ data, color = '#3b82f6', height = 40, animated = false }: MiniTrendProps) {
  const [animatedData, setAnimatedData] = useState<number[]>([])
  const prevDataRef = useRef<number[]>(data)
  
  useEffect(() => {
    if (!animated || !data || data.length === 0) {
      setAnimatedData(data)
      return
    }
    
    const prevData = prevDataRef.current.length === data.length ? prevDataRef.current : data
    const startTime = Date.now()
    const duration = 500
    
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easeProgress = 1 - Math.pow(1 - progress, 3)
      
      const interpolated = data.map((target, i) => {
        const start = prevData[i] ?? target
        return Math.round(start + (target - start) * easeProgress)
      })
      
      setAnimatedData(interpolated)
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        prevDataRef.current = data
      }
    }
    
    requestAnimationFrame(animate)
  }, [data, animated])
  
  const displayData = animated && animatedData.length > 0 ? animatedData : data

  if (!displayData || displayData.length === 0) return null

  const max = Math.max(...displayData)
  const min = Math.min(...displayData)
  const range = max - min || 1

  const points = displayData.map((value, index) => {
    const x = (index / (displayData.length - 1)) * 100
    const y = height - ((value - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  const pathD = `M ${points.split(' ').map(p => p.replace(',', ' ')).join(' L ')}`

  return (
    <svg width="100%" height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-300"
        style={{ filter: `drop-shadow(0 0 3px ${color})` }}
      />
    </svg>
  )
}
