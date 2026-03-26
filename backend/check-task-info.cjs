const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 获取 claim 关联的 task 信息
  const result = await prisma.$queryRaw`
    SELECT 
      c.id as claim_id, c.status, c.screenshots,
      t.id as task_id, t.title, t.platform, t.action, t.link
    FROM claims c
    LEFT JOIN tasks t ON c.task_id = t.id
    WHERE c.id = 1
  `;
  
  console.log('=== 任务信息 ===');
  const r = result[0];
  console.log('Claim ID:', r.claim_id);
  console.log('Claim 状态:', r.status);
  console.log('Task ID:', r.task_id);
  console.log('Task 标题:', r.title);
  console.log('平台:', r.platform);
  console.log('动作:', r.action);
  console.log('任务链接:', r.link || '无');
  console.log('截图:', r.screenshots?.substring(0, 100) + '...');
}

main()
  .catch(e => console.error('错误:', e))
  .finally(() => prisma.$disconnect());
