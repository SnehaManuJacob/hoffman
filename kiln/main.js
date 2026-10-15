/**
 * main.js — the loop. Input -> engine.step -> render views.
 *
 * Brief section 10: this file wires things together and nothing more. It holds
 * no kiln rules (those are in engine.js) and no drawing (that is in views/).
 * Controls do one thing only: dispatch a named action.
 */

import {
  C, PALETTE, STAGE_COLOUR, TAGS, OPEN_QUESTIONS, COMPONENTS, EVIDENCE,
} from './config.js';
import { createEngine } from './engine.js';
import { createRing, SIMULATED_COLOUR } from './views/ring.js';
import { createPanel } from './views/panel.js';
import { createLabels, LABELLED_COMPONENTS } from './views/labels.js';
import { createChart } from './views/chart.js';
import { createEvidence } from './views/evidence.js';
import { createClock } from './views/clock.js';
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
    whyOn: document.getElementById('why-on'),
    whyOff: document.getElementById('why-off'),
    note: document.getElementById('recovery-note'),
  },
}, engine.dispatch);

// The dial beside the hours. The number says how much time has passed; the
// dial says the beat it passed in.
const clock = createClock({
  dialEl: document.getElementById('dial'),
  handEl: document.getElementById('dial-hand'),
  marksEl: document.getElementById('dial-marks'),
});

/**
 * The legend and the details sheet.
 *
 * The drawn set is asked of the ring and the labels rather than read off the
 * config: the legend's claim is "this is what is on screen", and the only two
 * things that know what is on screen are the two that put it there.
 */
const evidence = createEvidence({
  stripEl: document.getElementById('evidence-strip'),
  legendEl: document.getElementById('legend'),
  sheetEl: document.getElementById('sources'),
  sheetBodyEl: document.getElementById('sources-body'),
  drawn: [...new Set([...ring.components(), ...LABELLED_COMPONENTS])],
  colourTags: SIMULATED_COLOUR,
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
 * Evidence mode, and the sheet behind it.
 *
 * Showing or hiding the legend strip CHANGES THE CANVAS'S HEIGHT, and the
 * ring only resizes on a window resize event. Without this the kiln renders
 * stretched from the moment the toggle is pressed until the window is next
 * touched — which on the exhibition machine is never.
 */
document.getElementById('evidence-mode').addEventListener('change', (ev) => {
  engine.dispatch({ type: 'setEvidenceMode', value: ev.target.checked });
  document.body.classList.toggle('evidence-mode', engine.state.ui.evidenceMode);
  // Show or hide the strip BEFORE measuring. Left to the next frame, the ring
  // resizes against the layout the strip is about to change and the canvas
  // ends up one strip-height taller than the box it is drawn into.
  evidence.update(engine.state);
  ring.resize();
  chart.update(engine.state, true);
});

document.getElementById('btn-sources').addEventListener('click', () => {
  engine.dispatch({ type: 'setDetails', value: true });
});

document.getElementById('btn-sources-close').addEventListener('click', () => {
  engine.dispatch({ type: 'setDetails', value: false });
});

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
    evidence.update(engine.state);   // the legend and the sheet
    clock.update(engine.state, dt);  // dt in REAL ms: the flash is a beat for
                                     // the viewer, not an event in the kiln

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
window.__cfg = { C, PALETTE, STAGE_COLOUR, TAGS, OPEN_QUESTIONS, COMPONENTS, EVIDENCE };
window.__chart = chart;
// What the legend was built from: the scene's own parts, the ones only the
// labels name, and which of them carry a colour the model computed.
window.__drawn = {
  ring: ring.components(),
  labelled: LABELLED_COMPONENTS,
  colours: SIMULATED_COLOUR,
};
console.log(
  '%c kiln %c engine ready — run kilnChecks() · inspect window.kiln.state',
  'background:#8a5a3c;color:#fff', '',
);
