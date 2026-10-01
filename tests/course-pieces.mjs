import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { defineCourse, groundSpans, MAX_COURSE_PROPS } from "../js/course.js";
import { PhysicsWorld } from "../js/physics.js";
import { CHARACTERS } from "../js/characters.js";
import { scoreAttempt } from "../js/scoring.js";
import { campaignFacts, combinedFacts } from "../js/campaign.js";
import { evaluateMedal, meetsThreshold } from "../js/campaign-levels.js";
import { Commentator, GENERAL_CAPTIONS } from "../js/commentary.js";
import { Renderer } from "../js/renderer.js";
import { defineTheme, THEMES } from "../js/themes.js";
import { ReplayRecording, ReplayPlayer } from "../js/replay.js";
import { Effects } from "../js/effects.js";

runInThisContext(readFileSync(new URL("../vendor/matter-0.20.0.min.js", import.meta.url), "utf8"));
const shape = { id: "pieces-test", groundY: 520, startX: -300, rampStart: 100,
  rampEnd: 300, rampTop: 400, endX: 3000, groundRight: 3500 };
const course = (pieces) => defineCourse({ ...shape, pieces });
const world = (pieces) => new PhysicsWorld(CHARACTERS[0], { course: course(pieces) });
const score = (w) => scoreAttempt(w.metrics(), w.character);
function stepUntil(w, predicate, limit = 1800) {
  for (let i = 0; i < limit && !w.finished && !predicate(); i++) w.step();
  assert.ok(predicate(), `condition not met: ${w.reason}`);
}
// Put a real constrained cart/rider in flight, then let Matter resolve contact.
function drop(w, x, bottom, velocity = { x: 0, y: 0 }) {
  const delta = { x: x - w.cart.position.x,
    y: bottom - Math.max(...w.dynamic.map((b) => b.bounds.max.y)) };
  for (const body of w.dynamic) {
    Matter.Body.translate(body, delta); Matter.Body.setVelocity(body, velocity);
  }
  w.launched = true; w.launchTime = w.elapsed;
}
function removeVehicle(w) {
  Matter.Composite.remove(w.engine.world,
    [...w.dynamic, ...w.axles, ...w.joints, ...w.harness]);
}
let groups = 0;
function test(name, fn) { fn(); groups++; console.log(`PASS ${name}`); }

test("Pits remove real ground, merge openings, crash on falling and never grant landing points", () => {
  const pits = [{ type: "pit", x: 1000, width: 900, depth: 140 },
    { type: "pit", x: 1400, width: 400, depth: 140 }];
  const w = world(pits);
  assert.deepEqual(groundSpans(w.course), [{ left: -1510, right: 550 }, { left: 1600, right: 3500 }]);
  assert.equal(w.groundBodies.length, 2);
  assert.equal(Matter.Query.point(w.groundBodies, { x: 1000, y: 550 }).length, 0);
  drop(w, 1000, 450);
  assert.equal(w.skills.contactETA(w), Infinity, "no fake ground brace target over a pit");
  stepUntil(w, () => w.finished);
  assert.ok(w.crashed && !w.landed);
  assert.equal(w.crashClassification, "pit-fall");
  assert.equal(score(w).crashCause, "pit-fall");
  assert.equal(score(w).landingPoints, 0);
  assert.equal(w.impactLoudness, null, "a pit is not a measured landing");
  assert.ok(w.drainEvents().includes("pit-fall"));
  const john = new Commentator();
  john.enqueue("launch", w.character, "qualifying", 0);
  john.enqueue("pit-fall", w.character, "qualifying", 1);
  assert.equal(john.tick(1), GENERAL_CAPTIONS["pit-fall"][0]);
  w.dispose();
  const flying = world(pits);
  drop(flying, 1000, 100, { x: 18, y: -2 });
  for (let i = 0; i < 80; i++) flying.step();
  assert.equal(flying.crashed, false, "flying across an opening is safe");
  flying.dispose();
  const sideways = world(pits);
  drop(sideways, 1000, 850);
  // The core has entered the opening, then continues sideways underneath
  // neighbouring ground before reaching the pit's kill depth.
  for (const body of sideways.dynamic) Matter.Body.translate(body, { x: 0, y: -150 });
  sideways.updateCoursePieces();
  assert.ok(sideways.pitFalls.size > 0);
  assert.equal(sideways.finished, false);
  for (const body of sideways.dynamic) Matter.Body.translate(body, { x: 1000, y: 200 });
  sideways.updateCoursePieces();
  assert.equal(sideways.crashClassification, "pit-fall");
  assert.equal(sideways.finished, true);
  sideways.dispose();
});

