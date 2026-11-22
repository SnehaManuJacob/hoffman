/**
 * proposal-page.js — "The proposal": the Drying Cycle, a design hypothesis.
 *
 * Content is from the research proposal "A Dryer on Schedule", draft 5
 * (future-research/), and keeps its four marks, shown with the site's
 * letters so a chip means the same on every page:
 *
 *   F  Field            seen at the tile works, or told by workers or growers
 *   L  Established      published, or textbook engineering
 *   A  Design decision  the author's own, untested choice
 *   S  Calculated       worked out on this page with standard formulas
 *   U  Open             not known
 *
 * Nothing here states a result. The dryer has not been built; every effect
 * is a potential one, and the tests at the end are what would decide it.
 */

import { createSmoothScroll } from './scroll.js';
import { createNav, linkChips } from './nav.js';
import { followAir } from './psychro.js';
import { createDryer, DAMPERS, legendHTML } from './views/dryerDiagram.js';
import { recordLoop } from './tourRun.js';
import { relativeHeat, stageAt } from './engine.js';
import { heatHex } from './views/heatRamp.js';

const $ = (s) => document.querySelector(s);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const NS = 'http://www.w3.org/2000/svg';

function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) n.append(kid);
  return n;
}
function s(name, attrs = {}, parent = null) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, v);
  if (parent) parent.append(n);
  return n;
}
function st(parent, x, y, str, attrs = {}) { const t = s('text', { x, y, ...attrs }, parent); t.textContent = str; return t; }

// ---------------------------------------------------------------------------
// The marks
// ---------------------------------------------------------------------------

const MARKS = {
  F: { word: 'Field', blurb: 'Seen at Prabhakar Tile Works, or told by its workers or by the arecanut growers spoken to. A few conversations, not a survey.' },
  L: { word: 'Established', blurb: 'From a published source, or standard textbook engineering.' },
  A: { word: 'Design decision', blurb: 'The author’s own choice for the new system. Untested, and open to change.' },
  S: { word: 'Calculated', blurb: 'Worked out on this page with standard formulas. An illustration, not a measurement.' },
  U: { word: 'Open', blurb: 'Not known. It would need fieldwork, a model or a test.' },
};
function chip(tag) {
  return h('span', { class: 'chip', 'data-ev': tag, title: `${MARKS[tag].word}. ${MARKS[tag].blurb}`, text: tag });
}
/** A run of text with inline chips: ['words', 'F', 'more words'] */
function said(parts) {
  return parts.map((p) => (MARKS[p] && p.length === 1 ? chip(p) : p));
}

createNav({ current: 'proposal' });
const smooth = createSmoothScroll();

$('#key').replaceChildren(...Object.entries(MARKS).map(([k, m]) => h('li', {},
  chip(k), h('b', { text: m.word }), h('span', { text: m.blurb }))));

// ---------------------------------------------------------------------------
// 01 The problem
// ---------------------------------------------------------------------------

const PROBLEMS = [
  {
    tag: 'Already solved by growers', n: 'Problem 1', h: 'Rain falling on the nuts',
    rows: [
      ['What goes wrong', ['Rain re-wets the nuts and spoils them. ', 'F']],
      ['What growers do', ['Carry the nuts indoors from the roof. ', 'F']],
      ['What remains', ['The risk of being caught before the nuts are moved, and the carrying in and out. How often rain catches nuts is open. ', 'U']],
      ['In this proposal', ['The nuts stay in closed bays from loading to unloading: they never meet rain. ', 'A']],
    ],
  },
  {
    tag: 'What this proposal is for', n: 'Problem 2', h: 'Slow drying in humid weather', main: true,
    rows: [
      ['What goes wrong', ['Indoors, humid air has little capacity left, so drying slows: 1 to 1.5 months instead of up to 2 weeks. The nuts do not spoil. ', 'F']],
      ['What growers do', ['Wait. ', 'F']],
      ['What remains', ['Weeks of delay.']],
      ['In this proposal', ['Heated air, routed through several bays and checked before each one. ', 'A']],
    ],
  },
];
$('#two-problems').replaceChildren(...PROBLEMS.map((p) => h('article', { class: `pp-problem${p.main ? ' is-main' : ''}` },
  h('p', { class: 'pp-problem-tag', text: p.tag }),
  h('h3', {}, h('span', { text: p.n }), p.h),
  h('dl', {}, ...p.rows.map(([k, v]) => h('div', {}, h('dt', { text: k }), h('dd', {}, ...said(v))))))));

// The year as a ring: when the rain comes, when the nuts ripen.
{
  const wrap = $('#calendar');
  const svg = s('svg', { viewBox: '-140 -140 280 280', role: 'img', 'aria-label': 'A year: monsoon rains from late May or June, lasting up to six months; arecanut ripening on the coast from late October to late January.' });
  const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const ang = (m) => (m / 12) * Math.PI * 2 - Math.PI / 2;    // m in months from 1 Jan
  const pt = (m, r) => [Math.cos(ang(m)) * r, Math.sin(ang(m)) * r];
  const arc = (m0, m1, r) => {
    const [x0, y0] = pt(m0, r); const [x1, y1] = pt(m1, r);
    const large = ((m1 - m0 + 12) % 12) > 6 ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
  };
  s('circle', { r: 100, class: 'pp-cal-track' }, svg);
  s('circle', { r: 76, class: 'pp-cal-track' }, svg);
  MONTHS.forEach((m, i) => {
    const [x, y] = pt(i + 0.5, 124);
    st(svg, x, y + 4, m, { class: 'pp-cal-m', 'text-anchor': 'middle' });
    const [a, b] = pt(i, 88); const [c, d] = pt(i, 112);
    s('line', { x1: a, y1: b, x2: c, y2: d, class: 'pp-cal-tick' }, svg);
  });
  // Rain: from late May or June; up to six months.
  s('path', { d: arc(4.8, 9, 100), class: 'pp-cal-rain' }, svg);
  s('path', { d: arc(9, 11, 100), class: 'pp-cal-rain is-tail' }, svg);
  // Ripening on the coast: late October to late January.
  s('path', { d: arc(9.75, 12.75, 76), class: 'pp-cal-nut' }, svg);
  st(svg, 0, -6, 'Rain', { class: 'pp-cal-key pp-cal-key--rain', 'text-anchor': 'middle' });
  st(svg, 0, 12, 'Ripening', { class: 'pp-cal-key pp-cal-key--nut', 'text-anchor': 'middle' });
  wrap.append(svg);
  $('#calendar-note').replaceChildren(...said([
    'Outer ring: the monsoon arrives in late May or early June, and its rains can last up to six months ', 'L',
    '. Inner ring: on the coast, nuts ripen from about late October to late January ', 'L',
    ', mostly after the main monsoon. The problem is rain arriving while nuts are drying. How often that happens is ', 'U', ' open.',
  ]));
}

