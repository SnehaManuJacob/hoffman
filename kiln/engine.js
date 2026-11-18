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
  'setEvidenceMode',
  'setDetails',
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
 * The gas temperature between the points the model computes.
 *
 * `gasProfile` gives the gas at each chamber BOUNDARY. Joining those with
 * straight lines — which is what this replaced — says the gas changes at one
 * steady rate all the way through a chamber and then changes rate instantly
 * at the dividing wall. It does neither. The result was a polyline: a crease
 * at every boundary and, worst of all, a sharp spike at the fire, where the
 * gas stops climbing and starts falling in the space of one sample.
 *
 * So: a monotone cubic (Fritsch-Carlson) through the model's own values.
 *
 *   - it passes exactly through every temperature the model computed, so
 *     nothing is smoothed away;
 *   - it is smooth everywhere, including across dividing walls and over the
 *     fire, whose crest is now rounded rather than pointed;
 *   - it is MONOTONE, which is the part that matters for honesty. An ordinary
 *     spline would overshoot on the way up to the fire and draw gas hotter
 *     than anything in the kiln. The harmonic-mean tangent cannot: where the
 *     gas turns from rising to falling the tangent is pinned at zero.
 *
 * Built once per frame and sampled a few hundred times, so the tangents are
 * computed here and the sampling is a separate call.
 */
export function gasCurve(profile) {
  // Knots sit at integer positions 0..n, one per chamber boundary. A chamber's
  // `inC` is the previous chamber's `outC`, so the boundaries are just the
  // entry gas followed by every exit gas.
  const y = [profile[0].inC];
  for (const g of profile) y.push(g.outC);

  const n = y.length - 1;
  const d = [];
  for (let k = 0; k < n; k++) d.push(y[k + 1] - y[k]);

  const m = new Array(n + 1);
  m[0] = d[0] ?? 0;
  m[n] = d[n - 1] ?? 0;
  for (let k = 1; k < n; k++) {
    // Zero at a turning point, harmonic mean elsewhere: both are what keep
    // the curve from leaving the range the model produced.
    m[k] = d[k - 1] * d[k] <= 0
      ? 0
      : (2 * d[k - 1] * d[k]) / (d[k - 1] + d[k]);
  }
  return { y, m };
}

/** Sample a `gasCurve` at `pos` chambers along the gas's journey. Degrees. */
export function gasAt(curve, pos) {
  const { y, m } = curve;
  const n = y.length - 1;
  const k = Math.max(0, Math.min(n - 1, Math.floor(pos)));
  const t = Math.max(0, Math.min(1, pos - k));
  const t2 = t * t;
  const t3 = t2 * t;
  // Cubic Hermite. Spacing is one chamber, so no interval width appears.
  return (2 * t3 - 3 * t2 + 1) * y[k]
    + (t3 - 2 * t2 + t) * m[k]
    + (-2 * t3 + 3 * t2) * y[k + 1]
    + (t3 - t2) * m[k + 1];
}

/**
 * How many rows of fuel holes a chamber has, and so how many steps the fire
 * takes to cross it. The thermal model works in these rows, not in whole
 * chambers: see FIRE_ZONE below.
 */
export const ROWS = C.parts.stokeHolesPerChamber;

/**
 * The order gas travels through the kiln, as chamber indices.
 *
 *   in through the open doorway of the chamber being UNLOADED
 *     -> through the chambers that have fired, cooling them and warming itself
 *     -> through the fire
 *     -> through the chambers ahead, giving that heat to unfired tiles
 *     -> out by the one open damper
 *
 * This is the same route the airflow arrow draws, and the reason the kiln is
 * built as a loop: one pass of air does two useful jobs.
 *
 * WHERE THE AIR COMES IN. It used to start at the first cooling chamber,
 * through an opening invented for the purpose, with the chamber being
 * unloaded left outside the draught to cool by itself. Accounts of working
 * Hoffmann kilns say otherwise: the kiln is sealed except where it is being
 * worked on, and the air is drawn in through the doorway that has been broken
 * open to unload. So the path now begins one chamber further back — the one
 * past the cooling run, which is the one the crew is emptying — and that
 * chamber is the first thing the cold air meets.
 *
 * With `recovery` off the last job is cut: the gas leaves through a damper at
 * the fire and goes straight up the chimney, still hot. The chambers ahead get
 * nothing and arrive at the fire cold. That one changed index is the whole of
 * section 6.5.
 *
 * Literature, not observation (config `thermal.counterCurrent`, tag L). The
 * flow path at Kundapur was not seen.
 */
