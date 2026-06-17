import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import prisma from '../config/db';
import axios from 'axios';
import { VideoStatus } from '@prisma/client';
import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY || '';

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Remove White Background using Jimp BFS Flood-Fill
// ──────────────────────────────────────────────────────────────────────────────
async function removeWhiteBackground(base64: string): Promise<string> {
  try {
    const buffer = Buffer.from(base64, 'base64');
    const image = await Jimp.read(buffer);
    const width = image.bitmap.width;
    const height = image.bitmap.height;

    // Start flood fill from the 4 corners
    const queue: [number, number][] = [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1]
    ];

    const visited = new Uint8Array(width * height);
    for (const [x, y] of queue) {
      visited[y * width + x] = 1;
    }

    const isNearWhite = (r: number, g: number, b: number) => {
      // Threshold: RGB values are all close to white (e.g. > 230)
      return r > 230 && g > 230 && b > 230;
    };

    while (queue.length > 0) {
      const curr = queue.shift();
      if (!curr) continue;
      const [cx, cy] = curr;

      const colorIdx = (cy * width + cx) * 4;
      const r = image.bitmap.data[colorIdx];
      const g = image.bitmap.data[colorIdx + 1];
      const b = image.bitmap.data[colorIdx + 2];
      const a = image.bitmap.data[colorIdx + 3];

      if (a === 0 || isNearWhite(r, g, b)) {
        // Make transparent
        image.bitmap.data[colorIdx + 3] = 0;

        const neighbors = [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1]
        ];

        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const idx = ny * width + nx;
            if (visited[idx] === 0) {
              visited[idx] = 1;
              queue.push([nx, ny]);
            }
          }
        }
      }
    }

    const outBuffer = await image.getBuffer('image/png');
    return outBuffer.toString('base64');
  } catch (err: any) {
    console.error('[Background Removal] Jimp processing failed:', err.message);
    return base64;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Save Base64 to local uploads folder and return public URL
// ──────────────────────────────────────────────────────────────────────────────
function saveBase64Image(base64Data: string, filename: string): string {
  const uploadsDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const filePath = path.join(uploadsDir, filename);
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(filePath, buffer);

  const backendBaseUrl = process.env.BACKEND_PUBLIC_URL || 'https://ugc.retailstacker.com/api';
  return `${backendBaseUrl}/uploads/${filename}`;
}

// In-memory caching for HeyGen assets
let cachedAvatars: any = null;
let cachedAvatarsTime = 0;
let cachedVoices: any = null;
let cachedVoicesTime = 0;
const CACHE_TTL = 30 * 60 * 1000; // Cache for 30 minutes

// Curated styles list matching HeyGen's style categories
const CURATED_STYLES = [
  { id: 'retro_tech_1', name: 'Strategy Drop', category: 'Retro Tech', preview: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&h=225&fit=crop&auto=format', heygen_template: null },
  { id: 'cinematic_1', name: 'Podcast Studio', category: 'Cinematic', preview: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=400&h=225&fit=crop&auto=format', heygen_template: null },
  { id: 'pop_culture_1', name: 'Product Focus', category: 'Pop Culture', preview: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=225&fit=crop&auto=format', heygen_template: null },
  { id: 'print_1', name: 'Bold Red', category: 'Print', preview: 'https://images.unsplash.com/photo-1542744094-24638eff58bb?w=400&h=225&fit=crop&auto=format', heygen_template: null },
  { id: 'handmade_1', name: 'Paper Cutout', category: 'Handmade', preview: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=225&fit=crop&auto=format', heygen_template: null },
  { id: 'iconic_artist_1', name: 'Grunge Title', category: 'Iconic Artist', preview: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=225&fit=crop&auto=format', heygen_template: null },
  { id: 'ugc_1', name: 'Product Monster', category: 'Pop Culture', preview: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=400&h=225&fit=crop&auto=format', heygen_template: null },
  { id: 'print_2', name: 'Minimal White', category: 'Print', preview: 'https://images.unsplash.com/photo-1611532736573-418036a57fbe?w=400&h=225&fit=crop&auto=format', heygen_template: null },
  { id: 'cinematic_2', name: 'UGC Creator', category: 'Cinematic', preview: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&h=225&fit=crop&auto=format', heygen_template: null },
  { id: 'print_3', name: 'The End Card', category: 'Print', preview: 'https://images.unsplash.com/photo-1519810755548-39cd217da494?w=400&h=225&fit=crop&auto=format', heygen_template: null },
  { id: 'retro_tech_2', name: 'Tech Minimal', category: 'Retro Tech', preview: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=400&h=225&fit=crop&auto=format', heygen_template: null },
  { id: 'handmade_2', name: 'Question Mark', category: 'Handmade', preview: 'https://images.unsplash.com/photo-1516117172878-fd2c41f4a759?w=400&h=225&fit=crop&auto=format', heygen_template: null },
  { id: 'iconic_artist_2', name: 'Smiley Face', category: 'Iconic Artist', preview: 'https://images.unsplash.com/photo-1531747056595-07f6a15a2b7c?w=400&h=225&fit=crop&auto=format', heygen_template: null },
  { id: 'pop_culture_2', name: 'Street Style', category: 'Pop Culture', preview: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=225&fit=crop&auto=format', heygen_template: null },
  { id: 'cinematic_3', name: 'The Problem', category: 'Cinematic', preview: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=225&fit=crop&auto=format', heygen_template: null },
  { id: 'retro_tech_3', name: 'Neon Grid', category: 'Retro Tech', preview: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=225&fit=crop&auto=format', heygen_template: null },
];

// Helper to compute width/height from orientation and resolution tier
function getDimensions(orientation: string, resolution: string): { width: number; height: number } {
  if (orientation === 'landscape') {
    if (resolution === '4k') return { width: 3840, height: 2160 };
    if (resolution === '1080p') return { width: 1920, height: 1080 };
    return { width: 1280, height: 720 };
  } else if (orientation === 'square') {
    if (resolution === '4k') return { width: 2160, height: 2160 };
    if (resolution === '1080p') return { width: 1080, height: 1080 };
    return { width: 720, height: 720 };
  } else {
    // portrait (default)
    if (resolution === '4k') return { width: 2160, height: 3840 };
    if (resolution === '1080p') return { width: 1080, height: 1920 };
    return { width: 720, height: 1280 };
  }
}

// Helper to get video resolution based on plan purchases
async function getUserVideoResolution(userId: string): Promise<string> {
  const lastTx = await prisma.transaction.findFirst({
    where: {
      userId,
      status: 'SUCCESS'
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  if (!lastTx) {
    return '720p'; // Default to SD for trial users
  }

  // Basic -> ₹1999 (SD -> 720p)
  // Pro -> ₹4999 (HD -> 1080p)
  // Business -> ₹9999 (4K -> 4k)
  if (lastTx.amount >= 9999) {
    return '4k';
  } else if (lastTx.amount >= 4999) {
    return '1080p';
  } else {
    return '720p';
  }
}

// 1. Generate Video: POST /api/videos/generate
export async function generateVideo(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const {
      script,
      avatarId,
      voiceId,
      language,
      visualPrompt,
      duration,           // '15' | '30' | '60' | 'auto'
      orientation,        // 'portrait' | 'landscape' | 'square'
      style,              // style id string
      mode,               // 'avatar' | 'product'
      productImageBase64, // base64 encoded product image
      productImageMime,   // mime type e.g. 'image/jpeg'
      hookText,
      bRollUrl,
    } = req.body;

    // Validate required fields based on mode
    if (mode === 'product') {
      if (!productImageBase64) {
        return res.status(400).json({ message: 'Product image is required for Product Ad mode.' });
      }
      if (!script) {
        return res.status(400).json({ message: 'Ad script/description is required.' });
      }
    } else {
      if (!script || !avatarId || !voiceId) {
        return res.status(400).json({ message: 'Script, avatarId, and voiceId are required.' });
      }
    }

    // Check credits balance (costs 20 credits)
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser || dbUser.creditsBalance < 20) {
      return res.status(400).json({ message: 'Insufficient credits. Please top up your account.' });
    }

    // Determine orientation and duration
    const orientationVal = orientation || 'portrait';
    const durationVal = parseInt(duration) || 0; // 0 = auto

    // Step 1: Create a PENDING Video record
    const serializedScript = mode === 'product' && req.body.productAnalysis
      ? `${script}||METADATA||${JSON.stringify(req.body.productAnalysis)}`
      : script;

    const video = await prisma.video.create({
      data: {
        userId: user.id,
        script: serializedScript || 'product_ad',
        avatarId: avatarId || 'product_mode',
        voiceId: voiceId || 'none',
        language: language || 'English',
        status: VideoStatus.PENDING,
        hookText: hookText || null,
        bRollUrl: bRollUrl || null,
      },
    });

    // Step 2: Deduct credits
    await prisma.user.update({
      where: { id: user.id },
      data: { creditsBalance: { decrement: 20 } },
    });

    // Step 3: Determine dimension/resolution based on user plan and orientation
    const resolution = await getUserVideoResolution(user.id);
    const { width, height } = getDimensions(orientationVal, resolution);

    console.log(`[HeyGen Render] User: ${user.id} | Mode: ${mode || 'avatar'} | Resolution: ${resolution} | Dimensions: ${width}x${height} | Duration: ${durationVal || 'auto'}s`);

    // Step 4: Trigger HeyGen API
    if (HEYGEN_API_KEY) {
      try {
        let characterInput: any;


        if (mode === 'product') {
          console.log('[Product Mode] Processing image with background removal...');
          let productPublicUrl = '';
          try {
            // Remove background locally using Jimp BFS
            const transparentBase64 = await removeWhiteBackground(productImageBase64);
            // Save locally to public static directory
            const filename = `${video.id}_product.png`;
            productPublicUrl = saveBase64Image(transparentBase64, filename);
            console.log(`[Product Mode] Transparent product image saved: ${productPublicUrl}`);
          } catch (procErr: any) {
            console.error('[Product Mode] Local image processing failed:', procErr.message);
            // Fallback: save original image locally
            const filename = `${video.id}_product_orig.png`;
            productPublicUrl = saveBase64Image(productImageBase64, filename);
          }

          // Use selected avatar or default
          characterInput = {
            type: 'avatar',
            avatar_id: avatarId || 'Daisy-inskirt-20220818',
            avatar_style: 'normal',
          };

          // Save product URL to database for Creatomate overlay (do NOT set as HeyGen background)
          if (productPublicUrl) {
            await prisma.video.update({
              where: { id: video.id },
              data: { bRollUrl: productPublicUrl },
            });
          }

        } else {
          characterInput = {
            type: 'avatar',
            avatar_id: avatarId,
            avatar_style: 'normal',
          };
        }

        const sceneInput: any = {
          character: characterInput,
          voice: voiceId && voiceId !== 'none' ? {
            type: 'text',
            input_text: script,
            voice_id: voiceId,
          } : {
            type: 'silence',
          },
        };

        // Apply background: product image for product mode, AI-generated for visual prompt
        const productBgUrl = (req as any)._productBgUrl;
        if (productBgUrl) {
          // Product mode: use uploaded product image as video background
          sceneInput.background = {
            type: 'image',
            url: productBgUrl,
          };
          console.log(`[HeyGen Render] Applied Product Image as Background: ${productBgUrl}`);
        } else if (visualPrompt && visualPrompt.trim().length > 0) {
          const bgPrompt = `${visualPrompt.trim()}, blurred background, photorealistic portrait studio setting, soft bokeh, high resolution`;
          const generatedBgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(bgPrompt)}?width=${width}&height=${height}&nologo=true`;
          sceneInput.background = {
            type: 'image',
            url: generatedBgUrl,
          };
          console.log(`[HeyGen Render] Applied AI Background: ${generatedBgUrl}`);
        }


        // Build the request payload
        const payload: any = {
          video_inputs: [sceneInput],
          dimension: { width, height },
        };

        // Apply duration if not auto
        if (durationVal > 0) {
          payload.duration = durationVal;
        }

        const response = await axios.post(
          'https://api.heygen.com/v2/video/generate',
          payload,
          {
            headers: {
              'x-api-key': HEYGEN_API_KEY,
              'Content-Type': 'application/json',
            },
          }
        );

        const heygenVideoId = response.data?.data?.video_id;

        if (!heygenVideoId) {
          throw new Error('HeyGen did not return a video_id. Response: ' + JSON.stringify(response.data));
        }

        console.log(`[HeyGen Render] Job submitted successfully. HeyGen Video ID: ${heygenVideoId}`);

        // Update video record to PROCESSING
        await prisma.video.update({
          where: { id: video.id },
          data: {
            status: VideoStatus.PROCESSING,
            videoUrl: heygenVideoId,
          },
        });

        // Start background polling
        pollHeyGenStatus(video.id, heygenVideoId);

      } catch (heygenErr: any) {
        console.error('[HeyGen API Error]:', heygenErr.response?.data || heygenErr.message);
        // Refund credits on API failure
        await prisma.$transaction([
          prisma.user.update({
            where: { id: user.id },
            data: { creditsBalance: { increment: 20 } },
          }),
          prisma.video.update({
            where: { id: video.id },
            data: { status: VideoStatus.FAILED },
          }),
        ]);
        return res.status(502).json({ 
          message: 'AI video generation API failed. Credits refunded.',
          detail: heygenErr.response?.data?.message || heygenErr.message,
        });
      }
    } else {
      // Mock processing for sandbox environments
      console.log(`[Mock Generation] Starting video render for: "${(script || '').slice(0, 30)}..."`);

      await prisma.video.update({
        where: { id: video.id },
        data: { status: VideoStatus.PROCESSING },
      });

      // Simulate completion in 10 seconds
      setTimeout(async () => {
        try {
          const mockVideos = [
            'https://res.cloudinary.com/demo/video/upload/dog.mp4',
            'https://res.cloudinary.com/demo/video/upload/elephants.mp4'
          ];
          const mockThumbnails = [
            'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop'
          ];
          const randIdx = Math.floor(Math.random() * mockVideos.length);

          await prisma.video.update({
            where: { id: video.id },
            data: {
              status: VideoStatus.COMPLETED,
              videoUrl: mockVideos[randIdx],
              thumbnailUrl: mockThumbnails[randIdx],
            },
          });
          console.log(`[Mock Generation] Video ${video.id} completed successfully.`);
        } catch (err) {
          console.error('Error completing mock video:', err);
        }
      }, 10000);
    }

    return res.status(202).json({
      message: 'Video rendering task initiated successfully.',
      videoId: video.id,
      creditsBalance: dbUser.creditsBalance - 20,
    });
  } catch (error: any) {
    console.error('Error initiating generation:', error);
    return res.status(500).json({ message: error.message || 'Error processing request' });
  }
}

// Helper to poll HeyGen API in background (lasts up to 3 hours to cover long renders)
async function pollHeyGenStatus(dbVideoId: string, heygenVideoId: string) {
  const maxAttempts = 540; // 540 * 20 seconds = 3 hours
  let attempts = 0;

  console.log(`[HeyGen Polling] Starting status polling for Video: ${dbVideoId}, Job: ${heygenVideoId}`);

  const interval = setInterval(async () => {
    attempts++;
    if (attempts > maxAttempts) {
      console.log(`[HeyGen Polling] Polling timed out (3 hours limit) for Video: ${dbVideoId}`);
      clearInterval(interval);
      await prisma.video.update({
        where: { id: dbVideoId },
        data: {
          status: VideoStatus.FAILED,
          videoUrl: null,
        },
      });
      return;
    }

    try {
      const response = await axios.get(
        `https://api.heygen.com/v1/video_status.get?video_id=${heygenVideoId}`,
        {
          headers: {
            'x-api-key': HEYGEN_API_KEY,
          },
        }
      );

      const data = response.data?.data;
      const status = data?.status;
      console.log(`[HeyGen Polling] Video: ${dbVideoId}, Attempt: ${attempts}/${maxAttempts}, Status: ${status}`);

      if (status === 'completed') {
        clearInterval(interval);
        const videoUrl = data?.video_url;
        const thumbnailUrl = data?.thumbnail_url;

        console.log(`[HeyGen Polling] Video completed! URL: ${videoUrl}`);

        const videoRecord = await prisma.video.findUnique({ where: { id: dbVideoId } });
        const CREATOMATE_API_KEY = process.env.CREATOMATE_API_KEY || '';
        if (videoRecord && (videoRecord.hookText || videoRecord.bRollUrl) && CREATOMATE_API_KEY) {
          triggerCreatomateRender(dbVideoId, videoUrl);
        } else {
          await prisma.video.update({
            where: { id: dbVideoId },
            data: {
              status: VideoStatus.COMPLETED,
              videoUrl,
              thumbnailUrl,
            },
          });
        }
      } else if (status === 'failed') {
        console.log(`[HeyGen Polling] Video failed on HeyGen side.`);
        clearInterval(interval);
        await prisma.video.update({
          where: { id: dbVideoId },
          data: {
            status: VideoStatus.FAILED,
            videoUrl: null,
          },
        });
      }
    } catch (err: any) {
      console.error('Error polling HeyGen status:', err.response?.data || err.message);
    }
  }, 20000); // poll every 20 seconds
}

// Creatomate Video Composition Helper
async function triggerCreatomateRender(dbVideoId: string, baseVideoUrl: string) {
  const CREATOMATE_API_KEY = process.env.CREATOMATE_API_KEY || '';
  if (!CREATOMATE_API_KEY) {
    console.error('[Creatomate] API Key not configured.');
    return;
  }

  try {
    const video = await prisma.video.findUnique({ where: { id: dbVideoId } });
    if (!video) return;

    // Parse product analysis metadata if present
    let productAnalysis: any = null;
    let cleanScript = video.script;
    if (video.script.includes('||METADATA||')) {
      const parts = video.script.split('||METADATA||');
      cleanScript = parts[0];
      try {
        productAnalysis = JSON.parse(parts[1]);
      } catch (e) {
        console.error('[Creatomate] Failed to parse product analysis:', e);
      }
    }

    console.log(`[Creatomate] Starting render composition for Video: ${dbVideoId}`);

    const elements: any[] = [
      // 1. Base Video layer (HeyGen video)
      {
        name: "Main-Video",
        type: "video",
        source: baseVideoUrl,
        width: "100%",
        height: "100%",
        x: "50%",
        y: "50%",
        track: 1,
      }
    ];

    // 2. Persistent Black Header Shape (if hookText is provided)
    if (video.hookText) {
      elements.push(
        {
          type: "shape",
          path: "M 0% 0% L 100% 0% L 100% 100% L 0% 100% Z",
          fill_color: "#000000",
          width: "100%",
          height: "120px",
          x: "50%",
          y: "60px",
          track: 2,
        },
        {
          type: "text",
          text: video.hookText,
          font_family: "Montserrat",
          font_weight: "800",
          fill_color: "#ffffff",
          font_size: "24px",
          x: "50%",
          y: "60px",
          width: "90%",
          height: "100px",
          x_alignment: "center",
          y_alignment: "center",
          track: 3,
        }
      );
    }

    // 3. Captions (auto-transcribed captions from the audio)
    elements.push({
      type: "text",
      transcript_source: "Main-Video",
      transcript_effect: "highlight",
      fill_color: "#ffffff",
      font_family: "Montserrat",
      font_weight: "700",
      font_size: "26px",
      x: "50%",
      y: "80%",
      width: "85%",
      x_alignment: "center",
      y_alignment: "center",
      background_color: "rgba(0, 80, 180, 0.7)", // Transparent blue background box
      background_padding: "8px 14px",
      track: 4,
    });

    // 4. B-Roll Overlay / Product Image (if product bRollUrl is provided)
    if (video.bRollUrl && video.bRollUrl.startsWith('http')) {
      const isVideo = video.bRollUrl.includes('.mp4');
      if (isVideo) {
        elements.push({
          type: "video",
          source: video.bRollUrl,
          track: 5,
          time: 5,
          duration: 6,
          width: "100%",
          height: "100%",
          x: "50%",
          y: "50%",
          fit: "cover",
        });
      } else if (productAnalysis) {
        // PREMIUM DYNAMIC MULTI-STAGE PRODUCT AD
        const pName = productAnalysis.productName || 'Our Product';
        const tagline = productAnalysis.tagline || '';
        const features = productAnalysis.keyFeatures || [];

        // ────────── STAGE 1: Beautiful Branding Intro (0s to 4.5s) ──────────
        elements.push({
          type: "shape",
          fill_color: "rgba(10, 30, 20, 0.95)", // dark green elegant backing
          width: "100%",
          height: "100%",
          x: "50%",
          y: "50%",
          track: 5,
          time: 0,
          duration: 4.5,
          animations: [
            {
              type: "fade-out",
              duration: 0.5,
            }
          ]
        });

        // "INTRODUCING..." Text
        elements.push({
          type: "text",
          text: "INTRODUCING...",
          font_family: "Montserrat",
          font_weight: "700",
          fill_color: "rgba(255, 255, 255, 0.6)",
          font_size: "16px",
          x: "30%",
          y: "32%",
          width: "50%",
          x_alignment: "left",
          track: 6,
          time: 0.5,
          duration: 3.5,
          animations: [
            {
              type: "fade-in",
              duration: 0.5,
            }
          ]
        });

        // Product Title
        elements.push({
          type: "text",
          text: pName.toUpperCase(),
          font_family: "Montserrat",
          font_weight: "800",
          fill_color: "#10b981", // bright emerald green
          font_size: "30px",
          x: "30%",
          y: "42%",
          width: "50%",
          x_alignment: "left",
          track: 7,
          time: 0.8,
          duration: 3.2,
          animations: [
            {
              type: "slide-in",
              direction: "left",
              duration: 0.8,
            }
          ]
        });

        // Tagline
        elements.push({
          type: "text",
          text: tagline,
          font_family: "Montserrat",
          font_style: "italic",
          fill_color: "#ffffff",
          font_size: "16px",
          x: "30%",
          y: "52%",
          width: "50%",
          x_alignment: "left",
          track: 8,
          time: 1.1,
          duration: 2.9,
          animations: [
            {
              type: "fade-in",
              duration: 0.5,
            }
          ]
        });

        // Intro Product Image
        elements.push({
          type: "image",
          source: video.bRollUrl,
          track: 9,
          time: 0.6,
          duration: 3.4,
          width: "42%",
          height: "42%",
          x: "72%",
          y: "45%",
          fit: "contain",
          animations: [
            {
              type: "scale-in",
              duration: 0.8,
              easing: "cubic-out",
            }
          ]
        });

        // ────────── STAGE 2: Features Showcase (4.5s to 14.5s) ──────────
        // Floating smaller product image
        elements.push({
          type: "image",
          source: video.bRollUrl,
          track: 10,
          time: 4.5,
          duration: 10.0,
          width: "35%",
          height: "35%",
          x: "76%",
          y: "42%",
          fit: "contain",
          animations: [
            {
              type: "slide-in",
              direction: "right",
              duration: 0.8,
              easing: "cubic-out",
            },
            {
              type: "shake",
              duration: 5.0,
              loop: true,
              easing: "linear",
            }
          ]
        });

        // Features backdrop card
        elements.push({
          type: "shape",
          fill_color: "rgba(0, 0, 0, 0.75)",
          width: "46%",
          height: "42%",
          x: "28%",
          y: "42%",
          border_radius: "16px",
          track: 11,
          time: 4.5,
          duration: 10.0,
          animations: [
            {
              type: "slide-in",
              direction: "left",
              duration: 0.8,
            }
          ]
        });

        // Features header text
        elements.push({
          type: "text",
          text: "KEY FEATURES",
          font_family: "Montserrat",
          font_weight: "800",
          fill_color: "#10b981",
          font_size: "16px",
          x: "28%",
          y: "27%",
          width: "40%",
          x_alignment: "center",
          track: 12,
          time: 4.8,
          duration: 9.7,
          animations: [{ type: "fade-in", duration: 0.4 }]
        });

        // Feature line 1
        if (features[0]) {
          elements.push({
            type: "text",
            text: `✓  ${features[0]}`,
            font_family: "Montserrat",
            font_weight: "600",
            fill_color: "#ffffff",
            font_size: "13px",
            x: "28%",
            y: "35%",
            width: "40%",
            x_alignment: "left",
            track: 13,
            time: 5.2,
            duration: 9.3,
            animations: [{ type: "fade-in", duration: 0.4 }]
          });
        }

        // Feature line 2
        if (features[1]) {
          elements.push({
            type: "text",
            text: `✓  ${features[1]}`,
            font_family: "Montserrat",
            font_weight: "600",
            fill_color: "#ffffff",
            font_size: "13px",
            x: "28%",
            y: "43%",
            width: "40%",
            x_alignment: "left",
            track: 14,
            time: 5.6,
            duration: 8.9,
            animations: [{ type: "fade-in", duration: 0.4 }]
          });
        }

        // Feature line 3
        if (features[2]) {
          elements.push({
            type: "text",
            text: `✓  ${features[2]}`,
            font_family: "Montserrat",
            font_weight: "600",
            fill_color: "#ffffff",
            font_size: "13px",
            x: "28%",
            y: "51%",
            width: "40%",
            x_alignment: "left",
            track: 15,
            time: 6.0,
            duration: 8.5,
            animations: [{ type: "fade-in", duration: 0.4 }]
          });
        }

        // ────────── STAGE 3: Call-To-Action (14.5s to end) ──────────
        // Floating product image at top of CTA
        elements.push({
          type: "image",
          source: video.bRollUrl,
          track: 16,
          time: 14.5,
          duration: 20.0,
          width: "32%",
          height: "32%",
          x: "50%",
          y: "28%",
          fit: "contain",
          animations: [
            {
              type: "scale-in",
              duration: 0.8,
            },
            {
              type: "shake",
              duration: 8.0,
              loop: true,
            }
          ]
        });

        // Tagline text
        elements.push({
          type: "text",
          text: tagline.toUpperCase(),
          font_family: "Montserrat",
          font_weight: "800",
          fill_color: "#ffffff",
          font_size: "18px",
          x: "50%",
          y: "45%",
          width: "80%",
          x_alignment: "center",
          track: 17,
          time: 14.8,
          duration: 19.7,
          animations: [{ type: "fade-in", duration: 0.5 }]
        });

        // Rounded green button
        elements.push({
          type: "shape",
          fill_color: "#10b981",
          width: "60%",
          height: "70px",
          x: "50%",
          y: "54%",
          border_radius: "35px",
          track: 18,
          time: 15.0,
          duration: 19.5,
          animations: [
            {
              type: "scale-in",
              duration: 0.6,
            },
            {
              type: "pulse",
              duration: 2.0,
              loop: true,
            }
          ]
        });

        // SHOP NOW button text
        elements.push({
          type: "text",
          text: "SHOP NOW",
          font_family: "Montserrat",
          font_weight: "800",
          fill_color: "#ffffff",
          font_size: "18px",
          x: "50%",
          y: "54%",
          width: "50%",
          x_alignment: "center",
          y_alignment: "center",
          track: 19,
          time: 15.0,
          duration: 19.5,
        });

        // Link in bio text
        elements.push({
          type: "text",
          text: "👉 LINK IN BIO 👈",
          font_family: "Montserrat",
          font_weight: "700",
          fill_color: "#fbbf24",
          font_size: "14px",
          x: "50%",
          y: "61%",
          width: "50%",
          x_alignment: "center",
          track: 20,
          time: 15.3,
          duration: 19.2,
          animations: [{ type: "fade-in", duration: 0.5 }]
        });

      } else {
        elements.push({
          type: "image",
          source: video.bRollUrl,
          track: 5,
          time: 3,
          duration: 25,
          width: "45%",
          height: "45%",
          x: "75%",
          y: "45%",
          fit: "contain",
          animations: [
            {
              type: "slide-in",
              direction: "right",
              duration: 1.0,
              easing: "cubic-out",
            },
            {
              type: "shake",
              duration: 8.0,
              loop: true,
              easing: "linear",
            },
          ],
        });
      }
    }

    const payload = {
      output_format: "mp4",
      width: 720,
      height: 1280,
      elements: elements,
    };

    console.log('[Creatomate] Dispatching render request...');
    const response = await axios.post(
      'https://api.creatomate.com/v2/renders',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${CREATOMATE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const renderId = response.data?.id || response.data?.render_id;
    if (!renderId) {
      throw new Error('Creatomate did not return a render ID');
    }

    console.log(`[Creatomate] Render started: ${renderId}`);

    // Update tracking URL to point to Creatomate render job
    await prisma.video.update({
      where: { id: dbVideoId },
      data: {
        videoUrl: `creatomate:${renderId}`,
        status: VideoStatus.PROCESSING,
      },
    });

    // Start polling Creatomate status
    pollCreatomateStatus(dbVideoId, renderId);

  } catch (err: any) {
    console.error('[Creatomate Error]:', err.response?.data || err.message);
    // On failure, fall back to showing the original HeyGen video so the user still gets a video!
    await prisma.video.update({
      where: { id: dbVideoId },
      data: {
        status: VideoStatus.COMPLETED,
        videoUrl: baseVideoUrl,
      },
    });
  }
}

async function pollCreatomateStatus(dbVideoId: string, renderId: string) {
  const maxAttempts = 60; // 5 minutes
  let attempts = 0;
  const CREATOMATE_API_KEY = process.env.CREATOMATE_API_KEY || '';

  console.log(`[Creatomate Polling] Starting status polling for Video: ${dbVideoId}, Job: ${renderId}`);

  const interval = setInterval(async () => {
    attempts++;
    if (attempts > maxAttempts) {
      console.log(`[Creatomate Polling] Polling timed out for Video: ${dbVideoId}`);
      clearInterval(interval);
      await prisma.video.update({
        where: { id: dbVideoId },
        data: { status: VideoStatus.FAILED },
      });
      return;
    }

    try {
      const response = await axios.get(
        `https://api.creatomate.com/v2/renders/${renderId}`,
        {
          headers: {
            'Authorization': `Bearer ${CREATOMATE_API_KEY}`,
          },
        }
      );

      const status = response.data?.status?.toLowerCase();
      const videoUrl = response.data?.url;
      const thumbnailUrl = response.data?.snapshot_url;

      console.log(`[Creatomate Polling] Video: ${dbVideoId}, Attempt: ${attempts}/${maxAttempts}, Status: ${status}`);

      if (status === 'succeeded' || status === 'completed') {
        clearInterval(interval);
        console.log(`[Creatomate Polling] Video completed! URL: ${videoUrl}`);

        await prisma.video.update({
          where: { id: dbVideoId },
          data: {
            status: VideoStatus.COMPLETED,
            videoUrl,
            thumbnailUrl: thumbnailUrl || undefined,
          },
        });
      } else if (status === 'failed') {
        console.log(`[Creatomate Polling] Video failed on Creatomate side.`);
        clearInterval(interval);
        await prisma.video.update({
          where: { id: dbVideoId },
          data: { status: VideoStatus.FAILED },
        });
      }
    } catch (err: any) {
      console.error('Error polling Creatomate status:', err.response?.data || err.message);
    }
  }, 10000); // poll every 10 seconds
}

// 2. Fetch User Videos: GET /api/videos (Syncs processing state on-the-fly)
export async function getVideos(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    let videos = await prisma.video.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    // On-the-fly status sync for processing videos
    const processingVideos = videos.filter(v => v.status === VideoStatus.PROCESSING);
    if (processingVideos.length > 0) {
      let updatedAny = false;
      const CREATOMATE_API_KEY = process.env.CREATOMATE_API_KEY || '';
      for (const video of processingVideos) {
        if (video.videoUrl) {
          if (video.videoUrl.startsWith('creatomate:')) {
            const renderId = video.videoUrl.replace('creatomate:', '');
            if (CREATOMATE_API_KEY) {
              try {
                const response = await axios.get(
                  `https://api.creatomate.com/v2/renders/${renderId}`,
                  {
                    headers: { 'Authorization': `Bearer ${CREATOMATE_API_KEY}` }
                  }
                );
                const status = response.data?.status?.toLowerCase();
                if (status === 'succeeded' || status === 'completed') {
                  await prisma.video.update({
                    where: { id: video.id },
                    data: {
                      status: VideoStatus.COMPLETED,
                      videoUrl: response.data?.url,
                      thumbnailUrl: response.data?.snapshot_url || undefined,
                    },
                  });
                  updatedAny = true;
                } else if (status === 'failed') {
                  await prisma.video.update({
                    where: { id: video.id },
                    data: { status: VideoStatus.FAILED },
                  });
                  updatedAny = true;
                }
              } catch (err: any) {
                console.error(`[On-The-Fly Sync Creatomate Error] Video: ${video.id}`, err.message);
              }
            }
          } else if (!video.videoUrl.startsWith('http') && HEYGEN_API_KEY) {
            try {
              const response = await axios.get(
                `https://api.heygen.com/v1/video_status.get?video_id=${video.videoUrl}`,
                {
                  headers: {
                    'x-api-key': HEYGEN_API_KEY,
                  },
                }
              );

              const data = response.data?.data;
              const status = data?.status;
              if (status === 'completed') {
                const liveUrl = data?.video_url;
                const liveThumb = data?.thumbnail_url;
                const videoRecord = await prisma.video.findUnique({ where: { id: video.id } });
                if (videoRecord && (videoRecord.hookText || videoRecord.bRollUrl) && CREATOMATE_API_KEY) {
                  triggerCreatomateRender(video.id, liveUrl);
                } else {
                  await prisma.video.update({
                    where: { id: video.id },
                    data: {
                      status: VideoStatus.COMPLETED,
                      videoUrl: liveUrl,
                      thumbnailUrl: liveThumb,
                    },
                  });
                }
                updatedAny = true;
                console.log(`[On-The-Fly Sync] Video ${video.id} updated to COMPLETED/Creatomate.`);
              } else if (status === 'failed') {
                await prisma.video.update({
                  where: { id: video.id },
                  data: {
                    status: VideoStatus.FAILED,
                    videoUrl: null,
                  },
                });
                updatedAny = true;
                console.log(`[On-The-Fly Sync] Video ${video.id} updated to FAILED.`);
              }
            } catch (err) {
              console.error(`[On-The-Fly Sync Error] Video: ${video.id}`, err);
            }
          }
        }
      }

      if (updatedAny) {
        videos = await prisma.video.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
        });
      }
    }

    const cleanedVideos = videos.map(v => {
      if (v.script.includes('||METADATA||')) {
        return {
          ...v,
          script: v.script.split('||METADATA||')[0]
        };
      }
      return v;
    });

    return res.status(200).json({ videos: cleanedVideos });
  } catch (error) {
    return res.status(500).json({ message: 'Error retrieving videos' });
  }
}

// Public endpoint for viewing shared videos
export async function getPublicVideo(req: any, res: Response) {
  try {
    const { id } = req.params;
    const video = await prisma.video.findUnique({
      where: { id },
      select: {
        id: true,
        script: true,
        videoUrl: true,
        thumbnailUrl: true,
        status: true,
        createdAt: true,
      }
    });

    if (!video) {
      return res.status(404).json({ message: 'Video not found.' });
    }

    if (video.script.includes('||METADATA||')) {
      video.script = video.script.split('||METADATA||')[0];
    }

    return res.status(200).json({ video });
  } catch (err: any) {
    return res.status(500).json({ message: err.message || 'Error fetching shared video.' });
  }
}

// 3. AI Script Generator: POST /api/videos/generate-script
export async function generateScript(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { productName, description, targetAudience, language } = req.body;
    if (!productName || !description) {
      return res.status(400).json({ message: 'Product name and description are required.' });
    }

    const audience = targetAudience || 'general consumers';
    const lang = language || 'English';

    let script = '';

    if (lang.includes('Hindi')) {
      script = `हे दोस्तों! क्या आप जानते हैं कि ${productName} आपके जीवन को कितना आसान बना सकता है? अगर आप ${description} से परेशान हैं, तो आज ही इसे आज़माएं। यह विशेष रूप से हमारे ${audience} के लिए बनाया गया है। अभी नीचे दिए गए बटन पर क्लिक करें और 50% की छूट का लाभ उठाएं!`;
    } else if (lang.includes('Tamil')) {
      script = `வணக்கம் நண்பர்களே! ${productName} உங்களை எப்படி மாற்றப்போகிறது என்று தெரியுமா? ${description} காரணமாக நீங்கள் கவலைப்படுகிறீர்களா? கவலை வேண்டாம்! இதோ உங்களுக்கான தீர்வு. எங்கள் ${audience}-க்காகவே இது பிரத்யேகமாக தயாரிப்பு செய்யப்பட்டுள்ளது. உடனே கீழே உள்ள லிங்கை கிளிக் செய்து ஆர்டர் செய்யுங்கள்!`;
    } else if (lang.includes('Telugu')) {
      script = `నమస్కారం! ${productName} మీ జీవితాన్ని ఎంత సులభతరం చేస్తుందో మీకు తెలుసా? ${description} తో మీరు ఇబ్బంది పడుతున్నారా? అయితే ఇది మీ కోసమే! మా ${audience} కోసం ప్రత్యేకంగా డిజైన్ చేయబడింది. ఇప్పుడే కింద ఉన్న లింక్‌ని క్లిక్ చేయండి మరియు ప్రత్యేక ఆఫర్‌ని పొందండి!`;
    } else {
      script = `Hey guys! Are you tired of dealing with ${description}? That's exactly why we created ${productName}. Designed specifically for ${audience}, it solves your biggest pain points instantly. Don't wait—click the link below to grab yours today and get an exclusive 30% discount!`;
    }

    return res.status(200).json({ script });
  } catch (error: any) {
    console.error('Error generating script:', error);
    return res.status(500).json({ message: error.message || 'Error generating script.' });
  }
}

// Helper to guess gender from avatar name if not provided (common in V3)
function guessGender(name: string): string {
  const lower = (name || '').toLowerCase();
  const maleNames = ['arjun', 'kabir', 'rohan', 'brian', 'chill brian', 'jack', 'peter', 'aditya', 'rahul', 'amit', 'sanjay', 'vihaan', 'sai', 'ram', 'krishna'];
  const femaleNames = ['aisha', 'priya', 'abigail', 'ivy', 'sophia', 'jenny', 'cassidy', 'anna', 'sara', 'ananya', 'diya', 'riya', 'sneha', 'neha', 'pooja'];
  if (maleNames.some(m => lower.includes(m))) return 'male';
  if (femaleNames.some(f => lower.includes(f))) return 'female';
  return 'neutral';
}

// 4. Fetch HeyGen Avatars: GET /api/videos/avatars
export async function getAvatars(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!HEYGEN_API_KEY) {
      return res.status(400).json({ message: 'HeyGen API Key is not configured' });
    }

    // Check if cache is still valid
    const now = Date.now();
    if (cachedAvatars && (now - cachedAvatarsTime < CACHE_TTL)) {
      return res.status(200).json(cachedAvatars);
    }

    console.log('[HeyGen API Cache] Cache miss, fetching avatars from V2 and V3 APIs...');
    
    // Fetch V2 avatars
    let v2Avatars: any[] = [];
    try {
      const v2Response = await axios.get('https://api.heygen.com/v2/avatars', {
        headers: { 'x-api-key': HEYGEN_API_KEY }
      });
      const data = v2Response.data;
      if (Array.isArray(data)) v2Avatars = data;
      else if (data.data && Array.isArray(data.data.avatars)) v2Avatars = data.data.avatars;
      else if (data.data && Array.isArray(data.data.looks)) v2Avatars = data.data.looks;
      else if (data.data && Array.isArray(data.data)) v2Avatars = data.data;
    } catch (err: any) {
      console.error('V2 Avatars fetch failed:', err.message);
    }

    // Fetch V3 avatars
    let v3Avatars: any[] = [];
    try {
      const v3Response = await axios.get('https://api.heygen.com/v3/avatars', {
        headers: { 'x-api-key': HEYGEN_API_KEY }
      });
      const data = v3Response.data;
      if (Array.isArray(data)) v3Avatars = data;
      else if (data.data && Array.isArray(data.data.avatars)) v3Avatars = data.data.avatars;
      else if (data.data && Array.isArray(data.data)) v3Avatars = data.data;
    } catch (err: any) {
      console.error('V3 Avatars fetch failed:', err.message);
    }

    // Normalize and merge uniquely by avatar_id
    const seen = new Set<string>();
    const mergedList: any[] = [];

    // Process V2 avatars
    for (const av of v2Avatars) {
      const avId = av.avatar_id || av.id;
      if (!avId || seen.has(avId)) continue;
      seen.add(avId);
      mergedList.push({
        avatar_id: avId,
        avatar_name: av.avatar_name || av.name || 'Unnamed',
        gender: av.gender || guessGender(av.avatar_name || av.name),
        preview_image_url: av.preview_image_url || '',
        preview_video_url: av.preview_video_url || '',
        premium: av.premium || false,
        type: av.type || 'studio',
        tags: av.tags || []
      });
    }

    // Process V3 avatars (talking photos, etc.)
    for (const av of v3Avatars) {
      const avId = av.id || av.avatar_id;
      if (!avId || seen.has(avId)) continue;
      seen.add(avId);
      mergedList.push({
        avatar_id: avId,
        avatar_name: av.name || av.avatar_name || 'Unnamed',
        gender: av.gender || guessGender(av.name || av.avatar_name),
        preview_image_url: av.preview_image_url || '',
        preview_video_url: av.preview_video_url || '',
        premium: av.premium || false,
        type: av.type || 'talking_photo',
        tags: av.tags || []
      });
    }

    cachedAvatars = { data: { avatars: mergedList } };
    cachedAvatarsTime = now;

    return res.status(200).json(cachedAvatars);
  } catch (error: any) {
    console.error('Error fetching HeyGen avatars:', error.response?.data || error.message);
    return res.status(500).json({ message: error.response?.data?.message || 'Error fetching avatars from HeyGen' });
  }
}

// 5. Fetch HeyGen Voices: GET /api/videos/voices
export async function getVoices(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!HEYGEN_API_KEY) {
      return res.status(400).json({ message: 'HeyGen API Key is not configured' });
    }

    // Check if cache is still valid
    const now = Date.now();
    if (cachedVoices && (now - cachedVoicesTime < CACHE_TTL)) {
      return res.status(200).json(cachedVoices);
    }

    console.log('[HeyGen API Cache] Cache miss, fetching voices from V2 and V3 APIs...');

    // Fetch V2 voices
    let v2Voices: any[] = [];
    try {
      const v2Response = await axios.get('https://api.heygen.com/v2/voices', {
        headers: { 'x-api-key': HEYGEN_API_KEY }
      });
      const data = v2Response.data;
      if (Array.isArray(data)) v2Voices = data;
      else if (data.data && Array.isArray(data.data.voices)) v2Voices = data.data.voices;
      else if (data.data && Array.isArray(data.data)) v2Voices = data.data;
    } catch (err: any) {
      console.error('V2 Voices fetch failed:', err.message);
    }

    // Fetch V3 voices
    let v3Voices: any[] = [];
    try {
      const v3Response = await axios.get('https://api.heygen.com/v3/voices', {
        headers: { 'x-api-key': HEYGEN_API_KEY }
      });
      const data = v3Response.data;
      if (Array.isArray(data)) v3Voices = data;
      else if (data.data && Array.isArray(data.data.voices)) v3Voices = data.data.voices;
      else if (data.data && Array.isArray(data.data)) v3Voices = data.data;
    } catch (err: any) {
      console.error('V3 Voices fetch failed:', err.message);
    }

    const seen = new Set<string>();
    const mergedList: any[] = [];

    // Process V2 voices
    for (const v of v2Voices) {
      const vId = v.voice_id;
      if (!vId || seen.has(vId)) continue;
      seen.add(vId);
      mergedList.push({
        voice_id: vId,
        name: v.name || 'Unnamed Voice',
        gender: v.gender || 'neutral',
        language: v.language || 'English',
        preview_audio: v.preview_audio || v.preview_audio_url || '',
        support_pause: v.support_pause || false,
        emotion_support: v.emotion_support || false,
        support_interactive_avatar: v.support_interactive_avatar || false,
        support_locale: v.support_locale || false
      });
    }

    // Process V3 voices
    for (const v of v3Voices) {
      const vId = v.voice_id;
      if (!vId || seen.has(vId)) continue;
      seen.add(vId);
      mergedList.push({
        voice_id: vId,
        name: v.name || 'Unnamed Voice',
        gender: v.gender || 'neutral',
        language: v.language || 'English',
        preview_audio: v.preview_audio_url || v.preview_audio || '',
        support_pause: v.support_pause || false,
        emotion_support: v.emotion_support || false,
        support_interactive_avatar: v.support_interactive_avatar || false,
        support_locale: v.support_locale || false
      });
    }

    cachedVoices = { data: { voices: mergedList } };
    cachedVoicesTime = now;

    return res.status(200).json(cachedVoices);
  } catch (error: any) {
    console.error('Error fetching HeyGen voices:', error.response?.data || error.message);
    return res.status(500).json({ message: error.response?.data?.message || 'Error fetching voices from HeyGen' });
  }
}

// 6. Get Curated Styles: GET /api/videos/styles
export async function getStyles(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    return res.status(200).json({ styles: CURATED_STYLES });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || 'Error fetching styles.' });
  }
}

// 7. Resume active polling for unprocessed jobs (Server restart recovery)
export async function resumeActivePolling() {
  try {
    const processingVideos = await prisma.video.findMany({
      where: { status: VideoStatus.PROCESSING },
    });
    console.log(`[HeyGen Resume] Found ${processingVideos.length} videos in PROCESSING state to resume polling.`);
    for (const video of processingVideos) {
      if (video.videoUrl) {
        if (video.videoUrl.startsWith('creatomate:')) {
          const renderId = video.videoUrl.replace('creatomate:', '');
          console.log(`[HeyGen Resume] Resuming status polling loop for Creatomate Video ID: ${video.id}, Render ID: ${renderId}`);
          pollCreatomateStatus(video.id, renderId);
        } else if (!video.videoUrl.startsWith('http')) {
          console.log(`[HeyGen Resume] Resuming status polling loop for HeyGen Video ID: ${video.id}, HeyGen ID: ${video.videoUrl}`);
          pollHeyGenStatus(video.id, video.videoUrl);
        }
      }
    }
  } catch (err) {
    console.error('[HeyGen Resume] Error resuming active polling on startup:', err);
  }
}
