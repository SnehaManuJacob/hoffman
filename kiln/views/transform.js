/**
 * views/transform.js — Stage 6: the kiln, changed one thing at a time.
 *
 * Picks up where views/problem.js leaves the visitor: the kiln drawing
 * (views/ring.js) seen from above, its fire just round a lap, "So start from
 * the kiln." From there each beat runs the same way: try the kiln as it is
 * on nuts, show the particular way it fails, make the ONE change that fixes
 * that failure, and light the one idea from the logic section it keeps (the
 * tray, built by problem.js):
 *
 *   a. Load      arecanut instead of tiles; the fire would come round and
 *                burn them, smoke and all. The fire leaves the chambers for
 *                one fixed heater outside, burning husk.        Pipeline
 *   b. Shape     nuts take days, not hours: four bays are enough. The ring
 *                straightens into a row, and a duct over the top, from the
 *                last bay back to the first, keeps it a loop.   Loop
 *   c. Route     a fixed heater would dry only the bay beside it. In the
 *                kiln the fire moved; here the AIR'S ROUTE moves: dampers
 *                open ahead and close behind, make before break.  Algorithm
 *   d. Hand-on   the air meets the driest nuts first and the wettest last,
 *                taking up water as it goes.                     Forwarding
 *   e. Trigger   the kiln moved every two hours, without fail; nuts dry with
 *                the weather. The clock is unplugged and the nuts plugged
 *                into the empty socket the Trigger card left.    Trigger
 *
 * Then Stage 7, the dryer shown whole: the trigger's diagram clears, its
 * name comes up, "The Drying Cycle", and the route
 * steps on three more times, so all four of its configurations are seen.
 * Every step starts with a grower testing a nut from the lead batch, by
 * hand and eye; only when it passes do the dampers move. Then that bay is
 * emptied and refilled, nut by nut; the batch letters stay in their bays,
 * the role tags move.
 *
 * Then Stage 8, the honest close: rain falls across the drawing again and
 * the rain stage's two bars come back with a third, dashed, for the
 * dryer's AIM (not a result); then full circle, the drawing raised into a
 * building in the village, in the rain, the one thing still drying; the
 * kiln and the Drying Cycle side by side,
 * row by row, four kept and two changed (the heat source, and what
 * starts a step); the questions that are
 * still open; and back to the kiln, running, for the dashboard.
 *
 * (b comes before c, not after as first planned: the route is then shown
 * once, on the dryer's real layout, not on the ring and again on the row.)
 *
 * Drawn as an SVG over the kiln drawing, in its own language: the paper,
 * light ink, chambers in the ring's greys, heat colours only for heat, the
 * page's air tone only for air, the logic section's purple for whatever does
 * the controlling (dampers, the trigger's wire). The eight chambers
 * start exactly where the ring draws them (projected through ring.camera),
 * so the hand-over from the live drawing is a crossfade of the same shapes.
 *
 * Everything is placed by problem.js's smoothed scroll, so it all runs
 * backwards; only the air's flow moves on its own clock.
 *
 * The layout follows the dryer proposal: four bays in a row, one fixed
 * husk-fired heater, supply dampers S1-S4, passages P12 P23 P34, the return
 * R41 (bay 4's headspace to bay 1's plenum, overhead), exhausts X1-X4. Step
 * one opens S1 P12 P23 X3; step two S2 P23 P34 X4.
 */

import { relativeHeat } from '../engine.js';
import { heatHex } from './heatRamp.js';
import { PALETTE } from '../config.js';

const NS = 'http://www.w3.org/2000/svg';
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, k) => a + (b - a) * k;
const bump = (a, b, c, d, x) => smooth(a, b, x) * (1 - smooth(c, d, x));

/** The stage's beats, in problem.js's scroll (vh from its pin). */
export const T6 = {
  IN: [1474, 1494],         // the schematic over the live drawing
  NUTS: [1494, 1534],       // "What if the chambers held arecanut…": nut by nut
  FIRE: [1544, 1572],       // "But the fire cannot pass through them…"
  OUT: [1584, 1616],        // "So the fire moves outside…": out to a heater
  JOIN: [1688, 1698],       // (not drawn)
  MORPH: [1708, 1764],      // four bays; the ring straightens into a row
  DUCTS: [1838, 1858],      // "The heater stays in one place…": the ducts
  ROUTE1: [1858, 1876],     // and one fixed route
  DAMPERS: [1894, 1936],    // "So dampers move the air's route on…": they glow
  FWD: [2000, 2034],        // "The warmest, driest air…": fresh, then spent
  // The first step, told in two passages: the lead batch dry, its bay shut
  // off and the lead moved on; then that bay emptied and refilled by hand.
  SWITCH: [2138, 2284],
  CLOCK: [2288, 2304],      // "The condition of the nuts decides…": the box
  UNPLUG: [2292, 2302],     // (no clock is drawn)
  PLUG: [2304, 2326],       // the grower's wire into it
  UNKNOWN: [2386, 2402],    // "How often to check…": not known
  // Stage 7: the dryer named, and its four steps.
  CLEAR: [2430, 2450],      // the trigger's diagram clears
  TITLE: [2446, 2468],
  C1: [2480, 2560],         // the route steps on: lead bay 2 -> 3
  C2: [2564, 2644],         //                            3 -> 4
  C3: [2648, 2728],         //                            4 -> 1
  // Stage 8: the honest close.
  RAIN: [2806, 2826],       // rain across the drawing again
  BARS: [2826, 2876],       // roof, indoors, and the dryer's aim (dashed)
  RAIN_OUT: [2884, 2900],
  // Full circle: the drawing becomes the building, in the village, in the
  // rain (views/problem.js draws it). It goes in the opening shot's order,
  // reversed: first the diagram simplifies into the building's plan, at the
  // building's own proportions; then that plan crosses into the same plan
  // drawn on the 3D ground, the scene still tinted to the paper; then the
  // paper lifts into the rainy village, and only then do the walls rise.
  PLAN: [2896, 2936],       // the diagram becomes a plan
  TO3D: [2936, 2966],       // the plan on paper -> the plan on the ground
  LIFT: [2966, 3002],       // the paper tint lifts; the rain comes back
  RISE: [2984, 3022],       // the Drying Cycle's walls rise from its plan
  ROOFS: [3016, 3044],      // its roofs settle on
  SKY: [3044, 3116],        // up and out over the village in the rain
  DOOR: [3142, 3162],       // down to a door, which opens
  TABLE: [3186, 3206],      // the kiln and the Drying Cycle, side by side
  ROWS: [3210, 3274],       // one row at a time
  TABLE_OUT: [3300, 3316],
  QS: [3320, 3336],         // the questions still open
  QROWS: [3338, 3396],
  QS_OUT: [3422, 3438],
  // The close: no return to the kiln. Up and out over the whole village as
  // the rain passes, and a question for the visitor to take away.
  AWAY: [3442, 3516],       // up from the door, out over the village (not OUT: Stage 6 has that)
  ASK: [3498, 3516],        // the question
  END: 3580,
};


/** What is said, [in from, in to, out from, out to], and its source. */
export const COPY6 = [
  { at: [1498, 1510, 1528, 1538], text: 'What if the kiln’s chambers held arecanut instead of tiles?' },
  { at: [1540, 1552, 1568, 1578], text: 'But the fire cannot pass through them: its heat is far too fierce, and its smoke must never touch the nuts.' },
  { at: [1580, 1592, 1620, 1630], text: 'So the fire moves outside. A separate heater burns husk and warms a clean stream of air; the smoke leaves by its own flue, and only warm air reaches the nuts.', srcs: [['A', 'Proposed: indirect heating, a design decision in the dryer proposal']] },
  { at: [1680, 1692, 1718, 1728], text: 'Unlike tiles, arecanut takes days to dry. Four bays are enough: three drying at different stages while the fourth is emptied and refilled.', srcs: [['A', 'Proposed: four bays, a design decision']] },
  { at: [1732, 1744, 1774, 1784], text: 'The ring straightens into a row, to fit a farm building. A duct runs from the last bay back to the first, so the air still has a way round.', srcs: [['A', 'Proposed: the row and the return duct, design decisions']] },
  { at: [1836, 1848, 1880, 1890], text: 'The heater stays in one place. If the air always took the same route, the bay nearest it would always get the warmest air, and the others would lag behind.', srcs: [['A', 'Proposed: a movable airflow route']] },
  { at: [1890, 1902, 1934, 1944], text: 'So dampers move the air’s route on, one bay at a time. The heater stays put; the path of the air changes.', srcs: [['A', 'Proposed: the damper sequence, a design decision']] },
  { at: [1994, 2006, 2074, 2084], text: 'The warmest, driest air meets the nearly dry nuts first. As it travels it cools and takes up water, reaching the wetter batches later: one stream of air does the work of several.', srcs: [['A', 'Proposed: counter-current airflow, driest nuts first']] },
  { at: [2138, 2150, 2212, 2222], text: 'When the lead batch is dry, its bay is shut off from the air, and the next bay becomes the lead.', srcs: [['A', 'Proposed: shutting off the dry bay and moving the lead on']] },
  { at: [2226, 2238, 2274, 2284], text: 'The dry batch is taken out by hand, and fresh nuts go in its place.', srcs: [['A', 'Proposed: unloading and reloading by hand']] },
  { at: [2286, 2298, 2322, 2332], text: 'The condition of the nuts decides when the system moves on: a grower tests the lead batch, as growers already do.', srcs: [['F', 'Observed: growers test their nuts for dryness by hand'], ['A', 'Proposed: using that test to move the airflow on']] },
  { at: [2382, 2394, 2418, 2430], text: 'How often to check, and how well the growers’ test works here, are still to be found out.', srcs: [['F', 'Observed: the growers’ test itself'], ['U', 'Not known: how reliable it is here, and how often to check']] },
  // Stage 7. Two phases in one scroll: the words light at the page's reading
  // pace (about 3vh a word, as the passages before it) and are read by the
  // middle of the first step (`readBy`), then stay up, whole, while the cycle
  // runs on at its own pace through C2 and C3. Read first, then watch.
  { at: [2464, 2476, 2726, 2738], readBy: T6.C1[0] + 52, text: 'A batch leaves; a fresh one takes its place. The dampers move on, and the cycle continues.', srcs: [['A', 'Proposed: batch replacement and the damper sequence']] },
  { at: [2744, 2758, 2790, 2804], text: 'The kiln’s logic and structure, reworked for a different material, a different process, and a different trigger.', big: true, finale: true },
  // Stage 8
  { at: [2810, 2822, 2884, 2896], text: 'Back to the rain that started this. On the roof, up to two weeks; indoors, a month or more. The Drying Cycle aims for the roof’s time, rain or shine: a claim to test, not a result.', srcs: [['F', 'Observed: the growers’ drying times, on the roof and indoors'], ['U', 'Not known: the dryer’s time is an aim, untested']] },
  { at: [2996, 3008, 3042, 3054], text: 'One way it could stand, beside the grower’s house: four bays under four tiled roofs. One heater burning husk feeds them all, through a channel along the front with a damper into each bay.', srcs: [['A', 'Illustrative: one way it could be built; the form is not designed']] },
  { at: [3062, 3074, 3108, 3120], text: 'The same rain, the same village. Every roof is bare; one batch keeps drying.', srcs: [['U', 'Not known: an aim, untested']] },
  { at: [3124, 3136, 3170, 3182], text: 'Steam rises from one chimney at a time, wherever the air’s route ends. When the lead batch is dry, its door opens and the grower takes it out.', srcs: [['A', 'Proposed: the route, the exhausts and the hand unloading']] },
  { at: [3190, 3202, 3288, 3300], text: 'Four things carried over from the kiln. Two changed: the heat source, and what starts a step.' },
  { at: [3324, 3336, 3410, 3422], text: 'This is a proposal. These are the questions it still has to answer.', srcs: [['U', 'Not known: each of these is open']] },
  { at: [3498, 3516, 1e9, 1e9], text: 'Do you have a problem a system like this could help solve?', big: true, ask: true },
  // After each paragraph that lights an idea in the tray, a card for that
  // idea: what the word means, and what it is here.
  { at: [1632, 1642, 1667, 1677], term: 'Pipeline', def: 'Several jobs in progress at once, each at a different stage.', here: 'the batches stay in their bays; warm air, not fire, moves round them.' },
  { at: [1786, 1796, 1821, 1831], term: 'Loop', def: 'When the last step is done, it starts again from the first, so it never has to stop.', here: 'the return duct takes the air from the last bay back to the first.' },
  { at: [1946, 1956, 1981, 1991], term: 'Algorithm', def: 'A fixed procedure: the same steps, in the same order, every time.', here: 'open the next dampers, then close the last.' },
  { at: [2086, 2096, 2121, 2131], term: 'Forwarding', def: 'Passing one stage’s result straight on to the next stage that can use it.', here: 'air leaving the driest nuts still has drying power, so it goes on to the wetter ones.' },
  { at: [2334, 2344, 2369, 2379], term: 'Trigger', def: 'The event that sets a procedure running.', here: 'in the kiln, a clock: every two hours. In the dryer, the nuts themselves, judged by a grower.' },
];


