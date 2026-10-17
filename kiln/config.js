/**
 * config.js — every value the kiln model uses, each with its evidence tag.
 *
 * Brief rule 14.3: nothing is hard-coded in a view. If a number matters, it
 * lives here. Brief section 4: every value carries a tag saying where it came
 * from, and the same tags drive evidence mode (section 8).
 *
 *   F  field-documented at Prabhakar Tile Factory, Kundapur
 *   L  literature on other Hoffmann / brick / tile kilns — NOT verified here
 *   A  my modelling assumption
 *   S  simulated by the model (relative units only — never kg or MJ)
 *   U  unknown — never present as known
 *
 * Each entry is written once as [value, tag, note?] and then split into three
 * parallel exports, so engine code reads plainly (C.time.tickHours) while
 * evidence mode still has the provenance (TAGS.time.tickHours).
 */

export const EVIDENCE = {
  F: { code: 'F', label: 'Field observation', blurb: 'Seen or recorded on the field visit to Prabhakar Tile Factory, Kundapur.' },
  L: { code: 'L', label: 'Literature',        blurb: 'From published writing on other Hoffmann kilns. Not checked at Kundapur.' },
  A: { code: 'A', label: 'Assumption',        blurb: 'A choice I made to build the model. Not observed.' },
  S: { code: 'S', label: 'Simulated',         blurb: 'Computed by the model as it runs. Relative units, not measurements.' },
  U: { code: 'U', label: 'Unknown',           blurb: 'Not known. Where the model needs a value, it shows one possibility and says so.' },
};

// ---------------------------------------------------------------------------
// The tagged source of truth. [value, tag, note?]
// ---------------------------------------------------------------------------

