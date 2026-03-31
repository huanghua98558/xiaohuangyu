/**
 * 业务定义：任务「完成」= 图片审核与链接审核均已通过（无需链接时为 skipped），且 claim 已进入通过态。
 * 与 claims.status IN ('approved','done') 配合使用。
 */
export const IMAGE_OK = new Set(['approved', 'checked'])
export const LINK_OK = new Set(['approved', 'skipped', 'passed', 'checked'])

export function isDualReviewComplete(claim) {
  if (!claim) return false
  const st = String(claim.status || '').toLowerCase()
  if (!['approved', 'done'].includes(st)) return false
  const img = String(claim.image_review_status || '')
    .trim()
    .toLowerCase()
  const link = String(claim.link_review_status || '')
    .trim()
    .toLowerCase()
  return IMAGE_OK.has(img) && LINK_OK.has(link)
}

/** Prisma/Cockroach 片段：双审通过（表别名 c） */
export const SQL_DUAL_REVIEW_COMPLETE = `
  c.status IN ('approved', 'done')
  AND LOWER(COALESCE(TRIM(c.image_review_status), '')) IN ('approved', 'checked')
  AND LOWER(COALESCE(TRIM(c.link_review_status), '')) IN ('approved', 'skipped', 'passed', 'checked')
`
