/**
 * src/youtube/ThumbnailGenerator.js — Generate a YouTube thumbnail.
 *
 * Approach:
 *   1. Use the LLM to write a vivid, lens-flare-rich thumbnail prompt
 *      (in the Spielberg "wonder face" style).
 *   2. Use z-ai-web-dev-sdk's image generation API (or any compatible
 *      image API) to produce a 1280x720 PNG.
 *   3. Optionally composite the movie title on top via sharp.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import axios from 'axios';
import sharp from 'sharp';

export class ThumbnailGenerator {
  constructor(brain, assets) {
    this.brain  = brain;
    this.assets = assets;
  }

  async generate(plan, projectDir) {
    const outPath = path.join(projectDir, 'thumbnail.png');
    await fs.mkdir(path.dirname(outPath), { recursive: true });

    const prompt = plan.thumbnailPrompt || this._defaultPrompt(plan);
    const imageUrl = await this._generateImage(prompt);
    if (!imageUrl) {
      // Fallback: produce a solid-color slate with the title baked in.
      await this._generateSlate(plan, outPath);
      return outPath;
    }
    await this._downloadAndComposite(imageUrl, plan, outPath);
    return outPath;
  }

  _defaultPrompt(plan) {
    return [
      'Cinematic close-up of a protagonist with wide-eyed wonder',
      'looking up at the sky at golden hour, anamorphic lens flare',
      'Spielberg signature composition, 16:9, 1280x720, photorealistic',
      `Genre: ${plan.genre}`,
      'Title-safe area in upper third',
    ].join('. ');
  }

  async _generateImage(prompt) {
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();
      // cogview-3 requires size divisible by 32, in range 512-2880.
      // Use 1024x576 (close to 16:9, both multiples of 32) and resize with sharp.
      const res = await zai.images.generations.create({
        model: 'cogview-3-plus',
        prompt,
        size: '1024x576',
        n: 1,
      });
      return res.data?.[0]?.url || null;
    } catch (err) {
      console.warn('[ThumbnailGenerator] SDK image generation failed:', err.message);
      return null;
    }
  }

  async _downloadAndComposite(url, plan, outPath) {
    try {
      const res = await axios.get(url, { responseType: 'arraybuffer' });
      const base = sharp(Buffer.from(res.data));

      // Apply a slight dark gradient at the bottom for the title to sit on.
      const overlaySvg = Buffer.from(`
        <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="black" stop-opacity="0" />
              <stop offset="65%" stop-color="black" stop-opacity="0" />
              <stop offset="100%" stop-color="black" stop-opacity="0.7" />
            </linearGradient>
          </defs>
          <rect width="1280" height="720" fill="url(#g)" />
          <text x="50" y="660" font-family="Arial, Helvetica, sans-serif"
                font-size="56" font-weight="bold" fill="#f4a261">${this._escapeXml(plan.title || 'Spilbergian')}</text>
          <text x="52" y="700" font-family="Arial, Helvetica, sans-serif"
                font-size="22" fill="#ffffff" opacity="0.85">Spilbergian · PREDATOR JUNGLE v3</text>
        </svg>
      `);

      await base
        .resize(1280, 720, { fit: 'cover' })
        .composite([{ input: overlaySvg, top: 0, left: 0 }])
        .png()
        .toFile(outPath);
    } catch (err) {
      console.warn('[ThumbnailGenerator] composite failed, using slate:', err.message);
      await this._generateSlate(plan, outPath);
    }
  }

  async _generateSlate(plan, outPath) {
    const svg = Buffer.from(`
      <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1a1f3a" />
            <stop offset="100%" stop-color="#0d1b2a" />
          </linearGradient>
        </defs>
        <rect width="1280" height="720" fill="url(#bg)" />
        <circle cx="980" cy="220" r="120" fill="#f4a261" opacity="0.35" />
        <circle cx="980" cy="220" r="80" fill="#ffb86b" opacity="0.55" />
        <text x="80" y="320" font-family="Arial, Helvetica, sans-serif"
              font-size="68" font-weight="bold" fill="#e9c46a">${this._escapeXml(plan.title || 'Spilbergian')}</text>
        <text x="80" y="380" font-family="Arial, Helvetica, sans-serif"
              font-size="28" fill="#f4a261">Una pel[iacute]cula de Spilbergian</text>
        <text x="80" y="650" font-family="Arial, Helvetica, sans-serif"
              font-size="22" fill="#ffffff" opacity="0.6">PREDATOR JUNGLE v3 · AJN Framework</text>
      </svg>
    `);
    await sharp(svg).png().toFile(outPath);
  }

  _escapeXml(s) {
    return String(s).replace(/[<>&'"]/g, c => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;',
    }[c]));
  }
}

export default ThumbnailGenerator;
