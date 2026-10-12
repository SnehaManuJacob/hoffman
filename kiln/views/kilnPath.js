/**
 * views/kilnPath.js — the centreline of the kiln loop.
 *
 * Pure maths. No three.js import, deliberately: that keeps it testable in Node
 * alongside the engine, and keeps the shape of the kiln separate from how it
 * gets rendered.
 *
 * WHAT THIS IS NOT
 * This is not a plan of the kiln at Kundapur. The real shape there is unknown
 * (config `shape.kundapur`, tag U). A rectangle is drawn because something has
 * to be drawn, and `config.form.topology` records that as an assumption. If the
 * factory answers open question 5.3, change that one setting.
 *
 * THE TRICK: ARC LENGTH, NOT ANGLE
 * Positions along the loop are addressed by `s` in 0..1 measured as ARC LENGTH,
 * not as angle or as a fraction of control points. That is what makes "eight
 * equal chambers" simply `s` in [i/8, (i+1)/8] — and it keeps working whatever
 * the topology is, which a circle-only angular version would not.
 *
 * Equal-length chambers matter because every chamber fires for the same two
 * hours (config `time.tickHours`, tag F). Chambers of different sizes would
 * draw a claim the model does not make.
 */

/** Sample the raw centreline for a topology, as a closed polyline. */
function rawPoints({ topology, width, depth, cornerRadius, samples }) {
  if (topology === 'closed') {
    // A circle, kept so the earlier round form still works unchanged.
    const r = Math.min(width, depth) / 2;
    return Array.from({ length: samples }, (_, i) => {
      const a = (i / samples) * Math.PI * 2;
      return { x: Math.cos(a) * r, z: Math.sin(a) * r };
    });
  }

  if (topology === 'zshaped') {
    throw new Error(
      'kilnPath: the z-shaped topology is not built. It is listed in config as ' +
      'a known Hoffmann form (tag L), but nothing here is modelled on it yet.',
    );
  }

  if (topology !== 'racetrack') {
    throw new Error(`kilnPath: unknown topology "${topology}"`);
  }

  // Rounded rectangle, walked anticlockwise from the middle of the top edge.
  // Clamp the radius so a small rectangle cannot produce self-crossing corners.
  const hw = width / 2;
  const hd = depth / 2;
  const r = Math.max(0, Math.min(cornerRadius, hw, hd));

  const straightX = (hw - r) * 2;    // length of each horizontal run
  const straightZ = (hd - r) * 2;    // length of each vertical run
  const quarter = (Math.PI * r) / 2;
  const perimeter = 2 * straightX + 2 * straightZ + 4 * quarter;

  // Eight legs: four straights and four corner arcs, in order around the loop.
  const legs = [
    { kind: 'line', len: straightX / 2, from: { x: 0, z: -hd }, to: { x: hw - r, z: -hd } },
    { kind: 'arc', len: quarter, cx: hw - r, cz: -hd + r, a0: -Math.PI / 2, a1: 0 },
    { kind: 'line', len: straightZ, from: { x: hw, z: -hd + r }, to: { x: hw, z: hd - r } },
    { kind: 'arc', len: quarter, cx: hw - r, cz: hd - r, a0: 0, a1: Math.PI / 2 },
    { kind: 'line', len: straightX, from: { x: hw - r, z: hd }, to: { x: -hw + r, z: hd } },
    { kind: 'arc', len: quarter, cx: -hw + r, cz: hd - r, a0: Math.PI / 2, a1: Math.PI },
    { kind: 'line', len: straightZ, from: { x: -hw, z: hd - r }, to: { x: -hw, z: -hd + r } },
    { kind: 'arc', len: quarter, cx: -hw + r, cz: -hd + r, a0: Math.PI, a1: (Math.PI * 3) / 2 },
    { kind: 'line', len: straightX / 2, from: { x: -hw + r, z: -hd }, to: { x: 0, z: -hd } },
  ];

  const points = [];
  for (const leg of legs) {
    // Give each leg a share of the samples proportional to how long it is, so
    // the polyline is evenly dense before it is resampled.
    const n = Math.max(2, Math.round((leg.len / perimeter) * samples));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      if (leg.kind === 'line') {
        points.push({
          x: leg.from.x + (leg.to.x - leg.from.x) * t,
          z: leg.from.z + (leg.to.z - leg.from.z) * t,
        });
      } else {
        const a = leg.a0 + (leg.a1 - leg.a0) * t;
        points.push({ x: leg.cx + Math.cos(a) * r, z: leg.cz + Math.sin(a) * r });
      }
    }
  }

  return points;
}

/**
 * Build a closed loop addressed by arc length.
 *
 * Returns:
 *   at(s)        -> { x, z, nx, nz }  position and outward unit normal, s in 0..1
 *   totalLength  -> perimeter in scene units
 *   bounds       -> { minX, maxX, minZ, maxZ, radius } for framing the camera
 */
export function createLoopPath({
  topology = 'racetrack',
  width = 9,
  depth = 6,
  cornerRadius = 1.6,
  samples = 720,
} = {}) {
  const raw = rawPoints({ topology, width, depth, cornerRadius, samples });

  // Cumulative arc length around the closed polyline. The final entry closes
  // the loop by returning to raw[0], which is what makes at(1) === at(0).
  const cum = [0];
  for (let i = 1; i <= raw.length; i++) {
    const a = raw[i - 1];
    const b = raw[i % raw.length];
    cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
  }
  const totalLength = cum[cum.length - 1];

  /** Position at arc length `d`, wrapped into the loop. */
  function positionAt(d) {
    let target = d % totalLength;
    if (target < 0) target += totalLength;

    // Binary search the cumulative table rather than walking it: at(s) is
    // called a few thousand times per rebuild.
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= target) lo = mid;
      else hi = mid;
    }

    const span = cum[lo + 1] - cum[lo];
    const t = span > 0 ? (target - cum[lo]) / span : 0;
    const a = raw[lo % raw.length];
    const b = raw[(lo + 1) % raw.length];
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
  }

  function at(s) {
    const d = s * totalLength;
    const p = positionAt(d);

    // Normal from a central difference along the curve: more stable at corners
    // than differencing the stored polyline, which can land on a vertex.
    const eps = totalLength * 1e-4;
    const ahead = positionAt(d + eps);
    const behind = positionAt(d - eps);
    const tx = ahead.x - behind.x;
    const tz = ahead.z - behind.z;
    const len = Math.hypot(tx, tz) || 1;

    // Rotate the tangent a quarter turn to get the outward normal.
    return { x: p.x, z: p.z, nx: tz / len, nz: -tx / len };
  }

  const xs = raw.map((p) => p.x);
  const zs = raw.map((p) => p.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);

  return {
    at,
    totalLength,
    topology,
    bounds: {
      minX, maxX, minZ, maxZ,
      // Radius of a sphere at the origin containing the whole loop.
      radius: Math.hypot(Math.max(Math.abs(minX), Math.abs(maxX)),
        Math.max(Math.abs(minZ), Math.abs(maxZ))),
    },
  };
}
