"""Kade (player): 1.8 m, rigged, 8 clips, weapon sockets.  Run inside Blender:
     exec(compile(open(r'<repo>/models/src/build_kade.py').read(), 'build_kade.py', 'exec'))
"""
import bpy, os, sys, importlib
SRC = os.path.dirname(os.path.abspath(JO_SRC)) if 'JO_SRC' in globals() else os.path.dirname(os.path.abspath(__file__))
if SRC not in sys.path: sys.path.insert(0, SRC)
import jo_lib; importlib.reload(jo_lib)
from jo_lib import *
OUT = os.path.dirname(SRC)

reset_scene()
BONES = [('root', (0, 0, 0), None), ('hips', (0, 0, 0.95), 'root'), ('spine', (0, 0, 1.06), 'hips'), ('chest', (0, 0, 1.24), 'spine'), ('head', (0, 0, 1.56), 'chest'),
         ('socket_back', (0, 0.29, 1.36), 'chest'), ('socket_hip.R', (-0.215, 0.0, 0.95), 'hips')]
for s, sx in (('L', 1), ('R', -1)):
    BONES += [('upper_arm.' + s, (0.27 * sx, 0, 1.46), 'chest'), ('forearm.' + s, (0.27 * sx, 0, 1.19), 'upper_arm.' + s), ('hand.' + s, (0.27 * sx, 0, 0.94), 'forearm.' + s),
              ('socket_hand.' + s, (0.27 * sx, -0.03, 0.87), 'hand.' + s),
              ('thigh.' + s, (0.1 * sx, 0, 0.92), 'hips'), ('shin.' + s, (0.1 * sx, 0, 0.5), 'thigh.' + s), ('foot.' + s, (0.1 * sx, 0, 0.09), 'shin.' + s)]
arm = make_armature('Kade', BONES)

b = Builder('Kade_mesh')
for s, sx in (('L', 1), ('R', -1)):
    x = 0.1 * sx
    b.box((0.155, 0.175, 0.44), (x, 0, 0.70), 'fatigue', 'thigh.' + s, taper=1.08, bevel=0.02)
    b.box((0.07, 0.05, 0.16), (x + 0.085 * sx, 0, 0.74), 'fatigue_dark', 'thigh.' + s, bevel=0.01)          # cargo pocket
    b.box((0.135, 0.06, 0.13), (x, -0.085, 0.5), 'vest', 'shin.' + s, bevel=0.015)                          # knee pad
    b.box((0.125, 0.14, 0.34), (x, 0, 0.34), 'fatigue_dark', 'shin.' + s, taper=1.1, bevel=0.018)
    b.box((0.145, 0.165, 0.17), (x, 0, 0.145), 'boot', 'shin.' + s, bevel=0.015)
    b.box((0.145, 0.3, 0.115), (x, -0.055, 0.0575), 'boot', 'foot.' + s, taper_y=0.86, taper=0.95, bevel=0.02)
    ax = 0.27 * sx
    b.box((0.135, 0.15, 0.1), (ax, 0, 1.475), 'fatigue_dark', 'upper_arm.' + s, bevel=0.025)                 # shoulder
    b.box((0.105, 0.115, 0.26), (ax, 0, 1.335), 'fatigue', 'upper_arm.' + s, bevel=0.018)
    b.box((0.118, 0.128, 0.05), (ax, 0, 1.205), 'fatigue_dark', 'upper_arm.' + s, bevel=0.012)               # rolled sleeve
    b.box((0.085, 0.092, 0.25), (ax, 0, 1.065), 'skin', 'forearm.' + s, taper=1.12, bevel=0.016)
    b.box((0.09, 0.105, 0.115), (ax, -0.005, 0.885), 'vest', 'hand.' + s, bevel=0.02)                        # glove
