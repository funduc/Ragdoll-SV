import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { CHARACTERS } from "../js/characters.js";
import { TOUR_LEVELS, applause, crowdCue, tourFacts, QUIET_IMPACT_LIMIT, ROAD_POEM, roadVerse } from "../js/santor-tour.js";
import { Campaign, CampaignState as S, campaignFacts, combinedFacts } from "../js/campaign.js";
import { attemptAchievementFacts } from "../js/achievement-events.js";
import { AchievementManager } from "../js/achievements.js";
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
const [freezer, mic, night, library, factory, warehouse, rooftop, finale] = TOUR_LEVELS;
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
  for (const c of CHARACTERS) for (const level of [freezer, mic]) {
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
  for (const key of ["syncStatus", "passiveStatus", "hudPhase", "hudDistanceLabel", "hudDistance", "hudRotationLabel", "hudRotation", "hudTime", "hint"]) hud[key] = node();
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
  ordinary.syncReady = true; hud.update(ordinary);
  assert.equal(hud.syncStatus.textContent, "SYNC READY"); assert.equal(hud.syncStatus.hidden, false);
  ordinary.syncReady = false; ordinary.syncMissedAt = ordinary.elapsed; hud.update(ordinary);
  assert.equal(hud.syncStatus.textContent, "SYNC MISSED: NOT ENOUGH AIR");
  ordinary.elapsed += 2; hud.update(ordinary); assert.equal(hud.syncStatus.hidden, true);
  ordinary.syncReady = true; ordinary.syncMissedAt = undefined; ordinary.syncTriggered = true;
  hud.update(ordinary); assert.equal(hud.syncStatus.hidden, true);
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
    if (![library, warehouse].includes(level)) assert.notEqual(draw(w), live);
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
  audio.play("shush"); assert.equal(audio.voices.size, 0);
  audio.toggle(); audio.resetAttempt(); audio.play("shush"); assert.equal(audio.voices.size, 1);
  audio.setPaused(true); assert.equal(audio.voices.size, 0);
  audio.play("shush"); assert.equal(audio.voices.size, 0);
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

test("Tour stops 3 and 4 unlock sequentially in existing per-character saves and open from the map", () => {
  const data = new Map([[CAMPAIGN_SAVE_KEY, JSON.stringify({ version: 1, selectedCharacter: "jake",
    progress: { jake: { "freezer-aisle": { medal: 3 }, "open-mic": { medal: 1 } } } })]]);
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const run = new Campaign(new CampaignSave(storage), { seedFactory: () => 42 });
  run.select("jake"); run.confirm();
  assert.ok(run.isUnlocked(night)); assert.ok(!run.isUnlocked(library));
  for (const level of [night, library]) {
    renderCampaign(ui, run);
    assert.match(ui.overlay.innerHTML, new RegExp(`data-value="${level.id}"(?![^>]*disabled)`));
    assert.ok(run.startLevel(level.id)); assert.equal(run.state, S.READY);
    renderCampaign(ui, run); assert.ok(ui.overlay.innerHTML.includes(level.john.introduction));
    run.confirm();
    const w = driveChapter(makeWorld(level), level, { target: level === library ? "Good" : "Perfect" });
    run.record(score(w), w); renderCampaign(ui, run);
    assert.match(ui.overlay.innerHTML, level === night ? /The road concedes/ : /NOISE · quiet.*0 BOOKS/);
    run.confirm(); assert.equal(run.state, S.MAP); w.dispose();
  }
  const restored = new CampaignSave(storage);
  for (const level of [night, library]) {
    assert.equal(restored.entry("jake", level.id).medal, 3);
    assert.equal(restored.entry("brandon", level.id).medal, 0);
  }
  assert.equal(restored.entry("jake", "open-mic").medal, 1);
});

test("Night Shift and Quiet Please reach Santor for all three characters without upgrades", () => {
  for (const level of [night, library]) for (const c of CHARACTERS) {
    const w = driveChapter(makeWorld(level, c), level, { target: level === library ? "Good" : "Perfect" });
    const facts = campaignFacts(score(w), w, true);
    assert.deepEqual(evaluateMedal(level, facts), { medal: 3, santor: true }, `${level.id}/${c.id}: ${JSON.stringify(facts)}`);
    if (level === night) {
      assert.equal(evaluateMedal(level, { ...facts, perfectTakeoff: false }).santor, false);
      assert.equal(evaluateMedal(level, { ...facts, controlledLanding: false }).santor, false);
      assert.equal(evaluateMedal(level, { ...facts, noMiss: false }).medal, 2);
      assert.equal(evaluateMedal(level, { ...facts, betweenPotholes: false }).medal, 2);
      assert.equal(evaluateMedal(level, { ...facts, avoidedPotholes: false }).medal, 1);
    } else {
      assert.ok(facts.impactLoudness <= QUIET_IMPACT_LIMIT);
      assert.equal(evaluateMedal(level, { ...facts, quietImpact: false }).medal, 2);
      assert.equal(evaluateMedal(level, { ...facts, controlledLanding: false }).medal, 2);
      assert.equal(evaluateMedal(level, { ...facts, pastBookStack: false }).medal, 1);
      assert.deepEqual(evaluateMedal(level, { ...facts, propsFallen: 1 }), { medal: 3, santor: false });
      assert.equal(evaluateMedal(level, { ...facts, uniqueTricks: 0 }).santor, false);
    }
    w.dispose();
  }
});

test("Every road bump reveals its verse; every pothole is a real crash opening", () => {
  const w = makeWorld(night), verses = new Set();
  const hud = Object.create(UI.prototype);
  const lines = [];
  Object.assign(hud, { trickDisplay: { observe() {}, reset() {} }, commentator: { enqueue() {}, tick() { return "John"; } },
    announced: new Set(), roadVerse: -1, say: (line) => lines.push(line) });
  for (let frame = 0; frame < 1250 && !w.finished; frame++) {
    const input = chapterControls(w, night); w.step(input); w.step({ ...input, pushes: 0, brace: false });
    const verse = roadVerse(w); if (verse >= 0) verses.add(verse);
    hud.observeAttempt(w, { round: "qualifying" });
  }
  assert.deepEqual([...verses], [0, 1, 2]);
  for (const line of ROAD_POEM.slice(0, 3)) assert.equal(lines.filter((s) => s === `BRANDON: ${line}`).length, 1);
  w.dispose();
  hud.resetAttempt = UI.prototype.resetAttempt;
  hud.commentator.resetAttempt = () => {}; hud.resetAttempt(); assert.equal(hud.roadVerse, -1);
  for (const pit of w.course.pieces.filter((p) => p.type === "pit")) {
    const hazard = makeWorld(night);
    assert.equal(Matter.Query.point(hazard.groundBodies, { x: pit.x, y: 530 }).length, 0);
    drop(hazard, pit.x, 480);
    for (let frame = 0; frame < 1500 && !hazard.finished; frame++) hazard.step();
    assert.equal(hazard.crashClassification, "pit-fall"); assert.equal(score(hazard).landingPoints, 0);
    assert.equal(tourFacts(hazard).avoidedPotholes, false); hazard.dispose();
  }
});

test("Book kicker and loose books collide; clearing them leaves all books standing", () => {
  const w = makeWorld(library);
  // Drive the real cart into the stack sideways; no prop count is fabricated.
  drop(w, 2650, 445);
  for (const body of w.dynamic) Matter.Body.setVelocity(body, { x: 9, y: 0 });
  for (let step = 0; step < 700 && !w.finished; step++) w.step();
  assert.ok(w.propFacts().propsFallen > 0);
  w.dispose();
  const kicker = makeWorld(library); drop(kicker, 2510, 475);
  for (let step = 0; step < 300 && !kicker.landed; step++) kicker.step();
  assert.equal(kicker.firstLandingPiece?.label, "book-kicker");
  assert.equal(tourFacts(kicker).pastBookStack, false); kicker.dispose();
});

test("Measured library noise costs Gold on a hard landing, updates HUD, and shushes once per attempt", () => {
  const hud = Object.create(UI.prototype);
  Object.assign(hud, { skillMeter: { update() {} }, campaignSession: null });
  for (const key of ["syncStatus", "passiveStatus", "hudPhase", "hudDistanceLabel", "hudDistance", "hudRotationLabel", "hudRotation", "hudTime", "hint"]) hud[key] = node();
  const w = makeWorld(library), cues = [], p = Object.create(Presentation.prototype);
  Object.assign(p, { effects: new Effects(), audio: { resetAttempt() {}, play: (cue) => cues.push(cue) } });
  hud.update(w); assert.match(hud.hudRotation.innerHTML, /AWAITING LANDING/);
  for (let frame = 0; frame < 1250 && !w.finished; frame++) {
    const input = chapterControls(w, library); w.step(input); w.step({ ...input, pushes: 0, brace: false });
    p.observe(w); hud.update(w);
  }
  assert.match(hud.hudRotation.innerHTML, /SHHH! TOO LOUD/);
  assert.equal(cues.filter((cue) => cue === "shush").length, 1);
  assert.equal(evaluateMedal(library, campaignFacts(score(w), w, true)).medal, 2);
  const fresh = makeWorld(library); p.observe(fresh); hud.update(fresh);
  assert.equal(p.shushed, false); assert.match(hud.hudRotation.innerHTML, /AWAITING LANDING/);
  fresh.dispose(); w.dispose();
});

test("Factory and warehouse unlock after Quiet Please and preserve old per-character saves", () => {
  const data = new Map([[CAMPAIGN_SAVE_KEY, JSON.stringify({ version: 1, selectedCharacter: "owen",
    progress: { owen: { "quiet-please": { medal: 1 } } } })]]);
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const run = new Campaign(new CampaignSave(storage), { seedFactory: () => 42 });
  run.select("owen"); run.confirm();
  assert.ok(run.isUnlocked(factory)); assert.ok(!run.isUnlocked(warehouse));
  for (const level of [factory, warehouse]) {
    renderCampaign(ui, run);
    assert.match(ui.overlay.innerHTML, new RegExp(`data-value="${level.id}"(?![^>]*disabled)`));
    assert.ok(run.startLevel(level.id)); assert.equal(run.state, S.READY);
    renderCampaign(ui, run); assert.ok(ui.overlay.innerHTML.includes(level.john.introduction));
    run.confirm();
    const w = driveChapter(new PhysicsWorld(run.current, run.attemptArena, run.attemptSpec), level);
    run.record(score(w), w); renderCampaign(ui, run);
    assert.match(ui.overlay.innerHTML, level === factory ? /STAYED ABOARD/ : /BOXES KNOCKED DOWN.*I ordered these/);
    assert.deepEqual({ medal: run.lastMedal.medal, santor: run.lastMedal.santor }, { medal: 3, santor: true });
    run.confirm(); assert.equal(run.state, S.MAP); w.dispose();
  }
  const saved = new CampaignSave(storage);
  assert.equal(saved.entry("owen", "quiet-please").medal, 1);
  for (const level of [factory, warehouse]) {
    assert.equal(saved.entry("owen", level.id).medal, 3);
    assert.equal(saved.entry("jake", level.id).medal, 0);
  }
});

test("Both new stops reach Santor for all characters through real controls, with exact medal gates", () => {
  for (const level of [factory, warehouse]) for (const c of CHARACTERS) {
    const w = driveChapter(makeWorld(level, c), level);
    const f = campaignFacts(score(w), w, true);
    assert.deepEqual(evaluateMedal(level, f), { medal: 3, santor: true }, `${level.id}/${c.id}: ${JSON.stringify(f)}`);
    if (level === factory) {
      assert.equal(w.runEffects.conditionId, "wrate-issue");
      assert.ok(w.elapsed - w.landingTime >= 4.75);
      assert.ok(w.course.distanceOrigin + w.distancePixels - w.cart.position.x > 300);
      assert.equal(evaluateMedal(level, { ...f, stayedOnConveyor: false }).medal, 2);
      assert.equal(evaluateMedal(level, { ...f, controlledLanding: false }).medal, 2);
      assert.equal(evaluateMedal(level, { ...f, conveyorLanding: false, stayedOnConveyor: false }).medal, 1);
      assert.equal(evaluateMedal(level, { ...f, perfectBrace: false }).santor, false);
      assert.equal(evaluateMedal(level, { ...f, tourDistance: 59.99 }).santor, false);
      assert.equal(evaluateMedal(level, { ...f, tourDistance: 60 }).santor, true);
    } else {
      assert.equal(w.looseProps.length, 36); assert.ok(f.propsFallen >= 30 && f.propsFallen <= 36);
      assert.equal(evaluateMedal(level, { ...f, propsFallen: 9 }).medal, 1);
      assert.equal(evaluateMedal(level, { ...f, propsFallen: 10 }).medal, 2);
      assert.equal(evaluateMedal(level, { ...f, propsFallen: 19 }).medal, 2);
      assert.deepEqual(evaluateMedal(level, { ...f, propsFallen: 20 }), { medal: 3, santor: false });
      assert.equal(evaluateMedal(level, { ...f, propsFallen: 29 }).santor, false);
      assert.equal(evaluateMedal(level, { ...f, riderAttached: false }).medal, 2);
      assert.equal(evaluateMedal(level, { ...f, controlledLanding: false }).santor, false);
    }
    w.dispose();
  }
});

test("Factory belt leaves airborne motion alone, preserves first contact, and dumps short landings into its pit", () => {
  const w = makeWorld(factory), control = new PhysicsWorld(CHARACTERS[0], {
    ...factory.arena, course: { ...w.course, pieces: w.course.pieces.map(p => p.type === "conveyor" ? { ...p, speed: 0 } : p) },
  }, { condition: factory.condition, upgrades: {}, objective: factory.optionalObjective });
  for (let frame = 0; frame < 1250 && !w.landed; frame++) {
    const input = chapterControls(w, factory);
    for (const v of [w, control]) { v.step(input); v.step({ ...input, pushes: 0, brace: false }); }
    if (!w.landed) assert.deepEqual(w.cart.position, control.cart.position);
  }
  const contact = [w.distancePixels, w.landingTime, w.impactLoudness];
  driveChapter(w, factory); assert.equal(w.reason, "Landing settled");
  assert.deepEqual([w.distancePixels, w.landingTime, w.impactLoudness], contact);
  w.dispose(); control.dispose();
  const short = makeWorld(factory); drop(short, 2670, 480);
  for (let frame = 0; frame < 1500 && !short.finished; frame++) short.step();
  assert.equal(short.firstLandingPiece?.label, "factory-belt");
  assert.equal(short.crashClassification, "pit-fall"); assert.equal(short.leftConveyor, true);
  assert.equal(tourFacts(short).stayedOnConveyor, false);
  assert.equal(evaluateMedal(factory, campaignFacts(score(short), short, true)).medal, 2);
  short.dispose();
});

test("Warehouse boxes stay standing before contact, show a live count and Owen's line once, and add only crash carnage", () => {
  const w = makeWorld(warehouse), hud = Object.create(UI.prototype), lines = [];
  Object.assign(hud, { skillMeter: { update() {} }, campaignSession: null,
    trickDisplay: { observe() {}, reset() {} }, commentator: { enqueue() {}, tick() { return "John"; }, resetAttempt() {} },
    say: line => lines.push(line) });
  for (const key of ["syncStatus", "passiveStatus", "hudPhase", "hudDistanceLabel", "hudDistance", "hudRotationLabel", "hudRotation", "hudTime", "hint"]) hud[key] = node();
  hud.resetAttempt();
  for (let frame = 0; frame < 1250 && !w.finished; frame++) {
    const input = chapterControls(w, warehouse); w.step(input); w.step({ ...input, pushes: 0, brace: false });
    if (w.cart.position.x < 3200) assert.equal(w.propFacts().propsFallen, 0);
    hud.observeAttempt(w, { round: "qualifying" }); hud.update(w);
    assert.match(hud.hudRotation.innerHTML, new RegExp(`^${w.propFacts().propsFallen} <small>/ 36`));
  }
  assert.equal(lines.filter(line => line === "OWEN: I ordered these.").length, 1);
  // A crash fixture reuses the real, latched fallen-box measurements. Its
  // ordinary score must be identical with and without the optional prop bonus.
  w.crashed = true;
  const withBoxes = score(w), summary = w.damage.summary();
  assert.equal(summary.propPoints, w.propFacts().propsFallen * 25);
  const base = summary.partsLost * 150 + summary.airtime * 100 + summary.bounces * 75 + summary.distance * 10;
  assert.equal(summary.total, Math.round(base + summary.propPoints));
  for (const box of w.looseProps) box.fallen = false;
  const withoutBoxes = score(w);
  assert.equal(withBoxes.total, withoutBoxes.total);
  assert.equal(w.damage.summary().propPoints, 0);
  const fresh = makeWorld(warehouse); hud.resetAttempt(); hud.update(fresh);
  assert.match(hud.hudRotation.innerHTML, /^0 <small>\/ 36/);
  assert.equal(hud.announced.has("ordered-boxes"), false);
  fresh.dispose(); w.dispose();
});

test("Rooftop cargo uses real physics: all characters deliver it, flips spill it, missing either roof edge is Bronze only", () => {
  for (const c of CHARACTERS) {
    const w = driveChapter(makeWorld(rooftop, c), rooftop);
    const facts = campaignFacts(score(w), w, true);
    assert.deepEqual(evaluateMedal(rooftop, facts), { medal: 3, santor: true });
    assert.equal(w.firstLandingPiece.label, "far-roof");
    assert.equal(evaluateMedal(rooftop, { ...facts, cargoRetained: false }).medal, 2);
    assert.equal(evaluateMedal(rooftop, { ...facts, controlledLanding: false }).medal, 2);
    assert.equal(evaluateMedal(rooftop, { ...facts, uniqueTricks: 0 }).santor, false);
    w.dispose();
    const spill = driveChapter(makeWorld(rooftop, c), rooftop, { flip: true });
    assert.equal(spill.cargoLost, true);
    assert.equal(evaluateMedal(rooftop, campaignFacts(score(spill), spill, true)).medal, 2);
    spill.dispose();
  }
  for (const x of [2200, 6200]) {
    const w = makeWorld(rooftop), recording = new ReplayRecording(w), effects = new Effects();
    assert.equal(Matter.Query.point(w.groundBodies, { x, y: 530 }).length, 0);
    drop(w, x, 430);
    for (let i = 0; i < 1500 && !w.finished; i++) { w.step(); recording.capture(w, effects, {}); }
    const s = score(w), f = campaignFacts(s, w, true);
    assert.ok(w.finished && !w.landed && w.crashed);
    assert.equal(w.crashClassification, "pit-fall"); assert.equal(s.landingPoints, 0);
    assert.deepEqual(evaluateMedal(rooftop, f), { medal: 1, santor: false });
    assert.equal(evaluateMedal(freezer, f).medal, 0); // No global completed-jump exception.
    assert.ok(recording.shouldAutoPlay(s, false)); assert.ok(!recording.shouldAutoPlay(s, true));
    w.dispose();
  }
  const idle = makeWorld(rooftop);
  assert.equal(tourFacts(idle).rooftopJump, false); idle.dispose();
});

test("Ribbon requires a real landed cart, latches once, resets per attempt and is copied into replay without changing points", () => {
  const w = makeWorld(finale), r = w.course.ribbon;
  drop(w, r.x, 300);
  w.updateCoursePieces(); assert.equal(w.ribbonCut, false);
  for (let i = 0; i < 1000 && !w.ribbonCut; i++) w.step();
  assert.ok(w.landed && w.ribbonCut);
  assert.equal(w.drainEvents().filter((e) => e === "ribbon-cut").length, 1);
  for (let i = 0; i < 120 && !w.finished; i++) w.step();
  assert.equal(w.drainEvents().filter((e) => e === "ribbon-cut").length, 0);
  const replay = new ReplayRecording(w); replay.capture(w, new Effects(), {});
  const total = score(w).total; w.ribbonCut = false;
  assert.equal(score(w).total, total); assert.equal(replay.frames[0].world.ribbonCut, true);
  const outside = makeWorld(finale); drop(outside, 5200, 430);
  for (let i = 0; i < 300 && !outside.landed; i++) outside.step();
  assert.ok(outside.landed); assert.equal(outside.ribbonCut, false);
  const fresh = makeWorld(finale); assert.equal(fresh.ribbonCut, false);
  fresh.dispose(); outside.dispose(); w.dispose();
});

test("Finale medal calibration uses all three actual courses, conditions and characters, with no score adjustments", () => {
  for (const c of CHARACTERS) for (const flip of [false, true]) {
    const heats = finale.stages.map((stage) => {
      const w = driveChapter(new PhysicsWorld(c, stage.arena, { condition: stage.condition, upgrades: {}, objective: stage.optionalObjective }), finale, { flip });
      const s = score(w), facts = campaignFacts(s, w, true);
      assert.equal(w.course.id, stage.arena.course); assert.equal(w.runEffects.conditionId, stage.condition);
      w.dispose(); return { score: s, facts };
    });
    const f = combinedFacts(heats), medal = evaluateMedal(finale, f);
    assert.equal(f.completedJumps, 3); assert.equal(f.controlledLandings, 3);
    assert.equal(f.ribbonCut, true);
    assert.equal(medal.medal, flip ? 3 : 2); assert.equal(medal.santor, flip);
    assert.equal(evaluateMedal(finale, combinedFacts(heats.slice(0, 2))).medal, 0);
    if (flip) {
      assert.equal(evaluateMedal(finale, { ...f, ribbonCut: false }).medal, 2);
      assert.equal(evaluateMedal(finale, { ...f, successfulLandings: 2 }).medal, 2);
      assert.equal(evaluateMedal(finale, { ...f, controlledLandings: 2 }).santor, false);
      assert.equal(evaluateMedal(finale, { ...f, combinedScore: 3499 }).medal, 2);
      assert.equal(evaluateMedal(finale, { ...f, combinedScore: 4299 }).santor, false);
    }
    assert.equal(evaluateMedal(finale, { ...f, combinedScore: 1199 }).medal, 0);
  }
});

test("All eight stops play from the map to the podium and save Tour Complete only after the third heat", () => {
  const data = new Map([[CAMPAIGN_SAVE_KEY, JSON.stringify({ version: 1, selectedCharacter: "jake",
    progress: { jake: { "the-santor-gauntlet": { medal: 1 } } } })]]);
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  const run = new Campaign(new CampaignSave(storage), { seedFactory: () => 42 });
  run.select("jake"); run.confirm();
  for (const level of TOUR_LEVELS) {
    renderCampaign(ui, run);
    assert.match(ui.overlay.innerHTML, new RegExp(`data-value="${level.id}"(?![^>]*disabled)`));
    assert.ok(run.startLevel(level.id)); run.confirm();
    do {
      const w = driveChapter(new PhysicsWorld(run.current, run.attemptArena, run.attemptSpec), level);
      const s = score(w); run.record(s, w);
      run.runs.manager.send("attempt-ended", attemptAchievementFacts(w, s, run));
      renderCampaign(ui, run);
      if (level === finale && run.levelFinished) {
        assert.match(ui.overlay.innerHTML, /aria-label="Tour ending"/);
        for (const c of CHARACTERS) assert.ok(ui.overlay.innerHTML.includes(`${c.name} portrait`));
        assert.match(ui.overlay.innerHTML, /The mug gets the rest of the night off/);
        assert.equal(run.runs.manager.data.records["tour-complete"].unlocked, true);
      } else {
        assert.doesNotMatch(ui.overlay.innerHTML, /aria-label="Tour ending"/);
        assert.equal(run.runs.manager.data.records["tour-complete"].unlocked, false);
      }
      w.dispose();
      if (run.levelFinished) break;
      run.confirm(); run.confirm();
    } while (run.active);
    assert.ok(run.lastMedal.medal >= 1);
    run.confirm(); assert.equal(run.state, S.MAP);
  }
  assert.equal(new AchievementManager(storage).data.records["tour-complete"].unlocked, true);
  const save = new CampaignSave(storage);
  assert.equal(save.entry("jake", "the-santor-gauntlet").medal, 1);
  assert.equal(save.entry("jake", finale.id).medal, 3);
  assert.equal(save.entry("brandon", finale.id).medal, 0);
  assert.ok(run.startLevel(finale.id)); run.confirm();
  const w = driveChapter(new PhysicsWorld(run.current, run.attemptArena, run.attemptSpec), finale);
  run.record(score(w), w); w.dispose();
  assert.ok(run.retryLevel()); assert.equal(run.stageIndex, 0); assert.equal(run.heats.length, 0);
  assert.equal(run.attemptArena.course, "freezer-aisle"); assert.equal(run.state, S.ACTIVE);
});

console.log(`${groups} Santor on Tour groups passed.`);
