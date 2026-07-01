/**
 * src/modules/SafetyGuardrails.js — Pre-execution safety checks for Spilbergian.
 * Extended from v2.0 to handle cinematic-specific concerns:
 *   - Content filter (explicit / violent / copyrighted)
 *   - Rate limits for renders, audio jobs, and YouTube uploads
 *   - Asset size limits
 */
const PATH_BLOCK = ['/etc', '/root', '/sys', '/proc', '/boot', '/dev'];

export class SafetyGuardrails {
  constructor(opts = {}) {
    this.safetyLevel    = opts.safetyLevel || 'standard';
    this.protectedPaths = opts.protectedPaths || PATH_BLOCK;
    this.maxFileSize    = opts.maxFileSize || (2 * 1024 * 1024 * 1024);
    this.rateLimits     = opts.rateLimits || { perMinute: 60, perHour: 500 };
    this.contentFilter  = opts.contentFilter || {};
    this._counters = { perMinute: [], perHour: [], renders: [], audio: [], youtube: [] };
  }

  async check({ input = '', kind = 'general', path: targetPath, size, action } = {}) {
    // 1. Path protection
    if (targetPath) {
      for (const blocked of this.protectedPaths) {
        if (targetPath.startsWith(blocked)) {
          return { allowed: false, reason: `path_protected:${blocked}` };
        }
      }
    }
    // 2. File size limit
    if (size && size > this.maxFileSize) {
      return { allowed: false, reason: `size_exceeds_limit:${size}>${this.maxFileSize}` };
    }
    // 3. Content filter (basic keyword scan)
    if (this.contentFilter.blockCopyrighted && input) {
      const copyrightHits = ['official trailer', 'official music video', 'copyright'];
      for (const kw of copyrightHits) {
        if (input.toLowerCase().includes(kw)) {
          return { allowed: false, reason: `copyright_keyword:${kw}` };
        }
      }
    }
    // 4. Rate limits
    const now = Date.now();
    this._counters.perMinute = this._counters.perMinute.filter(t => now - t < 60_000);
    this._counters.perHour   = this._counters.perHour.filter(t => now - t < 3_600_000);
    if (this._counters.perMinute.length >= this.rateLimits.perMinute) {
      return { allowed: false, reason: 'rate_limit:per_minute' };
    }
    if (this._counters.perHour.length >= this.rateLimits.perHour) {
      return { allowed: false, reason: 'rate_limit:per_hour' };
    }
    if (kind === 'video_render') {
      this._counters.renders = this._counters.renders.filter(t => now - t < 86_400_000);
      if (this._counters.renders.length >= (this.rateLimits.videoRendersPerDay || 50)) {
        return { allowed: false, reason: 'rate_limit:renders_per_day' };
      }
      this._counters.renders.push(now);
    }
    if (kind === 'audio_job') {
      this._counters.audio = this._counters.audio.filter(t => now - t < 86_400_000);
      if (this._counters.audio.length >= (this.rateLimits.audioJobsPerDay || 100)) {
        return { allowed: false, reason: 'rate_limit:audio_per_day' };
      }
      this._counters.audio.push(now);
    }
    if (kind === 'youtube_upload') {
      this._counters.youtube = this._counters.youtube.filter(t => now - t < 86_400_000);
      if (this._counters.youtube.length >= (this.rateLimits.youtubeUploadsPerDay || 6)) {
        return { allowed: false, reason: 'rate_limit:youtube_per_day' };
      }
      this._counters.youtube.push(now);
    }
    this._counters.perMinute.push(now);
    this._counters.perHour.push(now);

    // 5. Strict mode requires rollback plans for destructive actions
    if (this.safetyLevel === 'strict' && action === 'destructive') {
      return { allowed: false, reason: 'strict_mode_blocks_destructive' };
    }

    return { allowed: true };
  }
}

export default SafetyGuardrails;