// Benchmark: roof, indoors, and where the dryer must land.
{
  const wrap = $('#benchmark');
  const W = 520; const L = 132; const R = 40; const max = 60;
  const x = (d) => L + (d / max) * (W - L - R);
  const svg = s('svg', { viewBox: `0 0 ${W} 170`, class: 'pp-bars', role: 'img', 'aria-label': 'Drying time in days: roof, up to 14; indoors in rainy weather, 30 to 45; the dryer must come in nearer the roof than indoors.' });
  for (const d of [0, 14, 30, 45]) {
    s('line', { x1: x(d), y1: 8, x2: x(d), y2: 132, class: 'pp-gridline' }, svg);
    st(svg, x(d), 150, d === 0 ? '0' : `${d} days`, { class: 'pp-axis', 'text-anchor': 'middle' });
  }
  const bar = (y, a, b, cls, label, val) => {
    st(svg, 0, y + 14, label, { class: 'pp-bar-name' });
    const w = x(b) - x(a); const r = 4;
    s('path', { d: `M ${x(a)} ${y} H ${x(a) + w - r} Q ${x(a) + w} ${y} ${x(a) + w} ${y + r} V ${y + 18 - r} Q ${x(a) + w} ${y + 18} ${x(a) + w - r} ${y + 18} H ${x(a)} Z`, class: cls }, svg);
    st(svg, x(b) + 6, y + 14, val, { class: 'pp-bar-val' });
  };
  bar(16, 0, 14, 'pp-bar', 'On the roof, in sun', '≤ 2 weeks');
  bar(54, 30, 45, 'pp-bar', 'Indoors, in rain', '1–1.5 months');
  s('rect', { x: x(0), y: 92, width: x(14) - x(0), height: 18, rx: 4, class: 'pp-bar-aim' }, svg);
  st(svg, 0, 106, 'The dryer, in rain', { class: 'pp-bar-name' });
  st(svg, x(14) + 6, 106, 'aim: near here', { class: 'pp-bar-val pp-bar-val--aim' });
  s('line', { x1: x(30), y1: 86, x2: x(30), y2: 118, class: 'pp-fail' }, svg);
  st(svg, x(30) + 4, 126, 'fails here', { class: 'pp-axis pp-axis--fail' });
  wrap.append(svg, h('p', { class: 'pp-src pp-src--inline' }, chip('F'), ' Both times as growers reported them. The aim is a design decision ', chip('A'), ', and whether it is reachable is the first test.'));
}

// The options compared.
{
  const COLS = ['Protects from rain?', 'Dries in humid weather?', 'Takes lots arriving over weeks?'];
  const ROWS = [
    { name: 'Sun on the roof', tag: 'F', cells: [['no', 'No: nuts must be carried indoors'], ['no', 'No: needs sun and dry air'], ['yes', 'Yes: each lot spread as it arrives']] },
    { name: 'Indoors, the current fallback', tag: 'F', cells: [['yes', 'Yes'], ['part', 'Slowly: 1 to 1.5 months'], ['yes', 'Yes, if there is room']] },
    { name: 'Covers and solar tarpaulins', tag: 'L', cells: [['yes', 'Yes'], ['part', 'Only when the sun is out'], ['yes', 'Yes']] },
    { name: 'One heated batch dryer', tag: 'L', cells: [['yes', 'Yes'], ['yes', 'Yes'], ['part', 'One batch at a time. Shallow: air leaves still able to dry. Deep: saturates part-way, dries unevenly (FAO).']] },
    { name: 'The Drying Cycle', tag: 'A', aim: true, cells: [['aim', 'Yes'], ['aim', 'Yes, if heated air is supplied'], ['aim', 'Yes, by design: staggered bays']] },
  ];
  const mark = { yes: '●', part: '◐', no: '○', aim: '◌' };
  const word = { yes: 'yes', part: 'partly', no: 'no', aim: 'aimed for' };
  $('#options').replaceChildren(
    h('div', { class: 'pp-mx-row pp-mx-head', role: 'row' }, h('span', { role: 'columnheader' }), ...COLS.map((c) => h('span', { role: 'columnheader', text: c }))),
    ...ROWS.map((r) => h('div', { class: `pp-mx-row${r.aim ? ' is-aim' : ''}`, role: 'row' },
      h('span', { class: 'pp-mx-name', role: 'rowheader' }, r.name, ' ', chip(r.tag)),
      ...r.cells.map(([k, t]) => h('span', { class: `pp-mx-cell is-${k}`, role: 'cell' },
        h('i', { 'aria-hidden': 'true', text: mark[k] }), h('span', { class: 'pp-sr', text: `${word[k]}: ` }), t)))),
  );
}

// ---------------------------------------------------------------------------
// 02 What carries over
// ---------------------------------------------------------------------------

