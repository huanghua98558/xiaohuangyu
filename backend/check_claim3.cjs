const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const claimId = "1161237685590884353";
  
  const claim = await prisma.$queryRawUnsafe(
    "SELECT c.id::text, c.status, c.image_review_status, c.link_review_status, " +
    "c.link_verify_result::text, c.review_history::text, " +
    "t.title, t.video_url, c.ocr_comment " +
    "FROM claims c " +
    "JOIN tasks t ON c.task_id = t.id " +
    "WHERE c.id = " + claimId
  );
  
  claim.forEach(c => {
    console.log("ID:", c.id);
    console.log("Status:", c.status);
    console.log("Image Review:", c.image_review_status);
    console.log("Link Review:", c.link_review_status);
    console.log("Task Title:", c.title);
    console.log("Task Video URL:", c.video_url);
    console.log("OCR Comment:", c.ocr_comment);
    console.log("Link Verify Result:", c.link_verify_result);
    console.log("Review History:", c.review_history);
  });
  
  // 查看最近更新的 claims
  const recentClaims = await prisma.$queryRawUnsafe(
    "SELECT id::text, status, link_review_status " +
    "FROM claims " +
    "WHERE link_review_status IS NOT NULL " +
    "LIMIT 5"
  );
  console.log("\n=== 有 Link Review 状态的 Claims ===");
  recentClaims.forEach(c => {
    console.log(`ID: ${c.id}, Status: ${c.status}, LinkReview: ${c.link_review_status}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
