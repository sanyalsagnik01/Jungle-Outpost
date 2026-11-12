"""JUNGLE OUTPOST asset pipeline helpers (Blender 4.2+ / 5.x).

Conventions shared by every asset:
  * Blender: Z up, characters face -Y  ->  glTF / game: Y up, face +Z
  * metres, origin at the feet, transforms applied (geometry is built in place)
  * one shared material "JO_Palette": an 8x8 colour-swatch atlas, UVs sit on swatch centres
  * rigid skinning: every part is weighted 1.0 to exactly one bone
  * every bone points straight up with its Z axis facing forward, so bone-local axes equal
    character axes:  rot X = pitch (+ leans things above the pivot forward, swings limbs back)
                     rot Y = yaw   (+ turns left)      rot Z = roll (+ tilts right / lifts a left limb outward)
  * 24 fps, one NLA track per clip, exported with export_animation_mode='NLA_TRACKS'
"""
import bpy, bmesh, math, os
from mathutils import Vector, Matrix, Euler

FPS = 24
# name -> sRGB hex.  Order is the atlas order (row-major, 8 per row). Append only, never reorder.
PALETTE = [
    ('skin', 0xd9a676), ('skin_shadow', 0xb98458), ('hair', 0x2a1c14), ('eye', 0x16110e),
    ('fatigue', 0x3d5a2a), ('fatigue_dark', 0x2c4420), ('vest', 0x23281c), ('leather', 0x5a3a22),
    ('boot', 0x1c1a17), ('red', 0xb3261a), ('red_dark', 0x7a1810), ('canvas', 0x8a7a4c),
    ('gunmetal', 0x2b2f33), ('steel', 0x6a7078), ('steel_light', 0x9aa2aa), ('wood', 0x7a5a36),
    ('wood_dark', 0x5a4026), ('brass', 0xc9a020), ('rubber', 0x151515), ('glass', 0x2a8090),
    ('orange', 0xff8a20), ('yellow', 0xffd24a), ('white', 0xe9e4cf), ('olive', 0x6b7a3a),
    ('tan', 0x9a8454), ('slate', 0x3c4658), ('slate_light', 0x7f8ea8), ('purple', 0x3a2a55),
    ('cyan', 0x58e0d0), ('green_glow', 0x7fe04a), ('rust', 0x8a4a22), ('stone', 0x8d9088),
    # --- added in phase 2 (enemies and bosses) ---
    ('olive_dark', 0x4a5528), ('orange_cloth', 0xb5722a), ('brown_dark', 0x3a2a1a), ('skin_tan', 0xa9744a),
    ('skin_tan_dark', 0x85552f), ('ghillie', 0x2f4a2a), ('ghillie_dark', 0x1c2e1a), ('tan_dark', 0x6e5c38),
    ('slate_dark', 0x1e232c), ('steel_dark', 0x44484e), ('hull', 0x5a6052), ('hull_dark', 0x363c33),
    ('purple_dark', 0x16121f), ('pale', 0x9a8aa8), ('black', 0x0c0c0c), ('lens_red', 0xff3020),
    ('skin_pale', 0xc49062), ('skin_pale_dark', 0x9c6c44), ('hazard', 0xd0b020), ('bone', 0xd8d2bc),
]
CELLS = 8
_IDX = {n: i for i, (n, _) in enumerate(PALETTE)}


