const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
  const claims = await prisma.$queryRaw`
    SELECT id, link_verify_result
    FROM claims 
    WHERE id = 14
  `;
  claims.forEach(c => {
    console.log("ID:", c.id.toString());
    const result = c.link_verify_result;
    if (result) {
      const parsed = typeof result === "string" ? JSON.parse(result) : result;
      console.log("  linkResult.success:", parsed.linkResult?.valid);
      console.log("  extractedCommentCount:", parsed.linkResult?.extractedCommentCount);
      console.log("  commentResult.passed:", parsed.commentResult?.passed);
      console.log("  commentResult.errorType:", parsed.commentResult?.errorType);
      console.log("  commentResult.reasons:", parsed.commentResult?.reasons);
    }
  });
  await prisma.$disconnect();
}
check().catch(console.error);
