/**
 * views/anatomy.js — the tour of the kiln's parts, between the intro and the
 * dashboard.
 *
 * A VIEW, like intro.js: what it reads is scroll progress through #anatomy,
 * and what it drives is the ring view's drawing — which part is in focus
 * (ring.focus), how far the kiln has been assembled (ring.present) — and one
 * callout card with a leader line. It holds no kiln rules and sends no
 * actions. The kiln underneath is whatever state main.js hands the ring while
 * the tour is on: a fired demonstration copy, which the tour keeps under
 * wraps until the story reaches the fire.
 *
 * THE STORY: FIVE IDEAS, ONE AT A TIME
 * This is the visitor's first meeting with the kiln. It is not a parts list:
 * each step carries exactly one of the ideas the rest of the site builds on
 * (the logic cards, then the dryer), and a part is named only when that idea
 * needs it. Each card ends on the question the next one answers.
 *
 *   COLD  1 A loop of chambers   no first, no last: the firing never stops
 *         2 Tiles that stay put  ...so what moves?
 *   LIT   3 The fire moves       it creeps on, fed from the roof; every two
 *                                hours a chamber, each at a different stage
 *         4 One way through      one door, one damper: the air's single route
 *         5 Heat, handed forward the route passes the tiles ahead, so the
 *                                heat works twice. The point of the project.
 *
 * Colour arrives once, with the fire, and means heat from then on. The air's
 * route is told AFTER the fire, right before the step it pays off in, so it
 * is drawn straight away as the heat-carrying arrow rather than as a cold
 * line the visitor has to hold in mind for several screens.
 *
 * What the tour leaves out is not lost: the no-fans draught, bricked doors,
 * how the roof holes are fed, chamber temperatures and the unloading caveat
 * are all on the evidence sheet (config COMPONENTS and METHODS).
 *
 * A step may speak in BEATS: its words change at set points of its scroll,
 * dipping out and back in at the join, while the drawing carries on. A long
 * step thus says one thing at a time instead of everything at once.
 *
 * THE VOICE is the project brief's, kept short: the drawing explains, and the
 * card says only what the drawing cannot.
 *
 * The sentence on each card says what the part DOES, in plain words; where
 * that knowledge comes from is the job of the evidence chip beside it, with
 * the same codes the dashboard uses (config EVIDENCE). The notes in
 * config.COMPONENTS stay what they are — the evidence sheet's account of
 * provenance — and are not repeated here.
 */

import * as THREE from 'three';
import { COMPONENTS, EVIDENCE } from '../config.js';
import { relativeHeat, ROWS } from '../engine.js';
import { heatHex } from './heatRamp.js';

/**
 * One step per idea.
 *
 *   id     what the leader line points at (ring.anchorFor)
 *   focus  the part (or list of parts) that takes the accent, or absent for
 *          the whole kiln
 *   release  [from, to]: shares of the step over which the focus lets go
 *   title  defaults to the part's label in config.COMPONENTS
 *   tag    evidence code; defaults to the part's
 *   side   which margin the note takes; defaults to the side the part is on
 *   text   what the card says; or
 *   beats  [{ at, text }]: words that change at share `at` of the step
 *
 * Dividing walls, the kiln island, the flue and the partition are not
 * toured. The first two are drawing decisions; the flue is drawn, unnamed,
 * under the path to the chimney; the partition is left out of the tour's
 * drawing altogether (it stays on the evidence sheet).
 */
/** Scroll length of the longer steps, in viewport heights (the others: STEP_VH). */
const FIRE_VH = 620;
const AIR_VH = 150;
const RECOVER_VH = 400;

export const TOUR = [
  {
    // The loop: what makes a fire that never stops possible.
    id: 'chambers', focus: 'chambers', side: 'left', title: 'A loop of chambers',
    text: 'Seen from above, roof removed: one tunnel bent into a loop and worked as eight chambers. No first, no last, so the firing never has to stop.',
  },
  {
    // The loads stay put. The card ends on the question the fire answers.
    id: 'tiles', focus: 'tiles', title: 'Tiles that stay put',
    text: 'Each chamber is stacked with Mangalore tiles, the clay roof tiles this coast is known for. Once stacked, they stay where they are. So what moves?',
  },
  {
    // The one step that is not a part but a process: see THE FIRE below.
    // Two beats. First the creep, watched slowly through one chamber, with
    // only the clock beside it; then, once the fire has moved on, the rhythm
    // and the stages, which is when the panel's table comes up.
    // Tagged L: how the fire travels is from writing on other kilns; only the
    // two-hour interval is the factory's.
    id: 'fire', title: 'The fire moves', tag: 'L', vh: FIRE_VH,
    beats: [
      { at: 0, text: 'The fire does. Fuel dropped through holes in the roof catches on the red-hot tiles ahead, so the fire creeps forward row by row, never relit.' },
      { at: 0.40, text: 'About every two hours it enters the next chamber. At any moment, each chamber is at a different stage.' },
    ],
  },
  {
    // The air's route, told now because the next step needs it. The doors,
    // the dampers and the chimney are named only for what they do here: one
    // way in, one way out. The dampers and chimney are picked out first (the
    // open damper is the one gap among them), then fall back as the route
    // draws itself and becomes the subject. Not the doors: lighting all eight
    // would say "eight doors" when the point is that one stands open, and
    // the leader already marks that one, where the route begins.
    id: 'air', anchor: 'airPath', focus: ['dampers', 'chimney'], release: [0.5, 0.75],
    title: 'One way through', tag: 'L', side: 'left', vh: AIR_VH,
    text: 'A fire needs air. The chimney draws it in, but only one doorway and one damper stand open, so the air has a single route through the kiln.',
  },
  {
    // The point of the tour, in three beats that follow the drawing: the gas
    // warms the tiles ahead; the counterfactual sends it up the chimney; the
    // two kilns' fuel side by side. Tagged L: that the exhaust warms the tiles
    // ahead is documented for kilns of this kind; how much heat, and how much
    // fuel, is the model's, and the panel says so.
    id: 'recovery', title: 'Heat, handed forward', tag: 'L', vh: RECOVER_VH,
    beats: [
      { at: 0, text: 'On its way out, the hot gas passes the tiles waiting ahead and warms them. The fire arrives at a chamber already hot.' },
      { at: 0.36, text: 'Open the damper at the fire instead, and the same heat goes straight up the chimney.' },
      { at: 0.70, text: 'Handed forward, the same heat does its work twice.' },
    ],
  },
];

