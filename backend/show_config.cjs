const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const configs = await prisma.$queryRawUnsafe(
    "\"SELECT key, value FROM ai_configs WHERE key LIKE 'link_verify_%'\""
  );
  console.log("=== 链接审查配置 ===");
  configs.forEach(c => console.log(`${c.key}: ${c.value}`));
}
main().catch(console.error).finally(() => prisma.$disconnect());
