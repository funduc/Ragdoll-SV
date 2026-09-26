import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import {
  AchievementManager,
  ACHIEVEMENT_SAVE_KEY as KEY,
  normalizeAchievements,
} from "../js/achievements.js";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CAPABILITIES,
  COSMETIC_REWARDS,
} from "../js/achievement-config.js";
import {
  attemptAchievementFacts,
  campaignAchievementFacts,
  tournamentAchievementFacts,
  BiographyReader,
} from "../js/achievement-events.js";
import { Campaign } from "../js/campaign.js";
import { CampaignSave, CAMPAIGN_SAVE_KEY } from "../js/campaign-save.js";
import { RunSave, RUN_SAVE_KEY } from "../js/run-save.js";
import { LEVELS } from "../js/campaign-levels.js";
import { CHARACTERS } from "../js/characters.js";
import { PhysicsWorld } from "../js/physics.js";
import { scoreAttempt } from "../js/scoring.js";
import { timedInputs } from "./skill-helpers.mjs";
runInThisContext(
  readFileSync(
    new URL("../vendor/matter-0.20.0.min.js", import.meta.url),
    "utf8",
  ),
);
let checks = 0;
const test = (name, fn) => {
  fn();
  console.log("PASS " + name);
  checks++;
};
const now = 1_790_000_000_000;
const memory = () => {
  const map = new Map();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, String(value)),
  };
};
const manager = (db = memory(), options = {}) =>
  new AchievementManager(db, { clock: () => now, ...options });
const sample = (changes = {}) => ({
  characterId: "jake",
  valid: true,
  ...changes,
});
const record = (m, id) => m.data.records[id];

