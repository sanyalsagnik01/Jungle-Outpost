# JUNGLE OUTPOST

A browser 3D third-person shooter. Three levels, six enemy types, three multi-phase bosses, a story with three endings, stealth, a skill tree and three extra modes.
Characters, weapons and scenery are low-poly GLB models built in Blender; effects are Three.js primitives; character voices are generated with ElevenLabs; music and most sound effects are WebAudio synthesis. No build step, no network calls at runtime.

## Start

**Play in the browser:** https://sanyalsagnik01.github.io/Jungle-Outpost/

Or open `index.html` in a current Chrome, Edge or Firefox. Click **START MISSION**, then **DEPLOY** (the click also captures the mouse).

Everything the game needs is in this folder: Three.js r128 with its `GLTFLoader`, `SkeletonUtils` and post-processing passes in `lib/`, the models embedded in `models/models.bundle.js`, the story in `js/story.data.js`. It runs from `file://` and offline.

## Living world

The jungle reacts to you. Trees, bushes and grass move in the wind and part as you pass; birds scatter from gunfire, and the jungle goes quiet, then comes back. Shots leave marks and debris, bodies stay where they fall, lanterns can be shot out, and guards investigate noise, lose their nerve, retreat or surrender. Light shafts, ground fog, puddles after rain, positional sound with echo, and small scenes you can inspect with **E** fill in the rest.

| Key | Action |
|---|---|
| L | Flashlight |
| Z / V | Lean left / right |
| T | Wipe rain off the lens |
| Space at a ledge | Vault or climb |
| H | Minimal HUD |
| F2 | FPS and draw-call overlay |
| F4 | Cycle graphics quality (Auto, High, Medium, Low) |

Every effect has its own switch under **Settings > Living world**, and each scales with the quality tier. On Auto the game steps down by itself when the frame rate drops and says what it turned off. A gamepad works too, with vibration.

Headless tests for all of this are in `tests/`.

## Story

Kade, an engineer, is looking for his sister **Mira**, who was studying the **Lumen Bloom** in the valley. **Juno**, an ex-pilot with opinions, talks him through it over the radio. **The Commander** holds the outpost. **The Phantom** guards the ruins and can be spared once beaten (walk up and press **E**; **F** finishes him).
At the end Mira waits beside the Bloom and you choose: **Destroy**, **Preserve**, or a hidden **third** ending that only appears if you spared the Phantom.

Dialogue, barks, comic-panel cutscenes and boss intro cards are all skippable (**Enter** / **Esc**, or SKIP). Voice lines use files from `audio/voice/` when present and a synthesized radio voice otherwise (see `audio/voice/README.md`).

## Controls

Every key in this table can be changed under **SETTINGS → KEYS**.

| Input | Action |
| --- | --- |
| W A S D | Move (steer and throttle in the jeep) |
| Mouse | Look / aim |
| Left mouse | Shoot |
| Right mouse | Aim down sights |
| Shift | Sprint |
| Space | Jump (clears shockwave rings and the laser sweep) |
| C or Ctrl | Roll / dodge: short invulnerability |
| X | Crouch: quieter, harder to see |
| R | Reload |
| 1 – 5 | Assault rifle / Shotgun (Level 2) / Marksman rifle (Level 3) / Crossbow / Flamethrower (Level 2) |
| G / Q | Frag grenade / smoke grenade |
| E | Interact: supply crates, terminals, levers, the jeep, sparing the Phantom |
| F | Silent takedown from behind an unaware enemy |
| B | Field bench, at any checkpoint flag you have reached |
| J | Codex |
| Esc / P | Pause |
| M | Mute |
| F3 / F4 | Debug panel / graphics quality (Auto, High, Medium, Low) |

Prefer **C** for rolling: browsers reserve Ctrl+W.
Touch devices get a joystick, a look area and FIRE / JUMP / ROLL / LOAD / AIM / SWAP / FRAG / SMOKE / DUCK / USE buttons.

## Systems

**Stealth.** Enemies start on patrol with a vision cone. Standing in it fills an awareness meter (shown under the compass); crouching, distance, darkness, fog, rain and smoke slow it down. Footsteps, gunfire and explosions carry: the crossbow is nearly silent, a suppressed marksman rifle is quiet, everything else wakes the area. A spotted enemy needs about a second to raise the others, so killing him fast keeps things quiet.

**Field bench, salvage, skills, mods.** Kills, crates, intel and bosses pay salvage. Spend it at the bench (**B** at a reached checkpoint, or from the title and level-complete screens) on 12 skills in three branches (Assault, Stealth, Survival) and 10 weapon mods. Both stay with your profile across runs.

**Things to break and solve.** Explosive barrels (they chain), breakable crates, log bundles and a gantry bridge that drop when you shoot the rope. Level 2 has a timed spike corridor, a three-lever door and a jeep (it absorbs most damage and rams). Level 3 has a gate you hack at the terminal (enter the arrow sequence; failing trips an alarm) or blow open.

**Weather and time.** Each level has its own hour and the clock moves. Rain, fog banks and thunderstorms come and go; they shorten enemy sight and how far sound carries, and a thunderclap covers anything.

**Minimap and compass.** Unaware enemies show as dim wedges pointing where they look, alerted ones as red pings. Checkpoints, crates, barrels and puzzle pieces are marked.

**Saving.** The run autosaves at every checkpoint; **CONTINUE** on the title screen resumes it. Codex, collectibles, endings, salvage, skills, mods, achievements and settings are kept in the browser's localStorage (key `jungle-outpost-profile-v2`).