test("Platforms over pits count first contact once, while gaps between platforms stay empty", () => {
  const pieces = [{ type: "pit", x: 1200, width: 1600 },
    { type: "platform", x: 850, y: 400, width: 300, height: 30 },
    { type: "platform", x: 1550, y: 370, width: 300, height: 30 }];
  const w = world(pieces);
  drop(w, 850, 330);
  assert.ok(Number.isFinite(w.skills.contactETA(w)));
  stepUntil(w, () => w.landed);
  assert.ok(w.landingSurfaces.has(w.coursePieces[0]));
  assert.ok(Math.abs(w.cart.position.x - 850) < 5);
  assert.ok(w.impactLoudness > 0);
  const initial = [w.distancePixels, w.landingTime, w.impactLoudness];
  // A later fall still loses landing points without rewriting first contact.
  for (const body of w.dynamic) Matter.Body.translate(body, { x: 350, y: -100 });
  stepUntil(w, () => w.finished);
  assert.deepEqual([w.distancePixels, w.landingTime, w.impactLoudness], initial);
  assert.equal(w.crashClassification, "pit-fall");
  assert.equal(score(w).landingPoints, 0);
  w.dispose();
  const gap = world(pieces); drop(gap, 1200, 320);
  stepUntil(gap, () => gap.finished);
  assert.ok(!gap.landed && gap.crashed);
  gap.dispose();
});

test("Forward/backward conveyors transport contact bodies at their speed, never bodies in the air", () => {
  for (const speed of [120, -120]) {
    const w = world([{ type: "conveyor", x: 900, y: 450, width: 1100, height: 30, speed }]);
    removeVehicle(w);
    const crate = Matter.Bodies.rectangle(900, 410, 30, 30);
    const airborne = Matter.Bodies.rectangle(900, -200, 30, 30);
    const side = Matter.Bodies.rectangle(1465, 450, 30, 20);
    Matter.Composite.add(w.engine.world, [crate, airborne, side]);
    for (let i = 0; i < 90; i++) w.step();
    assert.equal(Matter.Body.getVelocity(crate).x, speed / 60);
    assert.ok((crate.position.x - 900) * Math.sign(speed) > 30);
    assert.equal(Matter.Body.getVelocity(airborne).x, 0);
    assert.ok(Math.abs(Matter.Body.getVelocity(side).x) < 0.1, "side contact is not a ride on the belt");
    w.dispose();
    const cart = world([{ type: "conveyor", x: 900, y: 450, width: 1100, height: 30, speed }]);
    drop(cart, 900, 360);
    stepUntil(cart, () => cart.landed);
    const x = cart.cart.position.x;
    for (let i = 0; i < 90; i++) cart.step();
    assert.ok((cart.cart.position.x - x) * Math.sign(speed) > 15, "belt carries the constrained cart too");
    cart.dispose();
  }
});

test("Loose stacks are real, light bodies; falls/line crossings count each prop only once", () => {
  const w = world([{ type: "props", x: 900, y: 504, width: 32, height: 32,
    columns: 2, rows: 3, lineX: 1020 }]);
  removeVehicle(w);
  for (let i = 0; i < 180; i++) w.step();
  assert.equal(w.looseProps.length, 6);
  assert.ok(w.looseProps.every((p) => !p.isStatic && Math.abs(p.mass - 0.3) < 1e-10));
  assert.deepEqual(w.propFacts(), { propsFallen: 0, propsPastLine: 0, propsMoved: 0 });
  const ball = Matter.Bodies.circle(760, 450, 35, { frictionAir: 0 });
  Matter.Body.setMass(ball, 12); Matter.Body.setVelocity(ball, { x: 14, y: 0 });
  Matter.Composite.add(w.engine.world, ball);
  for (let i = 0; i < 360; i++) w.step();
  assert.ok(w.propFacts().propsFallen >= 2);
  assert.ok(w.propFacts().propsPastLine >= 1);
  const before = w.propFacts();
  for (const prop of w.looseProps) {
    Matter.Body.setPosition(prop, prop.rest); Matter.Body.setAngle(prop, 0);
  }
  w.updateCoursePieces();
  assert.deepEqual(w.propFacts(), before, "returning upright or recrossing never removes earned counts");
  assert.ok(before.propsMoved <= 6, "fallen and crossed is one distinct prop");
  w.crash(); w.finish("Test finished");
  assert.equal(w.metrics().propsMoved, before.propsMoved);
  assert.equal(w.damage.summary().propsMoved, before.propsMoved);
  const facts = campaignFacts(score(w), w, true);
  assert.equal(facts.propsMoved, before.propsMoved);
  assert.equal(evaluateMedal({ bronze: { all: { propsMoved: 1 } } }, facts).medal, 1);
  w.dispose();
  assert.equal(Matter.Composite.allBodies(w.engine.world).length, 0);
  const left = world([{ type: "props", x: 900, y: 504, width: 32, height: 32, lineX: 800, lineDirection: -1 }]);
  Matter.Body.setVelocity(left.looseProps[0], { x: -12, y: -2 });
  stepUntil(left, () => left.propFacts().propsPastLine === 1);
  assert.equal(left.propFacts().propsMoved, 1); left.dispose();
});

