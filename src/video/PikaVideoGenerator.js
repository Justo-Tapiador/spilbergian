/**
 * src/video/PikaVideoGenerator.js — Pika 1.5 integration.
 * (Disabled by default in config; enable when you have an account.)
 */
import axios from 'axios';
import { VideoGenerator } from './VideoGenerator.js';

export class PikaVideoGenerator extends VideoGenerator {
  constructor(config) {
    super(config);
    this.apiKey   = process.env.PIKA_API_KEY || config.apiKey;
    this.endpoint = config.endpoint || 'https://api.pika.art/v1';
  }

  async generate(promptSpec, outPath) {
    if (!this.apiKey) {
      return this.savePlaceholder(promptSpec, outPath);
    }
    const submitRes = await axios.post(
      `${this.endpoint}/generate`,
      {
        promptText: promptSpec.prompt,
        options: {
          duration: promptSpec.durationSec || 5,
          resolution: this.config.defaultResolution || '1280x720',
          aspectRatio: '16:9',
          motion: 5,
        },
      },
      { headers: this._headers(), timeout: 30_000 },
    );
    const taskId = submitRes.data?.id || submitRes.data?.taskId;
    if (!taskId) throw new Error(`Pika: no task id: ${JSON.stringify(submitRes.data)}`);

    const finalState = await this.pollUntilDone(async () => {
      const r = await axios.get(`${this.endpoint}/generate/${taskId}`, {
        headers: this._headers(), timeout: 15_000,
      });
      const s = r.data || {};
      return {
        status:   (s.status || 'processing').toLowerCase(),
        progress: s.progress,
        videoUrl: s.url || s.video_url,
      };
    }, { intervalMs: 5000, maxAttempts: 120 });

    if (!finalState.videoUrl) throw new Error('Pika: no video URL');
    await this.download(finalState.videoUrl, outPath);
    return {
      path: outPath,
      cost: (promptSpec.durationSec || 5) * 0.15,
      metadata: { provider: 'pika', taskId, raw: finalState },
    };
  }

  _headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }
}

export default PikaVideoGenerator;
