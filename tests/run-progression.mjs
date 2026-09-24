// These selection/storage/combined checks run AFTER run-mechanics.mjs isolates
// every condition, objective type, and upgrade.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { CHARACTERS } from "../js/characters.js";
import { LEVELS } from "../js/campaign-levels.js";
import { Campaign, CampaignState as S } from "../js/campaign.js";
import { CampaignSave, CAMPAIGN_SAVE_KEY } from "../js/campaign-save.js";
import {
  RunSave,
  RUN_SAVE_KEY,
  ACHIEVEMENT_SAVE_KEY,
  upgradeOffer,
  normalizeRun,
  normalizeAchievements,
} from "../js/run-save.js";
import {
  UPGRADES,
  UPGRADE_IDS,
  CONDITION_IDS,
  OBJECTIVE_IDS,
} from "../js/run-config.js";
import { seededShuffle } from "../js/run-random.js";
import { readRunDeveloperSettings } from "../js/run-dev.js";
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
  checks++;
  console.log(`PASS ${name}`);
};
const memory = () => {
  const entries = new Map();
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, String(value)),
  };
};
test("Seeded selection is reproducible, varied, distinct and unaffected by frame count", () => {
  const one = upgradeOffer({}, 42, LEVELS[0].id);
  assert.deepEqual(one, upgradeOffer({}, 42, LEVELS[0].id));
  assert.equal(new Set(one).size, 3);
  const signatures = new Set(
    Array.from({ length: 30 }, (_, i) =>
      upgradeOffer({}, i, LEVELS[0].id).join(","),
    ),
  );
  assert.ok(signatures.size > 10);
  const conditions = seededShuffle(CONDITION_IDS, 42, "conditions");
  assert.equal(new Set(conditions).size, 5);
  assert.deepEqual([...conditions].sort(), [...CONDITION_IDS].sort());
});
test("Maxed upgrades are filtered; one, two, or zero remaining choices are handled", () => {
  const counts = Object.fromEntries(
    UPGRADE_IDS.map((id) => [id, UPGRADES[id].limit]),
  );
  assert.deepEqual(upgradeOffer(counts, 1, LEVELS[0].id), []);
  counts[UPGRADE_IDS[0]]--;
  assert.deepEqual(upgradeOffer(counts, 1, LEVELS[0].id), [UPGRADE_IDS[0]]);
  counts[UPGRADE_IDS[1]]--;
  assert.equal(upgradeOffer(counts, 1, LEVELS[0].id).length, 2);
});
test("Pending offers survive refresh and exactly one valid choice is consumed", () => {
  const db = memory(),
    save = new RunSave(db, () => 42);
  save.begin("jake");
  save.finishLevel(LEVELS[0].id, true, true);
  const offer = [...save.run.offers];
  const restored = new RunSave(db);
  assert.deepEqual(restored.run.offers, offer);
  assert.equal(restored.choose("unknown"), false);
  assert.equal(restored.choose(offer[0]), true);
  assert.equal(restored.choose(offer[1]), false);
  assert.equal(restored.run.upgrades[offer[0]], 1);
  assert.equal(restored.run.pendingLevel, null);
  restored.finishLevel(LEVELS[0].id, true, true);
  assert.equal(restored.run.pendingLevel, null, "replays cannot farm rewards");
  assert.deepEqual(restored.run.claimed, [LEVELS[0].id]);
});
test("Starting a new run clears temporary loadout/rewards but keeps the old medal schema and achievements", () => {
  const db = memory(),
    medals = new CampaignSave(db),
    save = new RunSave(db, () => 42);
  medals.award("jake", LEVELS[0].id, { medal: 3 });
  const existingMedals = db.getItem(CAMPAIGN_SAVE_KEY);
  save.begin("jake");
  save.finishLevel(LEVELS[0].id, true, true);
  save.choose(save.run.offers[0]);
  assert.equal(save.achieve("jake", OBJECTIVE_IDS[0]), true);
  assert.equal(save.achieve("jake", OBJECTIVE_IDS[0]), false);
  const achievements = db.getItem(ACHIEVEMENT_SAVE_KEY);
  save.begin("jake", { seed: 99 });
  assert.ok(Object.values(save.run.upgrades).every((count) => count === 0));
  assert.deepEqual(save.run.claimed, []);
  assert.deepEqual(save.run.cleared, []);
  assert.equal(save.run.seed, 99);
  assert.equal(db.getItem(CAMPAIGN_SAVE_KEY), existingMedals);
  assert.equal(db.getItem(ACHIEVEMENT_SAVE_KEY), achievements);
  assert.equal(JSON.parse(existingMedals).version, 1);
  save.begin("brandon");
  assert.equal(save.achievements.characters.jake[OBJECTIVE_IDS[0]], true);
  assert.equal(
    save.achievements.characters.brandon[OBJECTIVE_IDS[0]],
    undefined,
  );
});
test("Existing medal-only installs load safely; corrupt companion data cannot destroy medals", () => {
  const db = memory(),
    medals = new CampaignSave(db);
  medals.award("owen", LEVELS[1].id, { medal: 2 });
  const before = db.getItem(CAMPAIGN_SAVE_KEY);
  for (const raw of [
    "{bad",
    "null",
    "[]",
    '{"version":900}',
    '{"version":1,"seed":-1,"characterId":"owen"}',
  ]) {
    db.setItem(RUN_SAVE_KEY, raw);
    db.setItem(ACHIEVEMENT_SAVE_KEY, raw);
    const save = new RunSave(db);
    assert.equal(save.run, null);
    assert.equal(
      Object.values(save.achievements.characters).flatMap(Object.keys).length,
      0,
    );
    assert.equal(db.getItem(CAMPAIGN_SAVE_KEY), before);
  }
  assert.equal(
    normalizeRun({ version: 1, characterId: "nope", seed: 1 }),
    null,
  );
  const normalized = normalizeRun({
    version: 1,
    characterId: "jake",
    seed: 0,
    upgrades: { "impact-harness": 999, unknown: 5 },
    claimed: [LEVELS[0].id, LEVELS[0].id],
    pendingLevel: LEVELS[0].id,
    offers: ["impact-harness", "unknown"],
  });
  assert.equal(normalized.upgrades["impact-harness"], 1);
  assert.equal(normalized.pendingLevel, null);
  assert.equal(normalized.claimed.length, 1);
  assert.deepEqual(
    normalizeAchievements({
      version: 1,
      characters: { jake: { [OBJECTIVE_IDS[0]]: "yes", unknown: true } },
    }).characters.jake,
    {},
  );
});
test("Storage write failures stay visible even when a different companion write succeeds", () => {
  const db = memory();
  const save = new RunSave(
    {
      getItem: db.getItem,
      setItem(key, value) {
        if (key === ACHIEVEMENT_SAVE_KEY) throw new Error("quota");
        db.setItem(key, value);
      },
    },
    () => 1,
  );
  save.begin("jake");
  save.achieve("jake", OBJECTIVE_IDS[0]);
  save.finishLevel(LEVELS[0].id, true, true);
  assert.match(save.notice, /cannot be saved/);
  assert.equal(save.achievements.characters.jake[OBJECTIVE_IDS[0]], true);
  const unavailable = new RunSave(null, () => 1);
  unavailable.begin("jake");
  unavailable.finishLevel(LEVELS[0].id, true, true);
  assert.equal(unavailable.choose(unavailable.run.offers[0]), true);
  assert.match(unavailable.notice, /cannot be saved/);
});
test("Campaign confirmation resumes pending rewards; New run requires its own confirmation", () => {
  const db = memory(),
    medals = new CampaignSave(db),
    saves = new RunSave(db, () => 42);
  saves.begin("jake");
  saves.finishLevel(LEVELS[0].id, true, true);
  const run = new Campaign(medals, { runs: saves });
  run.select("jake");
  run.confirm();
  assert.equal(run.state, S.UPGRADES);
  run.confirm();
  assert.equal(
    run.state,
    S.UPGRADES,
    "generic confirmation cannot choose an upgrade",
  );
  run.chooseUpgrade(saves.run.offers[0]);
  assert.equal(run.state, S.MAP);
  const held = JSON.stringify(saves.run);
  run.requestNewRun();
  run.confirm();
  assert.equal(
    JSON.stringify(saves.run),
    held,
    "default confirmation cancels New run",
  );
  run.requestNewRun();
  run.confirmNewRun();
  assert.ok(Object.values(saves.run.upgrades).every((n) => n === 0));
  assert.equal(run.state, S.MAP);
});
test("Developer settings require explicit opt-in, validate values, and disable every campaign save", () => {
  assert.equal(readRunDeveloperSettings("?condition=crosswind&seed=42"), null);
  const settings = readRunDeveloperSettings(
    "?vaultdev=1&seed=42&condition=none&upgrades=impact-harness:88,unknown:4&objective=front-flip",
  );
  assert.equal(settings.seed, 42);
  assert.equal(settings.condition, null);
  assert.equal(settings.upgrades["impact-harness"], 1);
  assert.equal(settings.objective, "front-flip");
  const run = new Campaign(undefined, { developer: settings });
  run.select("owen");
  run.confirm();
  assert.equal(run.save.storage, null);
  assert.equal(run.runs.storage, null);
  assert.equal(run.isUnlocked(LEVELS[2]), true);
  run.startLevel(LEVELS[2].id);
  assert.equal(run.attemptSpec.condition, null);
  assert.equal(run.attemptSpec.upgrades["impact-harness"], 1);
});

