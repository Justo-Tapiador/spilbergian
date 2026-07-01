/**
 * src/tools/MediaAssetTool.js — Asset management for Spilbergian.
 * Handles project directories, asset caching, file naming, cleanup.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export class MediaAssetTool {
  constructor(config) {
    this.config = config;
    this.baseDir = './data/assets';
    this.projectsDir = './data/projects';
  }

  async init() {
    await fs.mkdir(this.baseDir, { recursive: true });
    await fs.mkdir(this.projectsDir, { recursive: true });
    await fs.mkdir(path.join(this.baseDir, 'video'), { recursive: true });
    await fs.mkdir(path.join(this.baseDir, 'audio'), { recursive: true });
    await fs.mkdir(path.join(this.baseDir, 'thumbnails'), { recursive: true });
  }

  /** Ensure a project directory exists with the standard sub-structure. */
  async ensureProjectDir(projectName) {
    const dir = path.join(this.projectsDir, projectName);
    await fs.mkdir(dir, { recursive: true });
    await fs.mkdir(path.join(dir, 'video'), { recursive: true });
    await fs.mkdir(path.join(dir, 'audio'), { recursive: true });
    await fs.mkdir(path.join(dir, 'renders'), { recursive: true });
    return dir;
  }

  /** Hash a file for cache lookup. */
  async hashFile(filePath) {
    const fsSync = await import('node:fs');
    return new Promise((resolve, reject) => {
      const h = createHash('sha1');
      const s = fsSync.createReadStream(filePath);
      s.on('data', d => h.update(d));
      s.on('end', () => resolve(h.digest('hex')));
      s.on('error', reject);
    });
  }

  /** List all project directories. */
  async listProjects() {
    try {
      const entries = await fs.readdir(this.projectsDir, { withFileTypes: true });
      return entries.filter(e => e.isDirectory()).map(e => e.name);
    } catch { return []; }
  }

  /** Get a project manifest if it exists. */
  async loadManifest(projectName) {
    const p = path.join(this.projectsDir, projectName, 'manifest.json');
    try { return JSON.parse(await fs.readFile(p, 'utf-8')); } catch { return null; }
  }

  /** Clean up old cached assets (older than maxAgeMs). */
  async cleanupCache(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
    const now = Date.now();
    let removed = 0;
    for (const sub of ['video', 'audio', 'thumbnails']) {
      const dir = path.join(this.baseDir, sub);
      try {
        const files = await fs.readdir(dir);
        for (const f of files) {
          const p = path.join(dir, f);
          const stat = await fs.stat(p);
          if (now - stat.mtimeMs > maxAgeMs) {
            await fs.unlink(p);
            removed++;
          }
        }
      } catch {}
    }
    return removed;
  }
}

export default MediaAssetTool;