/**
 * One reference image per step, shown across the kiln from the card.
 *
 * None of these is the Kundapur kiln: they are other Hoffmann kilns, two
 * nineteenth-century engravings, and Mangalore tiles from elsewhere, all from
 * Wikimedia Commons. The figure says so under every image, because the brief
 * requires field observation to stay distinct from reference material. Full
 * sources and licences: assets/tour/CREDITS.md. `credit` is the attribution
 * the licence asks for, written as a sentence rather than a string of codes.
 */
const IMG = './assets/tour/';
// Only the two cold steps carry a picture: there the drawing is still an
// abstract outline, and a photograph says "this is a real tunnel, real
// tiles". Once the kiln is lit, the drawing is the thing to watch, and a
// picture beside it would compete. (The doorway, stoke-hole and tunnel
// photographs stay in assets/tour/ and CREDITS.md for the evidence sheet.)
export const FIGURES = {
  chambers: { caption: 'Inside the firing tunnel of a Hoffmann kiln. Huatan, Taiwan.', credit: 'Photo by Kai3952, CC BY-SA 4.0' },
  tiles: { caption: 'Mangalore tiles from the Basel Mission tile works, 1865.', credit: 'Photo by Yadvendu, CC BY-SA 4.0' },
};

/** Scroll per step, in viewport heights, and the empty run after the last. */
export const STEP_VH = 110;
export const TAIL_VH = 60;
/** The kiln's move to make room for the cards: it starts LEAD_VH before the
 *  first step and is done SETTLE_VH into it, one long ease instead of a lurch. */
const LEAD_VH = 30;       // after the intro's blueprint has cleared (views/intro.js, kilnOut)
const SETTLE_VH = 55;

/**
 * THE FIRE — the one step where time passes.
 *
 * Scroll is time. One loop of the kiln, recorded ahead (tourRun.js), is
 * scrubbed by the scroll: the clock, the rule worked in numbers, the eight
 * chamber rows, the fuel and the kiln drawing are all read from the SAME
 * recorded frame, so they cannot disagree and they all run backwards
 * together when the visitor scrolls back.
 *
 * The scroll is not spent evenly. The first two hours get a long run, so
 * the fire can be watched creeping through one chamber slowly; after that
 * every interval gets the same shorter run.
 *
 *   f (share of the step)   hours
 *   0.00 – LIGHT            0        the kiln takes its heat colours
 *   LIGHT – FIRST_END       0 → 2    the first interval, slowly
 *   FIRST_END – LOOP_END    2 → 16   seven more, evenly
 *   LOOP_END – 1            16       the loop closed; the card leaves
 *
 * Nothing here stages the move itself. The fire's creep from row to row, the
 * zone straddling two chambers, the damper and partition stepping on: all of
 * that is in the recorded frames, because it is what the model does
 * (engine.js, FIRE_ZONE). The view only reads it out.
 */
const FIRE = { LIGHT: 0.07, FIRST_END: 0.40, LOOP_END: 0.94 };
// How much closer the kiln is drawn during the fire step, at most; less where
// the window has no room for it.
const FIRE_ZOOM = 1.12;

/**
 * "Heat, handed forward", as shares of its scroll. Three beats:
 *
 *   DRAW    the gas is followed along its path: in cold, up to the fire, and
 *           on through the chambers ahead, cooling as it goes
 *   SWITCH  the damper is opened at the fire instead. The path ahead is cut,
 *           the gas leaves hot, and the chambers ahead go cold
 *   COUNT   the fuel each kiln burns to fire one chamber, and where its heat
 *           ends up
 *
 * Each beat has its own stretch of scroll and its own words on the card (the
 * step's `beats`, which change in the gaps between these spans), so the
 * three never overlap. The fuel panel comes up only once the first bar has
 * something to show.
 *
 * Everything is a function of the scroll, so it all runs backwards too.
 */
const RECOVER = {
  DRAW: [0.06, 0.26], SWITCH: [0.40, 0.62], COUNT: [0.72, 0.88],
  // The line said over each kiln, and the stretch of the step it rises through.
  SAY: [
    { text: 'Heat, handed forward.', kiln: 'on', span: [0.08, 0.34] },
    { text: 'Heat, lost to the air.', kiln: 'off', span: [0.42, 0.68] },
  ],
};
/**
 * How far the fuel ratio moved when the assumed values were varied (halving
 * and doubling how readily gas and tiles trade heat; one to four chambers of
 * path ahead of the fire). Worked out by running the model, not by this page;
 * the evidence sheet gives the runs (config METHODS, "The kiln with its heat
 * sent to the chimney").
 */
const lerp = (a, b, k) => a + (b - a) * k;
/** A model figure in fuel units, shown to the nearest ten. */
const tens = (v) => `≈ ${Math.round(v / 10) * 10}`;

const STAGE_NAME = {
  fire: 'Firing', preheat: 'Preheating', cool: 'Cooling',
  wait: 'Restacked', empty: 'Unloading',
};

