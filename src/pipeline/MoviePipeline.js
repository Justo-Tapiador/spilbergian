/**
 * src/pipeline/MoviePipeline.js — End-to-end movie creation pipeline.
 *
 * Flow:
 *   brief
 *     → brain.plan()                       # script, storyboard, shot list
 *     → videoOrch.generate(shots)          # parallel AI video generation
 *     → audioMixer.compose(storyboard)     # soundtrack + voiceover + SFX
 *     → capcut.assemble(shots, audio)      # build CapCut draft & render
 *     → thumbnail generate
 *     → return finalMovie record
 *
 * Every stage emits progress events for UI / logging.
 */
import { EventEmitter } from 'eventemitter3';
import path from 'node:path';
import fs from 'node:fs/promises';
import { v4 as uuidv4 } from 'uuid';

import { ScriptWriter }  from './ScriptWriter.js';
import { StoryboardPlanner } from './StoryboardPlanner.js';
import { RenderQueue } from './RenderQueue.js';
import { ThumbnailGenerator } from '../youtube/ThumbnailGenerator.js';

export class MoviePipeline extends EventEmitter {
  constructor(deps) {
    super();
    this.brain      = deps.brain;
    this.videoOrch  = deps.videoOrch;
    this.audioMixer = deps.audioMixer;
    this.editor     = deps.editor;
    this.assets     = deps.assets;
    this.memory     = deps.memory;
    this.safety     = deps.safety;
    this.metrics    = deps.metrics;

    this.scriptwriter    = new ScriptWriter(deps.brain);
    this.storyboardPlanner = new StoryboardPlanner(deps.brain);
    this.renderQueue     = new RenderQueue(this.videoOrch, this.metrics);
    this.thumbnailGen    = new ThumbnailGenerator(deps.brain, this.assets);
  }

  /**
   * Run the full pipeline for a project.
   * @param {Object} project — project descriptor (must contain brief + format).
   * @returns {Promise<Object>} movie record with paths to final video/audio/thumbnail.
   */
  async run(project) {
    const phases = [
      ['plan',        this._phasePlan.bind(this)],
      ['render_video', this._phaseRenderVideo.bind(this)],
      ['compose_audio', this._phaseComposeAudio.bind(this)],
      ['edit',        this._phaseEdit.bind(this)],
      ['thumbnail',   this._phaseThumbnail.bind(this)],
      ['finalize',    this._phaseFinalize.bind(this)],
    ];

    const ctx = { project, plan: null, videoClips: [], audioTracks: {}, finalVideo: null, thumbnailPath: null };
    for (let i = 0; i < phases.length; i++) {
      const [name, fn] = phases[i];
      this.emit('pipeline:phase', { phase: name, project: project.id });
      const timerId = this.metrics?.startTimer?.(`pipeline_${name}`);
      await fn(ctx);
      if (timerId) this.metrics?.stopTimer?.(timerId);
      this.emit('pipeline:progress', {
        phase: name,
        project: project.id,
        progress: (i + 1) / phases.length,
      });
    }
    return this._buildMovieRecord(ctx);
  }

  // ── Phase 1: Plan ───────────────────────────────────────────────────
  async _phasePlan(ctx) {
    const plan = await this.brain.plan(ctx.project.brief, {
      format:    ctx.project.format,
      genre:     ctx.project.genre,
      language:  ctx.project.language,
      targetDurationSec: ctx.project.targetDurationSec,
    });
    ctx.plan = plan;

    // Save plan to project folder for inspection / re-use.
    const projectDir = await this.assets.ensureProjectDir(ctx.project.name);
    ctx.projectDir = projectDir;
    await fs.writeFile(
      path.join(projectDir, 'plan.json'),
      JSON.stringify(plan, null, 2),
    );
  }

  // ── Phase 2: Generate video clips in parallel via render queue ──────
  async _phaseRenderVideo(ctx) {
    const safety = await this.safety.check({
      kind: 'video_render',
      input: ctx.plan.brief,
    });
    if (!safety.allowed) throw new Error(`Render blocked by safety: ${safety.reason}`);

    const clips = await this.renderQueue.run(ctx.plan.renderPrompts, ctx.projectDir);
    ctx.videoClips = clips;
    this.metrics?.incrementCounter?.('video_renders_total', clips.length);

    // Stash successful renders in memory for future style retrieval.
    for (const clip of clips) {
      if (clip.status === 'ok') {
        await this.memory.rememberRender(clip.prompt, clip, { provider: clip.provider });
      }
    }
  }

  // ── Phase 3: Compose audio (soundtrack + voiceover + SFX) ───────────
  async _phaseComposeAudio(ctx) {
    const safety = await this.safety.check({ kind: 'audio_job', input: ctx.plan.brief });
    if (!safety.allowed) throw new Error(`Audio blocked by safety: ${safety.reason}`);

    const audio = await this.audioMixer.compose(ctx.plan, ctx.projectDir);
    ctx.audioTracks = audio;
    this.metrics?.incrementCounter?.('audio_jobs_total', 1);
  }

  // ── Phase 4: Edit in CapCut ─────────────────────────────────────────
  async _phaseEdit(ctx) {
    const finalVideo = await this.editor.assemble({
      projectName: ctx.project.name,
      projectDir:  ctx.projectDir,
      shots:       ctx.plan.shotList,
      videoClips:  ctx.videoClips,
      audioTracks: ctx.audioTracks,
      plan:        ctx.plan,
    });
    ctx.finalVideo = finalVideo;
    this.metrics?.incrementCounter?.('videos_edited_total', 1);
  }

  // ── Phase 5: Thumbnail ──────────────────────────────────────────────
  async _phaseThumbnail(ctx) {
    ctx.thumbnailPath = await this.thumbnailGen.generate(ctx.plan, ctx.projectDir);
  }

  // ── Phase 6: Finalize ───────────────────────────────────────────────
  async _phaseFinalize(ctx) {
    // Style adherence score
    const adherence = this.brain.persona.styleAdherence(ctx.plan);
    ctx.plan.styleAdherence = adherence;
    await this.memory.rememberStyleAdherence(ctx.plan, adherence.score);

    // Write a manifest.json with everything.
    const manifest = {
      projectId:   ctx.project.id,
      projectName: ctx.project.name,
      brief:       ctx.project.brief,
      format:      ctx.project.format,
      genre:       ctx.project.genre,
      durationSec: ctx.plan.durationSec,
      title:       ctx.plan.title,
      description: ctx.plan.description,
      tags:        ctx.plan.tags,
      finalVideo:  ctx.finalVideo,
      thumbnailPath: ctx.thumbnailPath,
      videoClips:  ctx.videoClips.map(c => ({ id: c.shotId, provider: c.provider, path: c.path, durationSec: c.durationSec, status: c.status })),
      audio:       ctx.audioTracks,
      styleAdherence: adherence,
      createdAt:   new Date().toISOString(),
    };
    await fs.writeFile(
      path.join(ctx.projectDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
    );
    ctx.manifest = manifest;
  }

  _buildMovieRecord(ctx) {
    return {
      projectId:   ctx.project.id,
      projectName: ctx.project.name,
      title:       ctx.plan.title,
      description: ctx.plan.description,
      tags:        ctx.plan.tags,
      finalVideo:  ctx.finalVideo,
      thumbnailPath: ctx.thumbnailPath,
      durationSec: ctx.plan.durationSec,
      videoClips:  ctx.videoClips,
      audio:       ctx.audioTracks,
      plan:        ctx.plan,
      manifest:    ctx.manifest,
      styleAdherence: ctx.plan.styleAdherence,
    };
  }
}

export default MoviePipeline;
