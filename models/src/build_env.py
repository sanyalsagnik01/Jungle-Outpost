"""Environment kit, pickups and story models (static props; Mira is rigged).
Mesh naming used by the game:  tint_*  -> takes the level's per-instance tint (leaves, vines)
                               fx_*    -> own glowing material         door/handle/head/turret -> movable sub-part"""
import bpy, os, sys, importlib, math, random
SRC = os.path.dirname(os.path.abspath(JO_SRC)) if 'JO_SRC' in globals() else os.path.dirname(os.path.abspath(__file__))
if SRC not in sys.path: sys.path.insert(0, SRC)
import jo_lib, jo_human; importlib.reload(jo_lib); importlib.reload(jo_human)
from jo_lib import *
from jo_human import *
OUT = os.path.dirname(SRC); PREV = os.path.join(SRC, 'preview'); os.makedirs(PREV, exist_ok=True)
ONLY = globals().get('JO_ONLY'); DO_PREVIEW = globals().get('JO_PREVIEW', True)
report = []; Y = (90, 0, 0); X = (0, 90, 0)
rnd = random.Random(11)


def jitter(b, amt):
    for v in b.bm.verts: v.co += Vector((rnd.uniform(-amt, amt), rnd.uniform(-amt, amt), rnd.uniform(-amt, amt)))


def prop(name, parts, target=(0, 0, 1), dist=6, yaw=40):
    """parts: {mesh_name: fn(builder)}"""
    reset_scene(); meshes = []
    for mname, fn in parts.items():
        b = Builder(mname); fn(b); meshes.append(b.build(SRC))
    if DO_PREVIEW: preview(os.path.join(PREV, name + '.png'), target=target, dist=dist, yaw=yaw, res=300)
    path = os.path.join(OUT, name + '.glb'); export_glb(path, meshes, anim=False)
    info = verify_glb(path); report.append(info)


# ---------------- vegetation ----------------
def t_trunk(b, h=6.0, r=0.38):
    b.cyl(r, r * 0.72, h, (0, 0, h / 2), 'wood', segs=6)
    for a in (20, 140, 260): b.box((0.2, 0.7, 0.4), (math.cos(math.radians(a)) * 0.35, math.sin(math.radians(a)) * 0.35, 0.18), 'wood_dark', rot=(0, 0, a + 90), taper=0.4)
def canopy_a(b):
    b.ball(2.7, (0, 0, 6.7), 'white', scale=(1, 1, 0.7)); b.ball(1.8, (1.0, 0.5, 8.0), 'white', scale=(1, 1, 0.72)); b.ball(1.6, (-1.1, -0.6, 7.6), 'white', scale=(1, 1, 0.72)); jitter(b, 0.12)
def canopy_b(b):
    b.cyl(2.5, 0.0, 3.6, (0, 0, 5.0), 'white', segs=7); b.cyl(1.9, 0.0, 3.0, (0, 0, 6.9), 'white', segs=7); b.cyl(1.25, 0.0, 2.4, (0, 0, 8.5), 'white', segs=7)
def palm_trunk(b):
    for i in range(6): b.cyl(0.3 - i * 0.025, 0.27 - i * 0.025, 1.15, (i * i * 0.035, 0, 0.55 + i * 1.1), 'wood', rot=(0, i * 3.5, 0), segs=6)
def palm_leaves(b):
    cx = 0.9
    for i in range(8):
        a = i * 45 + 10
        b.box((0.55, 2.6, 0.06), (cx + math.cos(math.radians(a + 90)) * -1.2, math.sin(math.radians(a + 90)) * -1.2, 6.75), 'white', rot=(-24, 0, a), taper=0.3)
        b.box((0.4, 1.3, 0.05), (cx + math.cos(math.radians(a + 90)) * -2.7, math.sin(math.radians(a + 90)) * -2.7, 5.95), 'white', rot=(-58, 0, a), taper=0.2)
    b.ball(0.45, (cx, 0, 6.9), 'white')