def pal_uv(name):
    i = _IDX[name]
    return ((i % CELLS + 0.5) / CELLS, 1.0 - (i // CELLS + 0.5) / CELLS)


def palette_image(folder):
    img = bpy.data.images.get('jo_palette')
    if img is None:
        px, size = 8, CELLS * 8
        img = bpy.data.images.new('jo_palette', size, size, alpha=False)
        buf = [0.0] * (size * size * 4)
        for y in range(size):
            for x in range(size):
                i = (CELLS - 1 - y // px) * CELLS + x // px          # image rows start at the bottom
                h = PALETTE[i][1] if i < len(PALETTE) else 0xff00ff
                o = (y * size + x) * 4
                buf[o] = ((h >> 16) & 255) / 255.0; buf[o + 1] = ((h >> 8) & 255) / 255.0; buf[o + 2] = (h & 255) / 255.0; buf[o + 3] = 1.0
        img.pixels = buf
        img.filepath_raw = os.path.join(folder, 'jo_palette.png'); img.file_format = 'PNG'; img.save()
    return img


def palette_material(folder):
    mat = bpy.data.materials.get('JO_Palette')
    if mat is None:
        mat = bpy.data.materials.new('JO_Palette')
        try: mat.use_nodes = True
        except Exception: pass
        nt = mat.node_tree
        bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = palette_image(folder); tex.interpolation = 'Closest'
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        bsdf.inputs['Roughness'].default_value = 1.0; bsdf.inputs['Metallic'].default_value = 0.0
    return mat


def reset_scene():
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.armatures, bpy.data.actions, bpy.data.cameras, bpy.data.lights):
        for d in list(coll):
            if d.users == 0: coll.remove(d)
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)
    for m in [m for m in bpy.data.materials if m.name.startswith('JO_Palette')]: bpy.data.materials.remove(m)      # palette may have grown
    for im in [im for im in bpy.data.images if im.name.startswith('jo_palette')]: bpy.data.images.remove(im)
    bpy.context.scene.render.fps = FPS; bpy.context.scene.frame_set(1)


def _link(obj):
    bpy.context.scene.collection.objects.link(obj); return obj


class Builder:
    """Accumulates chunky low-poly parts into one mesh; each part gets a palette colour and a bone."""

    def __init__(self, name):
        self.name = name; self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new('UVMap'); self.bl = self.bm.verts.layers.int.new('jo_bone'); self.bones = []

    def _bi(self, bone):
        if bone is None: return -1
        if bone not in self.bones: self.bones.append(bone)
        return self.bones.index(bone)

    def _finish(self, old, color, bone, loc, rot, bevel):
        new = [v for v in self.bm.verts if v not in old]
        if bevel > 0:
            edges = list({e for v in new for e in v.link_edges})
            bmesh.ops.bevel(self.bm, geom=edges, offset=bevel, segments=1, affect='EDGES', profile=0.5)
            new = [v for v in self.bm.verts if v not in old]
        M = Matrix.Translation(Vector(loc)) @ Euler([math.radians(a) for a in rot], 'XYZ').to_matrix().to_4x4()
        bi, uv = self._bi(bone), pal_uv(color)
        for v in new:
            v.co = M @ v.co; v[self.bl] = bi
        for f in {f for v in new for f in v.link_faces}:
            for l in f.loops: l[self.uv].uv = uv

    def box(self, size, loc, color, bone=None, rot=(0, 0, 0), taper=1.0, taper_y=None, bevel=0.0):
        old = set(self.bm.verts)
        for v in bmesh.ops.create_cube(self.bm, size=1.0)['verts']:
            if v.co.z > 0: v.co.x *= taper; v.co.y *= (taper if taper_y is None else taper_y)
            v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
        self._finish(old, color, bone, loc, rot, bevel)

    def cyl(self, r1, r2, depth, loc, color, bone=None, rot=(0, 0, 0), segs=8, bevel=0.0):
        """Cylinder / cone along local Z (r1 = bottom radius, r2 = top)."""
        old = set(self.bm.verts)
        bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r1, radius2=r2, depth=depth)
        self._finish(old, color, bone, loc, rot, bevel)

    def ball(self, r, loc, color, bone=None, scale=(1, 1, 1), subdiv=1):
        old = set(self.bm.verts)
        for v in bmesh.ops.create_icosphere(self.bm, subdivisions=subdiv, radius=r)['verts']:
            v.co.x *= scale[0]; v.co.y *= scale[1]; v.co.z *= scale[2]
        self._finish(old, color, bone, loc, (0, 0, 0), 0)

    def scale(self, s):
        for v in self.bm.verts: v.co *= s

    def build(self, folder, armature=None):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces[:])
        self.bm.verts.ensure_lookup_table()
        ids = [v[self.bl] for v in self.bm.verts]
        me = bpy.data.meshes.new(self.name); self.bm.to_mesh(me); self.bm.free()
        obj = _link(bpy.data.objects.new(self.name, me)); me.materials.append(palette_material(folder))
        if armature is not None:
            for i, b in enumerate(self.bones):
                obj.vertex_groups.new(name=b).add([vi for vi, k in enumerate(ids) if k == i], 1.0, 'REPLACE')
            loose = [vi for vi, k in enumerate(ids) if k < 0]
            if loose: raise RuntimeError('%d vertices have no bone in %s' % (len(loose), self.name))
            obj.modifiers.new('Armature', 'ARMATURE').object = armature; obj.parent = armature
        return obj


def tri_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def make_armature(name, bones):
    """bones: [(name, head_xyz, parent_or_None)].  All bones point up, Z axis forward (see module docstring)."""
    arm = bpy.data.armatures.new(name); obj = _link(bpy.data.objects.new(name, arm))
    bpy.context.view_layer.objects.active = obj; bpy.ops.object.mode_set(mode='EDIT')
    for n, h, p in bones:
        eb = arm.edit_bones.new(n); eb.head = h; eb.tail = (h[0], h[1], h[2] + 0.1)
        if p: eb.parent = arm.edit_bones[p]; eb.use_connect = False
    for eb in arm.edit_bones: eb.align_roll(Vector((0, -1, 0)))
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in obj.pose.bones: pb.rotation_mode = 'XYZ'
    arm.display_type = 'STICK'; obj.show_in_front = True
    return obj


def make_clip(arm, name, keys, base, loc_bones=('hips',)):
    """keys: [(frame, {bone: (rx, ry, rz) degrees}, {bone: (x, y, z) metres})]. Missing bones use `base`."""
    act = bpy.data.actions.new(name); act.use_fake_user = True
    arm.animation_data_create(); arm.animation_data.action = act
    for f, rots, locs in keys:
        for pb in arm.pose.bones:
            r = rots.get(pb.name, base.get(pb.name, (0, 0, 0)))
            pb.rotation_euler = Euler([math.radians(a) for a in r], 'XYZ'); pb.keyframe_insert('rotation_euler', frame=f)
            if pb.name in loc_bones:
                pb.location = locs.get(pb.name, (0, 0, 0)); pb.keyframe_insert('location', frame=f)
    return act


