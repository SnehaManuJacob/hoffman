/**
 * views/intro.js — the opening sequence.
 *
 * Owns its own three.js scene, camera and renderer on #intro-canvas. This is
 * a VIEW in the same sense ring.js is one (brief section 10: views read state
 * and draw it, they hold no kiln rules) — except what it reads is scroll
 * progress, not engine state, because it has nothing to do with the kiln
 * simulation. engine.js never touches it and it never dispatches an action.
 * It does READ the ring view's geometry and camera (see THE KILN DRAWING), so
 * the drawing it hands off on is the kiln the visitor is about to use.
 *
 * THE BUILDING
 * A real model — the Prabhakar Tile Works compound — built in Blender to
 * match the reference renders (the long signed shed A with its run of hipped
 * Mangalore-tile roofs, the entry porch, the rear sheds and house, laterite
 * compound wall, gate, truck, palms, power line), exported as
 * ./assets/factory.glb, optimised for the web by tools/optimize-models.cjs
 * (re-run it after every re-bake), and loaded through views/models.js, which
 * shares it with the drying story.
 *
 * BAKED, NOT LIT
 * Cycles rendered each surface's colour and lighting into texture atlases,
 * shipped with KHR_materials_unlit; on load every mesh gets a plain
 * MeshBasicMaterial with the same texture. A deliberate exception to brief
 * section 9 for this opening shot only: the establishing view is meant to
 * read as the real place.
 *
 * THE BLUEPRINT PHASE
 * Between the photograph and the kiln diagram sits a drawing, because the
 * question the visitor needs answered at that moment is "where is this
 * kiln?" — inside shed A — and an architectural plan is the image that
 * answers it. Plans are literally horizontal cuts through a building, so the
 * sequence performs one:
 *
 *   1. SCAN — a glowing line sweeps across the compound; behind it the
 *      photograph becomes a line drawing on blueprint paper. Hidden lines are
 *      removed with a depth-only copy of each mesh, so it reads as a drawing
 *      of solid buildings, not a see-through wireframe.
 *   2. CUT — a section plane descends from above the ridges to plan height,
 *      slicing roofs and walls away. Shed A's cut walls are filled solid
 *      (poché), which is how a plan shows what the knife went through.
 *   3. KILN — inside the opened shed, on its floor (the plinth top), the
 *      kiln draws itself round the loop the way the fire travels.
 *   4. DESCEND — the camera straightens to look down and drops until the
 *      drawn kiln is exactly the size and place the ring view draws it.
 *   5. HAND-OFF — the paper dissolves; the live kiln is underneath, line for
 *      line, and the drawing fades last.
 *
 * THE KILN DRAWING
 * Not a second model of the kiln. The outlines and faint fills are built from
 * the ring view's own meshes (ring.scene), mapped into the shed. The ring's
 * camera is mirrored (kiln +Z is screen-UP there, see ring.js), the intro's
 * final camera has world -Z screen-up, so the mapping flips Z. The scale is a
 * drawing decision — the kiln's real footprint at Kundapur is not known
 * (config.js: form.* are all 'A') — set so the kiln fills KILN_FILL of the
 * shed's depth, which keeps the shed's long walls inside the final frame: the
 * last thing seen before the hand-off is the kiln with the building's walls
 * either side of it. It stands at the shed's left end (KILN_END_GAP).
 *
 * THE SHAPE OF THE SEQUENCE — progress 0 -> 1 through #intro's scroll; every
 * phase boundary is in PHASE below.
 */

import * as THREE from 'three';
import { PALETTE } from '../config.js';
import { loadModel, warmTextures } from './models.js';

// Carries this module's own ?v= stamp (set by the import map in index.html),
// so re-baking factory.glb under the same name can't be masked by a cached copy.
const MODEL_URL = './assets/factory.glb' + new URL(import.meta.url).search;

const deg = THREE.MathUtils.degToRad;

// The opening frame (tuned by eye) and the waypoints the camera passes
// through. The END of the move is not here: it is solved each frame from the
// ring's camera so the hand-off lands exactly (see endPose()).
const CAM = {
  startAzimuth: Math.PI * 0.4,
  startElevation: deg(15),
  startRadius: 60,
  startFov: 33,
  lookAtStart: new THREE.Vector3(-1.7, -1.5, 1.4),

  // Over the compound for the scan and the cut: high enough to see the
  // whole compound, tilted enough that the cut reads as a cut.
  riseElevation: deg(50),
  riseRadius: 84,
  riseFov: 30,
  lookAtRise: new THREE.Vector3(0, 1.0, -2),       // the compound's middle

  // Leaning in over shed A while the kiln is drawn.
  cutElevation: deg(62),
  cutRadius: 46,

  // MUST be 0.5 PI: the final camera has world -Z screen-up only from this
  // side, and the kiln mapping below depends on it.
  endAzimuth: Math.PI * 0.50,
  endFov: 28,
};

