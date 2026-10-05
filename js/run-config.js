// Vault Run and Party Chaos tuning. Forces are Matter units and time is simulation seconds.
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
    cap: 28.5, // 3 above the rhythm-push cap
  },
  "wrate-issue": {
    name: "Wrate Issue",
    description:
      "A warning counts down from takeoff. At 0.65 seconds, a brief forward wobble begins. Counter with LEFT / A.",
    warning: 0.65,
    duration: 0.2,
    torque: 0.24,
  },
  // Extra conditions for Party Tournament Chaos rounds. They are never part of
  // the seeded shuffle used by Vault Run lessons (see CONDITION_IDS).
  "low-gravity": {
    name: "Low-G Loading Dock",
    description:
      "The loading dock's anti-gravity promo is switched on. Gravity drops by 40%: more hang time, room for a Double Flip, later landings.",
    gravity: 0.6,
  },
  tailwind: {
    name: "Leaf-Blower Tailwind",
    description:
      "A sponsored industrial leaf blower pushes FORWARD while airborne. Longer jumps, faster landings.",
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
    shortName: "Reinforced Hubs", effect: "+12% landing stability",
    limit: 2,
    description:
      "+12% landing stability per stack. Angle and impact still matter.",
    stability: 0.12,
  },
  "wider-launch-window": {
    name: "Wider Launch Window",
    shortName: "Launch Guide", effect: "Wider takeoff sweet spot",
    limit: 2,
    description:
      "Perfect and Good takeoff windows expand 10 pixels on each side per stack.",
    pixels: 10,
  },
  "improved-air-control": {
    name: "Improved Air Control",
    shortName: "Air Fin", effect: "+12% steering power",
    limit: 2,
    description:
      "+12% manual air rotation per stack; the original spin-speed cap remains.",
    rotation: 0.12,
  },
  "wider-brace-window": {
    name: "Wider Brace Window",
    shortName: "Padded Bumpers", effect: "Brace a little earlier",
    limit: 2,
    description:
      "Perfect Brace accepts 40 ms earlier input and Good Brace 60 ms earlier input per stack. Late input gets no help.",
    perfectSeconds: 0.04,
    goodSeconds: 0.06,
  },
  "style-multiplier": {
    name: "Style Multiplier",
    shortName: "Star Power", effect: "+15% style factor",
    limit: 2,
    description:
      "+15% character style factor per stack. The results table includes the increase.",
    style: 0.15,
  },
  "emergency-stabilizer": {
    name: "Emergency Stabilizer",
    shortName: "Stabilizer", effect: "One recovery assist",
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
    shortName: "Power Drive", effect: "+15% Perfect push power",
    limit: 2,
    description:
      "+15% speed from Perfect rhythm pushes per stack. Good, Miss, and the first-push kick are unchanged.",
    speed: 0.15,
  },
  "impact-harness": {
    name: "Impact Harness",
    shortName: "Safety Harness", effect: "Hold on through harder hits",
    limit: 1,
    description:
      "50% greater impact-speed tolerance before rider detachment. A crash still counts as a crash.",
    tolerance: 1.5,
  },
  "rocket-booster": {
    name: "Rocket Booster", shortName: "Rocket Booster",
    effect: "One mid-air boost",
    limit: 1,
    description: "Once per jump: tap Space / Up or BOOST in the air for 0.18 s of forward-and-up thrust. Adds 1.4 forward and 1.8 upward speed; no auto-leveling. Unavailable after a crash or landing.",
    duration: 0.18, forward: 1.4, lift: 1.8,
  },
  "spring-launch": {
    name: "Spring Launch", shortName: "Spring Launch",
    effect: "Perfect takeoff: extra height",
    limit: 2,
    description: "Adds 0.65 upward speed per stack on a Perfect takeoff only. No extra forward speed; Good and missed takeoffs are unchanged.",
    lift: 0.65,
  },
  focus: {
    name: "Focus", shortName: "Focus",
    effect: "5 Perfects: slow takeoff",
    limit: 1,
    description: "After 5 consecutive Perfect pushes, time runs at 50% in the last 300 px before the takeoff zone and through the zone. Good / Miss resets it; committing takeoff restores full speed. Physics and timing windows stay the same.",
    pushes: 5, approachPixels: 300, timeScale: 0.5,
  },
  "air-brake": {
    name: "Air Brake", shortName: "Air Brake",
    effect: "Early Down tap: fly shorter",
    limit: 1,
    description: "Once per jump: tap Down / S or BRACE with more than 0.6 s to landing to trim forward speed by 10% over 0.18 s. Tap again to brace. Within 0.6 s of contact, Down always braces directly.",
    duration: 0.18, reduction: 0.10, minimumETA: 0.6,
  },
  "bigger-wheels": {
    name: "Bigger Wheels", shortName: "Bigger Wheels",
    effect: "+8% landing stability",
    limit: 2,
    description: "+8% landing stability per stack, cushioning rough and scrappy contacts. Stacks add to Reinforced Wheels; wheel collision shapes and grip stay unchanged.",
    stability: 0.08,
  },
});
export const OBJECTIVES = freeze({
  "distance-35": {
    type: "distance",
    name: "Going the Distance",
    description: "Reach at least 50.0 metres during a finished jump.",
    metres: 50, // the ID predates the longer run-up; saves keep using it
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
    description: "First ground contact must be in the marked 49–64 metre zone.",
    minimum: 49,
    maximum: 64,
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
// Seeded Vault Run plans shuffle only these five IDs. Keeping the list fixed
// means existing saved runs never reshuffle when a condition is added.
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
