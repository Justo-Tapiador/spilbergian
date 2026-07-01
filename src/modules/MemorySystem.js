/**
 * src/modules/MemorySystem.js — Three-tier persistent memory for Spilbergian.
 * Episodic, semantic, and working memory with optional disk persistence.
 * Extends v2.0 with cinematic-specific helpers (rememberRender, recallStyle).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';

const cosineSim = (a, b) => {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  return (na && nb) ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
};

const hashEmbed = (text, dim = 64) => {
  // Cheap hash-based pseudo-embedding for semantic similarity.
  // For real semantic memory, replace with sentence-embedding model.
  const vec = new Array(dim).fill(0);
  const tokens = String(text || '').toLowerCase().split(/\W+/).filter(Boolean);
  for (const tok of tokens) {
    let h = 0;
    for (let i = 0; i < tok.length; i++) h = (h * 31 + tok.charCodeAt(i)) | 0;
    vec[Math.abs(h) % dim] += 1;
  }
  const n = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / n);
};

export class MemorySystem {
  constructor(opts = {}) {
    this.storageDir = opts.storageDir || './data/memory';
    this.maxEpisodic = opts.maxEpisodic || 5000;
    this.maxWorking  = opts.maxWorking  || 25;
    this.enablePersistence = opts.enablePersistence !== false;
    this.episodic  = [];
    this.semantic  = new Map();
    this.working   = [];
  }

  async init() {
    if (!this.enablePersistence) return;
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      await this._load();
    } catch (err) { console.warn('[Memory] init skipped:', err.message); }
  }

  async _load() {
    try {
      const epi = path.join(this.storageDir, 'episodic.json');
      const sem = path.join(this.storageDir, 'semantic.json');
      if (await this._exists(epi)) {
        this.episodic = JSON.parse(await fs.readFile(epi, 'utf-8'));
      }
      if (await this._exists(sem)) {
        const entries = JSON.parse(await fs.readFile(sem, 'utf-8'));
        this.semantic = new Map(entries);
      }
    } catch (err) { console.warn('[Memory] load failed:', err.message); }
  }

  async _persist() {
    if (!this.enablePersistence) return;
    try {
      await fs.writeFile(path.join(this.storageDir, 'episodic.json'), JSON.stringify(this.episodic));
      await fs.writeFile(path.join(this.storageDir, 'semantic.json'), JSON.stringify([...this.semantic.entries()]));
    } catch (err) { console.warn('[Memory] persist failed:', err.message); }
  }

  async _exists(p) { try { await fs.access(p); return true; } catch { return false; } }

  /** Store an episodic memory with text + structured payload. */
  async store(kind, text, payload = {}, meta = {}) {
    const entry = {
      id: uuidv4(),
      kind,
      text,
      payload,
      embedding: hashEmbed(text),
      ts: Date.now(),
      meta,
    };
    this.episodic.unshift(entry);
    if (this.episodic.length > this.maxEpisodic) this.episodic.length = this.maxEpisodic;
    await this._persist();
    return entry;
  }

  /** Recall top-K most similar episodic memories. */
  async recall(query, opts = {}) {
    const limit = opts.limit || 5;
    const minSim = opts.minSimilarity ?? 0.0;
    const qv = hashEmbed(query);
    const scored = this.episodic.map(e => ({
      ...e, similarity: cosineSim(qv, e.embedding),
    }));
    return scored
      .filter(e => e.similarity >= minSim)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /** Store a semantic key->value fact with confidence. */
  async storeSemantic(key, value, confidence = 0.8) {
    this.semantic.set(key, { value, confidence, ts: Date.now() });
    await this._persist();
  }

  /** Lookup a semantic fact. */
  lookupSemantic(key) { return this.semantic.get(key); }

  /** Push into the working memory buffer (TTL items). */
  pushWorking(item) {
    this.working.unshift({ ...item, ts: Date.now() });
    if (this.working.length > this.maxWorking) this.working.length = this.maxWorking;
  }

  /** Read the working memory buffer. */
  readWorking() { return [...this.working]; }

  // ── Spilbergian-specific helpers ─────────────────────────────────────
  async rememberRender(prompt, result, meta = {}) {
    return this.store('render', prompt, result, { ...meta, kind_detail: 'video_render' });
  }

  async rememberStyleAdherence(plan, score) {
    return this.storeSemantic(`style:${plan.id || plan.title || 'plan'}`, score, score.score || 0.7);
  }

  async recallRendersFor(prompt, limit = 3) {
    return this.recall(prompt, { limit, kind: 'render' });
  }

  clearWorking() { this.working = []; }
}

export default MemorySystem;