/**
 * Phase boundaries in scroll progress. Overlaps are deliberate: each move
 * starts before the last one has fully settled, so the camera never stops.
 */
const PHASE = {
  copyOut: [0.00, 0.07],     // the opening question, gone before the orbit gets going
  orbit: [0.00, 0.18],
  rise: [0.12, 0.34],
  scan: [0.32, 0.50],
  photoFade: [0.44, 0.50],   // whatever the scan did not reach (far power line); done before the line snaps away
  cut: [0.50, 0.63],
  lean: [0.50, 0.66],
  kiln: [0.58, 0.75],
  focus: [0.66, 0.84],
  descend: [0.64, 0.88],
  paperOut: [0.88, 0.95],
  linesOut: [0.88, 0.95],
  // Done before the tour's kiln starts to shrink (anatomy.js, LEAD_VH): the two
  // kilns are drawn at the same size only while this one is still on screen.
  kilnOut: [0.90, 0.955],
};

/**
 * THE READING HOLD. Everything in PHASE runs on ANIMATION progress, not
 * scroll. At HOLD.at — the scan finished, the whole compound a drawing, the
 * cut not yet begun — the animation stops for HOLD.share of the scroll while
 * the project statement comes in word by word. Without it the statement sat
 * on screen while the camera kept moving, and was scrolled past unread.
 */
// `zoom`: while the words come in, the camera keeps easing in toward the
// compound by this share of its distance, so the drawing is never frozen.
const HOLD = { at: 0.50, share: 0.25, zoom: 0.18 };
const HOLD_Q = [HOLD.at * (1 - HOLD.share), HOLD.at * (1 - HOLD.share) + HOLD.share];

/** Scroll progress -> animation progress, flat across the hold. */
function animProgress(q) {
  if (q < HOLD_Q[0]) return q / (1 - HOLD.share);
  if (q < HOLD_Q[1]) return HOLD.at;
  return (q - HOLD.share) / (1 - HOLD.share);
}

// Within the hold (scroll progress): the panel fades in, its words light in
// order over most of the hold, and it fades away as the animation resumes.
const BRIEF = {
  in: [HOLD_Q[0] - 0.015, HOLD_Q[0] + 0.01],
  words: [HOLD_Q[0], HOLD_Q[1] - 0.04],
  out: [HOLD_Q[1] - 0.005, HOLD_Q[1] + 0.02],
};

// --- the building, in the GLB's own coordinates (Y-up; Blender -Y is +Z) -----

// Shed A's walls (Blender A_walls: x -24..6, y 0..11, 4.2 high) and the plinth
// top they stand on, which is the shed's floor.
const SHED = { minX: -24, maxX: 6, minZ: -11, maxZ: 0, height: 4.2, wall: 0.3 };
const FLOOR_Y = 0.58;                // plinth top 0.55, plus a hair
const CUT_FROM = 11;                 // above the highest ridge (10 m)
const CUT_TO = 1.2;                  // plan height, as architects cut
const KILN_FILL = 0.88;              // share of the shed's inside depth
// The kiln stands at the shed's LEFT (west) end, this far in from the end
// wall's inside face, not centred: the rest of the shed is left empty.
const KILN_END_GAP = 1.5;

// Meshes that become lines. Greenery, fronds and the power line have no
// useful plan outline; they leave with the photograph.
const DRAWN = ['Web_ground', 'Web_buildings', 'Web_roofs', 'Web_sign', 'Web_compound', 'Web_truck'];
const OCCLUDES = DRAWN.filter((n) => n !== 'Web_ground');

// --- blueprint palette ---------------------------------------------------------
// Warm dark-grey paper with white ink: a blueprint's line-on-ground look
// without its blue. A drawing convention, not a claim, so it lives here
// rather than in config.js.
const INK = {
  paper: new THREE.Color(PALETTE.paper),
  grid: new THREE.Color('#ffffff'),
  line: new THREE.Color('#e4e0da'),
  kiln: new THREE.Color('#ffffff'),
  glow: new THREE.Color('#f3e6d2'),
};

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
const span = (p, [a, b]) => Math.min(1, Math.max(0, (p - a) / (b - a)));
const eased = (p, range) => ease(span(p, range));
const bump = (p, range) => Math.sin(Math.PI * span(p, range));
const lerp = THREE.MathUtils.lerp;

