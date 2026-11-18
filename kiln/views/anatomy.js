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
 * THE STORY, IN TWO ACTS
 * This is the visitor's first meeting with the kiln, so it is told in the
 * order someone would work it, one idea per step, each card ending on the
 * question the next one answers.
 *
 * THE VOICE is the project brief's: measured and explanatory, saying what
 * each part is and then what organising the kiln that way makes possible.
 *
 *   COLD  The kiln as an empty ink drawing. Chambers; tiles stacked in (faint,
 *         uncoloured); doors bricked up; fuel holes; then the gas circuit —
 *         chimney, flue, dampers — and the air's route traced as one plain
 *         line. Nothing is hot, so nothing is coloured except the part being
 *         talked about, which takes the accent.
 *   LIT   The fire is lit: only now do the tiles take heat colours and the
 *         line swell into the heat-carrying arrow. The last step is the point
 *         of the whole project, heat used twice, seen on the complete picture.
 *
 * Colour therefore arrives once, with the fire, and means heat from then on.
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
 *   focus  the part that takes the accent, or absent for the whole kiln
 *   title  defaults to the part's label in config.COMPONENTS
 *   tag    evidence code; defaults to the part's
 *   side   which margin the note takes; defaults to the side the part is on
 *   parts  two parts that share a step: each has its own id, text, note,
 *          leader and evidence tag, and both are shown and animated at once
 *
 * Dividing walls, the kiln island, the flue and the partition are not
 * toured. The first two are drawing decisions; the flue is drawn, unnamed,
 * under the path to the chimney; the partition is left out of the tour's
 * drawing altogether (it stays on the evidence sheet).
 */
/** Scroll length of the fire step, in viewport heights (the others: STEP_VH). */
const FIRE_VH = 620;
const RECOVER_VH = 340;
/** A step shared by two parts, shown and animated together. */
const PAIR_VH = 130;

