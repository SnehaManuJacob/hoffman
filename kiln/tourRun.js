/**
 * tourRun.js — one loop of the kiln, worked out ahead of time for the tour.
 *
 * Not a view and not a second model: it runs the real engine (engine.js) and
 * writes down what it did. The tour (views/anatomy.js) then shows a moment of
 * this record chosen by scroll position, so scrolling forwards is time
 * passing and scrolling back is time running backwards — clock, kiln, heat,
 * fuel and chamber states together, because they are all read from the same
 * frame. Nothing is integrated on scroll, so nothing can drift.
 *
 * WHAT IS RECORDED
 * A kiln in steady running, not its first lighting. From cold the first loop
 * has no fired chambers behind the fire, so nothing is cooling and there is
 * no heat to hand forward: a picture of the start-up, not of the kiln. The
 * engine is charged, lit, and run until the fire has been all the way round
 * at least once and stands in chamber 1 again. That moment is hour 0.
 *
 * THE COUNT (eight, not nine)
 * Hours run 0 to 16. The fire stands still for eight two-hour intervals,
 * [0,2) [2,4) … [14,16), one in each of the eight chambers, and MOVES eight
 * times, at hours 2, 4, … 16. Hour 0 is a position, not a move. The eighth
 * move, at hour 16, brings it back into chamber 1: the last frame is the
 * first frame of the next loop, not a ninth chamber.
 */

import { C } from './config.js';
import { createEngine } from './engine.js';

/** Frames per two-hour interval. 40 = one every three simulated minutes. */
const PER_TICK = 40;

function snapshot(state, hours, fuel0) {
  return {
    hours,
    // What ring.update() reads.
    tick: state.tick,
    subTime: state.subTime,
    firePos: state.firePos,
    fireRow: state.fireRow,
    phase: state.phase,
    // A copy: the pair below is the same kiln read two ways, and the two must
    // not end up sharing whichever setting was thrown last.
    params: { ...state.params, window: { ...state.params.window } },
    gasProfile: state.gasProfile.map((g) => ({ ...g })),
    chambers: state.chambers.map((c) => ({ ...c })),
    // Fuel burned since hour 0, in the model's relative units.
    fuel: state.fuelIndex - fuel0,
  };
}

export function recordLoop() {
  const engine = createEngine();
  const { state } = engine;
  const count = state.chambers.length;
  const tickHours = C.time.tickHours;

  // Fill the cold kiln, then run it warm: three full loops, so that it holds the same heat at the end of the
  // recorded loop as at its start and the heat account closes, ending at
  // the instant the fire arrives in chamber 1. Warmed with step(), whole
  // intervals at a time, because step() integrates the two hours and THEN
  // moves the fire, so it stops exactly on an arrival. Bounded, so a rule
  // change cannot hang the page.
  for (let i = 0; i < 64 && state.phase === 'charging'; i++) engine.dispatch({ type: 'tick' });
  state.paused = false;
  const tickMs = (state.params.tickSeconds / state.params.speed) * 1000;
  for (let i = 0; i < 64 && !state.fork && !(state.tick >= 3 * count && state.firePos === 0); i++) {
    engine.step(tickMs);
  }
  state.subTime = 0;

  const startTick = state.tick;
  const startFire = state.firePos;
  const fuel0 = state.fuelIndex;
  const hoursNow = () => (state.tick - startTick + state.subTime) * tickHours;

  const frames = [snapshot(state, 0, fuel0)];
  const ledger0 = state.heatLedger;

  /**
   * THE SAME MOMENT, TWO KILNS (for "Heat, handed forward").
   *
   * The engine has been working the kiln both ways all along (engine.js,
   * `worlds`): once with the gas led through the chambers ahead of the fire,
   * once with the damper opened at the fire so it leaves at once. The second
   * is a counterfactual, run only in the model. This reads both off at one
   * instant, by turning the engine's own switch and turning it back; no time
   * passes and nothing is rerun.
   *
   * The instant is the end of an interval, when the firing zone fills one
   * chamber exactly. That is the clearest picture of the difference: the gas
   * leaves a whole chamber of fire, and either has three more to pass through
   * or none.
   */
  const pairNow = (hours) => {
    const on = snapshot(state, hours, fuel0);
    engine.dispatch({ type: 'setRecovery', value: false });
    const off = snapshot(state, hours, fuel0);
    engine.dispatch({ type: 'setRecovery', value: true });
    return { on, off };
  };
  let pair = null;
  const dtMs = tickMs / PER_TICK;
  const total = count * tickHours;
  for (let i = 0; i < count * PER_TICK * 2 && !state.fork; i++) {
    engine.step(dtMs);
    const h = hoursNow();
    if (h >= total - 1e-6) break;
    frames.push(snapshot(state, h, fuel0));
    if (h > total - tickHours / 4) pair = pairNow(h);
  }
  // Land exactly on the closing move, whatever the float sum of the steps did.
  for (let i = 0; i < 4 && state.tick - startTick < count && !state.fork; i++) engine.step(dtMs);
  state.subTime = 0;
  frames.push(snapshot(state, total, fuel0));

  // The heat account for the loop just recorded, per chamber fired, both
  // kilns: where the fuel's heat went (engine.js, `newLedger`). The kiln is
  // in steady running, so what it holds is the same at both ends and every
  // unit of fuel is found again under one of the three ways out.
  const ledger1 = state.heatLedger;
  const account = {};
  for (const key of ['on', 'off']) {
    account[key] = {};
    for (const f of Object.keys(ledger1[key])) {
      account[key][f] = (ledger1[key][f] - ledger0[key][f]) / count;
    }
  }
  // The chamber the fire is about to enter, and how hot each kiln has it.
  if (pair) {
    const next = (pair.on.firePos + 1) % count;
    pair.next = next;
    pair.arrive = { on: pair.on.chambers[next].temp, off: pair.off.chambers[next].temp };
  }

  /** The frame at or just before `hours`. */
  function at(hours) {
    const h = Math.min(total, Math.max(0, hours));
    let lo = 0; let hi = frames.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (frames[mid].hours <= h + 1e-9) lo = mid; else hi = mid - 1;
    }
    return frames[lo];
  }

  return {
    frames, at, count, tickHours, startFire, pair, account,
    totalHours: total,
    totalFuel: frames[frames.length - 1].fuel,
    complete: !state.fork && frames[frames.length - 1].firePos === startFire,
  };
}
