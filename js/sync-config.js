// Sync Moments use a real-time beat clock and unchanged fixed physics steps.
const freeze = (value) => {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
export const SYNC_CONFIG = freeze({
  minimumPerfectPushes: 5,
  timeScale: 0.02,
  recoverySeconds: 0.8,
  safetyMargin: 0.12,
  apexLead: 0.28,
  maximumSpin: 0.025, // Matter angular velocity; steering never disqualifies a jump.
  missedSeconds: 2,
  // All presentation timings are real seconds; flight uses the configured timeScale.
  easeInSeconds: 0.5,
  easeInPower: 5,
  introSeconds: 1,
  countInSeconds: 1,
  countInTicks: 2,
  firstBeat: 0.2, // after the count-in
  spacing: 0.65,
  easeOutSeconds: 0.2,
  flashSeconds: 0.3,
  laneSlideSeconds: 0.4,
  notes: 3,
  preview: 1.2,
  perfectWindow: 0.085,
  goodWindow: 0.15,
  firstPerfectWindow: 0.14,
  firstGoodWindow: 0.24,
  goodCredit: 0.7,
  resultSeconds: 0.5,
  maximumFrameGap: 0.25,
  musicDuck: 0.72,
  maximumStyle: 180,
  maximumExtraMisses: 1000,
  beatFlashSeconds: 0.12,
  celebrationSeconds: 0.9,
  grades: [
    { name: "PERFECT SYNC", minimum: 99.99 },
    { name: "GREAT", minimum: 80 },
    { name: "GOOD", minimum: 60 },
    { name: "MISS", minimum: 0 },
  ],
  characters: {
    jake: { windows: 1.15, spacing: 1.04, patterns: [[0,1,2,3,0], [3,2,1,0,3], [0,2,3,1,0], [1,0,3,2,1]] },
    brandon: { windows: 1, spacing: 1, patterns: [[0,2,1,3,1], [2,0,3,1,2], [1,3,0,2,3], [3,1,2,0,1]] },
    owen: { windows: 1, spacing: 0.88, patterns: [[0,3,1,2,3], [3,0,2,1,0], [2,1,3,0,2], [1,2,0,3,1]] },
  },
  lines: {
    intro: "FIVE PERFECT PUSHES. PERFECT TAKEOFF. THE VAULT HAS DETECTED A MOMENT!",
    MISS: "No obligation to dance. Back to the landing.",
    GOOD: "They are weaponizing the beat!",
    GREAT: "BAM! THE CART HAS FOUND ITS RHYTHM!",
    "PERFECT SYNC": "PERFECT SYNC! EVEN THE AIR HAS ASKED FOR AN ENCORE!",
  },
});
export const SYNC_KEYS = Object.freeze({ ArrowLeft: 0, KeyA: 0, ArrowDown: 1, KeyS: 1, ArrowUp: 2, KeyW: 2, ArrowRight: 3, KeyD: 3 });
export function syncResult(perfect = 0, good = 0, extra = 0, notes = SYNC_CONFIG.notes) {
  const count = (n) => Number.isSafeInteger(n) ? Math.max(0, Math.min(SYNC_CONFIG.maximumExtraMisses, n)) : 0;
  notes = Math.max(3, Math.min(5, count(notes) || 3));
  perfect = Math.min(notes, count(perfect)); good = Math.min(notes - perfect, count(good)); extra = count(extra);
  const accuracy = Math.round(10000 * (perfect + good * SYNC_CONFIG.goodCredit) / (notes + extra)) / 100;
  return Object.freeze({ notes, perfect, good, miss: notes - perfect - good, extra, accuracy,
    grade: SYNC_CONFIG.grades.find((g) => accuracy >= g.minimum).name });
}
export function syncReward(result) {
  const normalized = result ? syncResult(result.perfect, result.good, result.extra, result.notes) : null;
  return Object.freeze({ points: Math.round(SYNC_CONFIG.maximumStyle * (normalized?.accuracy || 0) / 100) });
}
