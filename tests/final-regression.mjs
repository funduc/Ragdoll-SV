// Dependency-free save-integrity regressions. No production test hooks.
import assert from "node:assert/strict";
import { CampaignSave, CAMPAIGN_SAVE_KEY } from "../js/campaign-save.js";
import { RunSave, RUN_SAVE_KEY, ACHIEVEMENT_SAVE_KEY } from "../js/run-save.js";
import { Campaign } from "../js/campaign.js";
import { LEVELS } from "../js/campaign-levels.js";
const level = LEVELS[0].id;
function memory(initial = {}) {
  const data = new Map(Object.entries(initial)),
    writes = [];
  return {
    data,
    writes,
    denied: false,
    getItem(key) {
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      if (this.denied) throw new Error("quota denied");
      writes.push(key);
      data.set(key, value);
    },
  };
}
let checks = 0;
function test(name, fn) {
  fn();
  checks++;
  console.log(`PASS ${name}`);
}
test("Newer campaign/run saves survive selection, play, refresh and character changes", () => {
  const future = JSON.stringify({
    version: 99,
    untouched: { medals: [1, 2, 3] },
  });
  const db = memory({ [CAMPAIGN_SAVE_KEY]: future, [RUN_SAVE_KEY]: future });
  for (const id of ["jake", "brandon", "owen"]) {
    const medals = new CampaignSave(db),
      runs = new RunSave(db, () => 42);
    assert.match(medals.notice, /newer.*preserved/i);
    assert.match(runs.notice, /newer.*preserved/i);
    medals.select(id);
    medals.award(id, level, { medal: 3, santor: true });
    runs.begin(id);
    runs.finishLevel(level, true, true);
    runs.choose(runs.run.offers[0]);
    assert.equal(db.getItem(CAMPAIGN_SAVE_KEY), future);
    assert.equal(db.getItem(RUN_SAVE_KEY), future);
    assert.equal(
      medals.entry(id, level).medal,
      3,
      "in-memory play still works",
    );
  }
});
test("Only confirmed New run/reset can replace a protected future save", () => {
  const future = JSON.stringify({ version: 99, preserved: true });
  const db = memory({ [CAMPAIGN_SAVE_KEY]: future, [RUN_SAVE_KEY]: future });
  const campaign = new Campaign(new CampaignSave(db));
  campaign.select("jake");
  campaign.confirm();
  const achievements = db.getItem(ACHIEVEMENT_SAVE_KEY);
  campaign.requestNewRun();
  campaign.confirm(); // Default is Cancel.
  assert.equal(db.getItem(RUN_SAVE_KEY), future);
  campaign.requestNewRun();
  campaign.confirmNewRun();
  assert.equal(JSON.parse(db.getItem(RUN_SAVE_KEY)).version, 1);
  assert.equal(db.getItem(CAMPAIGN_SAVE_KEY), future);
  campaign.requestReset();
  campaign.confirmReset();
  assert.equal(JSON.parse(db.getItem(CAMPAIGN_SAVE_KEY)).version, 1);
  assert.equal(db.getItem(ACHIEVEMENT_SAVE_KEY), achievements);
});
test("Unchanged replays and repeated selection do not rewrite medal/run saves", () => {
  const db = memory(),
    medals = new CampaignSave(db),
    runs = new RunSave(db, () => 42);
  medals.select("jake");
  medals.award("jake", level, { medal: 3 });
  runs.begin("jake");
  runs.finishLevel(level, true, true);
  runs.skipOffer();
  db.writes.length = 0;
  for (let i = 0; i < 20; i++) {
    medals.select("jake");
    medals.award("jake", level, { medal: 1 });
    runs.finishLevel(level, true, true);
  }
  assert.deepEqual(db.writes, []);
  const restoredMedals = new CampaignSave(db),
    restoredRun = new RunSave(db);
  restoredMedals.select("jake");
  restoredRun.finishLevel(level, true, true);
  assert.deepEqual(db.writes, [], "unchanged loaded records also skip writes");
});
test("Failed writes retain in-memory progress and retry after storage recovers", () => {
  const db = memory(),
    medals = new CampaignSave(db),
    runs = new RunSave(db, () => 42);
  medals.select("jake");
  runs.begin("jake");
  db.denied = true;
  assert.equal(medals.award("jake", level, { medal: 3 }).saved, false);
  runs.finishLevel(level, true, true);
  assert.match(runs.notice, /cannot be saved/);
  db.denied = false;
  assert.equal(medals.award("jake", level, { medal: 1 }).saved, true);
  runs.finishLevel(level, true, true);
  assert.equal(new CampaignSave(db).entry("jake", level).medal, 3);
  assert.equal(new RunSave(db).run.pendingLevel, level);
  assert.equal(medals.notice, "");
  assert.equal(runs.notice, "");
});
test("Corrupt and unsupported old saves recover independently, without touching unrelated keys", () => {
  for (const raw of [
    "not-json",
    "null",
    '{"version":0}',
    '{"version":1,"progress":{"jake":{"orientation-day":{"medal":999}}}}',
  ]) {
    const db = memory({
      [CAMPAIGN_SAVE_KEY]: raw,
      [RUN_SAVE_KEY]: raw,
      unrelated: "keep",
    });
    const medals = new CampaignSave(db),
      runs = new RunSave(db, () => 42);
    assert.equal(medals.entry("jake", level).medal, 0);
    medals.select("jake");
    runs.begin("jake");
    medals.award("jake", level, { medal: 1 });
    assert.equal(new CampaignSave(db).entry("jake", level).medal, 1);
    assert.equal(new RunSave(db).run.characterId, "jake");
    assert.equal(db.getItem("unrelated"), "keep");
  }
});
console.log(`${checks} final save regressions passed.`);
