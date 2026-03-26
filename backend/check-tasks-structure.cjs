const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const columns = await prisma.$queryRaw`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'tasks'
    ORDER BY ordinal_position
  `;
  console.log('tasks 表结构:');
  columns.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
}

main()
  .catch(e => console.error('错误:', e))
  .finally(() => prisma.$disconnect());