export const TOUR = [
  {
    id: 'chambers', focus: 'chambers', side: 'left',
    text: 'Seen from above with its roof removed, the kiln is one continuous tunnel bent into a loop and worked as eight chambers. With no first chamber and no last, the firing never has to stop.',
  },
  {
    id: 'tiles', focus: 'tiles',
    text: 'Each chamber is stacked with Mangalore tiles, the interlocking clay roof tiles this coast is known for. A load stays where it is stacked until it is unloaded: it is the fire that travels, not the tiles.',
  },
  {
    // What the fire is given: fuel from above, air by the chimney's pull.
    id: 'feed', vh: PAIR_VH,
    parts: [
      { id: 'stokeHoles', text: 'Cashew-nut shells are dropped onto the fire through holes in the roof, so no chamber has to be opened to feed it.' },
      { id: 'chimney', text: 'The kiln has no fans. As hot gas rises through the chimney, fresh air is drawn in behind it, and that draught is what moves air through the chambers.' },
    ],
  },
  {
    // What the crew opens and shuts: one way in, one way out.
    id: 'openings', vh: PAIR_VH,
    parts: [
      { id: 'wicketDoors', text: 'Each chamber is loaded through one doorway, bricked shut once the stack is complete. Only the chamber being unloaded stands open.' },
      { id: 'dampers', text: 'Each chamber also has a damper leading to the chimney. Only one is open at a time, a few chambers ahead of the fire, so the chimney pulls at that one point.' },
    ],
  },
  {
    id: 'airPath', focus: 'airPath',
    text: 'So the air has one route. It enters by the open doorway, passes through the fired tiles, through the fire, over the tiles still waiting, and leaves by the open damper.',
  },
  {
    // The one step that is not a part but a process: see THE FIRE below. It
    // is several screens long, and its note stays the same throughout: with
    // the kiln, the clock and the panel all moving, the words must not. What
    // changes from moment to moment is said by the panel, in figures.
    // Tagged L: how the fire travels is from writing on other kilns; only the
    // two-hour interval is the factory's.
    id: 'fire', title: 'The fire', tag: 'L', vh: FIRE_VH,
    text: 'The fire is never carried forward or relit. Fuel dropped onto tiles that are already red-hot lights by itself, so the crew feeds the next row of holes ahead and stops feeding the last row behind. Row by row the fire creeps round the kiln, and about every two hours its leading edge enters the next chamber.',
  },
  {
    // One constant note, as in the fire step: the principle. What the scroll
    // changes is shown by the kiln and the panel. Tagged L: that the exhaust
    // warms the tiles ahead is documented for kilns of this kind; how much
    // heat, and how much fuel, is the model's, and the panel says so.
    id: 'recovery', title: 'Heat, handed forward', tag: 'L', vh: RECOVER_VH,
    text: 'The chambers open into one another, and the only open way to the chimney is a few chambers past the fire. So the hot gas warms the tiles waiting ahead before it leaves, and the fire needs less fuel when it gets there.',
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
export const FIGURES = {
  chambers: { caption: 'Inside the firing tunnel of a Hoffmann kiln, a doorway to each chamber along one side. Huatan, Taiwan.', credit: 'Photo by Kai3952, CC BY-SA 4.0' },
  tiles: { caption: 'Mangalore tiles from the Basel Mission tile works, 1865.', credit: 'Photo by Yadvendu, CC BY-SA 4.0' },
  wicketDoors: { caption: 'A chamber doorway, standing open. Sehnde brickworks, Germany.', credit: 'Photo by Hamelenser, CC BY-SA 3.0' },
  stokeHoles: { caption: 'A stoke hole in the roof of a Hoffmann kiln, seen from above. Sehnde brickworks, Germany.', credit: 'Photo by Hamelenser, CC BY-SA 3.0' },
  airPath: { caption: 'The tunnel the air is drawn along. Sehnde brickworks, Germany.', credit: 'Photo by Hamelenser, CC BY-SA 3.0' },
};

/** Scroll per step, in viewport heights, and the empty run after the last. */
export const STEP_VH = 110;
export const TAIL_VH = 60;

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
 * Everything is a function of the scroll, so it all runs backwards too.
 */
const RECOVER = {
  DRAW: [0.07, 0.30], SWITCH: [0.40, 0.66], COUNT: [0.72, 0.90],
  // The line said over each kiln, and the stretch of the step it rises through.
  SAY: [
    { text: 'Heat, handed forward.', kiln: 'on', span: [0.09, 0.38] },
    { text: 'Heat, lost to the air.', kiln: 'off', span: [0.47, 0.76] },
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

  const card = sectionEl.querySelector('.anatomy-card');
  const stepEl = card.querySelector('.anatomy-step');
  const chipEl = card.querySelector('.anatomy-chip');
  const evEl = card.querySelector('.anatomy-ev-label');
  const figure = sectionEl.querySelector('.anatomy-figure');
  const figImg = figure.querySelector('img');
  const figCap = figure.querySelector('.anatomy-figure-cap');
  const figNote = figure.querySelector('.anatomy-figure-note');
  // Fetched up front, so a step's image is there when its card arrives
  // rather than popping in half-way through the step.
  for (const id of Object.keys(FIGURES)) new Image().src = `${IMG}${id}.jpg`;
  // A step shared by two parts has a note on each side of the kiln, each
  // holding its own image where it has one. The second note and image
  // are copies of the first, used only in those steps.
  const card2 = card.cloneNode(true);
  card.after(card2);
  const figure2 = figure.cloneNode(true);
  figure.after(figure2);
  const slotOf = (c, fg) => ({
    card: c, figure: fg,
    step: c.querySelector('.anatomy-step'), entries: c.querySelector('.anatomy-entries'),
    chip: c.querySelector('.anatomy-chip'), ev: c.querySelector('.anatomy-ev-label'),
    img: fg.querySelector('img'), cap: fg.querySelector('.anatomy-figure-cap'),
    note: fg.querySelector('.anatomy-figure-note'), has: false,
  });
  const slots = [slotOf(card, figure), slotOf(card2, figure2)];
  const svg = sectionEl.querySelector('.anatomy-leader');
  const line = svg.querySelector('line');
  const dot = svg.querySelector('.leader-dot');
  const halo = svg.querySelector('.leader-halo');
  // A second leader, for the second note of a shared step.
  const leaders = [{ line, dot, halo }];
  leaders.push({ line: line.cloneNode(), dot: dot.cloneNode(), halo: halo.cloneNode() });
  svg.append(leaders[1].line, leaders[1].halo, leaders[1].dot);

  // A step's parts: its own pair, or itself as the only one.
  const partsOf = (step) => step.parts
    ? step.parts.map((p) => ({ ...p, focus: p.id }))
    : [step];
  // Which step an id belongs to. Both parts of a pair run through the whole
  // of their step, so their animations (`during`) play together.
  const stepOf = {}; const spanOf = {};
  TOUR.forEach((step, n) => {
    stepOf[step.id] = n;
    (step.parts ?? []).forEach((p) => { stepOf[p.id] = n; });
  });
  // The accent the ring draws the part in is the one the card and the leader
  // pick up, so the eye can tie the words to the place.
  sectionEl.style.setProperty('--tour-accent', ring.accent);
  const projected = new THREE.Vector3();
  let shown = -1;
  let side = 'right';
  let active = false;
  let done = false;

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
  const nextEl = el('.compute-next');
  const railEl = el('.compute-rail');
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
  // schedule, the table and the drawing into one thing.
  const railCells = []; const rows = []; const kilnNums = [];
  for (let i = 0; i < count; i++) {
    const cell = document.createElement('span');
    cell.className = 'rail-cell';
    cell.innerHTML = `<i></i><b>${i + 1}</b>`;
    railEl.append(cell);
    railCells.push({ cell, fill: cell.querySelector('i') });

    const row = document.createElement('li');
    row.innerHTML = `<b class="row-n">${i + 1}</b><span class="row-bar"><i></i></span><span class="row-temp"></span><span class="row-state"></span>`;
    rowsEl.append(row);
    rows.push({
      row, bar: row.querySelector('.row-bar i'),
      temp: row.querySelector('.row-temp'), state: row.querySelector('.row-state'),
    });

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

    nextEl.textContent = closed
      ? 'Loop complete. The next one starts now.'
      : `Next move in ${hm(T - within)}`;

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
      const temp = approxC(ch.temp);
      if (r.temp.textContent !== temp) r.temp.textContent = temp;
      // The two chambers the zone lies across say so in rows; the rest give
      // their stage.
      const row = frame.fireRow ?? ROWS - 1;
      const behind = (frame.firePos - 1 + count) % count;
      let name = STAGE_NAME[ch.stage] ?? ch.stage;
      if (i === frame.firePos) name = row >= ROWS - 1 ? 'Firing, all rows' : `Entering, row ${row + 1} of ${ROWS}`;
      else if (i === behind && row < ROWS - 1 && ch.fired) name = `Leaving, ${ROWS - 1 - row} ${ROWS - 1 - row === 1 ? 'row' : 'rows'} left`;
      if (r.state.textContent !== name) r.state.textContent = name;
      r.row.classList.toggle('is-fire', i === frame.firePos || name.startsWith('Leaving'));
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
    const parts = partsOf(TOUR[i]);
    parts.forEach((part, k) => {
      const slot = slots[k];
      slot.step.textContent = `${i + 1} of ${TOUR.length}`;
      slot.entries.innerHTML = '<h3 class="anatomy-title"><span class="anatomy-key" aria-hidden="true"></span><span class="anatomy-title-text"></span></h3><p class="anatomy-text"></p>';
      slot.entries.querySelector('.anatomy-title-text').textContent = part.title ?? (COMPONENTS[part.id] ?? {}).label;
      slot.entries.querySelector('.anatomy-text').textContent = part.text;
      const ev = EVIDENCE[part.tag ?? (COMPONENTS[part.id] ?? {}).tag];
      slot.chip.textContent = ev.code;
      slot.ev.textContent = ev.label;
      slot.card.dataset.ev = ev.code;
      slot.card.title = ev.blurb;
      // 'part': one part is picked out in the accent. 'whole': the lit kiln.
      slot.card.dataset.mode = part.focus ? 'part' : 'whole';
      slot.card.dataset.pair = slot.figure.dataset.pair = String(parts.length > 1);
      const fig = FIGURES[part.id];
      slot.has = !!fig;
      slot.figure.hidden = !fig;
      // In a shared step the image is part of the note: one slip, the words
      // and then the picture. Otherwise it stands alone across the kiln.
      const inline = parts.length > 1 && !!fig;
      slot.figure.classList.toggle('is-inline', inline);
      if (inline) slot.card.querySelector('.anatomy-foot').before(slot.figure);
      else if (slot.figure.parentElement !== slot.card.parentElement) slot.card.before(slot.figure);
      if (fig) {
        slot.img.src = `${IMG}${part.id}.jpg`;
        slot.img.alt = fig.caption;
        slot.cap.textContent = fig.caption;
        slot.note.textContent = `Reference image, not Prabhakar Tile Factory. ${fig.credit}, via Wikimedia Commons.`;
      }
    });
    svg.dataset.mode = parts[0].focus ? 'part' : 'whole';
    shown = i;
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
   * step, the scrubbed moment during it, and its last moment after.
   */
  function frame() {
    const { i, f } = measure();
    const n = stepOf.fire;
    if (i < n) return run.frames[0];
    if (i === stepOf.recovery && pair) return blended(recoverMoment(f));
    if (i > n) return run.frames[run.frames.length - 1];
    return fireMoment(f).frame;
  }

  function hide(...els) {
    for (const e of els) { e.style.opacity = '0'; e.style.visibility = 'hidden'; }
  }
  function show(e, a) {
    e.style.opacity = String(a);
    e.style.visibility = a > 0.01 ? 'visible' : 'hidden';
  }

  function update(state) {
    const { scrolled, i, f } = measure();

    if (!active) {
      // setZoom(1) with no pan also puts the kiln back in the centre.
      ring.focus(null, 0);
      ring.present(null);
      ring.setZoom(1);
      hide(card, figure, card2, figure2, compute, recover, numbers);
      placeSays(null, 0, 0);
      svg.style.opacity = '0';
      return;
    }

    const isFire = i === stepOf.fire;
    const m = isFire ? fireMoment(f) : null;
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

    // The part in focus takes the accent and the rest of the kiln falls back;
    // ring.js eases from one part to the next. The lit steps have no part:
    // the whole kiln is the subject, at full strength.
    // In a shared step both parts take the accent together.
    const parts = partsOf(TOUR[i]);
    const part = parts.length > 1 ? parts.map((p) => p.focus) : parts[0].focus ?? null;
    ring.focus(part, part ? smooth(0, 0.4, scrolled / STEP_VH) * fadeOut : 0);

    // How far the kiln has been put together. Each stage belongs to one step:
    // nothing before it, complete after it, and scrubbed by the scroll within
    // it — starting once the card is up, so the words arrive before the thing
    // they describe starts to move.
    const during = (id, lo = 0.16, hi = 0.8) => {
      const n = stepOf[id];
      const [from, to] = spanOf[id] ?? [0, 1];
      return i < n ? 0 : i > n ? 1 : smooth(from + lo * (to - from), from + hi * (to - from), f);
    };
    const lit = during('fire', 0.012, FIRE.LIGHT);
    ring.present({
      tiles: during('tiles'),
      // The roof holes fill in one after another, round from the fire.
      stoke: during('stokeHoles', 0.2, 0.85),
      doors: during('wicketDoors', 0.22, 0.8),
      damper: during('dampers', 0.3, 0.6),
        air: during('airPath', 0.14, 0.82),
      // In the last step the path starts at the fire. It is drawn back to
      // the damper there as that one is opened, then out to the chimney
      // again as the second kiln's.
      airFrom: rm ? rm.from : 0,
      airCut: rm ? (rm.second ? 1 - rm.out : rm.cut) : 0,
      // Fainter in the fire step, so the tiles' heat reads through the path.
      airAlpha: isFire ? 0.15 : 1,
      heat: lit,
      // From the lighting on, the kiln is drawn as the record has it — one
      // chamber being unloaded, one restacked — rather than as assembled.
      live: lit,
      // The firing zone is picked out by the floor under it, in the accent,
      // shared between the two chambers it lies across, with a bright bar at
      // its leading edge (front).
      fireAt: m ? m.fireAt : rm ? pair.on.firePos : null,
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
    if (i !== shown) fill(i);

    // Keep the kiln clear of the panels. The same room is kept on both sides
    // for the whole tour — the widest panel plus a gap — so the kiln stays
    // centred and one size from the first step to the last, and nothing is
    // ever drawn underneath a panel. It eases down from the intro's full-size
    // kiln as the tour opens, and back up as it closes.
    const reserve = Math.max(card.offsetWidth, compute.offsetWidth, recover.offsetWidth, figure.offsetWidth) + margin + 28;
    const fit = Math.min(1, Math.max(0.45, (w - 2 * reserve) / (ring.kilnShare() * w)));
    const settle = smooth(0, 45, scrolled) * (1 - smooth(steps + TAIL_VH * 0.5, steps + TAIL_VH, scrolled));
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
    // Held across the two panel steps, so the kiln does not step back and
    // forward again as one note gives way to the other.
    const held = isFire ? smooth(0, 0.14 * k, f) : isRecover ? fadeOut : 0;
    const near = fireFit > fit ? held : 0;
    const zoom = fit + (fireFit - fit) * near;
    ring.setZoom(1 + (zoom - 1) * settle, ((card.offsetWidth - pw) / 2) * near);

    if (panel) {
      // No leader and no image: the note takes the left margin, the computed
      // panel the right, both fixed, and the numbers on the kiln do the
      // pointing. Nothing here follows the fire around the screen.
      if (isFire) drawCompute(m); else drawRecover(rm);
      svg.style.opacity = '0';
      hide(figure, card2, figure2, isFire ? recover : compute);
      show(panel, a);
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
    const drawLeader = (ax, ay, c, cx, cy, onLeft, n = 0) => {
      const L = leaders[n];
      const ex = onLeft ? cx + c.offsetWidth : cx;
      const ey = Math.min(cy + c.offsetHeight - 12, Math.max(cy + 12, ay));
      L.line.setAttribute('x1', ax.toFixed(1));
      L.line.setAttribute('y1', ay.toFixed(1));
      L.line.setAttribute('x2', ex.toFixed(1));
      L.line.setAttribute('y2', ey.toFixed(1));
      for (const c2 of [L.dot, L.halo]) {
        c2.setAttribute('cx', ax.toFixed(1));
        c2.setAttribute('cy', ay.toFixed(1));
      }
    };

    if (parts.length > 1) {
      // A note either side of the kiln, each on the side its part is nearer,
      // with its image inside it, under the words, and each with a leader.
      const pts = parts.map((p) => at(p.id));
      const firstLeft = pts[0][0] <= pts[1][0];
      parts.forEach((p, k) => {
        const slot = slots[k];
        const onLeft = k === 0 ? firstLeft : !firstLeft;
        const c = slot.card; const fg = slot.figure;
        const cw = c.offsetWidth; const ch = c.offsetHeight;
        const fh = 0;
        const x = onLeft ? margin : w - margin - cw;
        const top = Math.max(20, (h - ch) / 2);
        const strength = a;
        c.dataset.side = onLeft ? 'left' : 'right';
        c.dataset.on = 'true';
        c.style.transform = `translate(${x.toFixed(1)}px, ${(top + fh).toFixed(1)}px)`;
        show(c, strength);
        if (!slot.has) hide(fg);
        drawLeader(pts[k][0], pts[k][1], c, x, top + fh, onLeft, k);
      });
      for (const e of Object.values(leaders[1])) e.style.display = '';
      return;
    }
    hide(card2, figure2);
    for (const e of Object.values(leaders[1])) e.style.display = 'none';
    card.dataset.on = 'true';
    show(figure, a);

    // Leader line: from the part to the near edge of the card, which sits in
    // the margin on the same side of the kiln as the part, so the leader
    // never crosses the kiln.
    const [ax, ay] = at(parts[0].id);
    side = parts[0].side ?? (ax < w / 2 ? 'left' : 'right');
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
    drawLeader(ax, ay, card, cx, cy, side === 'left');
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
