// Trick tuning is independent of the push/takeoff/brace configuration.
// Angles are radians; rates are radians/second; times are simulation seconds.
// Strain is the smaller separation of the two hand-to-cart constraint anchors,
// in world pixels. The stable solver leaves small, measurable residual stretch.
const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const TRICK_CONFIG = freeze({
  rotation: {
    fullTurn: Math.PI * 2,
    epsilon: 1e-7,
    directionThreshold: 0.02,
    reversalTolerance: 0.18, // a real reversal starts a new directional run
    maximumStep: 0.8, // discontinuities are rejected, never credited as spins
  },
  noHands: {
    strain: 0.1,
    strainTime: 0.07,
    recovered: 0.035,
    recoveryTime: 0.08,
    cooldown: 0.25,
  },
  appeal: {
    extremeAngle: 2.0,
    extremeTime: 0.06,
    recoveryAngle: 0.4,
    recoverySpeed: 2.4,
    recoveryTime: 0.05,
    recoveryWindow: 0.75,
    landingWindow: 0.35,
  },
  cleanFlight: {
    minimumTime: 1.15,
    minimumDistance: 1200,
    angle: 0.45,
    speed: 1.6,
    controlledFraction: 0.8,
    maximumTravel: 1.3,
  },
  combo: {
    increment: 0.25,
    maximum: 2.5,
    strain: 0.18,
    spinSpeed: 9.0,
    grace: 0.18,
  },
  repeatFactors: [1, 0.2, 0.05, 0], // attempt-wide: a broken combo never refreshes credit
  maximumOccurrences: 24,
  maximumStylePoints: 5000,
  maximumCharacterMultiplier: 3, // defensive ceiling for edited character data
  landingFactors: {
    Clean: 1.6,
    Scrappy: 1.25,
    Rough: 1.0,
    Crash: 0.45,
    "No landing": 0.45,
  },
  tricks: {
    front: { name: "Front Flip", points: 150 },
    back: { name: "Back Flip", points: 150 },
    double: { name: "Double Flip", points: 180 }, // bonus per non-overlapping pair; not a third rotation
    noHands: { name: "No Hands", points: 90 },
    appeal: { name: "Last-Second Appeal", points: 120 },
    clean: { name: "Clean Flight", points: 75 },
  },
  characters: {
    jake: { comboGrace: 0.4 }, // existing slower rotation remains unchanged
    brandon: { varietyScale: 1.6 }, // raises the unique-trick combo increment
    owen: {
      comboGrace: 0.12,
      comboStrain: 0.16,
      speedStart: 14,
      speedFull: 24,
      rotationBonus: 0.32,
    },
  },
  popup: { seconds: 1.05, maximumQueue: 4 },
});

export function trickProfile(character) {
  return TRICK_CONFIG.characters[character?.id] || {};
}
// Owen only gains torque while building a spin at high horizontal speed.
// Counter-steering, run-up forces and the existing angular-speed cap are unchanged.
export function trickRotationScale(world, rotate) {
  const p = trickProfile(world.character);
  if (
    !world.launched ||
    world.landed ||
    !p.rotationBonus ||
    rotate * world.cart.angularVelocity < 0
  )
    return 1;
  const speed = Math.abs(world.M.Body.getVelocity(world.cart).x);
  return (
    1 +
    p.rotationBonus *
      Math.max(
        0,
        Math.min(1, (speed - p.speedStart) / (p.speedFull - p.speedStart)),
      )
  );
}