const KEPT = [
  { l: 'A', name: 'Stationary material, a moving thermal zone', kiln: 'Tiles stay where stacked; the fire’s position moves.', dryer: 'The nuts stay in their bay. Dampers move the heated air’s route; the heater stays put.', tags: ['L', 'A'] },
  { l: 'B', name: 'Counter-current contact', kiln: 'Air meets the fired tiles first and the unfired ones last.', dryer: 'The driest nuts meet the hottest, driest air; the wettest meet the coolest, most humid.', tags: ['L', 'A'] },
  { l: 'C', name: 'Staggered batches', kiln: 'Every chamber at a different stage at once.', dryer: 'Bays at different drying stages, so lots that arrive over weeks can enter one at a time.', tags: ['L', 'A'] },
  { l: 'D', name: 'Shared infrastructure', kiln: 'One fire for all the chambers.', dryer: 'One heater and fan for all the bays. A design rationale, not a cost claim.', tags: ['L', 'A'] },
  { l: 'E', name: 'Fuel from a by-product', kiln: 'The kiln burns cashew-nut shells.', dryer: 'Arecanut husk, which growers already burn, heating the air through a heat exchanger. It never touches the nuts.', tags: ['F', 'A'] },
];
const DROPPED = [
  { l: 'F', name: 'Heat recovered from very hot product', why: 'Tiles leave the fire at about 900 °C. Dried nuts hold little heat.' },
  { l: 'G', name: 'Fuel fed into the charge', why: 'It needs a product that tolerates ash and smoke. Food does not.' },
  { l: 'H', name: 'A fixed two-hour clock', why: 'Nuts dry at a rate set by the weather. Replaced by moving on when the nuts are ready (section 05).' },
];
$('#kept').replaceChildren(...KEPT.map((p) => h('li', { class: 'pp-principle' },
  h('span', { class: 'pp-principle-l', text: p.l }),
  h('div', {}, h('h4', { text: p.name }),
    h('dl', {}, h('div', {}, h('dt', { text: 'Kiln' }), h('dd', { text: p.kiln })), h('div', {}, h('dt', { text: 'Dryer' }), h('dd', { text: p.dryer }))),
    h('p', { class: 'pp-principle-ev' }, ...p.tags.map(chip))))));
$('#dropped').replaceChildren(...DROPPED.map((p) => h('li', { class: 'pp-principle is-dropped' },
  h('span', { class: 'pp-principle-l', text: p.l }),
  h('div', {}, h('h4', { text: p.name }), h('p', { text: p.why })))));

const PRECEDENTS = [
  { for: 'A', grade: 'Exists', name: 'Simulated moving bed chromatography', text: 'Since 1961: fixed columns, with inlets and outlets switched along them on a timer. The material stays; the zone moves.' },
  { for: 'B', grade: 'Exists', name: 'Counter-current industrial dryers', text: 'An HP patent dries printed paper with the most humid air first and the driest last, reusing heat left in the air from each stage.' },
  { for: 'C', grade: 'Tested', name: 'Multi-chamber tobacco curing, 1980', text: 'One chamber filled a day; air routed through a finished chamber, then to ones still drying. The inventor claims 60–75% less fuel on three chambers. No evidence it became standard.' },
  { for: 'D', grade: 'Exists', name: 'Arita’s climbing kiln, Japan', text: 'Its 21 chambers were rented to different potters: one fire, many users.' },
  { for: 'E', grade: 'Field', name: 'Husk already burned as fuel', text: 'Growers on this coast already burn arecanut husk.' },
];
$('#precedents').replaceChildren(...PRECEDENTS.map((p) => h('li', { class: 'pp-prec-card' },
  h('p', { class: 'pp-prec-top' }, h('span', { class: 'pp-principle-l pp-principle-l--sm', text: p.for }), h('span', { class: `pp-grade pp-grade--${p.grade.toLowerCase()}`, text: p.grade })),
  h('h4', { text: p.name }), h('p', { text: p.text }))));

// ---------------------------------------------------------------------------
// 03 How it would work: the damper diagram
// ---------------------------------------------------------------------------

const STEPS = {
  1: { open: ['S1', 'P12', 'P23', 'X3'], route: [1, 2, 3], iso: 4, batch: ['A', 'B', 'C'], out: '–', inn: 'D' },
  2: { open: ['S2', 'P23', 'P34', 'X4'], route: [2, 3, 4], iso: 1, batch: ['B', 'C', 'D'], out: 'A', inn: 'E' },
  3: { open: ['S3', 'P34', 'R41', 'X1'], route: [3, 4, 1], iso: 2, batch: ['C', 'D', 'E'], out: 'B', inn: 'F' },
  4: { open: ['S4', 'R41', 'P12', 'X2'], route: [4, 1, 2], iso: 3, batch: ['D', 'E', 'F'], out: 'C', inn: 'G' },
};
const ROLE = ['Lead', 'Middle', 'Tail'];
const NUTS = ['dry', 'mid', 'wet'];
const ROLE_SUB = ['hottest, driest air', 'cooler air', 'coolest, most humid air'];
const ROLE_SUB2 = ['driest nuts', 'part-dry nuts', 'freshest, wettest nuts'];

function configFor(step, exc = 'none') {
  const S = STEPS[step];
  const dampers = Object.fromEntries(Object.keys(DAMPERS).map((id) => [id, S.open.includes(id) ? 'open' : 'shut']));
  const bays = {};
  S.route.forEach((b, n) => { bays[b] = { state: 'active', role: ROLE[n], batch: S.batch[n], nuts: NUTS[n], sub: ROLE_SUB[n], sub2: ROLE_SUB2[n] }; });
  bays[S.iso] = { state: 'isolated', role: 'Isolated', nuts: null, sub: 'doors open, no air', sub2: S.out === '–' ? `being loaded: ${S.inn}` : `${S.out} out, ${S.inn} in` };
  let route = S.route; let temper = null;
  if (exc === 'early') {
    const tail = S.route[2]; const mid = S.route[1];
    dampers[`X${mid}`] = 'open';
    dampers[`X${tail}`] = 'shut';
    const p = tail === 1 ? 'R41' : `P${mid}${tail}`;
    dampers[p] = 'shut';
    route = S.route.slice(0, 2);
    bays[tail] = { state: 'bypassed', role: 'Bypassed', batch: S.batch[2], nuts: 'wet', sub: 'loaded, doors shut', sub2: 'no air: arriving air unfit' };
  } else if (exc === 'temper') {
    const tail = S.route[2];
    dampers[`S${tail}`] = 'part';
    temper = tail;
    bays[tail].sub2 = 'cold: tempered via S';
  }
  return { dampers, bays, route, temper };
}

