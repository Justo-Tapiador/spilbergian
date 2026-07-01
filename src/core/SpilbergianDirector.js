/**
 * src/core/SpilbergianDirector.js — PREDATOR JUNGLE v3.0 "Spilbergian"
 * =====================================================================
 * The main orchestrator for the cinematic AI agent. Extends the v2.0
 * Predator agent with a "director persona" that thinks in shots, scenes,
 * and emotional beats in the tradition of Steven Spielberg.
 *
 * Spilbergian coordinates:
 *   - CinematicBrain        → shot/scene planning, story arc generation
 *   - MoviePipeline         → end-to-end movie creation flow
 *   - VideoOrchestrator     → picks best video provider per scene
 *   - AudioMixer            → blends soundtrack + voiceover + SFX
 *   - CapCutController      → assembles the final cut in CapCut
 *   - WhisperListener       → voice command interface (alternative to text)
 *   - YouTubeUploader       → publishes the finished video
 *
 * Author: Built on Agentic Theory by Justo Tapiador García (UA).
 */
import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import path from 'node:path';
import fs from 'node:fs/promises';

import { loadConfig } from '../../config/loader.js';
import { CinematicBrain } from './CinematicBrain.js';
import { SpielbergPersona } from '../persona/SpielbergPersona.js';
import { MoviePipeline } from '../pipeline/MoviePipeline.js';
import { VideoOrchestrator } from '../video/VideoOrchestrator.js';
import { AudioMixer } from '../audio/AudioMixer.js';
import { CapCutController } from '../editor/CapCutController.js';
import { WhisperListener } from '../voice/WhisperListener.js';
import { VoiceCommandRouter } from '../voice/VoiceCommandRouter.js';
import { YouTubeUploader } from '../youtube/YouTubeUploader.js';
import { MediaAssetTool } from '../tools/MediaAssetTool.js';

import { MemorySystem } from '../modules/MemorySystem.js';
import { SafetyGuardrails } from '../modules/SafetyGuardrails.js';
import { MetricsCollector } from '../modules/MetricsCollector.js';
import { PluginManager } from '../modules/PluginManager.js';
import { SpilbergianTrainer } from '../training/SpilbergianTrainer.js';

export class SpilbergianDirector extends EventEmitter {
  /**
   * @param {Object} [opts] — overrides for the loaded config.
   */
  constructor(opts = {}) {
    super();
    this.id = uuidv4();
    this.config = loadConfig(opts);

    // ── Subsystems ──────────────────────────────────────────────────────
    this.persona       = new SpielbergPersona(this.config.persona);
    this.brain         = new CinematicBrain(this.config, this.persona);
    this.memory        = new MemorySystem(this.config.memory);
    this.safety        = new SafetyGuardrails(this.config.safety);
    this.metrics       = new MetricsCollector(this.config.logging);
    this.plugins       = new PluginManager();
    this.assets        = new MediaAssetTool(this.config);
    this.videoOrch     = new VideoOrchestrator(this.config.video, this.assets);
    this.audioMixer    = new AudioMixer(this.config.audio, this.assets);
    this.capcut        = new CapCutController(this.config.editor);
    this.whisper       = new WhisperListener(this.config.voice);
    this.voiceRouter   = new VoiceCommandRouter(this);
    this.youtube       = new YouTubeUploader(this.config.youtube);
    this.trainer       = new SpilbergianTrainer(this.brain, this.config.training);
    this.pipeline      = new MoviePipeline({
      brain:        this.brain,
      videoOrch:    this.videoOrch,
      audioMixer:   this.audioMixer,
      editor:       this.capcut,
      assets:       this.assets,
      memory:       this.memory,
      safety:       this.safety,
      metrics:      this.metrics,
    });

    // ── State ───────────────────────────────────────────────────────────
    this.initialized   = false;
    this.currentProject = null;
    this.voiceActive   = false;

    // Wire pipeline events through to the director's listeners.
    this._wireEvents();
  }

  // ───────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ───────────────────────────────────────────────────────────────────────
  async init() {
    if (this.initialized) return;
    this.metrics.start();
    await this.memory.init();
    await this.assets.init();
    await this.videoOrch.init();
    await this.audioMixer.init();
    await this.capcut.init();
    await this.youtube.init();
    this.initialized = true;
    this.emit('ready', { id: this.id, persona: this.persona.name });
  }

  async shutdown() {
    if (this.voiceActive) await this.stopVoiceMode();
    this.metrics.stop();
    this.emit('shutdown');
  }

