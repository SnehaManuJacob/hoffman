"""
Bake the Prabhakar Tile Works compound to textures and export a web GLB.

Run headless on a SNAPSHOT of the scene (never the live file — this joins,
converts and re-unwraps everything):

  Blender -b snapshot.blend --python bake.py -- OUT_DIR GROUPS RES_SCALE SAMPLES [export]

  GROUPS     comma list (ground,roofs,buildings,compound,green,truck) or "all"
  RES_SCALE  1.0 for final; 0.25 for a quick test
  SAMPLES    Cycles samples per texel (256 final)
  export     if present, also build and write OUT_DIR/factory.glb

Per group: every object gets a new "bake" UV layer (active = bake target)
while the original UV stays active_render (RoofTile and palm_leaf patterns
are UV-driven). All objects of the group are smart-unwrapped together in
multi-object edit mode so they share one atlas, then Cycles bakes COMBINED
(direct + indirect light, shadows, AO, bounce) into it. The float result is
saved through the scene's view transform (AgX, Medium High Contrast) so the
PNG looks like the Blender render.
"""
import bpy, bmesh, sys, os, math, time

argv = sys.argv[sys.argv.index('--') + 1:]
OUT = argv[0]
GROUPS_ARG = argv[1]
RES_SCALE = float(argv[2])
SAMPLES = int(argv[3])
DO_EXPORT = len(argv) > 4 and argv[4] == 'export'
os.makedirs(OUT, exist_ok=True)

RES = {'ground': 4096, 'far': 1024, 'roofs': 4096, 'buildings': 4096, 'mat': 4096,
       'front': 2048, 'green': 2048, 'dryer': 2048, 'door': 512}
ALL_GROUPS = list(RES)
LIGHT_DIV = {'ground': 2, 'far': 2, 'roofs': 2, 'buildings': 2, 'mat': 2,
             'front': 1, 'green': 4, 'dryer': 1, 'door': 1}
BAKE_SKY = 0.6
GROUPS = ALL_GROUPS if GROUPS_ARG == 'all' else GROUPS_ARG.split(',')

sc = bpy.context.scene
vl = bpy.context.view_layer


def log(*a):
    print('[bake]', time.strftime('%H:%M:%S'), *a, flush=True)


def group_of(name):
    if name == 'White_Floor':
        return None                      # render backdrop: lights the bake, never exported
    if 'frond' in name.lower():
        return 'frond'
    if name == 'Far_ground':
        return 'far'
    if name.startswith('Plot_'):
        return 'ground'
    if name == 'HeroMat':
        return 'mat'
    if name.startswith('HeroFront_'):
        return 'front'
    if name == 'DryerDoor':
        return 'door'
    if name.startswith('Dryer_'):
        return 'dryer'
    if '_roof' in name or name.endswith('_caps') or 'finial' in name or 'gables' in name:
        return 'roofs'
    if name.startswith(('Palm', 'Bush')):
        return 'green'
    return 'buildings'


def select_only(objs, active=None):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    vl.objects.active = active or (objs[0] if objs else None)


# ---------------------------------------------------------------- render setup
sc.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'
prefs.get_devices()
for d in prefs.devices:
    d.use = (d.type == 'METAL')
sc.cycles.device = 'GPU'
sc.cycles.samples = SAMPLES
sc.cycles.max_bounces = 6
# 64 palms of alpha-cut fronds: every ray through a crown is a chain of
# transparent hits. A few are enough for dappled shade.
sc.cycles.transparent_max_bounces = 4
bk = sc.render.bake
bk.use_pass_glossy = False   # view-dependent; meaningless once frozen into a texture
bk.margin_type = 'EXTEND'
log('devices', [(d.name, d.type, d.use) for d in prefs.devices])
for n in sc.world.node_tree.nodes:
    # the lighting background (the camera-ray one stays pure white and does not light)
    if n.type == 'BACKGROUND' and tuple(n.inputs[0].default_value)[:3] != (1.0, 1.0, 1.0):
        n.inputs[1].default_value = BAKE_SKY
        log('sky fill ->', BAKE_SKY)

# ---------------------------------------------------------------- prepare geometry
# render-hidden objects (e.g. the old floating sign text) are not part of the model
for o in [o for o in sc.objects if o.hide_render]:
    log('removing render-hidden', o.name)
    bpy.data.objects.remove(o, do_unlink=True)
