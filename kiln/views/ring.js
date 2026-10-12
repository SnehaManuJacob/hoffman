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
import { createLoopPath } from './kilnPath.js';

const SETTLE_FRACTION = 0.3;
const SNAP_DISTANCE = 0.01;

/**
 * The heat ramp, as a lookup from relative heat: cold clay at 0, through pale
 * yellow and amber, to red at the fire. See style.css for why this runs the
 * opposite way to real incandescence.
 */
const RAMP = ['sand-faint', 'heat-0', 'heat-1', 'heat-2', 'heat-3', 'heat-4']
  .map((k) => new THREE.Color(PALETTE[k]));

let warnedAboutHeat = false;

function heatColour(h, out = new THREE.Color()) {
  /**
   * A chamber arriving without a heat value must not take the whole page down.
   * An undefined or NaN `h` makes the ramp index NaN, RAMP[NaN] is undefined,
   * and three.js then throws inside Color.copy — which kills the draw loop and
   * freezes everything, for one missing number.
   *
   * Fall back to cold and say so once. Seen in the wild when a stale cached
   * engine.js was paired with a current view, so the field did not exist yet.
   */
  if (!Number.isFinite(h)) {
    if (!warnedAboutHeat) {
      warnedAboutHeat = true;
      console.warn(
        '[ring] chamber.heat is missing or not a number — drawing it cold. '
        + 'If the kiln looks dead, hard-reload: this usually means a stale '
        + 'cached engine.js is running against a newer view.',
      );
    }
    h = 0;
  }

  const t = Math.max(0, Math.min(1, h)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.max(0, Math.floor(t)));
  return out.copy(RAMP[i]).lerp(RAMP[i + 1], t - i);
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
  const ductInset = halfBand + 0.5;
  const ductPath = createLoopPath({
    topology: C.form.topology,
    width: C.form.width - ductInset * 2,
    depth: C.form.depth - ductInset * 2,
    cornerRadius: Math.max(0.4, C.form.cornerRadius - ductInset * 0.5),
  });
  const ductGroup = componentGroup('flueDuct');
  root.add(ductGroup);
  ductGroup.add(new THREE.Mesh(
    bandGeometry(ductPath, 0, 1, -P.flueWidth / 2, P.flueWidth / 2, Y.flue, 240),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE['soot-raised']) }),
  ));
  ductGroup.add(new THREE.LineSegments(
    bandOutline(ductPath, 0, 1, -P.flueWidth / 2, P.flueWidth / 2, Y.outline, 240),
    new THREE.LineBasicMaterial({ color: new THREE.Color(PALETTE['sand-faint']) }),
  ));

  // ----------------------------------------------------------------- chimney
  // L — the draught that pulls everything through. Invented position.
  const chimneyGroup = componentGroup('chimney');
  root.add(chimneyGroup);
  const chimneyGeo = new THREE.CircleGeometry(P.chimneyRadius, 28);
  chimneyGeo.rotateX(-Math.PI / 2);
  const chimney = new THREE.Mesh(chimneyGeo, new THREE.MeshBasicMaterial({
    color: new THREE.Color(PALETTE['soot-raised']), side: THREE.DoubleSide,
  }));
  chimney.position.y = Y.damper;
  chimneyGroup.add(chimney);
  chimneyGroup.add(new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 28 }, (_, k) => {
        const a = (k / 28) * Math.PI * 2;
        return new THREE.Vector3(
          Math.cos(a) * P.chimneyRadius, Y.outline, Math.sin(a) * P.chimneyRadius,
        );
      }),
    ),
    new THREE.LineBasicMaterial({ color: new THREE.Color(PALETTE['sand-dim']) }),
  ));

  // ----------------------------------------------------------------- dampers
  // L — one per chamber. The open one sits ahead of the fire and pulls the
  // exhaust into the flue. Whether dampers are what workers move every two
  // hours is open question 5.2, so nothing here answers that.
  const damperGroup = componentGroup('dampers');
  root.add(damperGroup);
  const damperGeo = new THREE.CircleGeometry(P.damperRadius, 14);
  damperGeo.rotateX(-Math.PI / 2);
  const dampers = [];
  for (let i = 0; i < count; i++) {
    const mid = (sStart(i) + sEnd(i)) / 2;
    const { x, z, nx, nz } = path.at(mid);
    const m = new THREE.Mesh(damperGeo, new THREE.MeshBasicMaterial({
      color: new THREE.Color(PALETTE['sand-faint']), side: THREE.DoubleSide,
    }));
    m.position.set(x - nx * (halfBand + 0.2), Y.damper, z - nz * (halfBand + 0.2));
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
  function buildAirRibbon(firePos) {
    const pre = C.windows.preheat;
    const cool = C.windows.cool;
    const from = (firePos - cool - 0.5) / count;
    const to = (firePos + pre + 0.5) / count;
    const STEPS = 170;

    const positions = [];
    const colours = [];
    const indices = [];
    const edgeA = [];
    const edgeB = [];
    const col = new THREE.Color();
    const AIR = new THREE.Color(PALETTE.air);
    const atFire = (cool + 0.5) / (cool + pre + 1);

    for (let i = 0; i <= STEPS; i++) {
      const u = i / STEPS;
      const { x, z, nx, nz } = path.at(from + (to - from) * u);

      // Narrow where air comes in, widest at the fire, tapering as the
      // chambers ahead take the heat back out of it.
      const w = (P.airRibbonWidth / 2) * (0.28 + 0.72 * Math.sin(Math.PI * Math.min(1, u * 1.1)));

      const h = u < atFire
        ? (u / atFire) * 0.92
        : 0.92 - ((u - atFire) / (1 - atFire)) * 0.78;
      heatColour(h, col);

      // The cold end is air, not a dull ember, so it takes the one cool tone
      // the palette reserves for air. It warms into the heat ramp from there.
      if (h < 0.18) col.lerp(AIR, (0.18 - h) / 0.18);

      const ax = x + nx * w; const az = z + nz * w;
      const bx = x - nx * w; const bz = z - nz * w;

      positions.push(ax, Y.air, az, bx, Y.air, bz);
      colours.push(col.r, col.g, col.b, col.r, col.g, col.b);
      edgeA.push([ax, az]);
      edgeB.push([bx, bz]);
      if (i < STEPS) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    g.setIndex(indices);
    g.computeBoundingSphere();
    airRibbon.geometry.dispose();
    airRibbon.geometry = g;

    // Outline down both flanks.
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

    // Arrowhead at the exit, pointing the way the gas leaves.
    const tipAt = path.at(to);
    const justBefore = path.at(to - 0.004);
    let tx = tipAt.x - justBefore.x;
    let tz = tipAt.z - justBefore.z;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl; tz /= tl;
    const headHalf = P.airRibbonWidth * 1.05;
    const headLen = P.airRibbonWidth * 1.7;
    airHead.geometry.dispose();
    airHead.geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(tipAt.x + tx * headLen, Y.air, tipAt.z + tz * headLen),
      new THREE.Vector3(tipAt.x + tipAt.nx * headHalf, Y.air, tipAt.z + tipAt.nz * headHalf),
      new THREE.Vector3(tipAt.x - tipAt.nx * headHalf, Y.air, tipAt.z - tipAt.nz * headHalf),
    ]);

    const open = (((firePos + pre) % count) + count) % count;
    dampers.forEach((d, i) => {
      d.material.color.set(i === open ? PALETTE.air : PALETTE['sand-faint']);
      d.scale.setScalar(i === open ? 1.5 : 1);
    });
    return open;
  }

  let lastFire = -1;
  let openDamper = 0;

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);

    const b = path.bounds;
    const halfX = (b.maxX - b.minX) / 2 + halfBand + 0.25;
    const halfZ = (b.maxZ - b.minZ) / 2 + halfBand + 0.25;
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
    if (state.firePos !== lastFire) {
      openDamper = buildAirRibbon(state.firePos);
      lastFire = state.firePos;
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
        disc.material.color.set(lit ? PALETTE.soot : PALETTE['soot-raised']);
        ring.material.color.set(lit ? PALETTE.soot : PALETTE['sand-faint']);
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
      { id: 'dampers', pos: (() => { const d = dampers[openDamper]; return new THREE.Vector3(d.position.x, Y.air, d.position.z); })() },
      { id: 'stokeHoles', pos: at(state.firePos, -edge) },
      { id: 'tiles', pos: at(state.firePos + pre + 1, edge) },
      { id: 'wicketDoors', pos: at(state.firePos + cool + 3, -edge) },
      { id: 'zoneFire', pos: at(state.firePos, edge) },
      { id: 'zonePreheat', pos: at(state.firePos + Math.ceil(pre / 2), edge) },
      { id: 'zoneCool', pos: at(state.firePos - cool, -edge) },
      { id: 'airIn', pos: at(state.firePos - cool - 1, edge) },
    ];
  }

  function dispose() {
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    renderer.dispose();
  }

  resize();
  buildAirRibbon(0);
  render();

  return {
    update, resize, dispose, render, anchors,
    segments, path, ductPath, scene, camera, renderer, tileMeshes,
    groups: {
      massGroup, chambersGroup, tilesGroup, wallsGroup, wicketGroup,
      stokeGroup, ductGroup, chimneyGroup, damperGroup, airGroup,
    },
  };
}
