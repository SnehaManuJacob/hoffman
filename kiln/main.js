/**
 * main.js — the loop. Input -> engine.step -> render views.
 *
 * Brief section 10: this file wires things together and nothing more. It holds
 * no kiln rules (those are in engine.js) and no drawing (that is in views/).
 * Controls do one thing only: dispatch a named action.
 */

import {
  C, PALETTE, STAGE_COLOUR, TAGS, OPEN_QUESTIONS,
  COMPONENTS, EVIDENCE, EVIDENCE_INK, LAYERS,
} from './config.js';
import { createEngine } from './engine.js';
import { createRing, COLOUR_TAG } from './views/ring.js';
import { createPanel } from './views/panel.js';
import { createLabels, LABEL_COMPONENTS } from './views/labels.js';
import { createChart } from './views/chart.js';
import './checks.js';                 // exposes window.kilnChecks()

const engine = createEngine();

const ring = createRing(document.getElementById('ring-canvas'), {
  count: C.chambers.count,
});

const labels = createLabels(document.getElementById('label-layer'), ring);

// The chart draws recorded history; the kiln drags through it. Both send the
// same scrubTo action, so neither knows the other exists.
const chart = createChart(document.getElementById('chart'), engine.history, engine.dispatch);
ring.attachScrub(() => engine.state, engine.dispatch, engine.history);

const panel = createPanel({
  contextEl: document.getElementById('context'),
  debugEl: document.getElementById('debug'),
  clockEl: document.getElementById('clock-value'),
  recoveryEl: {
    on: document.getElementById('fuel-on'),
    off: document.getElementById('fuel-off'),
    rowOn: document.querySelector('.fuel-row[data-mode="on"]'),
    rowOff: document.querySelector('.fuel-row[data-mode="off"]'),
    note: document.getElementById('recovery-note'),
    basis: document.getElementById('fuel-basis'),
  },
  legendEl: {
    list: document.getElementById('legend'),
    note: document.getElementById('legend-note'),
    fieldOnly: document.getElementById('field-only'),
  },
  stallEl: {
    state: document.getElementById('stall-state'),
    note: document.getElementById('stall-note'),
  },
  // What the page actually draws, for the legend to list. The union of the
  // scene's components and the labels' — `zones` is only ever a label.
  drawn: [...new Set([...ring.components(), ...LABEL_COMPONENTS])],
  // The parts whose colour carries a different tag from the part itself. The
  // ring inks by this table; the legend lists by it.
  colourTags: COLOUR_TAG,
}, engine.dispatch);

// --- controls ---------------------------------------------------------------

const btnPlay = document.getElementById('btn-play');
const btnStep = document.getElementById('btn-step');
const speed = document.getElementById('speed');
const speedOut = document.getElementById('speed-out');

btnPlay.addEventListener('click', () => {
  engine.dispatch({ type: 'setPaused', value: !engine.state.paused });
});

btnStep.addEventListener('click', () => {
  engine.dispatch({ type: 'tick' });
});

speed.min = C.time.speedMin;
speed.max = C.time.speedMax;
speed.addEventListener('input', () => {
  engine.dispatch({ type: 'setSpeed', value: speed.value });
  speedOut.textContent = `${engine.state.params.speed}×`;
});

/**
 * Layer tabs. The views read `state.ui.layer` and decide what to draw from
 * config.LAYERS; this only dispatches the change and mirrors it onto <body>,
 * where the CSS uses it to bring the layer's own pane to the top of the
 * column. One dispatch and nothing else, like every other control.
 */
const tabs = document.getElementById('layer-tabs');

function showLayer(layer) {
  document.body.dataset.layer = layer;
  tabs.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('is-active', t.dataset.layer === layer);
  });
}

tabs.addEventListener('click', (ev) => {
  const tab = ev.target.closest('.tab');
  if (!tab) return;
  engine.dispatch({ type: 'setLayer', layer: tab.dataset.layer });
  showLayer(engine.state.ui.layer);
});

showLayer(engine.state.ui.layer);

/**
 * Heat recovery. Both kilns are already running inside the engine, so this
 * only chooses which one is on screen — no simulated time passes and nothing
 * is recomputed. One dispatch and nothing else, like every other control.
 */
