/**
 * src/youtube/YouTubeUploader.js — YouTube Data API v3 upload for Spilbergian.
 *
 * Authentication flow:
 *   1. User downloads OAuth credentials from Google Cloud Console
 *      (https://console.cloud.google.com/apis/credentials) and saves
 *      them to `data/youtube/credentials.json` (Desktop app type).
 *   2. First upload triggers interactive OAuth consent in a browser,
 *      storing the refresh token in `data/youtube/token.json`.
 *   3. Subsequent uploads use the cached token.
 *
 * Capabilities:
 *   - upload(videoPath, metadata) → returns { videoId, url }
 *   - schedule uploads at preferred time/day per config
 *   - set thumbnail (custom or AI-generated)
 *   - list recent uploads for status checks
 */
import { EventEmitter } from 'eventemitter3';
import fs from 'node:fs/promises';
import path from 'node:path';
import { google } from 'googleapis';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execP = promisify(exec);

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
];

export class YouTubeUploader extends EventEmitter {
  constructor(ytConfig) {
    super();
    this.config = ytConfig;
    this.credentialsFile = ytConfig.credentialsFile || './data/youtube/credentials.json';
    this.tokenFile       = ytConfig.tokenFile       || './data/youtube/token.json';
    this.oauth2Client    = null;
    this.youtube         = null;
  }