const defs = {

  chambers: {
    // Brief section 4: 8 connected chambers.
    count: [8, 'F'],
  },

  time: {
    // The fire advances to the next chamber every 2 hours.
    tickHours: [2, 'F', 'What exactly happens every 2 hours (the fuel feed, the dampers, the crew) is not known.'],
    // Fixed, not adjusted batch to batch.
    intervalIsFixed: [true, 'F', 'Confirmed in a follow-up conversation with the factory.'],
    // One chamber per tick, so a full loop is 8 x 2 h. Derived, not observed.
    loopHours: [16, 'A', '8 chambers × 2 hours. Worked out, not observed.'],
    // How fast simulated time runs on screen. A presentation choice only.
    tickSeconds: [3, 'A', 'Real seconds each 2-hour step takes on screen. How fast the display runs, not how the kiln behaves.'],
    speedMin: [0.25, 'A'],
    speedMax: [4, 'A'],
  },

  /**
   * Loading and unloading — the rhythm of the crew, all tagged 'A'.
   *
   * What is known: the process runs clay prep -> shaping -> drying -> firing
   * -> cooling -> sorting (tag F), so tiles must go in and come out. What is
   * NOT known is anything about how: crew size, their tasks, and what workers
   * watch and adjust are all listed as unknown in section 4.
   *
   * So this is a modelled rhythm, not an observation. A chamber is turned
   * around during its idle window — fired tiles out, green tiles in — and the
   * crew works ahead of the fire, because a chamber that is not ready when the
   * fire arrives is exactly the stall in open question 5.1.
   */
  loading: {
    startEmpty: [true, 'A', 'The kiln starts cold and empty, and fills as the first cycle runs.'],
    auto: [true, 'A', 'The crew loads chambers on its own. Turn this off to load each one by hand.'],
    perTick: [1, 'A', 'One chamber filled and one emptied per step, keeping pace with the fire.'],
    unloadWhenIdle: [true, 'A', 'A fired chamber is emptied once nothing more is happening in it.'],
  },

  // Which chambers count as preheating / cooling, measured from the fire.
  // Brief says make these settings, not constants.
  windows: {
    preheat: [3, 'A', 'How many chambers ahead of the fire count as preheating.'],
    cool: [2, 'A', 'How many chambers behind the fire count as cooling.'],
  },

  temperature: {
    // Always shown as a band. Never a precise reading.
    peakBandC: [[850, 900], 'F', 'Always shown as a range, never as one exact reading.'],
    ambientC: [30, 'A', 'The temperature of a chamber before it is fired.'],
    // Day 6 builds the thermal model. Values here are placeholders it will use.
    preheatTargetC: [400, 'A', 'Roughly how warm a chamber gets before the fire arrives.'],
    coolFloorC: [120, 'A', 'Roughly how far a cooling chamber falls.'],
  },

  /**
   * The thermal model. Everything here is 'A' — these are the knobs of a
   * MODEL, not measurements of a kiln.
   *
   * It replaces a lookup table that returned a chamber's heat from how far it
   * sat from the fire. That was geometry wearing the costume of physics: a
   * chamber read 0.16 because a table said so, not because anything had
   * heated it.
   *
   * What it does, per section 6.2: gas enters cold behind the fire, picks up
   * heat from the chambers that have just fired, feeds the fire, and carries
   * that heat forward into the green tiles ahead before it leaves. One
   * exchange rule, walked along the flow path, produces all of it.
   *
   * Deliberately a lumped-mass exchange model and nothing grander. Section 13
   * names this as the top schedule risk and says plausible beats accurate.
   *
   * Masses and rates are RELATIVE. Section 4 forbids kg and MJ for simulated
   * values, so there are no real units here — only ratios that behave.
   */
  thermalModel: {
    subStepHours: [0.1, 'A', '6 simulated minutes, so each 2-hour step is worked out in 20 smaller ones.'],
    chamberMass: [40, 'A', 'How much heat a chamber and its tiles can hold, on the model\'s own scale.'],
    gasMass: [1.6, 'A', 'Far smaller than a chamber\'s, so the gas takes on each chamber\'s heat as it passes. That difference is what lets heat be handed along the kiln.'],
    exchangeRate: [9.0, 'A', 'How quickly gas and chamber trade heat, per simulated hour.'],
    ambientLossRate: [0.22, 'A', 'How quickly a chamber out of the air\'s path cools back towards the outside air.'],
    targetC: [872, 'A', 'The temperature the fuel feed aims for, inside the 850–900 °C band recorded at the factory.'],
    heatPerFuel: [40, 'A', 'How much one unit of fuel heats one unit of chamber, on the model\'s own scale.'],
    fuelGain: [10, 'A', 'How strongly the feed reacts when a chamber is below target. Set high, so a chamber reaches the band within its two hours in the fire.'],
    // Tuning record (moved out of the visitor-facing note). High enough that
    // the crew can hold the band even when a chamber arrives cold — Day 8
    // needs turning heat recovery off to change the FUEL and not the peak.
    // Measured: at 400 both settings just hold the band; 500 leaves margin.
    // The whole kiln still takes a full loop to warm from cold (mean 30 to
    // 473 C, within 5% at tick 8) while the chamber in the fire is in the band
    // by tick 2 — it is the chamber with a fire in it that heats fast, not the
    // kiln.
    maxFuelRate: [500, 'A', 'The most fuel the crew can feed at once. High enough to hold the band even when a chamber arrives cold, so switching heat recovery off changes the fuel used, not the peak.'],
    heatRefC: [900, 'A', 'The top of the band. The model\'s temperatures are shown as a share of this, from 0 to 1.'],
  },

  thermal: {
    // Literature figure. Not verified at Kundapur.
    activeChambers: [3, 'L', 'Writing on other kilns says about 3 chambers are hot at any one time. Not checked at Kundapur.'],
    // Core Hoffmann principle: air in behind the fire, exhaust out ahead of it.
    counterCurrent: [true, 'L', 'Air drawn in behind the fire cools the fired tiles and warms up, feeds the fire, then warms the green tiles ahead before leaving by the chimney. The air\'s path at Kundapur was not seen.'],
    dampersToChimney: [true, 'L', 'Dampers and flues send the gas to a chimney.'],
    /**
     * L, not S. That reusing the heat saves fuel is the documented reason
     * Hoffmann kilns are built as a loop. HOW MUCH it saves on this screen is a
     * simulated result and lives in `state.fuelCompare`, not here.
     */
    recoveryPrinciple: [true, 'L', 'Reusing the exhaust to warm the chambers ahead is the whole point of a continuous kiln. How much fuel it saves here is simulated, not recorded.'],
  },

  fuel: {
    source: ['cashew-nut shells', 'F', 'Fed through holes in the chamber roofs.'],
    // Relative only. Brief section 4 forbids kg or MJ.
    indexUnit: ['fuel index (relative)', 'S', 'Relative units. Never a weight or an amount of energy.'],
    // Fuel is now fed continuously by the thermal model, at whatever rate
    // holds the firing chamber in the band — so there is no per-tick constant.
    //
    // There is deliberately no "penalty multiplier" for running without heat
    // recovery either. That number is what Day 8 exists to MEASURE; writing it
    // down here would be stating a simulated result as a given.
    //
    // Day 8 measured it. The engine now runs the kiln both ways at once over
    // the same firing schedule, and the figure comes out of the model into
    // `state.fuelCompare`. It is a RESULT, so it is not a constant here and it
    // changes if the model is retuned — which is the point of not writing it
    // down.
  },

  drying: {
    summerDays: [20, 'F', 'About 20 days in summer.'],
    monsoonDays: [45, 'F', 'About 1.5 months in monsoon.'],
  },

  // Brief section 4: clay prep -> shaping -> drying -> firing -> cooling -> sorting.
  process: {
    chain: [['clay prep', 'shaping', 'drying', 'firing', 'cooling', 'sorting'], 'F'],
    // The per-chamber cycle is my abstraction on top of that chain.
    stageCycle: [['wait', 'preheat', 'fire', 'cool', 'unload'], 'A', 'My simplification of what one chamber goes through.'],
  },

  shape: {
    kundapur: [null, 'U', 'Circular, racetrack or z-shaped: not known. The loop on screen is a simplification, not a plan of the real kiln.'],
    knownForms: [['circular', 'racetrack', 'z-shaped'], 'L', 'Hoffmann kilns take all three forms.'],
    nearbyExample: ['Albuquerque factory: z-shaped, cashew-shell fed, 850–900 °C', 'L', 'A different Mangalore kiln, not this one.'],
  },

  /**
   * How the kiln is DRAWN. Every value here is an 'A': these are drawing
   * decisions, not measurements, and none of them is evidence about Kundapur.
   *
   * Read this next to `shape.kundapur` above, which is still 'U'. The model
   * draws a rectangle because it has to draw something. That is not a finding,
   * and open question 5.3 stays open.
   */
  form: {
    topology: ['racetrack', 'A', 'A rectangle, so that there is something to draw. The real shape at Kundapur is not known.'],
    width: [9.0, 'A', 'In scene units, chosen to look right. Not metres.'],
    depth: [6.0, 'A', 'In scene units, chosen to look right. Not metres.'],
    cornerRadius: [1.6, 'A'],
    wallThickness: [1.25, 'A', 'How thick the band of chambers is drawn. Not a measurement.'],
    chamberGap: [0.035, 'A', 'How much of each chamber is trimmed away so the chambers read as separate.'],
  },

  /**
   * The kiln's other parts. Proportions are all 'A' — they are drawing
   * decisions. Whether each PART EXISTS at Kundapur is a separate matter, and
   * that is recorded per component in COMPONENTS below. Read both.
   */
  parts: {
    wallHeight: [0.5, 'A'],
    wallThickness: [0.1, 'A'],

    // Workers walk along the top of the kiln and drop fuel through holes in the
    // chamber roofs. The holes are field-documented; this walkway is the
    // abstraction that carries them.
    walkwayWidth: [0.30, 'A', 'Stands in for the roof workers walk along. Kept narrow so the chamber below stays visible.'],
    stokeHolesPerChamber: [5, 'A', 'The holes were seen at the factory; how many each chamber has was not recorded.'],
    stokeHoleRadius: [0.085, 'A', 'Drawn large enough to read as an opening at the size the kiln is shown.'],


    ductWidth: [0.52, 'A', 'Width of the flue duct that runs inside the ring of chambers.'],
    ductHeight: [0.3, 'A'],

    chimneyRadius: [0.46, 'A'],
    chimneyHeight: [3.4, 'A'],


    /**
     * Blueprint view: the kiln drawn as a cutaway plan, seen straight down.
     * All 'A' — these are drawing decisions.
     */
    wallInset: [0.2, 'A', 'Masonry thickness between the outside and the chamber void.'],
    /**
     * Tiles are stacked in two rows, one at each END of the chamber, each row
     * running across its full width. The middle of the chamber, along the
     * direction the fire travels, is left clear.
     *
     * HOW MANY TILES A CHAMBER HOLDS, AND HOW THEY ARE STACKED, IS UNKNOWN
     * (section 4, tag U). These are a stand-in for a load, not a count.
     */
    tilesAcross: [6, 'A', 'Tiles drawn in each end row. A picture of a load, not a count.'],
    tileEndFraction: [0.2, 'A', 'How much of the chamber length each end row takes up.'],
    tileInset: [0.08, 'A'],
    /**
     * Share of one tick a chamber takes to be stacked or emptied.
     *
     * Deliberately close to the whole interval. Unloading and reloading are
     * what the two hours between the fire's moves are FOR, so the work should
     * visibly fill that window rather than finishing early and leaving the
     * kiln sitting still — which would suggest the interval is just a pause.
     * Kept under 1 so a stack always completes before the fire moves again.
     */
    tileFillFraction: [0.85, 'A', 'Share of each step spent stacking or emptying a chamber.'],

    /**
     * The mark on a load that has been through the fire.
     *
     * THAT tiles change in the firing is real — it is the whole purpose of the
     * kiln. This particular mark is not a picture of what a fired Mangalore
     * tile looks like; it is a DRAWING CONVENTION for "this load is baked", so
     * a finished load and a fresh green one stop being indistinguishable the
     * moment they happen to be the same temperature. Every value here is a
     * drawing decision, tag A.
     *
     * Spacing is in world units and the stripes are phased in band space, so
     * the six tiles of an end row line up into one continuous hatch while each
     * still clips its own slice. A tile on its own is about 73 x 10 px on
     * screen — far too thin to carry slanted lines — but a whole end row is
     * roughly 73 x 74 px, which is.
     *
     * The angle is measured in BAND space, so the stripes meet every tile at
     * the same angle wherever it sits on the kiln — but their apparent slant on
     * screen turns with the kiln, matching the chart's +45 empty-cell hatch on
     * the short runs and opposing it on the long ones. The direction is
     * therefore not what keeps the two marks apart; their ground and weight are
     * (faint light lines on a dark void against heavy dark lines on a bright
     * tile). Worth knowing before trusting the angle to do that job.
     */
    tileHatch: {
      period: [0.17, 'A', 'Spacing of the stripes on fired tiles: about four across each row.'],
      angleDeg: [-45, 'A', 'Set across the row, so the stripes cut across the tiles instead of running along them.'],
      thickness: [0.34, 'A', 'How much of each stripe spacing the dark stripe fills.'],
      opacity: [0.85, 'A', 'Not quite solid, so the heat colour still shows through a fired load.'],
      texturePx: [128, 'A', 'Size of the image the stripes are drawn from.'],
    },
    flueWidth: [0.46, 'A'],
    /**
     * Wicket doors and dampers are both openings cut through a chamber wall,
     * so both are measured the same way: a share of the chamber's length.
     * The wicket goes through the OUTER wall, where tiles come and go; the
     * damper goes through the INNER one, into the flue.
     */
    wicketWidthFraction: [0.44, 'A', 'Share of the chamber length the doorway takes up.'],
    damperWidthFraction: [0.3, 'A', 'Share of the chamber length the flue opening takes up.'],

    /**
     * The island: the solid middle of the kiln, inside the flue duct.
     *
     * Split in two by a channel running top to bottom, open at both ends so it
     * meets the duct there. That channel is the route exhaust takes from an
     * open damper to the chimney at the centre — without it the chimney would
     * be a circle with no way into it.
     *
     * What is actually inside the middle of the kiln at Kundapur was not seen.
     * All of this is a drawing decision.
     */
    islandInset: [0.25, 'A', 'Gap between the flue duct and the island, so the two read as separate.'],
    channelWidth: [0.9, 'A', 'Width of the open channel from the duct to the chimney.'],
    chimneyVoidRadius: [0.55, 'A', 'How far the blocks are cut back around the chimney.'],
    islandCornerRadius: [0.35, 'A'],
    airInletLead: [0, 'A', 'The incoming air starts at the kiln\'s outer wall. Starting it further out would have meant pulling the camera back and shrinking the whole drawing.'],
    airInletTurn: [0.3, 'A', 'How much of a chamber the air takes to turn in from the wall. Kept short, so it reads as entering rather than drifting in.'],
    airInletWidthFraction: [0.34, 'A', 'Share of the chamber length the air inlet takes up. Separate from the damper: they are different openings in different walls.'],
    airSpentBlend: [0.92, 'A', 'How far the outgoing end fades to the grey of spent gas. Close to all the way, so the tip reads as used-up gas, not fresh air.'],
    airSmoothSamples: [420, 'A', 'Points the air\'s route is redrawn with before smoothing, so the curve is even all the way along.'],
    airSmoothRadius: [9, 'A', 'How many neighbouring points are averaged. More rounds the corners harder.'],
    airSmoothPasses: [2, 'A'],
    /**
     * The arrow is as thick as the heat the gas is carrying.
     *
     * Width is `max(airWidthMin, airWidthMax * relativeHeat(gas))` — the same
     * simulated temperature its colour comes from, so the two say one thing
     * loudly rather than two things. Proportional, not a floor-to-ceiling
     * blend: a blend would compress the ratio and quietly overstate the cold
     * end.
     *
     * This replaced a fixed width and a fixed `airExhaustScale` of 0.52, which
     * narrowed the exhaust on the grounds that "by then the gas has given its
     * heat to the green tiles" — true with heat recovery, flatly wrong without
     * it, and the one picture that should shout that the heat is being thrown
     * away was tapering as though it were spent.
     */
    airWidthMax: [0.42, 'A', 'Width of the arrow at full heat: about half the chamber, so the tiles still show on either side, and narrower than the flue duct.'],
    airWidthMin: [0.10, 'A', 'The thinnest the arrow gets, so air arriving cold is still a visible line. Cold air carries no heat, so without a minimum it would not be drawn at all.'],
    airWidthSoftness: [0.04, 'A', 'How gently the arrow eases onto its minimum width. A sharp change leaves a visible kink just where the arrow should look like it is growing.'],
    zoneBandWidth: [0.26, 'A'],
    zoneBandOffset: [0.42, 'A', 'How far outside the kiln wall the zone band sits.'],
  },

  /**
   * The space-time chart: chambers across, time down. All 'A' — presentation
   * choices, not anything about the kiln.
   *
   * It draws only what history recorded, so everything in it is as simulated
   * as the run that produced it.
   */
  /**
   * The dial in the transport bar. All 'A': how a clock is drawn is a
   * presentation choice. The one fact it carries — two hours per move — is
   * `time.tickHours`, and the dial is marked from it rather than from
   * anything here, so the face cannot go on claiming an interval the model
   * has stopped using.
   */
  clock: {
    dialHours: [12, 'A', 'Hours for one turn of the dial. An ordinary 12-hour clock face, because everyone can already read one.'],
    flashSeconds: [1, 'A', 'How long the dial glows red when the fire moves on.'],
    flashMaxOfTick: [0.4, 'A', 'The longest the glow can last, as a share of one step on screen. Without this limit the dial would stay red at high speed, and the flash would stop marking anything.'],
    handSettle: [0.3, 'A', 'How quickly the hand catches up when the kiln moves a step, so it sweeps rather than jumps.'],
    handSnapDeg: [0.05, 'A', 'Close enough for the hand simply to be placed, so it does not creep forever towards its mark.'],
  },

  chart: {
    windowTicks: [16, 'A', 'Steps shown at once. One loop is 8 steps, so 16 shows two loops (32 simulated hours), enough to see the pattern repeat.'],
    minRowHeight: [11, 'A', 'Tall enough that the fire\'s path reads as a diagonal line, not a smear.'],
    cellGap: [1, 'A'],
    hoursLabelEvery: [4, 'A', 'How often the time axis is labelled, so it does not crowd.'],
  },

  // Things the model simulates. Shown as bands or spreads, never as readings.
  simulated: {
    perChamberCurves: [true, 'S', 'Each chamber\'s temperature over time is simulated.'],
    defectBehaviour: [false, 'S', 'Cracking and other defects are not modelled.'],
  },

  // Never presented as known. Listed so evidence mode can show the gaps.
  unknowns: {
    items: [[
      'Kiln shape at Kundapur',
      'How unready chambers are handled',
      'Crew size and tasks',
      'What workers watch and adjust',
      'Tiles per chamber',
      'Whether tiles are graded by chamber',
    ], 'U'],
  },

  history: {
    hoffmannPatentYear: [1858, 'L', 'Friedrich Hoffmann. The innovation was continuity: the fire never goes out.'],
    mangaloreTileStart: [1865, 'L', 'Basel Mission, Georg Plebst. Background only.'],
  },
};