  // ───────────────────────────────────────────────────────────────────────
  // Public API — High-level directorial commands
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Create a complete cinematic video from a high-level creative brief.
   * @param {string} brief — e.g. "A lonely lighthouse keeper discovers a stranded mermaid".
   * @param {Object} [opts]
   * @param {string} [opts.format='short']     — 'short' | 'featurette' | 'vertical' | 'trailer'
   * @param {string} [opts.genre]              — overrides persona default genre
   * @param {number} [opts.targetDurationSec]  — overrides format default
   * @param {string} [opts.language='es']      — script / narration language
   * @param {boolean} [opts.uploadToYouTube]   — auto-upload when finished
   * @param {string} [opts.projectName]        — explicit project name
   * @returns {Promise<Object>} movieRecord with paths, metadata, quality score
   */
  async createMovie(brief, opts = {}) {
    await this.init();

    const project = {
      id:        uuidv4(),
      name:      opts.projectName || `spilbergian-${Date.now()}`,
      brief,
      format:    opts.format || 'short',
      genre:     opts.genre || this.persona.preferredGenres[0],
      language:  opts.language || 'es',
      targetDurationSec: opts.targetDurationSec,
      uploadToYouTube: opts.uploadToYouTube === true,
      createdAt: new Date().toISOString(),
      status:    'planning',
    };

    this.currentProject = project;
    this.emit('project:start', project);

    try {
      // 1. Safety check on the brief.
      const safety = await this.safety.check({ input: brief, kind: 'creative_brief' });
      if (!safety.allowed) throw new Error(`Brief rejected by safety: ${safety.reason}`);

      // 2. Run the full pipeline (script → storyboard → video clips → audio → edit).
      const result = await this.pipeline.run(project);

      // 3. Optional YouTube upload.
      if (project.uploadToYouTube) {
        result.youTube = await this.youtube.upload(result.finalVideo, {
          title:       result.title,
          description: result.description,
          tags:        result.tags,
          privacy:     this.config.youtube.defaultPrivacy,
          thumbnail:   result.thumbnailPath,
        });
      }

      project.status = 'complete';
      project.result = result;

      // 4. Persist in memory.
      await this.memory.store('movie', brief, result, { project });
      this.emit('project:complete', project);
      return result;

    } catch (err) {
      project.status = 'failed';
      project.error  = err.message;
      this.emit('project:error', { project, error: err });
      throw err;
    }
  }

  /**
   * Start listening for voice commands via Whisper. The director will
   * alternate between waiting for the wake word ("Spilbergian") and
   * capturing the command until silence.
   */
  async startVoiceMode() {
    if (this.voiceActive) return;
    await this.init();
    this.voiceActive = true;
    await this.whisper.start(async (transcript) => {
      this.emit('voice:transcript', transcript);
      const command = this.voiceRouter.parse(transcript);
      if (command) {
        this.emit('voice:command', command);
        await this.voiceRouter.execute(command);
      }
    });
    this.emit('voice:start');
  }

  async stopVoiceMode() {
    if (!this.voiceActive) return;
    await this.whisper.stop();
    this.voiceActive = false;
    this.emit('voice:stop');
  }

  /**
   * Execute a free-form text directive. This is the text alternative to
   * voice mode. The director will route it to the appropriate subsystem.
   */
  async execute(directive, opts = {}) {
    await this.init();
    this.emit('directive:received', { directive, opts });

    const routed = this.voiceRouter.parseText(directive);
    if (routed) {
      return this.voiceRouter.execute(routed, opts);
    }

    // Default: treat as a movie brief.
    return this.createMovie(directive, opts);
  }

  // ───────────────────────────────────────────────────────────────────────
  // Training
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Train Spilbergian on its specialized cinematic knowledge.
   * The training pipeline now includes:
   *   - Standard PREDATOR AJN training (Phases I–IV)
   *   - Cinematic phase: scene composition, shot pacing, story arcs
   *   - Style reward phase: Spielberg-style adherence scoring
   *
   * @param {Object} [opts] — Phase epoch overrides.
   */
  async train(opts = {}) {
    await this.init();
    this.emit('training:start', opts);
    const history = await this.trainer.train(opts);
    this.emit('training:complete', history);
    return history;
  }

  // ───────────────────────────────────────────────────────────────────────
  // Introspection
  // ───────────────────────────────────────────────────────────────────────

  status() {
    return {
      id:           this.id,
      persona:      this.persona.name,
      version:      this.config.agent.version,
      specialty:    this.config.agent.specialty,
      initialized:  this.initialized,
      voiceActive:  this.voiceActive,
      currentProject: this.currentProject?.name || null,
      metrics:      this.metrics.getSummary(),
      plugins:      this.plugins.list().map(p => p.name),
      videoProviders: this.videoOrch.listProviders(),
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Internals
  // ───────────────────────────────────────────────────────────────────────
  _wireEvents() {
    const forward = (evt) => (payload) => this.emit(evt, payload);
    this.pipeline.on?.('pipeline:progress', forward('pipeline:progress'));
    this.pipeline.on?.('pipeline:phase',    forward('pipeline:phase'));
    this.videoOrch.on?.('video:progress',   forward('video:progress'));
    this.audioMixer.on?.('audio:progress',  forward('audio:progress'));
    this.capcut.on?.('editor:progress',     forward('editor:progress'));
    this.whisper.on?.('voice:partial',      forward('voice:partial'));
  }
}

export default SpilbergianDirector;
