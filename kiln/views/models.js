/**
 * models.js — one loader for the baked models, shared by every view.
 *
 * The opening shot (views/intro.js) and the drying story (views/problem.js)
 * both draw assets/factory.glb. Each used to load and decode it for itself,
 * so its textures were decoded twice. Here a model is fetched and parsed
 * once, and every view gets the same result.
 *
 * The GLBs are optimised by tools/optimize-models.cjs: meshopt-compressed
 * geometry (decoded by vendor/libs/meshopt_decoder.module.js, vendored, so
 * the exhibition laptop needs no network) and quantized normals and UVs.
 *
 * `meshes` is the model's meshes as they were loaded, listed before any view
 * touches the scene: intro.js hangs edge lines and depth-only meshes off the
 * factory's meshes, and a view arriving later must not pick those up.
 */

import { GLTFLoader } from '../vendor/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../vendor/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();
// How far each download has got (0..1), and who is listening: the splash
// screen (splash.js) fills its kiln from the opening model's bytes.
const progress = new Map();

/**
 * @param {string} url
 * @param {(fraction: number) => void} [onProgress]  download progress, 0..1.
 *   Called at once with how far it already is, so a second caller (or one
 *   arriving after the file is cached) still hears the current state.
 * @returns {Promise<{ gltf: object, meshes: object[], textures: object[] }>}
 */
export function loadModel(url, onProgress) {
  if (!cache.has(url)) {
    const entry = { fraction: 0, listeners: new Set() };
    progress.set(url, entry);
    const report = (f) => {
      entry.fraction = Math.max(entry.fraction, Math.min(1, f));
      for (const fn of entry.listeners) fn(entry.fraction);
    };
    cache.set(url, loader.loadAsync(url, (ev) => {
      if (ev.lengthComputable && ev.total > 0) report(ev.loaded / ev.total);
    }).then((gltf) => {
      report(1);
      const meshes = [];
      gltf.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
      const textures = [...new Set(meshes.map((m) => m.material.map).filter(Boolean))];
      return { gltf, meshes, textures };
    }));
  }
  if (onProgress) {
    const entry = progress.get(url);
    entry.listeners.add(onProgress);
    onProgress(entry.fraction);
  }
  return cache.get(url);
}

/**
 * Send textures to the GPU one at a time, a frame or an idle moment apart,
 * instead of all in the first frame that draws them. A baked texture is
 * 2048 or 4096 pixels square, and copying it up stalls the main thread
 * (texSubImage2D): ten of them in one frame froze the page for over a second.
 *
 * `when` waits between textures: nextFrame for something about to be shown,
 * idle for something further down the page.
 */
export async function warmTextures(renderer, textures, when = nextFrame) {
  for (const tex of textures) {
    await when();
    renderer.initTexture(tex);
  }
}

export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

export const idle = () => new Promise((r) => {
  if ('requestIdleCallback' in window) requestIdleCallback(() => r(), { timeout: 1500 });
  else setTimeout(r, 120);
});

/**
 * Compile every shader a scene will need, hidden parts included, without
 * drawing it. The drying story keeps most of its world hidden until the
 * scroll reaches it, and each part compiled its shaders on the frame it first
 * appeared (ten or more at once at three points in the scroll).
 *
 * Hidden objects are shown only for the synchronous part of compileAsync,
 * where three collects the materials, and hidden again before any frame can
 * draw; the linking itself finishes in the background where the browser
 * supports KHR_parallel_shader_compile.
 */
export function warmShaders(renderer, scene, camera) {
  const hidden = [];
  scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
  let done;
  try { done = renderer.compileAsync(scene, camera); } catch (err) { done = Promise.reject(err); }
  finally { for (const o of hidden) o.visible = false; }
  return done.catch(() => { /* compiled on first draw instead */ });
}
