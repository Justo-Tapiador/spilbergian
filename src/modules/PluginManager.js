/**
 * src/modules/PluginManager.js — Hook-based plugin system for Spilbergian.
 * Identical hook surface to v2.0, with two new hooks:
 *   - `beforeRender`  (cancellable) — before each video render job
 *   - `movieComplete` (no payload change) — when a full movie pipeline finishes
 */
export class PluginManager {
  constructor() {
    this.plugins = [];
    this.hooks = new Map();
  }

  use(plugin) {
    if (!plugin?.name) throw new Error('Plugin must have a name');
    this.plugins.push(plugin);
    for (const [hook, fn] of Object.entries(plugin.hooks || {})) {
      if (!this.hooks.has(hook)) this.hooks.set(hook, []);
      this.hooks.get(hook).push({ plugin: plugin.name, fn, priority: plugin.priority ?? 100 });
    }
    // Sort by priority (lower runs first)
    for (const arr of this.hooks.values()) arr.sort((a, b) => a.priority - b.priority);
  }

  remove(name) {
    this.plugins = this.plugins.filter(p => p.name !== name);
    for (const arr of this.hooks.values()) {
      for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i].plugin === name) arr.splice(i, 1);
      }
    }
  }

  list() { return [...this.plugins]; }

  async runHook(name, payload = {}) {
    const handlers = this.hooks.get(name) || [];
    let result = payload;
    for (const h of handlers) {
      try {
        const out = await h.fn(result);
        if (out !== undefined) result = out;
        if (result?._cancel) break;
      } catch (err) {
        console.warn(`[PluginManager] hook ${name} from ${h.plugin} failed:`, err.message);
      }
    }
    return result;
  }
}

export default PluginManager;