const SAY = {
  none: (n) => {
    const S = STEPS[n]; const [a, b, c] = S.route;
    const pass = (x, y) => (x === 4 && y === 1 ? 'the return duct R41' : `P${x}${y}`);
    return `Step ${n}. Heated air enters bay ${a} through S${a} and rises through the driest nuts, batch ${S.batch[0]}. It passes through ${pass(a, b)} to bay ${b}, then ${pass(b, c)} to bay ${c} and the wettest nuts, and leaves through X${c}. Bay ${S.iso} is shut off, doors open, ${S.out === '–' ? `being loaded with batch ${S.inn}` : `batch ${S.out} out and batch ${S.inn} in`}. It joins next step as the tail.`;
  },
  early: () => 'Early exit, at step 2. The air leaving bay 3 fails the route check: too little capacity left, or a dew point above the cold, fresh nuts in bay 4. X3 opens and P34 shuts. Bay 4 is bypassed: loaded, doors shut, no air, until conditions allow.',
  temper: () => 'Tempering, at step 2. Bay 4’s fresh nuts are cold, below the dew point of the spent air arriving. S4 is set partly open, so a little heated supply air enters bay 4’s plenum and mixes with the spent air from P34, warming the nuts above that dew point sooner. The fan speeds up to keep the airflow through the lead bay steady.',
};

const dryer = createDryer($('#dryer'));
$('#dryer-legend').innerHTML = legendHTML();
$('#dryer-ev').replaceChildren(chip('A'), ' Every part of this is a design decision. Four bays is the smallest arrangement that shows every role at once, not a calculated number. The mixing and flow-splitting behind tempering are established physics ', chip('L'), ', but whether tempering is needed at all is open ', chip('U'), '.');

let cur = { step: 1, exc: 'none' };
let timer = null;
function show(step, exc = 'none', animate = true) {
  if (exc !== 'none') step = 2;
  const next = configFor(step, exc);
  const prev = configFor(cur.step, cur.exc);
  clearTimeout(timer);
  if (animate && !reduceMotion && (step !== cur.step || exc !== cur.exc)) {
    // Make before break: the new dampers open before the old ones shut.
    const both = { ...next, dampers: { ...next.dampers } };
    for (const [id, v] of Object.entries(prev.dampers)) if (v !== 'shut' && both.dampers[id] === 'shut') both.dampers[id] = v;
    dryer.render(both);
    timer = setTimeout(() => dryer.render(next), 520);
  } else {
    dryer.render(next);
  }
  cur = { step, exc };
  $('#dryer-say').textContent = SAY[exc](step);
  document.querySelectorAll('#step-buttons button').forEach((b) => b.setAttribute('aria-checked', String(exc === 'none' && Number(b.dataset.step) === step)));
  document.querySelectorAll('#exc-buttons button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.exc === exc && exc !== 'none')));
  document.querySelectorAll('#damper-table [data-step]').forEach((c) => c.classList.toggle('is-cur', exc === 'none' && Number(c.dataset.step) === step));
}

$('#step-buttons').replaceChildren(
  h('span', { class: 'pp-ctl-label', text: 'Step' }),
  ...[1, 2, 3, 4].map((n) => h('button', { type: 'button', role: 'radio', 'data-step': n, 'aria-checked': 'false', text: String(n) })),
  h('button', { type: 'button', class: 'pp-advance', 'aria-label': 'Advance one step', text: 'Advance →' }),
);
$('#exc-buttons').replaceChildren(
  h('span', { class: 'pp-ctl-label', text: 'When the check fails' }),
  h('button', { type: 'button', role: 'radio', 'data-exc': 'early', 'aria-checked': 'false', text: 'Early exit' }),
  h('button', { type: 'button', role: 'radio', 'data-exc': 'temper', 'aria-checked': 'false', text: 'Tempering' }),
);
$('#step-buttons').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.classList.contains('pp-advance')) show((cur.step % 4) + 1);
  else show(Number(b.dataset.step));
});
$('#exc-buttons').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-exc]'); if (!b) return;
  show(2, cur.exc === b.dataset.exc ? 'none' : b.dataset.exc);
});

// The damper table: the same states the diagram draws, all four steps.
{
  const table = $('#damper-table');
  const head = h('tr', {}, h('th', { scope: 'col', text: 'Damper' }), h('th', { scope: 'col', text: 'Connects' }),
    ...[1, 2, 3, 4].map((n) => h('th', { scope: 'col', 'data-step': n, text: `Step ${n}` })));
  const rows = Object.entries(DAMPERS).map(([id, d]) => h('tr', {},
    h('th', { scope: 'row', text: id }), h('td', { text: d.connects }),
    ...[1, 2, 3, 4].map((n) => {
      const open = STEPS[n].open.includes(id);
      return h('td', { 'data-step': n, class: open ? 'is-open' : '', text: open ? 'open' : 'shut' });
    })));
  const roles = h('tr', { class: 'pp-table-roles' }, h('th', { scope: 'row', text: 'Roles' }), h('td', { text: 'lead / middle / tail / isolated' }),
    ...[1, 2, 3, 4].map((n) => h('td', { 'data-step': n, text: [...STEPS[n].route, STEPS[n].iso].join(' / ') })));
  table.replaceChildren(h('thead', {}, head), h('tbody', {}, ...rows, roles));
}
show(1, 'none', false);

