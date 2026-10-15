/**
 * views/evidence.js — the legend, and the sheet behind it.
 *
 * A VIEW. It reads config and engine state and draws them; it decides nothing
 * about the kiln.
 *
 * Brief section 8 asks for three things, and this file is the second two: the
 * tags are stored in config.js (they already were), evidence mode restyles by
 * source (style.css and views/ring.js), and HERE is the small legend that
 * makes the letters mean something — plus the details sheet behind it.
 *
 * WHY A SHEET AND NOT A PAGE. A letter beside a label says a value was
 * simulated. It does not say what was done to it, and "simulated" stretches
 * from a defensible rule to a number picked because something had to be
 * drawn. The difference is the honest part of this project, and it needs more
 * room than a tooltip. It gets a <dialog> rather than a second page because
 * the kiln is mid-firing while a visitor reads: closing the sheet puts them
 * back in the run they left, not at tick 0.
 *
 * NOTHING HERE IS RETYPED FROM THE MODEL. Every row is walked out of `TAGS`,
 * `C` and `NOTES`, which are the same shape by construction (see `split` in
 * config.js), so a value cannot be changed in one place and still be
 * described the old way in another. The legend counts the parts the ring and
 * the labels ACTUALLY draw, not the ones the config lists — a part that is
 * configured and never drawn cannot appear here telling a visitor to look
 * for it.
 */

import {
  C, TAGS, NOTES, EVIDENCE, COMPONENTS, METHODS, REFERENCES, OPEN_QUESTIONS,
} from '../config.js';

/**
 * Headings for the top-level config groups.
 *
 * Display names live here rather than in config.js: the config says what the
 * kiln is, and what to call a group of its values on screen is a drawing
 * decision. Anything unlisted falls back to its own key, so adding a group
 * to the config shows up as itself rather than disappearing.
 */
const GROUP_LABEL = {
  chambers: 'The ring',
  time: 'The clock',
  loading: 'The loading crew',
  windows: 'How far the heat reaches',
  temperature: 'Temperatures',
  thermalModel: 'The thermal model',
  thermal: 'How a Hoffmann kiln works',
  fuel: 'Fuel',
  drying: 'Drying the green tiles',
  process: 'The process, end to end',
  shape: 'The shape of the kiln',
  form: 'Plan dimensions',
  parts: 'Drawing the parts',
  chart: 'The space-time chart',
  simulated: 'What is simulated',
  unknowns: 'What is unknown',
  history: 'Dates',
};

/** Every tagged value in the config, flattened: path, value, tag, note. */
function leaves(tags = TAGS, values = C, notes = NOTES, prefix = '') {
  const out = [];
  for (const key of Object.keys(tags)) {
    const tag = tags[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof tag === 'string') {
      out.push({ path, tag, value: values?.[key], note: notes?.[key] });
    } else {
      out.push(...leaves(tag, values?.[key], notes?.[key], path));
    }
  }
  return out;
}

/** A value as a visitor should read it. Arrays are lists, not JSON. */
function show(value) {
  if (Array.isArray(value)) return value.join(' · ');
  if (value === null) return 'not known';
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return String(value);
}

/**
 * Which drawn parts carry each code.
 *
 * Taken from the ring and the labels rather than from COMPONENTS, so this
 * describes the screen. A part can appear TWICE under different codes, and
 * that is the most interesting line in the legend: the chambers were counted
 * at Kundapur but the heat painted on them is simulated, so they are a shape
 * under F and a colour under S. Reading provenance off the components alone,
 * an earlier version reported that nothing on screen was simulated.
 */
