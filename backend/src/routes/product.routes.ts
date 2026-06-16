import { Router } from 'express';
import { analyzeProduct } from '../controllers/product.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

// POST /api/product/analyze — AI analysis of product image
router.post('/analyze', protect as any, analyzeProduct as any);

export default router;