// ---------------------------------------------------------------------------
// Open field questions (brief section 5).
// Unanswered, so each is a setting the model can change if the factory answers.
// They are deliberately NOT in `defs` — they are not values, they are holes.
// ---------------------------------------------------------------------------

export const OPEN_QUESTIONS = {
  forkPolicy: {
    question: 'If the next chamber is not ready, does the fire wait, skip it, or fire it empty?',
    value: null,                                  // null = undecided, as it truly is
    options: ['wait', 'skip', 'fireEmpty'],
    tag: 'U',
    ref: '5.1',
    note: 'What the factory does is not known. All three outcomes are modelled; none is known to be right.',
  },
  whatMoves: {
    question: 'What exactly moves every 2 hours: fuel feed, dampers, or people?',
    value: null,
    options: ['fuel feed', 'dampers', 'people'],
    tag: 'U',
    ref: '5.2',
  },
  ringTopology: {
    question: 'Is the kiln a closed ring, a racetrack, or z-shaped?',
    value: null,                                  // STILL UNANSWERED
    options: ['closed', 'racetrack', 'zshaped'],
    tag: 'U',
    ref: '5.3',
    // What the model draws is kept separate from what is known, so that
    // choosing a shape to render never quietly becomes a claim about Kundapur.
    drawnAs: 'racetrack',                         // tag 'A' — see form.topology
    note: 'A rectangle is drawn because something must be drawn. It is not a finding, and this question is still open.',
  },
  activeChambers: {
    question: 'How many chambers are thermally active at once?',
    value: 3,
    options: [2, 3, 4],
    unit: 'chambers',
    tag: 'L',
    ref: '5.4',
    note: 'Writing on other kilns says about 3. Not checked at Kundapur.',
  },
};

