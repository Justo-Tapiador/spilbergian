/**
 * src/video/RunwayVideoGenerator.js — Runway Gen-3 Alpha integration.
 * (Disabled by default in config; enable when you have an account.)
 */
import axios from 'axios';
import { VideoGenerator } from './VideoGenerator.js';

export class RunwayVideoGenerator extends VideoGenerator {
  constructor(config) {
    super(config);
    this.apiKey   = process.env.RUNWAY_API_KEY || config.apiKey;
    this.endpoint = config.endpoint || 'https://api.runwayml.com/v1';
  }

  async generate(promptSpec, outPath) {
    if (!this.apiKey) {
      return this.savePlaceholder(promptSpec, outPath);
    }
    const submitRes = await axios.post(
      `${this.endpoint}/generate`,
      {
        model: this.config.model || 'gen-3-alpha',
        promptText: promptSpec.prompt,
        seconds: promptSpec.durationSec || 10,
        resolution: this.config.defaultResolution || '1920x1080',
        options: { motion: 5, seed: null },
      },
      { headers: this._headers(), timeout: 30_000 },
    );
    const taskId = submitRes.data?.id || submitRes.data?.taskId;
    if (!taskId) throw new Error(`Runway: no task id: ${JSON.stringify(submitRes.data)}`);

    const finalState = await this.pollUntilDone(async () => {
      const r = await axios.get(`${this.endpoint}/generate/${taskId}`, {
        headers: this._headers(), timeout: 15_000,
      });
      const s = r.data || {};
      return {
        status:   (s.status || 'processing').toLowerCase(),
        progress: s.progress,
        videoUrl: s.output?.[0] || s.video_url,
      };
    }, { intervalMs: 7000, maxAttempts: 120 });

    if (!finalState.videoUrl) throw new Error('Runway: no video URL');
    await this.download(finalState.videoUrl, outPath);
    return {
      path: outPath,
      cost: (promptSpec.durationSec || 10) * 0.50,
      metadata: { provider: 'runway', taskId, raw: finalState },
    };
  }

  _headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'X-Runway-Version': '2024-11-06',
    };
  }
}

export default RunwayVideoGenerator;
