/**
 * views/ring.js — the hero: the kiln as a cutaway plan.
 *
 * (The file keeps its original name from when the kiln was drawn as a ring.
 * It is now a blueprint view; the name is historical.)
 *
 * This is a VIEW. It reads engine state and draws it. It holds no kiln rules.
 *
 * WHY A CUTAWAY, SEEN STRAIGHT DOWN
 * The single thing a visitor has to understand is that THE FIRE MOVES AND THE
 * TILES DO NOT. A solid kiln cannot show that, because the tiles are the thing
 * you cannot see. So the roof comes off: each chamber is drawn open, with its
 * load of tiles sitting inside, and the heat sweeps across them. Chambers being
 * emptied and reloaded become visible for the same reason.
 *
 * An orthographic camera, not perspective: this is a drawing of a plan, and
 * perspective would make the far side of the kiln a different size from the
 * near side for no gain.
 *
 * TEMPERATURE IS COLOUR, AND ONLY COLOUR
 * Tiles take their colour from `chamber.heat`, which is relative and simulated
 * (tag S). No number is printed anywhere on the kiln. Section 4 allows
 * simulated values only in relative units, and the one real figure — the
 * 850-900 C peak — only as a band, so degrees per chamber would be a lie
 * however well it would read.
 *
 * Every part is registered in config.COMPONENTS with the source of the
 * knowledge behind it, and each is its own THREE.Group carrying
 * `userData.component` so evidence mode can restyle or hide by tag.
 */

import * as THREE from 'three';
import { C, PALETTE, STAGE_COLOUR, COMPONENTS } from '../config.js';
import { gasProfile, relativeHeat } from '../engine.js';
import { createLoopPath } from './kilnPath.js';
import { heatHex } from './heatRamp.js';

const SETTLE_FRACTION = 0.3;
const SNAP_DISTANCE = 0.01;

/**
 * Which way a drag moves time. Dragging the way the fire travels must move
 * time FORWARD.
 *
 * Deliberately a constant rather than something derived: the camera's frustum
 * is inverted, so screen-space rotation does not map to world rotation the way
 * you would expect, and reasoning it out on paper gets it backwards as often
 * as not. It is settled by dragging the kiln and watching the clock.
 *
 * Measured: the fire runs anticlockwise on screen, and +1 is what makes a drag
 * that way move the clock forward. -1 was tried first and ran time backwards.
 */
const SCRUB_SIGN = 1;

/**
 * Relative heat to a colour. The ramp itself lives in views/heatRamp.js so the
 * space-time chart draws from exactly the same one — the chart is the same data
 * as the kiln, and two copies of a ramp would disagree the day one changed.
 */
function heatColour(h, out = new THREE.Color()) {
  return out.set(heatHex(h));
}

