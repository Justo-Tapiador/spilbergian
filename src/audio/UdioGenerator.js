/**
 * src/audio/UdioGenerator.js — Udio soundtrack generation.
 *
 * Authentication: Bearer <UDIO_API_KEY>
 * Reference: https://www.udio.com/developers (account required)
 *
 * Flow:
 *   POST /v1/generate  → returns { song_id }
 *   GET  /v1/song/{id} → poll until status=completed
 *   Download wav/mp3 url
 */
import axios from 'axios';
import { AudioGenerator } from './AudioGenerator.js';

export class UdioGenerator extends AudioGenerator {
  constructor(config) {
    super(config);
    this.apiKey   = process.env.UDIO_API_KEY || config.apiKey;
    this.endpoint = config.endpoint || 'https://api.udio.com/v1';
  }

  async generate(promptSpec, outPath) {
    if (!this.apiKey) return this.savePlaceholder(promptSpec, outPath);

    // 1. Submit
    const submitRes = await axios.post(
      `${this.endpoint}/generate`,
      {
        prompt: promptSpec.prompt,
        duration_seconds: promptSpec.durationSec || 30,
        instrumental: true,
        model: this.config.model || 'udio-v1.5',
      },
      { headers: this._headers(), timeout: 30_000 },
    );
    const songId = submitRes.data?.song_id || submitRes.data?.id;
    if (!songId) throw new Error(`Udio: no song_id: ${JSON.stringify(submitRes.data)}`);

    // 2. Poll
    const finalState = await this._poll(async () => {
      const r = await axios.get(`${this.endpoint}/song/${songId}`, {
        headers: this._headers(), timeout: 15_000,
      });
      const s = r.data || {};
      return {
        status: (s.status || 'generating').toLowerCase(),
        progress: s.progress,
        audioUrl: s.audio_url || s.url,
      };
    }, { intervalMs: 5000, maxAttempts: 120 });

    if (!finalState.audioUrl) throw new Error('Udio: no audio URL');
    await this.download(finalState.audioUrl, outPath);
    return { path: outPath, provider: 'udio', cost: this._estimate(promptSpec), metadata: { songId } };
  }

  _headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  _estimate(p) { return ((p.durationSec || 30) / 30) * 0.30; } // ~$0.30 per 30s

  async _poll(statusFn, opts) {
    const intervalMs = opts.intervalMs || 5000;
    const maxAttempts = opts.maxAttempts || 120;
    for (let i = 0; i < maxAttempts; i++) {
      const s = await statusFn();
      if (s.status === 'completed' || s.status === 'succeeded' || s.status === 'done') return s;
      if (s.status === 'failed' || s.status === 'error') throw new Error(`Udio generation failed: ${s.error || ''}`);
      await this._sleep(intervalMs);
    }
    throw new Error('Udio polling timed out');
  }
}

export default UdioGenerator;
