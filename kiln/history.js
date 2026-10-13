/**
 * history.js — one snapshot per tick.
 *
 * Two jobs (brief sections 6.3 and 6.4):
 *   1. scrubbing backwards replays what actually happened, rather than trying
 *      to run the simulation in reverse;
 *   2. the space-time chart on Day 5 is drawn from these snapshots, so the
 *      firing front and any stall kink come straight out of recorded history.
 *
 * Snapshots are copies. If a snapshot shared chamber objects with live state,
 * scrubbing back would show the present wearing the past's clothes.
 */

export function createHistory() {
  const snapshots = [];

  /** Copy the parts of state that describe one moment. */
  function snapshot(state) {
    return {
      tick: state.tick,
      firePos: state.firePos,
      fuelIndex: state.fuelIndex,
      // Chambers actually fired, the denominator of the recovery comparison.
      firings: state.firings,
      /**
       * BOTH thermal worlds, not just the one being watched. The recovery
       * comparison is only honest if scrubbing back restores the kiln that was
       * on screen AND the counterfactual beside it — otherwise the figure in
       * the other row would still belong to the end of the run.
       */
      thermal: {
        on: state.thermal.on.temps.slice(),
        onFuel: state.thermal.on.fuel,
        off: state.thermal.off.temps.slice(),
        offFuel: state.thermal.off.fuel,
      },
      chambers: state.chambers.map((c) => ({
        loaded: c.loaded,
        // Whether a chamber has had its firing, and whether it is being held
        // open by hand, both belong to the moment the snapshot describes.
        fired: c.fired,
        heldEmpty: c.heldEmpty,
        temp: c.temp,
        // Relative heat, simulated. Recorded because a snapshot has to describe
        // the whole moment: scrubbing back (Day 5) and the chart that reads
        // these rows both need to know how hot each chamber was, not just what
        // stage it was in.
        heat: c.heat,
        stage: c.stage,
      })),
    };
  }

  return {
    /**
     * Record the current tick. Re-recording the same tick overwrites it, so a
     * fork resolution that lands on an existing tick does not duplicate a row.
     */
    push(state) {
      const snap = snapshot(state);
      const existing = snapshots.findIndex((s) => s.tick === snap.tick);
      if (existing >= 0) snapshots[existing] = snap;
      else snapshots.push(snap);
      return snap;
    },

    /** The snapshot for a given tick, or undefined if that tick never happened. */
    at(tick) {
      return snapshots.find((s) => s.tick === tick);
    },

    /** Every snapshot in tick order. Feeds the Day 5 chart. */
    all() {
      return snapshots.slice().sort((a, b) => a.tick - b.tick);
    },

    get length() {
      return snapshots.length;
    },

    /** Highest tick recorded, or -1 if nothing has been recorded. */
    get lastTick() {
      return snapshots.length ? Math.max(...snapshots.map((s) => s.tick)) : -1;
    },

    /**
     * Drop every snapshot after `tick`.
     *
     * Needed the moment the run diverges. Scrub back to tick 5, empty a
     * chamber, press play: the engine records a fresh tick 6, but ticks 7
     * onward from the OLD run are still sitting here, and the chart would
     * happily draw a future that is no longer going to happen.
     */
    truncateAfter(tick) {
      const before = snapshots.length;
      for (let i = snapshots.length - 1; i >= 0; i--) {
        if (snapshots[i].tick > tick) snapshots.splice(i, 1);
      }
      return before - snapshots.length;
    },

    clear() {
      snapshots.length = 0;
    },
  };
}