// ---------------------------------------------------------------------------
// Chamber stages. Names only — engine.js derives which chamber is in which.
// ---------------------------------------------------------------------------

export const STAGES = {
  fire:    { id: 'fire',    label: 'Firing',     tag: 'F' },
  preheat: { id: 'preheat', label: 'Preheating', tag: 'A' },
  cool:    { id: 'cool',    label: 'Cooling',    tag: 'A' },
  wait:    { id: 'wait',    label: 'Waiting',    tag: 'A' },
  empty:   { id: 'empty',   label: 'Empty',      tag: 'A' },
};

/**
 * The palette, mirrored from style.css so three.js can reach it. The two must
 * agree; style.css is the place to change a colour.
 */
export const PALETTE = {
  soot: '#16120d',
  'soot-raised': '#1e1913',
  sand: '#c8bb99',
  'sand-dim': '#8a7f66',
  'sand-faint': '#574e3e',
  // Coolest (0) to hottest (4). Mirrors style.css — see the note there on why
  // this runs yellow -> red rather than the blackbody red -> yellow-white.
  'heat-0': '#ffe9a3',
  'heat-1': '#ffd24a',
  'heat-2': '#f9a826',
  'heat-3': '#ef6c1a',
  'heat-4': '#d8321a',
  air: '#9db4b8',
  'air-spent': '#a5a39b',
};

