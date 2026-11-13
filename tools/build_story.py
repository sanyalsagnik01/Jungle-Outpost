#!/usr/bin/env python3
"""Single source for every line in the game. Writes story.json (the data file the brief asks for)
and js/story.data.js (the same JSON wrapped for browsers opened from disk, where fetch() is blocked).
Run:  python tools/build_story.py"""
import json, os
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
L = []
def line(id, speaker, text, trigger, cooldown=0, seq=None):
    d = {'id': id, 'speaker': speaker, 'text': text, 'voice': 'audio/voice/%s.mp3' % id, 'trigger': trigger, 'cooldown': cooldown}
    if seq is not None: d['seq'] = seq
    L.append(d)
def seq(prefix, trigger, *pairs):
    for i, (sp, tx) in enumerate(pairs): line('%s_%d' % (prefix, i + 1), sp, tx, trigger, 0, i + 1)
def var(prefix, speaker, trigger, cooldown, *texts):
    for i, tx in enumerate(texts): line('%s_%d' % (prefix, i + 1), speaker, tx, trigger, cooldown)

# ---------------- Level 1: Landing Zone ----------------
seq('l1_start', 'level_start:0',
    ('juno', "Kade, it's Juno. You're on the ground and I'm at a safe altitude, which is my favourite kind."),
    ('juno', "Mira's last ping came from the research outpost, three klicks north. Follow the trail."),
    ('kade', "Copy. If my sister's out here, I'll find her."))
seq('l1_cp1', 'checkpoint:0:0', ('juno', "Checkpoint flag. Somebody left supplies. Don't ask who, just take them."))
seq('l1_cp2', 'checkpoint:0:1',
    ('juno', "Hold up. That's a camera in the mud. Kade... it's Mira's."),
    ('kade', "Footage is half gone. But she's laughing. She's working with them."),
    ('juno', "Maybe she had no choice. Maybe she did. Keep moving."))
seq('l1_cp3', 'checkpoint:0:2', ('juno', "Big heat signature past that wall of vines. I'd say knock, but he looks like the door."))
seq('brute_intro', 'boss_intro:brute',
    ('brute', "Little engineer. The Commander said you would come. He did not say you would be so small."),
    ('juno', "That is a very large man with a very large gun. Use the pillars!"))
seq('brute_p2', 'boss_phase:brute:2', ('brute', "Enough! I will bury you in this dirt!"), ('juno', "He's angry now. Jump the shockwaves!"))
seq('brute_stun', 'boss_stun:brute', ('juno', "He's dazed! The tank on his back, hit it now!"))
seq('brute_death', 'boss_death:brute', ('brute', "The Bloom... keeps us... strong..."), ('juno', "The what now?"))
# ---------------- Level 2: The Ruins ----------------
seq('l2_start', 'level_start:1',
    ('juno', "Fog's thick, so I'm flying on instruments and spite. The outpost is past these ruins."),
    ('juno', "The mercenaries here carry grenades and fly drones. I'd complain to their manager."))
seq('l2_cp1', 'checkpoint:1:0', ('juno', "The bridge is out. There's a patrol boat at the bank with a gun on it. I'm just saying."))
seq('l2_cp2', 'checkpoint:1:1',
    ('juno', "I've been reading the logs you found. The Bloom doesn't just glow, Kade. It gets into people's heads."),
    ('kade', "And Mira's been growing it."))
seq('l2_cp3', 'checkpoint:1:2', ('juno', "Something's moving in the temple and my scope can't hold on to it. Careful."))
seq('phantom_intro', 'boss_intro:phantom',
    ('phantom', "You hear it too. The humming. It tells me you are a threat."),
    ('kade', "You're a soldier. You have a name under all that."),
    ('phantom', "I had... a name."),
    ('juno', "Kade, his vitals read like a sleepwalker. He isn't choosing this. Maybe don't finish him."))
