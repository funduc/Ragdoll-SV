import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { rhythmPosition } from "../js/skill-config.js";
import { normalAngle } from "../js/scoring.js";
import { COURSES } from "../js/course.js";
import { HIGH_JUMP_HEIGHTS, HIGH_JUMP_TRIES } from "../js/party-config.js";
import { Tournament, State } from "../js/tournament.js";
import { attemptAchievementFacts } from "../js/achievement-events.js";
import { highJumpResultMarkup, finalMarkup, scoreboardMarkup } from "../js/party-ui.js";
runInThisContext(
  readFileSync(new URL("../vendor/matter-0.20.0.min.js", import.meta.url), "utf8"),
);
const { PhysicsWorld } = await import("../js/physics.js");
const { CHARACTERS } = await import("../js/characters.js");
const { scoreAttempt } = await import("../js/scoring.js");
const { ReplayRecording } = await import("../js/replay.js");
let checks = 0;
const check = (name, fn) => {
  fn();
  checks++;
  console.log(`PASS ${name}`);
};
const arena = (barHeight) => ({ id: "high-jump", course: "high-jump", barHeight });
// A deterministic player: pushes at a meter phase pattern, one takeoff tap,
// then either stays level or holds a rotation key over the bar.
const PHASE = { P: 0.5, G: 0.29, M: 0.9 };
function player(pattern, takeoffX, rotate = "level") {
  return (w) => {
    let pushes = 0;
    if (!w.launched) {
      if (w.cart.position.x < w.skills.config.takeoff.armedX) {
        const n = w.skills.pushes.Perfect + w.skills.pushes.Good + w.skills.pushes.Miss;
        const want = PHASE[pattern[n % pattern.length]], p = rhythmPosition(w.elapsed);
        pushes = Number(p >= want && p <= want + 0.04 && w.elapsed - w.skills.lastPush > 0.4);
      } else if (!w.skills.takeoff) pushes = Number(w.cart.position.x >= takeoffX);
    }
    const tilt = normalAngle(w.cart.angle);
    const level = Math.max(-1, Math.min(1, -tilt * 2 - w.cart.angularVelocity * 28));
    return { pushes, rotate: w.launched && !w.landed ? (rotate === "level" ? level : rotate) : 0, brace: false };
  };
}
function jump(character, height, controls) {
  const w = new PhysicsWorld(character, arena(height));
  for (let i = 0; i < 4000 && !w.finished; i++) w.step(controls(w));
  assert.ok(w.finished, "attempt must end");
  return w;
}

check("The high-jump course is data: short run-up, steep kicker, pit and bar", () => {
  const c = COURSES["high-jump"];
  assert.ok(c.rampEnd - c.rampStart < 200 && c.groundY - c.rampTop >= 80, "a short, steep kicker");
  assert.ok(c.rampStart - c.startX < 2000, "a short run-up");
  assert.ok(c.bar.x > c.rampEnd);
  const pit = c.pieces.find((p) => p.label === "landing pit");
  assert.ok(pit.landing && pit.sign && pit.x - pit.width / 2 > c.bar.x, "a signed landing pit after the bar");
  // No bar without a height: the long jump never gets one.
  const plain = new PhysicsWorld(CHARACTERS[0]);
  assert.equal(plain.bar, null);
  assert.equal(plain.metrics().highJump, null);
  plain.dispose();
});

check("The bar is a real body that rests on its peg and only the bar touches the peg", () => {
  const w = new PhysicsWorld(CHARACTERS[0], arena(4));
  assert.equal(w.bar.isStatic, false);
  assert.ok(Math.abs(w.bar.bounds.min.y - (520 - 4 * 40)) < 0.5, "bar top at 4.00 m");
  assert.equal(w.barPeg.collisionFilter.mask, 0x0004, "the peg ignores the cart and rider");
  const y = w.bar.position.y;
  for (let i = 0; i < 1200; i++) w.step();
  assert.ok(Math.abs(w.bar.position.y - y) < 0.5, "an untouched bar stays put");
  assert.equal(w.highJump.knocked, false);
  assert.equal(w.highJumpResult().result, "short", "never reaching the bar is a miss");
  // Nudge it: a moved bar is a knocked bar, and a head contact marks the face.
  w.handleCollisions([{ bodyA: w.bar, bodyB: w.head }]);
  w.M.Body.setVelocity(w.bar, { x: 3, y: -2 });
  for (let i = 0; i < 30; i++) w.step();
  assert.equal(w.highJump.knocked, true);
  assert.deepEqual(w.highJumpResult(), { height: 4, result: "knocked", cleared: false, fosbury: false, face: true });
  assert.ok(w.drainEvents().includes("barKnocked"));
  w.dispose();
});