/**
 * THE HEAT LEDGER.
 *
 * Everything in fuel units (heat divided by `heatPerFuel`), so each line can
 * be read against the fuel that paid for it.
 *
 *   IN    fuel      what was burned
 *   OUT   exhaust   carried up the chimney by the gas
 *         unload    carried out of the door in the fired tiles
 *         ambient   lost through the walls of chambers standing out of the draught
 *
 * The balance, which checks.js holds the model to:
 *
 *   fuel  =  exhaust + unload + ambient + (change in heat stored in the kiln)
 *
 * Two more lines move heat about INSIDE the kiln and so are not part of the
 * balance. They are what the kiln is for:
 *
 *   cooling   heat the incoming air took from fired tiles behind the fire
 *   preheat   heat the gas left in unfired tiles ahead of the fire
 */
export function newLedger() {
  return { fuel: 0, exhaust: 0, unload: 0, ambient: 0, cooling: 0, preheat: 0 };
}

export function flowPath(state, recovery = true) {
  const count = state.chambers.length;
  const { pre, cool } = state.params.window;
  const path = [];
  const last = recovery ? pre : 0;
  // Never so far back that the path would lap round onto its own far end.
  const back = Math.min(cool + 1, count - 1 - last);
  for (let k = -back; k <= last; k++) {
    path.push(((state.firePos + k) % count + count) % count);
  }
  return path;
}

/**
 * THE FIRING ZONE, and how the fire moves.
 *
 * The fire is not a thing that sits in one chamber and then jumps to the
 * next. Fuel dropped onto tiles that are already red-hot lights by itself, so
 * the fire "moves" because the crew starts feeding the next row of holes
 * ahead and stops feeding the last row behind. It creeps.
 *
 * So the model feeds a ZONE: `ROWS` rows long — one chamber's length — ending
 * at the leading row. The leading row steps forward one row at a time, ROWS
 * times in each interval. `firePos` is the chamber the leading row is in.
 *
 *   start of an interval   the leading row is the FIRST row of the chamber
 *                          the fire has just entered; the rest of the zone is
 *                          still in the chamber behind
 *   end of an interval     the zone fills this chamber exactly, and the next
 *                          step takes its leading row into the chamber ahead
 *
 * "Every two hours the fire moves on one chamber" is therefore still true —
 * it is the leading edge crossing a dividing line — but nothing changes state
 * all at once. A chamber takes the fire row by row and gives it up row by row.
 *
 * Literature for the mechanism (tag L). The number of rows is the number of
 * stoke holes drawn per chamber, which is an assumption (tag A), and what is
 * actually done at Kundapur every two hours is an open question (5.2).
 *
 * Returns whether cell `c` (chamber * ROWS + row) is being fed.
 */
export function inFireZone(state, c) {
  const total = state.chambers.length * ROWS;
  const lead = state.firePos * ROWS + (state.fireRow ?? ROWS - 1);
  const behind = ((lead - c) % total + total) % total;
  if (behind >= ROWS) return false;
  const ch = Math.floor(c / ROWS);
  // Only where there is a fire to keep going: the chamber the fire is in, or
  // one it has already been through. Not the chamber behind a fire that has
  // only just been lit.
  return ch === state.firePos || !!state.chambers[ch].fired;
}

