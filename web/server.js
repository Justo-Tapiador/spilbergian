#!/usr/bin/env node
/**
 * web/server.js — HTTP control plane + interactive UI for
 * PREDATOR JUNGLE v3.0 "Spilbergian"
 *
 * Endpoints:
 *   GET  /                       → interactive dashboard (web/public/index.html)
 *   GET  /health                 → liveness probe (Docker / k8s)
 *   GET  /status                 → director status (persona, version, providers)
 *   GET  /api/metrics            → runtime metrics snapshot
 *   GET  /api/persona            → persona details (genres, beats, palette)
 *   GET  /api/config             → safe config view (no secrets)
 *   GET  /api/projects           → list local projects (data/projects/*)
 *   GET  /api/projects/:id       → fetch a stored project manifest
 *   POST /api/plan               → run CinematicBrain.plan() only (no render)
 *   POST /api/movies             → run full pipeline (heavy, synchronous)
 *   POST /api/train              → trigger a short training round
 *   GET  /api/providers          → list video / audio providers and status
 *
 * Static assets under /public/* are served from web/public/*.
 *
 * Usage:
 *   node web/server.js                            # port 3000
 *   PORT=8080 node web/server.js
 *   SPILBERGIAN_WEB_KEY=secret node web/server.js # optional API key
 *   SPILBERGIAN_LLM=none node web/server.js       # disable LLM calls (offline mode)
 */
import express from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SpilbergianDirector } from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);
const API_KEY = process.env.SPILBERGIAN_WEB_KEY;
const SHUTDOWN_TIMEOUT_MS = 10_000;
const PROJECTS_DIR = path.resolve(process.cwd(), 'data/projects');

const app = express();
app.use(express.json({ limit: '2mb' }));

// ── Optional API-key middleware (only applied to /api/* write ops) ──
function requireApiKey(req, res, next) {
  if (!API_KEY) return next();
  const auth = req.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.query.key;
  if (token !== API_KEY) {
    return res.status(401).json({ error: 'unauthorized', hint: 'send Authorization: Bearer <key>' });
  }
  next();
}

// ── Shared director instance (lazy) ─────────────────────────────────
let _director = null;
async function getDirector() {
  if (!_director) {
    const opts = {};
    // Allow disabling LLM calls from the web UI (useful for offline demos).
    if ((process.env.SPILBERGIAN_LLM || '').toLowerCase() === 'none') {
      opts.llm = { provider: 'none' };
    }
    _director = new SpilbergianDirector(opts);
    await _director.init();
  }
  return _director;
}

// ── Static assets under /public ─────────────────────────────────────
app.use('/public', express.static(path.join(__dirname, 'public'), {
  fallthrough: true,
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
}));

// ── Health check ────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime_sec: Math.round(process.uptime()),
    memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    ts: new Date().toISOString(),
  });
});

// ── Status ──────────────────────────────────────────────────────────
app.get('/status', async (_req, res) => {
  try {
    const director = await getDirector();
    res.json(director.status());
  } catch (err) {
    res.status(500).json({ error: 'status_failed', message: err.message });
  }
});

// ── Metrics ─────────────────────────────────────────────────────────
app.get('/api/metrics', async (_req, res) => {
  try {
    const director = await getDirector();
    res.json(director.metrics?.getSummary?.() ?? { note: 'metrics unavailable' });
  } catch (err) {
    res.status(500).json({ error: 'metrics_failed', message: err.message });
  }
});

// ── Persona details ─────────────────────────────────────────────────
app.get('/api/persona', async (_req, res) => {
  try {
    const director = await getDirector();
    const p = director.persona;
    res.json({
      name: p.name,
      inspiration: p.inspiration,
      signatureTechniques: p.signatureTechniques,
      preferredGenres: p.preferredGenres,
      narrativeBeats: p.narrativeBeats,
      toneKeywords: p.toneKeywords,
      colorPalette: p.colorPalette,
      pacing: p.pacing,
    });
  } catch (err) {
    res.status(500).json({ error: 'persona_failed', message: err.message });
  }
});

