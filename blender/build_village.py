"""
Build the arecanut village for views/problem.js from the tile-works file's
own materials, sun, sky, palms and tile-roofed houses.

  Blender -b src.blend --python build_village.py -- OUT.blend

Coordinates are written in the PAGE's (three.js, y-up) frame and converted:
three (x, y, z) -> Blender (x, -z, y). glTF export with +Y up converts back.
Every new mesh is built with its vertices in world space and its origin at 0,
like the factory's parts, so object-space procedural textures line up.
"""
import bpy, bmesh, sys, math, random
from mathutils import Vector, Matrix

OUT = sys.argv[sys.argv.index('--') + 1]
D = bpy.data
sc = bpy.context.scene
R = random.Random(11)


def B(x, y, z):
    return Vector((x, -z, y))


# ------------------------------------------------------------------ clear out
KEEP_PREFIX = ('Palm0_', 'E_', 'D_', 'Bush0', 'Bush1', 'Bush2', 'Bush3')
KEEP = {'White_Floor', 'Sun'}
templates = {}
for o in list(sc.objects):
    if o.name in KEEP:
        continue
    if o.name.startswith(KEEP_PREFIX) and o.name not in ('Bush10', 'Bush11', 'Bush12', 'Bush13', 'Bush14', 'Bush15', 'Bush16', 'Bush19', 'Bush20', 'Bush22', 'Bush23', 'Bush24', 'Bush25', 'Bush26', 'Bush28', 'Bush29', 'Bush30', 'Bush31', 'Bush32', 'Bush33', 'Bush34', 'Bush35', 'Bush36', 'Bush37', 'Bush38', 'Bush39'):
        templates[o.name] = o
        continue
    D.objects.remove(o, do_unlink=True)

coll = D.collections.new('Village')
sc.collection.children.link(coll)


def link(o):
    for c in list(o.users_collection):
        c.objects.unlink(o)
    coll.objects.link(o)
    return o


# ------------------------------------------------------------------ materials
def principled(name, rgb, rough=0.8):
    m = D.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    return m, b


def brick_material(name, c1, c2, mortar, scale, rough=0.85, mortar_size=0.02, noise=0.15):
    m, b = principled(name, c1, rough)
    nt = m.node_tree; N = nt.nodes; L = nt.links
    tc = N.new('ShaderNodeTexCoord')
    br = N.new('ShaderNodeTexBrick')
    br.inputs['Color1'].default_value = (*c1, 1)
    br.inputs['Color2'].default_value = (*c2, 1)
    br.inputs['Mortar'].default_value = (*mortar, 1)
    br.inputs['Scale'].default_value = scale
    br.inputs['Mortar Size'].default_value = mortar_size
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale * 0.6
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = noise
    L.new(tc.outputs['Object'], br.inputs['Vector']); L.new(tc.outputs['Object'], nz.inputs['Vector'])
    L.new(br.outputs['Color'], mix.inputs['A']); L.new(nz.outputs['Color'], mix.inputs['B'])
    L.new(mix.outputs['Result'], b.inputs['Base Color'])
    return m


# A woven drying mat: fine split-bamboo weave in straw tones.
MAT_WEAVE = brick_material('weave', (0.46, 0.34, 0.17), (0.33, 0.23, 0.1), (0.16, 0.1, 0.05), 38, 0.9, 0.08, 0.35)
BRICK = brick_material('brick', (0.3, 0.1, 0.06), (0.25, 0.085, 0.05), (0.42, 0.38, 0.33), 8, 0.9, 0.03, 0.2)
RIPE, _ = principled('areca_ripe', (0.86, 0.36, 0.04), 0.45)
TERRACOTTA = brick_material('terracotta', (0.5, 0.2, 0.1), (0.46, 0.18, 0.09), (0.42, 0.17, 0.08), 3, 0.85, 0.0, 0.25)
SHAFT, _ = principled('crownshaft', (0.14, 0.24, 0.05), 0.45)
M = lambda n: D.materials[n]
PLASTER, PLINTH, CONCRETE, WOOD, DARK = M('plaster'), M('plinth'), M('concrete'), M('wood'), M('dark')
METAL_WALL, METAL, TRUNK, GROUND, DIRT, GRASS = M('metal_wall'), M('metal'), M('trunk'), M('ground'), M('dirt'), M('grass')

