import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { rhythmPosition } from "../js/skill-config.js";
import { normalAngle } from "../js/scoring.js";
import { COURSES, pinLayout } from "../js/course.js";
import { BOWLING, scoreBowling, bowlingLineKind } from "../js/bowling.js";
import { Tournament, State } from "../js/tournament.js";
import { attemptAchievementFacts } from "../js/achievement-events.js";
import { bowlingResultMarkup, finalMarkup, scoreboardMarkup } from "../js/party-ui.js";
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
const arena = { id: "bowling", course: "bowling" };
const PHASE = { P: 0.5, G: 0.29, M: 0.9 };
// A deterministic bowler: rhythm pushes on a phase pattern, one takeoff tap,
// level in the air, optional nudge on the lane.
function bowler(pattern, takeoffX, nudge = 0) {
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
    return { pushes, rotate: w.landed ? nudge : w.launched ? level : 0, brace: false };
  };
}
function bowl(character, controls) {
  const w = new PhysicsWorld(character, arena);
  for (let i = 0; i < 4000 && !w.finished; i++) w.step(controls(w));
  assert.ok(w.finished, "throw must end");
  return w;
}

check("The bowling course is data: run-up, ramp, long lane, a 1-2-3-4 rack and a backstop", () => {
  const c = COURSES.bowling;
  const spots = pinLayout(c.pins, c.groundY);
  assert.equal(spots.length, 10);
  assert.deepEqual([0, 1, 2, 3].map((r) => spots.filter((s) => s.row === r).length), [1, 2, 3, 4]);
  assert.ok(c.pins.x - c.rampEnd > 1500, "a long lane");
  assert.ok(c.rollOut && c.laneNudge > 0);
  assert.ok(c.pieces.some((p) => p.label === "backstop" && p.x > c.pins.x));
  const plain = new PhysicsWorld(CHARACTERS[0]);
  assert.deepEqual(plain.pins, []);
  assert.equal(plain.metrics().bowling, null, "other events have no pins");
  plain.dispose();
});

check("Pins are real bodies that stand still; same-row pins never collide, other rows do", () => {
  const w = new PhysicsWorld(CHARACTERS[0], arena);
  assert.equal(w.pins.length, 10);
  assert.ok(w.pins.every((p) => !p.isStatic));
  const [front, left, right] = w.pins;
  const collide = (a, b) => (a.collisionFilter.mask & b.collisionFilter.category) !== 0;
  assert.equal(collide(left, right), false, "row-mates stand side by side in depth");
  assert.equal(collide(front, left), true);
  assert.equal(collide(w.cart, front), true);
  for (let i = 0; i < 2400; i++) w.step();
  assert.equal(w.pinsDown, 0);
  assert.ok(w.pins.every((p) => Math.hypot(p.position.x - p.rest.x, p.position.y - p.rest.y) < 1));
  assert.deepEqual(w.bowlingResult(), { pins: 0, strike: false, cartHit: false, riderHit: false, riderOnly: false, maxSpeed: false });
  w.dispose();
});

check("Pin counting: tipped, dropped or knocked-away pins are down; a wobble is not", () => {
  const w = new PhysicsWorld(CHARACTERS[0], arena);
  const { Body } = w.M;
  Body.setAngle(w.pins[0], 0.3);
  Body.translate(w.pins[1], { x: 8, y: 0 });
  assert.equal(w.pinsDown, 0, "small nudges do not count");
  Body.setAngle(w.pins[0], 1.2);
  Body.translate(w.pins[2], { x: 60, y: 0 });
  Body.translate(w.pins[3], { x: 0, y: 30 });
  assert.equal(w.pinsDown, 3);
  Body.setAngle(w.pins[0], Math.PI);
  assert.equal(w.pinsDown, 3, "an upside-down pin is still one pin");
  w.dispose();
});

check("Cart and flying-rider contacts are told apart", () => {
  const w = new PhysicsWorld(CHARACTERS[1], arena);
  w.handleCollisions([{ bodyA: w.head, bodyB: w.pins[0] }]);
  assert.equal(w.bowling.cartHit, true, "a rider still in the cart counts as the cart");
  assert.equal(w.bowling.riderHit, false);
  const v = new PhysicsWorld(CHARACTERS[1], arena);
  v.attached = false;
  v.handleCollisions([{ bodyA: v.pins[4], bodyB: v.torso }]);
  assert.equal(v.bowling.riderHit, true);
  assert.equal(v.bowling.cartHit, false);
  assert.ok(v.drainEvents().includes("riderPins"));
  w.dispose();
  v.dispose();
});

