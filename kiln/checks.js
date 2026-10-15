/**
 * checks.js — the three invariants from brief section 10.
 *
 *   "Console checks to keep passing: after 8 ticks the fire is back where it
 *    started; each chamber fires exactly once per loop; an empty chamber always
 *    triggers the fork."
 *
 * Run `kilnChecks()` in the browser console. Each check builds its own engine,
 * so running them never disturbs the kiln on screen.
 */

import { createEngine, gasCurve, gasAt } from './engine.js';
import { C, PALETTE, STAGE_COLOUR, COMPONENTS, METHODS, EVIDENCE } from './config.js';
import { createLoopPath } from './views/kilnPath.js';
import { SIMULATED_COLOUR } from './views/ring.js';

/** The same loop the ring draws, built from the same settings. */
function buildPath() {
  return createLoopPath({
    topology: C.form.topology,
    width: C.form.width,
    depth: C.form.depth,
    cornerRadius: C.form.cornerRadius,
  });
}

function check(name, fn) {
  try {
    const detail = fn();
    console.log(`%c PASS %c ${name}`, 'background:#2b6;color:#fff', '', detail ?? '');
    return { name, pass: true, detail };
  } catch (err) {
    console.error(`%c FAIL %c ${name}\n  ${err.message}`, 'background:#c33;color:#fff', '');
    return { name, pass: false, detail: err.message };
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

/** Step the engine on by exactly n ticks, bypassing wall-clock time. */
function advance(engine, n) {
  for (let i = 0; i < n; i++) engine.dispatch({ type: 'tick' });
}

/**
 * Charge the cold kiln and light it.
 *
 * The kiln now starts empty and spends its first few steps being filled, with
 * no simulated time passing. Every invariant about the FIRING CYCLE therefore
 * has to start from a lit kiln, or it would be counting charging steps as ticks.
 */
function light(engine) {
  let guard = 0;
  while (engine.state.phase === 'charging' && guard++ < 64) {
    engine.dispatch({ type: 'tick' });
  }
  return engine;
}

export function kilnChecks() {
  const count = C.chambers.count;
  console.log(`%c kiln checks %c ${count} chambers, ${C.time.tickHours} h per tick`,
    'background:#444;color:#fff', '');

  const results = [];

  // 1. After a full loop the fire is back where it started.
  results.push(check(`after ${count} ticks the fire returns to its start`, () => {
    const e = light(createEngine());
    const start = e.state.firePos;
    advance(e, count);
    assert(e.state.firePos === start,
      `expected firePos ${start}, got ${e.state.firePos}`);
    assert(e.state.tick === count,
      `expected tick ${count}, got ${e.state.tick}`);
    return `firePos back to ${start} at tick ${e.state.tick}`;
  }));

  // 2. Each chamber fires exactly once per loop.
  results.push(check('each chamber fires exactly once per loop', () => {
    const e = light(createEngine());
    const fired = new Array(count).fill(0);
    fired[e.state.firePos] += 1;              // the chamber alight at tick 0
    for (let i = 0; i < count; i++) {
      advance(e, 1);
      fired[e.state.firePos] += 1;
    }
    // One extra count: the starting chamber is seen at tick 0 and again at the
    // end of the loop. Every chamber should otherwise be seen exactly once.
    const counts = fired.map((n, i) => (i === 0 ? n - 1 : n));
    const wrong = counts
      .map((n, i) => ({ i, n }))
      .filter(({ n }) => n !== 1);
    assert(wrong.length === 0,
      `these chambers did not fire exactly once: ${JSON.stringify(wrong)}`);
    return `all ${count} chambers fired once`;
  }));

  // 3. An empty chamber always triggers the fork, and the fire never passes it.
  results.push(check('an empty chamber always triggers the fork', () => {
    // Try it for every chamber the fire could meet, not just one.
    for (let target = 1; target < count; target++) {
      const e = light(createEngine());
      e.dispatch({ type: 'emptyChamber', index: target });

      // Walk up to a full loop; the fork must appear before the fire gets past.
      for (let i = 0; i < count + 1; i++) {
        e.dispatch({ type: 'tick' });
        if (e.state.fork) break;
      }

      assert(e.state.fork, `emptying chamber ${target} raised no fork`);
      assert(e.state.fork.at === target,
        `fork raised at ${e.state.fork.at}, expected ${target}`);
      assert(e.state.firePos === target - 1,
        `fire sits at ${e.state.firePos}, expected to be held at ${target - 1}`);
      assert(e.state.paused === true, 'the fork did not pause the simulation');

      // The fork must hold: stepping again must not walk past the empty chamber.
      e.dispatch({ type: 'tick' });
      assert(e.state.firePos === target - 1,
        `the fire moved past the empty chamber to ${e.state.firePos}`);
    }
    return `fork held for every chamber 1..${count - 1}`;
  }));

  // 4. Not in the brief, but cheap and it protects the engine/views contract:
  //    the three fork policies must each leave the kiln in a different place.
  results.push(check('wait / skip / fire-empty each resolve differently', () => {
    const outcomes = {};
    for (const policy of ['wait', 'skip', 'fireEmpty']) {
      const e = light(createEngine());
      e.dispatch({ type: 'emptyChamber', index: 3 });
      for (let i = 0; i < count && !e.state.fork; i++) e.dispatch({ type: 'tick' });
      assert(e.state.fork, `no fork to resolve for policy "${policy}"`);
      e.dispatch({ type: 'chooseForkPolicy', policy });
      assert(e.state.fork === null, `policy "${policy}" left the fork standing`);
      outcomes[policy] = e.state.firePos;
    }
    assert(outcomes.wait === 2, `wait should hold the fire at 2, got ${outcomes.wait}`);
    assert(outcomes.fireEmpty === 3, `fire-empty should move to 3, got ${outcomes.fireEmpty}`);
    assert(outcomes.skip === 4, `skip should jump to 4, got ${outcomes.skip}`);
    return `wait->${outcomes.wait}, fireEmpty->${outcomes.fireEmpty}, skip->${outcomes.skip}`;
  }));

  // 5. The loop closes. A kiln whose ends did not meet would not be a Hoffmann
  //    kiln at all — continuity is the whole point of the 1858 patent.
  results.push(check('the kiln loop closes', () => {
    const path = buildPath();
    const a = path.at(0);
    const b = path.at(1);
    const gap = Math.hypot(a.x - b.x, a.z - b.z);
    assert(gap < 1e-6, `start and end are ${gap} apart`);
    return `closed to within ${gap.toExponential(1)}`;
  }));

  // 6. All chambers are the same length. Every chamber fires for the same two
  //    hours, so unequal chambers would draw a claim the model does not make.
  results.push(check(`all ${count} chambers are the same length`, () => {
    const path = buildPath();
    const lengths = [];
    for (let i = 0; i < count; i++) {
      let len = 0;
      let prev = path.at(i / count);
      for (let k = 1; k <= 200; k++) {
        const p = path.at((i + k / 200) / count);
        len += Math.hypot(p.x - prev.x, p.z - prev.z);
        prev = p;
      }
      lengths.push(len);
    }
    const min = Math.min(...lengths);
    const max = Math.max(...lengths);
    const spread = (max - min) / min;
    assert(spread < 1e-3, `chamber lengths differ by ${(spread * 100).toFixed(2)}%`);

    const sum = lengths.reduce((a, b) => a + b, 0);
    const err = Math.abs(sum - path.totalLength) / path.totalLength;
    assert(err < 1e-3, `chambers sum to ${sum}, perimeter is ${path.totalLength}`);

    return `each ${min.toFixed(3)} units, summing to the perimeter`;
  }));

  // 7. Every stage the engine can produce has a colour. Without this a new
  //    stage would render as undefined and simply vanish from the kiln.
  results.push(check('every stage has a colour', () => {
    const e = createEngine();
    const produced = new Set();

    // Walk a full loop, and a kiln with an empty chamber, to see them all.
    for (let i = 0; i < count; i++) {
      e.state.chambers.forEach((c) => produced.add(c.stage));
      e.dispatch({ type: 'tick' });
    }
    const e2 = createEngine();
    e2.dispatch({ type: 'emptyChamber', index: 4 });
    e2.state.chambers.forEach((c) => produced.add(c.stage));

    const missing = [...produced].filter((s) => !STAGE_COLOUR[s]);
    assert(missing.length === 0, `no colour for stage(s): ${missing.join(', ')}`);

    const unpainted = [...produced].filter((s) => !PALETTE[STAGE_COLOUR[s].key]);
    assert(unpainted.length === 0, `stage(s) point at a missing palette key: ${unpainted.join(', ')}`);

    return [...produced].sort().join(', ');
  }));

  // 8. Nothing is drawn without saying where it came from. This is the check
  //    that keeps the detailed kiln honest: a part can be added to the scene
  //    only if COMPONENTS records its evidence tag.
  results.push(check('every drawn component declares its evidence', () => {
    const ids = Object.keys(COMPONENTS);
    assert(ids.length > 0, 'COMPONENTS is empty');

    const bad = ids.filter((id) => !['F', 'L', 'A', 'S', 'U'].includes(COMPONENTS[id].tag));
    assert(bad.length === 0, `bad or missing tag on: ${bad.join(', ')}`);

    const unexplained = ids.filter((id) => !COMPONENTS[id].note);
    assert(unexplained.length === 0, `no note explaining: ${unexplained.join(', ')}`);

    const byTag = ids.reduce((acc, id) => {
      acc[COMPONENTS[id].tag] = (acc[COMPONENTS[id].tag] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(byTag).map(([t, n]) => `${n}x${t}`).join(' ');
  }));

  // 9. Only what was seen at Kundapur may be tagged F.
  //    If this ever reports more than chambers and stoke holes, something has
  //    been quietly promoted from borrowed to observed — and the legend would
  //    then count it, and the details sheet would file it under the one
  //    heading on the page that claims first-hand knowledge.
  results.push(check('only what was seen at Kundapur is tagged as field work', () => {
    const field = Object.keys(COMPONENTS).filter((id) => COMPONENTS[id].tag === 'F');
    assert(field.length > 0, 'nothing on screen claims to have been observed at all');
    const expected = ['chambers', 'stokeHoles'];
    const extra = field.filter((id) => !expected.includes(id));
    assert(extra.length === 0,
      `these claim to be field-documented but are not in section 4: ${extra.join(', ')}`);
    return `${field.join(', ')} — everything else is borrowed or assumed`;
  }));

  // 10. Relative heat stays relative, and grades along the kiln.
  //     Section 4 allows simulated values only in relative units, so this must
  //     never leave 0..1 and must never be read as degrees.
  results.push(check('relative heat stays in 0..1 and grades with distance', () => {
    // The kiln starts cold and empty, so the gradient only exists once it is
    // lit and running. Charge it, then step into steady state.
    const e = light(createEngine());
    for (let i = 0; i < count + 2; i++) e.dispatch({ type: 'tick' });
    const h = e.state.chambers.map((c) => c.heat);

    const out = h.filter((v) => !(v >= 0 && v <= 1));
    assert(out.length === 0, `heat outside 0..1: ${out.join(', ')}`);

    const fire = e.state.firePos;
    // The firing chamber is the hottest. Not a constant any more — the model
    // produces it, so the check is a property, not a lookup.
    const hottest = Math.max(...h);
    assert(h[fire] === hottest, `firing chamber reads ${h[fire]}, hottest is ${hottest}`);

    // Just behind the fire is hotter than the far end of the cooling run.
    const behind1 = h[(fire - 1 + count) % count];
    const behind2 = h[(fire - C.windows.cool + count) % count];
    assert(behind1 > behind2, `cooling run does not fall: ${behind1} then ${behind2}`);

    // Just ahead is hotter than the far end of the preheat run.
    const ahead1 = h[(fire + 1) % count];
    const aheadN = h[(fire + C.windows.preheat) % count];
    assert(ahead1 > aheadN, `preheat run does not fall: ${ahead1} then ${aheadN}`);

    // An empty chamber in the fire is still hot. If this ever reads cold, the
    // "fire empty" fork would draw as harmless, which is the opposite of true.
    const e2 = light(createEngine());
    e2.dispatch({ type: 'emptyChamber', index: 1 });
    e2.dispatch({ type: 'chooseForkPolicy', policy: 'fireEmpty' });
    for (let i = 0; i < count && e2.state.firePos !== 1; i++) {
      e2.dispatch({ type: 'tick' });
      if (e2.state.fork) e2.dispatch({ type: 'chooseForkPolicy', policy: 'fireEmpty' });
    }
    assert(e2.state.chambers[1].heat === Math.max(...e2.state.chambers.map((c) => c.heat)),
      `an empty chamber being fired reads ${e2.state.chambers[1].heat}, not the hottest in the kiln`);

    return `fire ${h[fire]}, cooling ${behind1}->${behind2}, preheat ${ahead1}->${aheadN}`;
  }));

  // 11. No temperature is ever printed on the kiln. The 850-900 C band is the
  //     only real figure and section 4 allows it only as a band; simulated
  //     per-chamber values must never appear as degrees at all.
  results.push(check('no per-chamber temperature is ever printed', () => {
    // Everything that leaves the engine for a view is relative 0..1. Exact
    // degrees live on chamber.temp, which only the console reads.
    const e = light(createEngine());
    for (let i = 0; i < count * 2; i++) e.dispatch({ type: 'tick' });
    const bad = e.state.chambers.filter((c) => !(c.heat >= 0 && c.heat <= 1));
    assert(bad.length === 0, `${bad.length} chambers expose heat outside 0..1`);
    assert(e.state.chambers.some((c) => c.temp > 1),
      'temperatures should be real degrees internally, for tuning in the console');

    const band = C.temperature.peakBandC;
    assert(Array.isArray(band) && band.length === 2,
      'the peak firing figure must be a band, not a single reading');
    return `heat is relative; the only real figure is the ${band[0]}-${band[1]} C band`;
  }));

  // 12. Heat is a real number after EVERY action, and survives a snapshot.
  //     A single undefined here used to index the colour ramp out of bounds,
  //     throw inside three.js and freeze the whole page, so it is worth
  //     checking after each action rather than only at startup.
  results.push(check('every chamber has a usable heat after every action', () => {
    const e = light(createEngine());
    const bad = [];
    const inspect = (label) => {
      e.state.chambers.forEach((c, i) => {
        if (!Number.isFinite(c.heat)) bad.push(`${label}: chamber ${i} = ${c.heat}`);
      });
    };

    inspect('at start');
    e.dispatch({ type: 'tick' }); inspect('after tick');
    e.dispatch({ type: 'emptyChamber', index: 4 }); inspect('after empty');
    e.dispatch({ type: 'loadChamber', index: 4 }); inspect('after load');
    e.dispatch({ type: 'setSpeed', value: 2 }); inspect('after speed');
    for (let i = 0; i < count; i++) e.dispatch({ type: 'tick' });
    inspect('after a full loop');
    e.dispatch({ type: 'scrubTo', tick: 1 }); inspect('after scrubbing back');

    assert(bad.length === 0, bad.join('; '));

    // The snapshot has to carry heat too, or scrubbing replays a kiln with
    // stages but no temperature.
    const snap = e.history.at(1);
    assert(snap, 'no snapshot recorded for tick 1');
    const missing = snap.chambers.filter((c) => !Number.isFinite(c.heat)).length;
    assert(missing === 0, `${missing} chambers in the snapshot have no heat`);

    return 'finite after tick, empty, load, speed, full loop and scrub';
  }));

  // 13. The kiln starts empty, charges, and then holds a steady rhythm.
  results.push(check('the kiln starts empty and fills as it runs', () => {
    const e = createEngine();
    const loadedCount = () => e.state.chambers.filter((c) => c.loaded).length;

    assert(loadedCount() === 0, `${loadedCount()} chambers already hold tiles at tick 0`);

    // It must charge without ever stalling: a fork here would mean the crew
    // cannot keep ahead of the fire from a cold start.
    for (let i = 0; i < count; i++) {
      e.dispatch({ type: 'tick' });
      assert(!e.state.fork, `the fire stalled while charging, at tick ${e.state.tick}`);
    }
    const charged = loadedCount();
    assert(charged > count / 2, `only ${charged} of ${count} chambers filled after a full loop`);

    // Steady state: the fire and the whole preheat run hold tiles, so green
    // tiles are always being warmed before they burn.
    for (let i = 0; i < count; i++) e.dispatch({ type: 'tick' });
    const { pre } = e.state.params.window;
    for (let step = 0; step <= pre; step++) {
      const i = (e.state.firePos + step) % count;
      assert(e.state.chambers[i].loaded,
        `chamber ${i} is ${step === 0 ? 'firing' : 'preheating'} but holds no tiles`);
    }

    return `charged to ${charged}, steady at ${loadedCount()} of ${count}`;
  }));

  // 14. Each chamber is emptied and refilled once per loop, and the crew never
  //     touches a chamber a person emptied by hand — otherwise the stall could
  //     not be demonstrated at all.
  results.push(check('tiles turn over once per loop, and hand-emptying sticks', () => {
    const e = light(createEngine());
    for (let i = 0; i < count * 2; i++) e.dispatch({ type: 'tick' });

    const watch = (e.state.firePos + 4) % count;
    let unloads = 0;
    let loads = 0;
    let was = e.state.chambers[watch].loaded;
    for (let i = 0; i < count; i++) {
      e.dispatch({ type: 'tick' });
      const now = e.state.chambers[watch].loaded;
      if (was && !now) unloads++;
      if (!was && now) loads++;
      was = now;
    }
    assert(unloads === 1 && loads === 1,
      `chamber ${watch} was emptied ${unloads}x and filled ${loads}x in one loop`);

    // Hand-emptied chambers stay empty.
    const held = (e.state.firePos + 3) % count;
    e.dispatch({ type: 'emptyChamber', index: held });
    e.dispatch({ type: 'tick' });
    assert(!e.state.chambers[held].loaded,
      `the crew refilled chamber ${held} after it was emptied by hand`);

    return `one out, one in per loop; hand-emptied chambers are left alone`;
  }));

  // 15. Green tiles go in COLD.
  //     A chamber must spend a whole interval idle after it is loaded, before
  //     the preheat run reaches it. Without that the crew's work lands in the
  //     same tick the fire moves, the chamber is reclassified as preheating
  //     immediately, and freshly stacked tiles are drawn already warm — which
  //     says the kiln warms tiles before they are in it.
  results.push(check('a chamber is loaded cold, and warms only afterwards', () => {
    const e = light(createEngine());
    const { pre } = e.state.params.window;
    // "Cold" is now a property of the model: a chamber just loaded must be
    // nowhere near the fire's heat. A fifth of the way up the ramp is generous.
    const coldest = 0.2;

    let checked = 0;
    const was = e.state.chambers.map((c) => c.loaded);
    for (let t = 0; t < count * 2; t++) {
      e.dispatch({ type: 'tick' });
      for (let i = 0; i < count; i++) {
        const justLoaded = !was[i] && e.state.chambers[i].loaded;
        was[i] = e.state.chambers[i].loaded;
        if (!justLoaded) continue;
        checked++;
        assert(e.state.chambers[i].stage === 'wait',
          `chamber ${i} was loaded straight into "${e.state.chambers[i].stage}"`);
        assert(e.state.chambers[i].heat <= coldest + 1e-9,
          `chamber ${i} was loaded at heat ${e.state.chambers[i].heat}, not cold`);
      }
    }
    assert(checked > 0, 'no chamber was loaded during two full loops');

    // And it must actually warm afterwards, or preheating would mean nothing.
    const warm = [];
    for (let step = 1; step <= pre; step++) {
      warm.push(e.state.chambers[(e.state.firePos + step) % count].heat);
    }
    assert(warm.every((h, k) => k === 0 || h <= warm[k - 1]),
      `preheat run does not rise toward the fire: ${warm.join(', ')}`);

    return `${checked} loads, every one under ${coldest} relative, warming to ${warm[0].toFixed(2)} by the fire`;
  }));

  // 16. Scrubbing replays what was recorded, exactly.
  //     If this drifts, the chart and the kiln stop agreeing and the whole
  //     point of having a history collapses.
  results.push(check('scrubbing restores exactly what history recorded', () => {
    const e = light(createEngine());
    for (let i = 0; i < count * 2; i++) e.dispatch({ type: 'tick' });

    for (const tick of [1, 3, count, count + 5]) {
      const snap = e.history.at(tick);
      assert(snap, `no snapshot for tick ${tick}`);
      e.dispatch({ type: 'scrubTo', tick });

      assert(e.state.tick === snap.tick, `tick ${e.state.tick} != ${snap.tick}`);
      assert(e.state.firePos === snap.firePos,
        `at tick ${tick}: firePos ${e.state.firePos} != recorded ${snap.firePos}`);
      assert(e.state.fuelIndex === snap.fuelIndex,
        `at tick ${tick}: fuelIndex ${e.state.fuelIndex} != recorded ${snap.fuelIndex}`);

      const wrong = e.state.chambers
        .map((c, i) => (c.loaded !== snap.chambers[i].loaded ? i : -1))
        .filter((i) => i >= 0);
      assert(wrong.length === 0, `at tick ${tick}, chambers ${wrong} differ from the record`);
      assert(e.state.paused === true, 'scrubbing did not pause the kiln');
    }
    return `replayed ticks 1, 3, ${count} and ${count + 5}`;
  }));

  // 17. Scrubbing cannot leave the record. There is no future to drag into,
  //     and nothing before the kiln was lit.
  results.push(check('scrubbing cannot leave the recorded run', () => {
    const e = light(createEngine());
    for (let i = 0; i < count; i++) e.dispatch({ type: 'tick' });
    const last = e.history.lastTick;

    e.dispatch({ type: 'scrubTo', tick: last + 5 });
    assert(e.state.tick <= last, `scrubbed to ${e.state.tick}, past the end at ${last}`);

    e.dispatch({ type: 'scrubTo', tick: -3 });
    assert(e.state.tick >= 0, `scrubbed to ${e.state.tick}, before the start`);

    // And before the kiln is lit there is nothing to scrub to at all.
    const cold = createEngine();
    cold.dispatch({ type: 'tick' });                 // one charging step
    const phaseBefore = cold.state.phase;
    cold.dispatch({ type: 'scrubTo', tick: 0 });
    assert(cold.state.phase === phaseBefore, 'scrubbing disturbed the charging kiln');

    return `clamped to 0..${last}, inert while charging`;
  }));

  // 18. A future that will no longer happen must be dropped.
  results.push(check('a diverged future is dropped from the record', () => {
    const e = light(createEngine());
    for (let i = 0; i < count * 2; i++) e.dispatch({ type: 'tick' });
    const far = e.history.lastTick;
    assert(far > 6, `expected a long run, got ${far} ticks`);

    e.dispatch({ type: 'scrubTo', tick: 4 });
    // Change something, so what happens next is genuinely different.
    e.dispatch({ type: 'emptyChamber', index: (e.state.firePos + 3) % count });
    e.dispatch({ type: 'tick' });

    const stale = e.history.all().filter((s) => s.tick > e.state.tick);
    assert(stale.length === 0,
      `${stale.length} snapshots from the old run survived past tick ${e.state.tick}`);
    assert(e.history.lastTick === e.state.tick,
      `history ends at ${e.history.lastTick}, the kiln is at ${e.state.tick}`);

    return `truncated ${far} ticks of old future back to ${e.state.tick}`;
  }));

  // 19. One eighth of a turn is one tick. The drag maths, as a pure function,
  //     so it needs no browser.
  results.push(check('one eighth of a turn is one tick', () => {
    const perTick = (Math.PI * 2) / count;
    const ticksFor = (radians) => Math.round(radians / perTick);

    assert(ticksFor(perTick) === 1, 'an eighth of a turn should be 1 tick');
    assert(ticksFor(Math.PI * 2) === count, `a full turn should be ${count} ticks`);
    assert(ticksFor(-perTick) === -1, 'dragging back should go back');
    assert(ticksFor(perTick * 0.4) === 0, 'under half a chamber should not move');
    assert(ticksFor(perTick * 0.6) === 1, 'over half a chamber should snap on');

    return `${count} ticks per turn, snapping at half a chamber`;
  }));

  // 20. The one hard field figure the model must respect: peak firing sits in
  //     the 850-900 C band. Everything else about the model is invented; this
  //     is the number it has to land on.
  results.push(check('the firing chamber settles inside the 850-900 band', () => {
    const [lo, hi] = C.temperature.peakBandC;
    const e = light(createEngine());
    for (let i = 0; i < count * 3; i++) e.dispatch({ type: 'tick' });

    const seen = [];
    for (let i = 0; i < count * 2; i++) {
      e.dispatch({ type: 'tick' });
      seen.push(e.state.chambers[e.state.firePos].temp);
    }
    const out = seen.filter((t) => t < lo || t > hi);
    assert(out.length === 0,
      `${out.length} of ${seen.length} firings outside the band, e.g. ${Math.round(out[0])} C`);
    return `${Math.round(Math.min(...seen))}-${Math.round(Math.max(...seen))} C over ${seen.length} firings`;
  }));

  /**
   * 21. A cold KILN warms over a loop or two; it does not snap to temperature.
   *
   * About the kiln, not about the firing chamber. The chamber in the fire has a
   * fire in it and reaches the band quickly — it should. What takes time is the
   * mass of the whole kiln coming up, and that is what makes the opening of the
   * simulation say something true about starting one.
   *
   * This used to assert that the FIRST firing fell short of the band, which was
   * really a statement about the fuel ceiling. Day 8 raised that ceiling so the
   * crew can hold the band with heat recovery off, and the first firing now
   * reaches it. The kiln still takes a loop and a half to warm, which is the
   * thing the check was always for.
   */
  results.push(check('a cold kiln warms far slower than the chamber in the fire', () => {
    const e = light(createEngine());
    const ambient = C.temperature.ambientC;
    const [lo] = C.temperature.peakBandC;

    const means = [];
    const fires = [];
    for (let i = 0; i < count * 4; i++) {
      e.dispatch({ type: 'tick' });
      means.push(e.state.chambers.reduce((a, c) => a + c.temp, 0) / count);
      fires.push(e.state.chambers[e.state.firePos].temp);
    }
    const final = means[means.length - 1];

    const kilnWarm = means.findIndex((m) => m - ambient >= (final - ambient) * 0.95) + 1;
    const fireWarm = fires.findIndex((t) => t >= lo) + 1;
    assert(fireWarm > 0, 'the fire never reached the band at all');

    // The kiln's mass is the slow part. Measured: the fire is in the band by
    // tick 2, the kiln takes a full loop of 8 to come within 5% of settling.
    assert(kilnWarm >= count / 2,
      `the whole kiln was warm by tick ${kilnWarm}, less than half a loop`);
    assert(kilnWarm >= fireWarm * 3,
      `the kiln warmed in ${kilnWarm} ticks against the fire's ${fireWarm} — barely slower`);

    return `fire in the band at tick ${fireWarm}; kiln mean ${Math.round(ambient)} -> `
      + `${Math.round(final)} C, within 5% at tick ${kilnWarm}`;
  }));

  // 22. Heat grades away from the fire in BOTH directions, and the chamber
  //     that has just fired is hotter than the one about to be.
  results.push(check('temperature falls away from the fire on both sides', () => {
    const e = light(createEngine());
    for (let i = 0; i < count * 4; i++) e.dispatch({ type: 'tick' });
    const f = e.state.firePos;
    const at = (k) => e.state.chambers[((f + k) % count + count) % count].temp;

    for (let k = 1; k < C.windows.preheat; k++) {
      assert(at(k) > at(k + 1),
        `preheat run does not fall: offset ${k} is ${Math.round(at(k))}, ${k + 1} is ${Math.round(at(k + 1))}`);
    }
    for (let k = 1; k < C.windows.cool; k++) {
      assert(at(-k) > at(-k - 1),
        `cooling run does not fall: ${Math.round(at(-k))} then ${Math.round(at(-k - 1))}`);
    }
    assert(at(-1) > at(1),
      `just-fired (${Math.round(at(-1))}) should be hotter than about-to-fire (${Math.round(at(1))})`);

    return `ahead ${Math.round(at(1))}->${Math.round(at(C.windows.preheat))}, `
      + `behind ${Math.round(at(-1))}->${Math.round(at(-C.windows.cool))}`;
  }));

  // 23. One chamber, one loop: warms, peaks once in the fire, then cools.
  results.push(check('a chamber warms, peaks once, then cools', () => {
    const e = light(createEngine());
    for (let i = 0; i < count * 4; i++) e.dispatch({ type: 'tick' });

    const watch = (e.state.firePos + 4) % count;
    const trace = [];
    for (let i = 0; i < count; i++) {
      e.dispatch({ type: 'tick' });
      trace.push(e.state.chambers[watch].temp);
    }

    const peak = Math.max(...trace);
    const peakAt = trace.indexOf(peak);
    const peaks = trace.filter((t, i) =>
      (i === 0 || t > trace[i - 1]) && (i === trace.length - 1 || t > trace[i + 1])).length;

    assert(peaks === 1, `chamber ${watch} peaked ${peaks} times in one loop`);
    assert(trace[peakAt] > trace[0], 'it never warmed');
    assert(trace[trace.length - 1] < peak, 'it never cooled again');

    return `${Math.round(trace[0])} -> peak ${Math.round(peak)} -> ${Math.round(trace[trace.length - 1])} C`;
  }));

  // 24. No runaway and no impossible cold. An explicit integrator is easy to
  //     make unstable, and it would not look wrong until it was very wrong.
  results.push(check('the model stays stable over a long run', () => {
    const ambient = C.temperature.ambientC;
    const ceiling = C.temperature.peakBandC[1] * 1.15;
    const e = light(createEngine());

    let hottest = 0;
    let coldest = Infinity;
    for (let i = 0; i < 400; i++) {
      e.dispatch({ type: 'tick' });
      for (const ch of e.state.chambers) {
        if (!Number.isFinite(ch.temp)) throw new Error(`temperature went to ${ch.temp}`);
        hottest = Math.max(hottest, ch.temp);
        coldest = Math.min(coldest, ch.temp);
      }
    }
    assert(hottest <= ceiling, `ran away to ${Math.round(hottest)} C`);
    assert(coldest >= ambient - 1e-6, `fell to ${Math.round(coldest)} C, below ambient`);
    return `400 ticks: ${Math.round(coldest)}-${Math.round(hottest)} C`;
  }));

  // 25. Heat follows SIMULATED time, not frames. Without this the kiln would
  //     be a different kiln at 4x, on a slow machine, or on a busy tab.
  results.push(check('the model is frame-rate and speed independent', () => {
    const run = (frames, msEach, speed) => {
      const e = light(createEngine());
      e.dispatch({ type: 'setPaused', value: false });
      e.dispatch({ type: 'setSpeed', value: speed });
      for (let i = 0; i < frames; i++) e.step(msEach);
      return e.state.chambers.map((c) => c.temp);
    };

    const coarse = run(10, 100, 1);
    const fine = run(100, 10, 1);
    const worst = Math.max(...coarse.map((t, i) => Math.abs(t - fine[i])));
    assert(worst < 1.0, `coarse and fine frames differ by ${worst.toFixed(2)} C`);

    // Same simulated time at 4x: a quarter of the real milliseconds.
    const fast = run(100, 10 / 4, 4);
    const drift = Math.max(...fine.map((t, i) => Math.abs(t - fast[i])));
    assert(drift < 1.0, `1x and 4x differ by ${drift.toFixed(2)} C over the same simulated time`);

    return `frames differ by ${worst.toFixed(3)} C, speeds by ${drift.toFixed(3)} C`;
  }));

  // ---------------------------------------------------------------- Day 8
  // Heat recovery. The engine runs the kiln BOTH ways at once over one firing
  // schedule, so these read two live worlds rather than comparing two runs.

  /** Run to steady state and hand back the engine. */
  const settled = (params) => {
    const e = light(createEngine(params));
    for (let i = 0; i < count * 5; i++) e.dispatch({ type: 'tick' });
    return e;
  };

  /**
   * 26. The peak holds whichever way the kiln is run.
   *
   * This is the decision the day was built on: recovery changes the FUEL, not
   * the temperature. If the peak moved too, the comparison beside it could not
   * say whether the extra fuel bought heat or was thrown away.
   */
  results.push(check('the band holds with heat recovery on or off', () => {
    const [lo, hi] = C.temperature.peakBandC;
    const e = settled();
    const seen = { on: [], off: [] };
    for (let i = 0; i < count * 2; i++) {
      e.dispatch({ type: 'tick' });
      seen.on.push(e.state.thermal.on.temps[e.state.firePos]);
      seen.off.push(e.state.thermal.off.temps[e.state.firePos]);
    }
    for (const key of ['on', 'off']) {
      const out = seen[key].filter((t) => t < lo || t > hi);
      assert(out.length === 0,
        `recovery ${key}: ${out.length} firings outside the band, e.g. ${Math.round(out[0])} C`);
    }
    return `on ${Math.round(Math.min(...seen.on))}-${Math.round(Math.max(...seen.on))} C, `
      + `off ${Math.round(Math.min(...seen.off))}-${Math.round(Math.max(...seen.off))} C`;
  }));

  /**
   * 27. Section 6.5's stated outcome, MEASURED. There is deliberately no
   * penalty constant in config.js for this to read; the figure has to come out
   * of the model or it is not a finding.
   */
  results.push(check('running without heat recovery burns more fuel', () => {
    const e = settled();
    const { on, off, firings } = e.state.fuelCompare;
    assert(firings > 0, 'nothing was fired, so there is nothing to compare');
    const rateOn = on / firings;
    const rateOff = off / firings;
    assert(rateOff > rateOn,
      `without recovery ${rateOff.toFixed(0)} per firing, with ${rateOn.toFixed(0)} — no penalty at all`);
    return `${rateOn.toFixed(0)} vs ${rateOff.toFixed(0)} per chamber fired `
      + `(${(rateOff / rateOn).toFixed(2)}x) over ${firings} firings`;
  }));

  // 28. The other half of 6.5: with the exhaust going straight up the chimney
  //     the chambers ahead get nothing and arrive at the fire cold.
  results.push(check('without recovery the chambers ahead stay cold', () => {
    const e = settled();
    const f = e.state.firePos;
    const ahead = (k) => (f + k) % count;
    for (let k = 1; k <= C.windows.preheat; k++) {
      const warm = e.state.thermal.on.temps[ahead(k)];
      const cold = e.state.thermal.off.temps[ahead(k)];
      assert(cold < warm,
        `offset ${k}: ${Math.round(cold)} C without recovery is not below ${Math.round(warm)} C with it`);
    }
    const list = (w) => [1, 2, 3].map((k) => Math.round(e.state.thermal[w].temps[ahead(k)])).join('/');
    return `ahead of the fire: ${list('on')} C with reuse, ${list('off')} C without`;
  }));

  /**
   * 29. The comparison is CONTROLLED: the two worlds differ in recovery and in
   * nothing else. If the setting changed where the fire went or what got
   * loaded, the two fuel figures would be measuring two different kilns and the
   * number beside them would mean nothing.
   */
  results.push(check('the two recovery settings share one firing schedule', () => {
    const a = light(createEngine({ params: { recovery: true } }));
    const b = light(createEngine({ params: { recovery: false } }));

    for (let i = 0; i < count * 3; i++) {
      a.dispatch({ type: 'tick' });
      b.dispatch({ type: 'tick' });
      assert(a.state.firePos === b.state.firePos,
        `tick ${i}: fire at ${a.state.firePos} with recovery, ${b.state.firePos} without`);
      assert(a.state.firings === b.state.firings,
        `tick ${i}: ${a.state.firings} firings with recovery, ${b.state.firings} without`);
      for (let c = 0; c < count; c++) {
        assert(a.state.chambers[c].loaded === b.state.chambers[c].loaded,
          `tick ${i}: chamber ${c} loaded differently`);
      }
    }

    // And each engine computes the SAME pair of figures, whichever it is showing.
    assert(Math.abs(a.state.fuelCompare.off - b.state.fuelCompare.off) < 1e-6
      && Math.abs(a.state.fuelCompare.on - b.state.fuelCompare.on) < 1e-6,
      'the two engines disagree about the counterfactual');

    return `${count * 3} ticks, identical schedule and identical figures`;
  }));

  /**
   * 30. Scrubbing restores BOTH worlds. Restoring only the one on screen would
   * leave the other standing at the end of the run, and the figure beside the
   * kiln would quietly stop describing the moment being shown.
   */
  results.push(check('scrubbing back restores both recovery figures', () => {
    const e = settled();
    const mid = Math.floor(e.state.tick / 2);
    const snap = e.history.at(mid);
    assert(snap, `no snapshot at tick ${mid}`);

    e.dispatch({ type: 'scrubTo', tick: mid });
    assert(e.state.fuelCompare.on === snap.thermal.onFuel,
      `recovery-on fuel ${e.state.fuelCompare.on} != recorded ${snap.thermal.onFuel}`);
    assert(e.state.fuelCompare.off === snap.thermal.offFuel,
      `recovery-off fuel ${e.state.fuelCompare.off} != recorded ${snap.thermal.offFuel}`);
    assert(e.state.firings === snap.firings,
      `${e.state.firings} firings restored, ${snap.firings} recorded`);

    // Flipping the switch there must still show that moment, not the run's end.
    e.dispatch({ type: 'setRecovery', value: false });
    const worst = Math.max(...e.state.chambers.map(
      (c, i) => Math.abs(c.temp - snap.thermal.off[i]),
    ));
    assert(worst < 1e-9, `after flipping the switch, chambers are off by ${worst.toFixed(3)} C`);

    return `tick ${mid}: both figures and both worlds restored`;
  }));

  /**
   * 31. The gas profile is the model's own working value, not a second story.
   *
   * The airflow arrow is drawn from this, so if it ever stopped agreeing with
   * the temperatures beside it the picture and the fuel figures would be two
   * independent claims about the same kiln — which is exactly what this
   * replaced.
   */
  results.push(check('the gas carries one temperature all the way round', () => {
    const e = settled();
    const p = e.state.gasProfile;
    const ambient = C.temperature.ambientC;

    assert(p.length === C.windows.cool + C.windows.preheat + 1,
      `${p.length} entries for a flow path of ${C.windows.cool + C.windows.preheat + 1}`);
    assert(Math.abs(p[0].inC - ambient) < 1e-9,
      `gas enters at ${p[0].inC.toFixed(1)} C, not ambient ${ambient} C`);

    for (let i = 1; i < p.length; i++) {
      assert(Math.abs(p[i].inC - p[i - 1].outC) < 1e-9,
        `a gap at chamber ${p[i].chamber}: gas left the last one at `
        + `${p[i - 1].outC.toFixed(1)} C and arrives at ${p[i].inC.toFixed(1)} C`);
    }

    // The order of the entries is the order the gas travels, so the fire —
    // the only place heat is added — has to be where the gas is hottest.
    const hottest = p.reduce((b, g, i) => (g.outC > p[b].outC ? i : b), 0);
    assert(p[hottest].fire,
      `gas is hottest leaving chamber ${p[hottest].chamber}, which is not the fire`);

    /**
     * And it leaves the fire AT the fire, not merely warmed by brushing past
     * it. Gas coming off a flame cannot be cooler than the flame.
     *
     * The weaker test above — hottest at the fire — does not catch this:
     * delete the line that sets it and the gas is still hottest there, just
     * 170 C short. Measured, not assumed; that break passed 32/32 before
     * this assertion was added.
     */
    const atFire = p.find((g) => g.fire);
    const fireTemp = e.state.thermal[e.state.params.recovery ? 'on' : 'off'].temps[atFire.chamber];
    assert(atFire.outC >= fireTemp - 1e-6,
      `gas leaves the fire at ${Math.round(atFire.outC)} C, `
      + `below the burning chamber's ${Math.round(fireTemp)} C`);

    return `${p.map((g) => Math.round(g.outC)).join(' -> ')} C`;
  }));

  /**
   * 32. What the switch does to the gas, stated where the arrow reads it.
   *
   * Check 28 says the chambers ahead stay cold; this says the other half out
   * loud — the heat they are not getting goes up the chimney instead.
   */
  results.push(check('without recovery the exhaust leaves at the fire\'s heat', () => {
    const e = settled();
    const { on, off } = e.state.gasCompare;
    const exit = (p) => p[p.length - 1].outC;
    const peak = (p) => Math.max(...p.map((g) => g.outC));

    assert(off.length === C.windows.cool + 1,
      `${off.length} chambers on the path without recovery, expected ${C.windows.cool + 1}`);
    assert(exit(off) >= peak(off) - 1e-9,
      `exhaust leaves at ${Math.round(exit(off))} C with nothing ahead to cool it, `
      + `below the peak ${Math.round(peak(off))} C`);
    assert(exit(on) < exit(off) * 0.7,
      `reusing heat only brings the exhaust from ${Math.round(exit(off))} C `
      + `to ${Math.round(exit(on))} C`);

    return `exhaust ${Math.round(exit(on))} C with reuse, ${Math.round(exit(off))} C without`;
  }));

  /**
   * 33. The curve the arrow is drawn along may be smooth, but it may not be
   * creative.
   *
   * `gasCurve` exists so the gas reads as a curve rather than a run of
   * straight lines meeting at corners. The risk in any smoothing is that it
   * invents values between the ones it was given — an ordinary spline
   * overshoots on the way up to the fire and would draw gas hotter than
   * anything in the kiln, which is a temperature claim nobody made.
   */
  results.push(check('the gas curve stays inside what the model computed', () => {
    const e = settled();
    const p = e.state.gasProfile;
    const curve = gasCurve(p);
    const knots = [p[0].inC, ...p.map((g) => g.outC)];

    // It must pass exactly through every value the model produced.
    for (let k = 0; k < knots.length; k++) {
      assert(Math.abs(gasAt(curve, k) - knots[k]) < 1e-9,
        `at chamber boundary ${k} the curve reads ${gasAt(curve, k).toFixed(1)} C, `
        + `not the model's ${knots[k].toFixed(1)} C`);
    }

    // And between them it must stay inside the pair it is travelling between.
    let worst = 0;
    for (let k = 0; k < knots.length - 1; k++) {
      const lo = Math.min(knots[k], knots[k + 1]);
      const hi = Math.max(knots[k], knots[k + 1]);
      for (let s = 1; s < 32; s++) {
        const v = gasAt(curve, k + s / 32);
        assert(v >= lo - 1e-6 && v <= hi + 1e-6,
          `between chambers ${k} and ${k + 1} the curve reaches ${v.toFixed(1)} C, `
          + `outside the ${lo.toFixed(1)}-${hi.toFixed(1)} C the model computed`);
        worst = Math.max(worst, Math.max(lo - v, v - hi));
      }
    }

    return `${knots.length} boundaries hit exactly, no overshoot between them `
      + `(worst ${worst.toExponential(1)} C)`;
  }));

  // 15. Every method describes THIS model (day 11, brief section 8).
  //     The details sheet claims to say how each simulated figure is arrived
  //     at. A method citing a value the model does not have is a description
  //     of some other program, and it would read as authoritative anyway.
  results.push(check('every method cites values this model actually has', () => {
    assert(METHODS.length > 0, 'METHODS is empty');

    const missing = [];
    for (const m of METHODS) {
      assert(m.title && m.what && m.how, `incomplete method: ${m.title ?? '(untitled)'}`);
      assert(m.tag in EVIDENCE, `method "${m.title}" has no evidence code`);
      assert(m.where, `method "${m.title}" does not say where the rule lives`);
      assert(m.inputs?.length > 0, `method "${m.title}" cites no config values`);

      for (const path of m.inputs) {
        const value = path.split('.').reduce((node, key) => node?.[key], C);
        if (value === undefined) missing.push(`${m.title} -> ${path}`);
      }
    }
    assert(missing.length === 0, `methods cite values that do not exist: ${missing.join(', ')}`);

    return `${METHODS.length} methods, ${METHODS.reduce((n, m) => n + m.inputs.length, 0)} config values cited`;
  }));

  // 16. The legend cannot name a part that has no provenance.
  //     It is built by looking up drawn component ids in COMPONENTS, so an id
  //     that is drawn but not recorded would appear in the legend as
  //     `undefined` rather than failing anywhere. The same goes for a part
  //     whose COLOUR is simulated: that mapping lives in views/ring.js and
  //     has to point at components that exist.
  results.push(check('the legend can account for every part it is given', () => {
    const unknown = Object.keys(SIMULATED_COLOUR).filter((id) => !COMPONENTS[id]);
    assert(unknown.length === 0,
      `simulated colour claimed for parts with no entry in COMPONENTS: ${unknown.join(', ')}`);

    const badCode = Object.entries(SIMULATED_COLOUR)
      .filter(([, code]) => !(code in EVIDENCE))
      .map(([id]) => id);
    assert(badCode.length === 0, `bad evidence code on: ${badCode.join(', ')}`);

    /**
     * The chambers are the trap this check exists for. The heat LOOKS like it
     * is in them, but it is painted on the tile stacks inside; listing the
     * chambers as simulated-coloured had the legend reporting that the one
     * part of the drawing actually counted at Kundapur was showing a computed
     * colour.
     */
    const observed = Object.keys(SIMULATED_COLOUR).filter((id) => COMPONENTS[id].tag === 'F');
    assert(observed.length === 0,
      `field-observed parts claimed to carry a simulated colour: ${observed.join(', ')}`);

    return `${Object.keys(SIMULATED_COLOUR).join(', ')} carry a computed colour`;
  }));

  const passed = results.filter((r) => r.pass).length;
  const style = passed === results.length
    ? 'background:#2b6;color:#fff'
    : 'background:#c33;color:#fff';
  console.log(`%c ${passed}/${results.length} checks passed `, style);

  return results;
}

// Exposed for the console. Brief section 14.10: debugging starts in the console.
if (typeof window !== 'undefined') {
  window.kilnChecks = kilnChecks;

  // Open index.html?checks to run them on load and show the result on the page.
  // Useful when the console is awkward to reach — a test laptop, or Day 13.
  if (new URLSearchParams(location.search).has('checks')) {
    window.addEventListener('load', () => {
      const results = kilnChecks();
      const passed = results.filter((r) => r.pass).length;
      const el = document.createElement('div');
      el.id = 'checks-result';
      el.className = 'debug-summary';
      el.textContent = `checks: ${passed}/${results.length} passed — ` +
        results.map((r) => `${r.pass ? 'ok' : 'FAIL'} ${r.name}`).join(' · ');
      document.getElementById('debug')?.append(el);
    });
  }
}
