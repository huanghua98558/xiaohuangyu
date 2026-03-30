/**
 * 图片审核API路由
 */

import express from 'express';
import { authMiddleware, adminOrReviewer } from '../middlewares/auth.js';
import supabase from '../utils/supabaseToPrismaAdapter.js';
import { enqueueReview, getQueueStats } from '../services/ai/queueService.js';
import { reviewImage, getReviewQueue, getReviewStats, manualApprove, manualReject } from '../services/ai/imageReviewService.js';

const router = express.Router();

// 手动触发审核需要管理员或审核员权限
router.post('/review', authMiddleware, adminOrReviewer, async (req, res) => {
  try {
    const { claimId } = req.body;
    
    if (!claimId) {
      return res.status(400).json({ error: '缺少claimId' });
    }
    
    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select('*, tasks(platform, action, description)')
      .eq('id', claimId)
      .single();
    
    if (claimError || !claim) {
      return res.status(404).json({ error: '任务不存在' });
    }
    
    const screenshots = JSON.parse(claim.screenshots || '[]');
    
    if (screenshots.length === 0) {
      return res.status(400).json({ error: '无截图数据' });
    }
    
    const result = await reviewImage(claimId, screenshots[0], claim.tasks || {});
    
    res.json({ success: true, result });
    
  } catch (error) {
    console.error('图片审核失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取队列状态 - 需要认证
 */
router.get('/queue-status', authMiddleware, adminOrReviewer, async (req, res) => {
  try {
    const stats = await getQueueStats();
    res.json({ success: true, ...stats });
  } catch (error) {
    console.error('获取队列状态失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 添加到审核队列 - 需要认证
 */
router.post('/queue', authMiddleware, adminOrReviewer, async (req, res) => {
  try {
    const { claimId } = req.body;
    
    if (!claimId) {
      return res.status(400).json({ error: '缺少claimId' });
    }
    
    await enqueueReview(claimId);
    res.json({ success: true, message: '已加入审核队列' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取审核队列列表 - 需要认证
 */
router.get('/queue', authMiddleware, adminOrReviewer, async (req, res) => {
  try {
    const { status, limit = 20, offset = 0 } = req.query;
    const result = await getReviewQueue({ status, limit: parseInt(limit), offset: parseInt(offset) });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取审核统计 - 需要认证
 */
router.get('/stats', authMiddleware, adminOrReviewer, async (req, res) => {
  try {
    const stats = await getReviewStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 人工通过审核 - 需要认证
 */
router.post('/approve/:id', authMiddleware, adminOrReviewer, async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const reviewerId = req.userId; // 从认证中间件获取
    
    const result = await manualApprove(parseInt(id), reviewerId, note || '');
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 人工拒绝审核 - 需要认证
 */
router.post('/reject/:id', authMiddleware, adminOrReviewer, async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const reviewerId = req.userId; // 从认证中间件获取
    
    const result = await manualReject(parseInt(id), reviewerId, note || '');
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
