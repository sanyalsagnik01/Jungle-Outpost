/* ============================================================
   JUNGLE OUTPOST — config.js
   All tuning lives here: difficulty, player, weapons, enemies,
   bosses, upgrades and the three levels (data-driven).
   World axes: the path runs toward -Z. X is left/right.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO = window.JO || {};

JO.CFG = {
  STEP: 1 / 60,          // fixed logic timestep
  MAX_ACTIVE: 11,        // regular enemies alive at once (boss not counted) -> always < 12

  DIFF: {
    easy:   { label: 'EASY',   dmg: 0.6,  acc: 0.7, hp: 0.85 },
    normal: { label: 'NORMAL', dmg: 1.0,  acc: 1.0, hp: 1.0 },
    hard:   { label: 'HARD',   dmg: 1.35, acc: 1.3, hp: 1.15 }
  },

  PLAYER: {
    hp: 100, regenDelay: 5, regenRate: 6,
    walk: 5.6, sprint: 9.2, adsMove: 3.4, jump: 7.6, gravity: 21,
    rollSpeed: 12.5, rollTime: 0.45, rollInvuln: 0.42, rollCd: 1.2, rollCost: 22,
    stamina: 100, sprintDrain: 15, staminaRegen: 24, staminaDelay: 0.7,
    radius: 0.45, plateValue: 50, checkpointHeal: 40, checkpointAmmo: 150
  },

  // falloff: [fullDamageUntil, zeroPoint, minimumFraction]
  WEAPONS: [
    { id: 'ar', name: 'ASSAULT RIFLE', short: 'AR', dmg: 14, pellets: 1, interval: 0.105, mag: 30, reserve: 210, maxReserve: 300,
      reload: 1.7, spread: 1.5, adsSpread: 0.45, bloom: 0.2, range: 140, headMult: 2, recoil: 0.0055, unlockLevel: 0, pickup: 60 },
    { id: 'sg', name: 'SHOTGUN', short: 'SG', dmg: 10, pellets: 8, interval: 0.78, mag: 6, reserve: 24, maxReserve: 42,
      reload: 2.1, spread: 5.2, adsSpread: 3.4, bloom: 0, range: 50, headMult: 2, recoil: 0.03, unlockLevel: 1, pickup: 6,
      falloff: [7, 26, 0.2] },
    { id: 'mr', name: 'MARKSMAN RIFLE', short: 'MR', dmg: 72, pellets: 1, interval: 0.6, mag: 8, reserve: 32, maxReserve: 48,
      reload: 2.3, spread: 1.3, adsSpread: 0.04, bloom: 0, range: 240, headMult: 3, recoil: 0.022, unlockLevel: 2, pickup: 6 }
  ],

  ENEMY: {
    rifleman:  { hp: 60,  speed: 3.4, sight: 42, dmg: 7, burst: 3, burstGap: 0.15, cooldown: [1.4, 2.3], spread: 2.3,
                 bulletSpeed: 44, retreatHp: 0.35, drop: 0.45 },
    runner:    { hp: 30,  speed: 7.6, sight: 46, dmg: 14, windup: 0.45, reach: 2.5, drop: 0.2 },
    sniper:    { hp: 50,  sight: 80, dmg: 38, aim: 1.5, lock: 0.2, cooldown: 4.4, drop: 0.6 },
    grenadier: { hp: 85,  speed: 2.3, sight: 42, dmg: 30, radius: 4.4, fuse: 2.0, cooldown: 4.0, range: [13, 24], drop: 0.6 },
    shield:    { hp: 120, speed: 2.3, turn: 1.4, sight: 42, dmg: 18, windup: 0.5, reach: 2.5, pistolDmg: 6, pistolCd: 2.6, drop: 0.6 },
    drone:     { hp: 26,  speed: 7.5, sight: 55, dmg: 5, diveDmg: 14, cooldown: 2.9, drop: 0.3 }
  },

  BOSS: {
    brute: {
      name: 'THE BRUTE', hp: 1700, walk: 2.3, turn: 1.6,
      armorMult: 0.6, headMult: 1.0, weakMult: 2.5,
      sweepDmg: 6, sweepRate: 0.075, sweepTime: 2.3, sweepArc: 0.62,
      chargeSpeed: 20, chargeDmg: 28, stun: 3.0,
      slamDmg: 20, slamSpeed: 13, summonEvery: 20
    },
    phantom: {
      name: 'THE PHANTOM', hp: 1250, burstDmg: 8, knifeDmg: 12, dashDmg: 26, gasDps: 7,
      cloakTime: 1.15, visibleTime: 1.5, finalAt: 0.22
    },
    commander: {
      name: 'THE COMMANDER', hp: 3200, walk: 1.6, turn: 0.75,
      shieldMult: 0.2, armorMult: 1.0, coreMult: 3, shieldDown: 5.5,
      mgDmg: 6, mgRate: 0.085, mgTime: 2.6,
      missileDmg: 15, missileSpeed: 11, missileTurn: 1.45,
      stompDmg: 20, mortarDmg: 24, mortarRadius: 4, laserDmg: 26
    }
  },

  UPGRADES: [
    { id: 'hp',     name: 'FIELD MEDIC',    desc: '+25% maximum health' },
    { id: 'fire',   name: 'HAIR TRIGGER',   desc: '+20% fire rate on all weapons' },
    { id: 'reload', name: 'SPEED LOADER',   desc: 'Reload 25% faster' },
    { id: 'plate',  name: 'PLATE CARRIER',  desc: 'Carry +1 armor plate (and receive one now)' },
    { id: 'mag',    name: 'EXTENDED MAGS',  desc: '+30% magazine size' },
    { id: 'stam',   name: 'SECOND WIND',    desc: '+50% stamina recovery' }
  ],

  /* ----------------------------------------------------------
     LEVELS
     spawns: [type, x, z, opts]   opts.trig = player z that wakes the spawn (default z + 46)
                                  opts.alt  = [x, z] second perch for snipers
     Each level: 3 combat zones -> checkpoint after each -> boss arena.
     ---------------------------------------------------------- */
  LEVELS: [
    {
      sub: 'LEVEL 1', name: 'GREEN HELL', seed: 11, len: 240, boss: 'brute', barrier: 'vines',
      story: 'Dawn. The chopper is gone and the outpost is three klicks north. A warlord they call THE BRUTE holds the first ridge. Push through the patrols and put him down.',
      pal: {
        skyTop: 0x4f9fe0, fog: 0xc4e6b4, fogNear: 30, fogFar: 125,
        ground: [0x4f8a3a, 0x5d9a40, 0x457a34], path: 0xa08656, arena: 0x8f8a62,
        sun: 0xfff0c8, sunI: 0.78, hemiSky: 0xd8f2ff, hemiGround: 0x4a6a30, hemiI: 0.6, sunDir: [0.55, 1, 0.4],
        leaf: [0x2f8f3a, 0x3fa544, 0x57b84a, 0x2a7a3c], trunk: 0x6b4a2c, rock: 0x8d9088, wall: 0x7a5a36, hedge: 0x1f5a2a
      },
      zones: [
        { z0: -14, z1: -80, cover: 7, spawns: [
          ['rifleman', -6, -42], ['rifleman', 7, -56], ['rifleman', 0, -74],
          ['runner', -13, -62, { trig: -34 }], ['runner', -11, -65, { trig: -34 }], ['runner', 13, -68, { trig: -34 }]
        ] },
        { z0: -96, z1: -160, cover: 8, spawns: [
          ['rifleman', -8, -110], ['rifleman', 8, -120], ['rifleman', 2, -144],
          ['sniper', 12, -152, { alt: [-12, -158] }],
          ['runner', 13, -128, { trig: -102 }], ['runner', 11, -131, { trig: -102 }],
          ['runner', -13, -134, { trig: -102 }], ['runner', -11, -137, { trig: -102 }]
        ] },
        { z0: -176, z1: -232, cover: 8, spawns: [
          ['rifleman', -7, -190], ['rifleman', 6, -198], ['rifleman', -3, -216], ['rifleman', 9, -226],
          ['sniper', -12, -208, { alt: [12, -214] }], ['sniper', 13, -231, { alt: [-13, -226] }],
          ['runner', -12, -202, { trig: -178 }], ['runner', 12, -205, { trig: -178 }],
          ['runner', -10, -222, { trig: -198 }], ['runner', 11, -225, { trig: -198 }]
        ] }
      ],
      crates: [[5, -30], [-6, -100], [6, -172], [-5, -238]],
      pickups: [['ammo', -4, -84], ['health', 4, -164], ['ammo', 3, -236], ['armor', -9, -146]]
    },
    {
      sub: 'LEVEL 2', name: 'DROWNED RUINS', seed: 23, len: 240, boss: 'phantom', barrier: 'fog',
      story: 'Dusk. Mist rolls off the river and something moves in the old temple that you cannot quite see. Mercenaries have dug in with grenades and drones. Cross the bridge. Find THE PHANTOM.',
      river: { z0: -122, z1: -108 }, arenaWater: true,
      pal: {
        skyTop: 0x24465c, fog: 0x7ea8a2, fogNear: 16, fogFar: 92,
        ground: [0x2f5a48, 0x376653, 0x2a5044], path: 0x6a7460, arena: 0x5e6f6a,
        sun: 0xffc890, sunI: 0.7, hemiSky: 0xa8dce0, hemiGround: 0x24443a, hemiI: 0.78, sunDir: [-0.7, 0.55, 0.3],
        leaf: [0x1f6b55, 0x2a7a5f, 0x1b5c50, 0x3a8a6a], trunk: 0x4a3a2c, rock: 0x7c8a8a, wall: 0x6f7f7c, hedge: 0x163f36
      },
      zones: [
        { z0: -14, z1: -80, cover: 8, spawns: [
          ['rifleman', -6, -40], ['rifleman', 6, -52], ['rifleman', -2, -72],
          ['grenadier', 8, -66], ['grenadier', -9, -78],
          ['runner', 13, -58, { trig: -30 }], ['runner', -13, -61, { trig: -30 }], ['runner', 12, -64, { trig: -30 }]
        ] },
        { z0: -92, z1: -160, cover: 8, spawns: [
          ['rifleman', -7, -98], ['rifleman', 7, -134],
          ['drone', -6, -112, { trig: -84 }], ['drone', 6, -116, { trig: -84 }], ['drone', 0, -150],
          ['sniper', 11, -132, { alt: [-11, -140] }],
          ['grenadier', -8, -138], ['grenadier', 5, -154]
        ] },
        { z0: -176, z1: -232, cover: 9, spawns: [
          ['rifleman', -6, -188], ['rifleman', 7, -200], ['rifleman', 0, -222],
          ['grenadier', -10, -210], ['grenadier', 9, -228],
          ['drone', -8, -196, { trig: -170 }], ['drone', 8, -214],
          ['sniper', -12, -226, { alt: [12, -220] }],
          ['runner', 13, -196, { trig: -176 }], ['runner', -13, -199, { trig: -176 }],
          ['runner', 12, -218, { trig: -196 }], ['runner', -12, -221, { trig: -196 }]
        ] }
      ],
      crates: [[-5, -26], [6, -90], [-6, -170], [5, -238]],
      pickups: [['ammo', 4, -84], ['health', -4, -128], ['ammo', -3, -166], ['armor', 9, -204], ['health', 3, -240]]
    },
    {
      sub: 'LEVEL 3', name: 'THE OUTPOST', seed: 37, len: 240, boss: 'commander', barrier: 'gate',
      story: 'Night. Torches, searchlights and every soldier they have left stand between you and the gate. Inside the courtyard THE COMMANDER is warming up a four-legged walker. End this.',
      torches: true, searchlights: true,
      pal: {
        skyTop: 0x0b0812, fog: 0x40190e, fogNear: 14, fogFar: 96,
        ground: [0x3c3024, 0x473626, 0x33291f], path: 0x5c4630, arena: 0x524840,
        sun: 0xff9a60, sunI: 0.66, hemiSky: 0xe0a888, hemiGround: 0x2a1810, hemiI: 0.82, enemyGlow: 0x2a1c14, sunDir: [0.4, 0.8, -0.5],
        leaf: [0x34451f, 0x3f4f22, 0x4a3318, 0x2c3a1c], trunk: 0x3a2618, rock: 0x6a5a50, wall: 0x6b6660, hedge: 0x1c1a10
      },
      zones: [
        { z0: -14, z1: -80, cover: 9, spawns: [
          ['rifleman', -6, -38], ['rifleman', 6, -50], ['rifleman', 0, -74],
          ['shield', -3, -58], ['shield', 5, -70],
          ['grenadier', -9, -76],
          ['runner', 13, -52, { trig: -28 }], ['runner', -13, -55, { trig: -28 }], ['runner', 12, -58, { trig: -28 }]
        ] },
        { z0: -92, z1: -160, cover: 9, spawns: [
          ['rifleman', -7, -104], ['rifleman', 7, -118], ['rifleman', -2, -150],
          ['shield', 2, -112], ['shield', -5, -142],
          ['sniper', 12, -126, { alt: [-12, -132], trig: -92 }], ['sniper', -12, -156, { alt: [12, -152], trig: -118 }],
          ['drone', -6, -108, { trig: -88 }], ['drone', 6, -122], ['drone', 0, -146],
          ['grenadier', 9, -136], ['grenadier', -9, -158]
        ] },
        { z0: -176, z1: -232, cover: 10, spawns: [
          ['rifleman', -6, -186], ['rifleman', 7, -196], ['rifleman', 0, -224],
          ['shield', -2, -192], ['shield', 4, -208], ['shield', -6, -226],
          ['grenadier', 10, -212], ['grenadier', -10, -230],
          ['drone', -8, -194, { trig: -172 }], ['drone', 8, -206], ['drone', 0, -220],
          ['sniper', 13, -229, { alt: [-13, -222], trig: -190 }],
          ['runner', 13, -198, { trig: -178 }], ['runner', -13, -201, { trig: -178 }],
          ['runner', 12, -216, { trig: -196 }], ['runner', -12, -219, { trig: -196 }]
        ] }
      ],
      crates: [[5, -24], [-6, -88], [6, -168], [-5, -238], [5, -240]],
      pickups: [['ammo', -4, -84], ['health', 4, -90], ['armor', -9, -120], ['ammo', 8, -128], ['ammo', 3, -166], ['health', -3, -172], ['ammo', -8, -204], ['armor', 8, -236]]
    }
  ]
};
})();
