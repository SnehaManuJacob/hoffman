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
import { createSmoothScroll } from './scroll.js';
import { createIntro } from './views/intro.js';
import { createCharRise } from './views/charRise.js';
import { createAnatomy } from './views/anatomy.js';
import { createLogic } from './views/logic.js';
import { createProblem } from './views/problem.js';
import { recordLoop } from './tourRun.js';
import { createRing, SIMULATED_COLOUR } from './views/ring.js';
import { createPanel } from './views/panel.js';
import { createLabels, LABELLED_COMPONENTS } from './views/labels.js';
import { createChart } from './views/chart.js';
import { createEvidence } from './views/evidence.js';
import { createClock } from './views/clock.js';
import './checks.js';                 // exposes window.kilnChecks()

// One glide for the whole page (scroll.js): every section reads the same
// smoothed scroll position, so the journey has one feel from seam to seam.
const smooth = createSmoothScroll();

const engine = createEngine();

const ring = createRing(document.getElementById('ring-canvas'), {
  count: C.chambers.count,
});

/**
 * The intro (views/intro.js). Skipped for prefers-reduced-motion and for
 * viewports too small to read an orbiting establishing shot comfortably —
 * both land straight on the same end state the animated version settles
 * into (the bare kiln, dashboard chrome still hidden by body.pre-reveal),
 * just without the camera move. Collapsing #intro to nothing rather than
 * merely not animating it: a visitor who has asked for reduced motion
 * should not also have to scroll through 900vh of a frozen opening shot to
 * get to the kiln.
 */
const introSection = document.getElementById('intro');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  || window.innerWidth < 560;

let intro = null;
if (reduceMotion) {
  introSection.style.display = 'none';
} else {
  // The opening question rises in as the page opens, one character at a time.
  createCharRise(document.querySelector('.intro-title'), { mode: 'load', delay: 250, stagger: 18 });
  // The line under it is simpler: the whole of it fades in (it starts hidden, via
  // .fade-in in the markup, so it never shows before its cue), starting while
  // the last of the title's characters are still rising.
  const sub = document.querySelector('.intro-sub');
  ((document.fonts && document.fonts.ready) || Promise.resolve())
    .then(() => setTimeout(() => sub.classList.add('is-in'), 1850));
  intro = createIntro({
    sectionEl: introSection,
    canvas: document.getElementById('intro-canvas'),
    ring,                                              // the blueprint kiln is drawn from it
    copyEl: document.querySelector('.intro-copy'),
    briefEl: document.querySelector('.intro-brief'),
  });
}

/**
 * The tour of the kiln's parts (views/anatomy.js), after the intro.
 *
 * It points at a RUNNING kiln: one full loop of the real engine, recorded
 * ahead of time (tourRun.js) from a kiln in steady running. The tour shows
 * the record's first moment while it introduces the parts, scrubs through
 * the whole loop in "The fire", and rests on its last moment after. The
 * visitor's own kiln (`engine`) stays cold and empty until they light it;
 * the ring draws the record only while the tour is on screen.
 */
const run = recordLoop();
const anatomy = createAnatomy({ sectionEl: document.getElementById('anatomy'), ring, run });
// After the tour: the same recorded loop, read as five ideas from computing.
const logic = createLogic({ sectionEl: document.getElementById('logic'), ring, run });
// Then the question it ends on, answered: the drying problem the dryer is for.
const problem = createProblem({ sectionEl: document.getElementById('problem'), ring, run, followScroll: !smooth.enabled || window.matchMedia('(pointer: coarse)').matches });

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
  intro?.resize();
  chart.update(engine.state, true);   // width changed: force a rebuild
});

// --- dashboard reveal --------------------------------------------------------

/**
 * The page now opens on the intro sequence (style.css: `body.pre-reveal`
 * hides the topbar, side column and transport bar, leaving only the bare
 * kiln). This is the hand-off: it drops `pre-reveal` and re-measures the ring
 * exactly as the evidence-mode toggle already does above, for the same
 * reason — the ring-pane's box changes size the moment the side column and
 * transport bar come back, and the canvas only resizes on a window resize
 * event otherwise.
 *
 * Not called anywhere yet. The intro sequence (views/intro.js) will call this
 * once it has a defined moment to hand off at.
 */
function revealDashboard() {
  document.body.classList.remove('pre-reveal');
  ring.resize();
  chart.update(engine.state, true);
}

/**
 * The story ends at the end of #problem, over the village, on a question.
 * There is no hand-off to the dashboard any more: the page stays in
 * pre-reveal (the dashboard chrome out of the page), and scrolling simply
 * stops there. revealDashboard() is kept, reachable from the console, for
 * working on the model.
 */
window.__revealDashboard = revealDashboard;

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
  // The table is folded away by default; a failure must not be.
  el.closest('details')?.setAttribute('open', '');
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
    smooth.update(dt);     // first: every view below reads the scroll it writes
    engine.step(dt);

    // The ring needs dt to settle chamber colours at a rate tied to the cycle.
    // The tour draws the fired demonstration kiln; everything else, the
    // visitor's own.
    const touring = anatomy.isActive();
    document.body.classList.toggle('touring', touring);
    // ...and at the end of the drying problem, the recorded loop again, as
    // the kiln comes back (views/problem.js, stage 5).
    const shownState = touring ? anatomy.frame() : problem.kilnFrame() || engine.state;
    ring.update(shownState, dt);
    intro?.update();   // reads scroll position only; no engine state involved
    anatomy.update(shownState);
    logic.update();
    problem.update();
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
window.__anatomy = anatomy;
window.__problem = problem;  // camera — inspect the drying story's way
window.__run = run;         // the recorded loop the tour scrubs through
window.__intro = intro;      // camera, renderer, scene, getBuilding() — inspect the camera path
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
