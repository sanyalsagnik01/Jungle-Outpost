# JUNGLE OUTPOST

A browser 3D third-person shooter. Three levels, six enemy types, three multi-phase bosses.
The player, weapons, all six enemies and the three bosses are low-poly GLB models built in Blender; scenery and effects are Three.js primitives. Sound is WebAudio synthesis. No build step.

## Start

Open `index.html` in a current Chrome or Firefox. Click **START MISSION**, then **DEPLOY** (the click also captures the mouse).

Three.js r128 is bundled in `lib/` together with its matching `GLTFLoader.js` and `SkeletonUtils.js`, so the game works offline. If `three.min.js` is missing it falls back to the cdnjs copy.

## Controls

| Input | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Look / aim |
| Left mouse | Shoot |
| Right mouse | Aim down sights (zoom, tighter spread) |
| Shift | Sprint (uses stamina) |
| Space | Jump (clears shockwave rings and the laser sweep) |
| C or Ctrl | Roll / dodge: short invulnerability, 1.2 s cooldown |
| R | Reload |
| 1 / 2 / 3 | Assault rifle / Shotgun (from Level 2) / Marksman rifle (from Level 3) |
| E | Open supply crates |
| Esc | Pause |
| M | Mute |

Prefer **C** for rolling: browsers reserve Ctrl+W (close tab), which is easy to hit while moving forward.

Touch devices get a virtual joystick (left), a look area (right) and FIRE / JUMP / ROLL / LOAD / AIM / SWAP buttons.

## How the bosses work

- **THE BRUTE** (Level 1): front armor soaks most damage. Stand in front of a pillar or wall, let him charge down the red lane, step aside. The crash stuns him for 3 seconds; shoot the glowing tank on his back. Below 50% he slams the ground (jump the ring) and calls in runners.
- **THE PHANTOM** (Level 2): nearly invisible between attacks; watch for the shimmer and his shadow. He is fully visible for 1.5 seconds after each attack. Below 50% he adds knife fans, gas clouds and drones; near death he dashes along a red line.
- **THE COMMANDER** (Level 3): shielded until the missile volley ends, then open for a few seconds. Missiles can be shot down. Phase 2 adds stomps and a searchlight that calls mortars. Phase 3 exposes the core (triple damage) and adds a laser sweep you can jump or break with cover.

## Models

The player (Kade), the weapons, the enemies and the bosses are GLB models built in Blender; see `models/README.md` for the asset list, triangle counts and clip names. Models load behind the title screen with a progress bar. Anything that fails to load is replaced by the original primitive version, so the game always runs.

Press **F3** in play for a debug panel: the model, triangle count and active animation of whatever is under the crosshair, plus what the asset layer loaded.

## Code layout

| File | Contents |
| --- | --- |
| `js/config.js` | All tuning and level data: difficulty, player, weapons, enemies, bosses, upgrades, the three levels |
| `js/audio.js` | Synthesized SFX, ambient bed, music sequencer |
| `js/input.js` | Keyboard, mouse, pointer lock, touch |
| `js/world.js` | Renderer, level builder (instanced scenery), colliders, ray casts |
| `js/fx.js` | Pooled particles, tracers, enemy projectiles, markers, shake |
| `js/models.js` | Character models built from primitives (the fallback for every GLB) |
| `js/assets.js` | GLB loader, primitive fallback, animation layers, hit flash, death dissolve |
| `js/player.js` | Player controller, camera, weapons |
| `js/hazards.js` | Grenades, mortars, shockwaves, gas, homing missiles |
| `js/enemies.js` | Six enemy state machines, pooling, hit detection |
| `js/bosses.js` | The three bosses |
| `js/ui.js` | HUD and screens |
| `js/main.js` | Game loop (fixed 60 Hz step), level flow, pickups, playtest bot |

To retune, edit `js/config.js`. Enemy placements are `[type, x, z, options]` rows in each level's `zones`.

A debug bot exists for smoke testing: in the console, `JO.Game.debug.bot = true` (and `JO.Game.debug.god = true` to ignore damage).
