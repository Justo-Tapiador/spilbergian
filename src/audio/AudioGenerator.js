/**
 * src/audio/AudioGenerator.js — Abstract base for soundtrack generators.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import axios from 'axios';

export class AudioGenerator {
  constructor(config) {
    this.config = config;
    this.name = this.constructor.name;
  }

  async generate(promptSpec, outPath) {
    throw new Error(`${this.name}.generate() not implemented`);
  }

  async download(url, outPath) {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    const res = await axios.get(url, { responseType: 'stream' });
    const writer = (await import('node:fs')).createWriteStream(outPath);
    for await (const chunk of res.data) writer.write(chunk);
    writer.end();
    return outPath;
  }

  async savePlaceholder(promptSpec, outPath) {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    const slate = {
      provider: this.name,
      prompt: promptSpec.prompt,
      durationSec: promptSpec.durationSec,
      generatedAt: new Date().toISOString(),
      note: 'placeholder — no API key configured',
    };
    await fs.writeFile(outPath + '.placeholder.json', JSON.stringify(slate, null, 2));
    return { path: outPath, provider: this.name, cost: 0, placeholder: true };
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

export default AudioGenerator;
