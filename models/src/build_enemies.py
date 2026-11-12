"""The six regular enemies. Humanoids share Kade's rig and clip names; the drone has its own (hover, dive).
Rifleman and Sniper carry no gun mesh: the game seats ar.glb / marksman.glb on socket_hand.R."""
import bpy, os, sys, importlib
SRC = os.path.dirname(os.path.abspath(JO_SRC)) if 'JO_SRC' in globals() else os.path.dirname(os.path.abspath(__file__))
if SRC not in sys.path: sys.path.insert(0, SRC)
import jo_lib, jo_human; importlib.reload(jo_lib); importlib.reload(jo_human)
from jo_lib import *
from jo_human import *
OUT = os.path.dirname(SRC); PREV = os.path.join(SRC, 'preview'); os.makedirs(PREV, exist_ok=True)
ONLY = globals().get('JO_ONLY'); DO_PREVIEW = globals().get('JO_PREVIEW', True)
report = []


def finish(name, arm, meshes, clips, shots=(('idle', 1, 35), ('run', 5, 90), ('attack', 12, 40)), target=(0, 0, 0.95), dist=3.6):
    if DO_PREVIEW:
        ad = arm.animation_data
        for clip, frame, yaw in shots:
            ad.action = bpy.data.actions[clip]
            try:
                if ad.action_slot is None and len(ad.action.slots): ad.action_slot = ad.action.slots[0]
            except Exception: pass
            bpy.context.scene.frame_set(frame)
            preview(os.path.join(PREV, '%s_%s.png' % (name, clip)), yaw=yaw, target=target, dist=dist, res=420)
    push_to_nla(arm, clips); bpy.context.scene.frame_set(1)
    path = os.path.join(OUT, name + '.glb'); export_glb(path, [arm] + meshes, anim=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SRC, name + '.blend'), copy=True, check_existing=False)
    info = verify_glb(path); info['built_tris'] = sum(tri_count(m) for m in meshes); report.append(info)


def rifleman():
    reset_scene(); arm = make_armature('Rifleman', human_bones())
    C = dict(shirt='olive', shirt_dark='olive_dark', pants='olive', pants_dark='olive_dark', skin='skin_pale', skin_dark='skin_pale_dark', gear='vest', boot='boot', glove='vest', belt='leather')
    b = Builder('Rifleman_mesh'); human_body(b, C); helmet(b, 'olive_dark', 'vest')
    for x in (-0.1, 0.02, 0.13): b.box((0.085, 0.045, 0.11), (x, -0.165, 1.31), 'canvas', 'chest', bevel=0.01)      # magazine pouches
    b.box((0.26, 0.12, 0.26), (0, 0.185, 1.34), 'olive_dark', 'chest', bevel=0.025)
    b.box((0.09, 0.07, 0.12), (0.16, -0.11, 0.975), 'canvas', 'hips', bevel=0.012)
    mesh = b.build(SRC, arm)
    finish('rifleman', arm, [mesh], human_clips(arm, RIFLE_POSE, 'rifle'), shots=(('idle', 1, 35), ('run', 5, 90), ('death', 30, 60)))


def runner():
    reset_scene(); w = 0.9; arm = make_armature('Runner', human_bones(w))
    C = dict(shirt='orange_cloth', shirt_dark='brown_dark', pants='tan_dark', pants_dark='brown_dark', skin='skin_tan', skin_dark='skin_tan_dark', gear='brown_dark', boot='brown_dark', glove='skin_tan', belt='red_dark')
    b = Builder('Runner_mesh'); human_body(b, C, w=w, sleeves='bare', vest=False, knee=False)
    b.box((0.215, 0.235, 0.05), (0, -0.003, 1.775), 'red', 'head', bevel=0.012)                    # bandana
    b.box((0.2, 0.2, 0.06), (0, 0.01, 1.825), 'hair', 'head', bevel=0.02)
    b.box((0.05, 0.03, 0.16), (0.07, 0.125, 1.72), 'red', 'head', rot=(18, 0, 8)); b.box((0.05, 0.03, 0.13), (0.02, 0.13, 1.72), 'red_dark', 'head', rot=(24, 0, -6))
    b.box((0.34, 0.03, 0.07), (0, -0.115, 1.34), 'leather', 'chest', rot=(0, 28, 0))               # chest strap
    b.box((0.05, 0.05, 0.14), (-0.14, -0.1, 0.99), 'leather', 'hips', bevel=0.01)
    hx = -0.27 * w                                                                                   # machete in the right fist, edge forward
    b.box((0.03, 0.05, 0.14), (hx, -0.02, 0.86), 'wood_dark', 'hand.R', bevel=0.008)
    b.box((0.05, 0.1, 0.02), (hx, -0.05, 0.79), 'brass', 'hand.R')
    b.box((0.014, 0.085, 0.6), (hx, -0.065, 0.49), 'steel_light', 'hand.R', taper_y=1.25)
    b.box((0.016, 0.03, 0.6), (hx, -0.02, 0.49), 'steel', 'hand.R')
    mesh = b.build(SRC, arm)
    base = {'upper_arm.R': (-18, 0, 8), 'forearm.R': (-38, 0, 0), 'upper_arm.L': (6, 0, -10), 'forearm.L': (-30, 0, 0)}
    finish('runner', arm, [mesh], human_clips(arm, base, 'machete', swing=26, lean=16), shots=(('idle', 1, 35), ('run', 1, 90), ('attack', 9, 40)))


