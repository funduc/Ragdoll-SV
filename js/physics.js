import { applySyncLaunch } from "./sync.js";
import { normalAngle } from "./scoring.js";
import { applyPassive } from "./passives.js";
import { AttemptSkills } from "./skills.js";
import { SKILL_CONFIG } from "./skill-config.js";
import { TrickTracker, trickSample } from "./tricks.js";
import { trickRotationScale } from "./trick-config.js";
import { RunEffects } from "./run-effects.js";
import { CrashDamage } from "./carnage.js";
import {
  DEFAULT_COURSE,
  resolveCourse,
  pieceOutline,
  courseSkillConfig,
  pinLayout,
  groundSpans,
  propLayout,
} from "./course.js";
// The default long-jump course. Worlds read their own `world.course`.
export const COURSE = DEFAULT_COURSE;
export const STEP_MS = 1000 / 120;
export const ATTEMPT_LIMIT = 20;
const RUNUP_LIMIT = 12;

export class PhysicsWorld {
  constructor(
    character,
    arena = { id: "santor-vault", gravity: 1.05 },
    runSpec = null,
  ) {
    this.M = globalThis.Matter;
    if (!this.M)
      throw new Error(
        "Matter.js did not load. Check vendor/matter-0.20.0.min.js.",
      );
    this.runEffects = runSpec ? new RunEffects(runSpec) : null;
    this.character = this.runEffects
      ? this.runEffects.character(character)
      : character;
    // A level or event picks the course shape with `arena.course`.
    this.course = resolveCourse(arena.course);
    this.arena = arena;
    this.engine = this.M.Engine.create({
      positionIterations: 8,
      velocityIterations: 8,
      constraintIterations: 6,
      enableSleeping: false,
    });
    // The campaign's arena data selects gravity; the existing course geometry
    // stays fixed for this vertical slice. Party uses the exact original default.
    this.engine.gravity.y =
      arena.id === "santor-vault" && Number.isFinite(arena.gravity)
        ? Math.max(0.5, Math.min(1.5, arena.gravity))
        : 1.05;
    this.elapsed = 0;
    this.launched = false;
    this.landed = false;
    this.crashed = false;
    this.severeCrash = false;
    this.crashClassification = null;
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
    this.impactLoudness = null;
    this.distancePixels = 0;
    this.settleTime = 0;
    this.riderSettleTime = 0;
    this.reason = "";
    this.events = [];
    this.skills = new AttemptSkills(
      courseSkillConfig(this.runEffects?.skills || SKILL_CONFIG, this.course),
    );
    this.tricks = new TrickTracker(this.character);
    this.createCourse();
    this.createVehicle();
    // The cart and rider are built for the default ground height; other
    // courses lift or lower the whole assembly to their own ground.
    this.spawnOffsetY = this.course.groundY - DEFAULT_COURSE.groundY;
    if (this.spawnOffsetY)
      for (const body of this.dynamic)
        this.M.Body.translate(body, { x: 0, y: this.spawnOffsetY });
    this.damage = new CrashDamage(this);
    this.createCargo();
    this.createBar();
    this.createPins();
    this.createProps();
    this.runEffects?.install(this);
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
    const course = this.course;
    // A 160 px ground slab whose top edge is the course's ground height.
    this.groundBodies = groundSpans(course).map(({ left, right }) => Bodies.rectangle(
      (left + right) / 2,
      course.groundY + 80,
      right - left,
      160,
      options,
    ));
    this.ground = this.groundBodies[0];
    this.pits = course.pieces.filter((p) => p.type === "pit");
    this.pitFalls = new Map();
    const points = [
      { x: course.rampStart, y: course.groundY },
      { x: course.rampEnd, y: course.rampTop },
      { x: course.rampEnd, y: course.groundY },
    ];
    const center = {
      x: (course.rampStart + 2 * course.rampEnd) / 3,
      y: (2 * course.groundY + course.rampTop) / 3,
    };
    this.ramp = Bodies.fromVertices(center.x, center.y, [points], {
      ...options,
      label: "ramp",
      friction: 0.65,
    });
    this.wall = Bodies.rectangle(course.wallX, course.groundY - 320, 80, 900, {
      ...options,
      label: "wall",
    });
    Composite.add(this.engine.world, [...this.groundBodies, this.ramp, this.wall]);
    // Optional extra static pieces from the course data (bars, walls, ramps).
    this.coursePieces = course.pieces.filter((p) => !["pit", "props"].includes(p.type)).map((piece) => {
      const outline = pieceOutline(piece);
      const centre = this.M.Vertices.centre(outline);
      const body = Bodies.fromVertices(centre.x, centre.y, [outline], {
        ...options,
        label: piece.label,
        friction: piece.friction,
        restitution: piece.restitution,
      });
      body.coursePiece = piece;
      return body;
    });
    this.landingSurfaces = new Set([
      ...this.groundBodies,
      ...this.coursePieces.filter((body) => body.coursePiece.landing),
    ]);
    this.conveyors = new Set(this.coursePieces.filter((b) => b.coursePiece.type === "conveyor"));
    Composite.add(this.engine.world, this.coursePieces);
    this.runwayBumps = (this.arena.bumps || []).map(({ x, width, height }) => {
      const points = [
        { x: x - width / 2, y: course.groundY },
        { x, y: course.groundY - height },
        { x: x + width / 2, y: course.groundY },
      ];
      return Bodies.fromVertices(x, course.groundY - height / 3, [points], {
        ...options,
        label: "runway repair",
      });
    });
    Composite.add(this.engine.world, this.runwayBumps);
  }
  createCargo() {
    const config = this.arena.cargo;
    this.cargo = null;
    this.cargoLost = false;
    this.cargoStrainTime = 0;
    if (!config) return;
    const { Bodies, Body, Constraint, Composite } = this.M;
    this.cargo = Bodies.rectangle(
      this.course.startX + 25,
      445 + this.spawnOffsetY,
      config.size,
      config.size,
      {
        label: "ceremonial mug",
        friction: 0.5,
        frictionAir: 0.003,
        restitution: 0.15,
        collisionFilter: { group: this.cart.collisionFilter.group },
      },
    );
    Body.setMass(this.cargo, config.mass);
    this.cargoTether = Constraint.create({
      bodyA: this.cart,
      bodyB: this.cargo,
      pointA: {
        x: this.cargo.position.x - this.cart.position.x,
        y: this.cargo.position.y - this.cart.position.y,
      },
      length: 0,
      stiffness: config.stiffness,
      damping: config.damping,
    });
    this.dynamic.push(this.cargo);
    Composite.add(this.engine.world, [this.cargo, this.cargoTether]);
  }
  createProps() {
    const { Bodies, Body, Composite } = this.M;
    this.looseProps = this.course.pieces.filter((p) => p.type === "props").flatMap((piece) =>
      propLayout(piece).map((spot) => {
        const body = Bodies.rectangle(spot.x, spot.y, piece.width, piece.height, {
          label: piece.label, angle: piece.angle, friction: piece.friction,
          restitution: piece.restitution, frictionAir: 0.004,
        });
        Body.setMass(body, piece.mass);
        body.coursePiece = piece;
        body.rest = spot;
        body.fallen = body.pastLine = false;
        return body;
      }));
    Composite.add(this.engine.world, this.looseProps);
  }
  propFacts() {
    return {
      propsFallen: this.looseProps.filter((p) => p.fallen).length,
      propsPastLine: this.looseProps.filter((p) => p.pastLine).length,
      propsMoved: this.looseProps.filter((p) => p.fallen || p.pastLine).length,
    };
  }
  updateCoursePieces() {
    if (!this.conveyors.size && !this.looseProps.length && !this.pits.length) return;
    const { Body } = this.M;
    for (const pair of this.engine.pairs.list) {
      if (!this.conveyors.size) break;
      if (!pair.isActive) continue;
      const a = pair.bodyA.parent, b = pair.bodyB.parent;
      const belt = this.conveyors.has(a) ? a : this.conveyors.has(b) ? b : null;
      const body = belt === a ? b : a;
      // Only a real top-surface contact gets belt motion; proximity and
      // airborne bodies (even ones directly above the belt) do not count.
      if (!belt || body.isStatic || body.position.y >= belt.bounds.min.y ||
          Math.abs(pair.collision.normal.y) < 0.5) continue;
      const velocity = Body.getVelocity(body);
      Body.setVelocity(body, { x: belt.coursePiece.speed / 60, y: velocity.y });
    }
    for (const prop of this.looseProps) {
      const piece = prop.coursePiece;
      prop.fallen ||= Math.abs(normalAngle(prop.angle - piece.angle)) > 0.6 ||
        prop.position.y > prop.rest.y + piece.height * 0.5;
      if (piece.lineX !== null) {
        const direction = piece.lineDirection;
        prop.pastLine ||= (prop.rest.x - piece.lineX) * direction <= 0 &&
          (prop.position.x - piece.lineX) * direction > 0;
      }
    }
    // A platform may bridge a pit. Crash only once the cart or rider core
    // actually falls below its authored depth, never while flying over it.
    for (const body of [this.cart, this.head, this.torso]) {
      if (body.position.y <= this.course.groundY) this.pitFalls.delete(body);
      else if (!this.pitFalls.has(body)) {
        const pit = this.pits.find((p) => body.position.x > p.x - p.width / 2 &&
          body.position.x < p.x + p.width / 2);
        if (pit) this.pitFalls.set(body, pit);
      }
    }
    if ([...this.pitFalls].some(([body, pit]) => body.position.y > this.course.groundY + pit.depth)) {
      this.crash(false, "pit-fall");
      this.crashClassification = "pit-fall";
      this.events.push("pit-fall");
      this.finish("Fell into a pit");
    }
  }
  propsStill() {
    return this.looseProps.every((body) =>
      body.position.y > this.course.groundY + 1280 ||
      (this.M.Body.getSpeed(body) < 0.3 && Math.abs(this.M.Body.getAngularVelocity(body)) < 0.03));
  }
  updateCargo() {
    if (!this.cargo || this.cargoLost) return;
    const config = this.arena.cargo;
    this.cargoStrainTime =
      Math.abs(normalAngle(this.cart.angle)) > config.releaseAngle
        ? this.cargoStrainTime + STEP_MS / 1000
        : 0;
    if (this.cargoStrainTime < config.releaseSeconds && !this.severeCrash)
      return;
    this.cargoLost = true;
    this.M.Composite.remove(this.engine.world, this.cargoTether);
    this.skills.say(
      this,
      "cargo",
      "Lost",
      "MUG RESIGNED · delivery now requires a replacement mug",
    );
  }
  // CART HIGH JUMP: a real, light bar resting on a peg at `arena.barHeight`
  // metres. The peg only touches the bar, so the cart passes the uprights.
  createBar() {
    const bar = this.course.bar;
    this.bar = null;
    this.highJump = null;
    if (!bar || !Number.isFinite(this.arena.barHeight)) return;
    const { Bodies, Composite } = this.M;
    const top = this.course.groundY - this.arena.barHeight * 40;
    this.bar = Bodies.rectangle(bar.x, top + bar.thickness / 2, bar.width, bar.thickness, {
      label: "high-jump bar",
      density: 0.0006,
      friction: 0.6,
      frictionAir: 0.01,
      restitution: 0.1,
      collisionFilter: { category: 0x0004, mask: 0xffffffff },
    });
    this.barPeg = Bodies.rectangle(bar.x, top + bar.thickness + 3, 14, 6, {
      isStatic: true,
      label: "bar peg",
      friction: 0.9,
      collisionFilter: { category: 0x0008, mask: 0x0004 },
    });
    Composite.add(this.engine.world, [this.bar, this.barPeg]);
    this.barRest = { x: this.bar.position.x, y: this.bar.position.y };
    this.highJump = {
      height: this.arena.barHeight,
      barX: bar.x,
      barTop: top,
      knocked: false,
      face: false, // the rider's head touched the bar
      hitBy: [],
      crossing: null, // "over" or "under" when the cart centre passes the bar
      fosbury: false,
    };
    this.barPreviousX = this.cart.position.x;
  }
  updateBar() {
    const hj = this.highJump;
    if (!hj) return;
    const b = this.bar;
    if (
      !hj.knocked &&
      (Math.abs(b.position.x - this.barRest.x) > 4 ||
        Math.abs(b.position.y - this.barRest.y) > 4 ||
        Math.abs(normalAngle(b.angle)) > 0.2)
    ) {
      hj.knocked = true;
      this.events.push("barKnocked");
    }
    const x = this.cart.position.x;
    if (hj.crossing === null && this.barPreviousX < hj.barX && x >= hj.barX) {
      // Judged on the whole assembly: every part must be above the bar.
      const lowest = Math.max(...this.dynamic.map((body) => body.bounds.max.y));
      hj.crossing = lowest < hj.barTop ? "over" : "under";
      // Upside down over the bar (a flip over it): the Fosbury.
      hj.fosbury =
        hj.crossing === "over" && Math.abs(normalAngle(this.cart.angle)) > 2.09;
      this.events.push(hj.fosbury ? "fosbury" : "barCrossed");
    }
    this.barPreviousX = x;
  }
  highJumpResult() {
    const hj = this.highJump;
    if (!hj) return null;
    const result = hj.knocked
      ? "knocked"
      : hj.crossing === "over"
        ? "cleared"
        : hj.crossing === "under"
          ? "under"
          : "short";
    return {
      height: hj.height,
      result,
      cleared: result === "cleared",
      fosbury: result === "cleared" && hj.fosbury,
      face: hj.knocked && hj.face,
    };
  }
  // CART BOWLING: ten standing pins in a 1-2-3-4 triangle. Pins in the same
  // row stand side by side in depth, so they never collide with each other;
  // every other row, the cart and the rider do. A pin is down once it has
  // tipped, dropped, or been knocked well away from its spot.
  createPins() {
    const config = this.course.pins;
    this.pins = [];
    this.bowling = null;
    if (!config) return;
    const { Bodies, Composite } = this.M;
    const rowBit = (row) => 0x0010 << row;
    this.pins = pinLayout(config, this.course.groundY).map((spot, i) => {
      const pin = Bodies.rectangle(spot.x, spot.y, config.width, config.height, {
        label: `pin ${i + 1}`,
        density: config.density,
        friction: config.friction,
        frictionStatic: config.frictionStatic,
        frictionAir: 0.004,
        restitution: 0.15,
        collisionFilter: { category: rowBit(spot.row), mask: 0xffffffff & ~rowBit(spot.row) },
      });
      pin.rest = { x: spot.x, y: spot.y, row: spot.row };
      return pin;
    });
    Composite.add(this.engine.world, this.pins);
    this.bowling = { cartHit: false, riderHit: false, firstHitTime: null };
  }
  pinDown(pin) {
    const { width, height } = this.course.pins;
    return (
      Math.abs(normalAngle(pin.angle)) > 0.6 ||
      pin.position.y > pin.rest.y + height * 0.3 ||
      Math.abs(pin.position.x - pin.rest.x) > width * 1.5
    );
  }
  get pinsDown() {
    return this.pins.filter((pin) => this.pinDown(pin)).length;
  }
  pinsStill() {
    const { Body } = this.M;
    return this.pins.every(
      (pin) =>
        Body.getSpeed(pin) < 0.3 && Math.abs(Body.getAngularVelocity(pin)) < 0.03,
    );
  }
  bowlingResult() {
    if (!this.bowling) return null;
    const pins = this.pinsDown;
    return {
      pins,
      strike: pins === this.pins.length,
      cartHit: this.bowling.cartHit,
      riderHit: this.bowling.riderHit,
      // The rider (not the cart) did all the work: no cart contact at all.
      riderOnly: this.bowling.riderHit && !this.bowling.cartHit,
      maxSpeed: this.skills.runwayCapReached,
    };
  }
  createVehicle() {
    const { Bodies, Body, Composite, Constraint } = this.M,
      x = this.course.startX;
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
    Body.setMass(this.cart, 5.5 * (this.runEffects?.mass ?? 1));
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
    this.damage.ejectionPending = true;
  }
  crash(severe = false, classification = null) {
    if (!this.crashed) {
      this.crashed = true;
      this.events.push("crash");
      this.crashClassification = classification;
    }
    this.severeCrash ||= severe;
    if (severe) this.detach();
  }
  handleCollisions(pairs) {
    for (const pair of pairs) {
      const a = pair.bodyA.parent,
        b = pair.bodyB.parent;
      if (this.bowling && (a.label.startsWith("pin ") || b.label.startsWith("pin "))) {
        const other = a.label.startsWith("pin ") ? b : a;
        const hit =
          other === this.cart || this.wheels.includes(other)
            ? "cartHit"
            : this.rider.includes(other)
              ? // Only a rider thrown clear of the cart counts as flying in.
                this.attached
                ? "cartHit"
                : "riderHit"
              : null;
        if (hit) {
          if (!this.bowling[hit]) this.events.push(hit === "riderHit" ? "riderPins" : "pinsHit");
          this.bowling[hit] = true;
          this.bowling.firstHitTime ??= this.elapsed;
        }
        continue;
      }
      if (this.bar && (a === this.bar || b === this.bar)) {
        const other = a === this.bar ? b : a;
        if (!other.isStatic) {
          const part =
            other === this.head
              ? "head"
              : other === this.cart
                ? "cart"
                : this.wheels.includes(other)
                  ? "wheel"
                  : "rider";
          if (!this.highJump.hitBy.includes(part)) this.highJump.hitBy.push(part);
          if (part === "head") this.highJump.face = true;
        }
        continue;
      }
      const terrain = a.isStatic ? a : b.isStatic ? b : null;
      const body = terrain === a ? b : a;
      if (!terrain || body.isStatic) continue;
      const speed = this.preSpeeds?.get(body.id) || { x: 0, y: 0 };
      this.damage.contact(body, terrain, speed);
      if (terrain.coursePiece?.type === "obstacle" &&
          (body === this.head || body === this.torso))
        this.crash(Math.hypot(speed.x, speed.y) > 3.2 * this.character.landingStability,
          "obstacle-impact");
      if (
        this.launched &&
        !this.landed &&
        this.landingSurfaces.has(terrain) &&
        (body === this.cart || this.wheels.includes(body) || this.rider.includes(body))
      ) {
        // collisionStart runs after integration: this step's rotation happened
        // in the air and must count even though it ends in ground contact.
        this.tricks.land(trickSample(this));
        this.airRotation = Math.abs(this.tricks.signedRotation);
        this.landed = true;
        this.landingTime = this.elapsed;
        this.landingAngle = this.cart.angle;
        this.landingSpeed = Math.abs(this.preSpeeds.get(this.cart.id).y);
        const velocity = this.preSpeeds.get(this.cart.id), normal = pair.collision?.normal || { x: 0, y: 1 };
        // Normal approach speed in world pixels/second, measured once before
        // the solver/brace changes motion. Lower means a quieter first impact.
        this.impactLoudness = Math.round(Math.abs(velocity.x * normal.x + velocity.y * normal.y) * 600) / 10;
        this.skills.onLanding(this);
        this.distancePixels = Math.max(
          0,
          this.cart.position.x - this.course.distanceOrigin,
        );
        const tilt = Math.abs(normalAngle(this.cart.angle));
        if (tilt > 1.15 * this.character.landingStability)
          this.crash(
            tilt > 1.65 &&
              this.landingSpeed > 3 * (this.runEffects?.harnessTolerance ?? 1),
            "overturned",
          );
        this.events.push("land");
        // A little rolling resistance lets a good landing actually settle.
        // Bowling lanes keep the cart rolling toward the pins instead.
        if (!this.course.rollOut)
          for (const dynamic of this.dynamic)
            dynamic.frictionAir = this.runEffects?.landingAirFriction ?? 0.045;
      }
      if ((body === this.head || body === this.torso) && this.elapsed > 0.4) {
        this.crash(
          Math.hypot(speed.x, speed.y) >
            3.2 *
              this.character.landingStability *
              this.skills.impactTolerance *
              (this.runEffects?.harnessTolerance ?? 1),
          body === this.head ? "head-impact" : "torso-impact",
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
    // Bowling: a small nudge on the lane tilts the cart to aim high or low.
    if (this.course.laneNudge && this.landed && !this.crashed)
      this.cart.torque +=
        rotate *
        this.cart.inertia *
        0.00006 *
        this.course.laneNudge *
        this.character.rotationControl;
    this.runEffects?.step(this, STEP_MS / 1000);
    Engine.update(this.engine, STEP_MS);
    if (!this.hasFiniteBodies()) {
      this.stopInvalid(safeMetrics);
      return;
    }
    this.damage.afterStep(STEP_MS / 1000);
    this.updateCargo();
    this.updateBar();
    this.updateCoursePieces();
    if (this.finished) return;
    // Settle the cart's spin on the ramp (takeoff.rampSettle): no wheelie.
    if (
      !this.launched &&
      this.cart.position.x >= this.course.rampStart &&
      this.cart.position.x < this.course.rampEnd
    )
      Body.setAngularVelocity(
        this.cart,
        this.cart.angularVelocity * this.skills.config.takeoff.rampSettle,
      );
    // Follow-through can cross the runway cap between explicit impulses.
    // Record the fact without clamping or otherwise changing existing motion.
    if (
      !this.launched &&
      this.cart.position.x < this.skills.config.takeoff.armedX &&
      Body.getVelocity(this.cart).x >= this.skills.config.rhythm.maximumSpeed
    )
      this.skills.runwayCapReached = true;
    if (
      !this.launched &&
      this.cart.position.x > this.course.rampEnd + 35 &&
      this.wheels.every(
        (w) =>
          w.position.x > this.course.rampEnd &&
            w.position.y < this.course.groundY - 45,
      )
    ) {
      this.launched = true;
      this.launchAngle = this.cart.angle;
      this.launchTime = this.elapsed;
      this.skills.onLaunch(this);
      applySyncLaunch(this);
      this.tricks.start(trickSample(this));
      this.events.push("launch");
    }
    if (this.launched && !this.landed) {
      this.tricks.sample(trickSample(this));
      this.airRotation = Math.abs(this.tricks.signedRotation);
      this.distancePixels = Math.max(
        0,
        this.cart.position.x - this.course.distanceOrigin,
      );
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
      // Bowling: the throw only ends once the pins have stopped tumbling.
      const allStill = still(this.cart) && riderStill && (!this.bowling || this.pinsStill()) && this.propsStill();
      this.settleTime = allStill ? this.settleTime + STEP_MS / 1000 : 0;
      this.riderSettleTime = riderStill
        ? this.riderSettleTime + STEP_MS / 1000
        : 0;
      if (this.settleTime > 0.75)
        this.finish(this.crashed ? "Crash settled" : "Landing settled");
      else if (
        this.crashed &&
        !this.attached &&
        this.riderSettleTime > 1 &&
        (!this.bowling || this.pinsStill()) && this.propsStill()
      )
        this.finish("Rider came to rest");
    }
    if (!this.launched && this.elapsed >= RUNUP_LIMIT)
      this.finish("Run-up time expired");
    else if (this.elapsed >= ATTEMPT_LIMIT) this.finish("Attempt time limit");
    else if (
      this.dynamic.some((b) => b.position.y > this.course.groundY + 1280) ||
      this.cart.position.x > this.course.endX
    )
      this.finish("Out of bounds");
  }
  hasFiniteBodies() {
    return [...this.dynamic, ...this.looseProps].every(
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
      impactLoudness: this.impactLoudness,
      crashCause: this.crashClassification,
      ...this.propFacts(),
      reason: this.reason,
      ...this.skills.metrics(),
      trickSummary: this.tricks.snapshot(),
      sync: this.syncResult || null,
      highJump: this.highJumpResult(),
      bowling: this.bowlingResult(),
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
    this.pitFalls.clear();
    this.disposed = true;
  }
}
