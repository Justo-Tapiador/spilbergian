/**
 * src/video/MetaVideoGenerator.js — Meta Movie Gen / Emu Video generation.
 *
 * Meta's video generation API is exposed via the Meta AI developer API.
 * Authentication: Bearer <META_AI_API_KEY>
 *
 * Flow:
 *   POST /v1/movie-gen    → submits generation, returns job_id
 *   GET  /v1/movie-gen/{job_id} → poll until status=ready
 *   Download result_url
 */
import axios from 'axios';
import { VideoGenerator } from './VideoGenerator.js';

export class MetaVideoGenerator extends VideoGenerator {
  constructor(config) {
    super(config);
    this.apiKey   = process.env.META_AI_API_KEY || config.apiKey;
    this.endpoint = config.endpoint || 'https://api.meta.ai/v1';
  }

  async generate(promptSpec, outPath) {
    if (!this.apiKey) {
      return this.savePlaceholder(promptSpec, outPath);
    }

    // 1. Submit
    const submitRes = await axios.post(
      `${this.endpoint}/movie-gen`,
      {
        model: this.config.model || 'movie-gen-2',
        prompt: promptSpec.prompt,
        negative_prompt: promptSpec.negativePrompt || '',
        duration_s: promptSpec.durationSec || 8,
        resolution: this.config.defaultResolution || promptSpec.resolution,
        fps: promptSpec.fps || 30,
        aspect_ratio: promptSpec.aspectRatio || '16:9',
        style: 'cinematic_photorealistic',
      },
      { headers: this._headers(), timeout: 30_000 },
    );
    const jobId = submitRes.data?.id || submitRes.data?.job_id;
    if (!jobId) throw new Error(`Meta: no job id: ${JSON.stringify(submitRes.data)}`);

    // 2. Poll
    const finalState = await this.pollUntilDone(async () => {
      const r = await axios.get(`${this.endpoint}/movie-gen/${jobId}`, {
        headers: this._headers(), timeout: 15_000,
      });
      const s = r.data || {};
      return {
        status:   (s.status || 'processing').toLowerCase(),
        progress: s.progress,
        videoUrl: s.result_url || s.video_url,
      };
    }, { intervalMs: 8000, maxAttempts: 150 });

    if (!finalState.videoUrl) throw new Error('Meta: no video URL in completed job');
    await this.download(finalState.videoUrl, outPath);

    return {
      path: outPath,
      cost: this._estimateCost(promptSpec),
      metadata: { provider: 'meta', jobId, raw: finalState },
    };
  }

  _headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  _estimateCost(promptSpec) {
    // Meta Movie Gen estimated pricing: ~$0.35/sec for 1080p
    return (promptSpec.durationSec || 8) * 0.35;
  }
}

export default MetaVideoGenerator;
