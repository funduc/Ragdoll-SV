import { TRICK_CONFIG as C, trickProfile } from "./trick-config.js";
const wrapped = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const finite = (value) => Number.isFinite(value);

// Pure, attempt-local recognition. No forces, DOM, input listeners or wall timers.
export class TrickTracker {
  constructor(character) {
    this.profile = trickProfile(character);
    this.started = false;
    this.closed = false;
    this.finalized = false;
    this.lastTime = 0;
    this.lastAngle = 0;
    this.signedRotation = 0;
    this.angularTravel = 0;
    this.direction = 0;
    this.runStart = 0;
    this.extreme = 0;
    this.runTurns = 0;
    this.forward = 0;
    this.backward = 0;
    this.counts = {};
    this.awards = [];
    this.notices = [];
    this.unique = new Set();
    this.comboUnique = new Set();
    this.combo = 1;
    this.bestCombo = 1;
    this.comboBreaks = 0;
    this.unstableTime = 0;
    this.instabilityLatched = false;
    this.airTime = 0;
    this.controlledTime = 0;
    this.strainTime = 0;
    this.strainPending = false;
    this.strainRecovery = 0;
    this.nextStrain = 0;
    this.extremeTime = 0;
    this.lastExtreme = -Infinity;
    this.levelTime = 0;
    this.appealAt = -Infinity;
    this.finalSnapshot = null;
  }
  start(sample) {
    if (
      this.started ||
      this.finalized ||
      !finite(sample.angle) ||
      !finite(sample.time)
    )
      return;
    this.started = true;
    this.lastAngle = sample.angle;
    this.lastTime = sample.time;
  }
  notice(name, combo = this.combo) {
    this.notices.push({ name, combo });
    if (this.notices.length > C.popup.maximumQueue) this.notices.shift();
  }
  award(id, time) {
    if (
      this.finalized ||
      this.closed ||
      !Object.hasOwn(C.tricks, id) ||
      this.awards.length >= C.maximumOccurrences
    )
      return;
    const trick = C.tricks[id];
    const occurrence = (this.counts[id] = (this.counts[id] || 0) + 1);
    const repeat =
      C.repeatFactors[Math.min(occurrence - 1, C.repeatFactors.length - 1)];
    if (repeat > 0) {
      this.unique.add(id);
      if (!this.instabilityLatched) this.comboUnique.add(id);
      this.combo = Math.min(
        C.combo.maximum,
        1 +
          Math.max(0, this.comboUnique.size - 1) *
            C.combo.increment *
            (this.profile.varietyScale || 1),
      );
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.notice(trick.name + (occurrence > 1 ? " · REPEAT" : ""));
    }
    this.awards.push(
      Object.freeze({
        id,
        occurrence,
        time,
        base: trick.points,
        repeat,
        combo: this.combo,
        points: Math.round(trick.points * repeat * this.combo),
      }),
    );
  }
  breakCombo() {
    if (this.comboUnique.size) {
      this.comboBreaks++;
      this.notice("COMBO BROKEN", 1);
    }
    this.comboUnique.clear();
    this.combo = 1;
  }
  updateCombo(sample, dt) {
    const unstable =
      !sample.attached ||
      sample.strain > (this.profile.comboStrain ?? C.combo.strain) ||
      Math.abs(sample.spin) > C.combo.spinSpeed;
    this.unstableTime = unstable ? this.unstableTime + dt : 0;
    if (!unstable) this.instabilityLatched = false;
    if (
      (!sample.attached ||
        this.unstableTime >= (this.profile.comboGrace ?? C.combo.grace)) &&
      !this.instabilityLatched
    ) {
      this.breakCombo();
      this.instabilityLatched = true;
    }
  }
  rotation(delta, time) {
    const r = C.rotation;
    this.signedRotation += delta;
    this.angularTravel += Math.abs(delta);
    if (
      !this.direction &&
      Math.abs(this.signedRotation - this.runStart) >= r.directionThreshold
    ) {
      this.direction = Math.sign(this.signedRotation - this.runStart);
      this.extreme = this.signedRotation;
    }
    if (!this.direction) return;
    if (this.direction * (this.signedRotation - this.extreme) > 0)
      this.extreme = this.signedRotation;
    if (
      this.direction * (this.extreme - this.signedRotation) >
      r.reversalTolerance
    ) {
      this.direction *= -1;
      this.runStart = this.extreme;
      this.extreme = this.signedRotation;
      this.runTurns = 0;
    }
    const turns = Math.floor(
      (this.direction * (this.signedRotation - this.runStart) + r.epsilon) /
        r.fullTurn,
    );
    while (turns > this.runTurns) {
      this.runTurns++;
      if (this.direction > 0) {
        this.forward++;
        this.award("front", time);
      } else {
        this.backward++;
        this.award("back", time);
      }
      if (this.runTurns % 2 === 0) this.award("double", time);
    }
  }
  attachments(sample, dt) {
    if (!sample.attached) {
      this.strainPending = false;
      this.strainTime = this.strainRecovery = 0;
      return;
    }
    const c = C.noHands;
    this.strainTime = sample.strain >= c.strain ? this.strainTime + dt : 0;
    if (
      sample.time >= this.nextStrain &&
      this.strainTime + 1e-9 >= c.strainTime
    )
      this.strainPending = true;
    if (!this.strainPending) return;
    this.strainRecovery =
      sample.strain <= c.recovered ? this.strainRecovery + dt : 0;
    if (this.strainRecovery + 1e-9 >= c.recoveryTime) {
      this.award("noHands", sample.time);
      this.strainPending = false;
      this.strainTime = this.strainRecovery = 0;
      this.nextStrain = sample.time + c.cooldown;
    }
  }
  sample(sample) {
    if (
      !this.started ||
      this.closed ||
      this.finalized ||
      sample.time <= this.lastTime
    )
      return false;
    if (
      ![
        sample.time,
        sample.angle,
        sample.spin,
        sample.strain,
        sample.distance,
      ].every(finite)
    )
      return false;
    const dt = sample.time - this.lastTime;
    const delta = wrapped(sample.angle - this.lastAngle);
    this.lastTime = sample.time;
    this.lastAngle = sample.angle;
    if (Math.abs(delta) > C.rotation.maximumStep) {
      // A corrupt/teleported sample cannot bridge two partial spins.
      this.direction = 0;
      this.runStart = this.extreme = this.signedRotation;
      this.runTurns = 0;
      this.breakCombo();
      this.strainPending = false;
      this.appealAt = this.lastExtreme = -Infinity;
      this.angularTravel = Infinity;
      return false;
    }
    this.airTime += dt;
    this.updateCombo(sample, dt);
    this.rotation(delta, sample.time);
    this.attachments(sample, dt);
    const tilt = Math.abs(wrapped(sample.angle)),
      spin = Math.abs(sample.spin),
      clean = C.cleanFlight,
      appeal = C.appeal;
    if (sample.attached && tilt <= clean.angle && spin <= clean.speed)
      this.controlledTime += dt;
    this.extremeTime = tilt >= appeal.extremeAngle ? this.extremeTime + dt : 0;
    if (this.extremeTime >= appeal.extremeTime) this.lastExtreme = sample.time;
    const recovered =
      sample.attached &&
      tilt <= appeal.recoveryAngle &&
      spin <= appeal.recoverySpeed;
    if (!recovered) {
      this.levelTime = 0;
      this.appealAt = -Infinity;
    } else {
      this.levelTime += dt;
      if (
        this.levelTime >= appeal.recoveryTime &&
        sample.time - this.lastExtreme <= appeal.recoveryWindow &&
        !finite(this.appealAt)
      )
        this.appealAt = sample.time;
    }
    return true;
  }
  land(sample) {
    if (!this.started || this.closed || this.finalized) return;
    // Include the integration step that first touched ground; never reward a
    // corrupt contact sample or a duplicate timestamp.
    if (!this.sample(sample)) {
      this.closed = true;
      return;
    }
    const c = C.cleanFlight;
    if (
      sample.attached &&
      sample.time - this.appealAt <= C.appeal.landingWindow &&
      Math.abs(wrapped(sample.angle)) <= C.appeal.recoveryAngle
    )
      this.award("appeal", sample.time);
    if (
      sample.attached &&
      this.airTime >= c.minimumTime &&
      sample.distance >= c.minimumDistance &&
      this.controlledTime / this.airTime >= c.controlledFraction &&
      this.angularTravel <= c.maximumTravel
    )
      this.award("clean", sample.time);
    this.closed = true;
  }
  snapshot() {
    return (
      this.finalSnapshot ||
      Object.freeze({
        awards: Object.freeze(this.awards.slice()),
        forward: this.forward,
        backward: this.backward,
        unique: this.unique.size,
        bestCombo: this.bestCombo,
        comboBreaks: this.comboBreaks,
        finalized: this.finalized,
      })
    );
  }
  finalize() {
    if (this.finalized) return this.finalSnapshot;
    this.closed = true;
    this.finalized = true;
    this.finalSnapshot = this.snapshot();
    return this.finalSnapshot;
  }
  drainNotices() {
    return this.notices.splice(0);
  }
}

