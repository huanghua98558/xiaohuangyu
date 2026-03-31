const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. claims 状态分布
  const claims = await prisma.$queryRaw`
    SELECT 
      status,
      image_review_status,
      link_review_status,
      COUNT(*) as count
    FROM claims
    GROUP BY status, image_review_status, link_review_status
    ORDER BY count DESC
    LIMIT 20
  `;
  console.log('\n=== claims 状态分布 ===');
  console.table(claims);

  // 2. review_rules
  const rules = await prisma.$queryRaw`
    SELECT * FROM review_rules LIMIT 15
  `;
  console.log('\n=== review_rules 表 ===');
  console.table(rules);

  // 3. block_status 分布
  const blocks = await prisma.$queryRaw`
    SELECT 
      block_status,
      COUNT(*) as count
    FROM claims
    GROUP BY block_status
    ORDER BY count DESC
  `;
  console.log('\n=== block_status 分布 ===');
  console.table(blocks);

  // 4. 最近待审核的 claims
  const pending = await prisma.$queryRaw`
    SELECT 
      id, title, status, image_review_status, link_review_status, 
      submitted_at, review_note
    FROM claims
    WHERE status IN ('submitted', 'pending')
    ORDER BY submitted_at DESC
    LIMIT 10
  `;
  console.log('\n=== 最近待审核 claims ===');
  console.table(pending);
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
