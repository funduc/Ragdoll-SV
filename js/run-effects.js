import { SKILL_CONFIG } from "./skill-config.js";
import { CONDITIONS, UPGRADES, normalizeUpgrades } from "./run-config.js";

// Instantiated only for Vault Run. All changes are attempt-local copies.
export class RunEffects {
  constructor(spec = {}) {
    this.conditionId = Object.hasOwn(CONDITIONS, spec.condition)
      ? spec.condition
      : null;
    this.condition = CONDITIONS[this.conditionId] || null;
    this.upgrades = normalizeUpgrades(spec.upgrades);
    this.objectiveId = spec.objective || null;
    const n = this.upgrades,
      heavy = this.conditionId === "heavy-cart";
    this.acceleration = heavy ? this.condition.acceleration : 1;
    this.mass = heavy ? this.condition.mass : 1;
    this.stability =
      (heavy ? this.condition.stability : 1) *
      (1 + n["reinforced-wheels"] * UPGRADES["reinforced-wheels"].stability);
    this.rotation =
      1 + n["improved-air-control"] * UPGRADES["improved-air-control"].rotation;
    this.style = 1 + n["style-multiplier"] * UPGRADES["style-multiplier"].style;
    this.harnessTolerance = n["impact-harness"]
      ? UPGRADES["impact-harness"].tolerance
      : 1;
    this.boostUsed = false;
    this.mechanicalFailureOccurred = false;
    this.stabilizerUsed = false;
    this.stabilizerUntil = 0;
    this.previousX = 0;
    this.skills = this.skillConfig();
  }
  skillConfig() {
    const n = this.upgrades;
    const launch =
      n["wider-launch-window"] * UPGRADES["wider-launch-window"].pixels;
    const brace = n["wider-brace-window"],
      b = UPGRADES["wider-brace-window"];
    return Object.freeze({
      ...SKILL_CONFIG,
      rhythm: Object.freeze({
        ...SKILL_CONFIG.rhythm,
        perfectSpeed:
          SKILL_CONFIG.rhythm.perfectSpeed *
          (1 +
            n["faster-perfect-pushes"] *
              UPGRADES["faster-perfect-pushes"].speed),
      }),
      takeoff: Object.freeze({
        ...SKILL_CONFIG.takeoff,
        goodStart: SKILL_CONFIG.takeoff.goodStart - launch,
        perfectStart: SKILL_CONFIG.takeoff.perfectStart - launch,
        perfectEnd: SKILL_CONFIG.takeoff.perfectEnd + launch,
        goodEnd: SKILL_CONFIG.takeoff.goodEnd + launch,
      }),
      brace: Object.freeze({
        ...SKILL_CONFIG.brace,
        perfectMax: SKILL_CONFIG.brace.perfectMax + brace * b.perfectSeconds,
        goodMax: SKILL_CONFIG.brace.goodMax + brace * b.goodSeconds,
      }),
    });
  }
  character(base) {
    return Object.freeze({
      ...base,
      baseAcceleration: base.baseAcceleration * this.acceleration,
      rotationControl: base.rotationControl * this.rotation,
      landingStability: base.landingStability * this.stability,
      // The existing result equation displays this factor to two decimals.
      styleMultiplier:
        Math.round(base.styleMultiplier * this.style * 100) / 100,
    });
  }
  install(world) {
    this.previousX = world.cart.position.x;
    if (this.conditionId === "icy-ramp") {
      world.ground.friction = this.condition.groundFriction;
      world.ramp.friction = this.condition.rampFriction;
      for (const wheel of world.wheels)
        wheel.friction = this.condition.wheelFriction;
    }
  }
  get landingAirFriction() {
    return this.conditionId === "icy-ramp"
      ? this.condition.landingAirFriction
      : 0.045;
  }
  step(world, dt) {
    const { Body } = world.M,
      air = world.launched && !world.landed;
    if (
      this.conditionId === "boost-strip" &&
      !world.launched &&
      !world.crashed &&
      !this.boostUsed &&
      this.previousX < this.condition.end &&
      world.cart.position.x >= this.condition.start
    ) {
      this.boostUsed = true;
      world.skills.impulse(world, this.condition.speed, this.condition.cap);
      world.skills.say(
        world,
        "condition",
        "Boost",
        "BOOST STRIP · +3 speed · timed takeoff still available",
      );
    }
    this.previousX = world.cart.position.x;
    if (air && this.conditionId === "crosswind") {
      for (const body of world.dynamic)
        Body.applyForce(body, body.position, {
          x: body.mass * this.condition.force,
          y: 0,
        });
    }
    if (air && this.conditionId === "wrate-issue") {
      const phase = world.elapsed - world.launchTime - this.condition.warning;
      if (phase >= 0 && phase < this.condition.duration) {
        this.mechanicalFailureOccurred = true;
        world.cart.torque +=
          world.cart.inertia * 0.00006 * this.condition.torque;
      }
    }
    const stabilizer = UPGRADES["emergency-stabilizer"];
    const tilt = Math.atan2(
      Math.sin(world.cart.angle),
      Math.cos(world.cart.angle),
    );
    if (
      air &&
      this.upgrades["emergency-stabilizer"] &&
      !this.stabilizerUsed &&
      world.cart.velocity.y > 0 &&
      Math.abs(tilt) > stabilizer.angle &&
      world.skills.contactETA(world) < stabilizer.contactSeconds
    ) {
      this.stabilizerUsed = true;
      this.stabilizerUntil = world.elapsed + stabilizer.duration;
      world.skills.say(
        world,
        "upgrade",
        "Assist",
        "EMERGENCY STABILIZER · brief recovery assist",
      );
    }
    if (air && world.elapsed < this.stabilizerUntil) {
      const assist = Math.max(
        -stabilizer.torque,
        Math.min(stabilizer.torque, -tilt - world.cart.angularVelocity * 12),
      );
      world.cart.torque += world.cart.inertia * 0.00006 * assist;
      Body.setAngularVelocity(
        world.cart,
        world.cart.angularVelocity * Math.pow(stabilizer.damping, dt * 60),
      );
    }
  }
  status(world) {
    switch (this.conditionId) {
      case "crosswind":
        return world.launched && !world.landed
          ? "CROSSWIND → · steady airborne drift"
          : "CROSSWIND → · wind acts only in the air";
      case "icy-ramp":
        return "ICY RAMP · low traction / slippery landing";
      case "heavy-cart":
        return "HEAVY CART · slower pushes / stronger landing stability";
      case "boost-strip":
        return this.boostUsed
          ? "BOOST STRIP · boost used"
          : "BOOST STRIP · blue runway zone ahead";
      case "wrate-issue": {
        const air = world.elapsed - world.launchTime;
        return !world.launched
          ? "WRATE ISSUE · forward wobble at +0.65 s after launch"
          : world.landed ||
              air >= this.condition.warning + this.condition.duration
            ? "WRATE ISSUE · pulse complete"
            : air < this.condition.warning
              ? `WRATE ISSUE IN ${Math.max(0, this.condition.warning - air).toFixed(1)} s · prepare LEFT / A`
              : "WRATE ISSUE ACTIVE → · counter LEFT / A";
      }
      default:
        return "STANDARD CONDITIONS";
    }
  }
}
