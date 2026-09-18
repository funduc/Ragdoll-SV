import {
  SKILL_CONFIG as C,
  rhythmPosition,
  pushGrade,
  takeoffGrade,
  braceGrade,
  braceTolerance,
} from "./skill-config.js";

// Attempt-local skill state. PhysicsWorld owns it; no wall clock, listeners or timers.
export class AttemptSkills {
  constructor() {
    this.pushes = { Perfect: 0, Good: 0, Miss: 0 };
    this.lastPush = -Infinity;
    this.lastImpulse = -Infinity;
    this.started = false;
    this.takeoff = null;
    this.takeoffBonus = 0;
    this.braceAt = null;
    this.brace = "Unbraced";
    this.braceLead = null;
    this.impactTolerance = 1;
    this.feedback = null;
    this.serial = 0;
    this.lateKick = false;
    this.driveUntil = 0;
  }
  say(world, kind, grade, detail) {
    this.feedback = {
      serial: ++this.serial,
      kind,
      grade,
      detail,
      until: world.elapsed + C.feedbackSeconds,
    };
  }
  impulse(world, speed, cap) {
    const { Body } = world.M;
    const dx = Math.max(
      0,
      Math.min(speed, cap - Body.getVelocity(world.cart).x),
    );
    // Move the joined assembly together; a cart-only velocity jump strains joints.
    const { rampStart, rampEnd, groundY, rampTop } = world.course;
    const slope =
      world.cart.position.x > rampStart && world.cart.position.x < rampEnd
        ? (groundY - rampTop) / (rampEnd - rampStart)
        : 0;
    for (const body of world.dynamic) {
      const v = Body.getVelocity(body);
      Body.setVelocity(body, { x: v.x + dx, y: v.y - dx * slope });
    }
  }
  push(world, count) {
    if (world.landed || world.crashed || !count) return;
    const c = C.rhythm,
      t = world.elapsed;
    const spam = count > 1 || t - this.lastPush < c.minimumInterval;
    this.lastPush = t;
    if (world.launched) {
      if (!this.takeoff) this.commitTakeoff(world, "Late");
      return;
    }
    if (world.cart.position.x >= C.takeoff.armedX || this.takeoff) {
      // This is a separate, one-shot timing window. A recent rhythm push must
      // not turn a correctly placed launch push into an Early takeoff.
      if (!this.takeoff)
        this.commitTakeoff(world, takeoffGrade(world.cart.position.x));
      return;
    }
    const grade = pushGrade(rhythmPosition(t), spam);
    this.pushes[grade] += count;
    const first = !this.started;
    this.started = true;
    if (t - this.lastImpulse >= c.minimumInterval) {
      this.lastImpulse = t;
      this.driveUntil =
        t +
        (spam
          ? 0
          : grade === "Perfect"
            ? c.perfectFollowThrough
            : grade === "Good"
              ? c.goodFollowThrough
              : c.missFollowThrough);
      const speed =
        (spam
          ? c.spamSpeed
          : grade === "Perfect"
            ? c.perfectSpeed
            : grade === "Good"
              ? c.goodSpeed
              : c.missSpeed) + (first ? c.starterSpeed : 0);
      this.impulse(
        world,
        (speed * world.character.baseAcceleration) / c.accelerationReference,
        c.maximumSpeed,
      );
      const { Body } = world.M;
      if (grade === "Perfect")
        Body.setAngularVelocity(
          world.cart,
          world.cart.angularVelocity * c.perfectDamping,
        );
      if (grade === "Miss") {
        const sign = this.pushes.Miss % 2 ? 1 : -1;
        Body.setAngularVelocity(
          world.cart,
          Math.max(
            -c.maximumWobble,
            Math.min(
              c.maximumWobble,
              world.cart.angularVelocity + sign * c.missWobble,
            ),
          ),
        );
      }
    }
    this.say(
      world,
      "push",
      grade,
      spam
        ? "Too fast — release, then tap on the beat"
        : grade === "Miss"
          ? "Aim for the green centre; holding gives one push"
          : "Push! Keep tapping at the green centre",
    );
  }
  commitTakeoff(world, grade) {
    if (this.takeoff) return;
    this.takeoff = grade;
    const c = C.takeoff;
    this.takeoffBonus =
      grade === "Perfect" ? c.perfectBonus : grade === "Good" ? c.goodBonus : 0;
    this.driveUntil = world.elapsed + c.followThrough;
    if (!world.launched)
      this.impulse(world, c.baseSpeed + this.takeoffBonus, c.maximumSpeed);
    if (grade === "Perfect" || grade === "Good")
      world.M.Body.setAngularVelocity(
        world.cart,
        world.cart.angularVelocity *
          (grade === "Perfect" ? c.perfectDamping : c.goodDamping),
      );
    if (grade === "Late") this.lateKick = true;
    this.say(
      world,
      "takeoff",
      grade,
      grade === "Perfect"
        ? `Launch boost +${c.perfectBonus} · steadier takeoff`
        : grade === "Good"
          ? `Launch boost +${c.goodBonus}`
          : grade === "Early"
            ? "Boost spent before the zone"
            : "Missed the zone · forward pitch",
    );
  }
  onLaunch(world) {
    if (!this.takeoff) this.commitTakeoff(world, "Late");
    if (this.lateKick) {
      world.M.Body.setAngularVelocity(
        world.cart,
        world.cart.angularVelocity + C.takeoff.lateRotation,
      );
      this.lateKick = false;
    }
  }
  requestBrace(world) {
    if (!world.launched || this.braceAt !== null) return;
    if (world.landed) {
      if (this.brace === "Unbraced") {
        this.brace = "Late";
        this.say(
          world,
          "brace",
          "Late",
          "Contact already happened — no brace benefit",
        );
      }
      return;
    }
    this.braceAt = world.elapsed;
    this.say(
      world,
      "brace",
      "Braced",
      "Brace committed — timing is judged at contact",
    );
  }
  controlScale(world) {
    return this.braceAt !== null &&
      world.elapsed - this.braceAt > C.brace.goodMax
      ? C.brace.earlyControlScale
      : 1;
  }
  followThrough(world) {
    if (
      world.launched ||
      world.crashed ||
      world.elapsed >= this.driveUntil ||
      world.cart.velocity.x >= C.rhythm.maximumSpeed
    )
      return;
    world.M.Body.applyForce(world.cart, world.cart.position, {
      x:
        world.cart.mass *
        world.character.baseAcceleration *
        C.rhythm.followThroughScale,
      y: 0,
    });
  }
  onLanding(world) {
    this.braceLead =
      this.braceAt === null ? null : Math.max(0, world.elapsed - this.braceAt);
    this.brace = braceGrade(this.braceLead);
    this.impactTolerance = braceTolerance(this.brace);
    this.say(
      world,
      "brace",
      this.brace,
      this.impactTolerance > 1
        ? `Impact tolerance ×${this.impactTolerance.toFixed(2)} · angle still counts`
        : this.brace === "Early"
          ? "Brace was too early; reduced air control"
          : "No impact bonus",
    );
  }
  contactETA(world) {
    if (!world.launched || world.landed) return Infinity;
    const bottom = Math.max(...world.dynamic.map((body) => body.bounds.max.y));
    const height = Math.max(0, world.course.groundY - bottom);
    const velocity = world.M.Body.getVelocity(world.cart).y * 60;
    const gravity = world.engine.gravity.y * world.engine.gravity.scale * 1e6;
    return (
      (-velocity + Math.sqrt(velocity * velocity + 2 * gravity * height)) /
      gravity
    );
  }
  metrics() {
    return {
      takeoffGrade: this.takeoff || "Late",
      takeoffBonus: this.takeoffBonus,
      braceGrade: this.brace,
      braceLeadMs:
        this.braceLead === null ? null : Math.round(this.braceLead * 1000),
      pushCounts: { ...this.pushes },
    };
  }
}
