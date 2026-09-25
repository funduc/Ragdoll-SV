import assert from "node:assert/strict";
import { CHARACTERS } from "../js/characters.js";
import { LEVELS } from "../js/campaign-levels.js";
import { SYNC_CONFIG as C } from "../js/sync-config.js";
import { SyncSave, SYNC_SAVE_KEY } from "../js/sync-save.js";
import { RunSave, RUN_SAVE_KEY } from "../js/run-save.js";
const codes = ["ArrowLeft", "ArrowDown", "ArrowUp", "ArrowRight"];
const snapshots = (w) =>
  JSON.stringify(
    w.dynamic.map((b) => [
      b.position.x,
      b.position.y,
      b.angle,
      b.velocity.x,
      b.velocity.y,
    ]),
  );
function start(g, id, level = LEVELS[0].id) {
  g.click('[data-mode="vault"]');
  g.choose("select", id);
  g.choose("confirm");
  g.choose("level", level);
  g.choose("confirm");
  g.frame();
}
function timeTo(g, time) {
  while (g.sequence.time < time - 1e-9)
    g.frame(Math.min(1000 / 120, (time - g.sequence.time) * 1000));
}
function pointer(g, lane, type, id = 77) {
  const e = new g.w.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
  });
  Object.defineProperty(e, "pointerId", { value: id });
  g.$(`[data-sync-lane="${lane}"]`).dispatchEvent(e);
}
function perform(g, pattern, touch = false) {
  const seq = g.sequence,
    world = g.world,
    initial = snapshots(world),
    timestamp = world.engine.timing.timestamp;
  assert.ok(g.$("#game").dataset.sync);
  g.tap("Enter");
  assert.ok(g.$("#game").dataset.sync);
  for (let i = 0; i < seq.notes.length; i++) {
    const n = seq.notes[i];
    timeTo(g, n.at + (pattern[i] === "G" ? seq.perfectWindow + 0.025 : 0));
    if (pattern[i] !== "M") {
      const before = seq.serial;
      if (touch) {
        pointer(g, n.lane, "pointerdown");
        pointer(g, n.lane, "pointerdown");
        assert.equal(seq.serial, before + 1);
        pointer(g, n.lane, "pointerup");
      } else {
        g.key(codes[n.lane]);
        for (let j = 0; j < 4; j++) g.key(codes[n.lane], "keydown", true);
        g.key(codes[n.lane]);
        assert.equal(seq.serial, before + 1);
        g.key(codes[n.lane], "keyup");
      }
    }
    assert.equal(snapshots(world), initial);
    assert.equal(world.elapsed, 0);
    assert.equal(world.engine.timing.timestamp, timestamp);
  }
  timeTo(g, seq.end + 0.02);
  assert.equal(g.$("#game").dataset.sync, "result");
  // Holds made on the result screen must not leak into drive or brace inputs.
  g.key("ArrowUp");
  g.key("ArrowRight");
  g.key("ArrowDown");
  g.key("Enter");
  for (let i = 0; i < 120 && g.$("#game").dataset.sync; i++)
    g.frame(1000 / 120);
  assert.equal(g.$("#game").dataset.sync, undefined);
  assert.equal(world.elapsed, 0);
  assert.equal(snapshots(world), initial);
  g.key("ArrowUp", "keydown", true);
  g.key("ArrowRight", "keydown", true);
  g.key("Enter", "keydown", true);
  g.frame();
  g.frame();
  assert.equal(
    world.skills.pushes.Perfect +
      world.skills.pushes.Good +
      world.skills.pushes.Miss,
    0,
  );
  assert.equal(world.skills.braceAt, null);
  for (const key of ["ArrowUp", "ArrowRight", "ArrowDown", "Enter"])
    g.key(key, "keyup");
  g.driveTap("Space");
  g.frame();
  assert.equal(
    world.skills.pushes.Perfect +
      world.skills.pushes.Good +
      world.skills.pushes.Miss,
    1,
    "fresh runway tap works",
  );
  return seq.result;
}
export async function runSyncScenarios(boot, evidence) {
  const results = [];
  for (const c of CHARACTERS)
    for (const [pattern, expected] of [
      ["MMMMMM", "MISS"],
      ["GGGGGG", "GOOD"],
      ["PPPPGG", "GREAT"],
      ["PPPPPP", "PERFECT SYNC"],
    ]) {
      const g = await boot(
        { "santor-vault:muted": "true" },
        false,
        "?syncdev=1",
      );
      start(g, c.id);
      assert.equal(
        g.w.Audio.instances[0].paused,
        true,
        "muted rhythm remains playable",
      );
      const sequence = g.sequence,
        clock = sequence.time,
        pos = snapshots(g.world);
      g.frame(2000);
      assert.equal(sequence.time, clock);
      assert.equal(snapshots(g.world), pos);
      g.w.dispatchEvent(new g.w.Event("blur"));
      g.frame(100);
      g.tap("ArrowLeft");
      assert.equal(sequence.time, clock);
      assert.equal(sequence.extra, 0);
      g.w.dispatchEvent(new g.w.Event("focus"));
      g.frame();
      const result = perform(g, pattern, Boolean(process.env.MOBILE));
      assert.equal(result.grade, expected);
      assert.ok(!g.$("#sync-controls").hidden === false);
      g.finishAttempt();
      assert.ok(g.$(".sync-breakdown").textContent.includes(expected));
      g.choose("confirm");
      if (g.state() === "campaign-upgrades") g.choose("skip-upgrade");
      g.choose("level", LEVELS[0].id);
      g.choose("confirm");
      assert.equal(
        g.$("#game").dataset.sync,
        undefined,
        "replay has no second event even forced",
      );
      g.tap("KeyR");
      assert.equal(g.state(), "ready");
      assert.equal(g.$("#sync-overlay").hidden, true);
      g.choose("confirm");
      assert.equal(g.$("#game").dataset.sync, undefined);
      results.push({
        character: c.id,
        grade: result.grade,
        accuracy: result.accuracy,
        touch: Boolean(process.env.MOBILE),
      });
      g.close();
    }
  // Normal persistent run: reload mid-event, then reload with its grade banked.
  const data = new Map(),
    st = {
      getItem: (k) => data.get(k) || null,
      setItem: (k, v) => data.set(k, v),
    };
  new RunSave(st, () => 42).begin("jake");
  new SyncSave(st).begin(
    { characterId: "jake", seed: 42 },
    LEVELS[0].id,
    0,
    true,
  );
  let g = await boot(Object.fromEntries(data));
  start(g, "jake");
  timeTo(g, 0.6);
  const saved = g.savedData(),
    scope = JSON.parse(saved[SYNC_SAVE_KEY]);
  g.close();
  g = await boot(saved);
  start(g, "jake");
  assert.equal(
    JSON.parse(g.savedData()[SYNC_SAVE_KEY]).occurrences,
    scope.occurrences,
  );
  assert.equal(g.sequence.time, 0);
  const media = g.w.Audio.instances[0],
    ducked = media.volume;
  assert.ok(ducked > 0);
  perform(g, "PPPPPP");
  assert.ok(
    Math.abs(media.volume - ducked / C.musicDuck) < 1e-9,
    "music restores exact relative preference volume",
  );
  const banked = g.savedData();
  g.close();
  g = await boot(banked);
  start(g, "jake");
  assert.equal(g.$("#game").dataset.sync, undefined);
  assert.equal(
    g.world.syncResult.grade,
    "PERFECT SYNC",
    "no second rhythm roll",
  );
  g.tap("KeyR");
  assert.equal(g.world.syncResult, undefined);
  g.choose("confirm");
  assert.equal(g.$("#game").dataset.sync, undefined);
  g.close();
  // Restart while the minigame is playing: discard it, release duck, empty world.
  g = await boot({}, false, "?syncdev=1");
  start(g, "owen");
  const old = g.world;
  g.tap("KeyR");
  assert.equal(g.state(), "ready");
  assert.equal(g.$("#sync-controls").hidden, true);
  assert.equal(old.disposed, true);
  g.choose("confirm");
  assert.equal(g.$("#game").dataset.sync, undefined);
  g.close();
  assert.deepEqual(evidence.consoleErrors, []);
  assert.deepEqual(evidence.consoleWarnings, []);
  console.log(
    JSON.stringify(
      {
        status: "PASS",
        viewport: evidence.viewportSimulated,
        results,
        refresh: "pending and earned grade retained",
        reset: "R during and after event clears state",
        physics: "stationary engine and all bodies throughout sequence",
        music: "duck and preference volume restored",
        consoleErrors: evidence.consoleErrors,
      },
      null,
      2,
    ),
  );
}
