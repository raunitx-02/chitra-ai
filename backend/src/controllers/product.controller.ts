import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import axios from 'axios';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Analyze product image via Gemini Vision (if API key available)
// ──────────────────────────────────────────────────────────────────────────────
async function analyzeWithGemini(base64: string, mime: string): Promise<any> {
  const prompt = `You are an expert marketing AI. Analyze this product image and generate a complete UGC ad campaign package.

Return ONLY a JSON object (no markdown, no code fences, just pure JSON) with these exact fields:
{
  "productName": "exact product name detected (be specific)",
  "category": "product category (Electronics, Footwear, Skincare, Food, Fashion, Furniture, Sports, Beauty, Tech, Home, etc.)",
  "keyFeatures": ["specific feature 1", "specific feature 2", "specific feature 3"],
  "targetAudience": "describe the ideal customer for this product specifically",
  "adScript": "A compelling 25-35 second UGC ad script (70-90 words) in first-person conversational style. Start with a STRONG hook. Include 2-3 key selling points naturally. End with a clear CTA like 'Link in bio, go get yours!'",
  "visualPrompt": "Detailed scene description for video background that perfectly complements this specific product (describe setting, lighting, colors, mood, any props)",
  "tagline": "Punchy memorable tagline max 8 words"
}`;

  const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const model of models) {
    try {
      console.log(`[Product AI] Attempting Gemini model: ${model}`);
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mime, data: base64 } },
              ],
            },
          ],
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
      );

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch (err: any) {
      console.warn(`[Product AI] Gemini model ${model} failed:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini models failed');
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Step 1 — Get image caption via HuggingFace BLIP (free, no key needed)
// ──────────────────────────────────────────────────────────────────────────────
async function captionImageWithBLIP(base64: string): Promise<string> {
  // Convert base64 to buffer
  const imgBuffer = Buffer.from(base64, 'base64');
  const hfKey = (process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN || '').trim();

  const headers: any = {
    'Content-Type': 'application/octet-stream',
    'Accept': 'application/json',
  };

  if (hfKey) {
    headers['Authorization'] = `Bearer ${hfKey}`;
  }

  const response = await axios.post(
    'https://router.huggingface.co/hf-inference/models/Salesforce/blip-image-captioning-large',
    imgBuffer,
    {
      headers,
      timeout: 30000,
    }
  );

  // BLIP returns [{ generated_text: "..." }]
  const result = Array.isArray(response.data)
    ? response.data[0]?.generated_text
    : response.data?.generated_text;

  return result || '';
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Step 2 — Generate full ad package via Pollinations.ai (free, no key)
// ──────────────────────────────────────────────────────────────────────────────
async function generateAdPackageWithPollinations(imageCaption: string): Promise<any> {
  const systemMsg = `You are an expert UGC ad copywriter and marketing strategist. Given an image description, generate a complete product ad package. Always respond with ONLY valid JSON, no markdown.`;

  const userMsg = `Image description: "${imageCaption}"

Based on this product image, generate a complete UGC ad campaign package. Return ONLY this JSON (no markdown fences):
{
  "productName": "specific product name based on the image description",
  "category": "product category (Electronics, Footwear, Skincare, Food, Fashion, Beauty, Tech, Home, Sports, etc.)",
  "keyFeatures": ["feature 1 relevant to this product", "feature 2", "feature 3"],
  "targetAudience": "specific ideal customer demographic for this product",
  "adScript": "A 70-90 word UGC ad script in first-person conversational tone. Open with a viral hook like 'Okay I NEED to talk about this...' or 'This changed my entire routine...'. Mention 2-3 benefits naturally. Close with 'Link in bio—go grab yours!'",
  "visualPrompt": "Detailed video background scene: environment, lighting, colors, mood, props that make this product shine",
  "tagline": "Short punchy product tagline, max 8 words"
}`;

  const response = await axios.post(
    'https://text.pollinations.ai/',
    {
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: userMsg },
      ],
      model: 'openai',
      seed: 42,
      jsonMode: true,
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 45000,
    }
  );

  // Pollinations returns the text response directly or in choices
  let text = '';
  if (typeof response.data === 'string') {
    text = response.data;
  } else if (response.data?.choices?.[0]?.message?.content) {
    text = response.data.choices[0].message.content;
  } else if (response.data?.content) {
    text = response.data.content;
  } else {
    text = JSON.stringify(response.data);
  }

  // Clean and parse
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  // Try to extract JSON from response
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  
  return JSON.parse(cleaned);
}

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Smart fallback — heuristic-based analysis using image filename/mime
// ──────────────────────────────────────────────────────────────────────────────
function heuristicFallback(caption: string): any {
  const lower = caption.toLowerCase();

  // Detect product type from caption keywords
  const isShoe = /shoe|sneaker|boot|footwear|heel|slipper|sandal/.test(lower);
  const isKeyboard = /keyboard|laptop|computer|mouse|tech|electronic/.test(lower);
  const isSkincare = /cream|serum|moisturizer|skincare|lotion|bottle|jar|beauty/.test(lower);
  const isFood = /food|drink|bottle|can|snack|coffee|tea|juice|fruit/.test(lower);
  const isClothing = /shirt|dress|jacket|jeans|clothing|fabric|wear/.test(lower);
  const isWatch = /watch|clock|time/.test(lower);
  const isPhone = /phone|mobile|device|smartphone/.test(lower);

  if (isShoe) return buildFallback('Premium Sneakers', 'Footwear',
    ['Superior comfort', 'Durable build', 'Stylish design'],
    'sneaker enthusiasts and everyday wear lovers',
    'These sneakers just hit different. I\'ve tried so many pairs, but nothing compares to the comfort I feel every single day. The design is clean, the fit is perfect, and they literally go with every outfit. If you\'ve been searching for your next go-to pair—stop searching, this is it. Link in bio, go grab yours!',
    'Clean white studio with sneakers on marble, soft product lighting, minimal modern aesthetic',
    'Step into your best self'
  );

  if (isKeyboard) return buildFallback('Mechanical Keyboard', 'Electronics',
    ['Satisfying tactile feedback', 'Backlit keys', 'Ergonomic design'],
    'gamers, developers, and productivity enthusiasts',
    'I\'ve been using this keyboard for weeks and I can\'t go back to anything else. The tactile feedback is so satisfying, my typing speed literally went up. Whether you\'re coding, gaming, or just crushing emails—this thing is a game changer. The backlight? Chef\'s kiss. Link in bio!',
    'Dark moody desk setup, RGB lighting, clean cable management, cinematic side lighting',
    'Type smarter, not harder'
  );

  if (isSkincare) return buildFallback('Skincare Product', 'Beauty',
    ['Deep hydration', 'Fast-absorbing formula', 'Clinically tested'],
    'skincare enthusiasts and glow-getters',
    'Okay I need to tell you about this product RIGHT NOW. I\'ve been using it for 3 weeks and my skin has literally never looked better. It absorbs so fast, no greasy feeling, and my glow? Unreal. If your skincare routine isn\'t working, THIS is what\'s missing. Link in bio—treat yourself!',
    'Soft morning light, clean white bathroom counter, fresh flowers in background, dewy aesthetic',
    'Glow up starts here'
  );

  if (isFood) return buildFallback('Premium Food/Drink', 'Food & Beverage',
    ['All-natural ingredients', 'Delicious flavor', 'Convenient packaging'],
    'health-conscious consumers and foodies',
    'This is my new daily obsession and I\'m not apologizing for it. The flavor is incredible, the ingredients are clean, and it fits perfectly into my routine. I\'ve already convinced 5 friends to try it and they\'re all obsessed too. Don\'t sleep on this one. Link in bio!',
    'Bright natural kitchen setting, fresh ingredients scattered, warm morning light',
    'Taste the difference'
  );

  if (isWatch) return buildFallback('Premium Timepiece', 'Accessories',
    ['Precision movement', 'Premium materials', 'Timeless design'],
    'professionals and style-conscious individuals',
    'I wasn\'t looking for a new watch until this caught my eye and now I can\'t stop wearing it. The quality is insane for the price—it feels premium, it looks premium, and people keep asking where I got it. Honestly the best accessory investment I\'ve made all year. Link in bio!',
    'Clean modern desk setup, soft side lighting, watch on leather surface, minimalist luxury aesthetic',
    'Time well invested'
  );

  if (isPhone) return buildFallback('Smartphone', 'Electronics',
    ['Powerful performance', 'Stunning display', 'All-day battery'],
    'tech enthusiasts and power users',
    'I switched to this phone two weeks ago and I genuinely cannot stop talking about it. The speed is unreal, the camera is stunning, and the battery lasts me a full day no matter how hard I use it. If you\'re due for an upgrade—this is THE one. Link in bio!',
    'Clean minimalist desk, soft gradient background, phone displayed prominently, soft studio lighting',
    'Power meets perfection'
  );

  // Generic fallback
  return buildFallback(
    caption ? `${caption.split(' ').slice(0, 3).join(' ')}` : 'Premium Product',
    'General',
    ['Outstanding quality', 'Innovative design', 'Exceptional value'],
    'quality-conscious consumers',
    `Okay I need to stop what I'm doing and tell you about this right now! I've been using this for a few weeks and it's honestly one of the best things I've bought this year. The quality is incredible, it does exactly what it promises, and I've already recommended it to everyone I know. If you're on the fence—just get it. You won't regret it. Link in bio!`,
    'Clean bright studio, soft natural lighting, product centered on white surface, premium minimal aesthetic',
    'Quality you can feel'
  );
}

