/**
 * kiln-page.js — "The kiln": the original system, in depth.
 *
 * The story (index.html, main.js) tells the kiln one idea at a time. This
 * page holds what the story leaves out, and builds it from the same sources:
 *
 *   - facts, parts and open questions come from config.js, so a value has
 *     one home and its evidence tag travels with it;
 *   - the heat in "The air's route" and "Two readings" is read from one
 *     recorded loop of the real engine (tourRun.js), the same record the
 *     story's tour scrubs through;
 *   - "Run the kiln" is the story's dashboard, wired here exactly as main.js
 *     wires it there, with the same ids.
 *
 * What is written here rather than read from config is the material that
 * config has no reason to hold: the lineage, the comparisons with other
 * kilns and their sources. Each item says how it is known.
 */

import {
  C, TAGS, EVIDENCE, COMPONENTS, OPEN_QUESTIONS,
} from './config.js';
import { createEngine, relativeHeat, stageAt } from './engine.js';
import { createSmoothScroll } from './scroll.js';
import { createNav, linkChips } from './nav.js';
import { recordLoop } from './tourRun.js';
import { createRing, SIMULATED_COLOUR } from './views/ring.js';
import { createPanel } from './views/panel.js';
import { createLabels, LABELLED_COMPONENTS } from './views/labels.js';
import { createChart } from './views/chart.js';
import { createEvidence } from './views/evidence.js';
import { createClock } from './views/clock.js';
import { heatHex } from './views/heatRamp.js';
import {
  el as svgEl, drawPlan, drawSection, drawAirRoute, drawShape,
} from './views/kilnDrawings.js';

const $ = (sel) => document.querySelector(sel);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function h(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) node.append(kid);
  return node;
}

/** The evidence chip. Its tooltip says what the letter means. */
function chip(tag) {
  const e = EVIDENCE[tag];
  return h('span', { class: 'chip', 'data-ev': tag, title: e ? `${e.label}. ${e.blurb}` : tag, text: tag });
}

// ---------------------------------------------------------------------------
// The bar, with the evidence switch at its end, and one glide for the page.
// ---------------------------------------------------------------------------

const pill = $('#evidence-pill').content.firstElementChild.cloneNode(true);
createNav({ current: 'kiln', end: pill });
const smooth = createSmoothScroll();

// ---------------------------------------------------------------------------
// Opening: the kiln in figures
// ---------------------------------------------------------------------------

const [peakLo, peakHi] = C.temperature.peakBandC;
const FACTS = [
  { fig: String(C.chambers.count), unit: 'chambers', text: 'connected in one loop', tag: TAGS.chambers.count },
  { fig: `${C.time.tickHours} h`, unit: 'between moves', text: 'the fire moves on, without fail', tag: TAGS.time.tickHours },
  { fig: `${peakLo}–${peakHi}`, unit: '°C at the peak', text: 'as reported at the factory; never measured', tag: TAGS.temperature.peakBandC },
  { fig: 'Shells', unit: 'of cashew nuts', text: 'dropped through holes in the roof', tag: TAGS.fuel.source },
  { fig: '?', unit: 'shape', text: 'ring, racetrack or z-shape: not known', tag: TAGS.shape.kundapur },
];
$('#facts').replaceChildren(...FACTS.map((f) => h('div', { class: 'kp-fact', 'data-ev': f.tag },
  h('dt', {}, h('span', { class: 'kp-fact-fig', text: f.fig }), h('span', { class: 'kp-fact-unit', text: f.unit })),
  h('dd', {}, f.text, ' ', chip(f.tag)))));

// ---------------------------------------------------------------------------
// 01 Lineage
// ---------------------------------------------------------------------------

const TIMELINE = [
  { year: '1858', title: 'A fire that never goes out', text: 'Friedrich Hoffmann patents a ring of chambers with the fire travelling round it. Circular, with a central chimney. Sources disagree on the year (1858 or 1859) and the country.', tag: 'L' },
  { year: '1865', title: 'Tiles on the Mangalore coast', text: 'The Basel Mission tile works at Mangalore begins production (some sources date its founding to 1860). Georg Plebst combines German methods with local potters’ knowledge.', tag: 'L' },
  { year: '1868', title: 'The closest match', text: 'The Albuquerque tile factory opens at Panemangalore. Its kiln is documented as z-shaped, fed from the top with cashew-nut shells, at 850–900 °C: the nearest documented kiln to Kundapur’s.', tag: 'L' },
  { year: '1900', title: 'Four thousand kilns', text: 'More than 4,000 Hoffmann-type kilns are working across Europe, Russia, the Americas, Africa and Asia.', tag: 'L' },
  { year: '1990s', title: 'An industry at its height', text: 'About 75 tile factories in Mangalore.', tag: 'L' },
  { year: '2022', title: 'Three left in Mangalore', text: 'Sovereign, Cascia and Albuquerque are the only working units reported.', tag: 'L' },
  { year: 'Now', title: 'Prabhakar Tile Works, Kundapur', text: 'Still firing, eight chambers, every two hours. When and by whom its kiln was built is not known.', tag: 'F', also: 'U', here: true },
];
$('#timeline').replaceChildren(...TIMELINE.map((t) => h('li', { class: `kp-tl${t.here ? ' is-here' : ''}` },
  h('span', { class: 'kp-tl-year', text: t.year }),
  h('h3', { text: t.title }),
  h('p', {}, t.text),
  h('p', { class: 'kp-tl-ev' }, chip(t.tag), t.also ? chip(t.also) : null))));