# Which coordinates each procedural material reads (Object, UV, Generated).
for m in (PLASTER, CONCRETE, TRUNK, GROUND, DIRT, METAL_WALL, M('RoofTile'), M('palm_leaf')):
    used = sorted({l.from_socket.name for l in m.node_tree.links if l.from_node.type == 'TEX_COORD'})
    print('[village] coords', m.name, used)


# ------------------------------------------------------------------ primitives
def box_uvs(bm):
    """UVs in metres, projected along each face's main axis, so UV-driven
    patterns (corrugation) keep the same scale on every part."""
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal; ax = max(range(3), key=lambda k: abs(n[k]))
        for l in f.loops:
            c = l.vert.co
            l[uv].uv = (c.y, c.z) if ax == 0 else (c.x, c.z) if ax == 1 else (c.x, c.y)


def mesh_obj(name, bm, mat, smooth=False):
    bm.normal_update(); box_uvs(bm)
    if smooth:
        for f in bm.faces:
            f.smooth = True
    me = D.meshes.new(name); bm.to_mesh(me); bm.free()
    o = D.objects.new(name, me); coll.objects.link(o)
    if isinstance(mat, (list, tuple)):
        for m in mat:
            me.materials.append(m)
    else:
        me.materials.append(mat)
    return o


def box(name, w, h, d, cx, cy, cz, mat, yaw=0.0, pivot=None):
    """A box in page coordinates: w along x, h along y (up), d along z."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector((w, d, h)), verts=bm.verts)
    rot = Matrix.Rotation(-yaw, 4, 'Z')
    for v in bm.verts:
        v.co = rot @ v.co
    bmesh.ops.translate(bm, vec=B(cx, cy, cz), verts=bm.verts)
    return mesh_obj(name, bm, mat)


def cylinder(name, r0, r1, h, cx, cy, cz, mat, segs=16):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r0, radius2=r1, depth=h)
    bmesh.ops.translate(bm, vec=B(cx, cy + h / 2, cz), verts=bm.verts)
    return mesh_obj(name, bm, mat)


def plane(name, w, d, cx, cy, cz, mat, cuts=0):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=max(1, cuts), y_segments=max(1, cuts), size=0.5)
    bmesh.ops.scale(bm, vec=Vector((w, d, 1)), verts=bm.verts)
    bmesh.ops.translate(bm, vec=B(cx, cy, cz), verts=bm.verts)
    return mesh_obj(name, bm, mat)


# ------------------------------------------------------------------ terrace houses
ROOF_TOP = 6.3


def terrace_house(tag, x, z, w, d, hero=False):
    """A flat-roofed, lime-plastered house with a terrace for drying."""
    H = 6.0
    p = f'{tag}_'
    box(p + 'plinth', w + 0.14, 0.5, d + 0.14, x, 0.25, z, PLINTH)
    box(p + 'wall_back', w, H, 0.25, x, H / 2, z - d / 2 + 0.125, PLASTER)
    box(p + 'wall_left', 0.25, H, d, x - w / 2 + 0.125, H / 2, z, PLASTER)
    box(p + 'wall_right', 0.25, H, d, x + w / 2 - 0.125, H / 2, z, PLASTER)
    box(p + 'slab', w + 0.4, 0.3, d + 0.4, x, H + 0.15, z, CONCRETE)
    for i, (pw, pd, px, pz) in enumerate([(w + 0.4, 0.15, 0, d / 2 + 0.125), (w + 0.4, 0.15, 0, -d / 2 - 0.125),
                                          (0.15, d + 0.4, w / 2 + 0.125, 0), (0.15, d + 0.4, -w / 2 - 0.125, 0)]):
        box(f'{p}parapet{i}', pw, 0.35, pd, x + px, H + 0.47, z + pz, PLASTER)
    mat_name = 'HeroMat' if hero else p + 'mat'
    box(mat_name, w - 2.6, 0.03, d - 2.2, x, H + 0.315, z, MAT_WEAVE)
    # side windows: wooden frame, dark glass, a concrete sunshade over each
    for side in (-1, 1):
        sx = x + side * (w / 2 + 0.01)
        box(f'{p}win_{side}', 0.06, 1.4, 1.6, sx, 3.4, z - 1, DARK)
        box(f'{p}winframe_{side}', 0.1, 1.55, 1.75, sx - side * 0.02, 3.4, z - 1, WOOD)
        box(f'{p}chajja_{side}', 0.55, 0.08, 2.1, x + side * (w / 2 + 0.27), 4.35, z - 1, CONCRETE)
    # the front: its own objects on the hero house, so the page can dissolve it
    fp = 'HeroFront_' if hero else p + 'front_'
    door_x = x + (2.25 if hero else 0); door_w = 1.5; door_h = 2.5
    left = (door_x - door_w / 2) - (x - w / 2); right = (x + w / 2) - (door_x + door_w / 2)
    fz = z + d / 2 - 0.125
    box(fp + 'left', left, H, 0.25, x - w / 2 + left / 2, H / 2, fz, PLASTER)
    box(fp + 'right', right, H, 0.25, x + w / 2 - right / 2, H / 2, fz, PLASTER)
    box(fp + 'lintel', door_w, H - door_h, 0.25, door_x, door_h + (H - door_h) / 2, fz, PLASTER)
    box(fp + 'win', 1.8, 1.4, 0.06, x - 2, 3.6, z + d / 2 + 0.01, DARK)
    box(fp + 'winframe', 1.95, 1.55, 0.1, x - 2, 3.6, z + d / 2 - 0.01, WOOD)
    box(fp + 'chajja_win', 2.3, 0.08, 0.55, x - 2, 4.55, z + d / 2 + 0.27, CONCRETE)
    box(fp + 'chajja_door', 2.0, 0.08, 0.6, door_x, door_h + 0.35, z + d / 2 + 0.3, CONCRETE)
    # an open frame: two jambs and a head, so the doorway stays a doorway
    for side in (-1, 1):
        box(f'{fp}jamb{side}', 0.12, door_h, 0.16, door_x + side * (door_w / 2 + 0.06), door_h / 2, z + d / 2 - 0.02, WOOD)
    box(fp + 'doorhead', door_w + 0.24, 0.12, 0.16, door_x, door_h + 0.06, z + d / 2 - 0.02, WOOD)
    if not hero:
        box(p + 'door', door_w - 0.1, door_h - 0.1, 0.06, door_x, door_h / 2, z + d / 2 + 0.02, WOOD)
    else:
        # inside: a cement floor, the door leaf swung back against the wall
        box('HeroRoom_floor', w - 0.5, 0.2, d - 0.5, x, 0.6, z, CONCRETE)
        box('HeroRoom_door', 0.06, door_h - 0.1, door_w - 0.1, door_x + door_w / 2 + 0.1, door_h / 2 + 0.7, fz - 0.8, WOOD)


terrace_house('Hero', 0, 0, 10, 8, hero=True)
ROOFS = [(-44, -6), (-30, -16), (-15, -5), (14, -15), (29, -4)]
for i, (x, z) in enumerate(ROOFS):
    terrace_house(f'House{i}', x, z, 8.5, 7)

# A warm lamp in the hero's room, for the bake: the room is only ever seen
# by lamplight (the rain scene).
lamp = D.lights.new('RoomLamp', 'POINT'); lamp.energy = 420; lamp.color = (1.0, 0.78, 0.5); lamp.shadow_soft_size = 0.4
lo = D.objects.new('RoomLamp', lamp); lo.location = B(-0.5, 4.6, -0.5); coll.objects.link(lo)


# ------------------------------------------------------------------ tile-roofed houses
def duplicate_set(prefix, centre, at, yaw, scale):
    """Copy every part of one of the tile works' small buildings to `at`."""
    parts = [o for n, o in templates.items() if n.startswith(prefix)]
    M_ = Matrix.Translation(B(*at)) @ Matrix.Rotation(-yaw, 4, 'Z') @ Matrix.Scale(scale, 4) @ Matrix.Translation(-centre)
    out = []
    for o in parts:
        c = o.copy()
        if o.data:
            c.data = o.data.copy()
        coll.objects.link(c)
        c.matrix_world = M_ @ o.matrix_world
        c.name = 'Village_' + o.name
        out.append(c)
    return out


