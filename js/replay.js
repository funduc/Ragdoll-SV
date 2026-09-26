import { Effects } from "./effects.js";

export const REPLAY_SECONDS = 20;
export const REPLAY_MAX_FRAMES = 4801;
const point = ({ x, y }) => ({ x, y });
const bodyPose = (body) => ({
  label: body.label,
  position: point(body.position),
  angle: body.angle,
  vertices: body.vertices.map(point),
});

// Only render data crosses this boundary: no engine, constraints or live bodies.
export class ReplayRecording {
  constructor(world) {
    this.frames = [];
    this.impactTime = null;
    this.crashTime = null;
    this.launchTime = null;
    this.scene = structuredClone({
      character: world.character,
      course: world.course,
      cartArtOffset: world.cartArtOffset,
      runwayBumps: world.runwayBumps.map(bodyPose),
      skills: { config: world.skills.config },
    });
  }
  observe(world) {
    if (world.launched && this.launchTime === null) this.launchTime = world.elapsed;
    if (world.landed && this.impactTime === null) this.impactTime = world.elapsed;
    if (world.crashed && this.crashTime === null) this.crashTime = world.elapsed;
  }
  capture(world, effects, cosmetics) {
    if (world.invalid || this.frames.at(-1)?.time === world.elapsed) return;
    this.observe(world);
    const rider = world.rider.map(bodyPose);
    const snapshot = {
      ...this.scene,
      cart: bodyPose(world.cart),
      wheels: world.wheels.map(bodyPose),
      rider,
      head: rider[world.rider.indexOf(world.head)],
      hips: rider[world.rider.indexOf(world.hips)],
      cargo: world.cargo ? bodyPose(world.cargo) : null,
      cargoLost: world.cargoLost,
      attached: world.attached,
      landed: world.landed,
      distancePixels: world.distancePixels,
      runEffects: world.runEffects ? {
        conditionId: world.runEffects.conditionId,
        objectiveId: world.runEffects.objectiveId,
        boostUsed: world.runEffects.boostUsed,
      } : null,
    };
    this.frames.push({
      time: world.elapsed, world: snapshot,
      particles: effects.particles.map(p => ({ ...p })),
      shake: effects.offset(),
      cosmetics: { ...cosmetics },
    });
    while (this.frames.length > REPLAY_MAX_FRAMES ||
      world.elapsed - this.frames[0].time > REPLAY_SECONDS) this.frames.shift();
  }
  get available() { return this.frames.length > 1; }
  shouldAutoPlay(score, reducedMotion) {
    return this.available && !reducedMotion &&
      (score.crashed || (this.impactTime !== null && score.distanceMetres > 55));
  }
}

function interpolateBody(a, b, fraction) {
  const x = a.position.x + (b.position.x - a.position.x) * fraction;
  const y = a.position.y + (b.position.y - a.position.y) * fraction;
  // Matter angles are unwrapped; retain complete rotations between samples.
  const turn = (b.angle - a.angle) * fraction;
  const cos = Math.cos(turn), sin = Math.sin(turn);
  return {
    ...a, position: { x, y }, angle: a.angle + turn,
    vertices: a.vertices.map(v => ({
      x: x + (v.x - a.position.x) * cos - (v.y - a.position.y) * sin,
      y: y + (v.x - a.position.x) * sin + (v.y - a.position.y) * cos,
    })),
  };
}

export class ReplayPlayer {
  constructor(recording, { automatic = false, reducedMotion = false } = {}) {
    this.recording = recording;
    this.reducedMotion = reducedMotion;
    this.time = automatic && recording.launchTime !== null
      ? Math.max(recording.frames[0].time, recording.launchTime - 0.7)
      : recording.frames[0].time;
    this.end = recording.frames.at(-1).time;
    this.impact = recording.crashTime ?? recording.impactTime;
    this.index = 0;
  }
  get speed() {
    return !this.reducedMotion && this.impact !== null &&
      this.time >= this.impact - 0.45 && this.time <= this.impact + 0.8 ? 0.3 : 1;
  }
  advance(seconds) { this.time = Math.min(this.end, this.time + seconds * this.speed); }
  get done() { return this.time >= this.end; }
  sample() {
    const frames = this.recording.frames;
    while (this.index + 1 < frames.length && frames[this.index + 1].time <= this.time) this.index++;
    const a = frames[this.index], b = frames[this.index + 1];
    let world = a.world;
    if (b && this.time > a.time) {
      const f = (this.time - a.time) / (b.time - a.time);
      const rider = a.world.rider.map((body, i) => interpolateBody(body, b.world.rider[i], f));
      world = {
        ...a.world,
        cart: interpolateBody(a.world.cart, b.world.cart, f),
        wheels: a.world.wheels.map((body, i) => interpolateBody(body, b.world.wheels[i], f)),
        rider,
        head: rider[a.world.rider.indexOf(a.world.head)],
        hips: rider[a.world.rider.indexOf(a.world.hips)],
        cargo: a.world.cargo ? interpolateBody(a.world.cargo, b.world.cargo, f) : null,
      };
    }
    return {
      world, cosmetics: a.cosmetics,
      effects: {
        particles: a.particles,
        offset: () => this.reducedMotion ? { x: 0, y: 0 } : a.shake,
        drawWorld: Effects.prototype.drawWorld,
        drawScreen: Effects.prototype.drawScreen,
      },
    };
  }
}

// Capture before gameplay/menu listeners. Consume the entire skip gesture so
// Enter, R or a tap cannot also activate a newly revealed results button.
export class ReplayControls {
  constructor(target, isPlaying, skip, input) {
    this.consumeClick = false;
    this.key = event => {
      if (!isPlaying()) { if (!event.repeat) this.consumeClick = false; return; }
      event.preventDefault(); event.stopImmediatePropagation();
      input.downKeys.add(event.code);
      this.consumeClick = true;
      skip();
    };
    this.pointer = event => {
      this.consumeClick = false;
      if (!isPlaying()) return;
      event.preventDefault(); event.stopImmediatePropagation();
      this.consumeClick = true;
      skip();
    };
    this.click = event => {
      if (!this.consumeClick && !isPlaying()) return;
      event.preventDefault(); event.stopImmediatePropagation();
      this.consumeClick = false;
      if (isPlaying()) skip();
    };
    this.target = target;
    target.addEventListener("keydown", this.key, true);
    target.addEventListener("pointerdown", this.pointer, true);
    target.addEventListener("click", this.click, true);
  }
  destroy() {
    this.target.removeEventListener("keydown", this.key, true);
    this.target.removeEventListener("pointerdown", this.pointer, true);
    this.target.removeEventListener("click", this.click, true);
  }
}
