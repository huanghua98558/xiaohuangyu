const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 检查链接验证队列
  const queue = await prisma.$queryRaw`
    SELECT table_name FROM information_schema.tables 
    WHERE table_name LIKE '%link%' OR table_name LIKE '%verify%'
  `;
  console.log('链接相关表:', queue.map(t => t.table_name).join(', '));
  
  // 检查 link_verification_queue 表
  try {
    const linkQueue = await prisma.$queryRaw`
      SELECT * FROM link_verification_queue WHERE claim_id = 1 ORDER BY created_at DESC LIMIT 5
    `;
    console.log('\n链接验证队列记录:');
    linkQueue.forEach(q => console.log(q));
  } catch (e) {
    console.log('link_verification_queue 表不存在或查询失败:', e.message);
  }
}

main()
  .catch(e => console.error('错误:', e))
  .finally(() => prisma.$disconnect());
