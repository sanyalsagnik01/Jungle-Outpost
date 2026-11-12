"""Weapons + grenades. Each is one mesh, barrel along -Y (game +Z), origin at the firing-hand grip,
with a child empty named 'muzzle'.  Run inside Blender the same way as build_kade.py."""
import bpy, os, sys, importlib
SRC = os.path.dirname(os.path.abspath(JO_SRC)) if 'JO_SRC' in globals() else os.path.dirname(os.path.abspath(__file__))
if SRC not in sys.path: sys.path.insert(0, SRC)
import jo_lib; importlib.reload(jo_lib)
from jo_lib import *
OUT = os.path.dirname(SRC); PREV = os.path.join(SRC, 'preview'); os.makedirs(PREV, exist_ok=True)
Y = (90, 0, 0)          # lay a Z-axis cylinder along Y


def ar(b):
    b.box((0.06, 0.34, 0.11), (0, -0.1, 0.055), 'gunmetal', bevel=0.01)
    b.box((0.068, 0.26, 0.078), (0, -0.39, 0.06), 'fatigue_dark', bevel=0.012)
    for i in range(3): b.box((0.072, 0.02, 0.05), (0, -0.31 - i * 0.07, 0.06), 'gunmetal')
    b.cyl(0.014, 0.014, 0.24, (0, -0.62, 0.065), 'steel', rot=Y)
    b.cyl(0.022, 0.022, 0.06, (0, -0.75, 0.065), 'gunmetal', rot=Y)
    b.box((0.045, 0.06, 0.13), (0, 0.01, -0.05), 'rubber', rot=(-14, 0, 0), bevel=0.01)
    b.box((0.04, 0.075, 0.2), (0, -0.14, -0.09), 'steel', rot=(12, 0, 0), bevel=0.008)
    b.box((0.05, 0.24, 0.085), (0, 0.19, 0.035), 'gunmetal', taper_y=1.0, bevel=0.012)
    b.box((0.056, 0.03, 0.135), (0, 0.32, 0.025), 'rubber', bevel=0.008)
    b.box((0.026, 0.15, 0.03), (0, -0.1, 0.135), 'gunmetal', bevel=0.006)
    b.box((0.012, 0.02, 0.05), (0, -0.04, 0.12), 'gunmetal'); b.box((0.012, 0.02, 0.05), (0, -0.16, 0.12), 'gunmetal')
    b.box((0.012, 0.02, 0.065), (0, -0.5, 0.125), 'gunmetal')
    b.box((0.012, 0.03, 0.02), (0.034, -0.02, 0.06), 'brass')
    return (0, -0.78, 0.065)


def shotgun(b):
    b.box((0.065, 0.3, 0.1), (0, -0.08, 0.05), 'gunmetal', bevel=0.012)
    b.cyl(0.022, 0.022, 0.56, (0, -0.5, 0.075), 'steel', rot=Y)
    b.cyl(0.019, 0.019, 0.46, (0, -0.45, 0.028), 'gunmetal', rot=Y)
    b.box((0.075, 0.17, 0.07), (0, -0.4, 0.03), 'wood_dark', bevel=0.014)
    for i in range(4): b.box((0.079, 0.012, 0.05), (0, -0.345 - i * 0.036, 0.03), 'wood')
    b.box((0.05, 0.07, 0.13), (0, 0.035, -0.045), 'wood', rot=(-24, 0, 0), bevel=0.012)
    b.box((0.055, 0.3, 0.1), (0, 0.22, 0.0), 'wood', rot=(-8, 0, 0), taper=1.0, bevel=0.016)
    b.box((0.06, 0.03, 0.125), (0, 0.375, -0.02), 'rubber', rot=(-8, 0, 0), bevel=0.008)
    b.box((0.012, 0.012, 0.022), (0, -0.76, 0.105), 'brass')
    b.box((0.03, 0.09, 0.012), (0.036, -0.06, 0.04), 'red')               # loaded shell showing in the port
    return (0, -0.79, 0.075)


