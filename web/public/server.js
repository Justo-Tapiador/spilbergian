#!/usr/bin/env node
/**
 * web/server.js — HTTP control plane for PREDATOR JUNGLE v3.0 "Spilbergian"
 *
 * A small Express server that exposes:
 *   GET  /health            → liveness probe for Docker / k8s healthcheck
 *   GET  /status            → director status (persona, version, providers)
 *   POST /api/movies        → kick off a new movie from a creative brief
 *   GET  /api/movies/:id    → fetch a stored project manifest (best-effort)
 *   GET  /api/metrics       → runtime metrics snapshot
 *   GET  /                  → landing page (links + banner)
 *
 * The server is intentionally lightweight: it does NOT run the full
 * cinematic pipeline in-process by default. Long-running jobs should
 * be queued. For a quick demo, POST /api/movies runs the pipeline
 * synchronously and returns the manifest.
 *
 * Usage:
 *   node web/server.js                # default port 3000
 *   PORT=8080 node web/server.js
 *   SPILBERGIAN_WEB_KEY=secret node web/server.js   # optional API key
 */
import express from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SpilbergianDirector } from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);
const API_KEY = process.env.SPILBERGIAN_WEB_KEY; // optional bearer token
const SHUTDOWN_TIMEOUT_MS = 10_000;

const app = express();
app.use(express.json({ limit: '1mb' }));

// ── Optional API-key middleware ──────────────────────────────────────
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
    _director = new SpilbergianDirector();
    await _director.init();
  }
  return _director;
}

// ── Health check (called by Docker / k8s) ───────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime_sec: Math.round(process.uptime()),
    memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    ts: new Date().toISOString(),
  });
});

// ── Status ───────────────────────────────────────────────────────────
app.get('/status', async (_req, res) => {
  try {
    const director = await getDirector();
    res.json(director.status());
  } catch (err) {
    res.status(500).json({ error: 'status_failed', message: err.message });
  }
});

// ── Metrics ──────────────────────────────────────────────────────────
app.get('/api/metrics', async (_req, res) => {
  try {
    const director = await getDirector();
    res.json(director.metrics?.getSummary?.() ?? { note: 'metrics unavailable' });
  } catch (err) {
    res.status(500).json({ error: 'metrics_failed', message: err.message });
  }
});

// ── Create movie (synchronous demo endpoint — heavy!) ───────────────
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

// ── Fetch a stored project manifest (best-effort disk lookup) ────────
app.get('/api/movies/:id', async (req, res) => {
  const id = req.params.id;
  const projectsDir = path.resolve(process.cwd(), 'data/projects');
  try {
    const entries = await fs.readdir(projectsDir).catch(() => []);
    // Match either an exact dir name or a manifest containing the id.
    const match = entries.find(e => e === id || e.includes(id));
    if (!match) return res.status(404).json({ error: 'not_found', id });
    const manifestPath = path.join(projectsDir, match, 'manifest.json');
    const manifest = await fs.readFile(manifestPath, 'utf-8').catch(() => null);
    if (!manifest) return res.status(404).json({ error: 'manifest_missing', id, projectDir: match });
    res.type('application/json').send(manifest);
  } catch (err) {
    res.status(500).json({ error: 'lookup_failed', message: err.message });
  }
});

// ── Landing page ─────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Spilbergian — AI Cinematic Director</title>
  <style>
    body { font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
           max-width: 720px; margin: 4rem auto; padding: 0 1.5rem; color: #1a1f3a; }
    h1 { color: #f4a261; }
    code { background: #f4f4f4; padding: 0.1em 0.4em; border-radius: 4px; }
    a { color: #e76f51; }
  </style>
</head>
<body>
  <h1>🎬 Spilbergian — AI Cinematic Director</h1>
  <p>PREDATOR JUNGLE v3.0 control plane is running.</p>
  <ul>
    <li><a href="/health">/health</a> — liveness probe</li>
    <li><a href="/status">/status</a> — director status</li>
    <li><a href="/api/metrics">/api/metrics</a> — runtime metrics</li>
    <li><code>POST /api/movies</code> — body: <code>{ "brief": "..." }</code></li>
    <li><code>GET /api/movies/:id</code> — fetch a stored project manifest</li>
  </ul>
</body>
</html>`);
});

// ── 404 ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'not_found', path: req.path });
});

// ── Global error handler ─────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[spilbergian-web] unhandled error:', err);
  res.status(500).json({ error: 'internal', message: err.message });
});

// ── Boot ─────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`[spilbergian-web] listening on http://0.0.0.0:${PORT}`);
  console.log(`[spilbergian-web] healthcheck: http://localhost:${PORT}/health`);
});

// ── Graceful shutdown ────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`[spilbergian-web] ${signal} received, shutting down...`);
  server.close(() => console.log('[spilbergian-web] HTTP server closed.'));
  if (_director) {
    try { await _director.shutdown(); } catch (e) { console.error('director shutdown error:', e.message); }
  }
  setTimeout(() => process.exit(0), 500).unref();
  // Force-exit if something is stuck.
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

export default app;
