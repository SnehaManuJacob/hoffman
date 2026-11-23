/**
 * evidence-page.js — "Evidence": where every claim on the site comes from.
 *
 * Two kinds of material, kept apart:
 *   - the model's values, methods and tags, read live from config.js, so
 *     the register cannot describe a model that no longer exists;
 *   - everything else (fieldwork, ratings, disagreements, open questions,
 *     sources) from evidence-data.js, each entry naming the document it
 *     comes from.
 */

import { createSmoothScroll } from './scroll.js';
import { createNav } from './nav.js';
import {
  C, TAGS, NOTES, UNITS, EVIDENCE, METHODS,
} from './config.js';
import {
  SCALES, SHAPE, FIELD, HOW, READINGS, LEVELS, REJECTED, DISAGREE, OPEN, SOURCES,
} from './evidence-data.js';

const $ = (s) => document.querySelector(s);
function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false && kid !== '') n.append(kid);
  return n;
}
const chip = (tag) => h('span', { class: 'chip', 'data-ev': tag, title: `${EVIDENCE[tag].label}. ${EVIDENCE[tag].blurb}`, text: tag });
const ORDER = ['F', 'L', 'A', 'S', 'U'];

createNav({ current: 'evidence' });
const smooth = createSmoothScroll();

// ---------------------------------------------------------------------------
// The model's values, walked out of config.js once.
// ---------------------------------------------------------------------------

/** Groups that describe how the kiln is drawn or shown, not the kiln. */
const DISPLAY = new Set(['form', 'parts', 'clock', 'chart']);
const DISPLAY_PATHS = new Set(['time.tickSeconds', 'time.speedMin', 'time.speedMax']);
const GROUP = {
  chambers: 'Chambers', time: 'Time', loading: 'Loading and unloading', windows: 'Warming and cooling windows',
  temperature: 'Temperature', thermalModel: 'The heat model', thermal: 'Heat', fuel: 'Fuel', drying: 'Drying before firing',
  process: 'The process', shape: 'Shape', simulated: 'What is simulated', unknowns: 'Unknowns', history: 'History',
  form: 'How the kiln is drawn', parts: 'How its parts are drawn', clock: 'The clock', chart: 'The chart',
};

const rows = [];
(function walk(tags, path) {
  for (const [k, v] of Object.entries(tags)) {
    const p = path ? `${path}.${k}` : k;
    if (typeof v === 'string') {
      const get = (o) => p.split('.').reduce((a, key) => (a == null ? a : a[key]), o);
      const top = p.split('.')[0];
      rows.push({ path: p, tag: v, value: get(C), note: get(NOTES), unit: UNITS[p], top, display: DISPLAY.has(top) || DISPLAY_PATHS.has(p) });
    } else if (v && typeof v === 'object') walk(v, p);
  }
}(TAGS, ''));

const SINGULAR = { chambers: 'chamber', steps: 'step', tiles: 'tile', days: 'day' };
function withUnit(n, unit) {
  if (!unit) return String(n);
  if (n === 1) unit = unit.replace(/^\w+/, (w) => SINGULAR[w] ?? w);
  if (unit.startsWith('%')) return `${+(n * 100).toFixed(2)} ${unit}`;
  if (unit === '×' || unit === '°') return `${n}${unit}`;
  return `${n} ${unit}`;
}
function show(value, unit) {
  if (Array.isArray(value)) {
    if (unit && value.every((v) => typeof v === 'number')) return withUnit(value.join('–'), unit);
    return value.join(' · ');
  }
  if (value === null || value === undefined) return 'not known';
  if (value === true) return 'yes';
  if (value === false) return 'no';
  if (typeof value === 'number') return withUnit(value, unit);
  return String(value);
}

// ---------------------------------------------------------------------------
// The headline: how little of the kiln model was observed.
// ---------------------------------------------------------------------------

