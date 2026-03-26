import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function checkTables() {
  try {
    const result = await prisma.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name LIKE %review%");
    console.log("审核相关表:", JSON.stringify(result, null, 2));
    
    const queueCheck = await prisma.$queryRawUnsafe("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = ai_review_queue) as exists");
    console.log("ai_review_queue 表是否存在:", JSON.stringify(queueCheck, null, 2));
    
    const claimsWithReview = await prisma.$queryRawUnsafe("SELECT id, status, image_review_status, link_review_status FROM claims WHERE image_review_status IS NOT NULL OR link_review_status IS NOT NULL LIMIT 5");
    console.log("有审核状态的 claims:", JSON.stringify(claimsWithReview, null, 2));
    
  } catch (e) {
    console.error("错误:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}
checkTables();