geo = [o for o in sc.objects if o.type in ('MESH', 'CURVE', 'FONT')]
select_only(geo)
bpy.ops.object.make_single_user(object=True, obdata=True, material=False)
bpy.ops.object.convert(target='MESH')          # applies Solidify/Displace, curves & text -> mesh
meshes = [o for o in sc.objects if o.type == 'MESH']

# Faces lying on the ground and facing straight down are never seen; they would
# take half the ground atlas (Plot_Slab's underside is as big as its top).
dropped = 0
for o in meshes:
    if group_of(o.name) in (None, 'flat', 'frond'):
        continue
    bm = bmesh.new(); bm.from_mesh(o.data)
    mw = o.matrix_world; nm = mw.to_3x3().inverted().transposed()
    kill = [f for f in bm.faces
            if (nm @ f.normal).normalized().z < -0.95 and (mw @ f.calc_center_median()).z < 0.05]
    dropped += len(kill)
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bm.to_mesh(o.data); bm.free()
log('dropped', dropped, 'hidden ground faces')

groups = {}
for o in meshes:
    g = group_of(o.name)
    groups.setdefault(g, []).append(o)
log({k: len(v) for k, v in groups.items()})

# One UV layout per mesh before joining. The village mixes parts made three
# ways (the factory's, with 'UVMap'; generated boxes, with 'Float2'; copies
# with none). Joined, they carry several layers, each empty on part of the
# mesh, and the bake and the export end up reading different ones. Rename
# every first layer to 'UVMap', drop extras, and give UV-less parts one.
for o in meshes:
    if group_of(o.name) in (None, 'frond'):
        continue
    uvs = o.data.uv_layers
    while len(uvs) > 1:
        uvs.remove(uvs[-1])
    if len(uvs) == 0:
        uvs.new(name='UVMap')
    uvs[0].name = 'UVMap'
    uvs[0].active = True
    uvs[0].active_render = True

# One object per group before baking: Cycles bakes selected objects one at a
# time, and 270 palm parts cost minutes of per-object overhead. (Fronds stay
# apart: their texture is baked from one frond's own UVs.)
for g, objs in list(groups.items()):
    if g in (None, 'frond') or len(objs) < 2:
        continue
    select_only(objs)
    bpy.ops.object.join()
    j = vl.objects.active
    j.name = 'G_' + g
    groups[g] = [j]
log('joined', {k: len(v) for k, v in groups.items()})


def add_bake_uv(o):
    uvs = o.data.uv_layers
    had = len(uvs) > 0
    render_name = next((l.name for l in uvs if l.active_render), uvs[0].name if had else None)
    lay = uvs.get('bake') or uvs.new(name='bake')
    uvs.active = lay                              # bake writes through the ACTIVE layer
    if had:
        uvs[render_name].active_render = True     # shading keeps reading the original layer


