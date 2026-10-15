/**
 * views/heatRamp.js — relative heat to a colour, for every view that draws it.
 *
 * The kiln and the space-time chart must agree exactly: the whole point of the
 * chart is that it is the SAME data as the kiln, seen along a different axis.
 * Two copies of this ramp would disagree the first time a colour changed, so
 * there is one copy and both views call it.
 *
 * Pure: no three.js, no DOM. The kiln wraps the result in a THREE.Color, the
 * chart puts the string straight into an SVG fill, and this can be tested in
 * Node like the engine.
 *
 * Direction: cold clay at 0, through pale yellow and amber, to red at the fire.
 * That runs the opposite way to real incandescence — see the note above the
 * ramp in style.css for why.
 */

import { PALETTE } from '../config.js';

const RAMP_KEYS = ['sand-faint', 'heat-0', 'heat-1', 'heat-2', 'heat-3', 'heat-4'];

/** '#rrggbb' -> [r, g, b], 0-255. */
function parse(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const RAMP = RAMP_KEYS.map((k) => parse(PALETTE[k]));

let warnedAboutHeat = false;

/**
 * Relative heat (0 to 1, simulated) to a hex colour.
 *
 * A chamber arriving without a heat value must not take the page down. An
 * undefined or NaN `h` makes the ramp index NaN and RAMP[NaN] is undefined,
 * which three.js then throws on inside Color.copy — killing the draw loop and
 * freezing everything, for one missing number. Seen in the wild when a stale
 * cached engine.js was paired with a newer view.
 */
export function heatHex(h) {
  if (!Number.isFinite(h)) {
    if (!warnedAboutHeat) {
      warnedAboutHeat = true;
      console.warn(
        '[heatRamp] chamber.heat is missing or not a number — drawing it cold. '
        + 'If the kiln looks dead, hard-reload: this usually means a stale '
        + 'cached engine.js is running against a newer view.',
      );
    }
    h = 0;
  }

  const t = Math.max(0, Math.min(1, h)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.max(0, Math.floor(t)));
  const f = t - i;
  const a = RAMP[i];
  const b = RAMP[i + 1];

  const c = [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** How many stops the ramp has. Used by the legend and by checks. */
export const RAMP_STOPS = RAMP_KEYS.length;

/**
 * The same ramp, snapped to its nearest named stop. Evidence mode only.
 *
 * A continuous gradient looks like a reading off an instrument. The stops are
 * the colours the palette actually declares, and landing on one of six says
 * what a simulated temperature is: a model with buckets, not a measurement.
 * Section 4 — simulated values in relative units, shown as bands rather than
 * precise readings.
 *
 * Snapping `h` rather than the colour matters: it returns a palette entry
 * exactly, so a check can assert the drawn pixel IS one of the named stops.
 */
export function heatHexStepped(h) {
  if (!Number.isFinite(h)) return heatHex(h);
  const steps = RAMP.length - 1;
  return heatHex(Math.round(Math.max(0, Math.min(1, h)) * steps) / steps);
}
