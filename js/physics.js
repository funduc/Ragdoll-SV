import { normalAngle } from "./scoring.js";
import { applyPassive } from "./passives.js";
import { AttemptSkills } from "./skills.js";
import { SKILL_CONFIG } from "./skill-config.js";
import { TrickTracker, trickSample } from "./tricks.js";
import { trickRotationScale } from "./trick-config.js";
export const COURSE = Object.freeze({
  groundY: 520,
  rampStart: 730,
  rampEnd: 1080,
  rampTop: 330,
  startX: 210,
  endX: 10500,
});
export const STEP_MS = 1000 / 120;
export const ATTEMPT_LIMIT = 20;
const RUNUP_LIMIT = 12;

export class PhysicsWorld {
  constructor(character) {
    this.M = globalThis.Matter;
    if (!this.M)
      throw new Error(
        "Matter.js did not load. Check vendor/matter-0.20.0.min.js.",
      );
    this.character = character;
    this.course = COURSE;
    this.engine = this.M.Engine.create({
      positionIterations: 8,
      velocityIterations: 8,
      constraintIterations: 6,
      enableSleeping: false,
    });
    this.engine.gravity.y = 1.05;
    this.elapsed = 0;
    this.launched = false;
    this.landed = false;
    this.crashed = false;
    this.attached = true;
    this.finished = false;
    this.disposed = false;
    this.invalid = false;
    this.airRotation = 0;
    this.launchAngle = 0;
    this.launchTime = 0;
    this.passiveStatus = character.passive?.name || "";
    this.passiveWarning = false;
    this.landingAngle = 0;
    this.landingSpeed = 0;
    this.distancePixels = 0;
    this.settleTime = 0;
    this.riderSettleTime = 0;
    this.reason = "";
    this.events = [];
    this.skills = new AttemptSkills();
    this.tricks = new TrickTracker(character);
    this.createCourse();
    this.createVehicle();
    this.collisionHandler = (event) => this.handleCollisions(event.pairs);
    this.M.Events.on(this.engine, "collisionStart", this.collisionHandler);
  }
  createCourse() {
    const { Bodies, Composite } = this.M;
    const options = {
      isStatic: true,
      friction: 0.8,
      restitution: 0.03,
      label: "ground",
    };
    this.ground = Bodies.rectangle(5000, 600, 12000, 160, options);
    const points = [
      { x: COURSE.rampStart, y: COURSE.groundY },
      { x: COURSE.rampEnd, y: COURSE.rampTop },
      { x: COURSE.rampEnd, y: COURSE.groundY },
    ];
    const center = {
      x: (COURSE.rampStart + 2 * COURSE.rampEnd) / 3,
      y: (2 * COURSE.groundY + COURSE.rampTop) / 3,
    };
    this.ramp = Bodies.fromVertices(center.x, center.y, [points], {
      ...options,
      label: "ramp",
      friction: 0.65,
    });
    this.wall = Bodies.rectangle(-100, 200, 80, 900, {
      ...options,
      label: "wall",
    });
    Composite.add(this.engine.world, [this.ground, this.ramp, this.wall]);
  }
  createVehicle() {
    const { Bodies, Body, Composite, Constraint } = this.M,
      x = COURSE.startX;
    const group = Body.nextGroup(true),
      filter = { group };
    const base = {
      collisionFilter: filter,
      friction: 0.55,
      frictionAir: 0.003,
      restitution: 0.04,
    };
    const parts = [
      Bodies.rectangle(x, 470, 88, 10),
      Bodies.rectangle(x - 43, 450, 7, 45, { angle: -0.13 }),
      Bodies.rectangle(x + 43, 450, 7, 45, { angle: 0.13 }),
      Bodies.rectangle(x - 53, 425, 24, 6),
    ];
    this.cart = Body.create({ ...base, label: "cart", parts });
    Body.setMass(this.cart, 5.5);
    Body.setInertia(
      this.cart,
      this.cart.inertia * 1.4 * (this.character.passive?.cartInertiaScale ?? 1),
    );
    this.cartArtOffset = {
      x: x - this.cart.position.x,
      y: 450 - this.cart.position.y,
    };
    this.wheels = [-32, 32].map((offset) => {
      const wheel = Bodies.circle(x + offset, 498, 18, {
        ...base,
        label: "wheel",
        friction: 0.85,
        frictionAir: 0.001,
      });
      Body.setMass(wheel, 0.55);
      return wheel;
    });
    const pin = (bodyA, bodyB, pointA, pointB, stiffness = 0.85) =>
      Constraint.create({
        bodyA,
        bodyB,
        pointA,
        pointB,
        length: 0,
        stiffness,
        damping: 0.08,
      });
    this.axles = this.wheels.map((wheel) =>
      pin(
        this.cart,
        wheel,
        {
          x: wheel.position.x - this.cart.position.x,
          y: wheel.position.y - this.cart.position.y,
        },
        { x: 0, y: 0 },
        1,
      ),
    );
    const make = (body, mass) => {
      Body.setMass(body, mass);
      return body;
    };
    this.head = make(
      Bodies.circle(x, 385, 11, { ...base, label: "head" }),
      0.28,
    );
    this.torso = make(
      Bodies.rectangle(x, 412, 20, 32, {
        ...base,
        label: "torso",
        chamfer: { radius: 4 },
      }),
      0.75,
    );
    this.hips = make(
      Bodies.rectangle(x, 437, 24, 13, {
        ...base,
        label: "hips",
        chamfer: { radius: 3 },
      }),
      0.35,
    );
    const limb = (label, a, b, width = 8) => {
      const dx = b.x - a.x,
        dy = b.y - a.y;
      return make(
        Bodies.rectangle(
          (a.x + b.x) / 2,
          (a.y + b.y) / 2,
          width,
          Math.hypot(dx, dy),
          {
            ...base,
            label,
            angle: Math.atan2(dy, dx) - Math.PI / 2,
            chamfer: { radius: 3 },
          },
        ),
        0.16,
      );
    };
    const upperArmL = limb("arm", { x: x - 11, y: 402 }, { x: x - 24, y: 421 });
    const lowerArmL = limb("arm", { x: x - 24, y: 421 }, { x: x - 42, y: 427 });
    const upperArmR = limb("arm", { x: x + 11, y: 402 }, { x: x + 24, y: 421 });
    const lowerArmR = limb("arm", { x: x + 24, y: 421 }, { x: x + 42, y: 427 });
    const thighL = limb("leg", { x: x - 6, y: 439 }, { x: x + 13, y: 452 }, 10);
    const shinL = limb("leg", { x: x + 13, y: 452 }, { x: x + 23, y: 471 }, 9);
    const thighR = limb("leg", { x: x + 6, y: 439 }, { x: x + 29, y: 451 }, 10);
    const shinR = limb("leg", { x: x + 29, y: 451 }, { x: x + 35, y: 471 }, 9);
    this.rider = [
      this.head,
      this.torso,
      this.hips,
      upperArmL,
      lowerArmL,
      upperArmR,
      lowerArmR,
      thighL,
      shinL,
      thighR,
      shinR,
    ];
    // Matter stores a constraint anchor relative to a body's initial orientation.
    const joinAt = (a, b, point, stiffness = 0.8) =>
      pin(
        a,
        b,
        { x: point.x - a.position.x, y: point.y - a.position.y },
        { x: point.x - b.position.x, y: point.y - b.position.y },
        stiffness,
      );
    this.joints = [
      joinAt(this.head, this.torso, { x, y: 397 }),
      joinAt(this.torso, this.hips, { x, y: 430 }),
      joinAt(this.torso, upperArmL, { x: x - 11, y: 402 }),
      joinAt(upperArmL, lowerArmL, { x: x - 24, y: 421 }),
      joinAt(this.torso, upperArmR, { x: x + 11, y: 402 }),
      joinAt(upperArmR, lowerArmR, { x: x + 24, y: 421 }),
      joinAt(this.hips, thighL, { x: x - 6, y: 439 }),
      joinAt(thighL, shinL, { x: x + 13, y: 452 }),
      joinAt(this.hips, thighR, { x: x + 6, y: 439 }),
      joinAt(thighR, shinR, { x: x + 29, y: 451 }),
    ];
    this.harness = [
      joinAt(this.cart, this.hips, { x, y: 437 }, 0.6),
      joinAt(this.cart, lowerArmL, { x: x - 42, y: 427 }, 0.25),
      joinAt(this.cart, lowerArmR, { x: x + 42, y: 427 }, 0.25),
    ];
    this.dynamic = [this.cart, ...this.wheels, ...this.rider];
    Composite.add(this.engine.world, [
      ...this.dynamic,
      ...this.axles,
      ...this.joints,
      ...this.harness,
    ]);
  }
  get canRestart() {
    return !this.launched && !this.finished && !this.disposed;
  }
  detach() {
    if (!this.attached) return;
    this.attached = false;
    this.M.Composite.remove(this.engine.world, this.harness);
    this.events.push("detach");
  }
  crash(severe = false) {
    if (!this.crashed) {
      this.crashed = true;
      this.events.push("crash");
    }
    if (severe) this.detach();
  }
  handleCollisions(pairs) {
    for (const pair of pairs) {
      const a = pair.bodyA.parent,
        b = pair.bodyB.parent;
      const terrain = a.isStatic ? a : b.isStatic ? b : null;
      const body = terrain === a ? b : a;
      if (!terrain || body.isStatic) continue;
      const speed = this.preSpeeds?.get(body.id) || { x: 0, y: 0 };
      if (this.launched && !this.landed && terrain === this.ground) {
        // collisionStart runs after integration: this step's rotation happened
        // in the air and must count even though it ends in ground contact.
        this.tricks.land(trickSample(this));
        this.airRotation = Math.abs(this.tricks.signedRotation);
        this.landed = true;
        this.landingTime = this.elapsed;
        this.landingAngle = this.cart.angle;
        this.landingSpeed = Math.abs(this.preSpeeds.get(this.cart.id).y);
        this.skills.onLanding(this);
        this.distancePixels = Math.max(
          0,
          this.cart.position.x - COURSE.rampEnd,
        );
        const tilt = Math.abs(normalAngle(this.cart.angle));
        if (tilt > 1.15 * this.character.landingStability)
          this.crash(tilt > 1.65 && this.landingSpeed > 3);
        this.events.push("land");
        // A little rolling resistance lets a good landing actually settle.
        for (const dynamic of this.dynamic) dynamic.frictionAir = 0.045;
      }
      if ((body === this.head || body === this.torso) && this.elapsed > 0.4) {
        this.crash(
          Math.hypot(speed.x, speed.y) >
            3.2 * this.character.landingStability * this.skills.impactTolerance,
        );
      }
    }
  }
  step(controls = { pushes: 0, brace: false, rotate: 0 }) {
    if (this.finished || this.disposed) return;
    const safeMetrics = this.metrics();
    if (!this.hasFiniteBodies()) {
      this.stopInvalid(safeMetrics);
      return;
    }
    const { Body, Engine } = this.M;
    this.elapsed += STEP_MS / 1000;
    this.preSpeeds = new Map(
      this.dynamic.map((body) => [body.id, { ...Body.getVelocity(body) }]),
    );
    this.skills.push(
      this,
      Math.min(
        SKILL_CONFIG.maximumQueuedPushes,
        Math.max(0, Math.floor(controls?.pushes || 0)),
      ),
    );
    if (controls?.brace) this.skills.requestBrace(this);
    this.skills.followThrough(this);
    const rotate = Number.isFinite(controls?.rotate)
      ? Math.max(-1, Math.min(1, controls.rotate))
      : 0;
    const airControl =
      applyPassive(this, rotate) *
      this.skills.controlScale(this) *
      trickRotationScale(this, rotate);
    if (this.launched && !this.landed) {
      this.cart.torque +=
        airControl *
        this.cart.inertia *
        0.00006 *
        this.character.rotationControl;
      if (Math.abs(this.cart.angularVelocity) > 0.16)
        Body.setAngularVelocity(
          this.cart,
          Math.sign(this.cart.angularVelocity) * 0.16,
        );
    }
    Engine.update(this.engine, STEP_MS);
    if (!this.hasFiniteBodies()) {
      this.stopInvalid(safeMetrics);
      return;
    }
    if (
      !this.launched &&
      this.cart.position.x > COURSE.rampEnd + 35 &&
      this.wheels.every(
        (w) =>
          w.position.x > COURSE.rampEnd && w.position.y < COURSE.groundY - 45,
      )
    ) {
      this.launched = true;
      this.launchAngle = this.cart.angle;
      this.launchTime = this.elapsed;
      this.skills.onLaunch(this);
      this.tricks.start(trickSample(this));
      this.events.push("launch");
    }
    if (this.launched && !this.landed) {
      this.tricks.sample(trickSample(this));
      this.airRotation = Math.abs(this.tricks.signedRotation);
      this.distancePixels = Math.max(0, this.cart.position.x - COURSE.rampEnd);
    }
    if (this.landed || this.crashed) {
      const still = (body) =>
        Body.getSpeed(body) < 0.65 &&
        Math.abs(Body.getAngularVelocity(body)) < 0.06;
      // Ignore small loose-limb jitter once the rider's core and cart have stopped.
      const riderSpeeds = this.rider.map((body) => Body.getSpeed(body));
      const riderStill =
        [this.head, this.torso, this.hips].every(still) &&
        riderSpeeds.reduce((sum, speed) => sum + speed, 0) /
          riderSpeeds.length <
          0.5 &&
        Math.max(...riderSpeeds) < 1.8;
      const allStill = still(this.cart) && riderStill;
      this.settleTime = allStill ? this.settleTime + STEP_MS / 1000 : 0;
      this.riderSettleTime = riderStill
        ? this.riderSettleTime + STEP_MS / 1000
        : 0;
      if (this.settleTime > 0.75)
        this.finish(this.crashed ? "Crash settled" : "Landing settled");
      else if (this.crashed && !this.attached && this.riderSettleTime > 1)
        this.finish("Rider came to rest");
    }
    if (!this.launched && this.elapsed >= RUNUP_LIMIT)
      this.finish("Run-up time expired");
    else if (this.elapsed >= ATTEMPT_LIMIT) this.finish("Attempt time limit");
    else if (
      this.dynamic.some((b) => b.position.y > 1800) ||
      this.cart.position.x > COURSE.endX
    )
      this.finish("Out of bounds");
  }
  hasFiniteBodies() {
    return this.dynamic.every(
      (body) =>
        [
          body.position.x,
          body.position.y,
          body.positionPrev.x,
          body.positionPrev.y,
          body.angle,
          body.anglePrev,
          body.velocity.x,
          body.velocity.y,
          body.angularVelocity,
          body.force.x,
          body.force.y,
          body.torque,
        ].every(Number.isFinite) &&
        body.vertices.every(
          (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
        ),
    );
  }
  stopInvalid(safeMetrics) {
    // Keep only the last valid measurements; never draw corrupt body geometry.
    Object.assign(this, safeMetrics);
    this.invalid = true;
    this.finish("Physics safety stop");
  }
  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.reason = reason;
    this.tricks.finalize();
    if (!this.launched) this.distancePixels = 0;
  }
  metrics() {
    return {
      launched: this.launched,
      landed: this.landed,
      crashed: this.crashed,
      attached: this.attached,
      distancePixels: this.distancePixels,
      airRotation: this.airRotation,
      landingAngle: this.landingAngle,
      landingSpeed: this.landingSpeed,
      reason: this.reason,
      ...this.skills.metrics(),
      trickSummary: this.tricks.snapshot(),
    };
  }
  drainEvents() {
    return this.events.splice(0);
  }
  dispose() {
    if (this.disposed) return;
    this.M.Events.off(this.engine, "collisionStart", this.collisionHandler);
    this.M.Composite.clear(this.engine.world, false, true);
    this.M.Engine.clear(this.engine);
    this.events.length = 0;
    this.preSpeeds?.clear();
    this.disposed = true;
  }
}