def unwrap(objs):
    for o in objs:
        add_bake_uv(o)
    select_only(objs)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    # Blender 5 keeps UV selection separately (.uv_select_* attributes). A mesh
    # written through bmesh can carry it as all-False, and smart_project then
    # leaves that mesh's faces collapsed to zero-width slivers in the new layer.
    bpy.ops.uv.select_all(action='SELECT')
    # correct_aspect must stay off: it squashes islands by the aspect of each
    # material's active image node, and the sign band's 4096x246 paint image
    # (16.6:1) crushed its islands to zero width. The atlases are square.
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0015,
                             area_weight=0.0, correct_aspect=False, scale_to_bounds=False)
    # Smart-project can leave an island out of proportion to its 3D size (the
    # sign band came out as a full-height sliver), and the packer then shrinks
    # every other island to fit around it. Equalise texel density by real
    # surface area, then re-pack.
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.average_islands_scale()
    bpy.ops.uv.pack_islands(rotate=True, margin=0.0015)
    bpy.ops.object.mode_set(mode='OBJECT')
    # Hard stop on collapsed UVs: a zero-area island scaled up by
    # average_islands_scale is exactly what shrank the whole buildings atlas.
    for o in objs:
        bm = bmesh.new(); bm.from_mesh(o.data); uvl = bm.loops.layers.uv['bake']
        bad = 0
        for f in bm.faces:
            if f.calc_area() > 1e-4:
                us = [l[uvl].uv.x for l in f.loops]; vs = [l[uvl].uv.y for l in f.loops]
                if (max(us) - min(us)) < 1e-6 or (max(vs) - min(vs)) < 1e-6:
                    bad += 1
        bm.free()
        if bad:
            raise RuntimeError(f'{o.name}: {bad} faces with collapsed bake UVs')
    # Coverage check: one object with oversized UVs shrinks everyone else's.
    lo_u = lo_v = 1e9; hi_u = hi_v = -1e9
    for o in objs:
        uv = o.data.uv_layers['bake'].data
        if not len(uv):
            continue
        us = [d.uv.x for d in uv]; vs = [d.uv.y for d in uv]
        ou, ov = (min(us), max(us)), (min(vs), max(vs))
        lo_u, hi_u = min(lo_u, ou[0]), max(hi_u, ou[1]); lo_v, hi_v = min(lo_v, ov[0]), max(hi_v, ov[1])
        if (ou[1] - ou[0]) * (ov[1] - ov[0]) > 0.25 or ou[0] < -0.01 or ou[1] > 1.01:
            log('   wide UV:', o.name, [round(x, 3) for x in ou], [round(x, 3) for x in ov])
    log('   atlas bounds u', round(lo_u, 3), round(hi_u, 3), 'v', round(lo_v, 3), round(hi_v, 3))
    # Coverage check: one object with oversized UVs shrinks everyone else's.
    lo_u = lo_v = 1e9; hi_u = hi_v = -1e9
    for o in objs:
        uv = o.data.uv_layers['bake'].data
        if not len(uv):
            continue
        us = [d.uv.x for d in uv]; vs = [d.uv.y for d in uv]
        ou, ov = (min(us), max(us)), (min(vs), max(vs))
        lo_u, hi_u = min(lo_u, ou[0]), max(hi_u, ou[1]); lo_v, hi_v = min(lo_v, ov[0]), max(hi_v, ov[1])
        if (ou[1] - ou[0]) * (ov[1] - ov[0]) > 0.25 or ou[0] < -0.01 or ou[1] > 1.01:
            log('   wide UV:', o.name, [round(x, 3) for x in ou], [round(x, 3) for x in ov])
    log('   atlas bounds u', round(lo_u, 3), round(hi_u, 3), 'v', round(lo_v, 3), round(hi_v, 3))


def materials_of(objs):
    out = []
    for o in objs:
        for s in o.material_slots:
            if s.material and s.material not in out:
                out.append(s.material)
    return out


import numpy as np

# Diffuse-only bakes: a metallic surface has no diffuse colour, so flatten
# metal to dielectric here (snapshot only) or the corrugated sheds bake black.
for m in bpy.data.materials:
    if not m.use_nodes:
        continue
    for n in m.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            s = n.inputs['Metallic']
            for l in list(s.links):
                m.node_tree.links.remove(l)
            s.default_value = 0.0