const SHAPES = [
  ['circular', 'Circular', 'The 1858 patent'],
  ['elliptical', 'Elliptical', 'Soon after'],
  ['racetrack', 'Racetrack', 'Most later kilns'],
  ['z', 'Z-shaped', 'Albuquerque, Mangalore'],
];
$('#shapes').replaceChildren(...SHAPES.map(([kind, name, when]) => {
  const svg = svgEl('svg', { viewBox: '0 0 120 120', 'aria-hidden': 'true' });
  drawShape(svg, kind);
  return h('div', { class: 'kp-shape' }, svg, h('b', { text: name }), h('span', { text: when }));
}));

/**
 * A small horizontal bar chart: one series, direct labels, a hover note.
 * Drawn at its container's own width, so its 13px labels stay 13px on a
 * phone instead of shrinking with a fixed viewBox; redrawn when that width
 * changes. Too narrow for names beside the bars, it puts each name above.
 */
function barChart(container, rows, opts) {
  let last = 0;
  const draw = () => {
    const w = Math.round(container.clientWidth);
    if (!w || Math.abs(w - last) < 8) return;
    last = w;
    drawBars(container, rows, { ...opts, width: w });
  };
  draw();
  if (!last) drawBars(container, rows, opts);   // not laid out yet: a fallback width
  new ResizeObserver(draw).observe(container);
}

function drawBars(container, rows, { max, log = false, ticks = [], tickLabel = String, width = 640, labelW = 210 }) {
  const stacked = width < 480;
  const rowH = stacked ? 56 : 44; const left = stacked ? 0 : labelW; const right = 80; const top = 10;
  const height = top + rows.length * rowH + (ticks.length ? 30 : 6);
  const W = width - left - right;
  const x = log
    ? (v) => left + ((Math.log10(v) - Math.log10(ticks[0])) / (Math.log10(ticks[ticks.length - 1]) - Math.log10(ticks[0]))) * W
    : (v) => left + (v / max) * W;
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, class: 'kp-bars', role: 'img' });
  for (const t of ticks) {
    svgEl('line', { x1: x(t), y1: stacked ? top + 18 : top - 4, x2: x(t), y2: height - 24, class: 'kp-grid-line' }, svg);
    const lab = svgEl('text', { x: x(t), y: height - 8, class: 'kp-axis', 'text-anchor': 'middle' }, svg);
    lab.textContent = tickLabel(t);
  }
  const tip = h('div', { class: 'kp-tip', role: 'status' });
  rows.forEach((r, i) => {
    const y = top + i * rowH + (stacked ? 24 : 12);
    const g = svgEl('g', { class: `kp-bar${r.derived ? ' is-derived' : ''}`, tabindex: '0' }, svg);
    const name = svgEl('text', { x: 0, y: stacked ? y - 8 : y + 13, class: 'kp-bar-name' }, g);
    name.textContent = r.name;
    const x1 = x(r.value);
    const x0 = left;
    const bw = Math.max(4, x1 - x0); const bh = 18; const rr = 4;
    svgEl('path', {
      d: `M ${x0} ${y} H ${x0 + bw - rr} Q ${x0 + bw} ${y} ${x0 + bw} ${y + rr} V ${y + bh - rr} Q ${x0 + bw} ${y + bh} ${x0 + bw - rr} ${y + bh} H ${x0} Z`,
      class: 'kp-bar-mark',
    }, g);
    const val = svgEl('text', { x: x0 + bw + 8, y: y + 13, class: 'kp-bar-val' }, g);
    val.textContent = r.label;
    // A generous hit area: the whole row.
    svgEl('rect', { x: 0, y: y - (stacked ? 24 : 12), width, height: rowH, fill: 'transparent' }, g);
    const show = () => { tip.textContent = r.note; tip.classList.add('is-on'); };
    const hide = () => tip.classList.remove('is-on');
    g.addEventListener('pointerenter', show); g.addEventListener('pointerleave', hide);
    g.addEventListener('focus', show); g.addEventListener('blur', hide);
  });
  container.replaceChildren(svg, tip);
}

barChart($('#decline'), [
  { name: 'Early 1990s', value: 75, label: 'about 75', note: 'About 75 tile factories in Mangalore in the early 1990s. As reported in 2022 coverage of the industry\u2019s decline (Udayavani; ThePrint/PTI).' },
  { name: '2010s', value: 12, label: 'about 12', note: 'About 12 by the 2010s. Same 2022 reports.' },
  { name: '2022', value: 3, label: '3', note: 'Three working units: Sovereign (1929), Cascia (1916) and Albuquerque (1868). Same 2022 reports.' },
], { max: 80, ticks: [0, 25, 50, 75], tickLabel: (t) => String(t), width: 560, labelW: 110 });

// ---------------------------------------------------------------------------
// 02 Anatomy
// ---------------------------------------------------------------------------

/**
 * Photographs of the parts, from other Hoffmann kilns (assets/tour, with
 * credits in CREDITS.md). Never the kiln at Kundapur, and every caption says
 * so.
 */
const PHOTOS = {
  chambers: { src: 'field/tiles-stacked.jpg', cap: 'Tiles stacked in a chamber, seen from the doorway. Prabhakar Tile Factory, Kundapur.', field: true, pos: '50% 60%' },
  stokeHoles: { src: 'field/fire-hole.jpg', cap: 'The fire, seen down an open hole in the roof. Prabhakar Tile Factory, Kundapur.', field: true, pos: '50% 60%' },
  wicketDoors: { src: 'wicketDoors.jpg', cap: 'A side opening into the ring kiln at Sehnde, Germany.', credit: 'Hamelenser, CC BY-SA 3.0' },
  walkway: { src: 'field/roof-caps.jpg', cap: 'The roof of the kiln: lidded fuel holes in rows, with firewood stacked alongside. Prabhakar Tile Factory, Kundapur.', field: true, pos: '50% 70%' },
  tiles: { src: 'field/tile.jpg', cap: 'A finished Mangalore tile, stamped with the works’ name. Prabhakar Tile Factory, Kundapur.', field: true, pos: '50% 40%' },
  flueDuct: { src: 'airPath.jpg', cap: 'Inside the ring kiln at Sehnde, Germany.', credit: 'Hamelenser, CC BY-SA 3.0' },
};
const PART_ORDER = ['chambers', 'stokeHoles', 'tiles', 'walkway', 'wicketDoors', 'dividingWalls', 'partition', 'dampers', 'flueDuct', 'kilnIsland', 'chimney'];

