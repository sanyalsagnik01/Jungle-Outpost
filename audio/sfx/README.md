# Sound effects

Recorded sound effects, generated with ElevenLabs Sound Effects (model v3, free plan) in November 2026. Each effect has up to four takes named `<effect>_<take>.mp3`; the effect name matches a key of `JO.Audio.sounds` in `js/audio.js`. `amb_jungle_1.mp3` is the jungle ambience loop.

`python tools/build_sfx.py` trims, normalizes and embeds them into `js/sfx.data.js` (needs ffmpeg). The game picks a different take each time with a slight pitch change. Effects that have no recording (menu clicks, beeps, warnings, checkpoint and victory jingles, the radio crackle) keep their synthesized versions on purpose, and any effect whose file is missing or fails to decode falls back to synthesis.

Made with ElevenLabs (elevenlabs.io). Free-plan output: non-commercial use, credited here and in the main README.

| Effect | Length | Prompt |
| --- | --- | --- |
| `ar` | 1.0 s | Single assault rifle gunshot, close range, punchy crack with short outdoor jungle tail, no music |
| `sg` | 1.5 s | Pump shotgun blast, single close-range shot, heavy boom with short jungle echo, no music |
| `mr` | 1.5 s | Marksman rifle shot, single powerful high-caliber crack with long outdoor echo |
| `enemyShot` | 1.0 s | Distant enemy rifle shot, single gunshot heard from 40 meters away in a jungle |
| `sniperShot` | 1.5 s | Sniper rifle crack, single long-range shot with sharp supersonic snap and valley echo |
| `minigun` | 1.0 s | Rotary minigun firing, short buzzing burst of very rapid gunfire |
| `spinup` | 1.0 s | Minigun barrels spinning up, mechanical whir rising in pitch |
| `explode` | 3.0 s | Grenade explosion outdoors, deep boom with debris and dirt falling, jungle |
| `reload` | 1.5 s | Rifle magazine reload, magazine out, new magazine in, bolt pulled back, close foley |
| `empty` | 0.5 s | Dry fire click, empty gun trigger click, single |
| `swap` | 0.5 s | Weapon swap foley, rifle sling and gear rustle, quick |
| `step` | 0.5 s | Footstep on dirt path, single boot step on packed jungle soil |
| `stepGrass` | 0.5 s | Footstep in tall grass, single boot step through leaves and grass |
| `stepStone` | 0.5 s | Footstep on stone floor, single boot step on old temple stone |
| `stepWood` | 0.5 s | Footstep on wooden plank bridge, single hollow boot step |
| `splash` | 0.5 s | Footstep splashing through shallow water, single step in a puddle |
| `hit` | 0.5 s | Bullet impact on body, single dull meaty thud |
| `armor` | 0.5 s | Bullet ricochet off body armor plate, metallic ping |
| `clang` | 0.5 s | Metal clang ricochet, bullet hitting a steel riot shield |
| `hurt` | 0.7 s | Man grunting in pain, short male hurt grunt, soldier |
| `die` | 1.0 s | Soldier death groan, man collapsing with a final pained breath |
| `roar` | 2.0 s | Huge brute warrior roar, giant man bellowing in rage, deep and gravelly |
| `stomp` | 1.5 s | Heavy ground slam, giant stomp shockwave on dirt with rumble |
| `slash` | 0.5 s | Machete swing whoosh, fast blade swipe through the air |
| `windup` | 0.5 s | Weapon windup swoosh, heavy blade raised before a strike |
| `throw` | 0.5 s | Grenade throw whoosh, object thrown overhand, quick air swish |
| `missile` | 2.0 s | Rocket missile launch, whoosh and roaring thrust flying away |
| `gas` | 1.5 s | Toxic gas canister hiss, pressurized gas venting |
| `gate` | 2.0 s | Heavy iron gate grinding open, rusty metal and chains, fortress |
| `jump` | 0.5 s | Soldier jump foley, gear rattle and boots leaving the ground, quick |
| `roll` | 0.5 s | Combat roll on dirt, body tumbling with gear rustle |
| `charge` | 1.0 s | Energy weapon charging up, rising electric hum |
| `teleport` | 1.0 s | Cloaked figure teleport, quick dark whoosh vanish with shimmer |
| `laser` | 0.5 s | Laser beam zap, short sci-fi energy shot |
| `xb` | 0.5 s | Crossbow bolt release, string twang and bolt whoosh |
| `ft` | 1.0 s | Flamethrower burst, roaring jet of fire, short |
| `amb_jungle` | 10.0 s | Jungle ambience loop, insects, distant birds, humid rainforest at dusk, no music (loop on) |

About 1,750 credits in all (40 credits per second, four takes per generation). Takes that came back nearly silent are left out of the build automatically.
