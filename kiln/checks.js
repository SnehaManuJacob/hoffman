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

import { createEngine } from './engine.js';
import { C, PALETTE, STAGE_COLOUR, COMPONENTS } from './config.js';
import { createLoopPath } from './views/kilnPath.js';

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

  // 9. The field-only filter must leave something, and must leave only Kundapur.
  //    If this ever reports more than chambers and stoke holes, something has
  //    been quietly promoted from borrowed to observed.
  results.push(check('field-only leaves just what was seen at Kundapur', () => {
    const field = Object.keys(COMPONENTS).filter((id) => COMPONENTS[id].tag === 'F');
    assert(field.length > 0, 'nothing survives the field-only filter');
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
    assert(h[fire] === C.heat.firing, `firing chamber reads ${h[fire]}`);

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
    assert(e2.state.chambers[1].heat === C.heat.firing,
      `an empty chamber being fired reads ${e2.state.chambers[1].heat}, not hot`);

    return `fire ${h[fire]}, cooling ${behind1}->${behind2}, preheat ${ahead1}->${aheadN}`;
  }));

  // 11. No temperature is ever printed on the kiln. The 850-900 C band is the
  //     only real figure and section 4 allows it only as a band; simulated
  //     per-chamber values must never appear as degrees at all.
  results.push(check('no per-chamber temperature is ever printed', () => {
    const offenders = Object.entries(C.heat)
      .filter(([, v]) => typeof v === 'number' && v > 1);
    assert(offenders.length === 0,
      `these look like degrees, not relative units: ${offenders.map(([k]) => k).join(', ')}`);
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
    const coldest = Math.min(C.heat.waiting, C.heat.lastPreheat);

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

    return `${checked} loads, every one cold at ${C.heat.waiting}, warming to ${warm[0]} at the fire`;
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