b.box((0.092, 0.1, 0.035), (0.27, 0, 0.965), 'leather', 'forearm.L', bevel=0.008)                            # watch strap
b.box((0.05, 0.02, 0.04), (0.27, -0.05, 0.965), 'steel_light', 'forearm.L')
# hips + belt (engineer's kit)
b.box((0.36, 0.22, 0.2), (0, 0, 0.94), 'fatigue', 'hips', bevel=0.025)
b.box((0.385, 0.24, 0.07), (0, 0, 1.035), 'leather', 'hips', bevel=0.012)
b.box((0.07, 0.02, 0.06), (0, -0.125, 1.035), 'brass', 'hips')
b.box((0.1, 0.07, 0.13), (0.15, -0.115, 0.975), 'canvas', 'hips', bevel=0.012)
b.box((0.09, 0.07, 0.1), (-0.13, -0.115, 0.985), 'canvas', 'hips', bevel=0.012)
b.box((0.035, 0.05, 0.22), (-0.215, 0.03, 0.93), 'steel', 'hips', bevel=0.008)                               # wrench
b.box((0.07, 0.05, 0.05), (-0.215, 0.03, 1.05), 'steel_light', 'hips', bevel=0.008)
# torso
b.box((0.335, 0.21, 0.2), (0, 0, 1.14), 'fatigue', 'spine', bevel=0.025)
b.box((0.42, 0.25, 0.3), (0, 0, 1.385), 'fatigue', 'chest', taper=1.04, bevel=0.035)
b.box((0.37, 0.07, 0.27), (0, -0.115, 1.37), 'vest', 'chest', bevel=0.02)                                    # plate carrier
b.box((0.1, 0.03, 0.08), (-0.1, -0.16, 1.33), 'fatigue_dark', 'chest', bevel=0.008)
b.box((0.1, 0.03, 0.08), (0.02, -0.16, 1.33), 'fatigue_dark', 'chest', bevel=0.008)
b.box((0.06, 0.05, 0.11), (0.14, -0.165, 1.44), 'gunmetal', 'chest', bevel=0.008)                            # Juno's radio
b.cyl(0.006, 0.006, 0.16, (0.16, -0.165, 1.57), 'rubber', 'chest', segs=5)
b.box((0.02, 0.012, 0.02), (0.14, -0.192, 1.46), 'green_glow', 'chest')
for sx in (1, -1): b.box((0.06, 0.27, 0.04), (0.13 * sx, 0.0, 1.535), 'leather', 'chest', bevel=0.008)       # pack straps
b.box((0.31, 0.16, 0.37), (0, 0.2, 1.33), 'canvas', 'chest', bevel=0.03)                                      # backpack
b.box((0.2, 0.05, 0.14), (0, 0.29, 1.27), 'tan', 'chest', bevel=0.012)
b.cyl(0.075, 0.075, 0.33, (0, 0.2, 1.565), 'tan', 'chest', rot=(0, 90, 0), segs=8)                            # bedroll
for sx in (1, -1): b.box((0.02, 0.165, 0.165), (0.1 * sx, 0.2, 1.565), 'leather', 'chest')
# head
b.cyl(0.062, 0.058, 0.09, (0, 0.005, 1.555), 'skin_shadow', 'chest', segs=8)
b.box((0.2, 0.22, 0.235), (0, -0.005, 1.69), 'skin', 'head', taper=1.04, bevel=0.035)
b.box((0.19, 0.13, 0.075), (0, -0.05, 1.6), 'skin_shadow', 'head', bevel=0.02)                               # stubbled jaw
b.box((0.036, 0.045, 0.055), (0, -0.125, 1.675), 'skin_shadow', 'head', bevel=0.01)
for sx in (1, -1):
    b.box((0.04, 0.02, 0.026), (0.05 * sx, -0.112, 1.715), 'eye', 'head')
    b.box((0.03, 0.06, 0.07), (0.108 * sx, 0.0, 1.69), 'skin_shadow', 'head', bevel=0.008)                   # ears
