const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const prisma = new PrismaClient();

const oldDb = new Pool({
  host: 'cotton-tern-23589.j77.aws-ap-southeast-1.cockroachlabs.cloud',
  port: 6543,
  user: 'postgres.uupwoghhivtfapbntxzs',
  password: 'n9PMo08FHepPLg4W',
  database: 'postgres'
});

async function migrate() {
  try {
    // 先清理新数据库中的旧数据
    console.log('清理新数据库中的 claims 数据...');
    await prisma.$executeRaw`DELETE FROM claims WHERE id > 0`;
    
    // 从旧数据库获取数据
    console.log('从旧数据库获取 claims 数据...');
    const result = await oldDb.query(`
      SELECT 
        id, user_id, task_id, title, platform, action,
        base_reward, reward, level_coefficient, status,
        city, province, platform_nickname, screenshots,
        expires_at, claimed_at, submitted_at, reviewed_at,
        reviewer_id, review_note, ai_review_status, ai_confidence,
        ai_reason, ai_reviewed_at, image_review_status, image_reviewed_at,
        image_review_reason, link_review_status, link_reviewed_at,
        link_review_reason, block_status, review_history, created_at
      FROM claims 
      ORDER BY id
    `);
    
    console.log(`获取到 ${result.rows.length} 条 claims 记录`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const row of result.rows) {
      try {
        // 检查关联的用户是否存在
        const userId = parseInt(row.user_id);
        const userExists = await prisma.users.findUnique({ where: { id: userId } });
        
        // 检查关联的任务是否存在
        const taskId = BigInt(row.task_id || 1);
        const taskExists = await prisma.tasks.findUnique({ where: { id: taskId } });
        
        if (!userExists || !taskExists) {
          errorCount++;
          continue;
        }
        
        // 处理空值和默认值
        const data = {
          id: parseInt(row.id) || undefined,
          user_id: userId,
          task_id: taskId,
          title: row.title || '未知任务',
          platform: row.platform || '未知平台',
          action: row.action || '未知操作',
          base_reward: parseInt(row.base_reward) || 0,
          reward: parseInt(row.reward) || 0,
          level_coefficient: parseFloat(row.level_coefficient) || 1.0,
          status: row.status || 'doing',
          city: row.city,
          province: row.province,
          platform_nickname: row.platform_nickname,
          screenshots: row.screenshots || '[]',
          expires_at: row.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          claimed_at: row.claimed_at || new Date(),
          submitted_at: row.submitted_at,
          reviewed_at: row.reviewed_at,
          reviewer_id: row.reviewer_id ? parseInt(row.reviewer_id) : null,
          review_note: row.review_note,
          ai_review_status: row.ai_review_status,
          ai_confidence: row.ai_confidence ? parseFloat(row.ai_confidence) : null,
          ai_reason: row.ai_reason,
          ai_reviewed_at: row.ai_reviewed_at,
          image_review_status: row.image_review_status,
          image_reviewed_at: row.image_reviewed_at,
          image_review_reason: row.image_review_reason,
          link_review_status: row.link_review_status,
          link_reviewed_at: row.link_reviewed_at,
          link_review_reason: row.link_review_reason,
          block_status: row.block_status || 'none',
          review_history: row.review_history || []
        };
        
        await prisma.claims.create({ data });
        successCount++;
        
        if (successCount % 50 === 0) {
          console.log(`已迁移 ${successCount} 条记录...`);
        }
      } catch (err) {
        errorCount++;
        if (errorCount < 10) {
          console.log(`错误 (ID: ${row.id}): ${err.message}`);
        }
      }
    }
    
    console.log(`\n=== claims 迁移完成 ===`);
    console.log(`成功: ${successCount} 条`);
    console.log(`失败: ${errorCount} 条`);
    
  } catch (err) {
    console.error('迁移失败:', err);
  } finally {
    await oldDb.end();
    await prisma.$disconnect();
  }
}

migrate();
