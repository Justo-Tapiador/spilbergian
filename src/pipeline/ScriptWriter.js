/**
 * src/pipeline/ScriptWriter.js — Thin wrapper around CinematicBrain for
 * script-only generation. Useful when you want the script without running
 * the full pipeline (e.g. for human review before rendering).
 */
export class ScriptWriter {
  constructor(brain) { this.brain = brain; }

  async write(brief, opts = {}) {
    const plan = await this.brain.plan(brief, opts);
    return {
      title:   plan.title,
      scenes:  plan.script.scenes,
      arc:     plan.arc,
      format:  plan.format,
      genre:   plan.genre,
      language: plan.language,
    };
  }
}
export default ScriptWriter;