b.box((0.17, 0.03, 0.022), (0, -0.108, 1.745), 'hair', 'head')
b.box((0.215, 0.13, 0.2), (0, 0.06, 1.71), 'hair', 'head', bevel=0.025)
b.box((0.215, 0.235, 0.04), (0, -0.003, 1.785), 'red_dark', 'head', bevel=0.012)                             # beret band
b.cyl(0.125, 0.15, 0.075, (0.025, 0.0, 1.835), 'red', 'head', rot=(0, 9, 0), segs=9, bevel=0.012)            # beret
b.cyl(0.012, 0.012, 0.03, (0.025, 0, 1.885), 'red_dark', 'head', segs=5)
b.box((0.03, 0.012, 0.04), (-0.06, -0.12, 1.8), 'brass', 'head')                                             # cap badge
mesh = b.build(SRC, arm)

# ---------------- animation ----------------
BASE = {'upper_arm.R': (-36, 0, 10), 'forearm.R': (-74, 0, 0), 'hand.R': (0, 0, 0),
        'upper_arm.L': (-60, 0, -30), 'forearm.L': (-36, 0, -22), 'hand.L': (0, 0, 0)}
def P(**k): return {n.replace('_L', '.L').replace('_R', '.R'): v for n, v in k.items()}
def R(base, **k): d = dict(base); d.update(P(**k)); return d
def H(y=0.0, z=0.0): return {'hips': (0, y, z)}
def mirror(d):
    out = {}
    for n, (x, y, z) in d.items():
        m = n[:-1] + ('R' if n.endswith('L') else 'L') if n[-2:] in ('.L', '.R') else n
        out[m] = (x, -y, -z)
    return out
ARMS = dict(BASE)
clips = []
# idle: breathing in the ready stance
clips.append(make_clip(arm, 'idle', [(1, {}, H()), (24, P(chest=(1.6, 0, 0), head=(-1.2, 0, 0), upper_arm_R=(-37, 0, 10), upper_arm_L=(-61, 0, -30)), H(-0.008)), (48, {}, H())], BASE))
# walk: 24-frame cycle; arms stay on the weapon so the muzzle is steady
wc = P(thigh_L=(-28, 0, 0), shin_L=(8, 0, 0), foot_L=(-8, 0, 0), thigh_R=(20, 0, 0), shin_R=(30, 0, 0), foot_R=(12, 0, 0), hips=(0, 5, 0), spine=(2, -4, 0), chest=(0, -3, 0))
wp = P(thigh_L=(-4, 0, 0), shin_L=(4, 0, 0), thigh_R=(-14, 0, 0), shin_R=(58, 0, 0), foot_R=(6, 0, 0), hips=(0, 0, 0), spine=(2, 0, 0))
def legs(pose):
    d = dict(pose); return d
def swap(p):   # mirror only the lower body / torso twist, keep the asymmetric weapon arms
    m = mirror(p); return {k: v for k, v in m.items() if not k.startswith(('upper_arm', 'forearm', 'hand'))}
clips.append(make_clip(arm, 'walk', [(1, wc, H(-0.02)), (7, wp, H(0.012)), (13, swap(wc), H(-0.02)), (19, swap(wp), H(0.012)), (25, wc, H(-0.02))], BASE))
# run: 16-frame cycle, leaning in
rc = P(thigh_L=(-46, 0, 0), shin_L=(18, 0, 0), foot_L=(-10, 0, 0), thigh_R=(30, 0, 0), shin_R=(62, 0, 0), foot_R=(20, 0, 0), hips=(6, 8, 0), spine=(8, -6, 0), chest=(4, -5, 0), head=(-10, 0, 0),
       upper_arm_R=(-30, 0, 10), upper_arm_L=(-55, 0, -30))
rp = P(thigh_L=(-8, 0, 0), shin_L=(10, 0, 0), thigh_R=(-30, 0, 0), shin_R=(95, 0, 0), foot_R=(10, 0, 0), hips=(6, 0, 0), spine=(8, 0, 0), chest=(4, 0, 0), head=(-10, 0, 0),
       upper_arm_R=(-34, 0, 10), upper_arm_L=(-58, 0, -30))
