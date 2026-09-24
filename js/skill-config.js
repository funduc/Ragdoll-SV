// All skill tuning. Seconds use simulation time; x values are world pixels.
// Speed increments use Matter's standard pixels per 1/60-second frame.
// Character acceleration scales pushes; there is no random acceleration.
export const SKILL_CONFIG = Object.freeze({
  rhythm: Object.freeze({
    period: 0.72,
    perfectHalfWidth: 0.12, // normalized meter distance from the centre (0.5)
    goodHalfWidth: 0.3,
    minimumInterval: 0.24, // faster presses count as Miss, not extra good pushes
    starterSpeed: 4.5, // one explicit first-push kick helps new players get moving
    perfectSpeed: 3.8,
    goodSpeed: 2.6,
    missSpeed: 1.2,
    spamSpeed: 0.08, // awarded at most once per minimumInterval
    maximumSpeed: 15.5,
    accelerationReference: 0.0029,
    missWobble: 0.014, // angular-velocity impulse, alternating deterministically
    maximumWobble: 0.045,
    perfectDamping: 0.65,
    perfectFollowThrough: 0.58, // finite propulsion after the tap, never a held key
    goodFollowThrough: 0.46,
    missFollowThrough: 0.22,
    followThroughScale: 0.95, // multiplier on the character's existing acceleration
  }),
  takeoff: Object.freeze({
    armedX: 860, // first push after this line commits the one launch opportunity
    goodStart: 940,
    perfectStart: 980,
    perfectEnd: 1060,
    goodEnd: 1090,
    meterOvershoot: 40, // show the Late region beyond the Good zone
    baseSpeed: 1.5,
    perfectBonus: 6.0,
    goodBonus: 3.0,
    maximumSpeed: 29,
    perfectDamping: 0.25,
    goodDamping: 0.65,
    lateRotation: 0.035, // clockwise / forward; also applies if the zone is missed
    followThrough: 0.5, // finish the committed push up the last part of the ramp
  }),
  brace: Object.freeze({
    perfectMin: 0.09,
    perfectMax: 0.22,
    goodMin: 0.035,
    goodMax: 0.4,
    perfectTolerance: 1.4, // vertical-impact and rider-detachment speed tolerance
    goodTolerance: 1.18,
    earlyControlScale: 0.38, // once a held brace has aged past goodMax
    meterSeconds: 0.85,
  }),
  feedbackSeconds: 0.85,
  tutorialSweepSeconds: 2, // slower position sweeps for takeoff/brace practice
  maximumQueuedPushes: 4,
});

export function rhythmPosition(time) {
  return (Math.max(0, time) / SKILL_CONFIG.rhythm.period) % 1;
}
export function pushGrade(position, spam = false) {
  const distance = Math.abs(position - 0.5),
    c = SKILL_CONFIG.rhythm;
  return spam
    ? "Miss"
    : distance <= c.perfectHalfWidth
      ? "Perfect"
      : distance <= c.goodHalfWidth
        ? "Good"
        : "Miss";
}
export function takeoffGrade(x, c = SKILL_CONFIG.takeoff) {
  return x < c.goodStart
    ? "Early"
    : x > c.goodEnd
      ? "Late"
      : x >= c.perfectStart && x <= c.perfectEnd
        ? "Perfect"
        : "Good";
}
export function braceGrade(lead, c = SKILL_CONFIG.brace) {
  if (lead === null) return "Unbraced";
  if (lead < c.goodMin) return "Late";
  if (lead > c.goodMax) return "Early";
  return lead >= c.perfectMin && lead <= c.perfectMax
    ? "Perfect Brace"
    : "Good Brace";
}
export function braceTolerance(grade) {
  return grade === "Perfect Brace"
    ? SKILL_CONFIG.brace.perfectTolerance
    : grade === "Good Brace"
      ? SKILL_CONFIG.brace.goodTolerance
      : 1;
}
