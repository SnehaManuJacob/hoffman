/**
 * splash.js — the opening screen, up while the factory model loads.
 *
 * The loader is the kiln itself, kept quiet: eight chambers in a ring, drawn
 * as the site's native mark (short vertical strokes, as views/ring.js draws
 * the real one), and the fire walks once round them as the opening shot's
 * model arrives. The line under the name keeps the kiln's own beat: two hours
 * a chamber, the one hard field fact (config C.time.tickHours). Heat is the
 * only colour, as everywhere on the site.
 *
 * Moving over the ring warms the chamber under the pointer, a little. Nothing
 * announces it; the fire itself only ever reports the real download.
 *
 * When the model is in and drawn, the splash fades onto the factory yard.
 *
 * A classic script, not a module, and loaded straight after its markup: the
 * modules wait on three.js, and this has to be moving on the first frame.
 * main.js talks to it through window.kilnSplash:
 *
 *   kilnSplash.progress(f)     how far the load is, 0..1 (only ever rises)
 *   kilnSplash.ready(promise)  the scene is drawn; the splash may lift
 *   kilnSplash.revealed        settles as the yard comes through
 */
(() => {
  const root = document.getElementById('splash');
  const html = document.documentElement;
  if (!root) {
    window.kilnSplash = { progress() {}, ready() {}, revealed: Promise.resolve() };
    return;
  }

  const canvas = root.querySelector('.splash-canvas');
  const ctx = canvas.getContext('2d');
  const stateEl = root.querySelector('.splash-state');

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // A full lap the first time in a session; a quick one when coming back
  // from another page, where the model is usually already cached.
  let seen = false;
  try {
    seen = sessionStorage.getItem('kiln-splash') === '1';
    sessionStorage.setItem('kiln-splash', '1');
  } catch { /* private mode: treat every visit as the first */ }
  const MIN_LAP = REDUCED ? 0 : seen ? 700 : 2000;   // ms, the shortest the fire may take round
  const MAX_WAIT = 20000;                            // never hold the visitor longer than this
  const FADE_MS = REDUCED ? 250 : 650;

  const CHAMBERS = 8;
  const HOURS_PER_CHAMBER = 2;

  html.classList.add('is-splashing');

  // ---- colour: read from site.css, so the splash is on the site's palette

  const css = getComputedStyle(html);
  const tok = (name, fallback) => (css.getPropertyValue(name).trim() || fallback);
  const hex = (h) => {
    const n = parseInt(h.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  // Cold sand into the heat ramp, coolest to hottest (site.css --heat-0..4).
  const STOPS = [
    [0.00, hex(tok('--sand-faint', '#574e3e'))],
    [0.20, hex(tok('--sand-dim', '#8a7f66'))],
    [0.35, hex(tok('--heat-0', '#ffe9a3'))],
    [0.55, hex(tok('--heat-1', '#ffd24a'))],
    [0.72, hex(tok('--heat-2', '#f9a826'))],
    [0.86, hex(tok('--heat-3', '#ef6c1a'))],
    [1.00, hex(tok('--heat-4', '#d8321a'))],
  ];
  const LUT = [];
  for (let i = 0; i <= 64; i++) {
    const h = i / 64;
    let k = 0;
    while (k < STOPS.length - 2 && h > STOPS[k + 1][0]) k++;
    const [h0, c0] = STOPS[k];
    const [h1, c1] = STOPS[k + 1];
    const t = Math.min(1, Math.max(0, (h - h0) / (h1 - h0)));
    LUT.push(`rgb(${c0.map((c, j) => Math.round(c + (c1[j] - c) * t)).join(',')})`);
  }
  const heatColour = (h) => LUT[Math.round(Math.min(1, Math.max(0, h)) * 64)];
  const LINE = tok('--hairline-firm', '#443a2c');

  // ---- the ring: a rounded rectangle, walked clockwise from top centre

  let W = 0; let H = 0; let dpr = 1;
  let rw = 0; let rh = 0; let maxLen = 0;
  let bars = [];        // { x, y, s }: s is the position in chambers, 0..8
  let ticks = [];       // partition marks between chambers
  let stoke = new Float32Array(0);

  function roundedRect(w, h, r) {
    const a = w - 2 * r; const b = h - 2 * r; const q = (Math.PI / 2) * r;
    const L = -w / 2; const R = w / 2; const T = -h / 2; const B = h / 2;
    const arc = (ox, oy, a0) => (t) => {
      const ang = a0 + t * (Math.PI / 2);
      return [ox + Math.cos(ang) * r, oy + Math.sin(ang) * r, Math.cos(ang), Math.sin(ang)];
    };
    const line = (x0, y0, x1, y1, nx, ny) => (t) => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, nx, ny];
    return [
      [a / 2, line(0, T, a / 2, T, 0, -1)],
      [q, arc(R - r, T + r, -Math.PI / 2)],
      [b, line(R, T + r, R, B - r, 1, 0)],
      [q, arc(R - r, B - r, 0)],
      [a, line(a / 2, B, -a / 2, B, 0, 1)],
      [q, arc(L + r, B - r, Math.PI / 2)],
      [b, line(L, B - r, L, T + r, -1, 0)],
      [q, arc(L + r, T + r, Math.PI)],
      [a / 2, line(-a / 2, T, 0, T, 0, -1)],
    ];
  }

  function walk(segs, total, u) {
    let d = (((u % 1) + 1) % 1) * total;
    for (let i = 0; i < segs.length; i++) {
      const [len, at] = segs[i];
      if (d <= len || i === segs.length - 1) return at(len > 0 ? Math.min(1, d / len) : 0);
      d -= len;
    }
    return segs[0][1](0);
  }

  function layout() {
    W = window.innerWidth;
    H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    rw = Math.max(200, Math.min(W * 0.4, 440, H * 0.8));
    rh = rw * 0.44;
    const r = rh * 0.44;
    const cx = W / 2;
    const cy = H * 0.46;
    maxLen = rh * 0.16;
    root.style.setProperty('--ring-cy', `${cy}px`);
    root.style.setProperty('--ring-h', `${rh}px`);

    const segs = roundedRect(rw, rh, r);
    const total = segs.reduce((t, [len]) => t + len, 0);
    const n = Math.round(total / 5);
    bars = [];
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const [x, y] = walk(segs, total, u);
      bars.push({ x: cx + x, y: cy + y, s: u * CHAMBERS });
    }
    stoke = new Float32Array(n);

    ticks = [];
    for (let k = 0; k < CHAMBERS; k++) {
      const [x, y, nx, ny] = walk(segs, total, k / CHAMBERS);
      ticks.push({ x: cx + x, y: cy + y, nx, ny });
    }
  }

  // ---- state

  const t0 = performance.now();
  let load = 0;          // 0..1, from main.js
  let loaded = false;    // the scene is drawn
  let fire = 0;          // the fire's position, in chambers
  let phase = 'firing';  // firing -> fade -> gone
  let phaseAt = 0;
  let shown = '';
  let skip = false;

  let resolveRevealed;
  const revealed = new Promise((r) => { resolveRevealed = r; });

  window.kilnSplash = {
    progress(f) { load = Math.max(load, Math.min(1, Number(f) || 0)); },
    ready(p) { Promise.resolve(p).then(() => { loaded = true; }, () => { loaded = true; }); },
    revealed,
  };
  setTimeout(() => { loaded = true; load = 1; }, MAX_WAIT);

  // ---- warming a chamber under the pointer

  root.addEventListener('pointermove', (ev) => {
    if (phase !== 'firing') return;
    let best = -1; let bd = 36;
    for (let i = 0; i < bars.length; i++) {
      const d = Math.hypot(ev.clientX - bars[i].x, ev.clientY - (bars[i].y - maxLen / 2));
      if (d < bd) { bd = d; best = i; }
    }
    if (best < 0) return;
    const n = bars.length;
    for (let j = -5; j <= 5; j++) {
      const k = (best + j + n) % n;
      stoke[k] = Math.min(0.6, stoke[k] + 0.18 * Math.exp(-(j * j) / 8));
    }
  });

  // ---- hold the page still behind it

  // Capture phase on window, so the smooth scroll (scroll.js) never sees the
  // wheel or the keys while the splash is up. Escape or Enter lifts it.
  const SCROLL_KEYS = new Set([' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End']);
  function hold(ev) {
    if (phase === 'gone') return;
    if (ev.type === 'keydown') {
      if (ev.key === 'Escape' || ev.key === 'Enter') { loaded = true; load = 1; skip = true; return; }
      if (!SCROLL_KEYS.has(ev.key)) return;
    }
    ev.preventDefault();
    ev.stopPropagation();
  }
  window.addEventListener('wheel', hold, { capture: true, passive: false });
  window.addEventListener('touchmove', hold, { capture: true, passive: false });
  window.addEventListener('keydown', hold, { capture: true });

  // ---- drawing

  function heatAt(s) {
    // Behind the fire: chambers already fired, cooling as it moves on.
    const behind = s <= fire ? Math.exp(-(fire - s) / 1.1) : 0;
    // Just ahead of it: warmed by the exhaust drawn through.
    const ahead = ((s - fire) % CHAMBERS + CHAMBERS) % CHAMBERS;
    return Math.max(behind, 0.8 * Math.exp(-ahead / 0.35));
  }

  function draw(dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // The floor line the chambers stand on, and the partitions between them.
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    bars.forEach((b, i) => (i ? ctx.lineTo(b.x, b.y) : ctx.moveTo(b.x, b.y)));
    ctx.closePath();
    for (const tk of ticks) {
      ctx.moveTo(tk.x - tk.nx * 4, tk.y - tk.ny * 4);
      ctx.lineTo(tk.x + tk.nx * 4, tk.y + tk.ny * 4);
    }
    ctx.stroke();

    // One stroke per sample, as long and as hot as its heat.
    const ignite = REDUCED ? 1 : Math.min(1, (performance.now() - t0) / 500);
    const decay = Math.exp(-dt / 500);
    ctx.lineWidth = 1.25;
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      const h = heatAt(b.s) * ignite + stoke[i];
      stoke[i] *= decay;
      ctx.strokeStyle = heatColour(h);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x, b.y - (2 + Math.min(1, h) * maxLen));
      ctx.stroke();
    }
  }

  function readout() {
    const at = Math.min(CHAMBERS, Math.floor(fire + 1e-3));
    const text = at >= CHAMBERS
      ? `Fired · ${CHAMBERS * HOURS_PER_CHAMBER} h`
      : `Chamber ${at + 1} of ${CHAMBERS} · ${String(at * HOURS_PER_CHAMBER).padStart(2, '0')} h`;
    if (text !== shown && stateEl) { shown = text; stateEl.textContent = text; }
  }

  // ---- the loop

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(64, now - last);
    last = now;

    if (phase === 'firing') {
      // The fire follows the load, but never laps faster than MIN_LAP, and
      // the last stretch waits for the scene to be drawn, not just fetched.
      const byLoad = (loaded ? 1 : Math.min(0.92, load)) * CHAMBERS;
      const byTime = MIN_LAP ? Math.min(1, (now - t0) / MIN_LAP) * CHAMBERS : CHAMBERS;
      const target = skip ? CHAMBERS : Math.min(byLoad, byTime);
      if (REDUCED || skip) fire = target;
      else {
        // Eased, with a floor on the pace: a pure exponential creeps the
        // last hundredth of a chamber for over a second.
        const gap = target - fire;
        fire += Math.min(gap, Math.max(gap * (1 - Math.exp(-dt / 180)), dt * 0.0016));
      }
      if (loaded && fire >= CHAMBERS - 1e-3) {
        fire = CHAMBERS;
        phase = 'fade';
        phaseAt = now;
        html.classList.remove('is-splashing');
      }
    }

    if (phase === 'fade') {
      // A short beat on the finished ring, then onto the yard.
      const k = Math.min(1, Math.max(0, (now - phaseAt - (REDUCED ? 0 : 250)) / FADE_MS));
      root.style.opacity = String(1 - k * k * (3 - 2 * k));
      if (k >= 0.3) resolveRevealed();
      if (k >= 1) { finish(); return; }
    }

    draw(dt);
    readout();
    requestAnimationFrame(frame);
  }

  function finish() {
    phase = 'gone';
    resolveRevealed();
    html.classList.remove('is-splashing');
    window.removeEventListener('wheel', hold, { capture: true });
    window.removeEventListener('touchmove', hold, { capture: true });
    window.removeEventListener('keydown', hold, { capture: true });
    window.removeEventListener('resize', layout);
    root.remove();
  }

  layout();
  window.addEventListener('resize', layout);
  requestAnimationFrame(frame);
})();
