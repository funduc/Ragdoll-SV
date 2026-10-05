import { AFTER_HOURS_LEVELS } from "../js/after-hours.js";
import { campaignFacts, combinedFacts } from "../js/campaign.js";
import { evaluateMedal } from "../js/campaign-levels.js";
import { driveChapter } from "./chapter-helpers.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { PhysicsWorld } from "../js/physics.js";
import { CHARACTERS } from "../js/characters.js";
import { rhythmPosition } from "../js/skill-config.js";
import { normalAngle, scoreAttempt } from "../js/scoring.js";
import { timedInputs } from "./skill-helpers.mjs";
runInThisContext(readFileSync(new URL("../vendor/matter-0.20.0.min.js", import.meta.url), "utf8"));

// Representative run-ups, with level steering and a timed brace in every case.
// This measures physical flight time, excluding Sync/replay presentation time.
const profiles = [
  ["sloppy", "GM", 900], // alternating Good/Miss; Early takeoff
  ["solid", "G", 955], // Good pushes and Good takeoff
  ["excellent", "P", 1020], // Perfect pushes and Perfect takeoff
];
const levelSteering = world => {
  const value = -normalAngle(world.cart.angle) * 2 - world.cart.angularVelocity * 28;
  return Math.abs(value) < .1 ? 0 : Math.sign(value);
};
const report = [];
for (const character of CHARACTERS) {
  const rows = [];
  for (const [play, pattern, takeoffX] of profiles) {
    const world = new PhysicsWorld(character);
    while (!world.finished) {
      let pushes = 0;
      if (!world.launched) {
        if (world.cart.position.x < world.skills.config.takeoff.armedX) {
          const count = Object.values(world.skills.pushes).reduce((a, b) => a + b, 0);
          const target = { P: .5, G: .29, M: .9 }[pattern[count % pattern.length]];
          const phase = rhythmPosition(world.elapsed);
          pushes = Number(phase >= target && phase <= target + .04 && world.elapsed - world.skills.lastPush > .4);
        } else if (!world.skills.takeoff) pushes = Number(world.cart.position.x >= takeoffX);
      }
      world.step({ pushes, rotate: levelSteering(world),
        brace: world.launched && world.skills.braceAt === null && world.skills.contactETA(world) < .18 });
    }
    const score = scoreAttempt(world.metrics(), character);
    const airtime = world.landingTime - world.launchTime;
    assert.ok(!world.invalid && !world.crashed);
    assert.equal(score.landingQuality, "Clean", `${character.id}/${play}: a level, braced landing stays Clean`);
    if (play !== "sloppy") assert.ok(airtime >= 2.1 && airtime <= 2.4, `${character.id}/${play}: ${airtime}`);
    assert.ok(score.distanceMetres < (play === "excellent" ? 75 : 60), "height, not runaway distance");
    rows.push({ character: character.id, play, airtime: +airtime.toFixed(3), distance: score.distanceMetres });
    world.dispose();
  }
  assert.ok(rows[0].airtime < rows[1].airtime && rows[1].airtime < rows[2].airtime);
  assert.ok(rows[0].distance < rows[1].distance && rows[1].distance < rows[2].distance);
  report.push(...rows);

  for (const turns of [1, 2]) {
    const world = new PhysicsWorld(character);
    let completedAt = null;
    while (!world.finished) {
      const spinning = world.cart.angle - world.launchAngle < Math.PI * 2 * turns;
      if (world.launched && !spinning && completedAt === null) completedAt = world.elapsed;
      world.step(timedInputs(world, spinning ? 1 : levelSteering(world), true));
    }
    const score = scoreAttempt(world.metrics(), character);
    assert.equal(score.tricks.completedRotations, turns);
    assert.equal(score.landingQuality, "Clean", `${character.id}: ${turns} flip(s) can land Clean`);
    assert.ok(completedAt !== null && completedAt < world.landingTime);
    if (turns === 1) assert.ok(world.landingTime - completedAt > .8, "comfortable recovery after a full flip");
    world.dispose();
  }
}
console.table(report);
console.log("PASS representative airtime/distance profiles; all characters recover a single flip and can land a double");

// Keep the optional chapter's top medals meaningful as well as reachable.
// Each heat starts on the actual runway; only ordinary push/rotate/brace inputs.
for (const character of CHARACTERS) {
  const heats = [];
  for (const level of AFTER_HOURS_LEVELS.slice(0, 3)) {
    const low = level.condition === "low-gravity", slab = level.condition === "tailwind";
    const delay = low ? { jake: 1.3, brandon: 0, owen: .5 }[character.id]
      : { jake: .9, brandon: 1.1, owen: 1.1 }[character.id];
    const world = driveChapter(new PhysicsWorld(character, level.arena, { condition: level.condition, upgrades: {} }),
      level, { flip: !slab, delay, tap: low ? (character.id === "brandon" ? .15 : 0) : undefined });
    const score = scoreAttempt(world.metrics(), world.character), facts = campaignFacts(score, world, true);
    assert.deepEqual(evaluateMedal(level, facts), { medal: 3, santor: true }, character.id + "/" + level.id);
    if (slab) {
      assert.equal(world.firstLandingPiece?.label, "CONCRETE+");
      assert.equal(evaluateMedal(level, { ...facts, targetLanding: false }).medal, 2);
    }
    if (low) assert.equal(evaluateMedal(level, { ...facts, doubleFlip: false }).medal, 2);
    heats.push({ score, facts }); world.dispose();
  }
  const finale = AFTER_HOURS_LEVELS[3], facts = combinedFacts(heats);
  assert.deepEqual(evaluateMedal(finale, facts), { medal: 3, santor: true }, character.id + "/closing-time: " + facts.combinedScore);
  assert.equal(evaluateMedal(finale, { ...facts, doubleFlips: 0 }).medal, 2);
  assert.equal(evaluateMedal(finale, { ...facts, targetLandings: 0 }).medal, 2);
  assert.equal(evaluateMedal(finale, { ...facts, controlledLandings: 2 }).santor, false);
  console.log(character.id, "After Hours Santor; Closing Time combined", facts.combinedScore);
}
