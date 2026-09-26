// Dependency-free deterministic campaign rules, saves, and real Matter attempts.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { CHARACTERS } from "../js/characters.js";
import {
  LEVELS,
  evaluateMedal,
  meetsThreshold,
} from "../js/campaign-levels.js";
import {
  CampaignSave,
  CAMPAIGN_SAVE_KEY,
  emptyCampaignSave,
  normalizeCampaignSave,
} from "../js/campaign-save.js";
import { Campaign, CampaignState as S } from "../js/campaign.js";
import { PhysicsWorld } from "../js/physics.js";
import { scoreAttempt } from "../js/scoring.js";
import { Tournament } from "../js/tournament.js";
import { timedInputs } from "./skill-helpers.mjs";
runInThisContext(
  readFileSync(
    new URL("../vendor/matter-0.20.0.min.js", import.meta.url),
    "utf8",
  ),
);
let checks = 0;
const check = (name, fn) => {
  fn();
  checks++;
  console.log(`PASS ${name}`);
};
const storage = () => {
  const entries = new Map();
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, String(value)),
  };
};
const finished = { finished: true, invalid: false };
check(
  "Ten frozen level definitions contain all required data and linear unlocks",
  () => {
    assert.equal(LEVELS.length, 10);
    assert.equal(new Set(LEVELS.map((l) => l.id)).size, 10);
    for (const [i, level] of LEVELS.entries()) {
      for (const key of [
        "id",
        "name",
        "description",
        "objective",
        "arena",
        "modifier",
        "bronze",
        "silver",
        "gold",
        "santorMedal",
        "prerequisites",
        "john",
      ])
        assert.ok(Object.hasOwn(level, key));
      assert.deepEqual(level.prerequisites, i ? [LEVELS[i - 1].id] : []);
      assert.ok(
        Object.isFrozen(level.arena) && Object.isFrozen(level.gold.all),
      );
      assert.equal(level.arena.gravity, 1.05);
      assert.ok(
        level.john.introduction && Object.keys(level.john.results).length === 4,
      );
    }
  },
);
check(
  "Orientation medals require ramp completion, Good-or-better pushes, or Perfect takeoff",
  () => {
    const award = (facts) =>
      evaluateMedal(LEVELS[0], { ...finished, ...facts }).medal;
    assert.equal(award({}), 0);
    assert.equal(award({ reachedRamp: true }), 1);
    assert.equal(award({ reachedRamp: true, goodPushes: 1 }), 1);
    assert.equal(award({ reachedRamp: true, goodPushes: 2 }), 2);
    assert.equal(award({ reachedRamp: true, perfectTakeoff: true }), 3);
    assert.equal(award({ reachedRamp: true, goodPushes: Infinity }), 1);
  },
);
check(
  "Wheels Down requires a completed jump; Clean plus Perfect Brace alone earns Gold",
  () => {
    const award = (facts) =>
      evaluateMedal(LEVELS[1], { ...finished, ...facts }).medal;
    assert.equal(award({ goodBrace: true }), 0);
    assert.equal(award({ completedJump: true }), 1);
    assert.equal(award({ completedJump: true, goodBrace: true }), 2);
    assert.equal(
      award({
        completedJump: true,
        goodBrace: true,
        perfectBrace: true,
        controlledLanding: false,
      }),
      2,
    );
    assert.equal(
      award({
        completedJump: true,
        goodBrace: true,
        perfectBrace: true,
        controlledLanding: true,
      }),
      3,
    );
  },
);
check(
  "Commit to the Bit grades unique recognized tricks and actual successful landings",
  () => {
    const award = (facts) =>
      evaluateMedal(LEVELS[2], { ...finished, ...facts }).medal;
    assert.equal(award({ uniqueTricks: 0, successfulLanding: true }), 0);
    assert.equal(award({ uniqueTricks: 1 }), 1);
    assert.equal(award({ uniqueTricks: 1, successfulLanding: true }), 2);
    assert.equal(award({ uniqueTricks: 2, successfulLanding: true }), 3);
    for (const level of LEVELS) {
      const facts = {
        ...Object.fromEntries(Object.entries(level.gold.all)),
        finished: false,
      };
      assert.equal(evaluateMedal(level, facts).medal, 0);
      assert.equal(
        evaluateMedal(level, { ...facts, finished: true, invalid: true }).medal,
        0,
      );
    }
    assert.equal(meetsThreshold({ all: { unknown: 1 } }, {}), false);
  },
);
check(
  "Missing, corrupt, unsupported, and malformed saves safely normalize",
  () => {
    for (const text of [
      null,
      "{broken",
      "null",
      "[]",
      "42",
      '{"version":999}',
    ]) {
      const db = storage();
      if (text !== null) db.setItem(CAMPAIGN_SAVE_KEY, text);
      assert.deepEqual(new CampaignSave(db).data, emptyCampaignSave());
    }
    const raw = emptyCampaignSave();
    raw.selectedCharacter = "intruder";
    raw.progress.jake[LEVELS[0].id] = { medal: 99, santor: true };
    raw.progress.brandon[LEVELS[0].id] = { medal: "3" };
    raw.progress.owen[LEVELS[0].id] = { medal: 2, santor: true };
    const safe = normalizeCampaignSave(raw);
    assert.equal(safe.selectedCharacter, null);
    assert.equal(safe.progress.jake[LEVELS[0].id].medal, 0);
    assert.equal(safe.progress.brandon[LEVELS[0].id].medal, 0);
    assert.deepEqual(safe.progress.owen[LEVELS[0].id], {
      medal: 2,
      santor: true,
    });
  },
);
check(
  "Denied reads/writes and quota failures leave a playable in-memory campaign",
  () => {
    const denied = new CampaignSave({
      getItem() {
        throw new Error("Denied");
      },
      setItem() {
        throw new Error("Quota");
      },
    });
    const result = denied.award("jake", LEVELS[0].id, {
      medal: 1,
      santor: false,
    });
    assert.equal(result.saved, false);
    assert.equal(denied.entry("jake", LEVELS[0].id).medal, 1);
    assert.match(denied.notice, /page only/);
    const run = new Campaign(denied);
    run.select("jake");
    run.confirm();
    assert.equal(run.isUnlocked(LEVELS[1]), true);
    denied.reset();
    assert.equal(denied.entry("jake", LEVELS[0].id).medal, 0);
    assert.equal(new CampaignSave(null).writable, false);
  },
);
check(
  "Medal upgrades are idempotent, never downgrade, and survive reconstruction",
  () => {
    const db = storage(),
      save = new CampaignSave(db);
    for (const rank of [1, 1, 2, 1, 3, 0, 3])
      save.award("jake", LEVELS[0].id, { medal: rank, santor: false });
    save.select("jake");
    const restored = new CampaignSave(db);
    assert.equal(restored.entry("jake", LEVELS[0].id).medal, 3);
    assert.equal(restored.data.selectedCharacter, "jake");
    assert.equal(Object.keys(restored.data.progress.jake).length, 11);
    assert.equal(db.entries.size, 1);
    const copy = restored.entry("jake", LEVELS[0].id);
    copy.medal = 0;
    assert.equal(restored.entry("jake", LEVELS[0].id).medal, 3);
  },
);
check(
  "Character choice requires confirmation, locks are enforced, and reset defaults to cancel",
  () => {
    const run = new Campaign(new CampaignSave(storage()));
    assert.equal(run.startLevel(LEVELS[0].id), false);
    assert.equal(run.select("unknown"), false);
    assert.equal(run.select("jake"), true);
    assert.equal(run.state, S.PROFILE);
    assert.equal(run.save.data.selectedCharacter, null);
    run.confirm();
    assert.equal(run.state, S.MAP);
    assert.equal(run.save.data.selectedCharacter, "jake");
    assert.equal(run.startLevel(LEVELS[1].id), false);
    assert.equal(run.startLevel("unknown"), false);
    run.requestReset();
    run.confirm();
    assert.equal(run.state, S.MAP);
    assert.equal(run.startLevel(LEVELS[0].id), true);
    assert.equal(run.state, S.READY);
    run.confirm();
    assert.equal(run.active, true);
    run.confirm();
    assert.equal(run.active, true);
    assert.equal(run.changeCharacter(), false);
    assert.equal(run.backToMap(), false);
    assert.equal(run.requestReset(), false);
    assert.throws(
      () => run.transition(S.SELECT),
      /Invalid campaign transition/,
    );
    run.resetAttempt();
    assert.equal(run.state, S.READY);
    assert.equal(run.reachedRamp, false);
  },
);
check(
  "Each character has independent unlocks; campaign reset preserves unrelated storage",
  () => {
    const db = storage(),
      save = new CampaignSave(db),
      tournament = new Tournament();
    db.setItem("santor-vault:muted", "true");
    db.setItem("unrelated-project", "keep me");
    const party = JSON.stringify(tournament);
    save.award("jake", LEVELS[0].id, { medal: 3 });
    const run = new Campaign(save);
    for (const c of CHARACTERS) {
      run.select(c.id);
      run.confirm();
      assert.equal(run.isUnlocked(LEVELS[0]), true);
      assert.equal(run.isUnlocked(LEVELS[1]), c.id === "jake");
      run.changeCharacter();
    }
    run.select("owen");
    run.confirm();
    run.requestReset();
    run.confirmReset();
    assert.equal(save.entry("jake", LEVELS[0].id).medal, 0);
    assert.equal(db.getItem("santor-vault:muted"), "true");
    assert.equal(db.getItem("unrelated-project"), "keep me");
    assert.equal(JSON.stringify(tournament), party);
  },
);
const actual = [];
check(
  "All three characters complete a original three-lesson sequence with fresh attempt data",
  () => {
    const db = storage(),
      save = new CampaignSave(db);
    for (const c of CHARACTERS) {
      const run = new Campaign(save, { seedFactory: () => 42 });
      run.select(c.id);
      run.confirm();
      for (const level of LEVELS.slice(0, 3)) {
        assert.equal(run.startLevel(level.id), true);
        assert.equal(run.lastScore, null);
        assert.equal(run.reachedRamp, false);
        run.confirm();
        const world = new PhysicsWorld(c, level.arena, run.attemptSpec);
        for (let i = 0; i < 2500 && !world.finished; i++) {
          let rotation = 0;
          if (world.launched && !world.landed) {
            const target = level.id === LEVELS[2].id ? Math.PI * 2 : 0;
            rotation = Math.max(
              -1,
              Math.min(
                1,
                (target - world.cart.angle) * 3 -
                  world.cart.angularVelocity * 65,
              ),
            );
          }
          world.step(timedInputs(world, rotation, true));
          run.observe(world);
        }
        assert.ok(world.finished && !world.invalid);
        const score = scoreAttempt(world.metrics(), world.character);
        run.record(score, world);
        assert.equal(run.state, S.RESULTS);
        assert.ok(
          run.lastMedal.medal >= 1,
          `${c.id} / ${level.id} / ${JSON.stringify(score)}`,
        );
        assert.throws(() => run.record(score, world), /not ready/);
        actual.push({
          character: c.id,
          level: level.id,
          medal: run.lastMedal.medal,
          brace: score.braceGrade,
          landing: score.landingQuality,
          tricks: score.tricks.unique,
          score: score.total,
        });
        run.confirm();
        if (run.state === S.UPGRADES) {
          assert.equal(run.runs.run.offers.length, 3);
          assert.equal(run.chooseUpgrade(run.runs.run.offers[0]), true);
        }
        assert.equal(run.state, S.MAP);
        world.dispose();
        assert.equal(
          globalThis.Matter.Composite.allBodies(world.engine.world).length,
          0,
        );
      }
      assert.equal(run.complete, false);
    }
    const reloaded = new CampaignSave(db);
    for (const c of CHARACTERS)
      for (const level of LEVELS.slice(0, 3))
        assert.ok(reloaded.entry(c.id, level.id).medal >= 1);
  },
);
console.log(`${checks} campaign groups passed.`);
console.log(JSON.stringify({ actual }, null, 2));
