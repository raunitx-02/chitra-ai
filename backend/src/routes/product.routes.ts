import { Router } from 'express';
import { analyzeProduct } from '../controllers/product.controller';
import { generateProductAd, getCreatifyAvatars } from '../controllers/creatify.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

// POST /api/product/analyze — AI analysis of product image (free, no key needed)
router.post('/analyze', protect as any, analyzeProduct as any);

// POST /api/product/generate-ad — Full UGC product ad via Creatify AI
router.post('/generate-ad', protect as any, generateProductAd as any);

// GET /api/product/creatify-avatars — List Creatify avatar personas
router.get('/creatify-avatars', protect as any, getCreatifyAvatars as any);

export default router;
