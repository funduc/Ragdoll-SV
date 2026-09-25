// SANTOR SYNC tuning. Seconds use the independent, paused RAF beat clock.
// Height is a ballistic-height factor; takeoff vertical speed uses its square root.
const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const SYNC_CONFIG = freeze({
  chance: 0.11,
  pity: 6,
  force: false, // Party is always excluded at the lifecycle boundary.
  firstBeat: 1.0,
  spacing: 0.48,
  notes: 6,
  preview: 1.0,
  perfectWindow: 0.075,
  goodWindow: 0.15,
  goodCredit: 0.7,
  resultSeconds: 0.7,
  maximumFrameGap: 0.25,
  musicDuck: 0.72,
  maximumSpeed: 35,
  maximumUpwardSpeed: 20,
  maximumStyle: 1.35,
  maximumSpin: 0.16,
  maximumExtraMisses: 1000,
  beatFlashSeconds: 0.12,
  grades: [
    {
      name: "PERFECT SYNC",
      minimum: 95,
      speed: 1.12,
      height: 1.25,
      style: 1.25,
    },
    { name: "GREAT", minimum: 80, speed: 1.1, height: 1.12, style: 1.12 },
    { name: "GOOD", minimum: 60, speed: 1.05, height: 1.05, style: 1 },
    { name: "MISS", minimum: 0, speed: 1, height: 1, style: 1 },
  ],
  characters: {
    jake: {
      windows: 1.15,
      spacing: 1.04,
      damping: 0.6,
      speedExtra: 0,
      styleExtra: 0,
      styleCap: 1.18,
      kick: 0,
      pattern: [0, 1, 2, 3, 0, 3],
    },
    brandon: {
      windows: 1,
      spacing: 1,
      damping: 0.85,
      speedExtra: 0,
      styleExtra: 0.08,
      styleCap: 1.35,
      kick: 0,
      pattern: [0, 2, 1, 3, 1, 0],
    },
    owen: {
      windows: 1,
      spacing: 0.88,
      damping: 0.95,
      speedExtra: 0.03,
      styleExtra: 0,
      styleCap: 1.25,
      kick: 0.008,
      pattern: [0, 1, 2, 3, 0, 3],
    },
  },
  wrateWarningChance: 0.25,
  lines: {
    intro:
      "The Vault has detected rhythm. This was not in the risk assessment.",
    MISS: "No rhythm whatsoever. The attempt remains legally valid.",
    GOOD: "They are weaponizing the beat!",
    GREAT: "They are weaponizing the beat!",
    "PERFECT SYNC": "Perfect synchronization! Physics has lost jurisdiction.",
    wrate: "Someone check whether Owen wired this correctly.",
  },
});
export const SYNC_KEYS = Object.freeze({
  ArrowLeft: 0,
  KeyA: 0,
  ArrowDown: 1,
  KeyS: 1,
  ArrowUp: 2,
  KeyW: 2,
  ArrowRight: 3,
  KeyD: 3,
});
export function syncResult(perfect = 0, good = 0, extra = 0) {
  const count = (n) =>
    Number.isSafeInteger(n)
      ? Math.max(0, Math.min(SYNC_CONFIG.maximumExtraMisses, n))
      : 0;
  perfect = Math.min(SYNC_CONFIG.notes, count(perfect));
  good = Math.min(SYNC_CONFIG.notes - perfect, count(good));
  extra = count(extra);
  const accuracy =
    Math.round(
      (10000 * (perfect + good * SYNC_CONFIG.goodCredit)) /
        (SYNC_CONFIG.notes + extra),
    ) / 100;
  return Object.freeze({
    perfect,
    good,
    miss: SYNC_CONFIG.notes - perfect - good,
    extra,
    accuracy,
    grade: SYNC_CONFIG.grades.find((g) => accuracy >= g.minimum).name,
  });
}
export function syncReward(result, characterId) {
  const normalized = result
    ? syncResult(result.perfect, result.good, result.extra)
    : null;
  const base =
    SYNC_CONFIG.grades.find((g) => g.name === normalized?.grade) ||
    SYNC_CONFIG.grades.at(-1);
  const c = SYNC_CONFIG.characters[characterId] || SYNC_CONFIG.characters.jake;
  const boosted = base.speed > 1;
  return Object.freeze({
    speed: base.speed + (boosted ? c.speedExtra : 0),
    height: base.height,
    style: Math.min(
      SYNC_CONFIG.maximumStyle,
      c.styleCap,
      base.style + (base.style > 1 ? c.styleExtra : 0),
    ),
    damping: boosted ? c.damping : 1,
    kick: boosted ? c.kick : 0,
  });
}
