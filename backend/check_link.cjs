const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // 1. 查询 image_approved 状态的任务
  const imageApproved = await prisma.$queryRawUnsafe(
    "SELECT c.id, c.status, c.image_review_status, c.link_review_status, " +
    "c.image_review_reason, c.link_review_reason, " +
    "t.title, t.video_url, c.claimed_at, c.submitted_at " +
    "FROM claims c " +
    "JOIN tasks t ON c.task_id = t.id " +
    "WHERE c.status = image_approved"
  );
  console.log("=== image_approved 状态的任务 ===");
  console.log(JSON.stringify(imageApproved, null, 2));
  
  // 2. 查询 link_reviewing 状态的任务
  const linkReviewing = await prisma.$queryRawUnsafe(
    "SELECT c.id, c.status, c.image_review_status, c.link_review_status, " +
    "t.title, t.video_url " +
    "FROM claims c " +
    "JOIN tasks t ON c.task_id = t.id " +
    "WHERE c.status = link_reviewing"
  );
  console.log("\n=== link_reviewing 状态的任务 ===");
  console.log(JSON.stringify(linkReviewing, null, 2));
  
  // 3. 查询最近有审核记录的任务
  const recentClaims = await prisma.$queryRawUnsafe(
    "SELECT c.id, c.status, c.image_review_status, c.link_review_status, " +
    "c.review_history, t.title, t.video_url " +
    "FROM claims c " +
    "JOIN tasks t ON c.task_id = t.id " +
    "WHERE c.screenshots IS NOT NULL AND c.screenshots::text != [] " +
    "ORDER BY c.id DESC " +
    "LIMIT 5"
  );
  console.log("\n=== 最近提交的任务 ===");
  console.log(JSON.stringify(recentClaims, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
