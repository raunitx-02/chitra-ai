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

// 1. Generate Video: POST /api/videos/generate
export async function generateVideo(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { script, avatarId, voiceId, language } = req.body;
    if (!script || !avatarId || !voiceId) {
      return res.status(400).json({ message: 'Script, avatarId, and voiceId are required.' });
    }

    // Check credits balance (costs 10 credits)
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser || dbUser.creditsBalance < 10) {
      return res.status(400).json({ message: 'Insufficient credits. Please top up your account.' });
    }

    // Step 1: Create a PENDING Video record
    const video = await prisma.video.create({
      data: {
        userId: user.id,
        script,
        avatarId,
        voiceId,
        language: language || 'English',
        status: VideoStatus.PENDING,
      },
    });

    // Step 2: Deduct credits
    await prisma.user.update({
      where: { id: user.id },
      data: { creditsBalance: { decrement: 10 } },
    });

    // Step 3: Trigger HeyGen API (or D-ID API)
    // If HEYGEN_API_KEY is configured, make real request. Otherwise mock.
    if (HEYGEN_API_KEY) {
      try {
        const response = await axios.post(
          'https://api.heygen.com/v2/video/generate',
          {
            video_inputs: [
              {
                character: {
                  type: 'avatar',
                  avatar_id: avatarId,
                  avatar_style: 'normal',
                },
                voice: {
                  type: 'text',
                  input_text: script,
                  voice_id: voiceId,
                },
              },
            ],
            dimension: 'portrait', // portrait 9:16 for Reels/Shorts
          },
          {
            headers: {
              'x-api-key': HEYGEN_API_KEY,
              'Content-Type': 'application/json',
            },
          }
        );

        const heygenVideoId = response.data?.data?.video_id;

        // Update video record to PROCESSING with a mock url/id
        await prisma.video.update({
          where: { id: video.id },
          data: {
            status: VideoStatus.PROCESSING,
            // Store job ID or metadata
          },
        });

        // Start background polling to check video status
        pollHeyGenStatus(video.id, heygenVideoId);

      } catch (heygenErr: any) {
        console.error('HeyGen API call failed:', heygenErr.response?.data || heygenErr.message);
        // Refund credits on API failure
        await prisma.$transaction([
          prisma.user.update({
            where: { id: user.id },
            data: { creditsBalance: { increment: 10 } },
          }),
          prisma.video.update({
            where: { id: video.id },
            data: { status: VideoStatus.FAILED },
          }),
        ]);
        return res.status(502).json({ message: 'AI video generation API failed. Credits refunded.' });
      }
    } else {
      // Mock processing for sandbox environments
      console.log(`[Mock Generation] Starting video render for script: "${script.slice(0, 30)}..."`);
      await prisma.video.update({
        where: { id: video.id },
        data: { status: VideoStatus.PROCESSING },
      });

      // Simulate completion in 10 seconds
      setTimeout(async () => {
        try {
          // Mock completed video S3/Cloudinary URL
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
      creditsBalance: dbUser.creditsBalance - 10,
    });
  } catch (error: any) {
    console.error('Error initiating generation:', error);
    return res.status(500).json({ message: error.message || 'Error processing request' });
  }
}

// Helper to poll HeyGen API in background
async function pollHeyGenStatus(dbVideoId: string, heygenVideoId: string) {
  const maxAttempts = 30;
  let attempts = 0;

  const interval = setInterval(async () => {
    attempts++;
    if (attempts > maxAttempts) {
      clearInterval(interval);
      await prisma.video.update({
        where: { id: dbVideoId },
        data: { status: VideoStatus.FAILED },
      });
      return;
    }

    try {
      const response = await axios.get(
        `https://api.heygen.com/v3/videos/${heygenVideoId}`,
        {
          headers: {
            'x-api-key': HEYGEN_API_KEY,
          },
        }
      );

      const status = response.data?.data?.status;
      if (status === 'completed') {
        clearInterval(interval);
        const videoUrl = response.data?.data?.video_url;
        const thumbnailUrl = response.data?.data?.thumbnail_url;

        await prisma.video.update({
          where: { id: dbVideoId },
          data: {
            status: VideoStatus.COMPLETED,
            videoUrl,
            thumbnailUrl,
          },
        });
      } else if (status === 'failed') {
        clearInterval(interval);
        await prisma.video.update({
          where: { id: dbVideoId },
          data: { status: VideoStatus.FAILED },
        });
      }
    } catch (err) {
      console.error('Error polling HeyGen status:', err);
    }
  }, 10000); // poll every 10 seconds
}

// 2. Fetch User Videos: GET /api/videos
export async function getVideos(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const videos = await prisma.video.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ videos });
  } catch (error) {
    return res.status(500).json({ message: 'Error retrieving videos' });
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

    // Contextual high-converting ad script templates
    let script = '';

    if (lang.includes('Hindi')) {
      script = `हे दोस्तों! क्या आप जानते हैं कि ${productName} आपके जीवन को कितना आसान बना सकता है? अगर आप ${description} से परेशान हैं, तो आज ही इसे आज़माएं। यह विशेष रूप से हमारे ${audience} के लिए बनाया गया है। अभी नीचे दिए गए बटन पर क्लिक करें और 50% की छूट का लाभ उठाएं!`;
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
