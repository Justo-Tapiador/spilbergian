/**
 * tests/spilbergian.test.js — Smoke tests for Spilbergian v3.0
 * Run with: npm test
 */
import { SpilbergianDirector, SpielbergPersona, CinematicBrain } from '../src/index.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else      { failed++; console.error(`  ✗ ${msg}`); }
}

async function test(name, fn) {
  console.log(`\n→ ${name}`);
  try { await fn(); }
  catch (err) {
    failed++;
    console.error(`  ✗ threw: ${err.message}`);
    console.error(err.stack);
  }
}

// ── Persona tests ────────────────────────────────────────────────────
await test('SpielbergPersona builds with default config', () => {
  const persona = new SpielbergPersona({
    name: 'Spilbergian',
    inspiration: 'Steven Spielberg',
    signatureTechniques: ['long_take_suspense', 'wide_eyed_wonder'],
    preferredGenres: ['adventure'],
    narrativeBeats: ['ordinary_world', 'inciting_incident', 'resolution_and_wonder'],
    toneKeywords: ['awe', 'hope'],
    colorPalette: { primary: '#1a1f3a' },
    pacing: { defaultCutsPerMinute: 8, actionCutsPerMinute: 18, emotionalCutsPerMinute: 4 },
  });
  assert(persona.name === 'Spilbergian', 'persona name');
  assert(persona.preferredGenres.length === 1, 'preferred genres set');
  assert(persona.cutRateFor('triumphant_peril') === 18, 'action cut rate');
  assert(persona.cutRateFor('transcendent_wonder') === 4, 'emotional cut rate');
  assert(persona.validateArc(['ordinary_world', 'inciting_incident', 'resolution_and_wonder']), 'valid arc');
  assert(!persona.validateArc(['inciting_incident']), 'invalid arc rejected');
  assert(persona.isSignatureShot('a long take suspense shot'), 'signature shot detected');
});

// ── CinematicBrain tests ─────────────────────────────────────────────
await test('CinematicBrain produces a structured plan', async () => {
  const config = {
    agent: { version: '3.0.0' },
    persona: {
      name: 'Spilbergian',
      inspiration: 'Steven Spielberg',
      signatureTechniques: ['wide_eyed_wonder', 'silhouette_against_sky'],
      preferredGenres: ['adventure'],
      narrativeBeats: ['ordinary_world', 'inciting_incident', 'resolution_and_wonder'],
      toneKeywords: ['awe', 'hope'],
      colorPalette: { primary: '#1a1f3a' },
      pacing: { defaultCutsPerMinute: 8, actionCutsPerMinute: 18, emotionalCutsPerMinute: 4 },
    },
    llm: { provider: 'none' },
    video: { defaultResolution: '1920x1080', defaultFps: 30 },
    youtube: { defaultDescription: '' },
  };
  const brain = new CinematicBrain(config, new SpielbergPersona(config.persona));
  const plan = await brain.plan('A lonely lighthouse keeper finds a mermaid', {
    format: 'short', genre: 'adventure', language: 'es',
  });
  assert(plan.title && plan.title.length > 0, 'title generated');
  assert(plan.script?.scenes?.length > 0, 'scenes generated');
  assert(plan.storyboard?.length > 0, 'storyboard generated');
  assert(plan.shotList?.length > 0, 'shot list generated');
  assert(plan.renderPrompts?.length === plan.shotList.length, 'render prompts match shots');
  assert(plan.tags?.length > 0, 'tags generated');
  assert(plan.thumbnailPrompt, 'thumbnail prompt generated');
});

// ── Director lifecycle ───────────────────────────────────────────────
await test('SpilbergianDirector initialises and reports status', async () => {
  const director = new SpilbergianDirector({ llm: { provider: 'none' } });
  await director.init();
  const s = director.status();
  assert(s.persona === 'Spilbergian', 'persona name in status');
  assert(s.version === '3.0.0', 'version 3.0.0');
  assert(s.specialty === 'cinematic_video_creation', 'specialty set');
  assert(Array.isArray(s.videoProviders), 'video providers listed');
  await director.shutdown();
});

// ── Trainer tests ────────────────────────────────────────────────────
await test('SpilbergianTrainer runs all 6 phases', async () => {
  const director = new SpilbergianDirector({ llm: { provider: 'none' } });
  await director.init();
  const history = await director.train({
    epochsI: 2, epochsII_T1: 2, epochsII_T2: 2, epochsII_T3: 2,
    epochsIII: 2, epochsIV: 2, epochsCinematic: 2, epochsStyleReward: 2,
  });
  const phases = new Set(history.map(r => r.phase));
  assert(phases.has('I'), 'phase I ran');
  assert(phases.has('II-T1'), 'phase II-T1 ran');
  assert(phases.has('III'), 'phase III ran');
  assert(phases.has('IV'), 'phase IV ran');
  assert(phases.has('V-cinematic'), 'phase V (cinematic) ran');
  assert(phases.has('VI-style-reward'), 'phase VI (style reward) ran');
  await director.shutdown();
});

// ── Summary ──────────────────────────────────────────────────────────
console.log(`\n────────────────────────────────────────`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`────────────────────────────────────────`);
process.exit(failed > 0 ? 1 : 0);
