/**
 * views/building.js — a rough model of the real building.
 *
 * Not a reconstruction. Built to the level of "recognisable silhouette" from
 * the reference photographs (street view + satellite, Prabhakar Tile Works,
 * Kundapur), not from any survey or measurement — there is no field
 * measurement for a building, unlike the kiln facts in config.js, so nothing
 * here carries an evidence tag the way config.js's values do. It exists for
 * the intro only (views/intro.js); engine.js never reads it and ring.js never
 * draws it.
 *
 * WHAT CARRIES THE READ, IN ORDER
 *  1. The segmented, saw-tooth roofline — the one shape that makes this a
 *     tile-and-brick factory shed rather than a generic long box. Visible in
 *     both the satellite photo (repeated parallel ridges) and the street
 *     view (a row of separate hipped sections along one building).
 *  2. A free-standing chimney stack, off to one side, matching its position
 *     in the street-view photo — and a deliberate echo: this is the exact
 *     word the kiln's own cutaway labels later in the sequence (ring.js).
 *  3. Everything else — proportions, wall openings — is a plain massed
 *     block. Rough means this, not a textured reconstruction.
 *
 * FLAT, UNLIT, PALETTE-ONLY
 * MeshBasicMaterial throughout — no lights, no shading gradient. Brief
 * section 9: "flat surfaces; no gradients or shadows for decoration." Three
 * flat PALETTE tones carry the whole form (walls / roof / chimney); the
 * camera's orbit in the intro is what reads the geometry, the same way a
 * paper diorama reads from silhouette and parallax rather than shading.
 * Colours are taken only from the neutral mineral set (soot/clay/sand
 * family) — never the heat ramp or `air`, both reserved elsewhere in
 * style.css and PALETTE's own comments for simulated temperature and gas.
 */

import * as THREE from 'three';
import { PALETTE } from '../config.js';

const BAYS = 6;              // roof sections along the shed's length
const BAY_WIDTH = 2.2;
const BUILDING_DEPTH = 3.4;
const WALL_HEIGHT = 1.1;
const ROOF_RISE = 0.9;
const ROOF_OVERHANG = 0.12;

const CHIMNEY = {
  offsetX: (BAYS * BAY_WIDTH) / 2 + 1.6,
  offsetZ: -0.6,
  radiusTop: 0.16,
  radiusBase: 0.22,
  height: 3.6,
};

/**
 * One bay: a box for the wall below and a hipped triangular-prism roof above
 * it, sized so neighbouring bays' roofs meet edge to edge along the ridge —
 * a continuous saw-tooth, not a row of separate huts.
 *
 * The roof is six explicit triangles rather than an ExtrudeGeometry: a
 * BufferGeometry with one Float32Array is simpler to read and verify than a
 * Shape plus extrude settings for a shape this plain.
 */
function buildBay(materials) {
  const bay = new THREE.Group();

  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(BAY_WIDTH, WALL_HEIGHT, BUILDING_DEPTH),
    materials.wall,
  );
  wall.position.y = WALL_HEIGHT / 2;
  bay.add(wall);

  const hw = BAY_WIDTH / 2 + ROOF_OVERHANG;
  const hd = BUILDING_DEPTH / 2 + ROOF_OVERHANG;
  const y0 = WALL_HEIGHT;
  const yPeak = WALL_HEIGHT + ROOF_RISE;

  // prettier-ignore
  const positions = new Float32Array([
    // front hip (z = -hd)
    -hw, y0, -hd,   hw, y0, -hd,   0, yPeak, -hd,
    // back hip (z = +hd)
    -hw, y0,  hd,    0, yPeak, hd,  hw, y0,  hd,
    // left slope
    -hw, y0, -hd,   0, yPeak, -hd,  0, yPeak,  hd,
    -hw, y0, -hd,   0, yPeak,  hd, -hw, y0,  hd,
    // right slope
     hw, y0, -hd,   hw, y0,  hd,   0, yPeak,  hd,
     hw, y0, -hd,   0, yPeak,  hd, 0, yPeak, -hd,
  ]);
  const roofGeo = new THREE.BufferGeometry();
  roofGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  roofGeo.computeVertexNormals();
  bay.add(new THREE.Mesh(roofGeo, materials.roof));

  return bay;
}

function buildChimney(materials) {
  const stack = new THREE.Mesh(
    new THREE.CylinderGeometry(CHIMNEY.radiusTop, CHIMNEY.radiusBase, CHIMNEY.height, 12),
    materials.chimney,
  );
  stack.position.set(CHIMNEY.offsetX, CHIMNEY.height / 2, CHIMNEY.offsetZ);
  return stack;
}

/**
 * The whole group, centred on the world origin along X and Z — the point
 * ring.js's own camera already looks straight down at. views/intro.js settles
 * its camera toward that same point, so the hand-off needs no re-centring.
 */
export function createBuilding() {
  const materials = {
    wall: new THREE.MeshBasicMaterial({ color: PALETTE['soot-raised'] }),
    roof: new THREE.MeshBasicMaterial({ color: PALETTE['sand-faint'], side: THREE.DoubleSide }),
    chimney: new THREE.MeshBasicMaterial({ color: PALETTE['sand-dim'] }),
  };

  const group = new THREE.Group();
  const totalWidth = BAYS * BAY_WIDTH;
  for (let i = 0; i < BAYS; i++) {
    const bay = buildBay(materials);
    bay.position.x = -totalWidth / 2 + BAY_WIDTH / 2 + i * BAY_WIDTH;
    group.add(bay);
  }
  group.add(buildChimney(materials));

  group.userData.materials = materials;
  return group;
}
