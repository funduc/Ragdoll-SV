import { SynthAudio } from "./audio.js";
import { Effects } from "./effects.js";
import { State } from "./tournament.js";
import { COURSE } from "./physics.js";

// A read-only observer of game state and Matter collision results. No physics writes.
export class Presentation {
  constructor(root, button) {
    this.root = root;
    this.audio = new SynthAudio(button);
    this.effects = new Effects(
      globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
        false,
    );
    this.lastState = null;
    this.lastCountdown = null;
  }
  replaceWorld(world) {
    this.world = world;
    this.launched = false;
    this.landed = false;
    this.crashed = false;
    this.nextImpact = 0;
    this.lastCountdown = null;
    this.effects.clear();
    this.audio.resetAttempt();
  }
  state(t) {
    this.root.dataset.round = t.round;
    this.root.dataset.broadcast =
      t.state === State.FINAL
        ? "maximum"
        : t.round === "championship"
          ? t.turn
            ? "overdrive"
            : "final"
          : "normal";
    if (this.lastState === t.state) return;
    this.lastState = t.state;
    if (t.state === State.ELIMINATION) this.audio.play("elimination");
    if (t.state === State.RESULTS) this.audio.play("crowd");
    if (t.state === State.FINAL) {
      this.effects.victory();
      this.audio.play("victory");
    }
    if (t.state === State.TITLE) this.effects.clear();
  }
  countdown(remaining) {
    const seconds = Math.ceil(remaining / 1000);
    if (seconds !== this.lastCountdown) {
      this.audio.play("countdown", seconds);
      this.lastCountdown = seconds;
    }
  }
  observe(world) {
    if (world !== this.world) this.replaceWorld(world);
    if (world.invalid) {
      this.effects.clear();
      return;
    }
    if (world.launched && !this.launched) {
      this.effects.burst(
        "dust",
        world.wheels[0].position.x,
        world.wheels[0].position.y,
        14,
      );
      this.audio.play("launch");
    }
    if (world.landed && !this.landed)
      this.effects.burst("dust", world.cart.position.x, COURSE.groundY - 3, 18);
    for (const pair of world.engine.pairs.collisionStart || []) {
      const a = pair.bodyA.parent,
        b = pair.bodyB.parent;
      if (
        !((a === world.cart && b.isStatic) || (b === world.cart && a.isStatic))
      )
        continue;
      const v = world.preSpeeds?.get(world.cart.id) || { x: 0, y: 0 };
      const normal = pair.collision.normal;
      const speed =
        Math.abs(v.x * normal.x + v.y * normal.y) +
        Math.abs(world.cart.angularVelocity) * 26;
      if (speed < 5 || world.elapsed < this.nextImpact) continue;
      this.nextImpact = world.elapsed + 0.18;
      const point = pair.collision.supports?.[0] || world.cart.position;
      this.effects.burst("spark", point.x, point.y, 16);
      this.audio.play("impact");
      if (speed > 9 && world.crashed) this.effects.shake();
    }
    if (world.crashed && !this.crashed) {
      this.audio.play("impact");
      const speed = world.preSpeeds?.get(world.head.id);
      if (!world.attached || (speed && Math.hypot(speed.x, speed.y) > 6))
        this.effects.shake();
    }
    this.launched = world.launched;
    this.landed = world.landed;
    this.crashed = world.crashed;
  }
  frame(world, active, paused, dt, gap) {
    this.audio.setPaused(paused);
    if (gap > 250) {
      this.effects.clear();
      this.audio.stopAll();
    }
    if (!paused) this.effects.update(dt);
    this.audio.rattle(world, active && !paused);
  }
  destroy() {
    this.audio.destroy();
    this.effects.clear();
  }
}
