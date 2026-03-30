import { Router } from 'express'
import promotionController from '../controllers/promotionController.js'
import promotionService from '../services/promotionService.js'
import { authMiddleware } from '../middlewares/auth.js'
import { success } from '../utils/response.js'

const router = Router()

// 公开接口 - 获取注册配置（邀请码是否必填等）
router.get('/register-config', async (req, res, next) => {
  try {
    const config = await promotionService.getConfig()
    success(res, {
      inviteRequired: config.c_promotion_invite_required === 'true',
      promotionEnabled: config.c_promotion_enabled === 'true',
      registrationCodeRequired: config.register_code_required === 'true'
    })
  } catch (err) {
    next(err)
  }
})

// 以下接口需要登录
router.use(authMiddleware)

// C端推广
router.post('/bind', promotionController.bindInviteCode)
router.get('/c/stats', promotionController.getCStats)
router.get('/c/subordinates', promotionController.getSubordinates)
router.get('/c/earnings', promotionController.getCEarnings)

// B端推广
router.get('/b/stats', promotionController.getBStats)
router.get('/b/partners', promotionController.getPartners)

export default router
