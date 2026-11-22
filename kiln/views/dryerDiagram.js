/**
 * views/dryerDiagram.js — the proposed dryer, as one live SVG.
 *
 * Redrawn from the proposal's figures (future-research/figures) in the
 * site's language. Those figures drew air in reds and oranges; here the
 * site's rules hold: air is the air tone, fading towards the spent tone as
 * it gives up its drying power; heat colour is only the heater's flame; and
 * purple marks what does the controlling, the dampers.
 *
 * Geometry (all design decisions in the proposal, none measured): four
 * bays in a row, each a plenum under a perforated floor, a shallow bed of
 * nuts, and a headspace. Supply dampers S1–S4 from the duct below, passages
 * P12, P23, P34 from each headspace to the next plenum, the return duct
 * R41 from bay 4 back to bay 1, exhausts X1–X4 above.
 *
 * The view draws a configuration it is given; it decides nothing.
 */

const NS = 'http://www.w3.org/2000/svg';
function el(name, attrs = {}, parent = null) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, v);
  if (parent) parent.append(n);
  return n;
}
function text(parent, x, y, s, attrs = {}) {
  const t = el('text', { x, y, ...attrs }, parent);
  t.textContent = s;
  return t;
}

const BAY_W = 140; const GAP = 50; const LEFT0 = 190;
const TOP = 130; const FLOOR = 262; const BOTTOM = 330;
const DUCT_Y = 398; const RET_Y = 62; const EXH_TOP = 86;
const bayL = (i) => LEFT0 + (i - 1) * (BAY_W + GAP);
const bayR = (i) => bayL(i) + BAY_W;
const bayC = (i) => bayL(i) + BAY_W / 2;
const xX = (i) => bayL(i) + 34;           // exhaust stub
const RET_X1 = bayL(1) - 26;              // where R41 comes down to bay 1
const RET_X4 = bayR(4) - 26;              // where R41 leaves bay 4

/** Where each damper sits, and which way its flow runs there. */
export const DAMPERS = {
  S1: { x: bayC(1), y: 364, dir: 'v', label: 'S1', connects: 'supply → bay 1' },
  S2: { x: bayC(2), y: 364, dir: 'v', label: 'S2', connects: 'supply → bay 2' },
  S3: { x: bayC(3), y: 364, dir: 'v', label: 'S3', connects: 'supply → bay 3' },
  S4: { x: bayC(4), y: 364, dir: 'v', label: 'S4', connects: 'supply → bay 4' },
  P12: { x: bayR(1) + GAP / 2, y: 232, dir: 'v', label: 'P12', connects: 'bay 1 → bay 2' },
  P23: { x: bayR(2) + GAP / 2, y: 232, dir: 'v', label: 'P23', connects: 'bay 2 → bay 3' },
  P34: { x: bayR(3) + GAP / 2, y: 232, dir: 'v', label: 'P34', connects: 'bay 3 → bay 4' },
  R41: { x: (RET_X1 + RET_X4) / 2, y: RET_Y, dir: 'h', label: 'R41', connects: 'bay 4 → bay 1 (return duct)' },
  X1: { x: xX(1), y: 106, dir: 'v', label: 'X1', connects: 'bay 1 → outside' },
  X2: { x: xX(2), y: 106, dir: 'v', label: 'X2', connects: 'bay 2 → outside' },
  X3: { x: xX(3), y: 106, dir: 'v', label: 'X3', connects: 'bay 3 → outside' },
  X4: { x: xX(4), y: 106, dir: 'v', label: 'X4', connects: 'bay 4 → outside' },
};

/** The duct each damper sits in, as a path. */
function ductPath(id) {
  const i = Number(id[1]);
  if (id[0] === 'S') return `M ${bayC(i)} ${DUCT_Y} V ${BOTTOM}`;
  if (id[0] === 'X') return `M ${xX(i)} ${TOP} V ${EXH_TOP}`;
  if (id === 'R41') return `M ${RET_X4} ${TOP} V ${RET_Y} H ${RET_X1} V ${BOTTOM - 18} H ${bayL(1)}`;
  const a = Number(id[1]); const b = Number(id[2]);
  const mx = bayR(a) + GAP / 2;
  return `M ${bayR(a)} ${TOP + 22} H ${mx} V ${BOTTOM - 18} H ${bayL(b)}`;
}

/** The route of a passage, for drawing the air along it. */
function passageRoute(from, to) {
  if (from === 4 && to === 1) return ductPath('R41');
  return ductPath(`P${from}${to}`);
}

