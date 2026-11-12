"""The three bosses.  Brute and Phantom use the shared humanoid rig (scaled); the Commander's walker has its own.
Meshes named fx_* get their own material in the game so they can glow (weak point, core).
Meshes named panel_* are the walker's breakable armour; the game hides them in phase 3."""
import bpy, os, sys, importlib, math
SRC = os.path.dirname(os.path.abspath(JO_SRC)) if 'JO_SRC' in globals() else os.path.dirname(os.path.abspath(__file__))
if SRC not in sys.path: sys.path.insert(0, SRC)
import jo_lib, jo_human; importlib.reload(jo_lib); importlib.reload(jo_human)
from jo_lib import *
from jo_human import *
OUT = os.path.dirname(SRC); PREV = os.path.join(SRC, 'preview'); os.makedirs(PREV, exist_ok=True)
ONLY = globals().get('JO_ONLY'); DO_PREVIEW = globals().get('JO_PREVIEW', True)
report = []


def finish(name, arm, meshes, clips, shots, target, dist):
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


def brute():
    reset_scene(); w, S = 1.55, 2.3; hx = -0.27 * w
    arm = make_armature('Brute', scaled(human_bones(w, extra=[('barrel', (hx, 0, 0.74), 'forearm.R')]), S))
    C = dict(shirt='steel_dark', shirt_dark='gunmetal', pants='gunmetal', pants_dark='black', skin='skin_tan', skin_dark='skin_tan_dark', gear='red_dark', boot='black', glove='steel_dark', belt='rust')
    b = Builder('Brute_mesh'); human_body(b, C, w=w, sleeves='long')
    helmet(b, 'steel', 'steel_dark')
    for sx in (1, -1):
        b.cyl(0.04, 0.0, 0.2, (0.15 * sx, 0, 1.9), 'bone', 'head', rot=(0, 42 * sx, 0), segs=6)                       # horns
        b.box((0.3, 0.3, 0.17), (0.3 * w * sx, 0, 1.53), 'steel', 'upper_arm.' + ('L' if sx > 0 else 'R'), taper=0.8, bevel=0.04)
        b.box((0.2, 0.07, 0.24), (0.1 * w * sx, -0.11, 0.35), 'steel', 'shin.' + ('L' if sx > 0 else 'R'), bevel=0.02)
    b.box((0.2, 0.05, 0.1), (0, -0.115, 1.615), 'steel_dark', 'head', bevel=0.012)                                     # jaw guard
    b.box((0.52 * w, 0.06, 0.3), (0, -0.2, 1.39), 'red_dark', 'chest', bevel=0.02)
    b.box((0.2, 0.03, 0.2), (0, -0.235, 1.4), 'bone', 'chest', rot=(0, 45, 0))                                         # warlord's mark
    b.box((0.16, 0.17, 0.18), (0.27 * w, -0.005, 0.87), 'steel_dark', 'hand.L', bevel=0.03)                            # big fist
    # minigun built hanging from the right forearm (points forward once the arm is raised)
    b.box((0.2, 0.22, 0.26), (hx, 0, 0.98), 'gunmetal', 'forearm.R', bevel=0.03)
    b.box((0.12, 0.3, 0.1), (hx, 0.2, 1.02), 'brass', 'forearm.R', bevel=0.015)                                         # ammo feed
    b.cyl(0.085, 0.085, 0.1, (hx, 0, 0.8), 'steel_dark', 'barrel', segs=8); b.cyl(0.085, 0.085, 0.06, (hx, 0, 0.42), 'steel_dark', 'barrel', segs=8)
    for i in range(6):
        a = i / 6 * 6.283; b.cyl(0.02, 0.02, 0.56, (hx + math.cos(a) * 0.055, math.sin(a) * 0.055, 0.56), 'steel', 'barrel', segs=5)
    b.box((0.36 * w, 0.14, 0.4), (0, 0.2, 1.33), 'gunmetal', 'chest', bevel=0.03)                                       # tank cradle
    b.scale(S); mesh = b.build(SRC, arm)
    f = Builder('fx_weak')                                                                                              # glowing rear tank = weak point
    f.cyl(0.15, 0.15, 0.36, (0, 0.37, 1.16), 'orange', 'chest', segs=9, bevel=0.02)
    f.cyl(0.07, 0.07, 0.06, (0, 0.37, 1.37), 'yellow', 'chest', segs=7)
    f.scale(S); fx = f.build(SRC, arm)

    base = {'upper_arm.R': (-66, 0, 6), 'forearm.R': (-16, 0, 0), 'upper_arm.L': (-6, 0, -14), 'forearm.L': (-28, 0, 0)}
    def H(y=0.0, z=0.0): return {'hips': (0, y * S, z * S)}
    kneel = P(hips=(14, 0, 0), spine=(22, 0, 0), chest=(14, 0, 0), head=(24, 0, 0), thigh_L=(-84, 0, 0), shin_L=(92, 0, 0), thigh_R=(6, 0, 0), shin_R=(96, 0, 0), foot_R=(30, 0, 0),
              upper_arm_R=(-4, 0, 8), forearm_R=(-10, 0, 0), upper_arm_L=(-20, 0, -8), forearm_L=(-40, 0, 0))
    slam_up = P(chest=(-16, 0, 0), spine=(-8, 0, 0), head=(-14, 0, 0), upper_arm_L=(-178, 0, -16), forearm_L=(-20, 0, 0), upper_arm_R=(-150, 0, 10), thigh_L=(-10, 0, 0), shin_L=(24, 0, 0), thigh_R=(-10, 0, 0), shin_R=(24, 0, 0))
    slam_dn = P(hips=(16, 0, 0), spine=(30, 0, 0), chest=(18, 0, 0), head=(-10, 0, 0), upper_arm_L=(-58, 0, -6), forearm_L=(-6, 0, 0), upper_arm_R=(-40, 0, 6), thigh_L=(-52, 0, 0), shin_L=(70, 0, 0), thigh_R=(-52, 0, 0), shin_R=(70, 0, 0))
    spin = lambda i: {'barrel': (0, i * 80.0, 0)}
    custom = {
        'hit': [(1, {}, H()), (5, {**kneel, 'hips': (4, 0, 0)}, H(-0.2, -0.05)), (9, kneel, H(-0.4, -0.06)), (16, {**kneel, 'head': (30, 0, 0)}, H(-0.41, -0.06)), (24, kneel, H(-0.4, -0.06))],
        'attack': [(1, {}, H()), (10, slam_up, H(0.05)), (17, {**slam_up, 'chest': (-20, 0, 0)}, H(0.3)), (22, slam_dn, H(-0.3, -0.05)), (27, slam_dn, H(-0.28, -0.05)), (36, {}, H())],
        'shoot': [(i + 1, {**spin(i), 'upper_arm.R': (-84 + (i % 2) * 2.5, 0, 4), 'forearm.R': (-6, 0, 0), 'chest': (-3 + (i % 2), 6, 0), 'spine': (-2, 4, 0), 'upper_arm.L': (-30, 0, -20), 'forearm.L': (-50, 0, -10)}, H(-0.02)) for i in range(13)],
        'reload': [(1, {}, H()), (8, {**spin(2), 'upper_arm.R': (-84, 0, 4), 'forearm.R': (-6, 0, 0), 'chest': (-6, 6, 0), 'upper_arm.L': (-30, 0, -20), 'forearm.L': (-50, 0, -10), 'head': (-6, 0, 0)}, H(-0.02))]
                  + [(8 + i, {**spin(2 + i * 0.9), 'upper_arm.R': (-84, 0, 4), 'forearm.R': (-6, 0, 0), 'chest': (-6, 6, 0), 'upper_arm.L': (-30, 0, -20), 'forearm.L': (-50, 0, -10), 'head': (-6, 0, 0)}, H(-0.02)) for i in range(1, 15)],
    }
    clips = human_clips(arm, base, 'rifle', s=S, swing=12, lean=18, custom=custom)
    roar = P(chest=(-18, 0, 0), spine=(-8, 0, 0), head=(-26, 0, 0), upper_arm_L=(-30, 0, -74), forearm_L=(-50, 0, 0), upper_arm_R=(-128, 0, 20), thigh_L=(-8, 0, 8), thigh_R=(-8, 0, -8))
    clips.append(make_clip(arm, 'phase_change', [(1, {}, H()), (5, P(chest=(12, 0, 0), spine=(10, 0, 0), head=(14, 0, 0)), H(-0.06)), (11, roar, H(0.02)), (15, {**roar, 'head': (-22, 6, 0)}, H(0.02)), (19, {**roar, 'head': (-26, -6, 0)}, H(0.02)), (24, roar, H(0.02)), (32, {}, H())], base))
    crouch = P(hips=(20, 0, 0), spine=(26, 0, 0), chest=(10, 0, 0), head=(-32, 0, 0), thigh_L=(-58, 0, 0), shin_L=(74, 0, 0), thigh_R=(-20, 0, 0), shin_R=(64, 0, 0), foot_R=(24, 0, 0), upper_arm_L=(26, 0, -16), forearm_L=(-50, 0, 0), upper_arm_R=(-30, 0, 10), forearm_R=(-40, 0, 0))
    clips.append(make_clip(arm, 'special', [(1, {}, H()), (9, crouch, H(-0.2, 0.04)), (14, {**crouch, 'head': (-36, 0, 0)}, H(-0.22, 0.06)), (20, crouch, H(-0.2, 0.04)), (28, {**crouch, 'head': (-36, 0, 0)}, H(-0.22, 0.06))], base))
    finish('brute', arm, [mesh, fx], clips, (('idle', 1, 35), ('idle', 24, 160), ('shoot', 3, 60), ('hit', 12, 150), ('attack', 17, 40), ('special', 12, 70)), (0, 0, 2.2), 8.6)