def bush(b):
    b.ball(0.75, (0, 0, 0.42), 'white', scale=(1, 1, 0.62)); b.ball(0.5, (0.55, 0.25, 0.36), 'white', scale=(1, 1, 0.7)); b.ball(0.45, (-0.5, -0.3, 0.32), 'white', scale=(1, 1, 0.7)); jitter(b, 0.05)
def rock(b):
    b.ball(0.85, (0, 0, 0.5), 'stone', scale=(1, 0.92, 0.68)); b.ball(0.42, (0.62, -0.3, 0.26), 'stone', scale=(1, 1, 0.7)); jitter(b, 0.07)
def vine(b):
    for i in range(4):
        x = (i - 1.5) * 0.22; l = 1.6 + rnd.random() * 1.4
        b.box((0.05, 0.05, l), (x, rnd.uniform(-0.1, 0.1), -l / 2), 'white', rot=(rnd.uniform(-4, 4), rnd.uniform(-4, 4), 0))
        for k in range(3): b.box((0.2, 0.03, 0.12), (x + rnd.uniform(-0.08, 0.08), 0, -l * (0.3 + k * 0.3)), 'white', rot=(0, rnd.uniform(-30, 30), rnd.uniform(0, 180)))

# ---------------- structures / cover ----------------
def pillar(b):
    b.box((2.2, 2.2, 6.2), (0, 0, 3.1), 'stone', bevel=0.06); b.box((2.7, 2.7, 0.5), (0, 0, 0.25), 'steel_dark', bevel=0.05); b.box((2.6, 2.6, 0.4), (0, 0, 6.4), 'stone', rot=(0, 0, 6), bevel=0.05)
    for z, a in ((1.6, 0), (3.2, 90), (4.6, 180), (2.4, 270)): b.box((1.3, 0.06, 0.5), (math.sin(math.radians(a)) * 1.11, -math.cos(math.radians(a)) * 1.11, z), 'steel_dark', rot=(0, 0, a))
    for z, a in ((0.9, 30), (5.2, 200)): b.box((0.9, 0.08, 0.7), (math.sin(math.radians(a)) * 1.0, -math.cos(math.radians(a)) * 1.0, z), 'ghillie', rot=(0, 0, a))
def wall(b):
    b.box((1.7, 0.8, 2.5), (0, 0, 1.25), 'stone', bevel=0.04)
    for r in range(5):
        b.box((1.72, 0.82, 0.04), (0, 0, 0.5 + r * 0.5), 'steel_dark')
        for k in range(2): b.box((0.04, 0.82, 0.46), (-0.4 + k * 0.85 + (r % 2) * 0.3 - 0.15, 0, 0.27 + r * 0.5), 'steel_dark')
    b.box((0.6, 0.84, 0.4), (0.4, 0, 2.3), 'ghillie', bevel=0.03)
def bridge(b):
    for i in range(20): b.box((5.0, 0.7, 0.12), (0, -7.6 + i * 0.8, 0.2), 'wood' if i % 3 else 'wood_dark', rot=(0, 0, rnd.uniform(-1.5, 1.5)), bevel=0.015)
    for sx in (1, -1):
        b.box((0.1, 16.0, 0.1), (2.45 * sx, 0, 1.3), 'wood'); b.box((0.18, 16.2, 0.18), (2.2 * sx, 0, 0.08), 'wood_dark')
        for i in range(6): b.box((0.16, 0.16, 1.4), (2.45 * sx, -7.5 + i * 3.0, 0.7), 'wood_dark'); b.box((0.05, 2.95, 0.05), (2.45 * sx, -6.0 + i * 3.0 if i < 5 else 6.0, 0.8), 'canvas', rot=(8 * (-1) ** i, 0, 0))
