// Crash-only damage and a separate, in-memory spectacle score. Nothing here
// participates in medal, objective, distance or ordinary point calculations.
export class CrashDamage {
  constructor(world) {
    this.world = world;
    this.lostParts = new Set();
    this.lostWheels = new Set();
    this.debris = [];
    this.impact = 0;
    this.impactWheel = null;
    this.ejectionPending = false;
    this.ejected = false;
    this.ejectedAt = null;
    this.airtime = 0;
    this.airSinceContact = 0;
    this.bounces = 0;
    this.distance = 0;
    this.wheelLostAt = null;
    this.landedAfterWheelLoss = false;
  }
  contact(body, terrain, velocity) {
    const w = this.world;
    if (body !== w.cart && !w.wheels.includes(body) && !w.rider.includes(body)) return;
    const speed = Math.hypot(velocity.x, velocity.y);
    if (speed > this.impact) {
      this.impact = speed;
      const index = w.wheels.indexOf(body);
      this.impactWheel = index >= 0 ? index : null;
    }
    if (w.launched && terrain === w.ground && this.wheelLostAt !== null &&
      w.elapsed > this.wheelLostAt && (body === w.cart || w.rider.includes(body)))
      this.landedAfterWheelLoss = true;
  }
  releaseWheel(index) {
    if (this.lostWheels.has(index)) return;
    const w = this.world, wheel = w.wheels[index];
    w.M.Composite.remove(w.engine.world, w.axles[index]);
    this.lostWheels.add(index);
    this.lostParts.add(`wheel-${index}`);
    this.wheelLostAt ??= w.elapsed;
    wheel.frictionAir = 0.006;
    wheel.restitution = 0.45;
    // Preserve the incoming motion when the axle stops holding the wheel.
    const velocity = w.preSpeeds.get(wheel.id);
    w.M.Body.setVelocity(wheel, { x: velocity.x, y: -Math.abs(velocity.y) * 0.65 });
    w.M.Body.setAngularVelocity(wheel, (index ? 1 : -1) * 0.24);
    w.events.push("part-loss");
  }
  releasePanel(id) {
    if (this.lostParts.has(id)) return;
    const w = this.world, { Bodies, Body, Composite } = w.M;
    const seat = id === "seat";
    const local = { x: w.cartArtOffset.x, y: w.cartArtOffset.y + (seat ? 13 : -2) };
    const cos = Math.cos(w.cart.angle), sin = Math.sin(w.cart.angle);
    const body = Bodies.rectangle(
      w.cart.position.x + local.x * cos - local.y * sin,
      w.cart.position.y + local.x * sin + local.y * cos,
      seat ? 46 : 78, seat ? 13 : 38,
      { label: id, angle: w.cart.angle, friction: 0.55, frictionAir: 0.006,
        restitution: 0.4, collisionFilter: { ...w.cart.collisionFilter } },
    );
    Body.setMass(body, seat ? 0.2 : 0.35);
    const velocity = w.preSpeeds.get(w.cart.id);
    Body.setVelocity(body, { x: velocity.x * (seat ? 1.1 : 0.8), y: -Math.abs(velocity.y) * (seat ? 0.8 : 0.6) - 2 });
    Body.setAngularVelocity(body, seat ? -0.22 : 0.18);
    this.debris.push(body);
    this.lostParts.add(id);
    // Panels become physical only after a crash; their intact artwork never
    // adds mass, contacts or constraints to the original vehicle.
    w.dynamic.push(body);
    Composite.add(w.engine.world, body);
    w.events.push("part-loss");
  }
  eject() {
    const w = this.world;
    this.ejected = true;
    this.ejectedAt = w.elapsed;
    this.originX = w.torso.position.x;
    for (const body of w.rider) {
      const velocity = w.preSpeeds.get(body.id);
      // Apply after the collision solver: it must not erase the incoming
      // momentum in the same step. Redirect downward motion into the rebound.
      w.M.Body.setVelocity(body, { x: velocity.x, y: -Math.abs(velocity.y) });
      body.frictionAir = 0.008;
      body.restitution = 0.35;
    }
    w.events.push("ejection");
  }
  afterStep(dt) {
    const w = this.world;
    if (w.crashed) {
      if (this.impact >= 6) {
        const index = this.impactWheel ?? (w.cart.angle >= 0 ? 1 : 0);
        this.releaseWheel(index);
      }
      if (this.impact >= 8) this.releasePanel("grille");
      if (this.impact >= 11) this.releasePanel("seat");
      if (this.impact >= 18) {
        this.releaseWheel(0);
        this.releaseWheel(1);
      }
      if (this.ejectionPending && !this.ejected) this.eject();
    }
    this.impact = 0;
    this.impactWheel = null;
    this.ejectionPending = false;
    if (!this.ejected) return;
    const core = [w.head, w.torso, w.hips];
    const grounded = w.engine.pairs.list.some(pair => pair.isActive && (
      (pair.bodyA.parent.isStatic && core.includes(pair.bodyB.parent)) ||
      (pair.bodyB.parent.isStatic && core.includes(pair.bodyA.parent))
    ));
    if (!grounded) {
      this.airtime += dt;
      this.airSinceContact += dt;
    } else {
      // One count per return from flight, not one per limb or solver contact.
      if (this.airSinceContact >= 0.08) this.bounces++;
      this.airSinceContact = 0;
    }
    this.distance = Math.max(this.distance, Math.abs(w.torso.position.x - this.originX) / 40);
  }
  summary() {
    if (!this.world.crashed || this.world.invalid) return null;
    const partsLost = this.lostParts.size;
    const airtime = Math.round(this.airtime * 10) / 10;
    const distance = Math.round(this.distance * 10) / 10;
    return Object.freeze({
      partsLost, airtime, bounces: this.bounces, distance,
      total: Math.round(partsLost * 150 + airtime * 100 + this.bounces * 75 + distance * 10),
    });
  }
}
