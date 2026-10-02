import assert from "node:assert/strict";
import { CHARACTERS } from "../js/characters.js";
import { LEVELS } from "../js/campaign-levels.js";
import { SYNC_CONFIG as C } from "../js/sync-config.js";
import { chapterControls } from "./chapter-helpers.mjs";
const codes = ["ArrowLeft", "ArrowDown", "ArrowUp", "ArrowRight"];
const snapshots = w => JSON.stringify(w.dynamic.map(b => [b.position.x, b.position.y, b.angle]));
function start(g, id) {
  g.click('[data-mode="vault"]'); g.choose("select", id); g.choose("confirm");
  g.choose("level", LEVELS[0].id); g.choose("confirm"); g.frame();
  assert.equal(g.$("#game").dataset.sync, undefined, "no pre-jump event");
  let held = 0;
  for (let i = 0; i < 1200 && !g.$("#game").dataset.sync; i++) {
    const input = chapterControls(g.world, LEVELS[0]);
    if (input.pushes) g.driveTap("Space");
    if (input.rotate !== held) {
      if (held) g.key(held < 0 ? "ArrowLeft" : "ArrowRight", "keyup");
      held = input.rotate;
      if (held) g.key(held < 0 ? "ArrowLeft" : "ArrowRight");
    }
    g.frame();
  }
  if (held) g.key(held < 0 ? "ArrowLeft" : "ArrowRight", "keyup");
  assert.equal(g.$("#game").dataset.sync, "playing");
  g.frame(); // expose the running sequence through the real tick hook
  assert.equal(g.world.skills.takeoff, "Perfect"); assert.ok(g.world.skills.pushes.Perfect >= 5);
}
function timeTo(g, time) {
  while (g.sequence.time < time - 1e-9 && g.$("#game").dataset.sync)
    g.frame(Math.min(1000 / 120, (time - g.sequence.time) * 1000));
}
function pointer(g, lane, type) {
  const e = new g.w.MouseEvent(type, { bubbles: true, cancelable: true, button: 0 });
  Object.defineProperty(e, "pointerId", { value: 77 });
  g.$('[data-sync-lane="' + lane + '"]').dispatchEvent(e);
}
export async function runSyncScenarios(boot, evidence) {
  const results = [];
  for (const c of CHARACTERS) for (const [grade, expected] of [["M", "MISS"], ["G", "GOOD"], ["P", "PERFECT SYNC"]]) {
    const g = await boot({ "santor-vault:muted": "true" }); start(g, c.id);
    const sequence = g.sequence, initialTime = g.world.elapsed, clock = sequence.time, pose = snapshots(g.world);
    assert.equal(g.w.Audio.instances[0].paused, true, "muted notes remain playable");
    g.frame(2000); assert.equal(sequence.time, clock); assert.equal(snapshots(g.world), pose);
    g.w.dispatchEvent(new g.w.Event("blur")); g.frame(100); g.tap("ArrowLeft");
    assert.equal(sequence.time, clock); assert.equal(sequence.extra, 0);
    g.w.dispatchEvent(new g.w.Event("focus")); g.frame();
    for (const note of sequence.notes) {
      timeTo(g, note.at + (grade === "G" ? sequence.perfectWindow + .025 : 0));
      if (grade === "M") continue;
      const before = sequence.serial;
      if (process.env.MOBILE) {
        pointer(g, note.lane, "pointerdown"); pointer(g, note.lane, "pointerdown");
        pointer(g, note.lane, "pointerup");
      } else {
        g.key(codes[note.lane]); g.key(codes[note.lane], "keydown", true); g.key(codes[note.lane]);
        g.key(codes[note.lane], "keyup");
      }
      assert.equal(sequence.serial, before + 1, "holding never repeats a note");
    }
    for (let i = 0; g.$("#game").dataset.sync && i < 200; i++) g.frame();
    assert.equal(g.world.syncResult.grade, expected); assert.ok(g.$("#sync-controls").hidden);
    const resumed = g.world.elapsed;
    assert.ok(resumed > initialTime && resumed - initialTime < .5, "physics advances at 20% during notes");
    g.finishAttempt();
    assert.ok(g.world.landingTime - resumed >= C.recoverySeconds);
    assert.equal(g.world.crashed, false, "missing notes does not cause a crash");
    assert.ok(g.$(".sync-breakdown").textContent.includes(expected));
    results.push({ character: c.id, grade: expected, recovery: g.world.landingTime - resumed });
    const saved = g.savedData(); g.close();
    const reloaded = await boot(saved); start(reloaded, c.id);
    assert.notDeepEqual(reloaded.sequence.notes.map(n => n.lane), sequence.notes.map(n => n.lane), "next jump earns a fresh pattern even after reload");
    assert.equal(reloaded.world.syncResult, undefined, "old grade never boosts the next launch");
    reloaded.close();
  }
  assert.deepEqual(evidence.consoleErrors, []); assert.deepEqual(evidence.consoleWarnings, []);
  console.log(JSON.stringify({ status: "PASS", results, touch: Boolean(process.env.MOBILE) }, null, 2));
}