def tower(b):
    for sx in (1, -1):
        for sy in (1, -1):
            b.box((0.26, 0.26, 4.8), (1.35 * sx, 1.35 * sy, 2.4), 'wood_dark'); b.box((0.14, 0.14, 2.1), (1.45 * sx, 1.45 * sy, 5.9), 'wood_dark')
        b.box((0.1, 3.3, 0.12), (1.6 * sx, 0, 5.35), 'wood_dark'); b.box((3.3, 0.1, 0.12), (0, 1.6 * sx, 5.35), 'wood_dark')
        b.box((0.1, 3.8, 0.1), (1.35 * sx, 0, 2.4), 'wood', rot=(45, 0, 0)); b.box((3.8, 0.1, 0.1), (0, 1.35 * sx, 2.4), 'wood', rot=(0, 45, 0))
    b.box((3.4, 3.4, 0.24), (0, 0, 4.76), 'wood', bevel=0.03)
    b.cyl(3.9, 0.0, 1.5, (0, 0, 7.6), 'tan_dark', rot=(0, 0, 45), segs=4)
    for r in range(7): b.box((0.08, 0.7, 0.08), (1.75, 0, 0.5 + r * 0.65), 'wood')
    for sy in (1, -1): b.box((0.08, 0.08, 4.7), (1.75, 0.33 * sy, 2.35), 'wood_dark')
def sandbag(b):
    for row in range(3):
        for k in range(-1, 2):
            if row == 2 and k == 1: continue
            b.box((0.94, 0.72, 0.4), (k * 0.98 + (0.45 if row % 2 else 0), rnd.uniform(-0.03, 0.03), 0.21 + row * 0.42), 'tan' if (row + k) % 2 else 'canvas', rot=(0, 0, rnd.uniform(-4, 4)), bevel=0.09)
def crate(b):
    s = 1.3; b.box((s, s, s), (0, 0, s / 2), 'wood', bevel=0.03)
    for z in (0.12, s - 0.12): b.box((s + 0.06, s + 0.06, 0.14), (0, 0, z), 'wood_dark')
    for sx in (1, -1):
        b.box((0.14, 0.04, s * 1.25), (0, (s / 2 + 0.01) * sx, s / 2), 'wood_dark', rot=(0, 40, 0)); b.box((0.04, 0.14, s * 1.25), ((s / 2 + 0.01) * sx, 0, s / 2), 'wood_dark', rot=(40, 0, 0))
def barrel(b):
    b.cyl(0.42, 0.42, 1.1, (0, 0, 0.55), 'red', segs=10, bevel=0.03)
    for z in (0.3, 0.8): b.cyl(0.44, 0.44, 0.06, (0, 0, z), 'red_dark', segs=10)
    b.cyl(0.435, 0.435, 0.22, (0, 0, 0.55), 'hazard', segs=10); b.cyl(0.08, 0.08, 0.06, (0.2, 0, 1.12), 'steel', segs=6)
    b.box((0.2, 0.02, 0.16), (0, -0.44, 0.55), 'black', rot=(0, 45, 0))
def gate_frame(b):
    for sx in (1, -1): b.box((0.7, 1.4, 7.2), (3.85 * sx, 0, 3.6), 'steel_dark', bevel=0.06); b.box((0.3, 0.2, 0.5), (3.6 * sx, -0.75, 1.5), 'hazard')
    b.box((8.4, 1.5, 0.8), (0, 0, 6.9), 'steel_dark', bevel=0.06); b.box((1.2, 0.1, 0.4), (0, -0.78, 6.9), 'hazard')
def gate_door(b):
    for k in range(10): b.box((0.2, 0.2, 6.4), (-3.3 + k * 0.73, 0, 3.2), 'steel')
    for k in range(3): b.box((7.0, 0.28, 0.28), (0, 0, 1 + k * 2.2), 'gunmetal')
def lever_base(b):
    b.box((0.5, 0.5, 0.3), (0, 0, 0.15), 'steel_dark', bevel=0.04); b.box((0.12, 0.34, 0.4), (0, 0, 0.42), 'gunmetal'); b.box((0.3, 0.06, 0.2), (0, -0.26, 0.2), 'hazard')
def lever_handle(b):
    b.box((0.07, 0.07, 0.95), (0, 0, 0.75), 'steel'); b.ball(0.11, (0, 0, 1.25), 'red')
