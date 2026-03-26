const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const claimId = "1161237685590884353";
  
  const claim = await prisma.$queryRawUnsafe(
    "SELECT c.id::text, c.status, c.image_review_status, c.link_review_status, " +
    "c.link_verify_result::text, c.review_history::text, t.title, t.video_url " +
    "FROM claims c " +
    "JOIN tasks t ON c.task_id = t.id " +
    "WHERE c.id = " + claimId
  );
  console.log("=== Claim 状态 ===");
  claim.forEach(c => {
    console.log("ID:", c.id);
    console.log("Status:", c.status);
    console.log("Image Review:", c.image_review_status);
    console.log("Link Review:", c.link_review_status);
    console.log("Task Title:", c.title);
    console.log("Task Video URL:", c.video_url);
    console.log("Link Verify Result:", c.link_verify_result);
    console.log("Review History:", c.review_history);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
