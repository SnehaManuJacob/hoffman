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

  if (!state.chambers[i].loaded) return 'empty';
  if (offset === 0) return 'fire';
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

  if (!state.chambers[i].loaded) return 0;

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
    loaded: true,
    temp: C.temperature.ambientC,   // Day 6 replaces this with the thermal model
    heat: 0,                        // relative 0-1, simulated. Never degrees.
    stage: 'wait',
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
    paused: true,                    // starts held so the page opens still
    fork: null,                      // set when the fire meets an empty chamber
    ui: { layer: 'structure', evidenceMode: false, fieldOnly: false },
  };

  const history = createHistory();
  syncStages(state);
  history.push(state);

  /**
   * Move the fire on by one chamber, or raise the fork if it cannot.
   *
   * Brief section 6.6: when the fire reaches an empty chamber the simulation
   * pauses and offers wait / skip / fire empty. The fork ALWAYS appears — the
   * engine never picks for the user, because what Kundapur does is unknown.
   */
  function advanceTick() {
    const next = (state.firePos + 1) % count;

    if (!state.chambers[next].loaded) {
      state.fork = { at: next, from: state.firePos, atTick: state.tick };
      state.paused = true;
      state.subTime = 0;
      return false;                  // the fire has not moved
    }

    state.firePos = next;
    state.tick += 1;
    state.fuelIndex += C.fuel.perFiringTick;
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
        // Day 5 wires the ring drag to this. History is the source, so scrubbing
        // back replays what actually happened rather than recomputing it.
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
        syncStages(state);
        break;
      }

      case 'loadChamber': {
        const i = action.index;
        if (!state.chambers[i]) break;
        state.chambers[i].loaded = true;
        // Reloading the chamber the fork is waiting on clears the fork.
        if (state.fork && state.fork.at === i) state.fork = null;
        syncStages(state);
        break;
      }

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