def marksman(b):
    b.box((0.055, 0.36, 0.1), (0, -0.1, 0.05), 'gunmetal', bevel=0.01)
    b.box((0.05, 0.26, 0.06), (0, -0.4, 0.04), 'wood', bevel=0.012)
    b.cyl(0.013, 0.013, 0.52, (0, -0.62, 0.062), 'steel', rot=Y)
    b.cyl(0.026, 0.026, 0.14, (0, -0.93, 0.062), 'gunmetal', rot=Y)
    b.cyl(0.032, 0.032, 0.26, (0, -0.09, 0.165), 'gunmetal', rot=Y)       # scope
    b.cyl(0.04, 0.034, 0.05, (0, -0.24, 0.165), 'gunmetal', rot=Y); b.cyl(0.036, 0.036, 0.04, (0, 0.05, 0.165), 'gunmetal', rot=Y)
    b.cyl(0.033, 0.033, 0.006, (0, -0.267, 0.165), 'glass', rot=Y); b.cyl(0.03, 0.03, 0.006, (0, 0.072, 0.165), 'glass', rot=Y)
    b.box((0.02, 0.03, 0.04), (0, -0.17, 0.125), 'steel'); b.box((0.02, 0.03, 0.04), (0, -0.01, 0.125), 'steel')
    b.cyl(0.012, 0.012, 0.03, (0, -0.09, 0.205), 'steel_light', segs=6)
    b.box((0.045, 0.06, 0.13), (0, 0.02, -0.05), 'wood_dark', rot=(-16, 0, 0), bevel=0.01)
    b.box((0.038, 0.07, 0.11), (0, -0.15, -0.045), 'steel', bevel=0.008)
    b.box((0.05, 0.34, 0.1), (0, 0.24, 0.02), 'wood', rot=(-5, 0, 0), bevel=0.016)
    b.box((0.04, 0.16, 0.035), (0, 0.22, 0.085), 'wood_dark', bevel=0.01)  # cheek rest
    b.box((0.055, 0.03, 0.125), (0, 0.415, 0.005), 'rubber', bevel=0.008)
    for sx in (1, -1): b.box((0.012, 0.22, 0.012), (0.03 * sx, -0.42, 0.0), 'steel_light', rot=(4, 0, 0))   # folded bipod
    return (0, -1.01, 0.062)


def crossbow(b):
    b.box((0.05, 0.62, 0.07), (0, -0.12, 0.04), 'wood_dark', bevel=0.012)
    b.box((0.03, 0.5, 0.012), (0, -0.2, 0.08), 'gunmetal')                # rail
    for sx in (1, -1):
        b.box((0.3, 0.04, 0.032), (0.145 * sx, -0.39, 0.055), 'gunmetal', rot=(0, 0, 22 * sx), bevel=0.008)   # limbs
        b.cyl(0.018, 0.018, 0.02, (0.285 * sx, -0.335, 0.055), 'steel_light', segs=7)                          # cams
        b.box((0.3, 0.006, 0.006), (0.143 * sx, -0.235, 0.085), 'white', rot=(0, 0, 35 * sx))                  # string (drawn)
    b.box((0.07, 0.05, 0.05), (0, -0.42, 0.045), 'steel', bevel=0.008)
    b.box((0.09, 0.012, 0.09), (0, -0.47, 0.0), 'steel')                   # stirrup
    b.cyl(0.007, 0.007, 0.42, (0, -0.3, 0.094), 'tan', rot=Y, segs=6)      # bolt
    b.cyl(0.0, 0.014, 0.05, (0, -0.53, 0.094), 'steel_light', rot=Y, segs=6)
    for a in (0, 120, 240): b.box((0.002, 0.06, 0.02), (0, -0.115, 0.094), 'red', rot=(0, a, 0))
    b.box((0.045, 0.06, 0.13), (0, 0.02, -0.045), 'rubber', rot=(-16, 0, 0), bevel=0.01)
    b.box((0.05, 0.14, 0.11), (0, 0.24, 0.02), 'wood', bevel=0.014)
    b.cyl(0.02, 0.02, 0.16, (0, 0.0, 0.13), 'gunmetal', rot=Y); b.box((0.014, 0.02, 0.04), (0, 0.0, 0.1), 'steel')
    return (0, -0.56, 0.094)