clips.append(make_clip(arm, 'run', [(1, rc, H(-0.045)), (5, rp, H(0.03)), (9, swap(rc) | {k: v for k, v in rc.items() if k.startswith('upper_arm')}, H(-0.045)),
                                    (13, swap(rp) | {k: v for k, v in rp.items() if k.startswith('upper_arm')}, H(0.03)), (17, rc, H(-0.045))], BASE))
# shoot: recoil kick (upper body overlay)
clips.append(make_clip(arm, 'shoot', [(1, {}, H()), (3, P(upper_arm_R=(-28, 0, 10), forearm_R=(-78, 0, 0), upper_arm_L=(-54, 0, -30), chest=(-4, 0, 0), head=(-2, 0, 0)), H()), (8, {}, H())], BASE))
# reload: drop the off hand to the belt, slap a fresh magazine in
clips.append(make_clip(arm, 'reload', [
    (1, {}, H()),
    (7, P(forearm_R=(-58, 0, 0), hand_R=(0, 0, -25), upper_arm_L=(-20, 0, -8), forearm_L=(-55, 0, -10), head=(14, 6, 0), chest=(3, 0, 0)), H()),
    (15, P(forearm_R=(-58, 0, 0), hand_R=(0, 0, -25), upper_arm_L=(8, 0, 4), forearm_L=(-28, 0, 0), head=(16, 10, 0), chest=(4, 4, 0)), H()),
    (25, P(forearm_R=(-60, 0, 0), hand_R=(0, 0, -25), upper_arm_L=(-48, 0, -26), forearm_L=(-62, 0, -18), head=(12, 4, 0), chest=(3, 0, 0)), H()),
    (29, P(forearm_R=(-66, 0, 0), hand_R=(0, 0, -10), upper_arm_L=(-56, 0, -30), forearm_L=(-48, 0, -22), head=(8, 0, 0)), H()),
    (36, P(upper_arm_L=(-50, 0, -20), forearm_L=(-30, 0, -10)), H()),
    (41, {}, H())], BASE))
# hit: flinch
clips.append(make_clip(arm, 'hit', [(1, {}, H()), (3, P(chest=(-13, 12, 0), spine=(-6, 6, 0), head=(-12, -8, 0), hips=(-4, 0, 0), upper_arm_R=(-26, 0, 4)), H(-0.02, -0.03)), (6, P(chest=(-6, 5, 0), head=(-4, 0, 0)), H(-0.01, -0.01)), (11, {}, H())], BASE))
# death: knocked onto his back
clips.append(make_clip(arm, 'death', [
    (1, {}, H()),
    (5, P(hips=(-18, 0, 0), spine=(-10, 0, 0), chest=(-8, 0, 0), head=(-16, 0, 0), upper_arm_R=(-70, 0, -30), upper_arm_L=(-70, 0, 30), forearm_R=(-30, 0, 0), forearm_L=(-30, 0, 0), thigh_L=(-10, 0, 0), shin_L=(30, 0, 0)), H(-0.04, -0.06)),
    (13, P(hips=(-64, 0, 0), spine=(-6, 0, 0), head=(-10, 0, 0), upper_arm_R=(-110, 0, -55), upper_arm_L=(-120, 0, 60), forearm_R=(-25, 0, 0), forearm_L=(-20, 0, 0), thigh_L=(-36, 0, 0), shin_L=(60, 0, 0), thigh_R=(-10, 0, 0), shin_R=(20, 0, 0)), H(-0.48, -0.3)),
    (19, P(hips=(-90, 0, 0), spine=(4, 0, 0), head=(8, 0, 0), upper_arm_R=(-80, 0, -75), upper_arm_L=(-95, 0, 80), forearm_R=(-15, 0, 0), forearm_L=(-12, 0, 0), thigh_L=(-22, 0, 6), shin_L=(40, 0, 0), thigh_R=(4, 0, -6), shin_R=(6, 0, 0)), H(-0.83, -0.42)),
    (23, P(hips=(-86, 0, 0), spine=(2, 0, 0), head=(4, 0, 0), upper_arm_R=(-84, 0, -75), upper_arm_L=(-98, 0, 80), forearm_R=(-15, 0, 0), forearm_L=(-12, 0, 0), thigh_L=(-24, 0, 6), shin_L=(42, 0, 0), thigh_R=(2, 0, -6), shin_R=(6, 0, 0)), H(-0.8, -0.43)),
    (30, P(hips=(-90, 0, 0), spine=(4, 0, 0), head=(8, 0, 0), upper_arm_R=(-80, 0, -75), upper_arm_L=(-95, 0, 80), forearm_R=(-15, 0, 0), forearm_L=(-12, 0, 0), thigh_L=(-22, 0, 6), shin_L=(40, 0, 0), thigh_R=(4, 0, -6), shin_R=(6, 0, 0)), H(-0.83, -0.42))], BASE))