/** A flat band between two normal offsets, at height y. */
function bandGeometry(path, s0, s1, offInner, offOuter, y, steps = 40) {
  const positions = [];
  const indices = [];
  for (let i = 0; i <= steps; i++) {
    const { x, z, nx, nz } = path.at(s0 + (s1 - s0) * (i / steps));
    positions.push(x + nx * offInner, y, z + nz * offInner);
    positions.push(x + nx * offOuter, y, z + nz * offOuter);
  }
  for (let i = 0; i < steps; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}

/** Outline of a band, as a closed loop of line segments. */
function bandOutline(path, s0, s1, offInner, offOuter, y, steps = 40) {
  const inner = []; const outer = [];
  for (let i = 0; i <= steps; i++) {
    const { x, z, nx, nz } = path.at(s0 + (s1 - s0) * (i / steps));
    inner.push([x + nx * offInner, z + nz * offInner]);
    outer.push([x + nx * offOuter, z + nz * offOuter]);
  }
  const ring = [...outer, ...inner.reverse()];
  const pos = [];
  for (let i = 0; i < ring.length; i++) {
    const [x1, z1] = ring[i];
    const [x2, z2] = ring[(i + 1) % ring.length];
    pos.push(x1, y, z1, x2, y, z2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/** A flat rectangle lying in the XZ plane, centred on (cx, cz). */
function rectXZ(cx, cz, w, d, y) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  g.translate(cx, y, cz);
  return g;
}

/** A closed outline following a loop path at a normal offset. */
function pathOutline(path, offset, y, steps = 240, dx = 0) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const { x, z, nx, nz } = path.at(i / steps);
    pts.push(new THREE.Vector3(x + nx * offset + dx, y, z + nz * offset));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

/**
 * A loop path filled in as a solid shape, optionally shifted along x.
 *
 * THREE.Shape works in XY and rotateX(-90) sends y to -z, so the path's z is
 * fed in negated to come out the right way round.
 */
function filledPath(path, y, dx = 0, steps = 160) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= steps; i++) {
    const p = path.at(i / steps);
    if (i === 0) shape.moveTo(p.x + dx, -p.z);
    else shape.lineTo(p.x + dx, -p.z);
  }
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

function componentGroup(id) {
  const g = new THREE.Group();
  g.userData.component = id;
  g.userData.tag = COMPONENTS[id]?.tag;
  return g;
}

export function createRing(canvas, options = {}) {
  const count = options.count ?? C.chambers.count;
  const P = C.parts;
  const halfBand = C.form.wallThickness / 2;
  const inset = P.wallInset;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setClearColor(new THREE.Color(PALETTE.soot), 1);

  const scene = new THREE.Scene();

  /**
   * Straight down. `up` along -Z so the kiln's long axis lies across the
   * screen the way it would on a plan drawing.
   *
   * CAREFUL: resize() gives this camera an INVERTED frustum — top negative,
   * bottom positive — to get that orientation. An inverted frustum mirrors the
   * image, and a mirrored image reverses triangle winding, so anything flat
   * added to this scene is BACK-FACING and will be silently culled unless its
   * material sets `side`. It renders no pixels while reporting a perfectly
   * healthy colour, which is a miserable thing to debug.
   *
   * The band geometry below happens to be wound the other way, so it survives.
   * Every circle must say DoubleSide.
   */
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.set(0, 20, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  const FIT_MARGIN = 1.08;

  const path = createLoopPath({
    topology: C.form.topology,
    width: C.form.width,
    depth: C.form.depth,
    cornerRadius: C.form.cornerRadius,
  });

  const root = new THREE.Group();
  scene.add(root);

  const gap = C.form.chamberGap;
  const sStart = (i) => (i + gap / 2) / count;
  const sEnd = (i) => (i + 1 - gap / 2) / count;

  // How far the air-in tail reaches outside the kiln wall. The camera fit
  // below has to know about it, or the tail is drawn off the edge of the frame.
  const AIR_TAIL = 0.5;

  // Heights are only a draw order under an orthographic top-down camera.
  const Y = {
    masonry: 0, floor: 0.01, tiles: 0.02, wall: 0.03,
    flue: 0.04, damper: 0.05, air: 0.06, outline: 0.07,
    // Stoke holes sit above the airflow arrow. They are openings in the roof,
    // so nothing inside the kiln can be drawn over them — and the arrow runs
    // down the same centre line, which hid them completely until now.
    stoke: 0.09,
  };

  // ---------------------------------------------------------------- masonry
  // A — the kiln's bulk. Walls are implied by there being separate chambers.
  const massGroup = componentGroup('dividingWalls');
  root.add(massGroup);
  massGroup.add(new THREE.Mesh(
    bandGeometry(path, 0, 1, -halfBand, halfBand, Y.masonry, 260),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE['sand-faint']) }),
  ));
  massGroup.add(new THREE.LineSegments(
    bandOutline(path, 0, 1, -halfBand, halfBand, Y.outline, 260),
    new THREE.LineBasicMaterial({ color: new THREE.Color(PALETTE['sand-dim']) }),
  ));

  // ---------------------------------------------------------------- chambers
  // F — eight connected chambers, counted at the factory. Drawn as voids.
  const chambersGroup = componentGroup('chambers');
  root.add(chambersGroup);
  const segments = [];

  for (let i = 0; i < count; i++) {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.soot) });
    const mesh = new THREE.Mesh(
      bandGeometry(path, sStart(i), sEnd(i), -halfBand + inset, halfBand - inset, Y.floor),
      material,
    );
    mesh.userData.chamber = i;
    chambersGroup.add(mesh);
    segments.push({
      mesh, material, index: i,
      current: new THREE.Color(PALETTE['sand-faint']),
      // How much of the chamber's stack is in place, 0 to 1. Animated, so
      // tiles go in and come out one at a time instead of blinking.
      fill: 0,
    });
  }

  // ------------------------------------------------------------------- tiles
  // A — the stack is a stand-in. How many tiles a chamber holds, and how they
  // are stacked, is unknown (section 4, tag U). What matters is that they do
  // NOT move: the fire comes to them.
  const tilesGroup = componentGroup('tiles');
  root.add(tilesGroup);
  const tileMeshes = [];
  const tileColour = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const perChamber = [];
    const s0 = sStart(i);
    const s1 = sEnd(i);
    const innerEdge = -halfBand + inset + P.tileInset;
    const outerEdge = halfBand - inset - P.tileInset;

    /**
     * Two rows, one at each END of the chamber, each running across its full
     * width. The middle of the chamber — along the direction the fire travels
     * — is left clear.
     *
     * Tiles are revealed in this order as a chamber fills, so the order is
     * chosen to read as work: across the width, both ends together, so the two
     * stacks grow side by side rather than one end filling before the other.
     */
    const span = outerEdge - innerEdge;
    const length = s1 - s0;
    const margin = 0.05;                              // clear of the cross walls
    const endBands = [
      [s0 + length * margin, s0 + length * (margin + P.tileEndFraction)],
      [s1 - length * (margin + P.tileEndFraction), s1 - length * margin],
    ];

    for (let a = 0; a < P.tilesAcross; a++) {
      const o0 = innerEdge + span * ((a + 0.1) / P.tilesAcross);
      const o1 = innerEdge + span * ((a + 0.9) / P.tilesAcross);
      for (const [t0, t1] of endBands) {
        const m = new THREE.Mesh(
          bandGeometry(path, t0, t1, o0, o1, Y.tiles, 4),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE['sand-faint']) }),
        );
        tilesGroup.add(m);
        perChamber.push(m);
      }
    }
    tileMeshes.push(perChamber);
  }

  // ------------------------------------------------------------- cross walls
  // A — something separates the chambers.
  const wallsGroup = componentGroup('dividingWalls');
  root.add(wallsGroup);
  const crossMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE['sand-dim']) });
  for (let i = 0; i < count; i++) {
    wallsGroup.add(new THREE.Mesh(
      bandGeometry(path, sEnd(i), sEnd(i) + gap / count,
        -halfBand + inset, halfBand - inset, Y.wall, 3),
      crossMat,
    ));
  }

  // ------------------------------------------------------------ wicket doors
  // L — chambers are bricked up and broken open to load and unload.
  const wicketGroup = componentGroup('wicketDoors');
  root.add(wicketGroup);
  const wickets = [];
  for (let i = 0; i < count; i++) {
    const mid = (sStart(i) + sEnd(i)) / 2;
    const half = (sEnd(i) - sStart(i)) * 0.22;
    const m = new THREE.Mesh(
      bandGeometry(path, mid - half, mid + half, halfBand - inset, halfBand, Y.wall, 6),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE['sand-dim']) }),
    );
    wicketGroup.add(m);
    wickets.push(m);
  }

  // ------------------------------------------------------------- stoke holes
  // F — cashew-nut shells go in through holes in the chamber roofs. The only
  // new part that is actually Kundapur.
  const stokeGroup = componentGroup('stokeHoles');
  root.add(stokeGroup);
  /**
   * Each hole is a disc with a ring around it, so it reads as an opening cut
   * through the roof rather than a dot painted on it. The ring is always
   * there — every chamber has its holes — but only the chamber being stoked
   * is lit, which is what shows where the fuel is going in right now.
   */
  const stokeGeo = new THREE.CircleGeometry(P.stokeHoleRadius, 18);
  stokeGeo.rotateX(-Math.PI / 2);

  const ringGeo = new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 24 }, (_, k) => {
      const a = (k / 24) * Math.PI * 2;
      const r = P.stokeHoleRadius * 1.35;
      return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    }),
  );

  const stokeHoles = [];
  for (let i = 0; i < count; i++) {
    const perChamber = [];
    for (let h = 0; h < P.stokeHolesPerChamber; h++) {
      const t = (h + 0.5) / P.stokeHolesPerChamber;
      const { x, z } = path.at(sStart(i) + (sEnd(i) - sStart(i)) * t);

      /**
       * Drawn last, on top of everything.
       *
       * Height alone is not enough. The airflow ribbon is transparent, and
       * three.js renders every transparent object AFTER every opaque one, so
       * the ribbon painted straight over these discs no matter how high they
       * sat — they were only visible through its 5% of translucency. Joining
       * the transparent pass with a higher renderOrder, and ignoring depth,
       * puts the openings genuinely on top.
       */
      const onTop = {
        transparent: true, opacity: 1, depthTest: false, depthWrite: false,
        side: THREE.DoubleSide,        // mirrored projection: see the camera note
      };

      const disc = new THREE.Mesh(stokeGeo, new THREE.MeshBasicMaterial({
        color: new THREE.Color(PALETTE.soot), ...onTop,
      }));
      disc.position.set(x, Y.stoke, z);
      disc.renderOrder = 10;
      stokeGroup.add(disc);

      const ring = new THREE.LineLoop(ringGeo, new THREE.LineBasicMaterial({
        color: new THREE.Color(PALETTE['sand-faint']), ...onTop,
      }));
      ring.position.set(x, Y.stoke, z);
      ring.renderOrder = 11;
      stokeGroup.add(ring);

      perChamber.push({ disc, ring });
    }
    stokeHoles.push(perChamber);
  }

  // --------------------------------------------------------------- flue duct
  // L — dampers and flues route the gas to a chimney.
  //
  // A CORRIDOR, not a stripe: a dark void with masonry either side, so it
  // reads as a passage cut through the middle of the kiln. The exhaust from
  // whichever damper is open travels along here to the chimney.
  const ductInset = halfBand + 0.5;
  const ductPath = createLoopPath({
    topology: C.form.topology,
    width: C.form.width - ductInset * 2,
    depth: C.form.depth - ductInset * 2,
    cornerRadius: Math.max(0.4, C.form.cornerRadius - ductInset * 0.5),
  });
  const ductGroup = componentGroup('flueDuct');
  root.add(ductGroup);

  const halfFlue = P.flueWidth / 2;
  const wallT = P.flueWallThickness;
  const masonry = new THREE.MeshBasicMaterial({
    color: new THREE.Color(PALETTE['sand-faint']), side: THREE.DoubleSide,
  });
  const hairline = new THREE.LineBasicMaterial({
    color: new THREE.Color(PALETTE['sand-dim']),
  });

  // The void itself.
  ductGroup.add(new THREE.Mesh(
    bandGeometry(ductPath, 0, 1, -halfFlue, halfFlue, Y.flue, 240),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.soot) }),
  ));
  // Masonry either side of it.
  ductGroup.add(new THREE.Mesh(
    bandGeometry(ductPath, 0, 1, halfFlue, halfFlue + wallT, Y.flue, 240), masonry,
  ));
  ductGroup.add(new THREE.Mesh(
    bandGeometry(ductPath, 0, 1, -halfFlue - wallT, -halfFlue, Y.flue, 240), masonry,
  ));
  ductGroup.add(new THREE.LineLoop(
    pathOutline(ductPath, halfFlue + wallT, Y.outline), hairline,
  ));
  ductGroup.add(new THREE.LineLoop(
    pathOutline(ductPath, -halfFlue - wallT, Y.outline), hairline,
  ));

  // ------------------------------------------------------- inner wall + channel
  /**
   * A — the wall immediately inside the chambers, in TWO SECTIONS: one left of
   * the chimney, one right. Each is a hollow ring of masonry, not a solid
   * slab. The gap between them is the passage the exhaust takes from whichever
   * damper is open, along the corridor, and in to the chimney — and at the
   * chimney that passage widens into a circle, biting into the facing edge of
   * each section.
   *
   * That passage is structure, not a gap left over. Walling across it leaves
   * the kiln with no way to vent and the airflow arrow drawn through solid
   * masonry.
   */
  const islandDrop = halfFlue + wallT + P.islandInset;
  const islandW = C.form.width - (ductInset + islandDrop) * 2;
  const islandD = C.form.depth - (ductInset + islandDrop) * 2;

  const channelHalf = P.channelWidth / 2;
  const blockW = (islandW - P.channelWidth) / 2;
  const blockCX = channelHalf + blockW / 2;

  const blockOuter = createLoopPath({
    topology: 'racetrack',
    width: blockW,
    depth: islandD,
    cornerRadius: Math.min(P.blockCornerRadius, blockW / 2, islandD / 2),
  });
  const blockInner = createLoopPath({
    topology: 'racetrack',
    width: blockW - P.blockWallThickness * 2,
    depth: islandD - P.blockWallThickness * 2,
    cornerRadius: Math.max(0.1, P.blockCornerRadius - P.blockWallThickness),
  });

  const soot = () => new THREE.MeshBasicMaterial({
    color: new THREE.Color(PALETTE.soot), side: THREE.DoubleSide,
  });

  for (const sx of [-blockCX, blockCX]) {
    ductGroup.add(new THREE.Mesh(filledPath(blockOuter, Y.flue, sx), masonry));
    // Hollow: each section is a ring, so the inside comes back out again.
    ductGroup.add(new THREE.Mesh(filledPath(blockInner, Y.flue + 0.002, sx), soot()));
    ductGroup.add(new THREE.LineLoop(pathOutline(blockOuter, 0, Y.outline, 240, sx), hairline));
    ductGroup.add(new THREE.LineLoop(pathOutline(blockInner, 0, Y.outline, 240, sx), hairline));
  }

  // ----------------------------------------------------------------- chimney
  // L — the draught that pulls everything through. It stands in the channel,
  // in a circular widening of it, open to the passage on both sides so nothing
  // between the dampers and the flue is obstructed. Invented position.
  const chimneyGroup = componentGroup('chimney');
  root.add(chimneyGroup);

  // The circular void the chimney stands in, cut through both wall sections.
  const voidGeo = new THREE.CircleGeometry(P.chimneyVoidRadius, 48);
  voidGeo.rotateX(-Math.PI / 2);
  chimneyGroup.add(new THREE.Mesh(voidGeo, soot()).translateY(Y.damper + 0.002));
  chimneyGroup.add(new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 48 }, (_, k) => {
        const a = (k / 48) * Math.PI * 2;
        return new THREE.Vector3(
          Math.cos(a) * P.chimneyVoidRadius, Y.outline, Math.sin(a) * P.chimneyVoidRadius,
        );
      }),
    ), hairline,
  ));

  const chimneyGeo = new THREE.CircleGeometry(P.chimneyRadius, 32);
  chimneyGeo.rotateX(-Math.PI / 2);
  const chimney = new THREE.Mesh(chimneyGeo, new THREE.MeshBasicMaterial({
    color: new THREE.Color(PALETTE['soot-raised']), side: THREE.DoubleSide,
  }));
  chimney.position.y = Y.air - 0.005;
  chimneyGroup.add(chimney);
  chimneyGroup.add(new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 32 }, (_, k) => {
        const a = (k / 32) * Math.PI * 2;
        return new THREE.Vector3(
          Math.cos(a) * P.chimneyRadius, Y.outline, Math.sin(a) * P.chimneyRadius,
        );
      }),
    ), hairline,
  ));

  // ----------------------------------------------------------------- dampers
  // L — one per chamber. The open one sits ahead of the fire and pulls the
  // exhaust into the flue. Whether dampers are what workers move every two
  // hours is open question 5.2, so nothing here answers that.
  const damperGroup = componentGroup('dampers');
  root.add(damperGroup);
  const dampers = [];
  for (let i = 0; i < count; i++) {
    const mid = (sStart(i) + sEnd(i)) / 2;
    const half = (sEnd(i) - sStart(i)) * P.damperWidth;

    /**
     * An opening cut through the INNER wall, where a chamber meets the flue —
     * the same shape as the wicket door opposite it, because they are the same
     * kind of thing: a way through a wall. A damper is not an object sitting
     * next to the kiln, which is what a free-floating disc made it look like.
     *
     * Chamber to flue on the inside, chamber to the yard on the outside.
     */
    const m = new THREE.Mesh(
      bandGeometry(path, mid - half, mid + half, -halfBand, -halfBand + inset, Y.wall, 6),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE['sand-dim']) }),
    );
    damperGroup.add(m);
    dampers.push(m);
  }

  // ---------------------------------------------------------------- air path
  // L — counter-current flow. The core Hoffmann principle, and the reason the
  // kiln is shaped like this at all. Not observed here.
  const airGroup = componentGroup('airPath');
  root.add(airGroup);
  const airRibbon = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.95,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  airGroup.add(airRibbon);

  // An outline, because the ribbon is coloured from the same heat ramp as the
  // tiles beneath it and would otherwise melt into them.
  const airEdge = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: new THREE.Color(PALETTE['sand-bright'] ?? PALETTE.sand) }),
  );
  airGroup.add(airEdge);

  // The arrowhead. Without it the ribbon says where the gas is but not which
  // way it is going, and the direction is the whole point of counter-current.
  const airHead = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(PALETTE['heat-1']),
      transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  airGroup.add(airHead);

  /**
   * The airflow arrow: one band crossing the chambers, widening toward the
   * fire and coloured by how hot the gas is along the way.
   *
   * It is drawn as a SINGLE continuous ribbon on purpose. Cool air enters
   * behind the fire, is warmed by chambers that have just fired, feeds the
   * fire, then carries that heat forward over green tiles before it leaves.
   * One pass, two useful jobs — which is the whole Hoffmann idea.
   */
  /**
   * The route the gas takes, as a list of points carrying the temperature of
   * the gas at each one.
   *
   * Out of the yard, in through the wall behind the fire, along the chambers
   * that have just fired, through the fire, on through the chambers being
   * preheated, down through the open damper, along the flue corridor and into
   * the chimney.
   *
   * Temperatures come from engine.gasProfile — the same exchange rule the
   * thermal model runs on. The arrow is drawn FROM the simulation rather than
   * decorated to look like it.
   */
  function airRoute(state) {
    const profile = gasProfile(state);
    const pre = C.windows.preheat;
    const cool = C.windows.cool;
    const ambient = C.temperature.ambientC;
    const ctrl = [];

    const sOf = (k) => ((((state.firePos + k) % count) + count) % count + 0.5) / count;

    // 1. A hooked tail reaching out of the kiln, so the air visibly comes from
    //    the yard rather than appearing inside a wall.
    const entry = path.at(sOf(-cool));
    const tanX = -entry.nz;
    const tanZ = entry.nx;
    for (let k = 3; k >= 1; k--) {
      const u = k / 3;
      const out = halfBand + AIR_TAIL * u;
      const back = -AIR_TAIL * 1.2 * u * u;
      ctrl.push({
        x: entry.x + entry.nx * out + tanX * back,
        z: entry.z + entry.nz * out + tanZ * back,
        t: ambient,
      });
    }

    // 2. Along the chambers, sampling the gas as it travels.
    profile.forEach((g, idx) => {
      const k = idx - cool;
      const s0 = sOf(k) - 0.5 / count;
      const s1 = sOf(k) + 0.5 / count;
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        const p = path.at(s0 + (s1 - s0) * u);
        ctrl.push({ x: p.x, z: p.z, t: g.gasIn + (g.gasOut - g.gasIn) * u });
      }
    });

    // 3. Through the open damper into the corridor.
    const open = ((state.firePos + pre) % count + count) % count;
    const sOpen = (open + 0.5) / count;
    const exhaust = profile[profile.length - 1].gasOut;

    const wall = path.at(sOpen);
    ctrl.push({
      x: wall.x - wall.nx * (halfBand - inset / 2),
      z: wall.z - wall.nz * (halfBand - inset / 2),
      t: exhaust,
    });

    /**
     * 4. Along the corridor to the mouth of the channel, then down the channel
     *    to the chimney.
     *
     * The corridor's s=0 and s=0.5 are the middles of its two long sides,
     * which is where the channel between the two wall sections opens on to it.
     * Taking the nearer mouth keeps the exhaust inside the structure the whole
     * way; heading straight at the chimney would cut across a wall section.
     */
    const junction = Math.abs(((sOpen + 0.5) % 1) - 0.5) < 0.25 ? 0 : 0.5;
    let delta = junction - sOpen;
    if (delta > 0.5) delta -= 1;
    if (delta < -0.5) delta += 1;

    for (let i = 1; i <= 10; i++) {
      const d = ductPath.at(sOpen + delta * (i / 10));
      ctrl.push({ x: d.x, z: d.z, t: exhaust });
    }

    // Down the middle of the channel and in to the chimney.
    const mouth = ductPath.at(junction);
    for (let i = 1; i <= 6; i++) {
      const u = i / 6;
      ctrl.push({ x: mouth.x * (1 - u), z: mouth.z * (1 - u), t: exhaust });
    }

    return ctrl;
  }

  /**
   * Smooth the route into a continuous curve.
   *
   * The control points come from four different sources — a hooked tail, the
   * chamber centreline, a step through the damper, the corridor, the channel —
   * and joining them with straight segments left visible corners at every
   * handover. A centripetal Catmull-Rom runs one curve through all of them,
   * so the gas turns rather than hinges, and the curve cannot overshoot into
   * the walls the way a uniform spline can.
   *
   * Temperature is carried along the same parameter, so colour and width stay
   * attached to the point they belong to.
   */
  /**
   * Round off the genuinely sharp turns before anything else touches the route.
   *
   * Most of the route bends gently — it follows the kiln. But three joins are
   * real corners: stepping in through the damper wall, and turning off the
   * corridor into the channel at either end. A spline fitted straight through
   * those follows them faithfully, corner and all, which is exactly what we do
   * not want. Replacing each with a quadratic arc gives the curve something
   * smooth to follow instead.
   *
   * Only turns past the threshold are touched, so the chamber run — which is
   * already a smooth curve — is left exactly as it is.
   */
  function filletCorners(pts, radius = 0.5, minTurn = 0.45) {
    if (pts.length < 3) return pts;
    const out = [pts[0]];

    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i];
      const a = pts[i - 1];
      const b = pts[i + 1];

      const inX = p.x - a.x; const inZ = p.z - a.z;
      const outX = b.x - p.x; const outZ = b.z - p.z;
      const li = Math.hypot(inX, inZ) || 1;
      const lo = Math.hypot(outX, outZ) || 1;
      const turn = Math.acos(Math.max(-1, Math.min(1,
        (inX * outX + inZ * outZ) / (li * lo))));

      if (turn < minTurn) { out.push(p); continue; }

      const r = Math.min(radius, li * 0.5, lo * 0.5);
      const start = { x: p.x - (inX / li) * r, z: p.z - (inZ / li) * r, t: p.t };
      const end = { x: p.x + (outX / lo) * r, z: p.z + (outZ / lo) * r, t: p.t };

      const ARC = 6;
      for (let k = 0; k <= ARC; k++) {
        const u = k / ARC;
        const m = (1 - u) * (1 - u);
        const c = 2 * (1 - u) * u;
        const e = u * u;
        out.push({
          x: m * start.x + c * p.x + e * end.x,
          z: m * start.z + c * p.z + e * end.z,
          t: p.t,
        });
      }
    }

    out.push(pts[pts.length - 1]);
    return out;
  }

  function smoothRoute(rawCtrl, samples = 320) {
    const ctrl0 = filletCorners(rawCtrl);
    /**
     * Even out the spacing first.
     *
     * The control points arrive from four sources at wildly different
     * densities — roughly 0.4 units apart along the chambers, 0.3 along the
     * corridor, and one lone step through the damper wall. Catmull-Rom through
     * unevenly spaced points pinches at the tight clusters and overshoots at
     * the sparse ones, which is what put a kink at the kiln's corner and a
     * hard elbow where the corridor meets the channel.
     */
    const even = [ctrl0[0]];
    const SPACING = 0.22;
    let carry = 0;
    for (let i = 1; i < ctrl0.length; i++) {
      const a = ctrl0[i - 1];
      const b = ctrl0[i];
      const seg = Math.hypot(b.x - a.x, b.z - a.z);
      if (seg < 1e-9) continue;
      let travelled = carry;
      while (travelled + SPACING <= seg) {
        travelled += SPACING;
        const u = travelled / seg;
        even.push({
          x: a.x + (b.x - a.x) * u,
          z: a.z + (b.z - a.z) * u,
          t: a.t + (b.t - a.t) * u,
        });
      }
      carry = travelled - seg;
    }
    even.push(ctrl0[ctrl0.length - 1]);

    const curve = new THREE.CatmullRomCurve3(
      even.map((p) => new THREE.Vector3(p.x, 0, p.z)), false, 'centripetal', 0.5,
    );
    const ctrl = even;
    const pts = [];
    for (let i = 0; i <= samples; i++) {
      const u = i / samples;
      const v = curve.getPoint(u);

      // Temperature from the control points either side of this sample.
      const f = u * (ctrl.length - 1);
      const a = Math.min(ctrl.length - 1, Math.floor(f));
      const b = Math.min(ctrl.length - 1, a + 1);
      const t = ctrl[a].t + (ctrl[b].t - ctrl[a].t) * (f - a);

      pts.push({ x: v.x, z: v.z, t });
    }
    return pts;
  }

  /**
   * Draw the arrow from a route.
   *
   * WIDTH IS ENERGY. It comes from the gas temperature at each point, so the
   * arrow swells as the gas picks heat up off the chambers that have just
   * fired, is fattest leaving the fire, and visibly thins as the green tiles
   * ahead take that heat back out of it. That thinning is the kiln's whole
   * argument, drawn from the model rather than asserted.
   *
   * Tangents come from consecutive points, not from path.at: the route leaves
   * the chamber centreline to reach the chimney, so there is no `s` to ask.
   */
  function buildAirRibbon(state) {
    const pts = smoothRoute(airRoute(state));
    // Kept for inspection: the console and the checks read this to confirm
    // the arrow's width really does follow the gas temperature.
    lastRoute = pts;
    const positions = [];
    const colours = [];
    const indices = [];
    const edgeA = [];
    const edgeB = [];
    const col = new THREE.Color();
    const AIR = new THREE.Color(PALETTE.air);

    const minW = P.airRibbonWidth * 0.18;
    const maxW = P.airRibbonWidth;

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      let tx = b.x - a.x;
      let tz = b.z - a.z;
      const tl = Math.hypot(tx, tz) || 1;
      tx /= tl; tz /= tl;
      const nx = tz;
      const nz = -tx;

      const h = relativeHeat(p.t);
      const w = (minW + (maxW - minW) * h) / 2;

      heatColour(h, col);
      // The cold end is air, which the palette gives its one cool tone.
      if (h < 0.18) col.lerp(AIR, (0.18 - h) / 0.18);

      const ax = p.x + nx * w; const az = p.z + nz * w;
      const bx = p.x - nx * w; const bz = p.z - nz * w;
      positions.push(ax, Y.air, az, bx, Y.air, bz);
      colours.push(col.r, col.g, col.b, col.r, col.g, col.b);
      edgeA.push([ax, az]);
      edgeB.push([bx, bz]);
      if (i < pts.length - 1) {
        const k = i * 2;
        indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    g.setIndex(indices);
    g.computeBoundingSphere();
    airRibbon.geometry.dispose();
    airRibbon.geometry = g;

    const edgePos = [];
    for (const side of [edgeA, edgeB]) {
      for (let i = 0; i < side.length - 1; i++) {
        edgePos.push(side[i][0], Y.outline, side[i][1],
          side[i + 1][0], Y.outline, side[i + 1][1]);
      }
    }
    airEdge.geometry.dispose();
    airEdge.geometry = new THREE.BufferGeometry()
      .setAttribute('position', new THREE.Float32BufferAttribute(edgePos, 3));

    // The arrowhead is at the CHIMNEY now, pointing in. The exhaust has
    // somewhere to go, which is the end of the story the arrow tells.
    const tip = pts[pts.length - 1];
    const before = pts[pts.length - 6] ?? pts[0];
    let hx = tip.x - before.x;
    let hz = tip.z - before.z;
    const hl = Math.hypot(hx, hz) || 1;
    hx /= hl; hz /= hl;
    const headHalf = P.airRibbonWidth * 0.75;
    const headLen = P.airRibbonWidth * 1.3;
    airHead.geometry.dispose();
    airHead.geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(tip.x + hx * headLen * 0.4, Y.air, tip.z + hz * headLen * 0.4),
      new THREE.Vector3(tip.x - hz * headHalf - hx * headLen * 0.6, Y.air,
        tip.z + hx * headHalf - hz * headLen * 0.6),
      new THREE.Vector3(tip.x + hz * headHalf - hx * headLen * 0.6, Y.air,
        tip.z - hx * headHalf - hz * headLen * 0.6),
    ]);
    airHead.material.color.set(PALETTE['sand-dim']);

    const open = ((state.firePos + C.windows.preheat) % count + count) % count;
    dampers.forEach((d, i) => {
      d.material.color.set(i === open ? PALETTE.air : PALETTE['sand-dim']);
    });
    return open;
  }

  let lastFire = -1;
  let openDamper = 0;
  let lastRoute = [];
  // The arrow's width follows gas temperature, which moves continuously, so it
  // cannot only redraw when the fire does. Rebuilt on a short timer instead —
  // often enough to look live, rarely enough not to churn geometry at 60fps.
  let sinceRibbon = 1e9;
  const RIBBON_REBUILD_MS = 120;

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);

    const b = path.bounds;
    const margin = halfBand + AIR_TAIL + 0.12;
    const halfX = (b.maxX - b.minX) / 2 + margin;
    const halfZ = (b.maxZ - b.minZ) / 2 + margin;
    const aspect = w / h;

    let viewW = halfX * FIT_MARGIN;
    let viewH = halfZ * FIT_MARGIN;
    if (viewW / viewH > aspect) viewH = viewW / aspect;
    else viewW = viewH * aspect;

    camera.left = -viewW; camera.right = viewW;
    // `up` is -Z, so top and bottom are flipped relative to world Z.
    camera.top = -viewH; camera.bottom = viewH;
    camera.updateProjectionMatrix();
  }

  /**
   * Draw the current state. Tiles ease toward the colour of their chamber's
   * relative heat; which chamber is "firing" flips cleanly at the tick,
   * because what physically moves every two hours is unknown (5.2).
   */
  function update(state, dtMs = 16) {
    sinceRibbon += dtMs;
    if (state.firePos !== lastFire || sinceRibbon >= RIBBON_REBUILD_MS) {
      openDamper = buildAirRibbon(state);
      lastFire = state.firePos;
      sinceRibbon = 0;
    }

    // No fire, no draught: nothing is moving through a kiln that has not been
    // lit, so the airflow arrow stays off until it is.
    airGroup.visible = state.phase !== 'charging';

    const tickMs = (state.params.tickSeconds / state.params.speed) * 1000;
    const tau = Math.max(1, (tickMs * SETTLE_FRACTION) / 4);
    const k = 1 - Math.exp(-dtMs / tau);

    for (let i = 0; i < count; i++) {
      const ch = state.chambers[i];
      const seg = segments[i];

      // The tiles carry the temperature — relative, simulated, never degrees.
      heatColour(ch.heat, tileColour);
      const d = Math.abs(tileColour.r - seg.current.r)
        + Math.abs(tileColour.g - seg.current.g)
        + Math.abs(tileColour.b - seg.current.b);
      if (d < SNAP_DISTANCE) seg.current.copy(tileColour);
      else seg.current.lerp(tileColour, k);

      /**
       * Tiles go in and come out one at a time.
       *
       * `fill` walks toward 1 when the chamber is loaded and 0 when it is not,
       * at a steady rate rather than an eased one — stacking is work at a
       * constant pace, not something that accelerates. Tiles were built column
       * by column along the chamber, so revealing them in order reads as a
       * stack growing from one end and being taken down from the other.
       *
       * An empty chamber simply ends up with no tiles, which is how loading
       * and unloading stay visible without any extra device.
       */
      const target = ch.loaded ? 1 : 0;
      const fillRate = dtMs / Math.max(1, tickMs * C.parts.tileFillFraction);

      /**
       * Nobody stacks a chamber that is alight, or one still cooling with its
       * fired load inside. Those are full, finished, and not to be worked on.
       *
       * This matters when someone steps faster than the crew can work: the
       * engine has already loaded the chamber, but the animation would still
       * be part-way through, and tiles would appear to arrive in a chamber
       * that is burning — the exact thing the charging phase fixed.
       */
      const sealed = ch.loaded && (ch.stage === 'fire' || ch.stage === 'cool');
      if (sealed) seg.fill = 1;
      else if (seg.fill < target) seg.fill = Math.min(target, seg.fill + fillRate);
      else if (seg.fill > target) seg.fill = Math.max(target, seg.fill - fillRate);

      const stack = tileMeshes[i];
      const placed = Math.round(seg.fill * stack.length);
      for (let n = 0; n < stack.length; n++) {
        stack[n].visible = n < placed;
        stack[n].material.color.copy(seg.current);
      }

      // The void stays dark so an empty chamber still reads as a chamber.
      seg.material.color.set(ch.loaded ? PALETTE.soot : PALETTE[STAGE_COLOUR.empty.key]);

      /**
       * Fuel only goes into the chamber that is burning, so its holes are the
       * ones that read. They are drawn black: against the one chamber on the
       * page that is bright red, a dark opening is the strongest mark
       * available, and a hole punched through a roof is a dark thing anyway.
       *
       * Elsewhere the holes sit on a dark chamber, so there the rim does the
       * work and the fill stays near the background.
       */
      const lit = ch.stage === 'fire';
      stokeHoles[i].forEach(({ disc, ring }) => {
        /**
         * Only the chamber being stoked gets a filled hole. Everywhere else
         * the ring alone marks the opening.
         *
         * The fill used to be `soot-raised` when unlit, picked to sit near the
         * background back when a chamber was a dark void. Chambers now carry
         * brightly coloured tiles, so that near-black fill read as just as
         * solid as the lit one and every chamber looked like it was burning.
         * Not drawing it at all is both clearer and more honest.
         */
        disc.visible = lit;
        ring.material.color.set(lit ? PALETTE.soot : PALETTE['sand-dim']);
      });

      // A bricked-up door is solid; an empty chamber stands open.
      wickets[i].material.color.set(ch.loaded ? PALETTE['sand-dim'] : PALETTE.soot);
    }

    render();
  }

  function render() {
    renderer.render(scene, camera);
  }

  /** Where each label should point. Positions move with the fire. */
  function anchors(state) {
    const pre = C.windows.preheat;
    const cool = C.windows.cool;
    const edge = halfBand + 0.3;
    const at = (i, off = 0) => {
      const s = (((((i % count) + count) % count)) + 0.5) / count;
      const p = path.at(s);
      return new THREE.Vector3(p.x + p.nx * off, Y.air, p.z + p.nz * off);
    };

    return [
      { id: 'chimney', pos: new THREE.Vector3(0, Y.air, 0) },
      { id: 'flueDuct', pos: (() => { const d = ductPath.at(0.25); return new THREE.Vector3(d.x, Y.air, d.z); })() },
      // The opening sits in the inner wall, so the label points at the wall,
      // not at the mesh origin — a band mesh keeps its vertices in world space
      // and its own position stays at (0,0,0).
      { id: 'dampers', pos: at(openDamper, -(halfBand - inset / 2)) },
      { id: 'stokeHoles', pos: at(state.firePos, -edge) },
      { id: 'tiles', pos: at(state.firePos + pre + 1, edge) },
      { id: 'wicketDoors', pos: at(state.firePos + cool + 3, -edge) },
      { id: 'zoneFire', pos: at(state.firePos, edge) },
      { id: 'zonePreheat', pos: at(state.firePos + Math.ceil(pre / 2), edge) },
      { id: 'zoneCool', pos: at(state.firePos - cool, -edge) },
      // Where the tail actually reaches, not a chamber short of it.
      { id: 'airIn', pos: at(state.firePos - cool, edge + AIR_TAIL * 0.7) },
    ];
  }

  /**
   * Drag the kiln to move time (brief section 3: the loop IS the time control).
   *
   * One eighth of a turn is one chamber is one tick is two hours, and it snaps
   * — you cannot stand between ticks. Dragging the way the fire travels moves
   * time forward.
   *
   * Pointer to world goes through `unproject`, not hand-rolled maths: this
   * camera has an inverted frustum (see the note where it is built) and
   * anything that assumes a normal one comes out mirrored.
   */
  function attachScrub(getState, dispatch, history) {
    let dragging = false;
    let startTick = 0;
    let lastAngle = 0;
    let turned = 0;                     // radians accumulated, sign included

    const angleAt = (ev) => {
      const rect = canvas.getBoundingClientRect();
      const ndcX = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
      const p = new THREE.Vector3(ndcX, ndcY, 0).unproject(camera);
      return Math.atan2(p.z, p.x);
    };

    canvas.addEventListener('pointerdown', (ev) => {
      const state = getState();
      // Nothing to scrub to before the kiln is lit, and a standing fork is a
      // question waiting to be answered — neither should be draggable past.
      if (state.phase === 'charging' || state.fork) return;

      dragging = true;
      startTick = state.tick;
      lastAngle = angleAt(ev);
      turned = 0;
      canvas.setPointerCapture?.(ev.pointerId);
      canvas.classList.add('is-scrubbing');
    });

    canvas.addEventListener('pointermove', (ev) => {
      if (!dragging) return;

      const a = angleAt(ev);
      let delta = a - lastAngle;
      // Unwrap across the +/-pi seam, or one step would read as a full turn.
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      lastAngle = a;
      turned += delta;

      const perTick = (Math.PI * 2) / count;
      // SCRUB_SIGN carries the drag direction; see the constant for why it is
      // settled by looking at the screen rather than by reasoning.
      const ticks = Math.round((turned * SCRUB_SIGN) / perTick);

      // Scrubbing can only move through what was recorded: there is no future
      // to drag into, and nothing before the kiln was lit.
      const last = history.lastTick;
      const target = Math.max(0, Math.min(last, startTick + ticks));
      dispatch({ type: 'scrubTo', tick: target });
    });

    const end = (ev) => {
      if (!dragging) return;
      dragging = false;
      canvas.releasePointerCapture?.(ev.pointerId);
      canvas.classList.remove('is-scrubbing');
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  function dispose() {
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    renderer.dispose();
  }

  resize();
  render();        // the arrow needs engine state, so it waits for update()

  return {
    update, resize, dispose, render, anchors, attachScrub,
    get lastRoute() { return lastRoute; },
    segments, path, ductPath, scene, camera, renderer, tileMeshes,
    groups: {
      massGroup, chambersGroup, tilesGroup, wallsGroup, wicketGroup,
      stokeGroup, ductGroup, chimneyGroup, damperGroup, airGroup,
    },
  };
}
