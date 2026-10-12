/**
 * main.js — the loop. Input -> engine.step -> render views.
 *
 * Brief section 10: this file wires things together and nothing more. It holds
 * no kiln rules (those are in engine.js) and no drawing (that is in views/).
 * Controls do one thing only: dispatch a named action.
 */

import { C, PALETTE, STAGE_COLOUR, TAGS, OPEN_QUESTIONS } from './config.js';
import { createEngine } from './engine.js';
import { createRing } from './views/ring.js';
import { createPanel } from './views/panel.js';
import { createLabels } from './views/labels.js';
import './checks.js';                 // exposes window.kilnChecks()

const engine = createEngine();

const ring = createRing(document.getElementById('ring-canvas'), {
  count: C.chambers.count,
});

const labels = createLabels(document.getElementById('label-layer'), ring);

const panel = createPanel({
  contextEl: document.getElementById('context'),
  debugEl: document.getElementById('debug'),
  clockEl: document.getElementById('clock-value'),
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

// Layer tabs. Day 11 makes them change what is drawn; for now they set state.
const tabs = document.getElementById('layer-tabs');
tabs.addEventListener('click', (ev) => {
  const tab = ev.target.closest('.tab');
  if (!tab) return;
  engine.dispatch({ type: 'setLayer', layer: tab.dataset.layer });
  tabs.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('is-active', t === tab);
  });
});

// Evidence mode. Day 11 builds the legend and the field-only filter.
document.getElementById('evidence-mode').addEventListener('change', (ev) => {
  engine.dispatch({ type: 'setEvidenceMode', value: ev.target.checked });
  document.body.classList.toggle('evidence-mode', engine.state.ui.evidenceMode);
});

window.addEventListener('resize', () => ring.resize());

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
window.__cfg = { C, PALETTE, STAGE_COLOUR, TAGS, OPEN_QUESTIONS };
console.log(
  '%c kiln %c engine ready — run kilnChecks() · inspect window.kiln.state',
  'background:#8a5a3c;color:#fff', '',
);
