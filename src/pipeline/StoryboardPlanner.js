/**
 * src/pipeline/StoryboardPlanner.js — Storyboard-only generation.
 * Returns shots grouped by scene, with optional sketch prompts.
 */
export class StoryboardPlanner {
  constructor(brain) { this.brain = brain; }

  async build(brief, opts = {}) {
    const plan = await this.brain.plan(brief, opts);
    return {
      title:       plan.title,
      storyboard:  plan.storyboard,
      shotList:    plan.shotList,
      renderPrompts: plan.renderPrompts,
    };
  }

  /** Group the shot list by scene for human-readable output. */
  groupByScene(shotList) {
    const map = new Map();
    for (const shot of shotList) {
      if (!map.has(shot.sceneRef)) map.set(shot.sceneRef, []);
      map.get(shot.sceneRef).push(shot);
    }
    return [...map.entries()].map(([sceneRef, shots]) => ({ sceneRef, shots }));
  }
}
export default StoryboardPlanner;