/**
 * The model's temperature for a chamber, as it is shown: rounded to the
 * nearest ten degrees and marked approximate. The model works in degrees,
 * but its constants are assumptions (config thermalModel, all tagged A), so
 * a figure like 867 °C would claim a precision it does not have. Only the
 * 850 to 900 °C peak was recorded at the factory.
 */
const approxC = (t) => `≈ ${Math.round(t / 10) * 10} °C`;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Share of the fire step -> simulated hours (see the table above). */
function fireHours(f, run) {
  const T = run.tickHours;
  if (f <= FIRE.LIGHT) return 0;
  if (f <= FIRE.FIRST_END) return T * (f - FIRE.LIGHT) / (FIRE.FIRST_END - FIRE.LIGHT);
  if (f >= FIRE.LOOP_END) return run.totalHours;
  return T + (run.totalHours - T) * (f - FIRE.FIRST_END) / (FIRE.LOOP_END - FIRE.FIRST_END);
}

const hm = (hours) => {
  const m = Math.round(hours * 60);
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
};

/** Progress through the pinned range: 0 at the top, 1 once scrolled past it. */
function sectionProgress(sectionEl) {
  const scrollable = sectionEl.offsetHeight - window.innerHeight;
  if (scrollable <= 0) return 1;
  const p = -sectionEl.getBoundingClientRect().top / scrollable;
  return Math.min(1, Math.max(0, p));
}

