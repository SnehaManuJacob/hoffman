/**
 * views/kilnDrawings.js — the kiln page's line drawings, as SVG.
 *
 * Drawn in the same paper and ink as the 3D kiln (views/ring.js: RP and
 * INK_LINE), so the plan here and the kiln in "Run the kiln" read as one
 * drawing set. They are cold on purpose: as in the story, the kiln is ink
 * until something is hot, and heat colour appears only where the model says
 * a chamber is warm.
 *
 * Every drawn part carries `data-part`, a key of COMPONENTS in config.js, so
 * choosing a part highlights the same thing in every drawing and the words
 * about it come from the one place they are kept.
 *
 * Nothing here is a plan of the real kiln. Its shape at Kundapur is unknown
 * (config `shape.kundapur`, 'U'); proportions are drawing decisions.
 */

import { C } from '../config.js';

const NS = 'http://www.w3.org/2000/svg';

export const INK = {
  paper: '#2e2c29',
  void: '#4b4945',      // the tunnel, open space inside the masonry
  mass: '#403e3b',      // masonry
  island: '#54524d',
  line: '#e4e0da',      // every outline
  soft: '#9a958d',
  accent: '#B46AFF',    // "the part I mean", as in the tour
};

export function el(name, attrs = {}, parent = null) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  if (parent) parent.append(node);
  return node;
}

function text(parent, x, y, str, attrs = {}) {
  const t = el('text', { x, y, ...attrs }, parent);
  t.textContent = str;
  return t;
}

/** A rounded rectangle as a path, clockwise from top-centre. */
function roundedRectPath(cx, cy, hw, hh, r) {
  return [
    `M ${cx} ${cy - hh}`,
    `H ${cx + hw - r}`, `A ${r} ${r} 0 0 1 ${cx + hw} ${cy - hh + r}`,
    `V ${cy + hh - r}`, `A ${r} ${r} 0 0 1 ${cx + hw - r} ${cy + hh}`,
    `H ${cx - hw + r}`, `A ${r} ${r} 0 0 1 ${cx - hw} ${cy + hh - r}`,
    `V ${cy - hh + r}`, `A ${r} ${r} 0 0 1 ${cx - hw + r} ${cy - hh}`,
    'Z',
  ].join(' ');
}

