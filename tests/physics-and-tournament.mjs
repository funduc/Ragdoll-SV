import { crashInputs, timedInputs } from "./skill-helpers.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { CHARACTERS } from "../js/characters.js";
import { PhysicsWorld } from "../js/physics.js";
import {
  normalAngle,
  scoreAttempt,
  rankQualifiers,
  championshipWinners,
} from "../js/scoring.js";
import { Tournament, State } from "../js/tournament.js";
import {
  normalizeSetup,
  loadPartySetup,
  savePartySetup,
  PARTY_SETUP_KEY,
  MIN_PLAYERS,
  MAX_PLAYERS,
} from "../js/party-config.js";
import { ALL_CONDITION_IDS, CONDITION_IDS } from "../js/run-config.js";
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
    world.step(
      typeof controls === "function"
        ? controls(world)
        : controls.accelerate
          ? timedInputs(world, controls.rotate, true)
          : { pushes: 0, rotate: controls.rotate },
    );
  assert.ok(world.finished, "attempt must end");
  return world;
}
const scores = {};
test("Every character launches, lands, settles, and earns a finite score", () => {
  for (const c of CHARACTERS) {
    const w = jump(c, { accelerate: true, rotate: 0 });
    const s = scoreAttempt(w.metrics(), c);
    assert.ok(w.launched && w.landed);
    assert.ok(s.distanceMetres > 20 && s.distanceMetres < 80);
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
  const w = jump(CHARACTERS[0], (world) =>
    timedInputs(
      world,
      world.cart.angle - world.launchAngle < Math.PI * 2
        ? 1
        : Math.max(
            -1,
            Math.min(
              1,
              -normalAngle(world.cart.angle) * 2 -
                world.cart.angularVelocity * 28,
            ),
          ),
      true,
    ),
  );
  const s = scoreAttempt(w.metrics(), CHARACTERS[0]);
  assert.ok(s.airDegrees >= 360);
  assert.ok(s.stylePoints >= 240);
  assert.equal(s.landingQuality, "Clean");
  w.dispose();
});
test("Crashes detach the rider but retain distance and style", () => {
  const w = jump(CHARACTERS[1], w => crashInputs(w, true));
  const s = scoreAttempt(w.metrics(), CHARACTERS[1]);
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
  const w = jump(CHARACTERS[1], w => crashInputs(w, true));
  assert.ok(w.crashed);
  assert.ok(w.elapsed < 10);
  assert.notEqual(w.reason, "Attempt time limit");
  w.dispose();
});
test("Distance freezes at first contact, never at the end of the roll", () => {
  const w = new PhysicsWorld(CHARACTERS[0]);
  while (!w.landed) w.step(timedInputs(w));
  const distance = w.distancePixels;
  while (!w.finished) w.step(timedInputs(w));
  assert.equal(w.distancePixels, distance);
  assert.ok(w.cart.position.x > 1080 + distance);
  w.dispose();
});
test("Restart is legal on the runway and locked after takeoff", () => {
  const w = new PhysicsWorld(CHARACTERS[0]);
  assert.ok(w.canRestart);
  while (!w.launched) w.step(timedInputs(w));
  assert.equal(w.canRestart, false);
  w.dispose();
  assert.equal(w.canRestart, false);
});
test("Repeated world disposal removes bodies, joints, pairs, and callbacks", () => {
  for (let i = 0; i < 15; i++) {
    const w = new PhysicsWorld(CHARACTERS[i % 3]);
    assert.equal(Matter.Composite.allBodies(w.engine.world).length, 17);
    assert.equal(Matter.Composite.allConstraints(w.engine.world).length, 15);
    for (let j = 0; j < 30; j++) w.step(timedInputs(w));
    w.dispose();
    w.dispose();
    assert.equal(Matter.Composite.allBodies(w.engine.world).length, 0);
    assert.equal(Matter.Composite.allConstraints(w.engine.world).length, 0);
    assert.equal(w.engine.pairs.list.length, 0);
    assert.equal(w.engine.events.collisionStart.length, 0);
  }
});
// Party Tournament: a score whose total is all distance points.
const fake = (total, extra = {}) => ({
  ...scores.jake,
  total,
  distancePoints: total,
  stylePoints: 0,
  landingPoints: 0,
  attachedPoints: 0,
  distanceMetres: total / 10,
  crashed: false,
  ...extra,
});
const party = (players, format, chaos = false) => {
  const t = new Tournament(
    { players: players.map(([name, characterId]) => ({ name, characterId })), format, chaos },
    { seedFactory: () => 7 },
  );
  t.confirm(); // title → setup
  t.confirm(); // setup → rules
  t.confirm(); // rules → round intro
  return t;
};
// Plays the current round; totals(player, round) decides each jump's score.
const playRound = (t, totals) => {
  assert.equal(t.state, State.ROUND_INTRO);
  t.confirm();
  for (let i = 0; i < t.roster.length; i++) {
    assert.equal(t.state, State.READY);
    t.confirm();
    assert.ok(t.active);
    assert.ok(t.record(fake(totals(t.currentPlayer, t.currentRound.number))));
    assert.equal(t.record(fake(1)), false, "one score per player per round");
    assert.equal(t.state, State.RESULTS);
    t.confirm();
  }
};
test("Setup accepts 2–6 named players with duplicate characters and sanitizes saved data", () => {
  assert.deepEqual(normalizeSetup(null).players.map((p) => p.characterId), CHARACTERS.map((c) => c.id));
  const odd = normalizeSetup({
    players: [{ name: "  Sam\n  the   Great  ", characterId: "owen" }, { name: 42, characterId: "nobody" }, ...Array(9).fill({})],
    format: "marathon",
    chaos: "yes",
  });
  assert.equal(odd.players.length, MAX_PLAYERS);
  assert.equal(odd.players[0].name, "Sam the Great");
  assert.equal(odd.players[1].characterId, CHARACTERS[1].id);
  assert.equal(odd.format, "quick");
  assert.equal(odd.chaos, false);
  assert.equal(normalizeSetup({ players: [{ name: "Solo" }] }).players.length, MIN_PLAYERS);
  const t = new Tournament();
  assert.equal(t.editSetup({ type: "add" }), false, "setup edits only on the setup screen");
  t.confirm();
  assert.equal(t.state, State.SETUP);
  for (let i = 0; i < 5; i++) t.editSetup({ type: "add" });
  assert.equal(t.setup.players.length, MAX_PLAYERS);
  t.editSetup({ type: "character", index: 5, value: "jake" });
  t.editSetup({ type: "character", index: 4, value: "villain" });
  t.editSetup({ type: "name", index: 5, value: "Jake Two" });
  while (t.editSetup({ type: "remove", index: 0 }));
  assert.equal(t.setup.players.length, MIN_PLAYERS);
  t.confirm();
  assert.deepEqual(t.players.map((p) => [p.name, p.character.id]), [["Player 1", "brandon"], ["Jake Two", "jake"]], "an unknown character is ignored");
  // Saved settings round-trip; corrupt or denied storage falls back to defaults.
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.ok(savePartySetup(storage, { players: [{ name: "Ana", characterId: "brandon" }, { name: "Bo", characterId: "brandon" }], format: "elimination", chaos: true, event: "high-jump" }));
  assert.deepEqual(loadPartySetup(storage), { players: [{ name: "Ana", characterId: "brandon" }, { name: "Bo", characterId: "brandon" }], format: "elimination", chaos: true, event: "high-jump" });
  store.set(PARTY_SETUP_KEY, JSON.stringify({ players: [], event: "pole-vault" }));
  assert.equal(loadPartySetup(storage).event, "long-jump", "an unknown event falls back to Long Jump");
  store.set(PARTY_SETUP_KEY, "{broken");
  assert.equal(loadPartySetup(storage).players.length, 3);
  assert.equal(loadPartySetup({ getItem() { throw new Error("denied"); } }).format, "quick");
  assert.equal(savePartySetup({ setItem() { throw new Error("full"); } }, {}), false);
});
test("Quick: one jump each, highest total wins, ties share the win, restart returns to title", () => {
  const t = party([["Ana", "jake"], ["Bo", "jake"], ["Cy", "owen"]], "quick");
  playRound(t, (p) => ({ Ana: 500, Bo: 700, Cy: 700 })[p.name]);
  assert.equal(t.state, State.FINAL);
  assert.deepEqual(t.winners.map((p) => p.name), ["Bo", "Cy"]);
  assert.equal(t.jumps.length, 3);
  assert.equal(t.awards.mostConsistent, null, "one jump each has no consistency award");
  t.confirm();
  assert.equal(t.state, State.TITLE);
  assert.equal(t.jumps.length, 0);
});
test("Best of 3: three rounds with scoreboards, running totals and best jumps", () => {
  const t = party([["Ana", "jake"], ["Bo", "brandon"], ["Cy", "owen"], ["Di", "owen"]], "best-of-3");
  const plan = { Ana: [400, 800, 400], Bo: [600, 600, 600], Cy: [900, 100, 100], Di: [500, 500, 520] };
  for (let round = 1; round <= 3; round++) {
    assert.equal(t.currentRound.number, round);
    assert.equal(t.round, round === 3 ? "championship" : "qualifying");
    playRound(t, (p, n) => plan[p.name][n - 1]);
    if (round < 3) {
      assert.equal(t.state, State.SCOREBOARD);
      t.confirm();
    }
  }
  assert.equal(t.state, State.FINAL);
  assert.deepEqual(t.standings.map((row) => [row.player.name, row.total]), [["Bo", 1800], ["Ana", 1600], ["Di", 1520], ["Cy", 1100]]);
  assert.equal(t.bestJumpFor("p3").score.total, 900);
  assert.deepEqual(t.winners.map((p) => p.name), ["Bo"]);
  assert.equal(t.awards.longestJump.player.name, "Cy", "Cy's 90 m jump is the longest");
  assert.equal(t.awards.mostConsistent.player.name, "Bo");
  assert.equal(t.awards.bestStyle, null, "no style points, no style award");
  assert.equal(t.awards.crashOfNight, null);
});
test("Elimination: lowest running total drops each round until one is left", () => {
  const t = party([["Ana", "jake"], ["Bo", "brandon"], ["Cy", "owen"], ["Di", "jake"]], "elimination");
  assert.equal(t.totalRounds, 3);
  const plan = { Ana: 300, Bo: 500, Cy: 400, Di: 300 };
  const outs = [];
  while (t.state !== State.FINAL) {
    playRound(t, (p) => plan[p.name]);
    outs.push(t.lastEliminated?.name ?? t.eliminated.at(-1).player.name);
    if (t.state === State.SCOREBOARD) {
      assert.ok(t.standings.at(0).out === null);
      t.confirm();
      assert.equal(t.roster.length, 4 - outs.length);
    }
  }
  // Ana and Di tie on 300: equal best jumps, so the later roster player goes.
  assert.deepEqual(outs, ["Di", "Ana", "Cy"]);
  assert.deepEqual(t.winners.map((p) => p.name), ["Bo"]);
  assert.equal(t.jumpsFor("p2").length, 3);
  assert.equal(t.jumpsFor("p4").length, 1);
});
test("Chaos rolls a seeded condition each round without repeats until all have appeared", () => {
  const conditions = [];
  const t = party([["Ana", "jake"], ["Bo", "owen"]], "best-of-3", true);
  for (let round = 1; round <= 3; round++) {
    conditions.push(t.currentRound.condition);
    playRound(t, () => 100);
    if (t.state === State.SCOREBOARD) t.confirm();
  }
  assert.equal(new Set(conditions).size, 3);
  assert.ok(conditions.every((id) => ALL_CONDITION_IDS.includes(id)));
  assert.deepEqual(conditions, party([["A", "jake"], ["B", "jake"]], "best-of-3", true).chaosBag.slice(0, 3), "same seed, same rolls");
  assert.equal(party([["A", "jake"], ["B", "jake"]], "quick").currentRound.condition, null);
  assert.deepEqual([...CONDITION_IDS], ["crosswind", "icy-ramp", "heavy-cart", "boost-strip", "wrate-issue"], "Vault Run seeds never see Party-only conditions");
  const w = new PhysicsWorld(CHARACTERS[0], undefined, { condition: "low-gravity" });
  assert.ok(Math.abs(w.engine.gravity.y - 1.05 * 0.6) < 1e-9);
  w.dispose();
});
test("Awards: crash of the night, best style and consistency use real jumps", () => {
  const t = party([["Ana", "jake"], ["Bo", "brandon"]], "best-of-3");
  const style = (total, styleValue) => fake(total, { distancePoints: total - styleValue, stylePoints: styleValue });
  const plan = {
    Ana: [style(500, 200), fake(200, { crashed: true, carnage: { total: 300 } }), fake(500)],
    Bo: [fake(450, { crashed: true, carnage: { total: 300 } }), fake(460), fake(470)],
  };
  for (let round = 1; round <= 3; round++) {
    playRound(t, () => 0);
    if (t.state === State.SCOREBOARD) t.confirm();
  }
  // Replay the plan directly onto the recorded rounds to control every field.
  t.rounds.forEach((round, i) => {
    round.scores.p1 = plan.Ana[i];
    round.scores.p2 = plan.Bo[i];
  });
  const awards = t.computeAwards();
  assert.equal(awards.crashOfNight.player.name, "Bo", "first crash wins tied carnage");
  assert.equal(awards.bestStyle.player.name, "Ana");
  assert.equal(awards.bestStyle.value, 200);
  assert.equal(awards.mostConsistent.player.name, "Bo");
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
  for (let i = 0; i < 5; i++) t.confirm();
  assert.ok(t.active);
  t.confirm();
  assert.equal(t.state, State.ACTIVE);
  assert.ok(t.resetAttempt());
  assert.equal(t.state, State.READY);
});
test("Attempt timeout is enforced; unrecognized angle alone earns no style", () => {
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
  assert.equal(s.stylePoints, 0);
  assert.equal(s.attachedPoints, 0);
});
console.log(`\n${checks} test groups passed.`);