seq('phantom_p2', 'boss_phase:phantom:2', ('phantom', "It says... burn you out."), ('juno', "Gas clouds and drones. Keep moving and stay out of the green."))
seq('phantom_p3', 'boss_phase:phantom:3', ('juno', "He's failing. Watch the red line, then get clear."))
seq('phantom_beaten', 'boss_beaten:phantom', ('juno', "He's down. The humming is fading on my scope. Your call, Kade."))
seq('phantom_spared', 'boss_spared:phantom',
    ('phantom', "Sergeant... Elias Reyes. That is my name. I remember rain."),
    ('juno', "Welcome back, Sergeant. Extraction's on me."))
seq('phantom_death', 'boss_death:phantom', ('phantom', "Quiet... finally... quiet."), ('juno', "...Right. Moving on."))
# ---------------- Level 3: The Outpost ----------------
seq('l3_start', 'level_start:2',
    ('juno', "Every soldier he has left is between you and that gate. No pressure."),
    ('kade', "I didn't come this far to turn around."))
seq('l3_cp1', 'checkpoint:2:0', ('juno', "That gate's on a keypad. Find the terminal and I'll talk you through the hack."))
seq('l3_cp2', 'checkpoint:2:1', ('juno', "Halfway. For the record, I'm proud of you. Don't make it weird."))
seq('l3_cp3', 'checkpoint:2:2', ('juno', "Courtyard ahead. Something with four legs just powered up. I miss the large man."))
seq('commander_intro', 'boss_intro:commander',
    ('commander', "Engineer. You think I am the villain of this valley."),
    ('commander', "The Bloom keeps men from tearing each other apart. I am guarding it from people far worse than me."),
    ('kade', "Then you won't mind if I ask my sister."),
    ('commander', "You will have to get past the walker."))
seq('commander_p2', 'boss_phase:commander:2', ('commander', "Shield generator down. Impressive. Irrelevant."), ('juno', "Searchlight! Stay out of the beam or it rains mortars."))
seq('commander_p3', 'boss_phase:commander:3', ('commander', "The core! Keep away from the core!"), ('juno', "He said the quiet part out loud. Shoot the core!"))
seq('commander_death', 'boss_death:commander', ('commander', "If it falls into their hands... remember that I tried to hold the line."))
seq('mira_meet', 'mira_meet',
    ('mira', "Kade? You came all this way."),
    ('kade', "You were working with him."),
    ('mira', "I was. The Bloom calms minds. It also keeps this whole valley alive. I thought I could choose which."),
    ('mira', "There is a kill switch, and there is a containment seal. I can't decide. You have to."))