function drawnByTag(drawn, colourTags = {}) {
  const byTag = {};
  for (const code of Object.keys(EVIDENCE)) byTag[code] = [];
  for (const id of drawn) {
    const component = COMPONENTS[id];
    if (!component) continue;
    const colour = colourTags[id];
    byTag[component.tag]?.push(colour ? `${component.label} (shape)` : component.label);
    if (colour) byTag[colour]?.push(`${component.label} (colour)`);
  }
  return byTag;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** One `F` chip. The same mark in the legend, the sheet and the labels. */
function codeChip(code) {
  const chip = el('span', 'ev-code', code);
  chip.dataset.code = code;
  chip.title = EVIDENCE[code].label;
  return chip;
}

export function createEvidence({ stripEl, legendEl, noteEl, fieldOnlyEl, sheetEl, sheetBodyEl, drawn = [], colourTags = {} }, dispatch) {
  const all = leaves();
  const byCode = {};
  for (const code of Object.keys(EVIDENCE)) byCode[code] = all.filter((l) => l.tag === code);

  // --- the legend -----------------------------------------------------------

  const counts = drawnByTag(drawn, colourTags);

  for (const code of Object.keys(EVIDENCE)) {
    const parts = counts[code];

    const item = el('li', 'legend-item');
    item.dataset.ev = code;
    item.append(codeChip(code), el('span', 'legend-label', EVIDENCE[code].label));

    /**
     * An empty row stays, and says so. Nothing on screen is drawn as unknown
     * — an unknown is a hole, not a part — and a legend that quietly dropped
     * the U row would hide the one thing it is best placed to show.
     */
    item.append(el('span', 'legend-count', parts.length
      ? `${parts.length} on screen`
      : 'nothing on screen'));
    item.title = parts.length
      ? `${EVIDENCE[code].blurb}\n\n${parts.join('\n')}`
      : EVIDENCE[code].blurb;

    legendEl.append(item);
  }

  // --- the sheet, built on first open --------------------------------------

  function rowFor({ path, value, tag, note }) {
    const row = el('div', 'src-row');
    row.dataset.ev = tag;
    row.append(codeChip(tag), el('code', 'src-path', path), el('span', 'src-value', show(value)));
    if (note) row.append(el('p', 'src-note', note));
    return row;
  }

  function section(id, heading, lede, count) {
    const sec = el('section', 'src-section');
    sec.id = id;
    const head = el('header', 'src-head');
    head.append(el('h3', null, heading));
    if (count !== undefined) head.append(el('span', 'src-count', `${count}`));
    sec.append(head, el('p', 'src-lede', lede));
    return sec;
  }

  function componentRows(code) {
    return Object.keys(COMPONENTS)
      .filter((id) => COMPONENTS[id].tag === code)
      .map((id) => {
        const row = el('div', 'src-row');
        row.dataset.ev = code;
        row.append(codeChip(code), el('span', 'src-path', COMPONENTS[id].label));
        row.append(el('p', 'src-note', COMPONENTS[id].note));
        return row;
      });
  }

  function buildSheet() {
    const fieldParts = componentRows('F');
    const field = section('src-field', 'What was seen at Kundapur',
      'Documented at Prabhakar Tile Factory in one visit. Everything else on this page is built on top of these.',
      byCode.F.length + fieldParts.length);
    byCode.F.forEach((leaf) => field.append(rowFor(leaf)));
    fieldParts.forEach((row) => field.append(row));

    const litParts = componentRows('L');
    const lit = section('src-lit', 'What is borrowed from other kilns',
      'Taken from writing about Hoffmann kilns elsewhere. None of it was verified at Kundapur, and a kiln that has been running for decades is free to differ.',
      byCode.L.length + litParts.length);
    byCode.L.forEach((leaf) => lit.append(rowFor(leaf)));
    litParts.forEach((row) => lit.append(row));
    const refs = el('div', 'src-refs');
    REFERENCES.forEach((r) => {
      const a = el('a', 'src-ref');
      a.href = r.url;
      a.target = '_blank';
      a.rel = 'noreferrer';
      a.textContent = `${r.title} — ${r.where}`;
      refs.append(a);
    });
    lit.append(refs);

    const method = section('src-method', 'What the model computes, and how',
      'A tag says a figure was simulated. It does not say what was done to it. These are the rules the engine actually runs — relative units throughout, and no reading anywhere is a measurement.',
      METHODS.length);
    METHODS.forEach((m) => {
      const card = el('article', 'method');
      card.dataset.ev = m.tag;
      const head = el('header', 'method-head');
      head.append(codeChip(m.tag), el('h4', null, m.title));
      card.append(head, el('p', 'method-what', m.what), el('p', 'method-how', m.how));
      const foot = el('p', 'method-foot');
      foot.append(el('code', null, m.where));
      foot.append(el('span', null, ` · ${m.inputs.join(' · ')}`));
      card.append(foot);
      method.append(card);
    });
    byCode.S.forEach((leaf) => method.append(rowFor(leaf)));

    /**
     * The assumptions, and the reason this sheet exists. Eight values were
     * observed and seventy-two were chosen — a ratio that is invisible while
     * the kiln is running smoothly and is the most honest thing the project
     * has to report. Collapsed, because it is a list to check rather than a
     * list to read, and the count on the summary is the finding either way.
     */
    const mineParts = componentRows('A');
    const mine = section('src-mine', 'What I chose',
      'Modelling and drawing decisions. Each one is a place where the kiln on screen could reasonably have been built differently.',
      byCode.A.length + mineParts.length);
    const groups = {};
    byCode.A.forEach((leaf) => {
      const key = leaf.path.split('.')[0];
      (groups[key] ??= []).push(leaf);
    });
    for (const key of Object.keys(groups)) {
      const box = el('details', 'src-group');
      const sum = el('summary');
      sum.append(el('span', null, GROUP_LABEL[key] ?? key));
      sum.append(el('span', 'src-count', `${groups[key].length}`));
      box.append(sum);
      groups[key].forEach((leaf) => box.append(rowFor(leaf)));
      mine.append(box);
    }
    mineParts.forEach((row) => mine.append(row));

    const open = section('src-open', 'What is not known',
      'Questions the field visit did not answer. They are settings in the model, never facts — the kiln draws one possibility and does not claim it.',
      byCode.U.length + Object.keys(OPEN_QUESTIONS).length);
    for (const key of Object.keys(OPEN_QUESTIONS)) {
      const q = OPEN_QUESTIONS[key];
      const row = el('div', 'src-row');
      row.dataset.ev = q.tag;
      row.append(codeChip(q.tag), el('span', 'src-path', `${q.ref}  ${q.question}`));
      row.append(el('span', 'src-value', q.value === null
        ? 'open'
        : `modelled as ${show(q.value)}`));
      if (q.note) row.append(el('p', 'src-note', q.note));
      open.append(row);
    }
    byCode.U.forEach((leaf) => open.append(rowFor(leaf)));

    sheetBodyEl.append(field, lit, method, mine, open);
  }

  let built = false;

  // --- state ----------------------------------------------------------------

  function update(state) {
    const { evidenceMode, fieldOnly, details } = state.ui;

    stripEl.hidden = !evidenceMode;
    if (fieldOnlyEl) fieldOnlyEl.checked = !!fieldOnly;

    /**
     * What the filter did, in words, and only while it is on. With everything
     * showing there is nothing to account for.
     */
    noteEl.textContent = fieldOnly
      ? 'Everything not documented at Kundapur has gone. What is left as a faint outline is the shape of what was removed — borrowed or assumed, and drawn at all only so the rest can be found.'
      : '';

    if (details && !sheetEl.open) {
      if (!built) { buildSheet(); built = true; }
      sheetEl.showModal();
    } else if (!details && sheetEl.open) {
      sheetEl.close();
    }
  }

  // Esc closes the dialog without going through the button, so the engine has
  // to hear about it or the state and the screen disagree.
  sheetEl.addEventListener('close', () => dispatch({ type: 'setDetails', value: false }));

  return { update };
}
