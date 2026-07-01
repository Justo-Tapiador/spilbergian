/**
 * src/core/CinematicBrain.js — Cinematic reasoning module for Spilbergian.
 *
 * The CinematicBrain turns creative briefs into structured cinematic plans:
 *   brief → story arc → script → storyboard → shot list → render prompts
 *
 * It uses the LLM adapter for scriptwriting and applies the Spielberg
 * persona rules to every creative decision: pacing, color palette,
 * narrative beats, signature shots, and emotional tone.
 */
import { v4 as uuidv4 } from 'uuid';
import { OpenAIAdapter } from '../llm/OpenAIAdapter.js';

const FORMAT_PRESETS = {
  short:       { durationSec: 60,  beats: 5, shotsPerBeat: 2 },
  featurette:  { durationSec: 180, beats: 7, shotsPerBeat: 3 },
  trailer:     { durationSec: 90,  beats: 6, shotsPerBeat: 2 },
  vertical:    { durationSec: 45,  beats: 4, shotsPerBeat: 2 },
  documentary: { durationSec: 240, beats: 8, shotsPerBeat: 2 },
};

export class CinematicBrain {
  constructor(config, persona) {
    this.config = config;
    this.persona = persona;
    this.llm = null;

    if (config.llm?.provider === 'openai') {
      this.llm = new OpenAIAdapter({
        model: config.llm.model,
        temperature: config.llm.temperature,
        maxTokens: config.llm.maxTokens,
      });
    }
  }