def sniper():
    reset_scene(); arm = make_armature('Sniper', human_bones())
    C = dict(shirt='ghillie', shirt_dark='ghillie_dark', pants='ghillie', pants_dark='ghillie_dark', skin='skin_pale', skin_dark='skin_pale_dark', gear='ghillie_dark', boot='boot', glove='ghillie_dark', belt='brown_dark')
    b = Builder('Sniper_mesh'); human_body(b, C, sleeves='long', vest=False)
    b.box((0.26, 0.2, 0.3), (0, 0.035, 1.71), 'ghillie_dark', 'head', bevel=0.04)                  # hood
    b.box((0.27, 0.1, 0.05), (0, -0.09, 1.835), 'ghillie_dark', 'head', bevel=0.015)
    b.box((0.21, 0.04, 0.09), (0, -0.115, 1.615), 'ghillie', 'head', bevel=0.01)                   # face scarf
    b.box((0.46, 0.05, 0.4), (0, 0.15, 1.3), 'ghillie_dark', 'chest', rot=(-6, 0, 0), bevel=0.012) # cape
    import random; rnd = random.Random(7)
    for i in range(14):                                                                              # ghillie strips
        x = -0.24 + i * 0.037; l = 0.12 + rnd.random() * 0.14
        b.box((0.03, 0.02, l), (x, 0.185 + rnd.random() * 0.02, 1.12 - l / 2 + rnd.random() * 0.1), 'ghillie' if i % 2 else 'olive_dark', 'chest' if i % 3 else 'spine', rot=(rnd.uniform(-10, 4), 0, rnd.uniform(-8, 8)))
    for sx in (1, -1):
        for k in range(3): b.box((0.03, 0.02, 0.1), (0.3 * sx, -0.02 + k * 0.035, 1.25 - k * 0.02), 'ghillie', 'upper_arm.' + ('L' if sx > 0 else 'R'), rot=(0, 0, 10 * sx))
    b.box((0.035, 0.11, 0.035), (0.03, -0.14, 1.72), 'gunmetal', 'head')                           # monocular
    b.box((0.03, 0.01, 0.03), (0.03, -0.197, 1.72), 'lens_red', 'head')
    mesh = b.build(SRC, arm)
    finish('sniper', arm, [mesh], human_clips(arm, RIFLE_POSE, 'rifle'), shots=(('idle', 1, 35), ('idle', 24, 180), ('death', 30, 60)))