/** Progress through the pinned range: 0 at the top, 1 once scrolled past it. */
function sectionProgress(sectionEl) {
  const scrollable = sectionEl.offsetHeight - window.innerHeight;
  if (scrollable <= 0) return 1;
  const p = -sectionEl.getBoundingClientRect().top / scrollable;
  return Math.min(1, Math.max(0, p));
}

// --- shader injection ------------------------------------------------------------

// One set of uniforms shared by every injected material, so one assignment per
// frame drives them all.
const U = {
  uSweep: { value: 1e4 },          // world X of the scan line; blueprint is x > uSweep
  uGlow: { value: 0 },             // scan-line glow, 0..1
  uFocus: { value: 0 },            // dims lines outside shed A, 0..1
  uReveal: { value: 0 },           // kiln drawn round its loop, 0..1
  uCenter: { value: new THREE.Vector2() },
  uShed: { value: new THREE.Vector4() },   // centre xz, half-size xz
  uGlowColor: { value: INK.glow },
};

const FRAG_HEAD = /* glsl */`
  varying vec3 vW;
  uniform float uSweep, uGlow, uFocus, uReveal;
  uniform vec2 uCenter;
  uniform vec4 uShed;
  uniform vec3 uGlowColor;
`;

const MODE = {
  // The photograph: gone wherever the scan has passed, lit up just behind it.
  photo: /* glsl */`
    if (vW.x > uSweep) discard;
    float e = exp(-(uSweep - vW.x) * 0.9) * uGlow;
    outgoingLight = mix(outgoingLight, uGlowColor, clamp(e, 0.0, 1.0) * 0.85);
  `,
  // Depth-only copies: occlude lines, but only where the drawing exists.
  depth: /* glsl */`
    if (vW.x < uSweep) discard;
  `,
  // Building lines: appear behind the scan, flare as it passes, dim outside
  // shed A once the camera is closing in on it.
  line: /* glsl */`
    if (vW.x < uSweep) discard;
    float e = exp(-(vW.x - uSweep) * 0.45) * uGlow;
    outgoingLight = mix(outgoingLight, vec3(1.0), clamp(e, 0.0, 1.0));
    vec2 q = abs(vW.xz - uShed.xy) - uShed.zw;
    float outside = step(0.0, max(q.x, q.y));
    diffuseColor.a *= mix(1.0, 0.22, uFocus * outside);
  `,
  // The kiln: revealed by angle round its centre, anticlockwise on screen —
  // the way the fire travels in the ring view — with a bright leading edge.
  kiln: /* glsl */`
    float a = atan(-(vW.z - uCenter.y), vW.x - uCenter.x);
    float t = fract(a / 6.2831853 + 0.5);
    if (t > uReveal) discard;
    float lead = (1.0 - smoothstep(0.0, 0.05, uReveal - t)) * step(uReveal, 0.999);
    outgoingLight = mix(outgoingLight, uGlowColor, lead);
    diffuseColor.a = mix(diffuseColor.a, 1.0, lead * 0.6);
  `,
};

function inject(material, mode) {
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vW;\n' + sh.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\n  vW = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    );
    sh.fragmentShader = FRAG_HEAD + sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      MODE[mode] + '\n#include <opaque_fragment>',
    );
  };
  // onBeforeCompile's source is identical for every mode (it is one closure),
  // so without a key three would share one program between all four.
  material.customProgramCacheKey = () => 'intro-' + mode;
  return material;
}

/**
 * The paper: a huge sheet just under the ground. Beige (the same colour as
 * the canvas behind it, so invisible) until the scan passes; then the
 * dark-grey paper with a 1 m and 5 m grid. Drawn first and writing no depth, so the
 * photograph and the lines simply sit on top of it.
 *
 * Opaque on purpose, emitting PREMULTIPLIED colour: at the hand-off its alpha
 * falls to 0 so the ring canvas underneath shows through, and an opaque
 * material writes its alpha straight to the canvas with no blending.
 */
