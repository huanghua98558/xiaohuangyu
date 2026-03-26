const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // 设置延迟为 0 分钟（测试模式）
  await prisma.$executeRawUnsafe(
    "\"UPDATE ai_configs SET value = 0 WHERE key = link_verify_delay_minutes\""
  );
  
  // 验证
  const result = await prisma.$queryRawUnsafe(
    "\"SELECT key, value FROM ai_configs WHERE key = link_verify_delay_minutes\""
  );
  console.log("已更新配置:", result);
}

main().catch(console.error).finally(() => prisma.$disconnect());
