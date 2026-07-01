/**
 * src/audio/AudioMixer.js — Compose the full audio bed for a movie.
 *
 * Produces three layers and mixes them with ffmpeg:
 *   1. Soundtrack (Udio or Suno)  — instrumental, full length
 *   2. Voiceover (ElevenLabs)     — per-scene narration
 *   3. SFX (ElevenLabs sound-effects API or pre-rendered library)
 *
 * Output: a single mastered audio track at sample_rate / format from config.
 */
import { EventEmitter } from 'eventemitter3';
import path from 'node:path';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { UdioGenerator }         from './UdioGenerator.js';
import { SunoGenerator }         from './SunoGenerator.js';
import { ElevenLabsGenerator }   from './ElevenLabsGenerator.js';

const execFileP = promisify(execFile);

export class AudioMixer extends EventEmitter {
  constructor(audioConfig, assets) {
    super();
    this.config = audioConfig;
    this.assets = assets;
    this.udio     = new UdioGenerator(audioConfig.providers?.udio || {});
    this.suno     = new SunoGenerator(audioConfig.providers?.suno || {});
    this.eleven   = new ElevenLabsGenerator(audioConfig.providers?.elevenlabs || {}, audioConfig.voiceProfiles || {});
  }

  async init() {
    await fs.mkdir(this.config.cacheDir || './data/assets/audio', { recursive: true });
  }

  /**
   * @param {Object} plan — MoviePlan from CinematicBrain
   * @param {string} projectDir — where to save audio
   * @returns {Promise<Object>} { soundtrackPath, voiceoverPaths, sfxPaths, mixedPath, durationSec }
   */
  async compose(plan, projectDir) {
    const audioDir = path.join(projectDir, 'audio');
    await fs.mkdir(audioDir, { recursive: true });

    this.emit('audio:phase', 'soundtrack');
    const soundtrackPath = await this._composeSoundtrack(plan, audioDir);

    this.emit('audio:phase', 'voiceover');
    const voiceoverPaths = await this._composeVoiceovers(plan, audioDir);

    this.emit('audio:phase', 'sfx');
    const sfxPaths = await this._composeSfx(plan, audioDir);

    this.emit('audio:phase', 'mix');
    const mixedPath = path.join(audioDir, 'final_mix.mp3');
    await this._mix({
      soundtrack: soundtrackPath,
      voiceovers: voiceoverPaths.map(v => v.path),
      sfx:        sfxPaths.map(s => s.path),
      outPath:    mixedPath,
      durationSec: plan.durationSec,
    });

    return {
      soundtrackPath,
      voiceoverPaths,
      sfxPaths,
      mixedPath,
      durationSec: plan.durationSec,
    };
  }

  // ── Soundtrack (Udio first, Suno fallback) ──────────────────────────
  async _composeSoundtrack(plan, audioDir) {
    const prompt = this._soundtrackPrompt(plan);
    const out = path.join(audioDir, 'soundtrack.mp3');
    try {
      const result = await this.udio.generate({ prompt, durationSec: plan.durationSec }, out);
      return typeof result === 'string' ? result : (result.path || out);
    } catch (err) {
      this.emit('audio:fallback', { from: 'udio', to: 'suno', reason: err.message });
      const result = await this.suno.generate({ prompt, durationSec: plan.durationSec }, out);
      return typeof result === 'string' ? result : (result.path || out);
    }
  }

  _soundtrackPrompt(plan) {
    const tones = (plan.storyboard || []).map(s => s.tone).join(', ');
    return [
      `Cinematic orchestral score in the style of John Williams`,
      `Genre: ${plan.genre}`,
      `Tones: ${tones}`,
      `Tempo: starts soft, builds to triumphant climax, ends with wonder`,
      `Instrumentation: strings, brass, woodwinds, subtle choir`,
      `Duration: ${plan.durationSec} seconds`,
      `No vocals, no lyrics`,
    ].join('. ');
  }

  // ── Voiceover (ElevenLabs) ──────────────────────────────────────────
  async _composeVoiceovers(plan, audioDir) {
    const out = [];
    const scenes = plan.script?.scenes || [];
    let i = 0;
    for (const scene of scenes) {
      if (!scene.voiceover) continue;
      i++;
      const voiceProfile = this._voiceFor(scene);
      const outPath = `${audioDir}/voiceover_${String(i).padStart(2, '0')}.mp3`;
      const returnedPath = await this.eleven.generate({
        text: scene.voiceover,
        voiceProfile,
        language: plan.language,
      }, outPath);
      out.push({ sceneRef: scene.scene_number, voiceProfile, path: returnedPath });
    }
    return out;
  }

  _voiceFor(scene) {
    const tone = scene.tone || '';
    if (tone.includes('wonder'))   return 'narrator_warm';
    if (tone.includes('peril'))    return 'character_villain';
    if (tone.includes('desolation')) return 'narrator_grandpa';
    return 'narrator_warm';
  }

