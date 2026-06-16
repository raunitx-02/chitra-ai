import { Router } from 'express';
import { protect, requireReseller } from '../middlewares/auth.middleware';
import {
  listResellerUsers,
  createResellerUser,
  updateResellerUserPlan,
  deleteResellerUser,
  getResellerStats
} from '../controllers/reseller.controller';

const router = Router();

// Protect all routes under /api/reseller
router.use(protect as any);
router.use(requireReseller as any);

router.get('/users', listResellerUsers as any);
router.post('/users', createResellerUser as any);
router.put('/users/:id', updateResellerUserPlan as any);
router.delete('/users/:id', deleteResellerUser as any);
router.get('/stats', getResellerStats as any);

export default router;
