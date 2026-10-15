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
import { relativeHeat, gasCurve, gasAt } from '../engine.js';
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

/**
 * A flat band between two normal offsets, at height y.
 *
 * UVs are in BAND SPACE and world units: u is arc length along the kiln, v is
 * the offset across it. Two consequences worth the two lines it costs.
 *
 * Any two bands built from the same path tile continuously against each other,
 * because both are measuring the same kiln rather than each normalising to
 * itself. That is what lets the six separate tiles of an end row carry one
 * unbroken hatch while each still clips its own slice.
 *
 * And a texture's `repeat` is then a real distance, so stripe spacing can be a
 * number in config.js with a meaning rather than a figure tuned by eye.
 *
 * Unused by every other component here: MeshBasicMaterial without a map ignores
 * the attribute entirely.
 */
function bandGeometry(path, s0, s1, offInner, offOuter, y, steps = 40) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const arc = path.totalLength ?? 1;
  for (let i = 0; i <= steps; i++) {
    const s = s0 + (s1 - s0) * (i / steps);
    const { x, z, nx, nz } = path.at(s);
    positions.push(x + nx * offInner, y, z + nz * offInner);
    positions.push(x + nx * offOuter, y, z + nz * offOuter);
    uvs.push(s * arc, offInner, s * arc, offOuter);
  }
  for (let i = 0; i < steps; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}

/**
 * A repeating stripe, drawn into a canvas rather than loaded from a file so the
 * exhibition laptop needs no network and the repo needs no binary asset.
 *
 * The stripes are drawn VERTICAL and turned by `texture.rotation`, not drawn at
 * an angle. Drawing a diagonal into a square and repeating it only tiles without
 * a seam at exactly 45 degrees; rotating the sampling coordinates of a pattern
 * that varies in one axis gives parallel stripes at ANY angle with no seam at
 * all, from a smaller texture.
 *
 * Mipmaps and anisotropy are not optional here: these end up around three pixels
 * wide on screen, and without them they crawl and shimmer as the kiln animates.
 */
function stripeTexture(renderer, { texturePx, thickness, angleDeg }) {
  const canvas = document.createElement('canvas');
  canvas.width = texturePx;
  canvas.height = texturePx;
  const ctx = canvas.getContext('2d');

  // White where the stripe is, transparent elsewhere. The material's colour
  // does the tinting, so one texture could serve any number of marks.
  ctx.clearRect(0, 0, texturePx, texturePx);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, Math.round(texturePx * thickness), texturePx);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.center.set(0.5, 0.5);
  tex.rotation = (angleDeg * Math.PI) / 180;
  return tex;
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

/**
 * Parts whose SHAPE and whose COLOUR come from different places.
 *
 * A tile stack is an assumption — how tiles are stacked at Kundapur was not
 * seen — but the colour on it is the thermal model's own output, and so are
 * the airflow arrow's brightness and thickness. One part, two provenances, and
 * the legend has to say both or it reports that nothing on screen is
 * simulated, on a page whose most eye-catching feature is a simulated colour.
 *
 * `chambers` is deliberately NOT here, and it is the easy mistake. The heat
 * looks like it is in the chambers, but it is painted on the tiles inside
 * them; the chamber group's own colours are the dark void and the
 * empty-chamber fill, which are structural. Listing it would have the legend
 * report that the one part of the drawing actually counted at Kundapur is
 * showing a simulated colour.
 */
