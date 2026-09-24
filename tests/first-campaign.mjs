import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { CHARACTERS } from "../js/characters.js";
import {
  LEVELS,
  ALL_LEVELS,
  HARD_GAUNTLET,
  evaluateMedal,
} from "../js/campaign-levels.js";
import { Campaign, CampaignState as S, campaignFacts } from "../js/campaign.js";
import { CampaignSave, CAMPAIGN_SAVE_KEY } from "../js/campaign-save.js";
import { RUN_SAVE_KEY, RunSave } from "../js/run-save.js";
import {
  ACHIEVEMENT_SAVE_KEY,
  AchievementManager,
} from "../js/achievements.js";
import {
  attemptAchievementFacts,
  campaignAchievementFacts,
} from "../js/achievement-events.js";
import { CONDITIONS, OBJECTIVES } from "../js/run-config.js";
import { PhysicsWorld } from "../js/physics.js";
import { scoreAttempt, assertScore } from "../js/scoring.js";
import { driveChapter } from "./chapter-helpers.mjs";
runInThisContext(
  readFileSync(
    new URL("../vendor/matter-0.20.0.min.js", import.meta.url),
    "utf8",
  ),
);
let checks = 0;
const test = (name, fn) => {
  fn();
  checks++;
  console.log("PASS " + name);
};
const memory = () => {
  const map = new Map();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, String(value)),
  };
};
const makeRun = (character, storage = memory()) => {
  const run = new Campaign(new CampaignSave(storage), {
    seedFactory: () => 42,
  });
  run.select(character.id);
  run.confirm();
  return run;
};
const dispose = (w) => {
  w.dispose();
  assert.equal(Matter.Composite.allBodies(w.engine.world).length, 0);
  assert.equal(Matter.Composite.allConstraints(w.engine.world).length, 0);
  assert.equal(w.engine.events.collisionStart.length, 0);
};
const evidence = [];

test("Ten main levels and optional Overtime have complete content, fixed new conditions and sequential unlocks", () => {
  assert.equal(LEVELS.length, 10);
  assert.equal(ALL_LEVELS.length, 11);
  assert.ok(LEVELS.reduce((n, l) => n + l.estimatedMinutes, 0) >= 20);
  assert.ok(LEVELS.reduce((n, l) => n + l.estimatedMinutes, 0) <= 30);
  for (const l of ALL_LEVELS) {
    for (const key of [
      "description",
      "objective",
      "arena",
      "modifier",
      "santorMedal",
      "john",
    ])
      assert.ok(l[key], l.id + key);
    for (const c of CHARACTERS) assert.ok(l.john.characters[c.id]);
    for (const key of ["bronze", "silver", "gold", "santorMedal"])
      assert.ok(l[key].label && l[key].all);
    for (const s of l.stages || (LEVELS.indexOf(l) >= 3 ? [l] : [])) {
      assert.ok(s.condition === null || CONDITIONS[s.condition]);
      assert.ok(OBJECTIVES[s.optionalObjective]);
    }
  }
});

test("Original v1 medals, seed, pending upgrade, timestamps and earned v2 achievements survive additive expansion", () => {
  const db = memory(),
    old = { version: 1, selectedCharacter: "jake", progress: {} };
  for (const c of CHARACTERS)
    old.progress[c.id] = Object.fromEntries(
      LEVELS.slice(0, 3).map((l) => [l.id, { medal: 3, santor: false }]),
    );
  db.setItem(CAMPAIGN_SAVE_KEY, JSON.stringify(old));
  const savedRun = {
    version: 1,
    characterId: "jake",
    seed: 123,
    upgrades: { "reinforced-wheels": 1 },
    claimed: [LEVELS[0].id],
    cleared: [LEVELS[0].id],
    pendingLevel: LEVELS[0].id,
    offers: ["style-multiplier"],
  };
  db.setItem(RUN_SAVE_KEY, JSON.stringify(savedRun));
  db.setItem(
    ACHIEVEMENT_SAVE_KEY,
    JSON.stringify({
      version: 2,
      records: {
        graduate: { unlocked: true, progress: 3, unlockedAt: 1750000000000 },
        favourite: { unlocked: true, progress: 3, unlockedAt: 1750000000001 },
      },
    }),
  );
  const save = new CampaignSave(db),
    runs = new RunSave(db),
    manager = new AchievementManager(db);
  for (const c of CHARACTERS) {
    for (const l of LEVELS.slice(0, 3))
      assert.equal(save.entry(c.id, l.id).medal, 3);
    for (const l of ALL_LEVELS.slice(3))
      assert.equal(save.entry(c.id, l.id).medal, 0);
  }
  assert.equal(runs.run.seed, 123);
  assert.equal(runs.run.pendingLevel, LEVELS[0].id);
  assert.deepEqual(runs.run.offers, ["style-multiplier"]);
  assert.equal(manager.data.records.graduate.unlocked, true);
  assert.equal(manager.data.records.graduate.unlockedAt, 1750000000000);
  assert.equal(manager.data.records.favourite.unlockedAt, 1750000000001);
  assert.equal(manager.data.records["cone-of-composure"].unlocked, false);
});

