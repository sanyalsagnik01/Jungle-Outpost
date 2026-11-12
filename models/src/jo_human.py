"""Shared humanoid rig, body and clip set (enemies, Brute, Phantom). Same bone names as Kade."""
from jo_lib import *


def human_bones(w=1.0, extra=()):
    B = [('root', (0, 0, 0), None), ('hips', (0, 0, 0.95), 'root'), ('spine', (0, 0, 1.06), 'hips'), ('chest', (0, 0, 1.24), 'spine'), ('head', (0, 0, 1.56), 'chest'),
         ('socket_back', (0, 0.29, 1.36), 'chest')]
    for s, sx in (('L', 1), ('R', -1)):
        ax, lx = 0.27 * w * sx, 0.1 * w * sx
        B += [('upper_arm.' + s, (ax, 0, 1.46), 'chest'), ('forearm.' + s, (ax, 0, 1.19), 'upper_arm.' + s), ('hand.' + s, (ax, 0, 0.94), 'forearm.' + s),
              ('socket_hand.' + s, (ax, -0.03, 0.87), 'hand.' + s),
              ('thigh.' + s, (lx, 0, 0.92), 'hips'), ('shin.' + s, (lx, 0, 0.5), 'thigh.' + s), ('foot.' + s, (lx, 0, 0.09), 'shin.' + s)]
    return B + list(extra)


def scaled(bones, s):
    return [(n, (h[0] * s, h[1] * s, h[2] * s), p) for n, h, p in bones]


def human_body(b, C, w=1.0, sleeves='rolled', vest=True, knee=True, face=True):
    """C keys: shirt shirt_dark pants pants_dark skin skin_dark gear boot glove belt."""
    d = 1 + (w - 1) * 0.6
    for s, sx in (('L', 1), ('R', -1)):
        x = 0.1 * w * sx
        b.box((0.155 * w, 0.175 * d, 0.44), (x, 0, 0.70), C['pants'], 'thigh.' + s, taper=1.08, bevel=0.02)
        if knee: b.box((0.135 * w, 0.06, 0.13), (x, -0.085 * d, 0.5), C['gear'], 'shin.' + s, bevel=0.015)
        b.box((0.125 * w, 0.14 * d, 0.34), (x, 0, 0.34), C['pants_dark'], 'shin.' + s, taper=1.1, bevel=0.018)
        b.box((0.145 * w, 0.165 * d, 0.17), (x, 0, 0.145), C['boot'], 'shin.' + s, bevel=0.015)
        b.box((0.145 * w, 0.3 * d, 0.115), (x, -0.055, 0.0575), C['boot'], 'foot.' + s, taper_y=0.86, taper=0.95, bevel=0.02)
        ax = 0.27 * w * sx
        b.box((0.135 * w, 0.15 * d, 0.1), (ax, 0, 1.475), C['shirt_dark'], 'upper_arm.' + s, bevel=0.025)
        b.box((0.105 * w, 0.115 * d, 0.26), (ax, 0, 1.335), C['skin'] if sleeves == 'bare' else C['shirt'], 'upper_arm.' + s, bevel=0.018)
        if sleeves == 'rolled': b.box((0.118 * w, 0.128 * d, 0.05), (ax, 0, 1.205), C['shirt_dark'], 'upper_arm.' + s, bevel=0.012)
        b.box((0.085 * w, 0.092 * d, 0.25), (ax, 0, 1.065), C['shirt'] if sleeves == 'long' else C['skin'], 'forearm.' + s, taper=1.12, bevel=0.016)
        b.box((0.09 * w, 0.105 * d, 0.115), (ax, -0.005, 0.885), C['glove'], 'hand.' + s, bevel=0.02)
    b.box((0.36 * w, 0.22 * d, 0.2), (0, 0, 0.94), C['pants'], 'hips', bevel=0.025)
    b.box((0.385 * w, 0.24 * d, 0.07), (0, 0, 1.035), C['belt'], 'hips', bevel=0.012)
    b.box((0.335 * w, 0.21 * d, 0.2), (0, 0, 1.14), C['shirt'], 'spine', bevel=0.025)
    b.box((0.42 * w, 0.25 * d, 0.3), (0, 0, 1.385), C['shirt'], 'chest', taper=1.04, bevel=0.035)
    if vest: b.box((0.37 * w, 0.07, 0.27), (0, -0.115 * d, 1.37), C['gear'], 'chest', bevel=0.02)
    b.cyl(0.062 * w, 0.058 * w, 0.09, (0, 0.005, 1.555), C['skin_dark'], 'chest', segs=8)
    if face:
        b.box((0.2, 0.22, 0.235), (0, -0.005, 1.69), C['skin'], 'head', taper=1.04, bevel=0.035)
        b.box((0.19, 0.13, 0.075), (0, -0.05, 1.6), C['skin_dark'], 'head', bevel=0.02)
        b.box((0.036, 0.045, 0.055), (0, -0.125, 1.675), C['skin_dark'], 'head', bevel=0.01)
        for sx in (1, -1):
            b.box((0.04, 0.02, 0.026), (0.05 * sx, -0.112, 1.715), 'eye', 'head')
            b.box((0.03, 0.06, 0.07), (0.108 * sx, 0.0, 1.69), C['skin_dark'], 'head', bevel=0.008)
        b.box((0.17, 0.03, 0.022), (0, -0.108, 1.745), 'hair', 'head')