{
  const kiln = rows.filter((r) => !r.display);
  const count = Object.fromEntries(ORDER.map((t) => [t, kiln.filter((r) => r.tag === t).length]));
  const total = kiln.length;
  $('#headline').replaceChildren(
    h('p', { class: 'ev-headline-big' }, h('b', { text: String(count.F) }), ` of the ${total} values the kiln model uses to describe the kiln were seen or told at the factory.`),
    h('div', { class: 'ev-bar', role: 'img', 'aria-label': ORDER.map((t) => `${count[t]} ${EVIDENCE[t].label}`).join(', ') },
      ...ORDER.filter((t) => count[t]).map((t) => h('span', { class: `ev-seg ev-seg--${t}`, style: `flex:${count[t]}`, title: `${count[t]} ${EVIDENCE[t].label}` }))),
    h('ul', { class: 'ev-bar-key' }, ...ORDER.map((t) => h('li', {}, chip(t), h('span', { text: `${count[t]} ${EVIDENCE[t].label.toLowerCase()}` })))),
    h('p', { class: 'ev-note', text: 'Read from the model’s code as this page loads. Drawing and display settings are left out; they are listed, all as assumptions, in section 05.' }),
  );
}

// ---------------------------------------------------------------------------
// 01 Three questions
// ---------------------------------------------------------------------------

{
  const k = SCALES.known; const s = SCALES.strength; const r = SCALES.real;
  $('#scale-cards').replaceChildren(
    h('article', { class: 'ev-scale ev-scale--main' },
      h('p', { class: 'ev-scale-where', text: k.where }), h('h3', { text: k.q }),
      h('ul', {}, ...k.items.map(([t, word, blurb]) => h('li', { id: `key-${t}` }, chip(t), h('div', {}, h('b', { text: word }), h('span', { text: blurb })))))),
    h('article', { class: 'ev-scale' },
      h('p', { class: 'ev-scale-where', text: s.where }), h('h3', { text: s.q }),
      h('ul', {}, ...s.items.map(([word, blurb]) => h('li', {}, h('span', { class: `ev-rate ev-rate--${word.toLowerCase()}`, text: word }), h('span', { text: blurb }))))),
    h('article', { class: 'ev-scale' },
      h('p', { class: 'ev-scale-where', text: r.where }), h('h3', { text: r.q }),
      h('ul', {}, ...r.items.map(([word, blurb]) => h('li', {}, h('span', { class: 'ev-grade', text: word }), h('span', { text: blurb }))))),
  );
}

// ---------------------------------------------------------------------------
// 02 The shape of the evidence
// ---------------------------------------------------------------------------

{
  const chart = $('#shape-chart');
  const max = Math.max(...SHAPE.map((p) => ORDER.reduce((a, t) => a + (p.counts[t] || 0), 0)));
  chart.replaceChildren(...SHAPE.map((p) => {
    const total = ORDER.reduce((a, t) => a + (p.counts[t] || 0), 0);
    // The total sits at the end of its own bar, not in a far column. A
    // segment is labelled only when it is wide enough on screen to hold the
    // label, which depends on its share of the longest bar, not of its own.
    return h('div', { class: 'ev-shape-row' },
      h('span', { class: 'ev-shape-name', text: p.part }),
      total
        ? h('div', { class: 'ev-shape-track' },
          h('div', { class: 'ev-shape-bar', style: `width:${(total / max) * 100}%` },
            ...ORDER.filter((t) => p.counts[t]).map((t) => h('span', {
              class: `ev-seg ev-seg--${t}`, style: `flex:${p.counts[t]}`, tabindex: '0',
              title: `${p.counts[t]} ${EVIDENCE[t].label}`, 'aria-label': `${p.part}: ${p.counts[t]} ${EVIDENCE[t].label}`,
            }, p.counts[t] / max >= 0.08 ? h('i', { text: `${t} ${p.counts[t]}` }) : null))),
          h('span', { class: 'ev-shape-total', text: String(total) }))
        : h('span', { class: 'ev-shape-none', text: p.note }));
  }), h('ul', { class: 'ev-bar-key' }, ...ORDER.map((t) => h('li', {}, chip(t), h('span', { text: EVIDENCE[t].label })))));
  $('#shape-table').replaceChildren(h('table', { class: 'ev-table' },
    h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Part of the site' }), ...ORDER.map((t) => h('th', { scope: 'col', text: EVIDENCE[t].label })))),
    h('tbody', {}, ...SHAPE.map((p) => h('tr', {}, h('th', { scope: 'row', text: p.part }), ...ORDER.map((t) => h('td', { text: String(p.counts[t] || 0) })))))));
}

