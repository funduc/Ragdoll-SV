import { SKILL_CONFIG as C, rhythmPosition } from "../js/skill-config.js";

// A practice policy using only the displayed meter/cart/landing cues.
export function timedInputs(
  world,
  rotate = 0,
  brace = false,
  target = "Perfect",
) {
  let pushes = 0;
  if (!world.launched) {
    if (world.cart.position.x < C.takeoff.armedX) {
      const p = rhythmPosition(world.elapsed);
      pushes = Number(
        p >= 0.47 && p <= 0.55 && world.elapsed - world.skills.lastPush > 0.4,
      );
    } else if (!world.skills.takeoff) {
      const x =
        target === "Early"
          ? 900
          : target === "Good"
            ? 955
            : target === "Late"
              ? 1100
              : 1020;
      pushes = Number(world.cart.position.x >= x);
    }
  }
  return {
    pushes,
    rotate,
    brace:
      brace &&
      world.skills.braceAt === null &&
      world.skills.contactETA(world) < 0.18,
  };
}
export function settle(world, controls = (world) => timedInputs(world)) {
  for (let i = 0; i < 2500 && !world.finished; i++) world.step(controls(world));
  return world;
}