test("All three competitors play all ten levels and Overtime using actual physics, without upgrades or altered scores", () => {
  for (const c of CHARACTERS) {
    const run = makeRun(c);
    assert.equal(run.isUnlocked(HARD_GAUNTLET), false);
    for (const level of ALL_LEVELS) {
      assert.equal(
        run.startLevel(level.id),
        true,
        `${c.id} unlock ${level.id}`,
      );
      const scores = [];
      do {
        assert.equal(run.state, S.READY);
        assert.equal(run.lastScore, null);
        run.confirm();
        const w = new PhysicsWorld(c, run.attemptArena, run.attemptSpec);
        driveChapter(w, level);
        assert.ok(w.finished && !w.invalid, c.id + level.id);
        const s = scoreAttempt(w.metrics(), w.character);
        assertScore(s);
        run.record(s, w);
        run.runs.manager.send(
          "attempt-ended",
          attemptAchievementFacts(w, s, run),
        );
        run.runs.manager.send(
          "campaign-progress",
          campaignAchievementFacts(run),
        );
        scores.push(s.total);
        assert.equal(run.state, S.RESULTS);
        assert.throws(() => run.record(s, w), /not ready/);
        if (!run.levelFinished) {
          assert.equal(run.lastMedal.provisional, true);
          assert.equal(run.save.entry(c.id, level.id).medal, 0);
          assert.ok(!run.runs.run.cleared.includes(level.id));
          assert.equal(run.isUnlocked(HARD_GAUNTLET), level.bonus === true);
        }
        evidence.push({
          character: c.id,
          level: level.id,
          heat: run.stageIndex + 1,
          condition: w.runEffects.conditionId,
          score: s.total,
          landing: s.landingQuality,
          brace: s.braceGrade,
          tricks: s.tricks.details.map((t) => t.id),
          medal: run.lastMedal.medal,
          santor: run.lastMedal.santor,
        });
        dispose(w);
        if (!run.levelFinished) run.confirm();
      } while (run.state === S.READY);
      const minimum = LEVELS.indexOf(level) >= 3 || level.bonus ? 3 : 1;
      assert.ok(
        run.lastMedal.medal >= minimum,
        JSON.stringify(evidence.at(-1)),
      );
      if (level.stages)
        assert.equal(
          run.combinedScore,
          scores.reduce((a, b) => a + b, 0),
        );
      if (level.id === "the-santor-gauntlet") {
        assert.equal(run.complete, true);
        assert.equal(run.isUnlocked(HARD_GAUNTLET), true);
        assert.equal(run.runs.manager.data.records.graduate.unlocked, true);
        assert.equal(run.runs.manager.data.records.factory.unlocked, true);
      }
      run.confirm();
      if (run.state === S.UPGRADES) run.skipUpgrade();
      assert.equal(run.state, S.MAP);
    }
    assert.equal(
      run.runs.manager.data.records["cone-of-composure"].unlocked,
      c.id === "jake",
    );
    assert.equal(
      run.runs.manager.data.records["shift-supervisor"].unlocked,
      c.id === "owen",
    );
    const refreshed = new CampaignSave(run.save.storage);
    for (const l of ALL_LEVELS.slice(3))
      assert.equal(refreshed.entry(c.id, l.id).medal, 3);
    run.startLevel(HARD_GAUNTLET.id);
    assert.equal(run.stageIndex, 0);
    assert.equal(run.combinedScore, 0);
    run.backToMap();
    run.requestNewRun();
    run.confirmNewRun();
    assert.equal(run.isUnlocked(HARD_GAUNTLET), true);
    assert.equal(run.runs.manager.data.records.graduate.unlocked, true);
  }
});

