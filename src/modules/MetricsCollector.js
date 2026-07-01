/**
 * src/modules/MetricsCollector.js — Observability for Spilbergian.
 * Counters, gauges, histograms, timers, and time-series.
 * Cinematic-specific counters (renders, audio_jobs, uploads) included.
 */
export class MetricsCollector {
  constructor(opts = {}) {
    this.counters = new Map();
    this.gauges   = new Map();
    this.histograms = new Map();
    this.timers = new Map();
    this.timeseries = new Map();
    this.enableConsole = opts.enableConsole !== false;
    this._interval = null;
    this._startTs = Date.now();
  }

  start() {
    if (this._interval) return;
    this._interval = setInterval(() => this._tick(), 5_000);
  }

  stop() { if (this._interval) clearInterval(this._interval); this._interval = null; }

  _tick() {
    // Sample gauges into time-series
    for (const [name, value] of this.gauges) {
      if (!this.timeseries.has(name)) this.timeseries.set(name, []);
      const series = this.timeseries.get(name);
      series.push({ t: Date.now(), v: value });
      if (series.length > 1440) series.shift(); // 2 hours at 5s sampling
    }
  }

  incrementCounter(name, by = 1) {
    this.counters.set(name, (this.counters.get(name) || 0) + by);
  }

  setGauge(name, value) { this.gauges.set(name, value); }

  observeHistogram(name, value) {
    if (!this.histograms.has(name)) this.histograms.set(name, []);
    const arr = this.histograms.get(name);
    arr.push(value);
    if (arr.length > 1000) arr.shift();
  }

  startTimer(name) {
    const id = `${name}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.timers.set(id, { name, start: Date.now() });
    return id;
  }

  stopTimer(id) {
    const t = this.timers.get(id);
    if (!t) return 0;
    const dur = Date.now() - t.start;
    this.observeHistogram(t.name + '_ms', dur);
    this.timers.delete(id);
    return dur;
  }

  getSummary() {
    const counters = Object.fromEntries(this.counters);
    const gauges   = Object.fromEntries(this.gauges);
    const histSummary = {};
    for (const [name, arr] of this.histograms) {
      if (!arr.length) continue;
      const sorted = [...arr].sort((a, b) => a - b);
      histSummary[name] = {
        count: arr.length,
        min:   sorted[0],
        max:   sorted[sorted.length - 1],
        mean:  arr.reduce((s, v) => s + v, 0) / arr.length,
        p50:   sorted[Math.floor(arr.length / 2)],
        p95:   sorted[Math.floor(arr.length * 0.95)],
      };
    }
    return {
      uptimeMs: Date.now() - this._startTs,
      counters,
      gauges,
      histograms: histSummary,
    };
  }
}

export default MetricsCollector;
