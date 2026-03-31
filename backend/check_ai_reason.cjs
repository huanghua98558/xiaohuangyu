const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
  const claims = await prisma.$queryRaw`
    SELECT id, ai_reason, link_verify_result
    FROM claims 
    WHERE ai_reason IS NOT NULL OR link_verify_result IS NOT NULL
    ORDER BY id DESC
    LIMIT 3
  `;
  claims.forEach(c => {
    console.log("ID:", c.id.toString());
    console.log("  ai_reason:", c.ai_reason?.substring?.(0, 200) || c.ai_reason);
    console.log("  link_verify_result:", c.link_verify_result?.substring?.(0, 300) || c.link_verify_result);
    console.log("---");
  });
  await prisma.$disconnect();
}
check().catch(console.error);
