/**
 * 审核状态徽章组件
 */
'use client'

import { Badge } from '@/components/ui/badge'

interface ReviewStatusBadgeProps {
  imageReviewStatus?: string
  linkReviewStatus?: string
  mainStatus?: string
  size?: 'sm' | 'md' | 'lg'
}

const IMAGE_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: '待图片审核', className: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  reviewing: { label: '图片审核中', className: 'bg-blue-100 text-blue-700 border-blue-300' },
  passed: { label: '图片审核通过', className: 'bg-green-100 text-green-700 border-green-300' },
  failed: { label: '图片审核失败', className: 'bg-red-100 text-red-700 border-red-300' }
}

const LINK_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: '待链接审查', className: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  reviewing: { label: '链接审查中', className: 'bg-blue-100 text-blue-700 border-blue-300' },
  passed: { label: '链接审查通过', className: 'bg-green-100 text-green-700 border-green-300' },
  failed: { label: '链接审查失败', className: 'bg-red-100 text-red-700 border-red-300' }
}

const MAIN_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  doing: { label: '进行中', className: 'bg-gray-100 text-gray-700 border-gray-300' },
  submitted: { label: '已提交', className: 'bg-blue-100 text-blue-700 border-blue-300' },
  pending: { label: '待审核', className: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  approved: { label: '已通过', className: 'bg-green-100 text-green-700 border-green-300' },
  rejected: { label: '已拒绝', className: 'bg-red-100 text-red-700 border-red-300' }
}

export function ReviewStatusBadge({ 
  imageReviewStatus, 
  linkReviewStatus, 
  mainStatus,
  size = 'sm' 
}: ReviewStatusBadgeProps) {
  const sizeClass = size === 'sm' ? 'text-[10px] px-1 py-0' : size === 'md' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1'
  
  const badges = []
  
  // 主状态
  if (mainStatus && MAIN_STATUS_CONFIG[mainStatus]) {
    const config = MAIN_STATUS_CONFIG[mainStatus]
    badges.push(
      <Badge key="main" variant="outline" className={`${config.className} ${sizeClass}`}>
        {config.label}
      </Badge>
    )
  }
  
  // 图片审核状态
  if (imageReviewStatus && IMAGE_STATUS_CONFIG[imageReviewStatus]) {
    const config = IMAGE_STATUS_CONFIG[imageReviewStatus]
    badges.push(
      <Badge key="image" variant="outline" className={`${config.className} ${sizeClass}`}>
        {config.label}
      </Badge>
    )
  }
  
  // 链接审查状态（仅图片审核通过后显示）
  if (imageReviewStatus === 'passed' && linkReviewStatus && LINK_STATUS_CONFIG[linkReviewStatus]) {
    const config = LINK_STATUS_CONFIG[linkReviewStatus]
    badges.push(
      <Badge key="link" variant="outline" className={`${config.className} ${sizeClass}`}>
        {config.label}
      </Badge>
    )
  }
  
  return <div className="flex flex-wrap gap-1">{badges}</div>
}

export default ReviewStatusBadge