export function createAnatomy({ sectionEl, ring, run }) {
  // Where each step starts, in vh. Steps are STEP_VH long unless they say
  // otherwise; the section is their sum, plus a tail so the last card can be
  // read before the dashboard takes over, plus the one screen the sticky pin
  // itself occupies.
  const starts = [];
  let steps = 0;
  for (const s of TOUR) { starts.push(steps); steps += s.vh ?? STEP_VH; }
  sectionEl.style.height = `${steps + TAIL_VH + 100}vh`;
  // Pulled up a screen over the intro's end. The intro's pin releases a screen
  // before its section ends, and below that the kiln just sat still while the
  // page scrolled: a dead stretch between the two. With the tour starting as
  // the intro's pin lets go, the camera never stops.
  sectionEl.style.marginTop = '-100vh';

  const card = sectionEl.querySelector('.anatomy-card');
  const entries = card.querySelector('.anatomy-entries');
  entries.innerHTML = '<h3 class="anatomy-title"><span class="anatomy-key" aria-hidden="true"></span><span class="anatomy-title-text"></span></h3><p class="anatomy-text"></p>';
  const titleEl = entries.querySelector('.anatomy-title-text');
  const textEl = entries.querySelector('.anatomy-text');
  const stepEl = card.querySelector('.anatomy-step');
  const chipEl = card.querySelector('.anatomy-chip');
  const evEl = card.querySelector('.anatomy-ev-label');
  const figure = sectionEl.querySelector('.anatomy-figure');
  const figImg = figure.querySelector('img');
  // Intrinsic sizes, so the browser reserves the box before the file arrives.
  const DIMS = { chambers: [960, 720], tiles: [960, 547] };
  const figCap = figure.querySelector('.anatomy-figure-cap');
  const figNote = figure.querySelector('.anatomy-figure-note');
  // Fetched up front, so a step's image is there when its card arrives
  // rather than popping in half-way through the step.
  for (const id of Object.keys(FIGURES)) new Image().src = `${IMG}${id}.jpg`;
  const svg = sectionEl.querySelector('.anatomy-leader');
  const line = svg.querySelector('line');
  const dot = svg.querySelector('.leader-dot');
  const halo = svg.querySelector('.leader-halo');

  const stepOf = {};
  TOUR.forEach((step, n) => { stepOf[step.id] = n; });
  // The accent the ring draws the part in is the one the card and the leader
  // pick up, so the eye can tie the words to the place.
  sectionEl.style.setProperty('--tour-accent', ring.accent);
  const projected = new THREE.Vector3();
  let shown = -1;
  let shownBeat = -1;
  let active = false;
  let done = false;

  /**
   * Which beat of step i is speaking at share f, and how visible its words
   * are. At each join the words dip out over a short stretch of scroll
   * (BEAT_GAP_VH either side, the same distance however long the step) and
   * the new ones come up in their place, so a change is never missed and
   * never happens mid-read.
   */
  const BEAT_GAP_VH = 7;
  function beatAt(i, f) {
    const beats = TOUR[i].beats;
    if (!beats) return { n: 0, alpha: 1 };
    let n = 0;
    while (n + 1 < beats.length && beats[n + 1].at <= f) n++;
    const gap = BEAT_GAP_VH / (TOUR[i].vh ?? STEP_VH);
    let alpha = 1;
    for (let b = 1; b < beats.length; b++) {
      alpha = Math.min(alpha, smooth(0, gap, Math.abs(f - beats[b].at)));
    }
    return { n, alpha };
  }

  // ------------------------------------------------- the computed panel
  const count = run.count;
  const T = run.tickHours;
  const compute = sectionEl.querySelector('.anatomy-compute');
  const numbers = sectionEl.querySelector('.anatomy-numbers');
  const hand = compute.querySelector('.compute-hand');
  const marks = compute.querySelector('.compute-marks');
  const el = (cls) => compute.querySelector(cls);
  const timeEl = el('.compute-time');
  const ofEl = el('.compute-of');
  const railEl = el('.compute-rail');
  const tableEl = el('.compute-table');
  const rowsEl = el('.compute-rows');
  const markerEl = el('.compute-marker');
  ofEl.textContent = `of ${run.totalHours} h`;

  // The clock is the dashboard's: a twelve-hour face marked only where this
  // kiln can be, one mark per move (views/clock.js explains why).
  for (let h = 0; h < 12; h += T) {
    const a = (h / 12) * Math.PI * 2;
    const m = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    m.setAttribute('x1', (50 + Math.sin(a) * 38).toFixed(2));
    m.setAttribute('y1', (50 - Math.cos(a) * 38).toFixed(2));
    m.setAttribute('x2', (50 + Math.sin(a) * 45).toFixed(2));
    m.setAttribute('y2', (50 - Math.cos(a) * 45).toFixed(2));
    marks.append(m);
  }

  // One rail cell, one row and one number on the kiln per chamber, all three
  // carrying the same numeral: that shared number is what ties the clock's
  // schedule, the table and the drawing into one thing. A row is a heat bar
  // and a stage name, nothing more: the colour says how hot, the word says
  // what the chamber is doing. Degrees are on the dashboard, not here.
  const railCells = []; const rows = []; const kilnNums = [];
  for (let i = 0; i < count; i++) {
    const cell = document.createElement('span');
    cell.className = 'rail-cell';
    cell.innerHTML = `<i></i><b>${i + 1}</b>`;
    railEl.append(cell);
    railCells.push({ cell, fill: cell.querySelector('i') });

    const row = document.createElement('li');
    row.innerHTML = `<b class="row-n">${i + 1}</b><span class="row-bar"><i></i></span><span class="row-state"></span>`;
    rowsEl.append(row);
    rows.push({ row, bar: row.querySelector('.row-bar i'), state: row.querySelector('.row-state') });

    const n = document.createElement('span');
    n.textContent = String(i + 1);
    numbers.append(n);
    kilnNums.push(n);
  }

  // ------------------------------------------ "Heat, handed forward" panel
  // Two bars and one sentence. Everything else the model knows about where
  // the heat goes (tourRun.js records the whole account) is on the evidence
  // sheet, not here: this screen makes one point.
  const recover = sectionEl.querySelector('.anatomy-recover');
  const pair = run.pair;
  const account = run.account;
  const rq = (cls) => recover.querySelector(cls);
  const rrows = {};
  // The one figure on the kiln itself: how hot the next chamber's tiles are
  // when the fire reaches them. A div, so the numerals' span rule passes it by.
  const arriveEl = document.createElement('div');
  arriveEl.className = 'anatomy-arrive';
  arriveEl.innerHTML = '<b></b><em>before the fire arrives</em>';
  numbers.append(arriveEl);
  const arriveNum = arriveEl.querySelector('b');
  // The two lines that rise over the kiln, one per kiln. Each belongs to a
  // stretch of the scroll (RECOVER.SAY) and is placed by it, so scrolling
  // back lowers the line again. Set under the note and the panel in the
  // markup's order, so neither is ever written across.
  const says = RECOVER.SAY.map(({ text, kiln }) => {
    const e = document.createElement('p');
    e.className = 'anatomy-say';
    e.dataset.kiln = kiln;
    e.setAttribute('aria-hidden', 'true');
    // Two lines, broken after the comma: a small one that names the subject
    // and a large one that says what happens to it.
    const [head, rest] = text.split(', ');
    const small = document.createElement('span');
    small.className = 'say-head';
    small.textContent = head;
    const big = document.createElement('span');
    big.className = 'say-rest';
    big.textContent = rest;
    e.append(small, big);
    numbers.after(e);
    return e;
  });
  // Sized to the room between the note and the panel, measured again when
  // that room changes or the display face arrives.
  let sayRoom = -1;
  document.fonts?.ready.then(() => { sayRoom = -1; });
  function fitSays(room) {
    if (Math.abs(room - sayRoom) < 1) return;
    sayRoom = room;
    for (const e of says) {
      e.style.fontSize = '100px';
      const wide = e.offsetWidth || 1;
      e.style.fontSize = `${Math.max(20, Math.min(96, (room / wide) * 100)).toFixed(1)}px`;
    }
  }
  function placeSays(f, h, alpha, room) {
    if (f != null) fitSays(room);
    RECOVER.SAY.forEach(({ span }, n) => {
      const p = f == null ? -1 : (f - span[0]) / (span[1] - span[0]);
      const e = says[n];
      if (p <= 0 || p >= 1) { e.style.opacity = '0'; e.style.visibility = 'hidden'; return; }
      // Up from the bottom edge at a steady pace; in quickly, out slowly.
      const y = lerp(0.40, -0.30, p) * h;
      e.style.transform = `translate(-50%, -50%) translateY(${y.toFixed(1)}px)`;
      e.style.opacity = (smooth(0, 0.18, p) * (1 - smooth(0.55, 1, p)) * alpha).toFixed(3);
      e.style.visibility = 'visible';
    });
  }
  if (pair) {
    const most = Math.max(account.on.fuel, account.off.fuel);
    for (const key of ['on', 'off']) {
      const row = rq(`.recover-row[data-k="${key}"]`);
      row.querySelector('.rr-num').textContent = tens(account[key].fuel);
      rrows[key] = { row, bar: row.querySelector('.rr-bar'), share: account[key].fuel / most };
    }
    const ratio = account.off.fuel / account.on.fuel;
    rq('.recover-ratio').textContent = `With its heat sent straight to the chimney, the kiln burns about ${ratio.toFixed(1)} times the fuel.`;
  }

  /** Where the three beats of "Heat, handed forward" stand at share f. */
  function recoverMoment(f) {
    const reveal = smooth(RECOVER.DRAW[0], RECOVER.DRAW[1], f);
    const t = smooth(RECOVER.SWITCH[0], RECOVER.SWITCH[1], f);
    const grow = smooth(RECOVER.COUNT[0], RECOVER.COUNT[1], f);
    // The first half of the switch draws the path back to the fire; at the
    // half-way point the damper there is the open one, and from then on the
    // kiln is the second kiln, its chambers ahead going cold.
    const cut = smooth(0, 0.5, t);
    const cold = smooth(0.4, 1, t);
    // The path begins at the fire here: the run behind it, where the air is
    // warmed by fired tiles, was the air step's subject and is drawn back.
    const from = smooth(0.02, 0.07, f);
    // The second kiln's path, drawn out from the fire to the chimney.
    const out = smooth(0.5, 0.8, t);
    // Each kiln's fuel bar fills once that kiln has been shown.
    const barOn = smooth(RECOVER.DRAW[1] - 0.03, RECOVER.DRAW[1] + 0.06, f);
    const barOff = smooth(0.8, 1, t);
    return { reveal, t, grow, cut, cold, from, out, barOn, barOff, second: t >= 0.5 };
  }

  /**
   * The kiln at a point in the switch. Before half-way it is the first kiln,
   * after it the second (so the ring draws that kiln's path and damper), and
   * the tiles' heat is carried across between the two. A cross-fade between
   * two finished runs at one moment — not a simulation of throwing the
   * damper, which the model has never been asked to do.
   */
  let blendKey = -1; let blendState = null;
  function blended(mo) {
    const key = Math.round(mo.cold * 400) + (mo.second ? 1000 : 0);
    if (key === blendKey) return blendState;
    const k = mo.cold;
    blendState = {
      ...(mo.second ? pair.off : pair.on),
      chambers: pair.on.chambers.map((c, i) => {
        const o = pair.off.chambers[i];
        return {
          ...c,
          temp: lerp(c.temp, o.temp, k),
          heat: lerp(c.heat, o.heat, k),
          rowHeat: c.rowHeat.map((h, r) => lerp(h, o.rowHeat[r], k)),
        };
      }),
    };
    blendKey = key;
    return blendState;
  }

  function drawRecover(mo) {
    recover.dataset.kiln = mo.second ? 'off' : 'on';
    rrows.on.bar.style.width = `${(rrows.on.share * mo.barOn * 100).toFixed(2)}%`;
    rrows.off.bar.style.width = `${(rrows.off.share * mo.barOff * 100).toFixed(2)}%`;
    rrows.on.row.style.setProperty('--shown', smooth(0.7, 1, mo.barOn).toFixed(3));
    rrows.off.row.style.setProperty('--shown', smooth(0.7, 1, mo.barOff).toFixed(3));
    // The kiln on screen is the row at full strength, until the two are
    // read together at the end.
    rrows.on.row.style.opacity = (mo.second ? 0.5 + 0.5 * mo.grow : 1).toFixed(3);
    rrows.off.row.style.opacity = (mo.second ? 1 : 0.45).toFixed(3);
    recover.style.setProperty('--told', mo.grow.toFixed(3));
  }

  /** The arrival temperature, set beside the chamber it belongs to. */
  function placeArrive(mo, w, h) {
    const next = (pair.on.firePos + 1) % count;
    projected.set(0, 0, 0).project(ring.camera);
    const cx = (projected.x * 0.5 + 0.5) * w;
    const cy = (-projected.y * 0.5 + 0.5) * h;
    projected.copy(ring.chamberPoint(next)).project(ring.camera);
    const x = (projected.x * 0.5 + 0.5) * w;
    const y = (-projected.y * 0.5 + 0.5) * h;
    // Outward from the chamber's number, away from the middle of the kiln.
    const d = Math.hypot(x - cx, y - cy) || 1;
    const off = 46;
    arriveEl.style.transform = `translate(${(x + (x - cx) / d * off).toFixed(1)}px, ${(y + (y - cy) / d * off).toFixed(1)}px) translate(-50%, -50%)`;
    const cold = mo.cold >= 0.5;
    const text = approxC(cold ? pair.arrive.off : pair.arrive.on);
    if (arriveNum.textContent !== text) arriveNum.textContent = text;
    arriveEl.dataset.kiln = cold ? 'off' : 'on';
    // Up once the path has reached that chamber; dipped as the figure changes.
    arriveEl.style.opacity = (smooth(0.55, 0.85, mo.reveal) * Math.min(1, Math.abs(mo.cold - 0.5) * 6)).toFixed(3);
  }

  /** Everything the fire step shows, from one moment of the record. */
  function fireMoment(f) {
    const hours = fireHours(f, run);
    const frame = run.at(hours);
    // Moves made so far, and how far through the current interval. At the
    // closing hour the eighth move is complete and the interval is whole.
    const closed = hours >= run.totalHours - 1e-9;
    const moves = closed ? count : Math.floor(hours / T + 1e-9);
    const within = closed ? T : hours - moves * T;
    // How much of the firing zone is in the chamber its leading edge is in:
    // one row's worth on arrival, the whole zone by the end of the interval.
    // The rest is still in the chamber behind.
    const frac = closed ? 0 : within / T;
    const share = (1 + frac * (ROWS - 1)) / ROWS;
    // Where the middle of the zone is, as a position round the ring.
    const fireAt = frame.firePos - 1 + share + (closed ? count : 0);
    // And its leading edge.
    const front = frame.firePos + frac;
    return { hours, frame, moves, within, share, fireAt, front, closed };
  }

  function drawCompute(m) {
    const { hours, frame, moves, within, fireAt, closed } = m;
    hand.setAttribute('transform', `rotate(${((hours / 12) * 360).toFixed(2)} 50 50)`);
    timeEl.textContent = hm(hours);

    railCells.forEach(({ cell, fill }, k) => {
      const p = k < moves ? 1 : k === moves ? within / T : 0;
      fill.style.transform = `scaleX(${p.toFixed(4)})`;
      cell.classList.toggle('is-now', k === moves && !closed);
    });

    frame.chambers.forEach((ch, i) => {
      const r = rows[i];
      const h = relativeHeat(ch.temp);
      r.bar.style.transform = `scaleX(${Math.max(0.02, h).toFixed(4)})`;
      r.bar.style.background = heatHex(h);
      // While the zone lies across two chambers, both are firing. The
      // row-by-row count is the kiln drawing's to show, not the table's.
      const row = frame.fireRow ?? ROWS - 1;
      const behind = (frame.firePos - 1 + count) % count;
      const straddled = i === behind && row < ROWS - 1 && ch.fired;
      const firing = i === frame.firePos || straddled;
      const name = firing ? 'Firing' : STAGE_NAME[ch.stage] ?? ch.stage;
      if (r.state.textContent !== name) r.state.textContent = name;
      r.row.classList.toggle('is-fire', firing);
    });

    // The marker rides the fire down the rows, so the move is seen as a
    // movement in the table too. Round the wrap (row 8 to row 1) it fades
    // out at the bottom and in at the top rather than flying back up.
    const pos = ((fireAt % count) + count) % count;
    const wrapping = pos > count - 1;
    const frac = pos - (count - 1);
    const rowAt = wrapping ? (frac < 0.5 ? count - 1 : 0) : pos;
    const lo = rows[Math.floor(rowAt)].row; const hi = rows[Math.min(count - 1, Math.ceil(rowAt))].row;
    const y = lo.offsetTop + (hi.offsetTop - lo.offsetTop) * (rowAt - Math.floor(rowAt));
    markerEl.style.transform = `translateY(${y.toFixed(1)}px)`;
    markerEl.style.height = `${lo.offsetHeight}px`;
    markerEl.style.opacity = wrapping ? Math.abs(1 - 2 * frac).toFixed(3) : '1';
  }

  /** The chamber numbers on the kiln itself, just outside its outer wall. */
  function placeNumbers(m, w, h, alpha) {
    const on = ((Math.round(m.fireAt) % count) + count) % count;
    kilnNums.forEach((n, i) => {
      projected.copy(ring.chamberPoint(i)).project(ring.camera);
      const x = (projected.x * 0.5 + 0.5) * w;
      const y = (-projected.y * 0.5 + 0.5) * h;
      n.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
      n.classList.toggle('is-fire', i === on);
    });
    numbers.style.opacity = String(alpha);
    numbers.style.visibility = alpha > 0.01 ? 'visible' : 'hidden';
  }

  function fill(i) {
    const step = TOUR[i];
    stepEl.textContent = `${i + 1} of ${TOUR.length}`;
    titleEl.textContent = step.title ?? (COMPONENTS[step.id] ?? {}).label;
    const ev = EVIDENCE[step.tag ?? (COMPONENTS[step.id] ?? {}).tag];
    chipEl.textContent = ev.code;
    evEl.textContent = ev.label;
    card.dataset.ev = ev.code;
    card.title = ev.blurb;
    // 'part': a part is picked out in the accent. 'whole': the lit kiln.
    card.dataset.mode = step.focus ? 'part' : 'whole';
    const fig = FIGURES[step.id];
    figure.hidden = !fig;
    if (fig) {
      figImg.src = `${IMG}${step.id}.jpg`;
      figImg.decoding = 'async';
      if (DIMS[step.id]) [figImg.width, figImg.height] = DIMS[step.id];
      // The figcaption beside it says what the picture is; an alt that
      // repeated it would be read twice.
      figImg.alt = '';
      figCap.textContent = fig.caption;
      figNote.textContent = `Reference image, not Prabhakar Tile Factory. ${fig.credit}, via Wikimedia Commons.`;
    }
    svg.dataset.mode = step.focus ? 'part' : 'whole';
    shown = i;
    shownBeat = -1;
  }

  /** The words of beat n of the step on show. */
  function speak(n) {
    if (n === shownBeat) return;
    const step = TOUR[shown];
    textEl.textContent = step.beats ? step.beats[n].text : step.text;
    shownBeat = n;
  }

  /**
   * Where the scroll is, read fresh. main.js asks isActive() and frame()
   * BEFORE update() to decide which kiln the ring draws this frame, so none
   * of this can be a value left over from the last frame.
   */
  function measure() {
    const top = sectionEl.getBoundingClientRect().top;
    const scrolled = -top / window.innerHeight * 100;          // vh into the section
    active = top <= 1 && scrolled < steps + TAIL_VH;
    done = sectionProgress(sectionEl) >= 0.999;
    const at = Math.min(steps - 0.001, Math.max(0, scrolled));
    let i = TOUR.length - 1;
    while (i > 0 && starts[i] > at) i--;
    const f = (at - starts[i]) / (TOUR[i].vh ?? STEP_VH);
    return { scrolled, i, f };
  }

  /**
   * The kiln the ring should draw: the record's first moment until the fire
   * step, the scrubbed moment during it, and after it the moment the two
   * kilns are compared at. That moment is the end of the loop's last
   * interval (tourRun.js), so the air step and the last step show one and
   * the same kiln, and it follows on from the fire step's closing frame.
   */
  function frame() {
    const { i, f } = measure();
    const n = stepOf.fire;
    if (i < n) return run.frames[0];
    if (i === n) return fireMoment(f).frame;
    if (pair) return blended(recoverMoment(i === stepOf.recovery ? f : 0));
    return run.frames[run.frames.length - 1];
  }

  function hide(...els) {
    for (const e of els) { e.style.opacity = '0'; e.style.visibility = 'hidden'; }
  }
  function show(e, a) {
    e.style.opacity = String(a);
    e.style.visibility = a > 0.01 ? 'visible' : 'hidden';
  }

  /**
   * The zoom that clears the kiln of the panels either side, as in update().
   * Needed before the tour is on screen, while the kiln is already easing
   * down to it.
   */
  function clearFit() {
    const w = ring.renderer.domElement.clientWidth || 1;
    const margin = Math.max(24, w * 0.04);
    const reserve = Math.max(card.offsetWidth, compute.offsetWidth, recover.offsetWidth, figure.offsetWidth) + margin + 28;
    return Math.min(1, Math.max(0.45, (w - 2 * reserve) / (ring.kilnShare() * w)));
  }

  function update(state) {
    const { scrolled, i, f } = measure();

    if (!active) {
      // The kiln starts to make room as the intro lets go (LEAD_VH before the
      // tour's first step), so it is already easing down when the first card
      // arrives rather than lurching down underneath it. After the tour it is
      // put back at once. setZoom(1) with no pan also centres the kiln.
      ring.focus(null, 0);
      ring.present(null);
      const lead = scrolled < 0 ? smooth(-LEAD_VH, SETTLE_VH, scrolled) : 0;
      ring.setZoom(lead > 0 ? 1 + (clearFit() - 1) * lead : 1);
      hide(card, figure, compute, recover, numbers);
      placeSays(null, 0, 0);
      svg.style.opacity = '0';
      return;
    }

    const isFire = i === stepOf.fire;
    const m = isFire ? fireMoment(f) : null;
    const isAir = i === stepOf.air;
    const isRecover = i === stepOf.recovery && !!pair;
    const rm = isRecover ? recoverMoment(f) : null;
    // The two steps with a panel in place of a picture.
    const panel = isFire ? compute : isRecover ? recover : null;

    // In over the first slice of a step, out over the last — except the very
    // last step, which stays up through the tail. The fire step is long, so
    // its slices are measured in the same scroll distance, not the same share.
    const k = STEP_VH / (TOUR[i].vh ?? STEP_VH);
    const last = i === TOUR.length - 1;
    const fadeOut = last ? 1 - smooth(steps + TAIL_VH * 0.6, steps + TAIL_VH, scrolled) : 1 - smooth(1 - 0.14 * k, 1, f);
    const a = smooth(0, 0.14 * k, f) * fadeOut;
    show(card, a);
    if (i !== shown) fill(i);
    // The step's words, or this beat's, dipping out and in at each join.
    const beat = beatAt(i, f);
    speak(beat.n);
    textEl.style.opacity = beat.alpha.toFixed(3);

    // The part in focus takes the accent and the rest of the kiln falls back;
    // ring.js eases from one part to the next. The lit steps have no part:
    // the whole kiln is the subject, at full strength.
    // A step may let its part go part-way through (`release`), handing the
    // eye on to what the drawing does next.
    const part = TOUR[i].focus ?? null;
    const keep = TOUR[i].release ? 1 - smooth(...TOUR[i].release, f) : 1;
    ring.focus(part, part ? smooth(0, 0.4, scrolled / STEP_VH) * fadeOut * keep : 0);

    // How far the kiln has been put together. Each stage belongs to one step:
    // nothing before it, complete after it, and scrubbed by the scroll within
    // it — starting once the card is up, so the words arrive before the thing
    // they describe starts to move.
    const during = (id, lo = 0.16, hi = 0.8) => {
      const n = stepOf[id];
      return i < n ? 0 : i > n ? 1 : smooth(lo, hi, f);
    };
    const lit = during('fire', 0.012, FIRE.LIGHT);
    ring.present({
      tiles: during('tiles'),
      // Bricked up as the kiln is lit; from then on `live` shows which
      // doorway the record has open.
      doors: lit,
      // In the air step the one open damper opens, and then the route draws
      // itself from the open doorway to it, already the heat-carrying arrow
      // because the kiln is lit.
      damper: during('air', 0.14, 0.34),
      air: during('air', 0.32, 0.86),
      // In the last step the path starts at the fire. It is drawn back to
      // the damper there as that one is opened, then out to the chimney
      // again as the second kiln's.
      airFrom: rm ? rm.from : 0,
      airCut: rm ? (rm.second ? 1 - rm.out : rm.cut) : 0,
      airAlpha: 1,
      heat: lit,
      // From the lighting on, the kiln is drawn as the record has it — one
      // chamber being unloaded, one restacked — rather than as assembled.
      live: lit,
      // The firing zone is picked out by the floor under it, in the accent,
      // shared between the two chambers it lies across, with a bright bar at
      // its leading edge (front).
      fireAt: m ? m.fireAt : (rm || isAir) && pair ? pair.on.firePos : null,
      front: m ? m.front : null,
      // Not in the tour: with no step to explain it, it is not drawn.
      partition: 0,
      // Then, in the last step, the fire's mark gives way to the chambers
      // the air passes through on its way to and from it.
      fireGlow: lit * (1 - during('recovery', 0.03, 0.09)),
      pathGlow: during('recovery', 0.05, 0.14) * fadeOut,
      // Off the chambers ahead as the path to them is cut.
      pathAhead: rm ? 1 - rm.cut : 1,
      // Only the chambers ahead are this step's subject.
      pathBehind: 0,
    });

    const { camera, renderer } = ring;
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    const margin = Math.max(24, w * 0.04);

    // Keep the kiln clear of the panels. The same room is kept on both sides
    // for the whole tour — the widest panel plus a gap — so the kiln stays
    // centred and one size from the first step to the last, and nothing is
    // ever drawn underneath a panel. It eases down from the intro's full-size
    // kiln as the tour opens, and back up as it closes.
    const reserve = Math.max(card.offsetWidth, compute.offsetWidth, recover.offsetWidth, figure.offsetWidth) + margin + 28;
    const fit = Math.min(1, Math.max(0.45, (w - 2 * reserve) / (ring.kilnShare() * w)));
    const settle = smooth(-LEAD_VH, SETTLE_VH, scrolled) * (1 - smooth(steps + TAIL_VH * 0.5, steps + TAIL_VH, scrolled));
    // The fire step has only the note and the computed panel up, and the note
    // is the narrower of the two. So the kiln moves to the middle of the gap
    // between them and takes the room that frees: a slight step closer for
    // the one part of the tour where the drawing is the thing being read.
    // Eased with the note, so it arrives and leaves with it.
    const gap = margin + 28;
    // Always the fire step's panel, even in the last step: the two panels differ
    // in width, and measuring the live one moved the kiln sideways at the join.
    const pw = compute.offsetWidth;
    const fireFit = Math.min(1, fit * FIRE_ZOOM,
      (w - card.offsetWidth - pw - 2 * gap) / (ring.kilnShare() * w));
    // Held from the fire to the end, through the air step between the two
    // panel steps, so the kiln does not step back and forward again as one
    // note gives way to the next.
    const held = isFire ? smooth(0, 0.14 * k, f) : isAir ? 1 : isRecover ? fadeOut : 0;
    const near = fireFit > fit ? held : 0;
    const zoom = fit + (fireFit - fit) * near;
    ring.setZoom(1 + (zoom - 1) * settle, ((card.offsetWidth - pw) / 2) * near);

    if (panel) {
      // No leader and no image: the note takes the left margin, the computed
      // panel the right, both fixed, and the numbers on the kiln do the
      // pointing. Nothing here follows the fire around the screen.
      if (isFire) drawCompute(m); else drawRecover(rm);
      svg.style.opacity = '0';
      hide(figure, isFire ? recover : compute);
      // Each panel says only what its step has reached. The fire's table of
      // stages comes up with the second beat, once the fire has moved on and
      // there are stages to compare; the fuel panel once its first bar has
      // something in it.
      const reveal = isFire
        ? smooth(FIRE.FIRST_END, FIRE.FIRST_END + 0.03, f)
        : smooth(RECOVER.DRAW[1] - 0.05, RECOVER.DRAW[1], f);
      if (isFire) {
        // Grown open rather than faded in over a held gap, so the first beat's
        // panel is just the clock and the rail, with nothing empty under them.
        tableEl.style.height = `${(reveal * tableEl.scrollHeight).toFixed(1)}px`;
        tableEl.style.opacity = smooth(0.4, 1, reveal).toFixed(3);
        show(panel, a);
      } else show(panel, a * reveal);
      placeNumbers(m ?? { fireAt: pair.on.firePos }, w, h, a);
      if (isRecover) placeArrive(rm, w, h); else arriveEl.style.opacity = '0';
      placeSays(isRecover ? f : null, h, a, w - 2 * margin - card.offsetWidth - panel.offsetWidth - 72);
      card.dataset.side = 'left';
      card.style.transform = `translate(${margin.toFixed(1)}px, ${Math.max(24, (h - card.offsetHeight) / 2).toFixed(1)}px)`;
      panel.style.transform = `translate(${(w - margin - panel.offsetWidth).toFixed(1)}px, ${Math.max(16, (h - panel.offsetHeight) / 2).toFixed(1)}px)`;
      return;
    }
    hide(compute, recover, numbers);
    placeSays(null, 0, 0);
    svg.style.opacity = String(a);
    const at = (id) => {
      projected.copy(ring.anchorFor(id, state)).project(camera);
      return [(projected.x * 0.5 + 0.5) * w, (-projected.y * 0.5 + 0.5) * h];
    };
    const drawLeader = (ax, ay, cx, cy, onLeft) => {
      const ex = onLeft ? cx + card.offsetWidth : cx;
      const ey = Math.min(cy + card.offsetHeight - 12, Math.max(cy + 12, ay));
      line.setAttribute('x1', ax.toFixed(1));
      line.setAttribute('y1', ay.toFixed(1));
      line.setAttribute('x2', ex.toFixed(1));
      line.setAttribute('y2', ey.toFixed(1));
      for (const c2 of [dot, halo]) {
        c2.setAttribute('cx', ax.toFixed(1));
        c2.setAttribute('cy', ay.toFixed(1));
      }
    };
    card.dataset.on = 'true';
    if (figure.hidden) hide(figure); else show(figure, a);

    // Leader line: from the part to the near edge of the card, which sits in
    // the margin on the same side of the kiln as the part, so the leader
    // never crosses the kiln.
    const [ax, ay] = at(TOUR[i].anchor ?? TOUR[i].id);
    const side = TOUR[i].side ?? (ax < w / 2 ? 'left' : 'right');
    card.dataset.side = side;

    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const cx = side === 'left' ? margin : w - margin - cw;
    const cy = Math.min(h - ch - 24, Math.max(24, ay - ch / 2));
    card.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`;

    // The image takes the other margin, level with the middle of the kiln,
    // so words and picture sit either side of the thing they describe.
    const fw = figure.offsetWidth;
    const fx = side === 'left' ? w - margin - fw : margin;
    const fy = Math.max(24, (h - figure.offsetHeight) / 2);
    figure.style.transform = `translate(${fx.toFixed(1)}px, ${fy.toFixed(1)}px)`;
    drawLeader(ax, ay, cx, cy, side === 'left');
  }

  return {
    update, frame,
    /** True while the tour is on screen: main.js shows the recorded kiln. */
    isActive: () => { measure(); return active; },
    /** True once scrolled to the very end: time for the dashboard. */
    isDone: () => { measure(); return done; },
    /** For the console: the fire step's moment at share f of its scroll. */
    fireMoment,
  };
}
