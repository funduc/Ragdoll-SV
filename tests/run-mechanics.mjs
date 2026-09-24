// Each condition, objective type, and upgrade is tested in isolation FIRST.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { CHARACTERS } from "../js/characters.js";
import { PhysicsWorld, STEP_MS } from "../js/physics.js";
import { scoreAttempt } from "../js/scoring.js";
import { SKILL_CONFIG, takeoffGrade, braceGrade } from "../js/skill-config.js";
import { worldSkillView } from "../js/skill-ui.js";
import { CONDITIONS, UPGRADES, OBJECTIVES } from "../js/run-config.js";
import { evaluateObjective } from "../js/objectives.js";
import { timedInputs } from "./skill-helpers.mjs";
runInThisContext(
  readFileSync(
    new URL("../vendor/matter-0.20.0.min.js", import.meta.url),
    "utf8",
  ),
);
let checks = 0;
const evidence = { conditions: {}, upgrades: {}, objectives: [] };
const test = (name, fn) => {
  fn();
  checks++;
  console.log(`PASS ${name}`);
};
const create = (spec = null, c = CHARACTERS[0]) =>
  new PhysicsWorld(c, undefined, spec);
const upgrade = (id) => ({ upgrades: { [id]: 1 } });
function flight(spec = null, character = CHARACTERS[0], spin = false) {
  const world = create(spec, character);
  let peak = 0;
  for (let i = 0; i < 2500 && !world.finished; i++) {
    const tilt = Math.atan2(
      Math.sin(world.cart.angle),
      Math.cos(world.cart.angle),
    );
    const rotate =
      spin && world.cart.angle - world.launchAngle < Math.PI * 2
        ? 1
        : Math.max(
            -1,
            Math.min(1, -tilt * 2 - world.cart.angularVelocity * 28),
          );
    world.step(timedInputs(world, rotate, true));
    peak = Math.max(peak, Math.abs(world.cart.angularVelocity));
  }
  assert.ok(world.finished && !world.invalid && world.launched && world.landed);
  const score = scoreAttempt(world.metrics(), world.character);
  const result = {
    score,
    x: world.cart.position.x,
    peak,
    status: world.runEffects?.status(world),
    boost: world.runEffects?.boostUsed,
  };
  world.dispose();
  return result;
}
test("Crosswind: one constant rightward airborne force, visible direction, no ground force", () => {
  const w = create({ condition: "crosswind" });
  w.runEffects.step(w, STEP_MS / 1000);
  assert.equal(w.cart.force.x, 0);
  w.launched = true;
  w.runEffects.step(w, STEP_MS / 1000);
  const force = w.cart.force.x;
  assert.equal(force / w.cart.mass, CONDITIONS.crosswind.force);
  for (const body of w.dynamic)
    assert.ok(
      Math.abs(body.force.x / body.mass - CONDITIONS.crosswind.force) < 1e-12,
    );
  assert.match(w.runEffects.status(w), /→.*steady/);
  w.landed = true;
  w.runEffects.step(w, STEP_MS / 1000);
  assert.equal(w.cart.force.x, force);
  w.dispose();
  const calm = flight(),
    windy = flight({ condition: "crosswind" });
  assert.ok(windy.score.distanceMetres > calm.score.distanceMetres);
  evidence.conditions.crosswind = {
    calmMetres: calm.score.distanceMetres,
    windMetres: windy.score.distanceMetres,
  };
});
test("Icy Ramp: lower runway/ramp/wheel friction and lower landing resistance", () => {
  const w = create({ condition: "icy-ramp" }),
    base = create();
  assert.ok(
    w.ground.friction < base.ground.friction &&
      w.ramp.friction < base.ramp.friction &&
      w.wheels[0].friction < base.wheels[0].friction,
  );
  assert.equal(w.runEffects.landingAirFriction, 0.018);
  w.dispose();
  base.dispose();
  const regular = flight(),
    ice = flight({ condition: "icy-ramp" });
  const roll = (r) => r.x - 1080 - r.score.distanceMetres * 40;
  assert.ok(roll(ice) > roll(regular));
  evidence.conditions["icy-ramp"] = {
    regularRoll: roll(regular),
    iceRoll: roll(ice),
    score: ice.score.total,
  };
});
test("Heavy Cart: slower identical pushes, heavier body, greater impact stability", () => {
  const heavy = create({ condition: "heavy-cart" }),
    base = create();
  for (const w of [heavy, base]) {
    w.elapsed = 0.35;
    w.step({ pushes: 1 });
  }
  assert.ok(
    heavy.cart.mass > base.cart.mass &&
      heavy.cart.velocity.x < base.cart.velocity.x,
  );
  assert.ok(heavy.character.landingStability > base.character.landingStability);
  evidence.conditions["heavy-cart"] = {
    baseSpeed: base.cart.velocity.x,
    heavySpeed: heavy.cart.velocity.x,
    mass: heavy.cart.mass,
  };
  heavy.dispose();
  base.dispose();
  assert.notEqual(
    flight({ condition: "heavy-cart" }).score.landingQuality,
    "No landing",
  );
});
test("Boost Strip: fixed visible zone supplies one impulse, never a repeating boost", () => {
  const w = create({ condition: "boost-strip" });
  const dx = 410 - w.cart.position.x;
  for (const body of w.dynamic) w.M.Body.translate(body, { x: dx, y: 0 });
  w.runEffects.step(w, STEP_MS / 1000);
  assert.equal(w.runEffects.boostUsed, true);
  assert.equal(w.M.Body.getVelocity(w.cart).x, 3);
  for (let i = 0; i < 30; i++) w.runEffects.step(w, STEP_MS / 1000);
  assert.equal(w.M.Body.getVelocity(w.cart).x, 3);
  assert.match(w.skills.feedback.detail, /BOOST STRIP/);
  w.dispose();
  const result = flight({ condition: "boost-strip" });
  assert.equal(result.boost, true);
  evidence.conditions["boost-strip"] = {
    score: result.score.total,
    once: true,
  };
});
test("Wrate Issue: countdown precedes a bounded predictable pulse that can be countered", () => {
  const w = create({ condition: "wrate-issue" });
  w.launched = true;
  w.launchTime = 0;
  w.elapsed = 0.5;
  w.runEffects.step(w, STEP_MS / 1000);
  assert.equal(w.cart.torque, 0);
  assert.match(w.runEffects.status(w), /IN 0.2 s/);
  w.elapsed = 0.7;
  w.runEffects.step(w, STEP_MS / 1000);
  assert.ok(
    w.cart.torque > 0 &&
      w.cart.torque < w.cart.inertia * 0.00006 * w.character.rotationControl,
  );
  assert.match(w.runEffects.status(w), /ACTIVE.*LEFT/);
  w.cart.torque = 0;
  w.elapsed = 0.9;
  w.runEffects.step(w, STEP_MS / 1000);
  assert.equal(w.cart.torque, 0);
  w.dispose();
  for (const c of CHARACTERS) {
    const result = flight({ condition: "wrate-issue" }, c);
    assert.ok(["Clean", "Scrappy"].includes(result.score.landingQuality));
    evidence.conditions[`wrate-${c.id}`] = result.score.landingQuality;
  }
});
test("Reinforced Wheels: an identical impact angle earns a better landing grade", () => {
  const base = create(),
    reinforced = create(upgrade("reinforced-wheels"));
  const metrics = {
    launched: true,
    landed: true,
    attached: true,
    crashed: false,
    distancePixels: 1000,
    landingAngle: 0.52,
    landingSpeed: 5,
  };
  assert.equal(scoreAttempt(metrics, base.character).landingQuality, "Scrappy");
  assert.equal(
    scoreAttempt(metrics, reinforced.character).landingQuality,
    "Clean",
  );
  evidence.upgrades["reinforced-wheels"] = {
    base: "Scrappy",
    upgraded: "Clean",
  };
  base.dispose();
  reinforced.dispose();
});
test("Wider Launch Window: actual push grading and meter share the widened window", () => {
  const w = create(upgrade("wider-launch-window"));
  assert.equal(takeoffGrade(975), "Good");
  const dx = 975 - w.cart.position.x;
  for (const body of w.dynamic) w.M.Body.translate(body, { x: dx, y: 0 });
  // Reposition as one rigid translation for this grading fixture.
  w.skills.push(w, 1);
  assert.equal(w.skills.takeoff, "Perfect");
  const view = worldSkillView(w),
    c = w.skills.config.takeoff;
  assert.equal(
    view.perfect[0],
    (c.perfectStart - c.armedX) / (c.goodEnd + c.meterOvershoot - c.armedX),
  );
  assert.equal(SKILL_CONFIG.takeoff.perfectStart, 980);
  w.dispose();
});
test("Improved Air Control: same input adds more torque without altering the shared character", () => {
  const base = create(),
    improved = create(upgrade("improved-air-control"));
  for (const w of [base, improved]) {
    w.launched = true;
    w.tricks.start({ time: 0, angle: w.cart.angle });
    w.step({ rotate: 1 });
  }
  assert.ok(improved.cart.angularVelocity > base.cart.angularVelocity);
  assert.equal(CHARACTERS[0].rotationControl, 0.9);
  base.dispose();
  improved.dispose();
});
test("Wider Brace Window: earlier timing improves, late timing stays late", () => {
  const w = create(upgrade("wider-brace-window"));
  assert.equal(braceGrade(0.25), "Good Brace");
  w.skills.braceAt = 1;
  w.elapsed = 1.25;
  w.skills.onLanding(w);
  assert.equal(w.skills.brace, "Perfect Brace");
  assert.equal(braceGrade(0.02, w.skills.config.brace), "Late");
  w.skills.braceAt = 1;
  w.elapsed = 1.44;
  assert.equal(w.skills.controlScale(w), 1);
  w.elapsed = 1.47;
  assert.equal(w.skills.controlScale(w), SKILL_CONFIG.brace.earlyControlScale);
  assert.equal(SKILL_CONFIG.brace.perfectMax, 0.22);
  w.dispose();
});
test("Style Multiplier: only the existing style component increases and its equation still matches", () => {
  const w = create(upgrade("style-multiplier"));
  const metrics = {
    launched: true,
    landed: true,
    attached: true,
    crashed: false,
    distancePixels: 1600,
    landingAngle: 0,
    landingSpeed: 3,
    trickSummary: { awards: [{ id: "front", combo: 1 }], forward: 1 },
  };
  const before = scoreAttempt(metrics, CHARACTERS[0]),
    after = scoreAttempt(metrics, w.character);
  assert.ok(after.stylePoints > before.stylePoints);
  for (const key of ["distancePoints", "landingPoints", "attachedPoints"])
    assert.equal(after[key], before[key]);
  assert.equal(
    after.stylePoints,
    Math.round(
      after.tricks.subtotal *
        after.tricks.characterMultiplier *
        after.tricks.landingMultiplier,
    ),
  );
  evidence.upgrades["style-multiplier"] = {
    base: before.stylePoints,
    upgraded: after.stylePoints,
  };
  w.dispose();
});
test("Emergency Stabilizer: one near-contact deployment, limited torque, no snap or invincibility", () => {
  const w = create(upgrade("emergency-stabilizer"));
  w.launched = true;
  w.elapsed = 2;
  w.M.Body.setAngle(w.cart, 1.5);
  w.M.Body.setAngularVelocity(w.cart, 0.1);
  w.M.Body.setVelocity(w.cart, { x: 10, y: 6 });
  w.skills.contactETA = () => 0.4;
  const angle = w.cart.angle;
  w.runEffects.step(w, STEP_MS / 1000);
  assert.equal(w.runEffects.stabilizerUsed, true);
  assert.equal(w.cart.angle, angle);
  assert.ok(w.cart.torque < 0 && w.cart.angularVelocity < 0.1);
  const deadline = w.runEffects.stabilizerUntil;
  w.elapsed = 3;
  w.cart.torque = 0;
  w.runEffects.step(w, STEP_MS / 1000);
  assert.equal(w.runEffects.stabilizerUntil, deadline);
  assert.equal(w.cart.torque, 0);
  w.dispose();
});
test("Faster Perfect Pushes: only Perfect speed improves, including actual one-push input", () => {
  for (const [time, faster] of [
    [0.35, true],
    [0.2, false],
    [0.01, false],
  ]) {
    const base = create(),
      fast = create(upgrade("faster-perfect-pushes"));
    for (const w of [base, fast]) {
      w.elapsed = time;
      w.skills.push(w, 1);
    }
    const a = base.M.Body.getVelocity(base.cart).x,
      b = fast.M.Body.getVelocity(fast.cart).x;
    if (faster) assert.ok(b > a);
    else assert.equal(b, a);
    base.dispose();
    fast.dispose();
  }
});
test("Impact Harness: identical head contact still crashes but prevents a marginal detachment", () => {
  const base = create(),
    harness = create(upgrade("impact-harness"));
  for (const w of [base, harness]) {
    w.elapsed = 1;
    w.preSpeeds = new Map([[w.head.id, { x: 4.5, y: 0 }]]);
    w.handleCollisions([{ bodyA: w.head, bodyB: w.ground }]);
    assert.equal(w.crashed, true);
  }
  assert.equal(base.attached, false);
  assert.equal(harness.attached, true);
  base.dispose();
  harness.dispose();
});

