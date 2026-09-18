import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { TrickTracker, scoreTricks } from "../js/tricks.js";
import { TRICK_CONFIG as C } from "../js/trick-config.js";
import { CHARACTERS } from "../js/characters.js";
import { PhysicsWorld } from "../js/physics.js";
import { scoreAttempt, assertScore, normalAngle } from "../js/scoring.js";
import { timedInputs } from "./skill-helpers.mjs";
runInThisContext(
  readFileSync(
    new URL("../vendor/matter-0.20.0.min.js", import.meta.url),
    "utf8",
  ),
);
const tau = Math.PI * 2;
let checks = 0;
const evidence = {};
function test(name, fn) {
  fn();
  checks++;
  console.log("PASS " + name);
}
function stream(character = CHARACTERS[0]) {
  const tracker = new TrickTracker(character);
  let time = 0,
    angle = 0;
  const sample = (a, extra = {}) => ({
    time,
    angle: a,
    spin: 0,
    strain: 0,
    attached: true,
    distance: 0,
    ...extra,
  });
  tracker.start(sample(0));
  return {
    tracker,
    move(target, steps = 120, wrap = false, extra = {}) {
      const start = angle;
      for (let i = 1; i <= steps; i++) {
        time += 1 / 120;
        angle = start + ((target - start) * i) / steps;
        tracker.sample(
          sample(wrap ? normalAngle(angle) : angle, {
            spin: ((target - start) * 120) / steps,
            ...extra,
          }),
        );
      }
      return this;
    },
    hold(seconds, extra = {}) {
      for (let i = 0; i < Math.round(seconds * 120); i++) {
        time += 1 / 120;
        tracker.sample(sample(angle, extra));
      }
      return this;
    },
    land(extra = {}) {
      time += 1 / 120;
      tracker.land(sample(angle, extra));
      return this;
    },
    finish() {
      return tracker.finalize();
    },
  };
}
const ids = (t) => t.awards.map((a) => a.id);
test("Exactly one full forward rotation registers once; held angle does not repeat", () => {
  const s = stream().move(tau - 0.01);
  assert.equal(s.tracker.forward, 0);
  s.move(tau, 2).hold(0.2);
  assert.equal(s.tracker.forward, 1);
  assert.deepEqual(ids(s.tracker), ["front"]);
});
test("Exactly one full backward rotation registers once through angle wrapping", () => {
  const s = stream().move(-tau, 120, true).hold(0.2);
  assert.equal(s.tracker.backward, 1);
  assert.deepEqual(ids(s.tracker), ["back"]);
});
test("Oscillation around zero and half-turn reversals earn no trick points", () => {
  for (const amplitude of [0.03, 0.22, Math.PI * 0.95]) {
    const s = stream();
    for (let i = 0; i < 16; i++)
      s.move(i % 2 ? amplitude : -amplitude, 60, true);
    s.land();
    assert.equal(s.tracker.forward + s.tracker.backward, 0);
    assert.equal(scoreTricks(s.finish(), CHARACTERS[0], "Clean").points, 0);
  }
});
test("Two wrapped turns remain two turns, with one separate Double Flip bonus", () => {
  for (const sign of [1, -1]) {
    const s = stream()
      .move(sign * 2 * tau, 240, true)
      .hold(0.3);
    const t = s.tracker;
    assert.equal(t.forward + t.backward, 2);
    assert.equal(t.counts.double, 1);
    assert.equal(t.counts[sign > 0 ? "front" : "back"], 2);
    assert.equal(
      scoreTricks(s.finish(), CHARACTERS[0], "Clean").completedRotations,
      2,
    );
  }
});
test("Crossing a completed-turn boundary repeatedly cannot award that turn again", () => {
  const s = stream().move(tau);
  for (let i = 0; i < 30; i++) s.move(tau + (i % 2 ? 0.015 : -0.015), 2, true);
  assert.equal(s.tracker.forward, 1);
  assert.deepEqual(ids(s.tracker), ["front"]);
});
test("Opposite full turns count separately; repeated trick credit rapidly declines", () => {
  const s = stream()
    .move(tau)
    .move(0)
    .move(5 * tau, 600, true);
  const t = s.tracker;
  assert.equal(t.forward, 6);
  assert.equal(t.backward, 1);
  const fronts = t.awards.filter((a) => a.id === "front");
  assert.deepEqual(
    fronts.map((a) => a.repeat),
    [1, 0.2, 0.05, 0, 0, 0],
  );
  assert.ok(fronts[1].points < fronts[0].points * 0.5);
  assert.equal(fronts.at(-1).points, 0);
  assert.equal(t.counts.double, 2, "non-overlapping pairs only");
});
test("No Hands requires sustained strain, recovery, and continuous attachment", () => {
  const s = stream().hold(0.1, { strain: 0.12 });
  assert.deepEqual(ids(s.tracker), []);
  s.hold(0.09, { strain: 0.01 });
  assert.deepEqual(ids(s.tracker), ["noHands"]);
  s.hold(0.5);
  assert.equal(s.tracker.counts.noHands, 1);
  const brief = stream().hold(0.025, { strain: 0.15 }).hold(0.3);
  assert.deepEqual(ids(brief.tracker), []);
  const lost = stream()
    .hold(0.1, { strain: 0.15 })
    .hold(0.1, { attached: false })
    .hold(0.3);
  assert.deepEqual(ids(lost.tracker), []);
  const landed = stream()
    .hold(0.1, { strain: 0.15 })
    .land({ strain: 0.15 })
    .hold(0.3);
  assert.deepEqual(ids(landed.tracker), []);
});
test("Last-Second Appeal needs an extreme angle followed by a recent controlled recovery", () => {
  const recover = () => stream().move(2.2, 30).hold(0.1).move(0, 30).hold(0.06);
  const good = recover().land();
  assert.equal(good.tracker.counts.appeal, 1);
  good.land();
  assert.equal(good.tracker.counts.appeal, 1);
  assert.equal(recover().hold(0.5).land().tracker.counts.appeal, undefined);
  assert.equal(stream().hold(1).land().tracker.counts.appeal, undefined);
});
test("Clean Flight needs a long controlled flight; rapid small oscillations fail", () => {
  const clean = stream().hold(1.3).land({ distance: 1300 });
  assert.deepEqual(ids(clean.tracker), ["clean"]);
  assert.deepEqual(
    ids(stream().hold(0.5).land({ distance: 1300 }).tracker),
    [],
  );
  assert.deepEqual(ids(stream().hold(1.3).land({ distance: 400 }).tracker), []);
  const w = stream();
  for (let i = 0; i < 40; i++) w.move(i % 2 ? 0.12 : -0.12, 4);
  w.land({ distance: 1300 });
  assert.deepEqual(ids(w.tracker), []);
});
test("Jake keeps a combo through mild instability; Brandon gets more variety reward", () => {
  const byCharacter = CHARACTERS.slice(0, 2).map((c) => {
    const s = stream(c)
      .move(tau)
      .hold(0.22, { strain: 0.2 })
      .hold(0.09, { strain: 0 });
    return s.tracker;
  });
  assert.equal(byCharacter[0].comboBreaks, 0);
  assert.equal(byCharacter[1].comboBreaks, 1);
  assert.ok(byCharacter[0].bestCombo > 1);
  const combo = CHARACTERS.map(
    (c) => stream(c).move(tau).hold(0.1, { strain: 0.12 }).hold(0.09).tracker,
  );
  assert.equal(combo[0].bestCombo, 1.25);
  assert.equal(combo[1].bestCombo, 1.4);
});
test("Landing outcome multiplies banked tricks and all result subtotals agree", () => {
  const summary = stream().move(tau).finish();
  const base = {
    trickSummary: summary,
    airRotation: tau,
    distancePixels: 1600,
    launched: true,
    landed: true,
    landingAngle: 0,
    landingSpeed: 5,
    attached: true,
    crashed: false,
    reason: "fixture",
  };
  const clean = scoreAttempt(base, CHARACTERS[0]),
    crash = scoreAttempt({ ...base, crashed: true }, CHARACTERS[0]);
  assert.equal(clean.stylePoints, 240);
  assert.equal(crash.stylePoints, 68);
  assert.ok(clean.stylePoints > crash.stylePoints * 3);
  for (const s of [clean, crash]) {
    assertScore(s);
    assert.equal(
      s.tricks.details.reduce((n, e) => n + e.points, 0),
      s.tricks.subtotal,
    );
    assert.equal(
      s.stylePoints,
      Math.round(
        s.tricks.subtotal *
          s.tricks.characterMultiplier *
          s.tricks.landingMultiplier,
      ),
    );
  }
  evidence.sameTrick = { clean: clean.stylePoints, crash: crash.stylePoints };
});
test("Finalize is idempotent; landing stops recognition and a new attempt is empty", () => {
  const s = stream().move(tau).land();
  const saved = s.finish();
  s.move(4 * tau, 360, true);
  s.tracker.award("front", 10);
  assert.equal(s.finish(), saved);
  assert.equal(saved.forward, 1);
  assert.ok(Object.isFrozen(saved.awards));
  assert.deepEqual(stream().finish().awards, []);
});
test("Invalid angles, duplicate timestamps and teleports cannot mint turns", () => {
  const s = stream().move(tau / 2);
  const before = s.tracker.signedRotation;
  s.tracker.sample({
    time: 1,
    angle: NaN,
    spin: 0,
    strain: 0,
    attached: true,
    distance: 0,
  });
  assert.equal(s.tracker.signedRotation, before);
  s.tracker.sample({
    time: s.tracker.lastTime,
    angle: tau,
    spin: 0,
    strain: 0,
    attached: true,
    distance: 0,
  });
  assert.equal(s.tracker.signedRotation, before);
  s.move(tau, 1).land();
  assert.equal(s.tracker.forward, 0);
  const corrupt = scoreTricks(
    {
      awards: [null, { id: "front", combo: Infinity }],
      forward: NaN,
      backward: Infinity,
    },
    CHARACTERS[0],
    "Clean",
  );
  assert.ok(Number.isFinite(corrupt.points));
  assert.equal(corrupt.completedRotations, 0);
});
test("Actual physics recognizes controlled flips and recovery tricks without new joints", () => {
  evidence.physical = [];
  for (const c of CHARACTERS) {
    const w = new PhysicsWorld(c);
    for (let i = 0; i < 2500 && !w.finished; i++) {
      const rotate =
        w.cart.angle - w.launchAngle < tau
          ? 1
          : Math.max(
              -1,
              Math.min(
                1,
                -normalAngle(w.cart.angle) * 2 - w.cart.angularVelocity * 28,
              ),
            );
      w.step(timedInputs(w, rotate, true));
    }
    const s = scoreAttempt(w.metrics(), c);
    assert.ok(w.finished && !w.invalid);
    assert.equal(w.tricks.forward, 1);
    assert.equal(w.tricks.counts.front, 1);
    assert.equal(w.tricks.counts.noHands, 1);
    assert.equal(w.tricks.finalized, true);
    assert.equal(s.landingQuality, "Clean");
    assertScore(s);
    if (c.id === "jake") assert.equal(w.tricks.counts.appeal, 1);
    assert.equal(Matter.Composite.allConstraints(w.engine.world).length, 15);
    evidence.physical.push({
      character: c.id,
      tricks: s.tricks.details.map((e) => e.name),
      style: s.stylePoints,
      total: s.total,
    });
    w.dispose();
  }
});
test("Owen can complete a real Double Flip with a late-in-zone Perfect takeoff", () => {
  const w = new PhysicsWorld(CHARACTERS[2]);
  for (let i = 0; i < 2500 && !w.finished; i++) {
    const controls = timedInputs(w, -1);
    if (!w.launched && w.cart.position.x >= 860 && !w.skills.takeoff)
      controls.pushes = Number(w.cart.position.x >= 1040);
    w.step(controls);
  }
  assert.ok(w.finished && !w.invalid);
  assert.equal(w.skills.takeoff, "Perfect");
  assert.equal(w.tricks.backward, 2);
  assert.equal(w.tricks.counts.double, 1);
  evidence.doubleFlip = {
    degrees: (w.airRotation * 180) / Math.PI,
    tricks: w.tricks.awards.map((e) => e.id),
    score: scoreAttempt(w.metrics(), CHARACTERS[2]).stylePoints,
  };
  w.dispose();
});
test("Malformed trick data stays finite and the style ceiling is enforced", () => {
  const forged = {
    awards: [
      null,
      { id: "__proto__" },
      { id: "constructor" },
      { id: "front", combo: NaN },
    ],
    forward: NaN,
    backward: Infinity,
  };
  const safe = scoreTricks(forged, CHARACTERS[0], "Clean");
  assert.equal(safe.details.length, 1);
  assert.equal(safe.points, 240);
  assert.equal(safe.completedRotations, 0);
  const awards = Array.from({ length: 24 }, (_, i) => ({
    id: Object.keys(C.tricks)[i % 6],
    combo: 999,
  }));
  const capped = scoreTricks({ awards }, { styleMultiplier: 999 }, "Clean");
  assert.equal(capped.points, C.maximumStylePoints);
  assert.equal(capped.capped, true);
});
console.log(`${checks} trick groups passed.`);
console.log(JSON.stringify(evidence, null, 2));