const plan = $('#plan');
const section = $('#section');
drawPlan(plan);
drawSection(section);

const partsList = $('#parts');
const partCard = $('#part-card');
const partButtons = {};
for (const id of PART_ORDER) {
  const c = COMPONENTS[id];
  const btn = h('button', { type: 'button', 'data-part': id, 'aria-pressed': 'false' },
    h('span', { text: c.label }), chip(c.tag));
  partButtons[id] = btn;
  partsList.append(h('li', {}, btn));
}

let currentPart = null;
function showPart(id) {
  currentPart = id;
  const c = COMPONENTS[id];
  for (const [k, b] of Object.entries(partButtons)) b.setAttribute('aria-pressed', String(k === id));
  for (const svg of [plan, section]) {
    svg.classList.add('has-focus');
    svg.querySelectorAll('[data-part]').forEach((n) => n.classList.toggle('is-on', n.dataset.part === id));
  }
  const photo = PHOTOS[id];
  const e = EVIDENCE[c.tag];
  partCard.replaceChildren(...[
    h('h3', {}, c.label),
    h('p', { class: 'kp-part-ev' }, chip(c.tag), h('span', { text: e.label })),
    h('p', { class: 'kp-part-text', text: c.note }),
    photo ? h('figure', { class: photo.field ? 'kp-part-photo is-field' : 'kp-part-photo' },
      h('img', { src: `./assets/${photo.field ? '' : 'tour/'}${photo.src}`, alt: photo.cap, loading: 'lazy', style: photo.pos ? `object-position:${photo.pos}` : null }),
      h('figcaption', {}, h('span', { text: photo.cap }), h('em', { text: photo.field ? 'Field photograph, seen on the visit.' : `Another kiln, not Kundapur. Photo: ${photo.credit}.` })))
      : null,
  ].filter(Boolean));
}
partsList.addEventListener('click', (ev) => {
  const b = ev.target.closest('button[data-part]');
  if (b) showPart(b.dataset.part);
});
for (const svg of [plan, section]) {
  svg.addEventListener('click', (ev) => {
    const n = ev.target.closest('[data-part]');
    if (n && COMPONENTS[n.dataset.part]) showPart(n.dataset.part);
  });
}
showPart('chambers');

// ---------------------------------------------------------------------------
// The recorded loop. One full turn of the fire in the real engine, steady
// running, the same record the story's tour uses.
// ---------------------------------------------------------------------------

const run = recordLoop();
const COUNT = run.count;
const LOOP_H = run.totalHours;

/** Chamber index `k` places after the fire's starting chamber. */
const chamberAt = (k) => (run.startFire + k + COUNT) % COUNT;

// ---------------------------------------------------------------------------
// 03 The air's route
// ---------------------------------------------------------------------------

{
  // One moment: the start of the loop. Chambers are laid out from the one
  // being emptied behind the fire to the one waiting beyond the partition.
  // Late in a two-hour slot, when the chamber firing is the hottest. Early
  // in one, the chamber the fire has just left is still hotter.
  const frame = run.at(C.time.tickHours * 0.9);
  const { pre, cool } = frame.params.window;
  // Offsets from the fire, laid left to right in the order the air meets
  // them: the chamber being emptied, the cooling ones, the fire, the ones
  // warming ahead, and last the one waiting beyond the partition.
  const offsets = Array.from({ length: COUNT }, (_, i) => (COUNT - cool - 1 + i) % COUNT);
  const roles = offsets.map((o) => {
    if (o === 0) return { id: 'fire', label: 'firing' };
    if (o >= 1 && o <= pre) return { id: 'ahead', label: o === pre ? 'warming · damper' : 'warming', damper: o === pre };
    if (o >= COUNT - cool) return { id: 'cool', label: 'cooling' };
    if (o === COUNT - cool - 1) return { id: 'in', label: 'being emptied', cold: true };
    return { id: 'wait', label: 'waiting', cold: true };
  });
  const heat = offsets.map((o) => relativeHeat(frame.chambers[(frame.firePos + o) % COUNT].temp));

  const air = drawAirRoute($('#air-svg'), { heat, heatHex, roles });

  const STAGES_AIR = [
    { id: 'in', title: 'In through one open door', text: 'The chamber behind the cooling ones is being emptied, and its doorway is the only way in. Cold air is drawn through it.', tag: 'L' },
    { id: 'cool', title: 'Across the fired tiles', text: 'The air passes over tiles that have just been fired. It cools them, and they warm it: heat from the tiles on their way out goes into the air.', tag: 'L' },
    { id: 'fire', title: 'Through the fire', text: 'The air reaches the fire already hot. Cashew-nut shells are dropped through the roof holes onto the stacked tiles and burn there; there is no separate firebox.', tag: 'F', note: 'The fuel and the roof holes were seen at the factory. That the air arrives hot is from writing on other kilns.' },
    { id: 'ahead', title: 'Across the tiles waiting ahead', text: 'The hot gas moves on through the chambers of unfired tiles, warming and drying them before the fire arrives. The same heat does a second job.', tag: 'L' },
    { id: 'out', title: 'Out by one open damper', text: 'Only one damper is open, after the last warmed chamber. A partition just beyond it, once a sheet of metal, later paper that burns away, stops the air taking the short way round.', tag: 'L' },
    { id: 'up', title: 'Up the chimney, by draught alone', text: 'There are no fans. The warm gas rising in the chimney pulls the whole stream through. In one documented English kiln, the exhaust left at about 150 °C.', tag: 'L' },
  ];
  const stepsEl = $('#air-steps');
  const btns = STAGES_AIR.map((s, i) => {
    const b = h('button', { type: 'button', 'data-stage': s.id, 'aria-pressed': 'false' },
      h('b', { text: String(i + 1) }), h('span', { text: s.title }));
    stepsEl.append(h('li', {}, b));
    return b;
  });
  let stageIdx = 0;
  function showStage(i) {
    stageIdx = (i + STAGES_AIR.length) % STAGES_AIR.length;
    const s = STAGES_AIR[stageIdx];
    air.show(s.id);
    btns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === stageIdx)));
    $('#air-step-h').textContent = s.title;
    $('#air-step-text').textContent = s.text;
    $('#air-step-ev').replaceChildren(chip(s.tag), h('span', { text: s.note || EVIDENCE[s.tag].blurb }));
  }
  stepsEl.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-stage]');
    if (b) showStage(btns.indexOf(b));
  });
  showStage(0);
}

