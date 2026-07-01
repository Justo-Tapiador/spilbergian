/**
 * src/video/KlingVideoGenerator.js — Kuaishou Kling (kling-v2) integration.
 * https://klingai.com/developer
 *
 * Flow:
 *   POST /v1/kling/video      → returns task_id
 *   GET  /v1/kling/video/{id} → poll until status=succeed
 *   Download videos[0].url
 */
import axios from 'axios';
import { VideoGenerator } from './VideoGenerator.js';

export class KlingVideoGenerator extends VideoGenerator {
  constructor(config) {
    super(config);
    this.apiKey   = process.env.KLING_API_KEY || config.apiKey;
    this.endpoint = config.endpoint || 'https://api.kuaishoux.com/v1';
  }

  async generate(promptSpec, outPath) {
    if (!this.apiKey) {
      return this.savePlaceholder(promptSpec, outPath);
    }
    const submitRes = await axios.post(
      `${this.endpoint}/kling/video`,
      {
        model: this.config.model || 'kling-v2',
        prompt: promptSpec.prompt,
        negative_prompt: promptSpec.negativePrompt || '',
        duration: promptSpec.durationSec || 5,
        aspect_ratio: '16:9',
        mode: 'std',         // std | pro
        callback_url: null,
      },
      { headers: this._headers(), timeout: 30_000 },
    );
    const taskId = submitRes.data?.data?.id || submitRes.data?.task_id;
    if (!taskId) throw new Error(`Kling: no task id: ${JSON.stringify(submitRes.data)}`);

    const finalState = await this.pollUntilDone(async () => {
      const r = await axios.get(`${this.endpoint}/kling/video/${taskId}`, {
        headers: this._headers(), timeout: 15_000,
      });
      const s = r.data?.data || r.data || {};
      return {
        status:   (s.task_status || s.status || 'processing').toLowerCase(),
        progress: s.progress,
        videoUrl: s.videos?.[0]?.url || s.video_url,
      };
    }, { intervalMs: 6000, maxAttempts: 120 });

    if (!finalState.videoUrl) throw new Error('Kling: no video URL in completed task');
    await this.download(finalState.videoUrl, outPath);

    return {
      path: outPath,
      cost: (promptSpec.durationSec || 5) * 0.20,
      metadata: { provider: 'kling', taskId, raw: finalState },
    };
  }

  _headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }
}

export default KlingVideoGenerator;