/**
 * Which palette entry each chamber stage is drawn in.
 *
 * These are palette KEYS, not hex values, so Day 6 can replace "colour by
 * stage" with "colour by simulated temperature" using the same heat ramp and
 * no change to the palette itself.
 *
 * These are CATEGORIES, not temperatures. Do not read the ramp positions as a
 * ranking: a chamber just behind the fire is hotter than one far ahead of it,
 * yet both sit under one 'cool' or 'preheat' colour here. Day 6's temperature
 * model is what makes the ramp mean degrees.
 *
 * On section 9's rule that the heat ramp is for temperature only: firing,
 * preheating and cooling ARE thermal states, so the ramp is doing its job.
 * `wait` and `empty` stay outside the ramp on purpose — they are not
 * temperatures, and must not read as cold embers.
 */
export const STAGE_COLOUR = {
  fire:    { key: 'heat-4',      tag: 'A', note: 'The hottest end of the ramp. Day 6 replaces this with simulated temperature.' },
  preheat: { key: 'heat-1',      tag: 'A', note: 'Warming on the exhaust of the chamber behind it.' },
  cool:    { key: 'heat-2',      tag: 'A', note: 'Still giving up heat to the incoming air.' },
  wait:    { key: 'sand-faint',  tag: 'A', note: 'Cold clay, waiting. Not a temperature.' },
  empty:   { key: 'soot-raised', tag: 'A', note: 'No tiles. Day 9 makes these hollow.' },
};

