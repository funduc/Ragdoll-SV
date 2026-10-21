import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { Campaign, CampaignState as S } from "../js/campaign.js";
import { CampaignSave } from "../js/campaign-save.js";
import { RunSave, RUN_SAVE_KEY } from "../js/run-save.js";
import { LoadoutSave, LOADOUT_KEY, SLOT_LEVELS, slotCount, trimLoadout } from "../js/loadout.js";
import { garageMarkup, garageButton } from "../js/garage-ui.js";
import { campaignAchievementFacts } from "../js/achievement-events.js";
import { LEVELS, ALL_LEVELS } from "../js/campaign-levels.js";
import { CHARACTERS } from "../js/characters.js";
import { PhysicsWorld } from "../js/physics.js";
import { scoreAttempt } from "../js/scoring.js";
import { driveChapter } from "./chapter-helpers.mjs";

runInThisContext(readFileSync(new URL("../vendor/matter-0.20.0.min.js", import.meta.url), "utf8"));
const memory = () => {
  const data = new Map();
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
};
const db = memory(), medals = new CampaignSave(db);
assert.equal(slotCount(medals, "jake"), 0);
for (const [i, id] of SLOT_LEVELS.entries()) {
  medals.award("jake", id, { medal: 1 });
  assert.equal(slotCount(medals, "jake"), i + 1);
}
assert.equal(slotCount(medals, "owen"), 0);
const loadout = new LoadoutSave(medals);
assert.equal(loadout.change("owen", "improved-air-control", 1), false);
assert.ok(loadout.change("jake", "improved-air-control", 1));
assert.ok(loadout.change("jake", "improved-air-control", 1));
assert.equal(loadout.change("jake", "improved-air-control", 1), false);
assert.ok(loadout.change("jake", "rocket-booster", 1));
assert.equal(loadout.change("jake", "focus", 1), false);
assert.deepEqual(new LoadoutSave(medals).get("jake"), { "improved-air-control": 2, "rocket-booster": 1 });
assert.ok(loadout.change("jake", "improved-air-control", -1));
assert.equal(new LoadoutSave(medals).get("jake")["improved-air-control"], 1);
loadout.clear("jake");
assert.deepEqual(new LoadoutSave(medals).get("jake"), {});
assert.deepEqual(trimLoadout({ "improved-air-control": 99, "rocket-booster": 1, focus: 1, unknown: 10 }, 2), { "improved-air-control": 2 });
console.log("PASS medal-derived slots, caps, add/remove/clear, persistence and ordered trimming");

const legacyDB = memory(), legacyMedals = new CampaignSave(legacyDB), runs = new RunSave(legacyDB, () => 42);
legacyMedals.award("owen", SLOT_LEVELS[0], { medal: 1 });
runs.begin("owen", { upgrades: { "improved-air-control": 2, "rocket-booster": 1 } });
const oldRunText = legacyDB.getItem(RUN_SAVE_KEY);
const imported = new LoadoutSave(legacyMedals, runs.run);
assert.deepEqual(imported.get("owen"), { "improved-air-control": 1 });
assert.equal(legacyDB.getItem(RUN_SAVE_KEY), oldRunText);
imported.clear("owen");
assert.deepEqual(new LoadoutSave(legacyMedals, runs.run).get("owen"), {});
for (const bad of ["{bad", "null", '{"version":99}']) {
  legacyDB.setItem(LOADOUT_KEY, bad);
  const broken = new LoadoutSave(legacyMedals, runs.run);
  assert.deepEqual(broken.get("owen"), {});
  assert.ok(broken.change("owen", "focus", 1));
  assert.equal(legacyDB.getItem(LOADOUT_KEY), bad, "corrupt save stays memory-only");
}
const blockedMedals = new CampaignSave(null);
blockedMedals.data.progress.jake[SLOT_LEVELS[0]].medal = 1;
blockedMedals.storage = { getItem() { throw Error("denied"); }, setItem() { throw Error("denied"); } };
const blocked = new LoadoutSave(blockedMedals, runs.run);
assert.deepEqual(blocked.get("jake"), {});
assert.ok(blocked.change("jake", "focus", 1));
assert.deepEqual(blocked.get("jake"), { focus: 1 });
console.log("PASS one-time legacy import leaves old save intact; corrupt/blocked storage stays usable");

const campaign = new Campaign(medals, { loadout, seedFactory: () => 42 });
campaign.select("jake"); campaign.confirm();
assert.ok(campaign.changeLoadout("rocket-booster", 1));
campaign.requestNewRun(); campaign.confirmNewRun();
assert.equal(campaign.equipped["rocket-booster"], 1);
campaign.changeCharacter(); campaign.select("owen"); campaign.confirm();
assert.deepEqual(campaign.equipped, {});
campaign.changeCharacter(); campaign.select("jake"); campaign.confirm();
assert.equal(campaign.equipped["rocket-booster"], 1);
const html = garageMarkup(campaign);
assert.equal((html.match(/class="upgrade-card"/g) || []).length, 13);
assert.equal((html.match(/<summary>Details<\/summary>/g) || []).length, 13);
campaign.startLevel("orientation-day"); campaign.confirm();
assert.equal(campaign.runs.run.emptyGarageRun, false);
assert.equal(campaign.changeLoadout("clear"), false, "jump cannot change equipment");
campaign.resetAttempt(); campaign.backToMap(); campaign.changeLoadout("clear");
assert.equal(new RunSave(db).run.emptyGarageRun, false);
for (const level of LEVELS) campaign.runs.finishLevel(level.id, true, level.upgradeReward);
assert.equal(campaignAchievementFacts(campaign).upgradeCount, 1);
campaign.runs.manager.send("campaign-progress", campaignAchievementFacts(campaign));
assert.equal(campaign.runs.manager.data.records.factory.unlocked, false);
campaign.requestNewRun(); campaign.confirmNewRun();
assert.equal(campaign.runs.run.emptyGarageRun, true);
console.log("PASS character loadouts/new runs, all 13 cards and permanent per-run Factory Settings disqualification");