function buildFallback(
  productName: string, category: string, keyFeatures: string[],
  targetAudience: string, adScript: string, visualPrompt: string, tagline: string
): any {
  return { productName, category, keyFeatures, targetAudience, adScript, visualPrompt, tagline };
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/product/analyze
// ──────────────────────────────────────────────────────────────────────────────
export async function analyzeProduct(req: AuthenticatedRequest, res: Response) {
  const user = req.user;
  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  const { imageBase64, mimeType } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ message: 'imageBase64 is required.' });
  }

  const mime = mimeType || 'image/jpeg';
  console.log(`[Product AI] Analyzing product image for user: ${user.id}`);

  // ── Strategy 1: Gemini (if API key configured & real key) ────────────────
  const geminiKey = GEMINI_API_KEY.trim();
  const hasRealGeminiKey = geminiKey && geminiKey !== 'AIzaSyDummyKeyPleaseReplace' && geminiKey.length > 20;
  
  if (hasRealGeminiKey) {
    try {
      console.log('[Product AI] Using Gemini Vision...');
      const result = await analyzeWithGemini(imageBase64, mime);
      console.log('[Product AI] Gemini analysis complete:', result.productName);
      return res.status(200).json({ analysis: result, source: 'gemini' });
    } catch (err: any) {
      console.warn('[Product AI] Gemini failed, falling back:', err.message);
    }
  }

  // ── Strategy 2: HuggingFace BLIP + Pollinations.ai (100% free, no key) ──
  try {
    console.log('[Product AI] Using HuggingFace BLIP for image captioning...');
    const caption = await captionImageWithBLIP(imageBase64);
    console.log('[Product AI] BLIP caption:', caption);

    if (caption) {
      try {
        console.log('[Product AI] Using Pollinations.ai for ad copy generation...');
        const result = await generateAdPackageWithPollinations(caption);
        console.log('[Product AI] Pollinations analysis complete:', result.productName);
        return res.status(200).json({ analysis: result, source: 'blip+pollinations' });
      } catch (pollinationsErr: any) {
        console.warn('[Product AI] Pollinations failed, using heuristics:', pollinationsErr.message);
        const result = heuristicFallback(caption);
        return res.status(200).json({ analysis: result, source: 'blip+heuristic' });
      }
    }
  } catch (blipErr: any) {
    console.warn('[Product AI] BLIP failed, using pure heuristic:', blipErr.message);
  }

  // ── Strategy 3: Pure heuristic fallback (always works) ──────────────────
  console.log('[Product AI] Using heuristic fallback analysis');
  const result = heuristicFallback('');
  return res.status(200).json({ analysis: result, source: 'heuristic' });
}