const INK = '#e4e0da';
const INK_DIM = '#9a958d';
const CHAMBER = '#4b4945';
const WALL = '#5c5955';
const PURPLE = '#B46AFF';
const AIR = '#a9cdd4';
const AIR_SPENT = '#a5a39b';
const RIPE = [0xe8, 0x86, 0x22];
// Dried: a mid brown, light enough to see on the bays' dark floor.
const DRY = [0x92, 0x5c, 0x30];
const BURNT = [0x1e, 0x19, 0x16];
const mix = (a, b, k) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], clamp01(k)))).join(',')})`;
const mixArr = (a, b, k) => a.map((v, i) => lerp(v, b[i], clamp01(k)));

const NPTS = 13;              // points along each chamber's centreline
// The nuts lie loose, a single layer spread over the whole floor (not
// stacked in rows like tiles): a jittered lattice, COLS along by ROWS across.
const COLS = 12; const ROWS = 4;
const DOTS = COLS * ROWS;     // nuts drawn per chamber
const jit = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x) - 0.5; };
const CARPET = Array.from({ length: DOTS }, (_, j) => {
  const col = j % COLS; const row = Math.floor(j / COLS);
  return {
    u: (col + 0.5 + (row % 2) * 0.45 + jit(j, 1) * 0.55) / (COLS + 0.45),
    v: ((row + 0.5) / ROWS - 0.5) * 0.86 + jit(j, 2) * 0.12,
    size: 0.85 + jit(j, 3) * 0.3,
    tilt: jit(j, 4) * 50,
  };
});

export function createTransform({ container, before, ring, run, terms }) {
  const svg = document.createElementNS(NS, 'svg');
  svg.classList.add('pb-transform');
  svg.setAttribute('aria-hidden', 'true');
  container.insertBefore(svg, before);
  const el = (parent, tag, attrs = {}, text) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    parent.append(e);
    return e;
  };

  // ---- the paper, with the ring's faint grid
  const defs = el(svg, 'defs');
  const grid = el(defs, 'pattern', { id: 'pb6-grid', width: 48, height: 48, patternUnits: 'userSpaceOnUse' });
  el(grid, 'path', { d: 'M48 0 H0 V48', fill: 'none', stroke: 'rgba(228,224,218,0.06)', 'stroke-width': 1 });
  const paper = el(svg, 'rect', { x: 0, y: 0, fill: PALETTE.paper });
  const gridRect = el(svg, 'rect', { x: 0, y: 0, fill: 'url(#pb6-grid)' });

  // Layers, back to front.
  const gDucts = el(svg, 'g');
  const gAir = el(svg, 'g');
  const gChambers = el(svg, 'g');
  const gNuts = el(svg, 'g');
  const gOutline = el(svg, 'g');
  const gDampers = el(svg, 'g');
  const gTrigger = el(svg, 'g');
  const gLabels = el(svg, 'g');

  // ---- chambers (8) and their nuts
  const count = run.count;
  const chambers = Array.from({ length: count }, () => ({
    path: el(gChambers, 'path', { fill: 'none', 'stroke-linecap': 'butt', 'stroke-linejoin': 'round' }),
    fire: el(gChambers, 'path', { fill: 'none', 'stroke-linecap': 'butt', 'stroke-linejoin': 'round', opacity: 0 }),
    dots: Array.from({ length: DOTS }, () => el(gNuts, 'ellipse', {})),
    pts: [],
  }));
  // The join, last chamber to first: lit, then lifted into the return duct.
  const join = el(gDucts, 'path', { fill: 'none', stroke: PURPLE, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0 });

  // ---- the row's parts (drawn in gDucts, gOutline, gDampers)
  const bayOutlines = Array.from({ length: 4 }, () => el(gOutline, 'rect', { fill: 'none', stroke: INK, 'stroke-width': 1.5, rx: 10 }));
  const bayLabels = Array.from({ length: 4 }, (_, b) => el(gLabels, 'text', { class: 'pb6-label is-mid' }, `bay ${b + 1}`));
  const roleLabels = Array.from({ length: 4 }, () => el(gLabels, 'text', { class: 'pb6-role is-mid' }));
  const heater = {
    g: el(gDucts, 'g'),
  };
  heater.box = el(heater.g, 'rect', { fill: '#2a2826', stroke: INK, 'stroke-width': 1.5, rx: 6 });
  heater.flame = el(heater.g, 'path', { fill: heatHex(0.85), stroke: heatHex(1), 'stroke-width': 1.5 });
  // The heater's own flue: a short chimney, so its smoke never meets the nuts.
  heater.flue = el(heater.g, 'rect', { fill: '#3a3835', stroke: INK_DIM, 'stroke-width': 1.2, rx: 1.5 });
  heater.smoke = Array.from({ length: 4 }, () => el(heater.g, 'circle', { fill: INK_DIM }));
  heater.flueLabel = el(heater.g, 'text', { class: 'pb6-label' }, 'flue');
  heater.label = el(gLabels, 'text', { class: 'pb6-label is-mid' }, 'heater, burning husk');
  // The fire on its way out of the kiln to the heater.
  const fireDot = el(gNuts, 'circle', { r: 9, fill: heatHex(1), opacity: 0 });

  const ductStyle = { fill: 'none', stroke: WALL, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  const supply = el(gDucts, 'path', ductStyle);
  const stubs = Array.from({ length: 4 }, () => el(gDucts, 'path', ductStyle));
  const passages = Array.from({ length: 3 }, () => el(gDucts, 'path', ductStyle));
  const exhausts = Array.from({ length: 4 }, () => el(gDucts, 'path', ductStyle));
  const returnDuct = el(gDucts, 'path', ductStyle);

  // Dampers: S1-4, P12 P23 P34, R41, X1-4. A disc with a bar: the bar along
  // the duct when open, across it when shut.
  const damper = (name) => {
    const g = el(gDampers, 'g');
    const disc = el(g, 'circle', { r: 8, fill: PALETTE.paper, stroke: INK_DIM, 'stroke-width': 1.5 });
    const bar = el(g, 'line', { x1: -6, y1: 0, x2: 6, y2: 0, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' });
    return { name, g, disc, bar, x: 0, y: 0, along: 0 };
  };
  const S = Array.from({ length: 4 }, (_, i) => damper(`S${i + 1}`));
  const Pd = Array.from({ length: 3 }, (_, i) => damper(`P${i + 1}${i + 2}`));
  const R41 = damper('R41');
  const X = Array.from({ length: 4 }, (_, i) => damper(`X${i + 1}`));
  const dampersLabel = el(gLabels, 'text', { class: 'pb6-label' }, 'dampers');

  // The air's route: three legs, one per bay it crosses, coloured from fresh
  // to spent; dashes that flow on their own clock.
  const airLegs = Array.from({ length: 3 }, () => el(gAir, 'path', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': '10 12' }));
  const airIn = el(gLabels, 'text', { class: 'pb6-air' }, 'warm, dry air');
  const airOut = el(gLabels, 'text', { class: 'pb6-air' }, 'out: cool and damp');

  // ---- the trigger, as the Trigger card drew it
  const clock = el(gTrigger, 'g');
  const clockRing = el(clock, 'circle', { r: 22, fill: 'none', stroke: INK_DIM, 'stroke-width': 2 });
  const clockSweep = el(clock, 'circle', { r: 22, fill: 'none', stroke: PURPLE, 'stroke-width': 3, 'stroke-linecap': 'round', transform: 'rotate(-90)' });
  el(clock, 'text', { class: 'pb6-box is-mid', y: 5 }, '2 h');
  const clockWire = el(gTrigger, 'path', { fill: 'none', stroke: INK_DIM, 'stroke-width': 2 });
  const tBox = el(gTrigger, 'rect', { fill: '#332f2b', stroke: INK, 'stroke-width': 1.5, rx: 10 });
  const tBoxText = el(gTrigger, 'text', { class: 'pb6-box is-mid' }, 'move the dampers');
  const socket = el(gTrigger, 'path', { fill: 'none', stroke: INK_DIM, 'stroke-width': 2, 'stroke-dasharray': '5 5' });
  const socketEnd = el(gTrigger, 'circle', { r: 6, fill: 'none', stroke: INK_DIM, 'stroke-width': 2 });
  const socketLabel = el(gTrigger, 'text', { class: 'pb6-label' }, 'what decides when?');
  const plug = el(gTrigger, 'path', { fill: 'none', stroke: PURPLE, 'stroke-width': 3, 'stroke-linecap': 'round' });
  const plugLabel = el(gTrigger, 'text', { class: 'pb6-plug' }, 'a grower’s judgement');
  // What the new trigger rests on, sorted by how it is known.
  const plugF = chipRow(gTrigger, 'F', 'observed: the growers already test their nuts this way');
  const plugA = chipRow(gTrigger, 'A', 'proposed: move the dampers when the lead batch passes');
  const plugU = chipRow(gTrigger, 'U', 'how often to check: not known yet');

  /** Where the grower stands: from a bay's left edge, and below the row. */
  const GROWER_X = 46; const GROWER_Y = 84;

  /** The bay chamber i ends up in (0 = bay 1, at the left). */
  const bayOf = (i) => 3 - Math.floor(i / 2);

  /**
   * The site's evidence codes (config EVIDENCE), drawn on the diagram beside
   * what they qualify, with the word spelled out: F observed (filled), A
   * proposed (outlined), U not known (dashed), as the dashboard's legend
   * draws them. Observations, proposals and estimates never share a chip.
   */
  function chipRow(parent, code, words) {
    const g = el(parent, 'g');
    const filled = code === 'F';
    el(g, 'rect', {
      x: 0, y: -10, width: 18, height: 16, rx: 3,
      fill: filled ? INK : 'none', stroke: filled ? 'none' : INK_DIM, 'stroke-width': 1.2,
      'stroke-dasharray': code === 'U' ? '3 2' : 'none',
    });
    el(g, 'text', { x: 9, y: 2.5, class: filled ? 'pb6-chip is-mid is-filled' : 'pb6-chip is-mid' }, code);
    el(g, 'text', { x: 26, y: 2.5, class: 'pb6-label' }, words);
    return g;
  }

  // ---- Stage 7: the name, the batch letters, the person at the open bay
  const gName = el(svg, 'g');
  // The dryer's name.
  const title = el(gName, 'text', { class: 'pb7-title is-mid' }, 'The Drying Cycle');
  const stepText = el(gName, 'text', { class: 'pb7-step is-mid' });
  /**
   * Each bay's tag, in its top-left corner: the batch's letter, its role
   * and a word on how dry it is. The lead is picked out in purple (the
   * batch tested, the air's first stop); middle and tail are coloured like
   * the nuts they hold; the bay out for refilling is plain grey. The letter
   * stays with the bay; the role changes in place as the route steps on.
   */
  const ROLE = [
    { word: 'LEAD', desc: 'nearly dry', fill: PURPLE, stroke: PURPLE, ink: '#1d1030' },
    // Only the lead is a filled pill; the rest are quiet outlines in the
    // colour of their nuts, so the eye goes to the batch being tested.
    { word: 'MIDDLE', desc: 'half dry', fill: '#2c241d', stroke: '#b07a45', ink: '#f0e6d8' },
    { word: 'TAIL', desc: 'just in', fill: '#2c241c', stroke: '#e88622', ink: '#f6e3c8' },
    { word: 'OUT', desc: 'refilling', fill: PALETTE.paper, stroke: INK_DIM, ink: INK_DIM },
  ];
  const tags = Array.from({ length: 4 }, () => {
    const g = el(gLabels, 'g');
    const pill = el(g, 'rect', { x: 0, y: 0, height: 26, rx: 13, 'stroke-width': 1.5 });
    const chip = el(g, 'rect', { x: 5, y: 4, width: 18, height: 18, rx: 4, fill: PALETTE.paper });
    const t = el(g, 'text', { class: 'pb7-tag is-mid', x: 14, y: 17.5 });
    const role = el(g, 'text', { class: 'pb7-role', x: 30, y: 17.5 });
    const desc = el(g, 'text', { class: 'pb7-desc', y: 17.5 });
    return { g, pill, chip, t, role, desc, key: '' };
  });
  const tagsLabel = el(gLabels, 'text', { class: 'pb6-label' }, 'batches: each stays in its bay');
  const person = el(gLabels, 'g');
  el(person, 'circle', { cx: 0, cy: -30, r: 6, fill: INK });
  el(person, 'path', { d: 'M0 -23 V-6 M0 -6 L-6 8 M0 -6 L6 8 M0 -18 L10 -12', fill: 'none', stroke: INK, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  const basket = el(person, 'path', { d: 'M8 -16 h14 l-2 10 h-10 z', stroke: INK, 'stroke-width': 1.5 });
  // The nut being tested, held up.
  const heldNut = el(person, 'ellipse', { cx: 13, cy: -16, rx: 3.6, ry: 4.4, fill: mix(DRY, DRY, 0), stroke: INK, 'stroke-width': 1 });
  // The two heaps beside the grower: dry nuts out, fresh nuts in.
  const HEAP = 14;
  const heaps = { g: el(gLabels, 'g') };
  const heapDot = (k, x0) => {
    const row = k < 6 ? 0 : k < 11 ? 1 : 2; const inRow = row === 0 ? k : row === 1 ? k - 6 : k - 11;
    const n = row === 0 ? 6 : row === 1 ? 5 : 3;
    return { cx: x0 + (inRow - (n - 1) / 2) * 7, cy: -row * 6 };
  };
  heaps.dry = Array.from({ length: HEAP }, (_, k) => { const p = heapDot(k, -30); return el(heaps.g, 'ellipse', { cx: p.cx, cy: p.cy, rx: 3.4, ry: 4, fill: mix(DRY, DRY, 0) }); });
  heaps.fresh = Array.from({ length: HEAP }, (_, k) => { const p = heapDot(k, 34); return el(heaps.g, 'ellipse', { cx: p.cx, cy: p.cy, rx: 3.4, ry: 4, fill: mix(RIPE, RIPE, 0) }); });
  heaps.dryLabel = el(heaps.g, 'text', { class: 'pb6-label is-mid', x: -30, y: 18 }, 'dry, out');
  heaps.freshLabel = el(heaps.g, 'text', { class: 'pb6-label is-mid', x: 34, y: 18 }, 'fresh, in');
  const personLabel = el(gLabels, 'text', { class: 'pb6-role' });
  const personLabel2 = el(gLabels, 'text', { class: 'pb6-label' });
  const tick = el(gLabels, 'g');
  el(tick, 'circle', { r: 10, fill: PURPLE });
  el(tick, 'path', { d: 'M-4.5 0.5 L-1.2 3.8 L4.8 -3.2', fill: 'none', stroke: '#1d1030', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  const personChip = chipRow(gLabels, 'F', 'the growers’ own test');

  /**
   * The route's steps. Change n moves the lead from bay n+1 to the next;
   * change 0 is Stage 6's switch, 1-3 are Stage 7's. Within a change: the
   * new dampers open over its first part (make), the old shut over its last
   * (break), and the bay that was lead is emptied and refilled between.
   */
  const CHANGES = [T6.SWITCH, T6.C1, T6.C2, T6.C3];
  function stepState(s) {
    let n = 0;
    for (let k = 0; k < CHANGES.length; k++) if (s >= CHANGES[k][0]) n = k;
    const [a0, a1] = CHANGES[n];
    const t = clamp01((s - a0) / (a1 - a0));
    return { n, from: n % 4, to: (n + 1) % 4, t, range: CHANGES[n] };
  }
  // How dry each role's batch is: lead, middle, tail, out (just refilled).
  const ROLE_DRY = [0.85, 0.55, 0.25, 0];
  const roleOf = (bay, lead) => (bay - lead + 4) % 4;

  // ---- Stage 8: rain, the bars, the side-by-side, the open questions.
  // Drawn after (over) everything else; the dim sheet steps the diagram
  // back while a panel is up.
  const gRain = el(svg, 'g');
  const drops = Array.from({ length: 150 }, (_, k) => ({
    line: el(gRain, 'line', { stroke: 'rgba(205,214,218,0.42)', 'stroke-width': 1.3, 'stroke-linecap': 'round' }),
    x: (Math.sin(k * 91.7) * 0.5 + 0.5), y: (Math.sin(k * 37.3) * 0.5 + 0.5), v: 0.7 + (Math.sin(k * 13.1) * 0.5 + 0.5) * 0.6,
  }));
  const dim = el(svg, 'rect', { x: 0, y: 0, fill: PALETTE.paper, opacity: 0 });
  const panelBg = (g) => el(g, 'rect', { fill: 'rgba(29,25,21,0.78)', stroke: 'rgba(255,255,255,0.08)', 'stroke-width': 1, rx: 16 });

  // The bars: days to dry a batch.
  const gBars = el(svg, 'g');
  const barsBg = panelBg(gBars);
  const barsTitle = el(gBars, 'text', { class: 'pb8-head' }, 'Days to dry a batch');
  const BAR_ROWS = [
    { label: 'On the roof', from: 0, to: 14, note: 'up to 14 days', code: 'F', word: 'observed' },
    { label: 'Indoors, in rain', from: 0, to: 30, range: 45, note: '30–45 days', code: 'F', word: 'observed' },
    { label: 'The Drying Cycle', from: 0, to: 14, aim: true, note: 'aim: about the roof’s time, in any weather', code: 'U', word: 'not known: an aim, untested' },
  ];
  const bars = BAR_ROWS.map((r) => {
    const g = el(gBars, 'g');
    return {
      ...r, g,
      label: el(g, 'text', { class: 'pb6-role' }, r.label),
      track: el(g, 'rect', { height: 10, rx: 5, fill: 'rgba(228,224,218,0.08)' }),
      fill: el(g, 'rect', { height: 10, rx: 5, fill: r.aim ? 'none' : INK, stroke: r.aim ? INK : 'none', 'stroke-width': r.aim ? 1.6 : 0, 'stroke-dasharray': r.aim ? '5 4' : 'none' }),
      rangeFill: r.range ? el(g, 'rect', { height: 10, fill: INK, opacity: 0.35 }) : null,
      note: el(g, 'text', { class: r.aim ? 'pb6-plug' : 'pb6-label' }, r.note),
      chip: chipRow(g, r.code, r.word),
    };
  });

  // The kiln and the Drying Cycle, side by side.
  const gTable = el(svg, 'g');
  const tableBg = panelBg(gTable);
  const tHeads = [el(gTable, 'text', { class: 'pb8-head' }, 'The kiln'), el(gTable, 'text', { class: 'pb8-head' }, 'The Drying Cycle')];
  // [question, kiln, dryer, term index in the tray (-1: none), changed?]
  const ROWS8 = [
    ['Heat source', 'a moving fire, inside the chambers', 'one fixed heater, outside, burning husk', -1, true],
    ['What moves', 'the fire, chamber to chamber', 'the air’s route, bay to bay', 0],
    ['What stays put', 'the tiles', 'the nuts', 2],
    ['What is handed on', 'heat, to the tiles ahead', 'drying power, to the wetter nuts', 3],
    ['What closes the loop', 'the ring of chambers', 'a duct from the last bay to the first', 1],
    ['What starts a step', 'a clock: every two hours', 'a grower’s test of the lead batch', 4, true],
  ];
  const rows8 = ROWS8.map(([q, k, d, term, changed]) => {
    const g = el(gTable, 'g');
    return {
      g, term, changed,
      rule: el(g, 'line', { stroke: 'rgba(228,224,218,0.12)', 'stroke-width': 1 }),
      q: el(g, 'text', { class: 'pb6-label' }, q),
      k: el(g, 'text', { class: 'pb8-cell' }, k),
      d: el(g, 'text', { class: changed ? 'pb8-cell is-changed' : 'pb8-cell' }, d),
      tag: el(g, 'text', { class: changed ? 'pb8-tag is-changed' : 'pb8-tag' }, changed ? 'changed' : 'kept'),
    };
  });
  // The changed row's evidence: the clock observed; the test observed; acting on it proposed.
  const tChips = [chipRow(gTable, 'F', 'observed'), chipRow(gTable, 'F', 'observed: the test'), chipRow(gTable, 'A', 'proposed: acting on it')];

  // The questions still open.
  const gQs = el(svg, 'g');
  const qsBg = panelBg(gQs);
  const qsTitle = el(gQs, 'text', { class: 'pb8-head' }, 'Not known yet');
  const qsChip = chipRow(gQs, 'U', 'each of these is open');
  const QS = [
    'Does it beat drying indoors in the rain, and by how many days?',
    'How often must the lead batch be checked, and how long is a step?',
    'After three bays, is the air still dry enough to dry the last batch?',
    'How much husk does it burn for each batch?',
    'Who would run it? Would neighbours share one dryer?',
  ];
  const qs = QS.map((t) => {
    const g = el(gQs, 'g');
    el(g, 'rect', { x: 0, y: -11, width: 16, height: 16, rx: 3, fill: 'none', stroke: INK_DIM, 'stroke-width': 1.2, 'stroke-dasharray': '3 2' });
    el(g, 'text', { x: 26, y: 2, class: 'pb8-cell' }, t);
    return g;
  });
  const qsShare = chipRow(gQs, 'F', 'observed: growers already share drying space with neighbours');

  // ------------------------------------------------------------------ layout
  const v3 = ring.chamberPoint(0).clone();
  let L = null; let lastKey = '';
  /** Ring world (x, z) to the pin's pixels, through the live drawing's camera. */
  function proj(x, z, w, h) {
    v3.set(x, 0, z).project(ring.camera);
    return [(v3.x * 0.5 + 0.5) * w, (-v3.y * 0.5 + 0.5) * h];
  }
  function layout(w, h) {
    const key = `${w}x${h}x${ring.camera.zoom.toFixed(4)}`;
    if (key === lastKey) return L;
    lastKey = key;
    const path = ring.path;
    const halfBand = (ring.kilnShare() * Math.abs(ring.camera.right) - (path.bounds.maxX - path.bounds.minX) / 2);
    // The chambers on the ring, in pixels.
    const g = 0.012;
    const loop = [];
    let band = 0;
    let minX = 1e9; let maxX = -1e9; let minY = 1e9; let maxY = -1e9;
    for (let i = 0; i < count; i++) {
      const pts = [];
      for (let k = 0; k < NPTS; k++) {
        const t = i / count + g + (1 / count - 2 * g) * (k / (NPTS - 1));
        const p = path.at(((t % 1) + 1) % 1);
        const q = proj(p.x, p.z, w, h);
        pts.push(q);
        minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]);
        if (i === 0 && k === 6) {
          const o = proj(p.x + p.nx * halfBand, p.z + p.nz * halfBand, w, h);
          band = 2 * Math.hypot(o[0] - q[0], o[1] - q[1]);
        }
      }
      loop.push(pts);
    }
    const joinPts = [];
    for (let k = 0; k < 24; k++) {
      const t = -g * 1.2 + (2.4 * g) * (k / 23);
      const p = path.at(((t % 1) + 1) % 1);
      joinPts.push(proj(p.x, p.z, w, h));
    }

    // The row.
    // The drawing stays centred on the screen. The five ideas stand in a
    // column at the right (problem.js, .pb-tray), so the row is kept narrow
    // enough to clear them: the same margin both sides, as wide as the
    // column. On narrow screens the ideas are a row across the top instead.
    const trayRoom = w > 720 ? Math.min(250, w * 0.18) : 0;
    const midX = w / 2;
    const rowW = Math.min(w * 0.7, 1040, w - 2 * (trayRoom + 24));
    const gap = rowW * 0.04;
    const bayL = (rowW - 3 * gap) / 4;
    const D = Math.max(58, Math.min(bayL * 0.6, h * 0.2));
    const x0 = midX - rowW / 2;
    // A little above the middle: the grower and the labels under the row
    // must clear the words, which sit at the bottom left.
    const cy = h * 0.44;
    const top = cy - D / 2; const bottom = cy + D / 2;
    const bays = Array.from({ length: 4 }, (_, b) => {
      const a = x0 + b * (bayL + gap);
      return { x0: a, x1: a + bayL, cx: a + bayL / 2 };
    });
    // Two chambers to a bay, paired in the direction the ring already runs
    // (it runs right to left along its top, the side it unrolls from), so
    // the chain lays flat without turning over: chambers 8 and 7 make bay 1,
    // at the left, and 2 and 1 make bay 4. The bays are the dryer's own
    // numbering, not the kiln's.
    const rowPts = Array.from({ length: count }, (_, i) => {
      const b = bays[bayOf(i)]; const half = 1 - (i % 2);
      const a = b.x0 + half * bayL / 2 - (half ? 1 : 0); const z = b.x0 + (half + 1) * bayL / 2 + (half ? 0 : 1);
      // Points run right to left, the way the chain runs (see unroll): laid
      // out the other way, the chain could never quite arrive, and snapped
      // into place on the last frame.
      return Array.from({ length: NPTS }, (_, k) => [lerp(z, a, k / (NPTS - 1)), cy]);
    });
    // The return: up out of bay 4's headspace, over the row, down into bay 1's plenum.
    const over = top - D * 0.72;
    const leftX = x0 - gap * 1.6;
    const ret = [
      [bays[3].cx + bayL * 0.25, top], [bays[3].cx + bayL * 0.25, over],
      [leftX, over], [leftX, bottom - D * 0.14], [bays[0].x0 + bayL * 0.12, bottom - D * 0.14],
    ];
    const retPts = resample(ret, 24);
    // The join runs from chamber 8's end (now bay 1, left) to chamber 1's
    // start (bay 4, right): the return, walked the other way.
    const retJoin = retPts.slice().reverse();
    // Supply: the heater's duct under the row, a stub up into each plenum.
    const ys = bottom + D * 0.42;
    const heaterAt = [x0 - gap * 1.6 - bayL * 0.32, ys];
    const supplyD = `M${heaterAt[0] + bayL * 0.18} ${ys} H${bays[3].cx - bayL * 0.2}`;
    const stubX = bays.map((b) => b.cx - bayL * 0.2);
    // Passages: up out of bay b's headspace, over the partition, down into
    // bay b+1's plenum.
    const pass = [0, 1, 2].map((b) => {
      const gx = bays[b].x1 + gap / 2;
      return [[bays[b].x1 - bayL * 0.1, top], [bays[b].x1 - bayL * 0.1, top - D * 0.2], [gx, top - D * 0.2], [gx, bottom + D * 0.2], [bays[b + 1].x0 + bayL * 0.1, bottom + D * 0.2], [bays[b + 1].x0 + bayL * 0.1, bottom]];
    });
    const exhaustX = bays.map((b) => b.cx + bayL * 0.05);
    const exTop = top - D * 0.48;

    // The ring's left end, for the heater before the row exists.
    const ringHeater = [minX - Math.max(80, band * 2.4), (minY + maxY) / 2 - band * 0.4];
    L = {
      w, h, midX, loop, band, joinPts, bays, bayL, D, gap, x0, cy, top, bottom, rowPts, retPts, retJoin, ret,
      ys, heaterAt, ringHeater, supplyD, stubX, pass, exhaustX, exTop, over, leftX,
      ringBox: { minX, maxX, minY, maxY },
    };
    return L;
  }

  /** Resample a polyline to n points evenly along its length. */
  function resample(pts, n) {
    const segs = []; let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      segs.push(d); total += d;
    }
    const out = [];
    for (let k = 0; k < n; k++) {
      let target = total * k / (n - 1); let i = 0;
      while (i < segs.length - 1 && target > segs[i]) { target -= segs[i]; i++; }
      const f = segs[i] ? target / segs[i] : 0;
      out.push([lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)]);
    }
    return out;
  }
  /**
   * The ring, opened at its join and straightened like a chain: every step
   * along it keeps its place in the chain, its direction turning from the
   * ring's towards the row's, its length from the ring's towards the row's,
   * built outwards from the chain's middle (opposite the join), which itself
   * moves to the row's middle. No chamber crosses another on the way, and
   * at 0 and 1 it is exactly the ring and exactly the row.
   */
  function unroll(lay, k) {
    if (k <= 0) return lay.loop;
    if (k >= 1) return lay.rowPts;
    const A = lay.loop.flat(); const Bp = lay.rowPts.flat();
    const n = A.length; const mid = n / 2;
    // Direction of each step on the ring, unwrapped so it turns smoothly.
    const ang = []; const lenA = []; const lenB = [];
    let prev = null;
    for (let j = 0; j < n - 1; j++) {
      let a = Math.atan2(A[j + 1][1] - A[j][1], A[j + 1][0] - A[j][0]);
      if (prev !== null) { while (a - prev > Math.PI) a -= 2 * Math.PI; while (a - prev < -Math.PI) a += 2 * Math.PI; }
      ang.push(a); prev = a;
      lenA.push(Math.hypot(A[j + 1][0] - A[j][0], A[j + 1][1] - A[j][1]));
      lenB.push(Math.hypot(Bp[j + 1][0] - Bp[j][0], Bp[j + 1][1] - Bp[j][1]));
    }
    // The middle step turns to point along the row (increasing chamber runs
    // to the left, -x), by the short way;
    // every other step keeps its turn relative to it, shrinking to none.
    const m = Math.floor(mid);
    let toRow = Math.PI - ang[m];
    while (toRow > Math.PI) toRow -= 2 * Math.PI; while (toRow < -Math.PI) toRow += 2 * Math.PI;
    const dir = (j) => ang[m] + toRow * k + (ang[j] - ang[m]) * (1 - k);
    const out = new Array(n);
    out[m] = [lerp(A[m][0], Bp[m][0], k), lerp(A[m][1], Bp[m][1], k)];
    for (let j = m; j < n - 1; j++) {
      const l = lerp(lenA[j], lenB[j], k); const a = dir(j);
      out[j + 1] = [out[j][0] + Math.cos(a) * l, out[j][1] + Math.sin(a) * l];
    }
    for (let j = m - 1; j >= 0; j--) {
      const l = lerp(lenA[j], lenB[j], k); const a = dir(j);
      out[j] = [out[j + 1][0] - Math.cos(a) * l, out[j + 1][1] - Math.sin(a) * l];
    }
    const res = [];
    for (let i = 0; i < count; i++) res.push(out.slice(i * NPTS, (i + 1) * NPTS));
    return res;
  }
  const d = (pts) => 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L');
  const blend = (A, Bp, k) => A.map((p, i) => [lerp(p[0], Bp[i][0], k), lerp(p[1], Bp[i][1], k)]);

  /** The route for a step whose lead is bay `lead` (0-3), as three legs. */
  function route(lay, lead) {
    const { bays, bayL, top, bottom, ys, heaterAt, pass, retPts, exhaustX, exTop } = lay;
    const legs = [];
    let enter = [[heaterAt[0] + bayL * 0.18, ys], [lay.stubX[lead], ys], [lay.stubX[lead], bottom]];
    for (let k = 0; k < 3; k++) {
      const b = (lead + k) % 4;
      const leg = enter.slice();
      if (k < 2) {
        // Up through the nuts and on, by passage or (from bay 4) the return.
        const conn = b === 3 ? retPts : pass[b];
        leg.push([conn[0][0], bottom - 4], ...conn);
        legs.push(leg);
        enter = [conn[conn.length - 1]];
      } else {
        leg.push([exhaustX[b], bottom - 4], [exhaustX[b], top], [exhaustX[b], exTop - 26]);
        legs.push(leg);
      }
      void bays;
    }
    return legs;
  }
  /** Which dampers a step has open: S(lead), the two connections, X(lead+2). */
  const openSet = (lead) => {
    const conn = (b) => (b === 3 ? R41 : Pd[b]);
    return new Set([S[lead], conn(lead), conn((lead + 1) % 4), X[(lead + 2) % 4]]);
  };
  const allDampers = [...S, ...Pd, R41, ...X];

  // ------------------------------------------------------------------ frame
  const frameEnd = () => run.at(run.totalHours - 1e-6);
  let clockT = 0; let lastNow = performance.now();

  function update(s, w, h, beside = () => null) {
    const now = performance.now(); clockT += Math.min(0.1, (now - lastNow) / 1000); lastNow = now;
    const on = s > T6.IN[0] - 1;
    // display, not visibility: a group set visible on a later frame would show
    // through a hidden parent if the scroll jumped back past this in one step.
    svg.style.display = on ? '' : 'none';
    svg.style.visibility = on ? 'visible' : 'hidden';
    terms.forEach((t) => t.classList.remove('is-lit', 'is-now'));
    if (!on) { terms[4].textContent = 'Trigger'; return; }
    const lay = layout(w, h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    for (const r of [paper, gridRect]) { r.setAttribute('width', w); r.setAttribute('height', h); }
    // In over the live drawing; out again at the very end, to the kiln.
    svg.style.opacity = (smooth(T6.IN[0], T6.IN[1], s) * (1 - smooth(T6.AWAY[0], T6.AWAY[0] + 20, s))).toFixed(3);

    const nuts = smooth(T6.NUTS[0], T6.NUTS[1], s);
    const morph = smooth(T6.MORPH[0], T6.MORPH[1], s);
    const ducts = smooth(T6.DUCTS[0], T6.DUCTS[1], s);
    const r1 = smooth(T6.ROUTE1[0], T6.ROUTE1[1], s);
    const fwd = smooth(T6.FWD[0], T6.FWD[1], s);
    const out = smooth(T6.OUT[0], T6.OUT[1], s);

    // ---- a. the load, and the fire
    const frame = frameEnd();
    const fire0 = frame.firePos;
    // The fire comes round from where the lap left it: three chambers on.
    const fireAdv = 3 * smooth(T6.FIRE[0], T6.FIRE[1], s);
    const fireAt = (fire0 + Math.floor(fireAdv)) % count;
    const fireOn = bump(T6.FIRE[0] - 4, T6.FIRE[0] + 4, T6.OUT[0], T6.OUT[0] + 10, s);
    const bandW = lerp(lay.band * 0.82, lay.D, morph);

    // Where the route is in its steps (see stepState).
    const st = stepState(s);
    // A step, in order: a grower tests a nut from the lead batch (CHECK);
    // it passes, so the next dampers open (MAKE) and the old ones shut
    // (BREAK), cutting the old lead's bay off; then that bay is emptied
    // (UNLOAD) and refilled (LOAD), nut by nut, by hand.
    // The first step is told slowly across two passages: the lead dry and
    // the bay shut off (to ~0.58), then the emptying and refilling.
    const PH = st.n === 0
      ? { CHECK: [0, 0.12], MAKE: [0.14, 0.32], BREAK: [0.34, 0.54], UNLOAD: [0.6, 0.78], LOAD: [0.8, 0.98] }
      : { CHECK: [0, 0.14], MAKE: [0.14, 0.24], BREAK: [0.24, 0.34], UNLOAD: [0.36, 0.66], LOAD: [0.68, 0.96] };
    const ph = (k) => smooth(PH[k][0], PH[k][1], st.t);
    const swMake = ph('MAKE');
    const swBreak = ph('BREAK');
    const leadNow = st.t > PH.MAKE[1] ? st.to : st.from;
    const unloadK = st.t >= PH.UNLOAD[0] ? clamp01((st.t - PH.UNLOAD[0]) / (PH.UNLOAD[1] - PH.UNLOAD[0])) : 0;
    const loadK = st.t >= PH.LOAD[0] ? clamp01((st.t - PH.LOAD[0]) / (PH.LOAD[1] - PH.LOAD[0])) : 0;
    const refillK = bump(PH.UNLOAD[0], PH.UNLOAD[0] + 0.06, PH.LOAD[0], PH.LOAD[0] + 0.06, st.t);
    // Emptying and refilling go in TRIPS basket-loads. In each trip the
    // grower walks to the bay (0-0.35), fills or empties the basket there
    // (0.35-0.55: this is when nuts leave or arrive), and walks back to the
    // heap (0.55-0.9), tipping it out at the end.
    const TRIPS = 5;
    const trip = (k) => { const x = k * TRIPS; const j = Math.min(TRIPS - 1, Math.floor(x)); return { j, f: k >= 1 ? 1 : x - j }; };
    const uT = trip(unloadK); const lT = trip(loadK);
    // One at a time, steadily, from the door side.
    const unloadEff = unloadK;
    const loadEff = loadK;
    void uT; void lT;
    // While a bay is emptied and refilled, the rest of the dryer steps back.
    const inCh = s >= st.range[0] - 4 && s <= st.range[1] + 4;
    const focus = r1 * (inCh ? bump(PH.UNLOAD[0] - 0.05, PH.UNLOAD[0], PH.LOAD[1], PH.LOAD[1] + 0.04, st.t) : 0);

    const unrolled = unroll(lay, morph);
    chambers.forEach((c, i) => {
      const pts = unrolled[i];
      c.pts = pts;
      c.path.setAttribute('d', d(pts));
      c.path.setAttribute('stroke-width', bandW.toFixed(1));
      // Tiles at their heat until the nuts go in; then the ring's grey.
      const ch = frame.chambers[i];
      const tileCol = ch.loaded ? heatHex(relativeHeat(ch.temp)) : CHAMBER;
      c.path.setAttribute('stroke', nuts < 1 ? tileCol : CHAMBER);
      c.path.setAttribute('stroke-opacity', '1');
      const keep = bayOf(i) === st.from || bayOf(i) === leadNow;
      c.path.style.opacity = (keep ? 1 : 1 - 0.55 * focus).toFixed(3);
      if (nuts > 0 && nuts < 1) {
        // cross from tile colour to grey through opacity of a second pass
        c.path.setAttribute('stroke', mix(hexArr(tileCol), hexArr(CHAMBER), nuts));
      }
      // The fire, on the chamber it has reached.
      const lit = fireOn * (i === fireAt ? 1 : 0);
      c.fire.setAttribute('d', d(pts));
      c.fire.setAttribute('stroke-width', (bandW * 0.92).toFixed(1));
      c.fire.setAttribute('stroke', heatHex(1));
      c.fire.setAttribute('opacity', (lit * 0.9).toFixed(3));

      // The nuts: along the centreline, two rows.
      const bay = bayOf(i);
      let dry = lerp(ROLE_DRY[roleOf(bay, st.from)], ROLE_DRY[roleOf(bay, st.to)], st.t);
      // The bay that was lead is emptied and refilled mid-change: its nuts
      // stay dry until they go, and come back ripe.
      const goingOut = bay === st.from;
      if (goingOut) dry = ROLE_DRY[0];
      dry *= r1;
      const refill = 0;
      // Burnt: chambers the fire reached while the nuts were in.
      const reached = fireOn > 0.2 && ((i - fire0 + count) % count) <= Math.floor(fireAdv) && fireAdv > 0.05;
      const burnt = reached ? smooth(0, 0.6, fireAdv - ((i - fire0 + count) % count)) * (1 - out) : 0;
      const fill = mix(mixArr(RIPE, DRY, dry), BURNT, burnt);
      const vis = nuts * (1 - refill);
      // The size a nut can be here: the floor's length and width shared out.
      const lenPx = wireLength(pts);
      const r0 = Math.max(1.8, Math.min(lenPx / COLS, bandW * 0.86 / ROWS) * 0.4);
      // Which half of its bay this chamber is (the door side, left, first).
      const doorHalf = i % 2 === 1 ? 0 : 0.5;
      c.dots.forEach((dot, j) => {
        const q = CARPET[j];
        const [x, y, nx, ny] = along(pts, q.u);
        const off = q.v * bandW;
        // Loading the kiln: chamber by chamber round it, nut by nut.
        const key = (i * DOTS + j) / (count * DOTS);
        let k = clamp01((nuts - key * 0.94) / 0.06);
        let f = fill;
        if (goingOut && r1 > 0) {
          // Emptying and refilling the bay, nut by nut from the door side.
          // u runs right to left along a chamber; the door is on the left.
          const order = doorHalf + (1 - q.u) * 0.5;
          if (unloadEff > order) k = 0;
          if (loadEff > order) { k = 1; f = mix(RIPE, RIPE, 0); }
          else if (unloadEff > order) k = 0;
        }
        const r = r0 * q.size * (0.4 + 0.6 * k);
        dot.setAttribute('cx', (x + nx * off).toFixed(1));
        dot.setAttribute('cy', (y + ny * off).toFixed(1));
        dot.setAttribute('rx', r.toFixed(1));
        dot.setAttribute('ry', (r * 1.22).toFixed(1));
        dot.setAttribute('transform', `rotate(${q.tilt.toFixed(0)} ${(x + nx * off).toFixed(1)} ${(y + ny * off).toFixed(1)})`);
        dot.setAttribute('fill', f);
        // A faint light edge, so even dried nuts read on the dark floor.
        dot.setAttribute('stroke', 'rgba(240,232,220,0.35)');
        dot.setAttribute('stroke-width', '0.8');
        dot.setAttribute('opacity', (k * (keep ? 1 : 1 - 0.6 * focus) + 0 * refill).toFixed(3));
      });
    });

    // ---- 8. the drawing simplifies into the building's plan (T6.PLAN), at
    // the building's own proportions, framed as problem.js's overhead camera
    // will frame the real one: pk px to the metre, centred on the row.
    const plan = smooth(T6.PLAN[0], T6.PLAN[1], s);
    const rowPx = lay.bays[3].x1 - lay.bays[0].x0;
    const pk = (rowPx * 1.04) / 12.8;
    const PX = (x) => lay.w / 2 + (x - 16) * pk;      // the building's x, in px
    const PY = (z) => lay.cy + (z - 2) * pk;          // its z (south is down)

    // The heater: in beside the ring as the fire leaves, then with the row,
    // then (in the plan) where the furnace stands.
    let hx = lerp(lay.ringHeater[0], lay.heaterAt[0], morph);
    let hy = lerp(lay.ringHeater[1], lay.heaterAt[1], morph);
    let hw = Math.max(54, lay.bayL * 0.36); let hh = hw * 0.8;
    if (plan > 0) {
      hx = lerp(hx, PX(8.35), plan); hy = lerp(hy, PY(2.6), plan);
      hw = lerp(hw, 1.7 * pk, plan); hh = lerp(hh, 1.7 * pk, plan);
    }
    heater.flame.style.opacity = heater.flue.style.opacity = heater.flueLabel.style.opacity = (1 - plan).toFixed(3);
    heater.smoke.forEach((c) => { c.style.opacity = (1 - plan).toFixed(3); });
    heater.g.style.opacity = out.toFixed(3);
    heater.box.setAttribute('x', (hx - hw / 2).toFixed(1)); heater.box.setAttribute('y', (hy - hh / 2).toFixed(1));
    heater.box.setAttribute('width', hw.toFixed(1)); heater.box.setAttribute('height', hh.toFixed(1));
    const fl = 1 + 0.08 * Math.sin(clockT * 9) * Math.sin(clockT * 5.3);
    heater.flame.setAttribute('d', flamePath(hx, hy + hh * 0.3, hh * 0.55 * fl));
    const fx = hx + hw * 0.28; const fw = Math.max(8, hw * 0.16); const fh = hh * 0.75; const ftop = hy - hh / 2 - fh;
    heater.flue.setAttribute('x', (fx - fw / 2).toFixed(1)); heater.flue.setAttribute('y', ftop.toFixed(1));
    heater.flue.setAttribute('width', fw.toFixed(1)); heater.flue.setAttribute('height', fh.toFixed(1));
    heater.smoke.forEach((c, k) => {
      const u = (clockT * 0.35 + k / 4) % 1;
      c.setAttribute('cx', (fx + u * fw * 1.6 + Math.sin(u * 6 + k) * 2).toFixed(1));
      c.setAttribute('cy', (ftop - 4 - u * hh * 0.7).toFixed(1));
      c.setAttribute('r', (fw * (0.35 + u * 0.6)).toFixed(1));
      c.setAttribute('opacity', (0.5 * Math.sin(Math.PI * u)).toFixed(3));
    });
    // To the left of the flue, clear of the return duct.
    heater.flueLabel.setAttribute('x', (fx - fw).toFixed(1));
    heater.flueLabel.setAttribute('y', (ftop + 4).toFixed(1));
    heater.flueLabel.setAttribute('text-anchor', 'end');
    heater.label.setAttribute('x', hx.toFixed(1)); heater.label.setAttribute('y', (hy + hh / 2 + 18).toFixed(1));
    heater.label.style.opacity = (out * (1 - plan)).toFixed(3);
    // The fire's journey from its chamber to the heater.
    const go = smooth(T6.OUT[0], lerp(T6.OUT[0], T6.OUT[1], 0.7), s);
    const fromP = along(chambers[fireAt].pts, 0.5);
    fireDot.setAttribute('cx', lerp(fromP[0], hx, go).toFixed(1));
    fireDot.setAttribute('cy', lerp(fromP[1], hy, go).toFixed(1));
    fireDot.setAttribute('opacity', (bump(T6.OUT[0] - 2, T6.OUT[0] + 2, lerp(T6.OUT[0], T6.OUT[1], 0.6), lerp(T6.OUT[0], T6.OUT[1], 0.75), s)).toFixed(3));

    // ---- b. the join, lit, then lifted into the return duct
    const joinOn = smooth(T6.JOIN[0], T6.JOIN[1], s);
    let jpts = blend(lay.joinPts, lay.retJoin, morph);
    if (morph > 0 && morph < 1) {
      // Pin its ends to the chain's ends (last chamber's end, first's start).
      const e0 = unrolled[count - 1][NPTS - 1]; const e1 = unrolled[0][0];
      const a0 = jpts[0]; const a1 = jpts[jpts.length - 1];
      jpts = jpts.map((p, k2) => {
        const u = k2 / (jpts.length - 1);
        const w0 = (1 - u) * (1 - morph); const w1 = u * (1 - morph);
        return [p[0] + (e0[0] - a0[0]) * w0 + (e1[0] - a1[0]) * w1, p[1] + (e0[1] - a0[1]) * w0 + (e1[1] - a1[1]) * w1];
      });
    }
    join.setAttribute('d', d(jpts));
    join.setAttribute('stroke-width', lerp(lay.band * 0.5, Math.max(10, lay.D * 0.16), morph).toFixed(1));
    // Not drawn: a purple bar between two chambers read as a puzzle, not as
    // the loop's closure. The return duct says it instead (below).
    join.setAttribute('opacity', '0');
    void joinOn;
    // Bays: outlines and numbers once they have formed.
    // The outlines come in only as the chambers arrive in them.
    const formed = smooth(T6.MORPH[1] - 5, T6.MORPH[1] + 6, s);
    lay.bays.forEach((b, i) => {
      bayOutlines[i].setAttribute('x', (b.x0 - 2).toFixed(1));
      bayOutlines[i].setAttribute('y', (lay.top - 2).toFixed(1));
      bayOutlines[i].setAttribute('width', (b.x1 - b.x0 + 4).toFixed(1));
      bayOutlines[i].setAttribute('height', (lay.D + 4).toFixed(1));
      bayOutlines[i].style.opacity = formed.toFixed(3);
      // The bay being emptied: purple, broken at its door.
      // The lead bay is the one picked out (purple), at every step: it is
      // the batch the grower tests and the air reaches first. The bay out
      // for refilling is shown quietly: a grey broken outline, door open.
      const isLead = r1 > 0.5 && i === leadNow;
      const open = i === st.from ? focus : 0;
      bayOutlines[i].setAttribute('stroke', isLead ? PURPLE : open > 0.3 ? INK_DIM : INK);
      bayOutlines[i].setAttribute('stroke-width', isLead ? 2.5 : 1.5);
      bayOutlines[i].setAttribute('stroke-dasharray', !isLead && open > 0.3 ? '8 6' : 'none');
      // In the plan: closed up into one building, at its real proportions.
      if (plan > 0) {
        const cur = ['x', 'y', 'width', 'height'].map((k) => Number(bayOutlines[i].getAttribute(k)));
        const tgt = [PX(9.6 + 3.2 * i), PY(0.1), 3.2 * pk, 3.8 * pk];
        ['x', 'y', 'width', 'height'].forEach((k, j) => bayOutlines[i].setAttribute(k, lerp(cur[j], tgt[j], plan).toFixed(1)));
        if (plan > 0.5) {
          bayOutlines[i].setAttribute('stroke', INK);
          bayOutlines[i].setAttribute('stroke-width', 1.5);
          bayOutlines[i].setAttribute('stroke-dasharray', 'none');
        }
      }
      bayLabels[i].setAttribute('x', b.cx.toFixed(1));
      bayLabels[i].setAttribute('y', (lay.bottom + lay.D * 0.42 + 30).toFixed(1));
      bayLabels[i].style.opacity = (formed * (1 - 0.5 * ducts)).toFixed(3);
    });

    // ---- c. ducts, dampers, the route
    const ductW = Math.max(7, lay.D * 0.11);
    const ductA = ducts.toFixed(3);
    supply.setAttribute('d', lay.supplyD);
    stubs.forEach((p, b) => p.setAttribute('d', `M${lay.stubX[b].toFixed(1)} ${lay.ys.toFixed(1)} V${lay.bottom.toFixed(1)}`));
    passages.forEach((p, b) => p.setAttribute('d', d(lay.pass[b])));
    exhausts.forEach((p, b) => p.setAttribute('d', `M${lay.exhaustX[b].toFixed(1)} ${lay.top.toFixed(1)} V${lay.exTop.toFixed(1)}`));
    returnDuct.setAttribute('d', d(lay.ret));
    for (const p of [supply, ...stubs, ...passages, ...exhausts, returnDuct]) {
      p.setAttribute('stroke-width', ductW.toFixed(1));
      p.style.opacity = (ducts * (1 - plan)).toFixed(3);
    }
    // The return comes first, on its own, as soon as the row has formed: it
    // is what keeps the row a loop.
    returnDuct.style.opacity = (Math.max(ducts, smooth(T6.MORPH[1] - 6, T6.MORPH[1] + 10, s)) * (1 - plan)).toFixed(3);
    // Damper places.
    S.forEach((m, b) => Object.assign(m, { x: lay.stubX[b], y: lay.ys + (lay.bottom - lay.ys) * 0.5, along: 90 }));
    Pd.forEach((m, b) => Object.assign(m, { x: lay.bays[b].x1 + lay.gap / 2, y: lay.cy, along: 90 }));
    Object.assign(R41, { x: (lay.leftX + lay.bays[3].cx) / 2, y: lay.over, along: 0 });
    X.forEach((m, b) => Object.assign(m, { x: lay.exhaustX[b], y: (lay.top + lay.exTop) / 2, along: 90 }));
    const open1 = openSet(st.from); const open2 = openSet(st.to);
    allDampers.forEach((m) => {
      const o1 = open1.has(m) ? 1 : 0; const o2 = open2.has(m) ? 1 : 0;
      // Make before break: the new ones open first, the old ones shut after.
      let open = o1 * r1;
      if (o2 && !o1) open = swMake;
      if (o1 && !o2) open = r1 * (1 - swBreak);
      if (o1 && o2) open = r1;
      // Glowing: the ones that change in a step, and, as the dampers are
      // first explained, the ones holding today's route open.
      const acting = Math.max((o2 !== o1) ? bump(st.range[0] - 2, st.range[0] + 4, st.range[1] - 4, st.range[1] + 4, s) : 0,
        (o1 && st.n === 0) ? bump(T6.DAMPERS[0], T6.DAMPERS[0] + 6, T6.DAMPERS[1] - 6, T6.DAMPERS[1], s) : 0);
      const ang = m.along + (1 - open) * 90;
      m.g.setAttribute('transform', `translate(${m.x.toFixed(1)} ${m.y.toFixed(1)})`);
      m.bar.setAttribute('transform', `rotate(${ang.toFixed(1)})`);
      m.bar.setAttribute('stroke', acting > 0.5 ? PURPLE : open > 0.5 ? INK : INK_DIM);
      m.disc.setAttribute('stroke', acting > 0.5 ? PURPLE : INK_DIM);
      m.g.style.opacity = ductA;
    });
    dampersLabel.setAttribute('x', (R41.x + 14).toFixed(1));
    dampersLabel.setAttribute('y', (R41.y - 14).toFixed(1));
    dampersLabel.style.opacity = bump(T6.DAMPERS[0], T6.DAMPERS[0] + 6, T6.FWD[0], T6.FWD[1], s).toFixed(3);

    // The route: step one, then (once the new dampers are open) step two.
    const legs = route(lay, leadNow);
    const routeA = r1 * (st.t > PH.MAKE[1] - 0.06 && st.t < PH.MAKE[1] + 0.06 ? 0.25 : 1);
    const flow = (-clockT * 46) % 22;
    legs.forEach((leg, k) => {
      const p = airLegs[k];
      p.setAttribute('d', d(leg));
      p.setAttribute('stroke-width', Math.max(3, ductW * 0.42).toFixed(1));
      // Before the hand-on beat all one tone; after it, fresh to spent.
      const col = mix(hexArr(AIR), hexArr(AIR_SPENT), fwd * (k / 2));
      p.setAttribute('stroke', col);
      p.setAttribute('stroke-dashoffset', flow.toFixed(1));
      p.style.opacity = (routeA * (1 - 0.5 * focus)).toFixed(3);
    });
    const first = legs[0][0]; const last = legs[2][legs[2].length - 1];
    // Above the supply duct's start, clear of the heater's name; and to the
    // left of the exhaust, clear of the ideas on the right.
    airIn.setAttribute('x', (first[0] + 10).toFixed(1)); airIn.setAttribute('y', (first[1] - 14).toFixed(1));
    airOut.setAttribute('x', (last[0] - 12).toFixed(1)); airOut.setAttribute('y', (last[1] + 4).toFixed(1));
    airOut.setAttribute('text-anchor', 'end');
    airIn.style.opacity = airOut.style.opacity = (fwd * routeA).toFixed(3);

    // Roles over the bays.
    const lead = leadNow;
    const named = smooth(T6.TITLE[0], T6.TITLE[1], s);
    // The old role words over the return duct are gone: the roles are on
    // each bay's own tag now (below).
    roleLabels.forEach((l) => { l.style.display = 'none'; });
    // Off while the trigger is told; back once the dryer is named.
    const rolesShown = Math.max(1 - smooth(T6.CLOCK[0] - 10, T6.CLOCK[0], s), named);

    // ---- 7. the batch letters: they stay in their bays
    const letters = ['A', 'B', 'C', 'D'];
    CHANGES.forEach(([a0, a1], n) => { if (s >= lerp(a0, a1, PH.LOAD[0])) letters[n % 4] = String.fromCharCode(69 + n); });
    const roomy = lay.bayL > 170;
    lay.bays.forEach((b, i) => {
      const tg = tags[i];
      const r = ROLE[(i - lead + 4) % 4];
      tg.g.setAttribute('transform', `translate(${(b.x0 + 8).toFixed(1)} ${(lay.top + 8).toFixed(1)})`);
      // Measured again once the fonts have loaded (widths change with them).
      const key = `${letters[i]}|${r.word}|${roomy}|${document.fonts ? document.fonts.status : ''}`;
      if (key !== tg.key) {
        tg.key = key;
        tg.t.textContent = letters[i];
        tg.role.textContent = r.word;
        tg.desc.textContent = roomy ? r.desc : '';
        const rw = tg.role.getComputedTextLength() || r.word.length * 8;
        tg.desc.setAttribute('x', (30 + rw + 7).toFixed(1));
        const dw = roomy ? (tg.desc.getComputedTextLength() || r.desc.length * 6) + 7 : 0;
        tg.pill.setAttribute('width', (30 + rw + dw + 10).toFixed(1));
      }
      tg.pill.setAttribute('fill', r.fill);
      tg.pill.setAttribute('stroke', r.stroke);
      tg.chip.setAttribute('stroke', r.stroke);
      tg.role.setAttribute('fill', r.ink);
      tg.desc.setAttribute('fill', r.ink);
      // Before a role is anyone's (until the route first runs) only the
      // letter matters; the roles come in with the route.
      tg.role.style.opacity = tg.desc.style.opacity = rolesShown.toFixed(3);
      tg.pill.style.opacity = rolesShown.toFixed(3);
      tg.g.style.opacity = r1.toFixed(3);
    });
    // At the row's right end, clear of the person working the open bay.
    tagsLabel.setAttribute('x', lay.bays[3].x1.toFixed(1));
    tagsLabel.setAttribute('text-anchor', 'end');
    tagsLabel.setAttribute('y', (lay.bottom + lay.D * 0.42 + 52).toFixed(1));
    tagsLabel.style.opacity = bump(T6.TITLE[1], T6.TITLE[1] + 12, T6.C2[0], T6.C2[0] + 12, s).toFixed(3);
    // The grower. Every step starts with them: at the lead bay, a nut in
    // hand, testing it the way growers do. Only when it passes do the
    // dampers move; then they empty that bay and refill it, nut by nut.
    // During the trigger beat they stand at the lead bay, testing, and it
    // is from them, not from the bay, that the wire runs to the socket.
    const tWin = bump(T6.CLOCK[0], T6.CLOCK[1], T6.CLEAR[0], T6.CLEAR[1], s);
    const inChange = s >= st.range[0] - 4 && s <= st.range[1] + 4;
    const pBay = tWin > 0 ? 1 : st.from;
    const pb = lay.bays[pBay];
    const pA = tWin > 0 ? tWin : r1 * (inChange ? bump(-0.04, 0.04, 0.96, 1.02, st.t) : 0);
    const checking = tWin > 0 || st.t < PH.MAKE[0];
    const unloading = !checking && st.t >= PH.UNLOAD[0] && st.t < PH.LOAD[0];
    const loading = !checking && st.t >= PH.LOAD[0];
    const working = unloading || loading;
    // Clear of the supply duct and the bay's corner: in from the bay's
    // left edge and well below the duct. (The trigger beat below uses the
    // same place, GROWER_X / GROWER_Y.)
    const px = pb.x0 + GROWER_X;
    const atBayY = lay.bottom + lay.D * 0.42 + GROWER_Y; const heapY = atBayY + 36;
    // Up to the bay and back down to the heap, once a trip.
    // Standing still at the bay: movement here only distracted.
    const py = atBayY;
    // The heaps beside the grower: the dry batch growing as it comes out,
    // the fresh one shrinking as it goes in.
    const dryHeap = unloading ? unloadK : loading ? 1 : 0;
    const freshHeap = loading ? 1 - loadK : unloading ? 1 : 0;
    const heapA = r1 * (inCh ? bump(PH.UNLOAD[0] - 0.04, PH.UNLOAD[0], PH.LOAD[1], 1, st.t) : 0) * (tWin > 0 ? 0 : 1);
    heaps.dry.forEach((e, k) => { e.style.opacity = (heapA * (k < Math.round(dryHeap * HEAP) ? 1 : 0)).toFixed(3); });
    heaps.fresh.forEach((e, k) => { e.style.opacity = (heapA * (k < Math.round(freshHeap * HEAP) ? 1 : 0)).toFixed(3); });
    heaps.g.setAttribute('transform', `translate(${px.toFixed(1)} ${(heapY + 22).toFixed(1)})`);
    // No labels on the heaps: dark growing, orange shrinking says it.
    heaps.dryLabel.style.opacity = heaps.freshLabel.style.opacity = '0';
    person.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)})`);
    person.style.opacity = pA.toFixed(3);
    // The basket: full on the way out (unloading) or in (loading).
    basket.style.opacity = working ? '1' : '0';
    basket.setAttribute('fill', mix(unloading ? DRY : RIPE, RIPE, 0));
    heldNut.style.opacity = checking ? '1' : '0';
    const passed = tWin > 0 ? smooth(T6.PLUG[0], T6.PLUG[1], s) : smooth(0.08, 0.13, st.t);
    let say; let say2 = '';
    if (checking) {
      say = passed > 0.5 ? 'it passes: ready' : 'tests a nut: hard? husk peels?';
    } else {
      // Emptying and refilling: the picture says it; no words.
      say = '';
    }
    personLabel.textContent = say;
    personLabel2.textContent = say2;
    personLabel.setAttribute('x', (px + 30).toFixed(1)); personLabel.setAttribute('y', (py - 22).toFixed(1));
    personLabel2.setAttribute('x', (px + 30).toFixed(1)); personLabel2.setAttribute('y', (py - 4).toFixed(1));
    personLabel.style.opacity = personLabel2.style.opacity = pA.toFixed(3);
    // Beside the grower, out of the way of the walk.
    personLabel.setAttribute('x', (px + 30).toFixed(1)); personLabel.setAttribute('y', (atBayY - 22).toFixed(1));
    personLabel2.setAttribute('x', (px + 30).toFixed(1)); personLabel2.setAttribute('y', (atBayY - 4).toFixed(1));
    tick.setAttribute('transform', `translate(${(px + 18).toFixed(1)} ${(py - 52).toFixed(1)})`);
    tick.style.opacity = (pA * passed * (checking || st.t < PH.UNLOAD[0] ? 1 : 0)).toFixed(3);
    // Its evidence: the test is observed (F); acting on it is proposed (A).
    personChip.setAttribute('transform', `translate(${(px + 30).toFixed(1)} ${(py - 2).toFixed(1)})`);
    personChip.style.opacity = (pA * (checking ? 1 : 0)).toFixed(3);

    // ---- 7. the name
    gName.style.opacity = named.toFixed(3);
    gName.style.visibility = named > 0 ? 'visible' : 'hidden';
    const ty = Math.max(118, lay.over - lay.D * 1.25);
    title.setAttribute('x', lay.midX.toFixed(1)); title.setAttribute('y', ty.toFixed(1));
    stepText.setAttribute('x', lay.midX.toFixed(1)); stepText.setAttribute('y', (ty + 32).toFixed(1));
    stepText.textContent = `step ${leadNow + 1} of 4 · lead: bay ${leadNow + 1}`;
    title.setAttribute('transform', `translate(0 ${((1 - named) * 12).toFixed(1)})`);

    // ---- e. the trigger
    const tOn = smooth(T6.CLOCK[0], T6.CLOCK[1], s);
    const unplug = smooth(T6.UNPLUG[0], T6.UNPLUG[1], s);
    const plugged = smooth(T6.PLUG[0], T6.PLUG[1], s);
    const gone = smooth(T6.CLEAR[0], T6.CLEAR[1], s);
    gTrigger.style.opacity = (tOn * (1 - gone)).toFixed(3);
    gTrigger.style.visibility = tOn > 0 && gone < 1 ? 'visible' : 'hidden';
    // Laid out below the row, beside the grower, so the wire from the
    // grower runs a short way along the ground and crosses nothing: the
    // socket on the box's left (the grower's side), the clock on its right.
    const atBay = lay.bottom + lay.D * 0.42 + GROWER_Y;
    const gx = lay.bays[1].x0 + GROWER_X;
    const bw = 200; const bh = 42;
    // Level with the grower, past their words, and clear of the slip of
    // words at the bottom left.
    const bx = Math.max(gx + 240, lay.bays[2].x0); const by = atBay + 14;
    const bcx = bx + bw / 2;
    tBox.setAttribute('x', bx.toFixed(1)); tBox.setAttribute('y', (by - bh / 2).toFixed(1));
    tBox.setAttribute('width', bw); tBox.setAttribute('height', bh);
    tBoxText.setAttribute('x', bcx.toFixed(1)); tBoxText.setAttribute('y', (by + 5).toFixed(1));
    tBox.setAttribute('stroke', plugged > 0.5 ? PURPLE : INK);
    const ccx = bx + bw + 70 + unplug * 60; const ccy = by;
    clock.setAttribute('transform', `translate(${ccx.toFixed(1)} ${ccy.toFixed(1)})`);
    // No clock drawn: a "2 h" dial beside the dryer read as the dryer's
    // own timing and confused more than it explained.
    clock.style.display = 'none';
    const round = 2 * Math.PI * 22;
    const into = (clockT % 2.4) / 2.4;
    clockSweep.setAttribute('stroke-dasharray', `${round.toFixed(1)} ${round.toFixed(1)}`);
    clockSweep.setAttribute('stroke-dashoffset', (round * (1 - into)).toFixed(1));
    void clockRing;
    clockWire.setAttribute('d', `M${(bx + bw).toFixed(1)} ${by.toFixed(1)} H${(ccx - 24).toFixed(1)}`);
    clockWire.style.display = 'none';
    // The socket: a short stub out of the box's left side, open at its end.
    const sx1 = bx - 34;
    socket.setAttribute('d', `M${bx} ${by.toFixed(1)} H${(sx1 + 6).toFixed(1)}`);
    socketEnd.setAttribute('cx', sx1.toFixed(1)); socketEnd.setAttribute('cy', by.toFixed(1));
    socketLabel.setAttribute('x', bx.toFixed(1)); socketLabel.setAttribute('y', (by + bh / 2 + 20).toFixed(1));
    socketLabel.style.opacity = (1 - plugged).toFixed(3);
    // The wire into it, from the grower, below their words.
    const wire = [[gx + 8, by], [sx1, by]];
    const wireLen = wireLength(wire);
    plug.setAttribute('d', d(wire));
    plug.setAttribute('stroke-dasharray', `${wireLen.toFixed(1)} ${wireLen.toFixed(1)}`);
    plug.setAttribute('stroke-dashoffset', (wireLen * (1 - plugged)).toFixed(1));
    plugLabel.setAttribute('x', bx.toFixed(1)); plugLabel.setAttribute('y', (by + bh / 2 + 20).toFixed(1));
    plugLabel.style.opacity = smooth(T6.PLUG[1] - 6, T6.PLUG[1] + 6, s).toFixed(3);
    // The evidence for all this is in the words' slip (F, A, U): not
    // repeated on the drawing.
    [plugF, plugA].forEach((g) => { g.style.opacity = '0'; });
    // "How often to check…": the one thing here not known, marked as such.
    plugU.setAttribute('transform', `translate(${bx.toFixed(1)} ${(by + bh / 2 + 44).toFixed(1)})`);
    plugU.style.opacity = smooth(T6.UNKNOWN[0], T6.UNKNOWN[1], s).toFixed(3);

    // ---- 8. the honest close
    // While the village is back (problem.js), the drawing steps aside; its
    // panels (the side-by-side, the questions) stay, over the scene.
    const in3d = smooth(T6.TO3D[0], T6.TO3D[1], s);
    const away = (1 - in3d).toFixed(3);
    // The plan (bay outlines, heater) stays until the scene takes it over;
    // everything else in the diagram has already gone into the plan.
    const detail = ((1 - plan) * (1 - in3d)).toFixed(3);
    for (const g of [paper, gridRect, gDucts, gOutline]) g.style.opacity = away;
    for (const g of [gAir, gChambers, gNuts, gDampers, gLabels]) g.style.opacity = detail;
    if (plan > 0) gName.style.opacity = (Number(gName.style.opacity || 1) * (1 - plan)).toFixed(3);
    // Rain across the drawing again; the dryer runs on underneath it.
    const rainA = bump(T6.RAIN[0], T6.RAIN[1], T6.RAIN_OUT[0], T6.RAIN_OUT[1], s);
    gRain.style.visibility = rainA > 0 ? 'visible' : 'hidden';
    gRain.style.opacity = rainA.toFixed(3);
    if (rainA > 0) {
      drops.forEach((dr) => {
        const y = ((dr.y + clockT * 0.55 * dr.v) % 1) * (lay.h + 40) - 20;
        const x = ((dr.x + clockT * 0.03) % 1) * lay.w;
        dr.line.setAttribute('x1', x.toFixed(1)); dr.line.setAttribute('y1', y.toFixed(1));
        dr.line.setAttribute('x2', (x - 4).toFixed(1)); dr.line.setAttribute('y2', (y + 16).toFixed(1));
      });
    }
    const tableA = bump(T6.TABLE[0], T6.TABLE[1], T6.TABLE_OUT[0], T6.TABLE_OUT[1], s);
    const qsA = bump(T6.QS[0], T6.QS[1], T6.QS_OUT[0], T6.QS_OUT[1], s);
    dim.setAttribute('width', lay.w); dim.setAttribute('height', lay.h);
    // Over the scene, a lighter veil: the village should still show through.
    dim.setAttribute('opacity', (lerp(0.82, 0.5, in3d) * Math.max(tableA, qsA)).toFixed(3));

    // The bars: beside the words that read them out, on the same baseline
    // (problem.js places them); across the screen, they read as two things.
    const barsA = bump(T6.BARS[0] - 6, T6.BARS[0] + 4, T6.RAIN_OUT[0], T6.RAIN_OUT[1], s);
    gBars.style.visibility = barsA > 0 ? 'visible' : 'hidden';
    gBars.style.opacity = barsA.toFixed(3);
    if (barsA > 0) {
      const pw = Math.min(520, lay.w * 0.42); const RH = 60; const ph = 64 + BAR_ROWS.length * RH;
      const narrow = lay.w < 760;
      const at = beside(T6.BARS[0] - 6, T6.RAIN_OUT[1], pw, ph);
      const bx = at ? at.x : narrow ? 16 : lay.w - pw - Math.max(24, lay.w * 0.04);
      const byy = at ? at.y : narrow ? 112 : lay.h - ph - Math.max(40, lay.h * 0.08);
      for (const [k, v] of Object.entries({ x: bx, y: byy, width: pw, height: ph })) barsBg.setAttribute(k, v.toFixed(1));
      barsTitle.setAttribute('x', (bx + 20).toFixed(1)); barsTitle.setAttribute('y', (byy + 32).toFixed(1));
      const tx = bx + 150; const tw = pw - 170;
      const per = tw / 45;                                   // one scale: 45 days is the whole track
      bars.forEach((b, k) => {
        const y = byy + 62 + k * RH;
        const grow = smooth(T6.BARS[0] + k * 14, T6.BARS[0] + k * 14 + 16, s);
        b.label.setAttribute('x', (bx + 20).toFixed(1)); b.label.setAttribute('y', (y + 9).toFixed(1));
        b.track.setAttribute('x', tx.toFixed(1)); b.track.setAttribute('y', y.toFixed(1)); b.track.setAttribute('width', tw.toFixed(1));
        b.fill.setAttribute('x', tx.toFixed(1)); b.fill.setAttribute('y', y.toFixed(1));
        b.fill.setAttribute('width', Math.max(0.01, b.to * per * grow).toFixed(1));
        if (b.rangeFill) {
          const rg = smooth(T6.BARS[0] + k * 14 + 12, T6.BARS[0] + k * 14 + 22, s);
          b.rangeFill.setAttribute('x', (tx + b.to * per).toFixed(1)); b.rangeFill.setAttribute('y', y.toFixed(1));
          b.rangeFill.setAttribute('width', Math.max(0.01, (b.range - b.to) * per * rg).toFixed(1));
        }
        b.note.setAttribute('x', tx.toFixed(1)); b.note.setAttribute('y', (y + 26).toFixed(1));
        // Its evidence on a line of its own, under the note.
        b.chip.setAttribute('transform', `translate(${tx.toFixed(1)} ${(y + 46).toFixed(1)})`);
        b.g.style.opacity = smooth(T6.BARS[0] + k * 14 - 4, T6.BARS[0] + k * 14 + 6, s).toFixed(3);
      });
    }

    // The kiln and the Drying Cycle, side by side, a row at a time.
    gTable.style.visibility = tableA > 0 ? 'visible' : 'hidden';
    gTable.style.opacity = tableA.toFixed(3);
    let rowNow = -1;
    if (tableA > 0) {
      const tw = Math.min(900, lay.w - 48); const rh = 44; const th = 74 + ROWS8.length * rh + 40;
      const tx = (lay.w - tw) / 2; const ty = Math.max(96, lay.h * 0.4 - th / 2);
      for (const [k, v] of Object.entries({ x: tx, y: ty, width: tw, height: th })) tableBg.setAttribute(k, v.toFixed(1));
      const cQ = tx + 24; const cK = tx + tw * 0.26; const cD = tx + tw * 0.56; const cT = tx + tw - 24;
      tHeads[0].setAttribute('x', cK.toFixed(1)); tHeads[1].setAttribute('x', cD.toFixed(1));
      tHeads.forEach((t) => t.setAttribute('y', (ty + 40).toFixed(1)));
      const per = (T6.ROWS[1] - T6.ROWS[0]) / ROWS8.length;
      rows8.forEach((r, k) => {
        const y = ty + 74 + k * rh;
        const a = smooth(T6.ROWS[0] + k * per, T6.ROWS[0] + k * per + 8, s);
        if (s >= T6.ROWS[0] + k * per) rowNow = k;
        r.g.style.opacity = a.toFixed(3);
        r.g.setAttribute('transform', `translate(0 ${((1 - a) * 8).toFixed(1)})`);
        r.rule.setAttribute('x1', cQ.toFixed(1)); r.rule.setAttribute('x2', cT.toFixed(1));
        r.rule.setAttribute('y1', (y - 18).toFixed(1)); r.rule.setAttribute('y2', (y - 18).toFixed(1));
        r.q.setAttribute('x', cQ.toFixed(1)); r.q.setAttribute('y', (y + 4).toFixed(1));
        r.k.setAttribute('x', cK.toFixed(1)); r.k.setAttribute('y', (y + 4).toFixed(1));
        r.d.setAttribute('x', cD.toFixed(1)); r.d.setAttribute('y', (y + 4).toFixed(1));
        r.tag.setAttribute('x', cT.toFixed(1)); r.tag.setAttribute('y', (y + 4).toFixed(1));
      });
      // The changed row's evidence, under it.
      const yc = ty + 74 + (ROWS8.length - 1) * rh + 26;
      const chipA = smooth(T6.ROWS[1] - 6, T6.ROWS[1] + 6, s);
      tChips[0].setAttribute('transform', `translate(${cK.toFixed(1)} ${yc.toFixed(1)})`);
      tChips[1].setAttribute('transform', `translate(${cD.toFixed(1)} ${yc.toFixed(1)})`);
      tChips[2].setAttribute('transform', `translate(${(cD + 170).toFixed(1)} ${yc.toFixed(1)})`);
      tChips.forEach((c) => { c.style.opacity = chipA.toFixed(3); });
    }

    // The questions still open, one at a time.
    gQs.style.visibility = qsA > 0 ? 'visible' : 'hidden';
    gQs.style.opacity = qsA.toFixed(3);
    if (qsA > 0) {
      const qw = Math.min(760, lay.w - 48); const rh = 40; const qh = 80 + QS.length * rh + 40;
      const qx = (lay.w - qw) / 2; const qy = Math.max(96, lay.h * 0.4 - qh / 2);
      for (const [k, v] of Object.entries({ x: qx, y: qy, width: qw, height: qh })) qsBg.setAttribute(k, v.toFixed(1));
      qsTitle.setAttribute('x', (qx + 24).toFixed(1)); qsTitle.setAttribute('y', (qy + 40).toFixed(1));
      qsChip.setAttribute('transform', `translate(${(qx + 190).toFixed(1)} ${(qy + 37).toFixed(1)})`);
      const per = (T6.QROWS[1] - T6.QROWS[0]) / QS.length;
      qs.forEach((g, k) => {
        const a = smooth(T6.QROWS[0] + k * per, T6.QROWS[0] + k * per + 8, s);
        g.style.opacity = a.toFixed(3);
        g.setAttribute('transform', `translate(${(qx + 24).toFixed(1)} ${(qy + 84 + k * rh + (1 - a) * 8).toFixed(1)})`);
      });
      const shareA = smooth(T6.QROWS[1] - 4, T6.QROWS[1] + 6, s);
      qsShare.setAttribute('transform', `translate(${(qx + 50).toFixed(1)} ${(qy + 84 + (QS.length - 1) * rh + 22).toFixed(1)})`);
      qsShare.style.opacity = shareA.toFixed(3);
    }

    // ---- the tray: each idea lit by the beat that keeps it
    const LIT = [[2, T6.OUT[1] - 6], [1, T6.MORPH[1] - 8], [0, T6.DAMPERS[1] - 10], [3, T6.FWD[1]], [4, T6.PLUG[1] - 4]];
    const NAMES = ['Algorithm', 'Loop', 'Pipeline', 'Forwarding', 'Trigger'];
    LIT.forEach(([i, at], n) => {
      if (s >= at) terms[i].classList.add('is-lit');
      // Picked out from the paragraph that lights it until its card has gone.
      const card = COPY6.find((c) => c.term === NAMES[i]);
      const until = card ? card.at[3] : Math.min(LIT[n + 1] ? LIT[n + 1][1] : 1e9, at + 70);
      if (s >= at && s < until) terms[i].classList.add('is-now');
    });
    // In the side-by-side, the row being read picks out its idea.
    if (tableA > 0.5 && rowNow >= 0) {
      terms.forEach((t) => t.classList.remove('is-now'));
      if (rows8[rowNow].term >= 0) terms[rows8[rowNow].term].classList.add('is-now');
    }
    // Trigger is the one idea that changes: from a clock to a condition.
    terms[4].textContent = s >= T6.PLUG[1] - 4 ? 'Trigger: a grower’s test' : 'Trigger';
  }

  /** Point and unit normal at u (0-1) along a polyline. */
  function along(pts, u) {
    const n = pts.length - 1; const f = clamp01(u) * n; const i = Math.min(n - 1, Math.floor(f)); const k = f - i;
    const a = pts[i]; const b = pts[i + 1];
    const x = lerp(a[0], b[0], k); const y = lerp(a[1], b[1], k);
    const dx = b[0] - a[0]; const dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1;
    return [x, y, -dy / len, dx / len];
  }
  function wireLength(pts) {
    let t = 0;
    for (let i = 1; i < pts.length; i++) t += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return t;
  }
  function flamePath(x, y, s) {
    return `M${x} ${y} C${x - s * 0.55} ${y - s * 0.1} ${x - s * 0.4} ${y - s * 0.65} ${x - s * 0.1} ${y - s * 0.85} C${x - s * 0.05} ${y - s * 0.55} ${x + s * 0.12} ${y - s * 0.5} ${x + s * 0.12} ${y - s * 0.7} C${x + s * 0.45} ${y - s * 0.45} ${x + s * 0.55} ${y - s * 0.1} ${x} ${y} Z`;
  }
  function hexArr(c) {
    if (c.startsWith('rgb')) return c.match(/\d+/g).slice(0, 3).map(Number);
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  return { update };
}
