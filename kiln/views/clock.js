/**
 * views/clock.js — the dial in the transport bar.
 *
 * A VIEW. It reads simulated time off engine state and points a hand at it.
 * It holds no kiln rules and, in particular, IT KEEPS NO CLOCK OF ITS OWN:
 * the hand's angle is a function of `state.tick + state.subTime` and nothing
 * else. Pausing, scrubbing backwards and stalling at a fork all fall out of
 * that for free — simulated time stops, so the hand stops; the kiln is
 * dragged backwards, so the hand runs backwards. A view driven by its own
 * `setInterval` would have to be told about every one of those cases and
 * would be wrong in between.
 *
 * WHY SIX MARKS
 * The face is a twelve-hour one, marked only where this kiln can be: 12, 2,
 * 4, 6, 8, 10. One mark per firing step, 60 degrees apart, so the dial itself
 * says "two hours per move" without a caption, and the hand coming to rest on
 * a mark is the fire arriving somewhere new.
 *
 * The marks are generated from `C.time.tickHours`. A face with six marks
 * drawn into the markup would go on claiming a two-hour interval after the
 * factory told us it was something else — which is the kind of quiet lie this
 * whole project is built to avoid.
 */

import { C } from '../config.js';

/** Where the hand is, in degrees clockwise from twelve. */
function angleFor(state) {
  /**
   * NO SIMULATED TIME PASSES WHILE THE KILN IS BEING FILLED, so the clock has
   * not started and reads zero.
   *
   * `subTime` is the engine's progress towards its next step, and during
   * charging a step is A CHAMBER BEING LOADED, not two hours going by.
   * Reading it as time here had the hand sweep sixty degrees and snap back
   * once per chamber while the crew stacked the cold kiln — the dial showing
   * time passing beside a figure correctly reading 0 h.
   */
  if (state.phase === 'charging') return 0;

  const hours = (state.tick + state.subTime) * C.time.tickHours;
  return (hours / C.clock.dialHours) * 360;
}

/**
 * The shortest way round from one angle to another.
 *
 * The hand crosses twelve every sixth step. Subtracting raw angles there
 * gives -330 instead of +30, and the hand unwinds almost a full turn
 * backwards while the fire moves forwards.
 */
function shortestDelta(from, to) {
  return ((to - from + 540) % 360) - 180;
}

export function createClock({ dialEl, handEl, marksEl }) {
  /**
   * One mark per firing step, round the whole face.
   *
   * Written as a walk in HOURS rather than a count of marks, so an interval
   * that does not divide the face evenly produces an honest uneven dial
   * instead of silently rounding to something tidy.
   */
  const step = C.time.tickHours;
  for (let hour = 0; hour < C.clock.dialHours; hour += step) {
    const mark = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const angle = (hour / C.clock.dialHours) * 360;
    mark.setAttribute('x1', '0');
    mark.setAttribute('y1', '-46');
    mark.setAttribute('x2', '0');
    mark.setAttribute('y2', '-38');
    mark.setAttribute('transform', `rotate(${angle})`);
    mark.dataset.hour = String(hour);
    marksEl.append(mark);
  }

  /**
   * Motion is the point here, so reduced motion is honoured in JS. The
   * stylesheet's `prefers-reduced-motion` block only disables CSS transitions
   * and animations, and neither of those is what moves this hand.
   */
  const stillness = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  let current = 0;          // where the hand is drawn, degrees
  let lastTick = null;      // to notice a firing step
  let lastPhase = null;     // to notice the kiln being lit
  let flashLeft = 0;        // real milliseconds of red remaining

  /**
   * How long to hold the red.
   *
   * A flat second is longer than a whole tick at 4x speed, so the dial would
   * never come out of the flash and the mark would stop marking anything.
   * Capped against the real duration of one tick instead: a full second at
   * 1x and below, and 0.375 s at 4x.
   */
  function flashDuration(state) {
    const tickMs = (state.params.tickSeconds / state.params.speed) * 1000;
    return Math.min(C.clock.flashSeconds * 1000, C.clock.flashMaxOfTick * tickMs);
  }

  function update(state, dtMs = 16) {
    const target = angleFor(state);

    /**
     * The hand eases towards the model rather than being placed on it.
     * Step sets `subTime` to 0 and advances the tick, so the model angle
     * jumps a whole 60 degrees at once; placed, the hand would teleport and
     * the firing step would read as a glitch rather than as a movement.
     *
     * During Play the lag this costs is about a degree at 1x — the target
     * moves 20 degrees a second and the gap closes exponentially — so the
     * hand is showing simulated time, not trailing it.
     */
    const delta = shortestDelta(current, target);
    if (stillness?.matches || Math.abs(delta) < C.clock.handSnapDeg) {
      current = target;
    } else {
      current += delta * C.clock.handSettle;
    }
    handEl.setAttribute('transform', `rotate(${current.toFixed(2)})`);

    /**
     * A clock that has not started yet, said plainly. Otherwise a full face
     * with a hand resting at twelve for the whole of the charging phase reads
     * as a stopped clock rather than as one waiting to start.
     */
    dialEl.classList.toggle('is-waiting', state.phase === 'charging');

    /**
     * The flash marks TIME PASSING, so it fires when the tick goes up and
     * stays quiet when it comes down. Scrubbing the kiln backwards is time
     * being moved, not time going by, and a dial flashing through a backwards
     * drag would be reporting firings that are being un-done.
     *
     * Lighting the kiln is the exception, and it is the same event by another
     * name: the first firing begins, and the clock begins with it. The tick
     * does not move at that moment — charging and the first chamber are both
     * tick 0 — so there is nothing else for the flash to key on.
     */
    const lit = lastPhase === 'charging' && state.phase !== 'charging';
    if (lit || (lastTick !== null && state.tick > lastTick)) flashLeft = flashDuration(state);
    lastTick = state.tick;
    lastPhase = state.phase;

    // Real milliseconds, not simulated: this is a beat for whoever is
    // watching, not an event inside the kiln.
    if (flashLeft > 0) flashLeft = Math.max(0, flashLeft - dtMs);
    dialEl.classList.toggle('is-firing', flashLeft > 0);
  }

  return { update };
}
