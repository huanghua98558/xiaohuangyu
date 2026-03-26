const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
  const claims = await prisma.$queryRaw`
    SELECT id, status, link_review_status, link_review_reason, review_note, reject_count, user_hint
    FROM claims 
    WHERE id IN (11, 12, 13, 14)
    ORDER BY id
  `;
  console.log(JSON.stringify(claims, null, 2));
  await prisma.$disconnect();
}
check().catch(console.error);
