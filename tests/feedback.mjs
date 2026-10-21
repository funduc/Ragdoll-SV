import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { Settings, SETTINGS_KEY } from "../js/settings.js";
import { changelogEntries } from "../js/changelog.js";
import { palette, setSheedy, characterColour, gradeCue } from "../js/palette.js";
import { CHARACTERS } from "../js/characters.js";
import { Campaign, CampaignState as S } from "../js/campaign.js";
import { CampaignSave } from "../js/campaign-save.js";
import { SyncSave } from "../js/sync-save.js";
import { Tournament, State } from "../js/tournament.js";
import { chapterControls } from "./chapter-helpers.mjs";
import { Renderer } from "../js/renderer.js";
import { ThemePainter } from "../js/themes.js";

const entries = new Map();
const storage = {
  get length() { return entries.size; }, key: i => [...entries.keys()][i],
  getItem: k => entries.get(k) ?? null, setItem: (k, v) => entries.set(k, v),
};
const settings = new Settings({ localStorage: storage });
assert.equal(settings.data.sheedy, false);
const history = [
  { id: "2026-10-20", title: "New", items: ["One"] },
  { id: "2026-10-19", title: "Old", items: ["Two"] },
];
assert.deepEqual(changelogEntries(settings, { entries: history }), history.slice(0, 1));
settings.update({ sheedy: true, lastSeenChangelog: history[0].id });
assert.equal(new Settings({ localStorage: storage }).data.sheedy, true);
assert.deepEqual(changelogEntries(settings, { entries: history }), []);
const newer = [{ id: "2026-10-21", title: "Next", items: ["Three"] }, ...history];
assert.deepEqual(changelogEntries(settings, { entries: newer }), newer.slice(0, 1));
assert.deepEqual(changelogEntries(settings, { entries: newer, all: true }), newer);
assert.deepEqual([...entries.keys()], [SETTINGS_KEY]);
const blocked = new Settings({ get localStorage() { throw Error("blocked"); } });
assert.equal(blocked.data.sheedy, false);
blocked.update({ lastSeenChangelog: history[0].id });
assert.deepEqual(changelogEntries(blocked, { entries: history }), []);
entries.set(SETTINGS_KEY, "{bad");
assert.equal(new Settings({ localStorage: storage }).data.sheedy, false);
entries.set("santor-vault:campaign", "existing progress");
const returning = new Settings({ localStorage: storage });
assert.deepEqual(changelogEntries(returning, { entries: history }), history);
setSheedy(true);
assert.equal(palette().good, "#0072B2");
assert.equal(palette().perfect, "#56B4E9");
assert.equal(palette().bad, "#E69F00");
assert.equal(palette().miss, "#D55E00");
assert.equal(palette().target, "#56B4E9");
assert.equal(characterColour(CHARACTERS[2]), "#CC79A7");
assert.equal(characterColour(CHARACTERS[0]), CHARACTERS[0].primaryColor);
assert.equal(gradeCue("Perfect"), "Perfect ✓");
assert.equal(gradeCue("Miss"), "Miss ✕");
assert.equal(gradeCue("Unbraced"), "Unbraced");
setSheedy(false);
console.log("PASS settings defaults, persistence, corrupt/blocked storage, unseen/full history and safe palette");

runInThisContext(readFileSync(new URL("../vendor/matter-0.20.0.min.js", import.meta.url), "utf8"));
const source = readFileSync(new URL("../js/game.js", import.meta.url), "utf8");
const moduleSource = source.slice(0, source.lastIndexOf("\ntry {"))
  .replace(/from "(\.\/[^"]+)"/g, (_, p) => `from "${new URL(p, new URL("../js/game.js", import.meta.url)).href}"`)
  + "\nexport { Game };";