seq('mira_third', 'mira_third', ('phantom', "There's a third way. The river. I remember the river."), ('mira', "Reyes? The water... it strips the spores and leaves the rest. Kade, he's right."))
# ---------------- Juno reactions (variants with cooldowns) ----------------
var('first_rifleman', 'juno', 'first:rifleman', 0, "Riflemen ahead. They like cover. You like them out of it.")
var('first_runner', 'juno', 'first:runner', 0, "Machetes! They're fast and they're loud. Don't let them get close.")
var('first_sniper', 'juno', 'first:sniper', 0, "Red laser means a sniper is lining you up. Move when the dot stops moving.")
var('first_grenadier', 'juno', 'first:grenadier', 0, "Grenadier! A red ring on the ground means leave.")
var('first_drone', 'juno', 'first:drone', 0, "Scout drones. Fragile, annoying, a lot like my ex.")
var('first_shield', 'juno', 'first:shield', 0, "Shield trooper! Bullets bounce off the front, so flank him or shoot the legs.")
var('low_health', 'juno', 'low_health', 35, "You're bleeding all over my rescue. Find cover and breathe.", "Vitals are ugly, Kade. Get behind something solid.", "Do not die. I already spent the advance.")
var('headshots', 'juno', 'headshot_streak', 40, "Three for three. Show-off.", "That's some shooting for a bridge builder.", "Remind me never to play darts with you.")
var('near_miss', 'juno', 'near_miss', 30, "That one parted your hair!", "Too close. Way too close.", "Nice dodge. Do that every time.")
var('kill_streak', 'juno', 'kill_streak', 45, "They're running out of soldiers faster than I'm running out of jokes.", "Remind me to stay on your good side.")
var('player_dead', 'juno', 'player_dead', 0, "Kade? Kade! ...Okay. Back to the last flag. Again.", "No, no, no. Up you get. The flag's still there.")
var('stealth_kill', 'juno', 'takedown', 30, "Quiet. I like quiet.", "He never heard a thing. Neither did I, and I was listening.")
var('intel_found', 'juno', 'intel', 20, "Intel. I'll add it to the codex.", "Another log. Keep them coming.", "Got it. Reading while flying. Very safe.")
var('idol_found', 'juno', 'idol', 0, "Is that a golden idol? Who hides those in a jungle? Besides everyone.")
var('boat_start', 'juno', 'boat', 0, "You're on the gun. I'd say aim, but it has plenty of bullets.")
var('gate_hack', 'juno', 'hack', 0, "Stay on the terminal. They will not like this.")
var('weather_rain', 'juno', 'rain', 0, "Rain's coming in. They'll see less and hear less. So will you.")
# ---------------- Juno reacts to how you play (living-world pass) ----------------
var('re_lamp', 'juno', 'react:lamp_out', 60, "Lights out. Somebody is going to come and look at that.", "Nice shot. Now it's dark for them too.")
var('re_surr', 'juno', 'react:surrender', 50, "He's done, Kade. Hands up means hands up.", "Your call. I'm not the one who has to live with it.")
var('re_spare', 'juno', 'react:spared', 70, "He's running. Good. Let him tell the others what he saw.", "One less man holding a rifle, and nobody had to die for it.")
var('re_exec', 'juno', 'react:executed', 70, "He had dropped his weapon.", "...Noted.")
var('re_body', 'juno', 'react:body_found', 60, "They found one of the bodies. So much for quiet.", "Somebody tripped over your handiwork. Expect company.")
var('re_storm', 'juno', 'react:storm', 200, "Storm's coming in. Thunder covers gunfire, if you time it.", "Lightning. If you can see them in the flash, they can see you.")
var('re_rain', 'juno', 'react:rain', 200, "Rain. Good for you, it eats footsteps. Bad for my rotor.", "It's coming down. Watch the puddles, they splash.")
var('re_torch', 'juno', 'react:torch', 240, "That torch of yours can be seen from the next valley.", "Light on. Brave. Or tired of sneaking.")
var('re_quiet', 'juno', 'react:quiet', 300, "Hear that? No birds. They know something is wrong before the soldiers do.", "The jungle's gone quiet. That's on you.")
var('re_birds', 'juno', 'react:birds', 150, "Those birds just told everyone where you are.", "Flock's up. Anyone watching the treeline saw that.")
var('re_heat', 'juno', 'react:overheat', 120, "The flamethrower needs a breath. So do I.")
var('re_vault', 'juno', 'react:vault', 400, "Over the top. Show-off.")
var('re_ghost', 'juno', 'react:ghost', 200, "Three down and nobody has noticed. I'm almost impressed.", "You're good at this. I'm not sure that's a compliment.")
var('re_whiz', 'juno', 'react:whiz', 150, "That one parted your hair.", "Too close. Move!")
# ---------------- things left behind: scenes you can stop and look at ----------------
SCENES = [
 dict(id='s1_camp', level=0, z=-88, x=-10.5, kind='camp', title="A cold camp", text="Two bedrolls. One has been slept in. The other is still folded, with M.V. inked on the strap.", say=[('kade', "She had a place to sleep. She chose not to use it.")]),
 dict(id='s1_graves', level=0, z=-150, x=10.5, kind='graves', title="Three helmets", text="Three stakes, three helmets, fresh earth. The soldiers bury their own and do not mark the names.", say=[('juno', "They are losing people out here, Kade, and it isn't to you.")]),
 dict(id='s1_flags', level=0, z=-205, x=-10, kind='flags', title="Survey line", text="Survey flags in a row, each tagged in Mira's handwriting: soil, water, bloom spread. The last tag only says: faster than last month.", say=[('kade', "That's her writing. She was measuring it."), ('juno', "Measuring how fast it grows. Or how fast it takes.")]),
 dict(id='s2_shrine', level=1, z=-60, x=10.5, kind='shrine', title="An old shrine", text="Fresh fruit in a bowl older than the ruins. Somebody still leaves offerings at a shrine nobody admits to visiting.", say=[('juno', "Mercenaries, praying. That's new.")]),
 dict(id='s2_cots', level=1, z=-150, x=-10.5, kind='cots', title="The quiet ward", text="Six cots under a tarp. None of these men were wounded. Every chart says the same thing: calm, compliant, will not leave.", say=[('kade', "They weren't prisoners."), ('juno', "No. That's the part I don't like.")]),
 dict(id='s2_drop', level=1, z=-200, x=10.5, kind='drop', title="A drop that missed", text="Supply crates half sunk in the mud. A company name stencilled on, painted out, and a second name painted over that.", say=[('juno', "Whoever pays for this place doesn't want a paper trail.")]),
 dict(id='s3_bench', level=2, z=-84, x=-10.5, kind='bench', title="Mira's field bench", text="Sample jars, each brighter than the last. In the margin of the log: it wants to be looked after. I am not sure that is a metaphor any more.", say=[('kade', "Mira..."), ('juno', "Keep it together. We're close.")]),
 dict(id='s3_wall', level=2, z=-162, x=10.5, kind='wall', title="The count", text="Someone kept a tally on this wall. Days, then weeks. The marks stop, and under them one line: why would I go?", say=[('juno', "That's not a prisoner counting days. That's someone who stopped wanting to.")]),
 dict(id='s3_radio', level=2, z=-206, x=-10.5, kind='radio', title="The long-range set", text="The outpost's radio, opened up with an axe. Whoever did it coiled the cables neatly afterwards.", say=[('kade', "Nobody was calling for help."), ('juno', "Somebody made sure nobody could.")])]