  /**
   * Decompose a creative brief into a structured movie plan.
   * @param {string} brief
   * @param {Object} opts — format, genre, language, targetDurationSec
   * @returns {Promise<MoviePlan>}
   */
  async plan(brief, opts = {}) {
    const format = opts.format || 'short';
    const preset = FORMAT_PRESETS[format] || FORMAT_PRESETS.short;
    const durationSec = opts.targetDurationSec || preset.durationSec;
    const beatsCount = preset.beats;
    const genre = opts.genre || this.persona.preferredGenres[0];
    const language = opts.language || 'es';

    const arc = this._generateArc(brief, beatsCount);
    const script = await this._writeScript(brief, { arc, genre, language, durationSec });
    const storyboard = this._buildStoryboard(script, preset);
    const shotList = this._buildShotList(storyboard);
    const renderPrompts = this._buildRenderPrompts(shotList, genre);
    const title = await this._generateTitle(script, language);
    const description = await this._generateDescription(script, language);
    const tags = this._generateTags(script, genre);
    const thumbnailPrompt = this._buildThumbnailPrompt(script, storyboard);

    return {
      id: uuidv4(),
      brief,
      format,
      genre,
      language,
      durationSec,
      arc,
      script,
      storyboard,
      shotList,
      renderPrompts,
      title,
      description,
      tags,
      thumbnailPrompt,
      createdAt: new Date().toISOString(),
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Story arc — uses Spielberg's preferred 9-beat structure (compressed)
  // ─────────────────────────────────────────────────────────────────────
  _generateArc(brief, beatsCount) {
    const allBeats = this.persona.narrativeBeats;
    const selected = [];
    // Always include ordinary_world and resolution_and_wonder; sample the middle.
    selected.push(allBeats[0]);
    const middlePool = allBeats.slice(1, -1);
    const middleNeeded = beatsCount - 2;
    const stride = Math.max(1, Math.floor(middlePool.length / middleNeeded));
    for (let i = 0; i < middleNeeded; i++) {
      selected.push(middlePool[i * stride] || middlePool[i % middlePool.length]);
    }
    selected.push(allBeats[allBeats.length - 1]);

    return selected.map((beat, idx) => ({
      index: idx,
      beat,
      summary: this._beatSummary(beat, brief),
      tone: this._toneFor(beat),
    }));
  }

  _beatSummary(beat, brief) {
    const templates = {
      ordinary_world:        `We meet our protagonist in their ordinary world, hinting at the yearning inside them. Brief: ${brief}`,
      inciting_incident:     `A mysterious event shatters the ordinary — the protagonist is called to adventure.`,
      reluctant_hero:        `Hesitation and refusal. Doubt clouds their face against the amber backlight.`,
      threshold_crossing:    `They cross the threshold into the unknown. A wide-eyed reveal of a new world.`,
      rising_action:         `Trials, allies, and enemies. Stakes grow. The rhythm of the cuts accelerates.`,
      midpoint_reversal:     `A twist reframes everything. The music drops to a single sustained note.`,
      dark_night_of_soul:    `The lowest point. Silhouette against a cold sky. The score carries the weight.`,
      climactic_showdown:    `The final confrontation. Action peaks; cuts come fast; light breaks through.`,
      resolution_and_wonder: `Resolution — and that final Spielberg look of wonder toward the sky.`,
    };
    return templates[beat] || `Beat: ${beat}`;
  }

  _toneFor(beat) {
    const map = {
      ordinary_world:        'calm_yearning',
      inciting_incident:     'mysterious_awe',
      reluctant_hero:        'tense_doubt',
      threshold_crossing:    'wide_eyed_wonder',
      rising_action:         'rising_stakes',
      midpoint_reversal:     'shocked_realization',
      dark_night_of_soul:    'desolation',
      climactic_showdown:    'triumphant_peril',
      resolution_and_wonder: 'transcendent_wonder',
    };
    return map[beat] || 'neutral';
  }

  // ─────────────────────────────────────────────────────────────────────
  // Scriptwriting — uses LLM when available, otherwise uses templates.
  // ─────────────────────────────────────────────────────────────────────
  async _writeScript(brief, { arc, genre, language, durationSec }) {
    if (this.llm) {
      try {
        const system = `You are Spilbergian, a cinematic AI screenwriter in the tradition of Steven Spielberg.
You write short, vivid scripts in ${language}. Each scene has:
  - scene_number
  - location
  - time_of_day
  - description (visual, present tense, no dialogue unless essential)
  - voiceover (one or two sentences of narrator or character interior monologue)
  - tone (from: ${this.persona.toneKeywords.join(', ')})
  - duration_sec

Use Spielberg's signature visual storytelling: wonder, family stakes, silhouette against sky, amber backlight, and a John-Williams-style swelling score.
Always end on a note of awe or hope.`;
        const user = `Brief: ${brief}
Genre: ${genre}
Total duration: ${durationSec} seconds
Story arc beats: ${arc.map(b => b.beat).join(' → ')}

Return ONLY a JSON object: { "title": "...", "scenes": [...] }`;

        const response = await this.llm.chat(user, system);
        const parsed = this._safeJsonParse(response);
        if (parsed && Array.isArray(parsed.scenes)) return parsed;
      } catch (err) {
        console.warn('[SpilbergianBrain] LLM scriptwriting failed, falling back to template:', err.message);
      }
    }

    // Template fallback
    return this._templateScript(brief, arc, genre, language, durationSec);
  }

  _templateScript(brief, arc, genre, language, durationSec) {
    const perBeatSec = Math.floor(durationSec / arc.length);
    const scenes = arc.map((beat, i) => ({
      scene_number: i + 1,
      location:     this._locationForBeat(beat.beat),
      time_of_day:  this._timeOfDayForBeat(beat.beat),
      description:  beat.summary,
      voiceover:    this._voiceoverForBeat(beat.beat, language),
      tone:         beat.tone,
      duration_sec: perBeatSec,
    }));
    const title = this._titleFromBrief(brief, language);
    return { title, scenes };
  }

  _locationForBeat(beat) {
    const map = {
      ordinary_world:        'small town — kitchen / porch',
      inciting_incident:     'forest edge at dawn',
      reluctant_hero:        'family living room, evening',
      threshold_crossing:    'cliff overlooking an unknown valley',
      rising_action:         'varied locations — desert, river, ruin',
      midpoint_reversal:     'interior — dim room with single lamp',
      dark_night_of_soul:    'rain-soaked porch at night',
      climactic_showdown:    'storm-lit mountaintop',
      resolution_and_wonder: 'open field, golden hour',
    };
    return map[beat] || 'unspecified';
  }

  _timeOfDayForBeat(beat) {
    const map = {
      ordinary_world:        'morning — soft warm light',
      inciting_incident:     'dawn — pale blue with amber rim',
      reluctant_hero:        'dusk — orange glow through window',
      threshold_crossing:    'midday — bright, hopeful',
      rising_action:         'varied — quick changes',
      midpoint_reversal:     'night — single warm lamp',
      dark_night_of_soul:    'late night — cold, blue moonlight',
      climactic_showdown:    'storm — flashing lightning',
      resolution_and_wonder: 'golden hour — long shadows',
    };
    return map[beat] || 'unspecified';
  }

  _voiceoverForBeat(beat, language) {
    const es = {
      ordinary_world:        'Había una vez, en un lugar donde el tiempo parecía detenido...',
      inciting_incident:     'Pero una mañana, algo cambió para siempre.',
      reluctant_hero:        'No estaba listo. Nadie lo estaría.',
      threshold_crossing:    'Y sin mirar atrás, cruzó al otro lado.',
      rising_action:         'Cada paso le costaba más. Cada paso le hacía más fuerte.',
      midpoint_reversal:     'Entonces comprendió. Todo lo que creía saber... era mentira.',
      dark_night_of_soul:    'En la oscuridad, solo quedaba una cosa: la promesa.',
      climactic_showdown:    'Y ahí, frente al abismo, eligió ser valiente.',
      resolution_and_wonder: 'Miró al cielo. Y supo que todo había valido la pena.',
    };
    const en = {
      ordinary_world:        'Once, in a place where time seemed to stand still...',
      inciting_incident:     'But one morning, something changed forever.',
      reluctant_hero:        'He was not ready. No one would have been.',
      threshold_crossing:    'And without looking back, he crossed to the other side.',
      rising_action:         'Every step cost him more. Every step made him stronger.',
      midpoint_reversal:     'And then he understood. Everything he believed... was a lie.',
      dark_night_of_soul:    'In the darkness, only one thing remained: the promise.',
      climactic_showdown:    'And there, at the edge of the abyss, he chose to be brave.',
      resolution_and_wonder: 'He looked at the sky. And he knew it had all been worth it.',
    };
    return (language === 'es' ? es : en)[beat] || '';
  }

  _titleFromBrief(brief, language) {
    const words = brief.split(/\s+/).slice(0, 4).join(' ');
    return language === 'es' ? `Crónica de ${words}` : `Chronicle of ${words}`;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Storyboard — break each scene into shots with specific camera/lighting.
  // ─────────────────────────────────────────────────────────────────────
  _buildStoryboard(script, preset) {
    const shotsPerBeat = preset.shotsPerBeat;
    const storyboard = [];
    for (const scene of script.scenes || []) {
      for (let i = 0; i < shotsPerBeat; i++) {
        storyboard.push({
          sceneRef:  scene.scene_number,
          shotIndex: i + 1,
          shotType:  this._shotTypeFor(scene, i),
          camera:    this._cameraMoveFor(scene, i),
          lighting:  this._lightingFor(scene),
          color:     this._colorFor(scene.tone),
          durationMs: Math.floor((scene.duration_sec * 1000) / shotsPerBeat),
          narration: i === 0 ? scene.voiceover : '',
          tone:      scene.tone,
          description: `${scene.description} (Shot ${i + 1}/${shotsPerBeat}: ${this._shotTypeFor(scene, i)} ${this._cameraMoveFor(scene, i)})`,
        });
      }
    }
    return storyboard;
  }

  _shotTypeFor(scene, idx) {
    // Spielberg often opens with a wide, then pushes in for an emotional close-up.
    if (idx === 0) return 'wide_shot';
    if (idx === 1) return 'medium_shot';
    if (idx === 2) return 'close_up';
    return 'extreme_close_up';
  }

  _cameraMoveFor(scene, idx) {
    if (idx === 0) return 'slow_push_in';
    if (idx === 1) return 'static';
    if (idx === 2) return 'subtle_dolly';
    return 'handheld_subtle';
  }

  _lightingFor(scene) {
    if (scene.time_of_day?.includes('golden'))   return 'golden_hour_backlight';
    if (scene.time_of_day?.includes('night'))    return 'low_key_chiaroscuro';
    if (scene.time_of_day?.includes('storm'))    return 'high_contrast_lightning';
    if (scene.time_of_day?.includes('dawn'))     return 'cool_dawn_with_amber_rim';
    return 'natural_soft';
  }

  _colorFor(tone) {
    const map = {
      calm_yearning:         'amber_warm',
      mysterious_awe:        'cool_blue_with_amber',
      tense_doubt:           'desaturated_with_orange_accent',
      wide_eyed_wonder:      'warm_amber_overload',
      rising_stakes:         'punchy_contrast',
      shocked_realization:   'cool_then_warm_shift',
      desolation:            'cold_steel_blue',
      triumphant_peril:      'high_contrast_warm',
      transcendent_wonder:   'golden_glow_with_lens_flare',
    };
    return map[tone] || 'natural';
  }

  // ─────────────────────────────────────────────────────────────────────
  // Shot list — flat list of every shot with its render-ready prompt.
  // ─────────────────────────────────────────────────────────────────────
  _buildShotList(storyboard) {
    return storyboard.map((s, i) => ({
      id: `shot_${String(i + 1).padStart(3, '0')}`,
      ...s,
    }));
  }

  _buildRenderPrompts(shotList, genre) {
    return shotList.map(s => ({
      shotId: s.id,
      prompt: this._composeRenderPrompt(s, genre),
      negativePrompt: 'cartoon, anime, blurry, low quality, deformed, watermark, text overlay',
      durationSec: Math.ceil(s.durationMs / 1000),
      resolution: this.config.video.defaultResolution,
      fps: this.config.video.defaultFps,
    }));
  }

  _composeRenderPrompt(shot, genre) {
    const parts = [
      shot.description,
      `Genre: ${genre}`,
      `Shot type: ${shot.shotType}`,
      `Camera: ${shot.camera}`,
      `Lighting: ${shot.lighting}`,
      `Color grade: ${shot.color}`,
      `Tone: ${shot.tone}`,
      'Cinematic, photorealistic, 35mm film grain, anamorphic lens, Spielberg style, John Williams era composition',
    ];
    return parts.join('. ');
  }

  _buildThumbnailPrompt(script, storyboard) {
    const wonderShot = storyboard.find(s => s.tone === 'transcendent_wonder') || storyboard[storyboard.length - 1];
    return [
      `Close-up of protagonist face`,
      `Wide-eyed wonder, looking up at the sky`,
      `Golden hour backlight with lens flare`,
      `Spielberg signature "wonder face" composition`,
      `Cinematic color grade: amber_warm with cool shadows`,
      `Title-safe negative space in upper third`,
    ].join('. ');
  }

  // ─────────────────────────────────────────────────────────────────────
  // Metadata generation
  // ─────────────────────────────────────────────────────────────────────
  async _generateTitle(script, language) {
    return script.title || (language === 'es' ? 'Sin título' : 'Untitled');
  }

  async _generateDescription(script, language) {
    const base = this.config.youtube.defaultDescription || '';
    if (language === 'es') {
      return `${base}\n\n${script.scenes?.[0]?.description || ''}\n\nUn cortometraje creado por Spilbergian, agente cinematográfico de IA basado en el framework AJN de Justo Tapiador García (UA).`;
    }
    return `${base}\n\n${script.scenes?.[0]?.description || ''}\n\nA short film created by Spilbergian, an AI cinematic agent based on the AJN framework by Justo Tapiador García (UA).`;
  }

  _generateTags(script, genre) {
    return [
      'Spilbergian', 'PREDATOR JUNGLE v3', 'AJN', 'AI Director',
      genre, 'AI short film', 'cinematic AI', 'Spielberg style',
      'AI generated video', 'autonomous agent',
    ];
  }

  _safeJsonParse(text) {
    if (!text) return null;
    try {
      // Strip markdown fences
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
      return JSON.parse(cleaned);
    } catch {
      // Try to find a JSON object inside
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { return JSON.parse(match[0]); } catch { return null; }
      }
      return null;
    }
  }
}