function finish(run) {
  const world = new PhysicsWorld(run.current, run.attemptArena, run.attemptSpec);
  driveChapter(world, run.level);
  assert.ok(world.finished && !world.invalid);
  run.record(scoreAttempt(world.metrics(), world.character), world);
  world.dispose();
}
// Real attempts verify notices are tied to newly earned medals, not reward flags.
for (const c of CHARACTERS) {
  const run = new Campaign(new CampaignSave(memory()), { seedFactory: () => 42 });
  run.select(c.id); run.confirm();
  for (const level of LEVELS) {
    run.startLevel(level.id); run.confirm();
    do { finish(run); if (!run.levelFinished) { run.confirm(); run.confirm(); } } while (run.active);
    assert.ok(run.lastMedal.medal >= 1, `${c.id}/${level.id}`);
    assert.equal(run.slotUnlocked, SLOT_LEVELS.includes(level.id), level.id);
    assert.equal(run.runs.run.pendingLevel, null);
    assert.deepEqual(run.lastLoadout, {});
    run.confirm(); assert.equal(run.state, S.MAP);
  }
  run.startLevel(SLOT_LEVELS[0]); run.confirm(); finish(run);
  assert.equal(run.slotUnlocked, false, "slot notice does not repeat on replay");
}
console.log("PASS real Bronze routes for every character: only three slot notices, no reward screen");

for (const id of ["the-santor-gauntlet", "santor-gauntlet-hard", "closing-time", "grand-reopening"]) {
  const save = new CampaignSave(memory());
  for (const level of ALL_LEVELS) save.award("jake", level.id, { medal: 1 });
  const run = new Campaign(save, { seedFactory: () => 42 });
  run.select("jake"); run.confirm(); run.startLevel(id);
  assert.ok(run.canEditLoadout);
  run.changeLoadout("improved-air-control", 1); run.confirm();
  assert.ok(run.garageLocked);
  assert.equal(run.changeLoadout("clear"), false);
  run.resetAttempt();
  assert.match(garageButton(run), /disabled.*Locked until this level ends/);
  assert.equal(run.changeLoadout("clear"), false);
  run.confirm();
  for (let i = 0; i < 3; i++) {
    assert.equal(run.attemptSpec.upgrades["improved-air-control"], 1);
    finish(run);
    assert.equal(run.garageLocked, i < 2);
    if (i < 2) { run.confirm(); assert.equal(run.changeLoadout("clear"), false); run.confirm(); }
  }
  run.confirm(); assert.ok(run.canEditLoadout);
  run.startLevel(id); run.confirm(); run.resetAttempt(); run.backToMap();
  assert.ok(run.canEditLoadout, "abandon unlocks the loadout");
}
const dev = new Campaign(undefined, { developer: { seed: 42, upgrades: { "improved-air-control": 2, "spring-launch": 2, "rocket-booster": 1 } } });
dev.select("jake"); dev.confirm(); dev.startLevel("orientation-day");
assert.equal(dev.slots, 0);
assert.equal(dev.attemptSpec.upgrades["rocket-booster"], 1);
assert.equal(dev.attemptSpec.upgrades["improved-air-control"], 2);
assert.equal(dev.loadout.storage, null);
console.log("PASS all four three-heat locks, abandonment unlock, and unlimited isolated developer loadouts");

// The actual coordinator must ignore a populated Garage in every Party event.
const gameURL = new URL("../js/game.js", import.meta.url);
const source = readFileSync(gameURL, "utf8");
const moduleSource = source.slice(0, source.lastIndexOf("\ntry {"))
  .replace(/from "(\.\/[^\"]+)"/g, (_, p) => `from "${new URL(p, gameURL).href}"`) + "\nexport { Game };";
const { Game } = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`);
for (const event of ["long-jump", "high-jump", "bowling"]) {
  const game = Object.create(Game.prototype);
  Object.assign(game, {
    mode: "party", campaign: dev, clearSync() {},
    tournament: { state: "ready", highJump: event === "high-jump", bowling: event === "bowling", currentRound: { height: 5 } },
    renderer: { resetCamera() {} }, presentation: { replaceWorld() {}, voices: {} },
  });
  game.replaceWorld(CHARACTERS[0]);
  assert.equal(game.world.runEffects, null, event);
  game.world.dispose();
}
console.log("PASS actual Game worlds ignore the Garage in Party, High Jump and Bowling");
