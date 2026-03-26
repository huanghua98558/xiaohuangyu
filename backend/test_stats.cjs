const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

BigInt.prototype.toJSON = function() { return this.toString(); }

async function test() {
  const stats = await prisma.$queryRawUnsafe(`
    SELECT 
      COUNT(*) FILTER (WHERE status = 'image_reviewing') as image_reviewing,
      COUNT(*) FILTER (WHERE status = 'link_reviewing') as link_reviewing,
      COUNT(*) FILTER (WHERE status = 'image_approved' AND video_url IS NOT NULL) as pending_link,
      COUNT(*) FILTER (WHERE ai_review_status = 'manual') as manual,
      COUNT(*) FILTER (WHERE status IN ('done', 'released')) as approved,
      COUNT(*) FILTER (WHERE status IN ('image_rejected', 'link_rejected', 'rejected')) as rejected,
      COUNT(*) as total
    FROM claims
    WHERE screenshots IS NOT NULL
  `);
  
  console.log("=== 统计数据 ===");
  console.log(stats[0]);
  
  // 查看所有 claims 的状态
  const claims = await prisma.$queryRawUnsafe(`
    SELECT id, status, image_review_status, link_review_status, video_url
    FROM claims
    ORDER BY id DESC
    LIMIT 10
  `);
  
  console.log("\n=== 最近 Claims 状态 ===");
  claims.forEach(c => {
    console.log({
      id: c.id.toString(),
      status: c.status,
      img: c.image_review_status,
      link: c.link_review_status,
      has_video: !!c.video_url
    });
  });
  
  await prisma.$disconnect();
}

test();
