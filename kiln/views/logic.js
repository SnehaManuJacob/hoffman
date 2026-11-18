/**
 * "The logic in the kiln": after the tour, before the dashboard.
 *
 * The kiln and its grid fade out, the eight chamber numbers stay behind and
 * straighten into a row, and five cards follow, one idea each. The cards are
 * a READING of the kiln, an analogy with computing; they are neither field
 * observation nor literature, and the introduction says so (see also config
 * METHODS, "The logic in the kiln").
 *
 * Like the tour, everything here is placed by the scroll and nothing by a
 * timer, so it all runs backwards when the visitor scrolls back. And like the
 * tour it reads the recorded loop (tourRun.js): the stages in the Algorithm
 * and Pipeline cards and the temperatures in the Forwarding and Trigger cards
 * are the model's, not drawn by hand.
 *
 * The section is pulled up over the tour's tail (a negative top margin), so
 * its backdrop can fade in over the kiln while the tour's last note is still
 * leaving, rather than sliding in after it.
 */

import { relativeHeat } from '../engine.js';
import { heatHex } from './heatRamp.js';
import { TAIL_VH } from './anatomy.js';

const NS = 'http://www.w3.org/2000/svg';
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, k) => a + (b - a) * k;

/** The section's scroll, in viewport heights from where its pin takes hold. */
const AT = {
  SHADE: [8, 40],          // the kiln and grid go under a plain ground
  CELLS_IN: [4, 20],       // the eight numbers appear where the chambers are
  TO_ROW: [30, 62],        // and straighten into a row
  INTRO_IN: [48, 72],
  INTRO_OUT: [138, 160],   // gone before the dark panel rises over it
  CARDS: 172,              // the first card starts here
  CARD: 125,               // each card's run
  END: 60,                 // held on the question; the problem section's
                           // pin comes up over this (views/problem.js)
};

/** How much of the end the next section overlaps. */
export const LOGIC_TAIL_VH = AT.END;

/**
 * After the last card, in vh from the end of its run. The panel and what is
 * on it go, the five terms scatter over the clay, and then a purple ground
 * comes up with the question that opens the dryer.
 */
const AFTER = {
  CARD_OUT: [0, 14],       // the last card's words and drawing, and the numbers
  PANEL_OUT: [6, 28],      // then the dark panel itself
  SCATTER: [4, 62],        // the terms leave the card's title and spread out
  PURPLE: [96, 128],       // held scattered a while first
  ASK: [112, 142],
  LEN: 150,
};

/**
 * Where each term comes to rest, as fractions of the screen (its centre) and
 * a size relative to the cards' titles. Placed by hand, not by Math.random:
 * the scatter has to look loose but land the same way every time, scrolling
 * down or back up, and leave the middle clear for the question.
 */
const SCATTER = {
  // Loosely round the middle, like the corners of a lopsided pentagon: one
  // over the top, one high on each side, two low. Each is pulled a little
  // off the true shape so it does not read as a figure.
  loop: [0.55, 0.13, 1.3],
  trigger: [0.84, 0.35, 1.05],
  pipeline: [0.72, 0.84, 0.95],
  forward: [0.28, 0.87, 0.85],
  rule: [0.15, 0.27, 1.0],
};

export const STAGE = {
  fire: { label: 'Firing', fill: '#e0563a' },
  preheat: { label: 'Preheating', fill: '#f0b24a' },
  cool: { label: 'Cooling', fill: '#b98f6a' },
  wait: { label: 'Stacked, waiting', fill: '#6f6a62' },
  empty: { label: 'Unloading', fill: 'none' },
};

const CARDS = [
  {
    id: 'rule', term: 'Algorithm',
    text: 'A short procedure: the same three steps, in the same order, every time.',
  },
  {
    id: 'loop', term: 'Loop',
    text: 'After the last chamber comes the first, so the procedure never has to stop.',
  },
  {
    id: 'pipeline', term: 'Pipeline',
    text: 'Eight loads, each at a different stage, all at once. The loads stay put; the stages move round them.',
  },
  {
    // Forwarding, the pipeline's word for handing a stage's result straight to
    // the next stage that needs it. Not "reuse": that word is kept for the
    // dashboard's recovery control and nowhere else (index.html).
    id: 'forward', term: 'Forwarding',
    text: 'What one stage throws away is handed straight to the next, which needs it.',
  },
  {
    // Last on purpose: the one idea the dryer proposal changes. The kiln's
    // recorded rule is time-triggered; the dryer's would be condition-triggered.
    id: 'trigger', term: 'Trigger',
    text: 'The fire moves on when two hours are up, not when the tiles are ready.',
  },
];