E_C = Vector((-23.2, 20.0, 0)); D_C = Vector((1.25, 13.4, 0))
SPOTS = [(-58, -30, 'E'), (-24, -40, 'D'), (6, -42, 'E'), (40, -30, 'D'), (52, 12, 'E'),
         (-60, 14, 'D'), (32, 28, 'E'), (-34, 20, 'E'), (-8, -62, 'D'), (62, -50, 'E')]
tile_houses = []
for i, (x, z, kind) in enumerate(SPOTS):
    yaw = R.uniform(-0.3, 0.3) + (math.pi / 2 if i % 3 == 0 else 0)
    tile_houses.append((x, z, 9 if kind == 'D' else 6))
    duplicate_set(kind + '_', E_C if kind == 'E' else D_C, (x, 0, z), yaw, 1.3 if kind == 'E' else 1.0)

# The tile works itself is not built here: the page places the opening
# shot's own model (assets/factory.glb) at FACTORY_AT, unrotated, so both
# bakes share one sun. Its compound (53 x 49 m) is kept clear below.
FACTORY_AT = (-35.0, -105.0)
FACTORY_CLEAR = (FACTORY_AT[0] - 31, FACTORY_AT[0] + 31, FACTORY_AT[1] - 31, FACTORY_AT[1] + 27)


