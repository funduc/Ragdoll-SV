import { SKILL_CONFIG } from "./skill-config.js";
import { CONDITIONS, UPGRADES, normalizeUpgrades } from "./run-config.js";

// Vault Run attempts and Party Chaos rounds. All changes are attempt-local copies.
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
      (1 + n["reinforced-wheels"] * UPGRADES["reinforced-wheels"].stability +
        n["bigger-wheels"] * UPGRADES["bigger-wheels"].stability);
    this.rotation =
      1 + n["improved-air-control"] * UPGRADES["improved-air-control"].rotation;
    this.style = 1 + n["style-multiplier"] * UPGRADES["style-multiplier"].style;
    this.harnessTolerance = n["impact-harness"]
      ? UPGRADES["impact-harness"].tolerance
      : 1;
    this.boostUsed = false;
    this.rocketUsed = false;
    this.rocketUntil = 0;
    this.rocketRemaining = 0;
    this.brakeUsed = false;
    this.brakeUntil = 0;
    this.brakeRemaining = 0;
    this.brakeSpeed = 0;
    this.focusActive = false;
    this.mechanicalFailureOccurred = false;
    this.stabilizerUsed = false;
    this.stabilizerUntil = 0;
    this.previousX = 0;
    // Chameleon Wind: direction changes during this flight (display only).
    this.conditionChanges = 0;
    this.windDirection = 0;
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
    if (this.conditionId === "low-gravity")
      world.engine.gravity.y *= this.condition.gravity;
    if (this.conditionId === "icy-ramp") {
      for (const ground of world.groundBodies)
        ground.friction = this.condition.groundFriction;
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
  // Slow the simulation clock, never the fixed physics step or grading windows.
  timeScale(world) {
    const focus = UPGRADES.focus;
    return this.upgrades.focus && !world.launched && !world.crashed &&
      !world.skills.takeoff && world.skills.perfectStreak >= focus.pushes &&
      world.cart.position.x >= world.skills.config.takeoff.armedX - focus.approachPixels
      ? focus.timeScale : 1;
  }
  shiftVelocity(world, x, y) {
    for (const body of world.dynamic) {
      const v = world.M.Body.getVelocity(body);
      world.M.Body.setVelocity(body, { x: v.x + x, y: v.y + y });
    }
  }
  onLaunch(world) {
    if (world.skills.takeoff === "Perfect" && this.upgrades["spring-launch"])
      this.shiftVelocity(world, 0, -this.upgrades["spring-launch"] * UPGRADES["spring-launch"].lift);
  }
  rocket(world) {
    if (!this.upgrades["rocket-booster"] || this.rocketUsed ||
        !world.launched || world.landed || world.crashed || world.finished) return false;
    this.rocketUsed = true;
    this.rocketRemaining = UPGRADES["rocket-booster"].duration;
    this.rocketUntil = world.elapsed + this.rocketRemaining;
    world.skills.say(world, "upgrade", "Boost", "ROCKET BOOST · one shot used");
    return true;
  }
  brake(world) {
    if (!this.upgrades["air-brake"] || this.brakeUsed || world.skills.braceAt !== null ||
        !world.launched || world.landed || world.crashed || world.finished ||
        world.skills.contactETA(world) <= UPGRADES["air-brake"].minimumETA) return false;
    this.brakeUsed = true;
    this.brakeRemaining = UPGRADES["air-brake"].duration;
    this.brakeUntil = world.elapsed + this.brakeRemaining;
    this.brakeSpeed = Math.max(0, world.M.Body.getVelocity(world.cart).x) * UPGRADES["air-brake"].reduction;
    world.skills.say(world, "upgrade", "Brake", "AIR BRAKE · tap Down / BRACE again near landing");
    return true;
  }
  step(world, dt) {
    const { Body } = world.M,
      air = world.launched && !world.landed;
    this.focusActive = this.timeScale(world) < 1;
    if (!air || world.crashed) {
      this.rocketRemaining = this.brakeRemaining = 0;
      this.rocketUntil = this.brakeUntil = 0;
    }
    if (this.rocketRemaining > 0) {
      const rocket = UPGRADES["rocket-booster"], tick = Math.min(dt, this.rocketRemaining);
      this.shiftVelocity(world, rocket.forward * tick / rocket.duration, -rocket.lift * tick / rocket.duration);
      this.rocketRemaining = Math.max(0, this.rocketRemaining - tick);
    }
    if (this.brakeRemaining > 0) {
      const tick = Math.min(dt, this.brakeRemaining);
      this.shiftVelocity(world, -this.brakeSpeed * tick / UPGRADES["air-brake"].duration, 0);
      this.brakeRemaining = Math.max(0, this.brakeRemaining - tick);
    }
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
    if (air && this.conditionId === "tailwind") {
      for (const body of world.dynamic)
        Body.applyForce(body, body.position, {
          x: body.mass * this.condition.force,
          y: 0,
        });
    }
    if (this.conditionId === "shifting-wind") {
      const direction = this.shiftingDirection(world);
      if (air && direction !== this.windDirection) {
        if (this.windDirection !== 0) this.conditionChanges++;
        this.windDirection = direction;
      }
      // A gust on the rider's upper body pitches the whole assembly: a
      // forward gust pitches the nose down, a backward gust pitches it up.
      if (air)
        world.cart.torque +=
          direction * world.cart.inertia * 0.00006 * this.condition.torque;
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
  shiftingDirection(world) {
    if (!world.launched || world.landed) return 0;
    const phase = Math.floor(
      (world.elapsed - world.launchTime) / this.condition.interval,
    );
    return phase % 2 === 0 ? 1 : -1;
  }
  status(world) {
    switch (this.conditionId) {
      case "low-gravity":
        return "LOW-G LOADING DOCK · 40% less gravity · extra hang time";
      case "tailwind":
        return world.launched && !world.landed
          ? "LEAF-BLOWER TAILWIND → · full power"
          : "LEAF-BLOWER TAILWIND → · pushes forward once airborne";
      case "shifting-wind": {
        if (!world.launched)
          return "CHAMELEON WIND · flips every 0.45 s once airborne";
        if (world.landed)
          return `CHAMELEON WIND · settled after ${this.conditionChanges} direction changes`;
        const d = this.shiftingDirection(world);
        const next =
          this.condition.interval -
          ((world.elapsed - world.launchTime) % this.condition.interval);
        return d > 0
          ? `CHAMELEON WIND · GUST → nose down · counter LEFT / A · flips in ${next.toFixed(1)} s`
          : `CHAMELEON WIND · GUST ← nose up · counter RIGHT / D · flips in ${next.toFixed(1)} s`;
      }
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
