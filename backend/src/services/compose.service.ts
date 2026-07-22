import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import axios from 'axios';

const execFileAsync = promisify(execFile);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ComposeOptions {
  bRollClips: string[];       // Local paths to Kling B-roll video clips
  avatarVideoUrl: string;     // HeyGen avatar video URL (mp4)
  outputPath: string;         // Where to save final composed video
  orientation: 'portrait' | 'landscape' | 'square';
  productImagePath?: string;  // Local path to transparent PNG of product
}

// ─── Download Helper ──────────────────────────────────────────────────────────

async function downloadFile(url: string, destPath: string): Promise<string> {
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const response = await axios.get(url, {
    responseType: 'stream',
    timeout: 300000 // 5 min
  });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);
    writer.on('finish', () => resolve(destPath));
    writer.on('error', reject);
  });
}

// ─── Check FFmpeg availability ─────────────────────────────────────────────────

export async function checkFFmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync('ffmpeg', ['-version']);
    return true;
  } catch {
    return false;
  }
}

// ─── Get duration of a video file using FFprobe ───────────────────────────────

export async function getVideoDuration(filePath: string): Promise<number> {
  try {
    const result = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ]);
    return parseFloat(result.stdout.trim()) || 0;
  } catch {
    return 0;
  }
}

// ─── Scalio-Style UGC Ad Compositor ───────────────────────────────────────────

/**
 * Scalio-Style UGC Ad Compositor:
 * Creates professional UGC ad switching between:
 * - Avatar holding product in hand/on table (with speech)
 * - Kling 3D Animated Product B-Roll cuts (with background speech continuing)
 * - Seamless intercut transitions
 */