def in_factory(x, z):
    return FACTORY_CLEAR[0] < x < FACTORY_CLEAR[1] and FACTORY_CLEAR[2] < z < FACTORY_CLEAR[3]


# ------------------------------------------------------------------ the dryer
DX, DZ = 12.6, 3.0
box('Dryer_floor', 3.4, 0.08, 2, DX, 0.3, DZ, METAL_WALL)
box('Dryer_back', 3.4, 2.2, 0.08, DX, 1.4, DZ - 1, METAL_WALL)
box('Dryer_left', 0.08, 2.2, 2, DX - 1.7, 1.4, DZ, METAL_WALL)
box('Dryer_top', 3.4, 0.08, 2, DX, 2.5, DZ, METAL_WALL)
box('Dryer_right_low', 0.08, 0.7, 2, DX + 1.7, 0.65, DZ, METAL_WALL)
box('Dryer_right_high', 0.08, 0.5, 2, DX + 1.7, 2.25, DZ, METAL_WALL)
box('Dryer_tray', 3.3, 0.05, 1.9, DX, 1.0, DZ, METAL)
for lx in (-1.6, 1.6):
    for lz in (-0.9, 0.9):
        box(f'Dryer_leg{lx}{lz}', 0.08, 0.3, 0.08, DX + lx, 0.15, DZ + lz, METAL)
cylinder('Dryer_flue', 0.22, 0.22, 3.4, DX + 1.2, 2.5, DZ - 0.2, METAL)
box('Dryer_heater', 1.3, 1.3, 1.3, 9.5, 0.65, DZ, DARK)
box('Dryer_duct', 1.4, 0.4, 0.5, 10.6, 0.5, DZ, METAL)
box('DryerDoor', 0.08, 1.0, 2, DX + 1.7, 1.5, DZ, METAL_WALL)