def flamethrower(b):
    for sx in (1, -1):
        b.cyl(0.062, 0.062, 0.3, (0.066 * sx, 0.2, 0.03), 'red', rot=Y, segs=9, bevel=0.01)
        b.cyl(0.03, 0.03, 0.03, (0.066 * sx, 0.03, 0.03), 'steel', rot=Y, segs=7)
    b.box((0.2, 0.03, 0.03), (0, 0.12, 0.03), 'steel'); b.box((0.2, 0.03, 0.03), (0, 0.28, 0.03), 'steel')
    b.box((0.06, 0.2, 0.08), (0, -0.06, 0.045), 'gunmetal', bevel=0.012)
    b.cyl(0.028, 0.028, 0.42, (0, -0.36, 0.055), 'gunmetal', rot=Y)
    b.cyl(0.036, 0.036, 0.16, (0, -0.33, 0.055), 'steel', rot=Y)          # heat shield
    b.cyl(0.05, 0.03, 0.09, (0, -0.61, 0.055), 'steel_light', rot=Y)      # flared nozzle
    b.cyl(0.008, 0.008, 0.12, (0, -0.58, 0.105), 'brass', rot=Y, segs=5)  # pilot line
    b.box((0.016, 0.016, 0.016), (0, -0.65, 0.105), 'orange')             # pilot flame
    b.box((0.045, 0.06, 0.13), (0, 0.0, -0.05), 'rubber', rot=(-14, 0, 0), bevel=0.01)
    b.box((0.04, 0.05, 0.11), (0, -0.3, -0.03), 'rubber', bevel=0.01)
    b.box((0.02, 0.16, 0.02), (0.04, 0.02, 0.09), 'rubber', rot=(0, 0, 0))  # hose
    b.cyl(0.02, 0.02, 0.012, (0.034, -0.08, 0.09), 'yellow', rot=(0, 90, 0), segs=7)   # pressure gauge
    return (0, -0.67, 0.055)


def frag(b):
    b.ball(0.046, (0, 0, 0), 'fatigue_dark', scale=(1, 1, 1.22), subdiv=1)
    for z in (-0.02, 0.0, 0.02): b.cyl(0.048, 0.048, 0.006, (0, 0, z), 'vest', segs=8)
    b.cyl(0.018, 0.018, 0.03, (0, 0, 0.066), 'steel', segs=7)
    b.box((0.016, 0.012, 0.09), (0, -0.036, 0.04), 'brass', rot=(14, 0, 0))            # spoon lever
    b.cyl(0.016, 0.016, 0.005, (0.03, 0, 0.078), 'steel_light', rot=(90, 0, 0), segs=7)  # pin ring
    return (0, 0, 0.09)


def smoke(b):
    b.cyl(0.036, 0.036, 0.12, (0, 0, 0), 'slate', segs=9, bevel=0.006)
    b.cyl(0.0375, 0.0375, 0.022, (0, 0, 0.02), 'cyan', segs=9)
    b.cyl(0.03, 0.03, 0.02, (0, 0, 0.07), 'steel', segs=8)
    b.cyl(0.012, 0.012, 0.02, (0, 0, 0.09), 'steel_light', segs=6)
    b.box((0.016, 0.012, 0.1), (0, -0.04, 0.035), 'steel_light', rot=(8, 0, 0))
    b.cyl(0.016, 0.016, 0.005, (0.028, 0, 0.092), 'steel_light', rot=(90, 0, 0), segs=7)
    return (0, 0, 0.11)


# (file name, builder, uniform scale): long guns are authored oversized for chunky detail, then brought to real-world length
SPECS = [('ar', ar, 0.8), ('shotgun', shotgun, 0.8), ('marksman', marksman, 0.8), ('crossbow', crossbow, 0.9), ('flamethrower', flamethrower, 0.85), ('frag_grenade', frag, 1.0), ('smoke_grenade', smoke, 1.0)]
reset_scene()
report, made = [], []
for i, (name, fn, sc) in enumerate(SPECS):
    b = Builder('wpn_' + name); mz = tuple(c * sc for c in fn(b)); b.scale(sc); mesh = b.build(SRC)
    muzzle = add_empty('muzzle', mz, mesh)
    path = os.path.join(OUT, name + '.glb'); export_glb(path, [mesh, muzzle], anim=False)
    info = verify_glb(path); info['built_tris'] = tri_count(mesh); report.append(info)
    small = 'grenade' in name
    preview(os.path.join(PREV, 'wpn_%s.png' % name), target=(0, -0.2 if not small else 0, 0.04), dist=1.7 if not small else 0.45, yaw=62, pitch=18, res=420)
    mesh.hide_render = True; mesh.location.x = (i - 3) * 0.5; muzzle.name = 'muzzle_' + name; made.append(mesh)
for m in made: m.hide_render = False
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SRC, 'weapons.blend'), copy=True, check_existing=False)
result = {'weapons': report, 'bundle': bundle_models(OUT)}
