/**
 * engine.js — all kiln rules live here. No drawing code, ever.
 *
 * Brief section 10: inputs send named actions, the engine applies them, views
 * only read state and draw it. The later Arduino input and the physical LED
 * view attach at the same two seams, so nothing here should need to change.
 *
 * What the engine knows (brief section 6.1): 8 chambers; the fire advances one
 * chamber per tick; one tick is 2 simulated hours; a chamber's stage follows
 * from its position relative to the fire.
 */

import { C, DEFAULT_PARAMS, OPEN_QUESTIONS } from './config.js';
import { createHistory } from './history.js';

/** The named actions from brief section 10. Exported so views can't invent new ones. */
export const ACTIONS = [
  'tick',
  'setPaused',
  'setSpeed',
  'scrubTo',
  'emptyChamber',
  'loadChamber',
  'setRecovery',
  'setAutoLoad',
  'chooseForkPolicy',
  'setLayer',
  'setEvidenceMode',
];

/**
 * Which stage a chamber is in, derived from its distance ahead of the fire.
 *
 * Nothing stores a stage as truth — it is always recomputed from firePos, so a
 * chamber's stage can never drift out of step with where the fire actually is.
 *
 * offset 0                      -> firing
 * offset within the preheat window -> preheating (ahead of the fire)
 * offset within the cool window    -> cooling (behind the fire)
 * anything else                 -> waiting to be unloaded and reloaded
 */
export function stageAt(state, i) {
  const count = state.chambers.length;
  const { pre, cool } = state.params.window;
  const offset = (i - state.firePos + count) % count;

  // Nothing is firing until the kiln has been charged and lit. `firePos` is
  // only where the fire WILL start, so during charging it must not be drawn,
  // labelled or coloured as a fire that does not yet exist.
  if (state.phase === 'charging') {
    return state.chambers[i].loaded ? 'wait' : 'empty';
  }

  // The fire's position does not depend on whether there are tiles in it.
  // A chamber can burn with nothing inside — that is exactly what the
  // "fire empty" fork policy means — so this test comes before the empty one.
  if (offset === 0) return 'fire';

  if (!state.chambers[i].loaded) return 'empty';
  if (offset <= pre) return 'preheat';
  if (offset >= count - cool) return 'cool';
  return 'wait';
}

/**
 * Relative heat, 0 to 1, for the views to colour with.
 *
 * A NORMALISED TEMPERATURE, not a measurement. Section 4 allows simulated
 * values only in relative units, so this is what leaves the engine and no
 * view ever sees degrees. Exact temperature stays on `chamber.temp` for the
 * console.
 */
export function relativeHeat(tempC) {
  const lo = C.temperature.ambientC;
  const hi = C.thermalModel.heatRefC;
  return Math.max(0, Math.min(1, (tempC - lo) / (hi - lo)));
}

/**
 * The order gas travels through the kiln, as chamber indices.
 *
 * In behind the chambers that have just fired, forward through them, through
 * the fire, and on through the ones being preheated. This is the same route
 * the airflow arrow draws, and the reason the kiln is shaped like a loop at
 * all: one pass of air does two useful jobs.
 *
 * Literature, not observation (config `thermal.counterCurrent`, tag L). The
 * flow path at Kundapur was not seen.
 */
export function flowPath(state) {
  const count = state.chambers.length;
  const { pre, cool } = state.params.window;
  const path = [];
  for (let k = -cool; k <= pre; k++) {
    path.push(((state.firePos + k) % count + count) % count);
  }
  return path;
}

/**
 * Gas temperature along the flow path, as a profile the views can draw.
 *
 * PURE — it mutates nothing. One pass applying the same exchange rule the
 * thermal model uses, so the drawing and the simulation cannot disagree about
 * the same kiln. The constants come from the same config block for the same
 * reason.
 *
 * Returns `temps` with one more entry than `path`: temps[0] is the gas going
 * in, temps[k+1] is the gas after it has passed path[k].
 *
 * This is the whole Hoffmann argument in one array. Gas enters cold, is warmed
 * by the chambers that have just fired, is lifted by the fire, and then gives
 * that heat up to the green tiles ahead — so it leaves cooler than it left the
 * fire. The difference is the heat that did a second job.
 *
 * Derived rather than stored, like stage and heat: scrubbing gets the right
 * profile for free, because the chamber temperatures it reads are restored.
 */
