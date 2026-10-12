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
 * How hot a chamber is relative to the rest of the kiln, 0 to 1.
 *
 * SIMULATED (tag S), and relative only — this is not a temperature and must
 * never be drawn as degrees. It exists so the kiln can show heat GRADING along
 * its length: the chamber just behind the fire is still nearly as hot as the
 * fire, while one at the far end of the preheat run is barely warm. Stage alone
 * cannot say that, because every preheating chamber shares one stage.
 *
 * Derived from distance to the fire, so it is geometry rather than physics.
 * Day 6 swaps this body for a real thermal model and nothing else changes.
 */
export function heatAt(state, i) {
  const count = state.chambers.length;
  const { pre, cool } = state.params.window;
  const H = C.heat;

  /**
   * Heat belongs to the CHAMBER, not to what is in it. An empty chamber sitting
   * in the fire is still hot — that is precisely what makes the "fire empty"
   * fork costly, fuel spent on nothing. Tying heat to `loaded` would draw that
   * chamber cold and quietly contradict the choice the fork is asking about.
   *
   * The view paints heat onto tiles, so an empty chamber shows nothing anyway.
   */
  // A kiln that has not been lit is cold all the way round.
  if (state.phase === 'charging') return 0;

  const offset = (i - state.firePos + count) % count;
  if (offset === 0) return H.firing;

  // Ahead of the fire: taking its exhaust, hottest nearest, fading with distance.
  if (offset <= pre) {
    const t = pre === 1 ? 0 : (offset - 1) / (pre - 1);
    return H.firstPreheat + (H.lastPreheat - H.firstPreheat) * t;
  }

  // Behind the fire: just fired and still giving heat up to the incoming air.
  if (offset >= count - cool) {
    const back = count - offset;                  // 1 = immediately behind
    const t = cool === 1 ? 0 : (back - 1) / (cool - 1);
    return H.justBehind + (H.lastCooling - H.justBehind) * t;
  }

  return H.waiting;
}

function makeChambers(count) {
  return Array.from({ length: count }, () => ({
    // The kiln starts cold and empty and fills as the first cycle runs, so a
    // visitor sees tiles going in rather than finding them already there.
    loaded: !C.loading.startEmpty,
    temp: C.temperature.ambientC,   // Day 6 replaces this with the thermal model
    heat: 0,                        // relative 0-1, simulated. Never degrees.
    stage: 'wait',
    fired: false,                   // has been through the fire since loading
    heldEmpty: false,               // emptied by hand: the crew must leave it
  }));
}

/** Refresh the derived stage and heat on every chamber. */
function syncStages(state) {
  for (let i = 0; i < state.chambers.length; i++) {
    state.chambers[i].stage = stageAt(state, i);
  }
  // Heat depends on stage windows, so it is computed in a second pass.
  for (let i = 0; i < state.chambers.length; i++) {
    state.chambers[i].heat = heatAt(state, i);
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
    state.fuelIndex += C.fuel.perFiringTick;

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
      state.fuelIndex += C.fuel.perFiringTick;
    } else if (policy === 'skip') {
      // The fire jumps over the empty chamber to the one beyond it.
      state.firePos = (at + 1) % count;
      state.tick += 1;
      state.fuelIndex += C.fuel.perFiringTick;
    } else if (policy === 'fireEmpty') {
      // The fire moves in and burns fuel on a chamber holding no tiles.
      state.firePos = at;
      state.tick += 1;
      state.fuelIndex += C.fuel.perFiringTick;
    } else {
      return;                        // unknown policy: leave the fork standing
    }

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
  function step(dtMs) {
    if (state.paused || state.fork) return;

    const perTick = state.params.tickSeconds / state.params.speed;
    state.subTime += (dtMs / 1000) / perTick;

    // A while loop, not an if, so a long frame cannot silently lose a tick.
    while (state.subTime >= 1) {
      state.subTime -= 1;
      if (!advanceTick()) break;     // fork raised: stop here
    }
  }

  function dispatch(action) {
    const { type } = action;

    switch (type) {
      case 'tick':                   // step exactly one chamber, ignoring subTime
        state.subTime = 0;
        if (state.fork) break;       // a standing fork must be answered first
        state.paused = true;
        advanceTick();
        break;

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
