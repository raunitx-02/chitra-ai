import { Router } from 'express';
import { syncUser, getUserProfile } from '../controllers/auth.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.post('/sync', protect as any, syncUser as any);
router.get('/profile', protect as any, getUserProfile as any);

export default router;
