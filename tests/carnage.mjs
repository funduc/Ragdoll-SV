import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { PhysicsWorld } from "../js/physics.js";
import { CHARACTERS } from "../js/characters.js";
import { scoreAttempt } from "../js/scoring.js";
import { crashInputs, timedInputs } from "./skill-helpers.mjs";
import { attemptAchievementFacts } from "../js/achievement-events.js";
import { AchievementManager } from "../js/achievements.js";
import { Tournament, State } from "../js/tournament.js";
import { carnageDetails, crashOfNightMarkup } from "../js/ui-content.js";
import { ReplayRecording, ReplayPlayer } from "../js/replay.js";
import { Effects } from "../js/effects.js";
runInThisContext(readFileSync(new URL("../vendor/matter-0.20.0.min.js", import.meta.url), "utf8"));

for (const character of CHARACTERS) {
  for (const brace of [false, true]) {
    const world = new PhysicsWorld(character);
    const control = new PhysicsWorld(character);
    control.damage.contact = () => {};
    control.damage.afterStep = () => {};
    while (!world.finished) {
      world.step(timedInputs(world, 0, brace));
      control.step(timedInputs(control, 0, brace));
      assert.deepEqual(world.dynamic.map(b => [b.position.x, b.position.y, b.angle]),
        control.dynamic.map(b => [b.position.x, b.position.y, b.angle]));
    }
    const score = scoreAttempt(world.metrics(), character);
    assert.equal(world.crashed, false);
    assert.ok(["Clean", "Scrappy"].includes(score.landingQuality));
    assert.deepEqual(score, scoreAttempt(control.metrics(), character));
    assert.equal(world.damage.lostParts.size, 0);
    assert.equal(world.damage.summary(), null);
    assert.equal(carnageDetails(score), "");
    world.dispose(); control.dispose();
  }
}
console.log("PASS all characters: clean/scrappy trajectories and normal scores are identical with damage observation disabled");

const crashScores = [];
for (const character of CHARACTERS) {
  const world = new PhysicsWorld(character);
  const tape = new ReplayRecording(world), effects = new Effects();
  let ejectionVerified = false, maxSeparation = 0, beforeTouchdown;
  while (!world.finished) {
    const alreadyEjected = world.damage.ejected;
    world.step(crashInputs(world));
    if (world.damage.ejected && !alreadyEjected) {
      for (const body of world.rider) {
        const velocity = world.M.Body.getVelocity(body), incoming = world.preSpeeds.get(body.id);
        assert.ok(Math.abs(velocity.x - incoming.x) < 1e-9, "horizontal momentum survives ejection");
        assert.ok(velocity.y <= 0, "rider rebounds out of the basket");
        assert.ok(Math.abs(Math.hypot(velocity.x, velocity.y) - Math.hypot(incoming.x, incoming.y)) < 1e-9,
          "release redirects existing speed, without a manufactured speed boost");
      }
      ejectionVerified = true;
    }
    if (world.damage.lostWheels.size && !world.damage.landedAfterWheelLoss)
      beforeTouchdown = attemptAchievementFacts(world, scoreAttempt(world.metrics(), character));
    maxSeparation = Math.max(maxSeparation, Math.hypot(world.torso.position.x - world.cart.position.x, world.torso.position.y - world.cart.position.y));
    tape.capture(world, effects, {});
  }
  assert.ok(world.crashed && !world.invalid);
  assert.ok(world.damage.lostParts.size >= 2 && world.damage.lostParts.size <= 4);
  const bodies = Matter.Composite.allBodies(world.engine.world);
  const constraints = Matter.Composite.allConstraints(world.engine.world);
  for (const index of world.damage.lostWheels) {
    assert.ok(!constraints.includes(world.axles[index]), "axle really breaks");
    assert.ok(bodies.includes(world.wheels[index]), "loose wheel remains physical");
  }
  for (const body of world.damage.debris) assert.ok(bodies.includes(body));
  if (world.severeCrash) {
    assert.ok(ejectionVerified && maxSeparation > 200);
    assert.ok(world.damage.summary().airtime > 0);
    assert.ok(world.damage.summary().distance > 0);
    assert.ok(world.damage.summary().bounces >= 1);
  }
  const normal = scoreAttempt(world.metrics(), character);
  const score = { ...normal, carnage: world.damage.summary() };
  assert.equal(score.total, score.distancePoints + score.landingPoints + score.stylePoints + score.attachedPoints);
  assert.match(carnageDetails(score), /CARNAGE/);
  const summary = JSON.stringify(score.carnage);
  world.step(); assert.equal(JSON.stringify(world.damage.summary()), summary);
  const sample = new ReplayPlayer(tape); sample.time = tape.frames.at(-1).time;
  const replay = sample.sample().world;
  assert.deepEqual([...replay.damage.lostParts], [...world.damage.lostParts]);
  assert.deepEqual(replay.damage.debris.map(b => [b.label, b.position, b.angle]),
    world.damage.debris.map(b => [b.label, b.position, b.angle]));
  assert.notEqual(replay.damage.debris[0], world.damage.debris[0]);
  const manager = new AchievementManager(null);
  const facts = attemptAchievementFacts(world, score);
  if (beforeTouchdown) {
    manager.send("attempt-ended", { ...beforeTouchdown, valid: true });
    assert.equal(manager.data.records.wheel.unlocked, false, "loss alone is not a later landing");
  }
  manager.send("attempt-ended", { ...facts, valid: false });
  assert.equal(manager.data.records.wheel.unlocked, false);
  manager.send("attempt-ended", facts);
  assert.equal(manager.data.records.theseus.unlocked, true);
  assert.equal(manager.data.records.wheel.unlocked, true);
  assert.equal(facts.carnage, score.carnage.total);
  assert.equal(manager.data.records["parts-department"].progress, Math.min(1000, score.carnage.total));
  assert.equal(manager.data.records["parts-department"].unlocked, score.carnage.total >= 1000);
  crashScores.push(score);
  world.dispose();
  assert.equal(Matter.Composite.allBodies(world.engine.world).length, 0);
  assert.equal(Matter.Composite.allConstraints(world.engine.world).length, 0);
}
console.log("PASS real crashes: axles break, panels persist, ejection keeps incoming speed, airborne/bounce/travel carnage, replay debris, real achievement unlocks and disposal");

