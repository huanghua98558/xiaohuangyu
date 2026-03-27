/**
 * Claim 服务
 */
import prisma from '../utils/prisma.js';

export async function updateClaimStatus(claimId, status) {
  try {
    await prisma.claims.update({
      where: { id: claimId },
      data: { status, updated_at: new Date() }
    });
    console.log(`[ClaimService] claimId=${claimId} 状态已更新：${status}`);
    return true;
  } catch (error) {
    console.error(`[ClaimService] 更新 claimId=${claimId} 失败:`, error);
    return false;
  }
}

export default { updateClaimStatus };
