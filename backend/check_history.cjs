const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
  const claims = await prisma.$queryRaw`
    SELECT id, review_history, link_verify_result, ai_reason
    FROM claims 
    WHERE id = 14
  `;
  claims.forEach(c => {
    console.log("ID:", c.id.toString());
    console.log("\n=== review_history ===");
    if (c.review_history) {
      const history = typeof c.review_history === "string" ? JSON.parse(c.review_history) : c.review_history;
      console.log(JSON.stringify(history, null, 2));
    }
    console.log("\n=== link_verify_result ===");
    if (c.link_verify_result) {
      const result = typeof c.link_verify_result === "string" ? JSON.parse(c.link_verify_result) : c.link_verify_result;
      console.log(JSON.stringify(result, null, 2));
    }
    console.log("\n=== ai_reason ===");
    if (c.ai_reason) {
      const ai = typeof c.ai_reason === "string" ? JSON.parse(c.ai_reason) : c.ai_reason;
      console.log(JSON.stringify(ai, null, 2));
    }
  });
  await prisma.$disconnect();
}
check().catch(console.error);
