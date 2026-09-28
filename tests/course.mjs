import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { rhythmPosition, SKILL_CONFIG } from "../js/skill-config.js";
import {
  COURSES,
  DEFAULT_COURSE,
  defineCourse,
  resolveCourse,
  pieceOutline,
} from "../js/course.js";
import { UPGRADES } from "../js/run-config.js";
runInThisContext(
  readFileSync(new URL("../vendor/matter-0.20.0.min.js", import.meta.url), "utf8"),
);
globalThis.window = new EventTarget();
window.devicePixelRatio = 1;
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
const { PhysicsWorld, COURSE } = await import("../js/physics.js");
const { CHARACTERS } = await import("../js/characters.js");
const { scoreAttempt } = await import("../js/scoring.js");
const { Renderer } = await import("../js/renderer.js");
const { ReplayRecording } = await import("../js/replay.js");

// A tiny test-only course: higher ground, short run-up, a small ramp, distance
// measured from a line past the ramp, a landing slab and an overhead bar.
const TINY = {
  id: "tiny-test",
  name: "Tiny Test Course",
  groundY: 600,
  startX: -600,
  rampStart: 200,
  rampEnd: 420,
  rampTop: 470,
  endX: 4000,
  distanceOrigin: 440,
  pieces: [
    { type: "rect", label: "landing slab", x: 1100, y: 585, width: 500, height: 30, landing: true },
    { type: "rect", label: "overhead bar", x: 900, y: 120, width: 300, height: 12, angle: 0.1 },
    { type: "polygon", label: "back ramp", points: [{ x: 2600, y: 600 }, { x: 2800, y: 500 }, { x: 2800, y: 600 }] },
  ],
};
let checks = 0;
const check = (name, fn) => {
  fn();
  checks++;
  console.log(`PASS ${name}`);
};

check("The default long-jump course keeps the original numbers", () => {
  assert.equal(COURSE, DEFAULT_COURSE);
  assert.equal(resolveCourse(), DEFAULT_COURSE);
  assert.equal(resolveCourse("long-jump"), COURSES["long-jump"]);
  const { groundY, rampStart, rampEnd, rampTop, startX, endX, distanceOrigin, groundLeft, groundRight, wallX, pieces } = DEFAULT_COURSE;
  assert.deepEqual(
    { groundY, rampStart, rampEnd, rampTop, startX, endX, distanceOrigin, groundLeft, groundRight, wallX, pieces },
    { groundY: 520, rampStart: 730, rampEnd: 1080, rampTop: 330, startX: -3000, endX: 10500, distanceOrigin: 1080, groundLeft: -4210, groundRight: 11000, wallX: -3310, pieces: [] },
  );
  assert.deepEqual(
    { ...DEFAULT_COURSE.takeoff },
    { armedX: 860, goodStart: 940, perfectStart: 980, perfectEnd: 1060, goodEnd: 1090 },
  );
  const w = new PhysicsWorld(CHARACTERS[0]);
  assert.equal(w.course, DEFAULT_COURSE);
  assert.equal(w.skills.config, SKILL_CONFIG, "the default course reuses the shared config");
  assert.equal(w.spawnOffsetY, 0);
  w.dispose();
});

check("Course data is validated", () => {
  assert.throws(() => defineCourse({ ...TINY, rampStart: 500 }), RangeError);
  assert.throws(() => defineCourse({ ...TINY, groundY: "high" }), TypeError);
  assert.throws(() => defineCourse({ ...TINY, pieces: [{ type: "blob" }] }), TypeError);
  assert.throws(() => defineCourse({ ...TINY, pieces: [{ type: "polygon", points: [{ x: 0, y: 0 }] }] }), TypeError);
  assert.throws(() => resolveCourse("moon-base"), RangeError);
  const tiny = defineCourse(TINY);
  assert.ok(Object.isFrozen(tiny.pieces[0]));
  assert.equal(resolveCourse(tiny), tiny, "a defined course is used as is");
});

check("A different course shape builds its own ground, ramp, pieces and spawn", () => {
  const w = new PhysicsWorld(CHARACTERS[1], { id: "test", gravity: 1.05, course: TINY });
  const reference = new PhysicsWorld(CHARACTERS[1]);
  assert.equal(w.course.id, "tiny-test");
  assert.equal(w.ground.bounds.min.y, 600);
  assert.ok(Math.abs(w.ramp.bounds.min.x - 200) < 1 && Math.abs(w.ramp.bounds.max.x - 420) < 1);
  assert.ok(Math.abs(w.ramp.bounds.min.y - 470) < 1);
  assert.equal(w.wall.position.x, -910);
  assert.deepEqual(w.coursePieces.map((b) => b.label), ["landing slab", "overhead bar", "back ramp"]);
  assert.ok(w.coursePieces.every((b) => b.isStatic));
  assert.equal(w.spawnOffsetY, 80);
  assert.ok(Math.abs(w.cart.position.x - (reference.cart.position.x + 2400)) < 1e-9, "cart starts at the course's run-up start");
  assert.ok(Math.abs(w.cart.position.y - (reference.cart.position.y + 80)) < 1e-9, "cart sits on the higher ground");
  // The takeoff zone follows the ramp edge.
  assert.deepEqual(
    { ...w.skills.config.takeoff, meterOvershoot: undefined },
    { ...SKILL_CONFIG.takeoff, meterOvershoot: undefined, armedX: 200, goodStart: 280, perfectStart: 320, perfectEnd: 400, goodEnd: 430 },
  );
  reference.dispose();
  // An upgrade that widens the window still widens it on this course.
  const pixels = UPGRADES["wider-launch-window"].pixels;
  const upgraded = new PhysicsWorld(CHARACTERS[1], { id: "test", course: TINY }, { upgrades: { "wider-launch-window": 2 } });
  assert.equal(upgraded.skills.config.takeoff.goodStart, 280 - 2 * pixels);
  assert.equal(upgraded.skills.config.takeoff.goodEnd, 430 + 2 * pixels);
  upgraded.dispose();
  w.dispose();
});

