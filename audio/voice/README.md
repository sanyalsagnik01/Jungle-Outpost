# Voice lines

Every spoken line in `story.json` has an `id` and a `voice` path of `audio/voice/<id>.mp3`. `lines.tsv` in this folder lists all 158 lines (file name, speaker, text).

All 158 lines are voiced. They were generated with ElevenLabs (model Eleven v4) on the free tier in November 2026, about 6,900 credits, using the casting below, and checked against the script with an offline speech recognizer. The game only plays these local files; it never calls an API.

## Replacing or adding voices

1. Generate each row of `lines.tsv` and save it here under the listed file name (MP3). Cost is about one ElevenLabs credit per character.
2. Run `python tools/build_story.py`. It scans this folder and records which files exist in `story.json` / `js/story.data.js` (`voiceFiles`).
3. Reload the game. Lines with a file play it; lines without keep the stand-in. A missing or broken file never stops the game.

The game only ever plays local files. It makes no API calls at runtime.

## Suggested casting (ElevenLabs voice library)

| Speaker | Direction | Suggested voice |
| --- | --- | --- |
| Kade | steady, dry, 30s | Chad (`wiy1Gg8ir59Wz8fJAOFD`) |
| Juno | warm, sarcastic, on a radio | Moriana (`ahuwlnygfGOZ2gufNQh7`), played light and dry |
| The Brute | deep, gravelly | Harry - Fierce Warrior (`SOYHLrjzK2X1ezoPC6cr`) |
| The Phantom | calm, whispery | Callum - Husky Trickster (`N2lVS1w4EtoT3dr4eOWO`) |
| The Commander | commanding, weary | jephthah voice (`uLJQMZhREaVyMzh22S1d`) |
| Mira | soft, determined | Andrea (`jTAlT4VvvXlYNDrxqpNQ`) |
| Soldier A / B / C | clipped / rough / tired | William Dwyer, Samar, Alden |
