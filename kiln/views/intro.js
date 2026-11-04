/**
 * views/intro.js — the opening sequence.
 *
 * Owns its own three.js scene, camera and renderer on #intro-canvas. This is
 * a VIEW in the same sense ring.js is one (brief section 10: views read state
 * and draw it, they hold no kiln rules) — except what it reads is scroll
 * progress, not engine state, because it has nothing to do with the kiln
 * simulation. engine.js never touches it and it never dispatches an action.
 *
 * THE BUILDING
 * A real model — the Prabhakar Tile Works compound — built in Blender to
 * match the reference renders (the long signed shed A with its run of hipped
 * Mangalore-tile roofs, the entry porch, the rear sheds and house, laterite
 * compound wall, gate, truck, palms, power line), exported as
 * ./assets/factory.glb and loaded here with three's GLTFLoader. This
 * replaces the earlier hand-built procedural shed (views/building.js, still
 * in the repo but unused now).
 *
 * BAKED, NOT LIT
 * The Blender materials are procedural (noise, colour ramps, a UV-driven
 * tile pattern), which glTF cannot carry. So the model is baked: Cycles
 * renders each surface's colour and its lighting — sun, sky, shadows,
 * bounce, contact darkening — into a texture atlas per group (ground,
 * roofs, buildings, compound wall, greenery, truck), and the GLB ships those
 * atlases with KHR_materials_unlit. The palm fronds get one shared RGBA
 * texture with an alpha cut-out instead.
 *
 * That is a deliberate exception to brief section 9 ("flat surfaces; no
 * gradients or shadows for decoration") for this opening shot only: the
 * establishing view is meant to read as the real place. The ring view and
 * the dashboard stay flat.
 *
 * Because the light is already IN the textures, this scene still has no
 * lights: on load every mesh gets a plain MeshBasicMaterial carrying the
 * same texture (or flat colour), unlit. Adding a light here would light the
 * model twice.
 *
 * THE SHAPE OF THE SEQUENCE (progress 0 -> 1, driven by scroll — see
 * `sectionProgress()`)
 *   0.00 - 0.25  establishing shot holds; .intro-copy (title/tag) fades out
 *   0.00 - 0.40  camera orbits around the building (azimuth only)
 *   0.40 - 0.80  camera pitches toward top-down and the FOV collapses,
 *                settling into the same kind of flattened, near-orthographic
 *                framing ring.js's own camera uses for the kiln cutaway —
 *                not a literal shared camera (this is a separate scene/
 *                canvas), but a matched COMPOSITION, so the crossfade below
 *                doesn't jump in apparent scale or angle
 *   0.80 - 1.00  the building's materials fade to transparent, revealing
 *                #ring-canvas — already rendering, already fixed to the
 *                viewport underneath this one (style.css, body.pre-reveal)
 *
 * The numbers in ORBIT are a starting point, tuned by eye against the actual
 * compound (52 x 48m inside the wall; the building cluster 50 x 27m and 10m
 * to the tallest ridge; shed A 31 x 14m) — a camera move, not a simulated
 * quantity, and has no business in config.js.
 */

import * as THREE from 'three';
import { PALETTE } from '../config.js';
import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';

// Carries this module's own ?v= stamp (set by the import map in index.html),
// so re-baking factory.glb under the same name can't be masked by a cached copy.
const MODEL_URL = './assets/factory.glb' + new URL(import.meta.url).search;

const ORBIT = {
  // The opening frame is Blender's Cam_Overview converted to this orbit's
  // terms (the same aerial three-quarter the reference render was drawn
  // from): ~85m out, 35deg up, looking across the yard at the signed facade.
  // The orbit then swings round to face the facade square-on (0.5 PI is the
  // +Z side, where the yard and gate are) so the top-down settle that follows
  // lands with shed A's long axis running across the screen, like the ring.
  startAzimuth: Math.PI * 0.70,
  endAzimuth: Math.PI * 0.50,
  startElevation: THREE.MathUtils.degToRad(15),
  endElevation: THREE.MathUtils.degToRad(87),
  startRadius: 70,
  // Shed A (31m long) at ~75% of a 16:10 viewport's width under endFov —
  // the same share of the width the kiln ring takes in ring.js's view, so
  // the crossfade lands on matching scale. Measured to the ridge, ~7m up.
  endRadius: 35,
  startFov: 33,
  endFov: 28,
};

// The camera's target moves during the settle: the opening shot aims at the
// yard just in front of the facade (Cam_Overview's own aim point), the end
// shot at the middle of shed A — the long building the kiln ring is revealed
// inside. Coordinates are the GLB's own (Y-up; Blender's -Y is +Z here).
const LOOK_AT_START = new THREE.Vector3(-1.7, 10.0, 1.4);
const LOOK_AT_END = new THREE.Vector3(-16, 0.0, -6.2);
const lookAt = new THREE.Vector3();