// ---------------------------------------------------------------------------
// 04 Two readings: the space–time table, read down or across
// ---------------------------------------------------------------------------

{
  const ROW_H = 0.25;                                   // hours per row
  const ROWS = Math.round(LOOP_H / ROW_H);
  const STAGE_NAME = { fire: 'firing', preheat: 'warming', cool: 'cooling', wait: 'waiting', empty: 'empty' };
  // table[r][c]: heat and stage of the c-th chamber in firing order at row r.
  const table = Array.from({ length: ROWS }, (_, r) => {
    const f = run.at((r + 0.5) * ROW_H);
    return Array.from({ length: COUNT }, (_, c) => {
      const idx = chamberAt(c);
      return { heat: relativeHeat(f.chambers[idx].temp), stage: stageAt(f, idx) };
    });
  });

  const grid = $('#grid');
  const cw = 40; const ch = 6; const padL = 34; const padT = 22;
  const W = padL + COUNT * cw; const H = padT + ROWS * ch + 4;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'kp-st', 'aria-hidden': 'true' });
  for (let c = 0; c < COUNT; c++) {
    const t = svgEl('text', { x: padL + c * cw + cw / 2, y: 14, class: 'kp-axis', 'text-anchor': 'middle' }, svg);
    t.textContent = String(c + 1);
  }
  for (let hr = 0; hr <= LOOP_H; hr += C.time.tickHours) {
    const y = padT + (hr / ROW_H) * ch;
    const t = svgEl('text', { x: padL - 6, y: y + 3, class: 'kp-axis', 'text-anchor': 'end' }, svg);
    t.textContent = `${hr}h`;
  }
  const cells = svgEl('g', {}, svg);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COUNT; c++) {
      const v = table[r][c];
      svgEl('rect', {
        x: padL + c * cw + 1, y: padT + r * ch, width: cw - 2, height: ch,
        fill: v.stage === 'empty' ? '#3b3a36' : heatHex(v.heat), 'data-r': r, 'data-c': c,
      }, cells);
    }
  }
  const colBand = svgEl('rect', { class: 'kp-st-band', y: padT - 2, height: ROWS * ch + 4, width: cw, rx: 3 }, svg);
  const rowBand = svgEl('rect', { class: 'kp-st-band', x: padL - 2, width: COUNT * cw + 4, height: ch + 2, rx: 2 }, svg);
  grid.append(svg);

  // The key: the heat ramp, cold to hot, and the empty chamber.
  const key = h('div', { class: 'kp-heat-key', 'aria-hidden': 'true' },
    h('span', { text: 'cold' }),
    h('i', { style: `background: linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((v) => heatHex(v)).join(', ')})` }),
    h('span', { text: 'hot' }),
    h('b', {}), h('span', { text: 'empty' }));
  grid.after(key);

  let mode = 'col';
  let sel = { r: 0, c: 0 };

  const chart = $('#read-chart');
  const CW = 420; const CH = 260; const L = 40; const R = 12; const T = 16; const B = 58;
  function drawCol() {
    chart.replaceChildren();
    const x = (hr) => L + (hr / LOOP_H) * (CW - L - R);
    const y = (v) => T + (1 - v) * (CH - T - B);
    for (const v of [0, 0.5, 1]) {
      svgEl('line', { x1: L, y1: y(v), x2: CW - R, y2: y(v), class: 'kp-grid-line' }, chart);
    }
    const yl = svgEl('text', { x: L - 6, y: y(1) + 4, class: 'kp-axis', 'text-anchor': 'end' }, chart); yl.textContent = 'hot';
    const y0 = svgEl('text', { x: L - 6, y: y(0) + 4, class: 'kp-axis', 'text-anchor': 'end' }, chart); y0.textContent = 'cold';
    for (let hr = 0; hr <= LOOP_H; hr += 4) {
      const t = svgEl('text', { x: x(hr), y: CH - B + 16, class: 'kp-axis', 'text-anchor': 'middle' }, chart);
      t.textContent = `${hr} h`;
    }
    // The stages along the bottom, as named spans.
    let start = 0;
    for (let r = 1; r <= ROWS; r++) {
      const cur = table[r - 1][sel.c].stage;
      if (r === ROWS || table[r][sel.c].stage !== cur) {
        const xa = x(start * ROW_H); const xb = x(r * ROW_H);
        svgEl('rect', { x: xa + 1, y: CH - B + 26, width: Math.max(1, xb - xa - 2), height: 18, rx: 3, class: `kp-stage kp-stage--${cur}` }, chart);
        if (xb - xa > 34) {
          const t = svgEl('text', { x: (xa + xb) / 2, y: CH - B + 39, class: 'kp-stage-label', 'text-anchor': 'middle' }, chart);
          t.textContent = STAGE_NAME[cur];
        }
        start = r;
      }
    }
    const pts = table.map((row, r) => `${x((r + 0.5) * ROW_H).toFixed(1)},${y(row[sel.c].heat).toFixed(1)}`).join(' ');
    svgEl('polyline', { points: pts, class: 'kp-line' }, chart);
    // The selected moment, as a marker on the line.
    const v = table[sel.r][sel.c];
    svgEl('line', { x1: x((sel.r + 0.5) * ROW_H), y1: T, x2: x((sel.r + 0.5) * ROW_H), y2: CH - B, class: 'kp-cross' }, chart);
    svgEl('circle', { cx: x((sel.r + 0.5) * ROW_H), cy: y(v.heat), r: 5, class: 'kp-dot' }, chart);
    chart.setAttribute('aria-label', `Chamber ${sel.c + 1}: relative heat over one loop of ${LOOP_H} hours.`);
    $('#read-h').textContent = `Chamber ${sel.c + 1}, over one loop`;
    const peakAt = table.reduce((best, row, r) => (row[sel.c].heat > table[best][sel.c].heat ? r : best), 0);
    $('#read-text').textContent = `Left to right: it fires for ${C.time.tickHours} hours, cools as the fire moves on, is emptied and refilled, waits, then warms on the exhaust as the fire comes round again. Hottest about ${(peakAt * ROW_H).toFixed(1)} h into this loop. Every other chamber has the same life, shifted by ${C.time.tickHours} hours.`;
  }
  function drawRow() {
    chart.replaceChildren();
    const bw = (CW - L - R) / COUNT;
    const y = (v) => T + (1 - v) * (CH - T - B);
    for (const v of [0, 0.5, 1]) svgEl('line', { x1: L, y1: y(v), x2: CW - R, y2: y(v), class: 'kp-grid-line' }, chart);
    const yl = svgEl('text', { x: L - 6, y: y(1) + 4, class: 'kp-axis', 'text-anchor': 'end' }, chart); yl.textContent = 'hot';
    const y0 = svgEl('text', { x: L - 6, y: y(0) + 4, class: 'kp-axis', 'text-anchor': 'end' }, chart); y0.textContent = 'cold';
    table[sel.r].forEach((v, c) => {
      const x0 = L + c * bw + 5; const w = bw - 10; const top = y(Math.max(0.02, v.heat)); const base = y(0); const rr = 4;
      svgEl('path', {
        d: `M ${x0} ${base} V ${top + rr} Q ${x0} ${top} ${x0 + rr} ${top} H ${x0 + w - rr} Q ${x0 + w} ${top} ${x0 + w} ${top + rr} V ${base} Z`,
        fill: v.stage === 'empty' ? '#3b3a36' : heatHex(v.heat), class: c === sel.c ? 'kp-colbar is-sel' : 'kp-colbar',
      }, chart);
      const n = svgEl('text', { x: x0 + w / 2, y: CH - B + 16, class: 'kp-axis', 'text-anchor': 'middle' }, chart); n.textContent = String(c + 1);
      const s = svgEl('text', { x: x0 + w / 2, y: CH - B + 32, class: 'kp-stage-label kp-stage-label--small', 'text-anchor': 'middle' }, chart); s.textContent = STAGE_NAME[v.stage];
    });
    const hrs = (sel.r * ROW_H);
    chart.setAttribute('aria-label', `All eight chambers at ${hrs} hours.`);
    $('#read-h').textContent = `The whole kiln at ${hrs.toFixed(hrs % 1 ? 2 : 0)} h`;
    const fireC = table[sel.r].findIndex((v) => v.stage === 'fire');
    const hottest = table[sel.r].reduce((b, v, c) => (v.heat > table[sel.r][b].heat ? c : b), 0);
    const lag = hottest !== fireC
      ? ` Early in each two hours, chamber ${hottest + 1}, which the fire has just left, is still hotter than the one now firing.`
      : '';
    $('#read-text').textContent = `Chamber ${fireC + 1} is firing. The chambers after it are warming on its exhaust; the ones before it are cooling, and one behind those is emptied and refilled. Every chamber is at a different stage at once.${lag}`;
  }
  function render() {
    colBand.setAttribute('x', padL + sel.c * cw);
    rowBand.setAttribute('y', padT + sel.r * ch - 1);
    colBand.classList.toggle('is-on', mode === 'col');
    rowBand.classList.toggle('is-on', mode === 'row');
    if (mode === 'col') drawCol(); else drawRow();
  }
  svg.addEventListener('pointermove', (ev) => {
    const t = ev.target.closest('rect[data-r]');
    if (!t) return;
    const r = Number(t.dataset.r); const c = Number(t.dataset.c);
    if (r === sel.r && c === sel.c) return;
    sel = { r, c };
    render();
  });
  grid.addEventListener('keydown', (ev) => {
    const d = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[ev.key];
    if (!d) return;
    ev.preventDefault();
    sel = { r: (sel.r + d[0] * (mode === 'row' ? 1 : 4) + ROWS) % ROWS, c: (sel.c + d[1] + COUNT) % COUNT };
    render();
  });
  document.querySelectorAll('.kp-toggle [data-read]').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.read;
    document.querySelectorAll('.kp-toggle [data-read]').forEach((o) => o.setAttribute('aria-checked', String(o === b)));
    render();
  }));
  sel = { r: Math.round(4 / ROW_H), c: 0 };
  render();
}

