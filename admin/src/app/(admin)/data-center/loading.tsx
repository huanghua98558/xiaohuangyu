import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* 顶部栏骨架 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded-lg bg-slate-800" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-32 bg-slate-800" />
            <Skeleton className="h-4 w-24 bg-slate-800" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-32 bg-slate-800" />
          <Skeleton className="h-8 w-20 bg-slate-800" />
          <div className="text-right">
            <Skeleton className="h-8 w-24 bg-slate-800 mb-1" />
            <Skeleton className="h-4 w-32 bg-slate-800" />
          </div>
        </div>
      </div>

      {/* 核心数据骨架 */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 bg-slate-800/50" />
        ))}
      </div>

      {/* 运营指标骨架 */}
      <div className="grid grid-cols-12 gap-4 mb-4">
        <div className="col-span-8 grid grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-24 bg-slate-800/50" />
          ))}
        </div>
        <div className="col-span-4">
          <Skeleton className="h-48 bg-slate-800/50" />
        </div>
      </div>

      {/* 趋势图骨架 */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-3">
          <Skeleton className="h-48 bg-slate-800/50" />
        </div>
        <div className="col-span-9">
          <Skeleton className="h-48 bg-slate-800/50" />
        </div>
      </div>
    </div>
  )
}
