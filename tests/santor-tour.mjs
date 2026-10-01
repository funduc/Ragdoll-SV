import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { CHARACTERS } from "../js/characters.js";
import { TOUR_LEVELS, applause, crowdCue, tourFacts } from "../js/santor-tour.js";
import { Campaign, CampaignState as S, campaignFacts } from "../js/campaign.js";
import { CampaignSave, CAMPAIGN_SAVE_KEY } from "../js/campaign-save.js";
import { evaluateMedal } from "../js/campaign-levels.js";
import { renderCampaign } from "../js/campaign-ui.js";
import { PhysicsWorld } from "../js/physics.js";
import { scoreAttempt } from "../js/scoring.js";
import { driveChapter, chapterControls } from "./chapter-helpers.mjs";
import { Renderer } from "../js/renderer.js";
import { ReplayRecording } from "../js/replay.js";
import { Effects } from "../js/effects.js";
import { UI } from "../js/ui.js";
import { SynthAudio } from "../js/audio.js";
import { Presentation } from "../js/presentation.js";
import { audioDouble } from "./fake-audio.mjs";

runInThisContext(readFileSync(new URL("../vendor/matter-0.20.0.min.js", import.meta.url), "utf8"));
const [freezer, mic] = TOUR_LEVELS;
const makeWorld = (level, character = CHARACTERS[0]) => new PhysicsWorld(character,
  level.arena, { condition: level.condition, upgrades: {}, objective: level.optionalObjective });
const score = (world) => scoreAttempt(world.metrics(), world.character);
const node = () => ({ dataset: {}, textContent: "", innerHTML: "", classList: { add() {} }, querySelector() { return null; } });
const nodes = new Map();
globalThis.document = { getElementById(id) {
  if (!nodes.has(id)) nodes.set(id, node());
  return nodes.get(id);
} };
const ui = Object.fromEntries(["root", "eventLabel", "roundLabel", "standings", "overlay", "hudName", "passiveStatus"].map((key) => [key, node()]));
ui.say = ui.caption = () => {};
let groups = 0;
const test = (name, fn) => { fn(); groups++; console.log(`PASS ${name}`); };