for sc in SCENES: seq(sc['id'], 'scene:' + sc['id'], *sc['say'])
# ---------------- enemy barks ----------------
B = []
def bark(event, speaker, *texts):
    for i, tx in enumerate(texts):
        id = 'bark_%s_%s_%d' % (event, speaker[-1], i + 1)
        B.append({'id': id, 'speaker': speaker, 'text': tx, 'voice': 'audio/voice/%s.mp3' % id, 'trigger': 'bark:' + event, 'cooldown': 8})
bark('alert', 'soldier_a', "Contact!", "Intruder on the trail!"); bark('alert', 'soldier_b', "He's here!", "There! By the trees!"); bark('alert', 'soldier_c', "Eyes on target.")
bark('hurt', 'soldier_a', "I'm hit!"); bark('hurt', 'soldier_b', "Agh! Medic!"); bark('hurt', 'soldier_c', "Armour's holding!")
bark('ally_down', 'soldier_a', "Man down!"); bark('ally_down', 'soldier_b', "They got Ortiz!")
bark('throw', 'soldier_b', "Frag out!", "Eat this!")
bark('retreat', 'soldier_a', "Falling back!", "Cover me!")
bark('charge', 'soldier_b', "Cut him down!", "For the Bloom!")
bark('aim', 'soldier_a', "Hold still...", "Got you in my sights.")
bark('idle', 'soldier_a', "Three days of rain. Three."); bark('idle', 'soldier_b', "I didn't sign up to guard a flower."); bark('idle', 'soldier_c', "Quiet tonight. I hate quiet.")
bark('panic', 'soldier_a', "He's a demon!"); bark('panic', 'soldier_b', "I can't stop him!")
bark('search', 'soldier_a', "Thought I heard something."); bark('search', 'soldier_c', "Check the bushes.")
bark('investigate', 'soldier_a', "What was that?", "Stay here. I'll look."); bark('investigate', 'soldier_b', "Something moved."); bark('investigate', 'soldier_c', "Probably nothing. Probably.")
bark('body', 'soldier_a', "Man down! We've got a body!"); bark('body', 'soldier_b', "Ortiz? Ortiz!"); bark('body', 'soldier_c', "He's dead. Sound the alarm!")
bark('surrender', 'soldier_a', "Don't shoot! I'm done!"); bark('surrender', 'soldier_b', "I give up! I give up!"); bark('surrender', 'soldier_c', "Enough. I'm not dying for a flower.")

