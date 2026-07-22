import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import axios from 'axios';

const execFileAsync = promisify(execFile);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ComposeOptions {
  bRollClips: string[];       // Local paths to B-roll video clips
  avatarVideoUrl: string;     // HeyGen avatar video URL (mp4)
  outputPath: string;         // Where to save the final composed video
  orientation: 'portrait' | 'landscape' | 'square';
  productImagePath?: string;  // Optional: product image for end card
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

// ─── Compose: B-Roll + Avatar PiP ─────────────────────────────────────────────

/**
 * Composes the final UGC ad video:
 * - Concatenates 3 Kling B-roll clips
 * - Downloads & overlays HeyGen avatar as a PiP in the corner
 * - Produces a polished, social-media ready MP4
 */
export async function composeUgcAd(options: ComposeOptions): Promise<string> {
  const { bRollClips, avatarVideoUrl, outputPath, orientation } = options;

  const tmpDir = path.dirname(outputPath);
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const ffmpegAvailable = await checkFFmpegAvailable();

  // ── Strategy 1: Full FFmpeg composition (if ffmpeg is available) ──────────
  if (ffmpegAvailable && bRollClips.length > 0) {
    console.log('[Compose] FFmpeg available. Starting full composition...');

    // Download avatar video
    const avatarLocalPath = path.join(tmpDir, 'avatar.mp4');
    console.log('[Compose] Downloading avatar video from HeyGen...');
    await downloadFile(avatarVideoUrl, avatarLocalPath);

    // Verify all B-roll clips exist
    for (const clip of bRollClips) {
      if (!fs.existsSync(clip)) {
        throw new Error(`B-roll clip not found: ${clip}`);
      }
    }

    // Calculate dimensions based on orientation
    const isPortrait = orientation === 'portrait';
    const mainW = isPortrait ? 1080 : 1920;
    const mainH = isPortrait ? 1920 : 1080;

    // Avatar PiP: 35% width, positioned in bottom-right corner
    const pipW = Math.round(mainW * 0.35);
    const pipH = Math.round(pipW * (isPortrait ? 1.5 : 0.75));
    const pipX = mainW - pipW - 20; // 20px from right edge
    const pipY = mainH - pipH - 20; // 20px from bottom edge

    console.log(`[Compose] Canvas: ${mainW}x${mainH} | PiP: ${pipW}x${pipH} at (${pipX},${pipY})`);

    // Step 1: Concatenate all B-roll clips
    const concatListPath = path.join(tmpDir, 'concat_list.txt');
    const concatContent = bRollClips.map(p => `file '${p}'`).join('\n');
    fs.writeFileSync(concatListPath, concatContent);

    const concatenatedPath = path.join(tmpDir, 'broll_concat.mp4');
    console.log('[Compose] Concatenating B-roll clips...');

    await execFileAsync('ffmpeg', [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c:v', 'libx264',
      '-crf', '20',
      '-preset', 'fast',
      '-an', // Remove audio from B-roll
      concatenatedPath
    ]);

    console.log('[Compose] B-roll concatenated. Now compositing with avatar...');

    // Step 2: Scale concatenated B-roll to main canvas size
    const scaledBRollPath = path.join(tmpDir, 'broll_scaled.mp4');
    await execFileAsync('ffmpeg', [
      '-y',
      '-i', concatenatedPath,
      '-vf', `scale=${mainW}:${mainH}:force_original_aspect_ratio=increase,crop=${mainW}:${mainH}`,
      '-c:v', 'libx264',
      '-crf', '20',
      '-preset', 'fast',
      '-an',
      scaledBRollPath
    ]);

    // Step 3: Composite: B-roll background + Avatar PiP + cinematic grade
    console.log('[Compose] Final compositing...');

    const filterComplex = [
      // Scale avatar to PiP size
      `[1:v]scale=${pipW}:${pipH}:force_original_aspect_ratio=increase,crop=${pipW}:${pipH}[avatar_scaled]`,
      // Add rounded corners + drop shadow to avatar PiP
      `[avatar_scaled]format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(gt(hypot(X-${Math.round(pipW/2)},Y-${Math.round(pipH/2)}),${Math.round(Math.min(pipW,pipH)/2)-2}),0,255)'[avatar_circle]`,
      // Overlay avatar on B-roll background
      `[0:v][avatar_circle]overlay=${pipX}:${pipY}:format=auto[vout]`
    ].join(';');

    await execFileAsync('ffmpeg', [
      '-y',
      '-i', scaledBRollPath,    // Input 0: B-roll
      '-i', avatarLocalPath,    // Input 1: Avatar
      '-filter_complex', filterComplex,
      '-map', '[vout]',
      '-map', '1:a',            // Use avatar audio
      '-c:v', 'libx264',
      '-crf', '18',
      '-preset', 'medium',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart', // Optimise for web streaming
      '-shortest',               // End when shortest stream ends
      outputPath
    ]);

    console.log('[Compose] Full composition complete:', outputPath);

    // Clean up temp files
    try {
      fs.unlinkSync(concatListPath);
      fs.unlinkSync(concatenatedPath);
      fs.unlinkSync(scaledBRollPath);
      fs.unlinkSync(avatarLocalPath);
    } catch { /* Ignore cleanup errors */ }

    return outputPath;
  }

  // ── Strategy 2: Simple concat fallback (no avatar PiP, just B-roll with audio) ──
  if (ffmpegAvailable && bRollClips.length > 0) {
    console.log('[Compose] Fallback: Concatenate B-roll only with avatar audio...');

    const avatarLocalPath = path.join(tmpDir, 'avatar_audio.mp4');
    await downloadFile(avatarVideoUrl, avatarLocalPath);

    const concatListPath = path.join(tmpDir, 'concat_list2.txt');
    fs.writeFileSync(concatListPath, bRollClips.map(p => `file '${p}'`).join('\n'));

    await execFileAsync('ffmpeg', [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-i', avatarLocalPath,
      '-map', '0:v',
      '-map', '1:a',
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-shortest',
      outputPath
    ]);

    return outputPath;
  }

  // ── Strategy 3: Avatar-only fallback (no B-roll, just the avatar video) ──
  console.log('[Compose] No B-roll or FFmpeg available. Using avatar video directly...');
  await downloadFile(avatarVideoUrl, outputPath);
  return outputPath;
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