**Collectibles and codex.** Four intel logs and one hidden idol per level; the codex (**J**) also fills in as you meet enemies and bosses.

**Modes** (title → MODES). **New Game+**: unlocked by any ending; every weapon from the start, tougher enemies, more salvage. **Boss Rush**: the three bosses back to back, timed. **Endless Survival**: growing waves in the arena.

**Settings.** Look sensitivity, invert Y, aim assist, master and music volume, subtitle size, colourblind-safe warning colours, reduced shake, reduced flashes, hit-stop, adaptive difficulty (enemies ease off after repeated deaths at one checkpoint), graphics quality, minimap, weather effects, FPS counter and key rebinding.

**Achievements.** 23, listed under ACHIEVEMENTS on the title screen.

## How the bosses work

- **THE BRUTE** (Level 1): front armor soaks most damage. Stand in front of a pillar, let him charge down the red lane, step aside. The crash stuns him; shoot the glowing tank on his back. Below 50% he slams the ground (jump the ring) and calls in runners.
- **THE PHANTOM** (Level 2): nearly invisible between attacks; he is fully visible for 1.5 seconds after each one. Below 50% he adds knife fans, gas clouds and drones; near death he dashes along a red line. When beaten, spare or finish him.
- **THE COMMANDER** (Level 3): shielded until the missile volley ends. Missiles can be shot down. Phase 2 adds stomps and mortars. Phase 3 exposes the core (triple damage) and adds a laser sweep.

## Graphics quality

Post-processing uses the r128 `EffectComposer`: **High** = bloom + colour grade + vignette, **Medium** = grade + vignette, **Low** = none, lower resolution, shadows refreshed every other frame. **Auto** starts on High and steps down when the frame rate stays under 27 fps. If the composer cannot be created the game stays on Low.

## Models

See `models/README.md` for the asset list, triangle counts and clip names. Models load behind the title screen; anything that fails to load is replaced by a primitive version, so the game always runs. **F3** in play shows the model, triangle count and animation under the crosshair.

## Code layout

| File | Contents |
| --- | --- |
| `js/config.js` | All tuning and level data: difficulty, player, weapons, grenades, salvage, skills, mods, enemies, bosses, levels and their props |
| `js/events.js` | Publish/subscribe bus the systems below hang off |
| `js/save.js` | The localStorage profile |
| `js/audio.js` | Synthesized SFX, ambient bed, combat-aware music, surface footsteps |
| `js/input.js` | Keyboard (rebindable), mouse, pointer lock, touch |
| `js/world.js` | Renderer, level builder, colliders, ray casts |
| `js/fx.js` | Pooled particles, tracers, enemy projectiles, markers, shake |
| `js/models.js`, `js/assets.js` | Primitive fallback models; GLB loader, animation layers, hit flash, dissolve |
| `js/player.js` | Player controller, camera, weapons, aim assist |
| `js/hazards.js` | Enemy grenades, mortars, shockwaves, gas, homing missiles |
| `js/enemies.js`, `js/bosses.js` | Six enemy state machines and the three bosses |
| `js/ui.js` | HUD and screens |
| `js/story.js`, `js/story.data.js` | Dialogue, barks, cutscenes (data generated by `tools/build_story.py` from `story.json`) |
| `js/perks.js` | Salvage, skill tree, weapon mods, the bench |
| `js/arsenal.js` | Player grenades, smoke, flamethrower, blast damage |
| `js/stealth.js` | Vision cones, awareness, noise, alert spread, takedowns |
| `js/props.js` | Barrels, crates, rope traps, gate, lever door, spikes, jeep |
| `js/weather.js` | Day/night clock, rain, fog, lightning |
| `js/radar.js` | Minimap and compass |
| `js/post.js` | Post-processing tiers and automatic fallback |
| `js/codex.js`, `js/finale.js` | Collectibles and codex; the ending choice |
| `js/meta.js` | Settings, achievements, modes, adaptive difficulty, hit-stop, FPS counter |
| `js/main.js` | Game loop (fixed 60 Hz step), level flow, saves, pickups, playtest bot |

To retune, edit `js/config.js`. Enemy placements are `[type, x, z, options]` rows in each level's `zones`; breakables and set pieces are in each level's `props`.

## Testing

A playtest bot drives the normal inputs: in the console, `JO.Game.debug.bot = true` (add `JO.Game.debug.god = true` to ignore damage and `JO.Game.debug.speed = 8` to fast-forward). It solves the gate, the levers and the spikes and drives the jeep.

## Known limitations

- All 158 spoken lines are voiced (ElevenLabs Eleven v4, about 6,900 credits on the free tier). Delete a file from `audio/voice/` and rerun `python tools/build_story.py` to fall back to the synthesized voice for that line.
- Held weapons follow the hand's position but not its rotation.
- On-screen prompts name the default keys even after rebinding.
- The jeep has simple arcade handling and no driver model.
- Phase 7–10 balance (salvage prices, wave sizes, New Game+ scaling) has been tested by the bot, not tuned by hand.
- Barrels, the gate, levers and the terminal are drawn with primitives; the matching GLBs in `models/` are only used as static scenery.

## Credits

- Voices (and generated sound effects in `audio/sfx/`): created with ElevenLabs, elevenlabs.io (free plan; non-commercial use).
- Three.js r128 and its loaders and post-processing passes (MIT licence).
