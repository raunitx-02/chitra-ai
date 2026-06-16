import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import prisma from '../config/db';
import axios from 'axios';
import { VideoStatus } from '@prisma/client';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY || '';

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
    const video = await prisma.video.create({
      data: {
        userId: user.id,
        script: script || 'product_ad',
        avatarId: avatarId || 'product_mode',
        voiceId: voiceId || 'none',
        language: language || 'English',
        status: VideoStatus.PENDING,
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
          // Upload base64 image to ImgBB to get a public URL for HeyGen
          let productPublicUrl = '';
          try {
            const FormData = require('form-data');
            const imgbbRes = await axios.post(
              'https://api.imgbb.com/1/upload',
              new URLSearchParams({
                key: process.env.IMGBB_API_KEY || 'a4dc406e0a1def39a6fd18cda9ef6a64',
                image: productImageBase64,
                expiration: '0', // never expire
              }),
              { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );
            productPublicUrl = imgbbRes.data?.data?.url || imgbbRes.data?.data?.display_url || '';
            console.log(`[Product Upload] Uploaded to ImgBB: ${productPublicUrl}`);
          } catch (uploadErr: any) {
            console.error('[Product Upload] ImgBB upload failed:', uploadErr.message);
            // Fallback: use a data URL directly if ImgBB fails
            productPublicUrl = `data:${productImageMime};base64,${productImageBase64}`;
          }

          // For product mode: use a default avatar that presents the product
          // The product image will be set as the background
          characterInput = {
            type: 'avatar',
            avatar_id: avatarId || 'Daisy-inskirt-20220818', // Use selected avatar or default
            avatar_style: 'normal',
          };

          // Use the product image as background (overridden below if visualPrompt also provided)
          if (productPublicUrl && productPublicUrl.startsWith('http')) {
            // Will be set as background below
            (req as any)._productBgUrl = productPublicUrl;
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

        await prisma.video.update({
          where: { id: dbVideoId },
          data: {
            status: VideoStatus.COMPLETED,
            videoUrl,
            thumbnailUrl,
          },
        });
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
    if (processingVideos.length > 0 && HEYGEN_API_KEY) {
      let updatedAny = false;
      for (const video of processingVideos) {
        if (video.videoUrl && !video.videoUrl.startsWith('http')) {
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
              await prisma.video.update({
                where: { id: video.id },
                data: {
                  status: VideoStatus.COMPLETED,
                  videoUrl: liveUrl,
                  thumbnailUrl: liveThumb,
                },
              });
              updatedAny = true;
              console.log(`[On-The-Fly Sync] Video ${video.id} updated to COMPLETED.`);
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

      if (updatedAny) {
        videos = await prisma.video.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
        });
      }
    }

    return res.status(200).json({ videos });
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

    console.log('[HeyGen API Cache] Cache miss, fetching avatars from API...');
    const response = await axios.get('https://api.heygen.com/v2/avatars', {
      headers: {
        'x-api-key': HEYGEN_API_KEY,
      }
    });

    cachedAvatars = response.data;
    cachedAvatarsTime = now;

    return res.status(200).json(response.data);
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

    console.log('[HeyGen API Cache] Cache miss, fetching voices from API...');
    const response = await axios.get('https://api.heygen.com/v2/voices', {
      headers: {
        'x-api-key': HEYGEN_API_KEY,
      }
    });

    cachedVoices = response.data;
    cachedVoicesTime = now;

    return res.status(200).json(response.data);
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
      if (video.videoUrl && !video.videoUrl.startsWith('http')) {
        console.log(`[HeyGen Resume] Resuming status polling loop for Video ID: ${video.id}, HeyGen ID: ${video.videoUrl}`);
        pollHeyGenStatus(video.id, video.videoUrl);
      }
    }
  } catch (err) {
    console.error('[HeyGen Resume] Error resuming active polling on startup:', err);
  }
}