def terminal(b):
    b.box((0.8, 0.5, 1.1), (0, 0, 0.55), 'steel_dark', bevel=0.04); b.box((0.7, 0.3, 0.5), (0, -0.14, 1.28), 'gunmetal', rot=(-25, 0, 0), bevel=0.03)
    for k in range(3): b.box((0.14, 0.02, 0.06), (-0.2 + k * 0.2, -0.26, 0.9), 'hazard')
def terminal_screen(b): b.box((0.56, 0.02, 0.34), (0, -0.215, 1.32), 'cyan', rot=(-25, 0, 0))
def building(b):
    b.box((6.0, 5.0, 3.0), (0, 0, 1.5), 'hull', bevel=0.06); b.box((6.5, 5.5, 0.3), (0, 0, 3.15), 'hull_dark', bevel=0.04); b.box((6.2, 5.2, 0.5), (0, 0, 0.25), 'steel_dark')
    b.box((1.2, 0.1, 2.1), (-1.6, -2.52, 1.05), 'steel_dark'); b.box((0.12, 0.06, 0.12), (-1.2, -2.58, 1.05), 'hazard')
    for x in (0.6, 2.0): b.box((0.9, 0.08, 0.7), (x, -2.52, 1.9), 'glass'); b.box((1.0, 0.1, 0.08), (x, -2.53, 1.5), 'steel_dark')
    b.box((1.0, 1.0, 0.6), (1.8, 1.2, 3.6), 'steel_dark', bevel=0.04); b.cyl(0.03, 0.03, 2.4, (-2.4, 1.8, 4.5), 'black', segs=5); b.cyl(0.5, 0.1, 0.25, (-1.0, -1.2, 3.5), 'steel_light', rot=(-30, 0, 0), segs=8)
    for k in range(4): b.box((0.06, 5.04, 2.9), (-3.0 + 0.02, 0, 1.5), 'hull_dark') if k == 0 else b.box((6.04, 0.06, 0.1), (0, 2.52, 0.6 + k * 0.7), 'hull_dark')
def light_base(b):
    for a in (90, 210, 330): b.box((0.08, 0.08, 1.7), (math.cos(math.radians(a)) * 0.35, math.sin(math.radians(a)) * 0.35, 0.8), 'steel_dark', rot=(math.sin(math.radians(a)) * 22, -math.cos(math.radians(a)) * 22, 0))
    b.cyl(0.14, 0.14, 0.2, (0, 0, 1.6), 'gunmetal', segs=7)
def light_head(b):
    b.cyl(0.42, 0.34, 0.6, (0, -0.05, 1.95), 'steel_dark', rot=Y, segs=9); b.box((0.1, 0.5, 0.5), (0.36, 0, 1.95), 'gunmetal'); b.box((0.1, 0.5, 0.5), (-0.36, 0, 1.95), 'gunmetal')
def light_lens(b): b.cyl(0.38, 0.38, 0.04, (0, -0.37, 1.95), 'white', rot=Y, segs=9)
def jeep_body(b):
    b.box((1.9, 4.0, 0.7), (0, 0, 0.85), 'fatigue', bevel=0.07); b.box((1.8, 1.3, 0.5), (0, -1.5, 1.3), 'fatigue', taper=0.9, bevel=0.06); b.box((1.7, 0.08, 0.6), (0, -0.75, 1.55), 'glass', rot=(-18, 0, 0))
    b.box((1.9, 0.2, 0.3), (0, -2.05, 0.6), 'steel_dark'); b.box((1.9, 0.2, 0.3), (0, 2.05, 0.6), 'steel_dark'); b.box((1.5, 0.06, 0.4), (0, -2.02, 0.95), 'black')
    for sx in (1, -1):
        b.cyl(0.14, 0.14, 0.06, (0.65 * sx, -2.04, 1.0), 'yellow', rot=Y, segs=7); b.box((0.5, 1.2, 0.5), (0.6 * sx, 0.1, 1.2), 'vest', bevel=0.05)
        for sy in (-1.3, 1.3): b.cyl(0.46, 0.46, 0.34, (1.0 * sx, sy, 0.46), 'rubber', rot=X, segs=10); b.cyl(0.2, 0.2, 0.36, (1.0 * sx, sy, 0.46), 'steel', rot=X, segs=7)
    b.box((1.7, 1.5, 0.1), (0, 1.2, 1.25), 'fatigue_dark'); b.cyl(0.45, 0.45, 0.34, (0, 2.2, 1.0), 'rubber', rot=Y, segs=10); b.cyl(0.3, 0.36, 0.5, (0, 1.2, 1.5), 'steel_dark', segs=8)