// ── Safe config view (no secrets) ───────────────────────────────────
app.get('/api/config', async (_req, res) => {
  try {
    const director = await getDirector();
    const c = director.config;
    res.json({
      agent: c.agent,
      llm: { provider: c.llm?.provider, model: c.llm?.model },
      video: {
        defaultResolution: c.video?.defaultResolution,
        defaultFps: c.video?.defaultFps,
        providers: Object.entries(c.video?.providers || {}).map(([k, v]) => ({
          name: k, enabled: v.enabled, priority: v.priority, model: v.model,
        })),
      },
      audio: {
        providers: Object.entries(c.audio?.providers || {}).map(([k, v]) => ({
          name: k, enabled: v.enabled, priority: v.priority, specialty: v.specialty,
        })),
      },
      youtube: {
        defaultPrivacy: c.youtube?.defaultPrivacy,
        defaultLanguage: c.youtube?.defaultLanguage,
        publishSchedule: c.youtube?.publishSchedule,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'config_failed', message: err.message });
  }
});

// ── List projects ───────────────────────────────────────────────────
app.get('/api/projects', async (_req, res) => {
  try {
    const entries = await fs.readdir(PROJECTS_DIR).catch(() => []);
    const out = [];
    for (const name of entries) {
      const full = path.join(PROJECTS_DIR, name);
      const stat = await fs.stat(full).catch(() => null);
      if (!stat || !stat.isDirectory()) continue;
      const manifestPath = path.join(full, 'manifest.json');
      const hasManifest = existsSync(manifestPath);
      let title = null, createdAt = null;
      if (hasManifest) {
        try {
          const m = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
          title = m.title ?? null;
          createdAt = m.createdAt ?? null;
        } catch { /* ignore */ }
      }
      out.push({ id: name, title, createdAt, hasManifest });
    }
    out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json({ projects: out });
  } catch (err) {
    res.status(500).json({ error: 'list_failed', message: err.message });
  }
});

// ── Fetch a stored project manifest ─────────────────────────────────
app.get('/api/projects/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const entries = await fs.readdir(PROJECTS_DIR).catch(() => []);
    const match = entries.find(e => e === id || e.includes(id));
    if (!match) return res.status(404).json({ error: 'not_found', id });
    const manifestPath = path.join(PROJECTS_DIR, match, 'manifest.json');
    const manifest = await fs.readFile(manifestPath, 'utf-8').catch(() => null);
    if (!manifest) return res.status(404).json({ error: 'manifest_missing', id, projectDir: match });
    res.type('application/json').send(manifest);
  } catch (err) {
    res.status(500).json({ error: 'lookup_failed', message: err.message });
  }
});

// ── Plan only (no render): run CinematicBrain.plan() ────────────────
app.post('/api/plan', requireApiKey, async (req, res) => {
  const { brief, format, genre, language, durationSec } = req.body || {};
  if (!brief || typeof brief !== 'string') {
    return res.status(400).json({ error: 'bad_request', message: 'field "brief" (string) is required' });
  }
  try {
    const director = await getDirector();
    const plan = await director.brain.plan(brief, {
      format: format || 'short',
      genre,
      language: language || 'es',
      targetDurationSec: durationSec,
    });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: 'plan_failed', message: err.message });
  }
});

// ── Create movie (full pipeline — heavy, synchronous) ───────────────
app.post('/api/movies', requireApiKey, async (req, res) => {
  const { brief, format, genre, language, durationSec, uploadToYouTube, projectName } = req.body || {};
  if (!brief || typeof brief !== 'string') {
    return res.status(400).json({ error: 'bad_request', message: 'field "brief" (string) is required' });
  }
  try {
    const director = await getDirector();
    const result = await director.createMovie(brief, {
      format,
      genre,
      language,
      targetDurationSec: durationSec,
      uploadToYouTube: uploadToYouTube === true,
      projectName,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'movie_failed', message: err.message });
  }
});

// ── Train (short round, suitable for UI demo) ───────────────────────
app.post('/api/train', requireApiKey, async (req, res) => {
  const { epochs = 1, phase = 'all' } = req.body || {};
  try {
    const director = await getDirector();
    const history = await director.train({
      epochsI: epochs, epochsII_T1: epochs, epochsII_T2: epochs, epochsII_T3: epochs,
      epochsIII: epochs, epochsIV: epochs,
      epochsCinematic: epochs, epochsStyleReward: epochs,
      phase,
    });
    res.json({ epochs_run: history.length, history });
  } catch (err) {
    res.status(500).json({ error: 'train_failed', message: err.message });
  }
});

// ── Providers list ──────────────────────────────────────────────────
app.get('/api/providers', async (_req, res) => {
  try {
    const director = await getDirector();
    res.json({
      video: director.videoOrch?.listProviders?.() ?? [],
      audio: Object.entries(director.config?.audio?.providers || {}).map(([k, v]) => ({
        name: k, enabled: v.enabled, priority: v.priority, specialty: v.specialty,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'providers_failed', message: err.message });
  }
});

// ── Dashboard route → web/public/index.html ─────────────────────────
app.get('/', (_req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  // Fallback if index.html is missing
  res.type('html').send('<!doctype html><meta charset="utf-8"><title>Spilbergian</title>' +
    '<body style="font-family:sans-serif;color:#eee;background:#0d1117;padding:2rem">' +
    '<h1>🎬 Spilbergian</h1><p>UI missing. Place <code>web/public/index.html</code>.</p>' +
    '<p>Health: <a href="/health" style="color:#f4a261">/health</a></p></body>');
});

// ── 404 ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.accepts('json')) return res.status(404).json({ error: 'not_found', path: req.path });
  res.status(404).send('Not found');
});

// ── Global error handler ────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[spilbergian-web] unhandled error:', err);
  res.status(500).json({ error: 'internal', message: err.message });
});

// ── Boot ────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`[spilbergian-web] listening on http://0.0.0.0:${PORT}`);
  console.log(`[spilbergian-web] dashboard:  http://localhost:${PORT}/`);
  console.log(`[spilbergian-web] health:     http://localhost:${PORT}/health`);
  if (process.env.SPILBERGIAN_LLM === 'none') {
    console.log('[spilbergian-web] LLM disabled (SPILBERGIAN_LLM=none) — running in offline mode');
  }
});

// ── Graceful shutdown ───────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`[spilbergian-web] ${signal} received, shutting down...`);
  server.close(() => console.log('[spilbergian-web] HTTP server closed.'));
  if (_director) {
    try { await _director.shutdown(); } catch (e) { console.error('director shutdown error:', e.message); }
  }
  setTimeout(() => process.exit(0), 500).unref();
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

export default app;
