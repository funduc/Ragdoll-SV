import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { audioDouble } from "./fake-audio.mjs";
import { SynthAudio, MAX_VOICES } from "../js/audio.js";
import { Effects, MAX_PARTICLES } from "../js/effects.js";
import { Presentation } from "../js/presentation.js";
import { CHARACTERS } from "../js/characters.js";
import { PhysicsWorld } from "../js/physics.js";
import { scoreAttempt } from "../js/scoring.js";
runInThisContext(
  readFileSync(
    new URL("../vendor/matter-0.20.0.min.js", import.meta.url),
    "utf8",
  ),
);
let checks = 0;
async function check(name, fn) {
  await fn();
  checks++;
  console.log(`PASS ${name}`);
}

await check(
  "Particle bursts are capped, finite, short-lived, and reset without timers",
  () => {
    const effects = new Effects();
    effects.burst("dust", NaN, 0);
    assert.equal(effects.particles.length, 0);
    effects.burst("dust", 100, 200, 1000);
    effects.burst("spark", 100, 200, 1000);
    assert.equal(effects.particles.length, MAX_PARTICLES);
    effects.shake();
    for (let i = 0; i < 150; i++) {
      effects.update(1 / 60);
      const offset = effects.offset();
      assert.ok(Math.abs(offset.x) <= 4 && Math.abs(offset.y) <= 2.6);
      for (const p of effects.particles) assert.ok(Number.isFinite(p.x + p.y));
      if (i === 14) assert.equal(effects.shakeTime, 0);
    }
    assert.equal(effects.particles.length, 0);
    effects.victory();
    assert.equal(effects.particles.length, 48);
    effects.clear();
    assert.equal(effects.particles.length, 0);
    effects.update(Infinity);
    assert.equal(effects.time, 0);
  },
);
await check(
  "Reduced motion disables confetti/shake and restricts dust/sparks",
  () => {
    const effects = new Effects(true);
    effects.victory();
    effects.shake();
    assert.equal(effects.particles.length, 0);
    assert.equal(effects.shakeTime, 0);
    effects.burst("dust", 0, 0, 30);
    assert.equal(effects.particles.length, 4);
  },
);

class Button extends EventTarget {
  setAttribute(name, value) {
    this[name] = value;
  }
}
function environment(Context) {
  const env = new EventTarget();
  env.AudioContext = Context;
  const storage = new Map();
  env.localStorage = {
    getItem: (k) => storage.get(k),
    setItem: (k, v) => storage.set(k, v),
  };
  return env;
}
await check(
  "Audio is lazy, one-context, bounded, mute-persistent, and disposes all nodes",
  () => {
    let now = 0;
    const Context = audioDouble(() => now),
      env = environment(Context),
      button = new Button();
    const audio = new SynthAudio(button, env);
    audio.play("victory");
    assert.equal(Context.instances.length, 0);
    env.dispatchEvent(new Event("pointerdown"));
    const ctx = Context.instances[0];
    for (const cue of [
      "click",
      "rattle",
      "launch",
      "impact",
      "crowd",
      "elimination",
      "victory",
    ]) {
      const before = ctx.createdSources;
      audio.play(cue);
      assert.ok(ctx.createdSources > before, cue);
      now += 2;
      ctx.tick();
      assert.equal(audio.voices.size, 0, cue);
      assert.equal(ctx.connected.size, 1, "only master remains after a cue");
    }
    for (let i = 0; i < 20; i++) {
      now += 0.1;
      audio.play("victory");
    }
    assert.equal(audio.voices.size, MAX_VOICES);
    audio.toggle();
    ctx.tick();
    assert.equal(audio.voices.size, 0);
    assert.equal(ctx.connected.size, 1);
    assert.equal(env.localStorage.getItem("santor-vault:muted"), "true");
    const created = ctx.createdSources;
    audio.play("impact");
    assert.equal(ctx.createdSources, created);
    audio.resetAttempt();
    assert.equal(audio.muted, true);
    audio.toggle();
    env.dispatchEvent(new Event("keydown"));
    assert.equal(Context.instances.length, 1);
    audio.setPaused(true);
    assert.equal(audio.voices.size, 0);
    audio.setPaused(false);
    now += 2;
    ctx.tick();
    audio.play("victory");
    audio.destroy();
    audio.destroy();
    assert.equal(ctx.state, "closed");
    assert.equal(ctx.connected.size, 0);
    assert.equal(ctx.sources.size, 0);
    env.dispatchEvent(new Event("pointerdown"));
    assert.equal(Context.instances.length, 1);
  },
);
await check(
  "Unavailable audio, denied construction/resume, and storage restrictions are harmless",
  async () => {
    for (const Context of [
      undefined,
      class {
        constructor() {
          throw new Error("denied");
        }
      },
    ]) {
      const env = environment(Context),
        button = new Button(),
        audio = new SynthAudio(button, env);
      env.dispatchEvent(new Event("keydown"));
      audio.play("launch");
      audio.toggle();
      audio.destroy();
      assert.equal(button.textContent, "SOUND N/A");
      assert.equal(button.disabled, true);
    }
    const Context = audioDouble(),
      env = environment(Context);
    Object.defineProperty(env, "localStorage", {
      get() {
        throw new Error("denied");
      },
    });
    const audio = new SynthAudio(new Button(), env);
    audio.unlock();
    audio.context.state = "suspended";
    audio.context.resume = () => Promise.reject(new Error("blocked"));
    audio.unlock();
    await audio.resuming;
    audio.play("launch");
    audio.toggle();
    audio.destroy();
  },
);
await check(
  "Presentation observes real launch/landing/crash events without changing bodies or scores",
  () => {
    const events = new Set(),
      kinds = new Set();
    let shakes = 0;
    function run(character, present) {
      const world = new PhysicsWorld(character);
      const p = present ? new Presentation({ dataset: {} }, null) : null;
      if (p) {
        p.audio.play = (cue) => events.add(cue);
        const burst = p.effects.burst.bind(p.effects);
        p.effects.burst = (kind, ...rest) => {
          kinds.add(kind);
          burst(kind, ...rest);
        };
        const shake = p.effects.shake.bind(p.effects);
        p.effects.shake = () => {
          shakes++;
          shake();
        };
        p.replaceWorld(world);
      }
      for (let i = 0; i < 2500 && !world.finished; i++) {
        world.step({ accelerate: true, rotate: world.launched ? 1 : 0 });
        if (p) {
          const snapshot = world.dynamic.map((b) => [
            b.position.x,
            b.position.y,
            b.angle,
            b.velocity.x,
            b.velocity.y,
            b.angularVelocity,
          ]);
          p.observe(world);
          p.frame(world, true, false, 1 / 120, 1000 / 120);
          assert.deepEqual(
            world.dynamic.map((b) => [
              b.position.x,
              b.position.y,
              b.angle,
              b.velocity.x,
              b.velocity.y,
              b.angularVelocity,
            ]),
            snapshot,
          );
          assert.ok(p.effects.particles.length <= MAX_PARTICLES);
        }
      }
      assert.ok(world.finished && !world.invalid);
      const score = scoreAttempt(world.metrics(), character);
      p?.destroy();
      world.dispose();
      return score;
    }
    for (const character of CHARACTERS)
      assert.deepEqual(run(character, true), run(character, false));
    assert.ok(events.has("launch") && events.has("impact"));
    assert.ok(kinds.has("dust") && kinds.has("spark"));
    assert.ok(shakes > 0);
  },
);
console.log(`${checks} presentation groups passed.`);