export function createLogic({ sectionEl, ring, run }) {
  const count = run.count;
  const T = run.tickHours;
  const cardsEnd = AT.CARDS + CARDS.length * AT.CARD;
  const total = cardsEnd + AFTER.LEN + AT.END;
  sectionEl.style.height = `${total + 100}vh`;
  sectionEl.style.marginTop = `-${100 + TAIL_VH}vh`;

  const pin = sectionEl.querySelector('.logic-pin');
  const shade = sectionEl.querySelector('.logic-shade');
  const intro = sectionEl.querySelector('.logic-intro');
  const cellsEl = sectionEl.querySelector('.logic-cells');
  const deck = sectionEl.querySelector('.logic-deck');
  const termsEl = sectionEl.querySelector('.logic-terms');
  const ask = sectionEl.querySelector('.logic-ask');
  const question = sectionEl.querySelector('.logic-question');

  // ------------------------------------------------ the eight travelling cells
  const cells = [];
  for (let i = 0; i < count; i++) {
    const c = document.createElement('span');
    c.textContent = String(i + 1);
    cellsEl.append(c);
    cells.push(c);
  }
  // Where each chamber's number stood on the kiln, kept from the last frame
  // the tour was still showing it (the camera moves on once the tour ends).
  const from = cells.map(() => [0, 0]);
  let captured = false;

  // ------------------------------------------------------------------ helpers
  const el = (parent, tag, attrs = {}, text) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    parent.append(e);
    return e;
  };
  const stageAt = (tick) => run.at(Math.min(run.totalHours - 1e-6, tick * T + T / 2));
  const mod = (n) => ((n % count) + count) % count;

  // ------------------------------------------------------------------ the cards
  const W = 640; const H = 400;
  const cards = CARDS.map((card, n) => {
    const node = document.createElement('article');
    node.className = 'logic-card';
    node.dataset.id = card.id;
    node.innerHTML = `
      <div class="logic-card-words">
        <p class="logic-card-n">${n + 1} of ${CARDS.length}</p>
        <h3></h3>
        <p class="logic-card-text"></p>
      </div>
      <svg class="logic-card-art" viewBox="0 0 ${W} ${H}" role="img"></svg>`;
    node.querySelector('h3').textContent = card.term;
    node.querySelector('.logic-card-text').textContent = card.text;
    const art = node.querySelector('svg');
    art.setAttribute('aria-label', card.text);
    deck.append(node);
    return { ...card, node, art, draw: null, spots: [] };
  });
  const byId = Object.fromEntries(cards.map((c) => [c.id, c]));

  // The five terms, loose, for the scatter after the last card.
  const terms = cards.map((card) => {
    const s = document.createElement('span');
    s.textContent = card.term;
    termsEl.append(s);
    return { id: card.id, node: s, rest: SCATTER[card.id] };
  });
  const lastTitle = cards[cards.length - 1].node.querySelector('h3');

  // One dark panel behind every card. It comes up once and stays; only the
  // words and drawing on it change from card to card.
  const panel = document.createElement('div');
  panel.className = 'logic-panel';
  deck.prepend(panel);

  /**
   * Where a card wants chamber `ch`'s number: the centre of the label, in the
   * drawing's own units, and its size. The cards draw no numbers of their
   * own. The eight HTML numbers that came off the kiln travel to these spots
   * instead, so the same "3" is the one the visitor has been following since
   * the tour, now as a cell in a row, now a dot on a ring, now a row label.
   */
  const spot = (card, ch, x, y, size = 15) => { card.spots[ch] = [x, y, size]; };

  // A row of eight cells, used by two of the cards.
  const CELL = 52; const GAP = 14;
  const rowX = (k) => (W - (count * CELL + (count - 1) * GAP)) / 2 + k * (CELL + GAP);
  const paint = (rect, stage, temp) => {
    if (stage === 'empty') {
      rect.setAttribute('fill', 'none');
      rect.setAttribute('class', 'lc-cell is-empty');
    } else {
      rect.setAttribute('fill', temp == null ? STAGE[stage].fill : heatHex(relativeHeat(temp)));
      rect.setAttribute('class', 'lc-cell');
    }
  };

  // ---- 1. Algorithm: three numbered steps, run in order ---------------------
  // What a procedure looks like written down: numbered lines, read top to
  // bottom. A pointer runs down them, and each line does its one thing to
  // the row of chambers below. The steps are the engine's own, in the order
  // it runs them (engine.js: the fire moves, then the crew empties, then
  // fills). The changes are read from two recorded moments either side of a
  // move and applied line by line, so nothing in the row is drawn by hand.
  // No clock here on purpose: WHEN the steps run is the Trigger card's.
  {
    const g = byId.rule.art;
    const MOVES = 3;
    const LINES = [
      'move the fire into the next chamber',
      'empty a chamber that has cooled',
      'stack green tiles in an empty one',
    ];
    const lx = 96; const ly = 58; const lh = 46;
    const hi = el(g, 'rect', { class: 'lc-box is-on', x: lx - 22, y: ly - 4, width: 498, height: 40, rx: 10 });
    const lineEls = LINES.map((t, i) => {
      el(g, 'text', { class: 'lc-key', x: lx, y: ly + i * lh + 22 }, String(i + 1));
      return el(g, 'text', { class: 'lc-line', x: lx + 30, y: ly + i * lh + 23 }, t);
    });

    const y = 250;
    const rects = [];
    for (let k = 0; k < count; k++) {
      rects.push(el(g, 'rect', { x: rowX(k), y, width: CELL, height: CELL, rx: 9 }));
      spot(byId.rule, k, rowX(k) + CELL / 2, y + CELL + 16);
    }
    // Where the current line is acting.
    const focus = el(g, 'rect', { class: 'lc-mark is-on', y: y - 5, width: CELL + 10, height: CELL + 10, rx: 12 });

    // One move's worth of change, split by which line causes it.
    const steps = [];
    for (let n = 0; n <= MOVES; n++) {
      const a = stageAt(n); const b = stageAt(n + 1);
      const out = []; const inn = [];
      a.chambers.forEach((c, k) => {
        if (c.loaded && !b.chambers[k].loaded) out.push(k);
        if (!c.loaded && b.chambers[k].loaded) inn.push(k);
      });
      steps.push({ a, b, out, inn });
    }

    let shown = '';
    byId.rule.draw = (p) => {
      const q = clamp01((p - 0.12) / 0.8) * MOVES;
      const n = Math.min(MOVES - 1, Math.floor(q));
      const frac = q >= MOVES ? 1 : q - n;
      const line = Math.min(2, Math.floor(frac * 3));           // which line the pointer is on
      const done = (frac * 3 - line) > 0.25 || frac >= 1;       // has that line acted yet
      const key = `${n}:${line}:${done}`;
      if (key === shown) return;
      shown = key;

      hi.setAttribute('y', (ly - 4 + line * lh).toFixed(1));
      lineEls.forEach((t, i) => t.classList.toggle('is-dim', i !== line));

      const { a, b, out, inn } = steps[n];
      const reached = line + (done ? 1 : 0);                   // lines that have acted
      a.chambers.forEach((c, k) => {
        let stage = c.stage;
        if (reached >= 1 && !out.includes(k) && !inn.includes(k)) stage = b.chambers[k].stage;
        if (reached >= 2 && out.includes(k)) stage = b.chambers[k].stage;
        if (reached >= 3 && inn.includes(k)) stage = b.chambers[k].stage;
        paint(rects[k], stage);
      });
      const target = line === 0 ? [reached >= 1 ? b.firePos : a.firePos]
        : line === 1 ? out : inn;
      focus.style.opacity = target.length ? '1' : '0';
      if (target.length) focus.setAttribute('x', (rowX(target[0]) - 5).toFixed(1));
    };
  }

  // ---- 2. Loop: the counter that wraps ---------------------------------------
  {
    const g = byId.loop.art;
    const cx = W / 2; const cy = H / 2; const R = 138;
    const pt = (pos) => {
      const a = (-90 + pos * (360 / count)) * Math.PI / 180;
      return [cx + Math.cos(a) * R, cy + Math.sin(a) * R];
    };
    el(g, 'circle', { class: 'lc-track', cx, cy, r: R });
    // The join the whole idea rests on: from the last chamber to the first.
    const [x8, y8] = pt(count - 1); const [x1, y1] = pt(count);
    const join = el(g, 'path', { class: 'lc-join', d: `M${x8.toFixed(1)} ${y8.toFixed(1)} A${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}` });
    const dots = [];
    for (let k = 0; k < count; k++) {
      const [x, y] = pt(k);
      dots.push(el(g, 'circle', { class: 'lc-dot', cx: x.toFixed(1), cy: y.toFixed(1), r: 24 }));
      spot(byId.loop, k, x, y, 17);
    }
    const marker = el(g, 'circle', { class: 'lc-marker', r: 31 });
    const big = el(g, 'text', { class: 'lc-big', x: cx, y: cy + 22 });
    const START = 5; const STEPS = 5;                 // chamber 6 round to chamber 3
    byId.loop.draw = (p) => {
      const u = clamp01((p - 0.14) / 0.72) * STEPS;
      const k = Math.min(STEPS, Math.floor(u));
      const pos = START + k + smooth(0.45, 1, u - k) * (k < STEPS ? 1 : 0);
      const [x, y] = pt(pos);
      marker.setAttribute('cx', x.toFixed(1));
      marker.setAttribute('cy', y.toFixed(1));
      const here = mod(Math.round(pos));
      dots.forEach((d, i) => d.classList.toggle('is-on', i === here));
      byId.loop.lit = here;                            // its number goes dark on the lit dot
      big.textContent = String(here + 1);
      const crossing = pos > count - 1.02 && pos < count + 0.6;
      join.classList.toggle('is-on', crossing);
    };
  }

  // ---- 3. Pipeline: every chamber's stages against time ----------------------
  {
    const g = byId.pipeline.art;
    const x0 = 86; const y0 = 44; const cw = 60; const rh = 30; const gap = 5;
    const cols = [];
    for (let c = 0; c < count; c++) {
      const col = el(g, 'g');
      const frame = stageAt(c);
      for (let r = 0; r < count; r++) {
        const rect = el(col, 'rect', {
          x: x0 + c * cw, y: y0 + r * (rh + gap), width: cw - gap, height: rh, rx: 5,
        });
        paint(rect, frame.chambers[r].stage);
      }
      cols.push(col);
    }
    for (let r = 0; r < count; r++) {
      spot(byId.pipeline, r, x0 - 22, y0 + r * (rh + gap) + rh / 2);
    }
    // A key, in the order a load goes through them.
    let kx = x0;
    for (const key of ['wait', 'preheat', 'fire', 'cool', 'empty']) {
      const s = STAGE[key];
      const sw = el(g, 'rect', { x: kx, y: H - 30, width: 12, height: 12, rx: 3 });
      paint(sw, key);
      const t = el(g, 'text', { class: 'lc-key', x: kx + 18, y: H - 19.5 }, s.label);
      kx += 18 + t.getComputedTextLength() + 18;
      // Not laid out yet when hidden: fall back to a width from the text.
      if (!t.getComputedTextLength()) kx += s.label.length * 6.2;
    }
    byId.pipeline.draw = (p) => {
      const q = clamp01((p - 0.14) / 0.6) * count;
      cols.forEach((col, c) => { col.style.opacity = smooth(c, c + 1, q).toFixed(3); });
    };
  }

  // ---- 4. Forwarding: heat leaving the fire, taken up by the chambers ahead ---
  {
    const g = byId.forward.art;
    const pair = run.pair;
    const y = 200;
    if (pair) {
      const pre = pair.on.params.window.pre;
      const FIRE_AT = 2;                                // the fire's place in the row
      const order = Array.from({ length: count }, (_, k) => mod(pair.on.firePos - FIRE_AT + k));
      const rects = order.map((ch, k) => {
        const r = el(g, 'rect', { class: 'lc-cell', x: rowX(k), y, width: CELL, height: CELL, rx: 9 });
        spot(byId.forward, ch, rowX(k) + CELL / 2, y + CELL + 16);
        return r;
      });
      // The heat's way: up out of the fire, over the chambers ahead, and down
      // into each in turn.
      const xs = rowX(FIRE_AT) + CELL / 2;
      const top = y - 62;
      const flows = [];
      for (let j = 1; j <= pre; j++) {
        const xe = rowX(FIRE_AT + j) + CELL / 2;
        const d = `M${xs} ${y - 8} V${top + 14} Q${xs} ${top} ${xs + 14} ${top} H${xe - 14} Q${xe} ${top} ${xe} ${top + 14} V${y - 14}`;
        const path = el(g, 'path', { class: 'lc-flow', d });
        const len = path.getTotalLength() || 1;
        path.setAttribute('stroke-dasharray', `${len} ${len}`);
        const head = el(g, 'path', { class: 'lc-flowhead', d: `M${xe - 6} ${y - 16} L${xe} ${y - 8} L${xe + 6} ${y - 16}` });
        flows.push({ path, len, head });
      }
      byId.forward.draw = (p) => {
        const q = clamp01((p - 0.14) / 0.62);
        order.forEach((ch, k) => {
          const j = k - FIRE_AT;                         // how far ahead of the fire
          const ahead = j >= 1 && j <= pre;
          // Ahead of the fire each chamber starts as it would be with no heat
          // sent its way, and warms to what the model has it at.
          const reach = ahead ? smooth((j - 1) / pre * 0.7 + 0.2, (j - 1) / pre * 0.7 + 0.5, q) : 1;
          const temp = lerp(pair.off.chambers[ch].temp, pair.on.chambers[ch].temp, reach);
          rects[k].setAttribute('fill', heatHex(relativeHeat(temp)));
        });
        flows.forEach(({ path, len, head }, j) => {
          const d = smooth(j / pre * 0.7, j / pre * 0.7 + 0.3, q);
          path.setAttribute('stroke-dashoffset', (len * (1 - d)).toFixed(1));
          head.style.opacity = smooth(0.92, 1, d).toFixed(3);
        });
      };
    } else {
      for (let k = 0; k < count; k++) spot(byId.forward, k, rowX(k) + CELL / 2, y + CELL + 16);
      byId.forward.draw = () => {};
    }
  }

  // ---- 5. Trigger: the clock is the only input ------------------------------
  // A box standing for card 1's three steps, wired to a clock and to nothing
  // else. Below
  // it, the chambers keep changing temperature the whole time (the model's,
  // read from the recorded loop), but the fire jumps only when the clock
  // comes round. The tiles' input is drawn as a socket left empty: the
  // recorded rule does not read them. Whether the stokers do, within a slot,
  // is not known (config METHODS), which is why the label says "rule".
  {
    const g = byId.trigger.art;
    const HOURS = 6.6;                                  // three moves, then a short hold
    const by = 52; const bh = 68; const bx = 236; const bw = 178;
    const mid = by + bh / 2;
    // The clock.
    const R = 30; const round = 2 * Math.PI * R; const dcx = 118;
    el(g, 'circle', { class: 'lc-track', cx: dcx, cy: mid, r: R });
    const sweep = el(g, 'circle', {
      class: 'lc-sweep', cx: dcx, cy: mid, r: R,
      'stroke-dasharray': `${round.toFixed(1)} ${round.toFixed(1)}`,
      transform: `rotate(-90 ${dcx} ${mid})`,
    });
    el(g, 'text', { class: 'lc-boxtext is-mid', x: dcx, y: mid + 7 }, '2 h');
    el(g, 'text', { class: 'lc-key is-mid', x: dcx, y: mid + R + 24 }, 'clock');
    // Its wire into the box.
    const wire = el(g, 'path', { class: 'lc-wire', d: `M${dcx + R + 4} ${mid} H${bx - 2}` });
    const wireHead = el(g, 'path', { class: 'lc-wirehead', d: `M${bx - 10} ${mid - 6} L${bx - 2} ${mid} L${bx - 10} ${mid + 6}` });
    // The box.
    const box = el(g, 'rect', { class: 'lc-box', x: bx, y: by, width: bw, height: bh, rx: 14 });
    // What the clock starts: card 1's procedure, named rather than redrawn.
    el(g, 'text', { class: 'lc-boxtext is-mid', x: bx + bw / 2, y: mid + 7 }, 'the 3 steps');
    // The input that is not there: a stub hanging from the box, open at its end.
    const sx = bx + bw / 2;
    el(g, 'path', { class: 'lc-socket', d: `M${sx} ${by + bh} V${by + bh + 40}` });
    el(g, 'circle', { class: 'lc-socket', cx: sx, cy: by + bh + 47, r: 7 });
    el(g, 'text', { class: 'lc-line-soft', x: sx + 20, y: by + bh + 32 }, 'the tiles');
    el(g, 'text', { class: 'lc-key', x: sx + 20, y: by + bh + 52 }, 'not an input to the rule');

    // The chambers, coloured by the model's temperature.
    const y = 222;
    const rects = [];
    for (let k = 0; k < count; k++) {
      rects.push(el(g, 'rect', { class: 'lc-cell', x: rowX(k), y, width: CELL, height: CELL, rx: 9 }));
      spot(byId.trigger, k, rowX(k) + CELL / 2, y + CELL + 16);
    }
    const fireMark = el(g, 'rect', { class: 'lc-mark is-on', y: y - 5, width: CELL + 10, height: CELL + 10, rx: 12 });

    // A time axis under the row: one mark for every time the clock comes round.
    const tl = y + CELL + 54;
    const tx0 = rowX(0); const tx1 = rowX(count - 1) + CELL;
    const tx = (h) => lerp(tx0, tx1, h / HOURS);
    el(g, 'path', { class: 'lc-wire', d: `M${tx0} ${tl} H${tx1}` });
    const marks = [];
    for (let h = 0; h <= HOURS; h += T) {
      marks.push({ h, node: el(g, 'path', { class: 'lc-tick', d: `M${tx(h)} ${tl - 8} V${tl + 8}` }) });
      el(g, 'text', { class: 'lc-key is-mid', x: tx(h), y: tl + 28 }, `${h} h`);
    }
    const now = el(g, 'circle', { class: 'lc-token', cy: tl, r: 6 });

    let shown = null;
    byId.trigger.draw = (p) => {
      const h = clamp01((p - 0.12) / 0.78) * HOURS;
      const into = h % T;                               // hours since the clock last came round
      sweep.setAttribute('stroke-dashoffset', (round * (1 - into / T)).toFixed(1));
      const fired = h >= T && into < 0.4;               // just came round: the box acts
      box.classList.toggle('is-on', fired);
      wire.classList.toggle('is-on', fired);
      wireHead.classList.toggle('is-on', fired);
      marks.forEach(({ h: mh, node }) => node.classList.toggle('is-on', h >= mh));
      now.setAttribute('cx', tx(h).toFixed(1));

      const frame = run.at(Math.min(run.totalHours - 1e-6, h));
      if (frame !== shown) {
        frame.chambers.forEach((c, k) => paint(rects[k], c.stage, c.temp));
        fireMark.setAttribute('x', (rowX(frame.firePos) - 5).toFixed(1));
        shown = frame;
      }
    };
  }

  // ------------------------------------------------------------------ the scroll
  function measure() {
    const top = sectionEl.getBoundingClientRect().top;
    const scrolled = -top / window.innerHeight * 100;
    const scrollable = sectionEl.offsetHeight - window.innerHeight;
    const done = scrollable > 0 && -top / scrollable >= 0.999;
    return { scrolled, done };
  }

  /**
   * The hand-overs, in cards: c = 0 is where card 1 begins, c = 1 card 2.
   * Each card's words and drawing fade out at the end of its run and the
   * next card's fade in; across that gap the numbers travel from one card's
   * spots to the next. The first hand-over is from the intro's row.
   */
  const TRAVEL = 0.16;       // half a hand-over, in cards
  const STAGGER = 0.014;     // each number sets off a little after the one before
  const BASE_PX = 16;        // the numbers' size in the intro's row
  const SWELL = 7;           // px added at the middle of a journey

  /** A card's number spots in the pin's pixels: [x, y, font px] per chamber. */
  function spotsOf(card, pinBox) {
    const r = card.art.getBoundingClientRect();
    // The drawing is fitted into its box the SVG way ("meet", centred).
    const k = Math.min(r.width / W, r.height / H);
    const ox = r.left + (r.width - W * k) / 2 - pinBox.left;
    const oy = r.top + (r.height - H * k) / 2 - pinBox.top;
    return card.spots.map(([x, y, size]) => [ox + x * k, oy + y * k, size * k]);
  }

  function update() {
    const { scrolled } = measure();
    const on = scrolled > 0 && scrolled < total + 1;
    pin.style.visibility = on ? 'visible' : 'hidden';
    if (!on) return;

    const w = pin.clientWidth; const h = pin.clientHeight;
    const lit = smooth(AT.SHADE[0], AT.SHADE[1], scrolled);
    shade.style.opacity = lit.toFixed(3);
    // The numbers turn from light to dark ink as the ground under them does.
    cellsEl.style.setProperty('--lit', smooth(0.35, 0.75, lit).toFixed(3));

    // The numbers: on the kiln while it is still the tour's, then in a row.
    if (scrolled < TAIL_VH || !captured) {
      const v = ring.chamberPoint(0).clone();
      for (let i = 0; i < count; i++) {
        v.copy(ring.chamberPoint(i)).project(ring.camera);
        from[i] = [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h];
      }
      captured = true;
    }
    const toRow = smooth(AT.TO_ROW[0], AT.TO_ROW[1], scrolled);
    const size = Math.min(64, w * 0.045);
    const step = size * 1.28;
    const leave = 1 - smooth(AT.INTRO_OUT[0], AT.INTRO_OUT[1], scrolled);
    // After the last card: k in vh past the end of its run.
    const k = scrolled - cardsEnd;
    const cardOut = smooth(AFTER.CARD_OUT[0], AFTER.CARD_OUT[1], k);
    const panelOut = smooth(AFTER.PANEL_OUT[0], AFTER.PANEL_OUT[1], k);
    // They stay on through every card, carrying over from one to the next,
    // and go with the last card's drawing.
    cellsEl.style.opacity = (smooth(AT.CELLS_IN[0], AT.CELLS_IN[1], scrolled) * (1 - cardOut)).toFixed(3);
    cellsEl.style.setProperty('--cell', `${size.toFixed(1)}px`);
    const pos = cells.map((_, i) => [
      lerp(from[i][0], w / 2 + (i - (count - 1) / 2) * step, toRow),
      lerp(from[i][1], h * 0.7, toRow),
    ]);
    const px = cells.map(() => BASE_PX);

    // Then from card to card.
    const c = (scrolled - AT.CARDS) / AT.CARD;
    const pinBox = pin.getBoundingClientRect();
    for (let n = 0; n < cards.length; n++) {
      const start = n - TRAVEL; const end = n + TRAVEL;
      if (c <= start) break;
      const spots = spotsOf(cards[n], pinBox);
      for (let i = 0; i < count; i++) {
        const t = smooth(start + i * STAGGER, end - (count - 1 - i) * STAGGER, c);
        if (t <= 0) continue;
        pos[i] = [lerp(pos[i][0], spots[i][0], t), lerp(pos[i][1], spots[i][1], t)];
        // A swell in flight, so the numbers carry the gap between two cards
        // while there is nothing else on the panel.
        px[i] = lerp(px[i], spots[i][2], t) + SWELL * Math.sin(Math.PI * t);
      }
    }
    const onCard = smooth(-TRAVEL, TRAVEL, c);
    // On the dark panel: light ink, and no box (the cards draw their own cells).
    cellsEl.style.setProperty('--oncard', onCard.toFixed(3));
    cellsEl.style.setProperty('--boxed', (toRow * (1 - onCard)).toFixed(3));
    const loopLit = c > 1.1 && c < 1.88 ? byId.loop.lit : -1;
    cells.forEach((cell, i) => {
      cell.style.transform = `translate(${pos[i][0].toFixed(1)}px, ${pos[i][1].toFixed(1)}px) translate(-50%, -50%)`;
      cell.style.fontSize = `${px[i].toFixed(1)}px`;
      cell.classList.toggle('is-on', i === loopLit);
    });

    const introA = smooth(AT.INTRO_IN[0], AT.INTRO_IN[1], scrolled) * leave;
    intro.style.opacity = introA.toFixed(3);
    intro.style.transform = `translate(-50%, -50%) translateY(${((1 - smooth(AT.INTRO_IN[0], AT.INTRO_IN[1], scrolled)) * 24 - (1 - leave) * 24).toFixed(1)}px)`;

    // The panel comes up once, as the intro goes, and then holds still.
    const up = smooth(-0.1, 0.06, c);
    const lift = `translate(-50%, -50%) translateY(${((1 - up) * 24).toFixed(1)}px)`;
    panel.style.opacity = (up * (1 - panelOut)).toFixed(3);
    panel.style.transform = lift;

    // Measured before the last card's opacity is touched below; the title
    // keeps its layout either way (visibility, never display).
    const titleBox = k > 0 ? textBox(lastTitle, pinBox) : null;

    cards.forEach((card, n) => {
      const last = n === cards.length - 1;
      const a = smooth(n + 0.06, n + 0.18, c) * (last ? 1 - cardOut : 1 - smooth(n + 0.82, n + 0.94, c));
      // Every card sits exactly over the panel, so its spots are where the
      // numbers land, whether it is showing yet or not.
      card.node.style.transform = lift;
      if (a <= 0) { card.node.style.opacity = '0'; card.node.style.visibility = 'hidden'; return; }
      card.node.style.visibility = 'visible';
      card.node.style.opacity = a.toFixed(3);
      card.draw(clamp01(c - n));
    });

    // ---- the scatter, then the question
    const purple = smooth(AFTER.PURPLE[0], AFTER.PURPLE[1], k);
    termsEl.style.visibility = k > 0 ? 'visible' : 'hidden';
    if (titleBox) {
      // White on the panel, the clay's dark ink once it has gone, and a dark
      // purple ghost behind the question.
      termsEl.style.setProperty('--onpanel', (1 - panelOut).toFixed(3));
      termsEl.style.setProperty('--purple', purple.toFixed(3));
      const [x0, y0, px0] = titleBox;
      const [s0, s1] = AFTER.SCATTER;
      const stagger = (s1 - s0) * 0.12;
      const last = terms.length - 1;
      terms.forEach((term, i) => {
        // The others peel off the last card's title first; its own term,
        // which sits exactly over that title, leaves last.
        const order = i === last ? last : i;
        const t = smooth(s0 + order * stagger, s1 - (last - order) * stagger, k);
        const [fx, fy, scale] = term.rest;
        const px = lerp(px0, px0 * scale, t);
        term.node.style.fontSize = `${px.toFixed(1)}px`;
        // Kept whole on screen however narrow: its half-width at rest, from
        // its width now (the text scales with its size).
        const half = (term.node.offsetWidth / px) * px0 * scale / 2 + 16;
        const fxPx = Math.min(w - half, Math.max(half, fx * w));
        const x = lerp(x0, fxPx, t); const y = lerp(y0, fy * h, t);
        term.node.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
        const shown = i === last ? 1 : smooth(0, 0.35, t);
        term.node.style.opacity = (shown * (1 - 0.72 * purple)).toFixed(3);
      });
    }

    ask.style.opacity = purple.toFixed(3);
    const said = smooth(AFTER.ASK[0], AFTER.ASK[1], k);
    question.style.opacity = said.toFixed(3);
    question.style.transform = `translate(-50%, -50%) translateY(${((1 - said) * 24).toFixed(1)}px)`;
  }

  /** The box round an element's text (not its block): [centre x, centre y, font px]. */
  function textBox(node, pinBox) {
    const range = document.createRange();
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    return [
      r.left + r.width / 2 - pinBox.left,
      r.top + r.height / 2 - pinBox.top,
      parseFloat(getComputedStyle(node).fontSize),
    ];
  }

  return {
    update,
    /** True once scrolled to the very end: time for the dashboard. */
    isDone: () => measure().done,
  };
}
