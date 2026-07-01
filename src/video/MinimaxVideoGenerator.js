/**
 * src/video/MinimaxVideoGenerator.js — Minimax (Hailuo) video generation.
 *
 * API docs (reference): https://api.minimax.chat/v1/video_generation
 * Authentication: Bearer <MINIMAX_API_KEY>
 *
 * Flow:
 *   POST /v1/video_generation  → returns a task_id
 *   GET  /v1/query/video_generation?task_id=...  → poll until status=Success
 *   Download the returned file_id via /v1/files/retrieve
 */
import axios from 'axios';
import { VideoGenerator } from './VideoGenerator.js';

export class MinimaxVideoGenerator extends VideoGenerator {
  constructor(config) {
    super(config);
    this.apiKey  = process.env.MINIMAX_API_KEY || config.apiKey;
    this.groupId = process.env.MINIMAX_GROUP_ID || config.groupId;
    this.endpoint = config.endpoint || 'https://api.minimax.chat/v1';
  }

  async generate(promptSpec, outPath) {
    if (!this.apiKey) {
      return this.savePlaceholder(promptSpec, outPath);
    }
    // 1. Submit generation task
    const submitRes = await axios.post(
      `${this.endpoint}/video_generation`,
      {
        model: this.config.model || 'video-01',
        prompt: promptSpec.prompt,
        duration: promptSpec.durationSec || 8,
        resolution: this.config.defaultResolution || promptSpec.resolution,
      },
      {
        headers: this._headers(),
        timeout: 30_000,
      },
    );
    const taskId = submitRes.data?.task_id;
    if (!taskId) throw new Error(`Minimax: no task_id in response: ${JSON.stringify(submitRes.data)}`);

    // 2. Poll for completion
    const finalState = await this.pollUntilDone(async () => {
      const r = await axios.get(
        `${this.endpoint}/query/video_generation?task_id=${taskId}`,
        { headers: this._headers(), timeout: 15_000 },
      );
      const s = r.data || {};
      return {
        status:    s.status?.toLowerCase() || 'processing',
        progress:  s.progress,
        videoUrl:  s.file?.download_url || (s.file_id ? `${this.endpoint}/files/retrieve?file_id=${s.file_id}` : null),
      };
    }, { intervalMs: 5000, maxAttempts: 120 });

    if (!finalState.videoUrl) throw new Error('Minimax: no video URL in completed task');
    await this.download(finalState.videoUrl, outPath);

    return {
      path: outPath,
      cost: this._estimateCost(promptSpec),
      metadata: { provider: 'minimax', taskId, raw: finalState },
    };
  }

  _headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...(this.groupId ? { 'GroupId': this.groupId } : {}),
    };
  }

  _estimateCost(promptSpec) {
    // Rough Minimax pricing: ~$0.10 per second of 720p video
    return (promptSpec.durationSec || 8) * 0.10;
  }
}

export default MinimaxVideoGenerator;