const { Game } = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`);
entries.clear();
const campaign = new Campaign(new CampaignSave(storage), { seedFactory: () => 42 });
campaign.select("jake"); campaign.confirm(); campaign.startLevel("orientation-day"); campaign.confirm();
let toastClears = 0, voiceCancels = 0, syncClears = 0, rendered;
const game = Object.assign(Object.create(Game.prototype), {
  mode: "vault", campaign, suspended: false, pendingVoiceFacts: [],
  achievements: campaign.runs.manager, syncSave: new SyncSave(storage),
  touch: { clear() {}, sync() {} }, input: { clear() {} },
  syncUI: { hide() { syncClears++; } },
  ui: { root: { dataset: {} }, achievementToasts: { clear() { toastClears++; } } },
  renderer: { resetCamera() {} },
  presentation: {
    voices: { cancel() { voiceCancels++; } }, music: { setDuck() {} },
    replaceWorld() {},
  },
  renderState() { rendered = this.session.state; },
});
try {
  game.replaceWorld(campaign.current);
  while (!game.world.launched) game.world.step(chapterControls(game.world, campaign.level));
  assert.equal(game.world.canRestart, false);
  const before = JSON.stringify([...entries]);
  game.voicePlayed({ characterId: "jake", speakerId: "owen", heckle: false });
  game.pendingSyncPattern = [0, 1, 2];
  game.syncSequence = { phase: "intro" };
  game.accumulator = 99;
  game.restartAttempt();
  assert.equal(rendered, S.READY);
  assert.equal(campaign.lastScore, null);
  assert.equal(JSON.stringify([...entries]), before, "abandon writes no save, record, career or achievement data");
  assert.equal(game.pendingVoiceFacts.length, 0);
  assert.equal(game.pendingSyncPattern, null);
  assert.equal(game.syncSequence, null);
  assert.equal(game.accumulator, 0);
  assert.ok(toastClears && voiceCancels && syncClears);
  assert.equal(game.recording.frames.length, 0);

  // Current-heat restart must not use retryLevel(), which resets the whole series.
  const banked = Object.freeze([{ score: { total: 450 } }, { score: { total: 550 } }]);
  const series = new Campaign(new CampaignSave(null), { developer: { seed: 42, upgrades: {} } });
  series.select("jake"); series.confirm(); series.startLevel("the-santor-gauntlet"); series.confirm();
  series.stageIndex = 2; series.heats = banked; game.campaign = series;
  game.restartAttempt();
  assert.equal(series.stageIndex, 2); assert.equal(series.heats, banked);
  assert.equal(series.heats.reduce((sum, heat) => sum + heat.score.total, 0), 1000);
  game.campaign = campaign;

  game.mode = "party";
  game.tournament = new Tournament(); game.tournament.state = State.ACTIVE;
  game.world.launched = true;
  const partyWorld = game.world;
  game.restartAttempt();
  assert.equal(game.tournament.state, State.ACTIVE);
  assert.equal(game.world, partyWorld);
  console.log("PASS airborne/Sync abandon discards pending progress, current heat retains bank, Party cannot redo flight");

  // Camera coverage uses actual body vertices, not just the cart centre.
  const ctx = new Proxy({}, { get: () => () => ({ addColorStop() {}, width: 0 }), set: () => true });
  const renderer = Object.assign(Object.create(Renderer.prototype), {
    ctx, themes: new ThemePainter(), cosmetics: {}, camera: { x: 0, y: -80, scale: 1 },
    dpr: 1, width: 1366, height: 560, hudBottom: 100, snap: true,
  });
  game.mode = "vault"; campaign.state = S.ACTIVE; game.replaceWorld(campaign.current);
  let checked = 0;
  while (!game.world.finished) {
    game.world.step(chapterControls(game.world, campaign.level));
    if (!game.world.launched || game.world.landed) continue;
    for (const width of [1366, 390]) {
      renderer.width = width; renderer.height = width === 390 ? 360 : 560;
      renderer.draw(game.world);
      const top = Math.min(...[game.world.cart, ...game.world.rider, ...game.world.wheels].flatMap(b => b.vertices.map(v => v.y)));
      assert.ok((top - renderer.camera.y) * renderer.camera.scale >= 123.99);
      checked++;
    }
  }
  assert.ok(checked > 100);
  console.log("PASS desktop and phone framing keeps the whole cart/rider below the HUD throughout flight");
} finally { game.world?.dispose(); }