def phantom():
    reset_scene(); w, S = 0.95, 1.18
    arm = make_armature('Phantom', scaled(human_bones(w, extra=[('cloak', (0, 0.15, 1.42), 'chest')]), S))
    C = dict(shirt='purple', shirt_dark='purple_dark', pants='purple_dark', pants_dark='black', skin='pale', skin_dark='purple', gear='purple_dark', boot='black', glove='black', belt='cyan')
    b = Builder('Phantom_mesh'); human_body(b, C, w=w, sleeves='long', knee=False, face=False)
    b.box((0.2, 0.22, 0.235), (0, -0.005, 1.69), 'purple_dark', 'head', taper=1.04, bevel=0.035)      # mask
    b.box((0.17, 0.02, 0.03), (0, -0.118, 1.715), 'cyan', 'head')                                      # eye slit
    b.box((0.02, 0.02, 0.09), (0, -0.118, 1.655), 'cyan', 'head')
    b.box((0.27, 0.24, 0.3), (0, 0.035, 1.72), 'purple', 'head', taper=0.8, bevel=0.05)               # hood
    b.box((0.28, 0.12, 0.06), (0, -0.085, 1.85), 'purple', 'head', bevel=0.02)
    b.box((0.6 * w, 0.36, 0.1), (0, 0.02, 1.5), 'purple', 'chest', taper=0.8, bevel=0.035)            # mantle
    b.box((0.5, 0.04, 0.9), (0, 0.19, 0.98), 'purple', 'cloak', rot=(-6, 0, 0), taper=0.8, bevel=0.012)
    for sx in (1, -1):
        b.box((0.04, 0.3, 0.74), (0.26 * sx, 0.06, 1.05), 'purple_dark', 'cloak', rot=(0, -5 * sx, 0), taper=0.8)
        for k in range(3): b.box((0.13, 0.03, 0.16 + k * 0.05), ((-0.17 + k * 0.17) * 1.0, 0.215, 0.5 - k * 0.02), 'purple_dark' if k % 2 else 'purple', 'cloak', rot=(-8, 0, (k - 1) * 6))
    b.box((0.1, 0.05, 0.08), (0, -0.125, 1.035), 'cyan', 'hips', bevel=0.01)
    b.box((0.3, 0.03, 0.05), (0, -0.13, 1.36), 'cyan', 'chest', rot=(0, 24, 0))
    b.scale(S); mesh = b.build(SRC, arm)
    kn = Builder('knives')                                                                              # separate mesh: one blade per fist
    for s, sx in (('L', 1), ('R', -1)):
        ax = 0.27 * w * sx
        kn.box((0.03, 0.04, 0.1), (ax, -0.03, 0.86), 'black', 'hand.' + s, bevel=0.006); kn.box((0.07, 0.03, 0.015), (ax, -0.03, 0.805), 'cyan', 'hand.' + s)
        kn.box((0.012, 0.045, 0.3), (ax, -0.035, 0.65), 'steel_light', 'hand.' + s, taper_y=0.3)
    kn.scale(S); knives = kn.build(SRC, arm)

    base = {'upper_arm.R': (-22, 0, 6), 'forearm.R': (-60, 0, 0), 'upper_arm.L': (-22, 0, -6), 'forearm.L': (-60, 0, 0), 'cloak': (5, 0, 0), 'head': (4, 0, 0)}
    def H(y=0.0, z=0.0): return {'hips': (0, y * S, z * S)}
    aim = P(upper_arm_R=(-86, 0, 6), forearm_R=(-4, 0, 0), chest=(0, 14, 0), upper_arm_L=(-10, 0, -14), forearm_L=(-70, 0, 0), head=(0, -8, 0))
    cross = P(upper_arm_R=(-70, 0, 46), forearm_R=(-80, 0, 0), upper_arm_L=(-70, 0, -46), forearm_L=(-80, 0, 0), chest=(8, 0, 0), spine=(6, 0, 0), head=(8, 0, 0), cloak=(-4, 0, 0))
    fling = P(upper_arm_R=(-80, 0, -62), forearm_R=(-6, 0, 0), upper_arm_L=(-80, 0, 62), forearm_L=(-6, 0, 0), chest=(-10, 0, 0), spine=(-4, 0, 0), head=(-8, 0, 0), cloak=(26, 0, 0), thigh_L=(-16, 0, 0), shin_L=(10, 0, 0))
    low = P(hips=(16, 0, 0), spine=(24, 0, 0), chest=(10, 0, 0), head=(-30, 0, 0), thigh_L=(-64, 0, 0), shin_L=(80, 0, 0), thigh_R=(-14, 0, 0), shin_R=(70, 0, 0), foot_R=(28, 0, 0),
            upper_arm_R=(34, 0, 14), forearm_R=(-30, 0, 0), upper_arm_L=(34, 0, -14), forearm_L=(-30, 0, 0), cloak=(30, 0, 0))
    custom = {
        'shoot': [(1, {}, H()), (4, aim, H()), (7, {**aim, 'upper_arm.R': (-92, 0, 6)}, H()), (10, aim, H()), (13, {**aim, 'upper_arm.R': (-92, 0, 6)}, H()), (17, aim, H()), (26, {}, H())],
        'attack': [(1, {}, H()), (8, cross, H(-0.03)), (13, {**cross, 'chest': (10, 0, 0)}, H(-0.04)), (16, fling, H(0.02, -0.06)), (20, {**fling, 'cloak': (14, 0, 0)}, H(0.02, -0.06)), (28, {}, H())],
        'reload': [(1, low, H(-0.3)), (5, low, H(-0.3)), (12, {'cloak': (16, 0, 0)}, H(0.02)), (16, {}, H())],
    }
    clips = human_clips(arm, base, 'rifle', s=S, swing=16, lean=24, custom=custom)
    rise = P(chest=(-14, 0, 0), spine=(-6, 0, 0), head=(-22, 0, 0), upper_arm_R=(-40, 0, -70), forearm_R=(-30, 0, 0), upper_arm_L=(-40, 0, 70), forearm_L=(-30, 0, 0), cloak=(22, 0, 0))
    clips.append(make_clip(arm, 'phase_change', [(1, {}, H()), (6, {**low, 'cloak': (10, 0, 0)}, H(-0.28)), (13, rise, H(0.08)), (18, {**rise, 'cloak': (30, 0, 0)}, H(0.1)), (23, rise, H(0.08)), (30, {}, H())], base))
    clips.append(make_clip(arm, 'special', [(1, {}, H()), (8, low, H(-0.3, 0.03)), (13, {**low, 'cloak': (36, 0, 0)}, H(-0.32, 0.05)), (18, low, H(-0.3, 0.03)), (24, {**low, 'cloak': (36, 0, 0)}, H(-0.32, 0.05))], base))
    finish('phantom', arm, [mesh, knives], clips, (('idle', 1, 35), ('idle', 24, 150), ('shoot', 7, 60), ('attack', 16, 30), ('special', 13, 70), ('run', 1, 90)), (0, 0, 1.1), 4.4)


