import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { CHARACTERS } from "../js/characters.js";
import { UPGRADES, UPGRADE_IDS, normalizeUpgrades } from "../js/run-config.js";
import { normalizeRun, upgradeOffer } from "../js/run-save.js";
import { PhysicsWorld } from "../js/physics.js";
import { Input } from "../js/input.js";
import { ALL_LEVELS, evaluateMedal } from "../js/campaign-levels.js";
import { campaignFacts, combinedFacts } from "../js/campaign.js";
import { scoreAttempt } from "../js/scoring.js";
import { chapterControls, driveChapter } from "./chapter-helpers.mjs";
import { upgradeChoices, upgradeIcons, upgradeControls } from "../js/run-ui.js";
import { Renderer } from "../js/renderer.js";
import { ReplayRecording } from "../js/replay.js";
import { Effects } from "../js/effects.js";
import { TouchControls } from "../js/touch.js";
runInThisContext(readFileSync(new URL("../vendor/matter-0.20.0.min.js", import.meta.url), "utf8"));
const newIds = ["rocket-booster", "spring-launch", "focus", "air-brake", "bigger-wheels"];
const max = Object.fromEntries(UPGRADE_IDS.map(id => [id, UPGRADES[id].limit]));
const create = (upgrades = {}, c = CHARACTERS[0]) => new PhysicsWorld(c, undefined, { upgrades });
const normal = ALL_LEVELS[0];
const steer = w => chapterControls(w, normal);
function launch(w, target = "Perfect") {
  while (!w.launched && !w.finished) w.step(chapterControls(w, normal, { target }));
  assert.ok(w.launched && !w.crashed);
  return w;
}
function finish(w, action = () => {}) {
  for (let i = 0; i < 2500 && !w.finished; i++) {
    const controls = steer(w); action(w, controls); w.step(controls);
  }
  assert.ok(w.finished && !w.invalid);
  return scoreAttempt(w.metrics(), w.character);
}
const almost = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

// Old v1 runs retain counts, pending offers, seed and progress; new slots default to zero.
const oldCounts = Object.fromEntries(UPGRADE_IDS.filter(id => !newIds.includes(id)).map(id => [id, UPGRADES[id].limit]));
oldCounts["reinforced-wheels"] = 1;
const old = { version: 1, seed: 42, characterId: "jake", upgrades: oldCounts,
  claimed: [normal.id], cleared: [normal.id], pendingLevel: normal.id, offers: ["reinforced-wheels"] };
const migrated = normalizeRun(old);
assert.deepEqual({ ...migrated, upgrades: oldCounts }, old);
for (const [id, count] of Object.entries(oldCounts)) assert.equal(migrated.upgrades[id], count);
for (const id of newIds) assert.equal(migrated.upgrades[id], 0);
assert.deepEqual(normalizeUpgrades(max), max);
assert.deepEqual(upgradeOffer(max, 42, normal.id), []);
console.log("PASS old upgrade counts, IDs, pending rewards and limits survive");

