/**
 * src/persona/SpielbergPersona.js — Directorial persona for Spilbergian.
 *
 * Encodes Steven Spielberg's signature directorial vocabulary so that
 * every creative decision (shot, cut, color, score, story beat) can be
 * checked against this canon.
 *
 * The persona is data-driven: the JSON in config/default.json controls
 * the lists and palettes, so users can swap to other directors
 * (e.g. Nolan, Kubrick, Villeneuve) by editing the config.
 */
export class SpielbergPersona {
  constructor(personaConfig) {
    this.name                  = personaConfig.name || 'Spilbergian';
    this.inspiration           = personaConfig.inspiration || 'Steven Spielberg';
    this.signatureTechniques   = personaConfig.signatureTechniques || [];
    this.preferredGenres       = personaConfig.preferredGenres || [];
    this.narrativeBeats        = personaConfig.narrativeBeats || [];
    this.toneKeywords          = personaConfig.toneKeywords || [];
    this.colorPalette          = personaConfig.colorPalette || {};
    this.pacing                = personaConfig.pacing || {};
  }

  /** Return true if a shot description contains a signature technique. */
  isSignatureShot(shotDescription = '') {
    const text = shotDescription.toLowerCase();
    return this.signatureTechniques.some(t => text.includes(t.toLowerCase().replace(/_/g, ' ')));
  }

  /** Return the Spielberg-recommended cut rate (cuts/minute) for a tone. */
  cutRateFor(tone = '') {
    const t = tone.toLowerCase();
    if (t.includes('triumphant') || t.includes('rising') || t.includes('peril')) {
      return this.pacing.actionCutsPerMinute || 18;
    }
    if (t.includes('wonder') || t.includes('desolation') || t.includes('transcendent')) {
      return this.pacing.emotionalCutsPerMinute || 4;
    }
    return this.pacing.defaultCutsPerMinute || 8;
  }

  /** Validate that a beat sequence is consistent with Spielberg's arc. */
  validateArc(arcBeats) {
    const canonical = this.narrativeBeats;
    if (!arcBeats || arcBeats.length === 0) return false;
    // Must start with ordinary_world and end with resolution_and_wonder.
    if (arcBeats[0] !== canonical[0]) return false;
    if (arcBeats[arcBeats.length - 1] !== canonical[canonical.length - 1]) return false;
    return true;
  }

  /** Compute a 0..1 "Spielberg-ness" score for a plan. */
  styleAdherence(plan = {}) {
    let score = 0.5; // baseline
    const reasons = [];

    // 1. Arc consistency
    const beats = (plan.arc || []).map(b => b.beat || b);
    if (this.validateArc(beats)) {
      score += 0.15;
      reasons.push('arc_consistent');
    }

    // 2. Signature shots present
    const allShotDescs = (plan.shotList || []).map(s => s.description || '').join(' ');
    const signatureHits = this.signatureTechniques.filter(t =>
      allShotDescs.toLowerCase().includes(t.toLowerCase().replace(/_/g, ' '))
    );
    score += Math.min(0.2, signatureHits.length * 0.05);
    if (signatureHits.length) reasons.push(`signature_shots:${signatureHits.length}`);

    // 3. Tone vocabulary alignment
    const tonesUsed = (plan.shotList || []).map(s => s.tone || '');
    const toneHits = this.toneKeywords.filter(k =>
      tonesUsed.join(' ').toLowerCase().includes(k.toLowerCase())
    );
    score += Math.min(0.1, toneHits.length * 0.02);
    if (toneHits.length) reasons.push(`tones:${toneHits.length}`);

    // 4. Pacing within recommended range
    if (plan.avgCutsPerMinute) {
      const target = this.pacing.defaultCutsPerMinute || 8;
      const diff = Math.abs(plan.avgCutsPerMinute - target) / target;
      if (diff < 0.25) {
        score += 0.05;
        reasons.push('pacing_on_target');
      }
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      reasons,
    };
  }

  /** Return the recommended color palette for a tone. */
  paletteFor(tone = '') {
    const t = tone.toLowerCase();
    if (t.includes('wonder') || t.includes('hope')) {
      return { primary: this.colorPalette.warm, accent: this.colorPalette.accent };
    }
    if (t.includes('peril') || t.includes('desolation')) {
      return { primary: this.colorPalette.shadow, accent: this.colorPalette.primary };
    }
    return { primary: this.colorPalette.primary, accent: this.colorPalette.secondary };
  }

  /** Human-readable persona summary for logs / UI. */
  describe() {
    return [
      `${this.name} — inspired by ${this.inspiration}`,
      `Genres: ${this.preferredGenres.join(', ')}`,
      `Signature techniques: ${this.signatureTechniques.slice(0, 5).join(', ')}...`,
      `Tone vocabulary: ${this.toneKeywords.join(', ')}`,
    ].join('\n');
  }
}

export default SpielbergPersona;
