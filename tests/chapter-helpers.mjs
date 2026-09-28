import { normalAngle } from "../js/scoring.js";
import { timedInputs } from "./skill-helpers.mjs";

// A deterministic practice policy: only discrete left/right keys, meter-timed
// pushes and one brace. Never moves a body, changes a score, or awards a trick.
// Each character waits a little before a flip so it recovers near contact.
export function chapterControls(world, level, { flip, delay, target } = {}) {
  const character = world.character.id,
    condition = world.runEffects?.conditionId;
  const delays = {
    jake: {
      standard: 0.2,
      "boost-strip": 0.2,
      "icy-ramp": 0.4,
      "wrate-issue": 0.35,
      "heavy-cart": 0.4,
    },
    brandon: {
      standard: 0.35,
      "boost-strip": 0.4,
      "icy-ramp": 0.45,
      "wrate-issue": 0.45,
      "heavy-cart": 0.4,
    },
    owen: {
      standard: 0.4,
      "boost-strip": 0.5,
      "icy-ramp": 0.45,
      "wrate-issue": 0.6,
      "heavy-cart": 0.4,
    },
  };
  // A short back-tap straight after takeoff jolts the grip loose (No Hands).
  const taps = { jake: 0, brandon: 0.1, owen: 0.25 };
  flip ??=
    level.id === "showboating-101" ||
    level.id === "commit-to-the-bit" ||
    Boolean(level.stages);
  delay ??=
    delays[character][condition || "standard"] ?? delays[character].standard;
  const airTime = world.elapsed - world.launchTime;
  const tapping = flip && world.launched && airTime < taps[character];
  const spinning =
    flip && airTime >= delay && world.cart.angle - world.launchAngle < Math.PI * 2;
  const value = tapping
    ? -1
    : spinning
      ? 1
      : -normalAngle(world.cart.angle) * 2 - world.cart.angularVelocity * 28;
  const rotate = !world.landed
    ? Math.abs(value) < 0.1
      ? 0
      : Math.sign(value)
    : 0;
  return timedInputs(
    world,
    rotate,
    true,
    target || (level.id === "cross-examination" ? "Good" : "Perfect"),
  );
}

export function driveChapter(world, level, options) {
  // Read the cues at 60 Hz; the unchanged Matter engine steps twice at 120 Hz.
  for (let frame = 0; frame < 1250 && !world.finished; frame++) {
    const controls = chapterControls(world, level, options);
    world.step(controls);
    world.step({ ...controls, pushes: 0, brace: false });
  }
  return world;
}
