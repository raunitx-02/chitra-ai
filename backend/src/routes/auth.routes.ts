import { Router } from 'express';
import {
  syncUser,
  getUserProfile,
  registerRequest,
  registerVerify,
  loginOtpRequest,
  loginOtpVerify,
  bindPhoneRequest,
  bindPhoneVerify,
  adminLogin
} from '../controllers/auth.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.post('/sync', protect as any, syncUser as any);
router.get('/profile', protect as any, getUserProfile as any);

// OTP Auth Routes
router.post('/register-request', registerRequest as any);
router.post('/register-verify', registerVerify as any);
router.post('/login-otp-request', loginOtpRequest as any);
router.post('/login-otp-verify', loginOtpVerify as any);

// Phone binding routes for social login
router.post('/bind-phone-request', protect as any, bindPhoneRequest as any);
router.post('/bind-phone-verify', protect as any, bindPhoneVerify as any);

// Admin bypass login
router.post('/admin-login', adminLogin as any);

export default router;