export async function composeUgcAd(options: ComposeOptions): Promise<string> {
  const { bRollClips, avatarVideoUrl, outputPath, orientation, productImagePath } = options;

  const tmpDir = path.dirname(outputPath);
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const ffmpegAvailable = await checkFFmpegAvailable();
  if (!ffmpegAvailable) {
    console.log('[Compose] FFmpeg not available. Falling back to avatar URL...');
    await downloadFile(avatarVideoUrl, outputPath);
    return outputPath;
  }

  // 1. Download Avatar Video
  const avatarLocalPath = path.join(tmpDir, 'avatar_raw.mp4');
  console.log('[Compose] Downloading avatar video...');
  await downloadFile(avatarVideoUrl, avatarLocalPath);

  const isPortrait = orientation === 'portrait';
  const mainW = isPortrait ? 1080 : 1920;
  const mainH = isPortrait ? 1920 : 1080;

  // 2. Prepare Avatar with Product Placement in Hand / On Desk
  let avatarWithProductPath = path.join(tmpDir, 'avatar_with_product.mp4');

  if (productImagePath && fs.existsSync(productImagePath)) {
    console.log('[Compose] Compositing product cutout into avatar scene...');

    // Scale product to ~28% canvas width, place at bottom-right near avatar hands/desk
    const prodW = Math.round(mainW * 0.28);
    const prodX = Math.round(mainW * 0.65);
    const prodY = Math.round(mainH * 0.62);

    const filterOverlay = [
      `[0:v]scale=${mainW}:${mainH}:force_original_aspect_ratio=increase,crop=${mainW}:${mainH}[bg]`,
      `[1:v]scale=${prodW}:-1[prod]`,
      `[bg][prod]overlay=${prodX}:${prodY}:format=auto[vout]`
    ].join(';');

    await execFileAsync('ffmpeg', [
      '-y',
      '-i', avatarLocalPath,
      '-i', productImagePath,
      '-filter_complex', filterOverlay,
      '-map', '[vout]',
      '-map', '0:a?',
      '-c:v', 'libx264',
      '-crf', '18',
      '-preset', 'fast',
      '-c:a', 'copy',
      avatarWithProductPath
    ]);
  } else {
    // If no product cutout, scale avatar directly
    await execFileAsync('ffmpeg', [
      '-y',
      '-i', avatarLocalPath,
      '-vf', `scale=${mainW}:${mainH}:force_original_aspect_ratio=increase,crop=${mainW}:${mainH}`,
      '-c:v', 'libx264',
      '-crf', '18',
      '-preset', 'fast',
      '-c:a', 'copy',
      avatarWithProductPath
    ]);
  }

  // If no Kling B-roll available, output avatar with product placement directly
  const validBRollClips = bRollClips.filter(c => fs.existsSync(c));
  if (validBRollClips.length === 0) {
    console.log('[Compose] No valid B-roll clips. Outputting avatar scene directly...');
    fs.copyFileSync(avatarWithProductPath, outputPath);
    return outputPath;
  }

  console.log(`[Compose] Intercutting avatar video with ${validBRollClips.length} Kling B-roll clips...`);

  // 3. Scalio Intercut Logic:
  // Split narration into intercut segments:
  //   Shot 1: Avatar introduction (0s to 4s)
  //   Shot 2: Kling B-roll 1 (4s to 9s)
  //   Shot 3: Avatar presentation (9s to 14s)
  //   Shot 4: Kling B-roll 2 (14s to 19s)
  //   Shot 5: Avatar CTA (19s to end)

  const totalDuration = await getVideoDuration(avatarWithProductPath) || 25;
  console.log(`[Compose] Total video duration: ${totalDuration}s`);

  // Extract separate audio track to keep voiceover continuous
  const continuousAudioPath = path.join(tmpDir, 'voiceover.aac');
  await execFileAsync('ffmpeg', [
    '-y',
    '-i', avatarWithProductPath,
    '-vn',
    '-c:a', 'aac',
    '-b:a', '192k',
    continuousAudioPath
  ]);

  // Scale all B-roll clips to main canvas size
  const scaledBRollPaths: string[] = [];
  for (let i = 0; i < validBRollClips.length; i++) {
    const scaledPath = path.join(tmpDir, `broll_scaled_${i}.mp4`);
    await execFileAsync('ffmpeg', [
      '-y',
      '-i', validBRollClips[i],
      '-vf', `scale=${mainW}:${mainH}:force_original_aspect_ratio=increase,crop=${mainW}:${mainH}`,
      '-c:v', 'libx264',
      '-crf', '18',
      '-preset', 'fast',
      '-an',
      scaledPath
    ]);
    scaledBRollPaths.push(scaledPath);
  }

  // Create intercut segments list
  const segmentFiles: string[] = [];

  // Segment 1: Avatar intro (0 - 4s)
  const seg1 = path.join(tmpDir, 'seg_1.mp4');
  await execFileAsync('ffmpeg', [
    '-y', '-ss', '0', '-to', '4', '-i', avatarWithProductPath,
    '-c:v', 'libx264', '-an', seg1
  ]);
  segmentFiles.push(seg1);

  // Segment 2: Kling B-Roll 1 (4 - 9s)
  if (scaledBRollPaths[0]) {
    const seg2 = path.join(tmpDir, 'seg_2.mp4');
    await execFileAsync('ffmpeg', [
      '-y', '-ss', '0', '-to', '5', '-i', scaledBRollPaths[0],
      '-c:v', 'libx264', '-an', seg2
    ]);
    segmentFiles.push(seg2);
  }

  // Segment 3: Avatar mid-talk (9 - 14s)
  if (totalDuration > 9) {
    const seg3 = path.join(tmpDir, 'seg_3.mp4');
    const seg3End = Math.min(14, totalDuration);
    await execFileAsync('ffmpeg', [
      '-y', '-ss', '9', '-to', String(seg3End), '-i', avatarWithProductPath,
      '-c:v', 'libx264', '-an', seg3
    ]);
    segmentFiles.push(seg3);
  }

  // Segment 4: Kling B-Roll 2 (14 - 19s)
  const bRoll2 = scaledBRollPaths[1] || scaledBRollPaths[0];
  if (totalDuration > 14 && bRoll2) {
    const seg4 = path.join(tmpDir, 'seg_4.mp4');
    await execFileAsync('ffmpeg', [
      '-y', '-ss', '0', '-to', '5', '-i', bRoll2,
      '-c:v', 'libx264', '-an', seg4
    ]);
    segmentFiles.push(seg4);
  }

  // Segment 5: Avatar CTA (19s to end)
  if (totalDuration > 19) {
    const seg5 = path.join(tmpDir, 'seg_5.mp4');
    await execFileAsync('ffmpeg', [
      '-y', '-ss', '19', '-to', String(totalDuration), '-i', avatarWithProductPath,
      '-c:v', 'libx264', '-an', seg5
    ]);
    segmentFiles.push(seg5);
  }

  // Concatenate all visual segments
  const concatTxt = path.join(tmpDir, 'intercut_concat.txt');
  fs.writeFileSync(concatTxt, segmentFiles.map(f => `file '${f}'`).join('\n'));

  const intercutVisualsPath = path.join(tmpDir, 'intercut_visuals.mp4');
  await execFileAsync('ffmpeg', [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatTxt,
    '-c:v', 'libx264',
    '-crf', '18',
    '-preset', 'medium',
    intercutVisualsPath
  ]);

  // Combine intercut visuals + continuous voiceover audio
  console.log('[Compose] Merging intercut visuals with continuous voiceover...');

  await execFileAsync('ffmpeg', [
    '-y',
    '-i', intercutVisualsPath,
    '-i', continuousAudioPath,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    '-movflags', '+faststart',
    outputPath
  ]);

  console.log('[Compose] Scalio-style UGC ad composition complete:', outputPath);
  return outputPath;
}

// ─── Add text overlay / captions ─────────────────────────────────────────────

export async function addCaptionOverlay(
  inputPath: string,
  outputPath: string,
  hookText: string
): Promise<string> {
  const ffmpegAvailable = await checkFFmpegAvailable();
  if (!ffmpegAvailable || !hookText) return inputPath;

  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-i', inputPath,
      '-vf', `drawtext=text='${hookText.replace(/'/g, "\\'")}':fontsize=52:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h*0.08:enable='between(t,0,3)'`,
      '-c:a', 'copy',
      '-c:v', 'libx264',
      '-preset', 'fast',
      outputPath
    ]);
    return outputPath;
  } catch (err: any) {
    console.warn('[Compose] Caption overlay failed:', err.message);
    return inputPath;
  }
}