check("Real jumps: every character clears the opening height; skill decides the rest", () => {
  const sloppy = () => player("GM", 900), good = () => player("G", 955), perfect = () => player("P", 1020);
  for (const c of CHARACTERS) {
    const opening = jump(c, HIGH_JUMP_HEIGHTS[0], sloppy());
    assert.equal(opening.highJumpResult().result, "cleared", `${c.id} sloppy clears the opening height`);
    opening.dispose();
    const mid = jump(c, 5, good());
    assert.ok(mid.highJumpResult().cleared, `${c.id} good pushes clear 5 m`);
    mid.dispose();
    const high = jump(c, 7.5, perfect());
    assert.ok(high.highJumpResult().cleared, `${c.id} perfect pushes clear 7.5 m`);
    high.dispose();
    const tooHigh = jump(c, 10, perfect());
    assert.equal(tooHigh.highJumpResult().cleared, false, `${c.id} cannot clear 10 m`);
    tooHigh.dispose();
    const sloppyHigh = jump(c, 8, sloppy());
    assert.ok(["knocked", "under"].includes(sloppyHigh.highJumpResult().result));
    sloppyHigh.dispose();
  }
});

check("Clearing upside down is a Fosbury; clearing level is not", () => {
  const flop = jump(CHARACTERS[2], 4, player("P", 1020, -1));
  const r = flop.highJumpResult();
  assert.equal(r.cleared, true);
  assert.equal(r.fosbury, true);
  const facts = attemptAchievementFacts(flop, scoreAttempt(flop.metrics(), flop.character));
  assert.equal(facts.hjCleared, true);
  assert.equal(facts.hjFosbury, true);
  // Replay frames carry the bar, so playback shows it too.
  const recording = new ReplayRecording(flop);
  recording.capture(flop, { particles: [], offset: () => ({ x: 0, y: 0 }) }, {});
  assert.ok(recording.frames[0].world.bar.vertices.length === 4);
  assert.equal(recording.frames[0].world.highJump.fosbury, true);
  flop.dispose();
  const level = jump(CHARACTERS[0], 4, player("P", 1020));
  assert.equal(level.highJumpResult().cleared, true);
  assert.equal(level.highJumpResult().fosbury, false);
  level.dispose();
});

