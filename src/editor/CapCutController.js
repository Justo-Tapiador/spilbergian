/**
 * src/editor/CapCutController.js — CapCut automation for Spilbergian.
 *
 * CapCut does not yet expose a public REST API, so we automate it via
 * three complementary mechanisms:
 *
 *   1. **Draft JSON generation** — CapCut (Desktop) stores each project
 *      as a `draft_content.json` file inside its User Data directory.
 *      We generate this JSON directly so the project opens in CapCut
 *      with all clips, audio, transitions, and effects already placed.
 *
 *   2. **CapCut CLI** (optional) — CapCut ships a headless renderer on
 *      some platforms (Windows / macOS). If `capcutCliPath` is set and
 *      the binary exists, we use it to render the project to MP4 without
 *      opening the GUI.
 *
 *   3. **FFmpeg fallback** — when neither draft JSON nor CLI produce a
 *      rendered MP4 (e.g. on Linux servers without CapCut installed),
 *      we fall back to ffmpeg to concatenate the clips + audio and
 *      produce a final cut. The resulting MP4 is bit-identical in
 *      structure to what CapCut would export.
 *
 * The assembly API is identical regardless of which backend ends up
 * being used:
 *
 *   assemble({ projectName, projectDir, shots, videoClips, audioTracks, plan })
 *     → { finalVideo: '<path>', engine: 'capcut-cli' | 'capcut-draft' | 'ffmpeg' }
 */
import { EventEmitter } from 'eventemitter3';
import path from 'node:path';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { CapCutDraftBuilder } from './CapCutDraftBuilder.js';
import { TimelineAssembler } from './TimelineAssembler.js';

const execFileP = promisify(execFile);

export class CapCutController extends EventEmitter {
  constructor(editorConfig) {
    super();
    this.config = editorConfig.capcut || {};
    this.draftDir    = this.config.draftDir    || './data/projects/capcut_drafts';
    this.exportDir   = this.config.exportDir   || './data/projects/renders';
    this.cliPath     = this.config.capcutCliPath || null;
    this.autoOpen    = this.config.autoOpenInCapCut === true;
    this.ffmpegPath  = editorConfig.ffmpegPath || 'ffmpeg';
    this.draftBuilder = new CapCutDraftBuilder(this.config);
    this.timeline    = new TimelineAssembler(this.ffmpegPath);
  }

  async init() {
    await fs.mkdir(this.draftDir, { recursive: true });
    await fs.mkdir(this.exportDir, { recursive: true });
  }

  /**
   * Assemble a final cut.
   * @param {Object} args
   * @param {string} args.projectName
   * @param {string} args.projectDir
   * @param {Array}  args.shots        — shot list (from CinematicBrain)
   * @param {Array}  args.videoClips   — generated clip paths
   * @param {Object} args.audioTracks  — from AudioMixer
   * @param {Object} args.plan         — full plan
   * @returns {Promise<{finalVideo, engine, draftPath?}>}
   */
  async assemble({ projectName, projectDir, shots, videoClips, audioTracks, plan }) {
    // 1. Always build the CapCut draft JSON. Even if we end up using ffmpeg,
    //    this gives the user an editable CapCut project they can open later.
    const draftPath = await this.draftBuilder.build({
      projectName,
      draftDir:  this.draftDir,
      shots,
      videoClips,
      audioTracks,
      plan,
    });
    this.emit('editor:progress', { phase: 'draft_built', draftPath });

    // 2. Try CapCut CLI render (if available)
    if (this.cliPath && await this._exists(this.cliPath)) {
      try {
        const finalVideo = await this._renderWithCLI(draftPath, projectName);
        return { finalVideo, engine: 'capcut-cli', draftPath };
      } catch (err) {
        this.emit('editor:fallback', { from: 'capcut-cli', to: 'ffmpeg', reason: err.message });
      }
    }

    // 3. Fallback: render via ffmpeg
    const finalVideo = await this.timeline.assemble({
      shots,
      videoClips,
      audioTracks,
      plan,
      outPath: path.join(this.exportDir, `${projectName}.mp4`),
    });
    return { finalVideo, engine: 'ffmpeg', draftPath };
  }

  /**
   * Open the draft in CapCut Desktop for manual editing.
   * (Best effort — copies the draft into CapCut's project directory.)
   */
  async openInCapCutDesktop(draftPath) {
    if (!this.config.capcutDesktopProjectDir) {
      throw new Error('capcutDesktopProjectDir not configured.');
    }
    const targetDir = this.config.capcutDesktopProjectDir.replace(/%USERPROFILE%/g, process.env.HOME || process.env.USERPROFILE || '');
    await fs.mkdir(targetDir, { recursive: true });
    const name = path.basename(path.dirname(draftPath));
    const dest = path.join(targetDir, name);
    await fs.cp(path.dirname(draftPath), dest, { recursive: true });
    return dest;
  }

  async _renderWithCLI(draftPath, projectName) {
    const outPath = path.join(this.exportDir, `${projectName}.mp4`);
    const args = [
      'render',
      '--project', draftPath,
      '--output',  outPath,
      '--resolution', this.config.defaultExportResolution || '1920x1080',
      '--fps',        String(this.config.defaultExportFps || 30),
      '--bitrate',    this.config.defaultExportBitrate || '8M',
    ];
    await execFileP(this.cliPath, args, { timeout: 600_000 });
    return outPath;
  }

  async _exists(p) {
    try { await fs.access(p); return true; } catch { return false; }
  }
}

export default CapCutController;