export function trickSample(world) {
  const { Constraint } = world.M;
  const strain = world.attached
    ? Math.min(
        ...world.harness.slice(1).map((constraint) => {
          const a = Constraint.pointAWorld(constraint),
            b = Constraint.pointBWorld(constraint);
          return Math.hypot(a.x - b.x, a.y - b.y);
        }),
      )
    : 0;
  return {
    time: world.elapsed,
    angle: world.cart.angle,
    spin: world.M.Body.getAngularVelocity(world.cart) * 60,
    strain,
    attached: world.attached,
    distance: Math.max(0, world.cart.position.x - world.course.rampEnd),
  };
}

// Recompute every subtotal from bounded recognized events; do not trust stored totals.
export function scoreTricks(summary, character, landingQuality) {
  const details = [];
  const seen = new Map();
  for (const event of (Array.isArray(summary?.awards)
    ? summary.awards
    : []
  ).slice(0, C.maximumOccurrences)) {
    const trick = Object.hasOwn(C.tricks, event?.id)
      ? C.tricks[event.id]
      : null;
    if (!trick) continue;
    const occurrence = (seen.get(event.id) || 0) + 1;
    seen.set(event.id, occurrence);
    const repeat =
      C.repeatFactors[Math.min(occurrence - 1, C.repeatFactors.length - 1)];
    const combo = finite(event.combo)
      ? Math.max(1, Math.min(C.combo.maximum, event.combo))
      : 1;
    const points = Math.round(trick.points * repeat * combo);
    details.push(
      Object.freeze({
        id: event.id,
        name: trick.name,
        occurrence,
        base: trick.points,
        repeat,
        combo,
        points,
      }),
    );
  }
  const subtotal = details.reduce((sum, event) => sum + event.points, 0);
  const characterMultiplier = finite(character.styleMultiplier)
    ? Math.max(
        0,
        Math.min(C.maximumCharacterMultiplier, character.styleMultiplier),
      )
    : 1;
  const landingMultiplier =
    C.landingFactors[landingQuality] ?? C.landingFactors["No landing"];
  const uncapped = Math.round(
    subtotal * characterMultiplier * landingMultiplier,
  );
  return Object.freeze({
    details: Object.freeze(details),
    subtotal,
    characterMultiplier,
    landingMultiplier,
    points: Math.min(C.maximumStylePoints, uncapped),
    capped: uncapped > C.maximumStylePoints,
    unique: seen.size,
    bestCombo: Math.max(1, ...details.map((e) => e.combo)),
    completedRotations: Math.max(
      0,
      Math.min(
        C.maximumOccurrences,
        Math.floor(
          (finite(summary?.forward) ? Math.max(0, summary.forward) : 0) +
            (finite(summary?.backward) ? Math.max(0, summary.backward) : 0),
        ),
      ),
    ),
  });
}
