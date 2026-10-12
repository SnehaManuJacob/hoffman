/**
 * views/heat.js — parcels of gas travelling the air path.
 *
 * A VIEW. It reads the engine's gas profile and draws it; it holds no kiln
 * rules.
 *
 * WHAT IT IS FOR
 * This layer carries the one claim that makes a Hoffmann kiln worth building,
 * and section 1's third success test: HEAT DOES USEFUL WORK TWICE. Air comes
 * in cold behind the fire, takes heat out of the chambers that have just
 * fired, feeds the fire, and carries what is left forward into the green tiles
 * ahead. One pass, two jobs.
 *
 * You can watch a single streak do it: pale and cool going in, brightening
 * through the cooling run, brightest at the fire, then visibly cooling again
 * as it crosses the chambers ahead. That cooling IS the heat going into the
 * tiles. It is the whole argument, and it is legible without a word of text.
 *
 * Colour comes from `gasProfile(state)` — the model's own gas temperature,
 * not a curve drawn to look right. Until Day 7 this layer was coloured by
 * hand, which meant the one thing on screen whose job was to show heat reuse
 * was the one thing not actually showing it.
 *
 * Drawn as streaks rather than dots so direction survives a still frame, and
 * as ONE indexed mesh so it costs one draw call.
 *
 * Quads, not lines: WebGL ignores `linewidth` on nearly every platform, which
 * left the first attempt as 1px hairlines that vanished against the kiln. A
 * quad also needs DoubleSide here — this camera's frustum is inverted, so
 * anything flat is back-facing and gets silently culled (see ring.js).
 *
 * Evidence: this belongs to the `airPath` component, tag L. Counter-current
 * flow is literature about other Hoffmann kilns; the path at Kundapur was not
 * observed.
 */

import * as THREE from 'three';
import { C, PALETTE } from '../config.js';
import { gasProfile, relativeHeat } from '../engine.js';
import { heatHex } from './heatRamp.js';

/** Below this relative heat a parcel is air, not an ember. */
const AIR_BLEND_BELOW = 0.18;

export function createHeat(ring) {
  const P = C.particles;
  const AIR = new THREE.Color(PALETTE.air);
  const colour = new THREE.Color();

  // Four vertices per streak — head-left, head-right, tail-left, tail-right —
  // indexed into two triangles.
  const positions = new Float32Array(P.count * 4 * 3);
  const colours = new Float32Array(P.count * 4 * 3);
  const indices = new Uint16Array(P.count * 6);
  for (let i = 0; i < P.count; i++) {
    const v = i * 4;
    const o = i * 6;
    indices[o] = v; indices[o + 1] = v + 1; indices[o + 2] = v + 2;
    indices[o + 3] = v + 1; indices[o + 4] = v + 3; indices[o + 5] = v + 2;
  }

  const geometry = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  const colAttr = new THREE.BufferAttribute(colours, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  colAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', posAttr);
  geometry.setAttribute('color', colAttr);
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));

  const streaks = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthTest: false, depthWrite: false,
    side: THREE.DoubleSide,
  }));
  streaks.renderOrder = 8;          // above the channel, below the stoke holes
  streaks.frustumCulled = false;    // the buffer is rewritten every frame
  ring.airGroup.add(streaks);

  /**
   * Parcels are spread evenly along the route at the start, with a fixed
   * lateral offset each. Even spacing makes a steady stream rather than a
   * pulse; the offsets stop them running in single file.
   */
  const parcels = Array.from({ length: P.count }, (_, i) => ({
    u: i / P.count,
    across: ((i * 2654435761) % 1000) / 1000 * 2 - 1,   // stable, no RNG
  }));

  /** Position and channel half-width at `u` along the route, 0..1. */
  function sample(u) {
    const pts = ring.routePoints;
    if (!pts.length) return null;
    const t = Math.max(0, Math.min(1, u)) * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(t));
    const f = t - i;
    const a = pts[i];
    const b = pts[i + 1];
    return {
      x: a.x + (b.x - a.x) * f,
      z: a.z + (b.z - a.z) * f,
      nx: a.nx, nz: a.nz,
      w: a.w + (b.w - a.w) * f,
    };
  }

  /**
   * Gas temperature at `u`, interpolated along the profile.
   *
   * `temps` has one more entry than there are chambers on the path: the gas
   * going in, then the gas after each chamber. So u maps across temps.length-1
   * spans, not across the chambers.
   */
  function gasTempAt(profile, u) {
    const t = profile.temps;
    if (t.length < 2) return C.temperature.ambientC;
    const x = Math.max(0, Math.min(1, u)) * (t.length - 1);
    const i = Math.min(t.length - 2, Math.floor(x));
    return t[i] + (t[i + 1] - t[i]) * (x - i);
  }

  function update(state, simHours) {
    // No fire, no draught. Nothing travels through a kiln that is not lit.
    const running = state.phase !== 'charging' && ring.routePoints.length > 1;
    streaks.visible = running;
    if (!running) return;

    const profile = gasProfile(state);

    for (let i = 0; i < parcels.length; i++) {
      const p = parcels[i];

      // Movement is tied to SIMULATED hours, so parcels speed up at 4x, freeze
      // when paused, and behave the same on a slow machine as a fast one.
      p.u += P.speedPerSimHour * simHours;
      while (p.u > 1) p.u -= 1;
      while (p.u < 0) p.u += 1;

      const head = sample(p.u);
      // The streak trails BEHIND the head, so it points the way it travels.
      const tail = sample(Math.max(0, p.u - P.streakLength));
      if (!head || !tail) continue;

      const off = p.across * P.jitter;
      const hw = P.width / 2;
      const hx = head.x + head.nx * head.w * off;
      const hz = head.z + head.nz * head.w * off;
      const tx = tail.x + tail.nx * tail.w * off;
      const tz = tail.z + tail.nz * tail.w * off;

      // Widen across the direction of travel, so a streak is a dash.
      const o = i * 12;
      const put = (k, x, z) => {
        positions[o + k * 3] = x;
        positions[o + k * 3 + 1] = ring.airY;
        positions[o + k * 3 + 2] = z;
      };
      put(0, hx + head.nx * hw, hz + head.nz * hw);
      put(1, hx - head.nx * hw, hz - head.nz * hw);
      put(2, tx + tail.nx * hw, tz + tail.nz * hw);
      put(3, tx - tail.nx * hw, tz - tail.nz * hw);

      /**
       * Colour from the model's gas temperature. The cold end takes `--air`,
       * the one tone section 9 reserves for air — incoming air is air, not a
       * dull ember, and the ramp's bottom would read as a cooling coal.
       */
      const h = relativeHeat(gasTempAt(profile, p.u));
      colour.set(heatHex(h));
      if (h < AIR_BLEND_BELOW) colour.lerp(AIR, (AIR_BLEND_BELOW - h) / AIR_BLEND_BELOW);

      // Fade out over the last stretch, as the gas leaves for the chimney.
      const fade = p.u > 1 - P.fadeTail ? (1 - p.u) / P.fadeTail : 1;
      colour.multiplyScalar(fade);

      const setCol = (k, m) => {
        colours[o + k * 3] = colour.r * m;
        colours[o + k * 3 + 1] = colour.g * m;
        colours[o + k * 3 + 2] = colour.b * m;
      };
      setCol(0, 1); setCol(1, 1);            // head, full
      setCol(2, 0.3); setCol(3, 0.3);        // tail, trailing off
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  function dispose() {
    geometry.dispose();
    streaks.material.dispose();
    ring.airGroup.remove(streaks);
  }

  return { update, dispose, streaks, parcels };
}
