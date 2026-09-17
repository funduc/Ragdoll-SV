import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { CHARACTERS } from "../js/characters.js";
import { PhysicsWorld } from "../js/physics.js";
import { applyPassive } from "../js/passives.js";
import { scoreAttempt } from "../js/scoring.js";
import { Introduction } from "../js/introductions.js";
import { Commentator, GENERAL_CAPTIONS } from "../js/commentary.js";
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
function drive(character, rotate = 0) {
  const world = new PhysicsWorld(character);
  const statuses = new Set();
  for (let i = 0; i < 2500 && !world.finished; i++) {
    world.step({ accelerate: true, rotate });
    statuses.add(world.passiveStatus);
  }
  assert.ok(world.finished && world.launched && world.landed && !world.invalid);
  const result = {
    score: scoreAttempt(world.metrics(), character),
    elapsed: world.elapsed,
    tilt: Math.abs(world.landingAngle),
    statuses: [...statuses],
  };
  world.dispose();
  return result;
}
check(
  "All characters reserve missing PNG paths without enabling image requests",
  () => {
    for (const c of CHARACTERS) {
      assert.equal(c.portraitPath, `./assets/portraits/${c.id}.png`);
      assert.equal(c.portraitAvailable, false);
      assert.equal(
        existsSync(new URL(`../${c.portraitPath}`, import.meta.url)),
        false,
      );
      assert.ok(
        c.fullName.includes(c.nickname) &&
          c.biography &&
          c.strength &&
          c.weakness &&
          c.passive.description,
      );
      assert.ok(c.statistics.length >= 3 && Object.isFrozen(c.passive));
    }
    assert.equal(CHARACTERS[2].keepsake.kind, "censored");
    assert.equal(CHARACTERS[2].keepsake.label, "Temu D***o.");
  },
);
check(
  "Introductions have no deadline and clear only on explicit continuation or reset",
  () => {
    const intro = new Introduction();
    assert.equal(intro.active, false);
    intro.start();
    assert.equal(intro.active, true);
    assert.equal("deadline" in intro, false);
    assert.equal("remaining" in intro, false);
    assert.equal("expired" in intro, false);
    intro.clear();
    assert.equal(intro.active, false);
    intro.start();
    assert.equal(intro.active, true);
    intro.clear();
    assert.equal(intro.active, false);
  },
);
check(
  "John covers every event, escalates in the final, and avoids consecutive repeats",
  () => {
    const john = new Commentator();
    for (const type of [
      "introduction",
      "launch",
      "longJump",
      "weakJump",
      "rotation",
      "goodLanding",
      "crash",
      "elimination",
      "championship",
      "victory",
    ]) {
      assert.ok(GENERAL_CAPTIONS[type].length >= 2);
      for (const round of ["qualifying", "championship"])
        for (const c of CHARACTERS) {
          let last = john.lastLine;
          for (let i = 0; i < 6; i++) {
            const line = john.pick(type, c, round);
            assert.ok(line && line.length <= 110);
            assert.notEqual(line, last);
            last = line;
          }
        }
    }
    const calm = new Commentator().pick("launch");
    const final = new Commentator().pick("launch", null, "championship");
    assert.notEqual(calm, final);
    assert.equal(final, final.toUpperCase());
    john.enqueue("launch", CHARACTERS[0], "qualifying", 0);
    assert.ok(john.tick(0));
    john.enqueue("rotation", CHARACTERS[0], "qualifying", 0.1);
    assert.equal(john.tick(0.1), null, "ordinary captions remain readable");
    john.resetAttempt();
    assert.equal(
      john.tick(99),
      null,
      "no previous-attempt captions survive reset",
    );
  },
);
check(
  "Jake's level assistance improves an actual landing while keeping a full flip possible",
  () => {
    const jake = CHARACTERS[0];
    const assisted = drive(jake),
      unassisted = drive({ ...jake, passive: null });
    assert.ok(assisted.tilt < unassisted.tilt * 0.65);
    assert.equal(assisted.score.landingQuality, "Clean");
    assert.ok(assisted.statuses.some((s) => s.includes("Level assist")));
    const spin = drive(jake, 1);
    assert.ok(spin.score.airDegrees >= 360 && spin.score.landingPoints === 150);
    const faster = drive(
      {
        ...jake,
        passive: null,
        rotationControl: CHARACTERS[1].rotationControl,
      },
      1,
    );
    assert.ok(
      spin.score.airDegrees < faster.score.airDegrees,
      "Jake rotates more slowly",
    );
    evidence.jake = {
      assistedTiltDegrees: assisted.score.landingAngle,
      unassistedTiltDegrees: unassisted.score.landingAngle,
      flipDegrees: spin.score.airDegrees,
    };
  },
);
check(
  "Jake's over-rotation penalty affects counter-steering, not a continuing spin",
  () => {
    const w = new PhysicsWorld(CHARACTERS[0]);
    try {
      w.launched = true;
      Matter.Body.setAngle(w.cart, 1.5);
      Matter.Body.setAngularVelocity(w.cart, 0.04);
      assert.ok(Math.abs(applyPassive(w, -1)) < 0.7);
      assert.match(w.passiveStatus, /Weaker recovery/);
      assert.equal(applyPassive(w, 1), 1);
      Matter.Body.setAngle(w.cart, 0.5);
      assert.equal(applyPassive(w, -1), -1);
    } finally {
      w.dispose();
    }
  },
);
check(
  "Brandon's wobble is small, repeatable, and remains under player control",
  () => {
    const c = CHARACTERS[1],
      w = new PhysicsWorld(c),
      neutral = new PhysicsWorld({ ...c, passive: null });
    let maxDifference = 0;
    try {
      for (let i = 0; i < 2500 && (!w.finished || !neutral.finished); i++) {
        w.step({ accelerate: true, rotate: 0 });
        neutral.step({ accelerate: true, rotate: 0 });
        if (w.launched && neutral.launched && !w.landed && !neutral.landed)
          maxDifference = Math.max(
            maxDifference,
            Math.abs(w.cart.angle - neutral.cart.angle),
          );
      }
      assert.ok(maxDifference > 0.01 && maxDifference < 0.15);
      assert.ok(!w.crashed && !w.invalid && w.finished);
      evidence.brandon = {
        wobbleDifferenceDegrees: (maxDifference * 180) / Math.PI,
      };
    } finally {
      w.dispose();
      neutral.dispose();
    }
    const first = drive(c);
    assert.deepEqual(drive(c), first);
    const controlled = new PhysicsWorld(c);
    try {
      for (let i = 0; i < 1500 && !controlled.launched; i++)
        controlled.step({ accelerate: true, rotate: 0 });
      assert.ok(controlled.launched);
      for (let i = 0; i < 24; i++)
        controlled.step({ accelerate: true, rotate: 1 });
      const before = controlled.cart.angularVelocity;
      for (let i = 0; i < 24; i++)
        controlled.step({ accelerate: true, rotate: -1 });
      assert.ok(
        controlled.cart.angularVelocity < before,
        "counter-steering overcomes the mild wobble",
      );
    } finally {
      controlled.dispose();
    }
  },
);
check("Brandon's style bonus uses the existing scoring components", () => {
  const metrics = {
    distancePixels: 1200,
    airRotation: Math.PI * 2,
    landed: true,
    launched: true,
    attached: true,
    crashed: false,
    landingAngle: 0,
    landingSpeed: 5,
    reason: "same jump",
  };
  const scores = CHARACTERS.map((c) => scoreAttempt(metrics, c));
  assert.equal(scores[1].stylePoints, 324);
  assert.ok(
    scores[1].stylePoints > scores[0].stylePoints &&
      scores[1].stylePoints > scores[2].stylePoints,
  );
  assert.ok(
    scores.every(
      (s) =>
        s.total ===
        s.distancePoints + s.stylePoints + s.landingPoints + s.attachedPoints,
    ),
  );
  evidence.brandon.fullFlipStylePoints = scores[1].stylePoints;
});
check(
  "Owen has the fastest run-up and a cosmetic warning without component failures",
  () => {
    const speeds = CHARACTERS.map((c) => {
      const world = new PhysicsWorld(c);
      for (let i = 0; i < 96; i++) world.step({ accelerate: true, rotate: 0 });
      const speed = world.cart.velocity.x;
      world.dispose();
      return speed;
    });
    assert.ok(speeds[2] > speeds[0] && speeds[2] > speeds[1]);
    const w = new PhysicsWorld(CHARACTERS[2]),
      neutral = new PhysicsWorld({ ...CHARACTERS[2], passive: null });
    try {
      assert.ok(Math.abs(w.cart.inertia / neutral.cart.inertia - 0.94) < 1e-10);
      for (let i = 0; i < 170; i++) w.step({ accelerate: true, rotate: 0 });
      assert.equal(w.passiveStatus, "Wrate Issue Detected");
      assert.equal(w.attached, true);
      assert.equal(Matter.Composite.allBodies(w.engine.world).length, 17);
      assert.equal(Matter.Composite.allConstraints(w.engine.world).length, 15);
      assert.equal(
        w.drainEvents().filter((event) => event === "wrateWarning").length,
        1,
      );
      evidence.owen = {
        runupSpeeds: speeds,
        inertiaRatio: w.cart.inertia / neutral.cart.inertia,
      };
    } finally {
      w.dispose();
      neutral.dispose();
    }
  },
);
console.log(`${checks} personalization groups passed.`);
console.log(JSON.stringify(evidence, null, 2));