export function gasProfile(state) {
  const M = C.thermalModel;
  const ambient = C.temperature.ambientC;
  const path = state.phase === 'charging' ? [] : flowPath(state);

  const temps = [ambient];
  let gas = ambient;

  for (const i of path) {
    const ch = state.chambers[i];

    // Same rule as integrateThermal: positive means the chamber is hotter and
    // is giving heat up to the gas.
    const q = M.exchangeRate * (ch.temp - gas) * M.subStepHours;
    gas += q / M.gasMass;

    // The fire sets the temperature of the gas leaving it.
    if (i === state.firePos) gas = Math.max(gas, ch.temp);

    temps.push(gas);
  }

  return { path, temps };
}

function makeChambers(count) {
  return Array.from({ length: count }, () => ({
    // The kiln starts cold and empty and fills as the first cycle runs, so a
    // visitor sees tiles going in rather than finding them already there.
    loaded: !C.loading.startEmpty,
    temp: C.temperature.ambientC,   // degrees, simulated. Owned by the thermal model.
    heat: 0,                        // relative 0-1, simulated. Never degrees.
    stage: 'wait',
    fired: false,                   // has been through the fire since loading
    heldEmpty: false,               // emptied by hand: the crew must leave it
  }));
}

/**
 * Refresh the derived stage on every chamber, and the relative heat the views
 * read. Heat now follows TEMPERATURE, which the thermal model owns — nothing
 * here invents it.
 */
function syncStages(state) {
  for (let i = 0; i < state.chambers.length; i++) {
    const ch = state.chambers[i];
    ch.stage = stageAt(state, i);
    ch.heat = relativeHeat(ch.temp);
  }
}

