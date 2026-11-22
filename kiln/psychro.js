/**
 * psychro.js — moist-air arithmetic for the proposal's route check.
 *
 * Standard formulas, nothing tuned: saturation vapour pressure (the
 * Arden Buck equation), humidity ratio, dew point, enthalpy of moist air.
 * Pressure is sea level, which suits a coastal site.
 *
 * Air drying produce without heat loss cools along a line of constant
 * enthalpy: the heat that evaporates the water comes out of the air. So
 * "water picked up" moves the air along that line, and "remaining capacity"
 * is how much more it could pick up before it is saturated.
 *
 * Checked against the proposal's worked example (draft 5, section 13.2):
 * 27 °C / 90% heated to 47 °C gives 30% and about 7 g/kg of capacity; after
 * 4 g/kg, about 37–38 °C, 59–60%, 24 g/kg, dew point 28 °C, about 3 g/kg.
 * Small differences are rounding and the choice of formula.
 */

const P = 101.325;            // kPa, sea level
const EPS = 0.62198;          // ratio of molar masses, water / dry air

/** Saturation vapour pressure over water, kPa (Buck, 1981). */
export function satPressure(tC) {
  return 0.61121 * Math.exp((18.678 - tC / 234.5) * (tC / (257.14 + tC)));
}

/** Humidity ratio, kg water per kg dry air, from temperature and RH (0–1). */
export function humidityRatio(tC, rh) {
  const pv = rh * satPressure(tC);
  return (EPS * pv) / (P - pv);
}

/** Relative humidity (0–1) of air at tC holding W. */
export function relHumidity(tC, w) {
  const pv = (w * P) / (EPS + w);
  return pv / satPressure(tC);
}

function bisect(f, lo, hi) {
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (f(m) < 0) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

/** Dew point, °C, of air holding W. */
export function dewPoint(w) {
  const pv = (w * P) / (EPS + w);
  return bisect((t) => satPressure(t) - pv, -30, 90);
}

/** Enthalpy of moist air, kJ per kg dry air. */
export function enthalpy(tC, w) {
  return 1.006 * tC + w * (2501 + 1.86 * tC);
}

/** Temperature on a line of constant enthalpy once the air holds W. */
export function tempAt(h, w) {
  return (h - 2501 * w) / (1.006 + 1.86 * w);
}

/** Where that line meets saturation: { t, w }. */
export function saturationOn(h) {
  const t = bisect((x) => enthalpy(x, humidityRatio(x, 1)) - h, -10, 90);
  return { t, w: humidityRatio(t, 1) };
}

/**
 * Follow one stream of heated air through a run of bays.
 *
 * @param {object} o
 * @param {number} o.outC   outdoor air, °C
 * @param {number} o.outRH  outdoor relative humidity, 0–1
 * @param {number} o.heatC  temperature it is heated to
 * @param {number} o.pickG  water each bay adds, g per kg of air
 * @param {number} o.bays   how many bays to follow
 * @returns {{outdoor, heated, sat, bays: Array}} every state, W in g/kg
 */
export function followAir({ outC, outRH, heatC, pickG, bays = 3 }) {
  const w0 = humidityRatio(outC, outRH);
  const h = enthalpy(heatC, w0);
  const sat = saturationOn(h);
  // Capacity is measured along each air's own line of constant enthalpy:
  // unheated outdoor air saturates far sooner than the same air heated.
  const state = (t, w, satW = sat.w) => ({
    t,
    w: w * 1000,
    rh: Math.min(1, relHumidity(t, w)),
    dew: dewPoint(w),
    cap: Math.max(0, (satW - w) * 1000),
  });
  const out = [];
  let w = w0;
  for (let i = 0; i < bays; i++) {
    const before = state(tempAt(h, w), w);
    // A bed cannot push air past saturation: it simply stops drying.
    const wNext = Math.min(sat.w, w + pickG / 1000);
    out.push({ in: before, out: state(tempAt(h, wNext), wNext), saturated: wNext >= sat.w - 1e-9 });
    w = wNext;
  }
  return {
    outdoor: state(outC, w0, saturationOn(enthalpy(outC, w0)).w),
    heated: state(heatC, w0),
    sat: { t: sat.t, w: sat.w * 1000 },
    bays: out,
  };
}