test("Cargo is a physical body, breaks once on a real flip, stays lost, and never counts as a rider landing", () => {
  const level = LEVELS[5];
  for (const c of CHARACTERS) {
    const w = new PhysicsWorld(c, level.arena, { condition: null });
    assert.equal(Matter.Composite.allBodies(w.engine.world).length, 18);
    assert.equal(Matter.Composite.allConstraints(w.engine.world).length, 16);
    driveChapter(w, level, { flip: true });
    assert.ok(w.cargoLost && w.finished && !w.invalid);
    assert.ok(
      !Matter.Composite.allConstraints(w.engine.world).includes(w.cargoTether),
    );
    assert.equal(
      evaluateMedal(
        level,
        campaignFacts(scoreAttempt(w.metrics(), w.character), w, true),
      ).medal,
      1,
    );
    dispose(w);
    const isolated = new PhysicsWorld(c, level.arena, { condition: null });
    isolated.launched = true;
    isolated.handleCollisions([
      { bodyA: isolated.ground, bodyB: isolated.cargo },
    ]);
    assert.equal(
      isolated.landed,
      false,
      "loose cargo cannot bank cart distance/brace",
    );
    dispose(isolated);
  }
});

test("Runway repairs change the real terrain only in Mapleton; Party retains 17 bodies and 15 constraints", () => {
  const l = LEVELS[6],
    w = new PhysicsWorld(CHARACTERS[0], l.arena, { condition: null });
  assert.equal(w.runwayBumps.length, 3);
  assert.equal(Matter.Composite.allBodies(w.engine.world).length, 20);
  assert.ok(w.runwayBumps.every((b) => b.isStatic));
  dispose(w);
  const party = new PhysicsWorld(CHARACTERS[0]);
  assert.equal(party.cargo, null);
  assert.equal(party.runwayBumps.length, 0);
  assert.equal(party.runEffects, null);
  assert.equal(Matter.Composite.allBodies(party.engine.world).length, 17);
  assert.equal(Matter.Composite.allConstraints(party.engine.world).length, 15);
  dispose(party);
});

test("Gauntlet heat restarts do not bank twice, partial sequences never unlock, and abandoning/reloading starts at heat one", () => {
  const run = makeRun(CHARACTERS[0]);
  run.save.award("jake", LEVELS[8].id, { medal: 1 });
  assert.ok(run.startLevel(LEVELS[9].id));
  run.confirm();
  assert.ok(run.resetAttempt());
  assert.equal(run.heats.length, 0);
  run.confirm();
  const w = new PhysicsWorld(run.current, run.attemptArena, run.attemptSpec);
  driveChapter(w, run.level);
  run.record(scoreAttempt(w.metrics(), w.character), w);
  dispose(w);
  const bank = run.combinedScore;
  run.confirm();
  assert.equal(run.stageIndex, 1);
  run.confirm();
  run.resetAttempt();
  assert.equal(run.combinedScore, bank);
  assert.equal(run.stageIndex, 1);
  run.backToMap();
  run.startLevel(LEVELS[9].id);
  assert.equal(run.stageIndex, 0);
  assert.equal(run.combinedScore, 0);
  const next = makeRun(CHARACTERS[0], run.save.storage);
  next.startLevel(LEVELS[9].id);
  assert.equal(next.stageIndex, 0);
  assert.equal(next.heats.length, 0);
  assert.equal(next.isUnlocked(HARD_GAUNTLET), false);
});

test("Campaign reset clears new medals/Overtime only; achievement reset and run reset remain independent", () => {
  const run = makeRun(CHARACTERS[0]);
  run.save.award("jake", LEVELS[9].id, { medal: 3, santor: true });
  run.save.award("jake", HARD_GAUNTLET.id, { medal: 2 });
  run.runs.manager.send("attempt-ended", {
    valid: true,
    characterId: "jake",
    launched: true,
  });
  const achievements = run.save.storage.getItem(ACHIEVEMENT_SAVE_KEY);
  run.requestReset();
  run.confirmReset();
  assert.equal(run.save.entry("jake", HARD_GAUNTLET.id).medal, 0);
  assert.equal(run.isUnlocked(HARD_GAUNTLET), false);
  assert.equal(run.save.storage.getItem(ACHIEVEMENT_SAVE_KEY), achievements);
});
console.log(
  `${checks} first-campaign groups passed; ${evidence.length} real Matter attempts.`,
);
console.log(JSON.stringify({ firstCampaign: evidence }, null, 2));
