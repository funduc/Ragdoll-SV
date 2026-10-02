import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { SYNC_CONFIG as C, syncResult, syncReward } from "../js/sync-config.js";
import { SyncSequence, syncMoment, syncLandingETA } from "../js/sync.js";
import { SyncSave, SYNC_SAVE_KEY } from "../js/sync-save.js";
import { Input } from "../js/input.js";
import { ALL_CONDITION_IDS } from "../js/run-config.js";
import { CHARACTERS } from "../js/characters.js";
import { PhysicsWorld, STEP_MS } from "../js/physics.js";
import { Campaign } from "../js/campaign.js";
import { CampaignSave } from "../js/campaign-save.js";
import { Tournament, State } from "../js/tournament.js";
import { ReplayRecording } from "../js/replay.js";
import { attemptAchievementFacts } from "../js/achievement-events.js";
import { Effects } from "../js/effects.js";
import { scoreAttempt, assertScore } from "../js/scoring.js";
import { chapterControls } from "./chapter-helpers.mjs";
import { AchievementManager, ACHIEVEMENT_SAVE_KEY } from "../js/achievements.js";
let groups = 0;
function check(name, fn) { fn(); groups++; console.log("PASS", name); }
function advance(s, time) { while (s.time < time - 1e-10) s.tick(Math.min(1 / 120, time - s.time)); }
const storage = () => {
  const data = new Map();
  return { getItem: k => data.get(k) || null, setItem: (k, v) => data.set(k, v) };
};
check("Three to five notes, all characters and grades, symmetric windows and bounded spam", () => {
  for (const c of CHARACTERS) for (const count of [3, 4, 5]) {
    for (const [grade, expected] of [["M", "MISS"], ["G", "GOOD"], ["P", "PERFECT SYNC"]]) {
      const s = new SyncSequence(c.id, C.characters[c.id].patterns[0].slice(0, count));
      for (const n of s.notes) {
        advance(s, n.at + (grade === "G" ? s.perfectWindow + .02 : 0));
        if (grade !== "M") s.hit(n.lane);
      }
      advance(s, s.end + .02);
      assert.equal(s.result.grade, expected); assert.ok(s.done); assert.equal(s.result.notes, count);
      assert.equal(syncReward(s.result).points, grade === "P" ? 180 : grade === "G" ? 126 : 0);
    }
  }
  assert.equal(syncResult(2, 1, 0, 3).grade, "GREAT");
  for (const offset of [-.11, .11]) {
    const s = new SyncSequence("brandon"); advance(s, C.firstBeat + offset);
    s.hit(s.notes[0].lane); assert.equal(s.notes[0].grade, "Good");
  }
  const s = new SyncSequence("jake"); advance(s, C.firstBeat); s.hit(3);
  assert.equal(s.notes[0].grade, "Miss");
  for (let i = 0; i < 1100; i++) s.hit(0);
  assert.equal(s.extra, C.maximumExtraMisses);
  const time = s.time; s.tick(Infinity); s.tick(20); assert.equal(s.time, time);
  assert.equal(syncResult(NaN, Infinity).accuracy, 0);
});
check("Old random/pity/pending saves migrate; progress, patterns, denied and future storage survive", () => {
  const st = storage(), run = { characterId: "jake", seed: 42 };
  const old = { version: 1, scope: "jake:42", occurrences: 2, pity: 5,
    levels: { "orientation-day": { triggered: true, result: syncResult(3) } }, used: true, serial: 9 };
  st.setItem(SYNC_SAVE_KEY, JSON.stringify(old)); st.setItem("campaign", "untouched");
  const a = new SyncSave(st);
  assert.deepEqual(a.data, { version: 2, scope: "jake:42", occurrences: 2, lastPattern: "" });
  assert.deepEqual(JSON.parse(st.getItem(SYNC_SAVE_KEY)), a.data);
  a.recordMoment(run, [0, 1, 2]); const b = new SyncSave(st);
  assert.equal(b.data.occurrences, 3); assert.equal(b.data.lastPattern, "012");
  b.recordMoment(null, [3, 2, 1]); assert.equal(b.data.occurrences, 3, "Party does not count toward campaign Encore");
  b.recordMoment({ ...run, seed: 43 }, [0, 2, 1]); assert.equal(b.data.occurrences, 1);
  b.resetRun(); assert.equal(b.data.occurrences, 0); assert.equal(b.data.lastPattern, "021");
  assert.equal(st.getItem("campaign"), "untouched");
  st.setItem(SYNC_SAVE_KEY, "{"); assert.doesNotThrow(() => new SyncSave(st).recordMoment(run, [0, 1, 2]));
  st.setItem(SYNC_SAVE_KEY, '{"version":99}'); new SyncSave(st).recordMoment(run, [0, 1, 2]);
  assert.equal(st.getItem(SYNC_SAVE_KEY), '{"version":99}');
  const denied = new SyncSave({ getItem() { throw Error(); }, setItem() { throw Error(); } });
  denied.recordMoment(run, [0, 1, 2]); assert.equal(denied.data.occurrences, 1);
});
runInThisContext(readFileSync(new URL("../vendor/matter-0.20.0.min.js", import.meta.url), "utf8"));
const source = readFileSync(new URL("../js/game.js", import.meta.url), "utf8");
const moduleSource = source.slice(0, source.lastIndexOf("\ntry {"))
  .replace(/from "(\.\/[^\"]+)"/g, (_, p) => 'from "' + new URL(p, new URL("../js/game.js", import.meta.url)).href + '"')
  + "\nexport { Game };";