const metric = {
  launched: true,
  landed: true,
  attached: true,
  crashed: false,
  distancePixels: 1600,
  landingAngle: 0,
  landingSpeed: 5,
  braceGrade: "Perfect Brace",
  pushCounts: { Perfect: 2, Good: 0, Miss: 0 },
  trickSummary: {
    awards: [
      { id: "front", combo: 1 },
      { id: "noHands", combo: 1.25 },
    ],
    forward: 1,
  },
};
const result = scoreAttempt(metric, CHARACTERS[0]);
const world = { ...metric, finished: true, invalid: false };
for (const [id, objective] of Object.entries(OBJECTIVES))
  test(`Objective ${objective.type}: success, failure, unfinished, and invalid attempts`, () => {
    assert.equal(evaluateObjective(id, result, world).passed, true);
    const zero = scoreAttempt({ distancePixels: 0 }, CHARACTERS[0]);
    assert.equal(evaluateObjective(id, zero, { finished: true }).passed, false);
    assert.equal(
      evaluateObjective(id, result, { ...world, finished: false }).passed,
      false,
    );
    assert.equal(
      evaluateObjective(id, result, { ...world, invalid: true }).passed,
      false,
    );
    evidence.objectives.push(objective.type);
  });
test("Objective boundaries exclude the wrong trick, post-landing roll, wrong brace, and equal style factor", () => {
  const backward = scoreAttempt(
    {
      ...metric,
      trickSummary: { awards: [{ id: "back", combo: 1 }], backward: 1 },
    },
    CHARACTERS[0],
  );
  assert.equal(evaluateObjective("front-flip", backward, world).passed, false);
  assert.equal(
    evaluateObjective("landing-zone", result, {
      ...world,
      distancePixels: 45.001 * 40,
      cart: { position: { x: 2400 } },
    }).passed,
    false,
  );
  assert.equal(
    evaluateObjective("landing-zone", result, {
      ...world,
      distancePixels: 45 * 40,
    }).passed,
    true,
  );
  assert.equal(
    evaluateObjective(
      "perfect-brace",
      { ...result, braceGrade: "Good Brace" },
      world,
    ).passed,
    false,
  );
  assert.equal(
    evaluateObjective(
      "style-factor",
      {
        ...result,
        tricks: {
          ...result.tricks,
          characterMultiplier: 1,
          landingMultiplier: 1.5,
        },
      },
      world,
    ).passed,
    false,
  );
  assert.equal(
    evaluateObjective(
      "no-miss",
      { ...result, pushCounts: { Perfect: 2, Good: 0, Miss: 1 } },
      world,
    ).passed,
    false,
  );
});
test("Every upgrade is clamped to its limit and new Party worlds retain exact defaults", () => {
  for (const [id, item] of Object.entries(UPGRADES)) {
    const w = create({ upgrades: { [id]: 99 } });
    assert.equal(w.runEffects.upgrades[id], item.limit);
    w.dispose();
  }
  const before = flight();
  for (const id of Object.keys(UPGRADES)) {
    const w = create(upgrade(id));
    w.dispose();
  }
  const after = flight();
  assert.deepEqual(after, before);
  const party = create();
  assert.equal(party.runEffects, null);
  assert.equal(party.character, CHARACTERS[0]);
  assert.equal(party.skills.config, SKILL_CONFIG);
  party.dispose();
});
console.log(`${checks} isolated run-mechanics groups passed.`);
console.log(JSON.stringify(evidence, null, 2));
