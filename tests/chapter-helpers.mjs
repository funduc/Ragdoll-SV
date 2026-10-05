import { normalAngle } from "../js/scoring.js";
import { timedInputs } from "./skill-helpers.mjs";

// A deterministic practice policy: only discrete left/right keys, meter-timed
// pushes and one brace. Never moves a body, changes a score, or awards a trick.
// Each character waits a little before a flip so it recovers near contact.
export function chapterControls(world, level, { flip, delay, target, tap, turns = 1 } = {}) {
  const character = world.character.id,
    condition = world.runEffects?.conditionId;
  // [start flip, initial back-tap], in seconds. Late flips deliberately
  // demonstrate No Hands and Last-Second Appeal as well as the rotation.
  const timings = {
    jake: { standard: [.9, 0], "boost-strip": [.85, 0], "icy-ramp": [.95, 0], "wrate-issue": [.95, 0], "heavy-cart": [1.05, .05] },
    brandon: { standard: [1, .15], "boost-strip": [1.05, 0], "icy-ramp": [1, .15], "wrate-issue": [1, .1], "heavy-cart": [1.1, .1] },
    owen: { standard: [1.2, 0], "boost-strip": [1.1, 0], "icy-ramp": [1.2, 0], "wrate-issue": [1.2, 0], "heavy-cart": [1.2, .05] },
  };
  const timing = timings[character][condition || "standard"] ?? timings[character].standard;
  if (level.chapter === "after-hours") {
    flip ??= condition === "low-gravity";
    if (flip && condition === "low-gravity") { turns = 2; delay ??= 0; tap ??= 0; }
  }
  flip ??=
    level.id === "showboating-101" ||
    level.id === "commit-to-the-bit" ||
    Boolean(level.stages);
  delay ??= timing[0];
  tap ??= timing[1];
  const airTime = world.elapsed - world.launchTime;
  const tapping = flip && world.launched && airTime < tap;
  const spinning =
    flip && airTime >= delay && world.cart.angle - world.launchAngle < Math.PI * 2 * turns;
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
