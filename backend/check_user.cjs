const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  // 查看最近的 claims 记录
  const claims = await prisma.$queryRawUnsafe(
    "SELECT id, user_id, task_id, status, created_at FROM claims ORDER BY created_at DESC LIMIT 10"
  );
  console.log('=== 最近的 claims ===');
  claims.forEach(c => {
    console.log({
      id: c.id?.toString(),
      user_id: c.user_id?.toString(),
      task_id: c.task_id?.toString(),
      status: c.status,
      created_at: c.created_at
    });
  });
  await prisma.$disconnect();
}

test();
