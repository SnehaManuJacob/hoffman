/**
 * "What else could this system become?": the problem, before the dryer.
 *
 * ONE WORLD, ONE CAMERA, NOTHING SWAPPED
 * The earlier version was a run of separate diagrams. This is a single 3D
 * place, a grower's house among arecanut palms, and a camera that never
 * cuts. Each idea is told by something in that place changing, not by a new
 * drawing replacing the last:
 *
 *   0. The answer   one ripe nut falls in under the question. The purple
 *                   thickens over the question, then thins into morning, and
 *                   the camera pulls back: the nut is one of hundreds on a
 *                   roof, which ripple in around it.
 *   1. The roof     the sun crosses fourteen times; shadows sweep the batch
 *                   and the nuts turn from ripe orange to dried brown. The
 *                   camera comes down to one nut and its husk opens.
 *   2. The rain     a fresh batch, then cloud and rain. A few nuts at the
 *                   edge are caught and spoil; the rest pour off the roof and
 *                   in at the door, the front wall dissolves, and they dry
 *                   slowly in lamplight, to day 45.
 *   3. The stall    the camera rises over the village: every roof is a batch
 *                   at a different stage, a pipeline you can see. A rain
 *                   front crosses it and every roof empties at once. On the
 *                   horizon, the tile works (the opening shot's own model)
 *                   keeps firing.
 *   4. The box      in the courtyard, a box dryer: air streams through and
 *                   leaves still able to dry; then it stops, empties, refills
 *                   and relights. The camera lifts to the tile works: Hoffmann.
 *
 *   5. The kiln     the camera flies to the tile works and comes down over
 *                   shed A; its roof is cut away the way the opening shot
 *                   cuts it, and the photograph dissolves into the kiln
 *                   drawing the visitor already knows (views/ring.js),
 *                   framed so the shed's floor and the drawing coincide (the
 *                   same solve as intro.js). The fire makes one lap, the
 *                   chamber numbers come back, and the five ideas from the
 *                   logic section settle into a tray: "So start from the
 *                   kiln."
 *
 * STORY BY SCROLL, LIFE BY TIME
 * Where things are in the story is set by the scroll, so it all runs
 * backwards, as everywhere else on the page. The scroll is followed through a
 * damped spring rather than read raw, so the camera glides instead of jumping
 * a wheel-notch at a time. Rain, clouds, smoke, fire and air move on their own
 * clock: they are weather, not story, and a page that freezes the moment you
 * stop scrolling reads as a diagram.
 *
 * THE LANDING SCENE'S LOOK
 * The village is built in Blender from the tile works file's own materials,
 * sun, sky, palms and tile-roofed houses, and Cycles-baked to textures with
 * the same pipeline as assets/factory.glb (assets/village.glb). Like the
 * opening shot it is drawn unlit, on the yard-clay backdrop: the light is in
 * the texture. Only what moves is lit live: the nuts, the rain, the air, the
 * fire. Time of day and weather are a tint over the whole bake.
 *
 * COLOUR
 * The page keeps yellow-to-red for heat (style.css). Ripe arecanut is that
 * colour in life, so produce is the one exception, and it is only ever drawn
 * as a lit, shaded fruit, never as a flat field, so it cannot be read as
 * temperature. Dried nuts go dark brown, as they do. Air keeps the page's air
 * tone; the heater's fire is the only heat.
 *
 * Evidence codes are the site's own (config EVIDENCE): F for the growers'
 * answers, L for the history, A for the village, which is staged.
 */

import * as THREE from 'three';
import { mergeGeometries } from '../vendor/utils/BufferGeometryUtils.js';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';
import { C, PALETTE } from '../config.js';
import { LOGIC_TAIL_VH } from './logic.js';
import { createTransform, T6, COPY6 } from './transform.js';