  // ── SFX (ElevenLabs sound-effect API) ───────────────────────────────
  async _composeSfx(plan, audioDir) {
    const sfxPrompts = this._sfxPromptsFor(plan);
    const out = [];
    let i = 0;
    for (const p of sfxPrompts) {
      i++;
      try {
        const sfxPath = await this.eleven.generateSfx(p, `${audioDir}/sfx_${String(i).padStart(2, '0')}.mp3`);
        out.push({ prompt: p, path: sfxPath });
      } catch (err) {
        // SFX are optional; skip if generation fails
        this.emit('audio:sfx_skip', { prompt: p, error: err.message });
      }
    }
    return out;
  }

  _sfxPromptsFor(plan) {
    const scenes = plan.script?.scenes || [];
    const prompts = [];
    for (const s of scenes) {
      if (s.tone?.includes('storm'))   prompts.push('distant thunder roll, cinematic, deep');
      if (s.tone?.includes('wonder'))  prompts.push('gentle magical chime, soaring strings swell');
      if (s.tone?.includes('peril'))   prompts.push('low rumble, ominous cinematic tension');
      if (s.time_of_day?.includes('dawn')) prompts.push('soft morning birdsong, distant');
    }
    return prompts;
  }

  // ── Mixing via ffmpeg ───────────────────────────────────────────────
  async _mix({ soundtrack, voiceovers, sfx, outPath, durationSec }) {
    const ffmpeg = this.config.ffmpegPath || 'ffmpeg';

    // Filter out non-existent inputs (e.g. placeholders that didn't produce files)
    const realSoundtrack = await this._exists(soundtrack) ? soundtrack : null;
    const realVoiceovers = [];
    for (const v of voiceovers) {
      if (await this._exists(v)) realVoiceovers.push(v);
    }
    const realSfx = [];
    for (const s of sfx) {
      if (await this._exists(s)) realSfx.push(s);
    }

    // If no real audio files exist, generate a silent audio file of the right duration.
    if (!realSoundtrack && realVoiceovers.length === 0 && realSfx.length === 0) {
      await this._generateSilent(outPath, durationSec || 60);
      this.emit('audio:mix_silent', { outPath, durationSec });
      return outPath;
    }

    // Build an ffmpeg filter graph:
    //   - soundtrack: lowered to -10dB
    //   - voiceovers: concatenated, full volume, side-chain compressed against soundtrack
    //   - sfx: side-chain against soundtrack
    //   - everything summed, then peak-limited
    const inputs = [];
    const filters = [];
    let inputIdx = 0;

    if (realSoundtrack) {
      inputs.push('-i', realSoundtrack);
      filters.push(`[${inputIdx}:a]volume=0.5[bg];`);
      inputIdx++;
    } else {
      inputs.push('-f', 'lavfi', '-i', `anullsrc=cl=stereo:d=${durationSec || 60}`);
      filters.push(`[${inputIdx}:a]volume=0.5[bg];`);
      inputIdx++;
    }

    if (realVoiceovers.length) {
      realVoiceovers.forEach(v => inputs.push('-i', v));
      const concatInputs = realVoiceovers.map((_, idx) => `[${inputIdx + idx}:a]`).join('');
      filters.push(`${concatInputs}concat=n=${realVoiceovers.length}:v=0:a=1[vo];`);
      inputIdx += realVoiceovers.length;
    } else {
      filters.push(`anullsrc=cl=stereo:d=1[vo];`);
    }

    if (realSfx.length) {
      realSfx.forEach(s => inputs.push('-i', s));
      const concatInputs = realSfx.map((_, idx) => `[${inputIdx + idx}:a]`).join('');
      filters.push(`${concatInputs}concat=n=${realSfx.length}:v=0:a=1[sfx];`);
      inputIdx += realSfx.length;
    } else {
      filters.push(`anullsrc=cl=stereo:d=1[sfx];`);
    }

    filters.push('[bg][vo]sidechaincompress=threshold=0.05:ratio=8:attack=5:release=200[bg2];');
    filters.push('[bg2][sfx]amix=inputs=2:duration=longest:weights=1 0.6[out]');

    const args = [
      '-y', ...inputs,
      '-filter_complex', filters.join(''),
      '-map', '[out]',
      '-t', String(durationSec || 60),
      '-b:a', this.config.defaultBitrate || '256k',
      '-ar', String(this.config.defaultSampleRate || 44100),
      outPath,
    ];

    try {
      await execFileP(ffmpeg, args, { timeout: 120_000 });
    } catch (err) {
      // If ffmpeg fails entirely, generate a silent fallback so the pipeline can continue.
      this.emit('audio:mix_fallback', { error: err.message });
      await this._generateSilent(outPath, durationSec || 60);
    }
    return outPath;
  }

  async _generateSilent(outPath, durationSec) {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    const ffmpeg = this.config.ffmpegPath || 'ffmpeg';
    try {
      await execFileP(ffmpeg, [
        '-y', '-f', 'lavfi', '-i', `anullsrc=cl=stereo:d=${durationSec}`,
        '-b:a', this.config.defaultBitrate || '256k',
        '-ar', String(this.config.defaultSampleRate || 44100),
        outPath,
      ], { timeout: 30_000 });
    } catch (err) {
      // Last resort: write an empty file so downstream stages don't crash.
      await fs.writeFile(outPath, Buffer.alloc(0));
    }
    return outPath;
  }

  async _exists(p) {
    if (!p) return false;
    try { await fs.access(p); return true; } catch { return false; }
  }
}

export default AudioMixer;