def push_to_nla(arm, actions):
    ad = arm.animation_data; ad.action = None
    for act in actions:
        tr = ad.nla_tracks.new(); tr.name = act.name
        st = tr.strips.new(act.name, 1, act); st.name = act.name
        try:
            if getattr(st, 'action_slot', None) is None and len(act.slots): st.action_slot = act.slots[0]
        except Exception: pass
        tr.mute = False
    for pb in arm.pose.bones: pb.rotation_euler = (0, 0, 0); pb.location = (0, 0, 0)


def add_empty(name, loc, parent=None):
    e = _link(bpy.data.objects.new(name, None)); e.empty_display_size = 0.05; e.location = loc
    if parent is not None: e.parent = parent
    return e


def export_glb(path, objs, anim=False):
    for o in bpy.data.objects: o.select_set(False)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
        export_materials='EXPORT', export_image_format='AUTO', export_vertex_color='NONE', export_all_vertex_colors=False,
        export_texcoords=True, export_normals=True, export_tangents=False, export_cameras=False, export_lights=False,
        export_skins=True, export_def_bones=False, export_rest_position_armature=True, export_influence_nb=1,
        export_animations=anim, export_animation_mode='NLA_TRACKS', export_force_sampling=True, export_frame_step=1,
        export_anim_slide_to_zero=True, export_reset_pose_bones=True, export_optimize_animation_size=True,
        export_morph=False)
    return os.path.getsize(path)


def verify_glb(path):
    """Re-import an exported GLB into a throwaway scene and report what is really in the file."""
    keep = bpy.context.window.scene
    tmp = bpy.data.scenes.new('jo_verify'); bpy.context.window.scene = tmp
    before = set(bpy.data.objects); acts_before = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=path)
    objs = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in objs if o.type == 'MESH' and len(o.data.materials)]      # skips the importer's bone-shape helper mesh
    lo = Vector((1e9, 1e9, 1e9)); hi = Vector((-1e9, -1e9, -1e9))
    for o in meshes:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    arms = [o for o in objs if o.type == 'ARMATURE']
    info = {
        'file': os.path.basename(path), 'bytes': os.path.getsize(path),
        'triangles': sum(tri_count(o) for o in meshes), 'meshes': len(meshes), 'materials': sorted({m.name.split('.')[0] for o in meshes for m in o.data.materials if m}),
        'bones': sum(len(a.data.bones) for a in arms), 'empties': sorted(o.name for o in objs if o.type == 'EMPTY'),
        'clips': sorted(a.name.split('.')[0] for a in bpy.data.actions if a not in acts_before),
        'size_xyz_m': [round(hi[i] - lo[i], 3) for i in range(3)] if meshes else None, 'min_z': round(lo.z, 3) if meshes else None,
    }
    new_actions = [a for a in bpy.data.actions if a not in acts_before]
    for o in objs: bpy.data.objects.remove(o, do_unlink=True)
    for a in new_actions: bpy.data.actions.remove(a)
    bpy.context.window.scene = keep; bpy.data.scenes.remove(tmp)
    return info


def preview(path, target=(0, 0, 0.95), dist=3.6, yaw=35, pitch=12, res=560):
    """Quick Workbench still for eyeballing an asset (camera + light are removed afterwards)."""
    sc = bpy.context.scene
    cam = _link(bpy.data.objects.new('jo_cam', bpy.data.cameras.new('jo_cam')))
    y, p = math.radians(yaw), math.radians(pitch); t = Vector(target)
    cam.location = t + Vector((math.sin(y) * math.cos(p), -math.cos(y) * math.cos(p), math.sin(p))) * dist
    cam.rotation_euler = (t - cam.location).to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = 50
    sc.camera = cam; sc.render.engine = 'BLENDER_WORKBENCH'; sc.render.resolution_x = sc.render.resolution_y = res; sc.render.resolution_percentage = 100
    sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'TEXTURE'; sh.show_shadows = False
    sc.render.film_transparent = False; sc.render.image_settings.file_format = 'PNG'; sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    return path


def bundle_models(models_dir):
    """Write models/models.bundle.js so the game can load models when index.html is opened from disk."""
    import base64, glob
    out = ['/* generated by tools/bundle_models.py - do not edit */', 'window.JO_MODEL_DATA = {']
    names = sorted(glob.glob(os.path.join(models_dir, '*.glb')))
    for p in names:
        with open(p, 'rb') as f: data = base64.b64encode(f.read()).decode('ascii')
        out.append('  "%s": "%s",' % (os.path.splitext(os.path.basename(p))[0], data))
    out.append('};')
    dst = os.path.join(models_dir, 'models.bundle.js')
    with open(dst, 'w', newline='\n') as f: f.write('\n'.join(out) + '\n')
    return {'bundle': os.path.basename(dst), 'models': len(names), 'bytes': os.path.getsize(dst)}