// --- Rules ---
const base = {
  total: 100, distancePoints: 100, stylePoints: 0, landingPoints: 0, attachedPoints: 0,
  distanceMetres: 10, quarterTurns: 0, airDegrees: 0, landingAngle: 0, crashed: false,
};
const attempt = (height, result, extra = {}) => ({
  ...base,
  highJump: { height, result, cleared: result === "cleared", fosbury: false, face: false, ...extra },
});
function highJumpParty(names) {
  const t = new Tournament(
    { players: names.map((name, i) => ({ name, characterId: CHARACTERS[i % 3].id })), event: "high-jump" },
    { seedFactory: () => 5 },
  );
  t.confirm(); t.confirm(); t.confirm(); // title → setup → rules → round intro
  return t;
}
// Plays one height; plan(name, try) returns "cleared" | "knocked" | … .
function playHeight(t, plan, extra = () => ({})) {
  assert.equal(t.state, State.ROUND_INTRO);
  t.confirm();
  const seen = [];
  while (t.state === State.READY) {
    const p = t.currentPlayer;
    seen.push(`${p.name}${t.attemptNumber}`);
    t.confirm();
    const result = plan(p.name, t.attemptNumber);
    assert.ok(t.record(attempt(t.currentRound.height, result, extra(p.name, t.attemptNumber))));
    assert.equal(t.state, State.RESULTS);
    assert.ok(highJumpResultMarkup(t).includes(result === "cleared" ? "CLEAR" : "BAR"));
    t.confirm();
  }
  return seen;
}
check("High Jump rules: three tries per height, misses go to the back, three misses are out", () => {
  const t = highJumpParty(["Ana", "Bo", "Cy"]);
  assert.equal(t.currentRound.height, HIGH_JUMP_HEIGHTS[0]);
  assert.equal(HIGH_JUMP_TRIES, 3);
  const order = playHeight(t, (name, n) => (name === "Bo" && n < 3 ? "knocked" : name === "Cy" ? "under" : "cleared"));
  // Tries rotate: everyone's first, then second tries, then third tries.
  assert.deepEqual(order, ["Ana1", "Bo1", "Cy1", "Bo2", "Cy2", "Bo3", "Cy3"]);
  assert.equal(t.state, State.SCOREBOARD);
  assert.deepEqual(t.lastEliminatedAll.map((p) => p.name), ["Cy"]);
  assert.match(scoreboardMarkup(t), /CY IS OUT/);
  t.confirm();
  assert.equal(t.currentRound.height, HIGH_JUMP_HEIGHTS[1], "the bar rises each round");
  assert.deepEqual(t.roster.map((p) => p.name), ["Ana", "Bo"]);
  assert.equal(t.bestHeightFor("p1"), HIGH_JUMP_HEIGHTS[0]);
  assert.equal(t.missesFor("p2"), 2);
});
check("High Jump scoring: best height wins, then count-back on misses, then Fosburys", () => {
  const t = highJumpParty(["Ana", "Bo", "Cy"]);
  // Height 1: all clear, Bo needs two tries. Height 2: Ana and Bo clear (Ana
  // with a Fosbury), Cy is out. Height 3: nobody clears.
  playHeight(t, (name, n) => (name === "Bo" && n === 1 ? "knocked" : "cleared"));
  t.confirm();
  playHeight(t, (name) => (name === "Cy" ? "knocked" : "cleared"), (name) => ({ fosbury: name === "Ana" }));
  t.confirm();
  playHeight(t, () => "knocked", (name, n) => ({ face: name === "Bo" && n === 1 }));
  assert.equal(t.state, State.FINAL);
  // Ana and Bo both reached height 2 with no misses there; Bo has an extra miss overall.
  assert.deepEqual(t.standings.map((r) => [r.player.name, r.height]), [["Ana", 2.5], ["Bo", 2.5], ["Cy", 1]]);
  assert.deepEqual(t.winners.map((p) => p.name), ["Ana"]);
  assert.equal(t.awards.fosburyKing.player.name, "Ana");
  assert.equal(t.awards.barBreaker.player.name, "Bo");
  assert.equal(t.awards.cleanSheet.player.name, "Ana");
  assert.match(finalMarkup(t), /ANA WINS!/);
  assert.match(finalMarkup(t), /2\.50 m/);
  assert.match(finalMarkup(t), /FOSBURY KING/);
  // Level on every count-back → a shared win.
  const tie = highJumpParty(["Ana", "Bo"]);
  playHeight(tie, () => "cleared");
  tie.confirm();
  playHeight(tie, () => "knocked");
  assert.deepEqual(tie.winners.map((p) => p.name), ["Ana", "Bo"]);
  // A cleared try must carry a bar result.
  const bad = highJumpParty(["Ana", "Bo"]);
  bad.confirm(); bad.confirm();
  assert.throws(() => bad.record({ ...base }), TypeError);
});
check("The event is picked on the title screen and Chaos still rolls per height", () => {
  const t = new Tournament({ event: "long-jump" }, { seedFactory: () => 1 });
  assert.equal(t.highJump, false);
  assert.ok(t.setEvent("high-jump"));
  assert.equal(t.highJump, true);
  assert.equal(t.currentRound.height, HIGH_JUMP_HEIGHTS[0]);
  t.confirm(); t.confirm(); t.confirm(); t.confirm();
  assert.equal(t.setEvent("long-jump"), false, "no switching mid-game");
  const chaos = new Tournament({ event: "high-jump", chaos: true }, { seedFactory: () => 2 });
  assert.ok(chaos.currentRound.condition);
});
console.log(`\n${checks} high jump test groups passed.`);
