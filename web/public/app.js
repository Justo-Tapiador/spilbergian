/* =========================================================================
   Spilbergian — Web dashboard logic
   Talks to the local web/server.js endpoints. No build step needed.
   ========================================================================= */
(function () {
  'use strict';

  // ───────────────── Helpers ─────────────────
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  async function fetchJSON(url, opts = {}) {
    const r = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    const text = await r.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    if (!r.ok) {
      const err = new Error(data?.error || data?.message || `HTTP ${r.status}`);
      err.data = data; err.status = r.status;
      throw err;
    }
    return data;
  }

  function toast(msg, kind = 'info', ms = 4000) {
    const el = $('#toast');
    el.textContent = msg;
    el.className = `toast ${kind} show`;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.classList.remove('show'); }, ms);
  }

  function fmt(obj) {
    if (obj == null) return '';
    if (typeof obj === 'string') return obj;
    return JSON.stringify(obj, null, 2);
  }

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function timeAgo(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return 'hace un instante';
    if (s < 3600) return `hace ${Math.floor(s/60)} min`;
    if (s < 86400) return `hace ${Math.floor(s/3600)} h`;
    return d.toLocaleDateString();
  }

  function setBtnLoading(btn, label) {
    btn._orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${label || 'Procesando…'}`;
  }
  function setBtnDone(btn) {
    btn.disabled = false;
    if (btn._orig) btn.innerHTML = btn._orig;
  }

  // ───────────────── Tab navigation ─────────────────
  $$('.navlink').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = link.dataset.tab;
      $$('.navlink').forEach(l => l.classList.toggle('active', l === link));
      $$('.tab').forEach(t => t.classList.toggle('active', t.id === `tab-${tab}`));
      // Lazy-load on first visit
      if (tab === 'projects') loadProjects();
      if (tab === 'config')   loadConfig();
    });
  });

  // ───────────────── Dashboard: health + status + persona + metrics ─────────────────
  async function loadHealth() {
    try {
      const h = await fetchJSON('/health');
      $('#health-dot').style.background = 'var(--success)';
      $('#health-label').textContent = `ok · ${h.memory_mb}MB`;
      $('#status-pill').classList.add('ok');
      $('#status-pill').classList.remove('error');

      const kv = $('#health-card');
      kv.innerHTML = `
        <dt>Estado</dt><dd class="ok">ok</dd>
        <dt>Uptime</dt><dd>${h.uptime_sec}s</dd>
        <dt>Memoria RSS</dt><dd>${h.memory_mb} MB</dd>
        <dt>Timestamp</dt><dd>${new Date(h.ts).toLocaleTimeString()}</dd>
      `;
    } catch (err) {
      $('#health-dot').style.background = 'var(--danger)';
      $('#health-label').textContent = 'sin conexión';
      $('#status-pill').classList.add('error');
      $('#status-pill').classList.remove('ok');
    }
  }

  async function loadStatus() {
    try {
      const s = await fetchJSON('/status');
      const kv = $('#director-status');
      kv.innerHTML = `
        <dt>Persona</dt><dd>${esc(s.persona)}</dd>
        <dt>Versión</dt><dd>${esc(s.version)}</dd>
        <dt>Especialidad</dt><dd>${esc(s.specialty)}</dd>
        <dt>Inicializado</dt><dd class="${s.initialized ? 'ok' : 'bad'}">${s.initialized ? 'sí' : 'no'}</dd>
        <dt>Voz activa</dt><dd>${s.voiceActive ? 'sí' : 'no'}</dd>
        <dt>Proyecto actual</dt><dd>${esc(s.currentProject) || '—'}</dd>
        <dt>Plugins</dt><dd>${(s.plugins || []).join(', ') || '—'}</dd>
      `;
    } catch (err) {
      $('#director-status').innerHTML = `<dt>Error</dt><dd class="bad">${esc(err.message)}</dd>`;
    }
  }

  async function loadPersona() {
    try {
      const p = await fetchJSON('/api/persona');
      const card = $('#persona-card');
      const beats = (p.narrativeBeats || []).map(b => `<span class="chip">${esc(b.replace(/_/g,' '))}</span>`).join('');
      const tones = (p.toneKeywords || []).map(t => `<span class="chip warm">${esc(t)}</span>`).join('');
      const genres = (p.preferredGenres || []).map(g => `<span class="chip cool">${esc(g)}</span>`).join('');
      card.innerHTML = `
        <div class="persona-name">${esc(p.name)}</div>
        <div class="persona-insp">Inspirado en ${esc(p.inspiration)}</div>
        <div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;">Géneros preferidos</div>
        <div class="chip-list">${genres}</div>
        <div style="font-size:12px;color:var(--text-dim);margin:12px 0 6px;">Beats narrativos</div>
        <div class="chip-list">${beats}</div>
        <div style="font-size:12px;color:var(--text-dim);margin:12px 0 6px;">Tono</div>
        <div class="chip-list">${tones}</div>
      `;
    } catch (err) {
      $('#persona-card').innerHTML = `<p class="muted" style="color:var(--danger)">${esc(err.message)}</p>`;
    }
  }

  async function loadMetrics() {
    try {
      const m = await fetchJSON('/api/metrics');
      const kv = $('#metrics-card');
      const counters = Object.entries(m.counters || {});
      const gauges = Object.entries(m.gauges || {});
      kv.innerHTML = `
        <dt>Uptime</dt><dd>${Math.round((m.uptimeMs || 0) / 1000)}s</dd>
        <dt>Contadores</dt><dd>${counters.length ? counters.map(([k,v]) => `${esc(k)}=${v}`).join(', ') : '—'}</dd>
        <dt>Gauges</dt><dd>${gauges.length ? gauges.map(([k,v]) => `${esc(k)}=${v}`).join(', ') : '—'}</dd>
      `;
    } catch (err) {
      $('#metrics-card').innerHTML = `<dt>Error</dt><dd class="bad">${esc(err.message)}</dd>`;
    }
  }

  // ───────────────── Plan tab ─────────────────
  $('#plan-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#plan-btn');
    const brief = $('#plan-brief').value.trim();
    if (!brief) return toast('Escribe un brief', 'error');

    setBtnLoading(btn, 'Generando plan…');
    try {
      const body = {
        brief,
        format: $('#plan-format').value,
        genre: $('#plan-genre').value || undefined,
        language: $('#plan-language').value,
      };
      const plan = await fetchJSON('/api/plan', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      renderPlan(plan);
      toast('Plan generado', 'ok');
    } catch (err) {
      toast('Error: ' + err.message, 'error', 6000);
    } finally {
      setBtnDone(btn);
    }
  });

  function renderPlan(plan) {
    const el = $('#plan-result');
    el.hidden = false;

    const scenes = (plan.script?.scenes || []).map(sc => `
      <div class="scene">
        <span class="scene-num">Escena ${sc.scene_number}</span>
        <strong>${esc(sc.location)}</strong> · ${esc(sc.time_of_day)} · ${esc(sc.tone)} · ${sc.duration_sec}s
        <div style="margin-top:4px;color:var(--text-dim);font-size:12px;">${esc(sc.description)}</div>
        ${sc.voiceover ? `<span class="scene-vo">🎙️ "${esc(sc.voiceover)}"</span>` : ''}
      </div>
    `).join('');

    const shots = (plan.shotList || []).map(s => `
      <div class="shot">
        <span class="shot-id">${esc(s.id)}</span>
        <span class="shot-meta">${esc(s.shotType)} · ${esc(s.camera)}</span>
        <span class="shot-meta">💡 ${esc(s.lighting)}</span>
        <span class="shot-meta">🎨 ${esc(s.color)}</span>
        <span class="shot-meta">⏱ ${Math.round(s.durationMs/1000)}s</span>
      </div>
    `).join('');

    const prompts = (plan.renderPrompts || []).slice(0, 4).map(p => `
      <div class="prompt-block">
        <span class="pid">${esc(p.shotId)}</span> · ${p.durationSec}s · ${esc(p.resolution)}@${p.fps}fps<br>
        ${esc(p.prompt)}
      </div>
    `).join('');
    const morePrompts = (plan.renderPrompts || []).length > 4
      ? `<div class="muted" style="margin-top:6px;font-size:11px;">… y ${(plan.renderPrompts || []).length - 4} prompts más</div>`
      : '';

    const arc = (plan.arc || []).map(b => `${esc(b.beat.replace(/_/g,' '))} <span style="color:var(--text-mute)">(${esc(b.tone.replace(/_/g,' '))})</span>`).join(' → ');

    el.innerHTML = `
      <h3>Plan generado</h3>
      <div class="plan-title">${esc(plan.title)}</div>
      <div class="meta-row">
        <span>🎬 <strong>${esc(plan.format)}</strong></span>
        <span>🎭 <strong>${esc(plan.genre)}</strong></span>
        <span>🌐 <strong>${esc(plan.language)}</strong></span>
        <span>⏱ <strong>${plan.durationSec}s</strong></span>
        <span>🆔 <strong>${esc(plan.id?.slice(0,8))}</strong></span>
      </div>

      <div class="section-h">Arco narrativo</div>
      <div style="font-size:13px;line-height:1.7;">${arc}</div>

      <div class="section-h">Guion (${(plan.script?.scenes || []).length} escenas)</div>
      ${scenes || '<p class="muted">Sin escenas</p>'}

      <div class="section-h">Storyboard (${(plan.shotList || []).length} planos)</div>
      <div class="shot-grid">${shots}</div>

      <div class="section-h">Prompts de render (primeros 4)</div>
      ${prompts}${morePrompts}

      <div class="section-h">Prompt del thumbnail</div>
      <div class="prompt-block">${esc(plan.thumbnailPrompt)}</div>

      <div class="section-h">Tags</div>
      <div class="chip-list">${(plan.tags || []).map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>

      <div class="section-h" style="margin-top:18px;">JSON completo</div>
      <pre class="json">${esc(fmt(plan))}</pre>
    `;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ───────────────── Create movie tab ─────────────────
  $('#movie-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#movie-btn');
    const brief = $('#movie-brief').value.trim();
    if (!brief) return toast('Escribe un brief', 'error');

    if (!confirm('Esto ejecuta el pipeline completo y puede tardar varios minutos. ¿Continuar?')) return;

    setBtnLoading(btn, '🎬 Dirigiendo…');
    try {
      const body = {
        brief,
        format: $('#movie-format').value,
        genre: $('#movie-genre').value || undefined,
        projectName: $('#movie-name').value.trim() || undefined,
        uploadToYouTube: $('#movie-upload').checked,
      };
      const result = await fetchJSON('/api/movies', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      renderMovieResult(result);
      toast('¡Película completada!', 'ok', 5000);
    } catch (err) {
      toast('Error: ' + err.message, 'error', 6000);
    } finally {
      setBtnDone(btn);
    }
  });

  function renderMovieResult(r) {
    const el = $('#movie-result');
    el.hidden = false;
    const finalVideo = typeof r.finalVideo === 'string' ? r.finalVideo : (r.finalVideo?.finalVideo || JSON.stringify(r.finalVideo));
    el.innerHTML = `
      <h3>Resultado</h3>
      <div class="plan-title">${esc(r.title)}</div>
      <div class="meta-row">
        <span>⏱ <strong>${r.durationSec}s</strong></span>
        <span>🎯 Adherencia: <strong>${Math.round((r.styleAdherence?.score || 0) * 100)}%</strong></span>
        <span>🎬 Planos: <strong>${(r.videoClips || []).length}</strong></span>
      </div>
      <div class="section-h">Archivos</div>
      <dl class="kv">
        <dt>Video final</dt><dd>${esc(finalVideo)}</dd>
        <dt>Thumbnail</dt><dd>${esc(r.thumbnailPath)}</dd>
        ${r.youTube ? `<dt>YouTube</dt><dd><a href="${esc(r.youTube.url)}" target="_blank" style="color:var(--accent)">${esc(r.youTube.url)}</a></dd>` : ''}
      </dl>
      <div class="section-h">JSON completo</div>
      <pre class="json">${esc(fmt(r))}</pre>
    `;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ───────────────── Projects tab ─────────────────
  async function loadProjects() {
    const list = $('#projects-list');
    list.innerHTML = '<p class="muted">Cargando…</p>';
    try {
      const data = await fetchJSON('/api/projects');
      if (!data.projects?.length) {
        list.innerHTML = '<p class="muted">No hay proyectos todavía. Crea uno desde la pestaña "Crear película".</p>';
        return;
      }
      list.innerHTML = data.projects.map(p => `
        <div class="project-item">
          <span class="pi-icon">🎞️</span>
          <div class="pi-main">
            <div class="pi-title">${esc(p.title || '(sin título)')}</div>
            <div class="pi-id">${esc(p.id)}</div>
          </div>
          <span class="pi-date">${timeAgo(p.createdAt)}</span>
          ${p.hasManifest ? `<a class="pi-link" href="/api/projects/${encodeURIComponent(p.id)}" target="_blank">ver manifest</a>` : ''}
        </div>
      `).join('');
    } catch (err) {
      list.innerHTML = `<p class="muted" style="color:var(--danger)">${esc(err.message)}</p>`;
    }
  }
  $('#refresh-projects').addEventListener('click', loadProjects);

  // ───────────────── Training tab ─────────────────
  $('#train-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#train-btn');
    const epochs = parseInt($('#train-epochs').value, 10) || 1;
    const phase = $('#train-phase').value;
    setBtnLoading(btn, 'Entrenando…');
    try {
      const data = await fetchJSON('/api/train', {
        method: 'POST',
        body: JSON.stringify({ epochs, phase }),
      });
      const el = $('#train-result');
      el.hidden = false;
      const phases = data.history.map(h => {
        const v = h.loss !== undefined ? `loss=${h.loss.toFixed(4)}` : `reward=${(h.reward || 0).toFixed(4)}`;
        return `<li><strong>${esc(h.phase)}</strong> · epoch ${h.epoch} · ${v} ${h.samples ? `· ${h.samples} muestras` : ''}</li>`;
      }).join('');
      el.innerHTML = `
        <h3>Entrenamiento completado</h3>
        <p class="muted">${data.epochs_run} epochs ejecutados en total.</p>
        <ol>${phases}</ol>
      `;
      toast(`Entrenamiento completado (${data.epochs_run} epochs)`, 'ok');
    } catch (err) {
      toast('Error: ' + err.message, 'error', 6000);
    } finally {
      setBtnDone(btn);
    }
  });

  // ───────────────── Config tab ─────────────────
  async function loadConfig() {
    try {
      const cfg = await fetchJSON('/api/config');
      $('#config-output').textContent = fmt(cfg);
    } catch (err) {
      $('#config-output').textContent = 'Error: ' + err.message;
    }
  }

  // ───────────────── Init ─────────────────
  async function init() {
    await loadHealth();
    await Promise.allSettled([loadStatus(), loadPersona(), loadMetrics()]);
    // Refresh health/metrics every 15s
    setInterval(() => { loadHealth(); loadMetrics(); }, 15000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