# ------------------------------------------------------------------ the Drying Cycle
# The proposed dryer, built: the "Tiled Row". Four bays in a row on a
# laterite base, lime-plastered, a wooden door and a jali vent to each bay,
# each bay under its own small hipped Mangalore-tile roof (the tile works'
# roof, scaled), a terracotta chimney pot on each (the exhausts), the return
# duct as a terracotta pipe along the ridges from bay 4 back to bay 1, and
# a brick husk furnace with a tall slim flue at the west end. It stands
# where the box dryer stood (the page shows one or the other), so it is
# baked as its own pieces: Cycle_ (body), CycleRoof_ (roofs, pots, duct),
# CycleDoor0-3 (one door each, so the page can open one).
CYX0, CYBW, CYD, CYZC = 9.6, 3.2, 3.8, 2.0          # bay 1's west wall, bay width, depth, centre z
CYWH, CYPL = 2.6, 0.45                               # wall height, plinth
CYZ0, CYZ1 = CYZC - CYD / 2, CYZC + CYD / 2
cy_cx = lambda b: CYX0 + CYBW * (b + 0.5)
CYX1 = CYX0 + 4 * CYBW
CYTOP = CYPL + CYWH


def pipe(name, a, b, r, mat):
    """A round pipe from a to b (page coordinates)."""
    A, Bv = B(*a), B(*b)
    d = Bv - A
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=14, radius1=r, radius2=r, depth=d.length)
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    bmesh.ops.rotate(bm, verts=bm.verts, cent=Vector((0, 0, 0)), matrix=q.to_matrix())
    bmesh.ops.translate(bm, vec=(A + Bv) / 2, verts=bm.verts)
    return mesh_obj(name, bm, mat, smooth=True)


box('Cycle_plinth', CYX1 - CYX0 + 0.3, CYPL, CYD + 0.3, (CYX0 + CYX1) / 2, CYPL / 2, CYZC, M('laterite'))
box('Cycle_back', CYX1 - CYX0, CYWH, 0.22, (CYX0 + CYX1) / 2, CYPL + CYWH / 2, CYZ0 + 0.11, PLASTER)
for i, x in enumerate((CYX0 + 0.11, CYX1 - 0.11)):
    box(f'Cycle_end{i}', 0.22, CYWH, CYD, x, CYPL + CYWH / 2, CYZC, PLASTER)
for k in range(1, 4):
    box(f'Cycle_part{k}', 0.18, CYWH, CYD, CYX0 + CYBW * k, CYPL + CYWH / 2, CYZC, PLASTER)
DW, DH = 1.0, 1.9
for b in range(4):
    cx = cy_cx(b); fz = CYZ1 - 0.11
    side = (CYBW - DW) / 2
    box(f'Cycle_frontL{b}', side, CYWH, 0.22, cx - DW / 2 - side / 2, CYPL + CYWH / 2, fz, PLASTER)
    box(f'Cycle_frontR{b}', side, CYWH, 0.22, cx + DW / 2 + side / 2, CYPL + CYWH / 2, fz, PLASTER)
    box(f'Cycle_lintel{b}', DW, CYWH - DH, 0.22, cx, CYPL + DH + (CYWH - DH) / 2, fz, PLASTER)
    for sd in (-1, 1):
        box(f'Cycle_jamb{b}{sd}', 0.1, DH, 0.26, cx + sd * (DW / 2 + 0.05), CYPL + DH / 2, fz, WOOD)
    box(f'Cycle_jali{b}', CYBW - 0.9, 0.34, 0.06, cx, CYTOP - 0.32, CYZ1 + 0.01, M('Jali'))
    box(f'Cycle_band{b}', CYBW, 0.28, 0.24, cx, CYPL + 0.14, fz + 0.01, PLINTH)
    box(f'CycleDoor{b}', DW - 0.04, DH - 0.04, 0.06, cx, CYPL + DH / 2, CYZ1 + 0.04, WOOD)
