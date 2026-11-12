# JUNGLE OUTPOST — models

Every model here is built by a Python script in `models/src/` running inside Blender (`jo_lib.py` for shared helpers, `jo_human.py` for the shared humanoid rig and clip set) (via the Blender MCP), exported as GLB, re-imported to verify it, and packed into `models.bundle.js`. The game treats every model as optional: a missing or broken file falls back to the primitive version in `js/models.js`.

## Assets

| File | What | Triangles | Budget | Animation clips (exact names, 24 fps) |
| --- | --- | ---: | ---: | --- |
| `kade.glb` | Kade, the player. 1.90 m to the top of the beret, 21 bones | 2,324 | 5,000 | `idle` (loop, 48 f), `walk` (loop, 24 f), `run` (loop, 16 f), `shoot` (8 f), `reload` (41 f), `hit` (11 f), `death` (30 f), `attack` (16 f) |
| `ar.glb` | Assault rifle, 0.89 m | 448 | 1,500 | none |
| `shotgun.glb` | Pump shotgun, 0.94 m | 348 | 1,500 | none |
| `marksman.glb` | Scoped marksman rifle, 1.14 m | 572 | 1,500 | none |
| `crossbow.glb` | Crossbow with a loaded bolt | 466 | 1,500 | none |
| `flamethrower.glb` | Twin-tank flamethrower | 560 | 1,500 | none |
| `frag_grenade.glb` | Frag grenade | 164 | 1,500 | none |
| `smoke_grenade.glb` | Smoke grenade | 220 | 1,500 | none |

| `rifleman.glb` | Rifleman, 1.88 m. Carries `ar.glb` in game | 1,736 | 3,500 | the eight humanoid clips (see below) |
| `runner.glb` | Machete Runner, machete in the right fist | 1,412 | 3,500 | the eight humanoid clips; `attack` is an overhead chop landing at 0.45 s |
| `sniper.glb` | Sniper in a ghillie hood. Carries `marksman.glb` in game | 1,692 | 3,500 | the eight humanoid clips |
| `grenadier.glb` | Grenadier with ordnance pack and bandolier | 1,852 | 3,500 | the eight humanoid clips; `attack` is an overhand throw releasing at 0.55 s |
| `shield.glb` | Shield Trooper. The shield is a separate mesh (`shield`) on its own bone | 1,600 | 3,500 | the eight humanoid clips; `attack` swings the shield aside, baton lands at 0.5 s |
| `drone.glb` | Scout Drone, 1.45 m across, origin at its centre | 680 | 3,500 | `hover` (loop, 25 f), `dive` (loop, 13 f) |
| `brute.glb` | The Brute, 4.5 m. Minigun arm with a `barrel` bone; rear tank is a separate mesh `fx_weak` | 2,180 | 12,000 | the eight humanoid clips plus `phase_change`, `special` |
| `phantom.glb` | The Phantom, 2.2 m. Cloak on a `cloak` bone; blades are a separate mesh `knives` | 1,484 | 12,000 | the eight humanoid clips plus `phase_change`, `special` |
| `commander.glb` | The Commander's walker, 6.5 m wide. Separate meshes: `panel_front`, `panel_L`, `panel_R`, `fx_core` | 2,508 | 12,000 | the eight humanoid clip names plus `phase_change`, `special` |

"The eight humanoid clips" are `idle`, `walk`, `run` (loops) and `shoot`, `reload`, `hit`, `death`, `attack`.

Triangle counts were read back from the exported files, not from the source scene.

Crossbow, flamethrower and the two grenades are loaded and verified but not yet usable in play; they arrive with the Phase 7 weapons.

### Named nodes

- `kade.glb` bones: `root`, `hips`, `spine`, `chest`, `head`, `upper_arm.L/R`, `forearm.L/R`, `hand.L/R`, `thigh.L/R`, `shin.L/R`, `foot.L/R`.
- `kade.glb` sockets (bones with no geometry): `socket_hand.R`, `socket_hand.L`, `socket_back`, `socket_hip.R`. The game seats the active weapon on `socket_hand.R`.
- Every weapon has a child node `muzzle` at the barrel tip. Tracers and the muzzle flash start there.
- Three.js strips dots from node names on load, so `upper_arm.L` is `upper_armL` in code. `Model.socket('socket_hand.R')` handles both spellings.