export function createDryer(svg) {
  svg.replaceChildren();
  const defs = el('defs', {}, svg);
  const hatch = el('pattern', { id: 'dd-hatch', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  el('line', { x1: 0, y1: 0, x2: 0, y2: 8, class: 'dd-hatch-line' }, hatch);
  const head = el('marker', { id: 'dd-head', viewBox: '0 0 10 10', refX: 6, refY: 5, markerWidth: 4.5, markerHeight: 4.5, orient: 'auto-start-reverse' }, defs);
  el('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'dd-head' }, head);

  // Ducts: drawn once, quiet. The air and the dampers sit on top.
  const ducts = el('g', { class: 'dd-ducts' }, svg);
  el('path', { d: `M 140 ${DUCT_Y} H ${bayC(4) + 8}`, class: 'dd-duct' }, ducts);
  for (const id of Object.keys(DAMPERS)) el('path', { d: ductPath(id), class: 'dd-duct' }, ducts);

  // The heater and fan: fixed, never moves.
  const heater = el('g', { class: 'dd-heater' }, svg);
  el('rect', { x: 22, y: 362, width: 118, height: 72, rx: 8, class: 'dd-heater-box' }, heater);
  text(heater, 81, 388, 'Heater + fan', { class: 'dd-heater-t', 'text-anchor': 'middle' });
  text(heater, 81, 404, 'husk-fired, indirect', { class: 'dd-heater-s', 'text-anchor': 'middle' });
  text(heater, 81, 419, 'fixed; never moves', { class: 'dd-heater-s', 'text-anchor': 'middle' });
  el('path', { d: 'M 40 352 q -6 -10 0 -18 q 2 8 7 6 q 3 -8 -1 -14 q 10 6 8 18 q -2 8 -14 8 z', class: 'dd-flame' }, heater);

  // Bays.
  const bays = {};
  for (let i = 1; i <= 4; i++) {
    const g = el('g', { class: 'dd-bay' }, svg);
    const box = el('rect', { x: bayL(i), y: TOP, width: BAY_W, height: BOTTOM - TOP, rx: 4, class: 'dd-bay-box' }, g);
    const fill = el('rect', { x: bayL(i), y: TOP, width: BAY_W, height: BOTTOM - TOP, rx: 4, fill: 'url(#dd-hatch)', class: 'dd-bay-hatch' }, g);
    el('line', { x1: bayL(i) + 6, y1: FLOOR, x2: bayR(i) - 6, y2: FLOOR, class: 'dd-floor' }, g);
    const nuts = el('g', { class: 'dd-nuts' }, g);
    for (let k = 0; k < 8; k++) {
      el('circle', { cx: bayL(i) + 18 + k * 15, cy: FLOOR - 8, r: 6.5 }, nuts);
    }
    text(g, bayL(i) + 2, BOTTOM + 18, `Bay ${i}`, { class: 'dd-bay-n' });
    const role = text(g, bayL(i) + 12, TOP + 26, '', { class: 'dd-role' });
    const sub = text(g, bayL(i) + 12, TOP + 44, '', { class: 'dd-sub' });
    const sub2 = text(g, bayL(i) + 12, TOP + 60, '', { class: 'dd-sub' });
    const batch = text(g, bayR(i) - 12, TOP + 26, '', { class: 'dd-batch', 'text-anchor': 'end' });
    text(g, bayC(i), BOTTOM - 12, 'plenum', { class: 'dd-tiny', 'text-anchor': 'middle' });
    bays[i] = { g, box, fill, nuts, role, sub, sub2, batch };
  }

  const airLayer = el('g', { class: 'dd-air' }, svg);

  // Dampers: a ring with a vane. Open, the vane lies along the flow;
  // shut, across it; partly open, at a slant.
  const dampers = {};
  for (const [id, d] of Object.entries(DAMPERS)) {
    const g = el('g', { class: 'dd-damper', transform: `translate(${d.x} ${d.y})` }, svg);
    el('circle', { r: 10, class: 'dd-damper-ring' }, g);
    const vane = el('line', { x1: 0, y1: -7, x2: 0, y2: 7, class: 'dd-damper-vane' }, g);
    const lx = d.dir === 'h' ? 0 : 15; const ly = d.dir === 'h' ? -15 : 4;
    text(g, lx, ly, d.label, { class: 'dd-damper-l', 'text-anchor': d.dir === 'h' ? 'middle' : 'start' });
    dampers[id] = { g, vane, dir: d.dir };
  }
  const outs = {};
  for (let i = 1; i <= 4; i++) {
    outs[i] = text(svg, xX(i), EXH_TOP - 8, 'out', { class: 'dd-out', 'text-anchor': 'middle' });
  }

  function setDamper(id, state) {
    const d = dampers[id];
    d.g.dataset.state = state;
    // Flow along the duct: vertical ducts run up and down, R41's damper sits
    // on a horizontal run.
    const along = d.dir === 'h' ? 90 : 0;
    const angle = state === 'open' ? along : state === 'part' ? along + 45 : along + 90;
    d.vane.setAttribute('transform', `rotate(${angle})`);
  }

  const NUT = { dry: 'dd-nut--dry', mid: 'dd-nut--mid', wet: 'dd-nut--wet' };

  /**
   * @param {object} cfg
   * @param {Object<string,'open'|'shut'|'part'>} cfg.dampers
   * @param {Object<number,{state, role, batch, nuts, sub, sub2}>} cfg.bays
   * @param {number[]} cfg.route   bay numbers the air passes, in order
   * @param {number|null} cfg.temper  a bay fed a little supply air directly
   */
  function render(cfg) {
    for (const id of Object.keys(DAMPERS)) setDamper(id, cfg.dampers[id] || 'shut');
    for (let i = 1; i <= 4; i++) {
      const b = bays[i]; const s = cfg.bays[i];
      b.g.dataset.state = s.state;
      b.role.textContent = s.role;
      b.sub.textContent = s.sub || '';
      b.sub2.textContent = s.sub2 || '';
      b.batch.textContent = s.batch ? `batch ${s.batch}` : '';
      b.nuts.setAttribute('class', `dd-nuts ${s.nuts ? NUT[s.nuts] : 'is-empty'}`);
      outs[i].classList.toggle('is-on', cfg.dampers[`X${i}`] === 'open');
    }

    // The air, segment by segment, fading from fresh to spent.
    airLayer.replaceChildren();
    const route = cfg.route;
    const steps = route.length * 2 + 1;       // supply, bed, passage, bed, ..., exhaust
    let k = 0;
    const seg = (d, cls = '') => {
      const t = k / (steps - 1);
      k += 1;
      el('path', {
        d, class: `dd-air-seg ${cls}`, 'marker-end': 'url(#dd-head)',
        style: `--t:${t.toFixed(3)}; stroke-width:${(6.5 - t * 3.5).toFixed(2)}px`,
      }, airLayer);
    };
    const lead = route[0];
    seg(`M 140 ${DUCT_Y} H ${bayC(lead)} V ${BOTTOM + 4}`);
    route.forEach((bay, n) => {
      seg(`M ${bayC(bay)} ${BOTTOM - 4} V ${TOP + 74}`, 'dd-air-bed');
      if (n < route.length - 1) seg(passageRoute(bay, route[n + 1]));
    });
    const last = route[route.length - 1];
    seg(`M ${xX(last)} ${TOP} V ${EXH_TOP - 22}`);
    if (cfg.temper) {
      el('path', {
        d: `M ${bayC(lead)} ${DUCT_Y} H ${bayC(cfg.temper)} V ${BOTTOM + 4}`,
        class: 'dd-air-seg dd-air-temper', 'marker-end': 'url(#dd-head)',
        style: '--t:0; stroke-width:2.5px',
      }, airLayer);
    }
  }

  return { render, setDamper };
}

/** The legend, as HTML that matches the drawing. */
export function legendHTML() {
  return `
    <span><svg viewBox="-12 -12 24 24"><g class="dd-damper" data-state="open"><circle r="10" class="dd-damper-ring"/><line y1="-7" y2="7" class="dd-damper-vane"/></g></svg>open</span>
    <span><svg viewBox="-12 -12 24 24"><g class="dd-damper" data-state="shut"><circle r="10" class="dd-damper-ring"/><line x1="-7" x2="7" class="dd-damper-vane"/></g></svg>shut</span>
    <span><svg viewBox="-12 -12 24 24"><g class="dd-damper" data-state="part"><circle r="10" class="dd-damper-ring"/><line x1="-5" y1="-5" x2="5" y2="5" class="dd-damper-vane"/></g></svg>partly open</span>
    <span class="pp-legend-air"><i></i>air: heated → spent</span>
    <span class="pp-legend-nut"><i class="dd-nut--dry"></i><i class="dd-nut--mid"></i><i class="dd-nut--wet"></i>nuts: dry → wet</span>
    <span class="pp-legend-bay"><i class="is-active"></i>active <i class="is-isolated"></i>isolated <i class="is-bypassed"></i>bypassed</span>`;
}
