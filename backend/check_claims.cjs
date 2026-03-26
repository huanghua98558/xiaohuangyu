const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
  const claims = await prisma.$queryRaw`
    SELECT id, status, link_review_status, link_review_reason, review_note, reject_count
    FROM claims 
    WHERE id IN (11, 12, 13, 14)
    ORDER BY id
  `;
  claims.forEach(c => {
    console.log("ID:", c.id.toString());
    console.log("  status:", c.status);
    console.log("  link_review_status:", c.link_review_status);
    console.log("  link_review_reason:", c.link_review_reason);
    console.log("  review_note:", c.review_note);
    console.log("  reject_count:", c.reject_count?.toString());
    console.log("---");
  });
  await prisma.$disconnect();
}
check().catch(console.error);
