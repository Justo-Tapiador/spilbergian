/**
 * plugins/example-plugin.js — Example plugins demonstrating the new
 * `beforeRender` and `movieComplete` hooks added in v3.0.
 *
 * Usage:
 *   director.use(renderBudgetAlertPlugin);
 *   director.use(movieAuditPlugin);
 */

export const renderBudgetAlertPlugin = {
  name: 'render-budget-alert',
  version: '1.0.0',
  priority: 50,
  hooks: {
    beforeRender: async (payload) => {
      const { prompt, shotId } = payload;
      // Estimate cost before render; cancel if over a per-shot threshold.
      const estCost = (prompt.durationSec || 8) * 0.40;
      if (estCost > 5.0) {
        console.warn(`[render-budget-alert] Skipping ${shotId}: estimated cost $${estCost.toFixed(2)} > $5.00`);
        return { ...payload, _cancel: true };
      }
      return payload;
    },
  },
};

export const movieAuditPlugin = {
  name: 'movie-audit',
  version: '1.0.0',
  priority: 100,
  hooks: {
    movieComplete: async (payload) => {
      const { project, result } = payload || {};
      console.log(`[movie-audit] Project "${project?.name}" complete.`);
      console.log(`[movie-audit]   Style adherence: ${((result?.styleAdherence?.score || 0) * 100).toFixed(1)}%`);
      console.log(`[movie-audit]   Final video:     ${result?.finalVideo}`);
      console.log(`[movie-audit]   Rendered clips:  ${result?.videoClips?.length}`);
      return payload;
    },
  },
};

export default [renderBudgetAlertPlugin, movieAuditPlugin];
