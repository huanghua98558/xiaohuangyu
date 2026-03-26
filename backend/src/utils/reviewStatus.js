/**
 * 审核状态工具函数
 */

// 状态映射
export const IMAGE_REVIEW_STATUS = {
  pending: { label: '待图片审核', color: 'yellow' },
  reviewing: { label: '图片审核中', color: 'blue' },
  passed: { label: '图片审核通过', color: 'green' },
  failed: { label: '图片审核失败', color: 'red' }
};

export const LINK_REVIEW_STATUS = {
  pending: { label: '待链接审查', color: 'yellow' },
  reviewing: { label: '链接审查中', color: 'blue' },
  passed: { label: '链接审查通过', color: 'green' },
  failed: { label: '链接审查失败', color: 'red' }
};

export const CLAIM_STATUS = {
  doing: { label: '进行中', color: 'gray' },
  submitted: { label: '已提交', color: 'blue' },
  pending: { label: '待审核', color: 'yellow' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已拒绝', color: 'red' }
};

/**
 * 获取完整的审核状态显示
 */
export function getReviewStatusDisplay(claim) {
  const statuses = [];
  
  // 主状态
  if (claim.status) {
    statuses.push({
      type: 'main',
      ...CLAIM_STATUS[claim.status]
    });
  }
  
  // 图片审核状态
  if (claim.image_review_status) {
    statuses.push({
      type: 'image',
      ...IMAGE_REVIEW_STATUS[claim.image_review_status]
    });
  }
  
  // 链接审查状态（仅图片审核通过后显示）
  if (claim.image_review_status === 'passed' && claim.link_review_status) {
    statuses.push({
      type: 'link',
      ...LINK_REVIEW_STATUS[claim.link_review_status]
    });
  }
  
  return statuses;
}

/**
 * 获取状态CSS类名
 */
export function getStatusClass(status) {
  const colorMap = {
    yellow: 'status-yellow',
    blue: 'status-blue',
    green: 'status-green',
    red: 'status-red',
    gray: 'status-gray'
  };
  return colorMap[status?.color] || 'status-gray';
}

export default {
  IMAGE_REVIEW_STATUS,
  LINK_REVIEW_STATUS,
  CLAIM_STATUS,
  getReviewStatusDisplay,
  getStatusClass
};

