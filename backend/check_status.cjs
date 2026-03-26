const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
  const claims = await prisma.$queryRaw`
    SELECT id, status, ai_review_status, link_review_status, image_review_status
    FROM claims 
    WHERE id IN (11, 12, 13, 14)
    ORDER BY id
  `;
  claims.forEach(c => {
    console.log("ID:", c.id.toString());
    console.log("  status:", c.status);
    console.log("  ai_review_status:", c.ai_review_status);
    console.log("  link_review_status:", c.link_review_status);
    console.log("  image_review_status:", c.image_review_status);
    console.log("---");
  });
  await prisma.$disconnect();
}
check().catch(console.error);
