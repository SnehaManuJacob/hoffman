#!/usr/bin/env node
/**
 * Optimise the baked GLBs for the web, from the untouched Blender exports.
 *
 *   node tools/optimize-models.cjs <in.glb> <out.glb>
 *
 * Needs the gltf-transform CLI installed globally (npm i -g @gltf-transform/cli),
 * which brings @gltf-transform/*, sharp and meshoptimizer with it:
 *   NODE_PATH=$(npm root -g)/@gltf-transform/cli/node_modules node tools/optimize-models.cjs ...
 *
 * What it does, and why each step is safe for this site:
 *
 * 1. Textures that are larger than the screen can show are halved, by name.
 *    Each was checked by rendering the page at 2x before and after: only the
 *    ones with no visible change are in TEXTURE_SIZE. The woven mat, the sign
 *    and anything not listed keep their full resolution. Halving a texture
 *    quarters its GPU upload, which is what froze the page (texSubImage2D:
 *    ~125 ms per 4096 texture, all in one frame).
 * 2. Normals and UVs are quantized (KHR_mesh_quantization). POSITIONS ARE NOT:
 *    views/problem.js bakes each node's world matrix into a clone of its
 *    geometry, which a normalised int16 position attribute cannot hold.
 * 3. Meshopt compression (EXT_meshopt_compression) on the vertex and index
 *    buffers; decoded in the browser by vendor/libs/meshopt_decoder.module.js.
 * Node names, materials and scene extras (areca_bunches) are kept: the views
 * find meshes by name.
 */
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS, EXTMeshoptCompression } = require('@gltf-transform/extensions');
const { dedup, prune, quantize, reorder } = require('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptDecoder } = require('meshoptimizer');
const sharp = require('sharp');

// texture name -> new edge length (square) or [w, h]
// Checked on screen at 2x: roofs at 2048 lost the mortar lines between tiles,
// the yard wall at 1024 lost its streaks, and the mat (25 dB when halved) is
// seen from a hand's width away, so those keep their full size.
const TEXTURE_SIZE = {
  bake_ground: 2048,     // 42 dB when halved: smooth yard and village ground
  bake_buildings: 2048,  // walls and the sign band: no visible change
  bake_frond: 512,       // 52 dB when halved: alpha-tested leaflet cut-outs
};

(async () => {
  const [src, dst] = process.argv.slice(2);
  await MeshoptEncoder.ready; await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(src);

  for (const tex of doc.getRoot().listTextures()) {
    const size = TEXTURE_SIZE[tex.getName()];
    if (!size) continue;
    const [w, h] = Array.isArray(size) ? size : [size, size];
    const img = sharp(Buffer.from(tex.getImage()));
    const meta = await img.metadata();
    if (meta.width <= w) continue;
    const out = await img.resize(w, h, { kernel: 'lanczos3' })
      .webp({ quality: 90, effort: 6, alphaQuality: 100 }).toBuffer();
    tex.setImage(new Uint8Array(out)).setMimeType('image/webp');
    console.log(`  ${tex.getName()}: ${meta.width}x${meta.height} -> ${w}x${h}`);
  }

  await doc.transform(
    dedup(),
    prune({ keepExtras: true, keepLeaves: true }),
    reorder({ encoder: MeshoptEncoder, target: 'size' }),
    quantize({ pattern: /^(NORMAL|TEXCOORD_\d+)$/, quantizeNormal: 8, quantizeTexcoord: 14 }),
  );
  doc.createExtension(EXTMeshoptCompression).setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });

  await io.write(dst, doc);
})().catch((e) => { console.error(e); process.exit(1); });