test("Old saves unlock the Tour per character; its own map row links both briefings", () => {
  const entries = new Map([[CAMPAIGN_SAVE_KEY, JSON.stringify({ version: 1,
    selectedCharacter: "jake", progress: { jake: { "the-santor-gauntlet": { medal: 1, santor: false } } } })]]);
  const storage = { getItem: (k) => entries.get(k) ?? null, setItem: (k, v) => entries.set(k, v) };
  const run = new Campaign(new CampaignSave(storage), { seedFactory: () => 42 });
  run.select("jake"); run.confirm();
  assert.ok(run.isUnlocked(freezer)); assert.ok(!run.isUnlocked(mic));
  renderCampaign(ui, run);
  assert.match(ui.overlay.innerHTML, /aria-label="Santor on Tour"/);
  assert.match(ui.overlay.innerHTML, /data-value="freezer-aisle"[^>]*>.*FREEZER AISLE/);
  assert.match(ui.overlay.innerHTML, /data-value="open-mic"[^>]* disabled/);
  assert.ok(run.startLevel(freezer.id)); assert.equal(run.state, S.READY);
  renderCampaign(ui, run);
  assert.match(ui.overlay.innerHTML, /gaps are pits/);
  assert.match(ui.overlay.innerHTML, /icy-ramp/);
  run.confirm();
  const w = driveChapter(makeWorld(freezer), freezer);
  run.record(score(w), w); w.dispose();
  assert.ok(run.isUnlocked(mic)); assert.equal(run.runs.run.pendingLevel, null);
  run.confirm(); assert.ok(run.startLevel(mic.id));
  renderCampaign(ui, run);
  assert.match(ui.overlay.innerHTML, /vary your tricks to build applause/);
  assert.match(ui.overlay.innerHTML, /Jake&#39;s comedy tour|Jake's comedy tour/);
  const reloaded = new CampaignSave(storage);
  assert.equal(reloaded.entry("jake", "the-santor-gauntlet").medal, 1);
  assert.equal(reloaded.entry("jake", freezer.id).medal, 3);
  assert.equal(reloaded.entry("brandon", freezer.id).medal, 0);
  run.backToMap(); run.changeCharacter(); run.select("brandon"); run.confirm();
  assert.ok(!run.isUnlocked(freezer) && !run.isUnlocked(mic));
});

test("All three characters earn each Tour Santor medal with normal discrete controls and no upgrades", () => {
  for (const c of CHARACTERS) for (const level of TOUR_LEVELS) {
    const w = driveChapter(makeWorld(level, c), level, { flip: level === mic });
    const facts = campaignFacts(score(w), w, true), result = evaluateMedal(level, facts);
    assert.deepEqual(result, { medal: 3, santor: true }, `${c.id}/${level.id}: ${JSON.stringify(facts)}`);
    if (level === freezer) {
      assert.equal(w.firstLandingPiece.label, "freezer-5");
      assert.equal(evaluateMedal(level, { ...facts, perfectBrace: false }).santor, false);
      assert.equal(evaluateMedal(level, { ...facts, farthestFreezerLanding: false }).santor, false);
      assert.equal(evaluateMedal(level, { ...facts, controlledLanding: false }).medal, 2);
      assert.equal(evaluateMedal(level, { ...facts, freezerLidLanding: false, farthestFreezerLanding: false }).medal, 1);
    } else {
      assert.equal(w.obstacleHits.size, 0);
      assert.equal(evaluateMedal(level, { ...facts, micUntouched: false }).santor, false);
      assert.equal(evaluateMedal(level, { ...facts, uniqueTricks: 2 }).medal, 2);
      assert.equal(evaluateMedal(level, { ...facts, uniqueTricks: 1 }).medal, 1);
      assert.equal(evaluateMedal(level, { ...facts, controlledLanding: false, successfulLanding: false }).medal, 2);
    }
    w.dispose();
  }
});

// Fixtures below place real bodies at individual hazards, then let Matter resolve
// them. Reachability above and in first-campaign always starts at the real run-up.
function drop(w, x, bottom) {
  const delta = { x: x - w.cart.position.x, y: bottom - Math.max(...w.dynamic.map((b) => b.bounds.max.y)) };
  for (const b of w.dynamic) Matter.Body.translate(b, delta);
  w.launched = true;
}
test("Each freezer lid records its own top contact; gaps have no ground and cause pit crashes", () => {
  for (let i = 1; i <= 5; i++) {
    const w = makeWorld(freezer);
    drop(w, w.course.pieces.find((p) => p.label === `freezer-${i}`).x, 390);
    for (let step = 0; step < 300 && !w.landed; step++) w.step();
    assert.equal(w.firstLandingPiece?.label, `freezer-${i}`);
    assert.equal(tourFacts(w).freezerLidLanding, true);
    assert.equal(tourFacts(w).farthestFreezerLanding, i === 5);
    w.dispose();
  }
  for (const gap of [1750, 2290, 2830, 3370]) {
    const w = makeWorld(freezer);
    assert.equal(Matter.Query.point(w.groundBodies, { x: gap, y: 530 }).length, 0);
    drop(w, gap, 430);
    for (let step = 0; step < 1500 && !w.finished; step++) w.step();
    assert.ok(w.finished && w.crashed);
    assert.equal(w.crashClassification, "pit-fall");
    assert.equal(score(w).landingPoints, 0);
    w.dispose();
  }
});

test("Actual mic contacts latch for any cart/rider part, and head/torso contacts crash", () => {
  for (const part of ["head", "torso", "cart", "wheel"]) {
    const w = makeWorld(mic), b = part === "wheel" ? w.wheels[0] : w[part];
    const delta = { x: 2350 - b.position.x, y: 100 - b.position.y };
    for (const body of w.dynamic) Matter.Body.translate(body, delta);
    w.launched = true; w.step();
    assert.ok(w.obstacleHits.size > 0, part);
    assert.equal(tourFacts(w).micUntouched, false);
    if (["head", "torso"].includes(part)) assert.equal(w.crashClassification, "obstacle-impact");
    for (const body of w.dynamic) Matter.Body.translate(body, { x: 600, y: -200 });
    w.step(); assert.equal(tourFacts(w).micUntouched, false);
    w.dispose();
  }
});

test("Applause tracks recognized unique tricks, drops on a crash and resets on a fresh attempt", () => {
  const hud = Object.create(UI.prototype);
  Object.assign(hud, { skillMeter: { update() {} }, campaignSession: null });
  for (const key of ["passiveStatus", "hudPhase", "hudDistanceLabel", "hudDistance", "hudRotationLabel", "hudRotation", "hudTime", "hint"]) hud[key] = node();
  const w = makeWorld(mic), seen = new Set();
  for (let frame = 0; frame < 1250 && !w.finished; frame++) {
    const controls = chapterControls(w, mic, { flip: true });
    w.step(controls); w.step({ ...controls, pushes: 0, brace: false });
    hud.update(w);
    const unique = w.tricks.unique.size;
    seen.add(unique);
    assert.match(hud.hudRotation.innerHTML, new RegExp(`value="${applause(unique, false)}"`));
  }
  assert.deepEqual([...seen], [0, 1, 2, 3]);
  assert.equal(applause(3, false), 75); assert.equal(applause(3, true), 18);
  w.crash(); hud.update(w); assert.match(hud.hudRotation.innerHTML, /value="18"/);
  const fresh = makeWorld(mic); hud.update(fresh);
  assert.match(hud.hudRotation.innerHTML, /value="0"/);
  const ordinary = new PhysicsWorld(CHARACTERS[0]); hud.update(ordinary);
  assert.equal(hud.hudRotationLabel.textContent, "AIR ROTATION");
  w.dispose(); fresh.dispose(); ordinary.dispose();
});

test("Tour art replays identical Canvas commands; reduced motion freezes audience and removes fog", () => {
  globalThis.window = { devicePixelRatio: 1 };
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  const motion = { matches: false }; globalThis.matchMedia = () => motion;
  for (const level of TOUR_LEVELS) for (const width of [1200, 390]) {
    const calls = [], ctx = new Proxy({}, {
      get: (_, key) => (...args) => calls.push([key, ...args]),
      set: (_, key, value) => { calls.push([key, value]); return true; },
    });
    const canvas = { getContext: () => ctx, getBoundingClientRect: () => ({ width, height: 560 }) };
    const w = makeWorld(level), r = new Renderer(canvas), effects = new Effects();
    driveChapter(w, level, { flip: level === mic });
    const recording = new ReplayRecording(w); recording.capture(w, effects, {});
    const draw = (world) => { calls.length = 0; r.resetCamera(); r.draw(world); return JSON.stringify(calls); };
    const live = draw(w);
    assert.equal(draw(recording.frames[0].world), live);
    motion.matches = true;
    const still = draw(w); w.elapsed += 1;
    assert.equal(draw(w), still);
    motion.matches = false;
    assert.notEqual(draw(w), live);
    r.destroy(); w.dispose();
  }
});

test("Crowd cues and freezer hum respect gesture, pause, mute, voice bounds and disposal", () => {
  let now = 0;
  const env = new EventTarget(), Context = audioDouble(() => now);
  env.AudioContext = Context; env.localStorage = { getItem: () => null, setItem() {} };
  const audio = new SynthAudio(null, env), w = makeWorld(freezer);
  audio.rattle(w, true); assert.equal(Context.instances.length, 0);
  env.dispatchEvent(new Event("pointerdown"));
  const ctx = Context.instances[0]; audio.resetAttempt();
  for (let i = 0; i < 120; i++) {
    now = w.elapsed = i / 4; ctx.tick(now); audio.rattle(w, true);
    assert.ok(audio.voices.size <= 4);
  }
  assert.ok(ctx.createdSources > 20);
  audio.setPaused(true); assert.equal(audio.voices.size, 0);
  audio.play("boo"); assert.equal(audio.voices.size, 0);
  audio.setPaused(false); audio.play("boo"); assert.equal(audio.voices.size, 4);
  audio.toggle(); assert.equal(audio.voices.size, 0);
  const cues = [], p = Object.create(Presentation.prototype);
  Object.assign(p, { root: node(), music: { setTrack() {} }, musicDirector: { scene() {} }, audio: { play: (cue) => cues.push(cue) } });
  p.state({ state: S.RESULTS, level: mic, lastScore: { crashed: true } });
  p.state({ state: S.RESULTS, level: mic, lastScore: { crashed: true } });
  p.state({ state: S.ACTIVE });
  p.state({ state: S.RESULTS, level: mic, lastScore: { crashed: false, landingQuality: "Clean" } });
  assert.deepEqual(cues, ["boo", "crowd"]);
  assert.equal(crowdCue({ crashed: false, landingQuality: "No landing" }), "boo");
  audio.destroy(); assert.equal(ctx.connected.size, 0); w.dispose();
});

console.log(`${groups} Santor on Tour groups passed.`);