const combined = [];
test("After isolated verification, every condition combines safely with each upgrade at its cap", () => {
  for (const condition of CONDITION_IDS)
    for (const [id, item] of Object.entries(UPGRADES)) {
      const world = new PhysicsWorld(CHARACTERS[0], undefined, {
        condition,
        upgrades: { [id]: item.limit },
      });
      for (let i = 0; i < 2500 && !world.finished; i++) {
        const angle = Math.atan2(
          Math.sin(world.cart.angle),
          Math.cos(world.cart.angle),
        );
        const rotate = Math.max(
          -1,
          Math.min(1, -angle * 2 - world.cart.angularVelocity * 28),
        );
        world.step(timedInputs(world, rotate, true));
      }
      assert.ok(
        world.finished && world.launched && world.landed && !world.invalid,
        `${condition} + ${id}`,
      );
      const score = scoreAttempt(world.metrics(), world.character);
      assert.equal(
        score.total,
        score.distancePoints +
          score.stylePoints +
          score.landingPoints +
          score.attachedPoints,
      );
      assert.equal(
        score.stylePoints,
        Math.min(
          5000,
          Math.round(
            score.tricks.subtotal *
              Number(score.tricks.characterMultiplier.toFixed(2)) *
              score.tricks.landingMultiplier,
          ),
        ),
      );
      combined.push({
        condition,
        upgrade: id,
        landing: score.landingQuality,
        score: score.total,
      });
      world.dispose();
      assert.equal(Matter.Composite.allBodies(world.engine.world).length, 0);
      assert.equal(
        Matter.Composite.allConstraints(world.engine.world).length,
        0,
      );
    }
});
test("Maxed combined loadouts remain finite for every character and condition", () => {
  const upgrades = Object.fromEntries(
    UPGRADE_IDS.map((id) => [id, UPGRADES[id].limit]),
  );
  for (const character of CHARACTERS)
    for (const condition of CONDITION_IDS) {
      const world = new PhysicsWorld(character, undefined, {
        condition,
        upgrades,
      });
      for (let i = 0; i < 2500 && !world.finished; i++)
        world.step(timedInputs(world, 1, true));
      assert.ok(
        world.finished && !world.invalid && world.launched,
        `${character.id} / ${condition}`,
      );
      assert.ok(
        Number.isFinite(scoreAttempt(world.metrics(), world.character).total),
      );
      world.dispose();
    }
});
console.log(`${checks} run-progression and combined groups passed.`);
console.log(JSON.stringify({ combined }, null, 2));
