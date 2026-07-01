/**
 * src/voice/VoiceCommandRouter.js — Map natural-language transcripts to
 * Spilbergian commands.
 *
 * Recognises intents like:
 *   - "crea un video sobre X"      → createMovie(X)
 *   - "haz un cortometraje de X"   → createMovie(X, { format: 'short' })
 *   - "sube el último video a YouTube"  → upload last movie to YouTube
 *   - "edita con CapCut el proyecto X"  → open CapCut draft for editing
 *   - "entrena el modelo"          → train()
 *   - "para" / "stop"              → emit voice:stop
 *   - "estado" / "status"          → return director.status()
 */
const INTENT_PATTERNS = [
  // Movie creation (Spanish + English)
  { intent: 'create_movie', regex: /^(?:crea|haz|genera|make|create)\s+(?:un\s+)?(?:cortometraje|video|pel[ií]cula|movie|short)\s+(?:sobre|de|about|on)?\s*(.+)$/i,
    map: m => ({ brief: m[1].trim() }) },
  { intent: 'create_movie_short', regex: /^(?:crea|haz|genera)\s+(?:un\s+)?(?:corto|short)\s+(?:sobre|de)?\s*(.+)$/i,
    map: m => ({ brief: m[1].trim(), format: 'short' }) },
  { intent: 'create_movie_vertical', regex: /^(?:crea|haz)\s+(?:un\s+)?(?:reel|vertical|short vertical)\s+(?:sobre|de)?\s*(.+)$/i,
    map: m => ({ brief: m[1].trim(), format: 'vertical' }) },

  // YouTube upload
  { intent: 'upload_youtube', regex: /^(?:sube|upload|publica)\s+(?:el\s+)?(?:[uú]ltimo\s+)?(?:video|pel[ií]cula|movie)\s+(?:a\s+)?(?:youtube|yt)$/i,
    map: () => ({}) },
  { intent: 'upload_youtube_named', regex: /^(?:sube|upload|publica)\s+(.+\.mp4)\s+(?:a\s+)?(?:youtube|yt)$/i,
    map: m => ({ file: m[1].trim() }) },

  // CapCut editing
  { intent: 'capcut_open', regex: /^(?:edita|abre|open)\s+(?:con\s+)?(?:capcut|el proyecto)\s+(.+)$/i,
    map: m => ({ projectName: m[1].trim() }) },

  // Training
  { intent: 'train', regex: /^(?:entrena|train|fine[- ]?tunea?)\s+(?:el\s+)?(?:modelo|model|agente|agent)?$/i,
    map: () => ({}) },
  { intent: 'train_phase', regex: /^(?:entrena|train)\s+(?:la\s+)?(?:fase\s+)?(\w+)$/i,
    map: m => ({ phase: m[1].trim() }) },

  // Status
  { intent: 'status', regex: /^(?:estado|status|c[oó]mo est[aá]s|qu[eé] haces)$/i, map: () => ({}) },

  // Stop
  { intent: 'stop', regex: /^(?:para|stop|silencio|quieto|_STOP_)$/i, map: () => ({}) },
];

export class VoiceCommandRouter {
  constructor(director) {
    this.director = director;
  }

  /** Parse a transcript into an intent object, or null if no match. */
  parse(transcript) {
    const text = transcript.trim();
    for (const p of INTENT_PATTERNS) {
      const m = text.match(p.regex);
      if (m) return { intent: p.intent, ...p.map(m), raw: text };
    }
    return null;
  }

  /** Same as parse, but accepts text directly (text mode equivalent). */
  parseText(text) {
    return this.parse(text);
  }

  /** Execute a parsed command. */
  async execute(command, opts = {}) {
    if (!command) return null;
    switch (command.intent) {
      case 'create_movie':
      case 'create_movie_short':
      case 'create_movie_vertical':
        return this.director.createMovie(command.brief, {
          format: command.format,
          ...opts,
        });

      case 'upload_youtube': {
        const last = this.director.currentProject?.result;
        if (!last) throw new Error('No hay proyecto actual para subir.');
        return this.director.youtube.upload(last.finalVideo, {
          title:       last.title,
          description: last.description,
          tags:        last.tags,
          thumbnail:   last.thumbnailPath,
        });
      }

      case 'upload_youtube_named':
        return this.director.youtube.upload(command.file, opts);

      case 'capcut_open':
        // Open the most recent draft for the given project name.
        // (Implementation left to CapCutController.openInCapCutDesktop.)
        return this.director.capcut.openInCapCutDesktop(
          `${this.director.config.editor.capcut.draftDir}/${command.projectName}_*/draft_content.json`,
        );

      case 'train':
        return this.director.train(opts);

      case 'train_phase':
        return this.director.train({ phase: command.phase, ...opts });

      case 'status':
        return this.director.status();

      case 'stop':
        await this.director.stopVoiceMode();
        return { stopped: true };

      default:
        return null;
    }
  }
}

export default VoiceCommandRouter;
