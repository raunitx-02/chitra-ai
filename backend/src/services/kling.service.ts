import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const CRAZYROUTER_API_KEY = process.env.CRAZYROUTER_API_KEY || '';
const CRAZYROUTER_BASE_URL = 'https://api.crazyrouter.com';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KlingScenePrompt {
  prompt: string;
  duration: number; // seconds: 5 or 10
}

export interface KlingVideoResult {
  taskId: string;
  videoUrl: string;
  localPath?: string;
}

// ─── Scene Prompt Generator using Gemini ─────────────────────────────────────

/**
 * Uses Gemini to generate 3 cinematic Kling scene prompts from the
 * user's product image + script. Returns prompts that will create
 * Scalio-quality product B-roll clips.
 */
export async function generateKlingScenePrompts(
  script: string,
  productDescription: string,
  productCategory: string = 'product'
): Promise<KlingScenePrompt[]> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

  const systemPrompt = `You are a world-class video director specializing in high-converting UGC product ads (like Scalio, Billo, Viraly).

Given a product description and ad script, generate EXACTLY 3 cinematic Kling AI video prompts for animated product B-roll clips. These clips will be composited with a talking avatar head to create a professional UGC ad.

Rules for each prompt:
- Be extremely specific and cinematic (like a real cinematographer's shot list)
- Always include: camera movement, lighting, mood, product action, background
- Make prompts that animate the product beautifully (glow, rotate, float, sparkle, etc.)
- Durations: Scene 1 = 5s (hook/product reveal), Scene 2 = 5s (product in use/benefits), Scene 3 = 5s (CTA/glamour shot)
- Use professional cinematography language
- Make it feel like a luxury brand commercial

Return ONLY valid JSON, no markdown:
{
  "scenes": [
    {"prompt": "...", "duration": 5},
    {"prompt": "...", "duration": 5},
    {"prompt": "...", "duration": 5}
  ]
}`;

  const userMessage = `Product: ${productDescription}
Category: ${productCategory}
Ad Script: ${script.slice(0, 500)}

Generate 3 cinematic Kling video prompts for this product's B-roll clips.`;

  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

  for (const model of models) {
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          contents: [
            { parts: [{ text: systemPrompt + '\n\n' + userMessage }] }
          ],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 20000 }
      );

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const result = JSON.parse(cleaned);

      if (result.scenes && result.scenes.length >= 3) {
        console.log('[Kling Scene AI] Generated 3 cinematic prompts via', model);
        return result.scenes.slice(0, 3);
      }
    } catch (err: any) {
      console.warn('[Kling Scene AI] Gemini model failed:', model, err.message);
    }
  }

  // Fallback: generic but good prompts based on product category
  console.log('[Kling Scene AI] Using fallback prompts for category:', productCategory);
  return generateFallbackPrompts(productDescription, productCategory);
}