export const SIMULATED_COLOUR = {
  tiles: 'S',
  airPath: 'S',
};

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
    masonry: 0, floor: 0.01, tiles: 0.02, tileHatch: 0.025, wall: 0.03,
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
      // Whether the tiles ON SCREEN have been through the fire. Latched — see
      // the update loop for why it cannot just read `chamber.fired`.
      baked: false,
    });
  }

  // ------------------------------------------------------------------- tiles
  // A — the stack is a stand-in. How many tiles a chamber holds, and how they
  // are stacked, is unknown (section 4, tag U). What matters is that they do
  // NOT move: the fire comes to them.
  const tilesGroup = componentGroup('tiles');
  root.add(tilesGroup);
  const tileMeshes = [];
  const tileHatches = [];
  const tileColour = new THREE.Color();

  /**
   * The mark on a load that has been through the fire.
   *
   * Without it the kiln never shows the thing it is FOR. A chamber cooling with
   * a finished load and one preheating with fresh green tiles are drawn from
   * the same ramp, so at the moment they happen to be the same temperature they
   * are the same picture — and the tiles going in raw and coming out baked, the
   * whole product of the place, is invisible.
   *
   * One texture and one material for every overlay in the kiln. The stripes are
   * phased in band space (see bandGeometry), so the six tiles of an end row line
   * up into one continuous hatch while each clips its own slice — which is what
   * keeps the mark disappearing tile by tile as a chamber is unloaded.
   *
   * A — a drawing convention for "this load is baked", not a picture of what a
   * fired Mangalore tile looks like.
   */
  const hatchTexture = stripeTexture(renderer, P.tileHatch);
  const hatchMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(PALETTE.soot),
    map: hatchTexture,
    transparent: true,
    opacity: P.tileHatch.opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  // World units: the repeat is a real stripe spacing, not a figure tuned by eye.
  hatchTexture.repeat.set(1 / P.tileHatch.period, 1 / P.tileHatch.period);

  for (let i = 0; i < count; i++) {
    const perChamber = [];
    const perChamberHatch = [];
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

        // The fired mark, on exactly the tile's own footprint so it is clipped
        // to that tile and goes when the tile goes.
        const h = new THREE.Mesh(
          bandGeometry(path, t0, t1, o0, o1, Y.tileHatch, 4),
          hatchMaterial,
        );
        h.visible = false;
        tilesGroup.add(h);
        perChamberHatch.push(h);
      }
    }
    tileMeshes.push(perChamber);
    tileHatches.push(perChamberHatch);
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

  /**
   * These three are redrawn in place every frame — the arrow's width follows
   * the heat in the gas — so their bounding spheres are stale the moment they
   * are computed, and a stale sphere is how a mesh gets culled while it is
   * plainly on screen. The whole kiln is always in frame, so there is nothing
   * for culling to save here anyway.
   */
  for (const m of [airRibbon, airEdge, airHead]) m.frustumCulled = false;

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
        pos: a.pos + (b.pos - a.pos) * t,
        spentShape: a.spentShape + (b.spentShape - a.spentShape) * t,
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
        let sx = 0; let sz = 0; let sh = 0; let sp = 0;
        for (let k = -r; k <= r; k++) {
          sx += pts[i + k].x; sz += pts[i + k].z;
          sh += pts[i + k].pos; sp += pts[i + k].spentShape;
        }
        const n = r * 2 + 1;
        return { x: sx / n, z: sz / n, pos: sh / n, spentShape: sp / n };
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

  const AIR = new THREE.Color(PALETTE.air);
  const AIR_SPENT = new THREE.Color(PALETTE['air-spent']);
  const gasCol = new THREE.Color();
  const coolTone = new THREE.Color();

  /**
   * The colour of the gas, from its relative heat and how spent it is. ONE
   * function, so the ribbon and the arrowhead cannot disagree — they did,
   * because the head was coloured straight off the heat ramp while the ribbon
   * was blended towards the air tone, and the two met as a grey line ending in
   * a tan triangle.
   */
  function gasColour(h, spent, out) {
    heatColour(h, out);
    coolTone.copy(AIR).lerp(AIR_SPENT, spent);
    // Cold gas leaves the heat ramp for the air tone; spent gas goes further
    // still, towards grey, however little heat it has left.
    const t = Math.max((0.18 - h) / 0.18, spent * P.airSpentBlend);
    if (t > 0) out.lerp(coolTone, Math.min(1, t));
    return out;
  }

  /**
   * Half the arrow's width where the gas carries `h` relative heat.
   *
   * The heat a gas stream carries past a point is its mass times how far above
   * ambient it is. The mass is one constant in this model, so relative carried
   * energy IS `relativeHeat` — the number the colour already uses, and the one
   * the tiles are drawn from. There is nothing further to compute, and a
   * `gasEnergy()` returning the same value under another name would only look
   * like rigour.
   *
   * PROPORTIONAL to that, with a floor rather than a blend from it. Blending
   * `min + (max - min) * h` would compress the whole range and quietly draw
   * cold air as though it carried a third of the fire's heat.
   *
   * The floor arrives SOFTLY. A plain `Math.max` leaves a crease where the
   * clamp lets go — measured as the second-largest kink in the whole ribbon,
   * right in the stretch where the arrow is supposed to be visibly growing.
   * This is the standard smooth maximum: far above the floor it is exactly
   * proportional, far below it is exactly the floor, and in between it turns
   * a corner into an arc.
   */
  function gasHalfWidth(h) {
    const over = P.airWidthMax * h - P.airWidthMin;
    const k = P.airWidthSoftness;
    return (P.airWidthMin + (over + Math.sqrt(over * over + k * k)) / 2) / 2;
  }

  /**
   * Draw the airflow arrow from the gas the engine actually computed: its
   * colour AND its thickness, which are the same number said twice.
   *
   * Runs every frame; the centreline underneath it does not. The view decides
   * nothing about temperature here — it reads degrees, converts them with the
   * engine's own `relativeHeat`, and hands them to the same ramp the tiles
   * use. The arrow and the chamber it crosses are now the same number.
   *
   * Everything is written in place. Rebuilding four buffers a frame would
   * churn the heap for a line whose shape has not moved.
   */
  function updateAirRibbon(profile) {
    if (!airRoute || !profile || !profile.length) return;
    const { route, posAttr, colourAttr, edgeAttr, headAttr } = airRoute;

    // The model's values, joined smoothly. Built once, sampled per vertex.
    const curve = gasCurve(profile);

    /**
     * How spent the exhaust is: the share of its heat the gas gave up between
     * the fire and the damper. Derived, not assumed — with recovery off it
     * gives up nothing, this is 0, and the tail stays as red as the fire.
     */
    const peak = relativeHeat(Math.max(...profile.map((g) => g.outC)));
    const exit = relativeHeat(profile[profile.length - 1].outC);
    const spentMax = peak > 0 ? Math.max(0, 1 - exit / peak) : 0;

    const pos = posAttr.array;
    const col = colourAttr.array;
    const edge = edgeAttr.array;
    let tipHalf = 0;

    for (let i = 0; i < route.length; i++) {
      const p = route[i];
      const h = relativeHeat(gasAt(curve, p.pos));
      const w = gasHalfWidth(h);
      if (i === route.length - 1) tipHalf = w;

      const ax = p.x + p.nx * w; const az = p.z + p.nz * w;
      const bx = p.x - p.nx * w; const bz = p.z - p.nz * w;

      const k = i * 6;
      pos[k] = ax; pos[k + 1] = Y.air; pos[k + 2] = az;
      pos[k + 3] = bx; pos[k + 4] = Y.air; pos[k + 5] = bz;

      gasColour(h, p.spentShape * spentMax, gasCol);
      col[k] = gasCol.r; col[k + 1] = gasCol.g; col[k + 2] = gasCol.b;
      col[k + 3] = gasCol.r; col[k + 4] = gasCol.g; col[k + 5] = gasCol.b;
    }

    /**
     * The outline traces the two edges the band just landed on, so it is read
     * back out of the positions above rather than recomputed. Line segments
     * come in pairs: side A's runs fill the first half of the buffer, side B's
     * the second.
     */
    const segs = route.length - 1;
    for (let i = 0; i < segs; i++) {
      const here = i * 6;
      const next = (i + 1) * 6;
      for (const [side, base] of [[0, 0], [3, segs * 6]]) {
        const e = base + i * 6;
        edge[e] = pos[here + side]; edge[e + 1] = Y.outline; edge[e + 2] = pos[here + side + 2];
        edge[e + 3] = pos[next + side]; edge[e + 4] = Y.outline; edge[e + 5] = pos[next + side + 2];
      }
    }

    posAttr.needsUpdate = true;
    colourAttr.needsUpdate = true;
    edgeAttr.needsUpdate = true;

    // --- the arrowhead, which grows with the ribbon it finishes ------------
    const tip = route[route.length - 1];
    const prev = route[route.length - 2];
    let tx = tip.x - prev.x;
    let tz = tip.z - prev.z;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl; tz /= tl;
    /**
     * Capped against the chimney. At full heat the ribbon is wide enough that
     * a head scaled straight off it would reach 0.71 into a chimney of radius
     * 0.46 and come out the far side.
     */
    const headLen = Math.min(tipHalf * 3.4, P.chimneyRadius);
    const headHalf = headLen * (2.1 / 3.4);
    const head = headAttr.array;
    head[0] = tip.x + tx * headLen; head[1] = Y.air; head[2] = tip.z + tz * headLen;
    head[3] = tip.x + tz * headHalf; head[4] = Y.air; head[5] = tip.z - tx * headHalf;
    head[6] = tip.x - tz * headHalf; head[7] = Y.air; head[8] = tip.z + tx * headHalf;
    headAttr.needsUpdate = true;

    // Literally the ribbon's final colour, so the join is invisible.
    airHead.material.color.copy(
      gasColour(relativeHeat(gasAt(curve, tip.pos)), tip.spentShape * spentMax, gasCol),
    );
  }

  /**
   * The built route, kept so the update pass can redraw it without rebuilding
   * any geometry. The route's SHAPE depends only on where the fire is and
   * which damper is open; the gas inside it, and so the arrow's width and
   * colour, are live.
   */
  let airRoute = null;

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

    /**
     * Each entry is a point on the CENTRE of the route, carrying only what
     * cannot change while the fire stays put:
     *
     *   `pos`        where the gas is on its journey, in CHAMBERS travelled.
     *                The engine's gas profile is one entry per chamber on the
     *                flow path, in the same order, so this indexes straight
     *                into it. Nothing here guesses a temperature.
     *   `spentShape` the 0-1 ramp from fresh air to used-up gas. A shape only:
     *                how far along it the exhaust actually gets is decided by
     *                the model, in updateAirRibbon.
     *
     * No width. The arrow is as thick as the heat the gas is carrying, and
     * that changes every sub-step, so width is decided in the update pass with
     * the colour. What is cached here is the line the gas follows; what is
     * live is everything about the gas itself.
     */
    const route = [];
    const push = (x, z, pos, spentShape = 0) => route.push({ x, z, pos, spentShape });

    // --- 1. in from outside, through the wall ------------------------------
    const ENTRY = 14;
    const turnIn = P.airInletTurn / count;
    for (let i = 0; i <= ENTRY; i++) {
      const t = i / ENTRY;
      const e = t * t * (3 - 2 * t);        // smoothstep, so the turn is not a corner
      const p = path.at(from + e * turnIn);
      const off = (1 - e) * (halfBand + P.airInletLead);
      // Already inside the first chamber by the time the curve straightens, so
      // the gas starts picking up heat here rather than at a hard line.
      push(p.x + p.nx * off, p.z + p.nz * off, e * P.airInletTurn);
    }

    // --- 2. along the chambers: cooling run, fire, preheat run -------------
    /**
     * The whole span from `from` to `to` is exactly (cool + lead + 1) chambers
     * — the length of the flow path — so position in chambers is just how far
     * along that span a point is. That is the entire mapping onto the model.
     */
    const MAIN = 150;
    const spanChambers = cool + lead + 1;
    for (let i = 1; i <= MAIN; i++) {
      const u = i / MAIN;
      const s = from + turnIn + (to - from - turnIn) * u;
      const p = path.at(s);
      push(p.x, p.z, (s - from) * count);
    }

    // --- 3. out through the open damper, into the flue ---------------------
    /**
     * Past the last chamber the model has nothing more to say: it stops at the
     * damper and does not simulate the flue or the chimney. So the tail holds
     * the gas at the temperature it left the kiln at — `spanChambers` is the
     * end of the profile — rather than inventing a cooling curve for it.
     *
     * With heat recovery that exit temperature is low and the tail greys out.
     * Without, the gas reaches the chimney still carrying the fire's heat and
     * the tail stays red the whole way. That contrast is the argument for
     * building a kiln in a loop, and it is now the model making it.
     */
    const OUT = 10;
    const flueOff = halfBand + (ductInset - halfBand) / 2;   // mid-flue
    for (let i = 1; i <= OUT; i++) {
      const t = i / OUT;
      const e = t * t * (3 - 2 * t);
      const p = path.at(to + e * (0.25 / count));
      push(p.x - p.nx * e * flueOff, p.z - p.nz * e * flueOff, spanChambers, e * 0.35);
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
      push(q.x, q.z, spanChambers, 0.35 + 0.45 * t);
    }

    // --- 5. down the channel into the chimney ------------------------------
    const mouthPt = ductPath.at(mouth);
    const dir = Math.sign(mouthPt.z) || 1;                   // which end we came in at
    const stopZ = dir * (P.chimneyRadius + 0.06);
    const DOWN = 24;
    for (let i = 1; i <= DOWN; i++) {
      const t = i / DOWN;
      push(0, mouthPt.z + (stopZ - mouthPt.z) * t, spanChambers, 0.8 + 0.2 * t);
    }

    // --- even the spacing, then round off the joins ------------------------
    const smooth = smoothRoute(
      resampleRoute(route, P.airSmoothSamples),
      P.airSmoothRadius, P.airSmoothPasses,
    );
    route.length = 0;
    route.push(...smooth);

    /**
     * The NORMAL at each point, computed once. It depends only on which way
     * the centreline is heading, and the centreline does not move until the
     * fire does — so the update pass can offset by any width it likes without
     * recomputing any of this.
     */
    for (let i = 0; i < route.length; i++) {
      const a = route[Math.max(0, i - 1)];
      const b = route[Math.min(route.length - 1, i + 1)];
      let dx = b.x - a.x;
      let dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      route[i].nx = dz / len;          // perpendicular to the direction of travel
      route[i].nz = -dx / len;
    }

    // --- allocate the band -------------------------------------------------
    // Positions and colours are both written by updateAirRibbon before
    // anything is drawn. Only the index buffer is final here.
    const indices = [];
    for (let i = 0; i < route.length - 1; i++) {
      const k = i * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position',
      new THREE.BufferAttribute(new Float32Array(route.length * 6), 3));
    g.setAttribute('color',
      new THREE.BufferAttribute(new Float32Array(route.length * 6), 3));
    g.setIndex(indices);
    airRibbon.geometry.dispose();
    airRibbon.geometry = g;

    // Two outlines, one per side, each a strip of segments between
    // consecutive points: 2 sides x (n-1) segments x 2 ends x 3 floats.
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position',
      new THREE.BufferAttribute(new Float32Array((route.length - 1) * 12), 3));
    airEdge.geometry.dispose();
    airEdge.geometry = eg;

    // The arrowhead sits at the CHIMNEY, which is where the gas is going.
    // Three points, rewritten each frame because its size follows the ribbon.
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    airHead.geometry.dispose();
    airHead.geometry = hg;

    /**
     * Keep the route. Everything above is written each frame by
     * updateAirRibbon; none of it is rebuilt until the fire moves.
     */
    airRoute = {
      route: route.slice(),
      posAttr: g.attributes.position,
      colourAttr: g.attributes.color,
      edgeAttr: eg.attributes.position,
      headAttr: hg.attributes.position,
    };

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
    // Every frame, unlike the route: the gas moves while the pipework does not.
    updateAirRibbon(state.gasProfile);

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

      /**
       * Has this load been through the fire?
       *
       * `fired` is set the moment the fire ARRIVES, so the first condition is
       * the decision: the mark lands when the fire moves ON. A chamber under
       * the flame is being fired, not yet fired, and leaving it clean keeps the
       * one burning chamber the simplest brightest thing on the page. The mark
       * appearing as the fire leaves also gives each tick a readable beat —
       * that one is done.
       *
       * LATCHED while a chamber empties, and this part matters. The engine
       * clears `fired` in the same instant it clears `loaded`, which is right —
       * once the load is out there is no load to have been fired. But the tiles
       * still on screen are the finished ones being carried out, over the next
       * two hours of stacking animation. Read straight off `ch.fired` and the
       * mark vanishes the moment unloading begins, so the kiln would show plain
       * tiles leaving at exactly the moment the finished product is the point.
       */
      if (ch.loaded) seg.baked = ch.fired && ch.stage !== 'fire';
      const baked = seg.baked;

      const stack = tileMeshes[i];
      const hatch = tileHatches[i];
      const placed = Math.round(seg.fill * stack.length);
      for (let n = 0; n < stack.length; n++) {
        const shown = n < placed;
        stack[n].visible = shown;
        stack[n].material.color.copy(seg.current);
        // Tied to the tile's own visibility, so unloading takes the mark away
        // one tile at a time instead of leaving it hanging over an empty slot.
        hatch[n].visible = shown && baked;
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

  /** Which components are actually drawn — the legend lists these, not the config. */
  function components() {
    return root.children
      .map((g) => g.userData.component)
      .filter((id, i, all) => id && all.indexOf(id) === i);
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
    update, resize, dispose, render, anchors, attachScrub, components,
    segments, path, ductPath, scene, camera, renderer, tileMeshes, tileHatches,
    groups: {
      massGroup, chambersGroup, tilesGroup, wallsGroup, wicketGroup,
      stokeGroup, ductGroup, islandGroup, chimneyGroup, damperGroup, airGroup,
    },
  };
}