export function createEngine(options = {}) {
  const count = options.count ?? C.chambers.count;

  const state = {
    tick: 0,
    subTime: 0,                      // progress through the current tick, 0..1
    firePos: 0,
    chambers: makeChambers(count),
    params: {
      ...DEFAULT_PARAMS,
      window: { ...DEFAULT_PARAMS.window },
      ...options.params,
    },
    fuelIndex: 0,                    // relative units only, never kg or MJ
    // 'charging' while the cold kiln is being filled, 'running' once lit.
    // No simulated time passes while charging.
    phase: C.loading.startEmpty ? 'charging' : 'running',
    paused: true,                    // starts held so the page opens still
    fork: null,                      // set when the fire meets an empty chamber
    ui: { layer: 'structure', evidenceMode: false, fieldOnly: false },
  };

  const history = createHistory();
  syncStages(state);
  history.push(state);

  // Simulated hours banked but not yet integrated — see integrateThermal.
  let thermalCarry = 0;

  /**
   * The thermal model (brief section 6.2).
   *
   * Advances every chamber's temperature by `simHours` of simulated time, in
   * fixed sub-steps. Sub-steps are measured in SIMULATED hours, not frames, so
   * the kiln behaves identically at 0.25x and 4x and on a slow machine.
   *
   * Each sub-step walks the flow path once:
   *
   *   gas enters cold behind the fire
   *     -> through the chambers that just fired: they give up heat, gas warms
   *     -> through the fire: fuel is fed, gas and chamber both get hotter
   *     -> through the chambers ahead: gas gives that heat to green tiles
   *
   * One exchange rule produces all of it. The gas carries far less mass than a
   * chamber, so it equilibrates as it travels — which is exactly what makes a
   * Hoffmann kiln worth building: one pass of air does two useful jobs.
   *
   * Chambers off the path drift back towards ambient.
   *
   * SIMULATED throughout (tag S), in relative masses and rates. Section 4
   * forbids kg and MJ for simulated values, so there are no real units here.
   */
  function integrateThermal(simHours) {
    if (simHours <= 0) return;

    const M = C.thermalModel;
    const ambient = C.temperature.ambientC;

    /**
     * Only ever integrate WHOLE sub-steps, carrying the remainder to the next
     * call. Explicit Euler gives a different answer for a different step size,
     * so letting the frame decide the step size makes the kiln behave one way
     * on a fast machine and another on a slow one. Measured at 5.7 C of drift
     * between 10 frames of 100 ms and 100 frames of 10 ms before this.
     */
    thermalCarry += simHours;

    while (thermalCarry >= M.subStepHours) {
      thermalCarry -= M.subStepHours;
      const dt = M.subStepHours;

      // Nothing is burning before the kiln is lit, so it only loses heat.
      const path = state.phase === 'charging' ? [] : flowPath(state);
      const onPath = new Set(path);

      let gas = ambient;
      for (const i of path) {
        const ch = state.chambers[i];

        // Gas and chamber trade heat. Positive q means the chamber is the
        // hotter of the two and is giving heat up to the gas.
        const q = M.exchangeRate * (ch.temp - gas) * dt;
        ch.temp -= q / M.chamberMass;
        gas += q / M.gasMass;

        if (i === state.firePos) {
          /**
           * Fuel is fed at whatever rate holds the band. That is an
           * assumption: how the crew actually decides a feed rate is unknown
           * (section 4 lists what workers watch and adjust as unknown).
           *
           * It is also what makes Day 8 possible. With heat recovery off the
           * chambers ahead arrive cold, more fuel is needed to reach the same
           * peak, and the fuel index rises — section 6.5's stated outcome.
           */
          const rate = Math.max(0, Math.min(
            M.maxFuelRate, (M.targetC - ch.temp) * M.fuelGain,
          ));
          ch.temp += (rate * dt * M.heatPerFuel) / M.chamberMass;
          gas = Math.max(gas, ch.temp);        // the fire sets the gas leaving it
          state.fuelIndex += rate * dt;        // relative units, never a mass
        }
      }

      // Everything off the flow path just loses heat to the outside.
      for (let i = 0; i < count; i++) {
        if (onPath.has(i)) continue;
        const ch = state.chambers[i];
        ch.temp += (ambient - ch.temp) * Math.min(1, M.ambientLossRate * dt);
      }

      for (let i = 0; i < count; i++) {
        const ch = state.chambers[i];
        if (ch.temp < ambient) ch.temp = ambient;   // nothing goes below the yard
        state.chambers[i].heat = relativeHeat(ch.temp);
      }
    }
  }

  /**
   * The loading crew, run once per tick before the fire moves.
   *
   * Two jobs, and the order matters:
   *   1. A chamber that has been fired and is now idle gets emptied. Those are
   *      finished tiles coming out.
   *   2. The empty chamber the fire will reach soonest gets loaded. Green tiles
   *      going in. One per tick, matching the rate the fire consumes them.
   *
   * Working AHEAD of the fire is the whole point. It is also why starting from
   * an empty kiln works at all: without it the fire would meet an unloaded
   * chamber on the very first tick and stall before anything had happened.
   *
   * A chamber emptied by hand is left alone — see `heldEmpty`. Otherwise the
   * crew would quietly undo the disruption the fork is there to demonstrate.
   *
   * This rhythm is an assumption (config `loading`, tag A). Crew tasks at
   * Kundapur are unknown.
   */
  function runLoadingCrew() {
    if (!state.params.autoLoad) return;

    const { pre, cool } = state.params.window;
    const offsetOf = (i) => (i - state.firePos + count) % count;

    /**
     * The idle slots: past cooling, not yet preheating. Offsets count DOWN as
     * the fire comes round, so a chamber runs
     *   ... idle, idle, preheat x3, fire, cool, cool, idle ...
     * The first idle slot is where fired tiles come out, and the last is where
     * green tiles go in — loaded there, a chamber rides the whole preheat run
     * before it burns, which is the point of preheating at all.
     */
    const firstIdle = count - cool - 1;
    const lastIdle = pre + 1;

    // 1. Out: fired tiles leave on the first idle slot.
    const justUnloaded = new Set();
    if (C.loading.unloadWhenIdle) {
      for (let i = 0; i < count; i++) {
        const ch = state.chambers[i];
        if (ch.loaded && ch.fired && offsetOf(i) === firstIdle) {
          ch.loaded = false;
          ch.fired = false;
          justUnloaded.add(i);     // one job per tick: do not refill it today
        }
      }
    }

    const canLoad = (i) => {
      const ch = state.chambers[i];
      return !ch.loaded && !ch.heldEmpty && !justUnloaded.has(i);
    };

    // 2. In: green tiles go into the last idle slot, ready for the preheat run.
    let loads = C.loading.perTick;
    for (let i = 0; i < count && loads > 0; i++) {
      if (offsetOf(i) >= lastIdle && offsetOf(i) <= firstIdle && canLoad(i)) {
        state.chambers[i].loaded = true;
        state.chambers[i].fired = false;
        loads--;
      }
    }

  }

  /**
   * Is the kiln charged enough to light? The fire's own chamber and the whole
   * preheat run ahead of it must hold tiles.
   */
  /**
   * How far ahead the cold kiln is charged before lighting: the fire's own
   * chamber, the whole preheat run, and the idle slot beyond it.
   *
   * That last slot matters. Once running, the crew loads one chamber per tick
   * at the idle slot measured AFTER the fire has moved, so the slot the fire
   * is standing next to at the moment of lighting is never its target. Charge
   * only as far as the preheat run and the kiln stalls a few ticks later on
   * the one chamber nobody was ever going to fill.
   */
  function chargeDepth() {
    return state.params.window.pre + 1;
  }

  function isCharged() {
    for (let step = 0; step <= chargeDepth(); step++) {
      const i = (state.firePos + step) % count;
      if (!state.chambers[i].loaded && !state.chambers[i].heldEmpty) return false;
    }
    return true;
  }

  /**
   * Charging a cold kiln, one chamber per step, before the fire is lit.
   *
   * This phase exists to avoid a lie. If the fire advanced from the first step
   * while the kiln was still empty, the crew would have to load each chamber in
   * the very tick the fire moved into it — so tiles would appear in a chamber
   * at the exact moment it caught light, which is not how anything works. A
   * Hoffmann kiln is charged and then lit.
   *
   * No simulated time passes here and no fuel is burned: `tick`, `firePos` and
   * `fuelIndex` all stay put, so the 2-hour cycle starts when the fire does.
   */
  function chargeOneChamber() {
    for (let step = 0; step <= chargeDepth(); step++) {
      const i = (state.firePos + step) % count;
      const ch = state.chambers[i];
      if (!ch.loaded && !ch.heldEmpty) {
        ch.loaded = true;
        ch.fired = false;
        return true;
      }
    }
    return false;
  }

  /**
   * Move the fire on by one chamber, or raise the fork if it cannot.
   *
   * Brief section 6.6: when the fire reaches an empty chamber the simulation
   * pauses and offers wait / skip / fire empty. The fork ALWAYS appears — the
   * engine never picks for the user, because what Kundapur does is unknown.
   */
  function advanceTick() {
    /**
     * Charging comes before anything else, and before the clock starts. Each
     * step fills one chamber; the fire is lit only once it has somewhere to
     * burn and a preheat run ahead of it.
     */
    if (state.phase === 'charging') {
      const didLoad = chargeOneChamber();
      syncStages(state);
      // Light once charged — or once there is nothing left the crew is allowed
      // to load, which happens if a chamber in the charge zone was emptied by
      // hand. Better to light and stall visibly at the fork than to sit in a
      // charging phase that can never finish.
      if (isCharged() || !didLoad) {
        state.phase = 'running';
        // The chamber the fire is lit in has had its firing like any other, so
        // it must be marked for unloading when it comes round to idle. Without
        // this one chamber would keep its original load for ever.
        state.chambers[state.firePos].fired = true;
      }
      history.push(state);
      return true;
    }

    const next = (state.firePos + 1) % count;

    if (!state.chambers[next].loaded) {
      state.fork = { at: next, from: state.firePos, atTick: state.tick };
      state.paused = true;
      state.subTime = 0;
      syncStages(state);             // the crew may have moved tiles already
      return false;                  // the fire has not moved
    }

    /**
     * If we are standing in the past — scrubbed back — anything recorded ahead
     * of here belongs to a run that is about to stop being true. Drop it before
     * recording, so the chart never shows a future that will not happen.
     *
     * Re-running unchanged produces identical rows, so this only has an effect
     * when something actually diverged, which is exactly when it must.
     */
    if (state.tick < history.lastTick) history.truncateAfter(state.tick);

    state.firePos = next;
    state.tick += 1;

    // The chamber now in the fire has had its firing. That is what later marks
    // it ready to be unloaded once it goes idle.
    state.chambers[next].fired = true;

    /**
     * The crew works AFTER the fire has moved — during the two hours that
     * follow, which is when the work actually happens.
     *
     * The order matters more than it looks. Run before the advance, a chamber
     * loaded in the idle slot is pushed straight into the preheat window by
     * that same advance, so freshly stacked green tiles are drawn as already
     * warm and never appear cold at all. Run after, a newly loaded chamber
     * spends a full interval idle and cold before the preheat run reaches it,
     * which is the truthful order: tiles go in cold, then warm as the fire
     * comes round.
     *
     * Safe because the chamber ahead of the fire is always already loaded by
     * the time the kiln is running — charging the cold kiln is its own phase.
     */
    runLoadingCrew();

    syncStages(state);
    history.push(state);
    return true;
  }

  /**
   * Resolve a fork with one of the three policies. None of them is correct and
   * none is scored — each simply moves the problem somewhere else.
   */
  function resolveFork(policy) {
    if (!state.fork) return;
    const { at } = state.fork;

    if (policy === 'wait') {
      // The fire holds position. Time still passes, so the chambers behind keep
      // cooling and the chambers ahead sit warm for longer than they should.
      state.tick += 1;
    } else if (policy === 'skip') {
      // The fire jumps over the empty chamber to the one beyond it.
      state.firePos = (at + 1) % count;
      state.tick += 1;
    } else if (policy === 'fireEmpty') {
      // The fire moves in and burns fuel on a chamber holding no tiles.
      state.firePos = at;
      state.tick += 1;
    } else {
      return;                        // unknown policy: leave the fork standing
    }

    // Whichever way the fork is answered, two hours pass and the kiln keeps
    // burning — including "fire empty", where the fuel buys nothing.
    integrateThermal(C.time.tickHours);

    state.params.policy = policy;
    state.fork = null;
    state.paused = false;
    syncStages(state);
    history.push(state);
  }

  /**
   * Advance simulated time. `dtMs` is real elapsed milliseconds.
   * One tick = params.tickSeconds of real time at speed 1.
   */
  /**
   * Advance by `dtMs` of real time. Returns the SIMULATED hours that passed,
   * so views animating in kiln-time (the heat particles) can use the engine's
   * own conversion instead of duplicating the formula and drifting from it.
   */
  function step(dtMs) {
    if (state.paused || state.fork) return 0;

    const perTick = state.params.tickSeconds / state.params.speed;
    const ticksElapsed = (dtMs / 1000) / perTick;

    /**
     * Heat advances with SIMULATED time, not with frames. A frame is just how
     * often we look; the kiln does not care. This is what keeps 0.25x and 4x,
     * and a fast machine and a slow one, producing the same kiln.
     *
     * Charging burns nothing, so no simulated time passes there either.
     */
    if (state.phase !== 'charging') {
      integrateThermal(ticksElapsed * C.time.tickHours);
    }

    state.subTime += ticksElapsed;

    // A while loop, not an if, so a long frame cannot silently lose a tick.
    while (state.subTime >= 1) {
      state.subTime -= 1;
      if (!advanceTick()) break;     // fork raised: stop here
    }

    return state.phase === 'charging' ? 0 : ticksElapsed * C.time.tickHours;
  }

  function dispatch(action) {
    const { type } = action;

    switch (type) {
      case 'tick': {                 // step exactly one chamber, ignoring subTime
        state.subTime = 0;
        if (state.fork) break;       // a standing fork must be answered first
        state.paused = true;
        const wasCharging = state.phase === 'charging';
        advanceTick();
        /**
         * Two hours pass when you step, so the kiln must heat for two hours.
         * Done HERE and not inside advanceTick, because step() already
         * integrates from elapsed time and would otherwise count it twice.
         *
         * Charging burns nothing, so a charging step moves no simulated time.
         */
        if (!wasCharging && state.phase !== 'charging') {
          integrateThermal(C.time.tickHours);
          syncStages(state);
          history.push(state);
        }
        break;
      }

      case 'setPaused':
        if (state.fork) break;       // cannot play past an unanswered fork
        state.paused = !!action.value;
        break;

      case 'setSpeed': {
        const s = Number(action.value);
        if (Number.isFinite(s)) {
          state.params.speed = Math.min(C.time.speedMax, Math.max(C.time.speedMin, s));
        }
        break;
      }

      case 'scrubTo': {
        // History is the source, so scrubbing back replays what actually
        // happened rather than recomputing it.
        //
        // Inert while charging: no simulated time has passed yet, so there is
        // nothing to scrub to, and jumping to tick 0 would un-charge the kiln.
        if (state.phase === 'charging') break;

        const snap = history.at(action.tick);
        if (snap) {
          state.tick = snap.tick;
          state.firePos = snap.firePos;
          state.fuelIndex = snap.fuelIndex;
          state.chambers = snap.chambers.map((c) => ({ ...c }));
          state.subTime = 0;
          state.paused = true;
          thermalCarry = 0;        // sub-tick bookkeeping does not survive a jump
          syncStages(state);
        }
        break;
      }

      case 'emptyChamber': {
        const i = action.index;
        if (!state.chambers[i]) break;
        // The firing chamber cannot be emptied: its tiles are in the fire.
        if (i === state.firePos) break;
        state.chambers[i].loaded = false;
        state.chambers[i].fired = false;
        // Held open until reloaded by hand. Without this the crew would refill
        // it on the next tick and the stall could never be demonstrated.
        state.chambers[i].heldEmpty = true;
        syncStages(state);
        break;
      }

      case 'loadChamber': {
        const i = action.index;
        if (!state.chambers[i]) break;
        state.chambers[i].loaded = true;
        state.chambers[i].fired = false;
        state.chambers[i].heldEmpty = false;   // hand it back to the crew
        // Reloading the chamber the fork is waiting on clears the fork.
        if (state.fork && state.fork.at === i) state.fork = null;
        syncStages(state);
        break;
      }

      case 'setAutoLoad':
        state.params.autoLoad = !!action.value;
        break;

      case 'setRecovery':
        // Stored now, acted on in Day 8. Keeping the action in the vocabulary
        // from the start means later days add behaviour, not plumbing.
        state.params.recovery = !!action.value;
        break;

      case 'chooseForkPolicy':
        resolveFork(action.policy);
        break;

      case 'setLayer':
        state.ui.layer = action.layer;
        break;

      case 'setEvidenceMode':
        state.ui.evidenceMode = !!action.value;
        if (action.fieldOnly !== undefined) state.ui.fieldOnly = !!action.fieldOnly;
        break;

      default:
        console.warn(`[engine] unknown action: ${type}`);
    }
  }

  return {
    state,
    step,
    dispatch,
    history,
    // Read-only helpers for views. They compute nothing the engine does not own.
    stageAt: (i) => stageAt(state, i),
    openQuestions: OPEN_QUESTIONS,
  };
}