def grenadier():
    reset_scene(); w = 1.26; arm = make_armature('Grenadier', human_bones(w))
    C = dict(shirt='tan', shirt_dark='tan_dark', pants='tan_dark', pants_dark='brown_dark', skin='skin_pale', skin_dark='skin_pale_dark', gear='olive_dark', boot='boot', glove='brown_dark', belt='leather')
    b = Builder('Grenadier_mesh'); human_body(b, C, w=w); helmet(b, 'tan_dark', 'olive_dark')
    b.box((0.05, 0.02, 0.05), (0, -0.14, 1.83), 'hazard', 'head')
    b.box((0.44, 0.24, 0.44), (0, 0.27, 1.33), 'olive_dark', 'chest', bevel=0.04)                  # ordnance pack
    for sx in (1, -1): b.cyl(0.06, 0.06, 0.34, (0.15 * sx, 0.27, 1.63), 'hull_dark', 'chest', segs=8)
    b.box((0.62, 0.04, 0.1), (0, -0.2, 1.36), 'leather', 'chest', rot=(0, 32, 0), bevel=0.01)      # bandolier
    for i in range(5): b.ball(0.045, (-0.2 + i * 0.1, -0.235, 1.48 - i * 0.062), 'fatigue_dark', 'chest', scale=(1, 1, 1.15))
    for sx in (1, -1): b.ball(0.045, (0.2 * sx, -0.16, 0.98), 'fatigue_dark', 'hips', scale=(1, 1, 1.15))
    b.ball(0.05, (-0.27 * w, -0.03, 0.82), 'fatigue_dark', 'hand.R', scale=(1, 1, 1.2)); b.cyl(0.018, 0.018, 0.03, (-0.27 * w, -0.03, 0.885), 'steel', 'hand.R', segs=6)
    mesh = b.build(SRC, arm)
    base = {'upper_arm.R': (-10, 0, 12), 'forearm.R': (-30, 0, 0), 'upper_arm.L': (-8, 0, -12), 'forearm.L': (-26, 0, 0)}
    finish('grenadier', arm, [mesh], human_clips(arm, base, 'throw', swing=16, lean=5), shots=(('idle', 1, 35), ('walk', 1, 90), ('attack', 12, 40)))


def shield():
    reset_scene(); w = 1.15
    arm = make_armature('ShieldTrooper', human_bones(w, extra=[('shield', (0.1, -0.36, 1.1), 'chest')]))
    C = dict(shirt='slate', shirt_dark='slate_dark', pants='slate', pants_dark='slate_dark', skin='skin_pale', skin_dark='skin_pale_dark', gear='slate_dark', boot='boot', glove='slate_dark', belt='black')
    b = Builder('ShieldTrooper_mesh'); human_body(b, C, w=w, sleeves='long', face=False)
    b.box((0.25, 0.27, 0.28), (0, 0.0, 1.7), 'slate_dark', 'head', taper=0.92, bevel=0.045)        # full helmet
    b.box((0.2, 0.03, 0.07), (0, -0.135, 1.71), 'slate_light', 'head', bevel=0.008)                # visor
    b.box((0.08, 0.05, 0.1), (0, -0.13, 1.62), 'black', 'head', bevel=0.01)
    for sx in (1, -1):
        b.box((0.19, 0.2, 0.09), (0.3 * w * sx, 0, 1.5), 'slate_light', 'upper_arm.' + ('L' if sx > 0 else 'R'), bevel=0.03)   # pauldrons
        b.box((0.15, 0.05, 0.2), (0.1 * w * sx, -0.1, 0.34), 'slate_light', 'shin.' + ('L' if sx > 0 else 'R'), bevel=0.015)   # greaves
    b.box((0.4, 0.05, 0.16), (0, -0.16, 1.44), 'slate_light', 'chest', bevel=0.015)
    hx = -0.27 * w                                                                                   # baton
    b.cyl(0.022, 0.022, 0.16, (hx, -0.03, 0.86), 'rubber', 'hand.R', segs=7)
    b.cyl(0.026, 0.03, 0.5, (hx, -0.03, 0.55), 'black', 'hand.R', segs=7)
    b.cyl(0.04, 0.04, 0.03, (hx, -0.03, 0.79), 'steel', 'hand.R', segs=7)
    mesh = b.build(SRC, arm)
    s = Builder('shield')                                                                            # separate mesh, own bone
    s.box((1.0, 0.07, 1.42), (-0.05, -0.5, 1.08), 'slate_light', 'shield', taper=0.94, bevel=0.035)
    s.box((1.04, 0.05, 0.1), (-0.05, -0.515, 0.5), 'slate_dark', 'shield'); s.box((1.0, 0.05, 0.08), (-0.05, -0.515, 1.72), 'slate_dark', 'shield')
    s.box((0.5, 0.03, 0.12), (-0.05, -0.54, 1.5), 'glass', 'shield', bevel=0.008)                   # view slit
    s.box((0.34, 0.02, 0.1), (-0.05, -0.54, 1.0), 'hazard', 'shield'); s.box((0.08, 0.1, 0.3), (0.12, -0.44, 1.1), 'black', 'shield')
    smesh = s.build(SRC, arm)
    base = {'upper_arm.R': (-22, 0, 10), 'forearm.R': (-46, 0, 0), 'upper_arm.L': (-48, 0, -14), 'forearm.L': (-58, 0, -28)}
    finish('shield', arm, [mesh, smesh], human_clips(arm, base, 'baton', lean=4), shots=(('idle', 1, 35), ('walk', 1, 140), ('attack', 13, 40)))


