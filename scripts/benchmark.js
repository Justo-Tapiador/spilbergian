#!/usr/bin/env node
/**
 * scripts/benchmark.js — Performance & quality benchmark for Spilbergian v3.0
 *
 * Measures:
 *   1. Cold-start init time of the SpilbergianDirector
 *   2. CinematicBrain.plan() latency across N briefs
 *   3. Style-adherence score distribution of generated plans
 *   4. Memory footprint before / after a batch
 *
 * Usage:
 *   node scripts/benchmark.js               # default 5 briefs
 *   node scripts/benchmark.js --n 20
 *   node scripts/benchmark.js --format vertical --genre sci-fi
 */
import { SpilbergianDirector } from '../src/index.js';

const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
}

const N          = parseInt(arg('n', '5'), 10);
const FORMAT     = arg('format', 'short');
const GENRE      = arg('genre', 'adventure');
const LANGUAGE   = arg('language', 'es');

const BRIEFS = [
  'A lonely lighthouse keeper discovers a stranded mermaid.',
  'Two siblings find an old map in their grandfather\u2019s attic.',
  'A retired astronaut is called back for one last mission to Europa.',
  'A small village defends itself against an incoming sandstorm.',
  'A young inventor builds a time machine out of an old radio.',
  'A family of foxes migrates across a changing landscape.',
  'A librarian discovers a book that writes itself overnight.',
  'A deep-sea diver meets a forgotten civilization beneath the waves.',
  'A child befriends a robot left behind by a travelling circus.',
  'A storm chaser witnesses something impossible inside a tornado.',
];

function ms() { return performance.now(); }
function fmtMs(x) { return x.toFixed(1).padStart(7) + ' ms'; }

async function benchInit() {
  const t0 = ms();
  const director = new SpilbergianDirector({ llm: { provider: 'none' } });
  await director.init();
  const t1 = ms();
  return { director, ms: t1 - t0 };
}

async function benchBrain(director, n) {
  const brain = director.brain;
  const samples = [];
  let totalAdherence = 0;
  for (let i = 0; i < n; i++) {
    const brief = BRIEFS[i % BRIEFS.length];
    const t0 = ms();
    const plan = await brain.plan(brief, { format: FORMAT, genre: GENRE, language: LANGUAGE });
    const t1 = ms();
    const adherence = director.persona.styleAdherence(plan).score;
    samples.push({ brief, ms: t1 - t0, shots: plan.shotList?.length ?? 0, adherence });
    totalAdherence += adherence;
  }
  return { samples, avgAdherence: totalAdherence / n };
}

function summary(samples) {
  if (!samples.length) return null;
  const times = samples.map(s => s.ms).sort((a, b) => a - b);
  const p = (q) => times[Math.min(times.length - 1, Math.floor(q * times.length))];
  return {
    n:    samples.length,
    p50:  p(0.50),
    p90:  p(0.90),
    p99:  p(0.99),
    min:  times[0],
    max:  times[times.length - 1],
    mean: times.reduce((a, b) => a + b, 0) / times.length,
  };
}

function memoryMB() {
  const m = process.memoryUsage();
  return {
    rss:     Math.round(m.rss / 1024 / 1024),
    heap:    Math.round(m.heapUsed / 1024 / 1024),
    external: Math.round(m.external / 1024 / 1024),
  };
}

// ── Run ──────────────────────────────────────────────────────────────
console.log('\n\u{1F3AC} Spilbergian v3.0 — Benchmark');
console.log('   N        =', N);
console.log('   format   =', FORMAT);
console.log('   genre    =', GENRE);
console.log('   language =', LANGUAGE);
console.log('   node     =', process.version);
console.log('   mem0     =', JSON.stringify(memoryMB()));

const memBefore = memoryMB();
const { director, ms: initMs } = await benchInit();
console.log(`\n\u{2705} Director init: ${fmtMs(initMs)}`);

console.log(`\n\u{1F550} Running ${N} brain.plan() iterations...`);
const { samples, avgAdherence } = await benchBrain(director, N);
const s = summary(samples);

console.log('\n\u{1F4CA} Latency (ms):');
console.log(`   min  ${fmtMs(s.min)}`);
console.log(`   p50  ${fmtMs(s.p50)}`);
console.log(`   p90  ${fmtMs(s.p90)}`);
console.log(`   p99  ${fmtMs(s.p99)}`);
console.log(`   max  ${fmtMs(s.max)}`);
console.log(`   mean ${fmtMs(s.mean)}`);

console.log(`\n\u{1F3A8} Style adherence:`);
console.log(`   avg = ${(avgAdherence * 100).toFixed(1)}%`);
const shotCounts = samples.map(s => s.shots);
console.log(`   shots/plan: min=${Math.min(...shotCounts)} max=${Math.max(...shotCounts)} avg=${(shotCounts.reduce((a,b)=>a+b,0)/shotCounts.length).toFixed(1)}`);

const memAfter = memoryMB();
console.log('\n\u{1F4BE} Memory (MB):');
console.log(`   rss      ${memBefore.rss}  ->  ${memAfter.rss}   (\u0394 ${memAfter.rss - memBefore.rss})`);
console.log(`   heap     ${memBefore.heap}  ->  ${memAfter.heap}   (\u0394 ${memAfter.heap - memBefore.heap})`);
console.log(`   external ${memBefore.external}  ->  ${memAfter.external}   (\u0394 ${memAfter.external - memBefore.external})`);

await director.shutdown();
console.log('\n\u{2705} Benchmark complete.\n');
process.exit(0);
