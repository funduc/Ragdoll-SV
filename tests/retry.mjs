// Exercise the real Game methods without starting its browser-owned render loop.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { Campaign, CampaignState as S } from "../js/campaign.js";
import { CampaignSave } from "../js/campaign-save.js";
import { Input } from "../js/input.js";
import { scoreAttempt } from "../js/scoring.js";
import { timedInputs } from "./skill-helpers.mjs";
const source = readFileSync(new URL("../js/game.js", import.meta.url), "utf8");
const moduleSource = source.slice(0, source.lastIndexOf("\ntry {"))
  .replace(/from "(\.\/[^\"]+)"/g, (_, p) => `from "${new URL(p, new URL("../js/game.js", import.meta.url)).href}"`)
  + "\nexport { Game };";
const { Game } = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`);
runInThisContext(readFileSync(new URL("../vendor/matter-0.20.0.min.js", import.meta.url), "utf8"));
globalThis.window = new EventTarget();
globalThis.document = new EventTarget();
document.hidden = false;
let focuses = 0;
document.getElementById = () => ({ focus() { focuses++; } });
const entries = new Map();
const storage = { getItem: k => entries.get(k) ?? null, setItem: (k, v) => entries.set(k, v) };
const run = new Campaign(new CampaignSave(storage), { seedFactory: () => 42 });
run.select("jake"); run.confirm(); run.startLevel("orientation-day");
assert.equal(run.state, S.READY, "map entry retains briefing");
const game = Object.create(Game.prototype);
const screens = [];
let resets = 0, syncStarts = 0;
Object.assign(game, {
  mode: "vault", campaign: run, destroyed: false, vaultOpen: false,
  touch: { clear() {} }, clearSync() {},
  renderer: { resetCamera() {} },
  presentation: { audio: { play() {} }, replaceWorld() {} },
  ui: { resetAttempt() { resets++; }, setPaused() {} },
  renderState() { screens.push(run.state); },
  startSync() { syncStarts++; },
});
const input = new Input({
  isActive: () => run.active,
  onExclusiveKey: e => game.exclusiveKey(e),
  onConfirm: event => {
    const focused = event.target?.closest?.("button[data-campaign]");
    if (focused) game.menuAction(focused); else game.confirm();
  },
  onRestart: () => game.restartAttempt(),
  onSuspend() {},
});
game.input = input;
function key(type, code, repeat = false) {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { code, repeat }); window.dispatchEvent(event);
}
function tap(code) { key("keydown", code); key("keyup", code); }
function button(action, value = "") {
  game.menuAction({ disabled: false, isConnected: true, dataset: { campaign: action, value }, hasAttribute: () => false });
}
try {
  game.replaceWorld(run.current);
  tap("Enter");
  for (let attempt = 0; attempt < 5; attempt++) {
    assert.equal(run.state, S.ACTIVE);
    for (let step = 0; step < 2500 && !game.world.finished; step++) {
      if (timedInputs(game.world).pushes) tap("Space");
      game.world.step(input.consume()); run.observe(game.world);
    }
    assert.ok(game.world.finished);
    run.record(scoreAttempt(game.world.metrics(), game.world.character), game.world);
    const oldWorld = game.world;
    const saved = JSON.stringify([...entries]);
    key("keydown", "KeyR");
    key("keydown", "KeyR", true);
    key("keyup", "KeyR");
    assert.equal(JSON.stringify([...entries]), saved, "retry itself never writes saves");
    if (attempt === 0) {
      assert.equal(run.state, S.UPGRADES, "pending reward precedes retry");
      tap("KeyR");
      assert.equal(run.state, S.UPGRADES, "R cannot bypass reward");
      // Enter on the focused reward button follows the same menu handler.
      window.closest = () => ({ disabled: false, isConnected: true, dataset: { campaign: "upgrade", value: run.runs.run.offers[0] }, hasAttribute: () => false });
      tap("Enter");
      delete window.closest;
    }
    assert.equal(run.state, S.ACTIVE);
    assert.notEqual(game.world, oldWorld);
    assert.equal(game.world.elapsed, 0);
    assert.equal(run.lastScore, null);
    assert.equal(run.reachedRamp, false);
    assert.equal(input.consume().pushes, 0);
  }
  assert.ok(!screens.includes(S.MAP) && !screens.includes(S.READY));
  assert.equal(resets, 5);
  assert.equal(syncStarts, 6, "retries retain the normal Sync entry point");
  assert.equal(focuses, 6);
  console.log("PASS five keyboard-driven Orientation attempts and R retries, reward ordering, fresh worlds, controls and save preservation");

  const series = new Campaign(new CampaignSave(null), { developer: { seed: 42, upgrades: {} } });
  series.select("jake"); series.confirm(); series.startLevel("the-santor-gauntlet");
  for (const heat of [0, 1, 2]) {
    series.state = S.RESULTS; series.stageIndex = heat;
    series.heats = Array.from({ length: heat + 1 }, () => ({ score: { total: 123 } }));
    series.lastScore = { total: 123 };
    assert.ok(series.retryLevel());
    assert.equal(series.state, S.ACTIVE);
    assert.equal(series.stageIndex, 0); assert.deepEqual(series.heats, []);
    assert.equal(series.lastScore, null);
  }
  run.state = S.RESULTS;
  button("retry"); assert.equal(run.state, S.ACTIVE);
  const currentWorld = game.world;
  game.retryLevel(); assert.equal(game.world, currentWorld, "retry during play is ignored");
  game.mode = "party";
  run.state = S.RESULTS;
  tap("KeyR"); assert.equal(run.state, S.RESULTS, "Party results unaffected");
  console.log("PASS retry button, every Gauntlet heat resets to heat 1, active and Party guards");

  const reward = new Campaign(new CampaignSave(null), { seedFactory: () => 42 });
  reward.select("jake"); reward.confirm(); reward.startLevel("orientation-day");
  reward.runs.finishLevel("orientation-day", true, true);
  reward.state = S.RESULTS;
  reward.retryLevel(); assert.equal(reward.state, S.UPGRADES);
  assert.equal(reward.chooseUpgrade("invalid"), false);
  assert.equal(reward.state, S.UPGRADES);
  reward.skipUpgrade(); assert.equal(reward.state, S.ACTIVE);
  console.log("PASS skipping reward resumes retry; invalid reward cannot bypass choice");
} finally {
  input.destroy(); game.world?.dispose();
}
