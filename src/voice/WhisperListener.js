/**
 * src/voice/WhisperListener.js — Voice command listener for Spilbergian.
 *
 * Provides a continuous-listening voice interface using OpenAI Whisper
 * (via the openai npm package or a local whisper.cpp binary).
 *
 * Modes:
 *   - continuous  — always listening, transcribes any utterance
 *   - wake_word   — waits for "Spilbergian" before transcribing a command
 *   - push_to_talk — records for a fixed duration, then transcribes
 *
 * Audio capture uses the `sox` / `rec` CLI by default (cross-platform),
 * or the optional `node-record-lpcm16` package if installed.
 *
 * The user said: "Deberá usar Whisper, como método alternativo al de
 * texto para recibir órdenes con voz de tareas del usuario" — so this
 * module is a first-class alternative to the text CLI.
 */
import { EventEmitter } from 'eventemitter3';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

export class WhisperListener extends EventEmitter {
  constructor(voiceConfig) {
    super();
    this.config = voiceConfig?.whisper || {};
    this.wakeWord = voiceConfig?.wakeWord || 'Spilbergian';
    this.mode = voiceConfig?.commandMode || 'continuous';
    this.language = this.config.language || 'es';
    this.model = this.config.model || 'base';
    this.sampleRate = this.config.sampleRate || 16000;
    this.apiKey = process.env.OPENAI_API_KEY || process.env.WHISPER_API_KEY;
    this.running = false;
    this._recordProc = null;
    this._transcribeEngine = null;
  }

  async init() {
    // Pick transcription engine:
    //   1. OpenAI Whisper API (preferred, no local deps)
    //   2. Local whisper.cpp binary
    //   3. openai npm package (Whisper API via SDK)
    if (this.apiKey) {
      this._transcribeEngine = 'openai-api';
      return;
    }
    try {
      await this._checkBinary('whisper');
      this._transcribeEngine = 'whisper-cli';
      return;
    } catch { /* not installed */ }
    try {
      await this._checkBinary('whisper-cpp');
      this._transcribeEngine = 'whisper-cpp';
      return;
    } catch { /* not installed */ }
    throw new Error('No Whisper engine available. Set OPENAI_API_KEY or install whisper / whisper.cpp.');
  }

  /**
   * Start listening. The callback receives a transcript string each time
   * the user finishes an utterance. Returns when stop() is called.
   */
  async start(onTranscript) {
    if (this.running) return;
    await this.init();
    this.running = true;
    this._onTranscript = onTranscript;

    while (this.running) {
      const wavPath = await this._record();
      let transcript;
      try {
        transcript = await this.transcribe(wavPath);
      } catch (err) {
        this.emit('voice:error', err);
      } finally {
        await fs.unlink(wavPath).catch(() => {});
      }
      if (!transcript || !transcript.trim()) continue;

      this.emit('voice:transcript', transcript);

      if (this.mode === 'wake_word') {
        if (transcript.toLowerCase().includes(this.wakeWord.toLowerCase())) {
          // Strip wake word and forward the rest as the command.
          const cmd = transcript.replace(new RegExp(this.wakeWord, 'i'), '').trim();
          if (cmd) await this._onTranscript(cmd);
        }
      } else {
        await this._onTranscript(transcript);
      }
    }
  }

  async stop() {
    this.running = false;
    if (this._recordProc) {
      this._recordProc.kill('SIGINT');
      this._recordProc = null;
    }
  }

  /**
   * Transcribe a WAV file using the configured engine.
   * @param {string} wavPath
   * @returns {Promise<string>} transcript text
   */
  async transcribe(wavPath) {
    if (this._transcribeEngine === 'openai-api') {
      return this._transcribeOpenAI(wavPath);
    }
    if (this._transcribeEngine === 'whisper-cli') {
      return this._transcribeCLI('whisper', wavPath);
    }
    if (this._transcribeEngine === 'whisper-cpp') {
      return this._transcribeCLI('whisper-cpp', wavPath);
    }
    throw new Error('No transcription engine available.');
  }

  // ── Engines ─────────────────────────────────────────────────────────

  async _transcribeOpenAI(wavPath) {
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('file', await fs.readFile(wavPath), { filename: 'audio.wav', contentType: 'audio/wav' });
    form.append('model', 'whisper-1');
    form.append('language', this.language);
    if (this.config.hotwords?.length) {
      form.append('prompt', this.config.hotwords.join(', '));
    }
    const res = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        ...form.getHeaders(),
      },
      timeout: 60_000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    return res.data?.text || '';
  }

  async _transcribeCLI(bin, wavPath) {
    return new Promise((resolve, reject) => {
      const args = [
        wavPath,
        '--model', this.model,
        '--language', this.language,
        '--output_format', 'txt',
        '--output_dir', path.dirname(wavPath),
      ];
      const proc = spawn(bin, args);
      let stderr = '';
      proc.stderr.on('data', d => { stderr += d.toString(); });
      proc.on('close', code => {
        if (code !== 0) return reject(new Error(`${bin} exited ${code}: ${stderr}`));
        const txtPath = wavPath.replace(/\.wav$/, '.txt');
        fs.readFile(txtPath, 'utf-8')
          .then(t => resolve(t.trim()))
          .then(() => fs.unlink(txtPath).catch(() => {}))
          .catch(reject);
      });
    });
  }

  // ── Recording ───────────────────────────────────────────────────────
  async _record() {
    const tmpDir = os.tmpdir();
    const wavPath = path.join(tmpDir, `spilbergian_${uuidv4()}.wav`);
    const { minSilenceMs, maxSpeechMs } = this.config.vad || {};
    const silenceSec = (minSilenceMs || 700) / 1000;
    const maxSec = (maxSpeechMs || 30_000) / 1000;

    // Try sox/rec first (cross-platform), fall back to ffmpeg.
    let cmd, args;
    try {
      await this._checkBinary('rec');
      cmd = 'rec';
      args = [
        '-q', '-r', String(this.sampleRate), '-c', '1', '-b', '16',
        wavPath,
        'silence', '1', '0.1', '3%', '1', String(silenceSec), '3%',
        'trim', '0', String(maxSec),
      ];
    } catch {
      await this._checkBinary('ffmpeg');
      cmd = 'ffmpeg';
      args = [
        '-y', '-f', this._platformInputFormat(), '-i', this._platformInputDevice(),
        '-ar', String(this.sampleRate), '-ac', '1', '-b:a', '16',
        '-t', String(maxSec),
        wavPath,
      ];
    }

    return new Promise((resolve, reject) => {
      this._recordProc = spawn(cmd, args, { stdio: 'ignore' });
      this._recordProc.on('close', code => {
        this._recordProc = null;
        if (code === 0 || code === null) resolve(wavPath);
        else reject(new Error(`${cmd} exited ${code}`));
      });
      this._recordProc.on('error', err => {
        this._recordProc = null;
        reject(err);
      });
    });
  }

  _platformInputFormat() {
    return process.platform === 'darwin' ? 'avfoundation' : process.platform === 'win32' ? 'dshow' : 'alsa';
  }

  _platformInputDevice() {
    return process.platform === 'darwin' ? ':0' : process.platform === 'win32' ? 'Microphone' : 'default';
  }

  async _checkBinary(bin) {
    return new Promise((resolve, reject) => {
      const proc = spawn(bin, ['--version'], { stdio: 'ignore' });
      proc.on('error', reject);
      proc.on('close', code => code === 0 ? resolve() : reject(new Error(`${bin} exited ${code}`)));
    });
  }
}

export default WhisperListener;