function createPaper(beige) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...U,
      uAlpha: { value: 1 },
      uBeige: { value: beige },
      uBlue: { value: INK.paper },
      uGrid: { value: INK.grid },
    },
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vW;
      uniform float uSweep, uGlow, uAlpha;
      uniform vec3 uBeige, uBlue, uGrid, uGlowColor;
      float grid(vec2 p, float s) {
        vec2 c = p / s;
        vec2 g = abs(fract(c - 0.5) - 0.5) / fwidth(c);
        return 1.0 - min(min(g.x, g.y), 1.0);
      }
      void main() {
        float bp = smoothstep(-0.15, 0.15, vW.x - uSweep);
        vec3 blue = uBlue + uGrid * (grid(vW.xz, 1.0) * 0.06 + grid(vW.xz, 5.0) * 0.14);
        vec3 c = mix(uBeige, blue, bp);
        c = mix(c, uGlowColor, exp(-abs(vW.x - uSweep) * 1.4) * uGlow * 0.9);
        gl_FragColor = vec4(c * uAlpha, uAlpha);
        #include <colorspace_fragment>
      }
    `,
    depthWrite: false,
  });
  const geo = new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -0.03;
  mesh.renderOrder = -10;
  return mesh;
}

/** A closed rectangle as line segments, in the XZ plane at height y. */
function rectLines(minX, maxX, minZ, maxZ, y) {
  const p = [
    minX, y, minZ, maxX, y, minZ,
    maxX, y, minZ, maxX, y, maxZ,
    maxX, y, maxZ, minX, y, maxZ,
    minX, y, maxZ, minX, y, minZ,
  ];
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
}

export function createIntro({ sectionEl, canvas, ring = null, copyEl = null, placeEl = null, briefEl = null, onProgress = null }) {
  // Settles once the factory is in the scene and has been drawn: the moment
  // the splash screen (splash.js) may lift. Settles on a failed load too, so
  // a missing model can never leave the visitor behind the splash.
  let markReady;
  const ready = new Promise((r) => { markReady = r; });

  // The statement's words, each in its own span so scroll can light them in
  // order. The paragraph's text is unchanged for anything reading the DOM.
  const briefWords = [];
  if (briefEl) {
    const words = briefEl.textContent.trim().split(/\s+/);
    briefEl.textContent = '';
    words.forEach((w, i) => {
      const span = document.createElement('span');
      span.className = 'word';
      span.textContent = w;
      briefEl.append(span);
      if (i < words.length - 1) briefEl.append(' ');
      briefWords.push(span);
    });
  }

  // alpha: true, and the clear alpha is animated to 0 at the hand-off — the
  // CANVAS ITSELF has to end up transparent for #ring-canvas to show through.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.localClippingEnabled = true;
  const beige = new THREE.Color(PALETTE.yard);
  const clearColour = beige.clone();
  renderer.setClearColor(clearColour, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAM.startFov, 1, 0.1, 2000);

  // The section plane. Keeps everything BELOW cutY: normal points down.
  const cut = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e4);

  const paper = createPaper(beige);
  scene.add(paper);

  const shedCx = (SHED.minX + SHED.maxX) / 2;
  const shedCz = (SHED.minZ + SHED.maxZ) / 2;
  U.uShed.value.set(shedCx, shedCz, (SHED.maxX - SHED.minX) / 2 + 0.6, (SHED.maxZ - SHED.minZ) / 2 + 0.6);
  U.uCenter.value.set(shedCx, shedCz);

  let building = null;
  const photoMaterials = [];
  const lineMaterials = [];

  loadModel(MODEL_URL, onProgress).then(
    async ({ gltf, meshes, textures }) => {
      const model = gltf.scene;
      const maxAniso = renderer.capabilities.getMaxAnisotropy();

      for (const child of meshes) {
        const src = child.material;
        if (src.map) src.map.anisotropy = maxAniso;
        const photo = inject(new THREE.MeshBasicMaterial({
          map: src.map || null,
          color: src.map ? 0xffffff : (src.color ? src.color.clone() : 0xffffff),
          // palm fronds: alphaMode MASK in the GLB -> alphaTest here, or the
          // leaflet cut-outs render as solid green cards
          alphaTest: src.alphaTest || 0,
          side: src.side,
        }), 'photo');
        child.material = photo;
        photoMaterials.push(photo);

        if (DRAWN.includes(child.name)) {
          const lineMat = inject(new THREE.LineBasicMaterial({
            color: INK.line, transparent: true, opacity: 0.9,
            depthWrite: false, clippingPlanes: [cut],
          }), 'line');
          const lines = new THREE.LineSegments(new THREE.EdgesGeometry(child.geometry, 30), lineMat);
          lines.renderOrder = 2;
          child.add(lines);
          lineMaterials.push(lineMat);
        }
        if (OCCLUDES.includes(child.name)) {
          const depth = new THREE.Mesh(child.geometry, inject(new THREE.MeshBasicMaterial({
            colorWrite: false, side: THREE.DoubleSide, clippingPlanes: [cut],
            polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
          }), 'depth'));
          depth.renderOrder = 1;
          child.add(depth);
        }
      }
      // Textures up a frame apart and shaders compiled off the frame, before
      // the model is shown: drawn straight away, its first frame had to upload
      // every texture at once and froze the opening (views/models.js).
      await warmTextures(renderer, textures);
      try { await renderer.compileAsync(model, camera, scene); } catch { /* compiled on first draw instead */ }
      building = model;
      scene.add(building);
      // Two frames: one for main.js's loop to draw it, one for it to show.
      requestAnimationFrame(() => requestAnimationFrame(() => markReady(true)));
    },
  ).catch((err) => {
    console.error('[intro] factory.glb failed to load:', err);
    markReady(false);
  });

  // --- the cut: a translucent sheet at the knife, and shed A's walls in poché

  const sheet = new THREE.Group();
  const sheetMat = new THREE.MeshBasicMaterial({
    color: INK.glow, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  });
  const sheetEdgeMat = new THREE.LineBasicMaterial({ color: INK.glow, transparent: true, opacity: 0, depthWrite: false });
  sheet.add(new THREE.Mesh(new THREE.PlaneGeometry(56, 52).rotateX(-Math.PI / 2).translate(0, 0, -2), sheetMat));
  sheet.add(new THREE.LineSegments(rectLines(-28, 28, -28, 24, 0), sheetEdgeMat));
  sheet.renderOrder = 3;
  scene.add(sheet);

  // Shed A's wall section: the ring between the outer face and an inner face
  // SHED.wall inside it, filled, at whatever height the knife is.
  const w = SHED.wall;
  const outline = new THREE.Shape();
  outline.moveTo(SHED.minX, -SHED.maxZ); outline.lineTo(SHED.maxX, -SHED.maxZ);
  outline.lineTo(SHED.maxX, -SHED.minZ); outline.lineTo(SHED.minX, -SHED.minZ);
  outline.closePath();
  const hole = new THREE.Path();
  hole.moveTo(SHED.minX + w, -SHED.maxZ + w); hole.lineTo(SHED.minX + w, -SHED.minZ - w);
  hole.lineTo(SHED.maxX - w, -SHED.minZ - w); hole.lineTo(SHED.maxX - w, -SHED.maxZ + w);
  hole.closePath();
  outline.holes.push(hole);
  const poche = new THREE.Group();
  const pocheMat = new THREE.MeshBasicMaterial({ color: INK.kiln, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const pocheLineMat = new THREE.LineBasicMaterial({ color: INK.kiln, transparent: true, opacity: 0, depthWrite: false });
  // Shape is drawn in XY with y = -z, then laid flat (rotateX(-90deg) maps y -> -z).
  poche.add(new THREE.Mesh(new THREE.ShapeGeometry(outline).rotateX(-Math.PI / 2), pocheMat));
  poche.add(new THREE.LineSegments(rectLines(SHED.minX, SHED.maxX, SHED.minZ, SHED.maxZ, 0), pocheLineMat));
  poche.add(new THREE.LineSegments(rectLines(SHED.minX + w, SHED.maxX - w, SHED.minZ + w, SHED.maxZ - w, 0), pocheLineMat));
  poche.renderOrder = 4;
  scene.add(poche);

  // --- the kiln, drawn from the ring view's own meshes -------------------------

  let kiln = null;
  let kilnScale = 1;
  // Where the kiln's centre sits on the floor. Set in buildKiln(); the reveal
  // sweeps round it and the final camera looks straight down on it.
  const kilnCentre = new THREE.Vector2(shedCx, shedCz);
  const kilnLineMat = inject(new THREE.LineBasicMaterial({
    color: INK.kiln, transparent: true, opacity: 1, depthWrite: false,
  }), 'kiln');
  const kilnFillMat = inject(new THREE.MeshBasicMaterial({
    color: INK.kiln, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide,
  }), 'kiln');

  /**
   * Built on the first frame rather than at construction: the ring has drawn
   * once by then, so its world matrices are current. A snapshot — the ring's
   * heat colours change, its outlines do not.
   */
  function buildKiln() {
    if (!ring) return;
    ring.scene.updateMatrixWorld(true);
    const b = ring.path.bounds;
    const pathW = b.maxX - b.minX;

    const lineP = [];
    const fillP = [];
    const box = new THREE.Box3();
    const tmp = new THREE.Box3();
    const take = (geo, matrix, into, edges) => {
      let g = edges ? new THREE.EdgesGeometry(geo, 20) : (geo.index ? geo.toNonIndexed() : geo.clone());
      g.applyMatrix4(matrix);
      const a = g.attributes.position.array;
      for (let i = 0; i < a.length; i++) into.push(a[i]);
      g.dispose();
    };

    ring.scene.traverseVisible((o) => {
      if (!o.geometry || !o.geometry.attributes.position) return;
      if (o.userData.ink) return;          // the ring's own inked edges; edges are built here
      o.geometry.computeBoundingBox();
      tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      const size = tmp.getSize(new THREE.Vector3());
      if (Math.max(size.x, size.z) > pathW * 2.5) return;   // backdrops, not kiln
      if (o.isLineSegments) take(o.geometry, o.matrixWorld, lineP, false);
      else if (o.isMesh) {
        take(o.geometry, o.matrixWorld, lineP, true);
        take(o.geometry, o.matrixWorld, fillP, false);
        box.union(tmp);
      }
    });
    if (box.isEmpty()) return;

    // Scale: the kiln's half-depth fills KILN_FILL of the shed's inside.
    const kilnHalfZ = Math.max(Math.abs(box.min.z), Math.abs(box.max.z));
    const insideHalfZ = (SHED.maxZ - SHED.minZ) / 2 - SHED.wall;
    kilnScale = (KILN_FILL * insideHalfZ) / kilnHalfZ;
    // Its left extreme (ring min x, which maps to the smallest shed x)
    // KILN_END_GAP from the inside of the shed's left end wall.
    kilnCentre.set(SHED.minX + SHED.wall + KILN_END_GAP - kilnScale * box.min.x, shedCz);
    U.uCenter.value.copy(kilnCentre);
    // The kiln view's paper carries the same grid on, so the hand-off has no jump.
    ring.setPaper?.({ scale: kilnScale, originX: kilnCentre.x, originZ: kilnCentre.y });

    // ring (x, y, z) -> shed (cx + s x, floor, cz - s z): Z flips because the
    // ring's camera is mirrored (see header). Ring heights are only draw
    // order, so they are flattened to a hair above the floor.
    const map = (arr) => {
      for (let i = 0; i < arr.length; i += 3) {
        const x = arr[i]; const y = arr[i + 1]; const z = arr[i + 2];
        arr[i] = kilnCentre.x + kilnScale * x;
        arr[i + 1] = FLOOR_Y + 0.002 * y;
        arr[i + 2] = kilnCentre.y - kilnScale * z;
      }
      return new THREE.Float32BufferAttribute(arr, 3);
    };

    kiln = new THREE.Group();
    const lines = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute('position', map(lineP)), kilnLineMat);
    const fills = new THREE.Mesh(
      new THREE.BufferGeometry().setAttribute('position', map(fillP)), kilnFillMat);
    lines.renderOrder = 6;
    fills.renderOrder = 5;
    kiln.add(fills, lines);
    scene.add(kiln);
  }

  // --- camera ----------------------------------------------------------------

  const lookAt = new THREE.Vector3();
  const endLook = new THREE.Vector3();

  /**
   * The final camera: straight down over the kiln's centre, at the height
   * where the floor plane shows exactly the ring camera's frame. The ring is
   * orthographic and the kiln drawing is flat, so a perspective camera
   * looking straight down at it matches it exactly — a flat plane under a
   * perspective camera is only scaled.
   */
  function endRadius() {
    const halfH = ring ? ring.camera.bottom : 5;   // ring frustum is inverted: bottom > 0
    return (halfH * kilnScale) / Math.tan(deg(CAM.endFov) / 2);
  }

  function resize() {
    const cw = canvas.clientWidth || 1;
    const ch = canvas.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(cw, ch, false);
    camera.aspect = cw / ch;
    camera.updateProjectionMatrix();
  }

  let donePainting = false;

  // --- the cursor's nod ---------------------------------------------------------
  // The model turns a few degrees toward the cursor, as if it had noticed it:
  // a slight yaw and an even slighter pitch, on the spot, about the middle of
  // the compound. The camera's scroll choreography is untouched, so the nod
  // never replaces or fights it; it is eased in, eased back out when the cursor
  // leaves, and fades away as the visitor starts to scroll (before the
  // camera's own move begins). Mouse and pen only: a finger has no hover.
  const NOD = { yaw: 0.05, pitch: 0.022, tauFollow: 0.55, tauReturn: 0.9, scrollFade: 0.04 };
  // The middle of the compound, on the ground (the rise camera's look-at, at
  // floor height): the nod turns the model about this point.
  const NOD_PIVOT = new THREE.Vector3(CAM.lookAtRise.x, 0, CAM.lookAtRise.z);
  const nodUp = new THREE.Vector3(0, 1, 0);
  const nodAxis = new THREE.Vector3(); const nodTmp = new THREE.Vector3();
  const nodQ = new THREE.Quaternion(); const nodQ2 = new THREE.Quaternion();
  const nodTarget = { x: 0, y: 0 };
  const nod = { x: 0, y: 0 };
  let nodLast = performance.now();
  window.addEventListener('pointermove', (ev) => {
    if (ev.pointerType === 'touch') return;
    // -1..1 from the middle of the window, so the edges mean "most"
    nodTarget.x = (ev.clientX / window.innerWidth) * 2 - 1;
    nodTarget.y = (ev.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });
  // The cursor leaving the window, or the page losing focus: settle home.
  const settleHome = () => { nodTarget.x = 0; nodTarget.y = 0; };
  document.documentElement.addEventListener('pointerleave', settleHome);
  window.addEventListener('blur', settleHome);

  function update() {
    if (!kiln) buildKiln();
    const q = sectionProgress(sectionEl);     // scroll
    const p = animProgress(q);                // animation (see HOLD)

    // camera: orbit -> rise over the compound -> lean in -> straight down
    const o = eased(p, PHASE.orbit);
    const r = eased(p, PHASE.rise);
    const l = eased(p, PHASE.lean);
    const d = eased(p, PHASE.descend);

    const azimuth = lerp(CAM.startAzimuth, CAM.endAzimuth, o);
    let elevation = lerp(CAM.startElevation, CAM.riseElevation, r);
    elevation = lerp(elevation, CAM.cutElevation, l);
    elevation = lerp(elevation, Math.PI / 2, d);
    let radius = lerp(CAM.startRadius, CAM.riseRadius, r);
    radius = lerp(radius, CAM.cutRadius, l);
    radius = lerp(radius, endRadius(), d);
    // The reading-hold dolly. Eases in over the hold, then hands over to the
    // lean: as the lean closes the distance it takes the dolly's share back
    // out, so the move carries straight on with no step and no pull-back.
    const hold = q < HOLD_Q[0] ? 0 : q < HOLD_Q[1] ? ease(span(q, HOLD_Q)) : 1 - l;
    radius *= 1 - HOLD.zoom * hold;
    let fov = lerp(CAM.startFov, CAM.riseFov, r);
    fov = lerp(fov, CAM.endFov, d);

    endLook.set(kilnCentre.x, FLOOR_Y, kilnCentre.y);
    lookAt.lerpVectors(CAM.lookAtStart, CAM.lookAtRise, r);
    lookAt.lerp(endLook, d);

    // The cursor's nod, eased (frame-rate independent) and faded with scroll.
    const now = performance.now();
    const dt = Math.min(0.1, (now - nodLast) / 1000);
    nodLast = now;
    const home = nodTarget.x === 0 && nodTarget.y === 0;
    const k = 1 - Math.exp(-dt / (home ? NOD.tauReturn : NOD.tauFollow));
    nod.x += (nodTarget.x - nod.x) * k;
    nod.y += (nodTarget.y - nod.y) * k;
    const nodW = 1 - ease(span(q, [0, NOD.scrollFade]));

    camera.fov = fov;
    camera.updateProjectionMatrix();
    camera.position.set(
      lookAt.x + radius * Math.cos(elevation) * Math.cos(azimuth),
      lookAt.y + radius * Math.sin(elevation),
      lookAt.z + radius * Math.cos(elevation) * Math.sin(azimuth),
    );
    // Screen-up tilts from world Y toward "away from the camera" as the view
    // pitches down, ending exactly on it when straight down — so looking
    // straight down is well defined and continuous with the tilted views.
    camera.up.set(
      -Math.cos(azimuth) * Math.sin(elevation),
      Math.cos(elevation),
      -Math.sin(azimuth) * Math.sin(elevation),
    );
    camera.lookAt(lookAt);

    // The nod itself: the model turns on the spot, about the vertical axis
    // through the middle of the compound (yaw, toward the cursor) and a
    // horizontal axis through the same point, across the view (pitch: its
    // far side lifts when the cursor goes up). The camera does not move.
    if (building) {
      const yaw = nod.x * NOD.yaw * nodW;
      const pitch = -nod.y * NOD.pitch * nodW;      // cursor up: far side lifts, top toward the viewer
      // Across the view, horizontal: the camera's right on the ground plane.
      nodAxis.set(Math.sin(azimuth), 0, -Math.cos(azimuth));
      nodQ.setFromAxisAngle(nodUp, yaw).multiply(nodQ2.setFromAxisAngle(nodAxis, pitch));
      building.quaternion.copy(nodQ);
      // Turning about NOD_PIVOT rather than the model's origin: p = c - R c.
      building.position.copy(NOD_PIVOT).sub(nodTmp.copy(NOD_PIVOT).applyQuaternion(nodQ));
    }

    // scan: photograph -> drawing
    const s = span(p, PHASE.scan);
    // Everything with x > uSweep is blueprint, and the paper runs 800 m out,
    // so the line is parked far beyond the paper's edge until the scan
    // starts (from the low opening shot the horizon is in view; a line parked
    // at the compound's edge left a blue sheet showing out there). It starts
    // and ends 90 m from the middle, outside the frame at the rise
    // camera, and snaps to the far side once done so no beige is left.
    U.uSweep.value = s <= 0 ? 1e5 : s >= 1 ? -1e5 : lerp(90, -90, ease(s));
    U.uGlow.value = Math.sin(Math.PI * s);
    clearColour.copy(beige).lerp(INK.paper, ease(s));

    const photoA = 1 - span(p, PHASE.photoFade);
    for (const m of photoMaterials) {
      m.transparent = photoA < 1;
      m.opacity = photoA;
    }
    if (building) building.visible = true;

    // cut
    const c = eased(p, PHASE.cut);
    const cutY = lerp(CUT_FROM, CUT_TO, c);
    cut.constant = p < PHASE.cut[0] ? 1e4 : cutY;
    const sheetA = bump(p, [PHASE.cut[0], PHASE.cut[1] + 0.02]);   // starts with the cut: nothing hangs over the hold
    sheet.position.y = cutY;
    sheetMat.opacity = 0.10 * sheetA;
    sheetEdgeMat.opacity = 0.7 * sheetA;
    sheet.visible = sheetA > 0;

    const linesA = 1 - span(p, PHASE.linesOut);
    for (const m of lineMaterials) m.opacity = 0.9 * linesA;

    // Shed A's walls are cut once the knife is below their top; the poché
    // rides the knife down and stays at plan height.
    const pocheA = (cutY < SHED.height ? 1 : 0) * span(p, [PHASE.cut[0] + 0.04, PHASE.cut[0] + 0.07]) * linesA;
    poche.position.y = Math.min(cutY, SHED.height) - 0.01;
    pocheMat.opacity = 0.55 * pocheA;
    pocheLineMat.opacity = pocheA;
    poche.visible = pocheA > 0;

    // kiln
    U.uReveal.value = eased(p, PHASE.kiln);
    const kilnA = 1 - span(p, PHASE.kilnOut);
    kilnLineMat.opacity = kilnA;
    kilnFillMat.opacity = 0.07 * kilnA;
    if (kiln) kiln.visible = U.uReveal.value > 0 && kilnA > 0;

    U.uFocus.value = eased(p, PHASE.focus);

    // hand-off: paper and canvas backdrop go clear together
    const paperA = 1 - span(p, PHASE.paperOut);
    paper.material.uniforms.uAlpha.value = paperA;
    renderer.setClearColor(clearColour, paperA);

    // The map tag leaves with the question.
    for (const node of [copyEl, placeEl]) {
      if (!node) continue;
      const a = 1 - span(p, PHASE.copyOut);
      node.style.opacity = String(a);
      node.style.visibility = a > 0 ? 'visible' : 'hidden';
    }

    if (briefEl) {
      const a = span(q, BRIEF.in) * (1 - span(q, BRIEF.out));
      briefEl.style.opacity = String(a);
      briefEl.style.visibility = a > 0 ? 'visible' : 'hidden';
      const lit = span(q, BRIEF.words) * briefWords.length;
      briefWords.forEach((w, i) => {
        w.style.opacity = String(0.18 + 0.82 * Math.min(1, Math.max(0, lit - i)));
      });
    }

    // Once everything is clear there is nothing left to paint; skip the draw
    // call rather than rendering an invisible scene every frame.
    const stillVisible = kilnA > 0 || !building;
    if (stillVisible || !donePainting) {
      renderer.render(scene, camera);
    }
    donePainting = !stillVisible;
  }

  resize();

  return {
    update,
    resize,
    camera, renderer, scene,       // for window.__intro — inspect the camera path
    getBuilding: () => building,   // building itself is only set once the GLB loads
    ready,                         // the factory is in and drawn (splash.js waits on it)
  };
}