# The husk furnace, its firebox, its flue, and the duct into bay 1's plenum.
box('Cycle_furnace', 1.7, 1.5, 1.7, CYX0 - 1.25, 0.75, CYZC + 0.6, BRICK)
box('Cycle_firebox', 0.62, 0.46, 0.04, CYX0 - 1.25, 0.55, CYZC + 0.6 + 0.86, DARK)
cylinder('Cycle_flue', 0.2, 0.17, 5.6, CYX0 - 1.6, 1.5, CYZC + 0.3, BRICK, 16)
# The supply: one warm-air channel from the furnace along the front of the
# row, past every bay, with a branch into each bay's plenum and a damper
# handle on each branch (S1-S4). The heater feeds all four bays; the
# dampers choose which one gets the air.
CHZ = CYZ1 + 0.42                                     # the channel's line, in front of the doors
box('Cycle_chan_elbow', 0.6, 0.42, CHZ - (CYZC + 0.6) + 0.3, CYX0 - 0.7, 0.21, (CHZ + CYZC + 0.6) / 2 + 0.15, BRICK)
box('Cycle_channel', CYX1 - (CYX0 - 1.0), 0.42, 0.6, (CYX1 + CYX0 - 1.0) / 2, 0.21, CHZ, BRICK)
box('Cycle_chan_cap', CYX1 - (CYX0 - 1.0) + 0.04, 0.05, 0.66, (CYX1 + CYX0 - 1.0) / 2, 0.445, CHZ, CONCRETE)
for b in range(4):
    hx = cy_cx(b) - 0.95
    box(f'Cycle_branch{b}', 0.42, 0.34, CHZ - CYZ1 + 0.1, hx, 0.17, (CHZ + CYZ1) / 2, BRICK)
    # The damper's handle: a short iron rod with a wheel, standing on the channel.
    cylinder(f'Cycle_handle{b}', 0.025, 0.025, 0.42, hx, 0.47, CHZ, DARK, 8)
    bmh = bmesh.new()
    bmesh.ops.create_cone(bmh, cap_ends=True, segments=18, radius1=0.13, radius2=0.13, depth=0.03)
    bmesh.ops.translate(bmh, vec=B(hx, 0.9, CHZ), verts=bmh.verts)
    mesh_obj(f'Cycle_wheel{b}', bmh, DARK)

# The roofs: the tile works' hipped roof (house E), scaled to a bay.
E_roof = [o for n, o in templates.items() if n.startswith('E_roof')]
E_C = Vector((-23.2, 20.0, 0))
for b in range(4):
    M_ = (Matrix.Translation(B(cy_cx(b), 0.82, CYZC)) @ Matrix.Diagonal((0.76, 0.6, 0.72, 1.0))
          @ Matrix.Translation(-E_C))
    for o in E_roof:
        c = o.copy()
        if o.data:
            c.data = o.data.copy()
        coll.objects.link(c)
        c.matrix_world = M_ @ o.matrix_world
        c.name = f'CycleRoof_{b}_{o.name}'
    # The exhaust: a terracotta chimney pot near the ridge.
    # Rising out of the ridge itself, not perched on the slope.
    cylinder(f'CycleRoof_pot{b}', 0.18, 0.14, 0.95, cy_cx(b), 3.9, CYZC + 0.45, TERRACOTTA, 14)
    cylinder(f'CycleRoof_collar{b}', 0.26, 0.24, 0.12, cy_cx(b), 4.06, CYZC + 0.45, TERRACOTTA, 14)
