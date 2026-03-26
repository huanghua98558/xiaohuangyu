'use client';

import { useMemo } from 'react';

interface ReviewProgressProps {
  imageStatus?: 'pending' | 'processing' | 'approved' | 'rejected';
  linkStatus?: 'pending' | 'processing' | 'approved' | 'rejected' | 'skipped';
  showDetails?: boolean;
}

export default function ReviewProgress({ 
  imageStatus = 'pending', 
  linkStatus = 'pending',
  showDetails = true 
}: ReviewProgressProps) {
  const steps = useMemo(() => [
    {
      name: '图片审核',
      status: imageStatus,
      icon: imageStatus === 'approved' ? '✅' : imageStatus === 'rejected' ? '❌' : imageStatus === 'processing' ? '🔄' : '⏳'
    },
    {
      name: '链接验证',
      status: linkStatus,
      icon: linkStatus === 'approved' ? '✅' : linkStatus === 'rejected' ? '❌' : linkStatus === 'processing' ? '🔄' : linkStatus === 'skipped' ? '⏭️' : '⏳'
    }
  ], [imageStatus, linkStatus]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-600 bg-green-50';
      case 'rejected': return 'text-red-600 bg-red-50';
      case 'processing': return 'text-blue-600 bg-blue-50';
      case 'skipped': return 'text-gray-500 bg-gray-50';
      default: return 'text-gray-400 bg-gray-50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return '通过';
      case 'rejected': return '拒绝';
      case 'processing': return '处理中';
      case 'skipped': return '已跳过';
      default: return '待处理';
    }
  };

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">审核进度</h3>
      
      <div className="flex items-center gap-4">
        {steps.map((step, index) => (
          <div key={step.name} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${getStatusColor(step.status)}`}>
              <span className="text-lg">{step.icon}</span>
              <div>
                <div className="text-sm font-medium">{step.name}</div>
                <div className="text-xs opacity-75">{getStatusText(step.status)}</div>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className="w-8 h-0.5 bg-gray-200 mx-2" />
            )}
          </div>
        ))}
      </div>

      {showDetails && imageStatus === 'approved' && linkStatus === 'approved' && (
        <div className="mt-3 p-2 bg-green-50 rounded text-sm text-green-700">
          ✅ 审核完成，任务已通过
        </div>
      )}

      {showDetails && (imageStatus === 'rejected' || linkStatus === 'rejected') && (
        <div className="mt-3 p-2 bg-red-50 rounded text-sm text-red-700">
          ❌ 审核未通过，请查看详情
        </div>
      )}
    </div>
  );
}