story = {
  'speakers': {
    'kade': {'name': 'KADE', 'color': '#8fbf6a', 'portrait': {'skin': '#d9a676', 'hair': '#2a1c14', 'hat': 'beret', 'hatColor': '#b3261a', 'bg': '#2c4420'}, 'voice': 'steady, dry, male, 30s'},
    'juno': {'name': 'JUNO', 'color': '#ffb62e', 'portrait': {'skin': '#c58a5c', 'hair': '#3a2418', 'hat': 'headset', 'hatColor': '#23281c', 'bg': '#5a3a10'}, 'voice': 'warm, sarcastic, female'},
    'brute': {'name': 'THE BRUTE', 'color': '#ff6a4a', 'portrait': {'skin': '#a9744a', 'hair': '#111', 'hat': 'horns', 'hatColor': '#6a7078', 'bg': '#4a1410'}, 'voice': 'deep, gravelly'},
    'phantom': {'name': 'THE PHANTOM', 'color': '#58e0d0', 'portrait': {'skin': '#16121f', 'hair': '#16121f', 'hat': 'hood', 'hatColor': '#3a2a55', 'bg': '#1a2a33'}, 'voice': 'calm, whispery'},
    'commander': {'name': 'THE COMMANDER', 'color': '#e9e4cf', 'portrait': {'skin': '#b98a60', 'hair': '#8a8a86', 'hat': 'cap', 'hatColor': '#363c33', 'bg': '#3a2418'}, 'voice': 'commanding, weary'},
    'mira': {'name': 'MIRA', 'color': '#9fd8ff', 'portrait': {'skin': '#d9a676', 'hair': '#2a1c14', 'hat': 'ponytail', 'hatColor': '#2a1c14', 'bg': '#22404a'}, 'voice': 'soft, determined'},
    'soldier_a': {'name': 'SOLDIER', 'color': '#c8c8b0', 'portrait': {'skin': '#c49062', 'hair': '#222', 'hat': 'helmet', 'hatColor': '#4a5528', 'bg': '#2a2f22'}, 'voice': 'clipped, professional male'},
    'soldier_b': {'name': 'SOLDIER', 'color': '#c8c8b0', 'portrait': {'skin': '#a9744a', 'hair': '#222', 'hat': 'helmet', 'hatColor': '#6e5c38', 'bg': '#2f2a22'}, 'voice': 'rough, excitable male'},
    'soldier_c': {'name': 'SOLDIER', 'color': '#c8c8b0', 'portrait': {'skin': '#c49062', 'hair': '#222', 'hat': 'helmet', 'hatColor': '#3c4658', 'bg': '#22262f'}, 'voice': 'flat, tired male'},
  },
  'barkVoices': {'rifleman': 'soldier_a', 'sniper': 'soldier_a', 'runner': 'soldier_b', 'grenadier': 'soldier_b', 'shield': 'soldier_c'},
  'levels': [
    {'name': 'LANDING ZONE', 'story': "Dawn at the landing zone. Mira's trail leads north through patrols loyal to a warlord called the Brute."},
    {'name': 'THE RUINS', 'story': "Dusk in the old temple. The bridge is out, the fog is thick, and something that used to be a soldier hunts between the pillars."},
    {'name': 'THE OUTPOST', 'story': "Night at Mira's outpost. Gates, searchlights and the Commander's walker stand between Kade and his sister."}],
  'lines': L + B,
  'cutscenes': {
    'l1_open': [
      {'art': 'chopper', 'caption': "Three weeks ago, Dr. Mira Voss stopped answering her radio."},
      {'art': 'jungle', 'caption': "Her brother Kade, an army engineer who builds bridges rather than wars, bought a seat on the only helicopter flying into the valley."},
      {'art': 'radio', 'caption': "The pilot stayed on the line. She says it is for the money."}],
    'l1_close': [
      {'art': 'camera', 'caption': "Mira's camera survived the fight. The last clip shows her handing a sample case to a man in a commander's coat. Willingly."},
      {'art': 'ruins', 'caption': "North of the ridge the jungle swallows an older place. Stone, river and fog."}],
    'l2_open': [
      {'art': 'ruins', 'caption': "The temple was old before anyone drew a map of this valley."},
      {'art': 'bloom', 'caption': "Something grows here that glows at night. The mercenaries call it the Lumen Bloom."}],
    'l2_close': [
      {'art': 'river', 'caption': "The logs were clear. Spores from the Bloom make people calm, loyal and easy to lead. The Commander has been feeding it to his own men."},
      {'art': 'outpost', 'caption': "And Mira helped him grow it."}],
    'l3_open': [
      {'art': 'outpost', 'caption': "Mira built the outpost to study the valley. The Commander turned it into a fortress."},
      {'art': 'storm', 'caption': "Night. One way in."}],
    'end_destroy': [
      {'art': 'fire', 'caption': "Kade throws the kill switch. The Bloom burns white, then grey, then nothing."},
      {'art': 'chopper', 'caption': "Mira flies home beside him. Behind them the valley's rivers run brown and the canopy starts to thin."},
      {'art': 'jungle', 'caption': "The soldiers wake up as themselves, in a jungle that no longer protects them. Some thank him. Some never will."}],
    'end_preserve': [
      {'art': 'bloom', 'caption': "Kade closes the containment seal. The Bloom keeps glowing behind glass."},
      {'art': 'outpost', 'caption': "Mira stays. The outpost takes down its guns and becomes a sanctuary, and the valley stays green."},
      {'art': 'radio', 'caption': "Kade leaves alone. The humming follows him as far as the river, and he tells himself it is only the rotors."}],
    'end_third': [
      {'art': 'river', 'caption': "They open the sluice instead. River water floods the grow beds and the spores wash out pale and harmless."},
      {'art': 'bloom', 'caption': "The Bloom survives, smaller and quieter. It heals. It no longer whispers."},
      {'art': 'dawn', 'caption': "Sergeant Reyes carries the first clean cutting out of the valley. Mira and Kade follow, arguing about bridges."}],
  },
  'endings': {
    'destroy': {'title': 'ASHES', 'choice': 'DESTROY THE BLOOM', 'hint': "Throw the kill switch. Mira comes home. The valley loses its guardian.", 'cutscene': 'end_destroy',
                'signoff': {'id': 'end_destroy_juno', 'speaker': 'juno', 'text': "You got her out. That was the job. The rest... we'll carry it. Juno out."}},
    'preserve': {'title': 'SANCTUARY', 'choice': 'PRESERVE THE BLOOM', 'hint': "Close the containment seal. The valley lives. Mira stays.", 'cutscene': 'end_preserve',
                 'signoff': {'id': 'end_preserve_juno', 'speaker': 'juno', 'text': "She chose to stay, Kade. That's not losing her. Probably. Juno out."}},
    'third': {'title': 'CLEAR WATER', 'choice': 'OPEN THE SLUICE', 'hint': "Reyes remembers the river. Wash out the spores, keep the cure.", 'cutscene': 'end_third', 'requires': 'mercy',
              'signoff': {'id': 'end_third_juno', 'speaker': 'juno', 'text': "Everybody lives and the flower behaves. I didn't know we were allowed to win like that. Juno out."}},
  },
  'intel': [
    {'id': 'i1_1', 'level': 0, 'title': "Field note, Dr. M. Voss", 'text': "Specimen LB-1 glows brighter when people are near. It seems to like company."},
    {'id': 'i1_2', 'level': 0, 'title': "Supply manifest", 'text': "40 crates rifles. 12 crates 'calming agent (LB extract)'. Signed for by the Commander."},
    {'id': 'i1_3', 'level': 0, 'title': "Patrol log", 'text': "The Brute has not slept in six days. Says the Bloom hums him lullabies."},
    {'id': 'i1_4', 'level': 0, 'title': "Voice memo, Mira", 'text': "Kade would hate it here. Too many things he can't fix with a wrench."},
    {'id': 'i2_1', 'level': 1, 'title': "Lab log 14", 'text': "Subjects exposed to the spores follow simple orders without question. The effect fades nine days after the last exposure."},
    {'id': 'i2_2', 'level': 1, 'title': "Medical file: Sgt. E. Reyes", 'text': "Volunteered for the 'enhanced reflex' trial. Has stopped answering to his own name."},
    {'id': 'i2_3', 'level': 1, 'title': "Temple carving, translated", 'text': "The flower keeps the valley. The valley keeps the flower. Do not carry it out. (The order of the levers is carved beside it: SUN, RIVER, MOON.)"},
    {'id': 'i2_4', 'level': 1, 'title': "Mira, private", 'text': "River water neutralises the spores but not the healing compounds. Why has nobody tested this?"},
    {'id': 'i3_1', 'level': 2, 'title': "Commander's log", 'text': "Three buyers have made offers for the Bloom. All three would turn it into a weapon. I refused all three."},
    {'id': 'i3_2', 'level': 2, 'title': "Outpost order 7", 'text': "Dr. Voss is not a prisoner. Dr. Voss is not to leave."},
    {'id': 'i3_3', 'level': 2, 'title': "Mira, private", 'text': "He believes he is protecting it. I believed I was studying it. We were both just feeding it."},
    {'id': 'i3_4', 'level': 2, 'title': "Maintenance note", 'text': "Walker core runs hot with the armour panels off. Do NOT let anyone shoot the core."}],
  'idols': [
    {'id': 'idol_1', 'level': 0, 'title': "Idol of the Sun", 'text': "A palm-sized gold figure, warm to the touch. Its eyes glow faintly green."},
    {'id': 'idol_2', 'level': 1, 'title': "Idol of the River", 'text': "Found behind the temple. Water beads on it and runs uphill."},
    {'id': 'idol_3', 'level': 2, 'title': "Idol of the Moon", 'text': "The Commander kept it on a shelf. Someone had turned its face to the wall."}],
  'codex': {
    'bios': [
      {'id': 'kade', 'title': 'Kade Voss', 'text': "Former army engineer. Builds bridges, clears roads, fixes generators. Came to the valley for one reason: his younger sister."},
      {'id': 'juno', 'title': 'Juno', 'text': "Former combat pilot, current freelance. Stays on the radio, briefs every level and insists she is only here for the fee."},
      {'id': 'mira', 'title': 'Dr. Mira Voss', 'text': "Botanist. Found the Lumen Bloom, built an outpost to study it, and stayed long after she should have left.", 'unlock': 'level:2'},
      {'id': 'cmdr', 'title': 'The Commander', 'text': "Took over the outpost with a private company of soldiers. Says he is guarding the Bloom. May even believe it.", 'unlock': 'level:1'},
      {'id': 'bloomc', 'title': 'The Lumen Bloom', 'text': "A glowing plant found only in this valley. Its spores calm and bind the mind. Its roots seem to hold the valley's water and soil together.", 'unlock': 'level:1'}],
    'enemies': [
      {'id': 'rifleman', 'title': 'Rifleman', 'text': "Moves between cover, strafes and fires short bursts. Falls back when hurt."},
      {'id': 'runner', 'title': 'Machete Runner', 'text': "Sprints in a zig-zag and slashes after a short wind-up. Low health, travels in groups."},
      {'id': 'sniper', 'title': 'Sniper', 'text': "Perches in towers. Shows a red laser for 1.5 seconds before each shot, then relocates if hit."},
      {'id': 'grenadier', 'title': 'Grenadier', 'text': "Keeps his distance and lobs grenades with a two-second fuse. Watch for the red ring."},
      {'id': 'shield', 'title': 'Shield Trooper', 'text': "Advances behind a shield that stops bullets from the front. Flank him, shoot his legs, or wait for the baton swing."},
      {'id': 'drone', 'title': 'Scout Drone', 'text': "Circles at changing heights, fires laser bursts and dive-bombs. Fragile. Explodes when it lands."}],
    'bosses': [
      {'id': 'brute', 'title': 'The Brute', 'text': "A warlord in plate armour with a minigun for an arm. Bait his charge into a pillar, then shoot the tank on his back."},
      {'id': 'phantom', 'title': 'The Phantom', 'text': "Sgt. Elias Reyes, deep under the Bloom's influence. Cloaks, teleports, throws knives. Can be spared once beaten."},
      {'id': 'commander', 'title': "The Commander's Walker", 'text': "Four legs, a shield, missiles, mortars and a laser. When the armour breaks, the core takes triple damage."}],
  },
}
story['scenes'] = [dict((k, v) for k, v in sc.items() if k != 'say') for sc in SCENES]
for e in story['endings'].values(): e['signoff']['voice'] = 'audio/voice/%s.mp3' % e['signoff']['id']
# synthesized stand-in voice per speaker (used for any line that has no audio file): pitch in Hz, radio = band-limited like a headset
BLIP = {'kade': (125, 0), 'juno': (215, 1), 'brute': (72, 0), 'phantom': (150, 0), 'commander': (98, 0), 'mira': (245, 0), 'soldier_a': (140, 0), 'soldier_b': (118, 0), 'soldier_c': (104, 0)}
for k, v in BLIP.items(): story['speakers'][k]['blip'] = {'pitch': v[0], 'radio': v[1]}
# suggested ElevenLabs casting (voice ids from the workspace voice list); used by whoever generates the files
CAST = {'kade': 'Chad (wiy1Gg8ir59Wz8fJAOFD)', 'juno': 'Moriana (ahuwlnygfGOZ2gufNQh7), played light and dry', 'brute': 'Harry - Fierce Warrior (SOYHLrjzK2X1ezoPC6cr)', 'phantom': 'Callum - Husky Trickster (N2lVS1w4EtoT3dr4eOWO)',
        'commander': 'jephthah voice (uLJQMZhREaVyMzh22S1d)', 'mira': 'Andrea (jTAlT4VvvXlYNDrxqpNQ)', 'soldier_a': 'William Dwyer (BTGyeM5mXQG9spZ5F9uw)', 'soldier_b': 'Samar (o7jrBY5t3RadnkTqEitx)', 'soldier_c': 'Alden - Tired Old Man (S9V0fuqWOqX0i8Kb8ctu)'}