test("All 34 definitions have stable IDs, supported rules and cosmetic-only rewards", () => {
  assert.equal(ACHIEVEMENTS.length, 34);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, 34);
  for (const a of ACHIEVEMENTS) {
    assert.ok(a.name && a.description && a.category && a.target > 0);
    if (a.reward) assert.ok(COSMETIC_REWARDS[a.reward]);
    if (a.requires) assert.equal(ACHIEVEMENT_CAPABILITIES[a.requires], false);
  }
  assert.equal(ACHIEVEMENTS.filter((a) => a.requires).length, 6);
});
test("v1 objective flags migrate intact; old medals import only provable achievements without fake dates", () => {
  const db = memory(),
    medals = new CampaignSave(db);
  for (const c of CHARACTERS)
    for (const l of LEVELS) medals.award(c.id, l.id, { medal: 3 });
  const oldMedals = db.getItem(CAMPAIGN_SAVE_KEY);
  db.setItem(RUN_SAVE_KEY, '{"version":1,"keep":"untouched"}');
  db.setItem(
    KEY,
    JSON.stringify({
      version: 1,
      characters: {
        jake: { "front-flip": true },
        brandon: { "no-miss": true },
        owen: { "distance-35": true },
      },
    }),
  );
  const m = manager(db, { medals: medals.data });
  assert.equal(m.data.version, 2);
  assert.equal(m.data.characters.jake["front-flip"], true);
  assert.equal(m.data.characters.brandon["no-miss"], true);
  assert.equal(m.data.characters.owen["distance-35"], true);
  for (const id of ["welcome", "graduate", "liabilities", "favourite"]) {
    assert.equal(record(m, id).unlocked, true);
    assert.equal(record(m, id).unlockedAt, null);
  }
  for (const id of ["factory", "cold-blooded", "butter"])
    assert.equal(record(m, id).unlocked, false);
  assert.deepEqual(m.drainUnlocks(), []);
  assert.equal(db.getItem(CAMPAIGN_SAVE_KEY), oldMedals);
  assert.equal(db.getItem(RUN_SAVE_KEY), '{"version":1,"keep":"untouched"}');
  assert.deepEqual(manager(db).data, m.data);
});
test("Missing, corrupt, malformed, and future data load safely; future schema is not overwritten", () => {
  for (const value of [
    null,
    "{bad",
    "null",
    "[]",
    '{"version":2,"records":{"cold-blooded":{"progress":-3}},"characters":null}',
    '{"version":1,"characters":{"jake":{"front-flip":"true"}}}',
  ]) {
    const db = memory();
    if (value !== null) db.setItem(KEY, value);
    const m = manager(db);
    assert.equal(record(m, "cold-blooded").progress, 0);
    assert.equal(m.data.characters.jake["front-flip"], undefined);
  }
  const clean = normalizeAchievements({
    version: 2,
    records: {
      tragedy: {
        progress: 999,
        values: ["head-impact", "head-impact", "fake"],
      },
      butter: { unlocked: true, unlockedAt: "yesterday" },
    },
    equipped: { cart: "blue-cart" },
  });
  assert.equal(clean.records.tragedy.progress, 1);
  assert.equal(clean.records.butter.unlockedAt, null);
  assert.equal(clean.equipped.cart, null);
  const db = memory();
  db.setItem(KEY, '{"version":99,"important":"future"}');
  const m = manager(db);
  m.send("attempt-ended", sample({ launched: true }));
  assert.equal(db.getItem(KEY), '{"version":99,"important":"future"}');
});
test("Ordered event IDs prevent duplicate unlocks and cumulative increments across refresh", () => {
  const db = memory();
  let m = manager(db);
  const event = {
    id: 1,
    type: "attempt-ended",
    ...sample({ launched: true, brace: "Perfect Brace" }),
  };
  assert.deepEqual(m.receive(event), ["airborne"]);
  const timestamp = record(m, "airborne").unlockedAt;
  assert.deepEqual(m.receive(event), []);
  assert.equal(record(m, "cold-blooded").progress, 1);
  m = manager(db);
  assert.deepEqual(m.receive(event), []);
  assert.equal(record(m, "cold-blooded").progress, 1);
  m.receive({ ...event, id: 2 });
  m.receive({ ...event, id: 3 });
  m.receive({ ...event, id: 4 });
  assert.equal(record(m, "cold-blooded").progress, 3);
  assert.equal(record(m, "cold-blooded").unlockedAt, now);
  assert.equal(record(m, "airborne").unlockedAt, timestamp);
  assert.deepEqual(m.drainUnlocks(), ["cold-blooded"]);
});
test("Character-specific counters never attribute Brandon/Owen attempts to Jake", () => {
  const m = manager();
  for (const c of ["brandon", "owen"])
    for (let i = 0; i < 4; i++)
      m.send(
        "attempt-ended",
        sample({ characterId: c, brace: "Perfect Brace", cleanLanding: true }),
      );
  assert.equal(record(m, "cold-blooded").progress, 0);
  assert.equal(record(m, "coordination").unlocked, true);
  for (const characterId of ["jake", "owen"])
    m.send("attempt-ended", sample({ characterId, crashClass: "head-impact" }));
  assert.equal(record(m, "tragedy").progress, 0);
  for (const crashClass of [
    "head-impact",
    "head-impact",
    "torso-impact",
    "overturned",
  ])
    m.send("attempt-ended", sample({ characterId: "brandon", crashClass }));
  assert.equal(record(m, "tragedy").progress, 3);
});
test("Every active one-attempt achievement accepts its facts and rejects incomplete or invalid facts", () => {
  const cases = {
    airborne: { launched: true },
    butter: { takeoff: "Perfect", brace: "Perfect Brace" },
    barrel: { rotations: 1, landed: true },
    "not-phase": { uniqueTricks: 3 },
    "style-over": { stylePoints: 11, distancePoints: 10 },
    "dead-centre": { landed: true, targetError: 0.5 },
    "no-reaction": { severeCrash: true, objectivePassed: true },
    coordination: {
      characterId: "brandon",
      cleanLanding: true,
      brace: "Perfect Brace",
    },
    "wrate-issues": {
      characterId: "owen",
      condition: "wrate-issue",
      mechanicalFailure: true,
      levelCompleted: true,
    },
    "fix-that": {
      characterId: "owen",
      mechanicalRecovered: true,
      successfulLanding: true,
    },
    siemens: { characterId: "owen", runwayCapReached: true },
  };
  for (const [id, facts] of Object.entries(cases)) {
    const m = manager();
    m.send("attempt-ended", sample());
    assert.equal(record(m, id).unlocked, false, id);
    m.send("attempt-ended", sample({ ...facts, valid: false }));
    assert.equal(record(m, id).unlocked, false, id);
    m.send("attempt-ended", sample(facts));
    assert.equal(record(m, id).unlocked, true, id);
  }
  const m = manager();
  m.send(
    "attempt-ended",
    sample({
      landed: true,
      targetError: 0.500001,
      stylePoints: 10,
      distancePoints: 10,
    }),
  );
  assert.equal(record(m, "dead-centre").unlocked, false);
  assert.equal(record(m, "style-over").unlocked, false);
});
test("Unavailable mechanics remain locked; configured future telemetry can use the same evaluator", () => {
  const facts = sample({
    landed: true,
    lostComponents: 2,
    lostWheels: 1,
    medalPointGap: 1,
    conditionChanges: 1,
    levelCompleted: true,
    sponsorHit: "concrete-plus",
    distancePoints: 1,
    stylePoints: 1,
    landingPoints: 1,
    attachmentPoints: 1,
    objectivePoints: 1,
  });
  const normal = manager(),
    future = manager(memory(), {
      capabilities: Object.fromEntries(
        Object.keys(ACHIEVEMENT_CAPABILITIES).map((key) => [key, true]),
      ),
    });
  normal.send("attempt-ended", facts);
  future.send("attempt-ended", facts);
  for (const a of ACHIEVEMENTS.filter((a) => a.requires)) {
    assert.equal(record(normal, a.id).unlocked, false);
    assert.equal(record(future, a.id).unlocked, true);
  }
});
test("Campaign completion uses one character's medals; all-character and no-upgrade goals differ", () => {
  const m = manager();
  for (const characterId of ["jake", "brandon", "owen"])
    m.send("campaign-progress", {
      characterId,
      completedLevels: 2,
      goldLevels: 2,
      firstLevel: 1,
      runComplete: false,
      upgradeCount: 0,
    });
  assert.equal(record(m, "graduate").unlocked, false);
  assert.equal(record(m, "liabilities").progress, 0);
  for (const characterId of ["jake", "brandon", "owen"])
    m.send("campaign-progress", {
      characterId,
      completedLevels: 10,
      goldLevels: 10,
      firstLevel: 1,
      runComplete: true,
      upgradeCount: 1,
    });
  assert.equal(record(m, "graduate").unlocked, true);
  assert.equal(record(m, "liabilities").unlocked, true);
  assert.equal(record(m, "favourite").unlocked, true);
  assert.equal(record(m, "factory").unlocked, false);
  m.send("campaign-progress", {
    characterId: "jake",
    runComplete: true,
    upgradeCount: 0,
  });
  assert.equal(record(m, "factory").unlocked, true);
});
test("Party victory needs Brandon, an outright win and a style majority", () => {
  const m = manager();
  for (const facts of [
    { characterId: "owen", soleWinner: true, styleMajority: true },
    { characterId: "brandon", soleWinner: false, styleMajority: true },
    { characterId: "brandon", soleWinner: true, styleMajority: false },
  ])
    m.send("tournament-won", facts);
  assert.equal(record(m, "poetic-license").unlocked, false);
  const t = {
    winners: [CHARACTERS[1]],
    championship: { brandon: { stylePoints: 501, total: 1000 } },
  };
  m.send("tournament-won", tournamentAchievementFacts(t)[0]);
  assert.equal(record(m, "poetic-license").unlocked, true);
});
test("Read the Manual requires visible focused time on one card; gaps and screen changes cannot fake it", () => {
  const m = manager(),
    reader = new BiographyReader((facts) => m.send("biography-read", facts));
  for (let i = 0; i < 299; i++) reader.tick("party:jake", "jake", 100, true);
  reader.tick("party:jake", "jake", 10000, true);
  reader.tick("party:jake", "jake", 100, false);
  assert.equal(record(m, "manual").unlocked, false);
  reader.tick("party:jake", "jake", 100, true);
  assert.equal(record(m, "manual").unlocked, true);
  const events = [];
  const other = new BiographyReader((e) => events.push(e));
  for (let i = 0; i < 200; i++) other.tick("jake", "jake", 100, true);
  other.tick(null, null, 0, false);
  for (let i = 0; i < 200; i++) other.tick("jake", "jake", 100, true);
  assert.equal(events.length, 0);
  const fixed = manager(),
    at120 = new BiographyReader((e) => fixed.send("biography-read", e));
  for (let i = 0; i < 3600; i++) at120.tick("owen", "owen", 1000 / 120, true);
  assert.equal(
    record(fixed, "manual").unlocked,
    true,
    "120 Hz rounding cannot drop the one-time reading event",
  );
});
test("Run and campaign reset preserve achievements; achievement reset preserves medals and run data", () => {
  const db = memory(),
    medals = new CampaignSave(db);
  medals.award("jake", LEVELS[0].id, { medal: 3 });
  const run = new Campaign(medals, { seedFactory: () => 42 });
  run.select("jake");
  run.confirm();
  run.runs.achieve("jake", "front-flip");
  run.runs.manager.send("attempt-ended", sample({ launched: true }));
  const saved = db.getItem(KEY);
  run.requestNewRun();
  run.confirmNewRun();
  assert.equal(db.getItem(KEY), saved);
  run.requestReset();
  run.confirmReset();
  assert.equal(db.getItem(KEY), saved);
  const campaign = db.getItem(CAMPAIGN_SAVE_KEY),
    temporary = db.getItem(RUN_SAVE_KEY);
  run.runs.manager.reset();
  assert.equal(db.getItem(CAMPAIGN_SAVE_KEY), campaign);
  assert.equal(db.getItem(RUN_SAVE_KEY), temporary);
  assert.equal(run.runs.achievements.characters.jake["front-flip"], undefined);
  assert.equal(
    manager(db, { medals: medals.data }).data.records.welcome.unlocked,
    false,
    "v2 reset is not reimported",
  );
});
test("Skipping upgrade rewards is explicit, consumes the offer, and enables Factory Settings", () => {
  const db = memory(),
    run = new Campaign(new CampaignSave(db), { seedFactory: () => 42 });
  run.select("owen");
  run.confirm();
  for (const l of LEVELS) {
    run.runs.finishLevel(l.id, true, l.upgradeReward);
    if (l.upgradeReward) {
      const offers = [...run.runs.run.offers];
      assert.ok(run.runs.skipOffer());
      assert.equal(run.runs.choose(offers[0]), false);
      run.runs.finishLevel(l.id, true, l.upgradeReward);
      assert.equal(run.runs.run.pendingLevel, null);
    }
  }
  assert.equal(run.complete, true);
  assert.equal(campaignAchievementFacts(run).upgradeCount, 0);
  run.runs.manager.send("campaign-progress", campaignAchievementFacts(run));
  assert.equal(record(run.runs.manager, "factory").unlocked, true);
});
test("Cosmetic entitlements, equipped choices and timestamps survive refresh; locked rewards cannot equip", () => {
  const db = memory(),
    m = manager(db);
  assert.equal(m.equip("blue-cart"), false);
  m.send("attempt-ended", sample({ launched: true }));
  assert.equal(m.equip("blue-cart"), true);
  assert.equal(manager(db).cosmeticValues().cart, "#52cefa");
  assert.equal(m.awardObjective("owen", "no-miss"), true);
  assert.equal(m.awardObjective("owen", "no-miss"), false);
  assert.equal(manager(db).data.objectiveDates.owen["no-miss"], now);
  assert.equal(m.equip(null, "cart"), true);
  assert.equal(m.cosmeticValues().cart, null);
  m.reset();
  assert.equal(m.equip("blue-cart"), false);
});
test("Blocked reads/writes stay playable and report failure without erasing other save keys", () => {
  for (const db of [
    null,
    {
      getItem() {
        throw Error("denied");
      },
      setItem() {
        throw Error("full");
      },
    },
  ]) {
    const m = manager(db);
    m.send("attempt-ended", sample({ launched: true }));
    assert.equal(record(m, "airborne").unlocked, true);
    assert.match(m.notice, /cannot be saved/);
  }
});
test("Actual collision causes are classified once; later severity does not invent more crash types", () => {
  for (const classification of ["head-impact", "torso-impact", "overturned"]) {
    const w = new PhysicsWorld(CHARACTERS[1]);
    w.elapsed = 1;
    w.preSpeeds = new Map(w.dynamic.map((b) => [b.id, { x: 6, y: 6 }]));
    if (classification === "overturned") {
      w.launched = true;
      w.cart.angle = 2;
    }
    const body =
      classification === "head-impact"
        ? w.head
        : classification === "torso-impact"
          ? w.torso
          : w.cart;
    w.handleCollisions([{ bodyA: w.ground, bodyB: body }]);
    assert.equal(w.crashClassification, classification);
    assert.equal(w.severeCrash, true);
    w.handleCollisions([{ bodyA: w.ground, bodyB: w.head }]);
    assert.equal(w.crashClassification, classification);
    w.dispose();
  }
});
const real = [];
test("Real Matter attempts feed normalized unlocks in Party and campaign without altering the score", () => {
  for (const [character, spec] of [
    [CHARACTERS[0], null],
    [CHARACTERS[1], null],
    [CHARACTERS[2], { condition: "wrate-issue", objective: "landing-zone" }],
  ]) {
    const w = new PhysicsWorld(character, undefined, spec),
      m = manager();
    for (let i = 0; i < 2500 && !w.finished; i++) {
      const tilt = Math.atan2(Math.sin(w.cart.angle), Math.cos(w.cart.angle));
      const rotate = Math.max(
        -1,
        Math.min(1, -tilt * 2 - w.cart.angularVelocity * 28),
      );
      w.step(timedInputs(w, rotate, true));
    }
    assert.ok(w.finished && !w.invalid && w.landed);
    const s = scoreAttempt(w.metrics(), w.character),
      before = JSON.stringify(w.metrics());
    m.send(
      "attempt-ended",
      attemptAchievementFacts(
        w,
        s,
        spec
          ? { lastMedal: { medal: 3 }, lastObjective: { passed: true } }
          : null,
      ),
    );
    assert.equal(record(m, "airborne").unlocked, true);
    assert.equal(record(m, "butter").unlocked, true);
    if (character.id === "brandon")
      assert.equal(record(m, "coordination").unlocked, true);
    if (character.id === "owen") {
      assert.equal(record(m, "wrate-issues").unlocked, true);
      assert.equal(record(m, "fix-that").unlocked, true);
      assert.equal(record(m, "siemens").unlocked, true);
    }
    assert.equal(JSON.stringify(w.metrics()), before);
    assert.equal(
      s.total,
      s.distancePoints + s.stylePoints + s.landingPoints + s.attachedPoints,
    );
    real.push({
      character: character.id,
      score: s.total,
      unlocks: m.drainUnlocks(),
    });
    w.dispose();
  }
});
console.log(`${checks} achievement groups passed.`);
console.log(JSON.stringify({ real }, null, 2));
