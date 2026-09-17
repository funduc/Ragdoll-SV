import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { CHARACTERS } from "../js/characters.js";
import { PhysicsWorld } from "../js/physics.js";
import {
  scoreAttempt,
  rankQualifiers,
  championshipWinners,
} from "../js/scoring.js";
import { Tournament, State } from "../js/tournament.js";
runInThisContext(
  readFileSync(
    new URL("../vendor/matter-0.20.0.min.js", import.meta.url),
    "utf8",
  ),
);
assert.equal(Matter.version, "0.20.0");
let checks = 0;
function test(name, fn) {
  fn();
  checks++;
  console.log(`PASS ${name}`);
}
function jump(character, controls) {
  const world = new PhysicsWorld(character);
  let steps = 0;
  while (!world.finished && steps++ < 2500)
    world.step(typeof controls === "function" ? controls(world) : controls);
  assert.ok(world.finished, "attempt must end");
  return world;
}
const scores = {};
test("Every character launches, lands, settles, and earns a finite score", () => {
  for (const c of CHARACTERS) {
    const w = jump(c, { accelerate: true, rotate: 0 });
    const s = scoreAttempt(w.metrics(), c);
    assert.ok(w.launched && w.landed);
    assert.ok(s.distanceMetres > 20 && s.distanceMetres < 40);
    assert.ok(s.attachedPoints === 100);
    assert.ok(Number.isFinite(s.total));
    assert.equal(
      s.total,
      s.distancePoints + s.landingPoints + s.stylePoints + s.attachedPoints,
    );
    scores[c.id] = s;
    w.dispose();
  }
});
test("A full forward flip is controllable and earns style with a clean landing", () => {
  const w = jump(CHARACTERS[0], { accelerate: true, rotate: 1 });
  const s = scoreAttempt(w.metrics(), CHARACTERS[0]);
  assert.ok(s.airDegrees >= 360);
  assert.ok(s.stylePoints >= 240);
  assert.equal(s.landingQuality, "Clean");
  w.dispose();
});
test("Crashes detach the rider but retain distance and style", () => {
  const w = jump(CHARACTERS[2], { accelerate: true, rotate: -1 });
  const s = scoreAttempt(w.metrics(), CHARACTERS[2]);
  assert.ok(s.crashed);
  assert.equal(s.attachedPoints, 0);
  assert.ok(s.distancePoints > 0 && s.stylePoints > 0);
  w.dispose();
});
test("Idle players time out with zero points", () => {
  const w = jump(CHARACTERS[0], { accelerate: false, rotate: 0 });
  assert.ok(w.elapsed <= 12.02);
  assert.equal(scoreAttempt(w.metrics(), CHARACTERS[0]).total, 0);
  w.dispose();
});
test("Minor arm jitter cannot hold a settled crash open until the time limit", () => {
  const w = jump(CHARACTERS[1], { accelerate: true, rotate: 1 });
  assert.ok(w.crashed);
  assert.ok(w.elapsed < 10);
  assert.notEqual(w.reason, "Attempt time limit");
  w.dispose();
});
test("Distance freezes at first contact, never at the end of the roll", () => {
  const w = new PhysicsWorld(CHARACTERS[0]);
  while (!w.landed) w.step({ accelerate: true, rotate: 0 });
  const distance = w.distancePixels;
  while (!w.finished) w.step({ accelerate: true, rotate: 0 });
  assert.equal(w.distancePixels, distance);
  assert.ok(w.cart.position.x > 1080 + distance);
  w.dispose();
});
test("Restart is legal on the runway and locked after takeoff", () => {
  const w = new PhysicsWorld(CHARACTERS[0]);
  assert.ok(w.canRestart);
  while (!w.launched) w.step({ accelerate: true, rotate: 0 });
  assert.equal(w.canRestart, false);
  w.dispose();
  assert.equal(w.canRestart, false);
});
test("Repeated world disposal removes bodies, joints, pairs, and callbacks", () => {
  for (let i = 0; i < 15; i++) {
    const w = new PhysicsWorld(CHARACTERS[i % 3]);
    assert.equal(Matter.Composite.allBodies(w.engine.world).length, 17);
    assert.equal(Matter.Composite.allConstraints(w.engine.world).length, 15);
    for (let j = 0; j < 30; j++) w.step({ accelerate: true, rotate: 0 });
    w.dispose();
    w.dispose();
    assert.equal(Matter.Composite.allBodies(w.engine.world).length, 0);
    assert.equal(Matter.Composite.allConstraints(w.engine.world).length, 0);
    assert.equal(w.engine.pairs.list.length, 0);
    assert.equal(w.engine.events.collisionStart.length, 0);
  }
});
test("Two complete tournaments use exactly 3 qualifying and 2 championship scores", () => {
  const t = new Tournament();
  for (let run = 0; run < 2; run++) {
    assert.equal(t.state, State.TITLE);
    t.confirm();
    assert.equal(t.state, State.INSTRUCTIONS);
    t.confirm();
    assert.equal(t.state, State.QUALIFYING_INTRO);
    t.confirm();
    for (let i = 0; i < 3; i++) {
      assert.equal(t.state, State.READY);
      assert.equal(t.current.id, CHARACTERS[i].id);
      t.confirm();
      assert.ok(t.active);
      t.record(scores[t.current.id]);
      assert.equal(t.record(scores.jake), false);
      assert.equal(t.state, State.RESULTS);
      t.confirm();
    }
    assert.equal(t.state, State.ELIMINATION);
    assert.equal(Object.keys(t.qualifying).length, 3);
    assert.equal(t.finalists.length, 2);
    assert.ok(!t.finalists.includes(t.eliminated));
    t.confirm();
    assert.equal(t.state, State.CHAMPIONSHIP_INTRO);
    t.confirm();
    for (let i = 0; i < 2; i++) {
      assert.equal(t.state, State.READY);
      t.confirm();
      assert.equal(t.state, State.CHAMPIONSHIP_ACTIVE);
      t.record(scores[t.current.id]);
      t.confirm();
    }
    assert.equal(t.state, State.FINAL);
    assert.equal(Object.keys(t.championship).length, 2);
    assert.ok(t.winners.length >= 1);
    t.confirm();
    assert.equal(t.state, State.TITLE);
    assert.equal(Object.keys(t.qualifying).length, 0);
    assert.equal(Object.keys(t.championship).length, 0);
  }
});
test("Qualifying ties use distance then roster order; final ties share the win", () => {
  const tied = Object.fromEntries(
    CHARACTERS.map((c) => [c.id, { total: 100, distanceMetres: 5 }]),
  );
  assert.deepEqual(rankQualifiers(CHARACTERS, tied), CHARACTERS);
  tied.owen.distanceMetres = 6;
  assert.equal(rankQualifiers(CHARACTERS, tied)[0].id, "owen");
  assert.equal(championshipWinners(CHARACTERS.slice(0, 2), tied).length, 2);
});
test("Impossible transitions are rejected and active Enter cannot skip a jump", () => {
  const t = new Tournament();
  assert.throws(() => t.transition(State.FINAL));
  for (let i = 0; i < 4; i++) t.confirm();
  assert.ok(t.active);
  t.confirm();
  assert.equal(t.state, State.ACTIVE);
});
test("Attempt timeout and style cap are enforced", () => {
  const w = new PhysicsWorld(CHARACTERS[0]);
  w.launched = true;
  w.elapsed = 19.999;
  w.step();
  assert.equal(w.reason, "Attempt time limit");
  w.dispose();
  const s = scoreAttempt(
    {
      distancePixels: 0,
      airRotation: Math.PI * 100,
      launched: true,
      landed: false,
      attached: true,
      crashed: false,
      landingAngle: 0,
      landingSpeed: 0,
      reason: "test",
    },
    CHARACTERS[0],
  );
  assert.equal(s.stylePoints, 720);
  assert.equal(s.attachedPoints, 0);
});
console.log(`\n${checks} test groups passed.`);
