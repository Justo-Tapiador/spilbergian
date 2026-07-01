/**
 * src/training/StyleRewardModel.js — Score how "Spielberg" a plan is.
 *
 * Used by the SpilbergianTrainer's Phase VI (style reward) to reinforce
 * plans that match the Spielberg persona canon.
 *
 * Factors:
 *   - persona.styleAdherence() score          (60% weight)
 *   - Tone diversity (how many distinct tones) (15% weight)
 *   - Pacing consistency with persona          (10% weight)
 *   - Title contains a wonder/adventure keyword (15% weight)
 */
export class StyleRewardModel {
  constructor(persona) {
    this.persona = persona;
    this.wonderKeywords = [
      'wonder', 'awe', 'hope', 'home', 'journey', 'last', 'first',
      'maravilla', 'asombro', 'esperanza', 'hogar', 'viaje',
      'misterio', 'descubrimiento', 'crónica', 'chronicle',
    ];
  }

  score(plan, expectedTones = []) {
    const adherence = this.persona.styleAdherence(plan);

    // Tone diversity
    const tones = new Set((plan.shotList || []).map(s => s.tone).filter(Boolean));
    const toneDiversity = Math.min(1, tones.size / 6);

    // Pacing — average cuts/min should be near persona default
    const targetCpm = this.persona.pacing.defaultCutsPerMinute || 8;
    const planCpm   = plan.avgCutsPerMinute || (plan.shotList?.length || 0) / Math.max(1, (plan.durationSec || 60) / 60);
    const pacingScore = 1 - Math.min(1, Math.abs(planCpm - targetCpm) / targetCpm);

    // Title keyword check
    const titleLc = (plan.title || '').toLowerCase();
    const hasWonderKw = this.wonderKeywords.some(k => titleLc.includes(k));

    // Expected tones coverage
    let expectedCoverage = 1;
    if (expectedTones.length) {
      const matched = expectedTones.filter(t => [...tones].some(s => s.includes(t)));
      expectedCoverage = matched.length / expectedTones.length;
    }

    const finalScore =
      0.60 * adherence.score +
      0.15 * toneDiversity +
      0.10 * pacingScore +
      0.15 * (hasWonderKw ? 1 : 0.3);

    return {
      score: Math.max(0, Math.min(1, finalScore)),
      factors: {
        adherence: adherence.score,
        toneDiversity,
        pacing: pacingScore,
        titleKeyword: hasWonderKw,
        expectedCoverage,
      },
      reasons: adherence.reasons,
    };
  }
}

export default StyleRewardModel;