def bake_pass(objs, res, kind, samples):
    """kind 'color' = albedo only; 'light' = direct+indirect irradiance, no albedo."""
    img = bpy.data.images.new(f'{kind}', res, res, alpha=False, float_buffer=True)
    targets, muted = [], []
    for m in materials_of(objs):
        nt = m.node_tree
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = img
        nt.nodes.active = n
        targets.append((nt, n))
        if kind == 'light':
            # the AO shader node only shapes albedo; it costs extra rays per sample
            for a in nt.nodes:
                if a.type == 'AMBIENT_OCCLUSION' and not a.mute:
                    a.mute = True; muted.append(a)
    sc.cycles.samples = samples
    bk.use_pass_direct = kind == 'light'
    bk.use_pass_indirect = kind == 'light'
    bk.use_pass_color = kind == 'color'
    select_only(objs)
    if os.environ.get('BAKE_DEBUG'):
        for o in objs[:4] + [x for x in objs if x.name in ('A_walls', 'A_sign_band')]:
            info = []
            for l in o.data.uv_layers:
                us = [d.uv.x for d in l.data] or [0]
                info.append((l.name, 'A' if l.active else '-', 'R' if l.active_render else '-',
                             round(min(us), 3), round(max(us), 3)))
            log('   uv', o.name, info)
    t = time.time()
    # The light pass is blurred and upsampled 4x afterwards; a wide margin keeps
    # both from pulling the empty (black) atlas background into island edges.
    margin = 16 if kind == 'light' else max(4, res // 256)
    bpy.ops.object.bake(type='DIFFUSE', margin=margin, use_clear=True,
                        target='IMAGE_TEXTURES')
    log(f'  {kind} {res}px @ {samples}spp', round(time.time() - t, 1), 's')
    for nt, n in targets:                         # shared materials must not keep this target
        nt.nodes.remove(n)
    for a in muted:
        a.mute = False
    arr = np.empty(res * res * 4, dtype=np.float32)
    img.pixels.foreach_get(arr)
    bpy.data.images.remove(img)
    return arr.reshape(res, res, 4)


def upsample(a, n, m=None):
    """Bilinear resize of an (h, w, c) array to (n, m or n, c)."""
    h, w = a.shape[:2]
    ys = np.linspace(0, h - 1, n); xs = np.linspace(0, w - 1, m or n)
    y0 = np.floor(ys).astype(int); x0 = np.floor(xs).astype(int)
    y1 = np.minimum(y0 + 1, h - 1); x1 = np.minimum(x0 + 1, w - 1)
    fy = (ys - y0)[:, None, None]; fx = (xs - x0)[None, :, None]
    top = a[y0][:, x0] * (1 - fx) + a[y0][:, x1] * fx
    bot = a[y1][:, x0] * (1 - fx) + a[y1][:, x1] * fx
    return top * (1 - fy) + bot * fy


def soften(a):
    """3x3 box blur: takes the last speckle out of the lighting pass."""
    p = np.pad(a, ((1, 1), (1, 1), (0, 0)), mode='edge')
    return sum(p[y:y + a.shape[0], x:x + a.shape[1]] for y in range(3) for x in range(3)) / 9.0


def bake_group(g):
    objs = groups.get(g, [])
    if not objs:
        log('skip empty', g); return
    # The dryer only appears late in the story: it must not cast a baked
    # shadow on anything else. The room lamp lights only the hero's house.
    dry = groups.get('dryer', []) + groups.get('door', [])
    for x in dry:
        x.hide_render = g not in ('dryer', 'door')
    lamp = bpy.data.objects.get('RoomLamp')
    if lamp:
        lamp.hide_render = g not in ('buildings', 'front')
    res = max(256, int(RES[g] * RES_SCALE))
    lres = max(128, res // LIGHT_DIV[g])
    t0 = time.time()
    if g == 'ground':
        # the ground brings its own bake UVs (built densest at the village):
        # copy them into the bake layer instead of unwrapping
        for o in objs:
            add_bake_uv(o)
            uvs = o.data.uv_layers
            for d_, s_ in zip(uvs['bake'].data, uvs['UVMap'].data):
                d_.uv = s_.uv
    else:
        unwrap(objs)
    log(g, 'unwrapped', len(objs), 'objects in', round(time.time() - t0, 1), 's')
    color = bake_pass(objs, res, 'color', max(2, SAMPLES // 24))
    light = bake_pass(objs, lres, 'light', SAMPLES)
    if os.environ.get('BAKE_DEBUG'):
        for nm, arr in (('color', color), ('light', light)):
            dbg = bpy.data.images.new(nm + '_dbg', arr.shape[1], arr.shape[0], float_buffer=True)
            dbg.pixels.foreach_set(np.ascontiguousarray(arr).ravel())
            dbg.save_render(os.path.join(OUT, f'dbg_{g}_{nm}.png'), scene=sc)
        log('   color mean', color[..., :3].mean().round(3), 'light mean', light[..., :3].mean().round(3))
    if os.environ.get('BAKE_DEBUG'):
        for nm, arr in (('color', color), ('light', light)):
            dbg = bpy.data.images.new(nm + '_dbg', arr.shape[1], arr.shape[0], float_buffer=True)
            dbg.pixels.foreach_set(np.ascontiguousarray(arr).ravel())
            dbg.save_render(os.path.join(OUT, f'dbg_{g}_{nm}.png'), scene=sc)
        log('   color mean', color[..., :3].mean().round(3), 'light mean', light[..., :3].mean().round(3))
    light = upsample(soften(light[..., :3]), res)
    out = color.copy()
    out[..., :3] = color[..., :3] * light
    out[..., 3] = 1.0
    img = bpy.data.images.new('bake_' + g, res, res, alpha=False, float_buffer=True)
    img.pixels.foreach_set(out.ravel())
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.render.image_settings.color_depth = '8'
    path = os.path.join(OUT, f'bake_{g}.png')
    img.save_render(path, scene=sc)               # applies AgX + look, like the Blender render
    log(g, 'saved', path, 'total', round(time.time() - t0, 1), 's')


def bake_fronds():
    """One shared RGBA texture for all palm fronds: colour + leaflet cut-out mask."""
    fr = groups.get('frond', [])
    if not fr:
        return
    src = fr[0]
    m = src.material_slots[0].material
    nt = m.node_tree; N = nt.nodes; L = nt.links
    b = next(n for n in N if n.type == 'BSDF_PRINCIPLED')
    out = next(n for n in N if n.type == 'OUTPUT_MATERIAL')
    col_sock = b.inputs['Base Color'].links[0].from_socket
    a_sock = b.inputs['Alpha'].links[0].from_socket
    orig = out.inputs['Surface'].links[0].from_socket
    em = N.new('ShaderNodeEmission')
    L.new(em.outputs[0], out.inputs['Surface'])
    res = 1024
    imgs = {}
    for key, sock in (('col', col_sock), ('alpha', a_sock)):
        img = bpy.data.images.new('frond_' + key, res, res, alpha=False, float_buffer=True)
        t = N.new('ShaderNodeTexImage'); t.image = img; N.active = t
        L.new(sock, em.inputs['Color'])
        select_only([src])
        bpy.ops.object.bake(type='EMIT', margin=4, use_clear=True, target='IMAGE_TEXTURES')
        imgs[key] = img
        N.remove(t)
    L.new(orig, out.inputs['Surface']); N.remove(em)
    c = np.empty(res * res * 4, np.float32); imgs['col'].pixels.foreach_get(c)
    a = np.empty(res * res * 4, np.float32); imgs['alpha'].pixels.foreach_get(a)
    c = c.reshape(-1, 4); a = a.reshape(-1, 4)
    v = np.clip(c[:, :3] * 0.92, 0, 1)
    # linear -> sRGB by hand: this byte image is stored display-encoded
    srgb = np.where(v <= 0.0031308, 12.92 * v, 1.055 * np.power(v, 1 / 2.4) - 0.055)
    px = np.concatenate([srgb, (a[:, :1] > 0.5).astype(np.float32)], axis=1)
    rgba = bpy.data.images.new('frond_rgba', res, res, alpha=True, float_buffer=False)
    rgba.pixels.foreach_set(px.ravel())
    rgba.filepath_raw = os.path.join(OUT, 'bake_frond.png'); rgba.file_format = 'PNG'
    rgba.save()
    log('fronds baked', res)


def bake_sign():
    """The painted sign at its own 4096px resolution, lit like its neighbours.

    In the shared buildings atlas the band only gets the same texel density as
    every wall (~60px/m), which blurs 1m letters. Instead: bake only the
    band's LIGHT through its own sign UVs (front face = whole 0..1), and
    multiply that into the full-resolution painted image."""
    objs = groups.get('sign', [])
    if not objs:
        return
    band = objs[0]
    m = band.material_slots[0].material
    tex = next(n for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image
               and n.image.size[0] > 1000)
    src = tex.image
    w, h = src.size
    paint = np.empty(w * h * 4, np.float32); src.pixels.foreach_get(paint)
    paint = paint.reshape(h, w, 4)
    if not src.is_float:
        # byte images hand back their stored (sRGB-encoded) values: decode to
        # linear before multiplying by the linear light pass
        c = paint[..., :3]
        paint[..., :3] = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    light = bake_pass(objs, 512, 'light', SAMPLES)[..., :3]
    light = upsample(soften(light), h, w)
    out = paint.copy(); out[..., :3] = paint[..., :3] * light; out[..., 3] = 1.0
    img = bpy.data.images.new('bake_sign', w, h, alpha=False, float_buffer=True)
    img.pixels.foreach_set(out.ravel())
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.render.image_settings.color_depth = '8'
    img.save_render(os.path.join(OUT, 'bake_sign.png'), scene=sc)
    band.data.uv_layers[0].name = 'bake'              # export reads the 'bake' layer
    log('sign baked', w, 'x', h)


# REUSE=1: re-unwrap (deterministic) but don't re-bake groups whose PNG is
# already in OUT — for re-baking one group without redoing the slow ones.
REUSE = os.environ.get('REUSE') == '1'
for g in ALL_GROUPS:
    if g in GROUPS:
        bake_group(g)
    elif REUSE and groups.get(g) and os.path.exists(os.path.join(OUT, f'bake_{g}.png')):
        unwrap(groups[g]); log(g, 'unwrapped only (reusing PNG)')
if GROUPS_ARG == 'all' or 'frond' in GROUPS:
    bake_fronds()

if not DO_EXPORT:
    sys.exit(0)

# ---------------------------------------------------------------- build web meshes
def unlit_material(name, image_path, alpha=False):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    for n in list(N):
        N.remove(n)
    out = N.new('ShaderNodeOutputMaterial')
    tex = N.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(image_path)
    tex.interpolation = 'Linear'
    uvn = N.new('ShaderNodeUVMap'); uvn.uv_map = 'bake'
    L.new(uvn.outputs[0], tex.inputs['Vector'])
    if alpha:
        # Principled + alpha so the exporter writes alphaMode MASK for the cut-outs
        b = N.new('ShaderNodeBsdfPrincipled')
        L.new(tex.outputs['Color'], b.inputs['Base Color'])
        rnd = N.new('ShaderNodeMath'); rnd.operation = 'ROUND'
        L.new(tex.outputs['Alpha'], rnd.inputs[0]); L.new(rnd.outputs[0], b.inputs['Alpha'])
        b.inputs['Roughness'].default_value = 1.0
        L.new(b.outputs[0], out.inputs['Surface'])
        m.surface_render_method = 'DITHERED'
    else:
        # Background shader -> exporter emits KHR_materials_unlit: the light is in the texture
        bgn = N.new('ShaderNodeBackground')
        L.new(tex.outputs['Color'], bgn.inputs['Color'])
        L.new(bgn.outputs[0], out.inputs['Surface'])
    return m


def finalize(objs, mat, name):
    for o in objs:
        o.data.materials.clear()
        o.data.materials.append(mat)
        uvs = o.data.uv_layers
        for l in [l for l in uvs if l.name != 'bake']:
            uvs.remove(l)
    select_only(objs)
    if len(objs) > 1:
        bpy.ops.object.join()
    j = vl.objects.active
    j.name = name; j.data.name = name
    log('   export', name, [l.name for l in j.data.uv_layers])
    return j


export = []
for g in ALL_GROUPS:
    p = os.path.join(OUT, f'bake_{g}.png')
    if groups.get(g) and os.path.exists(p):
        export.append(finalize(groups[g], unlit_material('Bake_' + g, p), 'Web_' + g))
fp = os.path.join(OUT, 'bake_frond.png')
if groups.get('frond') and os.path.exists(fp):
    fr = groups['frond']
    for o in fr:                                  # the frond texture lives on the original UV
        uvs = o.data.uv_layers
        if 'bake' in uvs:
            uvs.remove(uvs['bake'])
        uvs[0].name = 'bake'
    export.append(finalize(fr, unlit_material('Bake_frond', fp, alpha=True), 'Web_fronds'))
for o in groups.get('flat', []):
    for s in o.material_slots:
        if s.material and 'web_twin' in s.material:
            s.material = bpy.data.materials[s.material['web_twin']]
    export.append(o)

select_only(export)
glb = os.path.join(OUT, 'village.glb')
bpy.ops.export_scene.gltf(
    filepath=glb, export_format='GLB', use_selection=True, export_apply=True,
    export_cameras=False, export_lights=False, export_yup=True,
    export_image_format='WEBP', export_image_quality=82,
    export_extras=True,           # the scene's areca_bunches list
)
log('exported', glb, os.path.getsize(glb) // 1024, 'KB')
