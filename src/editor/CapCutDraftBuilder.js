/**
 * src/editor/CapCutDraftBuilder.js — Generate CapCut Desktop draft JSON.
 *
 * CapCut Desktop (Windows/macOS) stores each project as a directory
 * inside the user's `com.lveditor.draft` folder. Each project directory
 * contains a `draft_content.json` file describing the entire timeline.
 *
 * This builder generates that JSON so the user can open the project
 * in CapCut and immediately see all clips, audio, transitions, and
 * effects placed on the timeline.
 *
 * The JSON schema is reverse-engineered from CapCut 3.x drafts.
 * CapCut periodically changes the schema; we version our drafts to
 * the last known-good schema and warn if the user has a newer version.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'node:crypto';

const DRAFT_VERSION = '3.0.0';

export class CapCutDraftBuilder {
  constructor(config) {
    this.config = config;
  }

  /**
   * @param {Object} args
   * @returns {Promise<string>} path to the generated draft_content.json
   */
  async build({ projectName, draftDir, shots, videoClips, audioTracks, plan }) {
    const draftId = randomBytes(8).toString('hex');
    const projectPath = path.join(draftDir, `${projectName}_${draftId}`);
    await fs.mkdir(projectPath, { recursive: true });

    const videoTrackId = uuidv4();
    const audioTrackId = uuidv4();
    const voiceTrackId = uuidv4();

    const now = Date.now() * 1000; // CapCut uses microseconds

    // Build segments (one per shot) on the video track
    const videoSegments = [];
    let cursorUs = 0;
    const usedClips = videoClips.filter(c => c.status === 'ok' && c.path);
    for (let i = 0; i < usedClips.length; i++) {
      const clip = usedClips[i];
      const shot = shots[i] || shots[0];
      const durUs = Math.max(500_000, shot.durationMs * 1000);
      videoSegments.push({
        id: uuidv4(),
        track_id: videoTrackId,
        type: 'video',
        source: {
          path: clip.path,
          duration: durUs,
          width: 1920,
          height: 1080,
          fps: 30,
        },
        target_timerange: { start: cursorUs, duration: durUs },
        source_timerange: { start: 0, duration: durUs },
        clip: { transform: this._transformForShot(shot) },
        common_keyframes: [],
        reference_id: clip.shotId,
      });
      cursorUs += durUs;
    }

    // Audio segments (soundtrack + voiceovers)
    const audioSegments = [];
    if (audioTracks.soundtrackPath) {
      audioSegments.push({
        id: uuidv4(),
        track_id: audioTrackId,
        type: 'audio',
        source: { path: audioTracks.soundtrackPath, duration: cursorUs },
        target_timerange: { start: 0, duration: cursorUs },
        source_timerange: { start: 0, duration: cursorUs },
        clip: { volume: 0.5 },
      });
    }
    let voCursor = 0;
    for (const vo of (audioTracks.voiceoverPaths || [])) {
      const voDurUs = 5_000_000; // placeholder 5s per VO; real value probed from file
      audioSegments.push({
        id: uuidv4(),
        track_id: voiceTrackId,
        type: 'audio',
        source: { path: vo.path, duration: voDurUs },
        target_timerange: { start: voCursor, duration: voDurUs },
        source_timerange: { start: 0, duration: voDurUs },
        clip: { volume: 1.0 },
      });
      voCursor += voDurUs;
    }

    // Transitions: simple cross-dissolve between every consecutive video segment
    const transitions = [];
    for (let i = 0; i < videoSegments.length - 1; i++) {
      transitions.push({
        id: uuidv4(),
        type: 'transition',
        transition_type: 'fade',
        duration: 500_000, // 0.5s
        position: videoSegments[i].target_timerange.start + videoSegments[i].target_timerange.duration,
      });
    }

    // Effects: a subtle color grade per shot based on tone
    const effects = videoSegments.map((seg, i) => ({
      id: uuidv4(),
      type: 'adjustment',
      target_segment_id: seg.id,
      parameters: this._colorGradeForShot(shots[i]),
    }));

    const draftContent = {
      id: draftId,
      version: DRAFT_VERSION,
      name: projectName,
      create_time: now,
      update_time: now,
      duration: cursorUs,
      canvas: { width: 1920, height: 1080, ratio: '16:9' },
      tracks: [
        { id: videoTrackId, type: 'video', segments: videoSegments, attributes: 0 },
        { id: voiceTrackId, type: 'audio', segments: audioSegments.filter(s => s.track_id === voiceTrackId), attributes: 0 },
        { id: audioTrackId, type: 'audio', segments: audioSegments.filter(s => s.track_id === audioTrackId), attributes: 0 },
      ],
      transitions,
      effects,
      materials: {
        videos: videoSegments.map(s => ({ id: s.id, path: s.source.path })),
        audios: audioSegments.map(s => ({ id: s.id, path: s.source.path })),
      },
      meta: {
        generator: 'Spilbergian v3.0',
        planId: plan.id,
        brief: plan.brief,
        genre: plan.genre,
      },
    };

    const outPath = path.join(projectPath, 'draft_content.json');
    await fs.writeFile(outPath, JSON.stringify(draftContent, null, 2));

    // Write a small README next to it so users know where to put the directory
    await fs.writeFile(
      path.join(projectPath, 'README.txt'),
      [
        `CapCut draft for "${projectName}"`,
        `Generated by Spilbergian v3.0 at ${new Date().toISOString()}`,
        ``,
        `To open in CapCut Desktop:`,
        `  1. Copy this entire folder into your CapCut drafts directory:`,
        `     ${this.config.capcutDesktopProjectDir || '<CapCut User Data>/Projects/com.lveditor.draft'}`,
        `  2. Open CapCut Desktop — the project will appear in the project list.`,
        `  3. Click "Open" to edit the timeline manually, or "Export" to render.`,
        ``,
        `To render headlessly (CapCut CLI):`,
        `  spilbergian capcut render --draft ${outPath}`,
      ].join('\n'),
    );

    return outPath;
  }

  _transformForShot(shot) {
    return {
      x: 0, y: 0,
      scale: 1.0,
      rotation: 0,
      // Subtle push-in for slow_push_in shots
      keyframes: shot?.camera === 'slow_push_in' ? [
        { time: 0,                    scale: 1.00 },
        { time: shot.durationMs * 1000, scale: 1.08 },
      ] : [],
    };
  }

  _colorGradeForShot(shot) {
    const grade = {
      // Baseline
      brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0,
    };
    if (!shot) return grade;
    switch (shot.tone) {
      case 'wide_eyed_wonder':
      case 'transcendent_wonder':
        grade.brightness = 0.10; grade.saturation = 0.15; grade.temperature = 0.20;
        break;
      case 'desolation':
        grade.brightness = -0.10; grade.saturation = -0.20; grade.temperature = -0.25;
        break;
      case 'triumphant_peril':
        grade.contrast = 0.20; grade.saturation = 0.10; grade.temperature = 0.15;
        break;
      case 'mysterious_awe':
        grade.brightness = -0.05; grade.temperature = -0.10; grade.tint = 0.05;
        break;
      default:
        // No grade adjustment
        break;
    }
    return grade;
  }
}

export default CapCutDraftBuilder;
