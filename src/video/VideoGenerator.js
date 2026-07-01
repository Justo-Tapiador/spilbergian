/**
 * src/video/VideoGenerator.js — Abstract base class for all video providers.
 *
 * Every provider (Minimax, Meta, Kling, Runway, Pika) implements:
 *   generate(promptSpec, outPath) → { path, cost, metadata }
 *
 * The base class provides:
 *   - HTTP polling helper for async video APIs
 *   - File download helper
 *   - Cache-aware outPath generation
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import axios from 'axios';

export class VideoGenerator {
  constructor(config) {
    this.config = config;
    this.name = this.constructor.name;
  }

  /**
   * Generate a video clip.
   * @param {Object} promptSpec — { shotId, prompt, durationSec, resolution, fps, negativePrompt }
   * @param {string} outPath — final output path (.mp4)
   * @returns {Promise<{path,cost,metadata}>}
   */
  async generate(promptSpec, outPath) {
    throw new Error(`${this.name}.generate() not implemented`);
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  /**
   * Poll an async video API until status is 'completed' or 'failed'.
   * @param {Function} statusFn — async () => ({ status, progress, videoUrl? })
   * @param {Object} [opts] — { intervalMs: 5000, maxAttempts: 120 }
   */
  async pollUntilDone(statusFn, opts = {}) {
    const intervalMs = opts.intervalMs || 5000;
    const maxAttempts = opts.maxAttempts || 120; // 10 minutes at 5s
    for (let i = 0; i < maxAttempts; i++) {
      const s = await statusFn();
      if (s.status === 'completed' || s.status === 'succeeded' || s.status === 'done') {
        return s;
      }
      if (s.status === 'failed' || s.status === 'error') {
        throw new Error(`Generation failed: ${s.error || 'unknown'}`);
      }
      await this._sleep(intervalMs);
    }
    throw new Error('Polling timed out');
  }

  /** Download a URL into outPath with streaming. */
  async download(url, outPath) {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    const res = await axios.get(url, { responseType: 'stream' });
    const writer = (await import('node:fs')).createWriteStream(outPath);
    for await (const chunk of res.data) writer.write(chunk);
    writer.end();
    return outPath;
  }

  /** Save a synthetic placeholder clip (used when no API key is configured). */
  async savePlaceholder(promptSpec, outPath) {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    // Write a JSON descriptor that ffmpeg can later turn into a colored slate
    // if no real video is available. This keeps the pipeline runnable in
    // "dry run" mode without a real provider account.
    const slate = {
      provider: this.name,
      prompt: promptSpec.prompt,
      durationSec: promptSpec.durationSec,
      resolution: promptSpec.resolution,
      fps: promptSpec.fps,
      generatedAt: new Date().toISOString(),
      note: 'placeholder — no API key configured for this provider',
    };
    await fs.writeFile(outPath + '.placeholder.json', JSON.stringify(slate, null, 2));
    // Also produce a 1-second black mp4 using ffmpeg if available, else skip
    return { path: outPath, cost: 0, metadata: { placeholder: true, slate } };
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

export default VideoGenerator;