/**
 * Every part the kiln is drawn from, and where the knowledge of it comes from.
 *
 * This is the backbone of evidence mode (section 8): each component's `tag`
 * is the code shown beside its name and counted in the legend. Only two of
 * them are `F` — eight chambers and the holes the fuel goes through. That
 * ratio is the finding, and the details sheet is where it is stated.
 *
 * A warning that belongs here rather than in a commit message: a Hoffmann kiln
 * is a gas circuit, and most of what makes it legible as one — flues, chimney,
 * dampers, the air path — is literature about OTHER kilns. None of it was
 * observed at Kundapur. Drawing it is useful; believing it is not.
 */
export const COMPONENTS = {
  chambers: {
    label: 'Chambers', tag: 'F',
    note: '8 connected chambers. Counted at Prabhakar Tile Factory.',
  },
  dividingWalls: {
    label: 'Dividing walls', tag: 'A',
    note: 'If there are 8 separate chambers, something separates them. The walls are implied, not observed.',
  },
  stokeHoles: {
    label: 'Stoke holes', tag: 'F',
    note: 'Cashew-nut shells are fed through holes in the chamber roofs. Seen at the factory.',
  },
  walkway: {
    label: 'Roof walkway', tag: 'A',
    note: 'Stands in for the kiln roof the stoke holes sit in. Not observed.',
  },
  tiles: {
    label: 'Tiles', tag: 'A',
    note: 'Tiles stay put while the fire moves past them. How many go in a chamber, and how they are stacked, is not known. They are drawn in two rows with a gap between for the gas, as other Hoffmann kilns are described, but this was not seen at Kundapur. A stand-in for a load, not a count.',
  },
  wicketDoors: {
    label: 'Wicket doors', tag: 'L',
    note: 'Hoffmann chambers are bricked up, then broken open to load and unload. Not checked at Kundapur, where how the crew works is not known.',
  },
  flueDuct: {
    label: 'Flue duct', tag: 'L',
    note: 'Dampers and flues carry the gas to a chimney. Drawn as the open space between the chambers and the island, because a flue is a way through, not a wall. The duct\'s path at Kundapur was not seen.',
  },
  kilnIsland: {
    label: 'Kiln island', tag: 'A',
    note: 'The solid middle of the kiln, split by a channel that carries exhaust from the open damper to the chimney. A central flue leading to a chimney comes from writing on other kilns; this layout of two blocks and one channel is a drawing decision. What is inside the middle of the real kiln was not seen.',
  },
  chimney: {
    label: 'Chimney', tag: 'L',
    note: 'Draws exhaust out of the kiln. Its position and size here are invented.',
  },
  dampers: {
    label: 'Dampers', tag: 'L',
    note: 'One per chamber. The open one sits ahead of the fire and pulls gas to the chimney. Whether dampers are what workers move every 2 hours is one of the open questions.',
  },
  airPath: {
    label: 'Air path', tag: 'L',
    note: 'Air comes in behind the fire, through the cooling chambers, through the fire, then through the preheating chambers and out. This is the core Hoffmann principle, but it was not seen here. The arrow\'s colour and thickness both show how much heat the gas carries in the model: it is thin at the intake because cold air carries no heat, not because less air goes in.',
  },
  zones: {
    label: 'Zones', tag: 'A',
    note: 'Preheating, firing and cooling bands are my simplification of what each chamber is doing.',
  },
};

export const REFERENCES = [
  {
    title: 'Rings of Fire: Hoffmann Kilns',
    where: 'Low-Tech Magazine',
    url: 'https://solar.lowtechmagazine.com/2009/10/rings-of-fire-hoffmann-kilns/',
    tag: 'L',
  },
];

/**
 * How each simulated figure on screen is arrived at (brief section 8, day 11).
 *
 * A tag says a number was simulated. It does not say what was done to it, and
 * "simulated" covers everything from a defensible rule to a made-up curve. The
 * details sheet shows these so the difference is visible.
 *
 * Each entry describes a rule that `engine.js` ACTUALLY RUNS. `inputs` are
 * config paths, checked at startup — a method citing a value the model does
 * not have is a description of some other program. `where` names the function
 * so the prose can be read against the code rather than trusted.
 *
 * Section 4 holds throughout: relative units only. No entry here reports a
 * temperature in degrees, and the 850-900 C peak appears only as a band.
 */