// ---------------------------------------------------------------------------
// 03 Fieldwork
// ---------------------------------------------------------------------------

$('#how-key').replaceChildren(...Object.entries(HOW).filter(([k]) => k !== 'either').map(([k, w]) => h('span', { class: `ev-how ev-how--${k}`, text: w })),
  h('span', { class: 'ev-how-note', text: 'How each fact reached the record, in the research’s own words.' }));
$('#field-log').replaceChildren(...FIELD.map((g) => h('article', { class: 'ev-field' },
  h('header', { class: 'ev-field-head' },
    h('h3', { text: g.place }),
    h('dl', {}, h('div', {}, h('dt', { text: 'When' }), h('dd', { text: g.when })), h('div', {}, h('dt', { text: 'Who' }), h('dd', { text: g.who })))),
  h('ol', { class: 'ev-log' }, ...g.items.map((it) => h('li', {},
    h('span', { class: `ev-how ev-how--${it.how}`, text: HOW[it.how] }),
    h('div', { class: 'ev-log-main' },
      h('p', { class: 'ev-log-fact', text: it.fact }),
      it.detail ? h('p', { class: 'ev-log-detail', text: it.detail }) : null),
    h('dl', { class: 'ev-log-meta' },
      h('div', {}, h('dt', { text: 'From' }), h('dd', { text: it.from })),
      h('div', {}, h('dt', { text: 'Used on' }), h('dd', { text: it.used || 'not used yet' })))))))));

// ---------------------------------------------------------------------------
// 04 Readings
// ---------------------------------------------------------------------------

const RATING_STEP = { Trap: 0, Contrast: 0, Weak: 1, 'Weak–Moderate': 1.5, Moderate: 2, 'Strong–Moderate': 2.5, Strong: 3 };
function meter(rating) {
  const v = RATING_STEP[rating] ?? 0;
  return h('span', { class: `ev-meter${rating === 'Trap' ? ' is-trap' : ''}`, 'aria-hidden': 'true' },
    ...[1, 2, 3].map((i) => h('i', { class: v >= i ? 'is-on' : v >= i - 0.5 ? 'is-half' : '' })));
}
$('#levels').replaceChildren(h('p', { class: 'ev-levels-h', text: '"The kiln is an algorithm" can mean three things. Each rating is for the weakest one a connection actually reaches.' }),
  h('ol', {}, ...LEVELS.map(([n, t], i) => h('li', {}, h('b', { text: `${i + 1}. ${n}` }), h('span', { text: t })))));
$('#reading-cards').replaceChildren(...READINGS.map((r) => h('article', { class: `ev-reading${r.unrated ? ' is-unrated' : ''}` },
  h('header', {}, h('h3', { text: r.idea }), h('p', { text: `"${r.says}"` })),
  r.unrated ? h('p', { class: 'ev-unrated', text: 'Not yet rated' }) : null,
  h('ul', { class: 'ev-entries' }, ...r.entries.map((e) => h('li', {},
    h('p', { class: 'ev-entry-top' }, h('span', { class: 'ev-code', text: e.code }), h('span', { class: 'ev-entry-name', text: e.name })),
    h('p', { class: 'ev-entry-rate' }, meter(e.rating), h('span', { class: `ev-rate ev-rate--${e.rating.split('–')[0].toLowerCase()}`, text: e.rating }), h('span', { class: 'ev-basis', text: `basis ${e.basis}` })),
    h('p', { class: 'ev-entry-why', text: e.why })))),
  h('div', { class: 'ev-breaks' }, h('b', { text: 'Where it breaks' }), h('p', { text: r.breaks })))));