const recovery = document.getElementById('recovery');
recovery.checked = engine.state.params.recovery;
recovery.addEventListener('change', (ev) => {
  engine.dispatch({ type: 'setRecovery', value: ev.target.checked });
});

/**
 * Evidence mode, and the field-only filter inside it (brief section 8).
 *
 * The filter is a filter WITHIN the mode, not a third state: turning evidence
 * mode off takes field-only with it, so the kiln can never be left with most
 * of itself missing and no legend on screen to say why.
 */
const evidenceInput = document.getElementById('evidence-mode');
const fieldOnlyInput = document.getElementById('field-only');

function showEvidence() {
  const { evidenceMode, fieldOnly } = engine.state.ui;
  document.body.classList.toggle('evidence-mode', evidenceMode);
  document.body.classList.toggle('field-only', evidenceMode && fieldOnly);
  evidenceInput.checked = evidenceMode;
  fieldOnlyInput.checked = fieldOnly;
}

evidenceInput.addEventListener('change', (ev) => {
  engine.dispatch({
    type: 'setEvidenceMode',
    value: ev.target.checked,
    // Leaving the mode puts the filter back, so coming in again starts whole.
    fieldOnly: ev.target.checked ? engine.state.ui.fieldOnly : false,
  });
  showEvidence();
});

fieldOnlyInput.addEventListener('change', (ev) => {
  engine.dispatch({
    type: 'setEvidenceMode',
    value: engine.state.ui.evidenceMode,
    fieldOnly: ev.target.checked,
  });
  showEvidence();
});

showEvidence();

window.addEventListener('resize', () => {
  ring.resize();
  chart.update(engine.state, true);   // width changed: force a rebuild
});

// --- failure reporting ------------------------------------------------------

/**
 * Everything on screen is redrawn by one requestAnimationFrame loop. If any
 * view throws, the loop stops and the page LOOKS alive but is frozen: Play
 * appears to do nothing, the debug table never changes, and nothing says why.
 *
 * That failure is silent and very easy to misread as a logic bug, so it gets
 * caught, named and shown on the page. Brief rule 14.10 — debugging starts in
 * the console — and this makes sure there is something there to find.
 */
window.__errs = [];

function reportFailure(where, err) {
  const message = (err && (err.stack || err.message)) || String(err);
  window.__errs.push({ where, message });
  console.error(`[kiln] failed in ${where}:`, err);

  const el = document.getElementById('debug');
  if (!el) return;
  let box = document.getElementById('failure');
  if (!box) {
    box = document.createElement('div');
    box.id = 'failure';
    box.className = 'failure';
    el.prepend(box);
  }
  box.textContent = `Stopped: ${where} — ${message.split('\n')[0]}. `
    + 'Reload the page; if it persists, the console has the full trace.';
}

window.addEventListener('error', (e) => reportFailure('page', e.error || e.message));
window.addEventListener('unhandledrejection', (e) => reportFailure('a promise', e.reason));

// --- the loop --------------------------------------------------------------

let last = performance.now();

function frame(now) {
  const dt = Math.min(now - last, 250);   // clamp: a backgrounded tab must not
  last = now;                             // dump a huge dt into the simulation

  try {
    engine.step(dt);

    // The ring needs dt to settle chamber colours at a rate tied to the cycle.
    ring.update(engine.state, dt);
    labels.update(engine.state);     // must follow ring: it reads the camera
    panel.update(engine.state);
    chart.update(engine.state);      // redraws only when the record changes

    btnPlay.textContent = engine.state.paused ? 'Play' : 'Pause';
  } catch (err) {
    // Stop rather than throw the same error sixty times a second, and say so.
    reportFailure('the draw loop', err);
    return;
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Brief rule 14.10: debugging starts in the console.
window.kiln = engine;
window.__ring = ring;        // segments[], path — inspect the drawing
window.__labels = labels;    // text — which anchor shows which words
window.__cfg = {
  C, PALETTE, STAGE_COLOUR, TAGS, OPEN_QUESTIONS,
  // Day 11's tables. On the console because the question "why is this part
  // drawn like that" is now answerable, and the answer is in here.
  COMPONENTS, EVIDENCE, EVIDENCE_INK, LAYERS,
};
window.__chart = chart;
console.log(
  '%c kiln %c engine ready — run kilnChecks() · inspect window.kiln.state',
  'background:#8a5a3c;color:#fff', '',
);