// Batches against roles: the diagonal.
{
  const svg = s('svg', { viewBox: '0 0 420 230', class: 'pp-grid-svg', role: 'img', 'aria-label': 'Batches by step and role: each batch moves from tail to middle to lead over three steps.' });
  const cols = ['Lead', 'Middle', 'Tail', 'Loading'];
  const cw = 84; const ch = 40; const x0 = 70; const y0 = 34;
  cols.forEach((c, i) => st(svg, x0 + i * cw + cw / 2, 20, c, { class: 'pp-axis', 'text-anchor': 'middle' }));
  const where = {};
  [1, 2, 3, 4].forEach((n, r) => {
    st(svg, x0 - 12, y0 + r * ch + ch / 2 + 4, `Step ${n}`, { class: 'pp-axis', 'text-anchor': 'end' });
    const row = [...STEPS[n].batch, STEPS[n].inn];
    row.forEach((b, c) => {
      const cls = c === 3 ? 'pp-cell pp-cell--load' : `pp-cell pp-cell--${NUTS[c]}`;
      s('rect', { x: x0 + c * cw + 3, y: y0 + r * ch + 3, width: cw - 6, height: ch - 6, rx: 6, class: cls }, svg);
      st(svg, x0 + c * cw + cw / 2, y0 + r * ch + ch / 2 + 5, b, { class: 'pp-cell-t', 'text-anchor': 'middle' });
      (where[b] ||= []).push([x0 + c * cw + cw / 2, y0 + r * ch + ch / 2]);
    });
  });
  // Follow batch D across the steps.
  const d = where.D;
  if (d) s('polyline', { points: d.map((p) => p.join(',')).join(' '), class: 'pp-follow' }, svg);
  $('#batches').append(svg);
}

// The kiln's diagonal, from the same recorded loop as the kiln page.
{
  const run = recordLoop();
  const COUNT = run.count; const ROWS = 32; const rowH = run.totalHours / ROWS;
  const svg = s('svg', { viewBox: '0 0 420 230', class: 'pp-grid-svg', role: 'img', 'aria-label': 'The kiln over one loop: eight chambers across, sixteen hours down; the firing chamber runs diagonally.' });
  const cw = 36; const ch = 6; const x0 = 70; const y0 = 30;
  for (let c = 0; c < COUNT; c++) st(svg, x0 + c * cw + cw / 2, 20, String(c + 1), { class: 'pp-axis', 'text-anchor': 'middle' });
  st(svg, x0 - 12, y0 + 6, '0 h', { class: 'pp-axis', 'text-anchor': 'end' });
  st(svg, x0 - 12, y0 + ROWS * ch, `${run.totalHours} h`, { class: 'pp-axis', 'text-anchor': 'end' });
  for (let r = 0; r < ROWS; r++) {
    const f = run.at((r + 0.5) * rowH);
    for (let c = 0; c < COUNT; c++) {
      const idx = (run.startFire + c) % COUNT;
      const stg = stageAt(f, idx);
      s('rect', { x: x0 + c * cw + 1, y: y0 + r * ch, width: cw - 2, height: ch, fill: stg === 'empty' ? '#3b3a36' : heatHex(relativeHeat(f.chambers[idx].temp)) }, svg);
    }
  }
  $('#kiln-diagonal').append(svg);
}

// ---------------------------------------------------------------------------
// 04 Is the air fit for the next bay?
// ---------------------------------------------------------------------------

{
  const ids = ['out', 'rh', 'heat', 'pick', 'nut'];
  const inp = Object.fromEntries(ids.map((k) => [k, $(`#i-${k}`)]));
  const outEl = Object.fromEntries(ids.map((k) => [k, $(`#o-${k}`)]));
  const fmt = { out: (v) => `${v} °C`, rh: (v) => `${v}%`, heat: (v) => `${v} °C`, pick: (v) => `${v} g/kg`, nut: (v) => `${v} °C` };
  const DEFAULTS = { out: 27, rh: 90, heat: 47, pick: 2, nut: 27 };
  const baysEl = $('#calc-bays');
  const verdict = $('#calc-verdict');
  const MIN_CAP = 0.5;            // illustration only: the real threshold is open

  function stateCard(title, sub, st, warn = '') {
    return h('div', { class: `pp-air-state${warn ? ` is-${warn}` : ''}` },
      h('p', { class: 'pp-air-h' }, h('b', { text: title }), h('span', { text: sub })),
      h('dl', {},
        h('div', {}, h('dt', { text: 'Temperature' }), h('dd', { text: `${st.t.toFixed(1)} °C` })),
        h('div', {}, h('dt', { text: 'Relative humidity' }), h('dd', { text: `${Math.round(st.rh * 100)}%` })),
        h('div', {}, h('dt', { text: 'Water held' }), h('dd', { text: `${st.w.toFixed(1)} g/kg` })),
        h('div', { class: 'is-key' }, h('dt', { text: 'Dew point' }), h('dd', { text: `${st.dew.toFixed(1)} °C` })),
        h('div', { class: 'is-key' }, h('dt', { text: 'Can still take up' }), h('dd', { text: `${st.cap.toFixed(1)} g/kg` }))),
      h('span', { class: 'pp-air-cap', style: `--cap:${Math.min(1, st.cap / 10).toFixed(3)}` }));
  }

  function update() {
    const v = Object.fromEntries(ids.map((k) => [k, Number(inp[k].value)]));
    ids.forEach((k) => { outEl[k].textContent = fmt[k](v[k]); });
    const heat = Math.max(v.heat, v.out);
    const r = followAir({ outC: v.out, outRH: v.rh / 100, heatC: heat, pickG: v.pick, bays: 2 });
    const leadIn = r.heated;
    const tailIn = r.bays[1].out;                 // what reaches the tail bay
    const condense = tailIn.dew > v.nut;
    const spent = tailIn.cap < MIN_CAP;
    baysEl.replaceChildren(
      stateCard('Outdoors', 'before heating', r.outdoor),
      h('span', { class: 'pp-air-arrow', 'aria-hidden': 'true', text: 'heated →' }),
      stateCard('Into the lead bay', 'driest nuts', leadIn),
      h('span', { class: 'pp-air-arrow', 'aria-hidden': 'true', text: `+${(v.pick * 2).toFixed(1)} g/kg →` }),
      stateCard('Arriving at the tail bay', `after lead and middle; nuts at ${v.nut} °C`, tailIn, condense || spent ? 'fail' : 'pass'),
    );
    let msg;
    if (condense && spent) msg = 'Fails both checks: the air is nearly saturated, and its dew point is above the fresh nuts. Open the middle bay’s exhaust; bypass the tail.';
    else if (condense) msg = `Fails: the dew point (${tailIn.dew.toFixed(1)} °C) is above the fresh nuts (${v.nut} °C), so water would condense on them at first, even though the air could still take up ${tailIn.cap.toFixed(1)} g/kg. Exit early, or temper the tail bay.`;
    else if (spent) msg = 'Fails: the air can take up almost nothing more. Passing it on would only warm the nuts, not dry them. Exit early.';
    else msg = `Passes, with these settings: the air can still take up ${tailIn.cap.toFixed(1)} g/kg, and its dew point is ${(v.nut - tailIn.dew).toFixed(1)} °C below the nuts. The air can go on to the tail bay.`;
    verdict.textContent = msg;
    verdict.dataset.ok = String(!(condense || spent));
  }
  ids.forEach((k) => inp[k].addEventListener('input', update));
  $('#calc-reset').addEventListener('click', () => { ids.forEach((k) => { inp[k].value = DEFAULTS[k]; }); update(); });
  update();
}

