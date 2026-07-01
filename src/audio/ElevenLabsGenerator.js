/**
 * src/audio/ElevenLabsGenerator.js — Voiceover + SFX via ElevenLabs.
 *
 * Authentication: xi-api-key header (ELEVENLABS_API_KEY)
 * Reference: https://elevenlabs.io/docs/api-reference
 *
 * Capabilities:
 *   - text-to-speech (TTS) with voice profiles
 *   - sound-effect generation (SFX API, model: eleven_v3)
 */
import axios from 'axios';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AudioGenerator } from './AudioGenerator.js';

export class ElevenLabsGenerator extends AudioGenerator {
  constructor(config, voiceProfiles = {}) {
    super(config);
    this.apiKey        = process.env.ELEVENLABS_API_KEY || config.apiKey;
    this.endpoint      = config.endpoint || 'https://api.elevenlabs.io/v1';
    this.model         = config.model || 'eleven_turbo_v2';
    this.defaultVoice  = config.defaultVoice || 'Adam';
    this.voiceProfiles = voiceProfiles;
  }

  /**
   * @param {Object} spec  { text, voiceProfile, language }
   * @param {string|Function} outPathOrFn — either a string path or a fn(outPath) => string
   * @returns {Promise<string>} resolved outPath
   */
  async generate(spec, outPathOrFn) {
    if (!this.apiKey) {
      const fakePath = typeof outPathOrFn === 'function' ? outPathOrFn() : outPathOrFn;
      return (await this.savePlaceholder({ prompt: spec.text }, fakePath)).path;
    }

    const profile = this.voiceProfiles[spec.voiceProfile] || {
      voice: this.defaultVoice,
      stability: 0.55,
      similarity: 0.75,
      style: 0.35,
    };
    const outPath = typeof outPathOrFn === 'function' ? outPathOrFn() : outPathOrFn;
    await fs.mkdir(path.dirname(outPath), { recursive: true });

    const url = `${this.endpoint}/text-to-speech/${profile.voice}`;
    const res = await axios.post(
      url,
      {
        text: spec.text,
        model_id: this.model,
        voice_settings: {
          stability: profile.stability,
          similarity_boost: profile.similarity,
          style: profile.style,
          use_speaker_boost: true,
        },
        language_code: spec.language === 'es' ? 'es' : 'en',
      },
      {
        headers: this._headers(),
        responseType: 'stream',
        timeout: 60_000,
      },
    );

    const writer = (await import('node:fs')).createWriteStream(outPath);
    for await (const chunk of res.data) writer.write(chunk);
    writer.end();
    return outPath;
  }

  /**
   * Generate a sound effect from a prompt.
   * @param {string} prompt — e.g. "distant thunder roll, cinematic, deep"
   * @param {string} outPath
   */
  async generateSfx(prompt, outPath) {
    if (!this.apiKey) {
      return (await this.savePlaceholder({ prompt }, outPath)).path;
    }
    await fs.mkdir(path.dirname(outPath), { recursive: true });

    const res = await axios.post(
      `${this.endpoint}/sound-generation`,
      {
        text: prompt,
        duration_seconds: null, // auto
        prompt_influence: 0.3,
      },
      {
        headers: this._headers(),
        responseType: 'stream',
        timeout: 60_000,
      },
    );

    const writer = (await import('node:fs')).createWriteStream(outPath);
    for await (const chunk of res.data) writer.write(chunk);
    writer.end();
    return outPath;
  }

  _headers() {
    return {
      'xi-api-key':  this.apiKey,
      'Content-Type': 'application/json',
      'Accept':       'audio/mpeg',
    };
  }
}

export default ElevenLabsGenerator;