// ---------------------------------------------------------------------------
// 05 Run the kiln: the story's dashboard, wired as main.js wires it.
// ---------------------------------------------------------------------------

const engine = createEngine();
const ring = createRing($('#ring-canvas'), { count: C.chambers.count });
const labels = createLabels($('#label-layer'), ring);
const kchart = createChart($('#chart'), engine.history, engine.dispatch);
ring.attachScrub(() => engine.state, engine.dispatch, engine.history);
const panel = createPanel({
  contextEl: $('#context'),
  debugEl: $('#debug'),
  clockEl: $('#clock-value'),
  recoveryEl: {
    on: $('#fuel-on'), off: $('#fuel-off'),
    rowOn: $('.fuel-row[data-mode="on"]'), rowOff: $('.fuel-row[data-mode="off"]'),
    whyOn: $('#why-on'), whyOff: $('#why-off'), note: $('#recovery-note'),
  },
}, engine.dispatch);
const clock = createClock({ dialEl: $('#dial'), handEl: $('#dial-hand'), marksEl: $('#dial-marks') });
const evidence = createEvidence({
  stripEl: $('#evidence-strip'),
  legendEl: $('#legend'),
  sheetEl: $('#sources'),
  sheetBodyEl: $('#sources-body'),
  drawn: [...new Set([...ring.components(), ...LABELLED_COMPONENTS])],
  colourTags: SIMULATED_COLOUR,
}, engine.dispatch);

