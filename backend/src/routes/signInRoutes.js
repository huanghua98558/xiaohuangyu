import { Router } from 'express'
import signInController from '../controllers/signInController.js'
import { authMiddleware } from '../middlewares/auth.js'

const router = Router()

router.use(authMiddleware)

router.post('/', signInController.signIn)
router.get('/status', signInController.getSignInStatus)
router.get('/calendar', signInController.getSignInCalendar)

export default router
