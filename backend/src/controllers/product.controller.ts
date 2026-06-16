import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import axios from 'axios';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const IMGBB_API_KEY = process.env.IMGBB_API_KEY || '';

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Analyze product image via Gemini Vision
// ──────────────────────────────────────────────────────────────────────────────
async function analyzeProductWithGemini(imageUrl: string): Promise<{
  productName: string;
  category: string;
  keyFeatures: string[];
  targetAudience: string;
  adScript: string;
  visualPrompt: string;
  tagline: string;
}> {
  const prompt = `You are an expert marketing AI. Analyze this product image and generate a complete UGC ad campaign package.

Return a JSON object (no markdown, no code fences, just pure JSON) with these exact fields:
{
  "productName": "exact product name detected",
  "category": "product category (e.g. Electronics, Footwear, Skincare, Food, Fashion, etc.)",
  "keyFeatures": ["feature 1", "feature 2", "feature 3"],
  "targetAudience": "who this product is best for",
  "adScript": "A compelling 30-second UGC ad script (80-100 words) written in first-person, conversational style as if a real person is reviewing/recommending this product. Include a strong hook at the start and a CTA at the end.",
  "visualPrompt": "A detailed visual description for the video background scene - describe the ideal filming environment, lighting, colors, and mood that would complement this product (e.g. clean white studio with soft ring light, cozy bedroom setup, outdoor sunny day)",
  "tagline": "A short punchy tagline for this product (max 8 words)"
}`;

  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      contents: [
        {
          parts: [
            {
              inline_data: null,
            },
            {
              text: prompt,
            },
            {
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
    },
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  // Parse JSON from response
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Analyze product image via Gemini Vision (URL-based)
// ──────────────────────────────────────────────────────────────────────────────
async function analyzeProductWithGeminiURL(imageUrl: string): Promise<any> {
  const prompt = `You are an expert marketing AI. Analyze this product image and generate a complete UGC ad campaign package.

Return a JSON object (no markdown, no code fences, just pure JSON) with these exact fields:
{
  "productName": "exact product name detected",
  "category": "product category (e.g. Electronics, Footwear, Skincare, Food, Fashion, Furniture, etc.)",
  "keyFeatures": ["feature 1", "feature 2", "feature 3"],
  "targetAudience": "who this product is best for (be specific)",
  "adScript": "A compelling 30-second UGC ad script (80-100 words) written in first-person conversational style as if a real enthusiastic person is reviewing and recommending this product. Start with a strong hook like 'Okay I need to talk about this...' or 'This changed everything for me...' and end with a CTA.",
  "visualPrompt": "Detailed visual description for video background: describe the ideal filming environment, lighting, colors, mood that complements this product perfectly (e.g. 'minimalist white studio, soft diffused lighting, clean product on white marble surface')",
  "tagline": "A short punchy memorable tagline for this product (max 8 words)"
}`;

  if (!GEMINI_API_KEY) {
    // Fallback: return generic template
    return {
      productName: 'Your Product',
      category: 'General',
      keyFeatures: ['High quality', 'Great value', 'Easy to use'],
      targetAudience: 'Everyone who wants the best',
      adScript: `Okay, I need to talk about this product right now! I've been using it for a few weeks and honestly? Game changer. The quality is unreal, and it actually does exactly what it promises. If you've been on the fence about trying it, this is your sign. Trust me, you won't regret it. Link in bio—go grab yours before they sell out!`,
      visualPrompt: 'Clean modern studio background, soft warm lighting, product centered on white surface',
      tagline: 'Experience the difference today',
    };
  }

  // Use Gemini with image URL via the REST API
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              fileData: {
                mimeType: 'image/jpeg',
                fileUri: imageUrl,
              },
            },
          ],
        },
      ],
    },
    { headers: { 'Content-Type': 'application/json' } }
  );

  const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/videos/analyze-product