const btnPlay = $('#btn-play');
btnPlay.addEventListener('click', () => engine.dispatch({ type: 'setPaused', value: !engine.state.paused }));
$('#btn-step').addEventListener('click', () => engine.dispatch({ type: 'tick' }));
const speed = $('#speed');
speed.min = C.time.speedMin;
speed.max = C.time.speedMax;
speed.addEventListener('input', () => {
  engine.dispatch({ type: 'setSpeed', value: speed.value });
  $('#speed-out').textContent = `${engine.state.params.speed}×`;
});
const recovery = $('#recovery');
recovery.checked = engine.state.params.recovery;
recovery.addEventListener('change', (ev) => engine.dispatch({ type: 'setRecovery', value: ev.target.checked }));

$('#evidence-mode').addEventListener('change', (ev) => {
  engine.dispatch({ type: 'setEvidenceMode', value: ev.target.checked });
  document.body.classList.toggle('evidence-mode', engine.state.ui.evidenceMode);
  evidence.update(engine.state);
  ring.resize();
  kchart.update(engine.state, true);
});
$('#btn-sources').addEventListener('click', () => engine.dispatch({ type: 'setDetails', value: true }));
$('#btn-sources-close').addEventListener('click', () => engine.dispatch({ type: 'setDetails', value: false }));

// The ring is a WebGL scene: draw it only while it can be seen.
let runVisible = false;
new IntersectionObserver(([e]) => {
  runVisible = e.isIntersecting;
  if (runVisible) { ring.resize(); kchart.update(engine.state, true); }
}, { rootMargin: '200px 0px' }).observe($('.kp-run'));

window.addEventListener('resize', () => {
  ring.resize();
  kchart.update(engine.state, true);
});

// ---------------------------------------------------------------------------
// 06 Other kilns
// ---------------------------------------------------------------------------

const TYPES = [
  { id: 'batch', name: 'Batch kiln', moves: 'Nothing moves', text: 'The whole kiln is heated, fired and cooled for every load, then heated again from cold. The fuel spent warming the structure is lost each time.', tag: 'L' },
  { id: 'hoffmann', name: 'Hoffmann kiln', moves: 'The fire moves', text: 'The ware stays where it was stacked and the fire travels round it. Heat from cooling ware and from the exhaust is used again. The kiln at Kundapur works this way.', tag: 'F', here: true },
  { id: 'tunnel', name: 'Tunnel kiln', moves: 'The ware moves', text: 'Ware rides on cars through fixed zones of heat; the fire stays put. It replaced the Hoffmann kiln in Britain, keeping the same counter-current recovery.', tag: 'L' },
  { id: 'trench', name: 'Bull’s trench and zigzag kilns', moves: 'The fire moves, in a trench', text: 'India’s common brick kilns: continuous firing like the ring, in an oval trench. Zigzag firing changes only the route the air takes, making it longer.', tag: 'L' },
];
function typeArt(id) {
  const svg = svgEl('svg', { viewBox: '0 0 200 90', 'aria-hidden': 'true', class: `kp-type-art kp-type-art--${id}` });
  const box = (x, y, w, hh, cls = '') => svgEl('rect', { x, y, width: w, height: hh, rx: 3, class: `kta-box ${cls}` }, svg);
  if (id === 'batch') {
    box(70, 18, 60, 54);
    svgEl('path', { d: 'M 150 60 A 22 22 0 1 0 150 30', class: 'kta-cycle' }, svg);
    svgEl('path', { d: 'M 146 24 L 150 30 L 156 26', class: 'kta-cycle' }, svg);
    svgEl('circle', { cx: 100, cy: 45, r: 7, class: 'kta-fire kta-pulse' }, svg);
  } else if (id === 'hoffmann') {
    for (let i = 0; i < 6; i++) box(14 + i * 30, 30, 26, 30);
    svgEl('circle', { cx: 0, cy: 45, r: 7, class: 'kta-fire kta-travel' }, svg);
    svgEl('path', { d: 'M 30 78 H 170', class: 'kta-arrow' }, svg);
    svgEl('path', { d: 'M 164 73 L 170 78 L 164 83', class: 'kta-arrow' }, svg);
  } else if (id === 'tunnel') {
    svgEl('rect', { x: 10, y: 26, width: 180, height: 38, rx: 3, class: 'kta-box' }, svg);
    svgEl('circle', { cx: 100, cy: 45, r: 7, class: 'kta-fire' }, svg);
    for (let i = 0; i < 4; i++) svgEl('rect', { x: 0, y: 36, width: 20, height: 18, rx: 2, class: 'kta-car kta-ride', style: `animation-delay:${-i * 1.5}s` }, svg);
    svgEl('path', { d: 'M 30 78 H 170', class: 'kta-arrow kta-arrow--ware' }, svg);
    svgEl('path', { d: 'M 164 73 L 170 78 L 164 83', class: 'kta-arrow kta-arrow--ware' }, svg);
  } else {
    svgEl('path', { d: 'M 40 22 H 160 A 23 23 0 0 1 160 68 H 40 A 23 23 0 0 1 40 22 Z', class: 'kta-trench' }, svg);
    svgEl('circle', { cx: 0, cy: 0, r: 6, class: 'kta-fire kta-orbit' }, svg);
  }
  return svg;
}
$('#types').replaceChildren(...TYPES.map((t) => h('li', { class: `kp-type${t.here ? ' is-here' : ''}` },
  typeArt(t.id),
  h('p', { class: 'kp-type-moves', text: t.moves }),
  h('h3', { text: t.name }),
  h('p', { text: t.text }),
  h('p', { class: 'kp-type-ev' }, chip(t.tag)))));

