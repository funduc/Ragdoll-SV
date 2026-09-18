import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { PhysicsWorld, STEP_MS } from "../js/physics.js";
import { CHARACTERS } from "../js/characters.js";
import { scoreAttempt } from "../js/scoring.js";
import { SKILL_CONFIG as C, rhythmPosition } from "../js/skill-config.js";
import { Input } from "../js/input.js";
import { Tutorial } from "../js/tutorial.js";
import { timedInputs } from "./skill-helpers.mjs";
runInThisContext(
  readFileSync(
    new URL("../vendor/matter-0.20.0.min.js", import.meta.url),
    "utf8",
  ),
);
let checks = 0;
const evidence = {};
function check(name, fn) {
  fn();
  checks++;
  console.log(`PASS ${name}`);
}
function jump(character, policy) {
  const w = new PhysicsWorld(character);
  let launch;
  for (let i = 0; i < 2500 && !w.finished; i++) {
    w.step(policy(w, i));
    if (w.launched && !launch)
      launch = {
        xSpeed: w.cart.velocity.x,
        angle: w.cart.angle,
        angular: w.cart.angularVelocity,
      };
  }
  assert.ok(w.finished && !w.invalid);
  const result = {
    score: scoreAttempt(w.metrics(), character),
    launch,
    angle: w.landingAngle,
    impact: w.landingSpeed,
    air: w.airRotation,
    distance: w.distancePixels,
    reason: w.reason,
  };
  w.dispose();
  return result;
}
check(
  "Holding even a perfectly timed first press loses to deliberate pushes",
  () => {
    evidence.holdVsTiming = CHARACTERS.map((c) => {
      let sent = false;
      const held = jump(c, (w) => {
        const push = !sent && rhythmPosition(w.elapsed) >= 0.48;
        if (push) sent = true;
        return { pushes: Number(push), rotate: 0 };
      });
      const timed = jump(c, (w) => timedInputs(w, 0, true));
      assert.equal(
        Object.values(held.score.pushCounts).reduce((a, b) => a + b, 0),
        1,
      );
      assert.ok(timed.score.distanceMetres > held.score.distanceMetres + 8);
      assert.ok(timed.score.total > held.score.total);
      return {
        character: c.id,
        held: held.score.total,
        timed: timed.score.total,
        heldMetres: held.score.distanceMetres,
        timedMetres: timed.score.distanceMetres,
      };
    });
  },
);
check("Rough novice taps reach the ramp; spam remains weak and finite", () => {
  for (const c of CHARACTERS) {
    let next = 0;
    const novice = jump(c, (w) => {
      const pushes = Number(w.elapsed >= next && !w.launched);
      if (pushes) next += 0.55;
      return { pushes, rotate: 0 };
    });
    assert.ok(novice.launch && novice.score.distanceMetres > 10);
    next = 0;
    const spam = jump(c, (w) => {
      const pushes = Number(w.elapsed >= next && !w.launched);
      if (pushes) next += 0.1;
      return { pushes, rotate: 0 };
    });
    assert.ok(spam.score.pushCounts.Miss > 10);
    assert.ok(spam.score.distanceMetres < novice.score.distanceMetres);
  }
});
check(
  "Perfect/Good/Early/Late takeoffs produce different actual launches",
  () => {
    evidence.takeoffs = Object.fromEntries(
      ["Perfect", "Good", "Early", "Late"].map((target) => {
        const r = jump(CHARACTERS[0], (w) => timedInputs(w, 0, true, target));
        assert.equal(r.score.takeoffGrade, target);
        return [
          target,
          {
            metres: r.score.distanceMetres,
            bonus: r.score.takeoffBonus,
            ...r.launch,
          },
        ];
      }),
    );
    assert.ok(
      evidence.takeoffs.Perfect.metres > evidence.takeoffs.Early.metres + 10,
    );
    assert.ok(evidence.takeoffs.Perfect.xSpeed > evidence.takeoffs.Good.xSpeed);
    assert.ok(
      evidence.takeoffs.Late.angular >
        evidence.takeoffs.Perfect.angular + 0.015,
    );
    const early = jump(CHARACTERS[0], (w) => timedInputs(w, 0, true, "Early"));
    const spent = jump(CHARACTERS[0], (w) => {
      const controls = timedInputs(w, 0, true, "Early");
      if (w.skills.takeoff) controls.pushes = 1;
      return controls;
    });
    assert.deepEqual(spent, early, "extra pushes cannot restore a spent boost");
  },
);
check(
  "Perfect takeoff is repeatable across characters and three points inside the zone",
  () => {
    for (const c of CHARACTERS)
      for (const targetX of [995, 1020, 1045]) {
        const policy = (w) => {
          const controls = timedInputs(w, 0, true);
          if (w.cart.position.x >= C.takeoff.armedX && !w.skills.takeoff)
            controls.pushes = Number(w.cart.position.x >= targetX);
          return controls;
        };
        const first = jump(c, policy),
          second = jump(c, policy);
        assert.equal(first.score.takeoffGrade, "Perfect");
        assert.deepEqual(first, second);
      }
  },
);
check(
  "Brace timing changes impact tolerance for the same actual landing",
  () => {
    evidence.braces = {};
    for (const [name, lead] of [
      ["Unbraced", null],
      ["Perfect Brace", 0.18],
      ["Good Brace", 0.3],
      ["Early", 99],
      ["Late", 0.015],
    ]) {
      const r = jump(CHARACTERS[0], (w) => ({
        ...timedInputs(w),
        brace:
          lead !== null &&
          w.launched &&
          w.skills.braceAt === null &&
          w.skills.contactETA(w) < lead,
      }));
      assert.equal(r.score.braceGrade, name);
      evidence.braces[name] = {
        angle: r.angle,
        impact: r.impact,
        metres: r.score.distanceMetres,
        points: r.score.landingPoints,
        quality: r.score.landingQuality,
        tolerance: r.score.impactTolerance,
        leadMs: r.score.braceLeadMs,
      };
    }
    const b = evidence.braces;
    for (const r of Object.values(b)) {
      assert.equal(r.angle, b.Unbraced.angle);
      assert.equal(r.impact, b.Unbraced.impact);
      assert.equal(r.metres, b.Unbraced.metres);
    }
    assert.ok(b["Perfect Brace"].points > b.Unbraced.points);
    assert.equal(b.Late.tolerance, 1);
    assert.equal(b.Early.tolerance, 1);
    const afterContact = jump(CHARACTERS[0], (w) => ({
      ...timedInputs(w),
      brace: w.landed,
    }));
    assert.equal(afterContact.score.braceGrade, "Late");
    assert.equal(afterContact.score.impactTolerance, 1);
    assert.equal(afterContact.score.landingPoints, b.Unbraced.points);
  },
);
check(
  "Early bracing reduces actual air control; bad angles still crash when braced",
  () => {
    const normal = jump(CHARACTERS[0], (w) => timedInputs(w, 1));
    const early = jump(CHARACTERS[0], (w) => ({
      ...timedInputs(w, 1),
      brace: w.launched && w.skills.braceAt === null,
    }));
    assert.equal(early.score.braceGrade, "Early");
    assert.ok(early.air < normal.air * 0.8);
    const braced = jump(CHARACTERS[2], (w) => timedInputs(w, 1, true));
    assert.equal(braced.score.braceGrade, "Perfect Brace");
    assert.equal(braced.score.landingQuality, "Crash");
  },
);
check(
  "Key repeat, duplicate keydowns and screen changes never generate extra actions",
  () => {
    globalThis.window = new EventTarget();
    globalThis.document = new EventTarget();
    document.hidden = false;
    let active = true,
      confirm = 0;
    const input = new Input({
      isActive: () => active,
      onConfirm: () => confirm++,
      onRestart() {},
      onSuspend() {},
    });
    function key(code, type = "keydown", repeat = false) {
      const event = new Event(type, { cancelable: true });
      Object.assign(event, { code, repeat });
      window.dispatchEvent(event);
      return event;
    }
    assert.ok(key("Space").defaultPrevented);
    assert.equal(input.consume().pushes, 1);
    for (let i = 0; i < 50; i++) {
      key("Space", "keydown", true);
      key("Space");
      assert.equal(input.consume().pushes, 0);
    }
    input.clear();
    key("Space", "keydown", true);
    assert.equal(input.consume().pushes, 0);
    key("Space", "keyup");
    key("Space");
    assert.equal(input.consume().pushes, 1);
    key("Space", "keyup");
    active = false;
    key("ArrowUp");
    active = true;
    input.clear();
    key("ArrowUp", "keydown", true);
    assert.equal(input.consume().pushes, 0);
    key("ArrowUp", "keyup");
    key("ArrowUp");
    assert.equal(input.consume().pushes, 1);
    key("ArrowDown");
    assert.equal(input.consume().brace, true);
    key("ArrowDown", "keydown", true);
    assert.equal(input.consume().brace, false);
    key("KeyD");
    assert.equal(input.consume().rotate, 1);
    input.clear();
    key("KeyD", "keydown", true);
    assert.equal(input.consume().rotate, 0);
    key("Enter");
    input.clear();
    key("Enter");
    assert.equal(confirm, 1);
    key("Enter", "keyup");
    key("Enter");
    assert.equal(confirm, 2);
    input.destroy();
  },
);
check("Skill timing is independent of rendering at 30, 60 and 144 fps", () => {
  const runs = [30, 60, 144].map((fps) => {
    const w = new PhysicsWorld(CHARACTERS[0]);
    let accumulator = 0;
    for (let frame = 0; frame < fps * 21 && !w.finished; frame++) {
      accumulator += 1000 / fps;
      while (accumulator + 1e-7 >= STEP_MS && !w.finished) {
        w.step(timedInputs(w, 0, true));
        accumulator -= STEP_MS;
      }
    }
    assert.ok(w.finished);
    const score = scoreAttempt(w.metrics(), CHARACTERS[0]);
    w.dispose();
    return score;
  });
  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
});
check(
  "Tutorial uses all three grading rules and cannot advance the tournament",
  () => {
    const t = new Tutorial();
    t.tick(C.rhythm.period * 0.5, { pushes: 1 });
    assert.equal(t.result, "Perfect");
    t.next();
    t.tick(
      (C.tutorialSweepSeconds * (1020 - C.takeoff.armedX)) /
        (C.takeoff.goodEnd + C.takeoff.meterOvershoot - C.takeoff.armedX),
      { pushes: 1 },
    );
    assert.equal(t.result, "Perfect");
    t.next();
    t.tick(C.tutorialSweepSeconds * (1 - 0.18 / C.brace.meterSeconds), {
      brace: true,
    });
    assert.equal(t.result, "Perfect Brace");
    t.next();
    assert.equal(t.complete, true);
    t.reset();
    assert.equal(t.result, null);
    assert.equal(t.elapsed, 0);
    assert.equal(t.stage, 0);
  },
);
check("New attempts reset every skill field and queued feedback", () => {
  const a = new PhysicsWorld(CHARACTERS[0]);
  for (let i = 0; i < 500; i++) a.step(timedInputs(a, 0, true));
  a.dispose();
  const b = new PhysicsWorld(CHARACTERS[0]);
  assert.deepEqual(b.skills.pushes, { Perfect: 0, Good: 0, Miss: 0 });
  assert.equal(b.skills.takeoff, null);
  assert.equal(b.skills.braceAt, null);
  assert.equal(b.skills.driveUntil, 0);
  assert.equal(b.skills.feedback, null);
  assert.equal(b.skills.impactTolerance, 1);
  b.dispose();
});
console.log(`${checks} skill-loop groups passed.`);
console.log(JSON.stringify(evidence, null, 2));