export const METHODS = [
  {
    title: 'Chamber heat',
    tag: 'S',
    what: 'The warmth each chamber is drawn with. A figure from 0 to 1, never a temperature.',
    how: 'Every few simulated minutes, each chamber in the air\'s path trades heat with the gas passing through it: the hotter of the two gives heat to the colder, more when the gap between them is bigger. Chambers out of the path slowly cool towards the outside air. The model works in degrees inside, but what it hands to the screen is a share of one reference temperature, kept between 0 and 1, so nothing on screen can be read as a measured temperature.',
    where: 'engine.js — stepWorld, relativeHeat',
    inputs: ['thermalModel.exchangeRate', 'thermalModel.chamberMass', 'thermalModel.gasMass', 'thermalModel.ambientLossRate', 'thermalModel.heatRefC', 'temperature.ambientC'],
  },
  {
    title: 'The fuel figures',
    tag: 'S',
    what: 'The two numbers in the heat recovery panel. Relative units per chamber fired, not kilograms of cashew shell.',
    how: 'Fuel goes in at whatever rate keeps the firing chamber at its target: the further below target it is, the more fuel goes in, up to a limit. That rule knows nothing about heat recovery. The difference between the two numbers comes only from where the air goes: a chamber that arrives cold costs more to bring up to the same peak. So the saving is something the model produces, not a figure written into it. How the crew at Kundapur decides how much to feed was not observed.',
    where: 'engine.js — stepWorld',
    inputs: ['thermalModel.targetC', 'thermalModel.fuelGain', 'thermalModel.maxFuelRate', 'thermalModel.heatPerFuel', 'fuel.indexUnit'],
  },
  {
    title: 'The airflow arrow',
    tag: 'S',
    what: 'Where the arrow is thick and where it is bright. Both show how much heat the gas is carrying at that point.',
    how: 'Nothing is invented for the drawing. The arrow uses the model\'s own gas temperature, noted at each chamber boundary as the model follows the air, and joins those values with a curve that never rises above or dips below them. That matters: an ordinary smooth curve would overshoot on the climb to the fire and show gas hotter than anything in the kiln. So the arrow and the fuel figures are two readings of one model, not two separate claims.',
    where: 'engine.js — gasCurve, gasAt',
    inputs: ['thermalModel.subStepHours', 'parts.airWidthMax', 'parts.airWidthMin'],
  },
  {
    title: 'Which chambers are involved at all',
    tag: 'A',
    what: 'The three chambers ahead of the fire that are warming, and the two behind it that are still giving heat back.',
    how: 'Set, not simulated. Writing on other kilns says about three chambers are hot at once, and these two numbers are my reading of that. Everything above depends on them: they decide the path the air takes, and so which chambers trade heat and which are left to cool. They are the assumption that matters most in the model.',
    where: 'engine.js — flowPath',
    inputs: ['windows.preheat', 'windows.cool', 'thermal.activeChambers'],
  },
  {
    title: 'Stepping the clock',
    tag: 'A',
    what: 'Why the kiln behaves the same at 0.25× and 4×, and on a slow computer.',
    how: 'The temperature rule works step by step, and a different step size gives a slightly different answer. If the screen\'s frame rate chose the step, a fast computer and a slow one would end up several degrees apart. So simulated time is saved up and spent only in fixed small steps, with any remainder carried over to the next frame. The speed slider changes how fast simulated time passes, never how it is worked out.',
    where: 'engine.js — integrateThermal',
    inputs: ['thermalModel.subStepHours', 'time.tickSeconds', 'time.tickHours'],
  },
  {
    title: 'The space-time chart, and scrubbing back',
    tag: 'S',
    what: 'What the chart records, and what dragging the kiln backwards brings back.',
    how: 'One snapshot is kept for every step. Going back replays what happened rather than running the simulation in reverse, which this model cannot do. Both the kiln on screen and the comparison run beside it are recorded, so going back restores the comparison as it was. The air temperatures are not stored; they are worked out again from the chamber temperatures, so two copies can never disagree.',
    where: 'history.js — snapshot',
    inputs: ['chart.windowTicks', 'chart.minRowHeight'],
  },
];

/*
 * No ink table for evidence mode, and that is a decision rather than an
 * omission (day 11). Evidence mode leaves the drawing alone: the codes appear
 * on the labels, the legend decodes them, and the kiln keeps looking like a
 * kiln. An earlier attempt re-inked the whole scene the moment the toggle went
 * on and drained it to a grey diagram, which is a high price for a legend.
 */

// ---------------------------------------------------------------------------
// Split `defs` into values / tags / notes.
// ---------------------------------------------------------------------------

function split(node, pick) {
  // A leaf is the [value, tag, note?] array: second slot is an evidence code.
  if (Array.isArray(node) && typeof node[1] === 'string' && node[1] in EVIDENCE) {
    return pick(node);
  }
  const out = {};
  for (const key of Object.keys(node)) out[key] = split(node[key], pick);
  return out;
}

/** Plain values, for the engine and views: C.time.tickHours === 2 */
export const C = split(defs, ([value]) => value);

/** Evidence codes, same shape: TAGS.time.tickHours === 'F' */
export const TAGS = split(defs, ([, tag]) => tag);

/** Notes where one was written, same shape. Undefined otherwise. */
export const NOTES = split(defs, ([, , note]) => note);