// ---------------------------------------------------------------------------
// 05 Two clocks
// ---------------------------------------------------------------------------

{
  // The kiln: eight equal two-hour slots, one per chamber; the hand steps on every one.
  const k = $('#clock-kiln');
  s('circle', { r: 50, class: 'pp-dial-rim' }, k);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    s('line', { x1: Math.cos(a) * 40, y1: Math.sin(a) * 40, x2: Math.cos(a) * 50, y2: Math.sin(a) * 50, class: 'pp-dial-tick' }, k);
  }
  s('line', { x1: 0, y1: 0, x2: 0, y2: -36, class: 'pp-dial-hand pp-dial-hand--kiln' }, k);
  s('circle', { r: 3.5, class: 'pp-dial-pin' }, k);
  // The dryer: steps of unequal length, each as long as the lead batch needs.
  const d = $('#clock-dryer');
  s('circle', { r: 50, class: 'pp-dial-rim' }, d);
  const cuts = [0, 0.22, 0.47, 0.71, 1];      // illustrative, unequal
  cuts.slice(0, -1).forEach((c) => {
    const a = c * Math.PI * 2 - Math.PI / 2;
    s('line', { x1: Math.cos(a) * 40, y1: Math.sin(a) * 40, x2: Math.cos(a) * 50, y2: Math.sin(a) * 50, class: 'pp-dial-tick' }, d);
  });
  s('line', { x1: 0, y1: 0, x2: 0, y2: -36, class: 'pp-dial-hand pp-dial-hand--dryer' }, d);
  s('circle', { r: 3.5, class: 'pp-dial-pin' }, d);
  st(d, 0, 24, '?', { class: 'pp-dial-q', 'text-anchor': 'middle' });
}

const FLOW = [
  { n: '1', h: 'Sense', t: 'Read temperature and humidity in every active headspace and at the inlet, and the nut temperature in every loaded bay.' },
  { n: '2', h: 'Route', t: 'From the lead bay, pass the air on while it can still take up water and its dew point is below the next bay’s nuts. Otherwise open this bay’s exhaust and bypass the next.' },
  { n: '3', h: 'Temper', t: 'If the newly loaded tail bay is colder than the arriving air’s dew point, partly open its supply damper.' },
  { n: '4', h: 'Balance', t: 'Adjust the fan to hold the airflow through the lead bay.' },
  { n: '5', h: 'Advance?', t: 'When the lead bay is giving up little water, ask the operator to sample nuts from several places. Is the nut hard? Does the outer layer peel easily? If yes, open the next dampers, then shut the old ones.', person: true },
];
$('#flow').replaceChildren(...FLOW.map((f) => h('li', { class: `pp-flow-step${f.person ? ' is-person' : ''}` },
  h('span', { class: 'pp-flow-n', text: f.n }),
  h('h3', { text: f.h }),
  h('p', { text: f.t }),
  f.person ? h('p', { class: 'pp-flow-person' }, h('b', { text: 'A person decides here.' }), ' The test is the one growers already use ', chip('F'), '.') : null)));

$('#pseudo').textContent = `# runs every few minutes. Every threshold is open.

# 1  Sense
read temperature and relative humidity in every active headspace and the inlet
read nut temperature in every loaded bay
compute for each air stream: humidity ratio W, dew point, remaining capacity

# 2  Route: how far may the air go?
start at the lead bay
while there is a next bay in the sequence:
    if remaining capacity >= C_min
       and dew point <= next bay nut temperature - margin:
        pass the air on to the next bay
    else:
        open this bay's exhaust; mark the next bay BYPASSED; stop

# 3  Temper a cold new batch
if the tail bay is newly loaded and its nuts are below the arriving dew point:
    partly open its supply damper; adjust to hold plenum temperature

# 4  Balance
adjust fan speed to hold airflow through the lead bay

# 5  Advance?
if water picked up across the lead bay (W out - W in) stays below dW_min:
    ask the operator to sample nuts from several positions
    # the growers' own test: is the nut hard? does the outer layer peel easily?
    if the samples confirm (backed by a moisture meter):
        open the next configuration's dampers, then shut the old ones
        if the next bay is not loaded: wait, or skip it`;

// ---------------------------------------------------------------------------
// 06 What it might do
// ---------------------------------------------------------------------------

