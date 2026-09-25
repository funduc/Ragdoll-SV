import { normalAngle } from "../js/scoring.js";
import { timedInputs } from "./skill-helpers.mjs";

// A deterministic practice policy: only discrete left/right keys, meter-timed
// pushes and one brace. Never moves a body, changes a score, or awards a trick.
// The quicker characters wait a little before a flip to recover near contact.
export function chapterControls(world, level, { flip, delay, target } = {}) {
  const character = world.character.id,
    condition = world.runEffects?.conditionId;
  const delays = {
    jake: {
      standard: 0.05,
      "boost-strip": 0.05,
      "icy-ramp": 0.05,
      "wrate-issue": 0.05,
      "heavy-cart": 0.05,
    },
    brandon: {
      standard: 0.05,
      "boost-strip": 0.1,
      "icy-ramp": 0.15,
      "wrate-issue": 0.15,
      "heavy-cart": 0.15,
    },
    owen: {
      standard: 0.3,
      "boost-strip": 0.35,
      "icy-ramp": 0.225,
      "wrate-issue": 0.3,
      "heavy-cart": 0.25,
    },
  };
  // After Hours: low gravity leaves room for a Double Flip; the slab heat
  // needs a level, fast flight; the chameleon wind is countered, not flipped.
  const turns = condition === "low-gravity" ? 2 : 1;
  flip ??=
    condition === "low-gravity" ||
    (condition !== "tailwind" &&
      (level.id === "showboating-101" ||
        level.id === "commit-to-the-bit" ||
        Boolean(level.stages)));
  delay ??=
    delays[character][condition || "standard"] ?? delays[character].standard;
  const spinning =
    flip &&
    world.elapsed - world.launchTime >= delay &&
    world.cart.angle - world.launchAngle < Math.PI * 2 * turns;
  const value = spinning
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
