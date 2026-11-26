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
 * tour it reads the recorded loop (tourRun.js): the stages on every card and
 * the temperatures on the Forwarding card are the model's, not drawn by hand.
 *
 * The five drawings share one visual language: card 1's row of eight cells
 * in the stage colours, the chamber numbers under them, the accent purple
 * kept for the one thing to look at, a still opening so the words are read
 * first, and changes that fade with the scroll rather than jump.
 *
 * The section is pulled up over the tour's tail (a negative top margin), so
 * its backdrop can fade in over the kiln while the tour's last note is still
 * leaving, rather than sliding in after it.
 */

import { TAIL_VH } from './anatomy.js';

const NS = 'http://www.w3.org/2000/svg';
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, k) => a + (b - a) * k;

/** The section's scroll, in viewport heights from where its pin takes hold. */
/**
 * The pause on the question once the arecanut has landed on it (views/problem.js,
 * HOLD_AT): the story stands still for this much scroll so the nut and the words
 * are seen together. The question stays pinned through it.
 */
export const NUT_HOLD_VH = 40;

const AT = {
  SHADE: [8, 40],          // the kiln and grid go under a plain ground
  CELLS_IN: [4, 20],       // the eight numbers appear where the chambers are
  TO_ROW: [30, 62],        // and straighten into a row
  INTRO_IN: [48, 72],
  INTRO_OUT: [138, 160],   // gone before the dark panel rises over it
  CARDS: 172,              // the first card starts here
  CARD: 125,               // each card's run
  END: 60 + NUT_HOLD_VH,   // held on the question; the problem section's
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
  fire: { label: 'Firing', short: 'firing', fill: '#e0563a' },
  preheat: { label: 'Preheating', short: 'preheating', fill: '#f0b24a' },
  cool: { label: 'Cooling', short: 'cooling', fill: '#b98f6a' },
  wait: { label: 'Stacked, waiting', short: 'waiting', fill: '#6f6a62' },
  empty: { label: 'Unloading', short: 'unloading', fill: 'none' },
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
      <svg class="logic-card-art" viewBox="0 0 ${W} ${H}" aria-hidden="true"></svg>`;
    node.querySelector('h3').textContent = card.term;
    node.querySelector('.logic-card-text').textContent = card.text;
    const art = node.querySelector('svg');
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
  const paint = (rect, stage) => {
    if (stage === 'empty') {
      rect.setAttribute('fill', 'none');
      rect.setAttribute('class', 'lc-cell is-empty');
    } else {
      rect.setAttribute('fill', STAGE[stage].fill);
      rect.setAttribute('class', 'lc-cell');
    }
  };

  /**
   * A cell that can fade between stages, empty included: a dashed outline
   * (what an empty chamber looks like) under a filled square. Used by the
   * Algorithm and Loop cards, so both change their chambers the same way, by
   * the scroll and never at a jump.
   */
  const fadeCell = (g, x, y) => ({
    hole: el(g, 'rect', { class: 'lc-cell is-empty', fill: 'none', x, y, width: CELL, height: CELL, rx: 9 }),
    fill: el(g, 'rect', { class: 'lc-cell', x, y, width: CELL, height: CELL, rx: 9 }),
  });
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (h1, h2, t) => {
    const a = hex(h1); const b = hex(h2);
    return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(',')})`;
  };
  const setCell = ({ hole, fill }, from, to, t) => {
    const f0 = STAGE[from].fill; const f1 = STAGE[to].fill;
    const full0 = f0 !== 'none'; const full1 = f1 !== 'none';
    const solid = lerp(full0 ? 1 : 0, full1 ? 1 : 0, t);
    fill.setAttribute('fill', full0 && full1 ? mix(f0, f1, t) : (full0 ? f0 : f1));
    fill.style.opacity = solid.toFixed(3);
    hole.style.opacity = (1 - solid).toFixed(3);
  };

  // ---- 1. Algorithm: three numbered steps, run once, slowly -----------------
  // What a procedure looks like written down: numbered lines, read top to
  // bottom. The card opens still, so the words are read first; then a
  // highlight slides down the lines ONCE, and as it rests on each line only
  // the chambers that line changes fade to their new stage. One pass is
  // enough here: that it repeats for ever is the Loop card's idea, not this
  // one's. The steps are the engine's own, in the order it runs them
  // (engine.js: the fire moves, then the crew empties, then fills), and the
  // change is read from two recorded moments either side of one move, so
  // nothing in the row is drawn by hand. No clock here on purpose: WHEN the
  // steps run is the Trigger card's.
  {
    const g = byId.rule.art;
    const LINES = [
      'move the fire into the next chamber',
      'empty a chamber that has cooled',
      'stack green tiles in an empty one',
    ];
    const lx = 96; const ly = 58; const lh = 46;
    const hi = el(g, 'rect', { class: 'lc-box is-on', x: lx - 22, y: ly - 4, width: 498, height: 40, rx: 10 });
    LINES.forEach((t, i) => {
      el(g, 'text', { class: 'lc-key', x: lx, y: ly + i * lh + 22 }, String(i + 1));
      el(g, 'text', { class: 'lc-line', x: lx + 30, y: ly + i * lh + 23 }, t);
    });

    // The first recorded move in which a chamber is both emptied and filled,
    // so all three lines have something to do.
    let move = null;
    for (let n = 0; n < count && !move; n++) {
      const a = stageAt(n); const b = stageAt(n + 1);
      const out = []; const inn = []; const fire = [];
      a.chambers.forEach((c, k) => {
        const s = b.chambers[k];
        if (c.loaded && !s.loaded) out.push(k);
        else if (!c.loaded && s.loaded) inn.push(k);
        else if (c.stage !== s.stage) fire.push(k);
      });
      if (out.length && inn.length) move = { a, b, by: [fire, out, inn] };
    }
    if (!move) {
      const a = stageAt(0); const b = stageAt(1);
      move = { a, b, by: [a.chambers.map((_, k) => k), [], []] };
    }

    const y = 250;
    const cellEls = [];
    for (let k = 0; k < count; k++) {
      cellEls.push(fadeCell(g, rowX(k), y));
      spot(byId.rule, k, rowX(k) + CELL / 2, y + CELL + 16);
    }
    const lineOf = cellEls.map((_, k) => move.by.findIndex((ks) => ks.includes(k)));

    // Where the pointer is, in lines: still before 0 and after 2, sliding
    // between them, resting on each long enough for its change to be seen.
    const RUN = [0.22, 0.86];           // the pass, as a share of the card
    const REST = 0.62;                  // of each line's third, the part spent still
    byId.rule.draw = (p) => {
      const u = clamp01((p - RUN[0]) / (RUN[1] - RUN[0])) * 3;      // 0..3 across the pass
      const line = Math.min(2, Math.floor(u));
      const inLine = Math.min(1, u - line);
      // The highlight glides to the next line in the last part of each third.
      const glide = line < 2 ? smooth(REST, 1, inLine) : 0;
      hi.setAttribute('y', (ly - 4 + (line + glide) * lh).toFixed(1));
      hi.style.opacity = (smooth(RUN[0] - 0.06, RUN[0], p) * (1 - smooth(RUN[1], RUN[1] + 0.06, p))).toFixed(3);

      cellEls.forEach((cell, k) => {
        const by = lineOf[k];
        const from = move.a.chambers[k].stage; const to = move.b.chambers[k].stage;
        // A chamber changes while its own line is lit, in the middle of the rest.
        const t = by < 0 ? 0 : smooth(by + 0.12, by + REST - 0.08, u);
        setCell(cell, from, to, t);
      });
    };
  }

  // ---- 2. Loop: the same row, bent round so its ends meet --------------------
  // Card 1's eight cells, in the same stage colours, set on a ring. The fire
  // is marked the way card 1 marks things, with the accent outline, and the
  // card opens still the way card 1 does. Then the fire steps on four times,
  // chamber 6 round to chamber 2, and as it goes from the last chamber to the
  // first the join between them is drawn in the accent and stays drawn: the
  // one thing this card is about. The stages are the recorded loop's.
  {
    const g = byId.loop.art;
    const cx = W / 2; const cy = H / 2; const R = 128;
    const pt = (pos) => {
      const a = (-90 + pos * (360 / count)) * Math.PI / 180;
      return [cx + Math.cos(a) * R, cy + Math.sin(a) * R];
    };
    el(g, 'circle', { class: 'lc-track', cx, cy, r: R });
    // The join, from the last chamber to the first: drawn over the track as
    // the fire crosses it.
    const [x8, y8] = pt(count - 1); const [x1, y1] = pt(count);
    const join = el(g, 'path', { class: 'lc-join is-on', d: `M${x8.toFixed(1)} ${y8.toFixed(1)} A${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}` });
    const joinLen = join.getTotalLength() || (2 * Math.PI * R / count);
    join.setAttribute('stroke-dasharray', `${joinLen.toFixed(1)} ${joinLen.toFixed(1)}`);

    const cellEls = [];
    for (let k = 0; k < count; k++) {
      const [x, y] = pt(k);
      // The panel's own colour under each cell, so the ring does not show
      // through an empty one.
      el(g, 'rect', { x: x - CELL / 2, y: y - CELL / 2, width: CELL, height: CELL, rx: 9, style: 'fill: var(--card)' });
      cellEls.push(fadeCell(g, x - CELL / 2, y - CELL / 2));
      // Its number just outside the ring, where card 1 has it under the cell.
      const a = (-90 + k * (360 / count)) * Math.PI / 180;
      const out = R + CELL / 2 + 22;
      spot(byId.loop, k, cx + Math.cos(a) * out, cy + Math.sin(a) * out);
    }
    const marker = el(g, 'rect', { class: 'lc-mark is-on', width: CELL + 10, height: CELL + 10, rx: 12 });

    // Four recorded moves, starting with the fire in chamber 6, so the third
    // takes it from 8 to 1. The recording is exactly one turn of the kiln and
    // ends as it began, so the ticks wrap round it like the fire does.
    const STEPS = 4; const START = count - 3;
    let n0 = 0;
    for (let n = 0; n < count; n++) {
      if (stageAt(n).firePos === START) { n0 = n; break; }
    }
    const frames = Array.from({ length: STEPS + 1 }, (_, i) => stageAt(mod(n0 + i)));
    const pos0 = frames[0].firePos;

    const RUN = [0.22, 0.86];           // as card 1: still, the moves, still
    byId.loop.draw = (p) => {
      const u = clamp01((p - RUN[0]) / (RUN[1] - RUN[0])) * STEPS;
      const k = Math.min(STEPS - 1, Math.floor(u));
      // Each move: a short pause on the chamber, then the fire steps on and
      // the stages change with it.
      const t = smooth(0.35, 0.9, u - k);
      const pos = pos0 + k + t;
      const [x, y] = pt(pos);
      marker.setAttribute('x', (x - CELL / 2 - 5).toFixed(1));
      marker.setAttribute('y', (y - CELL / 2 - 5).toFixed(1));
      const a = frames[k].chambers; const b = frames[k + 1].chambers;
      cellEls.forEach((cell, i) => setCell(cell, a[i].stage, b[i].stage, t));
      // The join draws itself under the fire as it passes, and stays.
      const drawn = clamp01(pos - (count - 1));
      join.setAttribute('stroke-dashoffset', (joinLen * (1 - drawn)).toFixed(1));
    };
  }

  // ---- 3. Pipeline: card 1's row, and the same row two hours on, and on ------
  // Read in two beats, one per sentence of the card. First the row alone, the
  // kiln at one moment, its stages named right on it (no key to look away
  // to): eight loads, each at a different stage, all at once. Then the same
  // row again every two hours, stacked downwards like lines on a page. Each
  // column is one load and does not move; the fire, and every stage with it,
  // steps along the row, and a thin accent line drawn through the fire makes
  // that slant the thing the eye follows. The chamber numbers sit under the
  // newest row, as they sat under card 1's, and are pushed down as rows come.
  {
    const card = byId.pipeline;
    const g = card.art;
    const ROWS = 4;
    const PITCH = 62;                            // row to row
    const x0 = 128;                              // room on the left for the times
    const cx = (k) => x0 + k * (CELL + 12);
    const top = 86;
    const ry = (r) => top + r * PITCH;

    // Start where the fire has room to step right three times without wrapping,
    // so the line through it is one straight slant.
    let n0 = 0;
    for (let n = 0; n < count; n++) {
      if (stageAt(n).firePos <= count - ROWS) { n0 = n; break; }
    }
    const frames = Array.from({ length: ROWS }, (_, r) => stageAt(n0 + r));

    // The fire's path, drawn first so the cells sit over it and it shows only
    // in the gaps between them.
    const firePts = frames.map((f, r) => [cx(f.firePos) + CELL / 2, ry(r) + CELL / 2]);
    const path = el(g, 'path', {
      class: 'lc-path',
      d: firePts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' '),
    });
    const pathLen = path.getTotalLength() || (PITCH * (ROWS - 1) * 1.4);
    path.setAttribute('stroke-dasharray', `${pathLen.toFixed(1)} ${pathLen.toFixed(1)}`);

    const rows = frames.map((frame, r) => {
      const row = el(g, 'g');
      for (let k = 0; k < count; k++) {
        const rect = el(row, 'rect', { x: cx(k), y: ry(r), width: CELL, height: CELL, rx: 9 });
        paint(rect, frame.chambers[k].stage);
      }
      el(row, 'text', { class: 'lc-key is-end', x: x0 - 16, y: ry(r) + CELL / 2 + 4.5 },
        r === 0 ? 'now' : `+${r * T} h`);
      return row;
    });

    // The first row's stages, named over each run of them, with a short rule
    // in the stage's colour: the labels are the key.
    const first = frames[0].chambers.map((c) => c.stage);
    for (let a = 0; a < count;) {
      let b = a;
      while (b + 1 < count && first[b + 1] === first[a]) b++;
      const s = STAGE[first[a]];
      const xa = cx(a); const xb = cx(b) + CELL;
      el(g, 'text', { class: 'lc-key is-mid', x: (xa + xb) / 2, y: top - 22 }, s.short);
      el(g, 'path', {
        class: 'lc-rule' + (s.fill === 'none' ? ' is-empty' : ''),
        d: `M${xa + 4} ${top - 12} H${xb - 4}`,
        style: s.fill === 'none' ? '' : `stroke: ${s.fill}`,
      });
      a = b + 1;
    }

    const under = (r) => ry(r) + CELL + 16;
    for (let k = 0; k < count; k++) spot(card, k, cx(k) + CELL / 2, under(0));

    const RUN = [0.3, 0.8];                      // the first beat is the still row
    card.draw = (p) => {
      const u = clamp01((p - RUN[0]) / (RUN[1] - RUN[0])) * (ROWS - 1);
      // For each new row the numbers first step down out of its way, then the
      // row fades in where they were, so the two never sit on each other.
      let room = 0; let shown = 0;               // counted fractionally
      rows.forEach((row, r) => {
        if (r === 0) { row.style.opacity = '1'; return; }
        room += smooth(r - 1, r - 0.6, u);
        const a = smooth(r - 0.55, r - 0.15, u);
        row.style.opacity = a.toFixed(3);
        shown += a;
      });
      path.setAttribute('stroke-dashoffset', (pathLen * (1 - shown / (ROWS - 1))).toFixed(1));
      for (let k = 0; k < count; k++) card.spots[k][1] = under(0) + room * PITCH;
    };
  }

  // ---- 4. Forwarding: the fire's spent heat, handed to the chambers ahead -----
  // Card 1's row again, in the same stage colours. Heat is not given a colour
  // of its own (yellow and red already mean preheating and firing): it is a
  // plain bar over a chamber, as tall as the chamber is hot, with its °C.
  // The card opens on the fire's bar alone. Then the hot gas leaving the
  // fire is drawn, in the accent, over to each of the three chambers ahead in
  // turn, and each one's bar rises, also in the accent, to meet it: the heat
  // they have is the heat they were handed. Both temperatures are the
  // model's, read at one instant with the gas led on and with it let out at
  // the fire (tourRun.js, the pair). The row starts two chambers behind the
  // fire, so the three ahead of it (which run on past 8 to 1) are all in view.
  {
    const card = byId.forward;
    const g = card.art;
    const pair = run.pair;
    const y = 262;
    const FIRE_AT = 2;                                  // the fire's place in the row
    const order = pair
      ? Array.from({ length: count }, (_, k) => mod(pair.on.firePos - FIRE_AT + k))
      : Array.from({ length: count }, (_, k) => k);
    order.forEach((ch, k) => {
      const rect = el(g, 'rect', { x: rowX(k), y, width: CELL, height: CELL, rx: 9 });
      if (pair) paint(rect, pair.on.chambers[ch].stage);
      spot(card, ch, rowX(k) + CELL / 2, y + CELL + 16);
    });

    if (pair) {
      const pre = pair.on.params.window.pre;
      const base = y - 12;                              // the bars stand on this
      const perC = 135 / 900;                           // px per °C
      const BAR = 24;
      const topOf = (temp) => base - temp * perC;
      const colX = (k) => rowX(k) + CELL / 2;
      const degrees = (t) => `${Math.round(t)} °C`;

      // The fire's own bar, there from the start.
      const xs = colX(FIRE_AT);
      const fireT = pair.on.chambers[pair.on.firePos].temp;
      el(g, 'rect', { class: 'lc-heat', x: xs - BAR / 2, y: topOf(fireT), width: BAR, height: base - topOf(fireT), rx: 4 });
      el(g, 'text', { class: 'lc-key is-end', x: xs - BAR / 2 - 8, y: topOf(fireT) + 10 }, degrees(fireT));

      // The gas's way: up out of the fire, over the chambers ahead, and down
      // to where each one's bar will stop.
      const trunk = 70;
      el(g, 'text', { class: 'lc-key', x: xs + 14, y: trunk - 12 }, 'hot gas leaving the fire');
      const fed = [];
      for (let j = 1; j <= pre; j++) {
        const ch = order[FIRE_AT + j];
        const xe = colX(FIRE_AT + j);
        const from = pair.off.chambers[ch].temp; const to = pair.on.chambers[ch].temp;
        const stop = topOf(to) - 6;
        const d = `M${xs} ${topOf(fireT) - 6} V${trunk + 14} Q${xs} ${trunk} ${xs + 14} ${trunk} H${xe - 14} Q${xe} ${trunk} ${xe} ${trunk + 14} V${stop}`;
        const path = el(g, 'path', { class: 'lc-flow', d });
        const len = path.getTotalLength() || 1;
        path.setAttribute('stroke-dasharray', `${len} ${len}`);
        const head = el(g, 'path', { class: 'lc-flowhead', d: `M${xe - 6} ${stop - 8} L${xe} ${stop} L${xe + 6} ${stop - 8}` });
        // What it would hold with the gas let out at the fire, in the fire's
        // neutral; only what it gains on top is in the accent.
        el(g, 'rect', { class: 'lc-heat', x: xe - BAR / 2, y: topOf(from), width: BAR, height: base - topOf(from), rx: 4 });
        const bar = el(g, 'rect', { class: 'lc-heat is-fed', x: xe - BAR / 2, width: BAR, rx: 4 });
        const label = el(g, 'text', { class: 'lc-key', x: xe + BAR / 2 + 6 });
        fed.push({ path, len, head, bar, label, from, to });
      }

      const RUN = [0.24, 0.84];
      card.draw = (p) => {
        const u = clamp01((p - RUN[0]) / (RUN[1] - RUN[0])) * pre;
        fed.forEach(({ path, len, head, bar, label, from, to }, j) => {
          // Each in turn: the gas reaches it, then its bar rises to the arrow.
          const reach = smooth(j, j + 0.55, u);
          const rise = smooth(j + 0.45, j + 0.95, u);
          path.setAttribute('stroke-dashoffset', (len * (1 - reach)).toFixed(1));
          head.style.opacity = smooth(0.9, 1, reach).toFixed(3);
          const t = lerp(from, to, rise);
          bar.setAttribute('y', topOf(t).toFixed(1));
          // Overlapping the grey a little, to hide the seam, once there is any gain.
          const gain = topOf(from) - topOf(t);
          bar.setAttribute('height', (gain > 0.5 ? gain + 3 : 0).toFixed(1));
          label.setAttribute('y', (topOf(t) + 10).toFixed(1));
          label.textContent = degrees(t);
          label.style.opacity = smooth(0, 0.3, rise).toFixed(3);
        });
      };
    } else {
      card.draw = () => {};
    }
  }

  // ---- 5. Trigger: the clock, and nothing else ------------------------------
  // Card 1's row alone, centred, in the same stage colours, the fire marked
  // with card 2's outline, and riding above the fire a small timer that fills
  // to two hours. When it is full the fire steps on, the stages fade to the
  // next recorded move, and the timer starts again in the next chamber. The
  // card's words carry the rule; the drawing only shows it kept. Nothing in it
  // watches the tiles, because the recorded rule does not. Whether the
  // stokers do, within a slot, is not known (config METHODS). Last on purpose:
  // this is the one idea the dryer proposal changes.
  {
    const card = byId.trigger;
    const g = card.art;
    const MOVES = 3;

    // Three recorded moves, from where the fire has room to step right
    // without wrapping round the row.
    let n0 = 0;
    for (let n = 0; n < count; n++) {
      if (stageAt(n).firePos <= count - 1 - MOVES) { n0 = n; break; }
    }
    const frames = Array.from({ length: MOVES + 1 }, (_, i) => stageAt(n0 + i));

    // Centred top to bottom: from the timer's label above to the numbers below.
    const y = H / 2 - 16;
    const cellEls = [];
    for (let k = 0; k < count; k++) {
      cellEls.push(fadeCell(g, rowX(k), y));
      spot(card, k, rowX(k) + CELL / 2, y + CELL + 16);
    }
    const marker = el(g, 'rect', { class: 'lc-mark is-on', y: y - 5, width: CELL + 10, height: CELL + 10, rx: 12 });

    // The timer, riding over the fire.
    const ty = y - 22;
    const track = el(g, 'rect', { class: 'lc-timer', y: ty, width: CELL, height: 6, rx: 3 });
    const fill = el(g, 'rect', { class: 'lc-timer is-on', y: ty, height: 6, rx: 3 });
    const said = el(g, 'text', { class: 'lc-key is-mid', y: ty - 10 });

    const RUN = [0.2, 0.9];
    const FULL = 0.78;                    // of each move's share: the clock running
    card.draw = (p) => {
      const u = clamp01((p - RUN[0]) / (RUN[1] - RUN[0])) * MOVES;
      const k = Math.min(MOVES - 1, Math.floor(u));
      const into = Math.min(1, u - k);
      // The clock runs to two hours, then the move: the fire glides on and
      // the stages change with it. After the last move it rests, full.
      const clock = Math.min(1, into / FULL);
      const move = smooth(FULL, 1, into);
      const last = u >= MOVES;
      const pos = frames[k].firePos + move;
      const x = rowX(0) + pos * (CELL + GAP);
      marker.setAttribute('x', (x - 5).toFixed(1));
      track.setAttribute('x', x.toFixed(1));
      fill.setAttribute('x', x.toFixed(1));
      // Empties as the fire leaves, so it starts again in the next chamber.
      const shown = last ? 0 : clock * (1 - move);
      fill.setAttribute('width', (CELL * shown).toFixed(1));
      said.setAttribute('x', (x + CELL / 2).toFixed(1));
      track.style.opacity = last ? '0' : '1';
      said.textContent = last ? '' : `${move > 0 ? T : +(clock * T).toFixed(1)} h`;
      const a = frames[k].chambers; const b = frames[k + 1].chambers;
      cellEls.forEach((cell, i) => setCell(cell, a[i].stage, b[i].stage, move));
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
    cells.forEach((cell, i) => {
      cell.style.transform = `translate(${pos[i][0].toFixed(1)}px, ${pos[i][1].toFixed(1)}px) translate(-50%, -50%)`;
      cell.style.fontSize = `${px[i].toFixed(1)}px`;
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
