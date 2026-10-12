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
      chambers: state.chambers.map((c) => ({
        loaded: c.loaded,
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

    clear() {
      snapshots.length = 0;
    },
  };
}
