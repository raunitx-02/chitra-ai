import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import axios from 'axios';
import prisma from '../config/db';
import { VideoStatus } from '@prisma/client';

const CREATIFY_API_ID = process.env.CREATIFY_API_ID || '';
const CREATIFY_API_KEY = process.env.CREATIFY_API_KEY || '';
const CREATIFY_BASE = 'https://api.creatify.ai/api';

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Upload base64 image to ImgBB → get public URL
// ──────────────────────────────────────────────────────────────────────────────
async function uploadToImgBB(base64: string): Promise<string> {
  const res = await axios.post(
    'https://api.imgbb.com/1/upload',
    new URLSearchParams({
      key: process.env.IMGBB_API_KEY || 'a4dc406e0a1def39a6fd18cda9ef6a64',
      image: base64,
      expiration: '0',
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 }
  );
  const url = res.data?.data?.url || res.data?.data?.display_url || '';
  if (!url) throw new Error('ImgBB upload failed — no URL returned');
  return url;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: List available Creatify avatars
// ──────────────────────────────────────────────────────────────────────────────
export async function getCreatifyAvatars(req: AuthenticatedRequest, res: Response) {
  if (!CREATIFY_API_ID || !CREATIFY_API_KEY) {
    return res.status(200).json({ avatars: [], configured: false });
  }
  try {
    const response = await axios.get(`${CREATIFY_BASE}/personas/`, {
      headers: { 'X-API-ID': CREATIFY_API_ID, 'X-API-KEY': CREATIFY_API_KEY },
      timeout: 15000,
    });
    return res.status(200).json({ avatars: response.data, configured: true });
  } catch (err: any) {
    return res.status(200).json({ avatars: [], configured: true, error: err.message });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/product/generate-ad
// Creates a full UGC product ad via Creatify AI
// Body: { imageBase64, mimeType, script, avatarId?, duration?, aspectRatio? }
// ──────────────────────────────────────────────────────────────────────────────
export async function generateProductAd(req: AuthenticatedRequest, res: Response) {
  const user = req.user;
  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  if (!CREATIFY_API_ID || !CREATIFY_API_KEY) {
    return res.status(400).json({
      message: 'Creatify API not configured.',
      needsSetup: true,
      setupUrl: 'https://app.creatify.ai/settings/api',
    });
  }

  const {
    imageBase64,
    mimeType = 'image/jpeg',
    script,
    avatarId,
    duration = 30,
    aspectRatio = '9:16',
    language = 'en',
    productName,
    visualPrompt,
  } = req.body;

  if (!imageBase64) return res.status(400).json({ message: 'Product image is required.' });
  if (!script) return res.status(400).json({ message: 'Ad script is required.' });

  // Check credits
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser || dbUser.creditsBalance < 20) {
    return res.status(400).json({ message: 'Insufficient credits.' });
  }

  console.log(`[Creatify] Starting product ad for user: ${user.id}`);

  try {
    // 1. Upload image to ImgBB
    console.log('[Creatify] Uploading product image...');
    const imageUrl = await uploadToImgBB(imageBase64);
    console.log('[Creatify] Image uploaded:', imageUrl);

    // 2. Create video record in DB as PENDING
    const video = await prisma.video.create({
      data: {
        userId: user.id,
        script: script,
        avatarId: avatarId || 'creatify_auto',
        voiceId: 'creatify',
        language,
        status: VideoStatus.PENDING,
      },
    });

    // 3. Deduct credits
    await prisma.user.update({
      where: { id: user.id },
      data: { creditsBalance: { decrement: 20 } },
    });

    // 4. Determine aspect ratio for Creatify
    // Creatify accepts: "9:16" | "16:9" | "1:1"
    const creatifyAspect = aspectRatio;

    // 5. Submit to Creatify API — product_to_videos endpoint
    // This endpoint takes product media + script + avatar → generates realistic ad
    const creatifyPayload: any = {
      visual_style: 'ugc',           // UGC style — avatar holding/using product
      script: script,
      aspect_ratio: creatifyAspect,
      language: language,
      media: [imageUrl],              // Product image — Creatify places avatar with product
      duration: duration,
    };

    if (avatarId && avatarId !== 'creatify_auto') {
      creatifyPayload.persona = avatarId;
    }

    if (visualPrompt) {
      creatifyPayload.video_description = visualPrompt;
    }

    console.log('[Creatify] Submitting to product_to_videos API...');
    const creatifyRes = await axios.post(
      `${CREATIFY_BASE}/product_to_videos/`,
      creatifyPayload,
      {
        headers: {
          'X-API-ID': CREATIFY_API_ID,
          'X-API-KEY': CREATIFY_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const jobId = creatifyRes.data?.id || creatifyRes.data?.job_id;
    console.log('[Creatify] Job created:', jobId);

    if (!jobId) {
      throw new Error('Creatify returned no job ID');
    }

    // 6. Update DB with external job ID
    await prisma.video.update({
      where: { id: video.id },
      data: {
        status: VideoStatus.PROCESSING,
        videoUrl: `creatify_job:${jobId}`, // store job ID temporarily for tracking

      },
    });

    // 7. Start async polling for result
    pollCreatifyJob(video.id, jobId);

    return res.status(200).json({
      message: 'Product ad generation started! Check your video library in a few minutes.',
      videoId: video.id,
      creatifyJobId: jobId,
    });

  } catch (err: any) {
    console.error('[Creatify] Error:', err.response?.data || err.message);
    
    // Refund credits on failure
    await prisma.user.update({
      where: { id: user.id },
      data: { creditsBalance: { increment: 20 } },
    });

    const detail = err.response?.data?.detail || err.response?.data?.message || err.message;
    return res.status(500).json({ message: `Product ad generation failed: ${detail}` });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Async polling: check Creatify job status until complete
// ──────────────────────────────────────────────────────────────────────────────
async function pollCreatifyJob(videoId: string, jobId: string) {
  const maxAttempts = 60; // ~10 minutes
  let attempts = 0;

  const poll = async () => {
    attempts++;
    try {
      console.log(`[Creatify Poll] Job ${jobId}, attempt ${attempts}`);
      const res = await axios.get(`${CREATIFY_BASE}/product_to_videos/${jobId}/`, {
        headers: { 'X-API-ID': CREATIFY_API_ID, 'X-API-KEY': CREATIFY_API_KEY },
        timeout: 15000,
      });

      const status = res.data?.status?.toLowerCase() || '';
      const videoUrl = res.data?.output || res.data?.video_url || res.data?.output_url || '';

      if (status === 'done' || status === 'completed' || status === 'finished') {
        console.log(`[Creatify Poll] Job ${jobId} COMPLETE. URL: ${videoUrl}`);
        await prisma.video.update({
          where: { id: videoId },
          data: {
            status: VideoStatus.COMPLETED,
            videoUrl: videoUrl,
          },
        });
        return;
      }

      if (status === 'failed' || status === 'error') {
        console.error(`[Creatify Poll] Job ${jobId} FAILED`);
        await prisma.video.update({
          where: { id: videoId },
          data: { status: VideoStatus.FAILED },
        });
        return;
      }

      // Still processing — retry after delay
      if (attempts < maxAttempts) {
        const delay = attempts < 10 ? 10000 : 15000; // 10s → 15s
        setTimeout(poll, delay);
      } else {
        console.error(`[Creatify Poll] Job ${jobId} timed out`);
        await prisma.video.update({
          where: { id: videoId },
          data: { status: VideoStatus.FAILED },
        });
      }
    } catch (err: any) {
      console.error(`[Creatify Poll] Error on attempt ${attempts}:`, err.message);
      if (attempts < maxAttempts) {
        setTimeout(poll, 15000);
      }
    }
  };

  setTimeout(poll, 15000); // Start after 15s
}