// Best of 3 with a duplicate character: carnage is tracked per player.
const tournament = new Tournament({
  players: [{ name: "Ana", characterId: "jake" }, { name: "Bo", characterId: "jake" }, { name: "Cy", characterId: "owen" }],
  format: "best-of-3",
}, { seedFactory: () => 1 });
assert.equal(tournament.crashOfNight, null);
for (let i = 0; i < 3; i++) tournament.confirm(); // setup → rules → round intro
const play = (score) => {
  tournament.confirm(); // round intro or results → ready
  if (tournament.state !== State.READY) tournament.confirm();
  tournament.confirm(); // ready → active
  assert.ok(tournament.record(score));
};
const crash = (i, total, extra = {}) => ({ ...crashScores[i], carnage: { ...crashScores[i].carnage, total }, ...extra });
for (let i = 0; i < 3; i++) play(crash(i, 100 + i));
tournament.confirm();
assert.equal(tournament.state, State.SCOREBOARD);
tournament.confirm();
play(crash(0, 9999)); // Ana, round 2
const firstBig = tournament.currentPlayer;
play(crash(1, 5));
play(crash(2, 5));
tournament.confirm(); tournament.confirm();
play(crash(0, 1, { total: crashScores[0].total + 1, distancePoints: crashScores[0].distancePoints + 1 }));
play(crash(1, 9999)); // Bo ties the carnage later: the first crash keeps it
play(crash(2, 1));
tournament.confirm();
assert.equal(tournament.state, State.FINAL);
assert.equal(tournament.crashOfNight.player, firstBig, "first crash wins tied carnage");
assert.equal(tournament.crashOfNight.carnage.total, 9999);
assert.equal(tournament.awards.crashOfNight.player.name, "Ana");
assert.notEqual(tournament.crashOfNight.player.name, "Bo", "same character, different player");
const expectedWinner = [...tournament.players].sort((a, b) => tournament.totalFor(b.id) - tournament.totalFor(a.id))[0];
assert.ok(tournament.winners.includes(expectedWinner), "normal points still decide the winner");
assert.match(crashOfNightMarkup(tournament.crashOfNight), /JOHN:/);
assert.match(crashOfNightMarkup(tournament.crashOfNight), /CRASH OF THE NIGHT/);
assert.match(crashOfNightMarkup(tournament.crashOfNight), /ANA HAS REQUESTED/);
tournament.confirm(); assert.equal(tournament.crashOfNight, null);
tournament.rounds[0].scores.p3 = { crashed: true, carnage: { total: 0 } };
assert.equal(tournament.crashOfNight.character.id, "owen");
console.log("PASS Crash of the Night considers every round, tracks players (not characters), preserves normal winners and clears on restart");