for (const c of CHARACTERS) {
  const base = launch(create({}, c)), spring = launch(create({ "spring-launch": 2 }, c));
  almost(base.M.Body.getVelocity(base.cart).x, spring.M.Body.getVelocity(spring.cart).x);
  almost(base.M.Body.getVelocity(base.cart).y - spring.M.Body.getVelocity(spring.cart).y, UPGRADES["spring-launch"].lift * 2);
  const baseScore = finish(base), springScore = finish(spring);
  assert.ok(spring.landingTime - spring.launchTime > base.landingTime - base.launchTime);
  assert.ok(springScore.distanceMetres - baseScore.distanceMetres < 8);
  base.dispose(); spring.dispose();
  const good = launch(create({}, c), "Good"), goodSpring = launch(create({ "spring-launch": 2 }, c), "Good");
  assert.deepEqual(good.metrics(), goodSpring.metrics()); good.dispose(); goodSpring.dispose();

  const rocket = create({ "rocket-booster": 1 }, c);
  assert.equal(rocket.runEffects.rocket(rocket), false, "no ground boost");
  launch(rocket); const before = rocket.M.Body.getVelocity(rocket.cart);
  rocket.step({ pushes: 1, rotate: 0, brace: false });
  assert.ok(rocket.runEffects.rocketUsed && rocket.runEffects.rocketRemaining > 0);
  assert.ok(rocket.M.Body.getVelocity(rocket.cart).x > before.x);
  assert.equal(rocket.runEffects.rocket(rocket), false, "no repeat from more presses");
  const rocketScore = finish(rocket);
  assert.ok(rocketScore.distanceMetres > baseScore.distanceMetres && rocketScore.distanceMetres < baseScore.distanceMetres + 12);
  assert.ok(!rocket.crashed && rocket.attached, "boost preserves the assembly"); rocket.dispose();

  const brake = launch(create({ "air-brake": 1 }, c));
  brake.step({ pushes: 0, rotate: 0, brace: true });
  assert.ok(brake.runEffects.brakeUsed);
  assert.equal(brake.skills.braceAt, null, "early tap brakes without consuming brace");
  const brakeScore = finish(brake);
  assert.equal(brakeScore.braceGrade, "Perfect Brace");
  assert.ok(brakeScore.distanceMetres < baseScore.distanceMetres && brakeScore.distanceMetres > baseScore.distanceMetres - 10);
  assert.ok(!brake.crashed); brake.dispose();
  const lateBrake = create({ "air-brake": 1 }, c);
  const lateScore = finish(lateBrake);
  assert.equal(lateBrake.runEffects.brakeUsed, false);
  assert.equal(lateScore.braceGrade, "Perfect Brace", "first late Down still braces directly");
  assert.equal(lateScore.distanceMetres, baseScore.distanceMetres); lateBrake.dispose();
}
console.log("PASS all characters: bounded rocket/spring lift, braking distance, one use and normal bracing");

const focused = create({ focus: 1 }); let focusSteps = 0;
while (!focused.launched && !focused.finished) {
  focused.step(steer(focused));
  if (focused.runEffects.timeScale(focused) < 1) {
    focusSteps++;
    assert.ok(focused.skills.perfectStreak >= 5);
    assert.equal(focused.runEffects.timeScale(focused), .5);
  }
}
assert.ok(focusSteps > 0, "normal Perfect run-up reaches Focus before takeoff");
assert.equal(focused.runEffects.timeScale(focused), 1, "normal speed returns on takeoff");
focused.dispose();
const streak = create({ focus: 1 });
const approachX = streak.skills.config.takeoff.armedX - 100 - streak.cart.position.x;
for (const body of streak.dynamic) streak.M.Body.translate(body, { x: approachX, y: 0 });
streak.skills.pushes.Perfect = 6; streak.skills.perfectStreak = 4;
assert.equal(streak.runEffects.timeScale(streak), 1, "five total is insufficient for Focus");
streak.skills.perfectStreak = 5; assert.equal(streak.runEffects.timeScale(streak), .5);
streak.skills.perfectStreak = 0; assert.equal(streak.runEffects.timeScale(streak), 1, "Good/Miss resets Focus");
streak.dispose();
const wheels = create({ "bigger-wheels": 2 }), plain = create();
assert.ok(wheels.character.landingStability > plain.character.landingStability);
assert.equal(wheels.wheels[0].circleRadius, plain.wheels[0].circleRadius, "no geometry change to terrain contacts");
wheels.dispose(); plain.dispose();
console.log("PASS consecutive-streak Focus and Bigger Wheels stability");

// Each owned upgrade changes the cart drawing, including all eight older upgrades.
globalThis.window = new EventTarget(); window.devicePixelRatio = 1;
globalThis.document = new EventTarget();
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
const calls = [], ctx = new Proxy({}, { get: (_, name) => (...args) => calls.push([name, ...args]),
  set: (_, name, value) => { calls.push([name, value]); return true; } });