// Carries this module's ?v= stamp, so a re-bake under the same name is not
// masked by a cached copy (as intro.js does for factory.glb).
const MODEL_URL = './assets/village.glb' + new URL(import.meta.url).search;
const FACTORY_URL = './assets/factory.glb' + new URL(import.meta.url).search;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const prog = ([a, b], x) => clamp01((x - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const bump = (a, b, c, d, x) => smooth(a, b, x) * (1 - smooth(c, d, x));

/** The story, in viewport heights of (smoothed) scroll from the pin. */
const P = {
  DROP: [4, 30],
  COVER: [24, 52],          // purple comes up over the question
  DAWN: [56, 104],          // and thins into morning
  NUTS_IN: [72, 128],       // the batch ripples in round the first nut
  ROOF_DAYS: [230, 304],
  PEEL: [312, 340],
  NEXT: [362, 384],         // dried batch taken up, fresh batch spread
  NEXT_DAYS: [384, 402],
  CLOUD: [386, 412],
  // One rain, from the next batch's third day through the kiln line; it
  // clears only before the box dryer.
  RAIN: [400, 820],
  SPOIL: [408, 430],
  INDOORS: [424, 464],
  IN_DAYS: [468, 542],
  BARS: [482, 546],
  WALL: [440, 466, 560, 584],
  BACK_OUT: [836, 866],     // once the rain has cleared, every roof spread out again
  SWEEP: [670, 730],        // a rain front crosses the village
  CLEAR: [730, 766],
  DRYER_IN: [790, 834],
  AIR: [834, 850],
  TRAY_DRY: [840, 952],
  STOP: [958, 972],
  DOOR_OPEN: [968, 980],
  OUT: [976, 992],
  IN: [988, 1004],
  DOOR_SHUT: [1000, 1010],
  RELIGHT: [1006, 1022],
  DUSK: [1040, 1106],
  // 5. the kiln
  // The settle, in the order the opening shot hands over in: the camera
  // comes to rest straight above the kiln as the roof is cut away; the kiln
  // draws itself on the shed floor, round the way the fire travels; the
  // photograph fades to the drawing's paper around it; and only then does
  // the canvas give way to the live drawing, whose lines are the same lines.
  CUT: [1258, 1300],        // shed A's roof and walls cut down to plan height
  LINES: [1294, 1330],      // the kiln drawn on the shed floor
  PAPER: [1314, 1342],      // the photograph fades to the drawing's paper
  HAND: [1340, 1364],       // and gives way to the live drawing
  NUMS: [1354, 1374],       // the chamber numbers come back
  LAP: [1372, 1452],        // the fire makes one lap, sixteen hours
  TRAY: [1408, 1442],       // the five ideas settle into a tray
  END: T6.END,              // stage 6 runs on to here (views/transform.js)
};

const SRC = { F: 'Field observation', L: 'Literature', A: 'Assumption', U: 'Unknown' };
const src = (code, text) => `<p class="pb-src"><span class="pb-chip" data-ev="${code}" title="${SRC[code]}">${code}</span>${text}</p>`;

/** What is said, and when: [in from, in to, out from, out to]. */
const COPY = [
  { at: [106, 120, 178, 190], text: 'Across coastal villages, rooftops are covered with arecanut, spread out to dry in the sun.', src: src('F', 'Growers dry their nuts on their roofs') },
  { at: [226, 240, 352, 364], text: 'Drying takes up to two weeks. The nut is ready when it is hard and its husk peels away easily.', src: src('F', 'Growers, asked for this project') },
  { at: [372, 386, 426, 440], text: 'Unless it rains. Rain falling on the nuts spoils them.', src: src('F', 'Growers') },
  { at: [442, 456, 522, 536], text: 'Damp air only slows them down. So when it rains, the drying moves indoors, and waits.', src: src('F', 'Growers: indoors, a month to a month and a half') },
  { at: [536, 550, 586, 598], text: 'The same nuts, two to three times as long.', big: true },
  { at: [664, 676, 784, 796], text: 'Inside the kiln, the fire never waited for the weather. Its heat came from inside, kept to a rule. And the growers already have a fuel: many burn the husks.', src: src('F', 'Growers, on husk as fuel') },
  { at: [830, 842, 898, 910], text: 'The obvious fix: one box, one heater, burning husk.' },
  { at: [910, 922, 952, 964], text: 'But the air leaves while it could still dry more…' },
  { at: [964, 976, 1014, 1026], text: '…and everything stops to empty and refill, then heats up again from cold.' },
  { at: [1378, 1392, 1482, 1494], text: "Let's take a look at the Hoffmann Kiln again.", big: true },
  { at: [1034, 1048, 1100, 1114], text: 'Brick-makers had the same problem. In 1858 Friedrich Hoffmann patented a kiln that never let its fire go out, and never let its heat leave unused.', src: src('L', 'History of the Hoffmann kiln') },
];
// Stage 6's words, in the same slips (views/transform.js).
COPY.push(...COPY6.map((c) => (c.term ? c : { ...c, src: c.srcs ? `<div class="pb-srcs">${c.srcs.map(([k, t]) => src(k, t)).join('')}</div>` : undefined })));

// ------------------------------------------------------------------- colours
const col = (hex) => new THREE.Color(hex);
const BG = {
  purple: col('#B46AFF'),
  yard: col(PALETTE.yard),        // the opening shot's backdrop
  rain: col('#a4a29b'),
  dusk: col('#b39079'),
  paper: col(PALETTE.paper),     // the kiln drawing's sheet (views/ring.js)
};
// Multiplied over the whole bake: daylight is the bake as it is.
const TINT = {
  day: new THREE.Color(1, 1, 1),
  rain: new THREE.Color(0.74, 0.77, 0.8),
  dusk: new THREE.Color(0.86, 0.66, 0.56),
  // The bake taken down to the drawing's paper: a ghost of the photograph.
  paper: new THREE.Color(0.06, 0.058, 0.055),
};
// The bake's sun (the tile works file's), towards the light, in page axes.
const SUN_DIR = new THREE.Vector3(0.788, 0.559, -0.256).normalize();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * The village's layout, as the Blender build places it: the hero's terrace
 * (top at ROOF_TOP) and the five other drying roofs, left to right in the
 * aerial view from nearly dry to just spread, a pipeline seen from above.
 */
const ROOF_TOP = 6.3;
const ROOFS = [
  { x: 0, z: 0, w: 10, d: 8, dry: 0.42, n: 640 },
  { x: -44, z: -6, w: 8.5, d: 7, dry: 0.95, n: 420 },
  { x: -30, z: -16, w: 8.5, d: 7, dry: 0.78, n: 420 },
  { x: -15, z: -5, w: 8.5, d: 7, dry: 0.6, n: 420 },
  { x: 14, z: -15, w: 8.5, d: 7, dry: 0.24, n: 420 },
  { x: 29, z: -4, w: 8.5, d: 7, dry: 0.08, n: 420 },
];
// A ripe nut, crown to base; dried and spoilt are what the instance colour
// multiplies it by.
const NUT_CROWN = col('#7b6a1f');
const NUT_TOP = col('#f7bd2f');
const NUT_BASE = col('#ec7418');
const DRIED = new THREE.Color(0.16, 0.17, 0.55);
const SPOILT = new THREE.Color(0.035, 0.05, 0.3);

// Seeded, so the village is the same village on every visit.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createProblem({ sectionEl, ring, run }) {
  const total = P.END;
  sectionEl.style.height = `${total + 100}vh`;
  sectionEl.style.marginTop = `-${100 + LOGIC_TAIL_VH}vh`;

  const pin = sectionEl.querySelector('.problem-pin');
  const canvas = sectionEl.querySelector('.problem-canvas');
  const scrim = sectionEl.querySelector('.problem-scrim');
  const copyEl = sectionEl.querySelector('.problem-copy');
  const hud = sectionEl.querySelector('.problem-hud');
  const labelsEl = sectionEl.querySelector('.problem-labels');

  // --------------------------------------------------------------- the words
  // Each line is split into words that rise in one after another.
  const copy = COPY.map((c) => {
    const node = document.createElement('div');
    node.className = 'pb-copy';
    // The closing line: centred under the drawing, wide, on the bare paper.
    if (c.finale) node.classList.add('pb-copy--finale');
    if (c.term) {
      // A term card: the idea's name, what it means, and what it is here.
      // Built whole (no word-by-word): it reads as a definition, not a line.
      node.classList.add('pb-copy--term');
      const p = (cls, text) => { const e = document.createElement('p'); e.className = cls; e.textContent = text; node.append(e); return e; };
      p('pb-tc-term', c.term);
      p('pb-tc-def', c.def);
      const here = p('pb-tc-here', ` ${c.here}`);
      const b = document.createElement('b'); b.textContent = 'Here'; here.prepend(b);
      copyEl.append(node);
      return { ...c, node, words: [], srcNode: null };
    }
    const line = document.createElement('p');
    line.className = c.big ? 'pb-line pb-big' : 'pb-line';
    const words = c.text.split(' ').map((w, i, all) => {
      const span = document.createElement('span');
      span.className = 'pb-word';
      span.textContent = w + (i < all.length - 1 ? ' ' : '');
      line.append(span);
      return span;
    });
    node.append(line);
    let srcNode = null;
    if (c.src) {
      node.insertAdjacentHTML('beforeend', c.src);
      srcNode = node.lastElementChild;
    }
    copyEl.append(node);
    return { ...c, node, words, srcNode };
  });

  // The day count and the two bars, as slips.
  hud.innerHTML = `
    <div class="pb-slip pb-day"><span class="pb-day-n">Day 1</span><span class="pb-day-where">on the roof</span></div>
    <div class="pb-slip pb-bars">
      <div class="pb-bar-row"><span>On the roof</span><i><b class="pb-fill" data-k="roof"></b></i><em>up to 14 days</em></div>
      <div class="pb-bar-row"><span>Indoors</span><i><b class="pb-fill" data-k="in"></b><b class="pb-fill is-range" data-k="range"></b></i><em>30–45 days</em></div>
    </div>`;
  const dayEl = hud.querySelector('.pb-day');
  const dayN = hud.querySelector('.pb-day-n');
  const dayWhere = hud.querySelector('.pb-day-where');
  const barsEl = hud.querySelector('.pb-bars');
  const fills = Object.fromEntries([...hud.querySelectorAll('.pb-fill')].map((f) => [f.dataset.k, f]));

  // Labels pinned to places in the world.
  const LABELS = [
    { text: 'caught by the rain', at: new THREE.Vector3(3.05, 6.75, 2.35), show: (s) => bump(P.SPOIL[0] + 6, P.SPOIL[1], P.IN_DAYS[0], P.IN_DAYS[0] + 14, s) },
    { text: 'the tile works', at: new THREE.Vector3(-44, 16, -108), show: (s) => bump(664, 680, 784, 796, s) },
    { text: 'heater, burning husk', at: new THREE.Vector3(9.6, 1.5, 3.6), show: (s) => bump(836, 850, 952, 962, s) },
    { text: 'still warm, still dry: it could take more water', at: new THREE.Vector3(13.9, 6.4, 3.0), show: (s) => bump(914, 926, 956, 966, s) },
  ].map((l) => {
    const node = document.createElement('div');
    node.className = 'pb-label';
    node.textContent = l.text;
    labelsEl.append(node);
    return { ...l, node };
  });

  // The kiln's return: its eight chamber numbers, and the five ideas from the
  // logic section in a tray across the top.
  const back = document.createElement('div');
  back.className = 'pb-return';
  back.setAttribute('aria-hidden', 'true');
  pin.append(back);
  const nums = Array.from({ length: run.count }, (_, i) => {
    const n = document.createElement('span');
    n.className = 'pb-num';
    n.textContent = String(i + 1);
    back.append(n);
    return n;
  });
  const tray = document.createElement('div');
  tray.className = 'pb-tray';
  back.append(tray);
  const terms = ['Algorithm', 'Loop', 'Pipeline', 'Forwarding', 'Trigger'].map((t) => {
    const e = document.createElement('span');
    e.className = 'pb-term';
    e.textContent = t;
    tray.append(e);
    return e;
  });

  // Stage 6: the kiln changed into the dryer, drawn over the kiln drawing,
  // under the words and the tray.
  const transform = createTransform({ container: pin, before: scrim, ring, run, terms });

  // --------------------------------------------------------------- the world
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.localClippingEnabled = true;          // the cut through shed A
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // No tone mapping: the sky has to match the logic section's purple to the
  // last digit at the hand-over, and fog has to match the sky.
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 1200);
  const bg = BG.purple.clone();
  scene.fog = new THREE.Fog(bg.clone(), 1, 3);

  // Light for the live things only; the village carries its own in the bake.
  const hemi = new THREE.HemisphereLight(0xe8eef4, 0x8a7a62, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3e2, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 120 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.target.position.set(1, 3, 0);
  scene.add(sun, sun.target);

  // Everything but the first nut: hidden until the purple has covered the
  // question, so the roof cannot show through it.
  const world = new THREE.Group();
  world.visible = false;
  scene.add(world);

  // ---- the baked village
  const baked = [];            // every baked material, for the time-of-day tint
  let front = null;            // the hero house's front wall, which dissolves
  const dryer = new THREE.Group();
  world.add(dryer);
  const DX = 12.6; const DZ = 3;
  const doorPivot = new THREE.Group();
  doorPivot.position.set(DX + 1.7, 0, DZ - 1);
  dryer.add(doorPivot);
  new GLTFLoader().load(MODEL_URL, (gltf) => {
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const meshes = [];
    gltf.scene.traverse((c) => { if (c.isMesh) meshes.push(c); });
    for (const m of meshes) {
      const src = m.material;
      if (src.map) src.map.anisotropy = maxAniso;
      const mat = new THREE.MeshBasicMaterial({
        map: src.map || null,
        color: 0xffffff,
        alphaTest: src.alphaTest || 0,       // the fronds' leaflet cut-outs
        side: src.side,
      });
      m.material = mat;
      baked.push(mat);
      m.updateMatrixWorld();
      const geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = m.name;
      if (m.name === 'Web_front') {
        // Always see-through, only ever fully opaque in effect: switching a
        // material in and out of transparency rebuilds its shader mid-scroll.
        mat.transparent = true;
        front = mesh;
        world.add(mesh);
      } else if (m.name === 'Web_door') {
        mesh.position.set(-(DX + 1.7), 0, -(DZ - 1));
        doorPivot.add(mesh);
      } else if (m.name === 'Web_dryer') {
        dryer.add(mesh);
      } else {
        world.add(mesh);
      }
    }
    // The palms' ripe bunches: their places come with the bake; the fruit is
    // drawn live, in the same lit orange as the nuts on the roofs.
    const at = JSON.parse(gltf.scene.userData.areca_bunches || '[]');
    const bunchMesh = new THREE.InstancedMesh(bunchGeo, nutMat, at.length);
    at.forEach(([x, y, z], i) => {
      tmp.position.set(x, y, z);
      tmp.rotation.set(0, i * 2.39, 0);
      tmp.updateMatrix();
      bunchMesh.setMatrixAt(i, tmp.matrix);
      bunchMesh.setColorAt(i, new THREE.Color(1, 0.9 + (i % 5) * 0.04, 0.8 + (i % 3) * 0.15));
    });
    world.add(bunchMesh);
  });

  // Nut shadows: the bake cannot know where the nuts are, so the roof's mat,
  // the room's floor and the dryer's tray each get a shadow-only sheet.
  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.32 });
  const sheet = (w, d, x, y, z, parent = world) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), shadowMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  sheet(7.4, 5.8, 0, ROOF_TOP + 0.034, 0);
  sheet(9.4, 7.4, 0, 0.705, 0);
  sheet(3.3, 1.9, DX, 1.027, DZ, dryer);
  // A soft contact shadow under the dryer, which the bake leaves out (it is
  // not there for most of the story).
  const contact = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 4, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 3.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(DX - 0.8, 0.02, DZ + 0.1);
    world.add(m);
    return m;
  })();

  const puff = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();

  // ---- the tile works: the opening shot's own model, set down beyond the
  // village. Unrotated, so its baked shadows fall the same way as the
  // village's (both were baked under the tile works file's one sun).
  const FACTORY_AT = new THREE.Vector3(-35, 0.03, -105);
  // The section plane that takes shed A's roof off: everything above it is
  // cut away, the way the opening shot cuts it (intro.js, CUT_FROM/CUT_TO).
  const cut = new THREE.Plane(new THREE.Vector3(0, -1, 0), 99);

  /**
   * Where the kiln stands in shed A, by the same solve as intro.js: its
   * half-depth fills 88% of the shed's inside, its left end 1.5 m in from
   * the shed's west wall. In the GLB's coordinates, then moved with the
   * model. The ring draws the kiln about (0, 0) with world -Z screen-up, so
   * a camera straight above KILN at KILN_H shows the shed floor exactly as
   * the ring shows the kiln.
   */
  const SHED = { minX: -24, maxX: 6, minZ: -11, maxZ: 0, wall: 0.3 };
  const FLOOR_Y = 0.58;
  const kb = ring.path.bounds;
  const halfBand = C.form.wallThickness / 2;
  const kilnScale = (0.88 * ((SHED.maxZ - SHED.minZ) / 2 - SHED.wall)) / (Math.max(Math.abs(kb.minZ), Math.abs(kb.maxZ)) + halfBand);
  const KILN = new THREE.Vector3(
    FACTORY_AT.x + SHED.minX + SHED.wall + 1.5 - kilnScale * (kb.minX - halfBand),
    FACTORY_AT.y + FLOOR_Y,
    FACTORY_AT.z + (SHED.minZ + SHED.maxZ) / 2,
  );
  /**
   * The kiln drawn on the shed floor before the hand-over, as the opening
   * shot draws it (intro.js, THE KILN DRAWING): not a second model, the
   * ring's own meshes' edges, mapped into the shed the same way. Built the
   * first time it is needed. Segments are ordered by angle round the kiln,
   * starting at chamber 1, so it draws itself round the way the fire goes.
   */
  const inkMat = new THREE.LineBasicMaterial({ color: '#e4e0da', transparent: true, opacity: 0, fog: false, depthWrite: false });
  let kilnLines = null;
  function buildKilnLines() {
    const segs = [];
    const box = new THREE.Box3(); const size = new THREE.Vector3();
    const pathW = kb.maxX - kb.minX;
    const take = (geo, matrix, edges) => {
      const g = edges ? new THREE.EdgesGeometry(geo, 20) : geo.clone();
      g.applyMatrix4(matrix);
      const a = g.attributes.position.array;
      for (let i = 0; i + 5 < a.length; i += 6) segs.push(a.slice(i, i + 6));
      g.dispose();
    };
    ring.scene.updateMatrixWorld(true);
    ring.scene.traverseVisible((o) => {
      if (!o.geometry || !o.geometry.attributes.position || o.isInstancedMesh) return;
      if (o.userData.ink) return;          // the ring's own inked edges
      o.geometry.computeBoundingBox();
      box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      box.getSize(size);
      if (Math.max(size.x, size.z) > pathW * 2.5) return;   // backdrops, not kiln
      if (o.isLineSegments) take(o.geometry, o.matrixWorld, false);
      else if (o.isMesh) take(o.geometry, o.matrixWorld, true);
    });
    // Round the kiln from chamber 1, in the fire's direction.
    const p0 = ring.chamberPoint(0); const p1 = ring.chamberPoint(1);
    const a0 = Math.atan2(p0.z, p0.x);
    const dir = Math.sign(Math.atan2(p1.z, p1.x) - a0) || 1;
    const ang = (q) => {
      let d = (Math.atan2((q[2] + q[5]) / 2, (q[0] + q[3]) / 2) - a0) * dir;
      while (d < 0) d += Math.PI * 2;
      return d;
    };
    segs.sort((x, y) => ang(x) - ang(y));
    // ring (x, y, z) -> shed (cx + s x, floor, cz - s z), as intro.js maps it.
    const out = new Float32Array(segs.length * 6);
    segs.forEach((q, i) => {
      for (let j = 0; j < 6; j += 3) {
        out[i * 6 + j] = KILN.x + kilnScale * q[j];
        out[i * 6 + j + 1] = KILN.y + 0.02 + 0.002 * q[j + 1];
        out[i * 6 + j + 2] = KILN.z - kilnScale * q[j + 2];
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(out, 3));
    kilnLines = new THREE.LineSegments(geo, inkMat);
    kilnLines.userData.count = segs.length;
    kilnLines.renderOrder = 6;
    kilnLines.frustumCulled = false;
    world.add(kilnLines);
  }

  const END_FOV = 28;
  // The drawing is shown a little smaller than it fills the screen (room for
  // the tray above and the words below), and the camera lands at THAT size,
  // so nothing has to shrink after the hand-over.
  const KILN_ZOOM = 0.76;
  const kilnHeight = () => (Math.abs(ring.camera.bottom) / KILN_ZOOM * kilnScale) / Math.tan(THREE.MathUtils.degToRad(END_FOV / 2));
  new GLTFLoader().load(FACTORY_URL, (gltf) => {
    const meshes = [];
    gltf.scene.traverse((c) => { if (c.isMesh) meshes.push(c); });
    for (const m of meshes) {
      // The power line runs off for 150 m: it would cross the village.
      if (m.name.startsWith('Power_Lines')) continue;
      m.updateMatrixWorld();
      const geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
      // The compound mesh carries the line's poles too: keep the compound.
      if (m.name === 'Web_compound') keepWithin(geo, 27.2, -27, 25);
      geo.translate(FACTORY_AT.x, FACTORY_AT.y, FACTORY_AT.z);
      const mat = new THREE.MeshBasicMaterial({
        map: m.material.map || null, color: 0xffffff,
        alphaTest: m.material.alphaTest || 0, side: m.material.side,
        clippingPlanes: [cut],
      });
      baked.push(mat);
      world.add(new THREE.Mesh(geo, mat));
    }
  });
  /** Drop the triangles whose centre lies outside a box (x, then z). */
  function keepWithin(geo, maxX, minZ, maxZ) {
    const p = geo.attributes.position; const idx = geo.index;
    const keep = [];
    for (let t = 0; t < idx.count; t += 3) {
      const a = idx.getX(t); const b = idx.getX(t + 1); const c = idx.getX(t + 2);
      const cx = (p.getX(a) + p.getX(b) + p.getX(c)) / 3; const cz = (p.getZ(a) + p.getZ(b) + p.getZ(c)) / 3;
      if (Math.abs(cx) <= maxX && cz >= minZ && cz <= maxZ) keep.push(a, b, c);
    }
    geo.setIndex(keep);
  }
  // Smoke over shed A's west end, where the kiln stands (intro.js puts it
  // there too). No chimney is drawn: its place at Kundapur was not seen.
  const plume = new THREE.Group();
  plume.position.set(FACTORY_AT.x - 17, 9.5, FACTORY_AT.z - 5.5);
  world.add(plume);
  const smoke = [];
  for (let i = 0; i < 22; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, color: '#9a948d', transparent: true, depthWrite: false, fog: false }));
    plume.add(sp);
    smoke.push(sp);
  }

  // ---- clouds and rain
  const clouds = [];
  {
    const R = rng(21);
    for (let i = 0; i < 22; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, color: '#8d8e8c', transparent: true, depthWrite: false, opacity: 0, fog: false }));
      const s = 30 + R() * 40;
      sp.scale.set(s * 1.6, s * 0.6, 1);
      sp.userData = { x: (R() - 0.5) * 220, y: 30 + R() * 14, z: -40 - R() * 120 + 60, v: 0.6 + R() * 0.8 };
      world.add(sp);
      clouds.push(sp);
    }
  }
  const RAIN_N = 3200;
  const rainPos = new Float32Array(RAIN_N * 6);
  const rainSeed = new Float32Array(RAIN_N * 3);
  {
    const R = rng(5);
    for (let i = 0; i < RAIN_N; i++) { rainSeed[i * 3] = R(); rainSeed[i * 3 + 1] = R(); rainSeed[i * 3 + 2] = R(); }
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: '#e4e9ea', transparent: true, opacity: 0, depthWrite: false });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  world.add(rain);

  // ---- the nuts
  /**
   * The skin: fine lengthwise fibres, as on a real areca husk, used as a
   * faint colour variation and a bump, so a nut reads as a fruit up close.
   */
  const skin = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#e6e6e6'; x.fillRect(0, 0, 256, 128);
    const R = rng(13);
    for (let i = 0; i < 520; i++) {
      const v = 190 + R() * 65;
      x.strokeStyle = `rgba(${v},${v},${v},${0.25 + R() * 0.5})`;
      x.lineWidth = 0.5 + R() * 1.4;
      const u = R() * 256;
      x.beginPath(); x.moveTo(u, 0); x.bezierCurveTo(u + (R() - 0.5) * 8, 40, u + (R() - 0.5) * 8, 90, u + (R() - 0.5) * 6, 128); x.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  /** One nut, crown up: an egg with a little calyx, coloured crown to base. */
  const nutGeo = (() => {
    const body = new THREE.SphereGeometry(1, 24, 18);
    const p = body.attributes.position;
    const c = new Float32Array(p.count * 3);
    const k = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const pinch = 1 - 0.14 * Math.max(0, y);
      p.setX(i, p.getX(i) * 0.09 * pinch);
      p.setZ(i, p.getZ(i) * 0.09 * pinch);
      p.setY(i, y * 0.11);
      const u = (y + 1) / 2;
      k.copy(NUT_BASE).lerp(NUT_TOP, smooth(0.15, 0.85, u)).lerp(NUT_CROWN, smooth(0.86, 1, u));
      c.set([k.r, k.g, k.b], i * 3);
    }
    body.setAttribute('color', new THREE.BufferAttribute(c, 3));
    body.computeVertexNormals();
    const calyx = new THREE.ConeGeometry(0.045, 0.035, 5);
    calyx.translate(0, 0.112, 0);
    const cc = new Float32Array(calyx.attributes.position.count * 3);
    const dark = col('#4d4318');
    for (let i = 0; i < cc.length; i += 3) cc.set([dark.r, dark.g, dark.b], i);
    calyx.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    const g = mergeGeometries([body.toNonIndexed(), calyx.toNonIndexed()]);
    g.translate(0, 0.1, 0);                                   // resting on its base
    return g;
  })();
  const nutMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.56, metalness: 0, map: skin, bumpMap: skin, bumpScale: 1.6 });
  // A bunch on the palm: a dozen nuts hanging together under the crown.
  const bunchGeo = (() => {
    const parts = [];
    const R = rng(3);
    for (let i = 0; i < 12; i++) {
      const g = nutGeo.clone();
      g.scale(0.9, 0.9, 0.9);
      g.rotateZ((R() - 0.5) * 1.2);
      g.rotateX(Math.PI + (R() - 0.5) * 0.6);          // hanging, crown up to the stalk
      g.translate((R() - 0.5) * 0.36, -R() * 0.5, (R() - 0.5) * 0.36);
      parts.push(g);
    }
    return mergeGeometries(parts);
  })();
  const tmp = new THREE.Object3D();

  // Every nut in the village: where it lies on its roof, and (on the
  // hero's roof) where it ends up indoors.
  const HERO_SLOT = new THREE.Vector3(0.7, ROOF_TOP + 0.03, 1.15);
  const nuts = [];
  {
    const R = rng(42);
    ROOFS.forEach((roof, r) => {
      const hw = (roof.w - 2.8) / 2; const hd = (roof.d - 2.4) / 2;
      for (let i = 0; i < roof.n; i++) {
        let x; let z;
        do {
          x = (R() * 2 - 1) * hw; z = (R() * 2 - 1) * hd;
        } while (r === 0 && Math.hypot(x - HERO_SLOT.x, z - HERO_SLOT.z) < 0.2);
        const home = new THREE.Vector3(roof.x + x, ROOF_TOP + 0.03, roof.z + z);
        // Every nut a little different: some yellower, some redder.
        const warm = R();
        const n = {
          r, home, seed: R(), yaw: R() * 6.28, tilt: (R() - 0.5) * 0.5,
          tone: new THREE.Color(1, 0.84 + warm * 0.24, 0.7 + warm * 0.5),
          xf: (roof.x + x + 50) / 90,
        };
        if (r === 0) {
          n.dist = Math.hypot(x - HERO_SLOT.x, z - HERO_SLOT.z) / Math.hypot(hw * 2, hd * 2);
          n.spoils = x > hw - 1.1 && z > hd - 0.9;
          n.inside = new THREE.Vector3((R() * 2 - 1) * 3.6, 0.72, -2.8 + R() * 4.2);
        }
        nuts.push(n);
      }
    });
  }
  const nutMesh = new THREE.InstancedMesh(nutGeo, nutMat, nuts.length);
  nutMesh.castShadow = true;
  nutMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  world.add(nutMesh);

  // The nut that answers the question. Its husk comes apart in two halves
  // over a marbled kernel, the way the growers test for dryness.
  const heroNut = new THREE.Group();
  scene.add(heroNut);
  const heroMul = new THREE.Color(1, 1, 1);
  const halves = (() => {
    const make = (phi) => {
      const geo = new THREE.SphereGeometry(1, 32, 24, phi, Math.PI);
      const p = geo.attributes.position;
      const c = new Float32Array(p.count * 3);
      const k = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const pinch = 1 - 0.14 * Math.max(0, y);
        p.setX(i, p.getX(i) * 0.09 * pinch); p.setZ(i, p.getZ(i) * 0.09 * pinch); p.setY(i, y * 0.11 + 0.11);
        const u = (y + 1) / 2;
        k.copy(NUT_BASE).lerp(NUT_TOP, smooth(0.15, 0.85, u)).lerp(NUT_CROWN, smooth(0.86, 1, u));
        c.set([k.r, k.g, k.b], i * 3);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
      geo.computeVertexNormals();
      const outer = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.46, fog: false, map: skin, bumpMap: skin, bumpScale: 1.2 }));
      // The inside of the husk: pale, fibrous.
      const inner = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#d9ad6c', roughness: 1, side: THREE.BackSide, fog: false, bumpMap: skin, bumpScale: 3 }));
      outer.castShadow = true;
      const pivot = new THREE.Group();
      pivot.add(outer, inner);
      heroNut.add(pivot);
      return { pivot, outer };
    };
    return [make(0), make(Math.PI)];
  })();
  const calyx = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.035, 5), new THREE.MeshStandardMaterial({ color: '#4d4318', roughness: 0.8, fog: false }));
  calyx.position.y = 0.222;
  halves[0].pivot.add(calyx);
  const kernel = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#e8d1a4'; x.fillRect(0, 0, 256, 128);
    const R = rng(9);
    for (let i = 0; i < 70; i++) {
      x.strokeStyle = `rgba(${120 + R() * 30},${70 + R() * 20},${35 + R() * 15},${0.35 + R() * 0.4})`;
      x.lineWidth = 1 + R() * 4;
      x.beginPath();
      let px = R() * 256; let py = R() * 128;
      x.moveTo(px, py);
      for (let j = 0; j < 6; j++) { px += (R() - 0.5) * 40; py += (R() - 0.5) * 30; x.lineTo(px, py); }
      x.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.066, 24, 16), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, fog: false }));
    m.position.y = 0.1;
    m.scale.set(1, 1.15, 1);
    heroNut.add(m);
    return m;
  })();

  // ---- the dryer's live parts: its fire, its tray of nuts, its air
  const fireMat = new THREE.MeshBasicMaterial({ color: '#ef6c1a' });
  const fire = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), fireMat);
  fire.position.set(9.5, 0.55, DZ + 0.66);
  dryer.add(fire);
  const fireLight = new THREE.PointLight(0xff8a3a, 0, 9, 1.6);
  fireLight.position.set(9.5, 0.9, DZ + 1.3);
  dryer.add(fireLight);
  const trayMesh = new THREE.InstancedMesh(nutGeo, nutMat, 120);
  trayMesh.castShadow = true;
  dryer.add(trayMesh);
  const trayNuts = [];
  {
    const R = rng(77);
    for (let i = 0; i < 120; i++) {
      trayNuts.push({ x: DX + (R() * 2 - 1) * 1.5, z: DZ + (R() * 2 - 1) * 0.85, yaw: R() * 6.28, seed: R(), fresh: i >= 60 });
    }
  }
  // Air: a stream of motes along the air's way, in the page's air tone.
  const airPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(9.5, 0.65, DZ), new THREE.Vector3(10.8, 0.5, DZ), new THREE.Vector3(12.0, 0.55, DZ),
    new THREE.Vector3(12.8, 0.7, DZ), new THREE.Vector3(13.0, 1.5, DZ), new THREE.Vector3(13.5, 2.1, DZ - 0.2),
    new THREE.Vector3(13.8, 3.2, DZ - 0.2), new THREE.Vector3(13.8, 5.9, DZ - 0.2), new THREE.Vector3(14.3, 7.6, DZ + 0.2),
    new THREE.Vector3(15.2, 9.2, DZ + 0.6),
  ]);
  const AIR_N = 520;
  const airPos = new Float32Array(AIR_N * 3);
  const airGeo = new THREE.BufferGeometry();
  airGeo.setAttribute('position', new THREE.BufferAttribute(airPos, 3));
  const airMat = new THREE.PointsMaterial({ color: '#a9cdd4', size: 0.3, map: puff, transparent: true, depthWrite: false, opacity: 0 });
  const air = new THREE.Points(airGeo, airMat);
  air.frustumCulled = false;
  dryer.add(air);
  const airSeed = Array.from({ length: AIR_N }, (_, i) => [(i / AIR_N), (Math.sin(i * 12.9898) * 43758.5453) % 1, (Math.sin(i * 78.233) * 12345.678) % 1]);

  // ------------------------------------------------------------ the camera
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const H = HERO_SLOT;
  /**
   * The camera's way, [scroll, position, target, fov]. Two rules keep it calm:
   * the camera moves BETWEEN beats and all but holds (a slow drift) while
   * words are on screen; and every big move gets room. No move covers more
   * than about a metre per vh of scroll, and the long ones (up to the
   * village, down to the dryer) pass through a midpoint so they arc instead
   * of lunging. Timings are those of P: change one, check the other.
   */
  const KEYS = [
    // Framed so the nut sits under the question, a fifth of the screen high.
    [0, V(H.x + 0.02, H.y + 0.62, H.z + 1.95), V(H.x, H.y + 0.44, H.z), 34],
    [52, V(H.x + 0.22, H.y + 0.64, H.z + 1.93), V(H.x, H.y + 0.41, H.z), 34],
    // Out from the nut to the roof, as the batch ripples in round it.
    [100, V(2.5, 8.2, 6.6), V(0.6, 6.3, 0.8), 38],
    // Up over the village: roof after roof of drying nuts; then down to one.
    [150, V(-5, 24, 36), V(-8, 2, -6), 44],
    [188, V(-9, 25, 37), V(-9, 2, -7), 44],
    [236, V(8.2, 11, 13.2), V(0, 5.5, 0), 40],
    // While the days pass: a slow push in, not a swing round the house.
    [290, V(4.4, 9.8, 10.6), V(0.3, 5.9, 0.4), 40],
    // Down to the nut for the growers' test, and hold while it opens.
    [312, V(H.x + 1.3, H.y + 0.95, H.z + 2.3), V(H.x, H.y + 0.15, H.z), 34],
    [330, V(H.x + 0.42, H.y + 0.34, H.z + 0.72), V(H.x, H.y + 0.1, H.z), 32],
    [356, V(H.x + 0.5, H.y + 0.37, H.z + 0.8), V(H.x, H.y + 0.1, H.z), 32],
    // Back out for the next batch and the weather.
    [402, V(9, 10, 14.5), V(0.5, 5.2, 0.5), 42],
    // Down with the nuts to the door, and in.
    [438, V(9, 5.6, 14.5), V(1.8, 3.2, 2), 44],
    [476, V(0.8, 3.4, 12.6), V(0, 1.7, 0), 46],
    [552, V(-0.4, 3.1, 10.6), V(0, 1.4, -0.6), 46],
    // Up over the village, by way of a midpoint.
    [598, V(-3, 13, 27), V(-3, 2, -4), 45],
    [650, V(-12, 32, 50), V(-8, 0, -8), 45],
    [704, V(-17, 34, 50), V(-10, 0, -10), 45],
    // Turn to the tile works, and hold on it: seen from over the village's
    // middle, so the way down to the courtyard after is short.
    [758, V(-4, 23, 33), V(-32, 4, -94), 45],
    [792, V(-2, 22, 31), V(-33, 4, -98), 45],
    // Down to the courtyard; back far enough to see the flue's top, where
    // the air leaves.
    [830, V(10, 13.5, 26), V(10.5, 2.5, 2), 42],
    [868, V(21, 6.4, 17.2), V(12.4, 2.9, 3), 40],
    [970, V(20, 5.8, 16.2), V(12.4, 2.7, 3), 40],
    [1034, V(18.5, 5.4, 16.5), V(12.4, 2.8, 3), 40],
    // At dusk, a slow turn to the tile works.
    [1120, V(15, 6.2, 17.5), V(-35, 8, -105), 50],
    // 5. Over the village to the tile works, and down over shed A's kiln.
    // High up, so the ground passes slowly even though the way is long.
    [1200, V(-12, 36, -48), V(-42, 2, -106), 45],
    [1266, V(KILN.x + 2, 26, KILN.z + 15), V(KILN.x, KILN.y, KILN.z), 36],
    // Straight down (the target a hair north, so screen-up is world -Z, as
    // the kiln drawing has it). Its height is solved each frame.
    [1312, V(KILN.x, 12, KILN.z + 0.001), V(KILN.x, KILN.y, KILN.z), END_FOV],
    [T6.END, V(KILN.x, 12, KILN.z + 0.001), V(KILN.x, KILN.y, KILN.z), END_FOV],
  ];
  const camPos = new THREE.Vector3(); const camTgt = new THREE.Vector3();
  const _m0 = new THREE.Vector3(); const _m1 = new THREE.Vector3(); const _d = new THREE.Vector3();

  /**
   * The tangent at key i, per vh of scroll: the neighbours' difference over
   * the neighbours' time apart. Measured in scroll, not per segment, so the
   * camera's speed carries smoothly across every key instead of easing to a
   * stop and lunging off again at each one. Still at the first and last key.
   */
  function slope(i, f, out) {
    if (i <= 0 || i >= KEYS.length - 1) return out.set(0, 0, 0);
    const a = KEYS[i - 1]; const b = KEYS[i]; const c = KEYS[i + 1];
    // A key that starts or ends a hold is a place to come to rest: arriving
    // there still moving and then stopping dead is the jolt you feel.
    if (a[f].distanceToSquared(b[f]) < 1e-6 || b[f].distanceToSquared(c[f]) < 1e-6) return out.set(0, 0, 0);
    return out.copy(c[f]).sub(a[f]).divideScalar(c[0] - a[0]);
  }
  /** Cubic Hermite along one field (1 position, 2 target) of segment i. */
  function along(i, f, t, out) {
    const b = KEYS[i]; const c = KEYS[i + 1]; const span = c[0] - b[0];
    slope(i, f, _m0).multiplyScalar(span);
    slope(i + 1, f, _m1).multiplyScalar(span);
    // Never more than the segment's own length: no overshoot (no diving
    // through a roof between a wide shot and a close-up).
    const chord = _d.copy(c[f]).sub(b[f]).length() * 1.2;
    if (_m0.length() > chord) _m0.setLength(chord);
    if (_m1.length() > chord) _m1.setLength(chord);
    const t2 = t * t; const t3 = t2 * t;
    return out.copy(b[f]).multiplyScalar(2 * t3 - 3 * t2 + 1)
      .addScaledVector(_m0, t3 - 2 * t2 + t)
      .addScaledVector(c[f], -2 * t3 + 3 * t2)
      .addScaledVector(_m1, t3 - t2);
  }
  function placeCamera(s) {
    // The last two keys sit at the height where the shed floor shows exactly
    // the ring camera's frame; it changes with the window's shape.
    const kh = KILN.y + kilnHeight();
    KEYS[KEYS.length - 1][1].y = kh; KEYS[KEYS.length - 2][1].y = kh;
    let i = KEYS.findIndex((k) => k[0] > s) - 1;
    if (i < 0) i = s < KEYS[0][0] ? 0 : KEYS.length - 2;
    const b = KEYS[i]; const c = KEYS[i + 1];
    const t = clamp01((s - b[0]) / (c[0] - b[0]));
    along(i, 1, t, camPos);
    along(i, 2, t, camTgt);
    camera.position.copy(camPos);
    camera.lookAt(camTgt);
    camera.fov = lerp(b[3], c[3], t * t * (3 - 2 * t));
    camera.updateProjectionMatrix();
  }

  // --------------------------------------------------------------- the frame
  const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e3 = new THREE.Euler();
  const pos = new THREE.Vector3(); const scl = new THREE.Vector3(); const mul = new THREE.Color();
  const a3 = new THREE.Vector3(); const b3 = new THREE.Vector3(); const c3 = new THREE.Vector3();
  const EDGE = new THREE.Vector3(2.25, ROOF_TOP + 0.6, 4.35);
  const DOOR = new THREE.Vector3(2.25, 0.9, 5.2);

  /** Where a nut is on its way from the roof, over the edge, in at the door. */
  function pour(n, t, out) {
    if (t < 0.45) {
      const u = t / 0.45;
      a3.copy(n.home); b3.set(n.home.x, ROOF_TOP + 1.2, n.home.z);
      out.copy(a3).multiplyScalar((1 - u) ** 2).addScaledVector(b3, 2 * u * (1 - u)).addScaledVector(EDGE, u * u);
    } else {
      const u = (t - 0.45) / 0.55;
      b3.set(2.25, 0.9, 6.0); c3.copy(n.inside);
      // Over the edge and down, then in at the door to its place.
      a3.copy(EDGE).multiplyScalar((1 - u) ** 3).addScaledVector(b3, 3 * u * (1 - u) ** 2).addScaledVector(DOOR, 3 * u * u * (1 - u)).addScaledVector(c3, u ** 3);
      out.copy(a3);
    }
    return out;
  }

  /** How dry the hero's batches are. */
  function heroDry(s, batch2) {
    if (!batch2) return prog(P.ROOF_DAYS, s);
    const roofDays = 3 * prog(P.NEXT_DAYS, s);
    const inDays = 42 * prog(P.IN_DAYS, s);
    return roofDays / 14 + (inDays / 42) * (1 - 3 / 14);
  }

  function placeNuts(s) {
    // The village's own rain front is gone: there is one rain, and it is
    // the hero's (P.RAIN). Kept switchable, off.
    const sweepOn = false;
    for (let i = 0; i < nuts.length; i++) {
      const n = nuts[i];
      let k = 1; let lift = 0; let dry; let spoil = 0;
      pos.copy(n.home);
      // Taken up as the rain comes, put back once it has passed; in the
      // village's rain the front crosses from left to right.
      const sweepGo = sweepOn ? smooth(P.SWEEP[0] + n.xf * 34 + n.seed * 4, P.SWEEP[0] + n.xf * 34 + n.seed * 4 + 5, s) : 0;
      const sweepBack = sweepOn ? smooth(P.CLEAR[0] + n.xf * 22 + n.seed * 4, P.CLEAR[0] + n.xf * 22 + n.seed * 4 + 5, s) : 0;
      const village = 1 - sweepGo + sweepBack;
      if (n.r === 0) {
        const grow = smooth(P.NUTS_IN[0] + n.dist * 40, P.NUTS_IN[0] + n.dist * 40 + 10, s);
        const up = smooth(P.NEXT[0] + n.seed * 7, P.NEXT[0] + n.seed * 7 + 5, s);
        const down = smooth(P.NEXT[0] + 10 + n.seed * 7, P.NEXT[0] + 10 + n.seed * 7 + 5, s);
        if (down <= 0) {
          k = grow * (1 - up); lift = up * 0.5; dry = heroDry(s, false);
        } else if (s < P.BACK_OUT[0]) {
          dry = heroDry(s, true);
          k = down;
          if (n.spoils) {
            spoil = smooth(P.SPOIL[0] + n.seed * 6, P.SPOIL[1], s);
            k *= 1 - smooth(P.WALL[2], P.WALL[3], s);
          } else {
            const t = smooth(P.INDOORS[0] + n.seed * 26, P.INDOORS[0] + n.seed * 26 + 12, s);
            if (t > 0) pour(n, t, pos);
            k *= 1 - smooth(P.WALL[2], P.WALL[3] - 6, s) * (t > 0.99 ? 1 : 0);
          }
        } else {
          dry = ROOFS[0].dry;
          k = smooth(P.BACK_OUT[0] + n.seed * 14, P.BACK_OUT[0] + n.seed * 14 + 6, s) * clamp01(village);
          lift = (1 - clamp01(village)) * 0.4;
        }
      } else {
        dry = ROOFS[n.r].dry;
        const go = smooth(P.INDOORS[0] + n.seed * 20, P.INDOORS[0] + n.seed * 20 + 6, s);
        const back = smooth(P.BACK_OUT[0] + n.seed * 14, P.BACK_OUT[0] + n.seed * 14 + 6, s);
        k = clamp01(1 - go + back) * clamp01(village);
        lift = (1 - k) * 0.4;
      }
      pos.y += lift;
      // Drying shrinks a nut a little and darkens it to brown.
      const shrink = 1 - 0.12 * dry;
      scl.set(k * shrink * 1.02, k * shrink, k * shrink);
      e3.set(n.tilt, n.yaw, n.tilt * 0.5);
      q.setFromEuler(e3);
      m4.compose(pos, q, scl);
      nutMesh.setMatrixAt(i, m4);
      mul.copy(n.tone).lerp(DRIED, smooth(0, 1, dry)).lerp(SPOILT, spoil);
      nutMesh.setColorAt(i, mul);
    }
    nutMesh.instanceMatrix.needsUpdate = true;
    nutMesh.instanceColor.needsUpdate = true;

    // The first nut: falls in, settles on the roof, opens for the test, and
    // goes in at the door with the rest.
    const drop = smooth(P.DROP[0], P.DROP[1], s);
    const bounce = Math.sin(Math.PI * clamp01((s - P.DROP[1] + 6) / 8)) * 0.04 * (s > P.DROP[1] - 6 ? 1 : 0);
    pos.copy(HERO_SLOT);
    pos.y += (1 - drop) * 1.7 + bounce;
    const batch2 = smooth(P.NEXT[0] + 10, P.NEXT[0] + 16, s);
    const t = smooth(P.INDOORS[0] + 12, P.INDOORS[0] + 24, s);
    if (t > 0) pour({ home: HERO_SLOT, inside: new THREE.Vector3(0.4, 0.72, 0.6) }, t, pos);
    heroNut.position.copy(pos);
    heroNut.rotation.set(0, 0.25 + (1 - drop) * 2.2, 0);
    const dry = batch2 > 0 ? heroDry(s, true) : heroDry(s, false);
    const sh = (1 - 0.12 * dry) * (1 - smooth(P.WALL[2], P.WALL[3] - 6, s));
    heroNut.scale.setScalar(Math.max(0.0001, sh));
    heroMul.setRGB(1, 1, 1).lerp(DRIED, dry);
    halves.forEach((h) => h.outer.material.color.copy(heroMul));
    const open = bump(P.PEEL[0] + 6, P.PEEL[1], P.NEXT[0] - 12, P.NEXT[0], s);
    // The front half falls open towards the camera.
    halves[0].pivot.rotation.x = 1.0 * open;
    halves[1].pivot.rotation.x = -0.3 * open;
    halves[0].pivot.position.set(0, 0, 0.03 * open);
    kernel.visible = open > 0.01;
  }

  function placeTray(s) {
    const out = smooth(P.OUT[0], P.OUT[1], s);
    const inn = smooth(P.IN[0], P.IN[1], s);
    const dry = prog(P.TRAY_DRY, s) * 0.8;
    trayNuts.forEach((n, i) => {
      const slide = n.fresh ? (1 - inn) * 4 : out * 4;
      const k = n.fresh ? inn : 1 - out;
      pos.set(n.x + slide, 1.03, n.z);
      e3.set(0, n.yaw, 0); q.setFromEuler(e3);
      scl.setScalar(Math.max(0.0001, k * (n.fresh ? 1 : 1 - 0.1 * dry)));
      m4.compose(pos, q, scl);
      trayMesh.setMatrixAt(i, m4);
      mul.setRGB(1, 1, 1).lerp(DRIED, n.fresh ? 0 : dry);
      trayMesh.setColorAt(i, mul);
    });
    trayMesh.instanceMatrix.needsUpdate = true;
    trayMesh.instanceColor.needsUpdate = true;
  }

  // ------------------------------------------------------------- the scroll
  function measure() {
    const top = sectionEl.getBoundingClientRect().top;
    const scrolled = -top / window.innerHeight * 100;
    const scrollable = sectionEl.offsetHeight - window.innerHeight;
    const done = scrollable > 0 && -top / scrollable >= 0.999;
    return { scrolled, done };
  }

  let sv = null;            // the scroll, followed through a spring
  let sVel = 0;             // and its speed, in vh per second
  let last = performance.now();
  let clock = 0;
  const tint = new THREE.Color(); const sunWarm = new THREE.Color();
  const v = new THREE.Vector3();

  function update() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    clock += dt;
    const { scrolled: target } = measure();
    const on = target > -2 && target < total + 1;
    pin.style.visibility = on ? 'visible' : 'hidden';
    if (!on) { sv = null; return; }
    // The scroll is followed by a critically damped spring (position and
    // velocity), not a plain ease: a plain ease jumps to full speed the
    // instant the wheel turns, which is the jolt you feel. This one gathers
    // speed and lets it go, so a burst of wheel-notches becomes one glide.
    if (sv === null || Math.abs(target - sv) > 160) { sv = target; sVel = 0; }
    const W = 3.2;                                   // stiffness: ~1 s to settle
    for (let k = 0, n = Math.ceil(dt / 0.008); k < n; k++) {
      const h = dt / n;
      sVel += (W * W * (target - sv) - 2 * W * sVel) * h;
      sv += sVel * h;
    }
    const s = sv;

    const w = pin.clientWidth; const h = pin.clientHeight;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
    }

    // ---- weather and light
    const cover = smooth(P.COVER[0], P.COVER[1], s);
    const dawn = smooth(P.DAWN[0], P.DAWN[1], s);
    const cloud = Math.max(bump(P.CLOUD[0], P.CLOUD[1], 800, 830, s));
    const wet = Math.max(bump(P.RAIN[0], P.RAIN[0] + 12, P.RAIN[1] - 14, P.RAIN[1], s));
    const dusk = smooth(P.DUSK[0], P.DUSK[1], s);
    world.visible = cover > 0.995;

    // The days pass without blinking. Each day used to be a quick dimming
    // into night and back, with the sun snapping east again every morning:
    // fourteen of those in a few screens of scroll read as flicker. Now the
    // light holds steady (the day count says the days go by, and the nuts
    // darken), and the sun drifts once, slowly, across the whole run of
    // days and back, so the nuts' shadows turn smoothly as the time passes.
    // With no days running it sits exactly where the bake's sun is.
    const drift = 0.7 * Math.sin(Math.PI * prog(P.ROOF_DAYS, s)) + 0.35 * Math.sin(Math.PI * prog(P.NEXT_DAYS, s));
    sun.position.copy(SUN_DIR).applyAxisAngle(UP, drift).multiplyScalar(60).add(sun.target.position);
    sun.intensity = 2.6 * lerp(1, 0.35, cloud) * lerp(1, 0.6, dusk);
    hemi.intensity = 1.15 * lerp(1, 0.85, cloud) * lerp(1, 0.6, dusk);
    sunWarm.setRGB(1, 0.95, 0.88).lerp(TINT.dusk, dusk * 0.6);
    sun.color.copy(sunWarm);

    // The whole bake, tinted for the hour and the weather.
    const paper = smooth(P.PAPER[0], P.PAPER[1], s);
    tint.copy(TINT.day).lerp(TINT.rain, cloud).lerp(TINT.dusk, dusk).lerp(TINT.paper, paper);
    for (const m of baked) m.color.copy(tint);
    // The backdrop is the opening shot's yard clay, out of the purple.
    bg.copy(BG.purple).lerp(BG.yard, dawn).lerp(BG.rain, cloud).lerp(BG.dusk, dusk).lerp(BG.paper, paper);
    renderer.setClearColor(bg, cover);
    scene.fog.color.copy(bg);
    // Dense at first, so the world comes out of the purple as it thins.
    // In the rain the haze closes in; once the camera is up over the village
    // it thins, so the tile works can be seen firing through it.
    const haze = smooth(620, 690, s);
    scene.fog.near = lerp(lerp(0.2, 60, dawn * dawn), lerp(18, 45, haze), cloud);
    scene.fog.far = lerp(lerp(0.9, 340, dawn * dawn), lerp(150, 300, haze), cloud);

    clouds.forEach((c) => {
      const u = c.userData;
      c.position.set(((u.x + clock * u.v * 3 + 110) % 220) - 110, u.y, u.z);
      c.material.opacity = cloud * 0.85;
    });

    rainMat.opacity = wet * 0.55;
    rain.visible = wet > 0.01;
    if (rain.visible) {
      camera.getWorldDirection(v);
      const cx = camTgt.x; const cz = camTgt.z;
      const span = s > 590 ? 90 : 30;
      for (let i = 0; i < RAIN_N; i++) {
        const x = cx + (rainSeed[i * 3] - 0.5) * span;
        const z = cz + (rainSeed[i * 3 + 1] - 0.5) * span;
        const y = 30 - ((clock * 22 + rainSeed[i * 3 + 2] * 30) % 30);
        rainPos.set([x, y, z, x - 0.08, y - 0.55, z], i * 6);
      }
      rainGeo.attributes.position.needsUpdate = true;
    }

    // ---- the house opens to show the room
    const wall = bump(...P.WALL, s);
    if (front) {
      front.material.opacity = 1 - 0.92 * wall;
      front.material.depthWrite = wall < 0.5;
    }

    // ---- the tile works: always firing, rain or shine
    smoke.forEach((sp, i) => {
      const u = ((clock * 0.04 + i / smoke.length) % 1);
      sp.position.set(Math.sin(i * 1.7) * 1.5 + u * 10, u * 20, Math.cos(i * 1.3) * 1.5 - u * 2);
      sp.scale.setScalar(3 + u * 12);
      sp.material.opacity = 0.42 * Math.sin(Math.PI * u);
    });

    // ---- the dryer
    const dryerIn = smooth(P.DRYER_IN[0], P.DRYER_IN[1], s);
    dryer.visible = dryerIn > 0.001;
    contact.visible = dryer.visible;
    if (dryer.visible) {
      // It rises out of the ground into place, piece by piece read as one.
      dryer.position.y = (1 - dryerIn) * -3.2;
      contact.material.opacity = dryerIn;
      const stop = smooth(P.STOP[0], P.STOP[1], s);
      const relight = smooth(P.RELIGHT[0], P.RELIGHT[1], s);
      const running = smooth(P.AIR[0], P.AIR[1], s) * clamp01(1 - stop + relight);
      const flicker = 0.85 + 0.15 * Math.sin(clock * 11) * Math.sin(clock * 7.3);
      fireLight.intensity = 22 * running * flicker * dryerIn;
      fireMat.color.setRGB(lerp(0.25, 1, running), lerp(0.2, 0.45, running) * flicker, lerp(0.18, 0.1, running));
      airMat.opacity = running;
      for (let i = 0; i < AIR_N; i++) {
        const [o, j1, j2] = airSeed[i];
        const u = (o + clock * 0.09) % 1;
        airPath.getPointAt(u, v);
        const spread = 0.12 + 0.5 * smooth(0.8, 1, u);
        airPos.set([v.x + j1 * spread, v.y + j2 * spread * 0.6, v.z + (j1 - j2) * spread], i * 3);
      }
      airGeo.attributes.position.needsUpdate = true;
      doorPivot.rotation.y = 1.25 * smooth(P.DOOR_OPEN[0], P.DOOR_OPEN[1], s) * (1 - smooth(P.DOOR_SHUT[0], P.DOOR_SHUT[1], s));
      placeTray(s);
    }

    placeNuts(s);
    placeCamera(s);
    // ---- 5. the cut, then the hand-over to the kiln drawing underneath
    cut.constant = lerp(11, 1.2, smooth(P.CUT[0], P.CUT[1], s));
    if (s > P.LINES[0] - 10 && !kilnLines) buildKilnLines();
    if (kilnLines) {
      const k = smooth(P.LINES[0], P.LINES[1], s);
      kilnLines.visible = k > 0;
      kilnLines.geometry.setDrawRange(0, Math.round(k * kilnLines.userData.count) * 2);
      inkMat.opacity = Math.min(1, k * 3);
    }
    const hand = smooth(P.HAND[0], P.HAND[1], s);
    canvas.style.opacity = (1 - hand).toFixed(3);
    if (hand < 1) renderer.render(scene, camera);

    // ---- the words and slips
    scrim.style.opacity = (smooth(P.DAWN[0], P.DAWN[1], s) * (1 - 0.7 * paper)).toFixed(3);

    // The drawing at the size the camera landed at. The tour resets the zoom
    // each frame when it is not on screen; this runs after it, so it holds.
    if (s > P.CUT[0]) ring.setZoom(KILN_ZOOM);

    // The chamber numbers, placed on the kiln drawing as logic.js places them.
    const numsA = smooth(P.NUMS[0], P.NUMS[1], s);
    back.style.visibility = numsA > 0 || s > P.TRAY[0] ? 'visible' : 'hidden';
    if (numsA > 0) {
      nums.forEach((n, i) => {
        v.copy(ring.chamberPoint(i)).project(ring.camera);
        const x = (v.x * 0.5 + 0.5) * w; const y = (-v.y * 0.5 + 0.5) * h;
        const k = smooth(P.NUMS[0] + i * 1.6, P.NUMS[0] + i * 1.6 + 8, s);
        n.style.opacity = (k * (1 - smooth(T6.JOIN[0], T6.MORPH[0], s))).toFixed(3);
        n.style.transform = `translate(${x.toFixed(1)}px, ${(y + (1 - k) * 10).toFixed(1)}px) translate(-50%, -50%)`;
      });
    } else nums.forEach((n) => { n.style.opacity = '0'; });
    // The tray: the five ideas, in from the left one after another.
    tray.style.opacity = smooth(P.TRAY[0] - 2, P.TRAY[0] + 6, s).toFixed(3);
    terms.forEach((t, i) => {
      const k = smooth(P.TRAY[0] + i * 5, P.TRAY[0] + i * 5 + 12, s);
      t.style.opacity = k.toFixed(3);
      // In from the right, where the column stands.
      t.style.transform = `translateX(${((1 - k) * 14).toFixed(1)}px)`;
    });
    transform.update(s, w, h);
    copy.forEach(({ at: [a0, a1, b0, b1], node, words, srcNode }) => {
      const out = smooth(b0, b1, s);
      const vis = s > a0 - 2 && out < 1;
      node.style.visibility = vis ? 'visible' : 'hidden';
      if (!vis) return;
      const n = words.length;
      const span = (a1 - a0) * 0.55;
      words.forEach((wd, i) => {
        const k = smooth(a0 + span * i / n, a0 + span * i / n + (a1 - a0) * 0.45, s);
        wd.style.opacity = (k * (1 - out)).toFixed(3);
        wd.style.transform = `translateY(${((1 - k) * 0.5 - out * 0.3).toFixed(3)}em)`;
      });
      if (srcNode) srcNode.style.opacity = (smooth(a1 - 4, a1 + 4, s) * (1 - out)).toFixed(3);
      // The slip: in just ahead of the first word, out with the last.
      node.style.opacity = (smooth(a0 - 3, a0 + 5, s) * (1 - out)).toFixed(3);
      // A term card rises in whole.
      if (!words.length) node.style.transform = `translateY(${((1 - smooth(a0, a1, s)) * 12 - out * 8).toFixed(1)}px)`;
    });

    const dayA = bump(P.ROOF_DAYS[0] - 10, P.ROOF_DAYS[0], P.BARS[1] + 30, P.BARS[1] + 44, s);
    dayEl.style.opacity = dayA.toFixed(3);
    if (dayA > 0) {
      const second = s >= P.NEXT[0] + 10;
      const d1 = 14 * prog(P.ROOF_DAYS, s);
      const d2 = 3 * prog(P.NEXT_DAYS, s) + 42 * prog(P.IN_DAYS, s);
      const d = second ? d2 : d1;
      dayN.textContent = `Day ${Math.max(1, Math.ceil(d))}`;
      dayWhere.textContent = second
        ? `next batch, ${s > P.INDOORS[0] + 14 ? 'indoors' : 'on the roof'}`
        : (d1 >= 14 ? 'dry' : 'on the roof');
    }
    const barK = prog(P.BARS, s);
    barsEl.style.opacity = bump(P.BARS[0] - 4, P.BARS[0] + 6, 586, 600, s).toFixed(3);
    fills.roof.style.transform = `scaleX(${smooth(0, 0.45, barK).toFixed(3)})`;
    fills.in.style.transform = `scaleX(${smooth(0.3, 0.85, barK).toFixed(3)})`;
    fills.range.style.transform = `scaleX(${smooth(0.78, 1, barK).toFixed(3)})`;

    LABELS.forEach(({ at, show, node }) => {
      const a = show(s);
      if (a <= 0.001) { node.style.opacity = '0'; return; }
      v.copy(at);
      if (at.x > 9 && at.x < 16) v.y += dryer.position.y;
      v.project(camera);
      const x = (v.x * 0.5 + 0.5) * w; const y = (-v.y * 0.5 + 0.5) * h;
      node.style.opacity = (v.z < 1 ? a : 0).toFixed(3);
      node.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    });
  }

  /**
   * The kiln the ring should draw during the return, or null: the recorded
   * loop's first moment until the lap, then one lap of the fire scrubbed by
   * scroll (as the tour's fire step does), resting on its last moment.
   */
  function kilnFrame() {
    if (sv === null || sv < P.CUT[0]) return null;
    return run.at(Math.min(run.totalHours - 1e-6, run.totalHours * prog(P.LAP, sv)));
  }

  return {
    update,
    kilnFrame,
    /** True once scrolled to the very end: time for the dashboard. */
    isDone: () => measure().done,
  };
}