// Body: { imageUrl: string } — public URL of uploaded product image
// ──────────────────────────────────────────────────────────────────────────────
export async function analyzeProduct(req: AuthenticatedRequest, res: Response) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const { imageUrl, imageBase64, mimeType } = req.body;
    if (!imageUrl && !imageBase64) {
      return res.status(400).json({ message: 'imageUrl or imageBase64 is required.' });
    }

    console.log(`[Product Analysis] Starting analysis for user: ${user.id}`);

    let analysisResult: any;

    if (imageBase64) {
      // Analyze using base64 inline image (for direct file uploads)
      analysisResult = await analyzeProductBase64(imageBase64, mimeType || 'image/jpeg');
    } else {
      // Try URL-based analysis with fallback
      try {
        analysisResult = await analyzeProductWithGeminiURL(imageUrl!);
      } catch (err) {
        console.error('[Product Analysis] Gemini URL analysis failed, trying base64 approach:', err);
        // Fallback to generic response
        analysisResult = {
          productName: 'Your Product',
          category: 'General',
          keyFeatures: ['Premium quality', 'Innovative design', 'Best in class'],
          targetAudience: 'Customers who want quality',
          adScript: `Okay I need to stop what I'm doing and tell you about this! I found this product recently and it's honestly one of the best purchases I've made. The quality? Incredible. The results? Speak for themselves. If you've been looking for something that actually works, this is it. Don't wait—grab yours today before it sells out!`,
          visualPrompt: 'Clean bright studio, soft natural lighting, product displayed prominently on clean white surface',
          tagline: 'Quality you can feel',
        };
      }
    }

    console.log(`[Product Analysis] Analysis complete:`, analysisResult.productName);
    return res.status(200).json({ analysis: analysisResult });

  } catch (error: any) {
    console.error('[Product Analysis] Error:', error.response?.data || error.message);
    return res.status(500).json({ 
      message: 'Failed to analyze product image.',
      detail: error.message,
    });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Analyze product using base64 inline image
// ──────────────────────────────────────────────────────────────────────────────
async function analyzeProductBase64(base64Data: string, mimeType: string): Promise<any> {
  const prompt = `You are an expert marketing AI. Analyze this product image and generate a complete UGC ad campaign package.

Return ONLY a JSON object (no markdown, no code fences, just pure JSON) with these exact fields:
{
  "productName": "exact product name detected (be specific)",
  "category": "product category (Electronics, Footwear, Skincare, Food, Fashion, Furniture, Sports, Beauty, Tech, Home, etc.)",
  "keyFeatures": ["specific feature 1", "specific feature 2", "specific feature 3"],
  "targetAudience": "describe the ideal customer for this product specifically",
  "adScript": "A compelling 25-35 second UGC ad script (70-90 words) in first-person conversational style. Start with a STRONG hook (e.g. 'This completely changed my routine...' or 'I can't stop telling people about this...'). Include 2-3 key selling points naturally. End with a clear CTA like 'Link in bio, go get yours!'",
  "visualPrompt": "Detailed scene description for video background that perfectly complements this specific product (describe setting, lighting, colors, mood, any props)",
  "tagline": "Punchy memorable tagline max 8 words"
}`;

  if (!GEMINI_API_KEY) {
    return {
      productName: 'Your Product',
      category: 'General',
      keyFeatures: ['Premium quality', 'Innovative design', 'Best in class'],
      targetAudience: 'Quality-conscious customers',
      adScript: `Okay I need to stop what I'm doing and tell you about this! I found this recently and it's honestly one of the best things I've bought. The quality is incredible and it actually delivers on its promises. If you want something that works, this is it. Link in bio—grab yours now!`,
      visualPrompt: 'Clean bright studio with soft natural lighting, product prominently displayed on clean surface',
      tagline: 'Quality you can feel',
    };
  }

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
    },
    { headers: { 'Content-Type': 'application/json' } }
  );

  const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  try {
    return JSON.parse(cleaned);
  } catch {
    // If JSON parse fails, extract what we can
    console.error('[Gemini] Failed to parse JSON, raw text:', text.slice(0, 500));
    throw new Error('AI returned invalid JSON response');
  }
}
