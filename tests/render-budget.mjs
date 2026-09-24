import { timedInputs } from "./skill-helpers.mjs";
// Optional native-Canvas rendering benchmark. This does not measure browser FPS.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { createRequire } from "node:module";
import { Renderer } from "../js/renderer.js";
import { PhysicsWorld } from "../js/physics.js";
import { CHARACTERS } from "../js/characters.js";
import { Presentation } from "../js/presentation.js";
import { Effects } from "../js/effects.js";
const require = createRequire(import.meta.url);
let native;
try {
  native = require("@napi-rs/canvas");
} catch {
  native = createRequire(new URL("../.qa/package.json", import.meta.url))(
    "@napi-rs/canvas",
  );
}
runInThisContext(
  readFileSync(
    new URL("../vendor/matter-0.20.0.min.js", import.meta.url),
    "utf8",
  ),
);
globalThis.window = { devicePixelRatio: 1 };
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
};
const folder = new URL("../.qa/polish/renders/", import.meta.url);
mkdirSync(folder, { recursive: true });
let box = { width: 1246, height: 560 };
const canvas = native.createCanvas(box.width, box.height);
canvas.getBoundingClientRect = () => box;
const renderer = new Renderer(canvas),
  world = new PhysicsWorld(CHARACTERS[2]);
const presentation = new Presentation({ dataset: {} }, null);
presentation.replaceWorld(world);
const save = (name) =>
  writeFileSync(new URL(name + ".png", folder), canvas.toBuffer("image/png"));
let launch = false,
  impact = false,
  impactDelay = 0;
for (let i = 0; i < 2500 && !world.finished; i++) {
  world.step(timedInputs(world, world.launched ? 1 : 0));
  presentation.observe(world);
  presentation.frame(world, true, false, 1 / 120, 1000 / 120);
  if (world.launched && !launch) {
    launch = true;
    renderer.draw(world, 1 / 60, presentation.effects);
    save("launch-desktop");
    box = { width: 330, height: 420 };
    renderer.resize();
    renderer.draw(world, 1 / 60, presentation.effects);
    save("launch-narrow");
    box = { width: 1246, height: 560 };
    renderer.resize();
  }
  if (
    world.landed &&
    presentation.effects.particles.some((p) => p.kind === "spark") &&
    !impact &&
    ++impactDelay === 8
  ) {
    impact = true;
    renderer.draw(world, 1 / 60, presentation.effects);
    save("impact-sparks");
  }
}
assert.ok(launch && impact && !world.invalid);
function measure(effects) {
  const times = [];
  for (let i = 0; i < 270; i++) {
    const start = performance.now();
    renderer.draw(world, 1 / 60, effects);
    const duration = performance.now() - start;
    if (i >= 30) times.push(duration);
  }
  times.sort((a, b) => a - b);
  return {
    frames: times.length,
    meanMs: times.reduce((a, b) => a + b, 0) / times.length,
    p95Ms: times[Math.floor(times.length * 0.95)],
  };
}
const effects = new Effects();
effects.burst("dust", world.cart.position.x, world.cart.position.y, 48);
effects.burst("spark", world.cart.position.x, world.cart.position.y, 48);
effects.shake();
assert.equal(effects.particles.length, 96);
const desktop = {
  noParticles: measure(null),
  maximum96Particles: measure(effects),
};
box = { width: 330, height: 420 };
renderer.resize();
const narrow = {
  noParticles: measure(null),
  maximum96Particles: measure(effects),
};
// Repeat actual attempts in one process, then measure the identical render
// fixture again. Timings are evidence, not flaky pass/fail FPS thresholds.
const repeatedAttemptMs = [];
for (let attempt = 0; attempt < 40; attempt++) {
  const current = new PhysicsWorld(CHARACTERS[attempt % CHARACTERS.length]);
  presentation.replaceWorld(current);
  const start = performance.now();
  for (let step = 0; step < 2500 && !current.finished; step++) {
    current.step(timedInputs(current, 0, true));
    presentation.observe(current);
    presentation.frame(current, true, false, 1 / 120, 1000 / 120);
    if (step % 12 === 0) renderer.draw(current, 0.1, presentation.effects);
  }
  repeatedAttemptMs.push(performance.now() - start);
  assert.ok(current.finished && !current.invalid);
  current.dispose();
  assert.equal(Matter.Composite.allBodies(current.engine.world).length, 0);
  assert.equal(Matter.Composite.allConstraints(current.engine.world).length, 0);
  assert.equal(current.engine.events.collisionStart.length, 0);
  assert.equal(current.engine.pairs.list.length, 0);
}
presentation.replaceWorld(world);
const afterRepeatedAttempts = measure(effects);
const average = (values) => values.reduce((a, b) => a + b, 0) / values.length;
console.log(
  JSON.stringify(
    {
      renderer: "native Canvas; not a browser",
      desktop,
      narrow,
      actualImpactRendered: true,
      repeatAudit: {
        attempts: repeatedAttemptMs.length,
        firstTenMeanMs: average(repeatedAttemptMs.slice(0, 10)),
        lastTenMeanMs: average(repeatedAttemptMs.slice(-10)),
        narrowMaximum96ParticlesAfter: afterRepeatedAttempts,
        disposedBodiesConstraintsCallbacksAndPairs: true,
      },
    },
    null,
    2,
  ),
);
renderer.destroy();
world.dispose();
presentation.destroy();