/**
 * The unit of every numeric value, by dotted path: UNITS['time.tickHours'] === 'h'.
 *
 * Here rather than in the view for the same reason the tags are: a unit is
 * part of what a value MEANS. "2" is not a fact about the kiln; "2 h" is.
 * Without these the details sheet printed a column of bare numbers, and a
 * visitor had to work out from the key name whether 0.44 was metres, a share
 * or a rate.
 *
 * A unit starting with `%` marks a fraction, which is printed as a percent
 * (0.44 reads 44 %). `rel.` is section 4's relative unit — the model's own
 * scale, never a mass or an energy. Years carry no unit and are listed in
 * UNITLESS, so a check can tell a date from a number someone forgot.
 *
 * checks.js fails if a numeric value has no entry here, or an entry here
 * names no value, so the two cannot drift.
 */
export const UNITS = {
  'chambers.count': 'chambers',

  'time.tickHours': 'h',
  'time.loopHours': 'h',
  'time.tickSeconds': 's',
  'time.speedMin': '×',
  'time.speedMax': '×',

  'loading.perTick': 'chambers per step',

  'windows.preheat': 'chambers',
  'windows.cool': 'chambers',

  'temperature.peakBandC': '°C',
  'temperature.ambientC': '°C',
  'temperature.preheatTargetC': '°C',
  'temperature.coolFloorC': '°C',

  'thermalModel.subStepHours': 'h',
  'thermalModel.chamberMass': 'rel.',
  'thermalModel.gasMass': 'rel.',
  'thermalModel.exchangeRate': 'per h',
  'thermalModel.ambientLossRate': 'per h',
  'thermalModel.targetC': '°C',
  'thermalModel.heatPerFuel': '°C per fuel unit',
  'thermalModel.fuelGain': 'rel.',
  'thermalModel.maxFuelRate': 'rel. per h',
  'thermalModel.heatRefC': '°C',

  'thermal.activeChambers': 'chambers',

  'drying.summerDays': 'days',
  'drying.monsoonDays': 'days',

  'form.width': 'scene units',
  'form.depth': 'scene units',
  'form.cornerRadius': 'scene units',
  'form.wallThickness': 'scene units',
  'form.chamberGap': '% of a chamber',

  'parts.wallHeight': 'scene units',
  'parts.wallThickness': 'scene units',
  'parts.walkwayWidth': 'scene units',
  'parts.stokeHolesPerChamber': 'per chamber',
  'parts.stokeHoleRadius': 'scene units',
  'parts.ductWidth': 'scene units',
  'parts.ductHeight': 'scene units',
  'parts.chimneyRadius': 'scene units',
  'parts.chimneyHeight': 'scene units',
  'parts.wallInset': 'scene units',
  'parts.tilesAcross': 'tiles',
  'parts.tileEndFraction': '% of a chamber',
  'parts.tileInset': 'scene units',
  'parts.tileFillFraction': '% of a step',
  'parts.tileHatch.period': 'scene units',
  'parts.tileHatch.angleDeg': '°',
  'parts.tileHatch.thickness': '% of the period',
  'parts.tileHatch.opacity': '%',
  'parts.tileHatch.texturePx': 'px',
  'parts.flueWidth': 'scene units',
  'parts.wicketWidthFraction': '% of a chamber',
  'parts.damperWidthFraction': '% of a chamber',
  'parts.islandInset': 'scene units',
  'parts.channelWidth': 'scene units',
  'parts.chimneyVoidRadius': 'scene units',
  'parts.islandCornerRadius': 'scene units',
  'parts.airInletLead': 'scene units',
  'parts.airInletTurn': '% of a chamber',
  'parts.airInletWidthFraction': '% of a chamber',
  'parts.airSpentBlend': '%',
  'parts.airSmoothSamples': 'points',
  'parts.airSmoothRadius': 'points',
  'parts.airSmoothPasses': 'passes',
  'parts.airWidthMax': 'scene units',
  'parts.airWidthMin': 'scene units',
  'parts.airWidthSoftness': 'scene units',
  'parts.zoneBandWidth': 'scene units',
  'parts.zoneBandOffset': 'scene units',

  'clock.dialHours': 'h',
  'clock.flashSeconds': 's',
  'clock.flashMaxOfTick': '% of a step',
  'clock.handSettle': '% per frame',
  'clock.handSnapDeg': '°',

  'chart.windowTicks': 'steps',
  'chart.minRowHeight': 'px',
  'chart.cellGap': 'px',
  'chart.hoursLabelEvery': 'steps',
};

/** Numeric values that are dates, not quantities, and so have no unit. */
export const UNITLESS = ['history.hoffmannPatentYear', 'history.mangaloreTileStart'];

/**
 * Starting params for engine state. Brief section 10 lists these on state.params,
 * so they are gathered here rather than written inline in the engine.
 */
export const DEFAULT_PARAMS = {
  tickSeconds: C.time.tickSeconds,
  speed: 1,
  recovery: true,                                 // heat reuse on by default
  autoLoad: C.loading.auto,                       // the crew works on its own
  policy: OPEN_QUESTIONS.forkPolicy.value,        // null until the user chooses
  window: { pre: C.windows.preheat, cool: C.windows.cool },
};

export default C;