# The return duct, along the ridges: up out of bay 4, west over the roofs,
# down behind bay 1 and into its plenum.
RY = 4.95; RZ = CYZC - 0.55
pipe('CycleRoof_ret0', (CYX1 - 0.6, 3.7, RZ), (CYX1 - 0.6, RY, RZ), 0.2, TERRACOTTA)
pipe('CycleRoof_ret1', (CYX1 - 0.6, RY, RZ), (CYX0 + 0.6, RY, RZ), 0.2, TERRACOTTA)
pipe('CycleRoof_ret2', (CYX0 + 0.6, RY, RZ), (CYX0 + 0.6, RY, CYZ0 - 0.35), 0.2, TERRACOTTA)
pipe('CycleRoof_ret3', (CYX0 + 0.6, RY, CYZ0 - 0.35), (CYX0 + 0.6, 0.6, CYZ0 - 0.35), 0.2, TERRACOTTA)
pipe('CycleRoof_ret4', (CYX0 + 0.6, 0.6, CYZ0 - 0.35), (CYX0 + 0.6, 0.6, CYZ0 + 0.2), 0.2, TERRACOTTA)
for b in range(4):
    box(f'CycleRoof_post{b}', 0.1, RY - 3.95, 0.1, cy_cx(b), (RY + 3.95) / 2, RZ, WOOD)

# ------------------------------------------------------------------ arecanut palms
fronds = [o for n, o in templates.items() if n.startswith('Palm0_frond')]
OLD_CROWN = Vector((-25.72, 4.76, 13.5))


def nut_bunch(name, at):
    bm = bmesh.new()
    for i in range(11):
        g = bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.075)
        vs = g['verts']
        bmesh.ops.scale(bm, vec=Vector((1, 1, 1.25)), verts=vs)
        off = Vector((R.uniform(-0.22, 0.22), R.uniform(-0.22, 0.22), -R.uniform(0, 0.55)))
        bmesh.ops.translate(bm, vec=at + off, verts=vs)
    return mesh_obj(name, bm, RIPE, smooth=True)


BUNCHES = []


def palm(i, x, z, h):
    lean = Vector((R.uniform(-0.25, 0.25), R.uniform(-0.25, 0.25), 0))
    base = B(x, 0, z); top = B(x, h, z) + lean
    cu = D.curves.new(f'PalmTrunk{i}', 'CURVE'); cu.dimensions = '3D'
    sp = cu.splines.new('POLY'); sp.points.add(2)
    for k, t in enumerate((0, 0.5, 1)):
        p = base.lerp(top, t); sp.points[k].co = (p.x, p.y, p.z, 1)
    cu.bevel_depth = 0.11; cu.bevel_resolution = 2; cu.use_fill_caps = True
    tr = D.objects.new(f'Palm{i}_trunk', cu); coll.objects.link(tr)
    sp.use_smooth = True
    cu.materials.append(TRUNK)
    # the green crownshaft under the leaves, as on every areca palm
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.15, radius2=0.12, depth=1.4)
    bmesh.ops.translate(bm, vec=top + Vector((0, 0, -0.75)), verts=bm.verts)
    mesh_obj(f'Palm{i}_shaft', bm, SHAFT, smooth=True)
    # an areca crown: fewer, shorter, more upright fronds than a coconut's
    yaw = R.uniform(0, math.tau); s = R.uniform(0.62, 0.78)
    Mf = Matrix.Translation(top) @ Matrix.Rotation(yaw, 4, 'Z') @ Matrix.Scale(s, 4) @ Matrix.Translation(-OLD_CROWN)
    for k, f in enumerate(fronds):
        if k % 4 == 3:
            continue
        c = f.copy(); coll.objects.link(c); c.matrix_world = Mf @ f.matrix_world
        c.name = f'Palm{i}_frond{k}'
    # The ripe bunches are drawn live on the page (lit like the nuts on the
    # roofs, so the two oranges match): only their places travel in the GLB.
    for b in range(R.choice((1, 2, 2))):
        a = yaw + b * 2.4
        at = top + Vector((math.cos(a) * 0.32, math.sin(a) * 0.32, -1.5))
        BUNCHES.append([round(at.x, 3), round(at.z, 3), round(-at.y, 3)])


