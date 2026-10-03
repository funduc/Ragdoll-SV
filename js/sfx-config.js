// Paths are relative to assets/audio/sfx/. Unlisted events keep their synth.
// rarity: N = 1 in N; volume: 0..2 trim; duck: big-moment music/caption priority.
// channel groups ladder/flip/tier variants so the latest replaces the previous clip.
export const SFX_CONFIG = {
  "syncStep1": {
    "files": [
      "bam1.mp3"
    ],
    "volume": 1,
    "channel": "syncLadder"
  },
  "syncStep2": {
    "files": [
      "bam2.mp3"
    ],
    "volume": 1,
    "channel": "syncLadder"
  },
  "syncStep3": {
    "files": [
      "bam3.mp3"
    ],
    "volume": 1,
    "channel": "syncLadder"
  },
  "syncStep4": {
    "files": [
      "bam4.mp3"
    ],
    "volume": 1,
    "channel": "syncLadder"
  },
  "syncStep5": {
    "files": [
      "bam5.mp3"
    ],
    "volume": 1,
    "channel": "syncLadder"
  },
  "syncStep6": {
    "files": [
      "bam6.mp3"
    ],
    "volume": 1,
    "channel": "syncLadder"
  },
  "syncMiss": {
    "files": [
      "sync-miss.mp3"
    ],
    "volume": 1,
    "channel": "syncLadder"
  },
  "syncCombo3": {
    "files": [
      "combo3.mp3"
    ],
    "volume": 1,
    "duck": true,
    "channel": "landingCombo"
  },
  "syncCombo5": {
    "files": [
      "combo5.mp3"
    ],
    "volume": 1,
    "duck": true,
    "channel": "landingCombo"
  },
  "flip1": {
    "files": [
      "flip1.mp3"
    ],
    "volume": 1,
    "channel": "flip"
  },
  "flip2": {
    "files": [
      "flip2.mp3"
    ],
    "volume": 1,
    "channel": "flip"
  },
  "flip3": {
    "files": [
      "flip3.mp3"
    ],
    "volume": 1,
    "channel": "flip"
  },
  "flip4": {
    "files": [
      "flip4.mp3"
    ],
    "volume": 1,
    "channel": "flip"
  },
  "trickCombo": {
    "files": [
      "trick-combo.mp3"
    ],
    "volume": 1,
    "duck": true,
    "channel": "landingCombo"
  },
  "landClean": {
    "files": [
      "land-clean.mp3"
    ],
    "volume": 1,
    "channel": "landing"
  },
  "landPerfect": {
    "files": [
      "land-perfect.mp3"
    ],
    "volume": 1,
    "channel": "landing"
  },
  "crashLight": {
    "files": [
      "crash-light.mp3"
    ],
    "volume": 1,
    "duck": true,
    "channel": "crash"
  },
  "crashMedium": {
    "files": [
      "crash-medium.mp3"
    ],
    "volume": 1,
    "duck": true,
    "channel": "crash"
  },
  "crashHeavy": {
    "files": [
      "crash-heavy.mp3",
      "crash-big1.mp3",
      "crash-big2.mp3"
    ],
    "volume": 1,
    "duck": true,
    "channel": "crash"
  },
  "crashMax": {
    "files": [
      "carnage-max.mp3"
    ],
    "volume": 1,
    "duck": true,
    "channel": "crash"
  },
  "carnageExplosion": {
    "files": [
      "carnage-explosion.mp3"
    ],
    "volume": 1,
    "rarity": 15,
    "duck": true
  },
  "riderImpact": {
    "files": [
      "rider-impact.mp3"
    ],
    "volume": 1
  },
  "headImpact": {
    "files": [
      "headshot.mp3"
    ],
    "volume": 1
  },
  "personalBest": {
    "files": [
      "woohoo.mp3"
    ],
    "volume": 1
  },
  "crowdCheer": {
    "files": [
      "crowd-cheer.mp3"
    ],
    "volume": 1
  },
  "finalResults": {
    "files": [
      "party-winner.mp3"
    ],
    "volume": 1,
    "duck": true
  },
  "achievement": {
    "files": [
      "achievement.mp3"
    ],
    "volume": 1
  },
  "upgradeChoice": {
    "files": [
      "upgrade.mp3"
    ],
    "volume": 1
  },
  "menuConfirm": {
    "files": [
      "menu-confirm.mp3"
    ],
    "volume": 1
  },
  "characterSelect": {
    "files": [
      "character-select.mp3"
    ],
    "volume": 1
  }
};
export const SFX_RULES = Object.freeze({ duckSeconds: 1.2, musicDuck: 0.35, maxClipSeconds: 15, heavyParts: 3, allParts: 4, cheerMetres: 70 });