const EFFECTS = [
  { h: 'No rain on the nuts', t: 'Nuts never meet rain, however often it happens now, and are never carried between roof and indoors.', basis: [['A', 'the closed bays'], ['U', 'how often rain catches nuts today']] },
  { h: 'Faster than indoors in rainy spells', t: 'Aiming towards the two weeks of roof drying.', basis: [['L', 'heated drying, in general'], ['F', 'the benchmark'], ['U', 'how much faster']] },
  { h: 'Fuel from the crop itself', t: 'The husk heats the air.', basis: [['F', 'husk already used as fuel'], ['U', 'whether there is enough']] },
  { h: 'More use from each kilogram of heated air', t: 'It passes through up to three batches before leaving, when the route check allows.', basis: [['L', 'the principle'], ['U', 'how much']] },
  { h: 'More regular output', t: 'Lots enter and leave one bay at a time.', basis: [['A', 'limited by drying times and arrivals']] },
  { h: 'One heater and fan, shared', t: 'A design rationale, not a proven saving.', basis: [['A', 'the sharing'], ['U', 'what it costs to run']] },
];
$('#effect-list').replaceChildren(...EFFECTS.map((e) => h('li', { class: 'pp-effect' },
  h('h3', { text: e.h }), h('p', { text: e.t }),
  h('ul', { class: 'pp-basis' }, ...e.basis.map(([t, w]) => h('li', {}, chip(t), h('span', { text: w })))))));

// ---------------------------------------------------------------------------
// 07 To be tested
// ---------------------------------------------------------------------------

const TESTS = [
  { n: 1, q: 'In a rainy spell, does a batch dry faster than indoors, and how close does it get to roof drying?', why: 'The benchmark: 1 to 1.5 months indoors against up to 2 weeks on the roof. If it only matches indoor drying, the idea fails.', how: 'Split one lot: half in a bench dryer, half indoors. Judge both with the growers’ test and a moisture meter.', by: ['bench', 'field'] },
  { n: 2, q: 'How quickly does air approach saturation in a layer of wet nuts?', why: 'Sets how many bays the air can serve.', how: 'A moisture balance per bay in the model; the humidity ratio after each box on the bench.', by: ['model', 'bench'] },
  { n: 3, q: 'How much heat does the air lose between bays?', why: 'Downstream air may be too cool.', how: 'The model; temperatures on the bench.', by: ['model', 'bench'] },
  { n: 4, q: 'How many bays can one airflow realistically serve?', why: 'Whether four is too many or too few.', how: 'A model sweep from 2 to 6 bays; a bench check.', by: ['model', 'bench'] },
  { n: 5, q: 'What thresholds should the route check use?', why: 'The minimum capacity and the dew-point margin avoid saturation and condensation.', how: 'The model first, then the bench.', by: ['model', 'bench'] },
  { n: 6, q: 'Can one fan push air through up to three beds?', why: 'Pressure losses add up through nut layers, ducts and dampers.', how: 'Pressure drop per bed at several depths and moistures.', by: ['bench'] },
  { n: 7, q: 'Does the airflow stay balanced when dampers switch, or when tempering opens a parallel route?', why: 'Switching could starve the lead bay.', how: 'Flow in each branch during switching and tempering.', by: ['bench'] },
  { n: 8, q: 'Does condensation on fresh nuts matter, and does tempering prevent it?', why: 'Decides how a new batch joins.', how: 'Cold nuts in the tail bay, with and without tempering.', by: ['bench'] },
  { n: 9, q: 'How will moisture and its evenness be monitored?', why: 'Air readings are only indicators of how dry the nuts are.', how: 'Sample trays and a moisture meter, at several positions.', by: ['bench'] },
  { n: 10, q: 'Do the dampers seal, and do humidity sensors stay accurate near saturation?', why: 'Leaks short-circuit the air; poor readings break the route check.', how: 'Bench tests of dampers and sensors.', by: ['bench'] },
  { n: 11, q: 'What temperatures can arecanut take without losing quality?', why: 'Sets the heater’s limit.', how: 'Literature (one study tested 60–100 °C); small trials.', by: ['literature', 'bench'] },
  { n: 12, q: 'Does spent air do useful drying downstream, or only warm the nuts?', why: 'The core of the transfer from the kiln.', how: 'A box fed spent air against a box fed outdoor air.', by: ['bench'] },
  { n: 13, q: 'The field questions still open', why: 'How many pickings, and how far apart; how often rain catches nuts before they are moved; what slow drying costs growers; how lots would be kept apart; whether there is enough husk; whether buyers accept mechanically dried nuts.', how: 'More conversations with growers, and with a cooperative or trader.', by: ['field'] },
];
const BY_LABEL = { model: 'Model', bench: 'Bench rig', field: 'Fieldwork', literature: 'Literature' };
function testCard(t, big = false) {
  return h(big ? 'div' : 'article', { class: `pp-test${big ? ' is-one' : ''}` },
    h('p', { class: 'pp-test-top' }, h('span', { class: 'pp-test-n', text: `Test ${t.n}` }),
      h('span', { class: 'pp-test-by' }, ...t.by.map((b) => h('span', { class: `pp-by pp-by--${b}`, text: BY_LABEL[b] })))),
    h('h3', { text: t.q }),
    h('dl', {}, h('div', {}, h('dt', { text: 'Why it matters' }), h('dd', { text: t.why })),
      h('div', {}, h('dt', { text: 'How' }), h('dd', { text: t.how }))));
}
$('#test-one').replaceChildren(h('p', { class: 'pp-test-one-k', text: 'The test the others serve' }), testCard(TESTS[0], true));
const GROUPS = [
  ['A model first', 'The kiln simulation adapted for drying: moisture instead of heat.', (t) => t.by[0] === 'model'],
  ['A bench rig', 'Small boxes, a fan, a heater and sensors.', (t) => t.by[0] === 'bench'],
  ['Reading and trials', '', (t) => t.by[0] === 'literature'],
  ['Fieldwork', 'Only the growers can answer these.', (t) => t.by[0] === 'field' && t.n !== 1],
];
$('#test-board').replaceChildren(...GROUPS.map(([g, sub, f]) => h('section', { class: 'pp-test-col' },
  h('h3', { class: 'pp-test-col-h', text: g }), sub ? h('p', { class: 'pp-test-col-s', text: sub }) : null,
  ...TESTS.slice(1).filter(f).map((t) => testCard(t)))));

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

