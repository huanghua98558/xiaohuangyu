const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const columns = await prisma.$queryRaw`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'link_verification_queue'
    ORDER BY ordinal_position
  `;
  console.log('link_verification_queue 表结构:');
  columns.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
  
  // 检查所有记录
  const all = await prisma.$queryRaw`
    SELECT * FROM link_verification_queue ORDER BY created_at DESC LIMIT 10
  `;
  console.log('\n表中的记录数:', all.length);
  if (all.length > 0) {
    console.log('最近记录:', all[0]);
  }
}

main()
  .catch(e => console.error('错误:', e))
  .finally(() => prisma.$disconnect());
