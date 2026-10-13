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
    // The island fills the middle, inside the duct, so it never overlaps the
    // band geometry — its height only has to sit under the chimney.
    island: 0.035,
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
    const half = (sEnd(i) - sStart(i)) * P.wicketWidthFraction / 2;
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
  /**
   * The flue is drawn as the SPACE, not as a band.
   *
   * It used to be a closed ring of masonry just inside the chamber walls,
   * which was wrong twice over: it read as another wall rather than a way
   * through, and being continuous it sealed the mouth of the island's channel
   * — the one route exhaust has to the chimney.
   *
   * So nothing is drawn here. The flue is the open void between the chamber
   * walls and the island, bounded by both, running all the way round and
   * opening into the channel at top and bottom. The dampers open into it.
   *
   * `ductPath` stays: the label still needs somewhere to point.
   */
  const ductGroup = componentGroup('flueDuct');
  root.add(ductGroup);

  // ------------------------------------------------------------------ island
  // A — the solid middle of the kiln, with a channel cut through it.
  //
  // The channel runs top to bottom and is open at BOTH ends, where it meets
  // the flue duct. That opening is the whole point: it is how exhaust leaving
  // an open damper reaches the chimney at the centre. Without it the chimney
  // would be a circle with no way into it, and the gas would have nowhere to go.
  //
  // What is actually inside the middle of a Kundapur kiln was not seen.
  const islandGroup = componentGroup('kilnIsland');
  root.add(islandGroup);

  const islandHalfW = (C.form.width - ductInset * 2) / 2 - P.flueWidth / 2 - P.islandInset;
  const islandHalfD = (C.form.depth - ductInset * 2) / 2 - P.flueWidth / 2 - P.islandInset;
  const channelHalf = P.channelWidth / 2;

  /**
   * One block of the island. `side` is -1 for the left half, +1 for the right.
   *
   * Built as a Shape rather than a band because it is the only part of the
   * kiln that is not a strip following the loop: it is a slab with a corner
   * radius and a semicircular bite taken out of its inner edge, and the bite
   * is what opens the space around the chimney.
   */
  function islandBlock(side) {
    const r = P.islandCornerRadius;
    const notch = P.chimneyVoidRadius;
    const innerX = side * channelHalf;
    const outerX = side * islandHalfW;
    const hz = islandHalfD;

    const shape = new THREE.Shape();
    shape.moveTo(innerX, -hz);
    shape.lineTo(outerX - side * r, -hz);
    shape.quadraticCurveTo(outerX, -hz, outerX, -hz + r);
    shape.lineTo(outerX, hz - r);
    shape.quadraticCurveTo(outerX, hz, outerX - side * r, hz);
    shape.lineTo(innerX, hz);
    shape.lineTo(innerX, notch);
    // The bite. It curves away from the channel, into the block, so the two
    // blocks together leave a rounded void with the chimney sitting in it.
    shape.absarc(innerX, 0, notch, Math.PI / 2, Math.PI * 1.5, side > 0);
    shape.lineTo(innerX, -hz);
    shape.closePath();
    return shape;
  }

  for (const side of [-1, 1]) {
    const shape = islandBlock(side);

    const geo = new THREE.ShapeGeometry(shape, 24);
    geo.rotateX(-Math.PI / 2);          // shape XY -> kiln XZ
    geo.translate(0, Y.island, 0);
    islandGroup.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: new THREE.Color(PALETTE['soot-raised']), side: THREE.DoubleSide,
    })));

    // An edge, so the masonry reads as a solid rather than a hole in the page.
    const pts = shape.getPoints(24);
    islandGroup.add(new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(
        pts.map((p) => new THREE.Vector3(p.x, Y.outline, -p.y)),
      ),
      new THREE.LineBasicMaterial({ color: new THREE.Color(PALETTE['sand-faint']) }),
    ));
  }

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
  const dampers = [];
  const damperAnchors = [];
  for (let i = 0; i < count; i++) {
    const mid = (sStart(i) + sEnd(i)) / 2;
    const half = (sEnd(i) - sStart(i)) * P.damperWidthFraction / 2;

    /**
     * An opening cut through the INNER wall, built exactly like a wicket door
     * through the outer one — because that is what it is. A damper is the way
     * a chamber connects to the flue, not an object sitting beside the kiln,
     * and drawing it as a floating disc said the wrong thing about it.
     */
    const m = new THREE.Mesh(
      bandGeometry(path, mid - half, mid + half, -halfBand, -halfBand + inset, Y.wall, 6),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(PALETTE['sand-dim']), side: THREE.DoubleSide,
      }),
    );
    damperGroup.add(m);
    dampers.push(m);

    // Band geometry carries its vertices in world space, so the mesh itself
    // sits at the origin. Labels need the opening's real position separately.
    const p = path.at(mid);
    damperAnchors.push(new THREE.Vector3(
      p.x - p.nx * (halfBand - inset / 2), Y.air, p.z - p.nz * (halfBand - inset / 2),
    ));
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

  // The opening in the outer wall that the incoming air comes through.
  const airInlet = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(PALETTE.air), side: THREE.DoubleSide,
    }),
  );
  airGroup.add(airInlet);

  /** Even out a route's point spacing, interpolating width and heat with it. */
  function resampleRoute(route, n) {
    const cum = [0];
    for (let i = 1; i < route.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z));
    }
    const total = cum[cum.length - 1] || 1;
    const out = [];
    let i = 1;
    for (let k = 0; k <= n; k++) {
      const d = (k / n) * total;
      while (i < cum.length - 1 && cum[i] < d) i++;
      const span = cum[i] - cum[i - 1];
      const t = span > 1e-9 ? (d - cum[i - 1]) / span : 0;
      const a = route[i - 1];
      const b = route[i];
      out.push({
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
        w: a.w + (b.w - a.w) * t,
        h: a.h + (b.h - a.h) * t,
        spent: a.spent + (b.spent - a.spent) * t,
      });
    }
    return out;
  }

  /**
   * Round the route off.
   *
   * It is stitched from four differently-shaped pieces — along the chambers,
   * out through the damper, along the flue, down the channel — and the joins
   * between them change direction abruptly. Offsetting a polyline across a
   * sharp corner mitres it into a visible pinch, which looked like plumbing
   * rather than moving air.
   *
   * The window shrinks to nothing at both ends, so the first and last points
   * never move: the air has to keep starting exactly at the kiln's wall and
   * finishing exactly at the chimney.
   */
  function smoothRoute(route, radius, passes) {
    let pts = route;
    for (let pass = 0; pass < passes; pass++) {
      pts = pts.map((p, i) => {
        const r = Math.min(radius, i, pts.length - 1 - i);
        if (r === 0) return { ...p };
        let sx = 0; let sz = 0; let sw = 0; let sh = 0; let sp = 0;
        for (let k = -r; k <= r; k++) {
          sx += pts[i + k].x; sz += pts[i + k].z;
          sw += pts[i + k].w; sh += pts[i + k].h; sp += pts[i + k].spent;
        }
        const n = r * 2 + 1;
        return { x: sx / n, z: sz / n, w: sw / n, h: sh / n, spent: sp / n };
      });
    }
    return pts;
  }

  /** Nearest position along a loop path to a world point, as s in 0..1. */
  function nearestS(loop, x, z) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < 360; i++) {
      const s = i / 360;
      const q = loop.at(s);
      const d = (q.x - x) ** 2 + (q.z - z) ** 2;
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }

  /**
   * The airflow arrow: ONE continuous route, from outside the kiln to the
   * chimney.
   *
   *   outside  ->  in through an opening in the outer wall
   *            ->  along the chambers that have just fired, taking their heat
   *            ->  through the fire, where fuel is added
   *            ->  on over the green tiles, giving that heat up
   *            ->  out through the one open damper
   *            ->  along the flue, round to the channel
   *            ->  down the channel into the chimney
   *
   * Drawn as a single ribbon on purpose: one pass of air does two useful jobs,
   * and that is the whole Hoffmann idea. It used to begin in mid-air at the
   * first cooling chamber and stop dead at the damper, which said neither
   * where the air came from nor where it went.
   *
   * Built from a polyline rather than straight off the path, because the route
   * leaves the chamber loop twice — once coming in through the wall, once
   * going out through the damper into the flue.
   *
   * With `recovery` off the fourth line of that list is cut: a damper at the
   * fire itself takes the gas straight to the chimney, still at full heat. The
   * route gets shorter and — because its colour follows the gas — it stops
   * arriving grey and arrives red instead. That is the whole argument for
   * building a kiln in a loop, made in one picture.
   */
  function buildAirRibbon(firePos, recovery = true) {
    const cool = C.windows.cool;
    // How far past the fire the gas travels before it finds an open damper.
    const lead = recovery ? C.windows.preheat : 0;
    const from = (firePos - cool - 0.5) / count;
    const to = (firePos + lead + 0.5) / count;

    const maxW = P.airRibbonWidth / 2;
    const AIR = new THREE.Color(PALETTE.air);
    const AIR_SPENT = new THREE.Color(PALETTE['air-spent']);
    const col = new THREE.Color();
    const coolTone = new THREE.Color();

    /**
     * The colour of the gas at a point on the route. ONE function, so the
     * ribbon and the arrowhead cannot disagree — they did, because the head
     * was coloured straight off the heat ramp while the ribbon was blended
     * towards the air tone, and the two met as a grey line ending in a tan
     * triangle.
     */
    const gasColour = (p, out) => {
      heatColour(p.h, out);
      coolTone.copy(AIR).lerp(AIR_SPENT, p.spent);
      // Cold gas leaves the heat ramp for the air tone; spent gas goes further
      // still, towards grey, however little heat it has left.
      const t = Math.max((0.18 - p.h) / 0.18, p.spent * P.airSpentBlend);
      if (t > 0) out.lerp(coolTone, Math.min(1, t));
      return out;
    };

    // Each entry is a point on the centre of the route, with the half-width
    // and the gas temperature there.
    const route = [];
    /**
     * `spent` runs 0 for air on its way in to 1 for gas on its way out. It is
     * what lets the two ends read differently: fresh air is the cool blue the
     * palette reserves for air, spent gas is that same tone desaturated.
     */
    const push = (x, z, w, h, spent = 0) => route.push({ x, z, w, h, spent });

    // --- 1. in from outside, through the wall ------------------------------
    const ENTRY = 14;
    const turnIn = P.airInletTurn / count;
    for (let i = 0; i <= ENTRY; i++) {
      const t = i / ENTRY;
      const e = t * t * (3 - 2 * t);        // smoothstep, so the turn is not a corner
      const p = path.at(from + e * turnIn);
      const off = (1 - e) * (halfBand + P.airInletLead);
      push(p.x + p.nx * off, p.z + p.nz * off, maxW * 0.34, 0);
    }

    // --- 2. along the chambers: cooling run, fire, preheat run -------------
    const MAIN = 150;
    const PEAK_H = 0.92;                      // the gas at its hottest, at the fire
    const atFire = (cool + 0.5) / (cool + lead + 1);
    /**
     * How much heat the gas gives up after the fire. With recovery on it spends
     * it on the green tiles ahead and arrives at the chimney nearly cold; with
     * recovery off there are no tiles ahead to spend it on, so it keeps it.
     */
    const drop = recovery ? 0.78 : 0;
    for (let i = 1; i <= MAIN; i++) {
      const u = i / MAIN;
      const s = from + turnIn + (to - from - turnIn) * u;
      const p = path.at(s);
      const w = maxW * (0.34 + 0.66 * Math.sin(Math.PI * Math.min(1, u * 1.08)));
      const h = u < atFire
        ? (u / atFire) * PEAK_H
        : PEAK_H - ((u - atFire) / (1 - atFire)) * drop;
      push(p.x, p.z, w, h);
    }

    // --- 3. out through the open damper, into the flue ---------------------
    const exitH = route[route.length - 1].h;
    /**
     * How spent the gas is on its way out, DERIVED rather than assumed: the
     * fraction of its heat it actually gave up. Spent gas reads grey, gas that
     * kept its heat stays red.
     *
     * This used to be a fixed ramp to 1.0, which was fine while the exhaust was
     * always nearly cold — and would have greyed out the one thing the recovery
     * switch exists to show.
     */
    const spentMax = Math.max(0, 1 - exitH / PEAK_H);
    const exitW = maxW * P.airExhaustScale;
    const OUT = 10;
    const flueOff = halfBand + (ductInset - halfBand) / 2;   // mid-flue
    for (let i = 1; i <= OUT; i++) {
      const t = i / OUT;
      const e = t * t * (3 - 2 * t);
      const p = path.at(to + e * (0.25 / count));
      push(p.x - p.nx * e * flueOff, p.z - p.nz * e * flueOff, exitW, exitH * (1 - 0.15 * e), spentMax * e * 0.35);
    }

    // --- 4. along the flue to the nearer mouth of the channel --------------
    const last = route[route.length - 1];
    const sDuct = nearestS(ductPath, last.x, last.z);
    // The channel opens at the middle of each long side, which is where this
    // loop's s = 0 and s = 0.5 fall.
    const wrap = (d) => ((d % 1) + 1.5) % 1 - 0.5;           // shortest way round
    const mouth = Math.abs(wrap(0 - sDuct)) <= Math.abs(wrap(0.5 - sDuct)) ? 0 : 0.5;
    const span = wrap(mouth - sDuct);
    const FLUE = 60;
    for (let i = 1; i <= FLUE; i++) {
      const t = i / FLUE;
      const q = ductPath.at(sDuct + span * t);
      push(q.x, q.z, exitW, exitH * (0.85 - 0.25 * t), spentMax * (0.35 + 0.45 * t));
    }

    // --- 5. down the channel into the chimney ------------------------------
    const mouthPt = ductPath.at(mouth);
    const dir = Math.sign(mouthPt.z) || 1;                   // which end we came in at
    const stopZ = dir * (P.chimneyRadius + 0.06);
    const DOWN = 24;
    for (let i = 1; i <= DOWN; i++) {
      const t = i / DOWN;
      push(0, mouthPt.z + (stopZ - mouthPt.z) * t, exitW * (1 - 0.15 * t), exitH * 0.6, spentMax * (0.8 + 0.2 * t));
    }

    // --- even the spacing, then round off the joins ------------------------
    const smooth = smoothRoute(
      resampleRoute(route, P.airSmoothSamples),
      P.airSmoothRadius, P.airSmoothPasses,
    );
    route.length = 0;
    route.push(...smooth);

    // --- build the band ----------------------------------------------------
    const positions = [];
    const colours = [];
    const indices = [];
    const edgeA = [];
    const edgeB = [];

    for (let i = 0; i < route.length; i++) {
      const p = route[i];
      const a = route[Math.max(0, i - 1)];
      const b = route[Math.min(route.length - 1, i + 1)];
      let dx = b.x - a.x;
      let dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      const nx = dz;          // perpendicular to the direction of travel
      const nz = -dx;

      gasColour(p, col);

      const ax = p.x + nx * p.w; const az = p.z + nz * p.w;
      const bx = p.x - nx * p.w; const bz = p.z - nz * p.w;
      positions.push(ax, Y.air, az, bx, Y.air, bz);
      colours.push(col.r, col.g, col.b, col.r, col.g, col.b);
      edgeA.push([ax, az]);
      edgeB.push([bx, bz]);
      if (i < route.length - 1) {
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

    // The arrowhead now sits at the CHIMNEY, which is where the gas is going.
    const tip = route[route.length - 1];
    const prev = route[route.length - 2];
    let tx = tip.x - prev.x;
    let tz = tip.z - prev.z;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl; tz /= tl;
    const headHalf = exitW * 2.1;
    const headLen = exitW * 3.4;
    airHead.geometry.dispose();
    airHead.geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(tip.x + tx * headLen, Y.air, tip.z + tz * headLen),
      new THREE.Vector3(tip.x + tz * headHalf, Y.air, tip.z - tx * headHalf),
      new THREE.Vector3(tip.x - tz * headHalf, Y.air, tip.z + tx * headHalf),
    ]);
    // Literally the ribbon's final colour, so the join is invisible.
    airHead.material.color.copy(gasColour(tip, col));

    // --- the opening the air comes in through ------------------------------
    /**
     * Air has to get in somewhere. Without a way through the outer wall the
     * ribbon would still be arriving from nowhere, just further out.
     *
     * It must sit exactly where the ribbon crosses the wall. Putting it half a
     * chamber further on landed it on a DIVIDING WALL between two chambers —
     * an opening cut through a divider, nowhere near the air going through it.
     *
     * The inlet curve carries an offset of (1 - e) * (halfBand + lead), so it
     * is midway through the wall when that equals halfBand - inset/2. Solve
     * for e and the crossing point follows.
     */
    const reach = halfBand + P.airInletLead;
    const eCross = 1 - (halfBand - inset / 2) / reach;
    const inletMid = from + eCross * turnIn;
    const inletHalf = (P.airInletWidthFraction / 2) / count;
    airInlet.geometry.dispose();
    airInlet.geometry = bandGeometry(
      path, inletMid - inletHalf, inletMid + inletHalf,
      halfBand - inset, halfBand, Y.wall, 6,
    );

    /**
     * Only one damper is open: the one that pulls the exhaust into the flue.
     * With heat recovery it sits at the far end of the preheat run, so the gas
     * has to cross every green chamber to reach it. Without, it is the damper
     * at the fire — which is exactly what turning recovery off means in a real
     * kiln: you open a different damper.
     *
     * Open reads in the air tone — the palette reserves that for air, and air
     * is exactly what is going through it. Closed reads as masonry, like a
     * bricked-up wicket.
     *
     * Colour only: these are world-space bands, so scaling one would drag it
     * across the kiln rather than making it bigger.
     */
    const open = (((firePos + lead) % count) + count) % count;
    dampers.forEach((d, i) => {
      d.material.color.set(i === open ? PALETTE.air : PALETTE['sand-dim']);
    });
    return open;
  }

  // The route is rebuilt only when something about it changes. Recovery is part
  // of that key: the switch reroutes the gas, and keying on the fire alone left
  // the old route on screen until the fire next moved.
  let lastRoute = '';
  let openDamper = 0;

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);

    const b = path.bounds;
    // Just the kiln and its wall. The air inlet starts flush at the outer
    // face, so it needs no extra room — asking for some only pulled the camera
    // back and made the kiln smaller.
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
    const recovery = state.params.recovery !== false;
    const routeKey = `${state.firePos}:${recovery}`;
    if (routeKey !== lastRoute) {
      openDamper = buildAirRibbon(state.firePos, recovery);
      lastRoute = routeKey;
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
      { id: 'dampers', pos: damperAnchors[openDamper] },
      { id: 'stokeHoles', pos: at(state.firePos, -edge) },
      { id: 'tiles', pos: at(state.firePos + pre + 1, edge) },
      { id: 'wicketDoors', pos: at(state.firePos + cool + 3, -edge) },
      { id: 'zoneFire', pos: at(state.firePos, edge) },
      { id: 'zonePreheat', pos: at(state.firePos + Math.ceil(pre / 2), edge) },
      { id: 'zoneCool', pos: at(state.firePos - cool, -edge) },
      { id: 'airIn', pos: at(state.firePos - cool - 1, edge) },
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
  buildAirRibbon(0);
  render();

  return {
    update, resize, dispose, render, anchors, attachScrub,
    segments, path, ductPath, scene, camera, renderer, tileMeshes,
    groups: {
      massGroup, chambersGroup, tilesGroup, wallsGroup, wicketGroup,
      stokeGroup, ductGroup, islandGroup, chimneyGroup, damperGroup, airGroup,
    },
  };
}
