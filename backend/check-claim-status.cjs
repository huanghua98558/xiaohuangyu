const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const claim = await prisma.$queryRaw`
    SELECT 
      id, status, 
      image_review_status, image_reviewed_at, image_review_reason,
      link_review_status, link_reviewed_at, link_review_reason,
      ai_review_status, ai_confidence, ai_reason
    FROM claims WHERE id = 1
  `;
  
  console.log('=== Claim 审核状态详情 ===');
  const c = claim[0];
  console.log('\n基础状态:');
  console.log('  status:', c.status);
  
  console.log('\n图片审核:');
  console.log('  image_review_status:', c.image_review_status || '未审核');
  console.log('  image_reviewed_at:', c.image_reviewed_at || '无');
  console.log('  image_review_reason:', c.image_review_reason || '无');
  
  console.log('\n链接审核:');
  console.log('  link_review_status:', c.link_review_status || '未审核');
  console.log('  link_reviewed_at:', c.link_reviewed_at || '无');
  console.log('  link_review_reason:', c.link_review_reason || '无');
  
  console.log('\nAI审核:');
  console.log('  ai_review_status:', c.ai_review_status || '未审核');
  console.log('  ai_confidence:', c.ai_confidence || '无');
  console.log('  ai_reason:', c.ai_reason || '无');
}

main()
  .catch(e => console.error('错误:', e))
  .finally(() => prisma.$disconnect());