def jeep_turret(b):
    b.box((0.4, 0.5, 0.35), (0, 1.2, 1.95), 'gunmetal', bevel=0.04); b.cyl(0.06, 0.06, 1.3, (0, 0.4, 1.98), 'black', rot=Y, segs=7); b.box((0.5, 0.06, 0.5), (0, 1.0, 2.0), 'steel_dark'); b.box((0.2, 0.3, 0.25), (0.3, 1.25, 1.9), 'fatigue_dark')
def boat_hull(b):
    b.box((2.2, 5.2, 0.6), (0, 0, 0.3), 'wood_dark', taper=1.18, bevel=0.06); b.box((1.6, 1.3, 0.6), (0, -3.0, 0.38), 'wood_dark', taper=1.1, rot=(0, 0, 0), bevel=0.06)
    b.box((1.9, 4.8, 0.08), (0, 0, 0.5), 'wood'); b.box((1.8, 0.4, 0.3), (0, 0.9, 0.7), 'wood'); b.box((1.8, 0.4, 0.3), (0, -1.4, 0.7), 'wood')
    for sx in (1, -1): b.box((0.12, 5.3, 0.16), (1.25 * sx, 0, 0.68), 'wood')
    b.box((0.4, 0.5, 0.7), (0, 2.75, 0.75), 'gunmetal', bevel=0.04); b.box((0.12, 0.12, 0.8), (0, 2.9, 0.1), 'steel'); b.cyl(0.3, 0.3, 0.5, (0.6, 1.8, 0.8), 'red', segs=8)
    b.cyl(0.08, 0.08, 0.8, (0, -0.4, 0.9), 'steel_dark', segs=6)
def boat_turret(b):
    b.box((0.36, 0.5, 0.32), (0, -0.4, 1.45), 'gunmetal', bevel=0.04); b.cyl(0.055, 0.055, 1.3, (0, -1.2, 1.48), 'black', rot=Y, segs=7); b.box((0.6, 0.06, 0.55), (0, -0.62, 1.5), 'steel_dark'); b.box((0.22, 0.3, 0.26), (0.3, -0.35, 1.4), 'fatigue_dark')

# ---------------- pickups / collectibles ----------------
def pk_ammo(b):
    b.box((0.55, 0.34, 0.34), (0, 0, 0.17), 'olive_dark', bevel=0.03); b.box((0.57, 0.36, 0.06), (0, 0, 0.3), 'fatigue_dark'); b.box((0.2, 0.02, 0.1), (0, -0.175, 0.16), 'hazard')
    for k in range(4): b.cyl(0.03, 0.02, 0.14, (-0.18 + k * 0.12, 0, 0.4), 'brass', segs=6)
    b.box((0.3, 0.05, 0.04), (0, 0, 0.36), 'steel_dark')
def pk_health(b):
    b.box((0.5, 0.34, 0.4), (0, 0, 0.2), 'white', bevel=0.04); b.box((0.3, 0.02, 0.1), (0, -0.175, 0.2), 'red'); b.box((0.1, 0.02, 0.3), (0, -0.175, 0.2), 'red')
    b.box((0.2, 0.06, 0.05), (0, 0, 0.43), 'steel_dark'); b.box((0.52, 0.36, 0.04), (0, 0, 0.3), 'steel_light')
def pk_armor(b):
    b.box((0.46, 0.12, 0.56), (0, 0, 0.3), 'slate', taper=0.86, bevel=0.04); b.box((0.34, 0.03, 0.3), (0, -0.07, 0.3), 'slate_light', bevel=0.02)
    for sx in (1, -1): b.box((0.08, 0.1, 0.2), (0.16 * sx, 0, 0.62), 'slate_dark')