const PACE = [
  { name: 'Prabhakar, Kundapur', value: 16, label: '≈ 16 hours', derived: true, chambers: '8', move: 'every 2 hours', peak: '850–900 °C, as reported', source: 'Field visit; loop worked out (8 × 2 h)', note: 'Eight chambers, the fire moving every two hours (field). 8 × 2 h = 16 h is worked out, not observed. One open question is whether "two hours" is one chamber or one row of fuel holes.' },
  { name: 'Stewartby, England (1999)', value: 240, label: '10 days', chambers: '2 rows of 17', move: 'not given', peak: '930–960 °C, a 30-hour soak', source: 'Russell & Vogel (1999)', note: 'A natural-draught Hoffmann kiln for Fletton bricks, run 24 hours a day. "Each cycle takes 10 days." Russell & Vogel (1999).' },
  { name: 'A standard later kiln', value: 384, label: '≈ 16 days', derived: true, chambers: 'usually 16', move: 'one chamber a day', peak: '960–1000 °C', source: 'Materials for Architects and Builders (2019)', note: 'Usually 16 chambers, the fire advancing one chamber a day. 16 × 1 day ≈ 16 days is worked out from those figures.' },
];
barChart($('#pace'), PACE, {
  log: true, ticks: [10, 100, 1000],
  tickLabel: (t) => ({ 10: '10 h', 100: '100 h (4 days)', 1000: '1,000 h (6 weeks)' }[t]),
  width: 760, labelW: 200,
});
$('#pace-table').replaceChildren(h('table', { class: 'kp-table' },
  h('thead', {}, h('tr', {}, ...['Kiln', 'Chambers', 'Fire moves', 'One loop', 'Peak', 'Source'].map((t) => h('th', { scope: 'col', text: t })))),
  h('tbody', {}, ...PACE.map((p) => h('tr', {},
    h('th', { scope: 'row', text: p.name }), h('td', { text: p.chambers }), h('td', { text: p.move }),
    h('td', { text: `${p.label}${p.derived ? ' (worked out)' : ''}` }), h('td', { text: p.peak }), h('td', { text: p.source }))))));

// ---------------------------------------------------------------------------
// 07 Not known
// ---------------------------------------------------------------------------

const UNKNOWNS = [
  { q: OPEN_QUESTIONS.ringTopology.question, meanwhile: 'Drawn as a racetrack, because something has to be drawn. Not a finding.', settle: 'A photograph or sketch of the kiln from above.' },
  { q: OPEN_QUESTIONS.whatMoves.question, meanwhile: 'The fire’s leading edge enters a new chamber every two hours, creeping one row of fuel holes at a time.', settle: 'Watching one full move, or asking the stokers.' },
  { q: 'Eight chambers, or more than thirty?', meanwhile: 'The manager said 8. Energy-audit reports for the Mangalore cluster describe kilns of 32–36 chambers. Either this kiln is unusual, or "chamber" means different things to different people.', settle: 'Counting the wicket doors or damper handles on a return visit.', tag: 'U' },
  { q: OPEN_QUESTIONS.forkPolicy.question, meanwhile: 'All three are modelled in "Run the kiln". None is marked as right.', settle: 'Asking what happened the last time a chamber was not ready.' },
  { q: OPEN_QUESTIONS.activeChambers.question, meanwhile: 'About three, from writing on other kilns.', settle: 'Feeling the walls, or a thermometer, along the ring.', tag: OPEN_QUESTIONS.activeChambers.tag },
  { q: 'How does the crew work?', meanwhile: `Not modelled as people. ${C.unknowns.items.slice(2).join('; ')}: all unknown.`, settle: 'Time on site with the crew through one full loop.' },
];
$('#unknown-list').replaceChildren(...UNKNOWNS.map((u) => h('li', { class: 'kp-unknown' },
  h('p', { class: 'kp-unknown-ev' }, chip(u.tag || 'U')),
  h('h3', { text: u.q }),
  h('dl', {},
    h('div', {}, h('dt', { text: 'Meanwhile' }), h('dd', { text: u.meanwhile })),
    h('div', {}, h('dt', { text: 'Would settle it' }), h('dd', { text: u.settle }))))));

// ---------------------------------------------------------------------------
// Sources for this page. Only those this page leans on; every one has been
// read for the research behind it. The full, organised list will be the
// Evidence page's.
// ---------------------------------------------------------------------------