def commander():
    reset_scene()
    LEGS = [('FL', 1, 1), ('FR', -1, 1), ('BL', 1, -1), ('BR', -1, -1)]       # (name, side: +1 = left, fore/aft: +1 = front)
    bones = [('root', (0, 0, 0), None), ('body', (0, 0, 3.3), 'root'), ('turret', (0, 0.5, 4.95), 'body'), ('gun', (0, -0.3, 5.1), 'turret'),
             ('pod_L', (2.2, 0.8, 4.3), 'body'), ('pod_R', (-2.2, 0.8, 4.3), 'body')]
    for n, sx, sf in LEGS:
        bones += [('leg_' + n, (sx * 1.6, -sf * 1.6, 2.7), 'body'), ('shin_' + n, (sx * 2.75, -sf * 1.6, 2.25), 'leg_' + n)]
    arm = make_armature('Commander', bones)
    b = Builder('Commander_mesh')
    b.box((3.4, 4.4, 1.7), (0, 0, 3.3), 'hull', 'body', bevel=0.14)
    b.box((3.6, 4.6, 0.3), (0, 0, 2.5), 'hull_dark', 'body', bevel=0.05); b.box((3.46, 4.46, 0.12), (0, 0, 4.1), 'hazard', 'body')
    b.box((1.7, 1.3, 0.9), (0, -1.0, 4.5), 'hull', 'body', taper=0.82, bevel=0.1); b.box((1.36, 0.08, 0.46), (0, -1.63, 4.52), 'glass', 'body', rot=(-12, 0, 0))
    for sx in (1, -1):
        b.box((0.5, 0.08, 0.4), (0.62 * sx, -1.2, 4.52), 'glass', 'body', rot=(0, 0, 60 * sx))                                 # side canopy glass
        b.cyl(0.14, 0.11, 0.9, (1.1 * sx, 1.9, 4.5), 'steel_dark', 'body', segs=7); b.cyl(0.16, 0.16, 0.08, (1.1 * sx, 1.9, 4.96), 'black', 'body', segs=7)   # exhausts
        b.box((0.3, 1.2, 0.5), (1.55 * sx, 1.4, 3.3), 'steel_dark', 'body', bevel=0.03)                                        # radiator blocks (under the side panels)
        for k in range(4): b.box((0.34, 0.06, 0.4), (1.57 * sx, 0.95 + k * 0.3, 3.3), 'black', 'body')
    b.box((1.6, 0.4, 1.0), (0, 2.2, 3.4), 'hull_dark', 'body', bevel=0.05)                                                     # rear engine block
    b.box((0.44, 0.34, 0.3), (0, -2.38, 2.45), 'hazard', 'body', bevel=0.04); b.box((0.3, 0.06, 0.18), (0, -2.56, 2.45), 'white', 'body')   # searchlight
    b.cyl(1.05, 1.05, 0.3, (0, -2.08, 3.2), 'black', 'body', rot=(90, 0, 0), segs=10)                                          # core housing
    b.cyl(1.15, 1.15, 0.12, (0, -2.2, 3.2), 'steel_dark', 'body', rot=(90, 0, 0), segs=10)
    for n, sx in (('pod_L', 1), ('pod_R', -1)):
        b.box((0.9, 1.5, 0.9), (2.2 * sx, 0.8, 4.3), 'red_dark', n, bevel=0.06); b.box((0.3, 0.5, 0.3), (1.75 * sx, 0.8, 4.1), 'hull_dark', 'body')
        for i in range(4): b.cyl(0.0, 0.14, 0.3, (2.2 * sx + (i % 2 - 0.5) * 0.4, 0.02, 4.3 + (i // 2 - 0.5) * 0.4), 'bone', n, rot=(90, 0, 0), segs=6)
    b.box((1.3, 1.5, 0.6), (0, 0.5, 5.1), 'hull_dark', 'turret', taper=0.86, bevel=0.07); b.cyl(0.5, 0.56, 0.16, (0, 0.5, 4.78), 'steel_dark', 'turret', segs=10)
    b.box((0.3, 0.3, 0.3), (0.4, 0.9, 5.5), 'steel', 'turret', bevel=0.03); b.cyl(0.02, 0.02, 0.9, (-0.45, 1.0, 5.8), 'black', 'turret', segs=5)
    b.box((1.0, 0.5, 0.4), (0, -0.4, 5.1), 'gunmetal', 'gun', bevel=0.04)
    for sx in (1, -1): b.cyl(0.1, 0.1, 2.1, (0.3 * sx, -1.6, 5.1), 'black', 'gun', rot=(90, 0, 0), segs=8); b.cyl(0.14, 0.14, 0.3, (0.3 * sx, -2.55, 5.1), 'steel_dark', 'gun', rot=(90, 0, 0), segs=8)
    for n, sx, sf in LEGS:
        hx, hy, kx = sx * 1.6, -sf * 1.6, sx * 2.75
        b.ball(0.42, (hx, hy, 2.7), 'steel_dark', 'body')
        b.box((0.5, 0.56, 1.3), ((hx + kx) / 2, hy, 2.475), 'hull', 'leg_' + n, rot=(0, math.degrees(math.atan2(sx * 1.15, -0.45)), 0), bevel=0.06)
        b.cyl(0.36, 0.36, 0.62, (kx, hy, 2.25), 'steel_dark', 'shin_' + n, rot=(90, 0, 0), segs=9)                             # knee
        b.box((0.44, 0.44, 2.1), (kx, hy, 1.2), 'hull_dark', 'shin_' + n, taper=1.25, bevel=0.05)
        b.cyl(0.07, 0.07, 1.3, (kx - sx * 0.3, hy, 1.4), 'steel_light', 'shin_' + n, segs=6)                                   # piston
        b.box((1.0, 1.0, 0.26), (kx, hy, 0.13), 'black', 'shin_' + n, taper=0.8, bevel=0.05); b.box((0.5, 0.3, 0.14), (kx, hy - sf * 0.55, 0.07), 'hazard', 'shin_' + n)
    mesh = b.build(SRC, arm)
    panels = []
    for name, size, loc in (('panel_front', (3.0, 0.3, 1.5), (0, -2.3, 3.3)), ('panel_L', (0.3, 3.6, 1.4), (1.85, 0, 3.3)), ('panel_R', (0.3, 3.6, 1.4), (-1.85, 0, 3.3))):
        pb = Builder(name); pb.box(size, loc, 'hull_dark', 'body', bevel=0.06)
        if name == 'panel_front':
            for sx in (1, -1): pb.box((0.5, 0.06, 0.5), (0.9 * sx, -2.47, 3.3), 'hazard', 'body', rot=(0, 45, 0)); pb.box((0.12, 0.08, 1.3), (1.38 * sx, -2.47, 3.3), 'steel', 'body')
        else:
            for k in range(3): pb.box((0.08, 0.9, 1.1), (loc[0] + (0.17 if loc[0] > 0 else -0.17), -1.2 + k * 1.2, 3.3), 'hull', 'body', bevel=0.02)
        panels.append(pb.build(SRC, arm))
    cb = Builder('fx_core'); cb.ball(0.85, (0, -2.2, 3.2), 'orange', 'body', subdiv=2); core = cb.build(SRC, arm)

    def leg(n, fwd=0.0, lift=0.0, knee=0.0):
        sx = 1 if n.endswith('L') else -1
        return {'leg_' + n: (0, -sx * fwd, sx * lift), 'shin_' + n: (0, 0, -sx * (lift * 0.7 + knee))}
    def pose(A=(0, 0), Bp=(0, 0), body=(0, 0, 0), **more):
        d = {}
        for n in ('FL', 'BR'): d.update(leg(n, *A))
        for n in ('FR', 'BL'): d.update(leg(n, *Bp))
        d['body'] = body; d.update(more); return d
    def Y(y): return {'body': (0, y, 0)}
    LB = ('body',)
    clips = [make_clip(arm, 'idle', [(1, pose(), Y(0)), (24, pose(body=(0.6, 0, 0), turret=(0, 0, 0)), Y(-0.05)), (48, pose(), Y(0))], {}, LB)]
    def gait(name, step, f, l):
        k = lambda i: 1 + i * step
        clips.append(make_clip(arm, name, [(k(0), pose((f, 0), (-f, 0), (0, 0, 1.2)), Y(0)), (k(1), pose((0, 0), (0, l), (0.8, 0, 0)), Y(0.06)),
                                           (k(2), pose((-f, 0), (f, 0), (0, 0, -1.2)), Y(0)), (k(3), pose((0, l), (0, 0), (0.8, 0, 0)), Y(0.06)), (k(4), pose((f, 0), (-f, 0), (0, 0, 1.2)), Y(0))], {}, LB))
    gait('walk', 8, 10, 11); gait('run', 4, 14, 15)
    clips.append(make_clip(arm, 'shoot', [(i + 1, pose(gun=(-2.5 * (i % 2), 0, 0), turret=(0.8 * (i % 2), 0, 0)), Y(0)) for i in range(9)], {}, LB))
    op = dict(pod_L=(-34, 0, -8), pod_R=(-34, 0, 8))
    clips.append(make_clip(arm, 'reload', [(1, pose(), Y(0)), (9, pose(**op), Y(-0.05)), (14, pose(pod_L=(-30, 0, -8), pod_R=(-30, 0, 8)), Y(-0.05)), (22, pose(**op), Y(-0.05))], {}, LB))
    clips.append(make_clip(arm, 'hit', [(1, pose(), Y(0)), (4, pose(body=(-6, 0, 5), turret=(4, 10, 0)), Y(-0.14)), (8, pose(body=(-2, 0, 2)), Y(-0.05)), (13, pose(), Y(0))], {}, LB))
    down = pose((0, 46), (0, 50), (9, 0, 11), turret=(22, 30, 8), gun=(28, 0, 0), pod_L=(20, 0, -30), pod_R=(-10, 0, 14))
    clips.append(make_clip(arm, 'death', [(1, pose(), Y(0)), (6, pose((0, 8), (0, 4), (-5, 0, -6), turret=(-6, -14, 0)), Y(0.12)), (12, pose((0, 16), (0, 22), (4, 0, 7), turret=(8, 10, 0)), Y(-0.6)),
                                          (22, down, Y(-1.95)), (26, pose((0, 43), (0, 47), (7, 0, 9), turret=(22, 30, 8), gun=(28, 0, 0), pod_L=(20, 0, -30), pod_R=(-10, 0, 14)), Y(-1.8)), (32, down, Y(-1.95)), (40, down, Y(-1.95))], {}, LB))
    up = pose((0, -4), (0, -4), (-7, 0, 0), turret=(-6, 0, 0)); front = {**up, **leg('FL', 6, 24), **leg('FR', 6, 24)}
    clips.append(make_clip(arm, 'attack', [(1, pose(), Y(0)), (11, front, Y(0.75)), (17, {**front, 'body': (-9, 0, 0)}, Y(0.95)), (20, pose((0, 8), (0, 8), (5, 0, 0)), Y(-0.3)), (24, pose((0, 5), (0, 5), (2, 0, 0)), Y(-0.15)), (31, pose(), Y(0))], {}, LB))
    sh = [(1, pose(), Y(0))] + [(3 + i * 3, pose((0, 4), (0, 4), (4 * (-1) ** i, 0, 5 * (-1) ** (i // 2)), turret=(6 * (-1) ** i, 12 * (-1) ** (i // 2), 0), pod_L=(-10 * (i % 2), 0, 0), pod_R=(-10 * ((i + 1) % 2), 0, 0)), Y(-0.2 - 0.05 * (i % 2))) for i in range(8)] + [(31, pose(), Y(0))]
    clips.append(make_clip(arm, 'phase_change', sh, {}, LB))
    charge = pose((0, 14), (0, 10), (11, 0, 0), turret=(-8, 0, 0), gun=(10, 0, 0))
    clips.append(make_clip(arm, 'special', [(1, pose(), Y(0)), (10, charge, Y(-0.55)), (15, {**charge, 'body': (12, 0, 0.8)}, Y(-0.58)), (20, {**charge, 'body': (11, 0, -0.8)}, Y(-0.55)), (28, {**charge, 'body': (12, 0, 0.8)}, Y(-0.58))], {}, LB))
    for m in panels: m.hide_render = False
    finish('commander', arm, [mesh] + panels + [core], clips, (('idle', 1, 35), ('idle', 24, 150), ('walk', 9, 70), ('attack', 17, 40), ('death', 40, 40), ('special', 12, 20)), (0, 0, 2.8), 16)


for fn in (brute, phantom, commander):
    if ONLY and fn.__name__ not in ONLY: continue
    fn()
result = {'bosses': report, 'bundle': bundle_models(OUT)}
