/**
 * src/audio/SunoGenerator.js — Suno soundtrack generation.
 *
 * Authentication: Bearer <SUNO_API_KEY>
 * Reference: https://platform.suno.ai/
 *
 * Flow:
 *   POST /v1/generate  → returns { clip_id }
 *   GET  /v1/generation/{clip_id} → poll until status=completed
 *   Download audio_url
 */
import axios from 'axios';
import { AudioGenerator } from './AudioGenerator.js';

export class SunoGenerator extends AudioGenerator {
  constructor(config) {
    super(config);
    this.apiKey   = process.env.SUNO_API_KEY || config.apiKey;
    this.endpoint = config.endpoint || 'https://api.suno.ai/v1';
  }

  async generate(promptSpec, outPath) {
    if (!this.apiKey) return this.savePlaceholder(promptSpec, outPath);

    const submitRes = await axios.post(
      `${this.endpoint}/generate`,
      {
        prompt: promptSpec.prompt,
        duration: promptSpec.durationSec || 30,
        instrumental: true,
        model: this.config.model || 'chirp-v3.5',
        is_public: false,
      },
      { headers: this._headers(), timeout: 30_000 },
    );
    const clipId = submitRes.data?.clip_id || submitRes.data?.id;
    if (!clipId) throw new Error(`Suno: no clip_id: ${JSON.stringify(submitRes.data)}`);

    const finalState = await this._poll(async () => {
      const r = await axios.get(`${this.endpoint}/generation/${clipId}`, {
        headers: this._headers(), timeout: 15_000,
      });
      const s = r.data || {};
      return {
        status: (s.status || 'generating').toLowerCase(),
        progress: s.progress,
        audioUrl: s.audio_url || s.url,
      };
    }, { intervalMs: 4000, maxAttempts: 150 });

    if (!finalState.audioUrl) throw new Error('Suno: no audio URL');
    await this.download(finalState.audioUrl, outPath);
    return { path: outPath, provider: 'suno', cost: this._estimate(promptSpec), metadata: { clipId } };
  }

  _headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  _estimate(p) { return ((p.durationSec || 30) / 30) * 0.25; }

  async _poll(statusFn, opts) {
    const intervalMs = opts.intervalMs || 4000;
    const maxAttempts = opts.maxAttempts || 150;
    for (let i = 0; i < maxAttempts; i++) {
      const s = await statusFn();
      if (s.status === 'completed' || s.status === 'succeeded' || s.status === 'done') return s;
      if (s.status === 'failed' || s.status === 'error') throw new Error(`Suno generation failed: ${s.error || ''}`);
      await this._sleep(intervalMs);
    }
    throw new Error('Suno polling timed out');
  }
}

export default SunoGenerator;
