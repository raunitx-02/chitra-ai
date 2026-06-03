import { Router } from 'express';
import { createOrder, verifyPayment } from '../controllers/payment.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.post('/order', protect as any, createOrder as any);
router.post('/verify', protect as any, verifyPayment as any);

export default router;
