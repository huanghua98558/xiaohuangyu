const { Pool } = require('pg');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// 旧 Supabase 数据库连接
const oldDb = new Pool({
  host: 'aws-1-ap-south-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.uupwoghhivtfapbntxzs',
  password: 'n9PMo08FHepPLg4W',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  console.log('========== 开始数据迁移 ==========\n');
  
  try {
    // 1. 迁移 claims 数据
    console.log('=== 1. 迁移 claims 数据 ===');
    
    const claimsResult = await oldDb.query(`
      SELECT 
        id, user_id, task_id, title, platform, action,
        base_reward, reward, level_coefficient, status,
        city, province, platform_nickname, screenshots,
        expires_at, claimed_at, submitted_at, reviewed_at,
        reviewer_id, review_note, ai_review_status, ai_confidence,
        ai_reason, ai_reviewed_at, image_review_status, image_reviewed_at,
        image_review_reason, link_review_status, link_reviewed_at,
        link_review_reason, block_status, review_history,
        evaluation, link_verified, link_verify_result, 
        night_coefficient, online_users, reviewer_ip, reviewer_location
      FROM claims 
      ORDER BY id
    `);
    
    console.log(`获取到 ${claimsResult.rows.length} 条 claims 记录`);
    
    let claimsSuccess = 0;
    let claimsError = 0;
    const errors = [];
    
    for (const row of claimsResult.rows) {
      try {
        // 检查用户是否存在
        const userId = parseInt(row.user_id);
        const userExists = await prisma.users.findUnique({ where: { id: userId } });
        
        // 检查任务是否存在
        const taskId = parseInt(row.task_id);
        const taskExists = await prisma.tasks.findUnique({ where: { id: taskId } });
        
        if (!userExists || !taskExists) {
          claimsError++;
          errors.push(`ID ${row.id}: 用户或任务不存在 (user=${userId}, task=${taskId})`);
          continue;
        }
        
        // 插入数据
        await prisma.claims.create({
          data: {
            id: row.id,
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
            review_history: row.review_history || [],
            reject_count: 0,
            ocr_comment: null
          }
        });
        claimsSuccess++;
        
        if (claimsSuccess % 50 === 0) {
          console.log(`已迁移 ${claimsSuccess} 条 claims 记录...`);
        }
      } catch (err) {
        claimsError++;
        if (errors.length < 20) {
          errors.push(`ID ${row.id}: ${err.message}`);
        }
      }
    }
    
    console.log(`\nClaims 迁移完成: 成功 ${claimsSuccess} 条, 失败 ${claimsError} 条`);
    if (errors.length > 0 && errors.length <= 10) {
      console.log('错误详情:', errors);
    }
    
    // 2. 迁移其他表数据
    console.log('\n=== 2. 迁移 records 数据 ===');
    const recordsResult = await oldDb.query(`SELECT COUNT(*) as count FROM records`);
    console.log(`Records 记录数: ${recordsResult.rows[0].count}`);
    
    // 3. 迁移 withdrawals 数据
    console.log('\n=== 3. 迁移 withdrawals 数据 ===');
    const withdrawalsResult = await oldDb.query(`SELECT COUNT(*) as count FROM withdrawals`);
    console.log(`Withdrawals 记录数: ${withdrawalsResult.rows[0].count}`);
    
    // 4. 验证迁移结果
    console.log('\n=== 4. 验证迁移结果 ===');
    const newClaimsCount = await prisma.claims.count();
    console.log(`新库 Claims 记录数: ${newClaimsCount}`);
    
    console.log('\n========== 迁移完成 ==========');
    
  } catch (err) {
    console.error('迁移失败:', err);
  } finally {
    await oldDb.end();
    await prisma.$disconnect();
  }
}

migrate();
