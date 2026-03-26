const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // 检查 claim 1161237685590884353 的状态
  const claim = await prisma.$queryRawUnsafe(
    "SELECT id::text, status, image_review_status, link_review_status " +
    "FROM claims WHERE id = 1161237685590884353"
  );
  console.log("=== Claim 1161237685590884353 状态 ===");
  claim.forEach(c => console.log(c));
  
  // 检查 pending_link 状态的 claims
  const pendingLink = await prisma.$queryRawUnsafe(
    "SELECT c.id::text, c.status, c.image_review_status, c.link_review_status, " +
    "t.video_url IS NOT NULL as has_video " +
    "FROM claims c " +
    "JOIN tasks t ON c.task_id = t.id " +
    "WHERE c.status = link_reviewing LIMIT 5"
  );
  console.log("\n=== link_reviewing 状态的 Claims ===");
  pendingLink.forEach(c => console.log(c));
}

main().catch(console.error).finally(() => prisma.$disconnect());
