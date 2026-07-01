/**
 * src/pipeline/RenderQueue.js — Concurrent render queue for video shots.
 *
 * Manages parallel rendering of multiple shots across the available video
 * providers. Respects maxConcurrentRenders from config, falls back to the
 * next provider when one fails, and caches by prompt-hash for re-use.
 */
import { EventEmitter } from 'eventemitter3';
import path from 'node:path';
import crypto from 'node:crypto';

export class RenderQueue extends EventEmitter {
  constructor(videoOrchestrator, metrics) {
    super();
    this.videoOrch = videoOrchestrator;
    this.metrics   = metrics;
    this.maxConcurrent = videoOrchestrator.config?.maxConcurrentRenders || 3;
  }

  /**
   * @param {Array<{shotId,prompt,durationSec,resolution,fps,negativePrompt}>} prompts
   * @param {string} projectDir — where to save generated clips
   * @returns {Promise<Array>} render results with path / provider / status
   */
  async run(prompts, projectDir) {
    const results = new Array(prompts.length);
    let cursor = 0;
    let completed = 0;

    const worker = async () => {
      while (cursor < prompts.length) {
        const idx = cursor++;
        const p = prompts[idx];
        try {
          const filename = `${p.shotId}_${this._hash(p.prompt).slice(0, 8)}.mp4`;
          const outPath  = path.join(projectDir, 'video', filename);
          const result   = await this.videoOrch.generate(p, outPath);
          results[idx] = {
            shotId:      p.shotId,
            prompt:      p.prompt,
            provider:    result.provider,
            path:        result.path,
            durationSec: p.durationSec,
            status:      'ok',
            cost:        result.cost || null,
            metadata:    result.metadata || {},
          };
          this.emit('shot:complete', results[idx]);
        } catch (err) {
          results[idx] = {
            shotId: p.shotId,
            prompt: p.prompt,
            status: 'error',
            error:  err.message,
            provider: null,
            path:   null,
            durationSec: p.durationSec,
          };
          this.emit('shot:error', results[idx]);
        }
        completed++;
        this.emit('progress', { completed, total: prompts.length });
      }
    };

    const workers = Array.from({ length: Math.min(this.maxConcurrent, prompts.length) }, () => worker());
    await Promise.all(workers);
    return results;
  }

  _hash(text) {
    return crypto.createHash('sha1').update(text).digest('hex');
  }
}

export default RenderQueue;