check("Scoring: 10 per pin, +50 strike, +25 rider carnage; rider-only strikes and zero at max speed", () => {
  assert.deepEqual(
    { ...scoreBowling({ pins: 7, riderHit: false }) },
    { pins: 7, strike: false, carnage: false, riderOnly: false, zeroAtMaxSpeed: false, pinPoints: 70, strikeBonus: 0, carnageBonus: 0, points: 70 },
  );
  const strike = scoreBowling({ pins: 10, riderHit: true, riderOnly: true });
  assert.equal(strike.points, 10 * BOWLING.pinPoints + BOWLING.strikeBonus + BOWLING.carnageBonus);
  assert.equal(strike.riderOnly, true);
  assert.equal(scoreBowling({ pins: 9, riderHit: true, riderOnly: true }).riderOnly, false, "rider-only needs a strike");
  assert.equal(scoreBowling({ pins: 0, maxSpeed: true }).zeroAtMaxSpeed, true);
  assert.equal(scoreBowling({ pins: 99 }).pins, 10);
  assert.equal(scoreBowling({ pins: -3 }).points, 0);
  assert.equal(scoreBowling(null), null);
  assert.equal(bowlingLineKind(strike), "riderStrike");
  assert.equal(bowlingLineKind(scoreBowling({ pins: 0 })), "gutter");
});

check("Real throws: more speed knocks more pins; all-Perfect strikes for every character", () => {
  for (const c of CHARACTERS) {
    const sloppy = bowl(c, bowler("GM", 900)), good = bowl(c, bowler("G", 955)), perfect = bowl(c, bowler("P", 1020));
    const [s, g, p] = [sloppy, good, perfect].map((w) => w.bowlingResult());
    assert.ok(s.pins >= 1 && s.pins < g.pins, `${c.id}: sloppy ${s.pins} < good ${g.pins}`);
    assert.ok(g.pins >= 5 && !g.strike, `${c.id}: good pushes knock most but not all (${g.pins})`);
    assert.equal(p.strike, true, `${c.id}: all-Perfect is a strike`);
    const facts = attemptAchievementFacts(perfect, scoreAttempt(perfect.metrics(), perfect.character));
    assert.equal(facts.bowlStrike, true);
    // Replays carry every pin.
    const recording = new ReplayRecording(perfect);
    recording.capture(perfect, { particles: [], offset: () => ({ x: 0, y: 0 }) }, {});
    assert.equal(recording.frames[0].world.pins.length, 10);
    for (const w of [sloppy, good, perfect]) w.dispose();
  }
});

// --- Party rules ---
const base = {
  total: 100, distancePoints: 100, stylePoints: 0, landingPoints: 0, attachedPoints: 0,
  distanceMetres: 10, quarterTurns: 0, airDegrees: 0, landingAngle: 0, crashed: false,
};
const throwOf = (pins, extra = {}) => ({ ...base, bowling: scoreBowling({ pins, ...extra }) });
function bowlingParty(names) {
  const t = new Tournament(
    { players: names.map((name, i) => ({ name, characterId: CHARACTERS[i % 3].id })), event: "bowling" },
    { seedFactory: () => 4 },
  );
  t.confirm(); t.confirm(); t.confirm();
  return t;
}
function playFrame(t, plan) {
  assert.equal(t.state, State.ROUND_INTRO);
  t.confirm();
  while (t.state === State.READY) {
    const p = t.currentPlayer;
    t.confirm();
    assert.ok(t.record(plan(p.name, t.currentRound.number)));
    assert.match(bowlingResultMarkup(t), /PIN|STRIKE|GUTTER/);
    t.confirm();
  }
}
check("Party bowling: three frames, one throw each, points add up; strikes then pins break ties", () => {
  const t = bowlingParty(["Ana", "Bo", "Cy"]);
  assert.equal(t.totalRounds, BOWLING.throws);
  const plan = {
    Ana: [throwOf(10), throwOf(3), throwOf(5)], // 150 + 30 + 50 = 230
    Bo: [throwOf(8, { riderHit: true }), throwOf(7), throwOf(10)], // 105 + 70 + 150 = 325
    Cy: [throwOf(0), throwOf(10), throwOf(10, { riderHit: true, riderOnly: true })], // 0 + 150 + 175 = 325
  };
  for (let frame = 1; frame <= 3; frame++) {
    playFrame(t, (name, n) => plan[name][n - 1]);
    if (frame < 3) {
      assert.equal(t.state, State.SCOREBOARD);
      assert.match(scoreboardMarkup(t), /STRIKES/);
      t.confirm();
    }
  }
  assert.equal(t.state, State.FINAL);
  assert.deepEqual(t.standings.map((r) => [r.player.name, r.total, r.strikes, r.pins]), [["Cy", 325, 2, 20], ["Bo", 325, 1, 25], ["Ana", 230, 1, 18]]);
  assert.deepEqual(t.winners.map((p) => p.name), ["Cy"], "level on points: more strikes wins");
  assert.equal(t.awards.pinCollector.player.name, "Bo");
  assert.equal(t.awards.pinCollector.value, 25);
  assert.equal(t.awards.strikeLeader.player.name, "Cy");
  assert.equal(t.awards.bowlingBall.player.name, "Bo", "first to fly into the pins wins a tie");
  assert.equal(t.awards.gutterGlory.player.name, "Cy");
  assert.match(finalMarkup(t), /CY WINS!/);
  assert.match(finalMarkup(t), /HUMAN BOWLING BALL/);
  const bad = bowlingParty(["Ana", "Bo"]);
  bad.confirm(); bad.confirm();
  assert.throws(() => bad.record({ ...base }), TypeError);
});
console.log(`\n${checks} bowling test groups passed.`);