def drone():
    reset_scene()
    rot = [('rotor_FL', (0.44, -0.44, 0.1)), ('rotor_FR', (-0.44, -0.44, 0.1)), ('rotor_BL', (0.44, 0.44, 0.1)), ('rotor_BR', (-0.44, 0.44, 0.1))]
    arm = make_armature('ScoutDrone', [('root', (0, 0, 0), None), ('body', (0, 0, 0.0), 'root'), ('gun', (0, -0.25, -0.16), 'body')] + [(n, h, 'body') for n, h in rot])
    b = Builder('ScoutDrone_mesh')
    b.box((0.5, 0.62, 0.2), (0, 0, 0), 'steel_dark', 'body', taper=0.82, bevel=0.05)
    b.box((0.3, 0.3, 0.1), (0, 0.06, 0.13), 'gunmetal', 'body', bevel=0.03)
    b.box((0.22, 0.06, 0.12), (0, -0.31, -0.01), 'black', 'body', bevel=0.015)
    b.box((0.13, 0.03, 0.07), (0, -0.345, -0.01), 'lens_red', 'body')                               # eye
    b.cyl(0.012, 0.012, 0.22, (0.12, 0.2, 0.26), 'rubber', 'body', segs=5)
    for n, h in rot:
        b.box((0.07, 0.07, 0.62), ((h[0]) / 2, (h[1]) / 2, 0.03), 'gunmetal', 'body', rot=(90, 0, 45 if h[0] * h[1] < 0 else -45))   # arm
        b.cyl(0.05, 0.05, 0.1, (h[0], h[1], 0.05), 'steel', 'body', segs=7)
        b.box((0.56, 0.05, 0.012), (h[0], h[1], 0.115), 'black', n); b.box((0.05, 0.56, 0.012), (h[0], h[1], 0.115), 'black', n)   # blades
        b.cyl(0.3, 0.3, 0.02, (h[0], h[1], 0.085), 'steel_dark', 'body', segs=10)                                                   # guard ring (disc)
    for sx in (1, -1): b.box((0.03, 0.4, 0.03), (0.16 * sx, 0, -0.17), 'steel', 'body'); b.box((0.03, 0.03, 0.1), (0.16 * sx, -0.12, -0.12), 'steel', 'body'); b.box((0.03, 0.03, 0.1), (0.16 * sx, 0.12, -0.12), 'steel', 'body')
    b.box((0.08, 0.08, 0.08), (0, -0.2, -0.14), 'gunmetal', 'gun', bevel=0.01); b.cyl(0.02, 0.02, 0.26, (0, -0.36, -0.16), 'black', 'gun', rot=(90, 0, 0), segs=6)
    mesh = b.build(SRC, arm)
    def spin(i, tilt=0.0, bob=0.0, roll=0.0, gun=0.0):
        d = {n: (0, i * 75.0 * (1 if k % 2 else -1), 0) for k, (n, _) in enumerate(rot)}
        d['body'] = (tilt, 0, roll); d['gun'] = (gun, 0, 0); return (i + 1, d, {'body': (0, bob, 0)})
    import math as _m
    hover = make_clip(arm, 'hover', [spin(i, tilt=2 * _m.sin(i / 24 * 6.283), bob=0.03 * _m.sin(i / 24 * 6.283), roll=1.5 * _m.cos(i / 24 * 6.283)) for i in range(25)], {}, loc_bones=('body',))
    dive = make_clip(arm, 'dive', [spin(i, tilt=38 + 3 * _m.sin(i / 12 * 6.283), roll=4 * _m.sin(i / 6 * 6.283), gun=-20) for i in range(13)], {}, loc_bones=('body',))
    finish('drone', arm, [mesh], [hover, dive], shots=(('hover', 1, 35), ('dive', 4, 90)), target=(0, 0, 0), dist=2.2)


for fn in (rifleman, runner, sniper, grenadier, shield, drone):
    if ONLY and fn.__name__ not in ONLY: continue
    fn()
result = {'enemies': report, 'bundle': bundle_models(OUT)}