- Enemies and the two humanoid bosses use Kade's bone names. Extra bones: `shield` (Shield Trooper), `barrel` (Brute), `cloak` (Phantom).
- Walker bones: `root`, `body`, `turret`, `gun`, `pod_L/R`, `leg_FL/FR/BL/BR`, `shin_FL/FR/BL/BR`. The game aims `turret` itself; clips only add recoil.
- Meshes named `fx_*` get their own material in the game so they can glow independently (`fx_weak`, `fx_core`). Meshes named `panel_*` are hidden when the walker's armour breaks.

## Conventions

- Metres. Characters stand on the origin and face +Z in the game (−Y in Blender). Weapons point their barrel along +Z with the origin at the firing-hand grip.
- Transforms are applied: geometry is built in place, objects have identity transforms.
- One shared material, `JO_Palette`: an 8×8 swatch atlas (`src/jo_palette.png`, 64×64 px). UVs sit on swatch centres. Add colours by appending to `PALETTE` in `src/jo_lib.py`; never reorder it.
- Rigid skinning: each part is weighted 1.0 to one bone.
- Every bone points straight up with its Z axis forward, so bone-local axes match character axes. Rotation X is pitch, Y is yaw, Z is roll. This makes clips easy to author as plain Euler keys.
- One NLA track per clip, exported with `export_animation_mode='NLA_TRACKS'`.

## How the game uses the clips

`js/assets.js` splits each clip into an upper-body and a lower-body layer. `idle`, `walk` and `run` cross-fade as the base. `shoot`, `reload`, `hit` and `attack` play on the upper body only, so Kade can reload while running. `death` takes the whole body, then the model dissolves.

| Game state | Clip |
| --- | --- |
| standing | `idle` |
| aiming down sights, wading, slow movement | `walk` (speed-matched) |
| normal movement and sprint | `run` (speed-matched) |
| each shot | `shoot` |
| reload | `reload`, stretched to the weapon's reload time |
| taking damage | `hit` plus a red emissive flash |
| killed | `death`, held, then dissolve |
| (Phase 8 takedowns) | `attack` |

The roll is still a procedural tumble of the whole model.

### Enemies

Movement speed picks `idle`, `walk` or `run`, speed-matched. Each bullet fired plays `shoot`; a hit that does not kill plays `hit` with a flash; death plays `death` and dissolves. Telegraphed wind-ups (machete, grenade throw, baton) start `attack` when the wind-up starts, so the visible strike lands when the damage does. The drone uses `hover`, and `dive` during its dive-bomb.

### Bosses

| Boss state | Clip |
| --- | --- |
| **Brute** intro, phase 2 | `phase_change` (roar) |
| Brute minigun spin-up, sweep | `reload` held, then `shoot` repeating |
| Brute charge wind-up, charge | `special` held (crouch), then `run` |
| Brute stunned | `hit` held (kneeling); `fx_weak` pulses |
| Brute ground slam | `attack` (impact at 0.9 s) |
| **Phantom** intro, phase changes | `phase_change` |
| Phantom after a teleport | `reload` (rising from a crouch) before a burst, `attack` (knife fan, release at 0.65 s) |
| Phantom burst, dash wind-up, dash | `shoot` held, `special` held, `run` |
| **Commander** intro, phase changes | `phase_change` (shudder) |
| Commander machine gun | `shoot` repeating on the turret |
| Commander missile volley | `reload` held (pods tilt open) |
| Commander stomp | `attack` (impact at 0.83 s) |
| Commander laser | `special` held (nose down) |
| any boss killed | `death`, then dissolve |

The Phantom's cloaking is material opacity plus a wireframe copy of the mesh on the same skeleton.

## Rebuilding

In Blender's Python console (or through the Blender MCP):

```python
p = r'<repo>\models\src\build_kade.py'      # or build_weapons.py, build_enemies.py, build_bosses.py
exec(compile(open(p).read(), p, 'exec'), {'JO_SRC': p})
```

Each script clears the scene, builds the asset, writes preview stills to `src/preview/`, exports the GLB, re-imports it to check triangles, clips, size and orientation, saves a `.blend` beside the script, and regenerates `models.bundle.js`.

If you edit a `.glb` by hand, run `python tools/bundle_models.py` afterwards.

## Why there is a bundle

Browsers will not let a page opened from disk (`file://`) fetch other files, so `GLTFLoader.load('models/kade.glb')` fails when you double-click `index.html`. The loader therefore reads base64 copies from `models.bundle.js` first, and only fetches the `.glb` files when the game is served over HTTP and the bundle lacks an entry.

## Planned (later phases)

Phase 3: environment kits, pickups, skyboxes. Story models (Mira, the Lumen Bloom) come with Phase 3 or 6.