test("Hanging obstacles crash on actual head/torso contact, not a cart-only contact", () => {
  for (const part of ["head", "torso", "cart"]) {
    const w = world([]); drop(w, 900, 350);
    const body = w[part];
    const obstacle = { type: "obstacle", x: body.position.x, y: body.position.y,
      width: 8, height: 8, label: "test sign" };
    // A second real world places the authored object at the selected body.
    const hit = world([obstacle]); drop(hit, 900, 350);
    hit.step();
    if (part === "cart") assert.equal(hit.crashed, false);
    else {
      assert.ok(hit.crashed && !hit.landed);
      assert.equal(hit.crashClassification, "obstacle-impact");
      assert.equal(score(hit).landingPoints, 0);
    }
    hit.dispose(); w.dispose();
  }
});

test("Impact loudness measures only the first landing and can bound quiet-landing medals", () => {
  const drops = [2, 10].map((speed) => {
    const w = world([{ type: "platform", x: 950, y: 450, width: 700, height: 30 }]);
    drop(w, 950, 410, { x: 0, y: speed });
    stepUntil(w, () => w.landed);
    const loudness = w.impactLoudness;
    assert.ok(Number.isFinite(loudness) && loudness > 0);
    for (let i = 0; i < 120; i++) w.step();
    assert.equal(w.impactLoudness, loudness);
    w.finish("Measured");
    const facts = campaignFacts(score(w), w, true); w.dispose();
    return facts;
  });
  assert.ok(drops[1].impactLoudness > drops[0].impactLoudness * 2);
  const quiet = { all: { completedJump: true }, max: { impactLoudness: drops[0].impactLoudness + 1 } };
  assert.ok(meetsThreshold(quiet, drops[0]));
  assert.ok(!meetsThreshold(quiet, drops[1]));
  assert.ok(!meetsThreshold(quiet, { completedJump: true, impactLoudness: null }));
  const combined = combinedFacts(drops.map((facts) => ({ facts, score: { total: 0 } })));
  assert.equal(combined.impactLoudness, drops[1].impactLoudness);
});

test("New geometry, loose poses and theme colours are drawn identically during replay", () => {
  globalThis.window = { devicePixelRatio: 1 };
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  const calls = [], ctx = new Proxy({}, {
    get: (_, key) => (...args) => {
      calls.push([key, ...args]);
      if (key === "createLinearGradient") return { addColorStop(...v) { calls.push(["stop", ...v]); } };
    },
    set: (_, key, value) => { calls.push([key, typeof value === "object" ? "gradient" : value]); return true; },
  });
  const theme = defineTheme({ id: "pieces-test", pieces: { props: { fill: "#123456" }, pit: { fill: "#654321" } } });
  const w = world([{ type: "pit", x: 1500, width: 200 },
    { type: "platform", x: 1900, y: 420, width: 200, height: 20 },
    { type: "conveyor", x: 2200, y: 480, width: 250, height: 30, speed: -90 },
    { type: "props", x: 900, y: 500, width: 40, height: 40, rows: 2, lineX: 1000 },
    { type: "obstacle", x: 1150, y: 250, width: 80, height: 20 }]);
  w.arena.theme = theme.id;
  const renderer = new Renderer({ getContext: () => ctx, getBoundingClientRect: () => ({ width: 1200, height: 560 }) },
    { themes: { ...THEMES, [theme.id]: theme } });
  const recording = new ReplayRecording(w), effects = new Effects();
  const draw = (sample) => {
    calls.length = 0; renderer.resetCamera(); renderer.draw(sample);
    return JSON.stringify(calls);
  };
  for (let i = 0; i < 40; i++) {
    w.step(); recording.capture(w, effects, {});
    const player = new ReplayPlayer(recording); player.time = w.elapsed;
    assert.equal(draw(player.sample().world), draw(w));
  }
  assert.match(draw(w), /#123456/); assert.match(draw(w), /#654321/);
  assert.ok(calls.some(([method]) => method === "clip"));
  assert.equal(recording.frames[0].world.looseProps.length, 2);
  const last = recording.frames.at(-1), previous = recording.frames.at(-2);
  const replay = new ReplayPlayer(recording); replay.time = (last.time + previous.time) / 2;
  assert.ok(Number.isFinite(replay.sample().world.looseProps[0].angle));
  renderer.destroy(); w.dispose();
});

test("Invalid new pieces fail at authoring time and loose props are bounded", () => {
  assert.throws(() => course([{ type: "pit", x: 200, width: 100 }]), RangeError);
  assert.throws(() => course([{ type: "pit", x: 600, width: -10 }]), RangeError);
  assert.throws(() => course([{ type: "conveyor", x: 900, y: 500, width: 200, height: 20, speed: NaN }]), TypeError);
  assert.throws(() => course([{ type: "props", x: 900, y: 500, width: 30, height: 30, rows: MAX_COURSE_PROPS + 1 }]), RangeError);
});
console.log(`${groups} course-piece groups passed.`);
