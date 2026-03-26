/**
 * Claim 服务
 */
import pkg from '@prisma/client'; const { PrismaClient } = pkg;

const prisma = new PrismaClient();

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
  } finally {
    await prisma.$disconnect();
  }
}

export default { updateClaimStatus };