const SOURCES = [
  { kind: 'Field', cite: 'Prabhakar Tile Works, Kundapur: site visit and conversations with workers. Conversations with arecanut growers, November 2026.', note: 'Unpublished; reported practice from a few conversations, not a survey.' },
  { kind: 'Research', cite: 'A Dryer on Schedule: design hypothesis, draft 5 (November 2026). Unpublished, part of this project.', note: 'The source of every design decision on this page.' },
  { kind: 'Guidance', cite: 'FAO. Grain drying: principles and general considerations.', url: 'https://www.fao.org/4/x5065e/x5065E0c.htm', note: 'Drying rate, equilibrium moisture, saturation through deep beds.' },
  { kind: 'Guidance', cite: 'FAO. Grain storage: moisture and fungi.', url: 'https://www.fao.org/4/T1838E/T1838E0u.htm', note: 'Slow drying and mould.' },
  { kind: 'Extension guide', cite: 'CPCRI, Kasaragod. Arecanut cultivation practices.', url: 'https://cpcri.gov.in/filemgr/webfs/publication/arecanut_cultivation_practices(eng).pdf', note: 'Sun-drying times, safe storage moisture.' },
  { kind: 'Cooperative', cite: 'Totgars’ Cooperative Sale Society, Sirsi. Problems in arecanut processing.', url: 'https://tssindia.in/others/about-arecanut/problems-processing', note: 'Ripening seasons, chali and red nuts, 40–45 days of drying.' },
  { kind: 'Guide', cite: 'indiaagronet. Arecanut.', url: 'https://indiaagronet.com/indiaagronet/crop%20info/arecanut.htm', note: '35–40 days of sun-drying.' },
  { kind: 'Guide', cite: 'Krishisewa. Arecanut.', url: 'https://krishisewa.com/crop-cultivation/61-arecanut.html', note: '45–60 days for unhusked nuts.' },
  { kind: 'Parliament', cite: 'Lok Sabha reply on arecanut moisture (CPCRI findings).', url: 'https://eparlib.sansad.in/bitstream/123456789/2984120/1/AU1255_uonz6z.pdf', note: 'Moisture limits.' },
  { kind: 'Journal', cite: 'Madras Agricultural Journal (2007). A solar–biomass hybrid arecanut dryer.', url: 'https://masujournal.org/store_file/archive/94-7-12-256-268.pdf', note: 'Drying temperatures tested on arecanut.' },
  { kind: 'News', cite: 'Deccan Herald. Untimely rain in Dakshina Kannada and Udupi.', url: 'https://www.deccanherald.com/content/43552/untimely-rain-dk-udupi.html', note: 'Rain leaving drying nuts wet.' },
  { kind: 'News', cite: 'Newstrail. Areca growers opt for solar tarpaulins.', url: 'https://newstrailindia.com/inner.php?id=650', note: 'What growers are choosing now.' },
  { kind: 'Cooperative', cite: 'CAMPCO (Wikipedia); Indian Cooperative, CAMPCO procurement and membership.', url: 'https://en.wikipedia.org/wiki/CAMPCO', note: 'Potential users or hosts, not established operators of dryers.' },
  { kind: 'Journal', cite: 'Sateesh, D. & Adhanki, V. P. (2026). Aquapelagic Entanglements in the Panchagangavali Region. Geo: Geography and Environment.', url: 'https://doi.org/10.1002/geo2.70073', note: 'The monsoon at Kundapura: from late May or June, up to six months.' },
  { kind: 'Article', cite: 'Low-Tech Magazine (2009). Rings of Fire: Hoffmann Kilns.', url: 'https://solar.lowtechmagazine.com/2009/10/rings-of-fire-hoffmann-kilns/', note: 'The kiln’s air circuit.' },
  { kind: 'Paper', cite: 'TU Munich. Simulated moving bed technology: old and new.', url: 'https://portal.fis.tum.de/en/publications/simulated-moving-bed-technology-old-and-new/', note: 'Precedent for principle A.' },
  { kind: 'Patent', cite: 'Hewlett-Packard. US 9,731,515: Variable humidity drying.', url: 'https://patents.google.com/patent/US9731515', note: 'Precedent for principle B.' },
  { kind: 'Patent', cite: 'Johnson, W. H. US 4,499,911: Energy efficient curing and drying system.', url: 'https://patents.google.com/patent/US4499911', note: 'Precedent for principle C; its fuel saving is the inventor’s claim.' },
  { kind: 'Heritage', cite: 'MLIT Japan. Site of the Tengudani Kiln (Arita).', url: 'https://www.mlit.go.jp/tagengo-db/common/001550628.docx', note: 'Precedent for principle D.' },
];
$('#page-sources').replaceChildren(...SOURCES.map((x) => h('li', {},
  h('span', { class: 'pp-src-kind', text: x.kind }),
  h('span', { class: 'pp-src-cite' }, x.url ? h('a', { href: x.url, rel: 'noopener', target: '_blank', text: x.cite }) : x.cite),
  h('span', { class: 'pp-src-note', text: x.note }))));

// ---------------------------------------------------------------------------
// The rail, and the glide
// ---------------------------------------------------------------------------

{
  const links = [...document.querySelectorAll('.pp-rail a')];
  const byId = Object.fromEntries(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const seen = new Map();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) seen.set(e.target.id, e.intersectionRatio);
    let best = null; let bestR = 0;
    for (const [id, r] of seen) if (r > bestR) { best = id; bestR = r; }
    links.forEach((a) => a.classList.toggle('is-current', a === byId[best]));
  }, { threshold: [0, 0.15, 0.3, 0.5, 0.75] });
  for (const id of Object.keys(byId)) io.observe(document.getElementById(id));
}

let last = performance.now();
function frame(now) {
  smooth.update(Math.min(now - last, 250));
  last = now;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Every evidence chip leads to its meaning on the Evidence page, including
// the ones that cards redraw as the visitor picks things.
linkChips(document.querySelector('main'));
new MutationObserver(() => linkChips(document.querySelector('main')))
  .observe(document.querySelector('main'), { childList: true, subtree: true });