  async init() {
    await fs.mkdir(path.dirname(this.credentialsFile), { recursive: true });
    await fs.mkdir(path.dirname(this.tokenFile), { recursive: true });
    try {
      const creds = JSON.parse(await fs.readFile(this.credentialsFile, 'utf-8'));
      const { client_secret, client_id, redirect_uris } = creds.installed || creds.web || {};
      this.oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris?.[0] || 'http://localhost');
      this.oauth2Client.on('tokens', (tokens) => this._persistToken(tokens));

      try {
        const token = JSON.parse(await fs.readFile(this.tokenFile, 'utf-8'));
        this.oauth2Client.setCredentials(token);
      } catch {
        // No token yet — will trigger OAuth on first upload.
      }
      this.youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });
    } catch (err) {
      // Credentials not configured — uploader is disabled but doesn't crash init.
      this.emit('youtube:disabled', { reason: err.message });
    }
  }

  /**
   * Upload a video to YouTube.
   * @param {string} videoPath — local path to the MP4 file
   * @param {Object} metadata — { title, description, tags, privacy, category, thumbnail }
   * @returns {Promise<{videoId, url, snippet}>}
   */
  async upload(videoPath, metadata = {}) {
    if (!this.youtube) {
      await this._ensureAuth();
      this.youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });
    }

    const title       = metadata.title || 'Untitled — by Spilbergian';
    const description = metadata.description || this.config.defaultDescription || '';
    const tags        = metadata.tags || this.config.defaultTags || [];
    const privacy     = metadata.privacy || this.config.defaultPrivacy || 'private';
    const category    = metadata.category || this.config.defaultCategory || '24';

    this.emit('youtube:upload_start', { videoPath, title });

    const fileSize = (await fs.stat(videoPath)).size;
    const res = await this.youtube.videos.insert(
      {
        part: 'snippet,status',
        requestBody: {
          snippet: {
            title: title.slice(0, 100),
            description,
            tags,
            categoryId: category,
            defaultLanguage: this.config.defaultLanguage || 'es',
            defaultAudioLanguage: this.config.defaultLanguage || 'es',
          },
          status: {
            privacyStatus: privacy,
            selfDeclaredMadeForKids: false,
          },
        },
        media: { body: (await import('node:fs')).createReadStream(videoPath) },
      },
      {
        onUploadProgress: (e) => {
          const pct = (e.bytesRead / fileSize) * 100;
          this.emit('youtube:upload_progress', { pct, bytesRead: e.bytesRead, fileSize });
        },
      },
    );

    const videoId = res.data?.id;
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    this.emit('youtube:upload_complete', { videoId, url });

    // Optional thumbnail upload
    if (metadata.thumbnail && await this._exists(metadata.thumbnail)) {
      try {
        await this.youtube.thumbnails.set({
          videoId,
          media: { body: (await import('node:fs')).createReadStream(metadata.thumbnail) },
        });
        this.emit('youtube:thumbnail_set', { videoId });
      } catch (err) {
        this.emit('youtube:thumbnail_failed', { videoId, error: err.message });
      }
    }

    return { videoId, url, snippet: res.data?.snippet };
  }

  /**
   * Schedule a video for upload at the configured preferred day/time.
   * @param {string} videoPath
   * @param {Object} metadata
   * @returns {Promise<{scheduledFor: Date}>}
   */
  async schedule(videoPath, metadata = {}) {
    const schedule = this.config.publishSchedule || {};
    const tz = schedule.timezone || 'Europe/Madrid';
    const dayMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    const targetDay = dayMap[(schedule.preferredDay || 'friday').toLowerCase()] ?? 5;
    const [hh, mm] = (schedule.preferredTime || '18:00').split(':').map(Number);

    const now = new Date();
    const target = new Date(now);
    target.setHours(hh, mm, 0, 0);
    while (target.getDay() !== targetDay || target <= now) {
      target.setDate(target.getDate() + 1);
    }

    const delayMs = target.getTime() - now.getTime();
    this.emit('youtube:scheduled', { videoPath, scheduledFor: target });

    setTimeout(() => {
      this.upload(videoPath, metadata).catch(err => this.emit('youtube:schedule_error', err));
    }, delayMs);

    return { scheduledFor: target, timezone: tz };
  }

  /**
   * List the channel's most recent uploads.
   * @param {number} [maxResults=10]
   */
  async listRecent(maxResults = 10) {
    if (!this.youtube) return [];
    const ch = await this.youtube.channels.list({
      part: 'contentDetails',
      mine: true,
    });
    const uploadsPlaylist = ch.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylist) return [];
    const vids = await this.youtube.playlistItems.list({
      part: 'snippet',
      playlistId: uploadsPlaylist,
      maxResults,
    });
    return vids.data.items?.map(i => ({
      videoId: i.snippet?.resourceId?.videoId,
      title:   i.snippet?.title,
      publishedAt: i.snippet?.publishedAt,
      url: `https://www.youtube.com/watch?v=${i.snippet?.resourceId?.videoId}`,
    })) || [];
  }

  // ── OAuth helpers ───────────────────────────────────────────────────

  async _ensureAuth() {
    if (!this.oauth2Client) throw new Error('YouTube OAuth not initialised. Run `spilbergian youtube:auth` first.');
    let token;
    try {
      token = JSON.parse(await fs.readFile(this.tokenFile, 'utf-8'));
      this.oauth2Client.setCredentials(token);
      return;
    } catch { /* no cached token */ }

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });
    console.log('\nAuthorize Spilbergian for YouTube by visiting this URL:\n');
    console.log(authUrl);
    console.log('\nOpening browser...');
    try { await execP(`open "${authUrl}"`); } catch {}
    try { await execP(`xdg-open "${authUrl}"`); } catch {}

    const code = await new Promise((resolve) => {
      process.stdout.write('\nEnter the code from the browser: ');
      process.stdin.once('data', (d) => resolve(d.toString().trim()));
    });

    const { tokens } = await this.oauth2Client.getToken(code);
    await this._persistToken(tokens);
    this.oauth2Client.setCredentials(tokens);
  }

  async _persistToken(tokens) {
    try {
      await fs.writeFile(this.tokenFile, JSON.stringify(tokens, null, 2));
    } catch (err) {
      this.emit('youtube:token_persist_failed', err.message);
    }
  }

  async _exists(p) { try { await fs.access(p); return true; } catch { return false; } }
}

export default YouTubeUploader;
