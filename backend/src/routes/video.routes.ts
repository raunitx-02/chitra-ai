import { Router } from 'express';
import { generateVideo, getVideos, generateScript } from '../controllers/video.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.post('/generate', protect as any, generateVideo as any);
router.post('/generate-script', protect as any, generateScript as any);
router.get('/', protect as any, getVideos as any);

export default router;