const SOURCES = [
  { kind: 'Field', cite: 'Prabhakar Tile Works, Kundapur: site visit, conversations with workers, and a follow-up conversation.', note: 'Unpublished. The eight chambers, the two-hour move, the fuel and the roof holes, the peak temperature as reported.' },
  { kind: 'Report', cite: 'Russell, A. & Vogel, R. (1999). Evaluation of Hoffmann Kiln Technology. Intermediate Technology Consultants.', url: 'https://practicalactionpublishing.com/book/2727/download?type=download', note: 'A study visit to a working Hoffmann kiln at Stewartby, England: natural draught, dampers, the 10-day cycle.' },
  { kind: 'Article', cite: 'Low-Tech Magazine (2009). Rings of Fire: Hoffmann Kilns.', url: 'https://solar.lowtechmagazine.com/2009/10/rings-of-fire-hoffmann-kilns/', note: 'The air circuit, dampers and partitions; the change from circular to rectangular plans.' },
  { kind: 'Encyclopedia', cite: 'Wikipedia. Hoffmann kiln.', url: 'https://en.wikipedia.org/wiki/Hoffmann_kiln', note: 'The patent, the spread of the kiln, surviving examples.' },
  { kind: 'Book excerpt', cite: 'Materials for Architects and Builders (2019), via the Taylor & Francis knowledge base.', url: 'https://taylorandfrancis.com/knowledge/Engineering_and_technology/Industrial_engineering_%26_manufacturing/Hoffmann_kiln', note: 'The standard later kiln: 12–24 chambers, one chamber a day, 960–1000 °C; tunnel kilns replacing Hoffmann kilns in Britain.' },
  { kind: 'Documentation', cite: 'Architexturez.net. The Basel Mission tile industry and the Albuquerque kiln.', url: 'https://architexturez.net/doc/az-cf-193722', note: 'The z-shaped, cashew-shell-fed kiln at 850–900 °C.' },
  { kind: 'Encyclopedia', cite: 'Wikipedia. Mangalore tiles; Basel Mission tile factory.', url: 'https://en.wikipedia.org/wiki/Mangalore_tiles', note: 'Plebst, the 1865 start, the factories that followed.' },
  { kind: 'News', cite: 'Udayavani (2022). Mangalore tile industry in state of decline.', url: 'https://www.udayavani.com/english-news/mangalore-tile-industry-in-state-of-decline', note: 'From about 75 factories to three. The same PTI report ran in ThePrint.' },
  { kind: 'Government report', cite: 'Bureau of Energy Efficiency (2012). Detailed project reports, Mangalore tile cluster.', url: 'https://sameeeksha.org/pdf/dpr/Mangalore_tiles_cluster/', note: 'Exhaust at 350–400 °C, no measurement in the cluster, 32–36 chambers, the heat-recovery fan. Projections, not outcomes.' },
  { kind: 'Manual', cite: 'Centre for Science and Environment. Zigzag Kilns: A Design Manual.', url: 'https://cseindia.org/zigzag-kilns-a-design-manual-8525', note: 'Bull’s trench and zigzag kilns.' },
  { kind: 'Images', cite: 'Four photographs of other Hoffmann kilns and Mangalore tiles, Wikimedia Commons, CC BY-SA 3.0 / 4.0. Authors: Kai3952, Hamelenser, ZornigeAmeise2017, Yadvendu.', note: 'Each with its source page, listed in assets/tour/CREDITS.md. The photographs of the chamber, roof, fire and tile at Kundapur are the field visit’s own (assets/field/).' },
];
$('#page-sources').replaceChildren(...SOURCES.map((s) => h('li', {},
  h('span', { class: 'kp-src-kind', text: s.kind }),
  h('span', { class: 'kp-src-cite' }, s.url ? h('a', { href: s.url, rel: 'noopener', target: '_blank', text: s.cite }) : s.cite),
  h('span', { class: 'kp-src-note', text: s.note }))));

// ---------------------------------------------------------------------------
// The contents rail follows the reader.
// ---------------------------------------------------------------------------

{
  const links = [...document.querySelectorAll('.kp-rail a')];
  const byId = Object.fromEntries(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const seen = new Map();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) seen.set(e.target.id, e.intersectionRatio);
    let best = null; let bestR = 0;
    for (const [id, r] of seen) if (r > bestR) { best = id; bestR = r; }
    links.forEach((a) => a.classList.toggle('is-current', a === byId[best]));
  }, { threshold: [0, 0.15, 0.3, 0.5, 0.75] });
  for (const id of Object.keys(byId)) io.observe(document.getElementById(id));
  document.body.classList.toggle('is-still', reduceMotion);
}

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

window.__errs = [];
let last = performance.now();
function frame(now) {
  const dt = Math.min(now - last, 250);
  last = now;
  try {
    smooth.update(dt);
    engine.step(dt);
    if (runVisible) {
      ring.update(engine.state, dt);
      labels.update(engine.state);
      panel.update(engine.state);
      kchart.update(engine.state);
      evidence.update(engine.state);
      clock.update(engine.state, dt);
      btnPlay.textContent = engine.state.paused ? 'Play' : 'Pause';
    }
  } catch (err) {
    window.__errs.push(String(err && err.stack || err));
    console.error('[kiln page] the draw loop stopped:', err);
    return;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.kiln = engine;
window.__run = run;

// Every evidence chip leads to its meaning on the Evidence page, including
// the ones that cards redraw as the visitor picks things.
linkChips(document.querySelector('main'));
new MutationObserver(() => linkChips(document.querySelector('main')))
  .observe(document.querySelector('main'), { childList: true, subtree: true });