# attack: rifle-butt strike (melee / takedown)
clips.append(make_clip(arm, 'attack', [
    (1, {}, H()),
    (5, P(chest=(-4, -26, 0), spine=(0, -12, 0), upper_arm_R=(-10, 0, -6), forearm_R=(-95, 0, 0), upper_arm_L=(-70, 0, -40), head=(0, 14, 0)), H(0, 0.03)),
    (8, P(chest=(10, 24, 0), spine=(6, 10, 0), upper_arm_R=(-84, 0, 16), forearm_R=(-30, 0, 0), upper_arm_L=(-40, 0, -20), forearm_L=(-60, 0, -20), head=(4, -12, 0), thigh_L=(-18, 0, 0), shin_L=(14, 0, 0)), H(-0.04, -0.1)),
    (11, P(chest=(8, 18, 0), spine=(4, 8, 0), upper_arm_R=(-76, 0, 14), forearm_R=(-40, 0, 0), upper_arm_L=(-44, 0, -22), forearm_L=(-56, 0, -20), thigh_L=(-14, 0, 0), shin_L=(10, 0, 0)), H(-0.03, -0.08)),
    (16, {}, H())], BASE))

prev = os.path.join(SRC, 'preview'); os.makedirs(prev, exist_ok=True)
shots = []
if globals().get('JO_PREVIEW', True):
    ad = arm.animation_data
    for clip, frame, yaw in (('idle', 1, 35), ('idle', 1, 180), ('idle', 1, -90), ('walk', 1, 90), ('run', 5, 90), ('reload', 15, 30), ('death', 30, 60), ('attack', 8, 40)):
        ad.action = bpy.data.actions[clip]
        try:
            if ad.action_slot is None and len(ad.action.slots): ad.action_slot = ad.action.slots[0]
        except Exception: pass
        bpy.context.scene.frame_set(frame)
        shots.append(preview(os.path.join(prev, 'kade_%s_%d_%d.png' % (clip, frame, yaw)), yaw=yaw, target=(0, 0, 0.95 if clip != 'death' else 0.5)))
push_to_nla(arm, clips)
bpy.context.scene.frame_set(1)
path = os.path.join(OUT, 'kade.glb')
size = export_glb(path, [arm, mesh], anim=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SRC, 'kade.blend'), copy=True, check_existing=False)
bones = {pb.name: [round(v, 2) for v in pb.bone.matrix_local.col[0][:3]] + [round(v, 2) for v in pb.bone.matrix_local.col[2][:3]] for pb in arm.pose.bones if pb.name in ('hips', 'thigh.L')}
result = {'bundle': bundle_models(OUT), 'built_tris': tri_count(mesh), 'bytes': size, 'bone_axes_x_then_z': bones, 'verify': verify_glb(path), 'previews': len(shots)}
