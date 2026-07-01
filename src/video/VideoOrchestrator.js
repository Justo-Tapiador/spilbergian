/**
 * src/video/VideoOrchestrator.js — Pick the best video provider per shot.
 *
 * Strategy:
 *   1. Try providers in priority order.
 *   2. If a provider fails (or is disabled), fall back to the next.
 *   3. Cost-aware mode: among enabled providers, pick the cheapest for
 *      simple prompts and the highest-quality for hero shots.
 *   4. Caches by prompt+settings hash.
 *
 * All providers expose the same interface (VideoGenerator base), so
 * adding a new provider is one new file + one entry in config.
 */
import { EventEmitter } from 'eventemitter3';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

import { MinimaxVideoGenerator } from './MinimaxVideoGenerator.js';
import { MetaVideoGenerator }   from './MetaVideoGenerator.js';
import { KlingVideoGenerator }  from './KlingVideoGenerator.js';
import { RunwayVideoGenerator } from './RunwayVideoGenerator.js';
import { PikaVideoGenerator }   from './PikaVideoGenerator.js';

const PROVIDER_CLASSES = {
  minimax: MinimaxVideoGenerator,
  meta:    MetaVideoGenerator,
  kling:   KlingVideoGenerator,
  runway:  RunwayVideoGenerator,
  pika:    PikaVideoGenerator,
};

export class VideoOrchestrator extends EventEmitter {
  constructor(videoConfig, assets) {
    super();
    this.config = videoConfig;
    this.assets = assets;
    this.providers = new Map();
    this.cache = new Map();
    this.cacheDir = videoConfig.cacheDir || './data/assets/video';
  }

  async init() {
    await fs.mkdir(this.cacheDir, { recursive: true });
    for (const [name, cfg] of Object.entries(this.config.providers || {})) {
      if (!cfg.enabled) continue;
      const Cls = PROVIDER_CLASSES[name];
      if (!Cls) continue;
      const instance = new Cls(cfg);
      this.providers.set(name, instance);
    }
    // Sort by priority
    this._priorityList = [...this.providers.entries()]
      .sort((a, b) => (a[1].config.priority || 99) - (b[1].config.priority || 99))
      .map(([name]) => name);
  }

  listProviders() {
    return this._priorityList?.map(name => ({
      name,
      priority: this.providers.get(name).config.priority,
      endpoint: this.providers.get(name).config.endpoint,
    })) || [];
  }

  /**
   * Generate one video clip. Tries providers in priority order.
   * @param {Object} p  { shotId, prompt, durationSec, resolution, fps, negativePrompt }
   * @param {string} outPath
   * @returns {Promise<{provider,path,cost,metadata}>}
   */
  async generate(p, outPath) {
    const cacheKey = this._cacheKey(p);
    if (this.config.cacheGeneratedClips && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      await fs.copyFile(cached.path, outPath);
      return { ...cached, path: outPath, cached: true };
    }

    let lastErr;
    for (const name of this._priorityList) {
      const provider = this.providers.get(name);
      try {
        this.emit('provider:try', { provider: name, shotId: p.shotId });
        const result = await provider.generate(p, outPath);
        if (this.config.cacheGeneratedClips) {
          this.cache.set(cacheKey, { path: outPath, provider: name, cost: result.cost });
        }
        this.emit('provider:success', { provider: name, shotId: p.shotId });
        return { provider: name, ...result };
      } catch (err) {
        this.emit('provider:fail', { provider: name, shotId: p.shotId, error: err.message });
        lastErr = err;
      }
    }
    throw new Error(`All video providers failed for shot ${p.shotId}. Last error: ${lastErr?.message}`);
  }

  _cacheKey(p) {
    const key = JSON.stringify({
      prompt: p.prompt,
      duration: p.durationSec,
      resolution: p.resolution,
      fps: p.fps,
      negative: p.negativePrompt,
    });
    return crypto.createHash('sha1').update(key).digest('hex');
  }
}

export default VideoOrchestrator;