check("A jump on the tiny course launches, lands and measures from its own origin", () => {
  const w = new PhysicsWorld(CHARACTERS[0], { id: "test", gravity: 1.05, course: TINY });
  const zone = w.skills.config.takeoff;
  for (let i = 0; i < 4000 && !w.finished; i++) {
    let pushes = 0;
    if (!w.launched) {
      if (w.cart.position.x < zone.armedX) {
        const p = rhythmPosition(w.elapsed);
        pushes = Number(p >= 0.47 && p <= 0.55 && w.elapsed - w.skills.lastPush > 0.4);
      } else if (!w.skills.takeoff)
        pushes = Number(w.cart.position.x >= (zone.perfectStart + zone.perfectEnd) / 2);
    }
    w.step({ pushes, rotate: 0, brace: false });
  }
  assert.ok(w.finished && w.launched && w.landed, w.reason);
  assert.equal(w.skills.takeoff, "Perfect", "the takeoff zone sits on this ramp");
  const s = scoreAttempt(w.metrics(), w.character);
  assert.ok(s.distanceMetres > 0);
  assert.equal(s.distancePoints, Math.round(s.distanceMetres * 10));
  assert.ok(w.distancePixels >= 0 && w.distancePixels < w.course.endX - w.course.distanceOrigin);
  w.dispose();
});

check("Landing pieces count as ground; other pieces do not; brace estimate uses them", () => {
  const w = new PhysicsWorld(CHARACTERS[2], { id: "test", course: TINY });
  const [slab, bar] = w.coursePieces;
  w.launched = true;
  w.preSpeeds = new Map([[w.cart.id, { x: 0, y: 1 }]]);
  w.handleCollisions([{ bodyA: bar, bodyB: w.cart }]);
  assert.equal(w.landed, false, "touching the bar is not a landing");
  // Above the slab, the estimated contact is sooner than above the ground.
  w.landed = false;
  const Body = globalThis.Matter.Body;
  for (const b of w.dynamic) Body.setPosition(b, { x: b.position.x + 1700, y: b.position.y - 100 });
  const overSlab = w.skills.contactETA(w);
  for (const b of w.dynamic) Body.setPosition(b, { x: b.position.x + 1000, y: b.position.y });
  const overGround = w.skills.contactETA(w);
  assert.ok(overSlab < overGround);
  w.handleCollisions([{ bodyA: slab, bodyB: w.cart }]);
  assert.equal(w.landed, true, "the landing slab counts as a landing");
  w.dispose();
});

check("The renderer and replay draw the course from data, including extra pieces", () => {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (_, name) => (...args) => {
      calls.push([name, ...args]);
      if (name === "createLinearGradient" || name === "createRadialGradient") return { addColorStop() {} };
    },
    set: (_, name, value) => { calls.push([name, value]); return true; },
  });
  const renderer = new Renderer({ getContext: () => ctx, getBoundingClientRect: () => ({ width: 1200, height: 560 }) });
  const w = new PhysicsWorld(CHARACTERS[0], { id: "test", course: TINY });
  const tiny = w.course;
  const drawn = (predicate) => calls.some(predicate);
  renderer.draw(w, 1 / 60, null);
  assert.ok(drawn(([n, x, y]) => n === "moveTo" && x === 200 && y === 600), "ramp foot at the course's ramp start");
  for (const piece of tiny.pieces) {
    const [first] = pieceOutline(piece);
    assert.ok(drawn(([n, x, y]) => n === "moveTo" && x === first.x && y === first.y), `${piece.label} is drawn`);
  }
  assert.ok(drawn(([n, text, x]) => n === "fillText" && text === "0 m" && x === 444), "distance markers start at the distance origin");
  // Replay frames carry the course, so playback draws the same shapes.
  const recording = new ReplayRecording(w);
  assert.equal(recording.scene.course.pieces.length, 3);
  calls.length = 0;
  renderer.draw({ ...w, course: recording.scene.course }, 1 / 60, null);
  assert.ok(drawn(([n, x, y]) => n === "moveTo" && x === 200 && y === 600));
  w.dispose();
});

console.log(`\n${checks} course test groups passed.`);