def pk_intel(b):
    b.box((0.34, 0.03, 0.46), (0, 0, 0.3), 'gunmetal', rot=(-12, 0, 0), bevel=0.02); b.box((0.1, 0.035, 0.03), (0, 0.005, 0.07), 'steel_light', rot=(-12, 0, 0))
def pk_intel_screen(b):
    b.box((0.28, 0.01, 0.36), (0, -0.02, 0.31), 'cyan', rot=(-12, 0, 0))
def pk_idol(b):
    b.box((0.3, 0.3, 0.1), (0, 0, 0.05), 'stone', bevel=0.02); b.box((0.2, 0.16, 0.26), (0, 0, 0.23), 'brass', taper=0.8, bevel=0.03); b.box((0.26, 0.2, 0.2), (0, 0, 0.46), 'brass', bevel=0.04)
    b.box((0.34, 0.06, 0.1), (0, 0, 0.6), 'brass', taper=0.5)
    for sx in (1, -1): b.box((0.06, 0.1, 0.2), (0.14 * sx, -0.06, 0.25), 'brass', rot=(20, 0, 0))
def pk_idol_eyes(b):
    for sx in (1, -1): b.box((0.06, 0.02, 0.05), (0.06 * sx, -0.105, 0.48), 'green_glow')

# ---------------- story ----------------
def bloom_stem(b):
    b.cyl(0.5, 0.36, 0.3, (0, 0, 0.15), 'stone', segs=8)
    for i in range(5): b.cyl(0.07, 0.06, 0.34, (math.sin(i * 0.9) * 0.06, 0, 0.42 + i * 0.3), 'ghillie', rot=(math.sin(i * 1.3) * 8, math.cos(i) * 8, 0), segs=6)
    for a in (0, 120, 240): b.box((0.5, 0.2, 0.04), (math.cos(math.radians(a)) * 0.3, math.sin(math.radians(a)) * 0.3, 0.75), 'ghillie', rot=(0, -25, a), taper=0.3)
    for a in range(0, 360, 60): b.box((0.6, 0.26, 0.04), (math.cos(math.radians(a)) * 0.34, math.sin(math.radians(a)) * 0.34, 1.9), 'purple', rot=(0, -50, a), taper=0.3)
def bloom_glow(b):
    b.ball(0.2, (0, 0, 2.05), 'yellow')
    for a in range(30, 390, 60): b.box((0.46, 0.2, 0.03), (math.cos(math.radians(a)) * 0.22, math.sin(math.radians(a)) * 0.22, 2.12), 'cyan', rot=(0, -62, a), taper=0.25)
    for a in (0, 120, 240): b.ball(0.05, (math.cos(math.radians(a)) * 0.34, math.sin(math.radians(a)) * 0.34, 0.8), 'cyan')

def mira():
    reset_scene(); w = 0.9; arm = make_armature('Mira', human_bones(w))
    C = dict(shirt='white', shirt_dark='steel_light', pants='slate', pants_dark='slate_dark', skin='skin', skin_dark='skin_shadow', gear='cyan', boot='boot', glove='skin', belt='leather')
    b = Builder('Mira_mesh'); human_body(b, C, w=w, sleeves='long', vest=False, knee=False)
    b.box((0.46 * w, 0.27, 0.5), (0, 0.0, 0.86), 'white', 'hips', taper=0.86, bevel=0.02)                 # lab coat skirt
    b.box((0.22, 0.24, 0.1), (0, 0.0, 1.8), 'hair', 'head', bevel=0.03); b.box((0.23, 0.12, 0.3), (0, 0.075, 1.66), 'hair', 'head', bevel=0.03)
    b.cyl(0.05, 0.03, 0.26, (0, 0.17, 1.52), 'hair', 'head', rot=(-20, 0, 0), segs=6)                    # ponytail
    for sx in (1, -1): b.box((0.07, 0.015, 0.05), (0.05 * sx, -0.125, 1.715), 'glass', 'head')
    b.box((0.2, 0.012, 0.012), (0, -0.125, 1.725), 'black', 'head')
    b.box((0.1, 0.03, 0.14), (0.1, -0.14, 1.36), 'cyan', 'chest'); b.box((0.14, 0.02, 0.2), (-0.26 * w, -0.07, 0.9), 'gunmetal', 'hand.R')   # badge, data pad
    mesh = b.build(SRC, arm)
    base = {'upper_arm.R': (-14, 0, 6), 'forearm.R': (-44, 0, 0), 'upper_arm.L': (-4, 0, -8), 'forearm.L': (-16, 0, 0)}
    clips = human_clips(arm, base, 'rifle', swing=14, lean=4)
    if DO_PREVIEW:
        arm.animation_data.action = bpy.data.actions['idle']; bpy.context.scene.frame_set(1); preview(os.path.join(PREV, 'mira.png'), yaw=35, target=(0, 0, 0.95), dist=3.6, res=300)
    push_to_nla(arm, clips); bpy.context.scene.frame_set(1)
    path = os.path.join(OUT, 'mira.glb'); export_glb(path, [arm, mesh], anim=True); report.append(verify_glb(path))


