'use client';

interface ReviewDetailCardProps {
  method?: 'paddleocr' | 'gemini' | 'bailian' | 'manual';
  confidence?: number;
  duration?: number;
  likePassed?: boolean;
  favoritePassed?: boolean;
  followPassed?: boolean;
  ocrText?: string;
  rejectReason?: string;
}

export default function ReviewDetailCard({
  method = 'paddleocr',
  confidence = 0,
  duration = 0,
  likePassed,
  favoritePassed,
  followPassed,
  ocrText,
  rejectReason
}: ReviewDetailCardProps) {
  const getMethodLabel = (m: string) => {
    switch (m) {
      case 'paddleocr': return { label: 'PaddleOCR (本地)', color: 'bg-green-100 text-green-800' };
      case 'gemini': return { label: 'Gemini Vision', color: 'bg-blue-100 text-blue-800' };
      case 'bailian': return { label: '百炼视觉', color: 'bg-purple-100 text-purple-800' };
      case 'manual': return { label: '人工审核', color: 'bg-orange-100 text-orange-800' };
      default: return { label: m, color: 'bg-gray-100 text-gray-800' };
    }
  };

  const methodInfo = getMethodLabel(method);

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">审核详情</h3>
      
      <div className="space-y-3">
        {/* 审核方式 */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">审核方式</span>
          <span className={`px-2 py-1 rounded text-xs font-medium ${methodInfo.color}`}>
            {methodInfo.label}
          </span>
        </div>

        {/* 置信度 */}
        {confidence > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">置信度</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${confidence >= 0.8 ? 'bg-green-500' : confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(confidence * 100, 100)}%` }}
                />
              </div>
              <span className="text-sm font-medium">{(confidence * 100).toFixed(1)}%</span>
            </div>
          </div>
        )}

        {/* 审核耗时 */}
        {duration > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">审核耗时</span>
            <span className="text-sm font-medium">{duration}ms</span>
          </div>
        )}

        {/* 检测结果 */}
        {(likePassed !== undefined || favoritePassed !== undefined || followPassed !== undefined) && (
          <div className="pt-2 border-t">
            <span className="text-sm text-gray-500 block mb-2">检测结果</span>
            <div className="flex flex-wrap gap-2">
              {likePassed !== undefined && (
                <span className={`px-2 py-1 rounded text-xs ${likePassed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  点赞: {likePassed ? '✓ 通过' : '✗ 未通过'}
                </span>
              )}
              {favoritePassed !== undefined && (
                <span className={`px-2 py-1 rounded text-xs ${favoritePassed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  收藏: {favoritePassed ? '✓ 通过' : '✗ 未通过'}
                </span>
              )}
              {followPassed !== undefined && (
                <span className={`px-2 py-1 rounded text-xs ${followPassed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  关注: {followPassed ? '✓ 通过' : '✗ 未通过'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* OCR识别文字 */}
        {ocrText && (
          <div className="pt-2 border-t">
            <span className="text-sm text-gray-500 block mb-2">OCR识别文字</span>
            <div className="p-2 bg-gray-50 rounded text-xs text-gray-600 max-h-24 overflow-y-auto">
              {ocrText}
            </div>
          </div>
        )}

        {/* 拒绝原因 */}
        {rejectReason && (
          <div className="pt-2 border-t">
            <span className="text-sm text-red-600 block mb-1">拒绝原因</span>
            <div className="p-2 bg-red-50 rounded text-xs text-red-700">
              {rejectReason}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