const ORBIT_END = 0.4;      // orbit (phase 1) runs across progress 0-0.4
const SETTLE_END = 0.8;     // pitch/dolly/FOV (phase 2) runs across 0.4-0.8
const TEXT_FADE_END = 0.25; // .intro-copy is gone well before the camera settles

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

/** Progress through the pinned range: 0 at the top, 1 once scrolled past it. */
function sectionProgress(sectionEl) {
  const scrollable = sectionEl.offsetHeight - window.innerHeight;
  if (scrollable <= 0) return 1;
  const p = -sectionEl.getBoundingClientRect().top / scrollable;
  return Math.min(1, Math.max(0, p));
}

export function createIntro({ sectionEl, canvas, copyEl }) {
  // alpha: true, and the clear alpha is animated to 0 alongside the building
  // in update() below — the crossfade needs the CANVAS ITSELF to end up
  // transparent, not just the building drawn on it. An opaque canvas clearing
  // to solid colour every frame would hide #ring-canvas underneath regardless
  // of what's drawn on top of it. The colour is the yard's own beige (see
  // PALETTE.yard), so the fade dissolves the ground into the dashboard's soot.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  const clearColour = new THREE.Color(PALETTE.yard);
  renderer.setClearColor(clearColour, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(ORBIT.startFov, 1, 0.1, 400);

  let building = null;
  const buildingMaterials = [];

  new GLTFLoader().load(
    MODEL_URL,
    (gltf) => {
      building = gltf.scene;
      const maxAniso = renderer.capabilities.getMaxAnisotropy();
      building.traverse((child) => {
        if (!child.isMesh) return;
        const src = child.material;
        // Roof tiles are seen at grazing angles for most of the orbit; without
        // anisotropic filtering the atlas mips smear them into flat orange.
        if (src.map) src.map.anisotropy = maxAniso;
        const flat = new THREE.MeshBasicMaterial({
          map: src.map || null,
          color: src.map ? 0xffffff : (src.color ? src.color.clone() : 0xffffff),
          // palm fronds: alphaMode MASK in the GLB -> alphaTest here, or the
          // leaflet cut-outs render as solid green cards
          alphaTest: src.alphaTest || 0,
          side: src.side,
        });
        child.material = flat;
        buildingMaterials.push(flat);
      });
      scene.add(building);
    },
    undefined,
    (err) => console.error('[intro] factory.glb failed to load:', err),
  );

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function setBuildingOpacity(v) {
    buildingMaterials.forEach((m) => {
      m.transparent = true;
      m.opacity = v;
    });
  }

  let donePainting = false;

  function update() {
    const p = sectionProgress(sectionEl);

    const orbitT = easeInOut(Math.min(1, p / ORBIT_END));
    const azimuth = THREE.MathUtils.lerp(ORBIT.startAzimuth, ORBIT.endAzimuth, orbitT);

    const settleT = easeInOut(Math.min(1, Math.max(0, (p - ORBIT_END) / (SETTLE_END - ORBIT_END))));
    const elevation = THREE.MathUtils.lerp(ORBIT.startElevation, ORBIT.endElevation, settleT);
    const radius = THREE.MathUtils.lerp(ORBIT.startRadius, ORBIT.endRadius, settleT);
    camera.fov = THREE.MathUtils.lerp(ORBIT.startFov, ORBIT.endFov, settleT);
    camera.updateProjectionMatrix();

    lookAt.lerpVectors(LOOK_AT_START, LOOK_AT_END, settleT);
    camera.position.set(
      lookAt.x + radius * Math.cos(elevation) * Math.cos(azimuth),
      lookAt.y + radius * Math.sin(elevation),
      lookAt.z + radius * Math.cos(elevation) * Math.sin(azimuth),
    );
    camera.lookAt(lookAt);

    const fadeT = Math.min(1, Math.max(0, (p - SETTLE_END) / (1 - SETTLE_END)));
    if (building) setBuildingOpacity(1 - fadeT);
    // The canvas's own backdrop fades out with the building, not just the
    // building's materials — see the note on `alpha: true` above.
    renderer.setClearColor(clearColour, 1 - fadeT);

    if (copyEl) {
      copyEl.style.opacity = String(Math.max(0, 1 - p / TEXT_FADE_END));
    }

    // Once fully faded there is nothing left to paint; skip the draw call
    // rather than rendering an invisible building every frame indefinitely.
    const stillVisible = fadeT < 1 || !building;
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
  };
}