function generateFallbackPrompts(productDescription: string, category: string): KlingScenePrompt[] {
  const prod = productDescription.slice(0, 80);

  const categoryPrompts: Record<string, KlingScenePrompt[]> = {
    watch: [
      { prompt: `Cinematic extreme close-up of a luxury ${prod} on a dark marble surface. Dramatic side lighting creates sharp reflections on the watch face. Slow push-in with microscopic detail on the dial. Golden light rays sweep across the surface. Ultra 4K, depth of field, premium brand commercial feel.`, duration: 5 },
      { prompt: `${prod} rotating elegantly on a crystal pedestal. Soft diffused studio light from above creates a halo effect. Camera orbits slowly around the watch at mid-height. Tiny light particles float in background. Professional product photography style, ultra-sharp, cinematic grade.`, duration: 5 },
      { prompt: `Wrist shot: ${prod} on a well-groomed wrist in a luxury car interior or premium setting. Arm rests naturally, watch catches warm ambient light. Slow zoom out reveals the lifestyle context. Premium color grade, shallow depth of field, aspirational lifestyle feel.`, duration: 5 }
    ],
    skincare: [
      { prompt: `Cinematic close-up of ${prod} bottle/jar on a white marble bathroom counter with morning light streaming through frosted glass. Slow push-in reveals product label. Water droplets glisten on surface. Fresh, clean, luxury aesthetic. 4K, professional color grade.`, duration: 5 },
      { prompt: `${prod} product hero shot: gentle rotation on a pristine surface with botanical elements (flowers, leaves) softly blurred in background. Warm golden hour light. Camera slowly orbits. Elegant, natural, premium feel.`, duration: 5 },
      { prompt: `Close-up texture shot of ${prod} being applied to smooth skin. Product creamy texture shown in extreme detail. Soft bokeh background. Satisfying, ASMR-quality visuals. Warm skin-tone lighting. Premium skincare commercial aesthetic.`, duration: 5 }
    ],
    default: [
      { prompt: `Cinematic product reveal: ${prod} emerging from soft fog on a dark reflective surface. Dramatic spotlight from above creates rim lighting. Camera slowly pushes in. Particles of light swirl around. Premium brand commercial, 4K ultra-sharp.`, duration: 5 },
      { prompt: `${prod} hero shot on premium marble/glass surface. 360-degree orbit camera movement. Studio three-point lighting with warm key light. Product casts perfect shadow. Ultra-cinematic, luxury brand feel, shallow depth of field.`, duration: 5 },
      { prompt: `Lifestyle close-up of ${prod} in natural use context. Warm, inviting ambient light. Camera gently zooms out to reveal aspirational setting. Bokeh background with lifestyle elements. Color graded for social media UGC, authentic yet premium.`, duration: 5 }
    ]
  };

  return categoryPrompts[category.toLowerCase()] || categoryPrompts['default'];
}

// ─── Submit Kling Image-to-Video Task ─────────────────────────────────────────

/**
 * Submits a single Kling image-to-video generation task.
 * Returns the task ID for polling.
 */
