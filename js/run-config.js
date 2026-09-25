// Campaign-only tuning. Forces are Matter units and time is simulation seconds.
// Conditions never select forces randomly during an attempt.
const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const CONDITIONS = freeze({
  crosswind: {
    name: "Crosswind",
    description:
      "Steady wind pushes RIGHT while airborne. Watch the → wind indicator; counter-steer as needed.",
    force: 0.00012,
  },
  "icy-ramp": {
    name: "Icy Ramp",
    description:
      "Runway and ramp traction are reduced. The landing is slippery: expect a longer slide.",
    groundFriction: 0.12,
    rampFriction: 0.12,
    wheelFriction: 0.18,
    landingAirFriction: 0.018,
  },
  "heavy-cart": {
    name: "Heavy Cart",
    description:
      "25% heavier cart, 15% slower pushes, and 12% greater landing stability.",
    mass: 1.25,
    acceleration: 0.85,
    stability: 1.12,
  },
  "boost-strip": {
    name: "Boost Strip",
    description:
      "The blue runway strip gives one +3 speed boost. It is separate from your timed takeoff push.",
    start: 390,
    end: 490,
    speed: 3,
    cap: 18.5,
  },
  "wrate-issue": {
    name: "Wrate Issue",
    description:
      "A warning counts down from takeoff. At 0.65 seconds, a brief forward wobble begins. Counter with LEFT / A.",
    warning: 0.65,
    duration: 0.2,
    torque: 0.24,
  },
  // After Hours conditions. They are authored per level and are never part of
  // the seeded shuffle used by the original lessons (see CONDITION_IDS).
  "low-gravity": {
    name: "Low-G Loading Dock",
    description:
      "The loading dock's anti-gravity promo is switched on. Gravity drops by 40%: more hang time, room for a Double Flip, later landings.",
    gravity: 0.6,
  },
  tailwind: {
    name: "Leaf-Blower Tailwind",
    description:
      "A sponsored industrial leaf blower pushes FORWARD while airborne. Longer jumps; the Concrete+ slab is finally in range.",
    force: 0.00034,
  },
  "shifting-wind": {
    name: "Chameleon Wind",
    description:
      "In the air, a gust pushes the rider's upper body and FLIPS DIRECTION every 0.45 s. Forward gusts pitch the nose down, backward gusts pitch it up. Counter-steer each change.",
    interval: 0.45,
    torque: 0.45, // share of the manual air-control torque, like Wrate Issue
  },
});
export const UPGRADES = freeze({
  "reinforced-wheels": {
    name: "Reinforced Wheels",
    limit: 2,
    description:
      "+12% landing stability per stack. Angle and impact still matter.",
    stability: 0.12,
  },
  "wider-launch-window": {
    name: "Wider Launch Window",
    limit: 2,
    description:
      "Perfect and Good takeoff windows expand 10 pixels on each side per stack.",
    pixels: 10,
  },
  "improved-air-control": {
    name: "Improved Air Control",
    limit: 2,
    description:
      "+12% manual air rotation per stack; the original spin-speed cap remains.",
    rotation: 0.12,
  },
  "wider-brace-window": {
    name: "Wider Brace Window",
    limit: 2,
    description:
      "Perfect Brace accepts 40 ms earlier input and Good Brace 60 ms earlier input per stack. Late input gets no help.",
    perfectSeconds: 0.04,
    goodSeconds: 0.06,
  },
  "style-multiplier": {
    name: "Style Multiplier",
    limit: 2,
    description:
      "+15% character style factor per stack. The results table includes the increase.",
    style: 0.15,
  },
  "emergency-stabilizer": {
    name: "Emergency Stabilizer",
    limit: 1,
    description:
      "Once per jump, a brief recovery assist activates near landing if tilt exceeds 69°. It cannot guarantee a safe landing.",
    angle: 1.2,
    contactSeconds: 0.6,
    duration: 0.35,
    torque: 0.45,
    damping: 0.94,
  },
  "faster-perfect-pushes": {
    name: "Faster Perfect Pushes",
    limit: 2,
    description:
      "+15% speed from Perfect rhythm pushes per stack. Good, Miss, and the first-push kick are unchanged.",
    speed: 0.15,
  },
  "impact-harness": {
    name: "Impact Harness",
    limit: 1,
    description:
      "50% greater impact-speed tolerance before rider detachment. A crash still counts as a crash.",
    tolerance: 1.5,
  },
});
export const OBJECTIVES = freeze({
  "distance-35": {
    type: "distance",
    name: "Going the Distance",
    description: "Reach at least 35.0 metres during a finished jump.",
    metres: 35,
  },
  "front-flip": {
    type: "named-trick",
    name: "Forward Thinking",
    description: "Finish with a recognized Front Flip.",
    trick: "front",
  },
  "two-tricks": {
    type: "unique-tricks",
    name: "Variety Act",
    description: "Finish with at least two different recognized tricks.",
    count: 2,
  },
  "attached-landing": {
    type: "attached",
    name: "Stay Together",
    description:
      "Land and finish with the rider still attached. A crash may count.",
  },
  "perfect-brace": {
    type: "brace",
    name: "Perfect Preparation",
    description: "Complete the jump with exactly Perfect Brace.",
    grade: "Perfect Brace",
  },
  "landing-zone": {
    type: "landing-zone",
    name: "Reserved Parking",
    description: "First ground contact must be in the marked 30–45 metre zone.",
    minimum: 30,
    maximum: 45,
  },
  "style-factor": {
    type: "style-multiplier",
    name: "Style Finisher",
    description:
      "Finish with a scored trick and a final style factor above ×1.50 (character × landing).",
    multiplier: 1.5,
  },
  "no-miss": {
    type: "no-miss",
    name: "On the Beat",
    description:
      "Complete the jump with at least one rhythm push and no Missed rhythm pushes.",
  },
});
// Seeded plans for the original lessons shuffle only these five IDs. Keeping
// the list fixed means existing saved runs never reshuffle after an update.
export const CONDITION_IDS = Object.freeze([
  "crosswind",
  "icy-ramp",
  "heavy-cart",
  "boost-strip",
  "wrate-issue",
]);
export const ALL_CONDITION_IDS = Object.freeze(Object.keys(CONDITIONS));
export const UPGRADE_IDS = Object.freeze(Object.keys(UPGRADES));
export const OBJECTIVE_IDS = Object.freeze(Object.keys(OBJECTIVES));
export function normalizeUpgrades(value) {
  return Object.fromEntries(
    UPGRADE_IDS.map((id) => [
      id,
      Number.isInteger(value?.[id])
        ? Math.max(0, Math.min(UPGRADES[id].limit, value[id]))
        : 0,
    ]),
  );
}