const renderer = new Renderer({ getContext: () => ctx, getBoundingClientRect: () => ({ width: 1200, height: 560 }) });
const draw = w => { calls.length = 0; renderer.drawVehicle(w); return JSON.stringify(calls); };
const stock = create(), stockArt = draw(stock); stock.dispose();
const art = new Set();
for (const id of UPGRADE_IDS) {
  const w = create({ [id]: 1 }); const snapshot = draw(w);
  assert.notEqual(snapshot, stockArt, id + " visible"); assert.ok(!art.has(snapshot), id + " distinct"); art.add(snapshot); w.dispose();
}
const equipped = launch(create(max));
equipped.step({ pushes: 1, brace: true, rotate: 0 });
const recording = new ReplayRecording(equipped); recording.capture(equipped, new Effects(), {});
const frame = recording.frames[0].world;
assert.deepEqual(frame.runEffects.upgrades, max);
assert.equal(draw(frame), draw(equipped), "replay attachments and active rocket/brake exactly match");
assert.notEqual(frame.runEffects.upgrades, equipped.runEffects.upgrades);
const reduced = draw(equipped); renderer.motionPreference = { matches: true };
assert.notEqual(draw(equipped), reduced, "flames are steady with reduced motion");
equipped.dispose(); renderer.destroy();
const run = { runs: { run: { upgrades: normalizeUpgrades({ "rocket-booster": 1 }), offers: newIds.slice(1, 4) } } };
const cards = upgradeChoices(run, label => `<button>${label}</button>`);
assert.equal((cards.match(/class="upgrade-card"/g) || []).length, 3);
assert.equal((cards.match(/class="upgrade-details"/g) || []).length, 3);
assert.match(cards, /●|○/); assert.match(cards, /<summary>Details<\/summary>/);
assert.match(upgradeIcons(run), /aria-label="Rocket Booster: 1 of 1 stacks/);
assert.match(upgradeControls(run), /Space \/ Up or BOOST/);
const boost = { dataset: { control: "boost", ready: "true" }, disabled: false, setAttribute() {} };
const touch = new TouchControls({ querySelectorAll: () => [boost], addEventListener() {}, removeEventListener() {} }, () => true, new EventTarget());
touch.press(boost, 1); assert.equal(touch.controls.pushes, 1);
touch.press(boost, 1); assert.equal(touch.controls.pushes, 1, "held BOOST does not repeat");
touch.clear(); assert.equal(touch.controls.pushes, 0); touch.destroy();
let confirmed = 0;
const input = new Input({ isActive: () => false, onConfirm: () => confirmed++, onRestart() {}, onSuspend() {} });
for (const code of ["Enter", "Space"]) {
  const event = new Event("keydown", { cancelable: true });
  Object.defineProperties(event, { code: { value: code }, target: { value: { closest: selector => selector === "summary" ? {} : null } } });
  window.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false, "Details keeps native keyboard activation");
}
assert.equal(confirmed, 0); input.destroy();
console.log("PASS distinct attachment art, identical replay, reduced motion, cards and touch boost");

// Fully stacked carts still have an ordinary-input Bronze route on every level.
// These assists never alter the medal rules or fabricate successful facts.
let routes = 0;
for (const c of CHARACTERS) for (const level of ALL_LEVELS) {
  const heats = [];
  for (const stage of level.stages || [level]) {
    const w = new PhysicsWorld(c, stage.arena || level.arena, { upgrades: max, condition: stage.condition });
    driveChapter(w, level);
    const score = scoreAttempt(w.metrics(), w.character);
    assert.ok(w.finished && !w.invalid, c.id + "/" + level.id);
    heats.push({ score, facts: campaignFacts(score, w, w.launched) }); w.dispose();
  }
  const facts = level.stages ? combinedFacts(heats) : heats[0].facts;
  assert.ok(evaluateMedal(level, facts).medal >= 1, `${c.id}/${level.id}: ${JSON.stringify(facts)}`);
  routes++;
}
console.log(`PASS ${routes} fully upgraded Bronze routes across main, Tour, After Hours and finales`);