export async function submitKlingTask(
  imageUrl: string,
  scenePrompt: KlingScenePrompt,
  aspectRatio: string = '9:16'
): Promise<string> {
  if (!CRAZYROUTER_API_KEY) {
    throw new Error('CRAZYROUTER_API_KEY is not set');
  }

  console.log(`[Kling] Submitting task: ${scenePrompt.prompt.slice(0, 60)}...`);

  // Try kling-v3 first (best quality, Scalio-level), fallback to kling-v2-6
  const modelsToTry = ['kling-v3', 'kling-v2-6', 'kling-v2-5-turbo'];

  for (const modelName of modelsToTry) {
    try {
      const response = await axios.post(
        `${CRAZYROUTER_BASE_URL}/kling/v1/videos/image2video`,
        {
          model_name: modelName,
          prompt: scenePrompt.prompt,
          negative_prompt: 'blurry, low quality, distorted, shaky, amateur, text overlay, watermark, bad lighting',
          image: imageUrl,
          duration: String(scenePrompt.duration),
          aspect_ratio: aspectRatio,
          cfg_scale: 0.5,
          mode: 'std'
        },
        {
          headers: {
            'Authorization': `Bearer ${CRAZYROUTER_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const data = response.data;
      console.log('[Kling] Submit response:', JSON.stringify(data).slice(0, 200));

      // CrazyRouter returns task id in different fields depending on the model
      const taskId = data?.data?.task_id || data?.task_id || data?.id || data?.data?.id;

      if (taskId) {
        console.log(`[Kling] Task submitted with model ${modelName}. Task ID: ${taskId}`);
        return taskId;
      }

      // If model unavailable, try next
      if (data?.code === 'get_channel_failed') {
        console.warn(`[Kling] Model ${modelName} unavailable, trying next...`);
        continue;
      }

      throw new Error(`Kling submit failed: ${JSON.stringify(data)}`);

    } catch (err: any) {
      if (err.response?.data?.code === 'get_channel_failed') {
        console.warn(`[Kling] Model ${modelName} unavailable, trying next...`);
        continue;
      }
      // If it's the last model, rethrow
      if (modelName === modelsToTry[modelsToTry.length - 1]) {
        throw err;
      }
    }
  }

  throw new Error('All Kling models are currently unavailable. Please try again later.');
}

// ─── Poll Kling Task Status ───────────────────────────────────────────────────

/**
 * Polls a Kling task until it completes or fails.
 * Returns the video URL when done.
 */
export async function pollKlingTask(
  taskId: string,
  maxWaitMs: number = 5 * 60 * 1000 // 5 minutes per clip
): Promise<string> {
  const startTime = Date.now();
  const pollIntervalMs = 5000; // poll every 5 seconds

  console.log(`[Kling] Polling task ${taskId}...`);

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

    try {
      const response = await axios.get(
        `${CRAZYROUTER_BASE_URL}/kling/v1/videos/image2video/${taskId}`,
        {
          headers: {
            'Authorization': `Bearer ${CRAZYROUTER_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      const data = response.data?.data || response.data;
      const status = data?.task_status || data?.status;
      const elapsed = Math.round((Date.now() - startTime) / 1000);

      console.log(`[Kling] Task ${taskId} | Status: ${status} | Elapsed: ${elapsed}s`);

      if (status === 'succeed' || status === 'completed' || status === 'success') {
        // Extract video URL from response
        const videoUrl =
          data?.task_result?.videos?.[0]?.url ||
          data?.videos?.[0]?.url ||
          data?.video_url ||
          data?.result?.video_url ||
          data?.output?.video_url;

        if (videoUrl) {
          console.log(`[Kling] Task ${taskId} completed! Video URL: ${videoUrl.slice(0, 80)}...`);
          return videoUrl;
        }
        throw new Error('Task succeeded but no video URL found in response: ' + JSON.stringify(data));
      }

      if (status === 'failed' || status === 'error') {
        const errMsg = data?.task_status_msg || data?.error || data?.message || 'Unknown error';
        throw new Error(`Kling task failed: ${errMsg}`);
      }

      // Still processing: continue polling
    } catch (err: any) {
      if (err.message.includes('Kling task failed')) throw err;
      console.warn(`[Kling] Poll error for ${taskId}:`, err.message);
    }
  }

  throw new Error(`Kling task ${taskId} timed out after ${maxWaitMs / 1000}s`);
}

// ─── Download Video to Local File ─────────────────────────────────────────────

export async function downloadVideoToFile(
  videoUrl: string,
  outputPath: string
): Promise<string> {
  console.log(`[Kling] Downloading video to: ${outputPath}`);

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const response = await axios.get(videoUrl, {
    responseType: 'stream',
    timeout: 120000 // 2 min download timeout
  });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);
    writer.on('finish', () => {
      console.log(`[Kling] Video downloaded: ${outputPath}`);
      resolve(outputPath);
    });
    writer.on('error', reject);
  });
}

// ─── Full Pipeline: Image → 3 Kling Clips ─────────────────────────────────────

/**
 * Main entry point: Takes a product image URL, generates 3 cinematic B-roll
 * Kling clips, downloads them locally, and returns paths to all 3.
 */
export async function generateProductBRollClips(
  productImageUrl: string,
  script: string,
  productDescription: string,
  productCategory: string = 'product',
  aspectRatio: string = '9:16',
  outputDir: string
): Promise<string[]> {

  console.log('[Kling Pipeline] Starting B-roll generation for:', productDescription);

  // Step 1: Generate 3 scene prompts via Gemini
  const scenePrompts = await generateKlingScenePrompts(script, productDescription, productCategory);
  console.log('[Kling Pipeline] Generated', scenePrompts.length, 'scene prompts');

  // Step 2: Submit all 3 tasks concurrently
  const taskIds: string[] = [];
  for (let i = 0; i < scenePrompts.length; i++) {
    const taskId = await submitKlingTask(productImageUrl, scenePrompts[i], aspectRatio);
    taskIds.push(taskId);
    // Small delay between submissions to avoid rate limiting
    if (i < scenePrompts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('[Kling Pipeline] All tasks submitted:', taskIds);

  // Step 3: Poll all tasks concurrently
  const videoUrls = await Promise.all(
    taskIds.map((taskId, idx) => pollKlingTask(taskId, 6 * 60 * 1000))
  );

  console.log('[Kling Pipeline] All clips generated! Downloading...');

  // Step 4: Download all clips to local files
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const localPaths: string[] = [];
  for (let i = 0; i < videoUrls.length; i++) {
    const localPath = path.join(outputDir, `broll_${i + 1}.mp4`);
    await downloadVideoToFile(videoUrls[i], localPath);
    localPaths.push(localPath);
  }

  console.log('[Kling Pipeline] All clips downloaded:', localPaths);
  return localPaths;
}