function makeChambers(count) {
  return Array.from({ length: count }, () => ({
    // The kiln starts cold and empty and fills as the first cycle runs, so a
    // visitor sees tiles going in rather than finding them already there.
    loaded: !C.loading.startEmpty,
    temp: C.temperature.ambientC,   // degrees, simulated. Owned by the thermal model.
    heat: 0,                        // relative 0-1, simulated. Never degrees.
    // The same, for each row of fuel holes along the chamber, in the order
    // the fire meets them. A chamber is not one temperature: `heat` is the
    // mean of these.
    rowHeat: new Array(ROWS).fill(0),
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
    // Which row of the firing chamber the fire's leading edge has reached,
    // 0 to ROWS - 1. See FIRE_ZONE. Set by the thermal clock, not by a view.
    fireRow: 0,
    chambers: makeChambers(count),
    params: {
      ...DEFAULT_PARAMS,
      window: { ...DEFAULT_PARAMS.window },
      ...options.params,
    },
    fuelIndex: 0,                    // relative units only, never kg or MJ
    /**
     * Chambers that have actually had their firing. The denominator for the
     * recovery comparison, and deliberately not `tick`: waiting at a fork
     * passes ticks without firing anything, and "fire empty" spends fuel on a
     * chamber holding no tiles. Both should make the rate look worse, which
     * only works if this counts tiles fired rather than hours elapsed.
     */
    firings: 0,
    // Fuel for both recovery settings, published by the thermal model.
    fuelCompare: { on: 0, off: 0, firings: 0 },
    /**
     * The gas temperature at each chamber boundary along the flow path, in the
     * order the gas travels. Degrees, simulated; views take it through
     * `relativeHeat`. Empty until the kiln is lit, because nothing is moving.
     */
    gasProfile: [],
    gasCompare: { on: [], off: [] },
    // 'charging' while the cold kiln is being filled, 'running' once lit.
    // No simulated time passes while charging.
    phase: C.loading.startEmpty ? 'charging' : 'running',
    paused: true,                    // starts held so the page opens still
    fork: null,                      // set when the fire meets an empty chamber
    // No `layer` and no `fieldOnly`: the layer tabs and the field-only filter
    // are both cut (day 11). Nothing here is kept as a hook for a control that
    // does not exist — state that nothing reads goes stale silently. Both of
    // these have a control attached.
    ui: { evidenceMode: false, details: false },
  };

  // Simulated hours banked but not yet integrated — see integrateThermal.
  let thermalCarry = 0;
  // Simulated hours integrated since the fire last entered a chamber: what
  // decides which row its leading edge has reached.
  let intervalHours = 0;
  const cells = count * ROWS;
  const rowAt = (hours) => Math.min(
    ROWS - 1, Math.max(0, Math.floor(hours / (C.time.tickHours / ROWS) + 1e-9)),
  );

  /**
   * TWO thermal worlds: the same kiln, the same schedule, one difference.
   *
   * `on` reuses its heat the way a Hoffmann kiln is meant to; `off` sends the
   * exhaust straight up the chimney at the fire. Both are integrated every
   * sub-step from tick 0, over the identical firing and loading history, so the
   * fuel figures beside each other are a controlled comparison rather than two
   * runs of different lengths laid side by side.
   *
   * Only temperature and fuel are duplicated. Everything structural — where the
   * fire is, what is loaded, what the fork did — is shared, which is what makes
   * the two worlds differ in exactly one thing and no more.
   */
  const worlds = {
    on: { temps: new Array(count).fill(C.temperature.ambientC), cells: new Array(cells).fill(C.temperature.ambientC), fuel: 0, ledger: newLedger() },
    off: { temps: new Array(count).fill(C.temperature.ambientC), cells: new Array(cells).fill(C.temperature.ambientC), fuel: 0, ledger: newLedger() },
  };
  /**
   * How much heat a world is holding above the yard's temperature, in fuel
   * units: the "stored" term of the balance. Derived, never kept.
   */
  const storedHeat = (world) => {
    const ambient = C.temperature.ambientC;
    const cellMass = C.thermalModel.chamberMass / ROWS;
    let sum = 0;
    for (let c = 0; c < cells; c++) sum += cellMass * (world.cells[c] - ambient);
    return sum / C.thermalModel.heatPerFuel;
  };
  /**
   * `cells` is what the model integrates: one temperature per row of fuel
   * holes, ROWS to a chamber. `temps` is each chamber's mean of those, kept
   * beside it because the chart, the history and the checks all speak in
   * chambers. It is always derived from `cells`, never the other way round.
   */
  const meanTemps = (world) => {
    for (let i = 0; i < count; i++) {
      let sum = 0;
      for (let r = 0; r < ROWS; r++) sum += world.cells[i * ROWS + r];
      world.temps[i] = sum / ROWS;
    }
  };
  // Engine-owned, exposed so history can record both and the console can read
  // them. No view touches this: views read `chamber.heat` and nothing else.
  state.thermal = worlds;

  /**
   * Fresh tiles go in cold.
   *
   * A chamber's heat is mostly in its load. When that load is carried out and
   * unfired tiles are stacked in its place, the heat goes out with it: what
   * stays warm is the masonry. Without this the model handed the old load's
   * temperature to the new one, and "restacked" chambers stood at several
   * hundred degrees with tiles in them that had never been near a fire.
   *
   * `masonryShare` is how much of a chamber's heat is in its walls and so is
   * kept (config thermalModel, tag A). Applied to both worlds, at the moment
   * a chamber is loaded.
   */
  function stackCold(i) {
    const ambient = C.temperature.ambientC;
    const keep = C.thermalModel.masonryShare;
    const toFuel = 1 / C.thermalModel.heatPerFuel;
    for (const world of [worlds.on, worlds.off]) {
      for (let r = 0; r < ROWS; r++) {
        const c = i * ROWS + r;
        const kept = ambient + (world.cells[c] - ambient) * keep;
        // What the fired tiles carry out through the door with them.
        world.ledger.unload += toFuel * (C.thermalModel.chamberMass / ROWS) * (world.cells[c] - kept);
        world.cells[c] = kept;
      }
      meanTemps(world);
    }
    // So the chamber reads cool from the moment it is stacked, not from the
    // next time the model happens to be stepped.
    publishThermal();
  }

  /** The world the views are currently looking at. */
  const activeWorld = () => (state.params.recovery ? worlds.on : worlds.off);

  /**
   * Copy the active world onto the chambers the views read, and publish the
   * comparison. Temperatures stay in degrees for the console; `heat` is the
   * relative 0-1 everything on screen is drawn from (section 4).
   */
  function publishThermal() {
    const w = activeWorld();
    for (let i = 0; i < count; i++) {
      state.chambers[i].temp = w.temps[i];
      state.chambers[i].heat = relativeHeat(w.temps[i]);
      // A fresh array each time, so a recorded moment keeps its own rows.
      state.chambers[i].rowHeat = Array.from(
        { length: ROWS }, (_, r) => relativeHeat(w.cells[i * ROWS + r]),
      );
    }
    state.fuelIndex = w.fuel;
    // Relative units and a count, never a mass. Per chamber fired rather than a
    // running total: a total only says how long you have been watching.
    state.fuelCompare = { on: worlds.on.fuel, off: worlds.off.fuel, firings: state.firings };
    // The books for both worlds, and what each is holding: copies, so a
    // recorded moment keeps its own.
    state.heatLedger = {
      on: { ...worlds.on.ledger, stored: storedHeat(worlds.on) },
      off: { ...worlds.off.ledger, stored: storedHeat(worlds.off) },
    };
    // The gas on its way round, for the airflow arrow. Degrees, like `temp`.
    // Both worlds, so the console can compare them; the arrow draws the active
    // one, which is the one the fuel figure in bold belongs to.
    const gas = gasProfiles();
    state.gasCompare = gas;
    state.gasProfile = state.params.recovery ? gas.on : gas.off;
  }

  // After the worlds exist: the opening snapshot has to record them too, or
  // scrubbing back to tick 0 would find nothing to restore them from.
  const history = createHistory();
  syncStages(state);
  publishThermal();
  history.push(state);

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

  /**
   * One sub-step of one world. The rules live here and nowhere else, so the
   * recovery comparison cannot turn into two models that drifted apart.
   */
  function stepWorld(world, recovery, dt) {
    const M = C.thermalModel;
    const ambient = C.temperature.ambientC;

    // Nothing is burning before the kiln is lit, so it only loses heat.
    const path = state.phase === 'charging' ? [] : flowPath(state, recovery);
    const onPath = new Set(path);

    // A chamber's mass and its contact with the gas, shared out among its
    // rows, so the constants in config still describe a whole chamber.
    const cellMass = M.chamberMass / ROWS;
    const cellExchange = M.exchangeRate / ROWS;

    /**
     * The gas temperature at every chamber boundary on its journey, written
     * down as it goes and returned to the caller.
     *
     * Nothing here is computed FOR this: `gas` is the model's own working
     * value, recorded at each chamber boundary instead of being thrown away.
     * The airflow arrow draws it, which is the only way the picture and the
     * fuel figures can be two readings of one model rather than two
     * independent claims about the same kiln.
     */
    const profile = [];

    /**
     * `maxFuelRate` is the most the crew can feed AT ONCE, so it is one
     * budget for the whole zone, not an allowance per row. In practice nearly
     * all of it goes to the leading row: the rows behind it are already at
     * heat and need only a trickle to stay there. They are met first on the
     * gas's way through, so they are served first and the leading row takes
     * what is left.
     */
    let feedLeft = M.maxFuelRate;

    // Every flow of heat is booked as it happens, in fuel units, so the
    // balance can be checked rather than believed. See `newLedger`.
    const L = world.ledger ?? newLedger();   // a dry run keeps no books
    const toFuel = 1 / M.heatPerFuel;
    const firePlace = path.indexOf(state.firePos);

    let gas = ambient;
    for (let place = 0; place < path.length; place++) {
      const i = path[place];
      const inC = gas;
      let given = 0;      // heat the gas left in this chamber's tiles
      let taken = 0;      // heat the gas picked up from them
      let burned = 0;     // fuel fed in this chamber

      // Row by row, in the order the gas meets them.
      for (let r = 0; r < ROWS; r++) {
        const c = i * ROWS + r;

        // Gas and tiles trade heat. Positive q means the row is the hotter of
        // the two and is giving heat up to the gas.
        const q = cellExchange * (world.cells[c] - gas) * dt;
        world.cells[c] -= q / cellMass;
        gas += q / M.gasMass;
        if (q > 0) taken += q * toFuel; else given -= q * toFuel;

        if (inFireZone(state, c)) {
          /**
           * Fuel is fed at whatever rate holds the band. That is an
           * assumption: how the crew actually decides a feed rate is unknown
           * (section 4 lists what workers watch and adjust as unknown).
           *
           * It is also the whole of Day 8. The feed answers demand, so a row
           * that arrives cold costs more to bring to the same peak — and with
           * recovery off every row arrives cold. Nothing here knows about
           * recovery; the difference arrives through `flowPath` alone.
           */
          /**
           * THE FIRE, AND WHERE ITS HEAT GOES.
           *
           * In the fire the gas and the row it is passing through come to one
           * temperature, and the fuel heats the two of them together. So the
           * gas leaves the fire as hot as the tiles in it — and every degree
           * of that is paid for, by the tiles or by the fuel.
           *
           * It used to be set to the tiles' temperature for nothing: the gas
           * got hotter and nothing got cooler. That was heat from nowhere,
           * about 215 fuel units a chamber against 356 of real fuel, and it
           * made the fuel figures cheaper than the model's own rules allow.
           */
          const both = cellMass + M.gasMass;
          const before = world.cells[c];
          let mixed = (cellMass * world.cells[c] + M.gasMass * gas) / both;
          const rate = Math.max(0, Math.min(
            feedLeft, (M.targetC - mixed) * M.fuelGain / ROWS,
          ));
          feedLeft -= rate;
          mixed += (rate * dt * M.heatPerFuel) / both;
          // The row's share of the mixing, booked like any other exchange.
          const moved = cellMass * (before - (cellMass * before + M.gasMass * gas) / both) * toFuel;
          if (moved > 0) taken += moved; else given -= moved;
          world.cells[c] = mixed;
          gas = mixed;
          world.fuel += rate * dt;               // relative units, never a mass
          burned += rate * dt;
        }
      }

      L.fuel += burned;
      // Heat changing hands between gas and tiles, by which side of the fire
      // it happened on. Internal to the kiln: these move heat, they neither
      // add nor remove it, and are kept apart from the balance for that reason.
      if (place < firePlace) L.cooling += taken - given;
      else if (place > firePlace) L.preheat += given - taken;
      profile.push({
        chamber: i, inC, outC: gas, fire: i === state.firePos,
        // Per simulated hour, fuel units: what the tiles here gained from the
        // gas (negative where they are giving heat up to it instead). NOT the
        // same thing as the gas's fall in temperature — that is `inC - outC`.
        toTiles: (given - taken) / dt,
        fuelRate: burned / dt,
      });
    }
    // Whatever the gas still carries above the yard's air when it reaches a
    // damper goes up the chimney.
    if (path.length) L.exhaust += M.gasMass * (gas - ambient) * toFuel;

    // Everything off the flow path just loses heat to the outside.
    for (let i = 0; i < count; i++) {
      if (onPath.has(i)) continue;
      for (let r = 0; r < ROWS; r++) {
        const c = i * ROWS + r;
        const lost = (world.cells[c] - ambient) * Math.min(1, M.ambientLossRate * dt);
        world.cells[c] -= lost;
        L.ambient += cellMass * lost * toFuel;
      }
    }

    for (let c = 0; c < cells; c++) {
      if (world.cells[c] < ambient) {            // nothing goes below the yard
        L.ambient -= cellMass * (ambient - world.cells[c]) * toFuel;
        world.cells[c] = ambient;
      }
    }
    meanTemps(world);

    // Degrees, like `temps`. Views take it through `relativeHeat`, the same
    // way they take a chamber's — so arrow and tiles share one scale.
    return profile;
  }

  /**
   * The gas profile for both worlds, as they stand.
   *
   * Recomputed rather than remembered. A walk of the path produces it, so this
   * runs one against a COPY of each world: no temperature moves, no fuel is
   * spent, and the only rule involved is the one in `stepWorld`. That matters
   * three ways — the arrow is lit correctly the moment the kiln is lit and
   * before any time has passed, scrubbing back gets the profile that belongs
   * to the restored temperatures without history having to store it, and there
   * is no second copy of the exchange rule to drift.
   */
  function gasProfiles() {
    const dt = C.thermalModel.subStepHours;
    const dry = (world, recovery) =>
      stepWorld({ temps: world.temps.slice(), cells: world.cells.slice(), fuel: 0, ledger: null }, recovery, dt);
    return { on: dry(worlds.on, true), off: dry(worlds.off, false) };
  }

  function integrateThermal(simHours) {
    if (simHours <= 0) return;

    const M = C.thermalModel;

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
      // Where the fire's leading edge is for this sub-step: it has had
      // `intervalHours` in this chamber, and takes one row at a time.
      state.fireRow = rowAt(intervalHours);
      intervalHours += M.subStepHours;
      // Both worlds advance together, on the same schedule and the same clock.
      stepWorld(worlds.on, true, M.subStepHours);
      stepWorld(worlds.off, false, M.subStepHours);
    }

    publishThermal();
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
        stackCold(i);
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
        stackCold(state.chambers.indexOf(ch));
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
      // Lighting the kiln gives the gas somewhere to go, and the arrow appears
      // the same instant. Publishing here means it appears already coloured,
      // rather than waiting for the first sub-step to be integrated — which,
      // with the kiln paused on the tick it was lit, could be a long wait.
      publishThermal();
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
    // The leading edge has crossed into the next chamber: its first row.
    state.fireRow = 0;
    intervalHours = 0;

    // The chamber now in the fire has had its firing. That is what later marks
    // it ready to be unloaded once it goes idle.
    state.chambers[next].fired = true;
    state.firings += 1;              // a chamber of tiles fired, not just a tick

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
      // The fire jumps over the empty chamber to the one beyond it. That
      // chamber has its firing like any other, so it is marked and counted —
      // without which it would never come round to be unloaded.
      state.firePos = (at + 1) % count;
      state.tick += 1;
      state.chambers[state.firePos].fired = true;
      if (state.chambers[state.firePos].loaded) state.firings += 1;
    } else if (policy === 'fireEmpty') {
      // The fire moves in and burns fuel on a chamber holding no tiles. No
      // increment to `firings`: fuel is spent and nothing is fired, which is
      // the whole cost of this choice and should show in the fuel rate.
      state.firePos = at;
      state.tick += 1;
    } else {
      return;                        // unknown policy: leave the fork standing
    }
    // A new interval, wherever the fire now is.
    state.fireRow = 0;
    intervalHours = 0;

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
  function step(dtMs) {
    if (state.paused || state.fork) return;

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
          // A snapshot is taken as the fire arrives in a chamber (or, for the
          // one stepped by hand, once it has filled it): `fireRow` says which.
          state.fireRow = snap.fireRow ?? 0;
          intervalHours = state.fireRow >= ROWS - 1 ? C.time.tickHours : 0;

          /**
           * BOTH worlds are restored, not just the one on screen. Restoring
           * only the active world would leave the other still standing at the
           * end of the run, and the comparison beside it would quietly stop
           * describing the same moment.
           */
          state.firings = snap.firings;
          worlds.on.temps = snap.thermal.on.slice();
          worlds.on.cells = snap.thermal.onCells.slice();
          worlds.on.fuel = snap.thermal.onFuel;
          worlds.on.ledger = { ...newLedger(), ...snap.thermal.onLedger };
          worlds.off.temps = snap.thermal.off.slice();
          worlds.off.cells = snap.thermal.offCells.slice();
          worlds.off.fuel = snap.thermal.offFuel;
          worlds.off.ledger = { ...newLedger(), ...snap.thermal.offLedger };
          publishThermal();

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
        stackCold(i);
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
        /**
         * Both worlds have been running since tick 0, so this only chooses
         * which one the views read. No simulated time passes and no history is
         * rewritten — throwing the switch is a change of view onto a kiln that
         * was always being modelled both ways.
         */
        state.params.recovery = !!action.value;
        publishThermal();
        syncStages(state);
        break;

      case 'chooseForkPolicy':
        resolveFork(action.policy);
        break;

      case 'setEvidenceMode':
        state.ui.evidenceMode = !!action.value;
        break;

      // The details sheet. UI state, kept here with the rest of `ui` so the
      // console can see what the page is showing.
      case 'setDetails':
        state.ui.details = !!action.value;
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
