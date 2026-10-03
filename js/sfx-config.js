// Files are relative to assets/audio/sfx/. Empty lists retain the synth or silence.
// Example: crash: { files: ["crash-a.mp3", "crash-b.ogg"], rarity: 20, volume: 0.8 }
// rarity: 20 means a 1-in-20 chance; volume: 0..2 is a manual loudness trim.
export const SFX_CONFIG = {
  crash: { files: [], volume: 1 },
  headImpact: { files: [], volume: 1 },
  maxCarnage: { files: [], volume: 1 },
  partLoss: { files: [], volume: 1 },
  perfectPush: { files: [], volume: 1 },
  perfectTakeoff: { files: [], volume: 1 },
  syncReady: { files: [], volume: 1 },
  syncCountIn: { files: [], volume: 1 },
  doubleFlip: { files: [], volume: 1 },
  comboLanding: { files: [], volume: 1 },
  bigJump: { files: [], volume: 1 },
  onFireStreak: { files: [], volume: 1 },
  achievement: { files: [], volume: 1 },
  medal: { files: [], volume: 1 },
  upgradeScreen: { files: [], volume: 1 },
  chaosRoll: { files: [], volume: 1 },
  elimination: { files: [], volume: 1 },
  finalResults: { files: [], volume: 1 },
  wrateWarning: { files: [], volume: 1 },
};
export const SFX_RULES = Object.freeze({ duckSeconds: 1.2, musicDuck: 0.35, maxClipSeconds: 15, maxCarnage: 1000, bigJumpMetres: 55, perfectStreak: 3 });
