const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const task = await prisma.$queryRaw`
    SELECT * FROM tasks WHERE id = 1
  `;
  console.log('Task 数据:');
  Object.entries(task[0]).forEach(([k, v]) => {
    if (typeof v === 'string' && v.length > 50) {
      console.log(`  ${k}: ${v.substring(0, 50)}...`);
    } else {
      console.log(`  ${k}: ${v}`);
    }
  });
}

main()
  .catch(e => console.error('错误:', e))
  .finally(() => prisma.$disconnect());
