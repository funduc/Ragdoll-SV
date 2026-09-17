import { normalAngle } from "./scoring.js";

// Only small forces and status text. No timers, randomness, new bodies, or joints.
// Returning a control value keeps the original torque calculation in physics.js.
export function applyPassive(world, rotate) {
  const passive = world.character.passive;
  world.passiveStatus = passive?.name || "";
  world.passiveWarning = false;
  if (!passive) return rotate;

  if (passive.id === "wrate-issues") {
    const phase = (world.elapsed - 1.2) % 5.5;
    const warning = world.elapsed >= 1.2 && phase < 1.4;
    world.passiveWarning = warning;
    world.passiveStatus = warning
      ? "Wrate Issue Detected"
      : "Wrate Issues · Fast run-up / lower stability";
    if (warning && !world.wrateWarningActive) world.events.push("wrateWarning");
    world.wrateWarningActive = warning;
  }
  if (!world.launched || world.landed) return rotate;

  const cart = world.cart;
  if (passive.id === "cold-blooded") {
    const tilt = normalAngle(cart.angle);
    const counterSteering =
      Math.abs(cart.angularVelocity) > 0.001
        ? rotate * cart.angularVelocity < 0
        : rotate * tilt < 0;
    const recovering =
      Math.abs(tilt) > passive.recoveryAngle && counterSteering;
    world.passiveStatus = recovering
      ? "Cold-Blooded · Weaker recovery"
      : "Cold-Blooded · Slow, steady air control";
    if (!rotate && Math.abs(tilt) < passive.levelWindow) {
      cart.torque -= cart.inertia * tilt * passive.levelAssist;
      world.M.Body.setAngularVelocity(
        cart,
        cart.angularVelocity * passive.damping,
      );
      world.passiveStatus = "Cold-Blooded · Level assist";
    }
    return rotate * (recovering ? passive.recoveryScale : 1);
  }
  if (passive.id === "poetic-license") {
    const airTime = world.elapsed - world.launchTime;
    const phase = (airTime - passive.wobbleStart) % passive.wobblePeriod;
    const afterStart = airTime >= passive.wobbleStart;
    const wobbling = afterStart && phase < passive.wobbleDuration;
    if (wobbling) {
      // A bounded positive/negative pulse, at most 18% of Brandon's air control.
      // Identical inputs receive the same wobble, so counter-steering is learnable.
      const wave = Math.sin((phase / passive.wobbleDuration) * Math.PI * 2);
      cart.torque += cart.inertia * 0.00006 * passive.wobbleStrength * wave;
    }
    world.passiveStatus =
      afterStart && phase < passive.wobbleDuration + 0.6
        ? "Poetic License · Unlucky wobble / style ×1.35"
        : "Poetic License · Style ×1.35";
  }
  return rotate;
}