PROPS = [
    ('env_tree_a', {'trunk': lambda b: t_trunk(b), 'tint_canopy': canopy_a}, (0, 0, 4.5), 16),
    ('env_tree_b', {'trunk': lambda b: t_trunk(b, 5.0, 0.34), 'tint_canopy': canopy_b}, (0, 0, 4.5), 16),
    ('env_tree_c', {'trunk': palm_trunk, 'tint_canopy': palm_leaves}, (0, 0, 4), 15),
    ('env_bush', {'tint_leaf': bush}, (0, 0, 0.4), 4), ('env_rock', {'rock': rock}, (0, 0, 0.4), 4), ('env_vine', {'tint_vine': vine}, (0, 0, -1.2), 5),
    ('env_pillar', {'pillar': pillar}, (0, 0, 3.2), 13), ('env_wall', {'wall': wall}, (0, 0, 1.2), 6), ('env_bridge', {'bridge': bridge}, (0, 0, 0.5), 22),
    ('env_tower', {'tower': tower}, (0, 0, 4), 17), ('env_sandbag', {'bags': sandbag}, (0, 0, 0.6), 6), ('env_crate', {'crate': crate}, (0, 0, 0.6), 5),
    ('env_barrel', {'barrel': barrel}, (0, 0, 0.5), 4), ('env_gate', {'frame': gate_frame, 'door': gate_door}, (0, 0, 3.5), 18),
    ('env_lever', {'base': lever_base, 'handle': lever_handle}, (0, 0, 0.6), 4), ('env_terminal', {'body': terminal, 'fx_screen': terminal_screen}, (0, 0, 0.8), 4),
    ('env_building', {'hut': building}, (0, 0, 2), 15), ('env_searchlight', {'base': light_base, 'head': light_head, 'fx_lens': light_lens}, (0, 0, 1.2), 6),
    ('env_jeep', {'body': jeep_body, 'turret': jeep_turret}, (0, 0, 1), 10), ('env_boat', {'hull': boat_hull, 'turret': boat_turret}, (0, 0, 0.8), 11),
    ('pk_ammo', {'box': pk_ammo}, (0, 0, 0.2), 2), ('pk_health', {'kit': pk_health}, (0, 0, 0.2), 2), ('pk_armor', {'plate': pk_armor}, (0, 0, 0.3), 2.2),
    ('pk_intel', {'pad': pk_intel, 'fx_screen': pk_intel_screen}, (0, 0, 0.3), 2), ('pk_idol', {'idol': pk_idol, 'fx_eyes': pk_idol_eyes}, (0, 0, 0.3), 2.2),
    ('bloom', {'stem': bloom_stem, 'fx_glow': bloom_glow}, (0, 0, 1.1), 6),
]
for name, parts, target, dist in PROPS:
    if ONLY and name not in ONLY: continue
    prop(name, parts, target, dist)
if not ONLY or 'mira' in ONLY: mira()
result = {'props': [[r['file'], r['triangles'], r['meshes'], r['size_xyz_m']] for r in report], 'bundle': bundle_models(OUT)}