/** Point and unit normal (pointing outwards) at distance s along a path. */
function frameAt(path, s, total) {
  const a = path.getPointAtLength(((s % total) + total) % total);
  const b = path.getPointAtLength((((s + 0.5) % total) + total) % total);
  const dx = b.x - a.x; const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // Clockwise path in screen space: the outward normal is (dy, -dx) rotated.
  return { x: a.x, y: a.y, nx: dy / len, ny: -dx / len };
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

export function drawPlan(svg) {
  svg.replaceChildren();
  const count = C.chambers.count;
  const rows = C.parts.stokeHolesPerChamber;
  const cx = 320; const cy = 210;
  const hw = 236; const hh = 138; const r = 92;   // the tunnel's centreline
  const band = 64;                                 // masonry, outside to inside
  const tunnel = 38;                               // the open tunnel within it

  const centre = el('path', { d: roundedRectPath(cx, cy, hw, hh, r), fill: 'none' }, svg);
  const total = centre.getTotalLength();
  const chamberLen = total / count;
  // Chamber 1 is centred on the top straight; numbering runs clockwise.
  const s0 = -chamberLen / 2;

  // Masonry, then the tunnel inside it: two strokes on one centreline.
  el('path', { d: centre.getAttribute('d'), fill: 'none', stroke: INK.line, 'stroke-width': band + 2.4 }, svg);
  el('path', { d: centre.getAttribute('d'), fill: 'none', stroke: INK.mass, 'stroke-width': band, 'data-part': 'walkway', class: 'kd-fill' }, svg);
  el('path', { d: centre.getAttribute('d'), fill: 'none', stroke: INK.void, 'stroke-width': tunnel, 'data-part': 'chambers', class: 'kd-fill kd-tunnel' }, svg);
  centre.remove();

  // The flue duct: the channel between the ring and the island.
  el('path', {
    d: roundedRectPath(cx, cy, hw - band / 2 - 22, hh - band / 2 - 22, 46),
    fill: 'none', stroke: INK.soft, 'stroke-width': 1.4, 'stroke-dasharray': '5 4',
    'data-part': 'flueDuct', class: 'kd-line',
  }, svg);

  // The island, split by the channel to the chimney.
  const ihw = hw - band / 2 - 44; const ihh = hh - band / 2 - 44;
  const island = el('g', { 'data-part': 'kilnIsland', class: 'kd-group' }, svg);
  el('rect', { x: cx - ihw, y: cy - ihh, width: ihw - 9, height: ihh * 2, rx: 10, fill: INK.island, stroke: INK.line, 'stroke-width': 1.2, class: 'kd-fill' }, island);
  el('rect', { x: cx + 9, y: cy - ihh, width: ihw - 9, height: ihh * 2, rx: 10, fill: INK.island, stroke: INK.line, 'stroke-width': 1.2, class: 'kd-fill' }, island);
  el('circle', { cx, cy, r: 19, fill: INK.paper, stroke: INK.line, 'stroke-width': 1.6, 'data-part': 'chimney', class: 'kd-fill' }, svg);
  el('circle', { cx, cy, r: 8, fill: 'none', stroke: INK.line, 'stroke-width': 1.2, 'data-part': 'chimney', class: 'kd-line' }, svg);

  const parts = el('g', {}, svg);
  const tmp = el('path', { d: roundedRectPath(cx, cy, hw, hh, r) }, svg);
  tmp.setAttribute('visibility', 'hidden');

  for (let i = 0; i < count; i++) {
    const start = s0 + i * chamberLen;
    const mid = start + chamberLen / 2;

    // The division at the start of this chamber, across the tunnel.
    const d = frameAt(tmp, start, total);
    el('line', {
      x1: d.x - d.nx * tunnel / 2, y1: d.y - d.ny * tunnel / 2,
      x2: d.x + d.nx * tunnel / 2, y2: d.y + d.ny * tunnel / 2,
      stroke: INK.line, 'stroke-width': 1.2, 'data-part': 'dividingWalls', class: 'kd-line',
    }, parts);

    // Fuel holes in the roof, along the centreline.
    for (let k = 0; k < rows; k++) {
      const p = frameAt(tmp, start + ((k + 0.5) / rows) * chamberLen, total);
      el('circle', { cx: p.x, cy: p.y, r: 2.6, fill: INK.paper, stroke: INK.line, 'stroke-width': 1, 'data-part': 'stokeHoles', class: 'kd-fill' }, parts);
    }

    // The wicket door, in the outer wall.
    const m = frameAt(tmp, mid, total);
    const ox = m.x + m.nx * (band / 2); const oy = m.y + m.ny * (band / 2);
    const tx = -m.ny; const ty = m.nx;   // along the wall
    el('line', {
      x1: ox - tx * 9, y1: oy - ty * 9, x2: ox + tx * 9, y2: oy + ty * 9,
      stroke: INK.paper, 'stroke-width': 5, 'data-part': 'wicketDoors', class: 'kd-door',
    }, parts);

    // The damper, in the inner wall, onto the flue duct.
    const ix = m.x - m.nx * (band / 2 + 6); const iy = m.y - m.ny * (band / 2 + 6);
    el('rect', { x: ix - 4, y: iy - 4, width: 8, height: 8, fill: INK.paper, stroke: INK.line, 'stroke-width': 1.2, 'data-part': 'dampers', class: 'kd-fill' }, parts);

    // Chamber numbers, outside the ring, as painted markings.
    const nx = m.x + m.nx * (band / 2 + 20); const ny = m.y + m.ny * (band / 2 + 20);
    text(parts, nx, ny + 4, String(i + 1), { class: 'kd-num', 'text-anchor': 'middle', 'data-part': 'chambers' });
  }

  // One partition: a shutter across the tunnel, a few chambers on.
  const pp = frameAt(tmp, s0 + 4 * chamberLen, total);
  el('line', {
    x1: pp.x - pp.nx * (tunnel / 2 + 3), y1: pp.y - pp.ny * (tunnel / 2 + 3),
    x2: pp.x + pp.nx * (tunnel / 2 + 3), y2: pp.y + pp.ny * (tunnel / 2 + 3),
    stroke: INK.line, 'stroke-width': 3.2, 'stroke-dasharray': '3 2', 'data-part': 'partition', class: 'kd-line',
  }, parts);
  tmp.remove();

}

// ---------------------------------------------------------------------------
// The section through one chamber
// ---------------------------------------------------------------------------

export function drawSection(svg) {
  svg.replaceChildren();
  const floor = 330; const roof = 78;
  const wl = 206; const wr = 434;            // tunnel walls
  const springY = 236; const ar = (wr - wl) / 2; const acx = (wl + wr) / 2;

  // Ground.
  el('line', { x1: 20, y1: 352, x2: 620, y2: 352, stroke: INK.soft, 'stroke-width': 1 }, svg);

  // Masonry, with the tunnel cut out of it (even-odd).
  const tunnelD = `M ${wl} ${floor} V ${springY} A ${ar} ${ar} 0 0 1 ${wr} ${springY} V ${floor} Z`;
  const massD = `M 92 ${floor + 22} V ${roof + 10} Q 92 ${roof} 104 ${roof} H 536 Q 548 ${roof} 548 ${roof + 10} V ${floor + 22} Z`;
  el('path', { d: `${massD} ${tunnelD}`, 'fill-rule': 'evenodd', fill: INK.mass, stroke: INK.line, 'stroke-width': 1.4, class: 'kd-mass' }, svg);
  el('path', { d: tunnelD, fill: INK.void, stroke: 'none', 'data-part': 'chambers', class: 'kd-fill kd-tunnel' }, svg);

  // The roof surface the crew walks on.
  el('line', { x1: 92, y1: roof, x2: 548, y2: roof, stroke: INK.line, 'stroke-width': 3, 'data-part': 'walkway', class: 'kd-line' }, svg);

  // The partition, seen face-on: a sheet filling the whole tunnel.
  el('path', { d: tunnelD, fill: 'none', stroke: INK.line, 'stroke-width': 1.6, 'stroke-dasharray': '6 4', 'data-part': 'partition', class: 'kd-line kd-ghost' }, svg);

  // Tiles: two stacks, a gap between them for the gas and the falling fuel.
  const tiles = el('g', { 'data-part': 'tiles', class: 'kd-group' }, svg);
  for (const [x0, x1] of [[wl + 14, acx - 16], [acx + 16, wr - 14]]) {
    for (let y = floor - 8; y > springY - 26; y -= 9) {
      el('rect', { x: x0, y, width: x1 - x0, height: 5, rx: 1, fill: INK.soft, opacity: 0.85, class: 'kd-fill' }, tiles);
    }
  }

  // Fuel holes through the roof, with shells on their way down the gap.
  for (const x of [acx - 30, acx + 30]) {
    const g = el('g', { 'data-part': 'stokeHoles', class: 'kd-group' }, svg);
    el('rect', { x: x - 6, y: roof - 1, width: 12, height: springY - ar - roof + 22, fill: INK.void, stroke: INK.line, 'stroke-width': 1.1, class: 'kd-fill' }, g);
    el('rect', { x: x - 10, y: roof - 7, width: 20, height: 6, rx: 1, fill: INK.paper, stroke: INK.line, 'stroke-width': 1.1, class: 'kd-fill' }, g);
  }
  const shells = el('g', { 'data-part': 'stokeHoles', class: 'kd-group kd-shells' }, svg);
  [[acx - 3, 170], [acx + 4, 196], [acx - 2, 224], [acx + 3, 252], [acx - 4, 284]].forEach(([x, y]) => {
    el('ellipse', { cx: x, cy: y, rx: 2.6, ry: 1.8, fill: INK.line, class: 'kd-fill' }, shells);
  });

  // The wicket door: a passage through the outer wall, bricked up between firings.
  const door = el('g', { 'data-part': 'wicketDoors', class: 'kd-group' }, svg);
  el('rect', { x: 92, y: 252, width: wl - 92, height: floor - 252, fill: INK.void, stroke: INK.line, 'stroke-width': 1.2, class: 'kd-fill' }, door);
  for (let y = 258; y < floor; y += 11) {
    for (let x = 98 + ((y / 11) % 2) * 9; x < wl - 8; x += 18) {
      el('rect', { x, y, width: 14, height: 7, fill: 'none', stroke: INK.soft, 'stroke-width': 0.9, class: 'kd-line' }, door);
    }
  }

  // Flue: from the foot of the tunnel, under a damper, down to the main flue.
  const flue = el('g', { 'data-part': 'flueDuct', class: 'kd-group' }, svg);
  el('path', {
    d: `M ${wr} ${floor - 18} H 478 V ${floor + 6} H 548`,
    fill: 'none', stroke: INK.void, 'stroke-width': 16, class: 'kd-fill kd-flue',
  }, flue);
  el('path', {
    d: `M ${wr} ${floor - 18} H 478 V ${floor + 6} H 548`,
    fill: 'none', stroke: INK.line, 'stroke-width': 1, 'stroke-dasharray': '4 3', class: 'kd-line',
  }, flue);
  const damper = el('g', { 'data-part': 'dampers', class: 'kd-group' }, svg);
  el('line', { x1: 478, y1: roof, x2: 478, y2: floor - 12, stroke: INK.line, 'stroke-width': 1.4, class: 'kd-line' }, damper);
  el('rect', { x: 466, y: floor - 12, width: 24, height: 6, rx: 1, fill: INK.line, class: 'kd-fill' }, damper);
  el('circle', { cx: 478, cy: roof - 6, r: 5, fill: 'none', stroke: INK.line, 'stroke-width': 1.4, class: 'kd-line' }, damper);

  // The chimney, beyond the island.
  const chim = el('g', { 'data-part': 'chimney', class: 'kd-group' }, svg);
  el('path', { d: `M 548 ${floor + 6} H 584`, stroke: INK.line, 'stroke-width': 1, 'stroke-dasharray': '4 3', fill: 'none', class: 'kd-line' }, chim);
  el('path', { d: `M 582 ${floor + 22} L 588 24 H 612 L 618 ${floor + 22} Z`, fill: INK.mass, stroke: INK.line, 'stroke-width': 1.4, class: 'kd-fill' }, chim);

  // Orientation, as markings.
  text(svg, 100, 372, 'Outside', { class: 'kd-mark' });
  text(svg, 448, 372, 'Island side', { class: 'kd-mark' });
  text(svg, 584, 18, 'Chimney', { class: 'kd-mark' });
}

// ---------------------------------------------------------------------------
// The air's route, unrolled
// ---------------------------------------------------------------------------

/**
 * The loop cut open and laid flat, with the fire in the fourth chamber.
 * `heat` gives each chamber's relative heat (0–1) from the model, in the
 * same left-to-right order; `heatHex` turns it into the ramp's colour.
 *
 * Returns a handle that lights one stage of the route at a time.
 */
export function drawAirRoute(svg, { heat, heatHex, roles }) {
  svg.replaceChildren();
  const n = roles.length;
  const x0 = 66; const w = 94; const gap = 6;
  const top = 104; const bottom = 194;
  const mid = (top + bottom) / 2;
  const flueY = 248;
  const chimneyX = 916;

  const xs = roles.map((_, i) => x0 + i * (w + gap));

  // Masonry band and the chambers.
  el('rect', { x: x0 - 16, y: top - 22, width: n * (w + gap) - gap + 32, height: bottom - top + 44, rx: 8, fill: INK.mass, stroke: INK.line, 'stroke-width': 1.2 }, svg);
  const cells = roles.map((role, i) => {
    const g = el('g', { class: 'ka-ch', 'data-role': role.id }, svg);
    const fill = role.cold ? INK.void : heatHex(heat[i]);
    el('rect', { x: xs[i], y: top, width: w, height: bottom - top, rx: 3, fill, stroke: INK.line, 'stroke-width': 1 }, g);
    text(g, xs[i] + w / 2, bottom + 40, role.label, { class: 'kd-mark ka-role', 'text-anchor': 'middle' });
    return g;
  });

  // The open doorway in the chamber being emptied: the only way in.
  const doorX = xs[0] + w / 2;
  el('rect', { x: doorX - 14, y: top - 22, width: 28, height: 22, fill: INK.paper, stroke: INK.line, 'stroke-width': 1 }, svg);

  // The one open damper, at the far end of the warmed chambers, and the
  // partition just beyond it.
  const outIdx = roles.findIndex((r) => r.damper);
  const damperX = xs[outIdx] + w - 18;
  el('rect', { x: damperX - 10, y: bottom + 22, width: 20, height: 6, rx: 1, fill: INK.line }, svg);
  const partX = xs[outIdx] + w + gap / 2;
  el('line', { x1: partX, y1: top - 4, x2: partX, y2: bottom + 4, stroke: INK.line, 'stroke-width': 3, 'stroke-dasharray': '3 2' }, svg);
  text(svg, partX + 6, top - 8, 'partition', { class: 'kd-mark' });

  // Main flue and chimney.
  el('line', { x1: damperX, y1: flueY, x2: chimneyX, y2: flueY, stroke: INK.void, 'stroke-width': 14, 'stroke-linecap': 'round' }, svg);
  el('path', { d: `M ${chimneyX - 14} ${flueY + 10} L ${chimneyX - 9} 26 H ${chimneyX + 9} L ${chimneyX + 14} ${flueY + 10} Z`, fill: INK.mass, stroke: INK.line, 'stroke-width': 1.2 }, svg);
  text(svg, chimneyX, 18, 'chimney', { class: 'kd-mark', 'text-anchor': 'middle' });

  // The air, in stages. Width stands for the heat it carries, as on the
  // kiln in the story; colour is always the air's own.
  const fireIdx = roles.findIndex((r) => r.id === 'fire');
  const right = (i) => xs[i] + w;
  const seg = (id, d, width, spent = false) => el('path', {
    d, class: `ka-air${spent ? ' is-spent' : ''}`, 'data-stage': id,
    fill: 'none', 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  }, svg);
  const stages = [
    seg('in', `M ${doorX} ${top - 46} V ${mid} H ${right(0)}`, 2.5),
    seg('cool', `M ${right(0)} ${mid} H ${right(fireIdx - 1)}`, 5),
    seg('fire', `M ${right(fireIdx - 1)} ${mid} H ${right(fireIdx)}`, 9),
    seg('ahead', `M ${right(fireIdx)} ${mid} H ${damperX}`, 6),
    seg('out', `M ${damperX} ${mid} V ${flueY} H ${chimneyX - 20}`, 3, true),
    seg('up', `M ${chimneyX} ${flueY - 8} V 30`, 3, true),
  ];
  // Arrowheads at the end of each stage.
  stages.forEach((p) => p.setAttribute('marker-end', 'url(#ka-head)'));
  const defs = el('defs', {}, svg);
  const mk = el('marker', { id: 'ka-head', viewBox: '0 0 10 10', refX: 6, refY: 5, markerWidth: 4, markerHeight: 4, orient: 'auto-start-reverse' }, defs);
  el('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'ka-head' }, mk);
  svg.prepend(defs);

  return {
    show(stageId) {
      svg.dataset.stage = stageId;
      for (const p of stages) p.classList.toggle('is-on', p.dataset.stage === stageId);
      const lit = { in: [0], cool: roles.map((r, i) => (r.id === 'cool' ? i : -1)), fire: [fireIdx], ahead: roles.map((r, i) => (r.id === 'ahead' ? i : -1)), out: [outIdx], up: [] }[stageId] || [];
      cells.forEach((g, i) => g.classList.toggle('is-on', lit.includes(i)));
    },
  };
}

// ---------------------------------------------------------------------------
// Plan shapes through the kiln's history
// ---------------------------------------------------------------------------

export function drawShape(svg, kind) {
  svg.replaceChildren();
  const ring = { fill: 'none', stroke: INK.line, 'stroke-width': 9, 'stroke-linejoin': 'round' };
  const inner = { fill: 'none', stroke: INK.mass, 'stroke-width': 6, 'stroke-linejoin': 'round' };
  let d;
  if (kind === 'circular') d = 'M 60 18 A 42 42 0 1 1 59.9 18 Z';
  else if (kind === 'elliptical') d = 'M 60 30 A 46 30 0 1 1 59.9 30 Z';
  else if (kind === 'racetrack') d = roundedRectPath(60, 60, 48, 28, 26);
  else d = 'M 14 30 H 96 L 24 90 H 106';
  el('path', { d, ...ring }, svg);
  el('path', { d, ...inner }, svg);
  if (kind === 'circular') el('circle', { cx: 60, cy: 60, r: 6, fill: INK.line }, svg);
}