$('#rejected').replaceChildren(...REJECTED.map((r) => h('li', {},
  h('p', { class: 'ev-entry-top' }, h('span', { class: 'ev-code', text: r.code }), h('b', { text: r.name }), h('span', { class: 'ev-rate ev-rate--trap', text: 'Trap' })),
  h('p', { text: r.why }))));

// ---------------------------------------------------------------------------
// 05 The model
// ---------------------------------------------------------------------------

$('#methods').replaceChildren(h('h3', { class: 'ev-methods-h', text: 'How each computed thing on screen is worked out' }),
  h('div', { class: 'ev-methods-list' }, ...METHODS.map((m) => h('details', { class: 'ev-method' },
    h('summary', {}, chip(m.tag), h('span', { text: m.title })),
    h('div', {},
      m.what ? h('p', { class: 'ev-method-what', text: m.what }) : null,
      m.how ? h('p', { text: m.how }) : null,
      m.where ? h('p', { class: 'ev-method-where' }, h('b', { text: 'In the code: ' }), h('code', { text: m.where })) : null)))));

{
  let active = new Set(ORDER);
  let query = '';
  let showDisplay = false;
  const filter = $('#filter');
  const counts = Object.fromEntries(ORDER.map((t) => [t, rows.filter((r) => !r.display && r.tag === t).length]));
  filter.replaceChildren(...ORDER.map((t) => h('button', { type: 'button', 'data-tag': t, 'aria-pressed': 'true' }, chip(t), h('span', { text: `${EVIDENCE[t].label} ${counts[t]}` }))),
    h('label', { class: 'ev-check' }, h('input', { type: 'checkbox', id: 'show-display' }), ' Drawing and display settings'));

  function render() {
    const q = query.trim().toLowerCase();
    const shown = rows.filter((r) => active.has(r.tag) && (showDisplay || !r.display)
      && (!q || `${r.path} ${show(r.value, r.unit)} ${r.note || ''}`.toLowerCase().includes(q)));
    const byGroup = new Map();
    for (const r of shown) {
      const g = r.display && !DISPLAY.has(r.top) ? 'Display' : GROUP[r.top] || r.top;
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g).push(r);
    }
    $('#register').replaceChildren(...[...byGroup].map(([g, list]) => h('section', { class: 'ev-reg-group' },
      h('h4', { text: g }),
      h('ul', {}, ...list.map((r) => h('li', { class: 'ev-reg-row', id: `value-${r.path}` },
        chip(r.tag),
        h('code', { class: 'ev-reg-path', text: r.path }),
        h('span', { class: 'ev-reg-val', text: show(r.value, r.unit) }),
        r.note ? h('p', { class: 'ev-reg-note', text: r.note }) : null))))));
    $('#register-count').textContent = `${shown.length} value${shown.length === 1 ? '' : 's'} shown.`;
  }
  filter.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tag]'); if (!b) return;
    const t = b.dataset.tag;
    // The first click narrows to one kind; later clicks add or remove.
    if (active.size === ORDER.length) active = new Set([t]);
    else if (active.has(t)) { active.delete(t); if (!active.size) active = new Set(ORDER); } else active.add(t);
    filter.querySelectorAll('button[data-tag]').forEach((x) => x.setAttribute('aria-pressed', String(active.has(x.dataset.tag))));
    render();
  });
  $('#show-display').addEventListener('change', (e) => { showDisplay = e.target.checked; render(); });
  $('#search').addEventListener('input', (e) => { query = e.target.value; render(); });
  render();
}

// ---------------------------------------------------------------------------
// 06 Disagreements
// ---------------------------------------------------------------------------

$('#disagree-list').replaceChildren(...DISAGREE.map((d) => h('article', { class: 'ev-dis' },
  h('h3', { text: d.topic }),
  h('div', { class: 'ev-dis-pair' },
    h('div', {}, h('p', { class: 'ev-dis-v', text: d.a[0] }), h('p', { class: 'ev-dis-s', text: d.a[1] })),
    h('span', { class: 'ev-dis-vs', 'aria-hidden': 'true', text: 'or' }),
    h('div', {}, h('p', { class: 'ev-dis-v', text: d.b[0] }), h('p', { class: 'ev-dis-s', text: d.b[1] }))),
  h('p', { class: 'ev-dis-use' }, h('b', { text: 'On this site: ' }), d.use))));

