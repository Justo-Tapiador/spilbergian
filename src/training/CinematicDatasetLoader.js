/**
 * src/training/CinematicDatasetLoader.js — Load Spielberg-style training
 * samples from data/training/{scenes,scripts,storyboards}.
 *
 * Each sample file is a JSON object with:
 *   { brief, opts: { format, genre, language, targetDurationSec },
 *     expected: { tones: [...], minShots: N, titleKeywords: [...] } }
 *
 * If no files are present, returns a small built-in synthetic dataset
 * so the trainer always has something to learn from.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const BUILTIN_SCENES = [
  {
    brief: 'A lonely lighthouse keeper discovers a stranded mermaid at dawn.',
    opts: { format: 'short', genre: 'family', language: 'es' },
    expected: { tones: ['wide_eyed_wonder', 'transcendent_wonder'], minShots: 6 },
  },
  {
    brief: 'A young boy finds a worn map in his grandfather\u2019s attic.',
    opts: { format: 'short', genre: 'adventure', language: 'es' },
    expected: { tones: ['mysterious_awe', 'wide_eyed_wonder'], minShots: 6 },
  },
  {
    brief: 'An astronaut on a dying Mars sees a single green sprout in the dust.',
    opts: { format: 'featurette', genre: 'sci-fi', language: 'en' },
    expected: { tones: ['desolation', 'transcendent_wonder'], minShots: 10 },
  },
  {
    brief: 'A fishing village rallies to save a beached whale at sunrise.',
    opts: { format: 'short', genre: 'family', language: 'es' },
    expected: { tones: ['rising_stakes', 'triumphant_peril'], minShots: 6 },
  },
  {
    brief: 'A retired pilot teaches his granddaughter to fly before he loses his sight.',
    opts: { format: 'featurette', genre: 'historical_drama', language: 'es' },
    expected: { tones: ['calm_yearning', 'transcendent_wonder'], minShots: 10 },
  },
  {
    brief: 'A scientist discovers that her AI has been painting at night.',
    opts: { format: 'short', genre: 'sci-fi', language: 'en' },
    expected: { tones: ['mysterious_awe', 'shocked_realization'], minShots: 6 },
  },
];

export class CinematicDatasetLoader {
  constructor(config) {
    this.config = config;
    this.datasets = config.datasets || {
      scenesDir:      './data/training/scenes',
      scriptsDir:     './data/training/scripts',
      storyboardsDir: './data/training/storyboards',
    };
  }

  async _loadDir(dir) {
    const out = [];
    try {
      const entries = await fs.readdir(dir);
      for (const f of entries) {
        if (!f.endsWith('.json')) continue;
        try {
          const data = JSON.parse(await fs.readFile(path.join(dir, f), 'utf-8'));
          if (Array.isArray(data)) out.push(...data);
          else out.push(data);
        } catch (err) {
          console.warn(`[DatasetLoader] Skipping ${f}: ${err.message}`);
        }
      }
    } catch { /* dir missing */ }
    return out;
  }

  async loadScenes() {
    const userSamples = await this._loadDir(this.datasets.scenesDir);
    if (userSamples.length) return userSamples;
    return BUILTIN_SCENES;
  }

  async loadScripts() {
    const userSamples = await this._loadDir(this.datasets.scriptsDir);
    if (userSamples.length) return userSamples;
    return BUILTIN_SCENES;
  }

  async loadStoryboards() {
    const userSamples = await this._loadDir(this.datasets.storyboardsDir);
    return userSamples;
  }

  /** Write the built-in scenes to disk so users can inspect/edit them. */
  async seedBuiltinDatasets() {
    for (const dir of Object.values(this.datasets)) {
      await fs.mkdir(dir, { recursive: true });
    }
    await fs.writeFile(
      path.join(this.datasets.scenesDir, 'builtin_scenes.json'),
      JSON.stringify(BUILTIN_SCENES, null, 2),
    );
    await fs.writeFile(
      path.join(this.datasets.scriptsDir, 'builtin_scripts.json'),
      JSON.stringify(BUILTIN_SCENES, null, 2),
    );
    return BUILTIN_SCENES.length;
  }
}

export default CinematicDatasetLoader;