for k, v in CAST.items(): story['speakers'][k]['cast'] = v
VDIR = os.path.join(ROOT, 'audio', 'voice'); os.makedirs(VDIR, exist_ok=True)
allspoken = story['lines'] + [e['signoff'] for e in story['endings'].values()]
story['voiceFiles'] = sorted(l['id'] for l in allspoken if os.path.exists(os.path.join(VDIR, l['id'] + '.mp3')))
with open(os.path.join(VDIR, 'lines.tsv'), 'w', encoding='utf-8', newline='\n') as f:
    f.write('file\tspeaker\ttext\n'); [f.write('%s.mp3\t%s\t%s\n' % (l['id'], l['speaker'], l['text'])) for l in allspoken]
with open(os.path.join(ROOT, 'story.json'), 'w', encoding='utf-8', newline='\n') as f: json.dump(story, f, indent=1, ensure_ascii=False)
with open(os.path.join(ROOT, 'js', 'story.data.js'), 'w', encoding='utf-8', newline='\n') as f:
    f.write('/* generated from story.json by tools/build_story.py - edit that script, not this file */\nwindow.JO_STORY = ' + json.dumps(story, ensure_ascii=False, separators=(',', ':')) + ';\n')
spoken = len(story['lines']) + len(story['endings'])
print('voice files present: %d of %d' % (len(story['voiceFiles']), len(allspoken)))
print('story.json: %d lines (%d story, %d barks), %d cutscene panels, %d intel, %d chars spoken' % (spoken, len(L) + 3, len(B), sum(len(v) for v in story['cutscenes'].values()), len(story['intel']), sum(len(l['text']) for l in story['lines']) + sum(len(e['signoff']['text']) for e in story['endings'].values())))