// ---------------------------------------------------------------------------
// 07 Still open
// ---------------------------------------------------------------------------

$('#open-list').replaceChildren(...OPEN.map((g) => h('article', { class: 'ev-open-group' },
  h('h3', {}, chip('U'), h('span', { text: g.by }), h('small', { text: `${g.items.length === 1 ? '' : g.items.length}` })),
  h('ul', {}, ...g.items.map(([q, why]) => h('li', {}, h('p', { text: q }), why ? h('p', { class: 'ev-open-why', text: why }) : null))),
  g.link ? h('a', { class: 'ev-open-link', href: g.link, text: 'See them on the proposal page →' }) : null)));

// ---------------------------------------------------------------------------
// 08 Sources
// ---------------------------------------------------------------------------

{
  const types = [...new Set(SOURCES.flatMap((g) => g.items.map((i) => i.type)))].sort();
  const sel = $('#src-type');
  sel.replaceChildren(h('option', { value: '', text: 'All types' }), ...types.map((t) => h('option', { value: t, text: t })));
  const total = SOURCES.reduce((a, g) => a + g.items.length, 0);
  function render() {
    const type = sel.value; const missing = $('#src-missing').checked;
    let n = 0;
    const groups = SOURCES.map((g) => {
      // Unpublished and local material has no link to find; it is not "missing" one.
      const lacks = (i) => !i.url && !g.local;
      const items = g.items.filter((i) => (!type || i.type === type) && (!missing || lacks(i)));
      n += items.length;
      if (!items.length) return null;
      return h('section', { class: 'ev-src-group' },
        h('h3', {}, g.group, h('small', { text: String(items.length) })),
        g.note ? h('p', { class: 'ev-note', text: g.note }) : null,
        h('ol', {}, ...items.map((i) => h('li', { class: lacks(i) ? 'is-missing' : '' },
          h('span', { class: 'ev-src-type', text: i.type }),
          h('div', {},
            h('p', { class: 'ev-src-cite' }, i.url ? h('a', { href: i.url, rel: 'noopener', target: '_blank', text: i.cite }) : i.cite),
            h('p', { class: 'ev-src-use' }, lacks(i) ? h('span', { class: 'ev-src-flag', text: 'No confirmed link' }) : '', i.supports))))));
    });
    $('#source-list').replaceChildren(...groups.filter(Boolean));
    $('#src-count').textContent = `${n} of ${total} sources`;
  }
  sel.addEventListener('change', render);
  $('#src-missing').addEventListener('change', render);
  render();
}

// ---------------------------------------------------------------------------
// The rail, arriving at a mark, and the glide
// ---------------------------------------------------------------------------

{
  const links = [...document.querySelectorAll('.ev-rail a')];
  const byId = Object.fromEntries(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const seen = new Map();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) seen.set(e.target.id, e.intersectionRatio);
    let best = null; let bestR = 0;
    for (const [id, r] of seen) if (r > bestR) { best = id; bestR = r; }
    links.forEach((a) => a.classList.toggle('is-current', a === byId[best]));
  }, { threshold: [0, 0.15, 0.3, 0.5] });
  for (const id of Object.keys(byId)) io.observe(document.getElementById(id));
}

// A chip on another page links here as #key-F and so on: light that key up.
function arrive() {
  const id = location.hash.slice(1);
  const el = id && document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ block: 'center' });
  el.classList.remove('is-target');
  void el.offsetWidth;
  el.classList.add('is-target');
}
window.addEventListener('hashchange', arrive);
requestAnimationFrame(arrive);

let last = performance.now();
function frame(now) { smooth.update(Math.min(now - last, 250)); last = now; requestAnimationFrame(frame); }
requestAnimationFrame(frame);