def helmet(b, col, band):
    b.box((0.245, 0.265, 0.13), (0, 0.0, 1.81), col, 'head', taper=0.86, bevel=0.04)
    b.box((0.25, 0.275, 0.035), (0, -0.005, 1.755), band, 'head', bevel=0.01)
    b.box((0.215, 0.12, 0.16), (0, 0.075, 1.7), col, 'head', bevel=0.02)


def mirror(d):
    out = {}
    for n, (x, y, z) in d.items():
        m = n[:-1] + ('R' if n.endswith('L') else 'L') if n[-2:] in ('.L', '.R') else n
        out[m] = (x, -y, -z)
    return out


def P(**k): return {n.replace('_L', '.L').replace('_R', '.R'): v for n, v in k.items()}
ARMB = ('upper_arm', 'forearm', 'hand')


def human_clips(arm, base, kind='rifle', s=1.0, swing=0.0, lean=8, custom=None, loc_bones=('hips',)):
    """The standard eight clips. `kind` picks the attack; `custom` = {clip: keys} replaces any of them.
    s scales hip translation for tall characters; swing > 0 adds an arm swing (degrees) to walk/run."""
    custom = custom or {}
    def H(y=0.0, z=0.0): return {'hips': (0, y * s, z * s)}
    def B(n): return base.get(n, (0, 0, 0))
    def rel(n, dx=0, dy=0, dz=0): v = B(n); return (v[0] + dx, v[1] + dy, v[2] + dz)
    def sw(k, m=1.0):
        if not swing: return {}
        a = swing * k * m; return {'upper_arm.L': rel('upper_arm.L', a), 'upper_arm.R': rel('upper_arm.R', -a)}
    def swap(p):
        m = mirror(p); return {k: v for k, v in m.items() if not k.startswith(ARMB)}
    out = []
    def clip(name, keys):
        out.append(make_clip(arm, name, custom.get(name, keys), base, loc_bones))

    clip('idle', [(1, {}, H()), (24, {'chest': (1.6, 0, 0), 'head': (-1.2, 0, 0), 'upper_arm.R': rel('upper_arm.R', -1), 'upper_arm.L': rel('upper_arm.L', -1)}, H(-0.008)), (48, {}, H())])
    wc = P(thigh_L=(-28, 0, 0), shin_L=(8, 0, 0), foot_L=(-8, 0, 0), thigh_R=(20, 0, 0), shin_R=(30, 0, 0), foot_R=(12, 0, 0), hips=(0, 5, 0), spine=(2, -4, 0), chest=(0, -3, 0))
    wp = P(thigh_L=(-4, 0, 0), shin_L=(4, 0, 0), thigh_R=(-14, 0, 0), shin_R=(58, 0, 0), foot_R=(6, 0, 0), spine=(2, 0, 0))
    clip('walk', [(1, {**wc, **sw(1)}, H(-0.02)), (7, {**wp, **sw(0)}, H(0.012)), (13, {**swap(wc), **sw(-1)}, H(-0.02)), (19, {**swap(wp), **sw(0)}, H(0.012)), (25, {**wc, **sw(1)}, H(-0.02))])
    L = lean
    rc = P(thigh_L=(-46, 0, 0), shin_L=(18, 0, 0), foot_L=(-10, 0, 0), thigh_R=(30, 0, 0), shin_R=(62, 0, 0), foot_R=(20, 0, 0), hips=(L * 0.75, 8, 0), spine=(L, -6, 0), chest=(L * 0.5, -5, 0), head=(-L * 1.2, 0, 0))
    rp = P(thigh_L=(-8, 0, 0), shin_L=(10, 0, 0), thigh_R=(-30, 0, 0), shin_R=(95, 0, 0), foot_R=(10, 0, 0), hips=(L * 0.75, 0, 0), spine=(L, 0, 0), chest=(L * 0.5, 0, 0), head=(-L * 1.2, 0, 0))
    clip('run', [(1, {**rc, **sw(1, 1.8)}, H(-0.045)), (5, {**rp, **sw(0)}, H(0.03)), (9, {**swap(rc), **sw(-1, 1.8)}, H(-0.045)), (13, {**swap(rp), **sw(0)}, H(0.03)), (17, {**rc, **sw(1, 1.8)}, H(-0.045))])
    clip('shoot', [(1, {}, H()), (3, {'upper_arm.R': rel('upper_arm.R', 8), 'forearm.R': rel('forearm.R', -4), 'upper_arm.L': rel('upper_arm.L', 6), 'chest': (-4, 0, 0), 'head': (-2, 0, 0)}, H()), (8, {}, H())])
    clip('reload', [
        (1, {}, H()),
        (7, P(forearm_R=rel('forearm.R', 16), hand_R=(0, 0, -25), upper_arm_L=(-20, 0, -8), forearm_L=(-55, 0, -10), head=(14, 6, 0), chest=(3, 0, 0)), H()),
        (15, P(forearm_R=rel('forearm.R', 16), hand_R=(0, 0, -25), upper_arm_L=(8, 0, 4), forearm_L=(-28, 0, 0), head=(16, 10, 0), chest=(4, 4, 0)), H()),
        (25, P(forearm_R=rel('forearm.R', 14), hand_R=(0, 0, -25), upper_arm_L=(-48, 0, -26), forearm_L=(-62, 0, -18), head=(12, 4, 0), chest=(3, 0, 0)), H()),
        (33, P(upper_arm_L=rel('upper_arm.L', 8), head=(6, 0, 0)), H()), (41, {}, H())])
    clip('hit', [(1, {}, H()), (3, P(chest=(-13, 12, 0), spine=(-6, 6, 0), head=(-12, -8, 0), hips=(-4, 0, 0), upper_arm_R=rel('upper_arm.R', 10, 0, -6)), H(-0.02, -0.03)), (6, P(chest=(-6, 5, 0), head=(-4, 0, 0)), H(-0.01, -0.01)), (11, {}, H())])
    lying = P(hips=(-90, 0, 0), spine=(4, 0, 0), head=(8, 0, 0), upper_arm_R=(-80, 0, -75), upper_arm_L=(-95, 0, 80), forearm_R=(-15, 0, 0), forearm_L=(-12, 0, 0), thigh_L=(-22, 0, 6), shin_L=(40, 0, 0), thigh_R=(4, 0, -6), shin_R=(6, 0, 0))
    clip('death', [
        (1, {}, H()),
        (5, P(hips=(-18, 0, 0), spine=(-10, 0, 0), chest=(-8, 0, 0), head=(-16, 0, 0), upper_arm_R=(-70, 0, -30), upper_arm_L=(-70, 0, 30), forearm_R=(-30, 0, 0), forearm_L=(-30, 0, 0), thigh_L=(-10, 0, 0), shin_L=(30, 0, 0)), H(-0.04, -0.06)),
        (13, P(hips=(-64, 0, 0), spine=(-6, 0, 0), head=(-10, 0, 0), upper_arm_R=(-110, 0, -55), upper_arm_L=(-120, 0, 60), forearm_R=(-25, 0, 0), forearm_L=(-20, 0, 0), thigh_L=(-36, 0, 0), shin_L=(60, 0, 0), thigh_R=(-10, 0, 0), shin_R=(20, 0, 0)), H(-0.48, -0.3)),
        (19, lying, H(-0.83, -0.42)), (23, {**lying, 'hips': (-86, 0, 0)}, H(-0.8, -0.43)), (30, lying, H(-0.83, -0.42))])
    if kind == 'machete':        # overhead chop; blade lands ~0.45 s in
        atk = [(1, {}, H()),
               (5, P(chest=(-8, -22, 0), spine=(-4, -8, 0), upper_arm_R=(-165, 0, -18), forearm_R=(-55, 0, 0), upper_arm_L=(-30, 0, -20), head=(-4, 10, 0)), H(0.02, 0.03)),
               (9, P(chest=(-10, -26, 0), spine=(-5, -10, 0), upper_arm_R=(-185, 0, -20), forearm_R=(-70, 0, 0), upper_arm_L=(-36, 0, -24), head=(-4, 12, 0)), H(0.03, 0.04)),
               (12, P(chest=(16, 22, 0), spine=(10, 8, 0), upper_arm_R=(-42, 0, 16), forearm_R=(-8, 0, 0), upper_arm_L=(20, 0, -10), head=(6, -10, 0), thigh_L=(-22, 0, 0), shin_L=(16, 0, 0)), H(-0.05, -0.12)),
               (15, P(chest=(18, 26, 0), spine=(10, 10, 0), upper_arm_R=(-20, 0, 22), forearm_R=(-6, 0, 0), upper_arm_L=(22, 0, -10), thigh_L=(-20, 0, 0), shin_L=(14, 0, 0)), H(-0.05, -0.12)),
               (22, {}, H())]
    elif kind == 'throw':        # overhand lob; release ~0.55 s in
        atk = [(1, {}, H()),
               (7, P(chest=(-10, -24, 0), spine=(-4, -8, 0), upper_arm_R=(-175, 0, -14), forearm_R=(-60, 0, 0), upper_arm_L=(-70, 0, -10), forearm_L=(-10, 0, 0), head=(-6, 8, 0)), H(0, 0.04)),
               (12, P(chest=(-12, -28, 0), spine=(-5, -10, 0), upper_arm_R=(-195, 0, -16), forearm_R=(-75, 0, 0), upper_arm_L=(-80, 0, -10), forearm_L=(-10, 0, 0), head=(-8, 8, 0)), H(0, 0.05)),
               (14, P(chest=(14, 20, 0), spine=(8, 8, 0), upper_arm_R=(-70, 0, 10), forearm_R=(-6, 0, 0), upper_arm_L=(10, 0, -8), head=(4, -8, 0), thigh_L=(-18, 0, 0), shin_L=(12, 0, 0)), H(-0.04, -0.1)),
               (17, P(chest=(18, 24, 0), spine=(10, 10, 0), upper_arm_R=(-24, 0, 18), forearm_R=(-10, 0, 0), upper_arm_L=(16, 0, -8), thigh_L=(-16, 0, 0), shin_L=(10, 0, 0)), H(-0.04, -0.1)),
               (24, {}, H())]
    elif kind == 'baton':        # shield swings aside, baton comes down ~0.5 s in, guard stays open through the recovery
        op = {'shield': (0, 78, 0), 'upper_arm.L': rel('upper_arm.L', 14, 0, 34)}
        atk = [(1, {}, H()),
               (6, {**op, **P(chest=(-6, -18, 0), upper_arm_R=(-150, 0, -14), forearm_R=(-50, 0, 0), head=(-4, 8, 0))}, H(0.02, 0.02)),
               (10, {**op, **P(chest=(-8, -24, 0), spine=(-4, -8, 0), upper_arm_R=(-180, 0, -16), forearm_R=(-65, 0, 0), head=(-4, 10, 0))}, H(0.02, 0.03)),
               (13, {**op, **P(chest=(14, 20, 0), spine=(8, 8, 0), upper_arm_R=(-46, 0, 14), forearm_R=(-8, 0, 0), head=(6, -8, 0), thigh_L=(-20, 0, 0), shin_L=(14, 0, 0))}, H(-0.04, -0.1)),
               (24, {**op, **P(chest=(8, 10, 0), upper_arm_R=(-30, 0, 12), forearm_R=(-30, 0, 0))}, H(-0.02, -0.05)),
               (31, {}, H())]
    else:                         # rifle butt
        atk = [(1, {}, H()),
               (5, P(chest=(-4, -26, 0), spine=(0, -12, 0), upper_arm_R=(-10, 0, -6), forearm_R=(-95, 0, 0), upper_arm_L=(-70, 0, -40), head=(0, 14, 0)), H(0, 0.03)),
               (8, P(chest=(10, 24, 0), spine=(6, 10, 0), upper_arm_R=(-84, 0, 16), forearm_R=(-30, 0, 0), upper_arm_L=(-40, 0, -20), forearm_L=(-60, 0, -20), head=(4, -12, 0), thigh_L=(-18, 0, 0), shin_L=(14, 0, 0)), H(-0.04, -0.1)),
               (11, P(chest=(8, 18, 0), spine=(4, 8, 0), upper_arm_R=(-76, 0, 14), forearm_R=(-40, 0, 0), upper_arm_L=(-44, 0, -22), forearm_L=(-56, 0, -20), thigh_L=(-14, 0, 0), shin_L=(10, 0, 0)), H(-0.03, -0.08)),
               (16, {}, H())]
    clip('attack', atk)
    return out


RIFLE_POSE = {'upper_arm.R': (-36, 0, 10), 'forearm.R': (-74, 0, 0), 'upper_arm.L': (-60, 0, -30), 'forearm.L': (-36, 0, -22)}
