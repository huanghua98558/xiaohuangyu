const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  // 查找 amin 用户
  const users = await prisma.$queryRawUnsafe(
    "SELECT id, phone, nickname FROM users WHERE phone LIKE '%amin%' OR nickname LIKE '%amin%' LIMIT 5"
  );
  console.log('=== amin 用户 ===');
  users.forEach(u => console.log({ id: u.id?.toString(), phone: u.phone, nickname: u.nickname }));
  await prisma.$disconnect();
}

test();
