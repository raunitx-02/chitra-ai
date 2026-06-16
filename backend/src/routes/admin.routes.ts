import { Router } from 'express';
import { protect, requireAdmin } from '../middlewares/auth.middleware';
import {
  getDashboardStats,
  listUsers,
  updateUser,
  deleteUser,
  toggleBanUser,
  listPlansAdmin,
  createPlan,
  updatePlan,
  deletePlan,
  addPlanFeature,
  togglePlanFeature,
  deletePlanFeature,
  createReseller,
  listResellers
} from '../controllers/admin.controller';

const router = Router();

// Apply auth protection & admin check on all sub-routes
router.use(protect as any);
router.use(requireAdmin as any);

// Dashboard Analytics
router.get('/stats', getDashboardStats as any);

// Users Management
router.get('/users', listUsers as any);
router.put('/users/:id', updateUser as any);
router.delete('/users/:id', deleteUser as any);
router.post('/users/:id/ban', toggleBanUser as any);

// Resellers Management
router.post('/resellers', createReseller as any);
router.get('/resellers', listResellers as any);

// Plans & Features Management
router.get('/plans', listPlansAdmin as any);
router.post('/plans', createPlan as any);
router.put('/plans/:id', updatePlan as any);
router.delete('/plans/:id', deletePlan as any);
router.post('/plans/:planId/features', addPlanFeature as any);
router.post('/plans/features/:featureId/toggle', togglePlanFeature as any);
router.delete('/plans/features/:featureId', deletePlanFeature as any);

export default router;