avoid = [(0, 0, 9), (12, 3, 6)] + [(x, z, 8) for x, z in ROOFS] + [(x, z, r) for x, z, r in tile_houses]
palms = []
while len(palms) < 64:
    x = R.uniform(-90, 90); z = R.uniform(-85, 50)
    if any(math.hypot(x - ax, z - az) < ar for ax, az, ar in avoid):
        continue
    if z > 14 and -16 < x < 26:          # the near views stay clear
        continue
    if 6 < x < 24 and -6 < z < 20:      # the courtyard and the dryer shot
        continue
    if in_factory(x, z):
        continue
    if any(math.hypot(x - px, z - pz) < 3.2 for px, pz, _ in palms):
        continue
    palms.append((x, z, R.uniform(11, 16.5)))
for i, (x, z, h) in enumerate(palms):
    palm(i, x, z, h)
print('[village] palms', len(palms), 'bunches', len(BUNCHES))
import json
sc['areca_bunches'] = json.dumps(BUNCHES)

# bushes round the houses
bushes = [o for n, o in templates.items() if n.startswith('Bush')]
for i in range(38):
    hx, hz = R.choice([(0, 0)] + ROOFS + [(x, z) for x, z, _ in tile_houses])
    a = R.uniform(0, math.tau); rr = R.uniform(6.5, 10)
    x, z = hx + math.cos(a) * rr, hz + math.sin(a) * rr
    if 6 < x < 24 and -6 < z < 20:
        continue
    t = R.choice(bushes)
    c = t.copy(); c.data = t.data.copy(); coll.objects.link(c)
    tc = t.matrix_world.translation
    c.matrix_world = Matrix.Translation(B(x, 0, z) + Vector((0, 0, tc.z))) @ Matrix.Rotation(R.uniform(0, 6), 4, 'Z') @ Matrix.Scale(R.uniform(0.8, 1.3), 4) @ Matrix.Translation(-tc) @ t.matrix_world
    c.name = f'Bush_v{i}'


# ------------------------------------------------------------------ ground
def ground_plane():
    """One ground for the whole village, its UVs packed densest at the
    village and thinning towards the horizon, so it is sharp underfoot and
    has no seam where a near patch would meet a far one. (The bake keeps
    these UVs instead of unwrapping; see bake_village.py.)"""
    N = 96; X0, X1 = -280.0, 280.0; Z0, Z1 = -320.0, 240.0; CX, CZ = 0.0, -10.0
    K = 4.5
    G = lambda a: (1 - math.exp(-K * a)) / (1 - math.exp(-K))
    def warp(t, c, lo, hi):
        u = (t - c) / ((c - lo) if t < c else (hi - c))
        return 0.5 + 0.5 * math.copysign(G(abs(u)), u)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    grid = [[bm.verts.new(B(X0 + (X1 - X0) * i / N, 0, Z0 + (Z1 - Z0) * j / N)) for j in range(N + 1)] for i in range(N + 1)]
    for i in range(N):
        for j in range(N):
            f = bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    bm.normal_update()
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
        for l in f.loops:
            x, z = l.vert.co.x, -l.vert.co.y            # back to page axes
            l[uv].uv = (warp(x, CX, X0, X1), warp(z, CZ, Z0, Z1))
    me = D.meshes.new('Plot_ground'); bm.to_mesh(me); bm.free()
    o = D.objects.new('Plot_ground', me); coll.objects.link(o)
    me.materials.append(GROUND)


ground_plane()

# templates out of the way: they are not part of the village
for o in templates.values():
    D.objects.remove(o, do_unlink=True)

# purge: everything that is not in the village (or the floor and sun)
for o in list(sc.objects):
    if o.name in KEEP or coll in o.users_collection:
        continue
    D.objects.remove(o, do_unlink=True)

# a camera for previews
cam = D.cameras.new('Preview'); co = D.objects.new('Preview', cam); coll.objects.link(co); sc.camera = co
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print('[village] saved', OUT, len(coll.objects), 'objects')