const { Game } = await import('data:text/javascript;base64,' + Buffer.from(moduleSource).toString("base64"));
globalThis.document = { hidden: false, getElementById: () => ({ focus() {} }) };
globalThis.requestAnimationFrame = () => 1;
const poses = w => w.dynamic.map(b => [b.position.x, b.position.y, b.angle, b.velocity.x, b.velocity.y]);
function fly(character, { mode = "party", grade = "M", gravity = 1.05, target = "Perfect", hard = false,
    syncSave = new SyncSave(storage()), fewerPushes = false, disabled = false, interruption = false, runSpec = null } = {}) {
  const arena = { id: "santor-vault", gravity }, world = new PhysicsWorld(character, arena, runSpec);
  const campaign = new Campaign(new CampaignSave(null), { seedFactory: () => 42 });
  campaign.select(character.id); campaign.confirm(); campaign.startLevel("orientation-day"); campaign.confirm();
  const tournament = new Tournament(); tournament.state = State.ACTIVE;
  if (hard) Object.defineProperty(campaign, "level", { value: { ...campaign.level, bonus: true } });
  const controls = [], clocks = [], sequences = [], cues = [], lines = [];
  let syncEnd = null, paused = false, lastSequence = null;
  const game = Object.assign(Object.create(Game.prototype), {
    mode, campaign, tournament, world, syncSave, syncSequence: null, syncSerial: 0,
    recording: new ReplayRecording(world), lastTime: 0, accumulator: 0, suspended: false,
    introduction: { active: false }, biographyReader: { tick() {} },
    input: { consume() {
      const control = chapterControls(world, { id: "orientation-day" }, { target });
      if (fewerPushes && world.cart.position.x < world.skills.config.takeoff.armedX && world.skills.pushes.Perfect >= 4) control.pushes = 0;
      return control;
    } }, touch: { merge: v => v, sync() {} }, clearControls() {}, achievements: { send() {} },
    syncUI: { show(s) { sequences.push(s); clocks.push([world.elapsed, syncLandingETA(world)]); }, update() {}, hide() {} },
    presentation: { observe() {}, frame() {}, state() {}, effects: new Effects(),
      audio: { play(cue) { cues.push(cue); }, stopAll() {} }, music: { setDuck() {} } },
    renderer: { cosmetics: {}, resetCamera() {}, draw() {} },
    ui: { root: { dataset: {} }, render() {}, overlay: {}, hud: {}, observeAttempt() {}, update() {}, say(line) { lines.push(line); } },
    showAchievementsAfterAttempt() {}, startReplay() {},
  });
  if (disabled) game.startSync = () => false;
  const step = world.step.bind(world);
  world.step = control => { if (game.syncSequence) assert.deepEqual(control, { pushes: 0, rotate: 0, brace: false }); controls.push({ ...control }); step(control); };
  let time = 0;
  for (let frame = 0; frame < 2000 && !world.finished; frame++) {
    const seq = game.syncSequence;
    if (seq && interruption && !paused) {
      const clock = seq.time, pose = poses(world);
      game.frame(time += 2000); assert.equal(seq.time, clock); assert.deepEqual(poses(world), pose);
      game.suspended = true; game.frame(time += 100); game.hitSync(0);
      assert.equal(seq.time, clock); assert.deepEqual(poses(world), pose); assert.equal(seq.extra, 0);
      game.suspended = false; paused = true;
    }
    if (seq && grade !== "M") for (const n of seq.notes) {
      const offset = grade === "G" ? seq.perfectWindow + .025 : 0;
      if (!n.grade && Math.abs(seq.time - n.at - offset) < 1 / 120 + 1e-9) game.hitSync(n.lane);
    }
    lastSequence = game.syncSequence;
    game.frame(time += 1000 / 120);
    if (lastSequence && !game.syncSequence) syncEnd = world.elapsed;
  }
  assert.ok(world.finished && world.hasFiniteBodies());
  const score = scoreAttempt(world.metrics(), character); assertScore(score);
  // Replaying the exact controls through a normal-speed engine must be bit-identical.
  const baseline = new PhysicsWorld(character, arena, runSpec);
  for (const control of controls) baseline.step(control);
  assert.deepEqual(poses(world), poses(baseline), "slow motion and Sync rewards never alter physics");
  const ordinary = scoreAttempt(baseline.metrics(), character);
  assert.equal(score.distanceMetres, ordinary.distanceMetres); assert.equal(score.landingQuality, ordinary.landingQuality);
  assert.equal(score.stylePoints - ordinary.stylePoints, score.sync?.reward.points || 0);
  if (grade === "M") assert.equal(score.total, ordinary.total, "ignoring notes costs zero points");
  baseline.dispose();
  assert.equal(score.distancePoints, ordinary.distancePoints);
  assert.equal(score.landingPoints, ordinary.landingPoints);
  assert.equal(score.attachedPoints, ordinary.attachedPoints);
  const facts = attemptAchievementFacts(world, score, mode === "vault" ? campaign : null);
  const answer = { facts, score, sequences, clocks, syncEnd, landingTime: world.landingTime, cues, lines, pose: poses(world),
    pushes: world.skills.pushes, takeoff: world.skills.takeoff };
  world.dispose(); return answer;
}
check("Real Vault and Party flights: eligibility, once per jump, 20% physics, safe recovery, ignore or Perfect", () => {
  for (const mode of ["vault", "party"]) for (const character of CHARACTERS) {
    const ignored = fly(character, { mode, interruption: true });
    assert.equal(ignored.sequences.length, 1, mode + ":" + character.id + JSON.stringify(ignored.clocks));
    assert.ok(Math.abs((ignored.syncEnd - ignored.clocks[0][0]) - ignored.sequences[0].time * C.timeScale) <= STEP_MS / 1000 + 1e-9, "real-time notes run over 20% physics time");
    assert.ok(ignored.landingTime - ignored.syncEnd >= .8, JSON.stringify(ignored));
    assert.ok(["Clean", "Scrappy"].includes(ignored.score.landingQuality), character.id + " ignored: " + ignored.score.landingQuality);
    const perfect = fly(character, { mode, grade: "P" });
    assert.equal(perfect.score.sync.grade, "PERFECT SYNC");
    assert.deepEqual(perfect.pose, ignored.pose, "note accuracy cannot change the landing");
    assert.ok(perfect.facts.syncCompleted && perfect.facts.syncPerfect && perfect.facts.syncBoosted);
    assert.ok(ignored.facts.syncAllMiss && !ignored.facts.syncBoosted);
    assert.equal(fly(character, { gravity: 1.5 }).sequences.length, 0, "short flights keep controls throughout");
    assert.ok(perfect.lines.includes(C.lines["PERFECT SYNC"])); assert.ok(perfect.cues.includes("sync-drop"));
    assert.equal(fly(character, { mode, target: "Good" }).sequences.length, 0, "Good takeoff is ineligible");
    const fewer = fly(character, { mode, fewerPushes: true });
    assert.ok(fewer.pushes.Perfect < 5); assert.equal(fewer.sequences.length, 0);
    console.log(mode, character.id, ignored.sequences[0].notes.length, "notes; recovery", (ignored.landingTime - ignored.syncEnd).toFixed(3));
  }
});
check("Every authored condition preserves successful landings when notes are ignored", () => {
  let moments = 0;
  for (const character of CHARACTERS) for (const condition of ALL_CONDITION_IDS) {
    const options = { runSpec: { condition, seed: 42 } };
    const ordinary = fly(character, { ...options, disabled: true }), ignored = fly(character, options);
    if (!ignored.sequences.length) continue;
    moments++;
    assert.ok(ignored.landingTime - ignored.syncEnd >= .8, character.id + " " + condition + " recovery");
    if (["Clean", "Scrappy"].includes(ordinary.score.landingQuality))
      assert.ok(["Clean", "Scrappy"].includes(ignored.score.landingQuality), character.id + " " + condition + " must not introduce a crash");
  }
  assert.ok(moments >= 9); console.log("Condition flights with Sync:", moments);
});
check("Character pool never repeats across reloads; bigger air and harder levels lengthen patterns", () => {
  const st = storage(); let last = "";
  for (const character of CHARACTERS) for (let i = 0; i < 3; i++) {
    const result = fly(character, { syncSave: new SyncSave(st), gravity: .5 });
    assert.equal(result.sequences.length, 1); assert.equal(result.sequences[0].notes.length, 5);
    const pattern = result.sequences[0].notes.map(n => n.lane).join(""); assert.notEqual(pattern, last); last = pattern;
  }
  const easy = fly(CHARACTERS[0], { mode: "vault" }), hard = fly(CHARACTERS[0], { mode: "vault", hard: true });
  assert.ok(hard.sequences[0].notes.length > easy.sequences[0].notes.length);
});
check(
  "Six hooks unlock only once through normal events and preserve old records",
  () => {
    const st = storage(),
      a = new AchievementManager(st);
    a.send("attempt-ended", {
      characterId: "jake",
      valid: true,
      launched: true,
    });
    const old = a.data.records.airborne.unlockedAt;
    a.send("attempt-ended", {
      characterId: "brandon",
      valid: true,
      syncCompleted: true,
      syncPerfect: true,
      syncBoosted: true,
      rotations: 3,
      successfulLanding: true,
    });
    a.send("attempt-ended", {
      characterId: "owen",
      valid: true,
      syncCompleted: true,
      syncAllMiss: true,
      levelCompleted: true,
    });
    a.send("campaign-progress", {
      characterId: "jake",
      runComplete: true,
      syncOccurrences: 2,
    });
    const b = new AchievementManager(st);
    assert.equal(b.data.records.airborne.unlockedAt, old);
    for (const id of [
      "sync-first",
      "sync-perfect",
      "sync-land",
      "sync-three",
      "sync-miss-medal",
      "sync-twice",
    ])
      assert.equal(b.data.records[id].unlocked, true, id);
    const date = b.data.records["sync-perfect"].unlockedAt;
    b.send("attempt-ended", {
      characterId: "brandon",
      valid: true,
      syncPerfect: true,
    });
    assert.equal(b.data.records["sync-perfect"].unlockedAt, date);
    const c = new SyncSave(st);
    c.resetRun();
    assert.ok(
      JSON.parse(st.getItem(ACHIEVEMENT_SAVE_KEY)).records["sync-perfect"]
        .unlocked,
    );
  },
);
check("Real keyboard router consumes notes and requires release before normal rotation or brace", () => {
  globalThis.window = new EventTarget(); globalThis.document = new EventTarget(); document.hidden = false;
  const sequence = new SyncSequence("jake"), game = Object.assign(Object.create(Game.prototype), {
    mode: "party", syncSequence: sequence, suspended: false,
    presentation: { audio: { play() {} } }, syncUI: { update() {} },
  });
  let confirms = 0;
  const input = new Input({ isActive: () => true, onConfirm() { confirms++; }, onRestart() {}, onSuspend() {},
    onExclusiveKey: event => game.exclusiveKey(event) });
  const key = (code, type = "keydown", repeat = false) => {
    const event = new Event(type, { cancelable: true }); Object.assign(event, { code, repeat }); window.dispatchEvent(event);
  };
  advance(sequence, sequence.notes[0].at);
  key("ArrowLeft"); key("ArrowLeft", "keydown", true); key("ArrowLeft"); key("Enter"); key("ArrowDown");
  assert.equal(sequence.notes[0].grade, "Perfect"); assert.equal(confirms, 0);
  assert.deepEqual(input.consume(), { pushes: 0, rotate: 0, brace: false });
  input.clear(); game.syncSequence = null;
  key("ArrowLeft", "keydown", true); key("ArrowDown", "keydown", true);
  assert.deepEqual(input.consume(), { pushes: 0, rotate: 0, brace: false });
  key("ArrowLeft", "keyup"); key("ArrowDown", "keyup"); key("ArrowLeft"); key("ArrowDown");
  assert.deepEqual(input.consume(), { pushes: 0, rotate: -1, brace: true });
  input.destroy();
});
console.log(`${groups} Sync Moments groups passed.`);
